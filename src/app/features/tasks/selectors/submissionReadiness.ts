import type { Task } from "../taskTypes";

export interface SubtaskReadinessRecord {
  isCompleted?: boolean;
  status?: string;
}

export interface TaskSubmissionReadiness {
  ready: boolean;
  totalSubtasks: number;
  approvedSubtasks: number;
  remainingSubtasks: number;
  awaitingReviewSubtasks: number;
}

/** Parent submission requires completed subitems; subitems have no separate review.
 * Legacy field names remain compatible with existing callers and rollups.
 */
export function getTaskSubmissionReadiness(
  task: Pick<Task, "subtaskCount" | "subtaskCompletedCount">,
  liveSubtasks: SubtaskReadinessRecord[] = [],
): TaskSubmissionReadiness {
  const hasLiveRows = liveSubtasks.length > 0;
  const totalSubtasks = hasLiveRows
    ? liveSubtasks.length
    : Math.max(0, Number(task.subtaskCount || 0));
  const approvedSubtasks = Math.min(
    totalSubtasks,
    hasLiveRows
      ? liveSubtasks.filter(
          (subtask) => subtask.isCompleted || subtask.status === "completed",
        ).length
      : Math.max(0, Number(task.subtaskCompletedCount || 0)),
  );
  const awaitingReviewSubtasks = hasLiveRows
    ? liveSubtasks.filter(
        (subtask) =>
          !subtask.isCompleted && subtask.status === "for_review",
      ).length
    : 0;
  const remainingSubtasks = Math.max(0, totalSubtasks - approvedSubtasks);

  return {
    ready: remainingSubtasks === 0,
    totalSubtasks,
    approvedSubtasks,
    remainingSubtasks,
    awaitingReviewSubtasks,
  };
}
