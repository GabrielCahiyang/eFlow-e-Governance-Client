import assert from 'node:assert/strict';
export async function verifyNestedWorkMaterialDate({db,project,personalProject,applyCorrection}){
 let checks=0,key=41000,root;
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
 const equal=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
 const actor=async n=>{await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('set role authenticated');};
 const catalog=()=>value("select jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'body',p.prosrc,'acl',p.proacl,'args',pg_get_function_arguments(p.oid),'return',pg_get_function_result(p.oid),'config',p.proconfig,'definer',p.prosecdef) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','eflow_r7','eflow_r9','eflow_evidence','eflow_budget')");
 const access=()=>value("select jsonb_build_object('policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p),'tables',(select jsonb_agg(jsonb_build_object('id',c.oid,'acl',c.relacl,'rls',c.relrowsecurity) order by c.oid) from pg_class c where c.relkind in ('r','v')))");
 await db.exec('reset role');const before=await catalog(),permissions=await access();await applyCorrection();const after=await catalog();
 equal(await access(),permissions,'date addition preserves policies, table ACLs and RLS');
 equal(after.filter(a=>!before.some(b=>a.name===b.name)).map(a=>a.name),['eflow_r7.date_impact(uuid,jsonb)'],'only one private helper added');
 for(const old of before){const current=after.find(a=>a.name===old.name);if(old.name==='eflow_r7.work_impact(uuid,integer,text,jsonb)'){
  const body=old.body.replace('allowed boolean;','allowed boolean;date_impact jsonb:=\'{}\';').replace('impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);',"impact:=eflow_r7.operation_impact(p_root,p_command,p_payload); if p_command='edit' and p_payload ? 'due' then date_impact:=eflow_r7.date_impact(p_root,p_payload);end if;").replace("return jsonb_build_object('root_id',p_root,","return date_impact||jsonb_build_object('root_id',p_root,");
  equal(current,{...old,body},'exact additive preview patch; original locks/authority/fingerprint intact');
 }else equal(current,old,'unchanged existing function '+old.name);}
 await applyCorrection();equal(await catalog(),after,'date migration idempotent');
 for(const role of ['anon','authenticated','service_role'])equal(await value('select has_function_privilege($1,$2,\'execute\')',[role,'eflow_r7.date_impact(uuid,jsonb)']),false,'no API private date helper '+role);
 const helper=after.find(a=>a.name==='eflow_r7.date_impact(uuid,jsonb)');equal(helper.definer,false,'private helper invoker');equal(helper.config,['search_path=""'],'empty helper search path');
 const tree=()=>value('select r7_work_tree($1)',[root]);
 const command=async(cmd,payload)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(key++),cmd,JSON.stringify(payload)]);
 const preview=async(payload)=>value("select nw_work_impact($1,$2,'edit',$3::jsonb)",[root,(await tree()).revision,JSON.stringify(payload)]);
 const checked=(payload,impact)=>value("select nw_work_command($1,$2,$3,'edit',$4::jsonb,$5)",[root,impact.expected_revision,id(key++),JSON.stringify(payload),impact.fingerprint]);
 await actor(2);const group=await value('select id from project_groups where project_id=$1 order by position limit 1',[project]);root=await value('select (phase3_create_task($1,$2,$3)).id',[project,group,'NW5.5 date facts']);
 await db.exec('reset role;set session_replication_role=replica');await db.query("update tasks set assigned_to=$1,team_member_ids=$2::uuid[],percent_complete=37,due_date='2026-12-31',status='in_progress' where id=$3",[id(3),[3,4,6].map(id),root]);await db.exec('set session_replication_role=origin');await actor(3);
 const parent=id(key++),leaf=id(key++),own=id(key++);
 for(const [node,title,p,due] of [[parent,'Date branch',null,'2026-12-20'],[leaf,'Inherited schedule',parent,'2026-12-10'],[own,'Routine leaf',null,'2026-12-10']])await command('create',{id:node,title,parent:p,due,lead:id(4),people:[id(4),id(6)],standalone:true});
 let payload={id:own,title:'Routine leaf',due:'2026-12-11',standalone:true},impact=await preview(payload);
 equal(impact.requires_date_confirmation,false,'safe leaf date is routine');await checked(payload,impact);equal((await tree()).nodes.find(n=>n.id===own).due_date,'2026-12-11','routine checked write succeeds');
 payload={id:parent,title:'Date branch',due:'2026-12-21',standalone:true};impact=await preview(payload);equal(impact.requires_date_confirmation,false,'has children alone is not material when earlier own date remains binding');
 await command('edit',{id:leaf,title:'Inherited schedule',due:null,standalone:true});impact=await preview(payload);
 equal(impact.requires_date_confirmation,true,'changed inherited descendant bound is material');const item=impact.date_impact.items.find(i=>i.id===leaf);
 equal([item.path,item.old_bound,item.new_bound,item.bound_changed],[['Date branch','Inherited schedule'],'2026-12-20','2026-12-21',true],'authorized path and precise changed bounds');
 await checked(payload,impact);equal((await tree()).nodes.find(n=>n.id===leaf).due_date,null,'parent date never cascades child dates');
 for(const invalid of [{...payload,due:'2027-01-01'},{id:parent,title:'Date branch',due:'2026-12-01',standalone:true}]){
  if(invalid.due==='2026-12-01')await command('edit',{id:leaf,title:'Inherited schedule',due:'2026-12-10',standalone:true});
  const prior=await tree();await assert.rejects(()=>preview(invalid),/deadline|descendant dates/);checks++;equal(await tree(),prior,'invalid preview has no mutation');
 }
 // Real progress history with reset-looking current state remains a commitment.
 await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[id(4)]);
 await db.query('insert into subtask_progress_updates(id,task_id,subtask_id,author_id,author_name,percent_complete,note) values($1,$2,$3,$4,$5,0,$6)',[id(key++),root,own,id(4),'Current worker','Recorded plan']);await actor(3);
 payload={id:own,title:'Routine leaf',due:'2026-12-12',standalone:true};impact=await preview(payload);equal(impact.requires_date_confirmation,true,'retained progress plan makes zero-progress leaf material');equal(impact.date_impact.items[0].history_counts.progress,1,'aggregate history shown without row content');
 equal(JSON.stringify(impact).includes('Recorded plan'),false,'private history note absent');await checked(payload,impact);
 // History arriving after a routine classification invalidates the opaque hash,
 // even without a tree revision change; routine writes are checked too.
 const terms={id:leaf,title:'Inherited schedule',due:'2026-12-11',standalone:true},routine=await preview(terms);equal(routine.requires_date_confirmation,false,'routine before independent history');const rev=(await tree()).revision;
 await db.exec('reset role');await value("select set_config('request.jwt.claim.sub',$1,false)",[id(4)]);await db.query('insert into subtask_progress_updates(id,task_id,subtask_id,author_id,author_name,percent_complete,note) values($1,$2,$3,$4,$5,0,$6)',[id(key++),root,leaf,id(4),'Current worker','New commitment']);await actor(3);
 equal((await tree()).revision,rev,'independent history keeps tree revision');await assert.rejects(()=>checked(terms,routine),/impact changed/);checks++;
 equal((await tree()).nodes.find(n=>n.id===leaf).due_date,'2026-12-10','stale routine confirmation cannot save date');equal((await preview(terms)).requires_date_confirmation,true,'fresh classification sees new commitment');
 await actor(6);const denied=await preview(terms);equal(denied.allowed,false,'contributor cannot inspect date impact');equal(denied.date_impact,undefined,'denied scope reveals no schedule/history facts');
 await actor(3);equal(await value('select percent_complete from tasks where id=$1',[root]),37,'manual progress preserved');
 // Actual financial cap remains unchanged and makes a safe leaf date material.
 const financial=id(key++);await command('create',{id:financial,title:'Committed leaf',parent:null,due:'2026-12-10',lead:id(4),people:[id(4),id(6)],standalone:true});
 await actor(2);const section=await value("select s.id from office_budget_sections s join department_fiscal_budgets b on b.id=s.fiscal_budget_id where b.org_id=$1 and b.fiscal_year=2026 and b.status='locked' and not s.retired and not exists(select 1 from office_budget_sections c where c.parent_id=s.id and not c.retired) limit 1",[id(90)]);
 await value('select fund_office_work($1,2026,$2::jsonb,$3,$4)',[root,JSON.stringify([{partitionId:section,amount:100}]),'Date commitment fixture',id(key++)]);
 const line=await value('select l.id from work_budget_allocation_lines l join work_budget_allocations a on a.id=l.allocation_id where a.task_id=$1 and a.subtask_id is null',[root]);await actor(3);
 await value('select set_subtask_budget_cap($1,$2,$3,20,$4,$5)',[root,financial,line,'Date committed cap',id(key++)]);
 payload={id:financial,title:'Committed leaf',due:'2026-12-11',standalone:true};impact=await preview(payload);equal(impact.requires_date_confirmation,true,'real financial commitment makes leaf material');equal(impact.date_impact.items[0].history_counts.allocations,1,'only aggregate allocation count exposed');
 const finance=await value('select jsonb_agg(to_jsonb(a) order by id) from work_budget_allocations a where task_id=$1',[root]);await checked(payload,impact);equal(await value('select jsonb_agg(to_jsonb(a) order by id) from work_budget_allocations a where task_id=$1',[root]),finance,'date does not rewrite allocations');
 // Personal execution events remain historical after state returns to todo/0.
 await actor(21);await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject,'create_task',JSON.stringify({title:'NW5.5 personal date history',lead_id:id(21)}),id(key++)]);
 root=await value("select id from personal_tasks where project_id=$1 and title='NW5.5 personal date history'",[personalProject]);
 const personalNode=id(key++);await command('create',{id:personalNode,title:'Personal leaf',lead:id(21),people:[id(21)],due:'2026-12-10',standalone:true});
 payload={id:personalNode,title:'Personal leaf',due:'2026-12-11',standalone:true};equal((await preview(payload)).requires_date_confirmation,false,'personal routine leaf');
 await command('progress',{id:personalNode,progress:10,note:'Historical personal plan'});
 await db.exec('reset role;set session_replication_role=replica');await db.query("update personal_subtasks set status='todo',percent_complete=0 where id=$1",[personalNode]);await db.exec('set session_replication_role=origin');await actor(21);
 impact=await preview(payload);equal(impact.requires_date_confirmation,true,'personal historical event is material despite reset state');equal(impact.date_impact.items[0].history_counts.execution_events>0,true,'aggregate personal history');await checked(payload,impact);
 await command('progress',{id:personalNode,progress:10,note:'Current started work'});const locked=await preview({...payload,due:'2026-12-12'});equal(locked.allowed,false,'indicator does not authorize started canonical edits');
 console.log(`NW5.5 material dates: ${checks} assertions passed.`);return checks;
}
