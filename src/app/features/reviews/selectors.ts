import { isAdminRole } from "../../shared/roles";
import type { Task } from "../../services/taskService";
import { isHeadWorkspaceRole } from "../../shared/roles";

export type ReviewWorkspaceKind = "tasks" | "subtasks";

export function getInitialReviewWorkspaceKind(
  scope: "department" | "leading",
): ReviewWorkspaceKind {
  return scope === "leading" ? "subtasks" : "tasks";
}

export function canOpenBudgetReviewWorkspace(
  scope: "department" | "leading",
  role?: string,
): boolean {
  return scope === "leading" || isHeadWorkspaceRole(role);
}

export function canUserReviewTask(
  task: Task,
  userId?: string,
  role?: string,
): boolean {
  if (!userId || task.latestSubmission?.submitterId === userId) return false;
  return (
    isAdminRole(role) ||
    task.reviewerId === userId ||
    task.backupReviewerId === userId
  );
}

export function isTaskVisibleInReviewQueue(
  task: Task,
  userId?: string,
  role?: string,
): boolean {
  return (
    task.status === "for_review" &&
    !task.archivedAt &&
    canUserReviewTask(task, userId, role)
  );
}
