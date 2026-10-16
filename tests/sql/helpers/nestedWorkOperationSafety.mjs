// NW5.1: actual installed command/direct guards and authoritative private facts.
// Trusted historical controls are explicit; finance controls use real APIs.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyR9StaffingRemoval} from './nestedWorkR9StaffingRemoval.mjs';

export async function verifyNestedWorkOperationSafety({db,project,personalProject,applyCorrection,applyRemoval}) {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 let checks=0,key=18000,root,inTransaction=false;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const ok=(a,label)=>{assert.ok(a,label);checks++;};
 const actor=async n=>{await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 const setup=async(sql,args=[])=>{await db.exec('reset role;set session_replication_role=replica');if(inTransaction)await db.exec('savepoint nw51_setup');try{await db.query(sql,args);}catch(error){if(inTransaction)await db.exec('rollback to savepoint nw51_setup');throw error;}finally{await db.exec('set session_replication_role=origin');}};
 const tree=()=>value('select r7_work_tree($1)',[root]);
 const command=async(cmd,payload)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(key++),cmd,JSON.stringify(payload)]);
 const impact=async(cmd,payload)=>{await db.exec('reset role');return value('select eflow_r7.operation_impact($1,$2,$3::jsonb)',[root,cmd,JSON.stringify(payload)]);};
 const facts=async(ids)=>{await db.exec('reset role');return value('select eflow_r7.history_facts($1,$2::uuid[])',[root,ids]);};
 const state=async()=>{await db.exec('reset role');return value(`select jsonb_build_object(
  'tasks',(select jsonb_agg(to_jsonb(t) order by id) from tasks t),'nodes',(select jsonb_agg(to_jsonb(t) order by id) from subtasks t),
  'personal',(select jsonb_agg(to_jsonb(t) order by id) from personal_subtasks t),'revisions',(select jsonb_agg(to_jsonb(t) order by root_id) from eflow_r7.tree_state t),
  'events',(select jsonb_agg(to_jsonb(t) order by id) from work_tree_events t),'receipts',(select jsonb_agg(to_jsonb(t) order by actor_id,request_id) from eflow_r7.receipts t),
  'progress',(select jsonb_agg(to_jsonb(t) order by id) from subtask_progress_updates t),'submissions',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submissions t),
  'attachments',(select jsonb_agg(to_jsonb(t) order by id) from subtask_submission_attachments t),'seals',(select jsonb_agg(to_jsonb(t) order by bucket_id,object_name) from eflow_evidence.objects t),
  'attempts',(select jsonb_agg(to_jsonb(t) order by kind,submission_id) from eflow_evidence.attempts t),
  'allocations',(select jsonb_agg(to_jsonb(t) order by id) from work_budget_allocations t),'lines',(select jsonb_agg(to_jsonb(t) order by id) from work_budget_allocation_lines t),
  'cash',(select jsonb_agg(to_jsonb(t) order by id) from petty_cash_requests t),'ledger',(select jsonb_agg(to_jsonb(t) order by id) from budget_ledger_entries t),
  'notifications',(select count(*) from notifications),'audit',(select count(*) from audit_events))`);};
 const deny=async(who,sql,args,pattern)=>{const before=await state();await actor(who);if(inTransaction)await db.exec('savepoint nw51_denial');await assert.rejects(db.query(sql,args),pattern);checks++;if(inTransaction)await db.exec('rollback to savepoint nw51_denial');equal(await state(),before,'failed operation preserves rows/history/revision/receipts/finance');await actor(who);};
 const denyCommand=async(cmd,payload,pattern=/history|untouched|responsibilit/i,who=3)=>{await actor(who);await deny(who,'select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(key++),cmd,JSON.stringify(payload)],pattern);};
 const newRoot=async(title)=>{await actor(2);const group=await value('select id from project_groups where project_id=$1 order by position limit 1',[project]);root=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,title]);await setup("update tasks set assigned_to=$1,team_member_ids=$2::uuid[],percent_complete=37,due_date='2026-12-31',status='in_progress' where id=$3",[id(3),[3,4,5,6,13].map(id),root]);await actor(3);};
 const create=async(parent=null,title='Untouched',lead=4)=>{const node=id(key++);await actor(3);await command('create',{id:node,parent,title,lead:id(lead),people:[id(lead),id(6)],standalone:true,due:'2026-12-20'});return node;};
 const catalog=()=>value("select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'body',p.prosrc,'acl',p.proacl,'args',pg_get_function_arguments(p.oid),'return',pg_get_function_result(p.oid),'config',p.proconfig,'definer',p.prosecdef,'volatility',p.provolatile) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence')");
 const access=()=>value("select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'tables',(select jsonb_agg(jsonb_build_object('id',c.oid,'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence') and c.relkind in ('r','v')))");
 await db.exec('reset role');const before=await state(),beforeCatalog=await catalog(),beforeAccess=await access();await applyCorrection();
 equal(await state(),before,'migration performs no history/data writes');equal(await access(),beforeAccess,'every RLS policy/table/view privilege remains unchanged');
 const afterCatalog=await catalog();equal(afterCatalog.length,beforeCatalog.length+5,'exact five private helpers');
 const safetySource=await readFile(new URL('../../../supabase/migrations/20261010164510_nested_work_operation_safety.sql',import.meta.url),'utf8');
 const capabilityPatch=safetySource.match(/addition:=\$patch\$([\s\S]*?)\$patch\$/)?.[1];ok(capabilityPatch,'reviewed capability patch located');
 for(const f of beforeCatalog){const after=afterCatalog.find(a=>a.name===f.name);let body=f.body;
  if(f.name==='eflow_r7.command(uuid,integer,uuid,text,jsonb)')body=body.replace('v_before:=eflow_r7.snapshot(p_root);',"/* NW5.1 operation safety */ if p_command not in ('progress','submit','review') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if; v_before:=eflow_r7.snapshot(p_root);");
  if(f.name==='eflow_r7.operation_capabilities(uuid,uuid)')body=body.replace("result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));",capabilityPatch+"result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));");
  equal(after,{...f,body},'exact existing metadata/body preservation '+f.name);
 }
 for(const name of ['subtree_ids(uuid,uuid)','history_facts(uuid,uuid[])','operation_impact(uuid,text,jsonb)','require_operation(uuid,text,jsonb)','guard_operation_write()']) {
  const f=afterCatalog.find(f=>f.name==='eflow_r7.'+name);equal(f.config,['search_path=""'],'private empty search path');equal(f.definer,true,'private authoritative history visibility');
  equal(await value("select has_function_privilege('authenticated',$1,'execute') or has_function_privilege('anon',$1,'execute') or has_function_privilege('service_role',$1,'execute')",[f.name]),false,'no API history disclosure');
 }
 await applyCorrection();equal(await catalog(),afterCatalog,'exact idempotent migration rerun');equal(await state(),before,'rerun preserves data');

 await newRoot('NW5.1 histories');const parent=await create(null,'History parent'),leaf=await create(parent,'History leaf'),other=await create(null,'Other branch');
 // Each execution/evidence source independently protects even historical todo/0.
 const cases=[
  ['state',()=>setup('update subtasks set completed_by=$1 where id=$2',[id(6),leaf])],
  ['progress',()=>setup('insert into subtask_progress_updates(id,subtask_id,task_id,author_id,author_name,percent_complete,note) values($1,$2,$3,$4,$5,0,$5)',[id(key++),leaf,root,id(6),'Historical zero progress'])],
  ['submissions',()=>setup("insert into subtask_submissions(id,subtask_id,task_id,version,submitter_id,submitter_name,reviewer_id,note,status) values($1,$2,$3,1,$4,'Worker',$5,'Historical attempt','pending')",[id(key++),leaf,root,id(6),id(4)])],
  ['reviews',()=>setup("insert into subtask_submissions(id,subtask_id,task_id,version,submitter_id,submitter_name,reviewer_id,note,status,decided_by,decided_at) values($1,$2,$3,1,$4,'Worker',$5,'Historical returned attempt','changes_requested',$5,now())",[id(key++),leaf,root,id(6),id(4)])],
  ['attachments',()=>setup("insert into subtask_submission_attachments(id,subtask_id,task_id,submission_id,file_name,file_path,file_size,mime_type,uploaded_by) values($1,$2,$3,$4,'legacy.pdf','historical-private-path',12,'application/pdf',$5)",[id(key++),leaf,root,id(key++),id(6)])],
  ['evidence',()=>setup("insert into eflow_evidence.objects(bucket_id,object_name,task_id,subtask_id,actor_id,state,legacy) values('task-attachments',$1,$2,$3,$4,'finalized',true)",['historical-private-seal-'+key++,root,leaf,id(6)])],
  ['attempts',()=>setup("insert into eflow_evidence.attempts(kind,submission_id,task_id,subtask_id,actor_id) values('subtask',$1,$2,$3,$4)",[id(key++),root,leaf,id(6)])],
 ];
 for(const [source,seed] of cases){
  console.log('NW5.1 isolated history source: '+source);
  await db.exec('reset role;begin');inTransaction=true;try{
   await seed();const h=await facts([leaf]);ok(h.counts[source]>0,'source counted '+source);equal(h.untouched,false,'historical todo/0 is not untouched '+source);
   for(const [cmd,payload] of [['delete',{id:parent}],['move',{id:parent,parent:other}],['order',{parent:null,order:[other,parent]}],['edit',{id:parent,title:'Same',due:'2026-12-20',standalone:false}],['create',{id:id(key++),parent:leaf,title:'Child'}]]) {
    equal((await impact(cmd,payload)).allowed,false,'descendant-only source blocks '+cmd+' '+source);
    await db.exec('savepoint denied_write');try{await denyCommand(cmd,payload);}finally{await db.exec('reset role;rollback to savepoint denied_write');}
   }
   // Direct guard: trusted role exercises protection independently of RLS.
   await db.exec('savepoint direct_write');const s=await state();await assert.rejects(db.query('update subtasks set is_standalone=false where id=$1',[parent]),/history|responsibilit/i);checks++;
   await db.exec('rollback to savepoint direct_write');equal(await state(),s,'direct guard rollback preserves historical rows');
   equal((await impact('edit',{id:leaf,title:'Routine rename',due:'2026-12-20',standalone:true})).allowed,true,'history does not prohibit metadata rename '+source);
   await actor(3);const projected=(await tree()).nodes.find(n=>n.id===parent).capabilities;
   equal(projected.delete,{allowed:false,reason_code:'history_blocked'},'capability uses authoritative history '+source);
   await command('edit',{id:leaf,title:'Permitted metadata '+source,due:'2026-12-20',standalone:true});
   equal((await tree()).nodes.find(n=>n.id===leaf).title,'Permitted metadata '+source,'actual metadata amendment retains history '+source);
  }finally{await db.exec('rollback;reset role');inTransaction=false;}
 }
 // Unchanged planning events are not execution; genuine safe operations succeed.
 equal((await facts([parent,leaf,other])).untouched,true,'creation/staffing planning history is not execution');
 await actor(3);await command('edit',{id:leaf,title:'Safe rename',due:'2026-12-20',standalone:true});await command('order',{parent:null,order:[other,parent]});
 await command('move',{id:leaf,parent:other});equal((await tree()).nodes.find(n=>n.id===leaf).parent_subtask_id,other,'safe move retains canonical ID');
 const branch=await create(null,'Safe delete'),child=await create(branch,'Child to delete');await command('delete',{id:branch});equal((await tree()).nodes.some(n=>[branch,child].includes(n.id)),false,'children-first safe deletion');
 equal((await tree()).root.people.includes(id(6)),true,'workers remain selected');equal(await value('select percent_complete from tasks where id=$1',[root]),37,'manual root progress preserved');
 // Transfer retains old workers, active-work staffing remains available.
 await setup("update subtasks set status='in_progress',percent_complete=25 where id=$1",[other]);
 await denyCommand('staff',{id:other,lead:id(5),people:[id(5),id(6)]},/transfer_worker_removal/);
 await actor(3);await command('staff',{id:other,lead:id(5),people:[id(4),id(5),id(6)]});equal((await tree()).nodes.find(n=>n.id===leaf).lead_id,null,'transfer clears current descendant appointment');
 await command('staff',{id:other,lead:id(5),people:[id(4),id(5),id(6),id(13)]});equal((await tree()).nodes.find(n=>n.id===other).percent_complete,25,'active staffing preserves progress');
 await denyCommand('contributors',{people:[id(3)]},/unfinished_worker_removal/);
 await denyCommand('root_lead',{lead:id(5),people:[id(5)]},/transfer_worker_removal/,2);
 await actor(2);await command('root_lead',{lead:id(5),people:[id(3),id(4),id(5),id(6),id(13)]});equal((await tree()).root.lead,id(5),'eligible root transfer preserves old contributors');

 // Native financial relationships built by actual funding/cap/cash APIs; no
 // fabricated foreign keys, balances, authorities or finance-rule relaxations.
 // The historical column/function fixture omits indexes and generated metadata.
 // Restore the exact original ledger arbiter and cash identity locally, as the
 // existing financial runner does; never patch the public finance functions.
 await db.exec('reset role');
 const fundingSource=await readFile(new URL('../../../supabase/migrations/20260826000003_dynamic_task_funding.sql',import.meta.url),'utf8');
 const ledgerIndex=fundingSource.match(/create unique index if not exists budget_ledger_command_idempotency_uni[\s\S]*?;/)?.[0];ok(ledgerIndex,'original ledger arbiter located');await db.exec(ledgerIndex);
 // Historical fixtures omit identity metadata; the current installed baseline
 // already has it. Never replace or relax an existing generated identity.
 if(!await value("select attidentity<>'' from pg_attribute where attrelid='petty_cash_requests'::regclass and attname='request_number'"))
  await db.exec('alter table petty_cash_requests alter column request_number add generated always as identity;');
 await newRoot('NW5.1 genuine funded history');const funded=await create(null,'Cap branch'),fundedChild=await create(funded,'Cash work'),clean=await create(null,'Unfunded control');
 await actor(2);
 const settings={dailyReleaseLimit:30000,perReceiptLimit:5000,liquidationDueDays:15,allowReceiptOverride:false,threshold:75,notes:'Local NW5 history'};
 const section=id(key++);const budget=await value('select save_office_budget_sections($1,2026,$2::jsonb,0,null,$3::jsonb)',[id(90),JSON.stringify([{id:section,name:'NW5 supplies',amount:50000,parentId:null,heldAmount:0,position:0}]),JSON.stringify(settings)]);
 await value('select lock_department_fiscal_budget($1)',[budget]);
 await value('select fund_office_work($1,2026,$2::jsonb,$3,$4)',[root,JSON.stringify([{partitionId:section,amount:10000}]),'Local approved funding history',id(key++)]);
 const line=await value('select id from work_budget_allocation_lines where allocation_id in(select id from work_budget_allocations where task_id=$1 and subtask_id is null)',[root]);
 equal((await facts([clean])).untouched,true,'root-only finance is not attributed to every branch');
 await actor(3);const cap=await value('select set_subtask_budget_cap($1,$2,$3,1000,$4,$5)',[root,fundedChild,line,'Local protected subitem cap',id(key++)]);
 await actor(6);const cash=await value('select create_contextual_cash_request_v2($1,$2,$3::jsonb,$4,null,$5)',[root,fundedChild,JSON.stringify([{allocationLineId:line,amount:100}]),'Local subitem purchase',id(key++)]);
 const h=await facts([fundedChild]);for(const source of ['allocations','allocation_lines','cash','ledger'])ok(h.counts[source]>0,'genuine linked financial history '+source);
 for(const cmd of ['delete','move','order'])await denyCommand(cmd,cmd==='order'?{parent:null,order:[clean,funded]}:{id:funded,...(cmd==='move'?{parent:clean}:{})});
 // Older nullable ledger/cash links still resolve through allocation/request.
 await db.exec('begin');try{
  await setup('update budget_ledger_entries set subtask_id=null,task_id=null where allocation_id=$1 or petty_cash_request_id=$2',[cap,cash]);
  ok((await facts([fundedChild])).counts.ledger>0,'ledger nullable links fall back through protected allocation and cash');
  await setup('update petty_cash_requests set subtask_id=null where id=$1',[cash]);ok((await facts([fundedChild])).counts.cash>0,'cash nullable links fall back through cap allocation');
  await setup("update work_budget_allocations set status='cancelled' where id=$1",[cap]);ok((await facts([fundedChild])).counts.allocations>0,'cancelled cap remains protected history');
 }finally{await db.exec('rollback;reset role');}
 const hidden=await impact('delete',{id:funded});ok(!JSON.stringify(hidden).includes('historical-private-')&&!JSON.stringify(hidden).includes('file_path'),'facts disclose no private paths');
 // Unavailable canonical history is an error, never an empty allowed scope.
 await db.exec('begin');try{await db.exec('alter table eflow_evidence.objects rename to nw51_unavailable_objects');await assert.rejects(db.query('select eflow_r7.operation_impact($1,$2,$3::jsonb)',[root,'delete',JSON.stringify({id:clean})]),/does not exist/);checks++;}finally{await db.exec('rollback');}

 // Canonical bounds/authority still execute on the final migration.
 await newRoot('NW5.1 hierarchy negatives');const chain=[];for(let d=0;d<8;d++)chain.push(await create(chain.at(-1)||null,'Depth '+(d+1)));
 await denyCommand('create',{id:id(key++),parent:chain.at(-1),title:'Depth 9',lead:id(4)},/depth/i);
 await denyCommand('move',{id:chain[0],parent:chain.at(-1)},/cycle/i);
 await denyCommand('create',{id:id(key++),parent:chain[1],title:'Deadline overflow',due:'2026-12-30',lead:id(4)},/ancestor deadline/i);
 await denyCommand('move',{id:chain.at(-1),parent:funded},/root|branch|Destination/i);
 await denyCommand('delete',{id:chain[0]},/denied|staffing|branch/i,6);
 await denyCommand('delete',{id:chain[0]},/denied|staffing|branch/i,7);
 for(const table of ['subtasks','personal_subtasks','tasks','personal_tasks'])equal(await value("select count(*) from pg_trigger where tgrelid=$1::regclass and tgname='nw51_operation_safety' and tgenabled='O'",[table]),1,'additive direct-write guard '+table);
 await db.exec('begin');try{await setup('update subtasks set parent_subtask_id=$1 where id=$2',[chain.at(-1),chain[0]]);await assert.rejects(db.query('select eflow_r7.subtree_ids($1,$2)',[root,chain[0]]),/cycle/);checks++;}finally{await db.exec('rollback;reset role');}

 // Personal history is event-based, including prior snapshots after reset to
 // todo/0. Planning-only events retain their compatibility audit history.
 await actor(21);await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject,'create_task',JSON.stringify({title:'NW5 personal history',lead_id:id(22)}),id(key++)]);
 root=await value("select id from personal_tasks where project_id=$1 and title='NW5 personal history'",[personalProject]);
 const personalNode=id(key++);await command('create',{id:personalNode,title:'Personal history',lead:id(22),people:[id(22)],standalone:true});
 equal((await facts([personalNode])).untouched,true,'personal planning events alone do not block');
 await actor(22);await command('progress',{id:personalNode,progress:0,note:'Recorded execution even at zero'});
 await setup("update personal_subtasks set status='todo',percent_complete=0 where id=$1",[personalNode]);
 ok((await facts([personalNode])).counts.execution_events>0,'personal zero-progress event retained after reset');
 await denyCommand('delete',{id:personalNode},/history|responsibilit/i,21);
 await db.exec('begin');try{
  await setup("update work_tree_events set command='edit',node_id=null where root_id=$1 and command='progress'",[root]);
  ok((await facts([personalNode])).counts.execution_events>0,'relevant execution snapshot protects personal work even after command attribution changed');
 }finally{await db.exec('rollback;reset role');}
 checks+=await verifyR9StaffingRemoval({db,applyCorrection:applyRemoval,personalProject});
 // Positive removal control has its own project, with no terminal root. Do not
 // disable the existing terminal guard to manufacture a passing cleanup.
 await actor(2);const openProject=await value('select (create_project_with_details($1::jsonb)).id',[JSON.stringify({title:'NW5 open R9 control',org_id:id(90),status:'planning'})]);
 const openOffice=await value('select id from project_offices where project_id=$1 and office_id=$2',[openProject,id(90)]);
 await value('select phase6_set_members($1,$2::uuid[])',[openOffice,[2,3,6,13].map(id)]);
 const openGroup=await value('select id from project_groups where project_id=$1 order by position limit 1',[openProject]);
 root=await value('select (phase3_create_task($1,$2,$3)).id',[openProject,openGroup,'Open cleanup control']);
 await setup("update tasks set status='in_progress',assigned_to=$1,team_member_ids=$2::uuid[],due_date='2026-12-31',percent_complete=37 where id=$3",[id(3),[3,6,13].map(id),root]);
 await actor(3);const openNode=id(key++);await command('create',{id:openNode,title:'Current appointment',lead:id(13),people:[id(6),id(13)],standalone:true});
 await db.exec('reset role');const planningEvents=await value('select jsonb_agg(to_jsonb(e) order by id) from work_tree_events e where root_id=$1',[root]);
 await actor(2);const openPreview=await value('select r9_removal_preview($1,$2,$3)',[openProject,id(13),id(90)]),openRequest=id(key++);
 const openRemoval=await value('select r9_remove_person($1,$2,$3,$4,$5)',[openProject,id(13),id(90),openPreview.fingerprint,openRequest]);
 equal(openRemoval.removed,id(13),'existing open-project R9 removal succeeds');equal(await value('select r9_remove_person($1,$2,$3,$4,$5)',[openProject,id(13),id(90),openPreview.fingerprint,openRequest]),openRemoval,'open removal exact retry unchanged');
 equal((await tree()).nodes.find(n=>n.id===openNode).lead_id,null,'open removal clears current appointment');
 await db.exec('reset role');equal(await value('select jsonb_agg(to_jsonb(e) order by id) from work_tree_events e where root_id=$1',[root]),planningEvents,'open removal retains old work event authorship');
 console.log(`NW5.1 independent operation/history cases: ${checks} assertions passed; remaining R9 locked-root contract assertion follows.`);
 // The current R9 private UPDATE-only lifecycle path remains functional on
 // historical/active work. Its existing reviewed API is the only removal path.
 await actor(2);const removal=await value('select r9_removal_preview($1,$2,$3)',[project,id(13),id(90)]);
 await db.exec('reset role');const historical=await value("select jsonb_build_object('submissions',(select jsonb_agg(to_jsonb(s) order by id) from subtask_submissions s),'seals',(select jsonb_agg(to_jsonb(s) order by bucket_id,object_name) from eflow_evidence.objects s),'finance',(select jsonb_agg(to_jsonb(s) order by id) from budget_ledger_entries s))");
 await actor(2);const removalRequest=id(key++),removed=await value('select r9_remove_person($1,$2,$3,$4,$5)',[project,id(13),id(90),removal.fingerprint,removalRequest]);
 equal(removed.removed,id(13),'actual atomic R9 removal succeeds with final operation guards');
 equal(await value('select r9_remove_person($1,$2,$3,$4,$5)',[project,id(13),id(90),removal.fingerprint,removalRequest]),removed,'R9 exact retry retains its receipt semantics');
 await db.exec('reset role');equal(await value("select jsonb_build_object('submissions',(select jsonb_agg(to_jsonb(s) order by id) from subtask_submissions s),'seals',(select jsonb_agg(to_jsonb(s) order by bucket_id,object_name) from eflow_evidence.objects s),'finance',(select jsonb_agg(to_jsonb(s) order by id) from budget_ledger_entries s))"),historical,'R9 removal preserves historical decisions/evidence/finance exactly');

 console.log(`NW5.1 history/operation safety: ${checks} assertions passed; local synthetic claims and real financial APIs; checked confirmations and shared history-writer concurrency remain NW5.2.`);
 return checks;
}
