import type {
  EffectiveProjectStatus,
  Milestone,
  MilestoneStatus,
  Project,
  ProjectApprovalStatus,
  ProjectCompletionReviewStatus,
  ProjectFundingApprovalStatus,
  ProjectPriority,
  ProjectSourceType,
  ProjectStatus,
} from './types';

function parseFundingApprovalStatus(value: unknown): ProjectFundingApprovalStatus {
  if (value === 'pending_head' || value === 'pending_accounting' || value === 'approved') return value;
  return 'none';
}

function parseProjectApprovalStatus(value: unknown): ProjectApprovalStatus {
  if (value === 'pending_head' || value === 'approved' || value === 'rejected') return value;
  return 'not_required';
}

function parseCompletionReviewStatus(value: unknown): ProjectCompletionReviewStatus {
  if (value === 'requested' || value === 'changes_requested' || value === 'approved') return value;
  return 'none';
}

export function isProjectPendingFundingApproval(
  project?: Pick<Project, 'status' | 'fundingApprovalStatus'> | null,
): boolean {
  if (!project) return false;
  if (project.status === 'completed' || project.status === 'archived') return false;
  return project.fundingApprovalStatus === 'pending_head' || project.fundingApprovalStatus === 'pending_accounting';
}

export function isProjectPendingHeadApproval(
  project?: Pick<Project, 'status' | 'projectApprovalStatus'> | null,
): boolean {
  if (!project) return false;
  if (project.status === 'completed' || project.status === 'archived') return false;
  return project.projectApprovalStatus === 'pending_head';
}

export function isProjectWaitingForActivation(
  project?: Pick<
    Project,
    'status' | 'setupCompletedAt' | 'fundingNotRequired' | 'fundingApprovalStatus' | 'projectApprovalStatus'
  > | null,
): boolean {
  if (!project || project.status !== 'planning') return false;
  if (isProjectPendingFundingApproval(project) || isProjectPendingHeadApproval(project)) return false;
  if (project.projectApprovalStatus === 'rejected') return false;
  if (!project.setupCompletedAt) return false;
  return project.fundingNotRequired === true || project.fundingApprovalStatus === 'approved';
}

export function effectiveProjectLifecycleStatus(
  project: Pick<
    Project,
    | 'status'
    | 'setupCompletedAt'
    | 'fundingNotRequired'
    | 'fundingApprovalStatus'
    | 'projectApprovalStatus'
    | 'completionReviewStatus'
  >,
): EffectiveProjectStatus {
  if (project.status === 'planning') {
    if (isProjectPendingFundingApproval(project) || isProjectPendingHeadApproval(project)) {
      return 'pending';
    }
    if (isProjectWaitingForActivation(project)) {
      return 'waiting_for_activation';
    }
    return 'planning';
  }
  if (project.status === 'active' && project.completionReviewStatus === 'requested') {
    return 'pending_completion';
  }
  return project.status;
}

export function pendingFundingApprovalLabel(
  status?: ProjectFundingApprovalStatus,
  projectApprovalStatus?: ProjectApprovalStatus,
): string {
  if (status === 'pending_head') return 'Awaiting Office Head & Accounting approval';
  if (status === 'pending_accounting') return 'Awaiting Accounting certification';
  if (projectApprovalStatus === 'pending_head') return 'Awaiting Office Head approval';
  return 'Pending approval';
}

export function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    orgId: (row.org_id as string) || undefined,
    title: (row.title as string) || 'Untitled project',
    description: (row.description as string) || '',
    projectLeadId: (row.project_lead_id as string)||undefined,
    scope: (row.scope as string)||'',
    setupCompletedAt: (row.setup_completed_at as string)||undefined,
    fundingNotRequired: row.funding_not_required===true,
    fundingApprovalStatus: parseFundingApprovalStatus(row.funding_approval_status),
    projectApprovalStatus: parseProjectApprovalStatus(row.project_approval_status),
    projectApprovalRequestedBy: (row.project_approval_requested_by as string) || undefined,
    projectApprovalRequestedAt: typeof row.project_approval_requested_at === 'string' ? row.project_approval_requested_at : undefined,
    projectApprovedBy: (row.project_approved_by as string) || undefined,
    projectApprovedAt: typeof row.project_approved_at === 'string' ? row.project_approved_at : undefined,
    projectApprovalFeedback: (row.project_approval_feedback as string) || undefined,
    activationScheduledAt: typeof row.activation_scheduled_at === 'string' ? row.activation_scheduled_at : undefined,
    activationScheduledBy: (row.activation_scheduled_by as string) || undefined,
    completionReviewStatus: parseCompletionReviewStatus(row.completion_review_status),
    completionRequestedBy: (row.completion_requested_by as string) || undefined,
    completionRequestedAt: typeof row.completion_requested_at === 'string' ? row.completion_requested_at : undefined,
    completionRequestNote: (row.completion_request_note as string) || undefined,
    completionReviewFeedback: (row.completion_review_feedback as string) || undefined,
    completionReviewedBy: (row.completion_reviewed_by as string) || undefined,
    completionReviewedAt: typeof row.completion_reviewed_at === 'string' ? row.completion_reviewed_at : undefined,
    ownerId: (row.owner_id as string) || undefined,
    proposalId: (row.proposal_id as string) || undefined,
    proposalTitle: (row.proposal_title as string) || undefined,
    programId: (row.program_id as string) || undefined,
    programTitle: (row.program_title as string) || undefined,
    sourceType: (row.source_type as ProjectSourceType) || undefined,
    sourceFileName: (row.source_file_name as string) || undefined,
    sourceCollaborationDraftId: (row.source_collaboration_draft_id as string) || undefined,
    sourceCollaborationRevisionId: (row.source_collaboration_revision_id as string) || undefined,
    status: (row.status as ProjectStatus) || 'planning',
    publicationState: row.publication_state === 'draft' ? 'draft' : 'published',
    publishedAt: row.published_at ? new Date(row.published_at as string).getTime() : undefined,
    publishedBy: (row.published_by as string) || undefined,
    priority: (row.priority as ProjectPriority) || 'medium',
    startDate: (row.start_date as string) || undefined,
    targetDate: (row.target_date as string) || undefined,
    archivedAt: row.archived_at ? new Date(row.archived_at as string).getTime() : undefined,
    completedAt: typeof row.completed_at==='string'?row.completed_at:undefined,
    createdBy: (row.created_by as string) || undefined,
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
    updatedAt: new Date((row.updated_at as string) || Date.now()).getTime(),
    metadataVersion: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  };
}

export function rowToMilestone(row: Record<string, unknown>): Milestone {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: (row.title as string) || 'Untitled milestone',
    description: (row.description as string) || '',
    dueDate: (row.due_date as string) || undefined,
    status: (row.status as MilestoneStatus) || 'auto',
    manualStatus: (row.manual_status as MilestoneStatus) || undefined,
    manualNote: (row.manual_note as string) || undefined,
    sortOrder: (row.sort_order as number) || 0,
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
    updatedAt: new Date((row.updated_at as string) || Date.now()).getTime(),
  };
}

// ─── Local realtime listener system ──────────────────────────────
