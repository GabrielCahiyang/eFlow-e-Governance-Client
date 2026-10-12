// NW-F02: real assignment/workflow/evidence guards in disposable PostgreSQL.
// Role/claim simulation and Storage metadata are not genuine JWT/file bytes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function verifyOwnLeadExecution({db,root,project,office,personalProject,applyCorrection}) {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const leaf=id(7600), personalLeaf=id(7480);
 let checks=0,request=7800,attempt=7900;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const check=(a,label)=>{assert.ok(a,label);checks++;};
 const actor=async who=>{
  await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[who?id(who):'']);await db.exec('set role authenticated');
 };
 const setup=async(sql,args=[])=>{
  await db.exec('reset role;set session_replication_role=replica');
  try {await db.query(sql,args);} finally {await db.exec('set session_replication_role=origin');}
 };
 const tree=()=>value('select r7_work_tree($1)',[root]);
 const node=async n=>(await tree()).nodes.find(row=>row.id===(typeof n==='number'?id(n):n));
 const command=async(name,payload)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(request++),name,JSON.stringify(payload)]);
 const state=async()=>{
  await db.exec('reset role');
  return value(`select jsonb_build_object(
   'root',(select to_jsonb(t) from tasks t where id=$1),
   'nodes',(select jsonb_agg(to_jsonb(t) order by id) from subtasks t where task_id=$1),
   'revision',(select revision from eflow_r7.tree_state where root_id=$1),
   'progress',(select jsonb_agg(to_jsonb(t) order by id) from subtask_progress_updates t),
   'submissions',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submissions t),
   'attachments',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submission_attachments t),
   'attempts',(select jsonb_agg(to_jsonb(t) order by submission_id,kind) from eflow_evidence.attempts t),
   'seals',(select jsonb_agg(to_jsonb(t) order by bucket_id,object_name) from eflow_evidence.objects t),
   'files',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t),
   'receipts',(select count(*) from eflow_r7.receipts),'events',(select count(*) from work_tree_events),
   'notifications',(select count(*) from notifications),'audit',(select count(*) from audit_events),
   'activities',(select count(*) from task_activities))`,[root]);
 };
 const deny=async(who,sql,args=[],pattern,guardOnly=false)=>{
  const before=await state();await actor(who);
  // Owner role bypasses table RLS only for direct trigger tests. The genuine
  // guard still receives the synthetic actor and is never disabled/stubbed.
  if(guardOnly)await db.exec('reset role');
  await assert.rejects(db.query(sql,args),pattern);checks++;
  equal(await state(),before,'denial preserves rows, attempts, seals, revision and authorship');await actor(who);
 };
 const progress=(who,n=leaf,path=null)=>{return value('select save_subtask_progress($1,25,null,null,null,$2,$3,$4)',[n,'Own-Lead execution',path,path?'progress.pdf':null]);};
 const submission=(key,path,n=leaf)=>({id:key,note:'Own-Lead formal evidence',attachments:[{fileName:'evidence.pdf',filePath:path,fileSize:999,mimeType:'untrusted/client-type'}]});
 const submit=(n,payload)=>value('select submit_subtask_for_review($1,$2::jsonb)',[n,JSON.stringify(payload)]);
 const upload=async(who,path,metadata={size:12,mimetype:'application/pdf'})=>{
  await actor(who);await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['task-attachments',path,id(who),JSON.stringify(metadata)]);
 };
 const predicates=async(who,allowed)=>{
  await actor(who);await db.exec('reset role');
  equal(await value('select coalesce(eflow_r7.node_work($1,$2),false)',[leaf,who?id(who):null]),allowed,'node_work actor '+who);
  await actor(who);equal(await value('select eflow_evidence.can_upload($1)',[`subtasks/${leaf}/${id(7999)}/probe.pdf`]),allowed,'upload actor '+who);
 };
 const denyExecution=async(who,label)=>{
  await predicates(who,false);
  const key=id(attempt++),path=`subtasks/${leaf}/${key}/denied.pdf`;
  await deny(who,'insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['task-attachments',path,who?id(who):null,JSON.stringify({size:12,mimetype:'application/pdf'})]);
  await deny(who,'select save_subtask_progress($1,25,null,null,null,$2,null,null)',[leaf,label]);
  await deny(who,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify(submission(key,path))]);
  await deny(who,'insert into subtask_submissions(id,subtask_id,task_id,version,submitter_id,submitter_name,reviewer_id,note) values($1,$2,$3,1,$4,$5,$6,$5)',[key,leaf,root,who?id(who):null,label,id(4)],undefined,true);
  await deny(who,'insert into subtask_progress_updates(subtask_id,task_id,author_id,author_name,percent_complete,note) values($1,$2,$3,$4,25,$4)',[leaf,root,who?id(who):null,label],undefined,true);
 };

 // Reopen only the synthetic root closed by NW2.1. All real triggers/roles are
 // restored before fixture assertions. Never repair hosted staffing arrays.
 await setup("update tasks set status='todo' where id=$1",[root]);
 await actor(3);await command('create',{id:leaf,parent:id(101),title:'Historical Lead-only leaf',lead:id(5),people:[id(5),id(6)],standalone:true});
 check((await node(7600)).assigned_to_ids.includes(id(5)),'ordinary appointment keeps Lead in compatibility workers');
 await command('staff',{id:leaf,lead:id(5),people:[id(5),id(6)]});
 equal(await value('select assigned_to from subtasks where id=$1',[leaf]),id(5),'normal staffing keeps primary Lead');
 check((await node(7600)).assigned_to_ids.includes(id(5)),'normal staffing keeps Lead in compatibility array');
 await setup('update subtasks set assigned_to=null,assigned_to_ids=$1::uuid[] where id=$2',[[id(6)],leaf]);
 await actor(5);equal((await node(7600)).can_work,false,'pre-correction Lead-only snapshot denies');
 await denyExecution(5,'pre-correction Lead-only control');
 await actor(21);
 const personalRoot=await value('select id from personal_tasks where project_id=$1',[personalProject]);
 await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject,'set_member',JSON.stringify({user_id:id(23),access:'member',state:'active'}),id(request++)]);
 const personalTree=()=>value('select r7_work_tree($1)',[personalRoot]);
 await value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[personalRoot,(await personalTree()).revision,id(request++),'create',JSON.stringify({id:personalLeaf,title:'Personal Lead-only control',lead:id(22),people:[id(22),id(23)],standalone:true})]);
 await setup('update personal_subtasks set assigned_to_ids=$1::uuid[] where id=$2',[[id(23)],personalLeaf]);
 await actor(22);const personalBefore=await personalTree();

 await db.exec('reset role');
 const catalogSql=`select jsonb_agg(jsonb_build_object('id',case when pronamespace='public'::regnamespace then 'public.' else '' end||oid::regprocedure::text,'body',prosrc,
  'acl',proacl,'path',proconfig,'definer',prosecdef,'volatility',provolatile,
  'args',pg_get_function_arguments(oid),'result',pg_get_function_result(oid)) order by oid)
  from pg_proc where pronamespace in ('eflow_r7'::regnamespace,'eflow_r9'::regnamespace,'eflow_evidence'::regnamespace,'eflow_r3'::regnamespace)
   or pronamespace='public'::regnamespace and proname in ('save_subtask_progress','submit_subtask_for_review','guard_subtask_contributor_update','decide_subtask_review','guard_subtask_execution_dependencies','phase6_guard_subtask')`;
 const beforeCatalog=await value(catalogSql);
 const beforeCorrection=await state();
 await applyCorrection();
 const afterCatalog=await value(catalogSql);
 equal(await state(),beforeCorrection,'migration rewrites no staffing or history rows');
 equal(afterCatalog.length,beforeCatalog.length,'no function catalog additions/removals');
 const migration=await readFile(new URL('../../../supabase/migrations/20261010105440_nested_work_own_lead_execution.sql',import.meta.url),'utf8');
 const rewrites=[...migration.matchAll(/\('([^']+)',\s*\$before\$([\s\S]*?)\$before\$,\s*\$after\$([\s\S]*?)\$after\$\)/g)];
 equal(rewrites.length,7,'seven reviewed assignment corrections');
 for(const before of beforeCatalog){
  const after=afterCatalog.find(row=>row.id===before.id),rewrite=rewrites.find(row=>row[1]===before.id);
  equal({...after,body:null},{...before,body:null},'signature/default/grant/security unchanged: '+before.id);
  equal(after.body.replace(/\r/g,''),rewrite?before.body.replace(/\r/g,'').replace(rewrite[2],rewrite[3]):before.body.replace(/\r/g,''),'only reviewed assignment expression changes: '+before.id);
 }
 await actor(22);equal(await personalTree(),personalBefore,'entire personal snapshot unchanged by correction');
 const frozenArrays=()=>value('select jsonb_build_object(\'lead\',lead_id,\'primary\',assigned_to,\'workers\',assigned_to_ids) from subtasks where id=$1',[leaf]);
 await db.exec('reset role');const staffing=await frozenArrays();
 equal(staffing,{lead:id(5),primary:null,workers:[id(6)]},'both worker fields omit own Lead');
 await predicates(5,true);await actor(5);
 equal((await node(7600)).can_work,true,'legacy can_work agrees');
 equal((await node(7600)).capabilities.execute,{allowed:true,reason_code:null},'execute action agrees');
 equal((await node(7600)).capabilities.submit,{allowed:true,reason_code:null},'submit action agrees');
 equal((await node(7600)).capabilities.appoint_lead,{allowed:false,reason_code:'appointment_denied'},'execution does not grant self-replacement');

 for(const who of [2,3,4,15,16,7,10,11,1,8,9,null])await denyExecution(who,'unassigned/oversight actor '+who);
 // Independent copies of current authority state, restored between scenarios.
 const changes=[
  ['inactive',"update profiles set is_active=false where id=$1",[id(5)],'update profiles set is_active=true where id=$1',[id(5)]],
  ['unconfirmed','update auth.users set email_confirmed_at=null where id=$1',[id(5)],'update auth.users set email_confirmed_at=now() where id=$1',[id(5)]],
  ['expired',"update project_office_members set engagement='OJT',access_end=now()-interval '1 second' where project_office_id=$1 and user_id=$2",[office,id(5)],"update project_office_members set engagement='Permanent',access_end=null where project_office_id=$1 and user_id=$2",[office,id(5)]],
  ['revoked','update project_office_members set access_ended_at=now() where project_office_id=$1 and user_id=$2',[office,id(5)],'update project_office_members set access_ended_at=null where project_office_id=$1 and user_id=$2',[office,id(5)]],
  ['removed','insert into eflow_r9.removed(project_id,user_id,scope) values($1,$2,$3)',[project,id(5),id(90)],'delete from eflow_r9.removed where project_id=$1 and user_id=$2 and scope=$3',[project,id(5),id(90)]],
  ['broken parent chain','update subtasks set lead_id=null where id=$1',[id(101)],'update subtasks set lead_id=$1 where id=$2',[id(4),id(101)]],
  ['broken Task Lead chain','update project_office_members set access_ended_at=now() where project_office_id=$1 and user_id=$2',[office,id(3)],'update project_office_members set access_ended_at=null where project_office_id=$1 and user_id=$2',[office,id(3)]],
  ['obsolete own Lead','update subtasks set lead_id=$1 where id=$2',[id(16),leaf],'update subtasks set lead_id=$1 where id=$2',[id(5),leaf]],
  ['closed project',"update projects set status='completed' where id=$1",[project],"update projects set status='planning' where id=$1",[project]],
  ['closed Task',"update tasks set status='for_review' where id=$1",[root],"update tasks set status='todo' where id=$1",[root]],
 ];
 for(const [label,sql,args,restore,restoreArgs] of changes){await setup(sql,args);await denyExecution(5,label);await setup(restore,restoreArgs);}
 await setup('update subtasks set lead_id=$1 where id=$2',[id(7),leaf]);await denyExecution(7,'foreign Office appointed Lead');await setup('update subtasks set lead_id=$1 where id=$2',[id(5),leaf]);
 await predicates(6,true);await actor(6);await progress(6);
 await predicates(5,true);await actor(5);await progress(5);
 // The contributor trigger admits current worker eligibility while retaining
 // direct completion/structural guards. Owner role isolates the real trigger.
 await db.exec('reset role');await db.query('update subtasks set updated_at=now() where id=$1',[leaf]);checks++;
 await deny(5,'update subtasks set percent_complete=77 where id=$1',[leaf],/direct check-off/,true);
 await deny(5,'update subtasks set title=$1 where id=$2',['Illicit direct planning',leaf],undefined,true);
 await deny(5,'insert into subtask_progress_updates(subtask_id,task_id,author_id,author_name,percent_complete) values($1,$2,$3,$4,25)',[leaf,root,id(6),'Spoofed author'],/authenticated author/,true);
 await deny(5,'insert into subtask_submissions(id,subtask_id,task_id,version,submitter_id,submitter_name,reviewer_id,note) values($1,$2,$3,1,$4,$5,$4,$5)',[id(attempt++),leaf,root,id(5),'Self review'],/Invalid subtask reviewer/,true);

 const progressPath=`subtasks/${leaf}/progress/lead-progress.pdf`;
 await upload(5,progressPath);await progress(5,leaf,progressPath);
 await db.exec('reset role');
 check(await value("select exists(select 1 from eflow_evidence.objects where object_name=$1 and actor_id=$2 and reference_kind='progress' and state='finalized')",[progressPath,id(5)]),'Lead-only progress attachment sealed');
 const sealedBefore=await state();await actor(5);
 equal((await db.query('delete from storage.objects where name=$1 returning id',[progressPath])).rows,[],'Storage RLS filters finalized deletion');
 equal(await state(),sealedBefore,'filtered deletion preserves finalized Storage object and all history');
 await deny(5,'insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['task-attachments',`subtasks/${leaf}/${id(attempt++)}/spoof.pdf`,id(6),JSON.stringify({size:12,mimetype:'application/pdf'})]);
 await actor(5);equal(await value('select eflow_evidence.can_upload($1)',['subtasks/not-a-uuid/attempt/evidence.pdf']),false,'malformed path denied');
 for(const metadata of [{size:0,mimetype:'application/pdf'},{size:52428801,mimetype:'application/pdf'},{size:12,mimetype:'application/x-invalid'}]){
  const key=id(attempt++),path=`subtasks/${leaf}/${key}/invalid.pdf`;await upload(5,path,metadata);
  await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify(submission(key,path))],/nonempty|50 MiB|MIME/);
 }
 const foreignKey=id(attempt++),foreignPath=`subtasks/${leaf}/${foreignKey}/other-owner.pdf`;await upload(6,foreignPath);
 await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify(submission(foreignKey,foreignPath))],/uploaded by you/);
 const mismatchKey=id(attempt++),mismatchPath=`subtasks/${leaf}/${mismatchKey}/attempt.pdf`;await upload(5,mismatchPath);
 await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify(submission(id(attempt++),mismatchPath))],/task and attempt/);
 await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify({id:id(attempt++),note:'Missing evidence',attachments:[]})],/evidence file/);
 await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify({...submission(id(attempt++),mismatchPath),note:''})],/Completion note/);
 const manyKey=id(attempt++),many=[];
 for(let i=0;i<11;i++){const path=`subtasks/${leaf}/${manyKey}/file-${i}.pdf`;await upload(5,path);many.push(submission(manyKey,path).attachments[0]);}
 await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[leaf,JSON.stringify({id:manyKey,note:'Too many files',attachments:many})],/10 evidence files/);
 // Valid uploaded evidence still cannot bypass ordered execution prerequisites.
 await actor(3);
 await command('create',{id:id(7620),parent:id(101),title:'Ordered prerequisite',lead:id(5)});
 await command('create',{id:id(7621),parent:id(101),title:'Ordered Lead-only follower',lead:id(5)});
 await setup('update subtasks set assigned_to=null,assigned_to_ids=$1::uuid[] where id=$2',[[id(6)],id(7621)]);
 await actor(5);equal((await node(7621)).capabilities.execute,{allowed:false,reason_code:'lifecycle_blocked'},'ordered capability blocked');
 await deny(5,'select save_subtask_progress($1,25,null,null,null,null,null,null)',[id(7621)],/Complete Step/);
 const orderedKey=id(attempt++),orderedPath=`subtasks/${id(7621)}/${orderedKey}/ordered.pdf`;await upload(5,orderedPath);
 await deny(5,'select submit_subtask_for_review($1,$2::jsonb)',[id(7621),JSON.stringify(submission(orderedKey,orderedPath))],/Complete Step/);

 const key=id(attempt++),path=`subtasks/${leaf}/${key}/lead-formal.pdf`;await upload(5,path);await submit(leaf,submission(key,path));
 await db.exec('reset role');
 check(await value('select exists(select 1 from eflow_evidence.attempts where submission_id=$1 and actor_id=$2 and subtask_id=$3 and kind=$4)',[key,id(5),leaf,'subtask']),'Lead-only genuine attempt guard recorded');
 equal(await value('select jsonb_build_object(\'size\',file_size,\'mime\',mime_type,\'author\',uploaded_by) from subtask_submission_attachments where submission_id=$1',[key]),{size:12,mime:'application/pdf',author:id(5)},'Storage metadata overrides untrusted client metadata');
 check(await value("select exists(select 1 from eflow_evidence.objects where object_name=$1 and actor_id=$2 and subtask_id=$3 and state='finalized')",[path,id(5),leaf]),'Lead-only formal evidence sealed durably');
 equal(await frozenArrays(),staffing,'execution does not repair either worker field');
 equal(await value('select percent_complete from tasks where id=$1',[root]),37,'manual Task progress unchanged');
 await actor(5);equal((await node(7600)).capabilities.execute,{allowed:false,reason_code:'lifecycle_blocked'},'review locks execution');
 await deny(5,'select save_subtask_progress($1,25,null,null,null,null,null,null)',[leaf],/locked/);
 await deny(5,'select decide_subtask_review($1,true,null)',[leaf]);
 await actor(4);await value('select decide_subtask_review($1,true,null)',[leaf]);
 await db.exec('reset role');equal(await value('select jsonb_build_object(\'worker\',submitter_id,\'reviewer\',decided_by) from subtask_submissions where id=$1',[key]),{worker:id(5),reviewer:id(4)},'historical submitter/decision actors retained');
 equal(await value('select completed_by from subtasks where id=$1',[leaf]),id(5),'completed authorship retained');
 equal(await frozenArrays(),staffing,'approval does not backfill worker arrays');
 await actor(5);await deny(5,'select save_subtask_progress($1,25,null,null,null,null,null,null)',[leaf]);

 // Personal own-Lead absent from workers stays denied; an assigned worker still
 // progresses under the existing independent personal review contract.
 await actor(22);equal((await personalTree()).nodes.find(row=>row.id===personalLeaf).can_work,false,'personal Lead-only predicate unchanged');
 await assert.rejects(db.query('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[personalRoot,(await personalTree()).revision,id(request++),'progress',JSON.stringify({id:personalLeaf,progress:25})]),/assigned worker/);checks++;
 await actor(23);await value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[personalRoot,(await personalTree()).revision,id(request++),'progress',JSON.stringify({id:personalLeaf,progress:25})]);
 // An excluded unprojected root retains the original raw assigned_to fallback.
 const legacyRoot=id(7690),legacyLeaf=id(7691);
 await setup(`insert into tasks select (jsonb_populate_record(null::tasks,to_jsonb(t)||jsonb_build_object('id',$1::uuid,'linked_project_id',null,'group_id',null,'status','todo','archived_at',null))).* from tasks t where id=$2`,[legacyRoot,root]);
 await setup(`insert into subtasks select (jsonb_populate_record(null::subtasks,to_jsonb(s)||jsonb_build_object('id',$1::uuid,'task_id',$2::uuid,'parent_subtask_id',null,'lead_id',null,'assigned_to',$3::uuid,'status','todo','percent_complete',0,'is_completed',false,'latest_submission_id',null,'reviewer_id',null,'completed_by',null,'completed_at',null,'position',0,'sibling_order',0))).* from subtasks s where id=$4`,[legacyLeaf,legacyRoot,id(5),leaf]);
 await actor(5);check(await value('select eflow_evidence.can_upload($1)',[`subtasks/${legacyLeaf}/${id(attempt++)}/legacy.pdf`]),'legacy raw primary assignee still uploads');
 await progress(5,legacyLeaf);
 const legacyKey=id(attempt++),legacyPath=`subtasks/${legacyLeaf}/${legacyKey}/legacy.pdf`;await upload(5,legacyPath);await submit(legacyLeaf,submission(legacyKey,legacyPath));
 console.log(`NW2.2 / NW-F02: ${checks} assertions passed; canonical Lead-only node=${leaf}, personal control=${personalLeaf}, legacy root=${legacyRoot}; real guarded progress, authenticated Storage INSERT, attempt and formal seal; no hosted writes.`);
 return checks;
}
