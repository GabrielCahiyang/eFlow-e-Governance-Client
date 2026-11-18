-- =============================================================================
-- eFlow Full Fresh Workflow & Budget Reset (Target: ixnfphgjyelhckjwjkdv)
-- Updated: 2026-11-18
--
-- PURPOSE:
--   Wipes ALL projects (including archived & tamper demo seal certificates),
--   tasks, subtasks, chats, notifications, FY 2026 fiscal budgets & sections,
--   petty cash, general journal entries, office cash funds, and eflow_* logs.
--
-- KEEPS UNTOUCHED:
--   - Core 8 LEDIPO & admin accounts (auth.users, public.profiles, login accounts)
--   - LEDIPO organization + LEDIPO office workspace
--   - Admin config, roles, custom_roles, skill_tag_definitions, templates,
--     accounting_accounts, and definition backup tables
--   - eflow_seal.wallet_lease singleton row and user_pds_documents / profiles
-- =============================================================================

begin;
set local lock_timeout = '8s';
set local statement_timeout = '90s';

lock table public.profiles, public.organizations in share row exclusive mode;

-- Safeguard: verify core 8 LEDIPO/admin accounts and LEDIPO organization
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

-- Preserve user_pds_documents while allowing TRUNCATE of user_invitations & project_invitation_requests
update public.user_pds_documents
set invitation_id = null, project_request_id = null
where invitation_id is not null or project_request_id is not null;

do $drop_pds_fk$
declare r record;
begin
  create temp table _pds_fks (conname text, condef text) on commit drop;
  for r in
    select conname, pg_get_constraintdef(oid) as condef
    from pg_constraint
    where conrelid = 'public.user_pds_documents'::regclass
      and contype = 'f'
      and confrelid in ('public.user_invitations'::regclass, 'public.project_invitation_requests'::regclass)
  loop
    insert into _pds_fks values (r.conname, r.condef);
    execute format('alter table public.user_pds_documents drop constraint %I', r.conname);
  end loop;
end $drop_pds_fk$;

-- Truncate all operational, financial, budget, seal, and workflow tables
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

do $restore_pds_fk$
declare r record;
begin
  for r in select conname, condef from _pds_fks loop
    execute format('alter table public.user_pds_documents add constraint %I %s', r.conname, r.condef);
  end loop;
end $restore_pds_fk$;

-- Clean personal workspaces while keeping LEDIPO office workspace
delete from public.workspace_members
where workspace_id in (select id from public.workspaces where kind <> 'office');
delete from public.workspaces
where kind <> 'office';

-- Ensure only the core 8 users and LEDIPO office remain, and reset workloads
delete from public.user_permission_overrides where user_id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);
delete from public.user_preferences where user_id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);
delete from public.user_onboarding where user_id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);
delete from public.employee_notes where profile_id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);
delete from auth.sessions where user_id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);
delete from public.profiles where id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);
delete from public.organizations where id <> 'fdd4dfee-bbc3-42b4-9dcf-a9612c428460';
delete from auth.users where id not in (
  '32f28c6a-8025-4a7e-abb4-c14577ff5c4b'::uuid,'8f185e3c-9602-4e3f-8b13-fac33071e6d9'::uuid,
  '309c5592-0dde-42da-9274-d588d9921404'::uuid,'923737b8-3d33-432a-a42f-9aa6e8dbad33'::uuid,
  '5918fe34-c9ce-4471-94e7-aa430b6356d6'::uuid,'044b2ba8-842a-46f6-9b37-70ea4cc706d5'::uuid,
  '4526a77a-14d0-40e8-aa1d-eab54b3afbb8'::uuid,'4a02c2d4-e4f3-49da-8ce1-8b4df53228f0'::uuid
);

update public.profiles
set workload = 0, burnout_level = 'low';

-- Verify post-reset state
do $verify$
begin
  if (select count(*) from public.profiles) <> 8
  or (select count(*) from auth.users) <> 8
  or (select count(*) from public.organizations) <> 1
  or (select count(*) from public.projects) <> 0
  or (select count(*) from public.tasks) <> 0
  or (select count(*) from public.department_fiscal_budgets) <> 0
  or (select count(*) from public.project_seal_certificates) <> 0
  then
    raise exception 'Reset verification failed';
  end if;
end $verify$;

commit;

select jsonb_build_object(
  'profiles', (select count(*) from public.profiles),
  'auth_users', (select count(*) from auth.users),
  'offices', (select count(*) from public.organizations),
  'workspaces', (select count(*) from public.workspaces),
  'projects', (select count(*) from public.projects),
  'tasks', (select count(*) from public.tasks),
  'subtasks', (select count(*) from public.subtasks),
  'fiscal_budgets', (select count(*) from public.department_fiscal_budgets),
  'budget_sections', (select count(*) from public.office_budget_sections),
  'petty_cash_requests', (select count(*) from public.petty_cash_requests),
  'seal_certificates', (select count(*) from public.project_seal_certificates),
  'seal_snapshots', (select count(*) from eflow_seal.snapshots),
  'office_cash_funds', (select count(*) from eflow_office_cash.funds)
) as reset_result;
