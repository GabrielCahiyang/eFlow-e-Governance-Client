import type { Milestone, Project } from "../services/types";
import { isOverdue, type Task } from "../../tasks";
import type { TeamAttentionItem, TeamWorkflowFacts } from "../../team-management";
import type { ProjectActivityItem, ProjectCommandMetrics, ProjectScheduleHealth } from "../components/project-command/types";
import { parseCalendarDate } from "../../../shared/scheduling/relativeSchedule";

const DAY = 86_400_000;
const timestamp = (value?: string): number | undefined => {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
};

export function buildProjectCommandMetrics(
  project: Project,
  tasks: Task[],
  milestones: Milestone[],
  facts: TeamWorkflowFacts,
  attention: TeamAttentionItem[],
  now = Date.now(),
): ProjectCommandMetrics {
  const activeTasks = tasks.filter((task) => !task.archivedAt && task.status !== "cancelled");
  const progress = activeTasks.length
    ? Math.round(activeTasks.reduce((total, task) => total + (task.status === "completed" ? 100 : Math.max(0, Math.min(100, task.percentComplete || 0))), 0) / activeTasks.length)
    : project.status === "completed" ? 100 : 0;
  const overdue = new Set(attention.filter((item) => item.kind === "overdue").map((item) => item.taskId)).size;
  const blocked = attention.filter((item) => item.kind === "blocked").length;
  const awaitingReview = facts.submissions.filter((item) => item.status === "pending").length;
  const changesRequested = facts.submissions.filter((item) => item.status === "changes_requested").length;
  const taskCompleted = activeTasks.filter((task) => task.status === "completed").length;
  const completionRecommended = project.status !== "completed" && activeTasks.length > 0 && taskCompleted === activeTasks.length;

  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetParsed = project.targetDate ? parseCalendarDate(project.targetDate) ?? timestamp(project.targetDate) : undefined;
  const isTargetOverdue = targetParsed !== undefined && targetParsed < todayStart;
  const isTargetDueSoon = targetParsed !== undefined && targetParsed >= todayStart && targetParsed <= todayStart + 14 * DAY;

  let scheduleHealth: ProjectScheduleHealth = "on_track";
  if (project.status === "completed") scheduleHealth = "completed";
  else if (overdue > 0 || isTargetOverdue) scheduleHealth = "overdue";
  else if (blocked > 0 || changesRequested > 0 || milestones.some((milestone) => milestone.manualStatus === "at_risk")) scheduleHealth = "at_risk";
  else if (isTargetDueSoon || attention.some((item) => item.kind === "due_soon")) scheduleHealth = "due_soon";

  const taskDeadlines = activeTasks.map((task) => task.deadline || task.dueDate).filter((date): date is string => Boolean(date));
  const milestoneDeadlines = milestones.filter((milestone) => milestone.status !== "completed").map((milestone) => milestone.dueDate).filter((date): date is string => Boolean(date));
  const nextDeadline = [...taskDeadlines, ...milestoneDeadlines]
    .filter((date) => (parseCalendarDate(date) ?? timestamp(date) ?? 0) >= todayStart)
    .sort((a, b) => (parseCalendarDate(a) ?? timestamp(a) ?? 0) - (parseCalendarDate(b) ?? timestamp(b) ?? 0))[0];
  const activityTimes = [project.updatedAt, ...activeTasks.map((task) => task.lastActivityAt || task.updatedAt), ...facts.progress.map((item) => item.createdAt), ...facts.submissions.map((item) => item.decidedAt || item.submittedAt)];

  return {
    progress,
    scheduleHealth,
    taskTotal: activeTasks.length,
    taskCompleted,
    milestoneOpen: milestones.filter((milestone) => milestone.status !== "completed" && milestone.manualStatus !== "completed").length,
    milestoneCompleted: milestones.filter((milestone) => milestone.status === "completed" || milestone.manualStatus === "completed").length,
    overdue,
    blocked,
    awaitingReview,
    changesRequested,
    completionRecommended,
    activeLeadIds: Array.from(new Set(activeTasks.map((task) => task.recommendationLeadId || task.assigneeId).filter((id): id is string => Boolean(id)))),
    nextDeadline,
    lastActivityAt: activityTimes.length ? Math.max(...activityTimes.filter(Number.isFinite)) : undefined,
  };
}

export function buildProjectActivity(facts: TeamWorkflowFacts, projectEvents: ProjectActivityItem[] = []): ProjectActivityItem[] {
  return [
    ...projectEvents,
    ...facts.statusHistory.map((item) => ({ id: `status:${item.id}`, kind: "status" as const, title: `Task moved to ${item.toStatus.replace(/_/g, " ")}`, detail: item.note || "Status updated", actorName: item.actorName, occurredAt: item.createdAt, taskId: item.taskId })),
    ...facts.progress.map((item) => ({ id: `progress:${item.id}`, kind: "progress" as const, title: item.kind === "subtask" ? "Subtask progress updated" : "Task progress updated", detail: item.blocker || item.note || item.nextStep || `${item.percentComplete || 0}% complete`, actorName: item.authorName, occurredAt: item.createdAt, taskId: item.taskId })),
    ...facts.submissions.map((item) => ({ id: `submission:${item.id}`, kind: "submission" as const, title: `${item.kind === "subtask" ? "Subtask" : "Task"} ${item.status === "pending" ? "submitted for review" : item.status.replace(/_/g, " ")}`, detail: item.feedback || `Attempt ${item.version}`, actorName: item.submitterName, occurredAt: item.decidedAt || item.submittedAt, taskId: item.taskId })),
  ].sort((a, b) => b.occurredAt - a.occurredAt || b.id.localeCompare(a.id));
}

export interface ProjectWorkGroup {
  id: string;
  title: string;
  dueDate?: string;
  tasks: Task[];
  needsActivityAssignment: boolean;
}

/**
 * Groups operational tasks under the proposal activity represented internally
 * by a milestone. Invalid legacy links are surfaced as a repair queue instead
 * of presenting "unscheduled work" as a normal planning choice.
 */
export function buildProjectWorkGroups(tasks: Task[], milestones: Milestone[]): ProjectWorkGroup[] {
  const activityIds = new Set(milestones.map((milestone) => milestone.id));
  const groups: ProjectWorkGroup[] = milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
    dueDate: milestone.dueDate,
    tasks: tasks.filter((task) => task.milestoneId === milestone.id),
    needsActivityAssignment: false,
  }));
  const needsAssignment = tasks.filter((task) => !task.milestoneId || !activityIds.has(task.milestoneId));
  if (needsAssignment.length) {
    groups.push({
      id: "needs-activity-assignment",
      title: "Needs activity assignment",
      tasks: needsAssignment,
      needsActivityAssignment: true,
    });
  }
  return groups.filter((group) => group.tasks.length > 0);
}

export function buildProjectPortfolioSummary(project: Project, tasks: Task[], now = Date.now()) {
  const live = tasks.filter((task) => task.linkedProjectId === project.id && !task.archivedAt && task.status !== "cancelled");
  const completed = live.filter((task) => task.status === "completed").length;
  const progress = live.length ? Math.round(live.reduce((sum, task) => sum + (task.status === "completed" ? 100 : task.percentComplete || 0), 0) / live.length) : project.status === "completed" ? 100 : 0;
  const overdue = live.filter((task) => isOverdue(task, now)).length;
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetParsed = project.targetDate ? parseCalendarDate(project.targetDate) ?? timestamp(project.targetDate) : undefined;
  const isTargetOverdue = targetParsed !== undefined && targetParsed < todayStart;
  const isTargetDueSoon = targetParsed !== undefined && targetParsed >= todayStart && targetParsed <= todayStart + 14 * DAY;
  const awaitingReview = live.filter((task) => task.status === "for_review").length;
  const changesRequested = live.filter((task) => task.status === "changes_requested").length;
  const leadIds = Array.from(new Set(live.map((task) => task.recommendationLeadId || task.assigneeId).filter((id): id is string => Boolean(id))));
  const deadlines = live
    .map((task) => task.deadline || task.dueDate)
    .filter((date): date is string => Boolean(date))
    .filter((date) => (parseCalendarDate(date) ?? timestamp(date) ?? 0) >= todayStart)
    .sort((a, b) => (parseCalendarDate(a) ?? timestamp(a) ?? 0) - (parseCalendarDate(b) ?? timestamp(b) ?? 0));
  const health: ProjectScheduleHealth = project.status === "completed" ? "completed" : overdue || isTargetOverdue ? "overdue" : changesRequested ? "at_risk" : isTargetDueSoon ? "due_soon" : "on_track";
  const completionRecommended = project.status !== "completed" && live.length > 0 && completed === live.length;
  return { progress, completed, total: live.length, isEmpty: live.length === 0 && project.status !== "completed", overdue, awaitingReview, changesRequested, leadIds, nextDeadline: deadlines[0] || project.targetDate, health, completionRecommended, lastActivityAt: Math.max(project.updatedAt, ...live.map((task) => task.lastActivityAt || task.updatedAt)) };
}
