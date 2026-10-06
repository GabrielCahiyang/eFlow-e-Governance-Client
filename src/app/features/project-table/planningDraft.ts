import type { Task } from '../tasks';
import type { WorkspaceTaskPatch } from './types';

export function timelineDraft(task: Task) {
  return { start: task.startDate || '', end: (task.deadline || task.dueDate || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || '' };
}
/** Change the calendar part only; existing due-time/offset conventions stay intact. */
export function timelinePatch(task: Task, draft: ReturnType<typeof timelineDraft>): WorkspaceTaskPatch {
  if (draft.start && draft.end && draft.start > draft.end) throw new Error('Start date must precede the due date.');
  const suffix = (task.deadline || task.dueDate || '').match(/^\d{4}-\d{2}-\d{2}(T.*)$/)?.[1] || '';
  return { start_date: draft.start || null, deadline: draft.end ? draft.end + suffix : '' };
}
export function numericPatch(field: 'estimated_hours' | 'budget_impact', draft: string): WorkspaceTaskPatch {
  const next = Number(draft), max = field === 'estimated_hours' ? 100000 : 1e12;
  if (!Number.isFinite(next) || next < 0 || next > max) throw new Error('Enter an amount from 0 to ' + max.toLocaleString() + '.');
  return { [field]: next };
}
