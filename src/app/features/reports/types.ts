export type DepartmentReportKind =
  | "operations"
  | "projects"
  | "contributions"
  | "reviews"
  | "evidence"
  | "risks"
  | "lifecycle";

export interface DepartmentReportRow {
  id: string;
  kind: DepartmentReportKind;
  title: string;
  parent: string;
  project: string;
  person: string;
  personId?: string;
  role: string;
  status: string;
  priority: string;
  progress?: number;
  eventAt?: number;
  dueAt?: number;
  metric: string;
  detail: string;
  assignedReviewer?: string;
  decisionAuthor?: string;
  taskId?: string;
  projectId?: string;
}

export interface DepartmentReportFilters {
  search: string;
  personId: string;
  projectId: string;
  status: string;
  from?: number;
  to?: number;
}

export interface DepartmentReportDefinition {
  id: DepartmentReportKind;
  title: string;
  description: string;
}

