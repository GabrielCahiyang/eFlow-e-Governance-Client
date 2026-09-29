import type { Employee } from "../../employees";
import type { Task } from "../../tasks";
import { calculateDeadlineWorkload, isActive, isOverdue, parseDueDate } from "../../tasks";
import type { TeamMemberMetrics, TeamWorkflowFacts } from "../types";
import { DAY, deliveryQuality, hasBlocker, latestProgressByWorkItem, taskParticipantIds } from "./analyticsHelpers";

export function buildTeamMemberMetrics(
  employees: Employee[],
  tasks: Task[],
  facts: TeamWorkflowFacts,
  now: number = Date.now(),
): TeamMemberMetrics[] {
  const latestProgress = latestProgressByWorkItem(facts.progress);
  return employees.map((employee) => {
    const participating = tasks.filter((task) => taskParticipantIds(task).includes(employee.id));
    const activeTasks = participating.filter(isActive);
    const leadingTasks = activeTasks.filter((task) => task.assigneeId === employee.id);
    const assignedSubtasks = facts.subtasks.filter((subtask) => subtask.assignedToIds.includes(employee.id));
    const activeSubtasks = assignedSubtasks.filter((subtask) => subtask.status !== "completed");
    const overdue = activeTasks.filter((task) => isOverdue(task, now)).length;
    const dueSoon = activeTasks.filter((task) => {
      const due = parseDueDate(task);
      return due !== null && due >= now && due <= now + 7 * DAY;
    }).length;
    const blockedTasks = activeTasks.filter((task) => hasBlocker(latestProgress.get(`task:${task.id}`)));
    const blockedSubtasks = activeSubtasks.filter((subtask) => hasBlocker(latestProgress.get(`subtask:${subtask.id}`)));
    const blocked = blockedTasks.length + blockedSubtasks.length;
    const awaitingTaskReview = tasks.filter((task) => task.status === "for_review" && (task.reviewerId === employee.id || task.backupReviewerId === employee.id)).length;
    const awaitingSubtaskReview = facts.submissions.filter((submission) => submission.kind === "subtask" && submission.status === "pending" && submission.reviewerId === employee.id).length;
    const awaitingReview = awaitingTaskReview + awaitingSubtaskReview;
    const changesRequested = participating.filter((task) => task.status === "changes_requested").length
      + assignedSubtasks.filter((subtask) => subtask.status === "changes_requested").length;
    const completedContributions = participating.filter((task) => task.status === "completed").length
      + assignedSubtasks.filter((subtask) => subtask.status === "completed").length;
    const activityTimes = [
      ...participating.map((task) => task.lastActivityAt || task.updatedAt),
      ...facts.progress.filter((entry) => entry.authorId === employee.id).map((entry) => entry.createdAt),
      ...facts.submissions.filter((entry) => entry.submitterId === employee.id || entry.reviewerId === employee.id).map((entry) => entry.decidedAt || entry.submittedAt),
    ].filter((value): value is number => Number.isFinite(value));
    const lastActivityAt = activityTimes.length ? Math.max(...activityTimes) : undefined;
    const stale = activeTasks.length + activeSubtasks.length > 0 && Boolean(lastActivityAt && lastActivityAt < now - 3 * DAY);
    const quality = deliveryQuality(facts.submissions, employee.id);
    const workload = calculateDeadlineWorkload(participating, now, employee.id);
    const workloadSignal = workload.signal;
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      recordedWorkload: employee.currentWorkload,
      workloadSignal,
      workload,
      activeTasks: activeTasks.length,
      leadingTasks: leadingTasks.length,
      activeSubtasks: activeSubtasks.length,
      dueSoon,
      overdue,
      blocked,
      awaitingReview,
      changesRequested,
      completedContributions,
      firstPassApprovalRate: quality.firstPassRate,
      revisionRequests: quality.revisionRequests,
      averageReviewHours: quality.averageReviewHours,
      lastActivityAt,
      stale,
    };
  }).sort((first, second) => second.workloadSignal - first.workloadSignal || first.employeeName.localeCompare(second.employeeName));
}

