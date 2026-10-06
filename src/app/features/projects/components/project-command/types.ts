import type { Milestone, Project, ProjectMember } from "../../services/types";
import type { Task } from "../../../tasks";
import type { TeamAttentionItem, TeamWorkflowFacts } from "../../../team-management";
import type { DepartmentBudgetBundle } from "../../../budget";

export type PermanentProjectView = "tasks" | "board" | "gantt" | "calendar" | "dashboard" | "offices";

export type OptionalProjectView =
  | "readiness"
  | "overview"
  | "timeline"
  | "reports"
  | "proposal_context"
  | "activity"
  | "reviews"
  | "workload"
  | "budget"
  | "signoff"
  | "evidence"
  | "decisions";

export type ProjectCommandTab =
  | PermanentProjectView
  | OptionalProjectView
  | "delivery"
  | "team"
  | "plan"
  | "work"
  | "people";

export type ProjectScheduleHealth = "on_track" | "due_soon" | "overdue" | "at_risk" | "completed";

export interface ProjectViewMeta<T extends ProjectCommandTab = OptionalProjectView> {
  id: T;
  label: string;
  category: "Project" | "Insights" | "Governance";
  description: string;
  requiresProposal?: boolean;
  requiresBudget?: boolean;
}

export interface ProjectCommandMetrics {
  progress: number;
  scheduleHealth: ProjectScheduleHealth;
  taskTotal: number;
  taskCompleted: number;
  milestoneOpen: number;
  milestoneCompleted: number;
  overdue: number;
  blocked: number;
  awaitingReview: number;
  changesRequested: number;
  completionRecommended: boolean;
  activeLeadIds: string[];
  nextDeadline?: string;
  lastActivityAt?: number;
}

export interface ProjectActivityItem {
  id: string;
  kind: "project" | "status" | "progress" | "submission";
  title: string;
  detail: string;
  actorName?: string;
  occurredAt: number;
  taskId?: string;
}

export interface ProjectCommandData {
  project: Project;
  tasks: Task[];
  milestones: Milestone[];
  members: ProjectMember[];
  facts: TeamWorkflowFacts;
  attention: TeamAttentionItem[];
  metrics: ProjectCommandMetrics;
  activity: ProjectActivityItem[];
  financial: DepartmentBudgetBundle;
  financialLoading: boolean;
  financialError: string;
  loading: boolean;
  error: string;
  refreshMembers: () => Promise<void>;
}
