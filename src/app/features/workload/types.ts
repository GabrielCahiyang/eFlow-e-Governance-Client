export type WorkloadTier = 'balanced' | 'heavy' | 'overloaded';

export type ProposedAssignmentRole =
  | 'project_lead_active'
  | 'project_lead_planning'
  | 'task_lead'
  | 'task_contributor'
  | 'subtask_lead'
  | 'subtask_contributor';

export type WorkloadItemKind =
  | 'project_lead'
  | 'task_lead'
  | 'task_contributor'
  | 'subtask_lead'
  | 'subtask_contributor'
  | 'pending_review';

export interface WorkloadThresholds {
  id?: string;
  orgId: string | null;
  orgName?: string;
  heavyPoints: number;
  overloadPoints: number;
  maxActiveProjectLeads: number;
  maxActiveTaskLeads: number;
  maxOverdueItems: number;
  dueSoonBusinessDays: number;
  weightActiveProjectLead: number;
  weightPlanningProjectLead: number;
  weightTaskLead: number;
  weightTaskContributor: number;
  weightSubtaskLead: number;
  weightSubtaskContributor: number;
  weightPendingReview: number;
  weightOverduePenalty: number;
  weightDueSoonPenalty: number;
  requireOverrideReason: boolean;
  updatedAt?: string;
}

export interface WorkloadThresholdSettingsBundle {
  effective: WorkloadThresholds;
  globalDefault: WorkloadThresholds;
  officeOverrides: WorkloadThresholds[];
  canManage: boolean;
}

export interface MemberWorkloadSummary {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  isOfficeHead: boolean;
  activeProjectsLed: number;
  planningProjectsLed: number;
  taskLeads: number;
  taskContributions: number;
  subtaskLeads: number;
  subtaskContributions: number;
  pendingReviews: number;
  overdueCount: number;
  dueSoonCount: number;
  loadPoints: number;
  utilizationPercent: number;
  tier: WorkloadTier;
  reasons: string[];
}

export interface OfficeWorkloadSummary {
  orgId: string | null;
  thresholds: WorkloadThresholds;
  members: MemberWorkloadSummary[];
  calculatedAt: string;
}

export interface WorkloadCommitmentItem {
  kind: WorkloadItemKind;
  id: string;
  taskId?: string | null;
  projectId?: string | null;
  projectTitle: string;
  title: string;
  status: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  isOverdue: boolean;
  isDueSoon: boolean;
  points: number;
}

export interface MemberWorkloadHiddenCounts {
  projects: number;
  tasks: number;
  subtasks: number;
  reviews: number;
}

export interface MemberWorkloadDetail {
  member: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
    orgId: string | null;
    orgName: string;
    isOfficeHead: boolean;
  };
  summary: MemberWorkloadSummary | null;
  thresholds: WorkloadThresholds;
  items: WorkloadCommitmentItem[];
  hiddenCounts: MemberWorkloadHiddenCounts;
  alternatives: MemberWorkloadSummary[];
  calculatedAt: string;
}

export interface ProjectedWorkloadResult {
  currentPoints: number;
  addedPoints: number;
  projectedPoints: number;
  projectedUtilizationPercent: number;
  currentTier: WorkloadTier;
  projectedTier: WorkloadTier;
  tipsIntoOverload: boolean;
  alreadyOverloaded: boolean;
  requiresOverride: boolean;
  reasons: string[];
  roleLabel: string;
}

export interface OverloadOverrideState {
  acknowledged: boolean;
  reason: string;
}

export const EMPTY_OVERLOAD_OVERRIDE: OverloadOverrideState = {
  acknowledged: false,
  reason: '',
};

export const DEFAULT_WORKLOAD_THRESHOLDS: WorkloadThresholds = {
  orgId: null,
  heavyPoints: 8.0,
  overloadPoints: 12.0,
  maxActiveProjectLeads: 3,
  maxActiveTaskLeads: 5,
  maxOverdueItems: 3,
  dueSoonBusinessDays: 3,
  weightActiveProjectLead: 3.0,
  weightPlanningProjectLead: 1.5,
  weightTaskLead: 2.0,
  weightTaskContributor: 1.0,
  weightSubtaskLead: 1.0,
  weightSubtaskContributor: 0.5,
  weightPendingReview: 0.5,
  weightOverduePenalty: 1.5,
  weightDueSoonPenalty: 0.5,
  requireOverrideReason: true,
};
