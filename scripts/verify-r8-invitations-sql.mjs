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
 for(const file of ['20260831000001_task_evidence_security.sql','20261007120000_r3_personal_workspaces.sql','20261008030659_r6_project_file_library.sql','20261008035748_r7_project_members_and_nested_work.sql','20261008060756_r8_approved_project_invitations.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));

 await actor(3);
 let serial=5000;
 const submit=(email='guest@example.test',extra={})=>value('select r8_submit_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[extra.id??id(serial++),extra.project??project,extra.root??root,extra.node??null,extra.office??id(90),email,'Requested professional context',['Analysis'],extra.engagement??'Consultant',extra.end??null,extra.until??true]);
 let req=await submit();check(req.state==='pending','Owner submits approval request');
 await db.exec('reset role');check(await value('select count(*)=0 from eflow_r8.tokens'),'Proposal creates zero tokens');check(await value('select count(*)=0 from project_guest_members'),'Proposal grants zero access');
 const hash='a'.repeat(64);
 const reserve=(item,code=hash,resend=false)=>value('select r8_reserve_dispatch($1,$2,$3,$4,168,$5)',[id(2),item.id,item.revision,code,resend]);
 await deny('select r8_reserve_dispatch($1,$2,$3,$4,168,false)',[id(2),req.id,req.revision,hash]);
 await actor(4);await deny('select r8_decide_request($1,$2,$3)',[req.id,req.revision,'approved']);
 await actor(7);await deny('select r8_decide_request($1,$2,$3)',[req.id,req.revision,'approved']);
 await actor(2);req=await value('select r8_decide_request($1,$2,$3)',[req.id,req.revision,'approved']);check(req.state==='approved','Current appointed Head approves');
 check((await value('select r8_decide_request($1,1,$2)',[req.id,'approved'])).revision===req.revision,'Approval retry is idempotent');
 await db.exec('reset role');req=await reserve(req);check(req.invitation_created_at&&req.delivery_status==='attempting','Dispatch creates token only after approval');
 check(await value('select r8_finish_dispatch($1,$2,$3,null)',[req.id,hash,'provider-123']),'Provider receipt recorded');
 check((await value('select r8_lookup($1)',[hash])).existing_account===false,'New recipient detected');
 await deny('select r8_accept($1,$2,$3)',[hash,id(4),'Wrong email']);
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(31),'guest@example.test']);
 await value('select r8_accept($1,$2,$3)',[hash,id(31),'New Guest']);
 check(await value("select role='member' and org_id is null from profiles where id=$1",[id(31)]),'New guest is unaffiliated Member');
 check(await value('select count(*)=1 from project_guest_members where user_id=$1',[id(31)]),'Acceptance activates exactly one project membership');
 check(await value('select r8_accept($1,$2,$3)',[hash,id(31),'New Guest']),'Acceptance response loss retry succeeds');
 check(await value('select assigned_to=$1 and not ($2=any(team_member_ids)) from tasks where id=$3',[id(3),id(31),root]),'Acceptance never assigns work');
 await actor(31);check(await value('select can_see_project($1,$2)',[project,id(31)]),'Guest reads authorized project');check((await value('select r7_work_tree($1)',[root])).people.some(p=>p.id===id(31)),'Guest eligible in scoped people picker');
 check(!await value('select can_contribute_task($1,$2)',[root,id(31)]),'Unassigned guest cannot execute root');
 await value('select r8_complete_onboarding($1)',[req.id]);check((await value('select r8_list_requests($1)',[project])).requests[0].onboarding==='complete','Recipient completes separate onboarding');
 await actor(3);let snapshot=await value('select r7_work_tree($1)',[root]);await value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,snapshot.revision,id(serial++),'contributors',JSON.stringify({people:[id(3),id(4),id(31)]})]);
 await actor(31);check(await value('select can_contribute_task($1,$2)',[root,id(31)]),'Separate authorized assignment enables guest contribution');
 await actor(2);check((await value('select r7_project_members($1)',[project])).members.some(m=>m.user_id===id(31)&&m.state==='guest'),'Members lists guest independently of Office affiliation');
 let accepted=(await value('select r8_list_requests($1)',[project])).requests.find(p=>p.id===req.id);await value('select r8_decide_request($1,$2,$3)',[accepted.id,accepted.revision,'revoked']);
 await actor(31);check(!await value('select can_see_project($1,$2)',[project,id(31)]),'Revocation removes guest access synchronously');
 await db.exec('reset role');await deny('select r8_accept($1,$2,$3)',[hash,id(31),'New Guest']);
 await actor(3);let rejected=await submit('rejected@example.test');await actor(2);rejected=await value('select r8_decide_request($1,$2,$3)',[rejected.id,rejected.revision,'rejected']);await db.exec('reset role');await assert.rejects(reserve(rejected));checks++;
 await actor(3);let existing=await submit('p7@example.test');await actor(2);existing=await value('select r8_decide_request($1,$2,$3)',[existing.id,existing.revision,'approved']);await db.exec('reset role');existing=await reserve(existing,'b'.repeat(64));
 const before=await value('select to_jsonb(p) from profiles p where id=$1',[id(7)]);await value('select r8_accept($1,$2,$3)',['b'.repeat(64),id(7),'Existing']);check(JSON.stringify(await value('select to_jsonb(p) from profiles p where id=$1',[id(7)]))===JSON.stringify(before),'Existing Head keeps role and canonical foreign Office');
 await actor(3);let stale=await submit('stale@example.test');await actor(2);stale=await value('select r8_decide_request($1,$2,$3)',[stale.id,stale.revision,'approved']);await db.exec('reset role');await db.query('update organizations set head_user_id=$1 where id=$2',[id(5),id(90)]);await assert.rejects(reserve(stale));checks++;await db.query('update organizations set head_user_id=$1 where id=$2',[id(2),id(90)]);
 await db.exec('set session_replication_role=replica');await db.query('update tasks set assigned_to=$1 where id=$2',[id(4),root]);await db.exec('set session_replication_role=origin');await assert.rejects(reserve(stale));checks++;await db.exec('set session_replication_role=replica');await db.query('update tasks set assigned_to=$1 where id=$2',[id(3),root]);await db.exec('set session_replication_role=origin');
 await actor(3);await deny('select r8_submit_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id(serial++),project,root,id(999),id(90),'bad@example.test','',[],'OJT',null,true]);
 await deny('select r8_submit_request($1,$2,$3,null,$4,$5,$6,$7,$8,$9,false)',[id(serial++),project,root,id(90),'bad2@example.test','',[],'OJT',null]);
 for(const n of [1,8,9,null]){await actor(n);await assert.rejects(submit('denied'+n+'@example.test'));checks++;}
 await actor(3);let rotate=await submit('rotate@example.test');await actor(2);rotate=await value('select r8_decide_request($1,$2,$3)',[rotate.id,rotate.revision,'approved']);await db.exec('reset role');rotate=await reserve(rotate,'c'.repeat(64));await value('select r8_finish_dispatch($1,$2,null,$3)',[rotate.id,'c'.repeat(64),'Sender is not configured']);await assert.rejects(reserve(rotate,'d'.repeat(64)));checks++;
 await db.query("update project_invitation_requests set last_sent_at=now()-interval '2 minutes' where id=$1",[rotate.id]);rotate=await reserve(rotate,'d'.repeat(64));await deny('select r8_lookup($1)',['c'.repeat(64)]);check((await value('select r8_lookup($1)',['d'.repeat(64)])).email==='rotate@example.test','Retry rotates and invalidates old token');
 await db.query("update project_invitation_requests set expires_at=now()-interval '1 second' where id=$1",[rotate.id]);await deny('select r8_lookup($1)',['d'.repeat(64)]);
 await actor(3);const personal=await value('select r3_create_workspace($1,$2,$3)',[id(serial++),'Personal','Asia/Singapore']);const pp=await value('select r3_create_personal_project($1,$2,$3)',[personal.id,id(serial++),'Personal invite']);
 await assert.rejects(submit('personal@example.test',{project:pp.id,root:null}));checks++;
 await value('select r8_designate_sponsor($1,$2)',[personal.id,id(90)]);
 let personalRequest=await value('select r8_submit_request($1,$2,null,null,$3,$4,$5,$6,$7,null,true)',[id(serial++),pp.id,id(90),'personal@example.test','Summary',['Research'],'OJT']);
 await actor(2);check((await value('select r8_list_requests($1)',[pp.id])).requests.length===1,'Sponsor Head has narrow approval queue without personal workspace grant');personalRequest=await value('select r8_decide_request($1,$2,$3)',[personalRequest.id,personalRequest.revision,'approved']);await db.exec('reset role');personalRequest=await reserve(personalRequest,'e'.repeat(64));
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(32),'personal@example.test']);await value('select r8_accept($1,$2,$3)',['e'.repeat(64),id(32),'Personal Guest']);
 await actor(32);check(await value('select eflow_r3.project_access($1)',[pp.id]),'Personal guest has selected project access');
 await actor(3);await deny('update project_invitation_requests set state=$1 where id=$2',['approved',req.id]);await deny('select * from eflow_r8.tokens');await deny('delete from project_invitation_events');

 // Shared projects must use the same guest-only selected roster and private evidence guards.
 await db.exec('reset role;set session_replication_role=replica');await db.query("insert into project_offices(id,project_id,office_id,relationship_type,invitation_status) values($1,$2,$3,'collaborating','joined')",[id(8500),project,id(91)]);await db.exec('set session_replication_role=origin');
 await actor(3);let shared=await submit('shared@example.test');await actor(2);shared=await value('select r8_decide_request($1,$2,$3)',[shared.id,shared.revision,'approved']);await db.exec('reset role');shared=await reserve(shared,'f'.repeat(64));await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(33),'shared@example.test']);await value('select r8_accept($1,$2,$3)',['f'.repeat(64),id(33),'Shared Guest']);
 await actor(3);let sharedTree=await value('select r7_work_tree($1)',[root]);await value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,sharedTree.revision,id(serial++),'create',JSON.stringify({id:id(8600),title:'Guest branch',lead:id(33),people:[id(33)],standalone:true})]);
 await actor(33);await value('select save_subtask_progress($1,20,null,null,null,$2,null,null)',[id(8600),'Guest progress']);check(await value('select percent_complete=20 from subtasks where id=$1',[id(8600)]),'Shared project guest executes only its assigned branch');
 await value('select submit_subtask_for_review($1,$2::jsonb)',[id(8600),JSON.stringify({note:'Guest evidence',attachments:[{fileName:'guest.pdf'}]})]);check(await value('select reviewer_id=$1 from subtasks where id=$2',[id(3),id(8600)]),'Guest formal evidence routes to independent scoped ancestor');
 await actor(3);await value('select decide_subtask_review($1,true,null)',[id(8600)]);check(await value('select is_completed from subtasks where id=$1',[id(8600)]),'Existing formal evidence acceptance works for scoped guests');await actor(33);
 check(!await value('select eflow_phase6.head($1,$2,$3)',[project,id(90),id(33)]),'Guest never gains Office Head authority');
 await actor(2);check((await value('select r8_head_invitation_queue()')).some(p=>p.project_id===project),'Head Inbox finds approval/dispatch projects');
 await db.exec('reset role');await db.query("insert into user_pds_documents(id,office_id,project_request_id,storage_path,original_filename,mime_type,file_size,uploaded_by,content_sha256) values($1,$2,$3,$4,'PDS.pdf','application/pdf',12,$5,'hash')",[id(8700),id(90),shared.id,'office/private.pdf',id(3)]);
 check(await value('select user_id=$1 from user_pds_documents where id=$2',[id(33),id(8700)]),'Acceptance during upload binds late inserted PDS to correct recipient');
 await actor(33);check((await db.query('select id from user_pds_documents where id=$1',[id(8700)])).rows.length===1,'Accepted recipient sees its private PDS metadata');
 await actor(7);check((await db.query('select id from user_pds_documents where id=$1',[id(8700)])).rows.length===0,'Foreign Head cannot read private request PDS');
 await actor(2);check((await db.query('select id from user_pds_documents where id=$1',[id(8700)])).rows.length===0,'Approving Head is not original uploader; raw PDS stays private');
 await actor(3);check((await db.query('select id from user_pds_documents where id=$1',[id(8700)])).rows.length===1,'Current original scoped uploader can recover private PDS');
 await db.exec('reset role');check(await value('select count(*)>0 from project_invitation_events'),'Immutable transitions recorded');
 check(!await value("select has_function_privilege('anon','r8_reserve_dispatch(uuid,uuid,integer,text,integer,boolean)','execute')"),'Anonymous cannot reserve token');
 check(!await value("select has_function_privilege('authenticated','r8_accept(text,uuid,text,uuid)','execute')"),'Browser cannot spoof acceptance identity');
 await actor(3);let pdsRequest=await submit('pds-guest@example.test');await db.exec('reset role');
 await db.query("insert into user_pds_documents(id,office_id,project_request_id,storage_path,original_filename,mime_type,file_size,uploaded_by,content_sha256,processing_status,professional_draft) values($1,$2,$3,$4,'PDS.pdf','application/pdf',12,$5,'hash','completed',$6::jsonb)",[id(8701),id(90),pdsRequest.id,'office/processed.pdf',id(3),JSON.stringify({skills:['Verified extraction draft'],competency_summary:'Draft summary'})]);
 check(await value('select user_id is null from user_pds_documents where id=$1',[id(8701)]),'Pending request PDS does not create identity or access');
 await actor(2);pdsRequest=await value('select r8_decide_request($1,$2,$3)',[pdsRequest.id,pdsRequest.revision,'approved']);await db.exec('reset role');pdsRequest=await reserve(pdsRequest,'9'.repeat(64));await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(34),'pds-guest@example.test']);await value('select r8_accept($1,$2,$3)',['9'.repeat(64),id(34),'PDS Guest']);
 check(await value('select user_id=$1 from user_pds_documents where id=$2',[id(34),id(8701)]),'Acceptance attaches previously uploaded private PDS');
 check(await value("select skills ? 'Verified extraction draft' and not confirmed_by_user from user_professional_profiles where user_id=$1",[id(34)]),'Already processed PDS becomes an unconfirmed owner draft without added authority');
 await actor(2);pdsRequest=(await value('select r8_list_requests($1)',[project])).requests.find(p=>p.id===pdsRequest.id);await value('select r8_decide_request($1,$2,$3)',[pdsRequest.id,pdsRequest.revision,'revoked']);await db.exec('reset role');await deny("insert into user_pds_documents(id,office_id,project_request_id,storage_path,original_filename,mime_type,file_size,uploaded_by,content_sha256) values($1,$2,$3,$4,'PDS.pdf','application/pdf',12,$5,'hash')",[id(8702),id(90),pdsRequest.id,'office/revoked.pdf',id(3)]);
 console.log(`R8 invitations: ${checks} PostgreSQL checks passed`);

}finally{await db?.close();}
