import assert from 'node:assert/strict';
import { financialCompatibilityDatabase, migrationSource, nwCorrections } from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import { financialScenario, financeId } from '../tests/sql/helpers/financialScenario.mjs';

const db = await financialCompatibilityDatabase();
try {
  const { actor, value, project, group, office } = await financialScenario(db);
  const task = await value('select (phase3_create_task($1,$2,$3)).id', [project, group, 'Existing work']);
  // Model a published Active project using the compatibility fixture.
  await db.exec('reset role; set session_replication_role = replica');
  await db.query("insert into subtasks(id,task_id,title,created_by) values ($1,$3,'Historical parent',$4),($2,$3,'Historical child',$4)",
    [financeId(970), financeId(971), task, financeId(2)]);
  await db.query('update subtasks set parent_subtask_id=$1 where id=$2', [financeId(970), financeId(971)]);
  await db.exec('set session_replication_role = origin');
  for (const name of [
    '20261015125031_financial_cash_compatibility.sql',
    '20261015142837_financial_journal_and_refund_integrity.sql',
    ...nwCorrections,
    '20261016195402_fix_initial_task_team_assignment.sql',
    '20261016202126_validate_task_due_dates.sql',
    '20261018150908_work_status_snapshot.sql',
    '20261020210040_resumable_pdf_import_and_office_people.sql',
    '20261030013255_direct_subitem_completion.sql',
    '20261030074704_project_definition_and_funding_flow.sql',
    '20261030083920_complete_project_setup_guards.sql',
    '20261031124511_remove_project_funding_quarters.sql',
  ]) await db.exec(await migrationSource(name));
  await db.exec("create function storage.foldername(text) returns text[] language sql immutable as $$select regexp_split_to_array($1,'/')$$");
  await db.exec('create unique index fixture_chat_task_unique on public.chat_channels(task_id) where task_id is not null');
  for(const name of [
    '20261102190846_work_completion_and_update_notifications.sql',
    '20261102192953_work_status_lifecycle_sync.sql',
    '20261108172455_messages_workspace.sql',
    '20261111165907_m7_subtask_schedule_and_start.sql',
    '20261111165909_m7_work_review_contract.sql',
    '20261111165910_m7_allocation_authority.sql',
    '20261111170850_m7_operational_visibility.sql',
    '20261113030000_enforce_project_on_hold_and_subtask_execution.sql',
    '20261113051013_show_subtasks_to_parent_task_viewers.sql',
    '20261113052528_require_explicit_task_start.sql',
    '20261113054505_bound_subtask_dates_to_parent.sql',
    '20261113061239_require_scheduled_subtask_lead_start.sql',
    '20261113082829_project_work_planning_boundaries.sql',
    '20261113094225_private_project_planning_lifecycle.sql',
    '20261113103357_inline_task_creation_receipt.sql',
  ]){
    try{await db.exec(await migrationSource(name));}
    catch(error){throw new Error(name+': '+error.message+' '+(error.where??'')+' '+(error.position??''));}
  }
  await actor(2);
  const request=[JSON.stringify({title:'Private Office plan',org_id:office,owner_id:financeId(2),status:'planning'}),financeId(980)];
  const draft=await value('select (create_project_draft_once($1,$2)).id',request);
  assert.equal(await value('select (create_project_draft_once($1,$2)).id',request),draft);
  assert.equal(await value('select publication_state from projects where id=$1',[draft]),'draft');
  const discard=await value('select (create_project_draft_once($1,$2)).id',
   [JSON.stringify({title:'Discard this draft',org_id:office,owner_id:financeId(2),status:'planning'}),financeId(982)]);
  await actor(5);
  await assert.rejects(db.query("select discard_private_project($1,'Discard this draft','Duplicate plan')",[discard]),/private project access/);
  await actor(2);
  assert.equal(await value("select discard_private_project($1,'Discard this draft','Duplicate plan')",[discard]),discard);
  const legacy=await value('select (create_project_with_details($1)).id',[request[0]]);
  assert.equal(await value('select publication_state from projects where id=$1',[legacy]),'draft');
  await db.exec('reset role');
  await assert.rejects(db.query('delete from projects where id=$1',[legacy]),/confirmed project draft discard/);
  await actor(2);
  const appointment={title:'Private Office plan',description:'Private details',scope:'Deliver services',lead:financeId(6),
    start:'2026-10-01',end:'2027-12-31',noFunding:true};
  for(const lead of [financeId(6),financeId(5),financeId(6)]){
    const version=await value('select updated_at::text from projects where id=$1',[legacy]);
    await value('select save_project_definition($1,$2::jsonb)',[legacy,JSON.stringify({...appointment,lead,version})]);
  }
  await actor(6);
  assert.equal(await value("select discard_private_project($1,'Private Office plan','Duplicate plan')",[legacy]),legacy);
  await actor(2);
  const funded=await value('select (create_project_draft_once($1,$2)).id',
   [JSON.stringify({...JSON.parse(request[0]),title:'Funded plan'}),financeId(988)]);
  const fundingVersion=await value('select updated_at::text from projects where id=$1',[funded]);
  await value('select save_project_definition($1,$2::jsonb)',[funded,JSON.stringify({...appointment,title:'Funded plan',noFunding:false,version:fundingVersion})]);
  const fundingArgs=[funded,JSON.stringify([{partitionId:financeId(200),amount:100}]),'Budget authorization',financeId(989)];
  const funding=await value('select authorize_project_funding($1,$2,$3,$4)',fundingArgs);
  assert.deepEqual(await value('select authorize_project_funding($1,$2,$3,$4)',fundingArgs),funding);
  await assert.rejects(db.query("select discard_private_project($1,'Funded plan','Duplicate plan')",[funded]),/linked work, funding or review/);
  const version=await value('select updated_at::text from projects where id=$1',[draft]);
  await value('select save_project_definition($1,$2::jsonb)',[draft,JSON.stringify({
    title:'Private Office plan',description:'Private details',scope:'Deliver services',lead:financeId(6),
    start:'2026-10-01',end:'2027-12-31',noFunding:true,version,
  })]);
  await value('select finish_project_setup($1)',[draft]);
  await actor(6);
  assert.equal(await value('select count(*)::int from projects where id=$1',[draft]),1);
  await assert.rejects(db.query('select authorize_project_funding($1,$2,$3,$4)',
    [draft,JSON.stringify([{partitionId:financeId(200),amount:100}]),'Private budget',financeId(987)]),/Only the appointed Head/);
  const planningGroup=await value('select id from project_groups where project_id=$1 and is_default',[draft]);
  const inlineArgs=[draft,planningGroup,'Lead planning task',financeId(990),financeId(6)];
  const createInline='select create_inline_project_task($1,$2,$3,$4,$5,false)';
  const verifyInline='select create_inline_project_task($1,$2,$3,$4,$5,true)';
  assert.equal(await value(verifyInline,inlineArgs),null);
  await assert.rejects(db.query(createInline,[draft,planningGroup,' \t\n',financeId(991),financeId(6)]),/Enter a task title/);
  const leadTask=await value(createInline,inlineArgs);
  assert.equal(await value(verifyInline,inlineArgs),leadTask);
  assert.equal(await value(createInline,inlineArgs),leadTask);
  assert.equal(await value("select count(*)::int from tasks where group_id=$1 and title='Lead planning task'",[planningGroup]),1);
  await assert.rejects(db.query(createInline,[draft,planningGroup,'Different title',financeId(990),financeId(6)]),/reused with different details/);
  await actor(5);
  await assert.rejects(db.query(verifyInline,inlineArgs),/Current project access required/);
  await assert.rejects(db.query(createInline,[...inlineArgs.slice(0,4),financeId(5)]),/Current project access required/);
  await actor(6);
  await value("select phase3_patch_task($1,'{\"title\":\"Revised lead task\"}'::jsonb)",[leadTask]);
  assert.equal(await value('select title from tasks where id=$1',[leadTask]),'Revised lead task');
  await assert.rejects(db.query('select phase7_activate_project($1)',[draft]),/Only the Lead Head/);
  for(const worker of [1,3,4,5,7,8,9]){
    await actor(worker);
    assert.equal(await value('select count(*)::int from projects where id=$1',[draft]),0);
    assert.equal(await value('select can_see_project($1,auth.uid())',[draft]),false);
    await assert.rejects(db.query('select project_flow_snapshot($1)',[draft]),/Current project access required/);
  }
  assert.equal(await value('select can_see_project($1,$2)',[draft,financeId(2)]),false);
  await actor(2);
  await assert.rejects(db.query('select phase7_activate_project($1)',[draft]),/readiness is incomplete/);
  await assert.rejects(db.query("select delete_project_permanently($1,'Private Office plan','Retain linked work')",[draft]),/linked work/);
  const draftGroup=await value('select id from project_groups where project_id=$1 and is_default',[draft]);
  const draftTask=await value('select (phase3_create_task($1,$2,$3)).id',[draft,draftGroup,'Private task']);
  const officeRow=await value("select id from project_offices where project_id=$1 and relationship_type='lead'",[draft]);
  const teamArgs=[draft,[financeId(5)],financeId(981)];
  const team=await value('select save_private_project_people($1,$2,$3)',teamArgs);
  assert.deepEqual(await value('select save_private_project_people($1,$2,$3)',teamArgs),team);
  assert.equal(await value('select count(*)::int from project_office_members where project_office_id=$1 and user_id=$2',[officeRow,financeId(6)]),1);
  await value('select assign_task($1,$2,$3)',[draftTask,financeId(5),'Finance person 5']);
  await actor(6);
  const tree=await value('select r7_work_tree($1)',[leadTask]);
  await value("select r7_work_command($1,$2,$3,'root_lead',$4)",[leadTask,tree.revision,financeId(983),JSON.stringify({lead:financeId(5),people:[financeId(5)]})]);
  assert.equal(await value('select assigned_to from tasks where id=$1',[leadTask]),financeId(5));
  const currentTree=await value('select r7_work_tree($1)',[leadTask]);
  await value("select r7_work_command($1,$2,$3,'create',$4)",[leadTask,currentTree.revision,financeId(984),JSON.stringify({id:financeId(985),title:'Direct planning step',lead:financeId(5),people:[financeId(5)],standalone:true})]);
  assert.equal(await value('select count(*)::int from subtasks where task_id=$1 and parent_subtask_id is null',[leadTask]),1);
  await actor(5);
  assert.equal(await value('select count(*)::int from tasks where id=$1',[draftTask]),0);
  assert.equal(await value('select count(*)::int from notifications where task_id=$1',[draftTask]),0);
  await actor(2);
  assert.equal(await value('select count(*)::int from chat_channels where project_id=$1 or task_id=$2',[draft,draftTask]),0);
  for(const kind of ['structure','dates','budget'])await value('select phase7_review_project($1,$2)',[draft,kind]);
  await value('select phase7_activate_project($1)',[draft]);
  await value('select publish_project($1)',[draft]);
  assert.equal(await value("select count(*)::int from audit_events where entity_id=$1 and action='project.published'",[draft]),1);
  await actor(5);
  assert.equal(await value('select count(*)::int from tasks where id=$1',[draftTask]),1);
  assert.equal(await value("select count(*)::int from notifications where task_id=$1 and type='assignment'",[draftTask]),1);
  await actor(6);
  const activeInlineArgs=[draft,draftGroup,'New Active task',financeId(992),financeId(6)];
  const extra=await value(createInline,activeInlineArgs);
  await value("select phase3_patch_task($1,'{\"title\":\"Renamed Active task\"}'::jsonb)",[extra]);
  assert.equal(await value('select status from projects where id=$1',[draft]),'active');
  await value('select soft_delete_task($1)',[extra]);
  assert.equal(await value(createInline,activeInlineArgs),extra);
  await assert.rejects(db.query('select soft_delete_task($1)',[leadTask]),/retain this task’s history/);
  await value("select cancel_task($1,'Deliverable cancelled by the project team')",[leadTask]);
  assert.equal(await value('select status from tasks where id=$1',[leadTask]),'cancelled');
  await db.exec('reset role');
  assert.equal(await value('select deleted_at is not null from tasks where id=$1',[extra]),true);
  await db.exec(`create temporary table project_offices(project_id uuid,office_id uuid,relationship_type text,invitation_status text);
    create trigger fixture_office_change after insert or update or delete on project_offices
      for each row execute function eflow_phase7.material_change();`);
  await db.query("insert into pg_temp.project_offices values($1,$2,'collaborating','pending')",[draft,office]);
  await db.query("update pg_temp.project_offices set invitation_status='joined'");
  assert.equal(await value('select status from public.projects where id=$1',[draft]),'active');
  await db.query("update pg_temp.project_offices set invitation_status='revoked'");
  assert.equal(await value('select status from public.projects where id=$1',[draft]),'on_hold');
  await actor(2);
  await value("update projects set status='on_hold' where id=$1 returning status",[draft]);
  await actor(5);
  await assert.rejects(db.query("select transition_task_status($1,'in_progress')",[draftTask]),/on hold/i);
  await assert.rejects(db.query(createInline,[draft,draftGroup,'Unauthorized hold task',financeId(993),financeId(5)]),/planning authority required/);
  await actor(6);
  assert.ok(await value(createInline,[draft,draftGroup,'Authorized hold planning',financeId(994),financeId(6)]));
  assert.equal(await value('select status from projects where id=$1',[draft]),'on_hold');
  await db.exec('reset role');
  await assert.rejects(db.query("update subtasks set started_at=now() where id=$1",[financeId(985)]),/on hold/i);
  await assert.rejects(db.query("update projects set status='completed' where id=$1",[draft]),/Reactivate this project/);
  await db.exec('reset role');
  assert.equal(await value('select publication_state from projects where id=$1',[project]),'published');
  await assert.rejects(db.query("update projects set publication_state='draft' where id=$1",[project]),/cannot return/);
  await assert.rejects(db.query('delete from projects where id=$1',[project]),/governed closeout/);
  assert.equal(await value('select parent_subtask_id from subtasks where id=$1',[financeId(971)]),financeId(970));
  console.log('Private project lifecycle SQL checks passed.');
}catch(error){
 console.error(error.message,error.query?.slice(0,180)??'');
 process.exitCode=1;
}finally{
 await db.close();
}
