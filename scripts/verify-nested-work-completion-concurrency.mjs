// NW4.2 native PostgreSQL: full reviewed schema + actual approval RPCs.
// Disposable localhost only. Historical pending/complete fixture rows do not
// claim genuine provider evidence/JWT or accounting acceptance.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,mkdtempSync,realpathSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,sep,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';

const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
const scratch=mkdtempSync(join(tmpdir(),'eflow-nw42-pg-')),data=join(scratch,'data');
const pgBin=process.env.EFLOW_TEST_PG_BIN||(process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin':'');
const bin=n=>pgBin?join(pgBin,n+(process.platform==='win32'?'.exe':'')):n;
const read=p=>readFileSync(join(repo,p),'utf8');
let started=false,checks=0,primaryFailure=false;
const run=(name,args,input)=>{const r=spawnSync(bin(name),args,{input,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:16*1024*1024,...(name==='pg_ctl'?{stdio:'ignore'}:{})});if(r.error||r.status!==0)throw new Error(`${name}: ${r.error?.message||r.stderr||r.stdout}`);return r.stdout;};
const listener=createServer();await new Promise((yes,no)=>{listener.once('error',no);listener.listen(0,'127.0.0.1',yes);});const port=listener.address().port;await new Promise(yes=>listener.close(yes));
const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres'];
const sql=s=>run('psql',args,"set client_min_messages=warning;"+s);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const identity=who=>`select set_config('request.jwt.claim.sub','${id(who)}',false);set role authenticated;`;
const repair="reset role;select set_config('request.jwt.claim.sub','',false);set session_replication_role=replica;";
const clients=new Set();
function session(name){
 const child=spawn(bin('psql'),args,{windowsHide:true,env:{...process.env,PGAPPNAME:name}});clients.add(child);
 let output='',error='',waiting=[];const timer=setTimeout(()=>child.kill(),20000);
 child.stdout.on('data',b=>{output+=b;for(const [marker,yes] of waiting)if(output.includes(marker))yes();waiting=waiting.filter(([m])=>!output.includes(m));});
 child.stderr.on('data',b=>{error+=b;});
 const done=new Promise((yes,no)=>{child.on('error',no);child.on('close',code=>{clearTimeout(timer);clients.delete(child);yes({code,output,error});});});
 return {send:s=>child.stdin.write(s+'\n'),finish:s=>child.stdin.end(s+'\n'),done,ready:marker=>output.includes(marker)?Promise.resolve():Promise.race([new Promise(yes=>waiting.push([marker,yes])),done.then(r=>{throw new Error('Session closed before '+marker+': '+r.error);})])};
}
async function blocked(name){
 const end=Date.now()+10000;
 while(Date.now()<end){if(sql(`select count(*) from pg_stat_activity where application_name='${name}' and wait_event_type='Lock'`).trim()==='1'){checks++;return;}
  await new Promise(yes=>setTimeout(yes,30));}
 throw new Error('Expected real lock wait: '+name);
}
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
try {
 run('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--no-locale']);
 started=true;run('pg_ctl',['-D',data,'-l',join(scratch,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);
 const f=JSON.parse(read('tests/sql/phase1-deployed-schema.json'));
 const helper=read('tests/sql/helpers/phase65Database.mjs');equal(createHash('sha256').update(helper).digest('hex'),'2cc398014076fd5e2b9c20b4b698e54851c5fb9aa0719597e26cf9f877f4ae70','historical helper unchanged');
 let schema=`create extension ltree;create schema extensions;create extension pgcrypto with schema extensions;
 create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
 create role authenticated;create role anon;create role service_role bypassrls;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create publication supabase_realtime;set check_function_bodies=false;`;
 for(const table of new Set(f.columns.map(c=>c.table))){const cols=f.columns.filter(c=>c.table===table);
  for(const c of cols)if(c.default?.includes('nextval'))schema+=`create sequence if not exists ${c.default.match(/'([^']+)'/)[1]};`;
  schema+=`create table public."${table}"(${cols.map(c=>`"${c.column}" ${c.type}${c.default?' default '+c.default:''}${c.nullable===false?' not null':''}`).join(',')});`;
 }
 for(const c of f.constraints)schema+=`alter table public."${c.table}" add constraint "${c.name}" ${c.definition};`;
 for(const fn of f.functions)schema+=fn.definition+';';
 for(const p of f.policies.filter(p=>p.schemaname==='public'))schema+=`alter table public."${p.tablename}" enable row level security;create policy "${p.policyname}" on public."${p.tablename}" as ${p.permissive} for ${p.cmd} to ${p.roles.join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`;
 schema+='grant usage on schema public,auth to authenticated,service_role;grant select,insert,update,delete on all tables in schema public to authenticated,service_role;';
 for(const t of f.triggers.filter(t=>!t.includes('eflow_evidence.')))schema+=t+';';
 const manifest=(source,key,count)=>{const files=[...source.match(new RegExp(`const ${key} = \\[([\\s\\S]*?)\\];`))[1].matchAll(/'(\d{14}_[a-z0-9_]+\.sql)'/g)].map(m=>m[1]);equal(files.length,count,'explicit '+key+' count');return files;};
 for(const file of [...manifest(helper,'migrations',10),...manifest(helper,'continuation',10)])schema+=read('supabase/migrations/'+file);
 const runner=read('scripts/verify-nested-work-correction-sql.mjs'),integration=manifest(runner,'integration',10),corrections=manifest(runner,'corrections',8);
 schema+=read('supabase/migrations/'+integration[0]);
 schema+=`create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;insert into storage.buckets(id,name,public) values('task-attachments','task-attachments',false);`;
 for(const file of [...integration.slice(1),...corrections])schema+=read('supabase/migrations/'+file);
 sql(schema);
 sql(`insert into organizations(id,name,slug,path,org_type) values('${id(90)}','Office A','office_a','office_a','department');
 insert into auth.users(id,email,email_confirmed_at) values ${[1,2,3,4,6].map(n=>`('${id(n)}','p${n}@example.test',now())`).join(',')};
 insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values ${[1,2,3,4,6].map(n=>`('${id(n)}','Person ${n}','p${n}@example.test','${n}','${n===1?'admin':'member'}',true,'${id(90)}')`).join(',')};
 select set_config('request.jwt.claim.sub','${id(1)}',false);select set_organization_leadership('${id(90)}','${id(2)}',null);
 create table nw42_fixture(kind text primary key,root uuid,parent uuid,leaf uuid);
 do $$declare p uuid;g uuid;o uuid;r uuid;k text;parent uuid;leaf uuid;begin
 perform set_config('request.jwt.claim.sub','${id(2)}',false);
 select (create_project_with_details(jsonb_build_object('title','Native NW4.2','org_id','${id(90)}','status','planning'))).id into p;
 select id into g from project_groups where project_id=p order by position limit 1;
 select id into o from project_offices where project_id=p and office_id='${id(90)}';perform phase6_set_members(o,array['${id(2)}','${id(3)}','${id(4)}','${id(6)}']::uuid[]);
 foreach k in array array['root','parent'] loop
 select (phase3_create_task(p,g,'Native '||k)).id into r;
 perform set_config('session_replication_role','replica',true);
 update tasks set assigned_to='${id(3)}',team_member_ids=array['${id(3)}','${id(4)}','${id(6)}']::uuid[],status='in_progress',percent_complete=37 where id=r;
 parent:=gen_random_uuid();leaf:=gen_random_uuid();
 insert into subtasks(id,task_id,parent_subtask_id,title,position,lead_id,assigned_to,assigned_to_ids,is_standalone,status,is_completed,percent_complete) values
 (parent,r,null,'Pending parent',0,'${id(4)}','${id(4)}',array['${id(4)}','${id(6)}']::uuid[],true,'completed',true,100),
 (leaf,r,parent,'Required leaf',1,'${id(4)}','${id(4)}',array['${id(4)}','${id(6)}']::uuid[],true,'completed',true,100);
 if k='root' then
 insert into task_submissions(id,task_id,version,submitter_id,submitter_name,note,status) values(r,r,1,'${id(3)}','Task Lead','Historical pending root','pending');
 update tasks set status='for_review',reviewer_id='${id(2)}',latest_submission=jsonb_build_object('id',r,'submitterId','${id(3)}','note','Historical pending root','attachments','[]'::jsonb) where id=r;
 else
 insert into subtask_submissions(id,task_id,subtask_id,version,submitter_id,submitter_name,reviewer_id,note,status) values(parent,r,parent,1,'${id(6)}','Contributor','${id(4)}','Historical pending parent','pending');
 update subtasks set status='for_review',is_completed=false,latest_submission_id=parent,reviewer_id='${id(4)}' where id=parent;
 end if;
 perform set_config('session_replication_role','origin',true);insert into nw42_fixture values(k,r,parent,leaf);
 end loop;end $$;`);
 const fixtures=JSON.parse(sql("select json_agg(f) from nw42_fixture f").trim());
 for(const f of fixtures){
  const approve=f.kind==='root'?`select decide_task_review('${f.root}',true,null,null);`:`select decide_subtask_review('${f.parent}',true,null);`;
  const who=f.kind==='root'?2:4,target=f.kind==='root'?f.root:f.parent,table=f.kind==='root'?'tasks':'subtasks';
  const reset=()=>sql(`set session_replication_role=replica;update ${table} set status='for_review'${f.kind==='parent'?',is_completed=false':''} where id='${target}';update ${f.kind==='root'?'task_submissions':'subtask_submissions'} set status='pending',decided_by=null,decided_at=null,decision_feedback=null,decided_by_name=null where id='${target}';update subtasks set status='completed',is_completed=true where id='${f.leaf}';set session_replication_role=origin;`);
  reset();
  // Descendant commits first: actual approval waits, then checks its new state.
  const writer=session('nw42-writer-'+f.kind);writer.send(`begin;${repair}update subtasks set status='changes_requested',is_completed=false where id='${f.leaf}';select 'WRITER_READY';`);await writer.ready('WRITER_READY');
  const reviewer=session('nw42-reviewer-'+f.kind);reviewer.finish(`begin;${identity(who)}${approve}commit;`);await blocked('nw42-reviewer-'+f.kind);
  writer.finish('commit;');equal((await writer.done).code,0,'descendant-first committed');
  const denied=await reviewer.done;equal(denied.code,3,'approval fails after lock wait');assert.match(denied.error,/resolve descendant/);checks++;
  equal(sql(`select status from ${table} where id='${target}'`).trim(),'for_review','denied approval leaves parent pending');
  reset();
  // Approval commits first: writer cannot change descendant before that commit.
  const first=session('nw42-first-'+f.kind);first.send(`begin;${identity(who)}${approve}select 'APPROVAL_READY';`);await first.ready('APPROVAL_READY');
  const later=session('nw42-later-'+f.kind);later.finish(`begin;${repair}update subtasks set status='changes_requested',is_completed=false where id='${f.leaf}';commit;`);await blocked('nw42-later-'+f.kind);
  equal(sql(`select status from subtasks where id='${f.leaf}'`).trim(),'completed','descendant remains complete while approval is committing');
  first.finish('commit;');equal((await first.done).code,0,'approval-first committed');equal((await later.done).code,0,'trusted later repair is a later transaction');
  equal(sql(`select status from ${table} where id='${target}'`).trim(),'completed','later repair does not revoke historical approval');
  reset();
  // An old Repeatable Read snapshot must fail serialization, not approve stale.
  const stale=session('nw42-stale-'+f.kind);stale.send(`begin isolation level repeatable read;select status from subtasks where id='${f.leaf}';select 'SNAPSHOT_READY';`);await stale.ready('SNAPSHOT_READY');
  sql(`begin;${repair}update subtasks set status='changes_requested',is_completed=false where id='${f.leaf}';commit;`);
  stale.finish(`${identity(who)}${approve}commit;`);const rr=await stale.done;equal(rr.code,3,'stale snapshot denied');assert.match(rr.error,/could not serialize access/);checks++;
  for(const mode of ['deferred','immediate']) {
   reset();
   assert.throws(()=>sql(`begin;set constraints all ${mode};${identity(who)}${approve}${repair}update subtasks set status='changes_requested',is_completed=false where id='${f.leaf}';commit;`),/resolve descendant/);checks++;
   equal(sql(`select status from ${table} where id='${target}'`).trim(),'for_review','late repair rolls back '+mode+' approval');
   equal(sql(`select status from subtasks where id='${f.leaf}'`).trim(),'completed','late repair rolls back '+mode+' descendant');
   equal(sql(`select coalesce(decided_by::text,'undecided') from ${f.kind==='root'?'task_submissions':'subtask_submissions'} where id='${target}'`).trim(),'undecided','failed transaction preserves historical decision author');
  }
 }
 console.log(`NW4.2 native concurrency: ${checks} assertions passed; actual root/parent RPCs, both lock orders, stale Repeatable Read denial; no hosted changes.`);
 const approvalChecks=checks;
 sql(`insert into auth.users(id,email,email_confirmed_at) values('${id(13)}','p13@example.test',now());insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values('${id(13)}','Person 13','p13@example.test','13','member',true,'${id(90)}');create table nw51_fixture(label text primary key,project uuid,root uuid,node uuid,terminal_root uuid,terminal_node uuid);`);
 const seedRemoval=label=>{
  sql(`do $$declare p uuid;g uuid;o uuid;r uuid;n uuid;tr uuid;tn uuid;begin
   perform set_config('request.jwt.claim.sub','${id(2)}',false);
   select (create_project_with_details(jsonb_build_object('title','R9 race ${label}','org_id','${id(90)}','status','planning'))).id into p;
   select id into g from project_groups where project_id=p order by position limit 1;select id into o from project_offices where project_id=p and office_id='${id(90)}';perform phase6_set_members(o,array['${id(2)}','${id(3)}','${id(4)}','${id(6)}','${id(13)}']::uuid[]);
   select (phase3_create_task(p,g,'Open race')).id into r;select (phase3_create_task(p,g,'Historical completed')).id into tr;
   perform set_config('session_replication_role','replica',true);
   update tasks set assigned_to='${id(3)}',team_member_ids=array['${id(3)}','${id(4)}','${id(6)}','${id(13)}']::uuid[],status='in_progress',percent_complete=37,due_date='2026-12-31' where id=r;
   n:=gen_random_uuid();tn:=gen_random_uuid();
   insert into subtasks(id,task_id,title,position,lead_id,assigned_to,assigned_to_ids,is_standalone,status,is_completed,percent_complete,completed_by,reviewer_id) values(n,r,'Current authority',0,'${id(13)}','${id(13)}',array['${id(13)}','${id(6)}']::uuid[],true,'todo',false,0,null,null),(tn,tr,'Historical work',0,'${id(13)}','${id(13)}',array['${id(13)}','${id(6)}']::uuid[],true,'completed',true,100,'${id(13)}','${id(13)}');
   update tasks set assigned_to='${id(13)}',team_member_ids=array['${id(13)}','${id(6)}']::uuid[],status='completed',percent_complete=100,reviewer_id='${id(13)}' where id=tr;
   perform set_config('session_replication_role','origin',true);insert into nw51_fixture values('${label}',p,r,n,tr,tn);
  end $$;`);
  return JSON.parse(sql(`select to_json(f) from nw51_fixture f where label='${label}'`).trim());
 };
 const preview=f=>sql(`${identity(2)}select r9_removal_preview('${f.project}','${id(13)}','${id(90)}')->>'fingerprint'`).trim().split('\n').at(-1);
 const removeSql=(f,fp,request)=>`${identity(2)}select r9_remove_person('${f.project}','${id(13)}','${id(90)}','${fp}','${request}');`;
 const staffSql=f=>`${identity(3)}select r7_work_command('${f.root}',(r7_work_tree('${f.root}')->>'revision')::integer,'${id(26000+checks)}','staff',jsonb_build_object('id','${f.node}','lead','${id(4)}','people',jsonb_build_array('${id(4)}','${id(6)}','${id(13)}')));`;
 const protectedTerminal=f=>sql(`select (to_jsonb(t)-array['assigned_to','recommendation_lead_id','team_member_ids','team_member_names','assignee_name','updated_at'])::text||'/'||(to_jsonb(n)-array['lead_id','assigned_to','assigned_to_ids','updated_at'])::text from tasks t join subtasks n on n.task_id=t.id where t.id='${f.terminal_root}'`).trim();
 // Appointment commits first; the real removal waits, then rejects its stale
 // fingerprint. No sequential fake establishes this lock-order assertion.
 const f1=seedRemoval('staff-first'),fp1=preview(f1),prior1=protectedTerminal(f1);
 const staffing=session('nw51-staff-first');staffing.send(`begin;${staffSql(f1)}select 'STAFF_READY';`);await staffing.ready('STAFF_READY');
 const removal=session('nw51-removal-after-staff');removal.finish(`begin;${removeSql(f1,fp1,id(26101))}commit;`);await blocked('nw51-removal-after-staff');
 staffing.finish('commit;');equal((await staffing.done).code,0,'actual appointment commits first');const staleRemoval=await removal.done;equal(staleRemoval.code,3,'waiting removal rejects changed impact');assert.match(staleRemoval.error,/Refresh the impact preview/);checks++;
 equal(sql(`select lead_id from subtasks where id='${f1.node}'`).trim(),id(4),'stale removal does not clear the new appointment');equal(protectedTerminal(f1),prior1,'stale removal preserves historical work');
 equal(sql(`select count(*) from eflow_r9.receipts where request='${id(26101)}'`).trim(),'0','stale removal creates no receipt');
 // Removal commits first; ordinary staffing waits and its old revision fails.
 const f2=seedRemoval('removal-first'),fp2=preview(f2),prior2=protectedTerminal(f2),revision=sql(`select coalesce((select revision from eflow_r7.tree_state where root_id='${f2.root}'),1)`).trim();
 const removing=session('nw51-remove-first');removing.send(`begin;${removeSql(f2,fp2,id(26102))}select 'REMOVAL_READY';`);await removing.ready('REMOVAL_READY');
 const appointment=session('nw51-staff-after-removal');appointment.finish(`begin;${identity(3)}select r7_work_command('${f2.root}',${revision},'${id(26103)}','staff',jsonb_build_object('id','${f2.node}','lead','${id(4)}','people',jsonb_build_array('${id(4)}','${id(6)}')));commit;`);await blocked('nw51-staff-after-removal');
 equal(sql(`select lead_id from subtasks where id='${f2.node}'`).trim(),id(13),'uncommitted removal is invisible');removing.finish('commit;');equal((await removing.done).code,0,'actual terminal cleanup commits');const obsolete=await appointment.done;equal(obsolete.code,3,'old-revision staffing rejected after wait');assert.match(obsolete.error,/Work changed/);checks++;
 equal(sql(`select lead_id is null and status='todo' from subtasks where id='${f2.node}'`).trim(),'t','unfinished node needs reassignment without state change');equal(protectedTerminal(f2),prior2,'terminal work/reviewer facts preserved after concurrent removal');
 // A concurrent identical request waits for the committed receipt and returns
 // it once. A different request with the old fingerprint remains stale.
 const f3=seedRemoval('retry'),fp3=preview(f3),request3=id(26104);
 const original=session('nw51-original');original.send(`begin;${removeSql(f3,fp3,request3)}select 'ORIGINAL_READY';`);await original.ready('ORIGINAL_READY');
 const retry=session('nw51-exact-retry');retry.finish(`begin;${removeSql(f3,fp3,request3)}commit;`);await blocked('nw51-exact-retry');original.finish('commit;');equal((await original.done).code,0,'original removal commits');equal((await retry.done).code,0,'concurrent exact retry succeeds');
 equal(sql(`select count(*) from eflow_r9.events where project_id='${f3.project}' and action='person_removed'`).trim(),'1','concurrent retry never duplicates audit event');
 assert.throws(()=>sql(`begin;${removeSql(f3,fp3,id(26105))}commit;`),/Refresh the impact preview/);checks++;
 // An old RR work snapshot is rejected by the existing completion version
 // write before removal validates impact, preserving NW4.2's serialization.
 const f4=seedRemoval('repeatable-read'),fp4=preview(f4);
 const rrRemoval=session('nw51-rr-removal');rrRemoval.send(`begin isolation level repeatable read;select status from tasks where id='${f4.root}';select 'RR_READY';`);await rrRemoval.ready('RR_READY');sql(`begin;${staffSql(f4)}commit;`);rrRemoval.finish(`${removeSql(f4,fp4,id(26106))}commit;`);const rrRemoved=await rrRemoval.done;equal(rrRemoved.code,3,'old RR removal denied');assert.match(rrRemoved.error,/could not serialize access/);checks++;
 equal(sql('select count(*) from eflow_r9.staffing_removals').trim(),'0','no private capability remains after concurrent successes/failures');
 console.log(`NW5.1 native removal concurrency: ${checks-approvalChecks} assertions passed; actual R9/R7 RPCs, both lock orders, concurrent exact retry and stale Repeatable Read rejection.`);
} catch(error) {
 primaryFailure=true;throw error;
} finally {
 for(const child of clients)child.kill();let stopped=!started;
 if(started)try{run('pg_ctl',['-D',data,'-m','fast','-w','stop']);stopped=true;}catch(e){console.warn(`Cluster retained at ${scratch}: ${e.message}`);}
 const actual=realpathSync(scratch),parent=realpathSync(tmpdir());
 if(stopped&&actual.startsWith(parent+sep)&&basename(actual).startsWith('eflow-nw42-pg-'))try{rmSync(actual,{recursive:true,maxRetries:3,retryDelay:200});}catch(error){
  if(!primaryFailure)throw error;console.warn(`Cleanup also failed at ${scratch}: ${error.message}`);
 }
}
