import { financialBaselineSql, migrationSource, nwCorrections } from './financialCompatibilityDatabase.mjs';
import { financialScenario, financeId as id } from './financialScenario.mjs';
import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/** Disposable PostgreSQL fixture. Never reads hosted credentials or connects to Supabase. */
export async function notificationDatabase() {
  const db = await PGlite.create({ extensions: { ltree, pgcrypto } });
  try {
    // Normalize Windows checkout line endings before restoring exact SQL bodies.
    // The guarded historical patches compare multiline fragments literally.
    await db.exec((await financialBaselineSql()).replace(/\r\n/g, '\n'));
    const scenario = await financialScenario(db);
    const root = await scenario.value('select (phase3_create_task($1,$2,$3)).id', [scenario.project, scenario.group, 'Service delivery']);
    await db.exec('reset role');
    for (const name of [
      '20261015125031_financial_cash_compatibility.sql', '20261015142837_financial_journal_and_refund_integrity.sql', ...nwCorrections,
      '20261016195402_fix_initial_task_team_assignment.sql', '20261016202126_validate_task_due_dates.sql',
      '20261018150908_work_status_snapshot.sql', '20261020210040_resumable_pdf_import_and_office_people.sql',
      '20261030013255_direct_subitem_completion.sql', '20261030074704_project_definition_and_funding_flow.sql',
      '20261030083920_complete_project_setup_guards.sql', '20261031124511_remove_project_funding_quarters.sql',
    ]) await db.exec((await migrationSource(name)).replace(/\r\n/g, '\n'));
    await db.exec("create function storage.foldername(text) returns text[] language sql immutable as $$select regexp_split_to_array($1,'/')$$");
    await db.exec('create unique index fixture_chat_task_unique on public.chat_channels(task_id) where task_id is not null');
    for (const name of [
      '20261102190846_work_completion_and_update_notifications.sql', '20261102192953_work_status_lifecycle_sync.sql',
      '20261105200638_nested_work_read_command_receipt.sql',
      '20261108172455_messages_workspace.sql', '20261111165907_m7_subtask_schedule_and_start.sql',
      '20261111165909_m7_work_review_contract.sql', '20261111165910_m7_allocation_authority.sql',
      '20261111170850_m7_operational_visibility.sql', '20261113030000_enforce_project_on_hold_and_subtask_execution.sql',
      '20261113051013_show_subtasks_to_parent_task_viewers.sql', '20261113052528_require_explicit_task_start.sql',
      '20261113054505_bound_subtask_dates_to_parent.sql', '20261113061239_require_scheduled_subtask_lead_start.sql',
      '20261113082829_project_work_planning_boundaries.sql', '20261113094225_private_project_planning_lifecycle.sql',
      '20261113103357_inline_task_creation_receipt.sql', '20261113190755_active_root_contributor_lock_and_work_timeouts.sql',
      '20261113192810_allow_late_work_start.sql', '20261113203235_assigned_subtask_review_queue.sql',
      '20261114173000_remove_task_due_time.sql', '20261115090000_project_creator_and_subtask_staffing.sql',
    ]) {
      try { await db.exec((await migrationSource(name)).replace(/\r\n/g, '\n')); }
      catch (error) { throw new Error(name + ': ' + error.message + ' ' + (error.where || '')); }
    }
    // Synthetic setup only; all notification assertions exercise ordinary guarded writes below.
    await db.exec('reset role; set session_replication_role=replica');
    await db.query("update projects set publication_state='published',status='active',project_lead_id=$2,scope='Services',description='Fixture',funding_not_required=true,setup_completed_at=now() where id=$1", [scenario.project, id(6)]);
    await db.query("update tasks set status='in_progress',assigned_to=$2,recommendation_lead_id=$2,team_member_ids=$3::uuid[],start_date='2026-01-01',due_date='2030-12-31' where id=$1", [root, id(5), [5, 6, 9].map(id)]);
    const participation = await scenario.value("select id from project_offices where project_id=$1 and relationship_type='lead'", [scenario.project]);
    await db.query("insert into project_office_members(project_office_id,user_id,selected_by,engagement) values($1,$2,$3,'Permanent')", [participation, id(9), id(2)]);
    await db.query("insert into subtasks(id,task_id,title,created_by,lead_id,assigned_to,assigned_to_ids,due_date,start_date,started_at,is_standalone) values($1,$2,'Confirm service venue',$3,$4,$4,$5::uuid[],'2030-12-20',current_date,now(),true)", [id(950), root, id(5), id(6), [6, 9].map(id)]);
    await db.exec('set session_replication_role=origin; set check_function_bodies=on');
    return { db, root, node: id(950), ...scenario };
  } catch (error) { await db.close(); throw error; }
}
