import { matchesWorkDate, workDay } from "../../shared/workCalendar";
import type {
  WorkRow,
  WorkDestination,
  WorkDateFilter,
  WorkSnapshot,
} from "./types";
export function selectWorkRows(
  rows: WorkRow[],
  destination: WorkDestination,
  date: WorkDateFilter,
  query = "",
  workspace = "",
  recent = false,
  now = new Date(),
) {
  const needle = query.trim().toLocaleLowerCase();
  return rows
    .filter((row) => {
      if (!row.mine || (workspace && row.workspaceId !== workspace))
        return false;
      if (destination === "History") {
        if (!row.history) return false;
        if (recent) {
          const day = workDay(row.updatedAt, row.timezone),
            today = workDay(now, row.timezone);
          if (
            row.status !== "completed" ||
            day === null ||
            today === null ||
            day < today - 6 ||
            day > today
          )
            return false;
        }
      } else if (row.history || !row.actionable) return false;
      if (destination === "Leading" && !row.leading) return false;
      if (destination === "Assigned work" && !row.kind.endsWith("task"))
        return false;
      if (destination === "Subtasks" && !row.kind.endsWith("node"))
        return false;
      return (
        matchesWorkDate(row.due, date, now, row.timezone) &&
        (!needle ||
          [
            row.title,
            row.rootTitle,
            row.projectTitle,
            row.workspaceName,
            row.officeName,
            row.relation,
          ].some((value) => value?.toLocaleLowerCase().includes(needle)))
      );
    })
    .sort((a, b) =>
      destination === "History"
        ? (b.updatedAt || 0) - (a.updatedAt || 0) || a.key.localeCompare(b.key)
        : (workDay(a.due, a.timezone) ?? Infinity) -
            (workDay(b.due, b.timezone) ?? Infinity) ||
          a.title.localeCompare(b.title) ||
          a.key.localeCompare(b.key),
    );
}
export function workspaceSummary(data: WorkSnapshot, now = new Date()) {
  const active = data.rows.filter((row) => !row.history && row.actionable);
  return {
    activeProjects: data.projects.filter(
      (p) => !["completed", "archived"].includes(p.status),
    ),
    active,
    today: active.filter((r) =>
      matchesWorkDate(r.due, "Today", now, r.timezone),
    ),
    overdue: active.filter((r) =>
      matchesWorkDate(r.due, "Overdue", now, r.timezone),
    ),
    unassigned: active.filter((r) => r.relation === "Needs reassignment"),
    review: active.filter((r) =>
      ["for_review", "submitted"].includes(r.status),
    ),
  };
}
