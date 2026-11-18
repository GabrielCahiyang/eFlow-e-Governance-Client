import { useRef } from 'react';
import { deleteTask, type Task } from '../../tasks';
import { useReviewedMutation } from '../../../shared/useReviewedMutation';

/** Uses the existing audited soft-delete command; project history is retained. */
export function useProjectTaskDeletion(task: Task, allowed: boolean, hasStartedSubtask=false) {
  const hasWorkHistory = ['in_progress','changes_requested'].includes(task.status) ||
    (task.percentComplete ?? 0) !== 0 || !!task.subtaskCompletedCount || hasStartedSubtask;
  const current = useRef({ task, allowed, hasWorkHistory });
  current.current = { task, allowed, hasWorkHistory };
  const action = useReviewedMutation(`project-task-delete:${task.id}`);
  const label='Delete task';
  const remove = async () => {
    if (!allowed) return;
    if(hasWorkHistory)return;
    await action.run({
      key: `delete:${task.updatedAt}`,
      confirmation: {
        title: 'Delete task?',
        description: `Remove the unstarted task "${task.title}" and any unstarted checklist subtasks from the project? The complete branch is checked for work history, dependencies and financial records before deletion. Audit records are retained.`,
        actionLabel: 'Delete task',
        danger: true,
      },
      validate: () => {
        if (!current.current.allowed || current.current.hasWorkHistory || current.current.task.updatedAt !== task.updatedAt)
          throw new Error('This task changed. Reopen its menu and try again.');
      },
      operation: () => deleteTask(task.id),
      success: 'Task deleted.',
    });
  };
  return { ...action, label, remove, unavailable:hasWorkHistory };
}
