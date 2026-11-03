import { workloadDeadline } from "../../tasks";
import { getPhilippineCalendarDate } from "../../../shared/calendarDates";
import { workDay } from "../../../shared/workCalendar";
import type { AnalyticsInput, AnalyticsFilters, TaskAnalytic } from "../types";
export const median = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b),
    n = sorted.length;
  return n
    ? n % 2
      ? sorted[(n - 1) / 2]
      : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : null;
};
export function deadlineBucket(row: TaskAnalytic, now = Date.now()) {
  if (row.task.status === "completed") return "closed";
  if (row.overdue) return "overdue";
  const due = workDay(row.task.deadline || row.task.dueDate, "Asia/Manila"),
    today = workDay(now, "Asia/Manila");
  if (due === null || today === null) return "undated";
  const days = due - today;
  return days === 0 ? "today" : days > 0 && days <= 7 ? "soon" : "later";
}
export function deliveryRows({
  tasks,
  projects,
  people,
  facts,
  now = Date.now(),
}: AnalyticsInput): TaskAnalytic[] {
  const names = new Map(people.map((p) => [p.id, p.name])),
    byId = new Map(tasks.map((t) => [t.id, t]));
  return tasks
    .filter((t) => !t.archivedAt && t.status !== "cancelled")
    .map((task) => {
      const submissions = facts.submissions
        .filter((s) => s.kind === "task" && s.taskId === task.id)
        .sort((a, b) => a.submittedAt - b.submittedAt);
      const history = facts.statusHistory
        .filter((s) => s.taskId === task.id)
        .sort((a, b) => a.createdAt - b.createdAt);
      const startedAt = history.find(
        (h) => h.toStatus === "in_progress",
      )?.createdAt;
      const firstSubmitted =
        submissions[0]?.submittedAt ?? task.latestSubmission?.submittedAt;
      const approvals = submissions
        .filter((s) => s.status === "approved" && s.decidedAt)
        .map((s) => s.decidedAt!);
      const completedAt =
        task.status === "completed"
          ? approvals.length
            ? Math.max(...approvals)
            : history
                .slice()
                .reverse()
                .find((h) => h.toStatus === "completed")?.createdAt
          : undefined;
      const progress = facts.progress
        .filter((p) => p.kind === "task" && p.taskId === task.id)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      const blocked =
        !!progress?.blocker?.trim() &&
        progress.blockerCategory?.toLowerCase() !== "none";
      const deadline = workloadDeadline(task),
        overdue =
          task.status !== "completed" && deadline !== null && deadline < now;
      const ids = [...new Set(task.dependencyIds || [])];
      const leadId = task.assigneeId || task.recommendationLeadId;
      return {
        task,
        project: projects.find(
          (p) => p.id === (task.linkedProjectId || task.projectId),
        ),
        lead: names.get(leadId || "") || task.assigneeName || "Unassigned",
        participants: [
          ...new Set(
            [leadId, ...(task.teamMemberIds || [])].filter(
              (v): v is string => !!v,
            ),
          ),
        ],
        state:
          task.status === "completed"
            ? "completed"
            : task.status === "for_review"
              ? "for_review"
              : blocked
                ? "stuck"
                : task.status,
        overdue,
        overdueDays: overdue
          ? Math.max(1, Math.ceil((now - deadline!) / 86400000))
          : 0,
        prerequisites: ids.flatMap((id) => {
          const t = byId.get(id);
          return t && t.status !== "completed" ? [t] : [];
        }),
        missingPrerequisites: ids.filter((id) => !byId.has(id)).length,
        firstSubmitted,
        completedAt,
        startedAt,
        turnaroundHours:
          task.status === "completed" &&
          startedAt !== undefined &&
          firstSubmitted !== undefined &&
          firstSubmitted >= startedAt
            ? (firstSubmitted - startedAt) / 3600000
            : null,
        reviewHours:
          submissions.length &&
          submissions.every(
            (s) => s.decidedAt !== undefined && s.decidedAt >= s.submittedAt,
          )
            ? submissions.reduce(
                (n, s) => n + (s.decidedAt! - s.submittedAt) / 3600000,
                0,
              )
            : null,
        onTime:
          firstSubmitted !== undefined && deadline !== null
            ? firstSubmitted <= deadline
            : null,
        revisions: submissions.filter((s) => s.status === "changes_requested")
          .length,
      };
    });
}
export function filterDeliveryRows(
  rows: TaskAnalytic[],
  filter: AnalyticsFilters,
) {
  return rows.filter((r) => {
    const day = workDay(r.task.deadline || r.task.dueDate, "Asia/Manila"),
      due =
        day === null ? "" : new Date(day * 86400000).toISOString().slice(0, 10);
    return (
      (!filter.project || r.project?.id === filter.project) &&
      (!filter.person || r.participants.includes(filter.person)) &&
      (!filter.status || r.state === filter.status) &&
      (!filter.overdue || r.overdue) &&
      (!filter.from || (!!due && due >= filter.from)) &&
      (!filter.to || (!!due && due <= filter.to)) &&
      (!filter.query ||
        `${r.task.title} ${r.project?.title || ""} ${r.lead}`
          .toLowerCase()
          .includes(filter.query.toLowerCase()))
    );
  });
}
export function peopleDelivery(
  rows: TaskAnalytic[],
  people: AnalyticsInput["people"],
) {
  return people.map((person) => {
    const own = rows.filter(
        (r) => (r.task.assigneeId || r.task.recommendationLeadId) === person.id,
      ),
      participating = rows.filter((r) => r.participants.includes(person.id)),
      finished = own.filter((r) => r.task.status === "completed");
    const timed = finished.filter((r) => r.turnaroundHours !== null),
      dated = own.filter((r) => r.onTime !== null),
      late = dated.filter((r) => r.onTime === false).length;
    return {
      ...person,
      leading: own.length,
      contributing: participating.length - own.length,
      active: own.filter((r) => r.task.status !== "completed").length,
      completed: finished.length,
      overdue: own.filter((r) => r.overdue).length,
      late,
      dated: dated.length,
      onTime: dated.filter((r) => r.onTime).length,
      lateRate: dated.length ? Math.round((late / dated.length) * 100) : null,
      medianHours: median(timed.map((r) => r.turnaroundHours!)),
      samples: timed.length,
      reviewHours: median(
        finished.flatMap((r) =>
          r.reviewHours === null ? [] : [r.reviewHours],
        ),
      ),
      revisions: own.reduce((n, r) => n + r.revisions, 0),
      estimatedHours: own.reduce((n, r) => n + (r.task.estimatedHours || 0), 0),
    };
  });
}
export function completionTrend(rows: TaskAnalytic[], now = Date.now()) {
  const today = getPhilippineCalendarDate(new Date(now)),
    end = Date.parse(today + "T00:00:00Z") + 86400000;
  return Array.from({ length: 8 }, (_, i) => {
    const to = end - (7 - i) * 7 * 86400000,
      from = to - 7 * 86400000;
    const tasks = rows.filter(
      (r) =>
        r.completedAt !== undefined &&
        Date.parse(
          getPhilippineCalendarDate(new Date(r.completedAt)) + "T00:00:00Z",
        ) >= from &&
        Date.parse(
          getPhilippineCalendarDate(new Date(r.completedAt)) + "T00:00:00Z",
        ) < to,
    );
    return {
      from: new Date(from).toISOString().slice(0, 10),
      to: new Date(to - 1).toISOString().slice(0, 10),
      label: new Date(from).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      count: tasks.length,
      ids: tasks.map((r) => r.task.id),
    };
  });
}
