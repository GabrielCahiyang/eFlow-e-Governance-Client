// NW5.2: genuine separate PostgreSQL sessions, actual checked/finance/direct RPCs.
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
const scratch=mkdtempSync(join(tmpdir(),'eflow-nw52-pg-')),data=join(scratch,'data');
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
 select set_config('request.jwt.claim.sub','${id(1)}',false);select set_organization_leadership('${id(90)}','${id(2)}',null);`);
 const funding=read('supabase/migrations/20260826000003_dynamic_task_funding.sql');
 const arbiter=funding.match(/create unique index if not exists budget_ledger_command_idempotency_uni[\s\S]*?;/)?.[0];assert.ok(arbiter);checks++;sql(arbiter);
 const last=s=>s.trim().split(/\r?\n/).at(-1),json=s=>JSON.parse(last(s));
 const project=last(sql(`${identity(2)}select (create_project_with_details(jsonb_build_object('title','NW5.2 races','org_id','${id(90)}','status','planning'))).id;`));
 const group=last(sql(`select id from project_groups where project_id='${project}' order by position limit 1;`));
 const office=last(sql(`select id from project_offices where project_id='${project}' and office_id='${id(90)}';`));
 sql(`${identity(2)}select phase6_set_members('${office}',array['${id(2)}','${id(3)}','${id(4)}','${id(6)}']::uuid[]);`);
 const section=id(32000),settings=JSON.stringify({dailyReleaseLimit:30000,perReceiptLimit:5000,liquidationDueDays:15,allowReceiptOverride:false,threshold:75,notes:'NW5.2 local races'});
 const fiscal=last(sql(`${identity(2)}select save_office_budget_sections('${id(90)}',2026,'${JSON.stringify([{id:section,name:'Native NW5.2',amount:50000,parentId:null,heldAmount:0,position:0}])}'::jsonb,0,null,'${settings}'::jsonb);`));
 sql(`${identity(2)}select lock_department_fiscal_budget('${fiscal}');`);
 let key=32100;
 const tree=f=>json(sql(`${identity(3)}select r7_work_tree('${f.root}');`));
 const term=(cmd,payload)=>`'${cmd}','${JSON.stringify(payload)}'::jsonb`;
 function seed(label){
  const root=last(sql(`${identity(2)}select (phase3_create_task('${project}','${group}','${label}')).id;`));
  sql(`${repair}update tasks set assigned_to='${id(3)}',team_member_ids=array['${id(3)}','${id(4)}','${id(6)}']::uuid[],status='in_progress',percent_complete=37,due_date='2026-12-31' where id='${root}';set session_replication_role=origin;`);
  const f={root,parent:id(key++),leaf:id(key++)};
  for(const [node,parent] of [[f.parent,null],[f.leaf,f.parent]])sql(`${identity(3)}select r7_work_command('${root}',${tree(f).revision},'${id(key++)}',${term('create',{id:node,parent,title:'Native subitem',lead:id(4),people:[id(4),id(6)],standalone:true})});`);
  sql(`${identity(2)}select fund_office_work('${root}',2026,'${JSON.stringify([{partitionId:section,amount:100}])}'::jsonb,'Native checked history','${id(key++)}');`);
  f.line=last(sql(`select l.id from work_budget_allocation_lines l join work_budget_allocations a on a.id=l.allocation_id where a.task_id='${root}' and a.subtask_id is null;`));return f;
 }
 const preview=(f,cmd,payload)=>json(sql(`${identity(3)}select nw_work_impact('${f.root}',${tree(f).revision},${term(cmd,payload)});`));
 const checked=(f,cmd,payload,impact,request=id(key++))=>`${identity(3)}select nw_work_command('${f.root}',${impact.expected_revision},'${request}',${term(cmd,payload)},'${impact.fingerprint}');`;
 const cap=(f)=>`${identity(3)}select set_subtask_budget_cap('${f.root}','${f.leaf}','${f.line}',20,'Concurrent protected cap','${id(key++)}');`;
 const staff=(f,revision)=>`${identity(3)}select r7_work_command('${f.root}',${revision},'${id(key++)}',${term('staff',{id:f.parent,lead:id(6),people:[id(4),id(6)]})});`;
 const fail=async(client,pattern,label)=>{const r=await client.done;equal(r.code,3,label);assert.match(r.error,pattern);checks++;};
 // Genuine finance history first: zero tree-revision change, stale preview.
 const f1=seed('Cap first'),p1={id:f1.parent},v1=preview(f1,'delete',p1);
 const h1=session('nw52-cap-first');h1.send(`begin;${cap(f1)}select 'HISTORY_READY';`);await h1.ready('HISTORY_READY');
 const c1=session('nw52-checked-after-cap');c1.finish(`begin;${checked(f1,'delete',p1,v1)}commit;`);await blocked('nw52-checked-after-cap');
 equal(tree(f1).revision,v1.current_revision,'uncommitted finance does not mutate tree revision');h1.finish('commit;');equal((await h1.done).code,0,'actual cap commits');
 await fail(c1,/impact changed/,'checked delete rejects concurrent history');equal(tree(f1).revision,v1.current_revision,'committed finance still leaves tree revision unchanged');
 equal(tree(f1).nodes.length,2,'stale delete preserves subtree');
 // Checked delete first: the real finance API waits before allocation rows;
 // after deletion its existing same-root validation rejects the cap atomically.
 const f2=seed('Checked delete first'),p2={id:f2.parent},v2=preview(f2,'delete',p2);
 const c2=session('nw52-delete-first');c2.send(`begin;${checked(f2,'delete',p2,v2)}select 'DELETE_READY';`);await c2.ready('DELETE_READY');
 const h2=session('nw52-cap-after-delete');h2.finish(`begin;${cap(f2)}commit;`);await blocked('nw52-cap-after-delete');
 c2.finish('commit;');equal((await c2.done).code,0,'checked deletion commits');await fail(h2,/Subtask|subtask/i,'cap for deleted node rejects');
 equal(last(sql(`select count(*) from work_budget_allocations where subtask_id='${f2.leaf}';`)),'0','failed cap leaves no history');
 // Appointments, in both lock orders, use the original R7 command.
 const f3=seed('Appointment first'),p3={id:f3.parent,title:'Checked rename'},v3=preview(f3,'edit',p3);
 const a3=session('nw52-appointment-first');a3.send(`begin;${staff(f3,v3.current_revision)}select 'APPOINTMENT_READY';`);await a3.ready('APPOINTMENT_READY');
 const c3=session('nw52-checked-after-appointment');c3.finish(`begin;${checked(f3,'edit',p3,v3)}commit;`);await blocked('nw52-checked-after-appointment');a3.finish('commit;');equal((await a3.done).code,0,'appointment commits');await fail(c3,/Work changed/,'stale checked rename rejects changed appointment');
 const f4=seed('Checked rename first'),p4={id:f4.parent,title:'Checked rename'},v4=preview(f4,'edit',p4);
 const c4=session('nw52-rename-first');c4.send(`begin;${checked(f4,'edit',p4,v4)}select 'RENAME_READY';`);await c4.ready('RENAME_READY');
 const a4=session('nw52-appointment-after-rename');a4.finish(`begin;${staff(f4,v4.current_revision)}commit;`);await blocked('nw52-appointment-after-rename');c4.finish('commit;');equal((await c4.done).code,0,'checked rename commits');await fail(a4,/Work changed/,'ordinary old-revision staffing rejects');
 equal(last(sql(`select percent_complete from tasks where id='${f4.root}'`)),'37','manual root progress preserved');
 // Lost response + concurrently repeated actor/request, old fingerprint.
 const f5=seed('Concurrent exact retry'),p5={id:f5.parent,title:'Only one rename'},v5=preview(f5,'edit',p5),request5=id(key++);
 const o5=session('nw52-original');o5.send(`begin;${checked(f5,'edit',p5,v5,request5)}select 'ORIGINAL_READY';`);await o5.ready('ORIGINAL_READY');
 const r5=session('nw52-exact-retry');r5.finish(`begin;${checked(f5,'edit',p5,v5,request5)}commit;`);await blocked('nw52-exact-retry');o5.finish('commit;');equal((await o5.done).code,0,'original checked mutation commits');equal((await r5.done).code,0,'concurrent exact retry returns committed snapshot');
 equal(last(sql(`select count(*) from eflow_r7.receipts where actor_id='${id(3)}' and request_id='${request5}'`)),'1','one receipt');equal(last(sql(`select count(*) from work_tree_events where root_id='${f5.root}' and command='edit'`)),'1','one edit event');
 assert.throws(()=>sql(checked(f5,'edit',{...p5,title:'Changed retry'},v5,request5)),/different work/);checks++;
 // Old RR snapshot cannot miss an independent cap transaction.
 const f6=seed('Repeatable read history'),p6={id:f6.parent,title:'RR rename'},v6=preview(f6,'edit',p6);
 const rr=session('nw52-repeatable-read');rr.send(`begin isolation level repeatable read;select status from tasks where id='${f6.root}';select 'RR_READY';`);await rr.ready('RR_READY');sql(cap(f6));rr.finish(`${checked(f6,'edit',p6,v6)}commit;`);await fail(rr,/could not serialize access/,'old RR confirmation rejects');
 // Client direct progress INSERT is forbidden by existing RLS. Keep that
 // denial, and exercise the trigger via a trusted database producer with the
 // actual authenticated author claim; no policy is changed or guard disabled.
 const direct=f=>`reset role;select set_config('request.jwt.claim.sub','${id(4)}',false);insert into subtask_progress_updates(id,task_id,subtask_id,author_id,author_name,percent_complete,note) values('${id(key++)}','${f.root}','${f.leaf}','${id(4)}','Current Lead',0,'Direct retained history');`;
 const f7=seed('Direct history first'),p7={id:f7.parent},v7=preview(f7,'delete',p7);
 assert.throws(()=>sql(`${identity(4)}insert into subtask_progress_updates(id,task_id,subtask_id,author_id,author_name,percent_complete,note) values('${id(key++)}','${f7.root}','${f7.leaf}','${id(4)}','Current Lead',0,'Forbidden client insert');`),/row-level security/);checks++;
 const h7=session('nw52-direct-history-first');h7.send(`begin;${direct(f7)}select 'DIRECT_READY';`);await h7.ready('DIRECT_READY');
 const c7=session('nw52-delete-after-direct');c7.finish(`begin;${checked(f7,'delete',p7,v7)}commit;`);await blocked('nw52-delete-after-direct');h7.finish('commit;');equal((await h7.done).code,0,'trusted direct progress with real author guard commits');await fail(c7,/impact changed/,'direct history invalidates delete fingerprint');equal(tree(f7).revision,v7.current_revision,'direct retained progress does not bump node revision');
 const f8=seed('Delete before direct history'),p8={id:f8.parent},v8=preview(f8,'delete',p8);
 const c8=session('nw52-delete-before-direct');c8.send(`begin;${checked(f8,'delete',p8,v8)}select 'DELETE_READY';`);await c8.ready('DELETE_READY');
 const h8=session('nw52-direct-after-delete');h8.finish(`begin;${direct(f8)}commit;`);await blocked('nw52-direct-after-delete');c8.finish('commit;');equal((await c8.done).code,0,'checked delete commits before direct insert');await fail(h8,/not assigned|not found|foreign key|access denied/i,'direct history cannot attach to deleted work');
 equal(last(sql(`select count(*) from subtask_progress_updates where subtask_id='${f8.leaf}';`)),'0','no orphan/direct history after rejected write');
 // Storage rows here are local provider-metadata fixtures, never real uploads.
 // All installed evidence sealing/cleanup/author guards run unmodified.
 const uploaded=f=>{const path=`subtasks/${f.leaf}/progress/local-proof.pdf`;sql(`insert into storage.objects(bucket_id,name,owner_id,metadata) values('task-attachments','${path}','${id(4)}','{"size":12,"mimetype":"application/pdf"}');`);return path;};
 const finalize=(f,path)=>`reset role;select set_config('request.jwt.claim.sub','${id(4)}',false);insert into subtask_progress_updates(id,task_id,subtask_id,author_id,author_name,percent_complete,note,attachment_path,attachment_name) values('${id(key++)}','${f.root}','${f.leaf}','${id(4)}','Current Lead',0,'Sealed evidence history','${path}','local-proof.pdf');`;
 const cleanup=path=>`${identity(4)}select claim_task_evidence_cleanup('${path}','task-attachments');`;
 const f9=seed('Evidence before checked delete'),path9=uploaded(f9),p9={id:f9.parent},v9=preview(f9,'delete',p9);
 const e9=session('nw52-evidence-first');e9.send(`begin;${finalize(f9,path9)}select 'SEALED_READY';`);await e9.ready('SEALED_READY');
 const c9=session('nw52-delete-after-evidence');c9.finish(`begin;${checked(f9,'delete',p9,v9)}commit;`);await blocked('nw52-delete-after-evidence');e9.finish('commit;');equal((await e9.done).code,0,'evidence author/path/size/MIME guards allow finalization');await fail(c9,/impact changed/,'private sealing invalidates checked delete');equal(tree(f9).revision,v9.current_revision,'sealing history without node update leaves revision unchanged');
 const f10=seed('Checked delete before evidence'),path10=uploaded(f10),p10={id:f10.parent},v10=preview(f10,'delete',p10);
 const c10=session('nw52-delete-before-seal');c10.send(`begin;${checked(f10,'delete',p10,v10)}select 'DELETE_READY';`);await c10.ready('DELETE_READY');
 const e10=session('nw52-seal-after-delete');e10.finish(`begin;${finalize(f10,path10)}commit;`);await blocked('nw52-seal-after-delete');c10.finish('commit;');equal((await c10.done).code,0,'checked deletion commits before seal');await fail(e10,/not assigned|not found|foreign key|access denied/i,'evidence cannot finalize against deleted work');
 equal(last(sql(`select count(*) from eflow_evidence.objects where object_name='${path10}'`)),'0','failed finalization leaves no private seal');
 const f11=seed('Finalize before cleanup'),path11=uploaded(f11);
 const e11=session('nw52-finalization-before-cleanup');e11.send(`begin;${finalize(f11,path11)}select 'SEALED_READY';`);await e11.ready('SEALED_READY');
 const x11=session('nw52-cleanup-after-finalization');x11.finish(`begin;${cleanup(path11)}commit;`);await blocked('nw52-cleanup-after-finalization');e11.finish('commit;');equal((await e11.done).code,0,'finalization wins');await fail(x11,/Finalized evidence cannot be deleted/,'cleanup still rejects finalized evidence');equal(last(sql(`select state from eflow_evidence.objects where object_name='${path11}'`)),'finalized','finalized seal preserved');
 const f12=seed('Cleanup before finalization'),path12=uploaded(f12);
 const x12=session('nw52-cleanup-first');x12.send(`begin;${cleanup(path12)}select 'CLEANUP_READY';`);await x12.ready('CLEANUP_READY');
 const e12=session('nw52-finalization-after-cleanup');e12.finish(`begin;${finalize(f12,path12)}commit;`);await blocked('nw52-finalization-after-cleanup');x12.finish('commit;');equal((await x12.done).code,0,'cleanup claim wins');await fail(e12,/already finalized or claimed for cleanup/,'finalization rejects cleanup tombstone');equal(last(sql(`select state from eflow_evidence.objects where object_name='${path12}'`)),'cleanup','cleanup tombstone preserved');
 // NW5.5 routine date preview is still checked: a zero-progress recorded plan
 // arriving first invalidates it without a revision bump. Opposite lock order
 // commits the safe date before the later plan, with no retroactive rewrite.
 const f13=seed('Date history first'),p13={id:f13.leaf,title:'Native subitem',due:'2026-12-20',standalone:true},v13=preview(f13,'edit',p13);
 equal(v13.requires_date_confirmation,false,'date initially routine');
 const h13=session('nw55-date-history-first');h13.send(`begin;${direct(f13)}select 'DATE_HISTORY_READY';`);await h13.ready('DATE_HISTORY_READY');
 const c13=session('nw55-date-after-history');c13.finish(`begin;${checked(f13,'edit',p13,v13)}commit;`);await blocked('nw55-date-after-history');h13.finish('commit;');equal((await h13.done).code,0,'recorded plan commits first');await fail(c13,/impact changed/,'routine date rejects history race');equal(tree(f13).nodes.find(n=>n.id===f13.leaf).due_date,'2026-12-31','denied date unchanged');equal(preview(f13,'edit',p13).requires_date_confirmation,true,'fresh date sees commitment');
 const f14=seed('Date before history'),p14={id:f14.leaf,title:'Native subitem',due:'2026-12-20',standalone:true},v14=preview(f14,'edit',p14);
 const c14=session('nw55-date-first');c14.send(`begin;${checked(f14,'edit',p14,v14)}select 'DATE_READY';`);await c14.ready('DATE_READY');
 const h14=session('nw55-history-after-date');h14.finish(`begin;${direct(f14)}commit;`);await blocked('nw55-history-after-date');c14.finish('commit;');equal((await c14.done).code,0,'routine date commits first');equal((await h14.done).code,0,'later plan commits after date');equal(tree(f14).nodes.find(n=>n.id===f14.leaf).due_date,'2026-12-20','later history does not rewrite committed date');equal(last(sql(`select count(*) from subtask_progress_updates where subtask_id='${f14.leaf}'`)),'1','later historical authorship retained');
 console.log(`NW5.2/NW5.5 native impact concurrency: ${checks} assertions passed; actual history in both lock orders, routine date races, exact concurrent retry, stale Repeatable Read rejection.`);
} catch(error) {
 primaryFailure=true;throw error;
} finally {
 for(const child of clients)child.kill();let stopped=!started;
 if(started)try{run('pg_ctl',['-D',data,'-m','fast','-w','stop']);stopped=true;}catch(e){console.warn(`Cluster retained at ${scratch}: ${e.message}`);}
 const actual=realpathSync(scratch),parent=realpathSync(tmpdir());
 if(stopped&&actual.startsWith(parent+sep)&&basename(actual).startsWith('eflow-nw52-pg-'))try{rmSync(actual,{recursive:true,maxRetries:3,retryDelay:200});}catch(error){
  if(!primaryFailure)throw error;console.warn(`Cleanup also failed at ${scratch}: ${error.message}`);
 }
}
