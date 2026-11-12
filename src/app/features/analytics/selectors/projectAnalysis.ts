import { workDay } from "../../../shared/workCalendar";
import { workloadDeadline } from "../../tasks";
import type { AnalyticsInput, AnalyticsProject } from "../types";
import { median } from "./deliveryAnalytics";

const hour = 3_600_000;
const timeZone = "Asia/Manila";
const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
export const projectClosed = (project: AnalyticsProject) => ["completed", "archived"].includes(project.status);

export function projectScheduleResult(project: AnalyticsProject, now: number) {
  const target = workDay(project.targetDate, timeZone);
  const actual = workDay(project.completedAt, timeZone);
  if (projectClosed(project)) {
    if (actual === null) return "No completion date recorded";
    if (target === null) return "No target date recorded";
    const difference = actual - target;
    return difference === 0 ? "Completed on the target date"
      : `Completed ${days(Math.abs(difference))} ${difference < 0 ? "early" : "late"}`;
  }
  if (target === null) return "No target date recorded";
  const today = workDay(now, timeZone);
  if (today === null) return "Schedule unavailable";
  const difference = target - today;
  if (difference === 0) return "Due today";
  return difference > 0 ? `Due in ${days(difference)}` : `${days(-difference)} overdue`;
}

function indexByTask<T extends { taskId: string }>(records: T[]) {
  const index = new Map<string, T[]>();
  for (const record of records) {
    const list = index.get(record.taskId);
    if (list) list.push(record);
    else index.set(record.taskId, [record]);
  }
  return index;
}

export function analyzeProject(project: AnalyticsProject, input: AnalyticsInput) {
  const now = input.now ?? Date.now();
  const names = new Map(input.people.map(person => [person.id, person.name]));
  const submissions = indexByTask(input.facts.submissions.filter(record =>
    record.kind === "task" && Number.isFinite(record.submittedAt)));
  const statuses = indexByTask(input.facts.statusHistory.filter(record => Number.isFinite(record.createdAt)));
  const updates = indexByTask(input.facts.progress.filter(record =>
    record.kind === "task" && Number.isFinite(record.createdAt)));
  const closed = projectClosed(project);
  const projectTasks = input.tasks.filter(task => (task.linkedProjectId || task.projectId) === project.id);
  const tasks = projectTasks.filter(task => task.status !== "cancelled" && (!task.archivedAt || task.status === "completed"));
  const taskById = new Map(projectTasks.map(task => [task.id, task]));
  const rows = tasks.map(task => {
    const attempts = (submissions.get(task.id) ?? []).sort((a, b) => a.submittedAt - b.submittedAt);
    const history = (statuses.get(task.id) ?? []).sort((a, b) => a.createdAt - b.createdAt);
    const progress = (updates.get(task.id) ?? []).sort((a, b) => b.createdAt - a.createdAt);
    const recorded = task.latestSubmission;
    const first = attempts.find(attempt => attempt.version === 1)
      ?? (recorded?.version === 1 && Number.isFinite(recorded.submittedAt) ? recorded : undefined);
    const last = attempts[attempts.length - 1];
    const recordedAt = recorded && Number.isFinite(recorded.submittedAt) ? recorded.submittedAt : -Infinity;
    const latestSubmittedAt = Math.max(last?.submittedAt ?? -Infinity, recordedAt);
    const leadId = task.assigneeId || task.recommendationLeadId || task.assignedTo;
    const leadName = names.get(leadId ?? "") || task.assigneeName || "Unassigned";
    const submitterId = first?.submitterId || undefined;
    const submitterName = first && (names.get(submitterId ?? "") || first.submitterName);
    const start = history.find(entry => entry.toStatus === "in_progress" && entry.actorId === submitterId);
    const deadline = task.deadline || task.dueDate ? workloadDeadline(task) : null;
    const completed = task.status === "completed";
    const approval = completed ? attempts.slice().reverse().find(attempt =>
      attempt.status === "approved" && attempt.decidedAt != null
      && attempt.decidedAt >= attempt.submittedAt && attempt.submittedAt >= (task.reopenedAt ?? 0)) : undefined;
    const approvedAt = approval?.decidedAt ?? (completed ? history.slice().reverse().find(entry =>
      entry.toStatus === "completed" && entry.createdAt >= (task.reopenedAt ?? 0))?.createdAt : undefined);
    const reviewedAttempt = approval ?? last;
    const decidedAt = reviewedAttempt?.decidedAt;
    const reviewHours = reviewedAttempt && decidedAt != null && decidedAt >= reviewedAttempt.submittedAt
      ? (decidedAt - reviewedAttempt.submittedAt) / hour : null;
    const pendingSince = task.status === "for_review" ? latestSubmittedAt : undefined;
    const pendingHours = pendingSince != null && Number.isFinite(pendingSince) && pendingSince <= now
      ? (now - pendingSince) / hour : null;
    const contributorIds = [...new Set((task.teamMemberIds ?? []).filter(id => id !== leadId))];
    const activeBlocker = progress[0]?.blockerCategory?.toLowerCase() !== "none" ? progress[0]?.blocker?.trim() : undefined;
    const blocker = progress.find(entry => entry.blocker?.trim() && entry.blockerCategory?.toLowerCase() !== "none");
    const dependencies = [...new Set(task.dependencyIds ?? [])];
    const prerequisites = dependencies.flatMap(id => {
      const prerequisite = taskById.get(id);
      return prerequisite && prerequisite.status !== "completed" ? [prerequisite.title] : [];
    });
    const unavailablePrerequisites = dependencies.filter(id => !taskById.has(id)).length;
    const turnaroundHours = first && submitterId && start?.actorId === submitterId && start.createdAt <= first.submittedAt
      ? (first.submittedAt - start.createdAt) / hour : null;
    const unsubmittedOverdue = !closed && !completed && !Number.isFinite(latestSubmittedAt)
      && task.status !== "for_review" && task.status !== "changes_requested" && deadline !== null && deadline < now;
    return {
      task, completed, deadline, leadId, leadName, contributorIds, submitterId, submitterName,
      submittedAt: first?.submittedAt, latestSubmittedAt: Number.isFinite(latestSubmittedAt) ? latestSubmittedAt : undefined,
      approvedAt, reviewHours, pendingHours, turnaroundHours,
      late: first && deadline !== null ? first.submittedAt > deadline : null,
      unsubmittedOverdue, activeBlocker, blocker, prerequisites, unavailablePrerequisites,
      submitterChanged: !!(submitterId && leadId && submitterId !== leadId),
    };
  });
  const participants = new Map<string, string>();
  for (const row of rows) {
    if (row.leadId) participants.set(row.leadId, row.leadName);
    if (row.submitterId && row.submitterName) participants.set(row.submitterId, row.submitterName);
    for (const id of [row.submitterId, ...row.contributorIds]) {
      if (id && !participants.has(id)) participants.set(id, names.get(id) || "Name unavailable");
    }
  }
  const people = [...participants].map(([id, name]) => {
    const submitted = rows.filter(row => row.submitterId === id);
    const timed = submitted.flatMap(row => row.turnaroundHours === null ? [] : [row.turnaroundHours]);
    const late = submitted.filter(row => row.late === true).length;
    const onTime = submitted.filter(row => row.late === false).length;
    return {
      id, name, late, onTime, samples: timed.length, typicalHours: median(timed),
      leading: rows.filter(row => row.leadId === id).length,
      contributing: rows.filter(row => row.contributorIds.includes(id)).length,
      overdue: rows.filter(row => row.leadId === id && row.unsubmittedOverdue).length,
      reviewHours: median(submitted.flatMap(row => row.reviewHours === null ? [] : [row.reviewHours])),
    };
  });
  return { rows, people, now, closed, schedule: projectScheduleResult(project, now) };
}

export type ProjectAnalysisRow = ReturnType<typeof analyzeProject>["rows"][number];
