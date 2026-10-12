// NW4.2: exercise installed completion/routing guards, never replace them.
// Synthetic historical cash/status controls are local fixtures, not settlement
// or provider JWT/Storage acceptance. Triggers remain enabled for all operations.
import assert from 'node:assert/strict';

export async function verifyNestedWorkCompletion({db,project,root:dependency,personalProject,applyCorrection}) {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 let checks=0,request=9200,attempt=9400,root;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const actor=async who=>{await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[who?id(who):'']);await db.exec('set role authenticated');};
 const setup=async(sql,args=[])=>{await db.exec('reset role;set session_replication_role=replica');try{await db.query(sql,args);}finally{await db.exec('set session_replication_role=origin');}};
 const tree=()=>value('select r7_work_tree($1)',[root]);
 const command=async(name,payload)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(request++),name,JSON.stringify(payload)]);
 const state=async()=>{
  await db.exec('reset role');
  return value(`select jsonb_build_object(
   'tasks',(select jsonb_agg(to_jsonb(t) order by id) from tasks t),
   'personal_tasks',(select jsonb_agg(to_jsonb(t) order by id) from personal_tasks t),
   'nodes',(select jsonb_agg(to_jsonb(t) order by id) from subtasks t),
   'personal_nodes',(select jsonb_agg(to_jsonb(t) order by id) from personal_subtasks t),
   'submissions',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submissions t),
   'root_submissions',(select jsonb_agg(to_jsonb(t) order by id) from task_submissions t),
   'attachments',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submission_attachments t),
   'root_attachments',(select jsonb_agg(to_jsonb(t) order by id) from task_attachments t),
   'seals',(select jsonb_agg(to_jsonb(t) order by bucket_id,object_name) from eflow_evidence.objects t),
   'attempts',(select jsonb_agg(to_jsonb(t) order by kind,submission_id) from eflow_evidence.attempts t),
   'cash',(select jsonb_agg(to_jsonb(t) order by id) from petty_cash_requests t),
   'revisions',(select jsonb_agg(to_jsonb(t) order by root_id) from eflow_r7.tree_state t),
   'receipts',(select count(*) from eflow_r7.receipts),'events',(select count(*) from work_tree_events),
   'progress',(select count(*) from subtask_progress_updates),'notifications',(select count(*) from notifications),
   'audit',(select count(*) from audit_events),'history',(select count(*) from task_status_history))`);
 };
 const deny=async(who,sql,args,pattern)=>{const before=await state();await actor(who);await assert.rejects(db.query(sql,args),pattern);checks++;equal(await state(),before,'denial preserves rows, histories, receipts and seals');await actor(who);};
 const denyCommand=async(who,name,payload,pattern)=>{await actor(who);const revision=(await tree()).revision;await deny(who,'select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,revision,id(request++),name,JSON.stringify(payload)],pattern);};
 const upload=async(who,node)=>{
  await actor(who);const key=id(attempt++),path=node?`subtasks/${node}/${key}/evidence.pdf`:`${root}/${key}/evidence.pdf`;
  await db.query('insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4::jsonb)',['task-attachments',path,id(who),JSON.stringify({size:12,mimetype:'application/pdf'})]);
  return {key,path,payload:JSON.stringify({id:key,note:'NW4.2 explicit completion evidence',attachments:[{fileName:'evidence.pdf',filePath:path,fileSize:999,mimeType:'untrusted/client'}]})};
 };
 const submit=async(node)=>{const record=await upload(6,node);await value('select submit_subtask_for_review($1,$2::jsonb)',[node,record.payload]);return record;};
 const approve=async(node,who=4)=>{await actor(who);await value('select decide_subtask_review($1,true,null)',[node]);};
 const newOfficeRoot=async title=>{
  await actor(2);const group=await value('select id from project_groups where project_id=$1 order by position limit 1',[project]);
  root=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,title]);
  await setup("update tasks set status='in_progress',assigned_to=$1,team_member_ids=$2::uuid[],due_date='2026-12-31',percent_complete=37 where id=$3",[id(3),[3,4,5,6,13].map(id),root]);
  await actor(3);
 };
 const cash=async(node,key)=>setup(`insert into petty_cash_requests(id,request_number,fiscal_budget_id,commitment_id,allocation_id,org_id,funding_org_id,requester_org_id,task_id,subtask_id,requester_id,purpose,requested_amount,status)
  values($1,$2,$3,$3,$3,$4,$4,$4,$5,$6,$7,'Historical cash blocker control',10,'released')`,[id(key),key,id(9990),id(90),root,node,id(6)]);

 await db.exec('reset role');
 const catalog=()=>value(`select jsonb_agg(jsonb_build_object('name',oid::regprocedure::text,'body',prosrc,'acl',proacl,'config',proconfig,'definer',prosecdef,'args',pg_get_function_arguments(oid),'result',pg_get_function_result(oid)) order by oid) from pg_proc where pronamespace in ('public'::regnamespace,'eflow_r7'::regnamespace,'eflow_r3'::regnamespace,'eflow_r9'::regnamespace,'eflow_evidence'::regnamespace)`);
 const policies=()=>value("select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','eflow_r7','eflow_r3','eflow_r9','eflow_evidence')");
 const tableAccess=()=>value("select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','eflow_r7','eflow_r3','eflow_r9','eflow_evidence') and c.relkind in ('r','v') and not(n.nspname='eflow_r7' and c.relname='completion_locks')");
 const beforeCatalog=await catalog(),beforeInstall=await state(),beforePolicies=await policies(),beforeAccess=await tableAccess();await applyCorrection();
 equal(await state(),beforeInstall,'consistency migration performs no historical workflow/evidence writes');
 equal(await policies(),beforePolicies,'all existing RLS policies unchanged');equal(await tableAccess(),beforeAccess,'all existing table/view access unchanged');
 equal(await value("select bool_and(tgenabled='A') and count(*)=10 from pg_trigger where tgname in ('nw42_completion_lock','nw42_completion_commit')"),true,'all consistency locks/checks survive trusted replica mode');
 equal(await value("select relrowsecurity from pg_class where oid='eflow_r7.completion_locks'::regclass"),true,'private guard state has RLS');
 const afterCatalog=await catalog();equal(afterCatalog.length,beforeCatalog.length+4,'only four private consistency helpers added');
 const entries=new Map([
  ['decide_task_review(uuid,boolean,text,text)','p_task_id'],['submit_task_for_review(uuid,jsonb)','p_task_id'],
  ['decide_subtask_review(uuid,boolean,text)','(select task_id from public.subtasks where id=p_subtask_id)'],
  ['submit_subtask_for_review(uuid,jsonb)','(select task_id from public.subtasks where id=p_subtask_id)'],
  ['save_subtask_progress(uuid,integer,text,text,text,text,text,text)','(select task_id from public.subtasks where id=p_subtask_id)'],
  ['eflow_r7.command(uuid,integer,uuid,text,jsonb)','p_root']]);
 for(const f of beforeCatalog){const call=entries.get(f.name),body=call==='p_root'?f.body.replace('perform 1 from public.tasks where id=p_root for update;','/* NW4.2 completion serialization */ perform eflow_r7.lock_completion(p_root); perform 1 from public.tasks where id=p_root for update;'):f.body.replace(/\bbegin\b/i,'begin /* NW4.2 completion serialization */ perform eflow_r7.lock_completion('+call+');');equal(afterCatalog.find(a=>a.name===f.name),call?{...f,body}:f,'authority/ACL/body unchanged except lock preamble: '+f.name);}
 for(const f of afterCatalog.filter(f=>/eflow_r7\.(lock_completion|check_completion_commit|require_completed_descendants)/.test(f.name))) {
  equal(f.definer,true,'private triggers inspect required descendants through RLS');
  equal(f.config,['search_path=""'],'empty private search path');
  equal(await value("select has_function_privilege('authenticated',$1,'execute') or has_function_privilege('anon',$1,'execute') or has_function_privilege('service_role',$1,'execute')",[f.name]),false,'private helpers cannot be called as API');
 }
 await applyCorrection();equal(await catalog(),afterCatalog,'rerun preserves function bodies/signatures/ACLs');equal(await state(),beforeInstall,'rerun preserves every historical row');

 // Direct required child at depth 1 blocks the official root; nested parents
 // also block at depth 2 and the maximum supported depth 8.
 for(const maxDepth of [2,8]) {
  await newOfficeRoot('NW4.2 depth '+maxDepth);
  const nodes=Array.from({length:maxDepth},(_,i)=>id(9000+maxDepth*10+i));
  for(let i=0;i<nodes.length;i++)await command('create',{id:nodes[i],parent:i?nodes[i-1]:null,title:'Required depth '+(i+1),lead:id(4),people:[id(4),id(6)],standalone:true,due:i?'2026-12-20':'2026-12-25'});
  equal((await tree()).nodes.map(n=>n.depth),Array.from({length:maxDepth},(_,i)=>i+1),'all canonical descendants included');
  await denyCommand(3,'create',{id:id(9900+maxDepth),parent:nodes.at(-2),title:'Beyond deep ancestor',lead:id(4),due:'2026-12-26'},/ancestor deadline/i);
  const parent=nodes[0],leaf=nodes.at(-1),record=await upload(6,parent);
  await deny(6,'select submit_subtask_for_review($1,$2::jsonb)',[parent,record.payload],/every descendant/i);
  await deny(3,'select submit_task_for_review($1,$2::jsonb)',[root,JSON.stringify({note:'Root summary',attachments:[]})],/all subtasks approved|every subtask|descendant/i);
  // Complete every descendant through actual evidence and independent review.
  for(const n of nodes.slice(1).reverse()){await submit(n);await approve(n);}
  await actor(3);const completeLeaves=await tree();
  equal([completeLeaves.leaf_completed,completeLeaves.leaf_total],[1,1],'deep chain counts its sole approved leaf once');
  equal(completeLeaves.nodes.find(n=>n.id===parent).status,'todo','approved descendants do not submit their parent');
  await db.exec('reset role');equal(await value('select percent_complete from tasks where id=$1',[root]),37,'descendant work preserves manual root progress');
  await deny(6,'select submit_subtask_for_review($1,$2::jsonb)',[parent,JSON.stringify({note:' ',attachments:[]})],/note/i);
  await deny(6,'select submit_subtask_for_review($1,$2::jsonb)',[parent,JSON.stringify({note:'Own completion',attachments:[]})],/evidence|file/i);
  await deny(4,'select decide_subtask_review($1,true,null)',[parent],/pending|review/i);
  await actor(6);await value('select submit_subtask_for_review($1,$2::jsonb)',[parent,record.payload]);
  // Genuine pending attempt, then a synthetic historical inconsistency control
  // proves the approval guard independently of the submission guard.
  await setup("update subtasks set status='todo',is_completed=false where id=$1",[leaf]);
  await deny(4,'select decide_subtask_review($1,true,null)',[parent],/every descendant/i);
  await setup("update subtasks set status='completed',is_completed=true where id=$1",[leaf]);
  await deny(6,'select decide_subtask_review($1,true,null)',[parent],/reviewer|review|self/i);
  await db.exec('reset role');const historical=await value('select to_jsonb(s) from subtask_submissions s where id=$1',[record.key]);
  const seal=await value('select to_jsonb(s) from eflow_evidence.objects s where object_name=$1',[record.path]);
  await actor(3);await command('staff',{id:parent,lead:id(13),people:[id(13),id(6)]});
  await db.exec('reset role');equal(await value('select to_jsonb(s) from subtask_submissions s where id=$1',[record.key]),historical,'pending transfer preserves historical attribution');
  equal(await value('select to_jsonb(s) from eflow_evidence.objects s where object_name=$1',[record.path]),seal,'pending transfer preserves evidence seal');
  for(const who of [4,6,13]) {
   await actor(who);const snapshot=await tree(),n=snapshot.nodes.find(n=>n.id===parent);
   equal(n.current_reviewer,id(13),'parent current reviewer comes from resolver');
   equal(n.can_review,who===13,'tree flag agrees with new queue');
   equal((await value('select r7_pending_subtask_reviews()')).some(s=>s.id===record.key),who===13,'pending queue uses current authority');
  }
  await deny(4,'select decide_subtask_review($1,true,null)',[parent],/reviewer|review/i);
  await cash(parent,9600+maxDepth);
  for(const status of ['approved','released','pending_department_settlement']) {
   await setup('update petty_cash_requests set status=$1 where id=$2',[status,id(9600+maxDepth)]);
   await deny(13,'select decide_subtask_review($1,true,null)',[parent],/Settle all released or reserved cash/i);
  }
  await setup("update petty_cash_requests set status='settled' where id=$1",[id(9600+maxDepth)]);await approve(parent,13);
  await db.exec('reset role');equal(await value('select jsonb_build_object(\'worker\',submitter_id,\'initialReviewer\',reviewer_id,\'decisionAuthor\',decided_by) from subtask_submissions where id=$1',[record.key]),{worker:id(6),initialReviewer:id(4),decisionAuthor:id(13)},'approved authorship remains historical');
  equal(await value('select percent_complete from tasks where id=$1',[root]),37,'all nodes approved still preserves manual root progress');
  equal(await value('select status from tasks where id=$1',[root]),'in_progress','root still requires explicit own submission');
  await deny(3,'select submit_task_for_review($1,$2::jsonb)',[root,JSON.stringify({note:' ',attachments:[]})],/note/i);
  await setup('update tasks set dependency_ids=$1::uuid[] where id=$2',[[dependency],root]);
  await deny(3,'select submit_task_for_review($1,$2::jsonb)',[root,JSON.stringify({note:'Root summary',attachments:[]})],/dependencies/i);
  await setup("update tasks set dependency_ids='{}' where id=$1",[root]);
  const rootRecord=await upload(3);await value('select submit_task_for_review($1,$2::jsonb)',[root,rootRecord.payload]);
  await db.exec('reset role');equal(await value("select jsonb_build_object('status',status,'reviewer',reviewer_id,'progress',percent_complete) from tasks where id=$1",[root]),{status:'for_review',reviewer:id(2),progress:100},'explicit root submission retains normal Head and progress contract');
  await setup("update subtasks set status='todo',is_completed=false where id=$1",[leaf]);
  await deny(2,'select decide_task_review($1,true,null,null)',[root],/subtask|descendant/i);
  await setup("update subtasks set status='completed',is_completed=true where id=$1",[leaf]);
  for(const status of ['changes_requested','for_review','in_progress']) {
   await setup('update subtasks set status=$1 where id=$2',[status,leaf]);
   await deny(2,'select decide_task_review($1,true,null,null)',[root],new RegExp('resolve descendant.*'+leaf));
  }
  await setup("update subtasks set status='completed',is_completed=false where id=$1",[leaf]);
  await deny(2,'select decide_task_review($1,true,null,null)',[root],/resolve descendant/i);
  await setup('update subtasks set is_completed=true where id=$1',[leaf]);
  for(const status of ['pending','changes_requested']) {
   await setup('update subtask_submissions set status=$1 where id=(select latest_submission_id from subtasks where id=$2)',[status,leaf]);
   await deny(2,'select decide_task_review($1,true,null,null)',[root],/resolve descendant/i);
  }
  await setup("update subtask_submissions set status='approved' where id=(select latest_submission_id from subtasks where id=$1)",[leaf]);
  // Check the real deferred commit boundary, after an earlier approval write.
  // The subsequent trusted status repair keeps all new consistency triggers ON.
  const beforeCommit=await state();await actor(2);await db.exec('begin');
  await value('select decide_task_review($1,true,null,null)',[root]);
  await db.exec('reset role');await db.exec("select set_config('request.jwt.claim.sub','',false);set session_replication_role=replica");
  await db.query("update subtasks set status='changes_requested',is_completed=false where id=$1",[leaf]);
  await assert.rejects(db.exec('commit'),/resolve descendant/i);checks++;
  await db.exec('rollback');equal(await state(),beforeCommit,'commit-time rejection rolls back approval author, seals, status and history');
  await deny(3,'select decide_task_review($1,true,null,null)',[root],/review|Head|head/i);
  await cash(null,9700+maxDepth);
  await deny(2,'select decide_task_review($1,true,null,null)',[root],/Settle all task and subtask cash/i);
  await setup("update petty_cash_requests set status='settled' where id=$1",[id(9700+maxDepth)]);
  await actor(2);await value('select decide_task_review($1,true,null,null)',[root]);
  await db.exec('reset role');equal(await value('select status from tasks where id=$1',[root]),'completed','Head approval completes root after all required readiness');
 }

 // Ordered dependencies concern only earlier required siblings in one parent.
 await newOfficeRoot('NW4.2 sibling and ancestry controls');
 await command('create',{id:id(9100),title:'Branch A',lead:id(4),people:[id(4),id(6)],standalone:true,due:'2026-12-20'});
 await command('create',{id:id(9101),title:'Branch B',lead:id(4),people:[id(4),id(6)],standalone:true,due:'2026-12-25'});
 for(const [n,parent,standalone] of [[9110,9100,false],[9111,9100,true],[9112,9100,false],[9113,9101,false]])await command('create',{id:id(n),parent:id(parent),title:'Sibling '+n,lead:id(4),people:[id(4),id(6)],standalone,due:'2026-12-18'});
 await denyCommand(3,'create',{id:id(9114),parent:id(9100),title:'Beyond ancestor',lead:id(4),due:'2026-12-21'},/ancestor deadline/i);
 await denyCommand(3,'edit',{id:id(9100),title:'Branch A',due:'2026-12-17'},/descendant dates/i);
 await deny(6,'select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(9112)],/Complete Step/i);
 await actor(6);await value('select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(9111)]);
 await value('select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(9113)]);
 await submit(id(9110));await approve(id(9110));
 await actor(6);await value('select save_subtask_progress($1,20,null,null,null,null,null,null)',[id(9112)]);
 equal((await tree()).nodes.find(n=>n.id===id(9112)).percent_complete,20,'earlier standalone sibling does not block ordered work');
 await db.exec('reset role');equal(await value('select percent_complete from tasks where id=$1',[root]),37,'sibling progress never rolls up to manual task progress');

 // Existing independent Personal command checks must still cover depth 8.
 await actor(21);await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject,'create_task',JSON.stringify({title:'NW4.2 personal completion',lead_id:id(22)}),id(request++)]);
 await db.exec('reset role');root=await value("select id from personal_tasks where project_id=$1 and title='NW4.2 personal completion'",[personalProject]);await actor(21);
 const personalNodes=Array.from({length:8},(_,i)=>id(9800+i));
 for(let i=0;i<8;i++)await command('create',{id:personalNodes[i],parent:i?personalNodes[i-1]:null,title:'Personal depth '+(i+1),lead:id(22),standalone:true});
 await denyCommand(22,'submit',{id:personalNodes[0],note:'Independent personal completion'},/every descendant/i);
 for(const n of personalNodes.slice(1).reverse()){await actor(22);await command('submit',{id:n,note:'Own personal note'});await actor(21);await command('review',{id:n,approve:true});}
 await actor(22);await command('submit',{id:personalNodes[0],note:'Own personal parent note'});
 await denyCommand(22,'review',{id:personalNodes[0],approve:true},/independent reviewer/i);
 await setup("update personal_subtasks set status='todo' where id=$1",[personalNodes.at(-1)]);
 await denyCommand(21,'review',{id:personalNodes[0],approve:true},/every descendant/i);
 await setup("update personal_subtasks set status='completed' where id=$1",[personalNodes.at(-1)]);
 await actor(21);await command('review',{id:personalNodes[0],approve:true});
 equal([(await tree()).leaf_completed,(await tree()).leaf_total],[1,1],'Personal independent review and leaf summary preserved');
 console.log(`NW4.2 completion matrix: ${checks} assertions passed.`);
 return checks;
}
