import { PrerequisiteCell } from '../../../components/ui/workspace';
import type { Task } from '../../tasks';
import { dependencyWouldCycle } from '../selectors';
import type { WorkspaceTaskPatch } from '../types';

export function DependencyCell({ task, tasks, disabled, save }: {
  task: Task;
  tasks: Task[];
  disabled: boolean;
  save: (patch: WorkspaceTaskPatch) => Promise<void>;
}) {
  return <PrerequisiteCell
    title={task.title}
    itemName="task"
    selectedIds={task.dependencyIds || []}
    records={tasks}
    getChoices={() => tasks.filter(item => item.id !== task.id && !item.archivedAt && item.linkedProjectId === task.linkedProjectId)}
    disabled={disabled}
    completedLabel="Completed and approved"
    description="This task can start only after every selected task is completed and approved. Cycles are blocked."
    onSave={async ids => {
      if (dependencyWouldCycle(tasks, task.id, ids)) throw new Error('Dependencies cannot form a cycle.');
      await save({ dependency_ids: ids });
    }}
  />;
}
