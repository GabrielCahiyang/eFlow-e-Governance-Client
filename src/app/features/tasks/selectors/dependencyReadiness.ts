import type { Task } from '../taskTypes';
/** Missing/restricted prerequisites cannot be treated as completed. */
export function pendingTaskDependencies(task:Pick<Task,'dependencyIds'>,tasks:Task[]) {
  return (task.dependencyIds||[]).filter(id=>tasks.find(candidate=>candidate.id===id)?.status!=='completed');
}

/**
 * Presentation readiness only; the lifecycle RPC rechecks the current rows.
 * Start is date-neutral: the planned start date is informational and never
 * gates Start. Every selected prerequisite must still be completed.
 * `now` is retained for call-site compatibility.
 */
export function taskStartBlocker(task: Pick<Task, 'dependencyIds' | 'startDate'>, tasks: Task[], _now: Date | string = new Date()): string | null {
  if (pendingTaskDependencies(task, tasks).length) return 'Complete and approve every prerequisite task before starting this work.';
  return null;
}
