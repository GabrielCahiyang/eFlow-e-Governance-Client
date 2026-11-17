// Disposable PostgreSQL only. Identity, membership, finance and file-scope adapters
// are synthetic; this is not staging, authenticated-device or production acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
if(!process.env.EFLOW_WEB_SOURCE)throw new Error('Set EFLOW_WEB_SOURCE; no dependencies are downloaded.');
const require=createRequire(path.join(path.resolve(process.env.EFLOW_WEB_SOURCE),'package.json'));
const {PGlite}=require('@electric-sql/pglite');
const folder=new URL('../docs/mobile-redesign/backend-review/subtask-planning/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,folder),'utf8'));
const evidence=read('visibility-baseline.json').rows[0].evidence;
const files=read('visibility-file-functions.json').rows;
const fileDeps=read('visibility-file-dependencies.json').rows;
let migration=fs.readFileSync(new URL('20261116020000_parent_task_subtask_visibility_REVIEW.sql',folder),'utf8');
const crlf=process.argv.includes('--crlf-sql');if(crlf)migration=migration.replace(/\r?\n/g,'\r\n');
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [R,S,C,H,X,T,N,PR,O,W,PT,PN]=[1,2,3,4,5,6,7,8,9,10,11,12].map(id);
const request=id(13), filePath=`${S}/${T}/${N}/${request}/evidence.pdf`, evidencePath=`subtasks/${N}/${request}/evidence.pdf`;
const taskPath=`${T}/${request}/task.pdf`, personalPath=`${C}/${PT}/${PN}/${request}/personal.pdf`;
let checks=0;
const check=(a,b)=>{assert.deepEqual(a,b);checks++;};
const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const actor=async who=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await db.exec('set role authenticated');};
const rootTree=()=>value('select public.r7_work_tree($1)',[T]);
const count=table=>value(`select count(*)::int from ${table}`);
const setParent=async(status)=>{await db.exec('reset role');await db.query('update public.tasks set status=$1 where id=$2',[status,T]);};
try{
 await db.exec(`create role authenticated;create schema auth;create schema eflow_r7;create schema eflow_m7;create schema eflow_r3;create schema eflow_publication;create schema eflow_schedule;create schema eflow_evidence;create schema storage;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.profiles(id uuid,full_name text,org_id uuid,is_active boolean default true);
 create table public.projects(id uuid,start_date date,target_date date);
 create table public.tasks(id uuid,assigned_to uuid,recommendation_lead_id uuid,status text,deleted_at timestamptz,org_id uuid,linked_project_id uuid,start_date date,deadline text,due_date text,team_member_ids uuid[] default '{}');
 create table public.task_status_history(task_id uuid,to_status text);
 create table public.subtasks(id uuid,task_id uuid,parent_subtask_id uuid,lead_id uuid,assigned_to uuid,reviewer_id uuid,assigned_to_ids uuid[],title text,status text,sibling_order int,percent_complete int,due_date date,start_date date,started_at timestamptz,priority text,dependency_ids uuid[]);
 create table public.personal_subtasks(like public.subtasks);
 create view eflow_r7.nodes as select s.*,'office'::text kind from public.subtasks s union all select s.*,'personal'::text kind from public.personal_subtasks s;
 create table eflow_r7.tree_state(root_id uuid,revision int);
 create table public.subtask_progress_updates(task_id uuid,subtask_id uuid);
 create table public.subtask_submissions(task_id uuid,subtask_id uuid);
 create table public.subtask_submission_attachments(task_id uuid,subtask_id uuid,file_path text);
 create table public.work_tree_events(root_id uuid,node_id uuid,before_data jsonb,after_data jsonb);
 create table public.notifications(task_id uuid,work_node_id uuid);
 create table storage.objects(bucket_id text,name text,owner_id text);
 create table eflow_evidence.objects(bucket_id text,object_name text,state text,task_id uuid,subtask_id uuid);
 create table eflow_m7.work_proposals(id uuid,root_id uuid,node_id uuid,author_id uuid,reviewer_id uuid,kind text,state text,terms jsonb);
 insert into public.profiles(id,full_name,org_id) select v,'Synthetic '||v,'${O}' from unnest(array['${R}','${S}','${C}','${H}','${X}','${W}']::uuid[]) v;
 insert into public.projects values('${PR}','2026-11-16','2026-11-20');
 insert into public.tasks(id,assigned_to,status,org_id,linked_project_id,start_date,due_date,team_member_ids) values('${T}','${R}','todo','${O}','${PR}','2026-11-16','2026-11-20',array['${R}','${C}']::uuid[]);
 insert into public.subtasks(id,task_id,lead_id,assigned_to,assigned_to_ids,title,status,sibling_order,percent_complete,start_date,priority) values('${N}','${T}','${S}','${S}',array['${S}','${W}']::uuid[],'Hidden agenda','todo',0,0,'2026-11-16','medium');
 insert into public.personal_subtasks(id,task_id,lead_id,assigned_to,assigned_to_ids,title,status,sibling_order,percent_complete) values('${PN}','${PT}','${C}','${C}',array['${C}']::uuid[],'Personal work','todo',0,0);
 insert into public.subtask_progress_updates values('${T}','${N}');insert into public.subtask_submissions values('${T}','${N}');
 insert into public.subtask_submission_attachments values('${T}','${N}','${evidencePath}');
 insert into public.work_tree_events values('${T}',null,'{"nodes":[{"id":"${N}"}]}','{}');
 insert into public.notifications values('${T}','${N}');
 insert into storage.objects values('task-attachments','${evidencePath}','${S}'),('m7-work-evidence','${filePath}','${S}'),('task-attachments','${taskPath}','${C}'),('m7-work-evidence','${personalPath}','${C}'),('task-attachments','subtasks/${N}/${request}/sealed.pdf','${S}');
 insert into eflow_evidence.objects values('task-attachments','subtasks/${N}/${request}/sealed.pdf','ready','${T}','${N}');
 -- Synthetic identity/scope/finance/activation adapters; no production account or RLS bypass.
 create function public.can_see_task(uuid,uuid) returns boolean language sql stable security definer as $$select $1='${T}'::uuid and $2 in ('${R}'::uuid,'${S}'::uuid,'${C}'::uuid,'${H}'::uuid)$$;
 create function eflow_r3.eligible(uuid) returns boolean language sql stable as $$select $1 is not null and $1<>'${X}'::uuid$$;
 create function eflow_r7.root(uuid) returns jsonb language sql stable security definer as $$select case when $1='${PT}'::uuid then jsonb_build_object('id',$1,'project','${PR}','office',null,'kind','personal','lead','${C}','people','[]'::jsonb,'open',true,'status','todo') else (select jsonb_build_object('id',id,'project',linked_project_id,'office',org_id,'kind','office','lead',assigned_to,'people',to_jsonb(team_member_ids),'open',true,'status',status) from public.tasks where id=$1) end$$;
 create function eflow_r7.read_root(uuid) returns boolean language sql stable security definer as $$select case when $1='${PT}'::uuid then auth.uid()='${C}'::uuid else public.can_see_task($1,auth.uid()) end$$;
 create function eflow_r7.member(uuid,uuid,uuid) returns boolean language sql stable as $$select $3 in ('${R}'::uuid,'${S}'::uuid,'${C}'::uuid,'${H}'::uuid)$$;
 create function eflow_r7.operation_capabilities(uuid,uuid default null) returns jsonb language sql stable as $$select '{}'::jsonb$$;
 create function eflow_publication.manage_plan(uuid,uuid,boolean default false) returns boolean language sql stable as $$select auth.uid()='${R}'::uuid$$;
 create function eflow_r7.node_work(uuid,uuid) returns boolean language sql stable as $$select $2='${S}'::uuid$$;
 create function eflow_r7.pending_reviewer(uuid) returns uuid language sql stable as $$select '${R}'::uuid$$;
 create function eflow_r7.head(uuid) returns boolean language sql stable as $$select auth.uid()='${H}'::uuid$$;
 create function eflow_m7.personal_node_visible(uuid,uuid) returns boolean language sql stable as $$select $1='${PT}'::uuid and auth.uid()='${C}'::uuid$$;
 create function eflow_m7.work_day(uuid) returns date language sql as $$select '2026-11-16'::date$$;
 create function eflow_publication.with_subtask_staffing(jsonb) returns jsonb language sql as $$select $1$$;
 create function eflow_r7.subtask_dependency_scope(uuid) returns boolean language sql as $$select true$$;
 create function eflow_schedule.calendar_day(text) returns date language sql as $$select nullif(left($1,10),'')::date$$;
 create function eflow_evidence.active_actor() returns boolean language sql as $$select eflow_r3.eligible(auth.uid())$$;
 create function eflow_m7.proposal_file_scope(text) returns table(author uuid,root uuid,node uuid,request uuid) language sql stable as $$select '${S}'::uuid,'${T}'::uuid,'${N}'::uuid,'${request}'::uuid where $1='${filePath}' union all select '${C}'::uuid,'${PT}'::uuid,'${PN}'::uuid,'${request}'::uuid where $1='${personalPath}'$$;
 create function eflow_m7.node_activated(uuid,uuid) returns boolean language sql as $$select false$$;
 create function eflow_m7.personal_node_activated(uuid,uuid) returns boolean language sql as $$select false$$;
 create function eflow_m7.work_reviewer(uuid,uuid,uuid,text) returns uuid language sql as $$select '${R}'::uuid$$;
 `);
 const all=[...evidence.functions,...files,...fileDeps];
 for(const name of ['eflow_m7.node_visible(uuid,uuid,uuid)','eflow_m7.with_visible_counts(jsonb)','eflow_r7.m7_baseline_snapshot(uuid)','eflow_m7.with_schedule(jsonb)','eflow_r7.snapshot(uuid)','eflow_m7.can_view_linked_work(uuid,uuid)','eflow_m7.can_view_work_event(uuid,uuid,jsonb,jsonb)','eflow_evidence.path_context(text)','eflow_evidence.can_read_task(uuid,uuid)','eflow_evidence.can_read(text,text,text)','eflow_m7.proposal_file_read(text,text)']){
  const row=all.find(r=>r.signature===name);assert.ok(row,name);await db.exec(row.definition);
 }
 await db.exec(`create function public.r7_work_tree(uuid) returns jsonb language sql stable security definer as $$select eflow_r7.snapshot($1)$$;`);
 for(const table of ['subtasks','subtask_progress_updates','subtask_submissions','subtask_submission_attachments','work_tree_events','notifications']){
  await db.exec(`alter table public.${table} enable row level security;grant select on public.${table} to authenticated;`);
 }
 for(const policy of evidence.policies){
  await db.exec(`create policy "${policy.name}" on public.${policy.table} as ${['m7_operational_subtask','m7_operational_subtask_updates','m7_operational_subtask_submissions','m7_operational_work_events'].includes(policy.name)?'restrictive':'permissive'} for select to authenticated using (${policy.qual});`);
 }
 await db.exec(`create policy subtask_submission_attachments_read on public.subtask_submission_attachments for select to authenticated using(public.can_see_task(task_id,auth.uid()));
 create policy notifs_own on public.notifications for select to authenticated using(true);
 create policy m7_operational_notifications on public.notifications as restrictive for select to authenticated using(eflow_m7.can_view_linked_work(task_id,work_node_id));
 alter table storage.objects enable row level security;grant select on storage.objects to authenticated;
 create policy old_storage_read on storage.objects for select to authenticated using(true);
 create policy evidence_scope on storage.objects as restrictive for select to authenticated using(case when bucket_id='task-attachments' then eflow_evidence.can_read(bucket_id,name,owner_id) when bucket_id='m7-work-evidence' then eflow_m7.proposal_file_read(name,owner_id) else true end);
 grant usage on schema public,auth,eflow_r7,eflow_m7,eflow_r3,eflow_publication,eflow_evidence,storage to authenticated;
 grant select on public.tasks,public.profiles,public.task_status_history,public.projects,public.personal_subtasks to authenticated;`);
 await actor(S);check(await count('public.subtasks'),1);check(await count('public.subtask_submission_attachments'),1);
 check((await rootTree()).nodes.length,1);
 await db.exec('reset role');await db.exec(migration);
 for(const who of [S,C,H]){
  await actor(who);check(await value('select public.can_see_task($1,$2)',[T,who]),true);
  for(const table of ['subtasks','subtask_progress_updates','subtask_submissions','subtask_submission_attachments','work_tree_events','notifications'])check(await count('public.'+table),0);
  const tree=await rootTree();check(tree.nodes.length,0);check(tree.leaf_total,0);
  check(tree.people.some(p=>p.id===W),false);
 }
 await actor(S);check(await count('storage.objects'),1);
 check((await db.query('select name from storage.objects')).rows.map(r=>r.name),[taskPath]);
 await actor(C);check(await value('select count(*)::int from storage.objects where name=$1',[personalPath]),1);
 await actor(R);check(await count('public.subtasks'),1);check((await rootTree()).nodes.length,1);
 check((await rootTree()).people.some(p=>p.id===W),true);
 await setParent('in_progress');
 for(const who of [S,C,H]){
  await actor(who);for(const table of ['subtasks','subtask_progress_updates','subtask_submissions','subtask_submission_attachments','work_tree_events','notifications'])check(await count('public.'+table),1);
  const tree=await rootTree();check(tree.nodes.length,1);check(tree.leaf_total,1);
 }
 await actor(S);check(await count('storage.objects'),4);
 await setParent('cancelled');await actor(C);check(await count('public.subtasks'),0);
 await db.exec('reset role');await db.query("insert into public.task_status_history values($1,'in_progress')",[T]);
 await actor(C);check(await count('public.subtasks'),1);
 check((await value('select public.r7_work_tree($1)',[PT])).nodes[0].title,'Personal work');
 await actor(X);check(await count('public.subtasks'),0);
 await db.exec('reset role');await assert.rejects(db.exec(migration),/baseline differs/);checks++;await db.exec('rollback');
 console.log(JSON.stringify({checks,status:'PASS',environment:'disposable local PGlite',sqlLineEndings:crlf?'CRLF':'file',productionMutations:0,limitations:'Synthetic identity/membership/finance/activation/file-scope adapters; no hosted authenticated-role, real storage, cache invalidation, concurrent/staging or device acceptance.'},null,2));
}finally{await db.close();}
