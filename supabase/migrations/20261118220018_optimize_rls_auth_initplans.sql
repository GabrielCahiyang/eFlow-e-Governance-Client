SET lock_timeout = '5s';

ALTER POLICY "admin_unification_definition_read" ON "public"."admin_unification_definition_backup" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "admin_unification_permission_read" ON "public"."admin_unification_permission_backup" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "admin_unification_profile_read" ON "public"."admin_unification_profile_backup" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "recipients insert by admin" ON "public"."announcement_recipients" WITH CHECK ((EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_recipients.announcement_id) AND (a.created_by = (SELECT auth.uid())) AND (auth_role((SELECT auth.uid())) <> 'admin'::text) AND has_permission((SELECT auth.uid()), 'announcements.publish'::text)))));
ALTER POLICY "recipients read own" ON "public"."announcement_recipients" USING (((user_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_recipients.announcement_id) AND (a.created_by = (SELECT auth.uid())) AND (auth_role((SELECT auth.uid())) <> 'admin'::text))))));
ALTER POLICY "recipients update own" ON "public"."announcement_recipients" USING ((user_id = (SELECT auth.uid()))) WITH CHECK ((user_id = (SELECT auth.uid())));
ALTER POLICY "announcements readable" ON "public"."announcements" USING ((((created_by = (SELECT auth.uid())) AND (auth_role((SELECT auth.uid())) <> 'admin'::text)) OR ((status = 'published'::text) AND (EXISTS ( SELECT 1
   FROM announcement_recipients r
  WHERE ((r.announcement_id = announcements.id) AND (r.user_id = (SELECT auth.uid()))))))));
ALTER POLICY "announcements writable by publishers" ON "public"."announcements" USING (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND has_permission((SELECT auth.uid()), 'announcements.publish'::text) AND (created_by = (SELECT auth.uid())) AND can_access_org((SELECT auth.uid()), org_id, 'manage'::text))) WITH CHECK (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND has_permission((SELECT auth.uid()), 'announcements.publish'::text) AND (created_by = (SELECT auth.uid())) AND can_access_org((SELECT auth.uid()), org_id, 'manage'::text)));
ALTER POLICY "announcements_write_permission" ON "public"."announcements" USING (has_permission((SELECT auth.uid()), 'announcements.publish'::text)) WITH CHECK (has_permission((SELECT auth.uid()), 'announcements.publish'::text));
ALTER POLICY "service_role_only" ON "public"."app_config" USING (((SELECT auth.role()) = 'service_role'::text));
ALTER POLICY "audit_insert_self" ON "public"."audit_events" WITH CHECK ((actor_id = (SELECT auth.uid())));
ALTER POLICY "audit_read_permission" ON "public"."audit_events" USING (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND has_permission((SELECT auth.uid()), 'audit.read'::text)));
ALTER POLICY "audit_read_scoped" ON "public"."audit_events" USING ((((auth_role((SELECT auth.uid())) = 'admin'::text) AND (entity_type = ANY (ARRAY['profile'::text, 'profiles'::text, 'user'::text, 'organization'::text, 'organizations'::text, 'permission'::text, 'role_permission'::text, 'role_permissions'::text, 'user_permission_override'::text, 'user_permission_overrides'::text, 'system_config'::text, 'account'::text, 'org_scope_grant'::text, 'user_org_scope_grants'::text]))) OR ((auth_role((SELECT auth.uid())) <> 'admin'::text) AND ((actor_id = (SELECT auth.uid())) OR ((auth_role((SELECT auth.uid())) = 'head'::text) AND org_in_my_subtree(org_id, (SELECT auth.uid())))))));
ALTER POLICY "budget_commitments_read" ON "public"."budget_commitments" USING ((EXISTS ( SELECT 1
   FROM department_fiscal_budgets b
  WHERE ((b.id = budget_commitments.fiscal_budget_id) AND can_view_department_budget(b.org_id, (SELECT auth.uid()))))));
ALTER POLICY "budget_ledger_entries_read" ON "public"."budget_ledger_entries" USING (can_manage_department_accounting(org_id, (SELECT auth.uid())));
ALTER POLICY "calls_participants_only" ON "public"."calls" USING (((caller_id = (SELECT auth.uid())) OR (callee_id = (SELECT auth.uid()))));
ALTER POLICY "messages_member_insert" ON "public"."chat_messages" WITH CHECK (((sender_id = (SELECT auth.uid())) AND is_channel_member(channel_id, (SELECT auth.uid())) AND (pinned_at IS NULL) AND (reaction_users = '{}'::jsonb) AND ((length(btrim(content)) > 0) OR (image_path IS NOT NULL)) AND ((image_path IS NULL) OR (EXISTS ( SELECT 1
   FROM storage.objects o
  WHERE ((o.bucket_id = 'conversation-images'::text) AND (o.name = chat_messages.image_path)))))));
ALTER POLICY "messages_member_read" ON "public"."chat_messages" USING (is_channel_member(channel_id, (SELECT auth.uid())));
ALTER POLICY "department_accounting_settings_read" ON "public"."department_accounting_settings" USING ((EXISTS ( SELECT 1
   FROM department_fiscal_budgets budget
  WHERE ((budget.id = department_accounting_settings.fiscal_budget_id) AND can_manage_department_accounting(budget.org_id, (SELECT auth.uid()))))));
ALTER POLICY "department_budget_account_mappings_read" ON "public"."department_budget_account_mappings" USING ((EXISTS ( SELECT 1
   FROM (((work_budget_allocation_lines line
     JOIN work_budget_allocations allocation ON ((allocation.id = line.allocation_id)))
     JOIN budget_commitments commitment ON ((commitment.id = allocation.commitment_id)))
     JOIN department_fiscal_budgets budget ON ((budget.id = commitment.fiscal_budget_id)))
  WHERE ((line.id = department_budget_account_mappings.allocation_line_id) AND can_manage_department_accounting(budget.org_id, (SELECT auth.uid()))))));
ALTER POLICY "department_budget_adjustments_read" ON "public"."department_budget_adjustments" USING ((EXISTS ( SELECT 1
   FROM department_fiscal_budgets budget
  WHERE ((budget.id = department_budget_adjustments.fiscal_budget_id) AND can_view_department_budget(budget.org_id, (SELECT auth.uid()))))));
ALTER POLICY "department_budget_lines_read" ON "public"."department_budget_lines" USING ((EXISTS ( SELECT 1
   FROM department_fiscal_budgets b
  WHERE ((b.id = department_budget_lines.fiscal_budget_id) AND can_view_department_budget(b.org_id, (SELECT auth.uid()))))));
ALTER POLICY "department_fiscal_budgets_read" ON "public"."department_fiscal_budgets" USING (can_view_department_budget(org_id, (SELECT auth.uid())));
ALTER POLICY "notes_privileged" ON "public"."employee_notes" USING (((auth_role((SELECT auth.uid())) = 'head'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = employee_notes.profile_id) AND org_in_my_subtree(p.org_id, (SELECT auth.uid())))))));
ALTER POLICY "general_journal_entries_read" ON "public"."general_journal_entries" USING (can_manage_department_accounting(org_id, (SELECT auth.uid())));
ALTER POLICY "general_journal_lines_read" ON "public"."general_journal_lines" USING ((EXISTS ( SELECT 1
   FROM general_journal_entries entry
  WHERE ((entry.id = general_journal_lines.journal_entry_id) AND can_manage_department_accounting(entry.org_id, (SELECT auth.uid()))))));
ALTER POLICY "hierarchy_deadline_reminders_read_own" ON "public"."hierarchy_deadline_reminders" USING ((recipient_id = (SELECT auth.uid())));
ALTER POLICY "item_definition_admin_read" ON "public"."item_capability_definition_backup" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "milestone_organizations_read" ON "public"."milestone_organizations" USING ((EXISTS ( SELECT 1
   FROM milestones milestone
  WHERE ((milestone.id = milestone_organizations.milestone_id) AND can_see_project(milestone.project_id, (SELECT auth.uid()))))));
ALTER POLICY "milestones_delete" ON "public"."milestones" USING (can_manage_project(project_id, (SELECT auth.uid())));
ALTER POLICY "milestones_insert" ON "public"."milestones" WITH CHECK (can_manage_project(project_id, (SELECT auth.uid())));
ALTER POLICY "milestones_read" ON "public"."milestones" USING (can_see_project(project_id, (SELECT auth.uid())));
ALTER POLICY "milestones_update" ON "public"."milestones" USING (can_manage_project(project_id, (SELECT auth.uid()))) WITH CHECK (can_manage_project(project_id, (SELECT auth.uid())));
ALTER POLICY "monthly_productivity_read" ON "public"."monthly_productivity_snapshots" USING (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND ((user_id = (SELECT auth.uid())) OR can_access_org((SELECT auth.uid()), org_id, 'read'::text))));
ALTER POLICY "r3_office_home_read" ON "public"."office_project_homes" USING ((eflow_r3.eligible((SELECT auth.uid())) AND can_see_project(project_id, (SELECT auth.uid()))));
ALTER POLICY "organization_memberships_read" ON "public"."organization_memberships" USING (((user_id = (SELECT auth.uid())) OR is_organization_member(organization_id, (SELECT auth.uid())) OR is_organization_approver(organization_id, (SELECT auth.uid())) OR (auth_role((SELECT auth.uid())) = 'admin'::text)));
ALTER POLICY "orgs_write_super_admin" ON "public"."organizations" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::text)))));
ALTER POLICY "petty_cash_liquidations_read" ON "public"."petty_cash_liquidations" USING ((EXISTS ( SELECT 1
   FROM petty_cash_requests request
  WHERE ((request.id = petty_cash_liquidations.request_id) AND ((request.requester_id = (SELECT auth.uid())) OR (request.cash_recipient_id = (SELECT auth.uid())) OR (request.task_leader_id = (SELECT auth.uid())) OR can_manage_department_accounting(request.org_id, (SELECT auth.uid())))))));
ALTER POLICY "petty_cash_receipts_read" ON "public"."petty_cash_receipts" USING ((EXISTS ( SELECT 1
   FROM (petty_cash_liquidations liquidation
     JOIN petty_cash_requests request ON ((request.id = liquidation.request_id)))
  WHERE ((liquidation.id = petty_cash_receipts.liquidation_id) AND ((request.requester_id = (SELECT auth.uid())) OR (request.cash_recipient_id = (SELECT auth.uid())) OR (request.task_leader_id = (SELECT auth.uid())) OR can_manage_department_accounting(request.org_id, (SELECT auth.uid())))))));
ALTER POLICY "petty_cash_releases_read" ON "public"."petty_cash_releases" USING (((recipient_id = (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM petty_cash_requests request
  WHERE ((request.id = petty_cash_releases.request_id) AND ((request.requester_id = (SELECT auth.uid())) OR (request.task_leader_id = (SELECT auth.uid())) OR can_manage_department_accounting(request.org_id, (SELECT auth.uid()))))))));
ALTER POLICY "petty_cash_request_attachments_read" ON "public"."petty_cash_request_attachments" USING ((EXISTS ( SELECT 1
   FROM petty_cash_requests request
  WHERE ((request.id = petty_cash_request_attachments.request_id) AND ((request.requester_id = (SELECT auth.uid())) OR (request.cash_recipient_id = (SELECT auth.uid())) OR (request.task_leader_id = (SELECT auth.uid())) OR can_manage_department_accounting(request.org_id, (SELECT auth.uid())))))));
ALTER POLICY "petty_cash_requests_read" ON "public"."petty_cash_requests" USING (((requester_id = (SELECT auth.uid())) OR (cash_recipient_id = (SELECT auth.uid())) OR (task_leader_id = (SELECT auth.uid())) OR can_manage_department_accounting(org_id, (SELECT auth.uid()))));
ALTER POLICY "phase1_definitions_admin_read" ON "public"."phase1_authority_definition_backup" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "phase1_backup_admin_read" ON "public"."phase1_authority_row_backup" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "phase2_rollback_archive_admin_read" ON "public"."phase2_rollback_archive" USING (is_admin((SELECT auth.uid())));
ALTER POLICY "project_members_delete" ON "public"."project_members" USING (can_manage_project(project_id, (SELECT auth.uid())));
ALTER POLICY "project_members_insert" ON "public"."project_members" WITH CHECK (can_manage_project(project_id, (SELECT auth.uid())));
ALTER POLICY "project_members_read" ON "public"."project_members" USING (can_see_project(project_id, (SELECT auth.uid())));
ALTER POLICY "project_members_update" ON "public"."project_members" USING (can_manage_project(project_id, (SELECT auth.uid()))) WITH CHECK (can_manage_project(project_id, (SELECT auth.uid())));
ALTER POLICY "project_organizations_read" ON "public"."project_organizations" USING (can_see_project(project_id, (SELECT auth.uid())));
ALTER POLICY "project_task_templates_head" ON "public"."project_task_templates" USING (( SELECT (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = (SELECT auth.uid())) AND phase2_is_office_head(p.id, p.org_id)))) AS "exists")) WITH CHECK (( SELECT (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = (SELECT auth.uid())) AND phase2_is_office_head(p.id, p.org_id)))) AS "exists"));
ALTER POLICY "collaboration_approvals_read" ON "public"."proposal_collaboration_approvals" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "collaboration_changes_read" ON "public"."proposal_collaboration_change_requests" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "collaboration_commit_projects_read" ON "public"."proposal_collaboration_commit_projects" USING ((is_collaboration_participant(draft_id, (SELECT auth.uid())) OR can_see_project(project_id, (SELECT auth.uid()))));
ALTER POLICY "collaboration_drafts_read" ON "public"."proposal_collaboration_drafts" USING (is_collaboration_participant(id, (SELECT auth.uid())));
ALTER POLICY "collaboration_messages_read" ON "public"."proposal_collaboration_messages" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "collaboration_orgs_read" ON "public"."proposal_collaboration_orgs" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "collaboration_revisions_read" ON "public"."proposal_collaboration_revisions" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "proposal_delivery_closeout_decisions_read" ON "public"."proposal_delivery_closeout_decisions" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "proposal_delivery_closeouts_read" ON "public"."proposal_delivery_closeouts" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "proposal_governance_assignments_read" ON "public"."proposal_governance_assignments" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "proposal_governance_records_read" ON "public"."proposal_governance_records" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "proposal_governance_signoffs_read" ON "public"."proposal_governance_signoffs" USING (is_collaboration_participant(draft_id, (SELECT auth.uid())));
ALTER POLICY "role perms writable by admin" ON "public"."role_permissions" USING (is_super_admin((SELECT auth.uid()))) WITH CHECK (is_super_admin((SELECT auth.uid())));
ALTER POLICY "service_role_only" ON "public"."server_logs" USING (((SELECT auth.role()) = 'service_role'::text));
ALTER POLICY "subtask_progress_read" ON "public"."subtask_progress_updates" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "subtask_submission_attachments_read" ON "public"."subtask_submission_attachments" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "subtask_submissions_read" ON "public"."subtask_submissions" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "subtask_template_items_read" ON "public"."subtask_template_items" USING ((EXISTS ( SELECT 1
   FROM subtask_templates template
  WHERE ((template.id = subtask_template_items.template_id) AND ((template.owner_id = (SELECT auth.uid())) OR ((template.visibility = 'department'::text) AND can_approve_work_templates(template.org_id, (SELECT auth.uid()))) OR ((template.visibility = 'department'::text) AND (template.approval_status = 'approved'::text) AND (EXISTS ( SELECT 1
           FROM profiles p
          WHERE ((p.id = (SELECT auth.uid())) AND p.is_active AND (p.org_id = template.org_id))))))))));
ALTER POLICY "subtask_templates_delete" ON "public"."subtask_templates" USING (((owner_id = (SELECT auth.uid())) OR ((visibility = 'department'::text) AND can_approve_work_templates(org_id, (SELECT auth.uid())))));
ALTER POLICY "subtask_templates_insert" ON "public"."subtask_templates" WITH CHECK (((owner_id = (SELECT auth.uid())) AND can_use_work_templates(org_id, (SELECT auth.uid()))));
ALTER POLICY "subtask_templates_read" ON "public"."subtask_templates" USING (((owner_id = (SELECT auth.uid())) OR ((visibility = 'department'::text) AND can_approve_work_templates(org_id, (SELECT auth.uid()))) OR ((visibility = 'department'::text) AND (approval_status = 'approved'::text) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (SELECT auth.uid())) AND p.is_active AND (p.org_id = p.org_id)))))));
ALTER POLICY "subtask_templates_update" ON "public"."subtask_templates" USING (((owner_id = (SELECT auth.uid())) OR ((visibility = 'department'::text) AND can_approve_work_templates(org_id, (SELECT auth.uid()))))) WITH CHECK (((owner_id = (SELECT auth.uid())) OR ((visibility = 'department'::text) AND can_approve_work_templates(org_id, (SELECT auth.uid())))));
ALTER POLICY "config_super_admin" ON "public"."system_config" USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (SELECT auth.uid())) AND (profiles.role = 'admin'::text)))));
ALTER POLICY "system_config_write_permission" ON "public"."system_config" USING (has_permission((SELECT auth.uid()), 'settings.manage'::text)) WITH CHECK (has_permission((SELECT auth.uid()), 'settings.manage'::text));
ALTER POLICY "task_activities_read" ON "public"."task_activities" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "task_attachments_delete" ON "public"."task_attachments" USING (((uploaded_by = (SELECT auth.uid())) OR can_manage_task(task_id, (SELECT auth.uid()))));
ALTER POLICY "task_attachments_insert" ON "public"."task_attachments" WITH CHECK ((can_contribute_task(task_id, (SELECT auth.uid())) AND (uploaded_by = (SELECT auth.uid()))));
ALTER POLICY "task_attachments_read" ON "public"."task_attachments" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "comments insert self" ON "public"."task_comments" WITH CHECK ((author_id = (SELECT auth.uid())));
ALTER POLICY "comments update author or moderator" ON "public"."task_comments" USING (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND ((author_id = (SELECT auth.uid())) OR ((auth_role((SELECT auth.uid())) = 'head'::text) AND can_see_task(task_id, (SELECT auth.uid())))))) WITH CHECK (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND ((author_id = (SELECT auth.uid())) OR ((auth_role((SELECT auth.uid())) = 'head'::text) AND can_see_task(task_id, (SELECT auth.uid()))))));
ALTER POLICY "task_organizations_read" ON "public"."task_organizations" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "task_progress_read" ON "public"."task_progress_updates" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "task_reminders_read_own" ON "public"."task_reminders" USING ((recipient_id = (SELECT auth.uid())));
ALTER POLICY "task_history_read" ON "public"."task_status_history" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "task_submissions_read" ON "public"."task_submissions" USING (can_see_task(task_id, (SELECT auth.uid())));
ALTER POLICY "task_template_runs_read" ON "public"."task_template_runs" USING (((auth_role((SELECT auth.uid())) <> 'admin'::text) AND (EXISTS ( SELECT 1
   FROM task_templates t
  WHERE ((t.id = task_template_runs.template_id) AND ((t.created_by = (SELECT auth.uid())) OR can_access_org((SELECT auth.uid()), t.org_id, 'read'::text)))))));
ALTER POLICY "task_templates_delete" ON "public"."task_templates" USING (((created_by = (SELECT auth.uid())) OR can_approve_work_templates(org_id, (SELECT auth.uid()))));
ALTER POLICY "task_templates_insert" ON "public"."task_templates" WITH CHECK (((created_by = (SELECT auth.uid())) AND can_use_work_templates(org_id, (SELECT auth.uid()))));
ALTER POLICY "task_templates_read" ON "public"."task_templates" USING (((created_by = (SELECT auth.uid())) OR can_approve_work_templates(org_id, (SELECT auth.uid()))));
ALTER POLICY "task_templates_update" ON "public"."task_templates" USING (((created_by = (SELECT auth.uid())) OR can_approve_work_templates(org_id, (SELECT auth.uid())))) WITH CHECK (((created_by = (SELECT auth.uid())) OR can_approve_work_templates(org_id, (SELECT auth.uid()))));
ALTER POLICY "invitations_office_read" ON "public"."user_invitations" USING ((phase2_is_office_head((SELECT auth.uid()), office_id) OR is_admin((SELECT auth.uid()))));
ALTER POLICY "managed_activation_private" ON "public"."user_invitations" USING (((invitation_type <> 'managed_account'::text) OR is_admin((SELECT auth.uid()))));
ALTER POLICY "onboarding_own_read" ON "public"."user_onboarding" USING ((user_id = (SELECT auth.uid())));
ALTER POLICY "user_org_scope_grants_manage" ON "public"."user_org_scope_grants" USING (is_super_admin((SELECT auth.uid()))) WITH CHECK ((is_super_admin((SELECT auth.uid())) AND (granted_by = (SELECT auth.uid())) AND (user_id <> (SELECT auth.uid()))));
ALTER POLICY "user_org_scope_grants_read" ON "public"."user_org_scope_grants" USING (((user_id = (SELECT auth.uid())) OR is_super_admin((SELECT auth.uid()))));
ALTER POLICY "overrides readable self or admin" ON "public"."user_permission_overrides" USING (((user_id = (SELECT auth.uid())) OR is_super_admin((SELECT auth.uid()))));
ALTER POLICY "overrides writable by admin" ON "public"."user_permission_overrides" USING (is_super_admin((SELECT auth.uid()))) WITH CHECK (is_super_admin((SELECT auth.uid())));
ALTER POLICY "users insert own preferences" ON "public"."user_preferences" WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "users read own preferences" ON "public"."user_preferences" USING (((SELECT auth.uid()) = user_id));
ALTER POLICY "users update own preferences" ON "public"."user_preferences" USING (((SELECT auth.uid()) = user_id)) WITH CHECK (((SELECT auth.uid()) = user_id));
ALTER POLICY "professional_profile_read" ON "public"."user_professional_profiles" USING (((user_id = (SELECT auth.uid())) OR (confirmed_by_user AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = user_professional_profiles.user_id) AND p.is_active AND phase2_is_office_head((SELECT auth.uid()), p.org_id)))))));
ALTER POLICY "work_budget_allocation_lines_read" ON "public"."work_budget_allocation_lines" USING ((EXISTS ( SELECT 1
   FROM ((work_budget_allocations allocation
     JOIN budget_commitments commitment ON ((commitment.id = allocation.commitment_id)))
     JOIN department_fiscal_budgets budget ON ((budget.id = commitment.fiscal_budget_id)))
  WHERE ((allocation.id = work_budget_allocation_lines.allocation_id) AND (can_see_task(allocation.task_id, (SELECT auth.uid())) OR can_manage_department_accounting(budget.org_id, (SELECT auth.uid())))))));
ALTER POLICY "work_budget_allocations_read" ON "public"."work_budget_allocations" USING ((can_see_task(task_id, (SELECT auth.uid())) OR (EXISTS ( SELECT 1
   FROM (budget_commitments commitment
     JOIN department_fiscal_budgets budget ON ((budget.id = commitment.fiscal_budget_id)))
  WHERE ((commitment.id = work_budget_allocations.commitment_id) AND can_manage_department_accounting(budget.org_id, (SELECT auth.uid())))))));
ALTER POLICY "work_status_insert" ON "public"."work_status_definitions" WITH CHECK ((( SELECT auth_role((SELECT auth.uid())) AS auth_role) = 'admin'::text));
ALTER POLICY "work_status_read" ON "public"."work_status_definitions" USING ((( SELECT auth_role((SELECT auth.uid())) AS auth_role) IS NOT NULL));
ALTER POLICY "work_status_update" ON "public"."work_status_definitions" USING ((( SELECT auth_role((SELECT auth.uid())) AS auth_role) = 'admin'::text)) WITH CHECK ((( SELECT auth_role((SELECT auth.uid())) AS auth_role) = 'admin'::text));
ALTER POLICY "r3_workspace_member_read" ON "public"."workspace_members" USING ((eflow_r3.workspace_access(workspace_id) AND ((user_id = (SELECT auth.uid())) OR eflow_r3.personal_owner(workspace_id))));

RESET lock_timeout;
