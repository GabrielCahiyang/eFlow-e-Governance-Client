-- =============================================================================
-- eFlow Factory-Fresh Reset (Admin-Only + System Data)
-- Target: ixnfphgjyelhckjwjkdv
-- Created: 2026-11-19
--
-- PURPOSE:
--   Wipes EVERYTHING — all projects, tasks, subtasks, budgets, petty cash,
--   journal entries, seals, chats, notifications, organizations, workspaces,
--   invitations, logs, and ALL user accounts EXCEPT:
--     1. admin@gmail.com (32f28c6a-8025-4a7e-abb4-c14577ff5c4b)
--     2. System configuration & definitions:
--        - public.system_config, public.app_config
--        - public.role_permissions, public.custom_roles
--        - public.skill_tag_definitions, public.work_status_definitions
--        - public.project_task_templates, public.accounting_accounts
--        - public.*_definition_backup tables
--        - private.eflow_login_settings, eflow_seal.wallet_lease
--
-- USAGE:
--   Run in Supabase SQL Editor on project ixnfphgjyelhckjwjkdv.
--   Change COMMIT; at the bottom to ROLLBACK; if you want to dry-run first.
-- =============================================================================

begin;
set local lock_timeout = '15s';
set local statement_timeout = '90s';

-- -----------------------------------------------------------------------------
-- 0. Safeguard: verify admin@gmail.com exists with the expected UUID and role
-- -----------------------------------------------------------------------------
do $safeguard$
begin
  if not exists (
    select 1
    from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid
      and lower(u.email) = 'admin@gmail.com'
      and p.role = 'admin'
  ) then
    raise exception 'admin@gmail.com (32f28c6a-8025-4a7e-abb4-c14577ff5c4b) not found or not admin; reset canceled';
  end if;
end $safeguard$;

-- -----------------------------------------------------------------------------
-- 1. Truncate all operational, project, budget, seal, org, workspace, PDS,
--    and user-template tables
-- -----------------------------------------------------------------------------
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
  public.task_templates,
  public.subtask_template_items,
  public.subtask_templates,
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
  public.user_pds_documents,
  public.user_professional_profiles,
  public.employee_notes,
  public.user_org_scope_grants,
  public.organization_memberships,
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
  public.workspace_members,
  public.workspaces,
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
  eflow_seal.preview_edits,
  eflow_seal.transaction_attempts,
  eflow_seal.snapshots,
  eflow_work_clearance.acceptances,
  eflow_work_clearance.return_commands,
  eflow_work_clearance.return_decisions
restart identity;

-- -----------------------------------------------------------------------------
-- 2. Wipe all user accounts & sessions EXCEPT admin@gmail.com
--    and wipe all organizations cleanly
-- -----------------------------------------------------------------------------
lock table auth.users, public.profiles, public.organizations in share row exclusive mode;

alter table public.profiles disable trigger user;
alter table public.organizations disable trigger user;

delete from public.user_permission_overrides
where user_id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

delete from public.user_preferences
where user_id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

delete from public.user_onboarding
where user_id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

delete from private.eflow_login_accounts
where user_id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

-- Remove auth sessions for deleted users (and optional: clear admin sessions too)
delete from auth.sessions
where user_id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

delete from public.profiles
where id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

update public.profiles
set org_id = null,
    workload = 0,
    burnout_level = 'low',
    is_active = true
where id = '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

-- Clear all organizations (remove these two statements if you want to keep org rows)
update public.organizations
set parent_id = null, head_user_id = null, assistant_head_user_id = null;
delete from public.organizations;

-- Delete all non-admin auth.users (cascades identities, mfa_factors, etc.)
delete from auth.users
where id <> '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid;

alter table public.organizations enable trigger user;
alter table public.profiles enable trigger user;

-- -----------------------------------------------------------------------------
-- 3. Post-reset assertions
-- -----------------------------------------------------------------------------
do $verify$
begin
  if (select count(*) from auth.users) <> 1
  or (select count(*) from public.profiles) <> 1
  or not exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id
    where u.id = '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid
      and lower(u.email) = 'admin@gmail.com'
      and p.role = 'admin'
  )
  or (select count(*) from public.organizations) <> 0
  or (select count(*) from public.projects) <> 0
  or (select count(*) from public.tasks) <> 0
  or (select count(*) from public.system_config) = 0
  or (select count(*) from public.role_permissions) = 0
  then
    raise exception 'Reset verification failed (users=%, profiles=%, orgs=%)',
      (select count(*) from auth.users),
      (select count(*) from public.profiles),
      (select count(*) from public.organizations);
  end if;
end $verify$;

commit;

-- Summary readout
select jsonb_build_object(
  'auth_users', (select count(*) from auth.users),
  'profiles', (select count(*) from public.profiles),
  'remaining_email', (select email from auth.users limit 1),
  'organizations', (select count(*) from public.organizations),
  'workspaces', (select count(*) from public.workspaces),
  'projects', (select count(*) from public.projects),
  'tasks', (select count(*) from public.tasks),
  'fiscal_budgets', (select count(*) from public.department_fiscal_budgets),
  'system_config', (select count(*) from public.system_config),
  'role_permissions', (select count(*) from public.role_permissions),
  'skill_tags', (select count(*) from public.skill_tag_definitions),
  'project_task_templates', (select count(*) from public.project_task_templates)
) as reset_result;
