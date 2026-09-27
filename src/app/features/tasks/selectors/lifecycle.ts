import type { Task } from "../../../services/taskService";
import { resolveScheduleTimestamp } from "../../../shared/scheduling/relativeSchedule";

export function isArchived(task: Task): boolean {
  return !!task.archivedAt;
}

export function isUnassigned(task: Task): boolean {
  return !task.assigneeId;
}

export function isCompleted(task: Task): boolean {
  return task.status === "completed";
}

export function isActive(task: Task): boolean {
  return !isArchived(task) && !isCompleted(task) && task.status !== "cancelled";
}

export function isForReview(task: Task): boolean {
  return task.status === "for_review";
}

export function parseDueDate(task: Task): number | null {
  const raw = task.dueDate || task.deadline;
  const anchor = Number.isFinite(task.createdAt) ? task.createdAt : Date.now();
  const fromDeadline = resolveScheduleTimestamp(raw, anchor);
  if (fromDeadline !== null) return fromDeadline;
  return resolveScheduleTimestamp(task.activitySchedule, anchor);
}

export function isOverdue(task: Task, now: number = Date.now()): boolean {
  if (!isActive(task)) return false;
  const due = parseDueDate(task);
  if (due === null) return false;
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return due < todayStart;
}

export function isDueToday(task: Task, now: number = Date.now()): boolean {
  if (!isActive(task)) return false;
  const due = parseDueDate(task);
  if (due === null) return false;
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const todayEnd = todayStart + 86_400_000 - 1;
  return due >= todayStart && due <= todayEnd;
}

export function isDueSoon(task: Task, now: number = Date.now(), daysThreshold = 7): boolean {
  if (!isActive(task)) return false;
  const due = parseDueDate(task);
  if (due === null) return false;
  const today = new Date(now);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const thresholdEnd = todayStart + (daysThreshold + 1) * 86_400_000 - 1;
  return due >= todayStart && due <= thresholdEnd;
}
