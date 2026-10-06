import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../../supabase/migrations/20260822000008_department_budget_and_petty_cash.sql",
    import.meta.url,
  ),
  "utf8",
);

const enforcementSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260824000001_department_proposal_budget_enforcement.sql",
    import.meta.url,
  ),
  "utf8",
);

const ownerFundingSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260824000002_owner_department_budget_for_all_proposals.sql",
    import.meta.url,
  ),
  "utf8",
);

const employeeBudgetAccessSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260824000004_fix_employee_department_budget_access.sql",
    import.meta.url,
  ),
  "utf8",
);

const taskBudgetWorkflowSql = readFileSync(
  new URL("../../supabase/migrations/20260824000007_task_budget_daily_petty_cash_workflow.sql", import.meta.url),
  "utf8",
);

const budgetControlsSql = readFileSync(
  new URL("../../supabase/migrations/20260824000008_budget_controls_and_resubmission.sql", import.meta.url),
  "utf8",
);

const subtaskDistributionSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260825000001_subtask_budget_distribution_guard.sql",
    import.meta.url,
  ),
  "utf8",
);

const subtaskFiscalReferenceFixSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260826000001_fix_subtask_budget_allocation_fiscal_reference.sql",
    import.meta.url,
  ),
  "utf8",
);

const dynamicTaskFundingSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260826000003_dynamic_task_funding.sql",
    import.meta.url,
  ),
  "utf8",
);

const correctionHoldSql = readFileSync(
  new URL(
    "../../supabase/migrations/20260826000004_release_correction_holds_and_notify_reviewers.sql",
    import.meta.url,
  ),
  "utf8",
);

const collaborationWorkspace = readFileSync(
  new URL(
    "../../src/app/features/interdepartment-collaboration/components/CollaborationDraftWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("department budget migration", () => {
  it("hard-gates department proposal publication against a locked annual budget", () => {
    expect(sql).toContain("commit_single_department_proposal_budget");
    expect(sql).toContain("No locked % department budget exists");
    expect(sql).toContain("Insufficient department budget. Shortfall");
    expect(sql).toContain("Set a proposal budget greater than zero before publishing");
    expect(sql).toContain("revision.snapshot -> 'budget'");
    expect(sql).toContain("line ->> 'expenseClass'");
  });

  it("applies the commitment gate to manual and AI-imported department proposals", () => {
    expect(enforcementSql).toContain("commit_single_department_proposal_budget");
    expect(enforcementSql).not.toContain("new.source_type <> 'manual'");
    expect(enforcementSql).toContain("new.status <> 'committed' or old.status = 'committed'");
    expect(enforcementSql).toContain("'proposal_committed'");
    expect(collaborationWorkspace).toContain("fundingOwnerName={ownerOrg?.name}");
    expect(collaborationWorkspace).toMatch(/editable=\{\s*isOwner\s*&&\s*!\["committed",\s*"archived",\s*"deleted"\]\.includes\(draft\.status\)/);
    expect(collaborationWorkspace).not.toContain('draft.sourceType === "manual"');
  });

  it("charges the owner department for inter-department proposals and repairs prior bypasses", () => {
    expect(ownerFundingSql).not.toContain("participation_role <> 'owner'");
    expect(ownerFundingSql).toContain("where org_id = new.owner_org_id");
    expect(ownerFundingSql).toContain("Budget backfilled for previously published proposal");
    expect(ownerFundingSql).toContain("ranked.existing_commitments + ranked.backfill_running_total <= ranked.approved_amount");
    expect(ownerFundingSql).toContain("on conflict (proposal_draft_id) do nothing");
  });

  it("keeps reservations, verified expenses, and returned cash as separate ledger events", () => {
    expect(sql).toContain("'petty_cash_reserved'");
    expect(sql).toContain("'expense_posted'");
    expect(sql).toContain("'cash_returned'");
    expect(sql).toContain("You cannot approve your own request");
    expect(sql).toContain("Receipt amounts must equal the declared amount spent");
  });

  it("notifies every configured Head or Assistant Head about financial reviews", () => {
    expect(sql.match(/from public\.organization_approver_ids\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("'petty_cash_request', 'Petty-cash request awaiting approval'");
    expect(sql).toContain("'petty_cash_liquidation', 'Petty-cash receipts ready for review'");
    expect(sql).toContain("Only the Head or Assistant Head can decide this request");
  });

  it("uses the established user-first organization access signature", () => {
    expect(sql).toContain("public.can_access_org(caller_id, target_org, 'read')");
    expect(sql).not.toContain("public.can_access_org(p_org_id, auth.uid())");
  });

  it("allows active employees to read their directly assigned department budget", () => {
    expect(employeeBudgetAccessSql).toContain("profile.id = caller_id");
    expect(employeeBudgetAccessSql).toContain("profile.is_active");
    expect(employeeBudgetAccessSql).toContain("profile.org_id = target_org");
    expect(employeeBudgetAccessSql).toContain("public.is_organization_member(target_org, caller_id)");
    expect(employeeBudgetAccessSql).toContain("public.can_access_org(caller_id, target_org, 'read')");
  });

  it("creates task allocations atomically from the published task funding schedule", () => {
    expect(taskBudgetWorkflowSql).toContain("taskBudgets");
    expect(taskBudgetWorkflowSql).toContain("work_budget_allocation_lines");
    expect(taskBudgetWorkflowSql).toContain("Proposal funding total does not match its task budgets");
    expect(taskBudgetWorkflowSql).toContain("on conflict (proposal_draft_id)");
  });

  it("routes employee cash through the leader and department while using a daily release ceiling", () => {
    expect(taskBudgetWorkflowSql).toContain("pending_leader_review");
    expect(taskBudgetWorkflowSql).toContain("pending_department_approval");
    expect(taskBudgetWorkflowSql).toContain("daily_petty_cash_release_limit - used_on_day");
    expect(taskBudgetWorkflowSql).toContain("Only the Task Leader or an assigned subtask contributor");
    expect(taskBudgetWorkflowSql).toContain("override_reason");
  });

  it("adds audited adjustments, source-line subtask caps, acknowledgement, and completion guards", () => {
    expect(budgetControlsSql).toContain("department_budget_adjustments");
    expect(budgetControlsSql).toContain("parent_allocation_line_id");
    expect(budgetControlsSql).toContain("acknowledge_petty_cash_release");
    expect(budgetControlsSql).toContain("run_department_budget_maintenance");
    expect(budgetControlsSql).toContain("guard_task_financial_completion");
    expect(budgetControlsSql).toContain("Only the Task Leader can distribute task funding");
  });

  it("keeps parent-task cash and subtask distributions mutually exclusive", () => {
    expect(subtaskDistributionSql).toContain("guard_petty_cash_allocation_capacity");
    expect(subtaskDistributionSql).toContain("parent_cash_committed + new.amount > parent_allocation.amount");
    expect(subtaskDistributionSql).toContain("child_allocated := child_allocated + allocation.amount");
    expect(subtaskDistributionSql).toContain("Distributed by the Task Leader from the approved task budget");
    expect(subtaskDistributionSql).toContain("'subtask_budget_assigned'");
  });

  it("qualifies the fiscal budget used by subtask allocation ledger entries", () => {
    expect(subtaskFiscalReferenceFixSql).toContain(
      "select commitment.fiscal_budget_id into target_fiscal_budget_id",
    );
    expect(subtaskFiscalReferenceFixSql).toContain(
      "where commitment.id = parent_allocation.commitment_id",
    );
    expect(subtaskFiscalReferenceFixSql).not.toContain(
      "select fiscal_budget_id into fiscal_budget_id",
    );
  });

  it("reserves contextual cash atomically against a mandatory proposal source line", () => {
    expect(dynamicTaskFundingSql).toContain("create_contextual_cash_request");
    expect(dynamicTaskFundingSql).toContain("task_budget_line_available");
    expect(dynamicTaskFundingSql).toContain("for update");
    expect(dynamicTaskFundingSql).toContain("p_allocation_line_id uuid");
    expect(dynamicTaskFundingSql).toContain("Select a proposal budget line and fund source");
    expect(dynamicTaskFundingSql).toContain("reservation_expires_at");
    expect(dynamicTaskFundingSql).toContain("idempotency_key");
    expect(dynamicTaskFundingSql).toContain("where idempotency_key is not null");
  });

  it("keeps subtask caps optional and protects caps used by active requests", () => {
    expect(dynamicTaskFundingSql).toContain("set_subtask_budget_cap");
    expect(dynamicTaskFundingSql).toContain("remove_subtask_budget_cap");
    expect(dynamicTaskFundingSql).toContain("subtask_cap_available");
    expect(dynamicTaskFundingSql).toContain("This cap has an active cash request and cannot be edited");
    expect(dynamicTaskFundingSql).toContain("'approved'");
  });

  it("routes a Task Leader's own request directly to fiscal authorization", () => {
    expect(dynamicTaskFundingSql).toContain("caller = task_leader then 'pending_department_approval'");
    expect(dynamicTaskFundingSql).toContain("request.requester_id = request.task_leader_id then 'pending_department_approval'");
    expect(dynamicTaskFundingSql).toContain("pending_leader_review");
  });

  it("keeps funding events append-only and broadens only proven collaboration membership", () => {
    expect(dynamicTaskFundingSql).toContain("budget_ledger_append_only");
    expect(dynamicTaskFundingSql).toContain("Financial audit ledger entries are append-only");
    expect(dynamicTaskFundingSql).toContain("audit_cash_request_change");
    expect(dynamicTaskFundingSql).toContain("audit_liquidation_change");
    expect(dynamicTaskFundingSql).toContain("petty_cash_request_attachments");
    expect(dynamicTaskFundingSql).toContain("profile.org_id = target_organization");
    expect(dynamicTaskFundingSql).toContain("join public.project_members");
    expect(dynamicTaskFundingSql).toContain("task.assigned_to = caller_id");
    expect(dynamicTaskFundingSql).toContain("coalesce(subtask.assigned_to_ids");
  });

  it("releases correction-stage holds and notifies the reviewer on resubmission", () => {
    expect(correctionHoldSql).toContain("'leader_changes_requested', 'department_changes_requested'");
    expect(correctionHoldSql).toContain("then 0::numeric");
    expect(correctionHoldSql).toContain("normalize_cash_request_reservation_window");
    expect(correctionHoldSql).toContain("set reservation_expires_at = null");
    expect(correctionHoldSql).toContain("notify_corrected_cash_request_reviewer");
    expect(correctionHoldSql).toContain("Corrected cash request needs your endorsement");
    expect(correctionHoldSql).toContain("Corrected cash request needs fiscal authorization");
    expect(correctionHoldSql).toContain("petty_cash_request_correction_notification");
  });
});
