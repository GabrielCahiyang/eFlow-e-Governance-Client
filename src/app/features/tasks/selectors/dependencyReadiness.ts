import type { Task } from '../taskTypes';
/** Missing/restricted prerequisites cannot be treated as completed. */
export function pendingTaskDependencies(task:Pick<Task,'dependencyIds'>,tasks:Task[]) {
  return (task.dependencyIds||[]).filter(id=>tasks.find(candidate=>candidate.id===id)?.status!=='completed');
}
