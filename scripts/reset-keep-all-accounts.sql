-- Reset operational/project/audit/budget data on hosted Supabase (ixnfphgjyelhckjwjkdv)
-- Keeps ALL existing user accounts, organizations, memberships, skills, PDS data, and system/config data intact.
-- Safe to run inside a single transaction without CASCADE.

begin;

set local lock_timeout = '15s';

create temp table _reset_baseline on commit drop as
select
  (select count(*)::int from auth.users) as auth_users,
  (select count(*)::int from public.profiles) as profiles,
  (select count(*)::int from public.organizations) as organizations,
  (select count(*)::int from public.skill_tag_definitions) as skill_tags,
  (select count(*)::int from public.custom_roles) as custom_roles,
  (select count(*)::int from public.role_permissions) as role_permissions;

-- Temporarily detach user_pds_documents FKs referencing invitation tables so TRUNCATE succeeds without CASCADE
create temp table _saved_pds_fks on commit drop as
select
  c.conname,
  pg_get_constraintdef(c.oid, true) as condef
from pg_constraint c
where c.conrelid = 'public.user_pds_documents'::regclass
  and c.contype = 'f'
  and c.confrelid in (
    'public.user_invitations'::regclass,
    'public.project_invitation_requests'::regclass
  );

do $$
declare
  r record;
begin
  for r in select conname from _saved_pds_fks loop
    execute format('alter table public.user_pds_documents drop constraint %I', r.conname);
  end loop;
end $$;

update public.user_pds_documents
set invitation_id = null,
    project_request_id = null
where invitation_id is not null
   or project_request_id is not null;

-- Wipe all operational, project, task, audit trail, budget, finance, seal, chat, invitation, and eflow_* event tables
truncate table
  public.general_journal_lines,
  public.general_journal_entries,
  public.budget_ledger_entries,
  public.department_budget_account_mappings,
  public.petty_cash_receipt_items,
  public.petty_cash_receipts,
  public.liquidation_independent_reviews,
  public.petty_cash_liquidations,
  public.petty_cash_releases,
  public.petty_cash_request_attachments,
  public.petty_cash_request_lines,
  public.petty_cash_requests,
  public.work_budget_allocation_lines,
  public.work_budget_allocations,
  public.budget_commitments,
  public.office_budget_sections,
  public.department_budget_adjustments,
  public.department_accounting_settings,
  public.department_budget_lines,
  public.fiscal_budget_purged_totals,
  public.department_fiscal_budgets,
  public.project_seal_certificates,
  public.subtask_submission_attachments,
  public.subtask_submissions,
  public.subtask_progress_updates,
  public.subtasks,
  public.task_comment_attachments,
  public.task_comments,
  public.task_attachments,
  public.task_submissions,
  public.task_progress_updates,
  public.task_activities,
  public.task_status_history,
  public.task_reminders,
  public.task_organizations,
  public.task_template_runs,
  public.tasks,
  public.milestone_organizations,
  public.milestones,
  public.project_library_links,
  public.project_library_events,
  public.project_library_files,
  public.work_tree_events,
  public.project_field_history,
  public.calls,
  public.chat_messages,
  public.chat_channel_members,
  public.chat_channels,
  public.notifications,
  public.hierarchy_deadline_reminders,
  public.announcement_recipients,
  public.announcements,
  public.server_logs,
  public.monthly_productivity_snapshots,
  public.audit_events,
  public.project_guest_members,
  public.project_guest_account_events,
  public.project_guest_accounts,
  public.project_access_grants,
  public.project_invitation_events,
  public.project_invitation_requests,
  public.managed_account_invite_details,
  public.user_invitations,
  public.project_office_people,
  public.project_office_work,
  public.project_office_members,
  public.project_office_identities,
  public.project_offices,
  public.project_organizations,
  public.project_members,
  public.project_groups,
  public.project_import_batches,
  public.project_pdf_import_sessions,
  public.project_readiness_reviews,
  public.process_mining_snapshots,
  public.office_project_homes,
  public.proposal_collaboration_commit_projects,
  public.proposal_delivery_closeout_decisions,
  public.proposal_delivery_closeouts,
  public.proposal_governance_signoffs,
  public.proposal_governance_records,
  public.proposal_governance_assignments,
  public.proposal_collaboration_approvals,
  public.proposal_collaboration_change_requests,
  public.proposal_collaboration_messages,
  public.proposal_collaboration_orgs,
  public.proposal_collaboration_revisions,
  public.proposal_collaboration_drafts,
  public.projects,
  public.personal_subtasks,
  public.personal_tasks,
  public.personal_work_events,
  public.personal_project_shortcuts,
  public.personal_project_members,
  public.personal_projects,
  public.admin_unification_profile_backup,
  public.phase1_authority_row_backup,
  public.phase2_rollback_archive,
  private.eflow_login_audit,
  eflow_activation.dispatches,
  eflow_activation.request_limits,
  eflow_budget.cash_commands,
  eflow_budget.pcv_counters,
  eflow_budget.subtask_budget_commands,
  eflow_chat.nicknames,
  eflow_chat.personal_pins,
  eflow_evidence.attempts,
  eflow_evidence.objects,
  eflow_finance_review.commands,
  eflow_finance_review.events,
  eflow_finance_review.settlement_blocker_alerts,
  eflow_finance_review.staffing_escalation_approvals,
  eflow_guests.writes,
  eflow_m7.activation,
  eflow_m7.applying_work_proposal,
  eflow_m7.deferred_assignments,
  eflow_m7.draft_scope,
  eflow_m7.work_proposals,
  eflow_office_cash.commands,
  eflow_office_cash.events,
  eflow_office_cash.settlement_alerts,
  eflow_office_cash.requests,
  eflow_office_cash.funds,
  eflow_phase6.project_deletions,
  eflow_phase65.import_receipts,
  eflow_project.commands,
  eflow_project.funding,
  eflow_project.funding_requests,
  eflow_publication.discard_requests,
  eflow_r3.backfill_exceptions,
  eflow_r3.receipts,
  eflow_r7.backfill_exceptions,
  eflow_r7.completion_locks,
  eflow_r7.member_receipts,
  eflow_r7.mutations,
  eflow_r7.receipts,
  eflow_r7.tree_state,
  eflow_r8.tokens,
  eflow_r9.events,
  eflow_r9.mutations,
  eflow_r9.receipts,
  eflow_r9.removed,
  eflow_r9.staffing_removals,
  eflow_r11.snapshots,
  eflow_retention.notice_log,
  eflow_retention.project_dispositions,
  eflow_retention.project_holds,
  eflow_retention.storage_delete_queue,
  eflow_seal.preview_edits,
  eflow_seal.transaction_attempts,
  eflow_seal.snapshots,
  eflow_work_clearance.acceptances,
  eflow_work_clearance.return_commands,
  eflow_work_clearance.return_decisions
restart identity;

-- Restore user_pds_documents FK constraints
do $$
declare
  r record;
begin
  for r in select conname, condef from _saved_pds_fks loop
    execute format('alter table public.user_pds_documents add constraint %I %s', r.conname, r.condef);
  end loop;
end $$;

-- Remove non-office workspaces while preserving office workspace(s)
delete from public.workspace_members
where workspace_id in (
  select id from public.workspaces where coalesce(kind, '') <> 'office'
);

delete from public.workspaces
where coalesce(kind, '') <> 'office';

-- Reset workload counters on preserved profiles while keeping skills, role, org_id, full_name, custom_role_key
update public.profiles
set workload = 0,
    burnout_level = 'low';

-- Post-reset integrity checks
do $$
declare
  base record;
  v_auth_users int;
  v_profiles int;
  v_orgs int;
  v_skill_tags int;
  v_custom_roles int;
  v_role_permissions int;
  v_projects int;
  v_tasks int;
  v_audit_events int;
  v_fiscal_budgets int;
begin
  select * into base from _reset_baseline;
  select count(*)::int into v_auth_users from auth.users;
  select count(*)::int into v_profiles from public.profiles;
  select count(*)::int into v_orgs from public.organizations;
  select count(*)::int into v_skill_tags from public.skill_tag_definitions;
  select count(*)::int into v_custom_roles from public.custom_roles;
  select count(*)::int into v_role_permissions from public.role_permissions;
  select count(*)::int into v_projects from public.projects;
  select count(*)::int into v_tasks from public.tasks;
  select count(*)::int into v_audit_events from public.audit_events;
  select count(*)::int into v_fiscal_budgets from public.department_fiscal_budgets;

  if v_projects <> 0 or v_tasks <> 0 or v_audit_events <> 0 or v_fiscal_budgets <> 0 then
    raise exception 'Reset verification failed: projects=%, tasks=%, audit_events=%, fiscal_budgets=%',
      v_projects, v_tasks, v_audit_events, v_fiscal_budgets;
  end if;

  if v_auth_users <> base.auth_users or v_profiles <> base.profiles or v_orgs <> base.organizations then
    raise exception 'Preserved account/org count mismatch: auth_users %->%, profiles %->%, orgs %->%',
      base.auth_users, v_auth_users, base.profiles, v_profiles, base.organizations, v_orgs;
  end if;

  if v_custom_roles <> base.custom_roles or v_role_permissions <> base.role_permissions then
    raise exception 'Preserved roles count mismatch: custom_roles %->%, role_permissions %->%',
      base.custom_roles, v_custom_roles, base.role_permissions, v_role_permissions;
  end if;

  if v_skill_tags < 11 then
    raise exception 'Skill tag definitions unexpectedly reduced: %', v_skill_tags;
  end if;
end $$;

commit;
