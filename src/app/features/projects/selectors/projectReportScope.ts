import { getTaskScopedBudgetBundle } from "../../budget";
import type { ProjectCommandData } from "../components/project-command/types";
import { buildProjectExecutionFinancialRows } from "./projectFinancialReportSelectors";
export interface ProjectReportFilters {
  search: string;
  office: string;
  status: string;
  from: string;
  to: string;
}
export const EMPTY_REPORT_FILTERS: ProjectReportFilters = {
  search: "",
  office: "all",
  status: "all",
  from: "",
  to: "",
};
/** Select whole task families so budget pools and nested hierarchy stay meaningful. */
export function selectProjectReportScope(
  data: ProjectCommandData,
  filters: ProjectReportFilters,
): ProjectCommandData {
  const rows = buildProjectExecutionFinancialRows(
    data.tasks,
    data.facts.subtasks,
    data.financial,
    data.facts,
  );
  const families = new Set(
    rows
      .filter((row) => {
        const task = data.tasks.find(
          (t) => t.id === (row.parentTaskId || row.id),
        );
        const day = row.deadline.slice(0, 10);
        return (
          (filters.office === "all" || task?.orgId === filters.office) &&
          (filters.status === "all" || row.status === filters.status) &&
          (!filters.from || day >= filters.from) &&
          (!filters.to || (!!day && day <= filters.to)) &&
          `${row.workItem} ${row.accountability} ${row.status}`
            .toLowerCase()
            .includes(filters.search.trim().toLowerCase())
        );
      })
      .map((row) => row.parentTaskId || row.id),
  );
  const tasks = data.tasks.filter((t) => families.has(t.id));
  return {
    ...data,
    tasks,
    financial: getTaskScopedBudgetBundle(
      data.financial,
      tasks.map((t) => t.id),
    ),
    facts: {
      subtasks: data.facts.subtasks.filter((s) => families.has(s.taskId)),
      progress: data.facts.progress.filter((s) => families.has(s.taskId)),
      submissions: data.facts.submissions.filter((s) => families.has(s.taskId)),
      statusHistory: data.facts.statusHistory.filter((s) =>
        families.has(s.taskId),
      ),
      evidence: data.facts.evidence.filter((s) => families.has(s.taskId)),
    },
  };
}
