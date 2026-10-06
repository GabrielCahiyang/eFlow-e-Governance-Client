import type { Task, TaskStatus, TaskSubmissionMetadata } from "../taskTypes";

export const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  ));
};

export function rowToTask(row: Record<string, unknown>): Task {
  return {
    proposedOfficeIdentityId: readString(row.proposed_office_identity_id),
    groupId: readString(row.group_id),
    workspacePosition: Number(row.workspace_position || 0),
    startDate: readString(row.start_date),
    id: row.id as string,
    title: (row.title as string) || 'Untitled task',
    description: readString(row.description),
    status: (row.status as TaskStatus) || 'pending_assignment',
    priority: (row.priority as 'low' | 'medium' | 'high') || 'medium',
    assigneeId: readString(row.assigned_to),
    assigneeName: readString(row.assignee_name),
    assignedTo: readString(row.assigned_to),
    teamId: readString(row.team_id),
    teamName: readString(row.team_name),
    teamMemberIds: readStringArray(row.team_member_ids),
    teamMemberNames: readStringArray(row.team_member_names),
    department: readString(row.department),
    orgId: readString(row.org_id),
    deadline: readString(row.deadline),
    dueDate: readString(row.due_date),
    tags: readStringArray(row.tags),
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
    updatedAt: new Date((row.updated_at as string) || Date.now()).getTime(),
    auditHash: readString(row.audit_hash),
    feedback: readString(row.feedback),
    latestSubmission: row.latest_submission
      ? (row.latest_submission as TaskSubmissionMetadata)
      : undefined,
    rejectionNote: readString(row.rejection_note),
    rejectedAt: row.rejected_at ? new Date(row.rejected_at as string).getTime() : undefined,
    reopenReason: readString(row.reopen_reason),
    reopenedAt: row.reopened_at ? new Date(row.reopened_at as string).getTime() : undefined,
    reopenedById: readString(row.reopened_by_id),
    reopenedByName: readString(row.reopened_by_name),
    recommendedEmployeeIds: readStringArray(row.recommended_employee_ids),
    recommendationReasoning: readString(row.recommendation_reasoning),
    recommendationSource: readString(row.recommendation_source) as Task['recommendationSource'],
    recommendationLeadId: readString(row.recommendation_lead_id),
    reviewerId: readString(row.reviewer_id),
    backupReviewerId: readString(row.backup_reviewer_id),
    acceptanceCriteria: readStringArray(row.acceptance_criteria),
    definitionOfDone: readString(row.definition_of_done),
    dependencyIds: readStringArray(row.dependency_ids),
    cancellationReason: readString(row.cancellation_reason),
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at as string).getTime() : undefined,
    cancelledBy: readString(row.cancelled_by),
    burnoutWarning: (row.burnout_warning as boolean) || false,
    proposalId: readString(row.proposal_id),
    proposalTitle: readString(row.proposal_title),
    programId: readString(row.program_id),
    programTitle: readString(row.program_title),
    projectId: readString(row.project_id),
    projectTitle: readString(row.project_title),
    activityId: readString(row.activity_id),
    activityTitle: readString(row.activity_title),
    activitySchedule: readString(row.activity_schedule),
    hierarchyPath: readString(row.hierarchy_path),
    importBatchId: readString(row.import_batch_id),
    barangay: readString(row.barangay),
    estimatedHours: (row.estimated_hours as number) || undefined,
    budgetImpact: (row.budget_impact as number) || undefined,
    subtaskCount: (row.subtask_count as number) || 0,
    subtaskCompletedCount: (row.subtask_completed_count as number) || 0,
    linkedProjectId: readString(row.linked_project_id),
    milestoneId: readString(row.milestone_id),
    percentComplete: row.percent_complete == null ? undefined : (row.percent_complete as number),
    archivedAt: row.archived_at ? new Date(row.archived_at as string).getTime() : undefined,
    lastActivityAt: row.last_activity_at ? new Date(row.last_activity_at as string).getTime() : undefined,
    createdBy: readString(row.created_by),
    reviewRouteMode: readString(row.review_route_mode) as Task['reviewRouteMode'],
    governanceApprovalMode: (readString(row.governance_approval_mode) || "department") as Task['governanceApprovalMode'],
    governanceOrganizationId: readString(row.governance_organization_id) || undefined,
    sourceCollaborationDraftId: readString(row.source_collaboration_draft_id),
    sourceCollaborationRevisionId: readString(row.source_collaboration_revision_id),
  };
}

export function taskToRow(task: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (task.title !== undefined) row.title = task.title;
  if (task.description !== undefined) row.description = task.description;
  if (task.status !== undefined) row.status = task.status;
  if (task.priority !== undefined) row.priority = task.priority;
  if (task.assigneeId !== undefined) row.assigned_to = task.assigneeId || null;
  if (task.assignedTo !== undefined) row.assigned_to = task.assignedTo || null;
  if (task.assigneeName !== undefined) row.assignee_name = task.assigneeName || '';
  if (task.department !== undefined) row.department = task.department || '';
  if (task.orgId !== undefined) row.org_id = task.orgId || null;
  if (task.teamId !== undefined) row.team_id = task.teamId || '';
  if (task.teamName !== undefined) row.team_name = task.teamName || '';
  if (task.teamMemberIds !== undefined) row.team_member_ids = task.teamMemberIds;
  if (task.teamMemberNames !== undefined) row.team_member_names = task.teamMemberNames;
  if (task.deadline !== undefined) { row.deadline = task.deadline; row.due_date = task.deadline; }
  if (task.dueDate !== undefined) row.due_date = task.dueDate;
  if (task.tags !== undefined) row.tags = task.tags;
  if (task.feedback !== undefined) row.feedback = task.feedback;
  if (task.rejectionNote !== undefined) row.rejection_note = task.rejectionNote;
  if (task.rejectedAt !== undefined) row.rejected_at = task.rejectedAt ? new Date(task.rejectedAt).toISOString() : null;
  if (task.reopenReason !== undefined) row.reopen_reason = task.reopenReason;
  if (task.reopenedAt !== undefined) row.reopened_at = task.reopenedAt ? new Date(task.reopenedAt).toISOString() : null;
  if (task.reopenedById !== undefined) row.reopened_by_id = task.reopenedById || null;
  if (task.reopenedByName !== undefined) row.reopened_by_name = task.reopenedByName || '';
  if (task.recommendedEmployeeIds !== undefined) row.recommended_employee_ids = task.recommendedEmployeeIds;
  if (task.recommendationReasoning !== undefined) row.recommendation_reasoning = task.recommendationReasoning;
  if (task.recommendationSource !== undefined) row.recommendation_source = task.recommendationSource;
  if (task.recommendationLeadId !== undefined) row.recommendation_lead_id = task.recommendationLeadId || null;
  if (task.reviewerId !== undefined) row.reviewer_id = task.reviewerId || null;
  if (task.backupReviewerId !== undefined) row.backup_reviewer_id = task.backupReviewerId || null;
  if (task.acceptanceCriteria !== undefined) row.acceptance_criteria = task.acceptanceCriteria;
  if (task.definitionOfDone !== undefined) row.definition_of_done = task.definitionOfDone;
  if (task.dependencyIds !== undefined) row.dependency_ids = task.dependencyIds;
  if (task.burnoutWarning !== undefined) row.burnout_warning = task.burnoutWarning;
  if (task.proposalId !== undefined) row.proposal_id = task.proposalId;
  if (task.proposalTitle !== undefined) row.proposal_title = task.proposalTitle;
  if (task.programId !== undefined) row.program_id = task.programId;
  if (task.programTitle !== undefined) row.program_title = task.programTitle;
  if (task.projectId !== undefined) row.project_id = task.projectId;
  if (task.projectTitle !== undefined) row.project_title = task.projectTitle;
  if (task.activityId !== undefined) row.activity_id = task.activityId;
  if (task.activityTitle !== undefined) row.activity_title = task.activityTitle;
  if (task.activitySchedule !== undefined) row.activity_schedule = task.activitySchedule;
  if (task.hierarchyPath !== undefined) row.hierarchy_path = task.hierarchyPath;
  if (task.importBatchId !== undefined) row.import_batch_id = task.importBatchId;
  if (task.auditHash !== undefined) row.audit_hash = task.auditHash;
  if (task.barangay !== undefined) row.barangay = task.barangay;
  if (task.estimatedHours !== undefined) row.estimated_hours = task.estimatedHours;
  if (task.budgetImpact !== undefined) row.budget_impact = task.budgetImpact;
  if (task.linkedProjectId !== undefined) row.linked_project_id = task.linkedProjectId || null;
  if (task.milestoneId !== undefined) row.milestone_id = task.milestoneId || null;
  if (task.percentComplete !== undefined) row.percent_complete = task.percentComplete;
  if (task.reviewRouteMode !== undefined) row.review_route_mode = task.reviewRouteMode;
  if (task.governanceApprovalMode !== undefined) row.governance_approval_mode = task.governanceApprovalMode;
  if (task.governanceOrganizationId !== undefined) row.governance_organization_id = task.governanceOrganizationId;
  return row;
}
