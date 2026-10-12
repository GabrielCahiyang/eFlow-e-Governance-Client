// NW4.1 / NW-F03: real local workflow/RLS/immutable evidence guards.
// Synthetic claims and Storage metadata do not prove provider JWT/signing bytes.
import assert from 'node:assert/strict';

export async function verifyOfficeReviewRouting({db,root,project,office,personalProject,applyCorrection}) {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const branch=id(8200),child=id(8201);
 let checks=0,request=8300,attempt=8400;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const check=(a,label)=>{assert.ok(a,label);checks++;};
 const actor=async who=>{await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[who?id(who):'']);await db.exec('set role authenticated');};
 // Setup only synthetic historical controls; restore triggers before assertions.
 const setup=async(sql,args=[])=>{await db.exec('reset role;set session_replication_role=replica');try{await db.query(sql,args);}finally{await db.exec('set session_replication_role=origin');}};
 const tree=()=>value('select r7_work_tree($1)',[root]);
 const command=async(name,payload)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(request++),name,JSON.stringify(payload)]);
 const state=async()=>{
  await db.exec('reset role');
  return value(`select jsonb_build_object(
   'tasks',(select jsonb_agg(to_jsonb(t) order by id) from tasks t),
   'nodes',(select jsonb_agg(to_jsonb(t) order by id) from subtasks t),
   'personal',(select jsonb_agg(to_jsonb(t) order by id) from personal_subtasks t),
   'submissions',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submissions t),
   'attachments',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submission_attachments t),
   'seals',(select jsonb_agg(to_jsonb(t) order by bucket_id,object_name) from eflow_evidence.objects t),
   'attempts',(select jsonb_agg(to_jsonb(t) order by kind,submission_id) from eflow_evidence.attempts t),
   'files',(select jsonb_agg(to_jsonb(t) order by id) from storage.objects t),
   'revisions',(select jsonb_agg(to_jsonb(t) order by root_id) from eflow_r7.tree_state t),
   'receipts',(select count(*) from eflow_r7.receipts),'events',(select count(*) from work_tree_events),
   'notifications',(select count(*) from notifications),'audit',(select count(*) from audit_events))`);
 };
 const deny=async(who,sql,args=[],pattern)=>{const before=await state();await actor(who);await assert.rejects(db.query(sql,args),pattern);checks++;equal(await state(),before,'denied operation is atomic');await actor(who);};
 const resolve=async(submitter,expected,node=child)=>{await db.exec('reset role');equal(await value('select eflow_r7.reviewer($1,$2)',[node,id(submitter)]),expected===null?null:id(expected),'current independent candidate');};
 const submit=async(who,node=child)=>{
  const key=id(attempt++),path=`subtasks/${node}/${key}/evidence.pdf`;
  await actor(who);
  await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['task-attachments',path,id(who),JSON.stringify({size:12,mimetype:'application/pdf'})]);
  await value('select submit_subtask_for_review($1,$2::jsonb)',[node,JSON.stringify({id:key,note:'NW4 independent review',attachments:[{fileName:'evidence.pdf',filePath:path,fileSize:999,mimeType:'client/untrusted'}]})]);
  return {key,path,node};
 };
 const route=async(who,record,expected)=>{
  await actor(who);const snapshot=await tree(),n=snapshot.nodes.find(n=>n.id===record.node);
  equal(n.current_reviewer,id(expected),'snapshot current reviewer');
  equal(n.can_review,who===expected,'legacy review flag');
  equal(n.capabilities.review,{allowed:who===expected,reason_code:who===expected?null:'branch_denied'},'review capability');
  const queue=await value('select r7_pending_subtask_reviews()');
  equal(queue.some(row=>row.id===record.key),who===expected,'current-authority inbox');
  // Queue membership is current authority; row attribution remains historical.
  if(who===expected)equal(queue.find(row=>row.id===record.key).submitter_id,id(record.node===child?6:5),'inbox preserves submitter');
 };
 const evidence=async(who,record,allowed)=>{
  await actor(who);
  equal(await value('select eflow_evidence.can_read($1,$2,$3)',['task-attachments',record.path,id(6)]),allowed,'scoped evidence predicate '+who);
  equal(await value('select count(*)::int from storage.objects where bucket_id=$1 and name=$2',['task-attachments',record.path]),allowed?1:0,'Storage SELECT/signing prerequisite '+who);
 };

 // Andrés Task Lead (3) -> Gabriel branch Lead (4) -> Cheryl child Lead (5),
 // Juan contributor (6); the responsible Head is actor 2.
 await setup("update profiles set full_name=case id when $1 then 'Andrés' when $2 then 'Gabriel' when $3 then 'Cheryl' when $4 then 'Juan' else full_name end where id=any($5::uuid[])",[id(3),id(4),id(5),id(6),[3,4,5,6].map(id)]);
 await actor(3);await command('create',{id:branch,title:'Gabriel branch',lead:id(4),people:[id(4)],standalone:true});
 await command('create',{id:child,parent:branch,title:'Cheryl child',lead:id(5),people:[id(5),id(6)],standalone:true});
 await resolve(6,4); // The old parent-first behavior is an explicit control.
 await resolve(5,4);
 await db.exec('reset role');
 const personalRoot=await value('select id from personal_tasks where project_id=$1',[personalProject]);
 const personalNodes=(await db.query('select id from personal_subtasks where task_id=$1 order by id',[personalRoot])).rows.map(n=>n.id);
 const personalBefore=[];
 for(const n of personalNodes)for(const who of [21,22,23])personalBefore.push([n,who,await value('select eflow_r7.reviewer($1,$2)',[n,id(who)])]);
 const legacyNode=id(7691),legacyBefore=await value('select eflow_r7.reviewer($1,$2)',[legacyNode,id(5)]);
 const rootRoutingBefore=await value('select jsonb_build_object(\'mode\',review_route_mode,\'reviewer\',reviewer_id,\'backup\',backup_reviewer_id) from tasks where id=$1',[root]);
 const readScopeBefore=new Map();
 for(const who of [1,2,3,4,5,6,7,8,10,11,12,13,16,17]){
  await actor(who);await db.exec('reset role');
  readScopeBefore.set(who,await value('select eflow_evidence.can_read_task($1,$2)',[root,child]));
 }
 const catalogSql=`select jsonb_agg(jsonb_build_object('oid',oid,'name',oid::regprocedure::text,'body',prosrc,'acl',proacl,'config',proconfig,'definer',prosecdef,'volatility',provolatile,'args',pg_get_function_arguments(oid),'result',pg_get_function_result(oid)) order by oid) from pg_proc where pronamespace in ('public'::regnamespace,'eflow_r7'::regnamespace,'eflow_r3'::regnamespace,'eflow_r9'::regnamespace,'eflow_evidence'::regnamespace)`;
 const beforeCatalog=await value(catalogSql),beforeState=await state();
 await applyCorrection();
 equal(await state(),beforeState,'migration preserves every workflow/evidence/history row');
 const afterCatalog=await value(catalogSql);
 equal(afterCatalog.length,beforeCatalog.length,'no functions or APIs added');
 const oldReviewer=beforeCatalog.find(f=>f.name==='eflow_r7.reviewer(uuid,uuid)');
 const anchor='r:=eflow_r7.root(n.task_id);v_id:=n.parent_subtask_id;';
 const replacement="r:=eflow_r7.root(n.task_id);v_id:=case when r->>'kind'='office' and not exists(select 1 from public.tasks t where t.id=n.task_id and t.proposed_office_identity_id is not null) then n.id else n.parent_subtask_id end;";
 equal(oldReviewer.body.split(anchor).length,2,'exact prerequisite anchor');
 for(let i=0;i<beforeCatalog.length;i++)equal(afterCatalog[i],beforeCatalog[i].oid===oldReviewer.oid?{...beforeCatalog[i],body:beforeCatalog[i].body.replace(anchor,replacement)}:beforeCatalog[i],'only reviewer start changes: '+beforeCatalog[i].name);
 await applyCorrection();equal(await value(catalogSql),afterCatalog,'migration safe rerun without ACL/body drift');
 equal(await state(),beforeState,'rerun preserves histories and seals');
 for(const [n,who,expected] of personalBefore)equal(await value('select eflow_r7.reviewer($1,$2)',[n,id(who)]),expected,'personal reviewer unchanged');
 equal(await value('select eflow_r7.reviewer($1,$2)',[legacyNode,id(5)]),legacyBefore,'absent R7 root legacy fallback unchanged');
 equal(await value('select eflow_r7.reviewer($1,$2)',[legacyNode,id(5)]),await value('select resolve_subtask_reviewer(t,$2) from tasks t join subtasks s on s.task_id=t.id where s.id=$1',[legacyNode,id(5)]),'legacy result agrees with original resolver');
 // An unresolved Office planning root remains excluded despite an R7 root.
 await setup('update tasks set proposed_office_identity_id=$1 where id=$2',[id(8990),root]);
 await resolve(6,4);await setup('update tasks set proposed_office_identity_id=null where id=$1',[root]);
 await resolve(6,5);await resolve(5,4);
 await setup('update subtasks set lead_id=$1 where id=$2',[id(5),branch]);
 await resolve(5,3);await setup('update subtasks set lead_id=$1 where id=$2',[id(4),branch]);
 // Eligibility is read fresh; an invalid own Lead does not invalidate its parent.
 await setup('update profiles set is_active=false where id=$1',[id(5)]);await resolve(6,4);await setup('update profiles set is_active=true where id=$1',[id(5)]);
 for(const change of ["access_ended_at=now()","access_end=now()-interval '1 second',engagement='OJT'"]){
  await setup(`update project_office_members set ${change} where project_office_id=$1 and user_id=$2`,[office,id(5)]);await resolve(6,4);
  await setup("update project_office_members set access_ended_at=null,access_end=null,engagement='Permanent' where project_office_id=$1 and user_id=$2",[office,id(5)]);
 }
 await setup('update profiles set org_id=$1 where id=$2',[id(91),id(5)]);await resolve(6,4);await setup('update profiles set org_id=$1 where id=$2',[id(90),id(5)]);
 // A broken higher chain blocks lower candidates; valid Task Lead still reviews.
 await setup('update profiles set is_active=false where id=$1',[id(4)]);await resolve(6,3);await setup('update profiles set is_active=true where id=$1',[id(4)]);
 // Only the currently appointed responsible Head is the final candidate.
 await setup('update tasks set assigned_to=$1 where id=$2',[id(6),root]);
 await setup('update subtasks set lead_id=$1 where id=any($2::uuid[])',[id(6),[branch,child]]);await resolve(6,2);
 await setup('update profiles set is_active=false where id=$1',[id(2)]);await resolve(6,null);
 await actor(6);equal((await tree()).nodes.find(n=>n.id===child).capabilities.submit,{allowed:false,reason_code:'lifecycle_blocked'},'no candidate disables submission');
 const deniedKey=id(attempt++),deniedPath=`subtasks/${child}/${deniedKey}/denied.pdf`;
 await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['task-attachments',deniedPath,id(6),JSON.stringify({size:12,mimetype:'application/pdf'})]);
 await deny(6,'select submit_subtask_for_review($1,$2::jsonb)',[child,JSON.stringify({id:deniedKey,note:'No independent reviewer',attachments:[{fileName:'denied.pdf',filePath:deniedPath}]})],/No eligible Team Leader or task reviewer/);
 await setup('update profiles set is_active=true where id=$1',[id(2)]);await setup('update tasks set assigned_to=$1 where id=$2',[id(3),root]);
 await setup('update subtasks set lead_id=$1 where id=$2',[id(4),branch]);await setup('update subtasks set lead_id=$1 where id=$2',[id(5),child]);

 const first=await submit(6);await db.exec('reset role');
 const identity=await value('select to_jsonb(s) from subtask_submissions s where id=$1',[first.key]);
 equal(identity.submitter_id,id(6),'Juan recorded as submitter');equal(identity.reviewer_id,id(5),'Cheryl recorded as initial reviewer');
 equal(await value('select completed_by from subtasks where id=$1',[child]),null,'pending child has no completion author');
 const seals=await value('select jsonb_agg(to_jsonb(o)) from eflow_evidence.objects o where object_name=$1',[first.path]);
 equal(seals[0].state,'finalized','formal evidence sealed');equal(seals[0].actor_id,id(6),'seal uploader retained');
 equal(await value('select jsonb_build_object(\'size\',file_size,\'mime\',mime_type,\'author\',uploaded_by) from subtask_submission_attachments where submission_id=$1',[first.key]),{size:12,mime:'application/pdf',author:id(6)},'trusted metadata and authorship');
 await route(5,first,5);await route(4,first,5);await route(6,first,5);
 await evidence(5,first,true);await evidence(7,first,true);await evidence(12,first,false);await evidence(8,first,false);await evidence(17,first,false);
 for(const [who,allowed] of readScopeBefore)await evidence(who,first,allowed);
 await deny(6,'select decide_subtask_review($1,true,null)',[child],/own subtask submission/);
 await deny(4,'select decide_subtask_review($1,true,null)',[child]);
 // Existing checked appointment changes authority, never the old submission.
 await actor(4);await command('staff',{id:child,lead:id(13),people:[id(13),id(6)]});
 await db.exec('reset role');equal(await value('select to_jsonb(s) from subtask_submissions s where id=$1',[first.key]),identity,'pending identity and historical reviewer attribution untouched');
 equal(await value('select jsonb_agg(to_jsonb(o)) from eflow_evidence.objects o where object_name=$1',[first.path]),seals,'transfer preserves exact formal seal');
 await route(5,first,13);await route(13,first,13);await evidence(13,first,true);
 await deny(5,'select decide_subtask_review($1,true,null)',[child]);
 await actor(13);await value('select decide_subtask_review($1,true,null)',[child]);
 await db.exec('reset role');const approved=await value('select to_jsonb(s) from subtask_submissions s where id=$1',[first.key]);
 equal(approved.reviewer_id,id(5),'historical initially selected reviewer retained');equal(approved.decided_by,id(13),'actual decision author recorded');equal(approved.submitter_id,id(6),'submitter unchanged');
 equal(await value('select completed_by from subtasks where id=$1',[child]),id(6),'completion belongs to worker');
 await actor(3);await command('staff',{id:branch,lead:id(15),people:[id(15)]});
 await db.exec('reset role');equal(await value('select to_jsonb(s) from subtask_submissions s where id=$1',[first.key]),approved,'later appointment preserves old approved decision');
 equal(await value('select jsonb_agg(to_jsonb(o)) from eflow_evidence.objects o where object_name=$1',[first.path]),seals,'approved evidence remains sealed');
 await actor(3);await command('staff',{id:branch,lead:id(4),people:[id(4)]});
 // A genuine own-Lead submission skips Cheryl and is reviewed by Gabriel.
 const own=id(8202);await actor(4);await command('create',{id:own,parent:branch,title:'Own-Lead submission',lead:id(5),people:[id(5)],standalone:true});
 const second=await submit(5,own);await route(4,second,4);await deny(5,'select decide_subtask_review($1,true,null)',[own],/own subtask submission/);
 await actor(4);await value('select decide_subtask_review($1,true,null)',[own]);
 // Parent task reviewer remains its appointed Head, never its Task Lead.
 await db.exec('reset role');equal(await value('select jsonb_build_object(\'mode\',review_route_mode,\'reviewer\',reviewer_id,\'backup\',backup_reviewer_id) from tasks where id=$1',[root]),rootRoutingBefore,'stored root routing unchanged');
 // Same dynamic Office default lookup used by submit_task_for_review; this
 // historical synthetic root has not yet populated its submission reviewer_id.
 equal(await value('select o.head_user_id from tasks t join organizations o on o.id=t.org_id where t.id=$1 and is_office_output_reviewer(o.id,o.head_user_id)',[root]),id(2),'official root resolves responsible Head');
 for(const who of [3,4,5,6])equal(await value('select is_office_output_reviewer($1,$2)',[id(90),id(who)]),false,'Task/Subitem Leads and contributor are not root reviewers');
 equal(await value('select percent_complete from tasks where id=$1',[root]),37,'manually stored root progress unchanged');
 check(await value('select phase2_is_office_head($1,$2)',[id(2),id(90)]),'official root reviewer still appointed Head');
 console.log(`NW4.1 / NW-F03: ${checks} assertions passed; own-Lead-first route, current pending authority, real evidence seals and Storage SELECT, unchanged personal/legacy/root review; no hosted writes.`);
 return checks;
}
