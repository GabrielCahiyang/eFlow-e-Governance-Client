import { useRef } from 'react';
import { deleteTask, type Task } from '../../tasks';
import { useReviewedMutation } from '../../../shared/useReviewedMutation';

/** Uses the existing audited soft-delete command; project history is retained. */
export function useProjectTaskDeletion(task: Task, allowed: boolean) {
  const current = useRef({ task, allowed });
  current.current = { task, allowed };
  const action = useReviewedMutation(`project-task-delete:${task.id}`);
  const remove = async () => {
    if (!allowed) return;
    await action.run({
      key: `delete:${task.updatedAt}`,
      confirmation: {
        title: 'Delete task?',
        description: `Remove “${task.title}” and its subtasks from the project? Previous work is kept in the history.`,
        actionLabel: 'Delete task',
        danger: true,
      },
      validate: () => {
        if (!current.current.allowed || current.current.task.updatedAt !== task.updatedAt)
          throw new Error('This task changed. Reopen its menu and try again.');
      },
      operation: () => deleteTask(task.id),
      success: 'Task deleted.',
    });
  };
  return { ...action, remove };
}
