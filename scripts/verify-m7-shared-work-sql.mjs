import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { financialScenario, financeId as id } from '../tests/sql/helpers/financialScenario.mjs';
import { financialCompatibilityDatabase, migrationSource, nwCorrections } from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';

const db = await financialCompatibilityDatabase();
try {
  // Optional exact deployed distribution SQL, replayed only in this disposable DB.
  const distribution = process.argv[2] && await readFile(process.argv[2], 'utf8');
  let scenario, task, draft, projectTask, overdue;
  for (const name of [
    '20261015125031_financial_cash_compatibility.sql',
    '20261015142837_financial_journal_and_refund_integrity.sql',
    ...nwCorrections,
    '20261016195402_fix_initial_task_team_assignment.sql',
    '20261018150908_work_status_snapshot.sql',
    '20261020210040_resumable_pdf_import_and_office_people.sql',
    '20261030013255_direct_subitem_completion.sql',
    '20261030074704_project_definition_and_funding_flow.sql',
    '20261030083920_complete_project_setup_guards.sql',
    '20261031124511_remove_project_funding_quarters.sql',
    '20261102182541_task_multiple_budget_accounts.sql',
    '20261102190846_work_completion_and_update_notifications.sql',
    '20261102192953_work_status_lifecycle_sync.sql',
    '20261111165907_m7_subtask_schedule_and_start.sql',
    '20261111165909_m7_work_review_contract.sql',
    '20261111165910_m7_allocation_authority.sql',
    '20261111170850_m7_operational_visibility.sql',
    '20261113051013_show_subtasks_to_parent_task_viewers.sql',
    '20261113052528_require_explicit_task_start.sql',
    '20261113054505_bound_subtask_dates_to_parent.sql',
    '20261113061239_require_scheduled_subtask_lead_start.sql',
    '20261113192810_allow_late_work_start.sql',
    '20261113203235_assigned_subtask_review_queue.sql',
  ]) {
    if (name === '20261030074704_project_definition_and_funding_flow.sql') {
      scenario = await financialScenario(db);
      task = await scenario.task(1000);
      await scenario.actor(2);
      const selected = await scenario.value("select id from project_offices where project_id=$1 and relationship_type='lead'",[scenario.project]);
      const expected = await scenario.value("select coalesce(array_agg(user_id order by user_id),'{}'::uuid[]) from project_office_members where project_office_id=$1",[selected]);
      await scenario.value('select r7_select_office_members($1,$2::uuid[],$3::uuid[],$4)',[selected,expected,[4,5,6,9].map(id),id(920)]);
      projectTask = await scenario.value('select (phase3_create_task($1,$2,$3)).id',[scenario.project,scenario.group,'Project funding target']);
      overdue = await scenario.value('select (phase3_create_task($1,$2,$3)).id',[scenario.project,scenario.group,'Overdue recovery target']);
      draft = await scenario.value('select (create_project_with_details($1::jsonb)).id',[JSON.stringify({title:'M7 private draft',org_id:scenario.office,status:'planning'})]);
      await db.exec('reset role');
    }
    if (name === '20261111165907_m7_subtask_schedule_and_start.sql') {
      await db.exec("set session_replication_role=replica");
      await db.query("update projects set status='active', scope='Fixture', description='Fixture', funding_not_required=true, project_lead_id=$2, setup_completed_at=now() where id=$1",[scenario.project,id(6)]);
      await db.query("update projects set project_lead_id=$2 where id=$1",[draft,id(6)]);
      await db.query("update tasks set status='todo', assigned_to=$2, team_member_ids=$3::uuid[], start_date='2026-01-01', due_date='2030-12-31' where id=$1",[task.task,id(5),[5,6,9].map(id)]);
      await db.query("update tasks set status='todo', assigned_to=$2, team_member_ids=$3::uuid[], start_date='2026-01-01', due_date='2026-12-31' where id=any($1::uuid[])",[[projectTask,overdue],id(5),[5,6,9].map(id)]);
      await db.query("update tasks set due_date=(current_date-1)::text where id=$1",[overdue]);
      await db.exec("set session_replication_role=origin; set check_function_bodies=on");
    }
    try {
      if (distribution && name === '20261111165910_m7_allocation_authority.sql') {
        await db.exec(distribution);
      }
      await db.exec(await migrationSource(name));
    }
    catch (error) { throw new Error(name + ': ' + error.message); }
  }
  const { actor, value, project } = scenario;
  let assertions=0;
  const equal=(actual,expected)=>{assert.deepEqual(actual,expected);assertions++;};
  const ok=(actual)=>{assert.ok(actual);assertions++;};
  const denies=async(sql,args,pattern)=>{await assert.rejects(db.query(sql,args),pattern);assertions++;};
  const root=task.task;
  const tree=()=>value('select r7_work_tree($1)',[root]);
  const command=async(payload,key)=>value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[root,(await tree()).revision,id(key),'create',JSON.stringify(payload)]);
  await actor(2);
  equal(await value('select count(*) from projects where id=$1',[draft]),0);
  ok((await value('select m7_draft_projects()')).some(item=>item.id===draft));
  await actor(3);
  await denies('select m7_draft_project($1)',[draft],/draft access denied/i);
  await actor(2);
  ok((await value('select m7_draft_project($1)',[draft])).flow.project.id===draft);
  await actor(5);
  const workspaces=await value('select r3_list_workspaces()');
  const currentOffice=workspaces.find(item=>item.kind==='office' && item.office_id===scenario.office);
  ok(currentOffice);
  ok((await value('select m7_office_assignments($1)',[currentOffice.id])).some(item=>item.key==='office-task:'+root));
  equal((await value('select r3_select_workspace($1)',[currentOffice.id])).projects.some(item=>item.id===draft),false);
  await actor(3);
  await denies('select m7_office_assignments($1)',[currentOffice.id],/workspace access/i);
  await actor(4);
  equal((await value('select m7_office_assignments($1)',[currentOffice.id])).some(item=>item.key==='office-task:'+root),false);
  await actor(5);
  const before=await tree();
  const today=before.root.scheduling.today;
  const due=(new Date(Date.parse(today)+3*86400000)).toISOString().slice(0,10);
  const future=(new Date(Date.parse(today)+2*86400000)).toISOString().slice(0,10);
  const nowNode=id(951),futureNode=id(952),directNode=id(953),capNode=id(954),secondCap=id(955);
  const create=(node,extra={})=>({id:node,title:'M7 fixture '+node.slice(-3),lead:id(6),people:[id(6),id(9)],due,standalone:true,...extra});
  let current=await command(create(nowNode,{start:today}),961);
  equal(current.nodes.find(n=>n.id===nowNode).start_date,today);
  equal(current.nodes.find(n=>n.id===nowNode).started_at,null);
  await command(create(futureNode,{start:future}),962);
  await denies('select r7_work_command($1,$2,$3,$4,$5::jsonb)',
    [root,(await tree()).revision,id(919),'create',JSON.stringify(create(id(917),{start:'2031-01-01',due:null}))],/parent schedule/i);
  await denies('select r7_work_command($1,$2,$3,$4,$5::jsonb)',
    [root,(await tree()).revision,id(918),'create',JSON.stringify(create(id(916),{due:'2031-01-01'}))],/ancestor deadline|parent deadline/i);
  await actor(2);
  equal((await tree()).nodes.map(n=>n.id).includes(futureNode),true);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set start_date='2026-01-01',target_date='2030-12-31' where id=$1",[project]);
  await db.exec('set session_replication_role=origin');
  await actor(2);
  await denies("select m7_create_scheduled_task($1,$2,'Out of range','2025-12-31','2026-01-01')",[project,scenario.group],/project schedule/i);
  const scheduledTask=await value("select to_jsonb(m7_create_scheduled_task($1,$2,'Within range','2026-01-01','2026-01-02'))",[project,scenario.group]);
  equal(scheduledTask.start_date,'2026-01-01');
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set status='active' where id=$1",[project]);
  await db.exec('set session_replication_role=origin');
  await actor(3);
  equal(await value('select count(*) from subtasks where id=$1',[nowNode]),0);
  await actor(4);
  equal((await value('select m7_office_assignments($1)',[currentOffice.id])).some(item=>item.key==='office-node:'+nowNode),false);
  await actor(6);
  equal(await value('select count(*) from subtasks where id=$1',[nowNode]),1);
  const preStart=await tree();
  equal(preStart.nodes.length,2);
  equal(preStart.leaf_total,2);
  equal(preStart.nodes.find(n=>n.id===nowNode).capabilities.execute.allowed,false);
  await denies('select complete_subitem($1,$2::jsonb)',[nowNode,JSON.stringify({id:id(970),note:'Before start'})],/appointed Task Lead|not started/i);
  equal(await value("select count(*) from notifications where work_node_id=$1",[nowNode]),0);
  await denies("select transition_task_status($1,'in_progress',null,null)",[root],/lead|permission|access|transition/i);
  await actor(5);
  await denies('select submit_task_progress($1,20,null,null,null,$2,null,null)',[root,'Before start'],/start or resume/i);
  await denies('select submit_task_for_review($1,$2::jsonb)',[root,JSON.stringify({note:'Before start'})],/start or resume/i);
  await denies("select transition_task_status($1,'for_review',null,null)",[root],/start or resume/i);
  equal(await value('select status from tasks where id=$1',[root]),'todo');
  await db.exec('reset role; set session_replication_role=replica');
  await db.query('update tasks set start_date=$2 where id=$1',[root,future]);
  await db.exec('set session_replication_role=origin');
  await actor(5);
  await denies("select transition_task_status($1,'in_progress',null,null)",[root],/on or after/i);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query('update tasks set start_date=$2::date-1 where id=$1',[root,today]);
  await db.exec('set session_replication_role=origin');
  await actor(5);
  await value("select transition_task_status($1,'in_progress',null,null)",[root]);
  equal((await tree()).nodes.find(n=>n.id===nowNode).started_at,null);
  await denies('select m7_start_subtask($1,$2)',[root,nowNode],/appointed Subtask Lead/i);
  await actor(6);
  await denies('select m7_start_subtask($1,$2)',[root,futureNode],/on or after/i);
  ok((await value('select m7_start_subtask($1,$2)',[root,nowNode])).started_at);
  current=await tree();
  ok(current.nodes.find(n=>n.id===nowNode).started_at);
  equal(current.nodes.find(n=>n.id===nowNode).effective_status,'in_progress');
  equal(current.nodes.find(n=>n.id===futureNode).started_at,null);
  await actor(5);
  current=await command(create(directNode,{lead:id(5),people:[id(5)]}),963);
  equal(current.nodes.find(n=>n.id===directNode).started_at,null);
  ok((await value('select m7_start_subtask($1,$2)',[root,directNode])).started_at);
  await actor(6);
  equal(await value("select count(*) from notifications where work_node_id=$1",[nowNode]),1);
  await actor(9);
  const futureBranch=(await tree()).nodes.find(n=>n.id===futureNode);
  ok(futureBranch);
  equal(futureBranch.started_at,null);
  equal(futureBranch.capabilities.execute.allowed,false);
  await denies("update subtasks set started_at=now() where id=$1",[nowNode],/managed|row-level|authority|permission/i);
  const originalProgress=await value('select percent_complete from tasks where id=$1',[root]);
  try { await db.query('update tasks set percent_complete=80 where id=$1',[root]); }
  catch (error) { assert.ok(error.code); }
  equal(await value('select percent_complete from tasks where id=$1',[root]),originalProgress);
  const completeArgs=[nowNode,JSON.stringify({id:id(964),note:'Unauthorized direct completion'})];
  await denies('select complete_subitem($1,$2::jsonb)',completeArgs,/appointed task lead|review/i);
  await denies('select submit_task_progress($1,20,null,null,null,null,null,null)',[root],/Lead review/i);
  const submit=async(node,key,kind,terms,previous=null)=>value('select m7_propose_work($1,$2,$3,$4,$5::jsonb,$6)',[root,node,id(key),kind,JSON.stringify(terms),previous]);
  const decide=async(key,request,approve,note=null)=>value('select m7_decide_work($1,$2,$3,$4)',[id(key),id(request),approve,note]);
  equal((await submit(null,965,'progress',{note:'Contributor update',progress:20})).reviewer_id,id(5));
  equal(await value('select percent_complete from tasks where id=$1',[root]),0);
  await denies('select m7_decide_work($1,$2,true,null)',[id(965),id(966)],/assigned review/i);
  await actor(5);
  equal((await decide(965,966,true)).state,'approved');
  equal(await value('select percent_complete from tasks where id=$1',[root]),20);
  equal((await decide(965,966,true)).state,'approved');
  await actor(9);
  const filePath=[id(9),root,nowNode,id(972),'evidence.pdf'].join('/');
  const attachment={filePath,fileName:'evidence.pdf',fileSize:12,mimeType:'application/pdf'};
  const insertFile="insert into storage.objects(bucket_id,name,owner_id,metadata) values ('m7-work-evidence',$1,$2,$3::jsonb)";
  const fileMetadata=JSON.stringify({size:12,mimetype:'application/pdf'});
  await db.query(insertFile,[filePath,id(9),fileMetadata]);
  await actor(6);
  equal(await value('select count(*) from storage.objects where name=$1',[filePath]),0);
  await actor(9);
  equal((await submit(nowNode,972,'progress',{note:'Subtask contributor update',progress:10,attachments:[attachment]})).reviewer_id,id(6));
  equal(await value('select count(*) from storage.objects where name=$1',[filePath]),1);
  equal((await db.query('delete from storage.objects where name=$1 returning id',[filePath])).rows.length,0);
  await actor(4);
  equal(await value('select count(*) from storage.objects where name=$1',[filePath]),0);
  await actor(6);
  equal(await value('select count(*) from storage.objects where name=$1',[filePath]),1);
  equal(await value("select count(*) from notifications where work_node_id=$1 and entity_type='m7_work_proposal'",[nowNode]),1);
  equal((await decide(972,973,true)).state,'approved');
  equal((await value('select m7_work_proposals($1,$2)',[root,nowNode])).items[0].terms.attachments,[attachment]);
  equal((await tree()).nodes.find(n=>n.id===nowNode).percent_complete,10);
  equal((await submit(nowNode,967,'completion',{note:'Done'})).reviewer_id,id(5));
  equal(await value('select count(*) from m7_assigned_subtask_reviews()'),0);
  await actor(5);
  equal(await value('select node_id from m7_assigned_subtask_reviews() where id=$1',[id(967)]),nowNode);
  equal((await decide(967,968,false,'Confirm checks')).state,'changes_requested');
  equal(await value('select count(*) from m7_assigned_subtask_reviews()'),0);
  await actor(6);
  equal((await submit(nowNode,969,'completion',{note:'Checks confirmed'},id(967))).supersedes,id(967));
  await actor(5);
  equal((await decide(969,970,true)).state,'approved');
  equal((await tree()).nodes.find(n=>n.id===nowNode).status,'completed');
  await value('select complete_subitem($1,$2::jsonb)',[directNode,JSON.stringify({id:id(971),note:'Same Lead'})]);
  equal((await tree()).nodes.find(n=>n.id===directNode).status,'completed');
  equal(await value('select status from tasks where id=$1',[root]),'in_progress');
  await command(create(capNode),974);
  await actor(6);
  await value('select m7_start_subtask($1,$2)',[root,capNode]);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query('update subtasks set due_date=$2 where id=$1',[capNode,new Date(Date.parse(today)-86400000).toISOString().slice(0,10)]);
  await db.exec('set session_replication_role=origin');
  await actor(5);
  await value("select save_subtask_work_update($1,'in_progress',null,$2,null,null,null)",[capNode,'Task Lead supervision']);
  equal((await tree()).nodes.find(n=>n.id===capNode).status,'in_progress');
  await command(create(secondCap),975);
  const cap=async(node,amount,request)=>value('select set_subtask_budget_cap($1,$2,$3,$4,$5,$6)',[root,node,task.supply,amount,'Fixture allocation',id(request)]);
  await actor(2);
  equal((await value('select m7_work_allocation_context($1,$2)',[root,capNode])).canAllocate,false);
  await denies('select set_subtask_budget_cap($1,$2,$3,600,$4,$5)',[root,capNode,task.supply,'Head attempt',id(976)],/Task Lead/i);
  const funding=await value('select authorize_project_funding($1,$2::jsonb,$3,$4)',[project,JSON.stringify([{partitionId:scenario.sections[0].id,amount:1000}]),'Fixture authorization',id(980)]);
  ok(funding);
  const flow=await value('select project_flow_snapshot($1)',[project]);
  const source=flow.funds[0];
  ok(source?.id);
  const lines=JSON.stringify([{sourceId:source.id,amount:100}]);
  await denies('select allocate_project_task_funding($1,$2::jsonb,$3,$4)',[projectTask,lines,'Head attempt',id(981)],/Project Lead/i);
  await actor(6);
  const allocated=await value('select allocate_project_task_funding($1,$2::jsonb,$3,$4)',[projectTask,lines,'Authorized allocation',id(982)]);
  ok(allocated);
  equal(await value('select allocate_project_task_funding($1,$2::jsonb,$3,$4)',[projectTask,lines,'Authorized allocation',id(982)]),allocated);
  await actor(5);
  equal((await value('select m7_work_allocation_context($1,$2)',[root,capNode])).canAllocate,true);
  const capId=await cap(capNode,600,976);
  ok(capId);
  equal(await cap(capNode,600,976),capId);
  await denies('select set_subtask_budget_cap($1,$2,$3,601,$4,$5)',[root,capNode,task.supply,'Fixture allocation',id(976)],/terms changed|different details/i);
  await denies('select set_subtask_budget_cap($1,$2,$3,500,$4,$5)',[root,secondCap,task.supply,'Overspend',id(977)],/available/i);
  await db.exec('reset role');
  equal(await value('select count(*) from budget_ledger_entries where correlation_key=$1',[id(976)]),1);
  if (distribution) {
    equal(await value('select count(*) from eflow_budget.subtask_budget_commands where request_id=$1',[id(976)]),1);
    equal(await value("select to_regclass('eflow_m7.cap_receipts')"),null);
    await db.exec('set session_replication_role=replica');
    await db.query('update tasks set assigned_to=null,recommendation_lead_id=$2 where id=$1',[root,id(5)]);
    await db.exec('set session_replication_role=origin');
    await actor(5);
    await denies('select set_subtask_budget_cap($1,$2,$3,600,$4,$5)',[root,capNode,task.supply,'Recommendation only',id(979)],/Task Lead/i);
    await denies('select remove_subtask_budget_cap($1,$2,$3)',[capId,'Recommendation only',id(978)],/Task Lead/i);
    await denies('select create_subtask_budget_allocation($1,$2,$3,100,$4)',[root,secondCap,task.supply,'Recommendation only'],/Task Lead/i);
    equal((await value('select get_task_funding_context($1,null)',[root])).canManageDistribution,false);
    await db.exec('reset role; set session_replication_role=replica');
    await db.query('update tasks set assigned_to=$2,recommendation_lead_id=null where id=$1',[root,id(5)]);
    await db.exec('set session_replication_role=origin');
    await actor(5);
    const createLegacyCap = () => value('select create_subtask_budget_allocation($1,$2,$3,100,$4)',[root,secondCap,task.supply,'Legacy allocation']);
    const legacyCap = await createLegacyCap();
    ok(legacyCap);
    equal(await createLegacyCap(),legacyCap);
    for (let attempt = 0; attempt < 2; attempt++) {
      await value('select remove_subtask_budget_cap($1,$2,$3)',[legacyCap,'Return unused cap',id(978)]);
    }
    equal((await value('select get_task_funding_context($1,null)',[root])).subtaskBudgets.find(row=>row.id===secondCap).capId,null);
    await db.exec('reset role');
  }
  await db.exec('set session_replication_role=replica');
  await db.query('update subtasks set start_date=$1 where id=$2',[today,futureNode]);
  await db.exec('set session_replication_role=origin');
  await actor(null,'service_role');
  equal(await value('select eflow_m7.activate_scheduled_subtasks(50)'),0);
  equal(await value('select eflow_m7.activate_scheduled_subtasks(50)'),0);
  await actor(6);
  ok((await value('select m7_start_subtask($1,$2)',[root,futureNode])).started_at);
  await actor(5);
  const overdueTree=await value('select r7_work_tree($1)',[overdue]);
  const recovery={id:id(983),title:'Overdue recovery',lead:id(5),people:[id(5)],due:overdueTree.root.due};
  await denies('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[overdue,overdueTree.revision,id(984),'create',JSON.stringify({...recovery,start:'2025-12-31'})],/start date/i);
  const recovered=await value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[overdue,overdueTree.revision,id(985),'create',JSON.stringify({...recovery,start:overdueTree.root.due})]);
  equal(recovered.nodes[0].start_date,overdueTree.root.due);
  ok(overdueTree.root.due<overdueTree.root.scheduling.today);
  await value("select transition_task_status($1,'in_progress',null,null)",[overdue]);
  equal(await value('select status from tasks where id=$1',[overdue]),'in_progress');
  ok((await value('select m7_start_subtask($1,$2)',[overdue,recovery.id])).started_at);
  await value('select submit_task_progress($1,20,null,null,null,$2,null,null)',[overdue,'Overdue progress']);
  equal(await value('select percent_complete from tasks where id=$1',[overdue]),20);
  const personalWorkspace=await value('select r3_create_workspace($1,$2,$3)',[id(987),'M7 Personal','Asia/Singapore']);
  const personalProject=await value('select r3_create_personal_project($1,$2,$3)',[personalWorkspace.id,id(988),'M7 Personal project']);
  for (const actorId of [6,9])
    await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'set_member',
      JSON.stringify({user_id:id(actorId),access:'member',state:'active'}),id(990+actorId)]);
  await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'create_task',JSON.stringify({title:'Personal root',lead_id:id(5)}),id(989)]);
  const personal=await value('select r3_personal_project_snapshot($1)',[personalProject.id]);
  const personalRoot=personal.tasks[0];
  const personalTree=await value('select r7_work_tree($1)',[personalRoot.id]);
  const personalNode=await value('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[personalRoot.id,personalTree.revision,id(990),'create',
    JSON.stringify({id:id(991),title:'Personal subtask',lead:id(6),people:[id(6),id(9)]})]);
  equal(personalNode.nodes[0].start_date,personalTree.root.scheduling.today);
  equal(personalNode.nodes[0].started_at,null);
  await actor(6);
  equal(await value('select count(*) from personal_subtasks where id=$1',[id(991)]),1);
  equal((await value('select r7_work_tree($1)',[personalRoot.id])).nodes[0].capabilities.execute.allowed,false);
  await actor(5);
  const personalStart=JSON.stringify({task_id:personalRoot.id,revision:personalRoot.revision});
  await denies('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'submit_task',personalStart,id(1001)],/start the task/i);
  await denies('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'progress_task',personalStart,id(1001)],/start the task/i);
  equal((await value('select r3_personal_project_command($1,$2,$3::jsonb,$4)',[personalProject.id,'start_task',personalStart,id(1001)])).status,'in_progress');
  await actor(6);
  ok((await value('select m7_start_subtask($1,$2)',[personalRoot.id,id(991)])).started_at);
  await actor(9);
  const startedPersonal=await value('select r7_work_tree($1)',[personalRoot.id]);
  ok(startedPersonal.nodes[0].started_at);
  await denies('select r7_work_command($1,$2,$3,$4,$5::jsonb)',[personalRoot.id,startedPersonal.revision,id(1002),'progress',
    JSON.stringify({id:id(991),progress:35,note:'Unauthorized'})],/lead to review/i);
  const personalSubmit=(key,kind,terms)=>value('select m7_propose_work($1,$2,$3,$4,$5::jsonb)',
    [personalRoot.id,id(991),id(key),kind,JSON.stringify(terms)]);
  equal((await personalSubmit(1003,'progress',{note:'Personal contributor work',progress:15})).reviewer_id,id(6));
  await actor(6);
  equal(await value("select count(*) from notifications where entity_type='m7_personal_work_proposal' and work_node_id=$1",[id(991)]),1);
  equal((await decide(1003,1004,true)).state,'approved');
  equal((await value('select r7_work_tree($1)',[personalRoot.id])).nodes[0].percent_complete,15);
  equal((await personalSubmit(1005,'completion',{note:'Personal branch complete'})).reviewer_id,id(5));
  await actor(5);
  equal((await decide(1005,1006,true)).state,'approved');
  equal((await value('select r7_work_tree($1)',[personalRoot.id])).nodes[0].status,'completed');
  console.log('M7 PostgreSQL migrations and '+assertions+' workflow assertions passed.');
} catch (error) { console.error(error.message, error.where ?? ''); process.exitCode = 1; } finally {
  await db.close();
}
