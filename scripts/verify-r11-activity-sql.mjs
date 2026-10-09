import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {phase65Database} from '../tests/sql/helpers/phase65Database.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let db,checks=0,currentActor=null,attempt=9000;
const value=async(sql,args=[])=>{
 if(sql.startsWith('select submit_subtask_for_review')){
  const payload=JSON.parse(args[1]);payload.id??=id(attempt++);
  await db.exec('reset role');
  for(const file of payload.attachments??[]){
   file.filePath=`subtasks/${args[0]}/${payload.id}/${file.fileName}`;
   await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)', ['task-attachments',file.filePath,id(currentActor),JSON.stringify({size:12,mimetype:'application/pdf'})]);
  }
  await db.exec('set role authenticated');args=[args[0],JSON.stringify(payload)];
 }
 return Object.values((await db.query(sql,args)).rows[0])[0];
};
const check=(value,label)=>{assert.ok(value,label);checks++;};
const deny=async(sql,args=[])=>{await assert.rejects(db.query(sql,args));checks++;};
const actor=async n=>{currentActor=n;await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
try{
 db=await phase65Database();
 await db.exec(`create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;
 insert into storage.buckets(id,name,public) values('task-attachments','task-attachments',false);
 insert into organizations(id,name,slug,path,org_type) values('${id(90)}','Office','office','office','department'),('${id(91)}','Foreign','foreign','foreign','department');
 insert into auth.users(id,email,email_confirmed_at) values ${Array.from({length:10},(_,i)=>i+1).map(n=>`('${id(n)}','p${n}@example.test',${n===9?'null':'now()'})`).join(',')};
 insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values ${Array.from({length:10},(_,i)=>i+1).map(n=>`('${id(n)}','Person ${n}','p${n}@example.test','${n}','${n===1?'admin':'member'}',${n===8?'false':'true'},'${n===7?id(91):id(90)}')`).join(',')};`);
 await value("select set_config('request.jwt.claim.sub',$1,false)",[id(1)]);await value('select set_organization_leadership($1,$2,null)',[id(90),id(2)]);await value('select set_organization_leadership($1,$2,null)',[id(91),id(7)]);
 await value("select set_config('request.jwt.claim.sub',$1,false)",[id(2)]);
 const project=await value('select (create_project_with_details($1::jsonb)).id',[JSON.stringify({title:'Nested work',org_id:id(90),status:'planning'})]);
 const group=await value('select id from project_groups where project_id=$1 order by position limit 1',[project]);
 const root=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'Root']);
 await db.exec('set session_replication_role=replica');await db.query("update tasks set status='todo',assigned_to=$1,team_member_ids=$2::uuid[],due_date='2026-12-31',percent_complete=37,recommendation_lead_id=$4 where id=$3",[id(3),[id(3),id(4)],root,id(5)]);
 await db.query("insert into subtasks(id,task_id,title,position,assigned_to,assigned_to_ids,created_by,due_date) values($1,$2,'Legacy flat',0,$3,$4::uuid[],$5,'2026-12-20')",[id(100),root,id(4),[id(4)],id(3)]);await db.exec('set session_replication_role=origin');
 const original=await value('select to_jsonb(t) from tasks t where id=$1',[root]);
 for(const file of ['20260831000001_task_evidence_security.sql','20261007120000_r3_personal_workspaces.sql','20261008030659_r6_project_file_library.sql','20261008035748_r7_project_members_and_nested_work.sql','20261008060756_r8_approved_project_invitations.sql','20261008081855_r9_project_access_lifecycle.sql','20261008123723_r11_project_activity_snapshots.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));

 await db.exec('reset role;set session_replication_role=replica');
 await db.query("insert into task_progress_updates(id,task_id,author_id,author_name,note,created_at) select ('00000000-0000-4000-8000-'||lpad((30000+n)::text,12,'0'))::uuid,$1,$2,'Lead','Equal timestamp event '||n,'2026-10-01T10:00:00Z'::timestamptz from generate_series(1,310) n",[root,id(3)]);
 await db.query("insert into task_submissions(id,task_id,version,submitter_id,submitter_name,note,status,submitted_at) values($1,$2,1,$3,'Lead','Evidence submitted','pending','2026-09-01')",[id(32000),root,id(3)]);
 await db.query("insert into audit_events(id,actor_id,actor_name,entity_type,entity_id,action,org_id,created_at) values($1,$2,'Lead','project',$3,'project.updated',$4,'2026-09-15')",[id(35000),id(3),project,id(90)]);
 await db.query("insert into task_status_history(id,task_id,to_status,actor_id,actor_name,note,created_at) values($1,$2,'in_progress',$3,'Lead','Started delivery','2026-09-15')",[id(34000),root,id(3)]);
 await db.query("insert into subtask_progress_updates(id,subtask_id,task_id,author_id,author_name,percent_complete,note,created_at) values($1,$2,$3,$4,'Lead',20,'Nested progress','2026-09-15')",[id(30001),id(100),root,id(3)]);
 await db.query("insert into subtask_submissions(id,subtask_id,task_id,version,submitter_id,reviewer_id,submitter_name,note,status,submitted_at,decided_at,decided_by_name,decision_feedback) values($1,$2,$3,1,$4,$5,'Lead','Child evidence','approved','2026-09-01','2026-09-02','Reviewer','Accepted')",[id(32000),id(100),root,id(3),id(4)]);
 await db.query("insert into work_tree_events(id,root_id,project_id,actor_id,actor_name,command,node_id,after_data,occurred_at) values($1,$2,$3,$4,'Lead','progress',$5,$6::jsonb,'2026-09-15')",[id(34500),root,project,id(3),id(100),JSON.stringify({nodes:[{id:id(100),title:'Nested branch'}]})]);
 await db.exec('set session_replication_role=origin');
 await actor(3);
 const page=(snapshot=null,index=0,size=25,kind='all',search='',from=null,to=null)=>value('select r11_project_activity($1,$2,$3,$4,$5,$6,$7,$8)',[project,snapshot,index,size,kind,search,from,to]);
 let first=await page();check(first.total>310,'All >250 events reachable');check(first.events.length===25&&first.more,'Default page contract');
 const expected=(await db.query('select event_id from eflow_r11.events where project_id=$1 order by occurred_at desc,event_id collate "C" desc',[project])).rows.map(r=>r.event_id);
 const snapshot=first.snapshot;
 // New events including a backdated insert, plus a mutable decision, cannot shift this snapshot.
 await db.exec('reset role;set session_replication_role=replica');
 await db.query("insert into task_progress_updates(id,task_id,author_id,author_name,note,created_at) values($1,$2,$3,'Lead','Concurrent new','2026-10-03'),($4,$2,$3,'Lead','Concurrent backdated','2026-08-01')",[id(33000),root,id(3),id(33001)]);
 await db.query("update task_submissions set status='approved',decided_by_name='Independent reviewer',decided_at='2026-10-04',decision_feedback='Approved' where id=$1",[id(32000)]);
 await db.exec('set session_replication_role=origin');await actor(3);
 const seen=[];
 for(let index=0;index<Math.ceil(first.total/25);index++){
  const next=await page(snapshot,index);seen.push(...next.events.map(e=>e.event_id));check(next.total===first.total,'Snapshot count stays fixed');
 }
 check(new Set((await db.query('select kind from eflow_r11.events where project_id=$1',[project])).rows.map(e=>e.kind)).size===4,'All audit/status/progress/submission lenses merged');
 check(seen.includes('progress:task:'+id(30001))&&seen.includes('progress:subtask:'+id(30001)),'Cross-source UUID collisions retain both events');
 check(seen.includes('submission:task:'+id(32000))&&seen.includes('submission:subtask:'+id(32000))&&seen.includes('decision:subtask:'+id(32000)),'Submission and review facts retain separate source identities');
 check(JSON.stringify(seen)===JSON.stringify(expected),'Equal timestamps/inserts/decisions have no duplicate or skipped facts');check(new Set(seen).size===seen.length,'Stable source identities');
 const refreshed=await page();check(refreshed.total===first.total+3,'Refresh sees two inserts and separate decision event');
 const filtered=await page(null,0,25,'progress','Equal timestamp');check(filtered.total===310,'Server type and literal search applies before paging');
 const dateFiltered=await page(null,0,25,'progress','','2026-10-01','2026-10-02');check(dateFiltered.total===310,'Server half-open date bounds');
 const clamped=await page(snapshot,999);check(clamped.page===Math.floor((first.total-1)/25),'Out-of-range page clamps');
 check((await page(snapshot,0,100)).events.length===100,'Selectable size does not change snapshot membership');
 await deny('select r11_project_activity($1,$2,0,25,$3)',[project,snapshot,'status']);
 await deny('select r11_project_activity($1,null,0,26)',[project]);
 await actor(4);await deny('select r11_project_activity($1,$2)',[project,snapshot]);
 await actor(7);await deny('select r11_project_activity($1)',[project]);
 await actor(null);await deny('select r11_project_activity($1)',[project]);
 await db.exec('reset role');await db.query("update eflow_r11.snapshots set expires_at=now()-interval '1 second' where id=$1",[snapshot]);await actor(3);await deny('select r11_project_activity($1,$2)',[project,snapshot]);
 // Remove source access while retaining broad project read: cached facts must also disappear.
 await db.exec('reset role');await db.exec('create policy r11_test_deny on task_progress_updates as restrictive for select to authenticated using(false)');await actor(3);await deny('select r11_project_activity($1,$2)',[project,refreshed.snapshot]);
 await db.exec('reset role');
 const functions=(await db.query("select prosecdef from pg_proc where proname='r11_project_activity'")).rows;check(functions.length===1&&!functions[0].prosecdef,'RPC cannot bypass source RLS');
 check((await db.query("select reloptions from pg_class where oid='eflow_r11.events'::regclass")).rows[0].reloptions.includes('security_invoker=true'),'Merged view respects source policies');
 check(!(await value("select has_function_privilege('anon','public.r11_project_activity(uuid,uuid,integer,integer,text,text,timestamptz,timestamptz)','execute')")),'Anonymous RPC denied');
 await actor(3);
 const personalWorkspace=await value('select r3_create_workspace($1,$2)',[id(40000),'Activity workspace']);
 const personalProject=await value('select r3_create_personal_project($1,$2,$3)',[personalWorkspace.id,id(40001),'Private activity']);
 const personalTask=await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'create_task',JSON.stringify({title:'Personal task',lead_id:id(3)}),id(40002)]);
 await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'progress_task',JSON.stringify({task_id:personalTask.id,revision:personalTask.revision,progress:25,note:'Private progress'}),id(40003)]);
 const personalHistory=await value('select r11_project_activity($1)',[personalProject.id]);
 check(personalHistory.events.some(e=>e.kind==='progress'&&e.detail==='Private progress'),'Real personal commands appear in shared Activity RPC');
 check(personalHistory.events.every(e=>e.event_id.startsWith('personal:')),'Personal Activity excludes Office source events');
 await actor(4);await deny('select r11_project_activity($1)',[personalProject.id]);
 console.log(`R11 disposable PostgreSQL: ${checks} assertions passed`);
}finally{await db?.close();}
