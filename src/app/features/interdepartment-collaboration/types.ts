export type CollaborationSourceType = "ai_pdf" | "manual";
export type CollaborationDraftStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "ready_to_commit"
  | "committed"
  | "archived"
  | "deleted";
export type CollaborationParticipationRole = "owner" | "participant" | "governance" | "observer";
export type CollaborationDecision = "approved" | "changes_requested" | "declined";
export type GovernanceApprovalPolicy = "one_of" | "all" | "quorum";
export type GovernanceAssignmentRole = "primary_approver" | "backup_approver" | "liaison" | "technical_reviewer" | "observer" | "delegate";
export type TaskGovernanceMode = "department" | "governance" | "closeout_only";
export type CollaborationTargetType = "proposal" | "program" | "project" | "activity" | "task" | "staff_assignment";

export interface CollaborationOrganizationSelection {
  orgId: string;
  participationRole: CollaborationParticipationRole;
  staffingEnabled: boolean;
  approvalPolicy?: GovernanceApprovalPolicy;
  quorumCount?: number;
  sequence?: number;
  reviewDeadlineDays?: number;
}

export interface CollaborationSnapshotTask {
  key: string;
  proposalTitle: string;
  proposalId: string;
  programIdx: number;
  projectIdx: number;
  activityIdx: number;
  taskIdx: number;
  programId: string;
  programTitle: string;
  projectId: string;
  projectTitle: string;
  activityId: string;
  activityTitle: string;
  activitySchedule: string;
  activityPrimaryOrgId: string;
  activitySupportingOrgIds: string[];
  primaryOrgId: string;
  supportingOrgIds: string[];
  title: string;
  description: string;
  deadline: string;
  priority: "low" | "medium" | "high";
  requiredSkills: string[];
  assignedMemberIds: string[];
  leadMemberId: string | null;
  burnoutWarning: boolean;
  reasoning: string;
  enabled: boolean;
  governanceMode?: TaskGovernanceMode;
  governanceOrgId?: string;
  budgetDecision?: TaskBudgetDecision;
  budgetNoCostReason?: string;
  budgetLines?: BudgetLineInput[];
}

export interface CollaborationDraftSnapshot {
  version: 1;
  proposalId: string;
  title: string;
  description: string;
  planningAnchor: string;
  organizations: CollaborationOrganizationSelection[];
  tasks: CollaborationSnapshotTask[];
  budget?: ProposalBudgetDraft;
}

export interface CollaborationDraft {
  id: string;
  title: string;
  ownerOrgId: string;
  ownerUserId: string;
  sourceType: CollaborationSourceType;
  sourceFileName?: string;
  sourceFilePath?: string;
  sourceFileHash?: string;
  status: CollaborationDraftStatus;
  currentRevisionId?: string;
  currentRevisionNumber?: number;
  approvedOrganizations?: number;
  requiredOrganizations?: number;
  snapshot: CollaborationDraftSnapshot;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  committedAt?: number;
}

export interface CollaborationRevision {
  id: string;
  draftId: string;
  revisionNumber: number;
  snapshot: CollaborationDraftSnapshot;
  createdBy: string;
  createdAt: number;
  changeSummary: string;
}

export interface CollaborationParticipant {
  draftId: string;
  orgId: string;
  participationRole: CollaborationParticipationRole;
  staffingEnabled: boolean;
  requestedBy?: string;
  requestedAt?: number;
  approvalPolicy: GovernanceApprovalPolicy;
  quorumCount: number;
  sequence: number;
  reviewDeadlineDays: number;
}

export interface GovernanceAssignment {
  id: string;
  draftId: string;
  organizationId: string;
  userId: string;
  role: GovernanceAssignmentRole;
  assignedBy: string;
  delegatedBy?: string;
  validUntil?: number;
  createdAt: number;
}

export interface GovernanceSignoff {
  id: string;
  draftId: string;
  revisionId: string;
  organizationId: string;
  userId: string;
  decision: CollaborationDecision | "recused";
  reason?: string;
  delegatedTo?: string;
  createdAt: number;
}

export interface GovernanceRecord {
  id: string;
  draftId: string;
  organizationId: string;
  resolutionNumber?: string;
  meetingDate?: string;
  minutesFileName?: string;
  minutesFilePath?: string;
  endorsement?: string;
  recordedBy: string;
  updatedAt: number;
}

export type ProposalCloseoutStatus = "draft" | "pending" | "changes_requested" | "approved" | "completed" | "archived";

export interface ProposalCloseout {
  draftId: string;
  status: ProposalCloseoutStatus;
  requestNote?: string;
  requestedBy?: string;
  requestedAt?: number;
  approvedAt?: number;
  completedBy?: string;
  completedAt?: number;
  archivedBy?: string;
  archivedAt?: number;
}

export interface ProposalCloseoutDecision {
  id: string;
  draftId: string;
  organizationId: string;
  decision: CollaborationDecision;
  decidedBy: string;
  reason?: string;
  resolutionNumber?: string;
  meetingDate?: string;
  createdAt: number;
}

export interface ProposalGovernanceState {
  assignments: GovernanceAssignment[];
  signoffs: GovernanceSignoff[];
  records: GovernanceRecord[];
  closeout: ProposalCloseout | null;
  closeoutDecisions: ProposalCloseoutDecision[];
}

export interface CollaborationApproval {
  id: string;
  draftId: string;
  revisionId: string;
  organizationId: string;
  decision: CollaborationDecision;
  approvedBy: string;
  reason?: string;
  createdAt: number;
}

export interface CollaborationMessage {
  id: string;
  draftId: string;
  revisionId?: string;
  authorId?: string;
  authorOrgId?: string;
  authorName?: string;
  message: string;
  messageType: "comment" | "system" | "change_request_comment";
  targetType?: CollaborationTargetType;
  targetKey?: string;
  createdAt: number;
}

export interface CollaborationChangeRequest {
  id: string;
  draftId: string;
  revisionId: string;
  requestedBy: string;
  requestingOrgId: string;
  targetType: CollaborationTargetType;
  targetKey: string;
  reason: string;
  proposedChange: Record<string, unknown>;
  status: "open" | "accepted" | "rejected" | "withdrawn";
  resolvedBy?: string;
  resolvedAt?: number;
  createdAt: number;
}

export interface CollaborationReadiness {
  ready: boolean;
  requiredOrganizations: number;
  approvedOrganizations: number;
  openChangeRequests: number;
  missingApprovers: number;
  currentRevisionId?: string;
  blockers: string[];
}

export interface CollaborationCommitResult {
  draftId: string;
  revisionId: string;
  revisionNumber: number;
  projectIds: string[];
  projectCount: number;
}
import type { BudgetLineInput, ProposalBudgetDraft, TaskBudgetDecision } from "../budget";
