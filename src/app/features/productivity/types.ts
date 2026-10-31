export interface ContributionBreakdown {
  delivery: number;
  quality: number;
  speed: number;
  collaboration: number;
}

export interface MonthlyContributionRow {
  rank: number;
  userId: string;
  employeeName: string;
  departmentName?: string;
  approvedTasks: number;
  approvedSubtasks: number;
  onTimeRate: number | null;
  medianCycleHours: number | null;
  firstPassApprovalRate: number | null;
  contributionScore: number;
  breakdown: ContributionBreakdown;
  source: "live" | "snapshot";
}

export interface ManilaMonthPeriod {
  key: string;
  label: string;
  start: number;
  end: number;
}

export interface ContributionSubtaskFact {
  completedBy?: string;
  completedAt?: number;
  leadId?: string;
  id: string;
  taskId: string;
  status: string;
  createdAt: number;
}

export interface ContributionSubmissionFact {
  id: string;
  kind: "task" | "subtask";
  taskId: string;
  subtaskId?: string;
  version: number;
  submitterId: string;
  reviewerId?: string;
  status: string;
  decidedAt?: number;
}

export interface ContributionWorkflowFacts {
  subtasks: ContributionSubtaskFact[];
  submissions: ContributionSubmissionFact[];
}
