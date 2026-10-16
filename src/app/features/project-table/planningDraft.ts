import type { Task } from '../tasks';
import type { WorkspaceTaskPatch } from './types';

export interface TimelineDraft { start: string; end: string; time?: string }
const pad = (value: number) => String(value).padStart(2, '0');
export function todayDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function timelineDraft(task: Task): TimelineDraft {
  const due = task.deadline || task.dueDate || '';
  return { start: task.startDate || '', end: due.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '', time: due.match(/T(\d{2}:\d{2})/)?.[1] || '' };
}
function deadlineValue(task: Task, draft: TimelineDraft) {
  if (!draft.end) return '';
  const time = draft.time ?? timelineDraft(task).time;
  // Existing timestamps keep their recorded timezone; new dates use the local
  // offset on the chosen day (including daylight-saving changes).
  const recordedOffset = (task.deadline || task.dueDate || '').match(/T.*?(Z|[+-]\d{2}:\d{2})$/)?.[1];
  const minutes = -new Date(`${draft.end}T${time || '23:59'}:00`).getTimezoneOffset();
  const offset = recordedOffset || `${minutes < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
  return `${draft.end}T${time || '23:59'}:00${offset}`;
}
export function timelineError(task: Task, draft: TimelineDraft, now = new Date()): string | undefined {
  for (const day of [draft.start, draft.end]) {
    if (day && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || todayDate(new Date(day + 'T12:00:00')) !== day)) return 'Enter a valid date.';
  }
  if (draft.start && draft.end && draft.start > draft.end) return 'Due date cannot be before the start date.';
  const today = todayDate(now);
  if (draft.end && draft.end < today) return 'Choose today or a future due date.';
  // A task that already started keeps its history when its due date changes.
  if (draft.start && draft.start !== (task.startDate || '') && draft.start < today) return 'Choose today or a future start date.';
  if (draft.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return 'Enter a valid time.';
  if (draft.time && !draft.end) return 'Choose a due date before setting a time.';
  if (draft.end && new Date(deadlineValue(task, draft)).getTime() < Math.floor(now.getTime() / 60000) * 60000) return 'Choose a due time that has not passed.';
}
export function timelinePatch(task: Task, draft: TimelineDraft, now = new Date()): WorkspaceTaskPatch {
  const error = timelineError(task, draft, now);
  if (error) throw new Error(error);
  return { start_date: draft.start || null, deadline: deadlineValue(task, draft) };
}
export function numericPatch(field: 'estimated_hours' | 'budget_impact', draft: string): WorkspaceTaskPatch {
  const next = Number(draft), max = field === 'estimated_hours' ? 100000 : 1e12;
  if (!Number.isFinite(next) || next < 0 || next > max) throw new Error('Enter an amount from 0 to ' + max.toLocaleString() + '.');
  return { [field]: next };
}
