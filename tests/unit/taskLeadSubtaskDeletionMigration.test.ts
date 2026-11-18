import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {expect,it} from 'vitest';
import baseline from '../fixtures/subtaskParticipationBaseline.json';

const root='20000000-0000-4000-8000-000000000001',node='40000000-0000-4000-8000-000000000001';
const taskLead='30000000-0000-4000-8000-000000000001',subLead='30000000-0000-4000-8000-000000000002',worker='30000000-0000-4000-8000-000000000003';
const head='30000000-0000-4000-8000-000000000004';
const sql=(name:string)=>readFile(new URL(`../../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
const migration=()=>sql('20261119020000_task_lead_only_subtask_deletion');
const actor=(db:PGlite,id=taskLead)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
async function database(){
 const db=await PGlite.create();
 await db.exec(await readFile(new URL('../fixtures/subtaskParticipationDatabase.sql',import.meta.url),'utf8'));
 await db.exec(`set check_function_bodies=off;
  alter table public.tasks add column proposed_office_identity_id uuid;
  create table public.subtask_submissions(subtask_id uuid);
  create table public.work_budget_allocations(subtask_id uuid);
  create table public.petty_cash_requests(subtask_id uuid);
  create table public.budget_ledger_entries(subtask_id uuid);
  create schema eflow_r9;
  create function eflow_r9.internal(uuid) returns boolean language sql stable as $$select false$$;
  create function eflow_r7.chain(uuid,uuid) returns boolean language sql stable as $$select true$$;
  create or replace function eflow_r7.manage(uuid,uuid) returns boolean language sql stable as $$
   select auth.uid()=t.assigned_to or auth.uid()=s.lead_id or auth.uid()='${head}'::uuid
   from public.tasks t left join public.subtasks s on s.task_id=t.id and s.id=$2 where t.id=$1$$;`);
 for(const row of baseline)await db.exec(row.definition);
 const source=await sql('20261118091500_active_subtask_planning_lock_and_direct_task_staffing');
 for(const name of ['node_capabilities_fast','guard_node']){
  const definition=source.match(new RegExp(`create or replace function eflow_r7\\.${name}\\([\\s\\S]*?\\$\\$;`,'i'))![0];
  await db.exec(definition);
 }
 await db.exec(`set check_function_bodies=on;
  update public.subtasks set status='todo',percent_complete=0,started_at=null;
  create trigger node_bounds before delete on public.subtasks for each row execute function eflow_r7.guard_node();
  revoke all on function eflow_r7.guard_node() from public;`);
 for(const name of ['20261118152250_restrict_subtask_execution_to_assigned_team','20261119010000_task_lead_subtask_contributor_review'])await db.exec(await sql(name));
 await actor(db);return db;
}
async function capabilities(db:PGlite,dirty=false){
 const rows=(await db.query<{normal:Record<string,{allowed:boolean;reason_code:string|null}>;fast:Record<string,{allowed:boolean;reason_code:string|null}>}>(`
  select eflow_r7.operation_capabilities($1,$2) as normal,
  eflow_r7.node_capabilities_fast($1,$2,eflow_r7.root($1),true,auth.uid()=$3,false,false,true,true,
   case when $4 then array[$2::uuid] else '{}'::uuid[] end,'active',false) as fast`,[root,node,head,dirty])).rows[0];
 return [rows.normal,rows.fast];
}
const remove=(db:PGlite)=>db.query('delete from public.subtasks where id=$1',[node]);

it('removes Subtask Lead deletion from both capability paths and internal commands while retaining edit rights and privileges',async()=>{
 const db=await database();try{
  await actor(db,subLead);for(const cap of await capabilities(db))expect(cap.delete.allowed).toBe(true);
  const meta="select oid,proowner,proacl,prosecdef,proconfig from pg_proc where proname in ('operation_capabilities','node_capabilities_fast','guard_node') order by oid";
  const before=await db.query(meta);await db.exec(await migration());expect(await db.query(meta)).toEqual(before);
  for(const cap of await capabilities(db)){expect(cap.delete).toMatchObject({allowed:false,reason_code:'branch_denied'});expect(cap.edit_details.allowed).toBe(true);}
  await expect(remove(db)).rejects.toThrow('Only the Task Lead can delete this subtask');
  await db.query('insert into eflow_r7.mutations values(txid_current(),$1,$2)',[subLead,root]);
  // Same transaction marker as versioned commands: it must not bypass deletion authority.
  await db.exec('begin');
  await db.query('insert into eflow_r7.mutations values(txid_current(),$1,$2)',[subLead,root]);
  await expect(remove(db)).rejects.toThrow('Only the Task Lead can delete this subtask');await db.exec('rollback');
  expect((await db.query('select id from public.subtasks')).rows).toHaveLength(1);
 }finally{await db.close();}
},30_000);

it('retains clean Task Lead deletion without requiring execution membership',async()=>{
 const db=await database();try{
  await db.exec(await migration());
  for(const cap of await capabilities(db)){expect(cap.delete.allowed).toBe(true);expect(cap.edit_details.allowed).toBe(true);expect(cap.execute.allowed).toBe(false);}
  await remove(db);expect((await db.query('select id from public.subtasks')).rows).toHaveLength(0);
 }finally{await db.close();}
},30_000);

it.each([head,worker])('does not let another appointment or contribution delete Office work: %s',async id=>{
 const db=await database();try{
  await db.exec(await migration());await actor(db,id);
  for(const cap of await capabilities(db))expect(cap.delete.allowed).toBe(false);
  await expect(remove(db)).rejects.toThrow('Only the Task Lead can delete this subtask');
 }finally{await db.close();}
},30_000);

it('retains started-work and history restrictions for the Task Lead',async()=>{
 const db=await database();try{
  await db.exec(await migration());
  for(const mutation of ["status='in_progress'","percent_complete=1","started_at=now()"]){
   await db.exec(`update public.subtasks set status='todo',percent_complete=0,started_at=null;update public.subtasks set ${mutation}`);
   for(const cap of await capabilities(db))expect(cap.delete.allowed).toBe(false);
   await expect(remove(db)).rejects.toThrow('Started work and history cannot be deleted');
  }
  await db.exec("update public.subtasks set status='todo',percent_complete=0,started_at=null");
  for(const table of ['subtask_progress_updates','subtask_submissions','work_budget_allocations','petty_cash_requests','budget_ledger_entries']){
   await db.query(`insert into public.${table}(subtask_id) values($1)`,[node]);
   for(const cap of await capabilities(db,true))expect(cap.delete.allowed).toBe(false);
   await expect(remove(db)).rejects.toThrow('Evidence, progress, budget and cash history prevent deletion');
   await db.exec(`delete from public.${table}`);
  }
 }finally{await db.close();}
},30_000);

it('rejects deletion when a descendant has started even if its status/progress have not advanced',async()=>{
 const db=await database();try{
  await db.exec(await migration());
  await db.query(`insert into public.subtasks(id,task_id,parent_subtask_id,lead_id,status,percent_complete,started_at)
   values('40000000-0000-4000-8000-000000000002',$1,$2,$3,'todo',0,now())`,[root,node,subLead]);
  for(const cap of await capabilities(db))expect(cap.delete.allowed).toBe(false);
 }finally{await db.close();}
},30_000);

it('aborts on baseline drift before changing any deletion function',async()=>{
 const db=await database();try{
  await db.exec(`create or replace function eflow_r7.guard_node() returns trigger language plpgsql security definer set search_path='' as $$begin return old;end$$;`);
  await expect(db.exec(await migration())).rejects.toThrow('Hosted function changed; review Task Lead deletion migration');
  await db.exec('rollback');await actor(db,subLead);
  for(const cap of await capabilities(db))expect(cap.delete.allowed).toBe(true);
 }finally{await db.close();}
},30_000);
