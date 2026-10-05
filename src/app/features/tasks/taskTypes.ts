export type TaskStatus =
  | 'pending_assignment'
  | 'todo'
  | 'in_progress'
  | 'for_review'
  | 'changes_requested'
  | 'completed'
  | 'cancelled';

export interface TaskAssignmentDetails {
  teamId?: string;
  teamName?: string;
  teamMemberIds?: string[];
  teamMemberNames?: string[];
}

export interface TaskHierarchy {
  proposalId?: string;
  proposalTitle?: string;
  programId?: string;
  programTitle?: string;
  projectId?: string;
  projectTitle?: string;
  activityId?: string;
  activityTitle?: string;
  activitySchedule?: string;
  hierarchyPath?: string;
  importBatchId?: string;
}

export interface Task extends TaskHierarchy {
  groupId?: string;
  workspacePosition?: number;
  startDate?: string;
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeId?: string;
  assigneeName?: string;
  assignedTo?: string;
  teamId?: string;
  teamName?: string;
  teamMemberIds?: string[];
  teamMemberNames?: string[];
  department?: string;
  orgId?: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;
  dueDate?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  auditHash?: string;
  feedback?: string;
  latestSubmission?: TaskSubmissionMetadata;
  rejectionNote?: string;
  rejectedAt?: number;
  reopenReason?: string;
  reopenedAt?: number;
  reopenedById?: string;
  reopenedByName?: string;
  recommendedEmployeeIds?: string[];
  recommendationReasoning?: string;
  recommendationSource?: 'llm' | 'fallback' | 'import';
  recommendationLeadId?: string;
  reviewerId?: string;
  backupReviewerId?: string;
  acceptanceCriteria?: string[];
  definitionOfDone?: string;
  dependencyIds?: string[];
  cancellationReason?: string;
  cancelledAt?: number;
  cancelledBy?: string;
  burnoutWarning?: boolean;
  barangay?: string;
  estimatedHours?: number;
  budgetImpact?: number;
  subtaskCount?: number;
  subtaskCompletedCount?: number;
  // ── Core-workflow operational links (added Phase 0) ──
  linkedProjectId?: string;
  milestoneId?: string;
  percentComplete?: number;
  archivedAt?: number;
  lastActivityAt?: number;
  createdBy?: string;
  reviewRouteMode?: 'organization_default' | 'explicit' | 'governance';
  governanceApprovalMode?: 'department' | 'governance' | 'closeout_only';
  governanceOrganizationId?: string;
  sourceCollaborationDraftId?: string;
  sourceCollaborationRevisionId?: string;
}

export interface TaskSubmissionMetadata {
  id?: string;
  version?: number;
  note: string;
  submitterId: string;
  submitterName: string;
  submittedAt: number;
  attachments: Array<TaskSubmissionAttachment | string>;
}

export interface TaskSubmissionAttachment {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}

export interface TaskSubmissionInput {
  note: string;
  attachments?: File[];
  submitterId: string;
  submitterName: string;
}

export interface TaskActor {
  id?: string;
  name?: string;
}

export interface TaskUndoInput {
  reason: string;
  actor?: TaskActor;
}

export interface TaskActivity {
  id: string;
  taskId: string;
  action: string;
  details: string;
  userId?: string;
  userName?: string;
  timestamp: number;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  deadline: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  status?: TaskStatus;
  department?: string;
  orgId?: string;
  teamId?: string;
  teamName?: string;
  teamMemberIds?: string[];
  teamMemberNames?: string[];
  assigneeId?: string;
  assigneeName?: string;
  recommendedEmployeeIds?: string[];
  recommendationReasoning?: string;
  recommendationSource?: 'llm' | 'fallback' | 'import';
  recommendationLeadId?: string;
  reviewerId?: string;
  backupReviewerId?: string;
  acceptanceCriteria?: string[];
  definitionOfDone?: string;
  dependencyIds?: string[];
  burnoutWarning?: boolean;
  barangay?: string;
  estimatedHours?: number;
  budgetImpact?: number;
  proposalId?: string;
  proposalTitle?: string;
  programId?: string;
  programTitle?: string;
  projectId?: string;
  projectTitle?: string;
  activityId?: string;
  activityTitle?: string;
  activitySchedule?: string;
  hierarchyPath?: string;
  importBatchId?: string;
  linkedProjectId?: string;
  milestoneId?: string;
  percentComplete?: number;
  reviewRouteMode?: 'organization_default' | 'explicit' | 'governance';
  governanceApprovalMode?: 'department' | 'governance' | 'closeout_only';
  governanceOrganizationId?: string;
}

export interface UpdateTaskPayload {
  estimatedHours?: number;
  title?: string;
  description?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  status?: TaskStatus;
  department?: string;
  orgId?: string;
  teamId?: string;
  teamName?: string;
  teamMemberIds?: string[];
  teamMemberNames?: string[];
  assigneeId?: string;
  assigneeName?: string;
  recommendedEmployeeIds?: string[];
  recommendationReasoning?: string;
  recommendationSource?: 'llm' | 'fallback' | 'import';
  recommendationLeadId?: string;
  reviewerId?: string;
  backupReviewerId?: string;
  acceptanceCriteria?: string[];
  definitionOfDone?: string;
  dependencyIds?: string[];
  burnoutWarning?: boolean;
  proposalId?: string;
  proposalTitle?: string;
  programId?: string;
  programTitle?: string;
  projectId?: string;
  projectTitle?: string;
  activityId?: string;
  activityTitle?: string;
  activitySchedule?: string;
  hierarchyPath?: string;
  importBatchId?: string;
  linkedProjectId?: string;
  milestoneId?: string;
  percentComplete?: number;
  reviewRouteMode?: 'organization_default' | 'explicit' | 'governance';
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
