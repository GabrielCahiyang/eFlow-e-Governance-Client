import type { DeadlineWorkload } from "../tasks";
import type { Subtask } from "../subtasks";

export type WorkflowSubmissionStatus = "pending" | "approved" | "changes_requested";

export interface WorkflowProgressFact {
  id: string;
  kind: "task" | "subtask";
  taskId: string;
  subtaskId?: string;
  authorId?: string;
  authorName: string;
  percentComplete?: number;
  blockerCategory?: string;
  blocker?: string;
  nextStep?: string;
  note?: string;
  createdAt: number;
}

export interface WorkflowSubmissionFact {
  id: string;
  kind: "task" | "subtask";
  taskId: string;
  subtaskId?: string;
  version: number;
  submitterId: string;
  submitterName: string;
  reviewerId?: string;
  status: WorkflowSubmissionStatus;
  feedback?: string;
  submittedAt: number;
  decidedAt?: number;
}

export interface TaskStatusFact {
  id: string;
  taskId: string;
  fromStatus?: string;
  toStatus: string;
  actorId?: string;
  actorName?: string;
  note?: string;
  createdAt: number;
}

export interface WorkflowEvidenceFact {
  id: string;
  kind: "task" | "subtask";
  taskId: string;
  submissionId?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: number;
}

export interface TeamWorkflowFacts {
  subtasks: Subtask[];
  progress: WorkflowProgressFact[];
  submissions: WorkflowSubmissionFact[];
  statusHistory: TaskStatusFact[];
  evidence: WorkflowEvidenceFact[];
}

export interface TeamMemberMetrics {
  employeeId: string;
  employeeName: string;
  recordedWorkload: number;
  workloadSignal: number;
  workload?: DeadlineWorkload;
  activeTasks: number;
  leadingTasks: number;
  activeSubtasks: number;
  dueSoon: number;
  overdue: number;
  blocked: number;
  awaitingReview: number;
  changesRequested: number;
  completedContributions: number;
  firstPassApprovalRate: number | null;
  revisionRequests: number;
  averageReviewHours: number | null;
  lastActivityAt?: number;
  stale: boolean;
}

export type TeamAttentionKind =
  | "overdue"
  | "due_soon"
  | "blocked"
  | "stalled"
  | "changes_requested"
  | "awaiting_review"
  | "unassigned"
  | "vague_schedule";

export interface TeamAttentionItem {
  id: string;
  kind: TeamAttentionKind;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  taskId: string;
  taskTitle: string;
  subtaskId?: string;
  employeeIds: string[];
  occurredAt?: number;
}

export interface TeamHealthSummary {
  activeTasks: number;
  activeSubtasks: number;
  completedTasks: number;
  overdue: number;
  blocked: number;
  stalled: number;
  awaitingReview: number;
  changesRequested: number;
  vagueSchedules: number;
  firstPassApprovalRate: number | null;
  averageReviewHours: number | null;
}

export interface SkillCoverageRow {
  skill: string;
  employeeIds: string[];
  employeeNames: string[];
  coverage: "single_point" | "limited" | "covered";
}
