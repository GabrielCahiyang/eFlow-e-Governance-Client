import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
import baseline from '../fixtures/subtaskParticipationBaseline.json';

const root='20000000-0000-4000-8000-000000000001',node='40000000-0000-4000-8000-000000000001';
const taskLead='30000000-0000-4000-8000-000000000001',subLead='30000000-0000-4000-8000-000000000002';
const worker='30000000-0000-4000-8000-000000000003',head='30000000-0000-4000-8000-000000000004';
const sql=(name:string)=>readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
const migration=()=>sql('20261119010000_task_lead_subtask_contributor_review');
const actor=(db:PGlite,id=taskLead)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const update=(db:PGlite)=>db.query("select public.save_subtask_work_update($1,'stuck','Waiting for equipment','Contributor update',null,null,null)",[node]);
const reviewer=async(db:PGlite,author=taskLead,kind='progress',id:string|null=node)=>(await db.query<{id:string|null}>('select eflow_m7.work_reviewer($1,$2,$3,$4) as id',[root,id,author,kind])).rows[0].id;
const privileges=(db:PGlite)=>db.query("select oid,proowner,proacl,prosecdef,proconfig from pg_proc where oid in ('eflow_m7.work_reviewer(uuid,uuid,uuid,text)'::regprocedure,'eflow_m7.require_progress_authority(uuid,uuid)'::regprocedure,'eflow_evidence.guard_progress()'::regprocedure) order by oid");

async function database(){
 const db=await PGlite.create();
 await db.exec(await readFile(new URL('../fixtures/subtaskParticipationDatabase.sql',import.meta.url),'utf8'));
 await db.exec(`set check_function_bodies=off;
  alter table public.tasks add column team_member_ids uuid[];
  alter table public.personal_tasks add column lead_id uuid;
  create table public.organizations(id uuid,head_user_id uuid);
  create or replace function eflow_r7.manage(uuid,uuid) returns boolean language sql stable as $$
   select auth.uid()=t.assigned_to or auth.uid()=s.lead_id or exists(select 1 from public.organizations o where o.id=t.org_id and o.head_user_id=auth.uid())
   from public.tasks t left join public.subtasks s on s.task_id=t.id and s.id=$2 where t.id=$1$$;
  create function eflow_r7.chain(uuid,uuid) returns boolean language sql stable as $$select true$$;
  create function public.phase2_is_office_head(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.organizations where id=$2 and head_user_id=$1)$$;`);
 // Keep the existing ancestor/Office-Head resolver rather than inventing a new reviewer.
 const original=await sql('20261008035748_r7_project_members_and_nested_work');
 const resolver=original.match(/create function eflow_r7\.reviewer\(p_node uuid,p_submitter uuid\)[\s\S]*?end \$\$;/)![0];
 await db.exec(resolver.replace('create function','create or replace function'));
 for(const row of baseline)await db.exec(row.definition);
 await db.exec(`set check_function_bodies=on;
  revoke all on function eflow_m7.work_reviewer(uuid,uuid,uuid,text),eflow_m7.require_progress_authority(uuid,uuid),eflow_evidence.guard_progress() from public;
  create trigger protect_progress before insert or update on public.subtask_progress_updates for each row execute function eflow_evidence.guard_progress();
  insert into public.organizations values('10000000-0000-4000-8000-000000000002','${head}');
  update public.tasks set team_member_ids=array['${worker}'::uuid];
  update public.subtasks set assigned_to_ids=array_append(assigned_to_ids,'${taskLead}'::uuid);`);
 await db.exec(await sql('20261118152250_restrict_subtask_execution_to_assigned_team'));
 await actor(db);return db;
}

it('routes an assigned Task Lead contributor to independent review and rejects direct writes without changing privileges',async()=>{
 const db=await database();try{
  expect(await reviewer(db)).toBeNull();await update(db);
  const before=await privileges(db);await db.exec(await migration());expect(await privileges(db)).toEqual(before);
  expect(await reviewer(db)).toBe(head);expect(await reviewer(db,taskLead,'completion')).toBe(head);
  await expect(update(db)).rejects.toThrow('Contributor changes must be submitted for Lead review');
  await expect(db.query('insert into public.subtask_progress_updates(subtask_id,task_id,author_id,percent_complete) values($1,$2,$3,43)',[node,root,taskLead])).rejects.toThrow('Contributor changes must be submitted for Lead review');
  await db.query('select eflow_m7.require_progress_authority($1,null)',[root]);
 }finally{await db.close();}
},30_000);

it.each(['progress','completion'])('applies an assigned Task Lead contributor %s only after an independent decision',async kind=>{
 const db=await database();try{
  await db.exec(await migration());
  const proposal='50000000-0000-4000-8000-000000000001',request='50000000-0000-4000-8000-000000000002';
  const chosen=await reviewer(db,taskLead,kind);expect(chosen).toBe(head);
  await db.query(`insert into eflow_m7.work_proposals(id,root_id,node_id,author_id,reviewer_id,kind,state,submitted_as_lead,terms,baseline)
   values($1,$2,$3,$4,$5,$6,'pending',false,$7,'{}')`,[proposal,root,node,taskLead,chosen,kind,JSON.stringify({note:'Contributor update',blocker:'Waiting for equipment'})]);
  expect((await db.query('select * from public.subtask_progress_updates')).rows).toHaveLength(0);
  await expect(db.query('select eflow_m7.decide_work($1,$2,true,null)',[proposal,request])).rejects.toThrow('Current assigned review required');
  await actor(db,head);await db.query('select eflow_m7.decide_work($1,$2,true,null)',[proposal,request]);
  expect((await db.query<{state:string}>('select state from eflow_m7.work_proposals where id=$1',[proposal])).rows[0].state).toBe('approved');
  expect((await db.query<{blocker:string}>('select blocker from public.subtask_progress_updates')).rows[0].blocker).toBe('Waiting for equipment');
  expect((await db.query('select status,percent_complete from public.subtasks where id=$1',[node])).rows[0]).toMatchObject({status:'in_progress',percent_complete:43});
  expect((await db.query('select * from eflow_m7.applying_work_proposal')).rows).toHaveLength(0);
  await actor(db);await expect(update(db)).rejects.toThrow('Contributor changes must be submitted for Lead review');
 }finally{await db.close();}
},30_000);

it('fails closed for revoked membership, wrong node, self-review and unavailable independent reviewers',async()=>{
 const db=await database();try{
  await db.exec(await migration());
  expect(await reviewer(db,taskLead,'progress','40000000-0000-4000-8000-000000000099')).toBeNull();
  await db.query('update public.subtasks set assigned_to_ids=array[null::uuid] where id=$1',[node]);
  expect(await reviewer(db)).toBeNull();await expect(update(db)).rejects.toThrow('Only this subtask lead or an assigned contributor');
  await db.query('update public.subtasks set assigned_to_ids=array[$1::uuid] where id=$2',[taskLead,node]);
  await db.query('update public.organizations set head_user_id=$1',[taskLead]);
  expect(await reviewer(db)).toBeNull();expect(await reviewer(db,taskLead,'completion')).toBeNull();
  await expect(update(db)).rejects.toThrow('Contributor changes must be submitted for Lead review');
  await db.exec('update public.organizations set head_user_id=null');expect(await reviewer(db)).toBeNull();
 }finally{await db.close();}
},30_000);

it('retains ordinary contributor review, ancestor routing and appointed Subtask Lead direct updates',async()=>{
 const db=await database();try{
  await db.exec(await migration());expect(await reviewer(db,worker)).toBe(taskLead);
  await actor(db,subLead);await update(db);
  const parent='40000000-0000-4000-8000-000000000002';
  await db.query('insert into public.subtasks(id,task_id,lead_id,status) values($1,$2,$3,\'in_progress\')',[parent,root,subLead]);
  await db.query('update public.subtasks set parent_subtask_id=$1 where id=$2',[parent,node]);
  expect(await reviewer(db)).toBe(subLead);
  await actor(db);await db.query('update public.subtasks set lead_id=$1 where id=$2',[taskLead,node]);
  await update(db);expect(await reviewer(db)).toBeNull();expect(await reviewer(db,taskLead,'completion')).toBeNull();
 }finally{await db.close();}
},30_000);

it('rolls back on function drift without changing the previously applied participation rule',async()=>{
 const db=await database();try{
  await db.exec(`create or replace function eflow_m7.work_reviewer(p_root uuid,p_node uuid,p_author uuid,p_kind text) returns uuid language plpgsql stable security definer set search_path='' as $$begin return null;end$$;`);
  await expect(db.exec(await migration())).rejects.toThrow('Hosted function changed; review Task Lead contributor migration');
  await db.exec('rollback;');await update(db);
 }finally{await db.close();}
},30_000);
