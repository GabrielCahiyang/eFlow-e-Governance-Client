import type { DepartmentReportDefinition } from "./types";

export const DEPARTMENT_REPORTS: DepartmentReportDefinition[] = [
  { id: "operations", title: "Office operations", description: "Current task ownership, progress, schedules, and subtask roll-up." },
  { id: "projects", title: "Projects and delivery", description: "Project ownership, linked task progress, health, and target dates." },
  { id: "contributions", title: "Team contributions", description: "Lead, member, and subtask contribution—not just the primary assignee." },
  { id: "reviews", title: "Reviews and revisions", description: "Submission attempts, decision status, feedback, and review turnaround." },
  { id: "evidence", title: "Evidence register", description: "Task and subtask evidence with its work item and approval state." },
  { id: "risks", title: "Attention and risk register", description: "Overdue, blocked, stalled, unassigned, and waiting-review work." },
  { id: "lifecycle", title: "Task lifecycle history", description: "Auditable task status transitions with actor, time, and reason." },
];

