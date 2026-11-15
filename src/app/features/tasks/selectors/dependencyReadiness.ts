import type { Task } from '../taskTypes';
import { workDay } from '../../../shared/workCalendar';
/** Missing/restricted prerequisites cannot be treated as completed. */
export function pendingTaskDependencies(task:Pick<Task,'dependencyIds'>,tasks:Task[]) {
  return (task.dependencyIds||[]).filter(id=>tasks.find(candidate=>candidate.id===id)?.status!=='completed');
}

/** Presentation readiness only; the lifecycle RPC rechecks the current rows. */
export function taskStartBlocker(task: Pick<Task, 'dependencyIds' | 'startDate'>, tasks: Task[], now: Date | string = new Date()): string | null {
  if (pendingTaskDependencies(task, tasks).length) return 'Complete and approve every prerequisite task before starting this work.';
  const start = workDay(task.startDate, 'Asia/Manila');
  const today = workDay(now, 'Asia/Manila');
  if (start === null) return 'Set a planned start date before starting this task.';
  if (today === null || start > today) return `You can start this task on or after ${task.startDate}.`;
  return null;
}
