// NW5.1 confirmed R9-only staffing exception. All actors/data are disposable.
import assert from 'node:assert/strict';

export async function verifyR9StaffingRemoval({db,applyCorrection,personalProject}) {
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 let checks=0,key=24000;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const actor=async n=>{await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');};
 const setup=async(sql,args=[])=>{await db.exec('reset role;set session_replication_role=replica');try{await db.query(sql,args);}finally{await db.exec('set session_replication_role=origin');}};
 const catalog=()=>value("select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'body',p.prosrc,'acl',p.proacl,'args',pg_get_function_arguments(p.oid),'return',pg_get_function_result(p.oid),'config',p.proconfig,'definer',p.prosecdef,'volatility',p.provolatile) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence')");
 const access=()=>value("select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'tables',(select jsonb_agg(jsonb_build_object('id',c.oid,'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_r3','eflow_evidence') and c.relkind in ('r','v') and c.oid<>coalesce(to_regclass('eflow_r9.staffing_removals'),0)))");
 const state=async()=>{await db.exec('reset role');return value(`select jsonb_build_object(
  'work',jsonb_build_array((select jsonb_agg(to_jsonb(t) order by id) from tasks t),(select jsonb_agg(to_jsonb(t) order by id) from subtasks t),(select jsonb_agg(to_jsonb(t) order by id) from personal_tasks t),(select jsonb_agg(to_jsonb(t) order by id) from personal_subtasks t)),
  'membership',jsonb_build_array((select jsonb_agg(to_jsonb(t) order by project_office_id,user_id) from project_office_members t),(select jsonb_agg(to_jsonb(t) order by project_id,user_id) from personal_project_members t)),
  'receipts',(select jsonb_agg(to_jsonb(t) order by actor,request) from eflow_r9.receipts t),
  'events',(select jsonb_agg(to_jsonb(t) order by id) from eflow_r9.events t),
  'audit',(select jsonb_agg(to_jsonb(t) order by id) from audit_events t),
  'revisions',(select jsonb_agg(to_jsonb(t) order by root_id) from eflow_r7.tree_state t))`);};
 const facts=async()=>{await db.exec('reset role');return value(`select jsonb_build_object(
  'work',jsonb_build_array((select jsonb_agg(to_jsonb(t)-array['assigned_to','recommendation_lead_id','team_member_ids','team_member_names','assignee_name','updated_at'] order by id) from tasks t),
   (select jsonb_agg(to_jsonb(t)-array['assigned_to','assigned_to_ids','lead_id','updated_at'] order by id) from subtasks t),
   (select jsonb_agg(to_jsonb(t)-array['lead_id','revision','updated_at'] order by id) from personal_tasks t),
   (select jsonb_agg(to_jsonb(t)-array['assigned_to_ids','lead_id','updated_at'] order by id) from personal_subtasks t)),
  'submissions',jsonb_build_array((select jsonb_agg(to_jsonb(t) order by id) from task_submissions t),(select jsonb_agg(to_jsonb(t) order by id) from subtask_submissions t)),
  'progress',(select jsonb_agg(to_jsonb(t) order by id) from subtask_progress_updates t),
  'events',(select jsonb_agg(to_jsonb(t) order by id) from work_tree_events t),
  'finance',jsonb_build_array((select jsonb_agg(to_jsonb(t) order by id) from work_budget_allocations t),(select jsonb_agg(to_jsonb(t) order by id) from work_budget_allocation_lines t),(select jsonb_agg(to_jsonb(t) order by id) from petty_cash_requests t),(select jsonb_agg(to_jsonb(t) order by id) from budget_ledger_entries t)),
  'evidence',jsonb_build_array((select jsonb_agg(to_jsonb(t) order by id) from subtask_submission_attachments t),(select jsonb_agg(to_jsonb(t) order by bucket_id,object_name) from eflow_evidence.objects t),(select jsonb_agg(to_jsonb(t) order by kind,submission_id) from eflow_evidence.attempts t)))`);};
 await db.exec('reset role');const old=await catalog(),before=await state(),oldAccess=await access();
 await applyCorrection();equal(await state(),before,'installation changes no data');
 equal(await access(),oldAccess,'every prior RLS policy/table/view privilege unchanged');
 const installed=await catalog();equal(installed.length,old.length+4,'only four private removal helpers');
 for(const f of old){let body=f.body;
  if(f.name==='eflow_r9.remove_person(uuid,uuid,uuid,text,uuid)')body=body.replace('v:=eflow_r9.preview(p_project,p_user,p_office);','/* NW5.1 confirmed staffing */ perform eflow_r9.lock_removal_work(p_project,p_office); v:=eflow_r9.preview(p_project,p_user,p_office);').replace('perform eflow_r9.clear_staff(p_project,p_user,p_office);','perform eflow_r9.clear_removed_staff(p_project,p_user,p_office,p_request,p_fingerprint);');
  if(f.name==='guard_subtask_mutation()')body=body.replace(/begin/i,"begin /* NW5.1 exact R9 UPDATE */ if tg_op='UPDATE' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;");
  if(['route_organization_leadership_review()','validate_task_reviewers()'].includes(f.name))body=body.replace(/begin/i,"begin /* NW5.1 preserve historical reviewers */ if tg_op='UPDATE' then if pg_catalog.has_function_privilege(current_user,'eflow_r9.staffing_removal_allowed(text,jsonb,jsonb)','EXECUTE') then if eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;end if;end if;");
  if(f.name==='sync_task_chat_channel()')body=body.replace(/begin/i,"begin /* NW5.1 current chat access only */ if tg_op='UPDATE' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then delete from public.chat_channel_members c using public.chat_channels h,eflow_r9.staffing_removals m where c.channel_id=h.id and h.task_id=new.id and m.tx=pg_catalog.pg_current_xact_id() and m.relation_name=tg_table_name and m.row_id=new.id and c.user_id=m.removed_user;return new;end if;");
  equal(installed.find(a=>a.name===f.name),{...f,body},'exact prior function preservation '+f.name);
 }
 for(const name of ['staffing_removal_allowed(text,jsonb,jsonb)','guard_staffing_removal()','lock_removal_work(uuid,uuid)','clear_removed_staff(uuid,uuid,uuid,uuid,text)']){
  const f=installed.find(f=>f.name==='eflow_r9.'+name);equal(f.definer,true,'private authoritative helper');equal(f.config,['search_path=""'],'empty search path');
  for(const role of ['authenticated','anon','service_role'])equal(await value('select has_function_privilege($1,$2,\'execute\')',[role,f.name]),false,'helper inaccessible '+role);
 }
 for(const role of ['authenticated','anon','service_role'])equal(await value("select has_table_privilege($1,'eflow_r9.staffing_removals','select,insert,update,delete')",[role]),false,'private capability rows inaccessible '+role);
 equal(await value("select relrowsecurity from pg_class where oid='eflow_r9.staffing_removals'::regclass"),true,'private RLS');
 await applyCorrection();equal(await catalog(),installed,'exact idempotent helper/patch rerun');equal(await state(),before,'idempotent installation preserves rows');

 await actor(2);const project=await value('select (create_project_with_details($1::jsonb)).id',[JSON.stringify({title:'NW5 confirmed R9 boundary',org_id:id(90),status:'planning'})]);
 const office=await value('select id from project_offices where project_id=$1 and office_id=$2',[project,id(90)]);
 await value('select phase6_set_members($1,$2::uuid[])',[office,[2,3,4,6,13].map(id)]);
 const group=await value('select id from project_groups where project_id=$1 order by position limit 1',[project]);
 const roots=[];const nodes=[];
 for(const status of ['in_progress','for_review','completed']){
  await actor(2);const root=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'Removal '+status]);roots.push(root);
  await setup("update tasks set status=$1,assigned_to=$2,team_member_ids=$3::uuid[],team_member_names=array['Task Lead','Other Worker'],reviewer_id=$2,backup_reviewer_id=$2,percent_complete=$4,due_date='2026-12-31' where id=$5",[status,id(13),[13,6].map(id),status==='completed'?100:37,root]);
  const parent=id(key++),child=id(key++),unrelated=id(key++);nodes.push({root,parent,child,unrelated,status});
  await setup("insert into subtasks(id,task_id,parent_subtask_id,title,position,lead_id,assigned_to,assigned_to_ids,is_standalone,status,is_completed,percent_complete,completed_by,reviewer_id) values($1,$4,null,'Removed lead',0,$5,$5,$7::uuid[],true,$8,$9,$10,$5,$5),($2,$4,$1,'Delegated child',1,$6,$6,$11::uuid[],true,$8,$9,$10,$5,$5),($3,$4,null,'Sibling under root',2,$6,$6,$11::uuid[],true,$8,$9,$10,$5,$5)",[parent,child,unrelated,root,id(13),id(4),[13,6].map(id),status==='completed'?'completed':'todo',status==='completed',status==='completed'?100:0,[4,6].map(id)]);
 }
 await actor(2);const emptyRoot=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'Completed sole current worker']);roots.push(emptyRoot);
 await setup("update tasks set status='completed',percent_complete=100,assigned_to=$2,team_member_ids=array[$2]::uuid[],team_member_names=array['Departing worker'],reviewer_id=$3,backup_reviewer_id=$4 where id=$1",[emptyRoot,id(13),id(4),id(6)]);
 await actor(2);const unaffectedRoot=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'Unrelated current branch; removed historical reviewer']);
 await setup("update tasks set assigned_to=$2,team_member_ids=array[$2,$3]::uuid[],reviewer_id=$4,status='in_progress',percent_complete=37 where id=$1",[unaffectedRoot,id(3),id(6),id(13)]);
 const unaffectedNode=id(key++);await setup("insert into subtasks(id,task_id,title,position,lead_id,assigned_to_ids,status,is_completed,percent_complete,completed_by,reviewer_id) values($1,$2,'Unrelated completed author history',0,$3,array[$3,$4]::uuid[],'completed',true,100,$5,$5)",[unaffectedNode,unaffectedRoot,id(4),id(6),id(13)]);
 const unaffected=await value('select jsonb_build_array(to_jsonb(t),to_jsonb(n)) from tasks t join subtasks n on n.task_id=t.id where n.id=$1',[unaffectedNode]);
 const outsideRoot=await value('select id from tasks where linked_project_id<>$1 order by id limit 1',[project]);
 await db.exec('reset role');const outside=await value('select to_jsonb(t) from tasks t where id=$1',[outsideRoot]);
 const protectedFacts=await facts();
 const preview=async()=>{await actor(2);return value('select r9_removal_preview($1,$2,$3)',[project,id(13),id(90)]);};
 const remove=(fingerprint,request=id(key++))=>value('select r9_remove_person($1,$2,$3,$4,$5)',[project,id(13),id(90),fingerprint,request]);
 const reject=async(who,sql,args,pattern)=>{const s=await state();await actor(who);await assert.rejects(db.query(sql,args),pattern);checks++;equal(await state(),s,'denied action rolls back work/membership/events/receipt');};
 const terminal=nodes.at(-1);
 await db.exec('reset role');for(const r of roots){let ch=(await db.query('select id from chat_channels where task_id=$1',[r])).rows[0]?.id;
  // Replica historical seeds intentionally do not run the AFTER chat hook.
  if(!ch)ch=await value("insert into chat_channels(channel_type,task_id,name) values('task',$1,'Historical task channel') returning id",[r]);
  await db.query('insert into chat_channel_members(channel_id,user_id) values($1,$2),($1,$3),($1,$4) on conflict do nothing',[ch,id(13),id(6),id(4)]);
 }
 const chats=await value('select jsonb_agg(to_jsonb(c) order by id) from chat_channels c'),messages=await value('select jsonb_agg(to_jsonb(c) order by id) from chat_messages c');
 const otherChatMembers=await value('select jsonb_agg(to_jsonb(c) order by channel_id,user_id) from chat_channel_members c where user_id<>$1',[id(13)]);
 // Direct writes, caller GUCs and the older private marker confer no exception.
 for(const who of [2,13])await reject(who,'update subtasks set lead_id=null where id=$1',[terminal.parent],/locked|denied|read-only|planning|privilege|editable|lifecycle|versioned|responsibilities/i);
 await actor(2);await value("select set_config('eflow_r9.staffing_removal','true',false)");
 await reject(2,'update subtasks set assigned_to=null,assigned_to_ids=array[]::uuid[],lead_id=null where id=$1',[terminal.parent],/locked|denied|read-only|planning|editable|lifecycle|versioned|responsibilities/i);
 await reject(2,'select eflow_r9.clear_removed_staff($1,$2,$3,$4,$5)',[project,id(13),id(90),id(key++),'forged'],/permission denied/);
 await reject(2,'insert into eflow_r9.staffing_removals(tx,actor) values(pg_current_xact_id(),auth.uid())',[],/permission denied/);
 await db.exec('reset role;begin');try{
  await db.query('insert into eflow_r9.mutations values(txid_current(),$1)',[project]);
  await actor(2);await assert.rejects(db.query('update subtasks set lead_id=null where id=$1',[terminal.parent]),/locked/);checks++;
 }finally{await db.exec('rollback;reset role');}
 await reject(3,'select r9_remove_person($1,$2,$3,$4,$5)',[project,id(13),id(90),(await preview()).fingerprint,id(key++)],/authority|Head/);
 // A real changed assignment invalidates the previously confirmed impact.
 const stale=await preview();await setup('update subtasks set assigned_to_ids=array_append(assigned_to_ids,$1) where id=$2',[id(3),nodes[0].parent]);
 const changedFacts=await facts();await actor(2);await assert.rejects(remove(stale.fingerprint),/Refresh the impact/);checks++;equal(await facts(),changedFacts,'stale rejection preserves changed state');
 await setup('update subtasks set assigned_to_ids=array_remove(assigned_to_ids,$1) where id=$2',[id(3),nodes[0].parent]);
 // Inject illegal writes INSIDE the private cleanup, before its boundary guard.
 // Every attempt must roll back the whole real removal, including its receipt.
 for(const expression of ["new.status:='changes_requested';","new.is_completed:=not old.is_completed;","new.percent_complete:=17;","new.reviewer_id:=null;","new.completed_by:=null;","new.title:='Changed work content';","new.position:=999;","new.due_date:='2026-12-01';","new.task_id:='"+outsideRoot+"';","new.lead_id:='"+id(3)+"';"]){
  await db.exec(`reset role;create or replace function public.nw51_illegal_removal() returns trigger language plpgsql as $$begin ${expression} return new;end$$;create trigger a00_nw51_illegal before update on subtasks for each row execute function public.nw51_illegal_removal();`);
  const p=await preview(),s=await state();await actor(2);await assert.rejects(remove(p.fingerprint),/cannot change work facts/);checks++;equal(await state(),s,'illegal cleanup is fully atomic');
  await db.exec('drop trigger a00_nw51_illegal on subtasks;drop function nw51_illegal_removal()');
 }
 equal(await facts(),protectedFacts,'negative fixtures restore protected facts exactly');
 const p=await preview(),request=id(key++),beforeRemoval=await state();await actor(2);const removed=await remove(p.fingerprint,request);
 equal(removed.removed,id(13),'confirmed terminal/open removal succeeds');equal(await remove(p.fingerprint,request),removed,'exact committed retry');
 equal(await facts(),protectedFacts,'all work facts/reviewer identity/authorship/history/evidence/finance unchanged');
 const afterRemoval=await state();for(const kind of ['audit','events']){
  const ids=new Set((beforeRemoval[kind]||[]).map(e=>e.id));equal((afterRemoval[kind]||[]).filter(e=>ids.has(e.id)),beforeRemoval[kind]||[],'existing '+kind+' history/authorship preserved; new removal audit is additive');
 }
 await db.exec('reset role');equal(await value('select to_jsonb(t) from tasks t where id=$1',[outsideRoot]),outside,'unrelated project/branch untouched');
 equal(await value('select jsonb_build_array(to_jsonb(t),to_jsonb(n)) from tasks t join subtasks n on n.task_id=t.id where n.id=$1',[unaffectedNode]),unaffected,'same-project unrelated authority/reviewer-only impact untouched');
 equal(await value('select count(*) from eflow_r9.staffing_removals'),0,'no capability survives the operation');
 equal(await value('select jsonb_agg(to_jsonb(c) order by id) from chat_channels c'),chats,'channel identity/history unchanged');equal(await value('select jsonb_agg(to_jsonb(c) order by id) from chat_messages c'),messages,'chat authorship/history unchanged');
 equal(await value('select jsonb_agg(to_jsonb(c) order by channel_id,user_id) from chat_channel_members c where user_id<>$1',[id(13)]),otherChatMembers,'unrelated chat participants untouched');
 equal(await value('select count(*) from chat_channel_members c join chat_channels h on h.id=c.channel_id where h.task_id=any($1::uuid[]) and c.user_id=$2',[roots,id(13)]),0,'derived task chat access removed for departing member only');
 for(const n of nodes){
  equal(await value('select assigned_to is null and reviewer_id=$2 and backup_reviewer_id=$2 and not($2=any(team_member_ids)) from tasks where id=$1',[n.root,id(13)]),true,'root staffing cleared, reviewer metadata retained '+n.status);
  equal(await value('select bool_and(lead_id is null) from subtasks where task_id=$1',[n.root]),true,'dependent delegation invalidated '+n.status);
  equal(await value('select assigned_to is null and not($2=any(assigned_to_ids)) and reviewer_id=$2 and completed_by=$2 from subtasks where id=$1',[n.parent,id(13)]),true,'node current worker cleared; historical actors preserved');
 }
 await actor(2);equal((await value('select r7_work_tree($1)',[roots[0]])).root.lead,null,'unfinished root retains existing null-Lead reassignment contract');
 await db.exec('reset role');equal(await value('select eflow_r7.reviewer($1,$2)',[nodes[0].child,id(6)]),id(2),'current review eligibility falls back to responsible Head; history stays recorded');
 await reject(6,'select save_subtask_progress($1,20,null,null,null,null,null,null)',[nodes[0].child],/Lead|assigned|reassignment|branch|authority/i);
 await actor(2);await assert.rejects(remove('changed terms',request),/Request ID reused/);checks++;
 // Personal terminal work follows the same exact staffing/history boundary.
 await actor(21);await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject,'create_task',JSON.stringify({title:'Personal R9 terminal',lead_id:id(22)}),id(key++)]);
 const personalRoot=await value("select id from personal_tasks where project_id=$1 and title='Personal R9 terminal'",[personalProject]);
 const personalNode=id(key++);await value('select r7_work_command($1,1,$2,$3,$4::jsonb)',[personalRoot,id(key++),'create',JSON.stringify({id:personalNode,title:'Completed personal node',lead:id(22),people:[id(22)],standalone:true})]);
 await setup("update personal_subtasks set status='completed',percent_complete=100 where id=$1",[personalNode]);
 await setup("update personal_tasks set status='done',lead_id=null,reviewer_id=$2 where id=$1",[personalRoot,id(22)]);
 const personalFacts=await facts();await actor(21);const pp=await value('select r9_removal_preview($1,$2,null)',[personalProject,id(22)]);
 const pr=await value('select r9_remove_person($1,$2,null,$3,$4)',[personalProject,id(22),pp.fingerprint,id(key++)]);equal(pr.removed,id(22),'personal terminal current staff cleanup');
 equal(await facts(),personalFacts,'personal historical work/reviewer facts retained');
 await db.exec('reset role');equal(await value('select lead_id is null and cardinality(assigned_to_ids)=0 from personal_subtasks where id=$1',[personalNode]),true,'personal appointment removed');
 equal(await value('select reviewer_id=$2 and status=\'done\' from personal_tasks where id=$1',[personalRoot,id(22)]),true,'personal reviewer identity and completed status retained');
 console.log(`NW5.1 private R9 staffing boundary: ${checks} assertions passed; exact deltas, historical facts, rollback, authority and retries.`);
 return checks;
}
