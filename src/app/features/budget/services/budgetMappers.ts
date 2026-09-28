import type {
  BudgetCommitment,
  DepartmentBudgetAdjustment,
  BudgetLedgerEntry,
  DepartmentBudgetLine,
  DepartmentBudgetSummary,
  PettyCashLiquidation,
  PettyCashRelease,
  PettyCashReceipt,
  PettyCashRequest,
  WorkBudgetAllocation,
  WorkBudgetAllocationLine,
} from "../types";

const number = (value: unknown) => Number(value || 0);
const millis = (value: unknown) => value ? new Date(String(value)).getTime() : undefined;

export const mapBudgetSummary = (row: Record<string, unknown>): DepartmentBudgetSummary => ({
  id: String(row.id), orgId: String(row.orgId), fiscalYear: number(row.fiscalYear),
  status: String(row.status) as DepartmentBudgetSummary["status"],
  approvedAmount: number(row.approvedAmount), committedAmount: number(row.committedAmount),
  spentAmount: number(row.spentAmount), availableAmount: number(row.availableAmount),
  commitmentRemaining: number(row.commitmentRemaining), pettyCashLimit: number(row.pettyCashLimit),
  pettyCashRequestLimit: number(row.pettyCashRequestLimit), pettyCashReserved: number(row.pettyCashReserved),
  pettyCashSpent: number(row.pettyCashSpent), pettyCashAvailable: number(row.pettyCashAvailable),
  dailyPettyCashReleaseLimit: number(row.dailyPettyCashReleaseLimit ?? row.pettyCashLimit),
  perReceiptLimit: number(row.perReceiptLimit ?? row.pettyCashRequestLimit),
  liquidationDueDays: number(row.liquidationDueDays || 15),
  allowReceiptLimitOverride: Boolean(row.allowReceiptLimitOverride),
  releasedToday: number(row.releasedToday), scheduledToday: number(row.scheduledToday),
  dailyReleaseRemaining: number(row.dailyReleaseRemaining ?? row.pettyCashAvailable),
  underutilizationThreshold: number(row.underutilizationThreshold), notes: row.notes ? String(row.notes) : undefined,
  lockedAt: millis(row.lockedAt), updatedAt: millis(row.updatedAt),
});

export const mapBudgetLine = (row: Record<string, unknown>): DepartmentBudgetLine => ({
  id: String(row.id), fiscalBudgetId: String(row.fiscal_budget_id), expenseClass: String(row.expense_class || "Other Expenses"), category: String(row.category || ""),
  particular: String(row.particular || ""), quantity: number(row.quantity || 1), unit: String(row.unit || "item"),
  unitCost: number(row.unit_cost ?? row.approved_amount), amount: number(row.approved_amount),
  fundSource: String(row.fund_source || ""), position: number(row.position),
});

export const mapCommitment = (row: Record<string, unknown>): BudgetCommitment => ({
  id: String(row.id), fiscalBudgetId: String(row.fiscal_budget_id), proposalDraftId: String(row.proposal_draft_id),
  proposalRevisionId: row.proposal_revision_id ? String(row.proposal_revision_id) : undefined,
  title: String(row.title || "Untitled proposal"), amount: number(row.amount),
  status: String(row.status) as BudgetCommitment["status"], createdAt: millis(row.created_at) || 0,
});

export const mapAllocation = (row: Record<string, unknown>): WorkBudgetAllocation => ({
  id: String(row.id), commitmentId: String(row.commitment_id), taskId: String(row.task_id),
  subtaskId: row.subtask_id ? String(row.subtask_id) : undefined, amount: number(row.amount),
  subtaskTitle: (row.subtask as { title?: string } | null)?.title,
  subtaskAssigneeIds: Array.isArray((row.subtask as { assigned_to_ids?: unknown[] } | null)?.assigned_to_ids)
    ? ((row.subtask as { assigned_to_ids?: unknown[] }).assigned_to_ids || []).map(String)
    : [],
  parentAllocationLineId: row.parent_allocation_line_id ? String(row.parent_allocation_line_id) : undefined,
  status: String(row.status) as WorkBudgetAllocation["status"], reason: String(row.reason || ""),
  requestedBy: String(row.requested_by), decidedBy: row.decided_by ? String(row.decided_by) : undefined,
  decisionReason: row.decision_reason ? String(row.decision_reason) : undefined,
  requestedAt: millis(row.requested_at) || 0, decidedAt: millis(row.decided_at),
});

export const mapAllocationLine = (row: Record<string, unknown>): WorkBudgetAllocationLine => ({
  id: String(row.id), allocationId: String(row.allocation_id),
  draftTaskKey: row.draft_task_key ? String(row.draft_task_key) : undefined,
  expenseClass: String(row.expense_class || "Other Expenses"), category: String(row.category || ""),
  particular: String(row.particular || ""), quantity: number(row.quantity || 1), unit: String(row.unit || "item"),
  unitCost: number(row.unit_cost), amount: number(row.amount), fundSource: String(row.fund_source || "Department Budget"),
  position: number(row.position),
});

export const mapRequest = (row: Record<string, unknown>): PettyCashRequest => ({
  id: String(row.id), requestNumber: number(row.request_number), fiscalBudgetId: String(row.fiscal_budget_id),
  commitmentId: String(row.commitment_id), allocationId: String(row.allocation_id),
  allocationLineId: row.allocation_line_id ? String(row.allocation_line_id) : undefined,
  orgId: String(row.org_id),
  fundingOrgId: String(row.funding_org_id || row.org_id),
  requesterOrgId: String(row.requester_org_id || row.org_id),
  taskId: String(row.task_id), subtaskId: row.subtask_id ? String(row.subtask_id) : undefined,
  requesterId: String(row.requester_id), requesterName: (row.requester as { full_name?: string } | null)?.full_name,
  taskLeaderId: row.task_leader_id ? String(row.task_leader_id) : undefined,
  cashRecipientId: row.cash_recipient_id ? String(row.cash_recipient_id) : undefined,
  taskLeaderName: (row.task_leader as { full_name?: string } | null)?.full_name,
  cashRecipientName: (row.cash_recipient as { full_name?: string } | null)?.full_name,
  taskTitle: (row.task as { title?: string } | null)?.title, subtaskTitle: (row.subtask as { title?: string } | null)?.title,
  purpose: String(row.purpose || ""), requestedAmount: number(row.requested_amount),
  neededBy: row.needed_by ? String(row.needed_by) : undefined,
  reservationExpiresAt: millis(row.reservation_expires_at),
  status: String(row.status) as PettyCashRequest["status"],
  approvedAmount: row.approved_amount == null ? undefined : number(row.approved_amount),
  approvalReason: row.approval_reason ? String(row.approval_reason) : undefined,
  leaderDecisionReason: row.leader_decision_reason ? String(row.leader_decision_reason) : undefined,
  departmentDecisionReason: row.department_decision_reason ? String(row.department_decision_reason) : undefined,
  scheduledAmount: row.scheduled_amount == null ? undefined : number(row.scheduled_amount),
  releasedAmount: row.released_amount == null ? undefined : number(row.released_amount),
  liquidationDueAt: millis(row.liquidation_due_at),
  actualSpent: row.actual_spent == null ? undefined : number(row.actual_spent),
  returnedAmount: row.returned_amount == null ? undefined : number(row.returned_amount),
  createdAt: millis(row.created_at) || 0, updatedAt: millis(row.updated_at) || 0,
});

export const mapRelease = (row: Record<string, unknown>): PettyCashRelease => ({
  id: String(row.id), requestId: String(row.request_id), orgId: String(row.org_id),
  scheduledDate: String(row.scheduled_date || ""), amount: number(row.amount),
  status: String(row.status) as PettyCashRelease["status"], recipientId: row.recipient_id ? String(row.recipient_id) : undefined,
  releasedBy: row.released_by ? String(row.released_by) : undefined, releasedAt: millis(row.released_at),
  acknowledgedBy: row.acknowledged_by ? String(row.acknowledged_by) : undefined,
  acknowledgedAt: millis(row.acknowledged_at),
  createdAt: millis(row.created_at) || 0,
  voucherNumber: row.voucher_number ? String(row.voucher_number) : undefined,
  releaseMethod: String(row.release_method || "cash") as PettyCashRelease["releaseMethod"],
  chequeNumber: row.cheque_number ? String(row.cheque_number) : undefined,
});

export const mapReceipt = (row: Record<string, unknown>): PettyCashReceipt => ({
  id: String(row.id), liquidationId: String(row.liquidation_id), vendor: String(row.vendor || ""),
  receiptNumber: row.receipt_number ? String(row.receipt_number) : undefined,
  receiptDate: String(row.receipt_date || ""), description: String(row.description || ""), amount: number(row.amount),
  fileName: String(row.file_name || "Receipt"), filePath: String(row.file_path || ""),
  mimeType: String(row.mime_type || "application/octet-stream"), fileSize: number(row.file_size),
  overrideReason: row.override_reason ? String(row.override_reason) : undefined,
});

export const mapLiquidation = (row: Record<string, unknown>, receipts: PettyCashReceipt[]): PettyCashLiquidation => ({
  id: String(row.id), requestId: String(row.request_id), version: number(row.version),
  declaredSpent: number(row.declared_spent), returnedAmount: number(row.returned_amount), note: String(row.note || ""),
  status: String(row.status) as PettyCashLiquidation["status"], submittedBy: String(row.submitted_by),
  submittedAt: millis(row.submitted_at) || 0, decisionReason: row.decision_reason ? String(row.decision_reason) : undefined,
  receipts: receipts.filter((receipt) => receipt.liquidationId === String(row.id)),
  liquidationNumber: row.liquidation_number ? String(row.liquidation_number) : undefined,
  refundReceiptNumber: row.refund_receipt_number ? String(row.refund_receipt_number) : undefined,
  refundDate: row.refund_date ? String(row.refund_date) : undefined,
});

export const mapLedger = (row: Record<string, unknown>): BudgetLedgerEntry => ({
  id: String(row.id), entryType: String(row.entry_type || ""), amount: number(row.amount),
  description: String(row.description || ""), actorId: row.actor_id ? String(row.actor_id) : undefined,
  actorRole: row.actor_role ? String(row.actor_role) : undefined,
  taskId: row.task_id ? String(row.task_id) : undefined,
  subtaskId: row.subtask_id ? String(row.subtask_id) : undefined,
  allocationLineId: row.allocation_line_id ? String(row.allocation_line_id) : undefined,
  previousState: row.previous_state ? String(row.previous_state) : undefined,
  newState: row.new_state ? String(row.new_state) : undefined,
  reason: row.reason ? String(row.reason) : undefined,
  correlationKey: row.correlation_key ? String(row.correlation_key) : undefined,
  metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {},
  createdAt: millis(row.created_at) || 0,
});

export const mapAdjustment = (row: Record<string, unknown>): DepartmentBudgetAdjustment => ({
  id: String(row.id), fiscalBudgetId: String(row.fiscal_budget_id),
  previousAmount: number(row.previous_amount), adjustedAmount: number(row.adjusted_amount),
  reason: String(row.reason || ""), supportFilePath: row.support_file_path ? String(row.support_file_path) : undefined,
  createdBy: String(row.created_by), createdAt: millis(row.created_at) || 0,
});
