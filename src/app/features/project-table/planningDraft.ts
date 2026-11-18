import type { Task } from '../tasks';
import type { WorkspaceTaskPatch } from './types';

export interface TimelineDraft { start: string; end: string }
const pad = (value: number) => String(value).padStart(2, '0');
export function todayDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function timelineDraft(task: Task): TimelineDraft {
  const due = task.deadline || task.dueDate || '';
  return { start: task.startDate || '', end: due.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '' };
}
export interface ProjectTimelineBounds { start?: string; end?: string }
export function timelineError(task: Task, draft: TimelineDraft, now = new Date(), projectBounds?: ProjectTimelineBounds): string | undefined {
  for (const day of [draft.start, draft.end]) {
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || todayDate(new Date(day + 'T12:00:00')) !== day)) return 'Enter a valid date.';
  }
  if (draft.start && draft.end && draft.start > draft.end) return 'Due date cannot be before the start date.';
  const today = todayDate(now);
  if (draft.end && draft.end < today) return 'Choose today or a future due date.';
  // A task that already started keeps its history when its due date changes.
  if (draft.start && draft.start !== (task.startDate || '') && draft.start < today) return 'Choose today or a future start date.';
  const projectStart = projectBounds?.start?.slice(0, 10) || '';
  const projectEnd = projectBounds?.end?.slice(0, 10) || '';
  if (projectStart && draft.start && draft.start < projectStart) return `Start date cannot be before the project start date (${projectStart}).`;
  if (projectStart && draft.end && draft.end < projectStart) return `Due date cannot be before the project start date (${projectStart}).`;
  if (projectEnd && draft.end && draft.end > projectEnd) return `Due date cannot be after the project target date (${projectEnd}).`;
  if (projectEnd && draft.start && draft.start > projectEnd) return `Start date cannot be after the project target date (${projectEnd}).`;
}
export function timelinePatch(task: Task, draft: TimelineDraft, now = new Date(), projectBounds?: ProjectTimelineBounds): WorkspaceTaskPatch {
  const error = timelineError(task, draft, now, projectBounds);
  if (error) throw new Error(error);
  return { start_date: draft.start || null, deadline: draft.end };
}
export function numericPatch(field: 'budget_impact', draft: string): WorkspaceTaskPatch {
  const next = Number(draft), max = 1e12;
  if (!Number.isFinite(next) || next < 0 || next > max) throw new Error('Enter an amount from 0 to ' + max.toLocaleString() + '.');
  return { [field]: next };
}
