import { visibleProjectTasks, inlineStatusOptions, canEditProjectTask } from '../project-table';
import { isOverdue, type Task, type TaskStatus } from '../tasks';
import { parseCalendarDate } from '../../shared/scheduling/relativeSchedule';
import type { ProjectViewFilters, TaskScheduleRow } from './types';

export function filterProjectViewTasks(tasks: Task[], filters: ProjectViewFilters) {
  return visibleProjectTasks(tasks, filters.query, filters.status, filters.owner, filters.sort)
    .filter(task => !filters.office || task.orgId === filters.office);
}
export function calendarDay(value?: string | null): number | null {
  const parsed = parseCalendarDate(value);
  if (parsed === null) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}
export function dayString(day: number): string { return new Date(day * 86400000).toISOString().slice(0, 10); }
export function replaceDatePart(value: string | undefined, date: string): string {
  return date + (value?.match(/^\d{4}-\d{2}-\d{2}(T.*)$/)?.[1] || '');
}
export function scheduledTaskRows(tasks: Task[]): TaskScheduleRow[] {
  return tasks.flatMap(task => {
    const end = calendarDay(task.deadline || task.dueDate);
    const start = calendarDay(task.startDate);
    if (end === null || (start !== null && start > end)) return [];
    return [{ task, start: start ?? end, end, point: start === null }];
  });
}
export function shiftedTaskDates(task: Task, days: number, edge: 'move' | 'start' | 'end') {
  const end = calendarDay(task.deadline || task.dueDate);
  const start = calendarDay(task.startDate);
  if (end === null) throw new Error('Set a due date before moving this task.');
  const nextStart = start === null ? null : start + (edge === 'end' ? 0 : days);
  const nextEnd = end + (edge === 'start' ? 0 : days);
  if (nextStart !== null && nextStart > nextEnd) throw new Error('Start date must precede the due date.');
  return { start_date: nextStart === null ? null : dayString(nextStart), deadline: replaceDatePart(task.deadline || task.dueDate, dayString(nextEnd)) };
}
export function projectBoardMoveError(task: Task, status: TaskStatus, userId: string, structuralEdit: boolean, readOnly: boolean): string | null {
  if (task.status === status) return null;
  if (readOnly || task.archivedAt || ['completed', 'cancelled'].includes(task.status)) return 'This task is read-only in the Board.';
  if (status === 'for_review') return 'Open task details and use Submit for Review to record the required evidence.';
  if (status === 'completed' || status === 'changes_requested') return 'Completion and revision decisions require the existing review workflow.';
  if (inlineStatusOptions(task, userId, structuralEdit).includes(status)) return null;
  return 'This move is not available. Use task details for assignment and lifecycle actions.';
}
export { canEditProjectTask };

export function officeTaskSummaries(tasks: Task[]) {
  const groups = new Map<string, Task[]>();
  tasks.forEach(task => { const id = task.orgId || ''; groups.set(id, [...(groups.get(id) || []), task]); });
  return Array.from(groups, ([officeId, items]) => ({ officeId, tasks: items, total: items.length,
    completed: items.filter(t => t.status === 'completed').length,
    active: items.filter(t => !['completed', 'cancelled'].includes(t.status)).length,
    overdue: items.filter(t => !['completed', 'cancelled'].includes(t.status) && isOverdue(t)).length }));
}
/** Longest dated dependency chain, not a claim of a fully resource-constrained critical path. */
export function longestDependencyChain(tasks: Task[]): string[] {
  const rows = scheduledTaskRows(tasks).filter(r => !r.point && !r.task.archivedAt && !['completed', 'cancelled'].includes(r.task.status));
  const byId = new Map(rows.map(r => [r.task.id, r]));
  const memo = new Map<string, { days: number; ids: string[] }>();
  const visiting = new Set<string>();
  let cycle = false;
  const visit = (id: string): { days: number; ids: string[] } => {
    if (visiting.has(id)) { cycle = true; return { days: 0, ids: [] }; }
    if (memo.has(id)) return memo.get(id)!;
    const row = byId.get(id);
    if (!row) return { days: 0, ids: [] };
    visiting.add(id);
    const predecessors = (row.task.dependencyIds || []).filter(p => byId.has(p)).map(visit);
    const best = predecessors.reduce((a, b) => b.days > a.days ? b : a, { days: 0, ids: [] } as { days: number; ids: string[] });
    visiting.delete(id);
    const result = { days: best.days + row.end - row.start + 1, ids: [...best.ids, id] };
    memo.set(id, result); return result;
  };
  const result = rows.map(r => visit(r.task.id)).reduce((a, b) => b.days > a.days ? b : a, { days: 0, ids: [] } as { days: number; ids: string[] });
  return cycle || result.ids.length < 2 ? [] : result.ids;
}
