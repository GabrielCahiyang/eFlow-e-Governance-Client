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
  budgetPartitionId?: string;
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
  heldAmount?: number;
  budgetReleasedAmount?: number;
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

export interface BudgetSection {
  id: string;
  parentId?: string;
  name: string;
  accountCode?: string;
  journalAccountCode?: string;
  amount: number;
  heldAmount: number;
  position: number;
  retired?: boolean;
  committedAmount?: number;
  spentAmount?: number;
  protectedAmount?: number;
  reservations?: BudgetReservation[];
  releaseSchedule?: BudgetScheduledRelease[];
}

export interface BudgetScheduledRelease {
  id: string;
  date: string;
  amount: number;
  status: 'pending' | 'confirmed';
  confirmedAt?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  automatic?: boolean;
  reference?: string;
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
  pcvNumber?: number;
  pcvLegacy?: boolean;
  pcvDate?: string;
  fundingLines?: CashFundingLine[];
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
  requesterIsAccountingStaff?: boolean;
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
  items?: ReceiptItem[];
}

export interface CashFundingLine { allocationLineId: string; amount: number; sourceName?: string }
export interface ReceiptItem {
  id: string; allocationLineId: string; quantity: number; unit: string;
  particular: string; amount: number; purpose: string; accountName?: string; accountLabel?: string;
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
  leaderDecidedBy?: string;
  leaderDecidedAt?: number;
  departmentDecidedBy?: string;
  departmentDecidedAt?: number;
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

export type WorkCashSourceKind = "task_cash_release" | "office_petty_cash";

export interface TaskCashReleaseFundingLine extends CashFundingLine {
  allocatedAmount?: number;
  unrequestedAmount?: number;
  assignedToTask?: number;
  assignedToSubtasks?: number;
  unassignedAmount?: number;
  recordedReceiptsTotal?: number;
}

export interface TaskCashReleasePool {
  requestId: string;
  requestNumber: number;
  purpose: string;
  status: string;
  sourceLabels: string[];
  fundingLines: TaskCashReleaseFundingLine[];
  releasedAmount: number;
  assignedToTask: number;
  assignedToSubtasks: number;
  unassignedAmount: number;
  recordedReceiptsTotal: number;
  liquidationDueAt?: string | null;
  holderId?: string;
  holderName: string;
  isCurrentHolder: boolean;
  acknowledged: boolean;
}

export interface OfficePettyCashReleasePool {
  officeCashRequestId: string;
  purpose: string;
  releasedAmount: number;
  assignedHere: number;
  assignedElsewhere: number;
  unassignedAmount: number;
  recordedReceiptsTotal: number;
  liquidationDueAt?: string | null;
  holderId?: string;
  holderName: string;
  isCurrentHolder: boolean;
}

export interface WorkCashAssignmentReceipt {
  id: string;
  assignmentId: string;
  taskId?: string;
  subtaskId?: string | null;
  subtaskTitle?: string | null;
  vendor: string;
  receiptNumber: string;
  receiptDate: string;
  description: string;
  amount: number;
  items: ReceiptItem[];
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  uploadedByName: string;
  createdAt?: string;
  canDelete?: boolean;
  receiptReviewStatus?: AssignmentReceiptReviewStatus;
  locked?: boolean;
  accountingDecidedAt?: string | null;
  accountingDecidedByName?: string;
}

export type AssignmentReceiptReviewStatus =
  | "open"
  | "pending_accounting"
  | "approved"
  | "changes_requested";

export interface WorkCashAssignment {
  id: string;
  sourceKind: WorkCashSourceKind;
  sourceRequestId: string;
  allocationLineId?: string | null;
  sourceLabel: string;
  sourceOrgId?: string;
  fundingLines: CashFundingLine[];
  taskId: string;
  subtaskId?: string | null;
  subtaskTitle?: string | null;
  amount: number;
  recordedSpent: number;
  unspentAmount: number;
  status: "active" | "recalled" | "settled";
  receiptReviewStatus?: AssignmentReceiptReviewStatus;
  returnedToPoolAmount?: number;
  accountingDecisionReason?: string | null;
  receiptSubmittedAt?: string | null;
  note: string;
  assignedBy: string;
  assignedByName: string;
  canLogReceipt: boolean;
  canRecall: boolean;
  receipts: WorkCashAssignmentReceipt[];
}

export interface PendingAssignmentReceiptReview {
  assignmentId: string;
  orgId: string;
  taskId: string;
  taskTitle: string;
  subtaskId?: string | null;
  subtaskTitle?: string | null;
  sourceKind: WorkCashSourceKind;
  sourceLabel: string;
  amount: number;
  returnedToPoolAmount: number;
  submittedAt?: string | null;
  submittedBy?: string | null;
  submittedByName: string;
  submissionNote: string;
  workAccepted: boolean;
  canDecide: boolean;
  receipts: Array<{
    id: string;
    vendor: string;
    receiptNumber: string;
    receiptDate: string;
    description: string;
    amount: number;
    fileName: string;
    filePath: string;
    mimeType: string;
    uploadedByName: string;
  }>;
}

export interface TaskCashPoolsSummary {
  cashOnHandTask: number;
  cashOnHandAssigned: number;
  cashOnHandUnassigned: number;
  officePettyCashOnHand: number;
  officePettyCashAssigned: number;
  subtaskTaskCashAssigned: number;
  subtaskOfficePettyCashAssigned: number;
  unrequestedBudget: number;
}

export interface TaskCashPools {
  canAssignCash: boolean;
  completionSubmitted?: boolean;
  taskCashReleases: TaskCashReleasePool[];
  officePettyCashReleases: OfficePettyCashReleasePool[];
  assignments: WorkCashAssignment[];
  totals: TaskCashPoolsSummary;
}

export interface TaskFundingContext {
  funded: boolean;
  supportsItemizedCash?: boolean;
  fiscalYear?: number;
  fundingOrgId?: string;
  taskId: string;
  subtaskId?: string;
  taskAllocationId?: string;
  taskBudget: number;
  available: number;
  taskLeaderId?: string;
  cap?: SubtaskFundingCap;
  subtaskBudgetBlocked?: boolean;
  lines: TaskFundingLine[];
  distribution?: SubtaskBudgetDistribution;
  canManageDistribution?: boolean;
  subtaskBudgets?: SubtaskBudgetRow[];
  parentSources?: { id: string; name: string; available: number }[];
  cashPools?: TaskCashPools;
}

export interface SubtaskBudgetDistribution {
  allocated: number;
  unallocated: number;
  available: number;
  released: number;
  spent: number;
}

export interface SubtaskBudgetRow {
  id: string;
  title: string;
  capId?: string;
  sourceId?: string;
  amount: number;
  returnable: number;
  reason?: string;
  finished: boolean;
  hasHistory: boolean;
  blocked: boolean;
}

export interface SubtaskAllocationContext {
  canAllocate: boolean;
  reason?: string;
  lines: { id: string; name: string; available: number }[];
}

export interface DepartmentBudgetBundle {
  budgetVersions?: OfficeBudgetVersion[];
  canAdjustBudget?: boolean;
  readjustmentBlockedByProjects?: boolean;
  releaseScheduleAvailable?: boolean;
  summary: DepartmentBudgetSummary | null;
  sections?: BudgetSection[];
  sectionsAvailable?: boolean;
  itemizedCashAvailable?: boolean;
  sectionsVersion?: number;
  lines: DepartmentBudgetLine[];
  commitments: BudgetCommitment[];
  allocations: WorkBudgetAllocation[];
  allocationLines: WorkBudgetAllocationLine[];
  requests: PettyCashRequest[];
  requestAttachments: CashRequestAttachment[];
  releases: PettyCashRelease[];
  liquidations: PettyCashLiquidation[];
  ledger: BudgetLedgerEntry[];
  ledgerCount?: number;
  adjustments: DepartmentBudgetAdjustment[];
  schemaWarnings?: string[];
}

export interface BudgetReservation {id:string;name:string;amount:number}
export interface BudgetProtection {kind:'budget_account_protected';account:string;entered:number;minimum:number;sources:BudgetReservation[]}
export interface BudgetAccountSnapshot {releaseSchedule?:BudgetScheduledRelease[];id:string;name:string;parentId?:string|null;accountCode?:string|null;amount:number;heldAmount:number;position:number}
export interface OfficeBudgetVersion {q4Target?:number;version:number;total:number;actorName:string;createdAt:string;reason:string;accounts:BudgetAccountSnapshot[]}

export interface ReceiptDraft {
  id: string;
  vendor: string;
  receiptNumber: string;
  receiptDate: string;
  description: string;
  amount: number;
  overrideReason?: string;
  file?: File;
  existingFile?: {
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  };
  originLabel?: string;
  locked?: boolean;
  approvedByName?: string;
  items?: ReceiptItem[];
}

export interface CashReviewFocus {
  recordId: string;
  orgId: string;
  fiscalYear: number;
  independentReview?: boolean;
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
  settlement?: { eligibleSettlers: number; headNotified: boolean; headApproved: boolean };
}
