import type { Subtask } from "../../../services/subtaskService";

import {deadlinePresentation} from '../../../shared/deadlinePresentation';

export type SubtaskDeadlineTone = "none" | "on_track" | "due_soon" | "overdue" | "completed";

export interface SubtaskDeadlineState {
  tone: SubtaskDeadlineTone;
  label: string;
  dueAt?: number;
  days?: number;
}

export function isoDateTimestamp(value?: string | null): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function parentTaskDueDate(deadline?: string | null, dueDate?: string | null): string | undefined {
  const candidate = dueDate || deadline;
  return candidate && /^\d{4}-\d{2}-\d{2}/.test(candidate) ? candidate.slice(0, 10) : undefined;
}

export function getSubtaskDeadlineState(subtask: Pick<Subtask, "dueDate" | "isCompleted" | "status">, now = Date.now()): SubtaskDeadlineState {
  if (subtask.isCompleted || subtask.status === "completed") return { tone: "completed", label: "Completed" };
  const dueAt = isoDateTimestamp(subtask.dueDate);
  if (dueAt === undefined) return { tone: "none", label: "No due date" };
  const state = deadlinePresentation(subtask.dueDate, subtask.status, now);
  const tone = {red: 'overdue', yellow: 'due_soon', green: 'on_track', neutral: 'none'} as const;
  return {tone: tone[state.tone], label: state.label, dueAt, days: state.days};
}
