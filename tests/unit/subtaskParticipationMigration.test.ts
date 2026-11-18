import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
import baseline from '../fixtures/subtaskParticipationBaseline.json';

const root='20000000-0000-4000-8000-000000000001',node='40000000-0000-4000-8000-000000000001';
const taskLead='30000000-0000-4000-8000-000000000001',subLead='30000000-0000-4000-8000-000000000002',worker='30000000-0000-4000-8000-000000000003';
const migration=()=>readFile(new URL('../../supabase/migrations/20261118152250_restrict_subtask_execution_to_assigned_team.sql',import.meta.url),'utf8');
async function actor(db:PGlite,id=taskLead){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function database(){
 const db=await PGlite.create();
 await db.exec(await readFile(new URL('../fixtures/subtaskParticipationDatabase.sql',import.meta.url),'utf8'));
 await db.exec('set check_function_bodies=off;');
 for(const item of baseline)await db.exec(item.definition);
 await db.exec(`set check_function_bodies=on;
  revoke all on function eflow_m7.require_progress_authority(uuid,uuid) from public;
  create trigger protect_progress before insert or update on public.subtask_progress_updates for each row execute function eflow_evidence.guard_progress();`);
 await actor(db);return db;
}
const update=(db:PGlite)=>db.query(`select public.save_subtask_work_update($1,'stuck','Waiting for equipment','Latest work','Follow up',null,null)`,[node]);
const capabilities=async(db:PGlite)=>(await db.query<{cap:{execute:{allowed:boolean};submit:{allowed:boolean}}}>('select eflow_r7.operation_capabilities($1,$2) as cap',[root,node])).rows[0].cap;

it('rejects unassigned Task Lead updates through capabilities, the RPC, and direct history writes while preserving privileges',async()=>{
 const db=await database();try{
  expect((await capabilities(db)).execute.allowed).toBe(true);await update(db);
  const before=await db.query("select oid,proowner,proacl,prosecdef,proconfig from pg_proc where oid in ('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure,'eflow_m7.require_progress_authority(uuid,uuid)'::regprocedure,'eflow_evidence.guard_progress()'::regprocedure) order by oid");
  await db.exec(await migration());
  expect(await db.query("select oid,proowner,proacl,prosecdef,proconfig from pg_proc where oid in ('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure,'eflow_m7.require_progress_authority(uuid,uuid)'::regprocedure,'eflow_evidence.guard_progress()'::regprocedure) order by oid")).toEqual(before);
  const cap=await capabilities(db);expect(cap.execute.allowed).toBe(false);expect(cap.submit.allowed).toBe(false);
  // The same user remains permitted to post on their own root Task.
  await db.query('select eflow_m7.require_progress_authority($1,null)',[root]);
  await expect(update(db)).rejects.toThrow('Only this subtask lead or an assigned contributor');
  await expect(db.query('insert into public.subtask_progress_updates(subtask_id,task_id,author_id,percent_complete) values($1,$2,$3,43)',[node,root,taskLead])).rejects.toThrow('Only this subtask lead or an assigned contributor');
  expect((await db.query<{count:number}>('select count(*)::integer as count from public.subtask_progress_updates')).rows[0].count).toBe(1);
  await db.exec("select set_config('eflow.subtask_workflow_authorized','on',false)");
  await expect(update(db)).rejects.toThrow('Only this subtask lead or an assigned contributor');
 }finally{await db.close();}
},30_000);

it('retains assigned Subtask Lead updates, contributor review requirements, and explicit Task Lead membership',async()=>{
 const db=await database();try{
  await db.exec(await migration());await actor(db,subLead);await update(db);
  await actor(db,worker);expect((await capabilities(db)).execute.allowed).toBe(true);
  await expect(update(db)).rejects.toThrow('Contributor changes must be submitted for Lead review');
  await db.query('update public.subtasks set assigned_to_ids=array_append(assigned_to_ids,$1::uuid) where id=$2',[taskLead,node]);
  await actor(db);expect((await capabilities(db)).execute.allowed).toBe(true);await update(db);
  await db.query('update public.subtasks set assigned_to_ids=array[null::uuid] where id=$1',[node]);
  expect((await capabilities(db)).execute.allowed).toBe(false);await expect(update(db)).rejects.toThrow('Only this subtask lead or an assigned contributor');
 }finally{await db.close();}
},30_000);

it.each(['progress','completion'])('preserves independent Lead approval of a submitted %s without enabling unassigned direct execution',async kind=>{
 const db=await database();try{
  await db.exec(await migration());const proposal='50000000-0000-4000-8000-000000000001';
  await db.query(`insert into eflow_m7.work_proposals(id,root_id,node_id,author_id,reviewer_id,kind,state,submitted_as_lead,terms,baseline)
   values($1,$2,$3,$4,$5,$6,'pending',$7,$8,'{}')`,[proposal,root,node,kind==='completion'?subLead:worker,taskLead,kind,kind==='completion',JSON.stringify({note:'Submitted work',...(kind==='progress'?{blocker:'Waiting for equipment'}:{})})]);
  await db.query("select eflow_m7.decide_work($1,$2,true,'Accepted')",[proposal,'50000000-0000-4000-8000-000000000002']);
  expect((await db.query<{state:string}>('select state from eflow_m7.work_proposals where id=$1',[proposal])).rows[0].state).toBe('approved');
  const history=(await db.query<{blocker:string|null;percent_complete:number}>('select blocker,percent_complete from public.subtask_progress_updates order by created_at desc')).rows;
  expect(history[0]).toMatchObject(kind==='completion'?{percent_complete:100,blocker:null}:{blocker:'Waiting for equipment',percent_complete:43});
  expect((await db.query('select * from eflow_m7.applying_work_proposal')).rows).toHaveLength(0);
  await expect(update(db)).rejects.toThrow('Only this subtask lead or an assigned contributor');
 }finally{await db.close();}
},30_000);

it('rolls back on hosted-function drift',async()=>{
 const db=await database();try{
  await db.exec(`create or replace function eflow_m7.require_progress_authority(p_root uuid,p_node uuid) returns void language plpgsql security definer set search_path='' as $$begin return;end$$;`);
  await expect(db.exec(await migration())).rejects.toThrow('Hosted function changed; review subtask participation migration');
  await db.exec('rollback;');expect((await capabilities(db)).execute.allowed).toBe(true);
 }finally{await db.close();}
},30_000);
