export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type ProjectPriority = 'low' | 'medium' | 'high';
export type MilestoneStatus = 'auto' | 'not_started' | 'in_progress' | 'at_risk' | 'completed';
export type ProjectSourceType = 'ai_pdf' | 'manual' | 'standalone';

export interface Project {
  id: string;
  orgId?: string;
  title: string;
  description: string;
  ownerId?: string;
  proposalId?: string;
  proposalTitle?: string;
  programId?: string;
  programTitle?: string;
  sourceType?: ProjectSourceType;
  sourceFileName?: string;
  sourceCollaborationDraftId?: string;
  sourceCollaborationRevisionId?: string;
  status: ProjectStatus;
  publicationState?: 'draft' | 'published';
  publishedAt?: number;
  publishedBy?: string;
  priority: ProjectPriority;
  startDate?: string;
  targetDate?: string;
  archivedAt?: number;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: 'owner' | 'member' | 'viewer';
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  dueDate?: string;
  status: MilestoneStatus;
  manualStatus?: MilestoneStatus;
  manualNote?: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProjectInput {
  title: string;
  description?: string;
  orgId?: string | null;
  ownerId?: string | null;
  proposalId?: string | null;
  proposalTitle?: string | null;
  programId?: string | null;
  programTitle?: string | null;
  sourceType?: ProjectSourceType;
  sourceFileName?: string | null;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  startDate?: string | null;
  targetDate?: string | null;
  memberIds?: string[];
  milestones?: { title: string; dueDate?: string | null }[];
}

// ─── Row mappers ─────────────────────────────────────────────────
