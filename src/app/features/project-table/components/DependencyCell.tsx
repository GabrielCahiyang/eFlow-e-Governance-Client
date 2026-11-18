import { PrerequisiteCell } from '../../../components/ui/workspace';
import type { Task } from '../../tasks';
import { projectPrerequisiteChoices, projectPrerequisiteError } from '../selectors';
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
    getChoices={() => projectPrerequisiteChoices(tasks, task.linkedProjectId, task.id, task.dependencyIds)}
    disabled={disabled}
    completedLabel="Completed and approved"
    description="This task can start only after every selected task is completed and approved. Cycles are blocked."
    onSave={async ids => {
      const issue = projectPrerequisiteError(tasks, task.linkedProjectId, task.id, ids, task.dependencyIds);
      if (issue) throw new Error(issue);
      await save({ dependency_ids: ids });
    }}
  />;
}
