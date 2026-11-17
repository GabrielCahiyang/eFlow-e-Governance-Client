// Disposable local PostgreSQL only; identity/permission helpers are synthetic.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
if(!process.env.EFLOW_WEB_SOURCE)throw new Error('Set EFLOW_WEB_SOURCE; no dependencies are downloaded.');
const require=createRequire(path.join(path.resolve(process.env.EFLOW_WEB_SOURCE),'package.json'));
const {PGlite}=require('@electric-sql/pglite');
const folder=new URL('../docs/mobile-redesign/backend-review/subtask-planning/',import.meta.url);
const original=JSON.parse(fs.readFileSync(new URL('task-delete-baseline.json',folder),'utf8')).rows[0];
const sql=fs.readFileSync(new URL('20261116010000_unstarted_task_delete_REVIEW.sql',folder),'utf8');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [H,P,C,T,O,PR]=[1,2,3,4,5,6].map(id);
let checks=0;
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const actor=who=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);
const remove=()=>db.query('select public.soft_delete_task($1)',[T]);
const deny=async(op,pattern)=>{await assert.rejects(op,pattern);checks++;};
const reset=()=>db.exec(`update public.tasks set status='todo',percent_complete=0,deleted_at=null;delete from public.task_status_history;delete from public.subtasks;`);
try{
 await db.exec(`create schema auth;create schema eflow_publication;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid,full_name text);
 create table public.tasks(id uuid,status text,percent_complete int,deleted_at timestamptz,last_activity_at timestamptz,org_id uuid,linked_project_id uuid);
 create table public.task_status_history(task_id uuid,to_status text);
 create table public.subtasks(task_id uuid,status text,started_at timestamptz,percent_complete int);
 create table public.audit_events(actor_id uuid,actor_name text,entity_type text,entity_id text,action text,before_data jsonb,after_data jsonb,org_id uuid);
 create function public.can_manage_task(uuid,uuid) returns boolean language sql stable as $$select $1='${T}'::uuid and $2='${H}'::uuid$$;
 create function eflow_publication.planning_lead(uuid,uuid) returns boolean language sql stable as $$select $1='${PR}'::uuid and $2='${O}'::uuid and auth.uid()='${P}'::uuid$$;
 insert into public.profiles values('${H}','Synthetic Head'),('${P}','Synthetic Project Lead'),('${C}','Synthetic contributor');
 insert into public.tasks values('${T}','in_progress',0,null,null,'${O}','${PR}');`);
 await db.exec(original.definition);
 await actor(H);await remove();
 check((await db.query('select deleted_at is not null as deleted from public.tasks')).rows[0].deleted,true);
 await reset();await db.exec(sql);
 for(const status of ['in_progress','for_review','changes_requested','completed','cancelled']){
  await reset();await db.query('update public.tasks set status=$1',[status]);
  await deny(remove(),/Only an unstarted task/);
  check((await db.query('select deleted_at is null as retained from public.tasks')).rows[0].retained,true);
 }
 for(const status of ['todo','pending_assignment']){
  await reset();await actor(P);await db.query('update public.tasks set status=$1',[status]);await remove();
  check((await db.query('select deleted_at is not null as deleted from public.tasks')).rows[0].deleted,true);
 }
 await reset();await actor(H);
 await db.query('insert into public.task_status_history values($1,$2)',[T,'in_progress']);
 await deny(remove(),/Only an unstarted task/);
 await reset();await db.query("insert into public.subtasks values($1,'todo',now(),0)",[T]);
 await deny(remove(),/Only an unstarted task/);
 await reset();await db.query('update public.tasks set percent_complete=10');
 await deny(remove(),/Only an unstarted task/);
 await reset();await actor(C);await deny(remove(),/Not allowed/);
 await deny(db.exec(sql),/baseline differs/);await db.exec('rollback');
 console.log(JSON.stringify({checks,status:'PASS',environment:'disposable local PGlite',limitations:'Synthetic permission/identity helpers; real RLS, other triggers, concurrent sessions and hosted/device workflows not verified.',productionMutations:0},null,2));
}finally{await db.close();}
