import assert from 'node:assert/strict';
import { financialBaselineSql, migrationSource, nwCorrections } from '../tests/sql/helpers/financialCompatibilityDatabase.mjs';
import { financialScenario, financeId } from '../tests/sql/helpers/financialScenario.mjs';

import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
// Normalize Windows checkout line endings only inside this disposable replay.
const db = await PGlite.create({extensions:{ltree,pgcrypto}});
await db.exec((await financialBaselineSql()).replaceAll('\r\n','\n'));
const source=async name=>(await migrationSource(name)).replaceAll('\r\n','\n');
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
  ]) await db.exec(await source(name));
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
    try{await db.exec(await source(name));}
    catch(error){throw new Error(name+': '+error.message+' '+(error.where??'')+' '+(error.position??''));}
  }
  await db.exec(await source('20261105200638_nested_work_read_command_receipt.sql'));
  await db.exec(await source('20261113190755_active_root_contributor_lock_and_work_timeouts.sql'));
  await db.exec(await source('20261115090000_project_creator_and_subtask_staffing.sql'));
  await actor(2);
  const draft=await value('select (create_project_draft_once($1,$2)).id',
    [JSON.stringify({title:'Creator-led plan',org_id:office,owner_id:financeId(2),status:'planning'}),financeId(980)]);
  assert.equal(await value('select project_lead_id from projects where id=$1',[draft]),financeId(2));
  // The appointed Project Lead can staff during planning, including while also Head.
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set status='planning',project_lead_id=$2,description='Complete fixture',scope='Test work',funding_not_required=true,setup_completed_at=now() where id=$1",[project,financeId(2)]);
  await db.query("insert into project_office_members(project_office_id,user_id,selected_by) select id,$2,$2 from project_offices where project_id=$1 and relationship_type='lead' on conflict do nothing",[project,financeId(2)]);
  await db.exec('set session_replication_role=origin');
  await actor(2);
  const command=async (name,payload,key)=>{
    const current=await value('select r7_work_tree($1)',[task]);
    return value('select r7_work_command($1,$2,$3,$4,$5)',[task,current.revision,financeId(key),name,JSON.stringify(payload)]);
  };
  await command('root_lead',{lead:financeId(2),people:[2,5,6].map(financeId)},981);
  await command('staff',{id:financeId(970),lead:financeId(2),people:[financeId(2)]},982);
  assert.equal(await value('select lead_id from subtasks where id=$1',[financeId(970)]),financeId(2));
  await command('create',{id:financeId(978),title:'Reviewed updates',lead:financeId(6),people:[5,6].map(financeId),standalone:true},984);
  let snapshot=await value('select r7_work_tree($1)',[task]);
  assert.equal(snapshot.root.subtask_staffing_locked,false);
  assert.equal(snapshot.nodes.find(n=>n.id===financeId(970)).capabilities.manage_contributors.allowed,true);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set status='active' where id=$1",[project]);
  await db.exec('set session_replication_role=origin');
  await actor(2);
  snapshot=await value('select r7_work_tree($1)',[task]);
  assert.equal(snapshot.root.subtask_staffing_locked,true);
  for(const action of ['manage_contributors','appoint_lead'])
    assert.deepEqual(snapshot.nodes.find(n=>n.id===financeId(970)).capabilities[action],{allowed:false,reason_code:'active_subtask_staffing_locked'});
  await assert.rejects(db.query('update subtasks set lead_id=$2,assigned_to=$2,assigned_to_ids=$3 where id=$1',
    [financeId(970),financeId(5),[financeId(5)]]),/Subtask assignments are read-only/);
  await assert.rejects(db.query('insert into subtasks(id,task_id,title,created_by,lead_id,assigned_to_ids) values($1,$2,$3,$4,$4,$5)',
    [financeId(975),task,'Assigned during Active',financeId(2),[financeId(2)]]),/Subtask assignments are read-only/);
  await command('create',{id:financeId(976),title:'Unassigned during Active',people:[],standalone:true},983);
  assert.equal(await value('select lead_id from subtasks where id=$1',[financeId(976)]),null);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update tasks set status='in_progress' where id=$1",[task]);
  await db.query("update subtasks set status='in_progress',started_at=now() where id=$1",[financeId(978)]);
  await db.exec('set session_replication_role=origin');
  await actor(5);
  const terms={note:'',blocker:'Waiting for supplies',next_step:'Confirm delivery'};
  const proposal=await value('select m7_propose_work($1,$2,$3,$4,$5,null)',[task,financeId(978),financeId(985),'progress',JSON.stringify(terms)]);
  assert.equal(proposal.terms.next_step,'Confirm delivery');
  assert.equal(proposal.reviewer_id,financeId(6));
  assert.equal(await value('select count(*)::int from subtask_progress_updates where subtask_id=$1',[financeId(978)]),0);
  await actor(6);
  await value('select m7_decide_work($1,$2,true,null)',[financeId(985),financeId(986)]);
  const saved=(await db.query('select blocker,next_step from subtask_progress_updates where subtask_id=$1',[financeId(978)])).rows[0];
  assert.equal(saved.blocker,terms.blocker);assert.equal(saved.next_step,terms.next_step);
  await actor(5);
  await assert.rejects(db.query('select m7_propose_work($1,$2,$3,$4,$5,null)',[task,financeId(978),financeId(987),'progress',JSON.stringify({...terms,next_step:'x'.repeat(301)})]),/work note/);
  await value('select m7_propose_work($1,$2,$3,$4,$5,null)',[task,financeId(978),financeId(988),'progress',JSON.stringify({note:'Supplies arrived',blocker:'',next_step:'Distribute supplies'})]);
  await actor(6);
  await value('select m7_decide_work($1,$2,true,null)',[financeId(988),financeId(989)]);
  assert.equal(await value('select blocker from subtask_progress_updates where subtask_id=$1 order by created_at desc limit 1',[financeId(978)]),null);
  await db.exec('reset role');
  // Helper and internal migration functions must not become new client entry points.
  assert.equal(await value("select has_function_privilege('authenticated','eflow_publication.subtask_staffing_locked(uuid)','execute')"),false);
  console.log('PASS creator lead default, Planning staffing, Active capability and write guards, unassigned creation, reviewed blocker/next-step persistence and clearing');
} catch(error) { console.error(error.message, error.where ?? ''); process.exitCode=1; } finally { await db.close(); }
