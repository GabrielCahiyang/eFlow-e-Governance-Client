import type { Task } from "../tasks";
import type { TeamWorkflowFacts } from "../team-management";
export interface AnalyticsProject {
  id: string;
  title: string;
  projectLeadId?: string;
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  status: string;
}
export interface AnalyticsPerson {
  id: string;
  name: string;
}
export interface AnalyticsFilters {
  project: string;
  person: string;
  status: string;
  overdue: boolean;
  from: string;
  to: string;
  query: string;
}
export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
  project: "",
  person: "",
  status: "",
  overdue: false,
  from: "",
  to: "",
  query: "",
};
export interface TaskAnalytic {
  task: Task;
  project?: AnalyticsProject;
  lead: string;
  participants: string[];
  state: string;
  overdue: boolean;
  overdueDays: number;
  prerequisites: Task[];
  missingPrerequisites: number;
  firstSubmitted?: number;
  completedAt?: number;
  startedAt?: number;
  turnaroundHours: number | null;
  reviewHours: number | null;
  onTime: boolean | null;
  revisions: number;
}
export interface AnalyticsInput {
  tasks: Task[];
  projects: AnalyticsProject[];
  people: AnalyticsPerson[];
  facts: TeamWorkflowFacts;
  now?: number;
}
