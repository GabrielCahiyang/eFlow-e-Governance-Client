-- =============================================================================
-- eFlow Database Workflow Reset (Target: ixnfphgjyelhckjwjkdv)
-- Updated: 2026-11-18
--
-- PURPOSE:
--   Clears active/draft/completed projects, tasks, subtasks, chats,
--   notifications, non-archived petty cash / allocations / journal entries,
--   and non-archived workflow receipts while keeping:
--     1. Archived projects (status = 'archived' OR archived_at IS NOT NULL)
--        and ALL of their tasks, subtasks, attachments, evidence, budgets,
--        petty cash, journal entries, chats, audit events, and blockchain seals.
--     2. The 8 core LEDIPO & admin accounts + LEDIPO office + office workspace.
--     3. All system config, roles, custom_roles, skill_tag_definitions,
--        work_status_definitions, project_task_templates, templates, and
--        definition backups.
--     4. The locked office fiscal budget setup (department_fiscal_budgets,
--        department_budget_lines, office_budget_sections, accounting settings).
--
-- USAGE:
--   Run in Supabase SQL Editor on project ixnfphgjyelhckjwjkdv.
--   Change COMMIT; at the bottom to ROLLBACK; if you want a dry-run first.
-- =============================================================================

begin;
set local lock_timeout = '8s';
set local statement_timeout = '90s';

lock table public.profiles, public.organizations in share row exclusive mode;

-- -----------------------------------------------------------------------------
-- 0. Safeguard: verify core 8 LEDIPO/admin accounts and LEDIPO organization
-- -----------------------------------------------------------------------------
do $safeguard$
begin
  if (select count(*) from public.profiles
      where role = 'admin' or org_id = 'fdd4dfee-bbc3-42b4-9dcf-a9612c428460') <> 8
  or exists (
      select 1 from public.profiles
      where (role = 'admin' or org_id = 'fdd4dfee-bbc3-42b4-9dcf-a9612c428460')
        and id not in (
          '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,
          '8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
          '309c5592-0dde-42da-9274-d588d9921404'::uuid,
          '923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
          '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,
          '044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
          '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,
          '4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
        )
  )
  or not exists (
      select 1 from public.organizations
      where id = 'fdd4dfee-bbc3-42b4-9dcf-a9612c428460'
        and slug = 'ledipo'
        and head_user_id = '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'
  )
  then
    raise exception 'Keep set changed; reset canceled';
  end if;
end $safeguard$;

-- -----------------------------------------------------------------------------
-- 1. Build exemption sets for ARCHIVED projects & their entire dependency tree
-- -----------------------------------------------------------------------------
create temp table _keep_users (id uuid primary key) on commit drop;
insert into _keep_users (id) values
  ('32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid),
  ('8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid),
  ('309c5592-0dde-42da-9274-d588d9921404'::uuid),
  ('923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid),
  ('5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid),
  ('044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid),
  ('4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid),
  ('4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid);

create temp table _archived_projects on commit drop as
select id, source_collaboration_draft_id, source_collaboration_revision_id
from public.projects
where status = 'archived' or archived_at is not null;

create temp table _archived_tasks on commit drop as
select id from public.tasks
where linked_project_id in (select id from _archived_projects);

create temp table _archived_subtasks on commit drop as
select id from public.subtasks
where task_id in (select id from _archived_tasks);

create temp table _archived_drafts on commit drop as
select distinct source_collaboration_draft_id as id
from _archived_projects
where source_collaboration_draft_id is not null;

create temp table _archived_revisions on commit drop as
select id from public.proposal_collaboration_revisions
where draft_id in (select id from _archived_drafts)
union
select distinct source_collaboration_revision_id as id
from _archived_projects
where source_collaboration_revision_id is not null;

create temp table _archived_commitments on commit drop as
select distinct commitment_id as id
from eflow_project.funding
where project_id in (select id from _archived_projects)
  and commitment_id is not null
union
select id from public.budget_commitments
where proposal_draft_id in (select id from _archived_drafts)
union
select distinct commitment_id as id
from public.work_budget_allocations
where task_id in (select id from _archived_tasks)
  and commitment_id is not null;

create temp table _archived_allocations on commit drop as
select id from public.work_budget_allocations
where task_id in (select id from _archived_tasks)
   or commitment_id in (select id from _archived_commitments);

create temp table _archived_allocation_lines on commit drop as
select id from public.work_budget_allocation_lines
where allocation_id in (select id from _archived_allocations);

create temp table _archived_petty_cash_requests on commit drop as
select id from public.petty_cash_requests
where task_id in (select id from _archived_tasks)
   or subtask_id in (select id from _archived_subtasks)
   or commitment_id in (select id from _archived_commitments)
   or allocation_id in (select id from _archived_allocations);

create temp table _archived_petty_cash_releases on commit drop as
select id from public.petty_cash_releases
where request_id in (select id from _archived_petty_cash_requests);

create temp table _archived_liquidations on commit drop as
select id from public.petty_cash_liquidations
where request_id in (select id from _archived_petty_cash_requests);

create temp table _archived_receipts on commit drop as
select id from public.petty_cash_receipts
where liquidation_id in (select id from _archived_liquidations);

create temp table _archived_reviews on commit drop as
select id from public.liquidation_independent_reviews
where liquidation_id in (select id from _archived_liquidations);

create temp table _archived_journal_entries on commit drop as
select id from public.general_journal_entries
where (source_type = 'cash_release' and source_id in (select id from _archived_petty_cash_releases))
   or (source_type = 'liquidation' and source_id in (select id from _archived_liquidations));

create temp table _archived_seal_snapshots on commit drop as
select id from eflow_seal.snapshots
where project_id in (select id from _archived_projects);

create temp table _archived_channels on commit drop as
select id from public.chat_channels
where project_id in (select id from _archived_projects)
   or task_id in (select id from _archived_tasks);

create temp table _archived_project_offices on commit drop as
select id from public.project_offices
where project_id in (select id from _archived_projects);

create temp table _archived_project_office_identities on commit drop as
select id from public.project_office_identities
where project_id in (select id from _archived_projects);

create temp table _archived_inv_requests on commit drop as
select id from public.project_invitation_requests
where project_id in (select id from _archived_projects);

create temp table _archived_task_submissions on commit drop as
select id from public.task_submissions
where task_id in (select id from _archived_tasks);

create temp table _archived_subtask_submissions on commit drop as
select id from public.subtask_submissions
where task_id in (select id from _archived_tasks)
   or subtask_id in (select id from _archived_subtasks);

create temp table _archived_task_comments on commit drop as
select id from public.task_comments
where task_id in (select id from _archived_tasks);

create temp table _archived_library_files on commit drop as
select id from public.project_library_files
where project_id in (select id from _archived_projects);

-- -----------------------------------------------------------------------------
-- 2. Temporarily disable USER triggers (append-only & delete guards) while
--    keeping PostgreSQL system FK constraint triggers 100% active.
-- -----------------------------------------------------------------------------
alter table public.general_journal_lines disable trigger user;
alter table public.general_journal_entries disable trigger user;
alter table public.budget_ledger_entries disable trigger user;
alter table public.petty_cash_receipt_items disable trigger user;
alter table public.petty_cash_receipts disable trigger user;
alter table public.petty_cash_liquidations disable trigger user;
alter table public.petty_cash_releases disable trigger user;
alter table public.petty_cash_request_attachments disable trigger user;
alter table public.petty_cash_request_lines disable trigger user;
alter table public.petty_cash_requests disable trigger user;
alter table public.work_budget_allocation_lines disable trigger user;
alter table public.work_budget_allocations disable trigger user;
alter table public.work_tree_events disable trigger user;
alter table public.chat_messages disable trigger user;
alter table public.subtask_submission_attachments disable trigger user;
alter table public.subtask_submissions disable trigger user;
alter table public.subtask_progress_updates disable trigger user;
alter table public.subtasks disable trigger user;
alter table public.task_comment_attachments disable trigger user;
alter table public.task_comments disable trigger user;
alter table public.task_attachments disable trigger user;
alter table public.task_submissions disable trigger user;
alter table public.task_progress_updates disable trigger user;
alter table public.task_activities disable trigger user;
alter table public.task_status_history disable trigger user;
alter table public.tasks disable trigger user;
alter table public.milestone_organizations disable trigger user;
alter table public.milestones disable trigger user;
alter table public.project_library_links disable trigger user;
alter table public.project_library_files disable trigger user;
alter table public.project_office_work disable trigger user;
alter table public.project_office_people disable trigger user;
alter table public.project_office_members disable trigger user;
alter table public.project_office_identities disable trigger user;
alter table public.project_offices disable trigger user;
alter table public.project_organizations disable trigger user;
alter table public.project_members disable trigger user;
alter table public.project_groups disable trigger user;
alter table public.project_guest_members disable trigger user;
alter table public.project_invitation_requests disable trigger user;
alter table public.project_access_grants disable trigger user;
alter table public.projects disable trigger user;
alter table public.personal_subtasks disable trigger user;
alter table public.personal_tasks disable trigger user;
alter table public.personal_project_members disable trigger user;
alter table public.personal_projects disable trigger user;
alter table eflow_budget.cash_commands disable trigger user;
alter table eflow_evidence.attempts disable trigger user;
alter table eflow_evidence.objects disable trigger user;
alter table eflow_project.funding disable trigger user;

-- -----------------------------------------------------------------------------
-- 3. Delete non-archived financial, journal, ledger, and budget allocations
-- -----------------------------------------------------------------------------
delete from public.general_journal_lines
where journal_entry_id is null
   or journal_entry_id not in (select id from _archived_journal_entries);

delete from public.general_journal_entries
where id not in (select id from _archived_journal_entries);

delete from public.budget_ledger_entries
where not coalesce(
  task_id in (select id from _archived_tasks)
  or subtask_id in (select id from _archived_subtasks)
  or commitment_id in (select id from _archived_commitments)
  or allocation_id in (select id from _archived_allocations)
  or allocation_line_id in (select id from _archived_allocation_lines)
  or petty_cash_request_id in (select id from _archived_petty_cash_requests),
  false
);

delete from public.department_budget_account_mappings
where allocation_line_id is null
   or allocation_line_id not in (select id from _archived_allocation_lines);

delete from public.petty_cash_receipt_items
where receipt_id is null
   or receipt_id not in (select id from _archived_receipts);

delete from public.petty_cash_receipts
where id not in (select id from _archived_receipts);

delete from eflow_finance_review.events
where review_id is null
   or review_id not in (select id from _archived_reviews);

delete from eflow_finance_review.commands
where review_id is null
   or review_id not in (select id from _archived_reviews);

delete from eflow_finance_review.settlement_blocker_alerts
where liquidation_id is null
   or liquidation_id not in (select id from _archived_liquidations);

delete from eflow_finance_review.staffing_escalation_approvals
where liquidation_id is null
   or liquidation_id not in (select id from _archived_liquidations);

delete from eflow_work_clearance.return_commands
where liquidation_id is null
   or liquidation_id not in (select id from _archived_liquidations);

delete from eflow_work_clearance.return_decisions
where liquidation_id is null
   or liquidation_id not in (select id from _archived_liquidations);

delete from public.liquidation_independent_reviews
where id not in (select id from _archived_reviews);

delete from public.petty_cash_liquidations
where id not in (select id from _archived_liquidations);

delete from public.petty_cash_releases
where id not in (select id from _archived_petty_cash_releases);

delete from public.petty_cash_request_attachments
where request_id is null
   or request_id not in (select id from _archived_petty_cash_requests);

delete from public.petty_cash_request_lines
where request_id is null
   or request_id not in (select id from _archived_petty_cash_requests);

delete from eflow_budget.cash_commands
where request_id is null
   or request_id not in (select id from _archived_petty_cash_requests);

delete from public.petty_cash_requests
where id not in (select id from _archived_petty_cash_requests);

delete from eflow_budget.subtask_budget_commands
where result_id is null
   or result_id not in (select id from _archived_allocations);

-- Break circular RESTRICT FK between work_budget_allocations and lines
update public.work_budget_allocations
set parent_allocation_line_id = null
where id not in (select id from _archived_allocations);

delete from public.work_budget_allocation_lines
where id not in (select id from _archived_allocation_lines);

delete from public.work_budget_allocations
where id not in (select id from _archived_allocations);

delete from eflow_project.funding
where project_id is null
   or project_id not in (select id from _archived_projects);

delete from eflow_project.funding_requests
where project_id is null
   or project_id not in (select id from _archived_projects);

delete from eflow_project.commands
where coalesce(payload->>'project', result->>'project', result->>'projectId', '')
      not in (select id::text from _archived_projects);

delete from public.budget_commitments
where id not in (select id from _archived_commitments);

-- Office-level petty cash operational requests (keep eflow_office_cash.funds)
delete from eflow_office_cash.settlement_alerts;
delete from eflow_office_cash.events;
delete from eflow_office_cash.requests;
delete from eflow_office_cash.commands;

-- -----------------------------------------------------------------------------
-- 4. Delete non-archived eflow_* state, evidence, m7, seal, and audit logs
-- -----------------------------------------------------------------------------
delete from eflow_evidence.attempts
where not coalesce(
  task_id in (select id from _archived_tasks)
  or subtask_id in (select id from _archived_subtasks)
  or submission_id in (select id from _archived_task_submissions)
  or submission_id in (select id from _archived_subtask_submissions),
  false
);

delete from eflow_evidence.objects
where not coalesce(
  task_id in (select id from _archived_tasks)
  or subtask_id in (select id from _archived_subtasks),
  false
);

delete from eflow_work_clearance.acceptances
where not coalesce(
  root_id in (select id from _archived_tasks)
  or node_id in (select id from _archived_subtasks),
  false
);

delete from eflow_m7.applying_work_proposal;
delete from eflow_m7.activation
where root is null or root not in (select id from _archived_tasks);
delete from eflow_m7.deferred_assignments
where root_id is null or root_id not in (select id from _archived_tasks);
delete from eflow_m7.draft_scope
where project_id is null or project_id not in (select id from _archived_projects);
update eflow_m7.work_proposals
set supersedes = null
where root_id is null or root_id not in (select id from _archived_tasks);
delete from eflow_m7.work_proposals
where root_id is null or root_id not in (select id from _archived_tasks);

delete from eflow_r7.completion_locks
where root_id is null or root_id not in (select id from _archived_tasks);
delete from eflow_r7.tree_state
where root_id is null or root_id not in (select id from _archived_tasks);
delete from eflow_r7.receipts
where root_id is null or root_id not in (select id from _archived_tasks);
delete from eflow_r7.mutations
where root_id is null or root_id not in (select id from _archived_tasks);
delete from eflow_r7.member_receipts
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r7.backfill_exceptions
where project_id is null or project_id not in (select id from _archived_projects);

delete from eflow_r9.events
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r9.mutations
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r9.removed
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r9.staffing_removals
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r9.receipts
where coalesce(payload->>0, '') not in (select id::text from _archived_project_offices);

delete from eflow_r11.snapshots
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r3.backfill_exceptions
where project_id is null or project_id not in (select id from _archived_projects);
delete from eflow_r8.tokens
where request_id is null or request_id not in (select id from _archived_inv_requests);
delete from eflow_activation.dispatches;
delete from eflow_activation.request_limits;
delete from eflow_guests.writes;
delete from eflow_phase6.project_deletions;
delete from eflow_phase65.import_receipts;
delete from eflow_publication.discard_requests
where project_id is null or project_id not in (select id from _archived_projects);

-- Seal tables: preserve archived projects AND the standalone Tamper Demo cert
delete from eflow_seal.preview_edits
where snapshot_id is null or snapshot_id not in (select id from _archived_seal_snapshots);

delete from eflow_seal.transaction_attempts
where snapshot_id is null or snapshot_id not in (select id from _archived_seal_snapshots);

update eflow_seal.snapshots
set previous_id = null
where id not in (select id from _archived_seal_snapshots);

delete from eflow_seal.snapshots
where id not in (select id from _archived_seal_snapshots);

delete from public.project_seal_certificates
where (project_id is null or project_id not in (select id from _archived_projects))
  and id <> '99999999-9999-4999-8999-999999999001'::uuid; -- Remove this line if you also want to clear the Tamper Demo cert

-- -----------------------------------------------------------------------------
-- 5. Delete non-archived subtasks, tasks, chats, notifications, and milestones
-- -----------------------------------------------------------------------------
delete from public.subtask_submission_attachments
where not coalesce(
  task_id in (select id from _archived_tasks)
  or subtask_id in (select id from _archived_subtasks),
  false
);

update public.subtasks
set parent_subtask_id = null, latest_submission_id = null
where id not in (select id from _archived_subtasks);

delete from public.subtask_submissions
where id not in (select id from _archived_subtask_submissions);

delete from public.subtask_progress_updates
where not coalesce(
  task_id in (select id from _archived_tasks)
  or subtask_id in (select id from _archived_subtasks),
  false
);

delete from public.subtasks
where id not in (select id from _archived_subtasks);

delete from public.task_comment_attachments
where comment_id is null or comment_id not in (select id from _archived_task_comments);

delete from public.task_comments
where id not in (select id from _archived_task_comments);

delete from public.task_attachments
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.task_submissions
where id not in (select id from _archived_task_submissions);

delete from public.task_progress_updates
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.task_activities
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.task_status_history
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.task_reminders
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.task_organizations
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.task_template_runs
where task_id is null or task_id not in (select id from _archived_tasks);

delete from public.project_office_work
where not coalesce(
  project_id in (select id from _archived_projects)
  or task_id in (select id from _archived_tasks),
  false
);

delete from public.project_library_links
where not coalesce(
  file_id in (select id from _archived_library_files)
  or task_id in (select id from _archived_tasks),
  false
);

delete from public.project_library_events
where project_id is null or project_id not in (select id from _archived_projects);

delete from public.project_library_files
where id not in (select id from _archived_library_files);

delete from public.work_tree_events
where project_id is null or project_id not in (select id from _archived_projects);

delete from public.project_field_history
where project_id is null or project_id not in (select id from _archived_projects);

delete from eflow_chat.nicknames
where channel_id is null or channel_id not in (select id from _archived_channels);
delete from eflow_chat.personal_pins
where channel_id is null or channel_id not in (select id from _archived_channels);
delete from public.calls;
delete from public.chat_messages
where channel_id is null or channel_id not in (select id from _archived_channels);
delete from public.chat_channel_members
where channel_id is null or channel_id not in (select id from _archived_channels);
delete from public.chat_channels
where id not in (select id from _archived_channels);

delete from public.notifications
where not coalesce(
  project_id in (select id from _archived_projects)
  or task_id in (select id from _archived_tasks),
  false
);

delete from public.hierarchy_deadline_reminders;
delete from public.announcement_recipients;
delete from public.announcements;
delete from public.server_logs;
delete from public.monthly_productivity_snapshots;

delete from public.audit_events
where not coalesce(
  (entity_type = 'project' and entity_id in (select id::text from _archived_projects))
  or (entity_type = 'task' and entity_id in (select id::text from _archived_tasks))
  or (entity_type = 'subtask' and entity_id in (select id::text from _archived_subtasks)),
  false
);

delete from public.tasks
where id not in (select id from _archived_tasks);

delete from public.milestone_organizations
where milestone_id is null
   or milestone_id not in (select id from public.milestones where project_id in (select id from _archived_projects));

delete from public.milestones
where project_id is null or project_id not in (select id from _archived_projects);

-- -----------------------------------------------------------------------------
-- 6. Delete non-archived projects, project offices, invitations, and personal work
-- -----------------------------------------------------------------------------
delete from public.project_guest_members
where project_id is null or project_id not in (select id from _archived_projects);

delete from public.project_guest_account_events;
delete from public.project_guest_accounts;

delete from public.project_access_grants
where project_id is null or project_id not in (select id from _archived_projects);

delete from public.project_invitation_events
where request_id is null or request_id not in (select id from _archived_inv_requests);

update public.user_pds_documents
set project_request_id = null
where project_request_id is not null
  and project_request_id not in (select id from _archived_inv_requests);

update public.user_pds_documents
set invitation_id = null
where invitation_id is not null;

delete from public.project_office_people
where project_id is null or project_id not in (select id from _archived_projects);

delete from public.project_invitation_requests
where id not in (select id from _archived_inv_requests);

delete from public.managed_account_invite_details
where invitation_id is null
   or invitation_id in (
     select id from public.user_invitations
     where project_office_id is null
        or project_office_id not in (select id from _archived_project_offices)
   );

delete from public.user_invitations
where project_office_id is null
   or project_office_id not in (select id from _archived_project_offices);

delete from public.project_office_members
where project_office_id is null or project_office_id not in (select id from _archived_project_offices);

delete from public.project_office_identities
where id not in (select id from _archived_project_office_identities);

delete from public.project_offices
where id not in (select id from _archived_project_offices);

delete from public.project_organizations
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.project_members
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.project_groups
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.project_import_batches
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.project_pdf_import_sessions
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.project_readiness_reviews
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.office_project_homes
where project_id is null or project_id not in (select id from _archived_projects);
delete from public.proposal_collaboration_commit_projects
where project_id is null or project_id not in (select id from _archived_projects);

delete from public.projects
where id not in (select id from _archived_projects);

-- Proposal collaboration drafts not linked to an archived project
delete from public.proposal_delivery_closeout_decisions
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_delivery_closeouts
where draft_id not in (select id from _archived_drafts);
delete from public.proposal_governance_signoffs
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_governance_records
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_governance_assignments
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_collaboration_approvals
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_collaboration_change_requests
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_collaboration_messages
where draft_id is null or draft_id not in (select id from _archived_drafts);
delete from public.proposal_collaboration_orgs
where draft_id is null or draft_id not in (select id from _archived_drafts);
update public.proposal_collaboration_drafts
set current_revision_id = null
where id not in (select id from _archived_drafts);
delete from public.proposal_collaboration_revisions
where id not in (select id from _archived_revisions);
delete from public.proposal_collaboration_drafts
where id not in (select id from _archived_drafts);

-- Personal projects & personal workspaces (keep office workspace LEDIPO)
delete from public.personal_subtasks;
delete from public.personal_tasks;
delete from public.personal_work_events;
delete from public.personal_project_shortcuts;
delete from public.personal_project_members;
delete from public.personal_projects;
delete from public.workspace_members
where workspace_id in (select id from public.workspaces where kind <> 'office');
delete from public.workspaces
where kind <> 'office';

-- Non-core users/orgs cleanup (safety)
delete from public.user_permission_overrides where user_id not in (select id from _keep_users);
delete from public.user_preferences where user_id not in (select id from _keep_users);
delete from public.user_onboarding where user_id not in (select id from _keep_users);
delete from public.employee_notes where profile_id not in (select id from _keep_users);
delete from auth.sessions where user_id not in (select id from _keep_users);
delete from public.profiles where id not in (select id from _keep_users);
delete from public.organizations where id <> 'fdd4dfee-bbc3-42b4-9dcf-a9612c428460';
delete from auth.users where id not in (select id from _keep_users);
delete from private.eflow_login_audit;

update public.profiles
set workload = 0, burnout_level = 'low'
where id in (select id from _keep_users);

-- -----------------------------------------------------------------------------
-- 7. Re-enable USER triggers
-- -----------------------------------------------------------------------------
alter table public.general_journal_lines enable trigger user;
alter table public.general_journal_entries enable trigger user;
alter table public.budget_ledger_entries enable trigger user;
alter table public.petty_cash_receipt_items enable trigger user;
alter table public.petty_cash_receipts enable trigger user;
alter table public.petty_cash_liquidations enable trigger user;
alter table public.petty_cash_releases enable trigger user;
alter table public.petty_cash_request_attachments enable trigger user;
alter table public.petty_cash_request_lines enable trigger user;
alter table public.petty_cash_requests enable trigger user;
alter table public.work_budget_allocation_lines enable trigger user;
alter table public.work_budget_allocations enable trigger user;
alter table public.work_tree_events enable trigger user;
alter table public.chat_messages enable trigger user;
alter table public.subtask_submission_attachments enable trigger user;
alter table public.subtask_submissions enable trigger user;
alter table public.subtask_progress_updates enable trigger user;
alter table public.subtasks enable trigger user;
alter table public.task_comment_attachments enable trigger user;
alter table public.task_comments enable trigger user;
alter table public.task_attachments enable trigger user;
alter table public.task_submissions enable trigger user;
alter table public.task_progress_updates enable trigger user;
alter table public.task_activities enable trigger user;
alter table public.task_status_history enable trigger user;
alter table public.tasks enable trigger user;
alter table public.milestone_organizations enable trigger user;
alter table public.milestones enable trigger user;
alter table public.project_library_links enable trigger user;
alter table public.project_library_files enable trigger user;
alter table public.project_office_work enable trigger user;
alter table public.project_office_people enable trigger user;
alter table public.project_office_members enable trigger user;
alter table public.project_office_identities enable trigger user;
alter table public.project_offices enable trigger user;
alter table public.project_organizations enable trigger user;
alter table public.project_members enable trigger user;
alter table public.project_groups enable trigger user;
alter table public.project_guest_members enable trigger user;
alter table public.project_invitation_requests enable trigger user;
alter table public.project_access_grants enable trigger user;
alter table public.projects enable trigger user;
alter table public.personal_subtasks enable trigger user;
alter table public.personal_tasks enable trigger user;
alter table public.personal_project_members enable trigger user;
alter table public.personal_projects enable trigger user;
alter table eflow_budget.cash_commands enable trigger user;
alter table eflow_evidence.attempts enable trigger user;
alter table eflow_evidence.objects enable trigger user;
alter table eflow_project.funding enable trigger user;

-- -----------------------------------------------------------------------------
-- 8. Post-reset assertions
-- -----------------------------------------------------------------------------
do $verify$
declare
  v_archived_before int;
  v_archived_after int;
begin
  select count(*) into v_archived_before from _archived_projects;
  select count(*) into v_archived_after from public.projects where status = 'archived' or archived_at is not null;

  if (select count(*) from public.profiles) <> 8
  or (select count(*) from auth.users) <> 8
  or (select count(*) from public.organizations) <> 1
  or (select count(*) from public.projects where status <> 'archived' and archived_at is null) <> 0
  or v_archived_after <> v_archived_before
  then
    raise exception 'Reset verification failed (profiles=%, users=%, orgs=%, archived_before=%, archived_after=%)',
      (select count(*) from public.profiles),
      (select count(*) from auth.users),
      (select count(*) from public.organizations),
      v_archived_before,
      v_archived_after;
  end if;
end $verify$;

commit;

-- Summary readout
select jsonb_build_object(
  'profiles', (select count(*) from public.profiles),
  'auth_users', (select count(*) from auth.users),
  'offices', (select count(*) from public.organizations),
  'archived_projects_kept', (select count(*) from public.projects where status = 'archived' or archived_at is not null),
  'active_or_draft_projects', (select count(*) from public.projects where status <> 'archived' and archived_at is null),
  'tasks_kept_for_archived', (select count(*) from public.tasks),
  'subtasks_kept_for_archived', (select count(*) from public.subtasks),
  'seal_certificates_kept', (select count(*) from public.project_seal_certificates),
  'fiscal_budgets_kept', (select count(*) from public.department_fiscal_budgets),
  'petty_cash_requests_kept', (select count(*) from public.petty_cash_requests)
) as reset_result;
