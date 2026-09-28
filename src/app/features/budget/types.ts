export type FiscalBudgetStatus = "draft" | "locked" | "closed";
export type AllocationStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TaskBudgetDecision = "missing" | "funded" | "no_cost";
export type PettyCashStatus =
  | "draft"
  | "pending"
  | "pending_leader_review"
  | "leader_changes_requested"
  | "pending_department_approval"
  | "department_changes_requested"
  | "approved"
  | "scheduled_for_release"
  | "partially_released"
  | "released"
  | "rejected"
  | "cancelled"
  | "expired"
  | "liquidation_draft"
  | "liquidation_submitted"
  | "pending_leader_liquidation_review"
  | "pending_department_settlement"
  | "changes_requested"
  | "overdue_liquidation"
  | "settled";

export interface BudgetLineInput {
  id: string;
  draftTaskKey?: string;
  expenseClass: string;
  category: string;
  particular: string;
  quantity?: number;
  unit?: string;
  unitCost?: number;
  amount: number;
  fundSource: string;
  position: number;
}

export interface ProposalTaskBudget {
  taskKey: string;
  taskTitle: string;
  decision: TaskBudgetDecision;
  noCostReason?: string;
  totalAmount: number;
  lines: BudgetLineInput[];
}

export interface ProposalBudgetDraft {
  fiscalYear: number;
  totalAmount: number;
  lines: BudgetLineInput[];
  taskBudgets?: ProposalTaskBudget[];
}

export interface ProposalBudgetCategoryGroup {
  id: string;
  category: string;
  fundSource: string;
  amount: number;
  particulars: BudgetLineInput[];
}

export interface ProposalBudgetExpenseGroup {
  id: string;
  expenseClass: string;
  amount: number;
  categories: ProposalBudgetCategoryGroup[];
}

export interface DepartmentBudgetSummary {
  id: string;
  orgId: string;
  fiscalYear: number;
  status: FiscalBudgetStatus;
  approvedAmount: number;
  committedAmount: number;
  spentAmount: number;
  availableAmount: number;
  commitmentRemaining: number;
  dailyPettyCashReleaseLimit: number;
  perReceiptLimit: number;
  liquidationDueDays: number;
  allowReceiptLimitOverride: boolean;
  releasedToday: number;
  scheduledToday: number;
  dailyReleaseRemaining: number;
  pettyCashLimit: number;
  pettyCashRequestLimit: number;
  pettyCashReserved: number;
  pettyCashSpent: number;
  pettyCashAvailable: number;
  underutilizationThreshold: number;
  notes?: string;
  lockedAt?: number;
  updatedAt?: number;
}

export interface DepartmentBudgetLine extends BudgetLineInput {
  fiscalBudgetId: string;
}

export interface BudgetCommitment {
  id: string;
  fiscalBudgetId: string;
  proposalDraftId: string;
  proposalRevisionId?: string;
  title: string;
  amount: number;
  status: "active" | "released" | "closed";
  createdAt: number;
}

export interface WorkBudgetAllocation {
  id: string;
  commitmentId: string;
  taskId: string;
  subtaskId?: string;
  subtaskTitle?: string;
  subtaskAssigneeIds?: string[];
  parentAllocationLineId?: string;
  amount: number;
  status: AllocationStatus;
  reason: string;
  requestedBy: string;
  decidedBy?: string;
  decisionReason?: string;
  requestedAt: number;
  decidedAt?: number;
}

export interface WorkBudgetAllocationLine extends BudgetLineInput {
  allocationId: string;
}

export interface PettyCashRequest {
  id: string;
  requestNumber: number;
  fiscalBudgetId: string;
  commitmentId: string;
  allocationId: string;
  allocationLineId?: string;
  orgId: string;
  fundingOrgId: string;
  requesterOrgId: string;
  taskId: string;
  subtaskId?: string;
  requesterId: string;
  taskLeaderId?: string;
  cashRecipientId?: string;
  requesterName?: string;
  taskLeaderName?: string;
  cashRecipientName?: string;
  taskTitle?: string;
  subtaskTitle?: string;
  purpose: string;
  requestedAmount: number;
  neededBy?: string;
  reservationExpiresAt?: number;
  status: PettyCashStatus;
  approvedAmount?: number;
  approvalReason?: string;
  leaderDecisionReason?: string;
  departmentDecisionReason?: string;
  scheduledAmount?: number;
  releasedAmount?: number;
  liquidationDueAt?: number;
  actualSpent?: number;
  returnedAmount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PettyCashRelease {
  id: string;
  requestId: string;
  orgId: string;
  scheduledDate: string;
  amount: number;
  status: "scheduled" | "released" | "cancelled";
  recipientId?: string;
  releasedBy?: string;
  releasedAt?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  createdAt: number;
  voucherNumber?: string;
  releaseMethod?: "cash" | "cheque";
  chequeNumber?: string;
}

export interface PettyCashReceipt {
  id: string;
  liquidationId: string;
  vendor: string;
  receiptNumber?: string;
  receiptDate: string;
  description: string;
  amount: number;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  overrideReason?: string;
}

export interface CashRequestAttachment {
  id: string;
  requestId: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  createdAt: number;
}

export interface DepartmentBudgetAdjustment {
  id: string;
  fiscalBudgetId: string;
  previousAmount: number;
  adjustedAmount: number;
  reason: string;
  supportFilePath?: string;
  createdBy: string;
  createdAt: number;
}

export interface PettyCashLiquidation {
  id: string;
  requestId: string;
  version: number;
  declaredSpent: number;
  returnedAmount: number;
  note: string;
  status: "pending" | "pending_leader_review" | "pending_department_settlement" | "approved" | "changes_requested";
  submittedBy: string;
  submittedAt: number;
  decisionReason?: string;
  receipts: PettyCashReceipt[];
  liquidationNumber?: string;
  refundReceiptNumber?: string;
  refundDate?: string;
}

export interface AccountingAccount {
  code: string;
  title: string;
  classification: "asset" | "liability" | "equity" | "income" | "expense";
  normalBalance: "debit" | "credit";
}

export interface GeneralJournalLine {
  id: string;
  lineNumber: number;
  accountCode: string;
  accountTitle: string;
  debit: number;
  credit: number;
}

export interface GeneralJournalEntry {
  id: string;
  entryNumber: number;
  fiscalBudgetId: string;
  orgId: string;
  entryDate: string;
  referenceNumber: string;
  sourceType: "cash_release" | "liquidation" | "manual_adjustment";
  sourceId?: string;
  memo: string;
  postedBy?: string;
  postedByName?: string;
  postedAt: number;
  lines: GeneralJournalLine[];
}

export interface JournalAdjustmentLineInput {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface BudgetLedgerEntry {
  id: string;
  entryType: string;
  amount: number;
  description: string;
  actorId?: string;
  actorRole?: string;
  taskId?: string;
  subtaskId?: string;
  allocationLineId?: string;
  previousState?: string;
  newState?: string;
  reason?: string;
  correlationKey?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface TaskFundingLine {
  id: string;
  expenseClass: string;
  category: string;
  particular: string;
  fundSource: string;
  amount: number;
  available: number;
}

export interface SubtaskFundingCap {
  id: string;
  amount: number;
  available: number;
  allocationLineId: string;
  reason: string;
}

export interface TaskFundingContext {
  funded: boolean;
  taskId: string;
  subtaskId?: string;
  taskAllocationId?: string;
  taskBudget: number;
  available: number;
  taskLeaderId?: string;
  cap?: SubtaskFundingCap;
  lines: TaskFundingLine[];
}

export interface DepartmentBudgetBundle {
  summary: DepartmentBudgetSummary | null;
  lines: DepartmentBudgetLine[];
  commitments: BudgetCommitment[];
  allocations: WorkBudgetAllocation[];
  allocationLines: WorkBudgetAllocationLine[];
  requests: PettyCashRequest[];
  requestAttachments: CashRequestAttachment[];
  releases: PettyCashRelease[];
  liquidations: PettyCashLiquidation[];
  ledger: BudgetLedgerEntry[];
  adjustments: DepartmentBudgetAdjustment[];
  schemaWarnings?: string[];
}

export interface ReceiptDraft {
  id: string;
  vendor: string;
  receiptNumber: string;
  receiptDate: string;
  description: string;
  amount: number;
  overrideReason?: string;
  file?: File;
}

export interface CashReviewFocus {
  recordId: string;
  orgId: string;
  fiscalYear: number;
}

export interface TaskCashBlocker {
  request: PettyCashRequest;
  fiscalYear?: number;
  sourceLabel?: string;
  stage: string;
  owner: string;
  nextStep: string;
  location: string;
  reviewTarget?: { recordId: string; role: "leader" | "department" };
  liquidation?: PettyCashLiquidation;
}
