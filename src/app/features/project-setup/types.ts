export interface ProjectFundingSource {id:string;name:string;year:number;available:number}
export interface ProjectFunding {id:string;name:string;fiscal_year:number;quarter?:number|null;amount:number;available:number}
export interface ProjectFundingRequestItem {
  id: string;
  reason: string;
  lines: { partitionId?: string; amount?: number }[];
  actor_id: string;
  actorName?: string;
  status?: 'pending' | 'pending_accounting' | 'approved' | 'rejected' | 'cancelled';
  head_approved_by?: string | null;
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
  canCertify: boolean;
}
export interface ProjectFlow {
  canExtendTaskFunding?: boolean;
  project: {
    id: string;
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
  requests: { id: string; purpose: string; amount: number; status: string; requester: string; canReview: boolean }[];
  taskFunding: { sourceId?: string; fiscalYear?: number; id: string; taskId: string; task: string; source: string; amount: number; available: number }[];
  liquidations: { id: string; purpose: string; spent: number; canReview: boolean }[];
  fundingRequests: ProjectFundingRequestItem[];
}
export interface FundingDraft {partitionId:string;amount:number}
