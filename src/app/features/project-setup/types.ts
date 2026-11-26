export interface ProjectFundingSource {
  id: string;
  name: string;
  year: number;
  available: number;
  fiscalBudgetId?: string;
  fiscalAvailable?: number;
}
export interface OfficeFundingSourcesPreview {
  orgId: string;
  canAuthorize: boolean;
  hasEligibleAccountingStaff: boolean;
  sources: ProjectFundingSource[];
}
export interface ProjectFunding {
  id: string;
  name: string;
  fiscal_year: number;
  quarter?: number | null;
  amount: number;
  available: number;
  budget_before_activation?: number;
  supplemental_added?: number;
  total_certified?: number;
  actual_spent?: number;
  returned_to_office?: number;
  last_returned_at?: string | null;
  last_returned_by_name?: string;
}

export interface ProjectFinancialCloseoutSource {
  sourceId: string;
  partitionId: string;
  name: string;
  fiscalYear: number;
  quarter?: number | null;
  budgetBeforeActivation: number;
  supplementalAdded: number;
  totalCertified: number;
  currentCertified: number;
  allocatedToTasks: number;
  actualSpent: number;
  returnedToOfficeBudget: number;
  unreturnedBalance: number;
  unusedTaskAllocations: number;
  lastReturnedAt?: string | null;
  lastReturnedByName?: string;
}

export interface ProjectFinancialCloseoutSummary {
  projectId: string;
  projectTitle: string;
  status: string;
  fundingNotRequired: boolean;
  activatedAt?: string | null;
  completedAt?: string | null;
  archivedAt?: string | null;
  capturedAt?: string | null;
  capturedStage?: string | null;
  capturedBy?: string | null;
  capturedByName?: string | null;
  archivedBy?: string | null;
  archivedByName?: string | null;
  budgetBeforeActivation: number;
  supplementalBudgetAdded: number;
  totalCertifiedBudget: number;
  actualSpent: number;
  returnedToOfficeBudget: number;
  allocatedToTasks: number;
  unreturnedBalance: number;
  unusedTaskAllocations: number;
  taskCashReleased: number;
  taskCashReturned: number;
  outstandingAdvances: number;
  isFullyReconciled: boolean;
  sources: ProjectFinancialCloseoutSource[];
}
export interface ProjectFundingRequestItem {
  id: string;
  reason: string;
  lines: { partitionId?: string; amount?: number }[];
  actor_id: string;
  actorName?: string;
  status?: 'pending' | 'pending_accounting' | 'approved' | 'rejected' | 'cancelled';
  created_at?: string;
  head_approved_by?: string | null;
  head_approved_at?: string | null;
  headApprovedByName?: string;
  totalAmount?: number;
  canEndorse?: boolean;
  canCancel?: boolean;
  canCertify?: boolean;
}
export interface PendingFundingCertificationLine {
  partitionId: string;
  sourceName: string;
  fiscalYear: number | null;
  amount: number;
  available: number;
}
export interface PendingFundingCertification {
  id: string;
  projectId: string;
  projectTitle: string;
  projectScope: string;
  projectStatus: string;
  publicationState: string;
  orgId: string;
  requestedBy: string;
  requestedByName: string;
  headApprovedBy: string | null;
  headApprovedByName: string;
  headApprovedAt: string | null;
  reason: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  lines: PendingFundingCertificationLine[];
  canEndorse?: boolean;
  canCertify: boolean;
}
export interface ProjectFlow {
  canExtendTaskFunding?: boolean;
  project: {
    id: string;
    org_id?: string | null;
    status: string;
    title: string;
    description: string;
    scope: string;
    project_lead_id: string | null;
    start_date: string | null;
    target_date: string | null;
    funding_not_required: boolean;
    updated_at: string;
  };
  ready: boolean;
  canDraftWork?: boolean;
  hasEligibleAccountingStaff?: boolean;
  canConfigure?: boolean;
  canAuthorize: boolean;
  canCertify?: boolean;
  canAllocate: boolean;
  funds: ProjectFunding[];
  sources: ProjectFundingSource[];
  total: number;
  allocated: number;
  unallocated: number;
  released: number;
  spent: number;
  returned?: number;
  outstanding?: number;
  closeoutSummary?: ProjectFinancialCloseoutSummary;
  requests: { id: string; purpose: string; amount: number; status: string; requester: string; canReview: boolean }[];
  taskFunding: { sourceId?: string; fiscalYear?: number; id: string; taskId: string; task: string; source: string; amount: number; available: number }[];
  liquidations: { id: string; purpose: string; spent: number; canReview: boolean }[];
  fundingRequests: ProjectFundingRequestItem[];
}
export interface FundingDraft {partitionId:string;amount:number}
