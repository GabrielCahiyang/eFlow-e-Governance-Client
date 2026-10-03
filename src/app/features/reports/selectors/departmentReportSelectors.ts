import type { Employee } from "../../members";
import type { Project } from "../../projects";
import type { Task } from "../../tasks";
import type { TeamAttentionItem, TeamWorkflowFacts } from "../../team-management";
import type { DepartmentReportFilters, DepartmentReportKind, DepartmentReportRow } from "../types";
import { buildContributionRows, buildOperationRows, buildProjectRows } from "./workReportRows";
import { buildEvidenceRows, buildLifecycleRows, buildReviewRows, buildRiskRows } from "./workflowReportRows";

export function buildDepartmentReportRows(
  kind: DepartmentReportKind,
  tasks: Task[],
  projects: Project[],
  employees: Employee[],
  facts: TeamWorkflowFacts,
  attention: TeamAttentionItem[],
  now: number = Date.now(),
): DepartmentReportRow[] {
  if (kind === "projects") return buildProjectRows(projects, tasks, employees, now);
  if (kind === "contributions") return buildContributionRows(tasks, projects, employees, facts);
  const workflowContext = { tasks, projects, employees, facts, now };
  if (kind === "reviews") return buildReviewRows(workflowContext);
  if (kind === "evidence") return buildEvidenceRows(workflowContext);
  if (kind === "risks") return buildRiskRows(workflowContext, attention);
  if (kind === "lifecycle") return buildLifecycleRows(workflowContext);
  return buildOperationRows(tasks, projects, employees, now);
}

export function filterDepartmentReportRows(rows: DepartmentReportRow[], filters: DepartmentReportFilters): DepartmentReportRow[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.personId !== "all" && row.personId !== filters.personId) return false;
    if (filters.projectId !== "all" && row.projectId !== filters.projectId) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.from && (!row.eventAt || row.eventAt < filters.from)) return false;
    if (filters.to && (!row.eventAt || row.eventAt > filters.to)) return false;
    if (!query) return true;
    return [row.title, row.parent, row.project, row.person, row.role, row.status, row.priority, row.metric, row.detail]
      .some((value) => value.toLowerCase().includes(query));
  }).sort((first, second) => (second.eventAt || 0) - (first.eventAt || 0) || first.title.localeCompare(second.title));
}

