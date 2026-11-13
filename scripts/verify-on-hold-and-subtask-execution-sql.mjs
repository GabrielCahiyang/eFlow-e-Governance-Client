import assert from 'node:assert/strict';
import { financialScenario, financeId as id } from '../tests/sql/helpers/financialScenario.mjs';
import { financialCompatibilityDatabase, migrationSource, nwCorrections } from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';

const db = await financialCompatibilityDatabase();
try {
  let scenario, task, draft, projectTask;
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
    '20261113030000_enforce_project_on_hold_and_subtask_execution.sql',
    '20261113051013_show_subtasks_to_parent_task_viewers.sql',
    '20261113052528_require_explicit_task_start.sql',
    '20261113054505_bound_subtask_dates_to_parent.sql',
  ]) {
    if (name === '20261030074704_project_definition_and_funding_flow.sql') {
      scenario = await financialScenario(db);
      task = await scenario.task(1000);
      await scenario.actor(2);
      const selected = await scenario.value("select id from project_offices where project_id=$1 and relationship_type='lead'",[scenario.project]);
      const expected = await scenario.value("select coalesce(array_agg(user_id order by user_id),'{}'::uuid[]) from project_office_members where project_office_id=$1",[selected]);
      await scenario.value('select r7_select_office_members($1,$2::uuid[],$3::uuid[],$4)',[selected,expected,[4,5,6,9].map(id),id(920)]);
      projectTask = await scenario.value('select (phase3_create_task($1,$2,$3)).id',[scenario.project,scenario.group,'Project funding target']);
      draft = await scenario.value('select (create_project_with_details($1::jsonb)).id',[JSON.stringify({title:'M7 private draft',org_id:scenario.office,status:'planning'})]);
      await db.exec('reset role');
    }
    if (name === '20261111165907_m7_subtask_schedule_and_start.sql') {
      await db.exec("set session_replication_role=replica");
      await db.query("update projects set status='active', scope='Fixture', description='Fixture', funding_not_required=true, project_lead_id=$2, setup_completed_at=now() where id=$1",[scenario.project,id(6)]);
      await db.query("update projects set project_lead_id=$2 where id=$1",[draft,id(6)]);
      await db.query("update tasks set status='todo', assigned_to=$2, team_member_ids=$3::uuid[], start_date='2026-01-01', due_date='2030-12-31' where id=$1",[task.task,id(5),[5,6,9].map(id)]);
      await db.query("update tasks set status='todo', assigned_to=$2, team_member_ids=$3::uuid[], start_date='2026-01-01', due_date='2026-12-31' where id=any($1::uuid[])",[[projectTask],id(5),[5,6,9].map(id)]);
      await db.exec("set session_replication_role=origin; set check_function_bodies=on");
    }
    try { await db.exec(await migrationSource(name)); }
    catch (error) { throw new Error(name + ': ' + error.message); }
  }

  const { actor, value, project } = scenario;
  const root = task.task;
  let assertions = 0;
  const equal = (a, b) => { assert.deepEqual(a, b); assertions++; };
  const ok = (a) => { assert.ok(a); assertions++; };
  const denies = async (sql, args, pattern) => {
    await assert.rejects(db.query(sql, args), pattern);
    assertions++;
  };

  console.log('Database migrated successfully. Testing On-Hold and Subtask authorization...');

  // Create subtask using r7_work_command as Actor 5 (Task Lead)
  await actor(5);
  const tree = () => value('select r7_work_tree($1)', [root]);
  const command = async (payload, key) => value('select r7_work_command($1,$2,$3,$4,$5::jsonb)', [root, (await tree()).revision, id(key), 'create', JSON.stringify(payload)]);
  const before = await tree();
  const today = before.root.scheduling.today;
  const due = (new Date(Date.parse(today) + 3 * 86400000)).toISOString().slice(0, 10);
  const subtask1 = id(951);
  await command({ id: subtask1, title: 'Child subtask 1', lead: id(6), people: [id(6), id(9)], due, standalone: true }, 961);

  // Start parent task so child work is published to assignees
  await value("select transition_task_status($1, 'in_progress')", [root]);

  const treeCaps = async (nodeId) => {
    const t = await value('select r7_work_tree($1)', [root]);
    const n = t?.nodes?.find(item => item.id === nodeId);
    return n?.capabilities;
  };

  // TEST 1: While project is ACTIVE
  await actor(6); // Subtask Lead
  let capsNode6 = await treeCaps(subtask1);
  equal(capsNode6.execute.allowed, true);
  equal(capsNode6.submit.allowed, true);

  await actor(9); // Subtask Contributor
  let capsNode9 = await treeCaps(subtask1);
  equal(capsNode9.execute.allowed, true);

  // TEST 2: Subtask Execution Authorization:
  // Actor 5 (Task Lead) and Actor 2 (Office Head) are NOT on this subtask.
  // They should NOT have execute or submit capability on subtask1!
  await actor(5); // Task Lead
  let capsNode5 = await treeCaps(subtask1);
  equal(capsNode5.execute.allowed, false);
  equal(capsNode5.execute.reason_code, 'branch_denied');
  equal(capsNode5.submit.allowed, false);
  equal(capsNode5.submit.reason_code, 'branch_denied');

  await actor(2); // Office Head
  let capsNode2 = await treeCaps(subtask1);
  equal(capsNode2.execute.allowed, false);
  equal(capsNode2.execute.reason_code, 'branch_denied');
  equal(capsNode2.submit.allowed, false);
  equal(capsNode2.submit.reason_code, 'branch_denied');

  // Task Lead tries to complete the subtask directly -> REJECTED
  await actor(5);
  await denies(
    'select complete_subitem($1, $2::jsonb)',
    [subtask1, JSON.stringify({ id: id(980), note: 'Done by Task Lead' })],
    /Submit this subtask|Only a current subitem lead/i
  );

  // TEST 3: Switch project to ON_HOLD
  await db.exec('reset role');
  const linkedProj = await value('select linked_project_id from public.tasks where id=$1', [root]);
  await db.query("update public.projects set status='on_hold' where id=$1", [linkedProj]);

  // Root facts should show project_status = 'on_hold'
  const rootFacts = await value('select eflow_r7.root($1)', [root]);
  equal(rootFacts.project_status, 'on_hold');

  // eflow_r7.operation_capabilities for execute & submit must return project_on_hold
  await actor(6); // Subtask Lead
  capsNode6 = await treeCaps(subtask1);
  equal(capsNode6.execute.allowed, false);
  equal(capsNode6.execute.reason_code, 'project_on_hold');
  equal(capsNode6.submit.allowed, false);
  equal(capsNode6.submit.reason_code, 'project_on_hold');
  // But planning operations remain allowed for authorized users!
  equal(capsNode6.edit_details.allowed, true);

  // m7_propose_work must reject when project is on_hold (via work_scope_open)
  await denies(
    'select m7_propose_work($1, $2, $3, $4, $5::jsonb)',
    [root, subtask1, id(982), 'progress', JSON.stringify({ note: 'Subtask progress', progress: 50 })],
    /Current work scope required/i
  );

  // complete_subitem must reject with 'Project is on hold'
  await actor(6);
  await denies(
    'select complete_subitem($1, $2::jsonb)',
    [subtask1, JSON.stringify({ id: id(981), note: 'Subtask done' })],
    /Project is on hold/i
  );

  // save_subtask_work_update must reject with 'Project is on hold'
  await denies(
    'select save_subtask_work_update($1, $2)',
    [subtask1, 'in_progress'],
    /Project is on hold/i
  );

  // save_subtask_progress must reject with 'Project is on hold'
  await denies(
    'select save_subtask_progress($1, 50)',
    [subtask1],
    /Project is on hold/i
  );

  // transition_task_status must reject moving root task to in_progress with 'Project is on hold'
  await actor(5); // Task Lead
  await denies(
    "select transition_task_status($1, 'in_progress')",
    [root],
    /Project is on hold/i
  );

  // submit_task_progress must reject with 'Project is on hold'
  await denies(
    'select submit_task_progress($1, 20)',
    [root],
    /Project is on hold/i
  );

  // submit_task_for_review must reject with 'Project is on hold'
  await denies(
    'select submit_task_for_review($1, $2::jsonb)',
    [root, JSON.stringify({ note: 'Task ready' })],
    /Project is on hold/i
  );

  // Direct table update on tasks.status -> REJECTED by trigger
  await db.exec('reset role');
  await denies(
    "update public.tasks set status = 'completed' where id = $1",
    [root],
    /Project is on hold/i
  );

  // Direct table update on tasks.percent_complete -> REJECTED by trigger
  await denies(
    "update public.tasks set percent_complete = 50 where id = $1",
    [root],
    /Project is on hold/i
  );

  // Direct table update on subtasks.percent_complete -> REJECTED by trigger
  await denies(
    "update public.subtasks set percent_complete = 50 where id = $1",
    [subtask1],
    /Project is on hold/i
  );

  // Direct table update on subtasks.status -> REJECTED by trigger
  await denies(
    "update public.subtasks set status = 'in_progress' where id = $1",
    [subtask1],
    /Project is on hold/i
  );

  // Planning updates on task while ON_HOLD (title, description, due_date) -> STILL SUCCEED!
  await db.query("update public.tasks set description = 'Updated planning description' where id = $1", [root]);
  equal(await value("select description from public.tasks where id = $1", [root]), 'Updated planning description');

  // TEST 4: Unauthorized user (Actor 6, Subtask Lead) cannot activate project
  await actor(6);
  await denies("select phase7_activate_project($1)", [linkedProj], /Only the Lead Head/i);

  // Lead Office Head (Actor 2) performs readiness reviews and reactivates project to ACTIVE
  await actor(2);
  await db.query("select phase7_review_project($1, 'structure')", [linkedProj]);
  await db.query("select phase7_review_project($1, 'dates')", [linkedProj]);
  await db.query("select phase7_review_project($1, 'budget')", [linkedProj]);
  await db.query("select phase7_activate_project($1)", [linkedProj]);

  // Restores execution capabilities immediately!
  await actor(6); // Subtask Lead
  capsNode6 = await treeCaps(subtask1);
  equal(capsNode6.execute.allowed, true);
  equal(capsNode6.submit.allowed, true);

  // Subtask Lead can now update work!
  await actor(6);
  const updatedSubtask = await value("select save_subtask_work_update($1, 'in_progress')", [subtask1]);
  ok(updatedSubtask);
  equal(await value("select status from public.subtasks where id = $1", [subtask1]), 'in_progress');

  console.log(`All ${assertions} SQL assertions passed successfully!`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
