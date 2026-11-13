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
    '20261018150908_work_status_snapshot.sql',
    '20261020210040_resumable_pdf_import_and_office_people.sql',
    '20261030013255_direct_subitem_completion.sql',
    '20261030074704_project_definition_and_funding_flow.sql',
    '20261030083920_complete_project_setup_guards.sql',
  ]) await db.exec(await migrationSource(name));
  await db.exec(await migrationSource('20261113082829_project_work_planning_boundaries.sql'));

  await actor(2);
  const draftRequest = [JSON.stringify({title:'Recoverable draft',org_id:office,owner_id:financeId(2),status:'planning'}),financeId(976)];
  const created = await value('select (create_project_draft_once($1,$2)).id',draftRequest);
  assert.equal(await value('select (create_project_draft_once($1,$2)).id',draftRequest),created);
  await assert.rejects(db.query('select create_project_draft_once($1,$2)',
    [JSON.stringify({...JSON.parse(draftRequest[0]),title:'Different draft'}),draftRequest[1]]), /reused with different details/);
  await actor(5);
  await assert.rejects(db.query('select create_project_draft_once($1,$2)',draftRequest), /Only the appointed Office Head/);
  await actor(2);
  const version = await value('select updated_at::text from projects where id=$1',[project]);
  const details = { title:'Office plan',description:'Project description',scope:'Project scope',lead:financeId(6),start:'2026-10-01',end:'2026-12-31',noFunding:true,version };
  await value('select save_project_definition($1,$2::jsonb)',[project,JSON.stringify(details)]);
  await value('select finish_project_setup($1)',[project]);
  const receipt = await value('select setup_completed_at::text from projects where id=$1',[project]);
  details.version = await value('select updated_at::text from projects where id=$1',[project]);
  details.description = 'Revised project description';
  await value('select save_project_definition($1,$2::jsonb)',[project,JSON.stringify(details)]);
  assert.equal(await value('select setup_completed_at::text from projects where id=$1',[project]), receipt);
  await assert.rejects(db.query('select save_project_definition($1,$2::jsonb)',
    [project,JSON.stringify(details)]), /changed elsewhere/);
  await db.exec('reset role; set session_replication_role = replica');
  await db.query("update projects set status='active' where id=$1", [project]);
  await db.exec('set session_replication_role = origin');
  await actor(2);
  await value('select (phase3_create_task($1,$2,$3)).id', [project, group, 'Ordinary new task']);
  assert.equal(await value('select status from projects where id=$1', [project]), 'active');
  await db.exec('reset role');
  await assert.rejects(db.query('delete from project_members where project_id=$1 and user_id=$2',
    [project,financeId(6)]), /Appoint a different Project Lead/);
  await assert.rejects(db.query(`update project_office_members set access_ended_at=now()
    where project_office_id in (select id from project_offices where project_id=$1) and user_id=$2`,
    [project,financeId(6)]), /Appoint a different Project Lead/);
  await db.query("update tasks set description='Revised plan' where id=$1", [task]);
  assert.equal(await value('select status from projects where id=$1', [project]), 'active');
  assert.equal(await value('select parent_subtask_id from subtasks where id=$1', [financeId(971)]), financeId(970));
  await assert.rejects(db.query(
    "insert into subtasks(task_id,parent_subtask_id,title,created_by) values ($1,$2,'New nested subtask',$3)",
    [task, financeId(970), financeId(2)]), /directly to a project task/);
  await assert.rejects(db.query('update subtasks set parent_subtask_id=$1 where id=$2',
    [financeId(971), financeId(970)]), /directly to a project task/);
  const direct = await value("insert into subtasks(task_id,title,created_by,position,sibling_order) values ($1,'Direct subtask',$2,10,10) returning parent_subtask_id",
    [task,financeId(2)]);
  assert.equal(direct,null);
  // Exercise the Office material-change branch without invoking unrelated
  // Office membership validation on the compatibility fixture.
  await db.exec(`
    create temporary table project_offices (
      project_id uuid, office_id uuid, relationship_type text, invitation_status text
    );
    create trigger material_office_change after insert on project_offices
      for each row execute function eflow_phase7.material_change();
  `);
  await db.query("insert into pg_temp.project_offices(project_id) values ($1)", [project]);
  assert.equal(await value('select status from public.projects where id=$1', [project]), 'on_hold');
  console.log('Project work planning SQL checks passed.');
} catch (error) {
  console.error(error.message, error.query?.slice(0,200) ?? '');
  process.exitCode = 1;
} finally {
  await db.close();
}
