import type { Milestone, MilestoneStatus, Project, ProjectPriority, ProjectSourceType, ProjectStatus } from './types';

export function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    orgId: (row.org_id as string) || undefined,
    title: (row.title as string) || 'Untitled project',
    description: (row.description as string) || '',
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
    createdBy: (row.created_by as string) || undefined,
    createdAt: new Date((row.created_at as string) || Date.now()).getTime(),
    updatedAt: new Date((row.updated_at as string) || Date.now()).getTime(),
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
