import type { TaskStatus } from "../../../types";

export type TaskStatusPresentationState = TaskStatus | "rejected" | "cancelled" | "archived";

export interface TaskStatusPresentation {
  label: string;
  description: string;
  color: "dark" | "primary" | "positive" | "negative" | "working_orange" | "purple";
}

const taskStatusPresentation: Record<TaskStatusPresentationState, TaskStatusPresentation> = {
  pending_assignment: {
    label: "Unassigned",
    description: "This task needs an assigned owner.",
    color: "dark",
  },
  todo: {
    label: "To do",
    description: "This task is ready to begin.",
    color: "purple",
  },
  in_progress: {
    label: "In progress",
    description: "Work on this task is underway.",
    color: "primary",
  },
  for_review: {
    label: "For review",
    description: "This task is waiting for a reviewer decision.",
    color: "working_orange",
  },
  changes_requested: {
    label: "Updates needed",
    description: "The submitted work needs updates before approval.",
    color: "negative",
  },
  rejected: {
    label: "Needs changes",
    description: "The submitted work was returned for revision.",
    color: "negative",
  },
  completed: {
    label: "Completed",
    description: "This task has been approved and completed.",
    color: "positive",
  },
  cancelled: {
    label: "Cancelled",
    description: "This task is no longer active.",
    color: "dark",
  },
  archived: {
    label: "Archived",
    description: "This task is retained for recordkeeping.",
    color: "dark",
  },
};

export function getTaskStatusPresentation(status: string): TaskStatusPresentation {
  return taskStatusPresentation[status as TaskStatusPresentationState] ?? {
    label: "Unknown status",
    description: "This task has an unrecognized status.",
    color: "dark",
  };
}
