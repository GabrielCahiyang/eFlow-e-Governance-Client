import type { Task } from '../tasks';
import type { ProjectGroup } from './types';
import type { Subtask } from '../subtasks';
import { tasksInGroup } from './selectors';

export function groupDeleteBlocker(group: ProjectGroup, tasks: Task[], canManage: boolean, subtasks: Subtask[] = []): string | undefined {
  if (!canManage) return 'Only the project’s authorized Head can change its groups.';
  const members = tasksInGroup(tasks, group);
  if (members.some(task => task.archivedAt)) return 'Move archived tasks out of this group before deleting it.';
  if (members.some(task => !['todo', 'pending_assignment'].includes(task.status) || (task.percentComplete || 0) > 0 || task.latestSubmission || (task.subtaskCompletedCount || 0) > 0)) return 'Some work has already started. Move those tasks before deleting this group.';
  const ids = new Set(members.map(task => task.id));
  if (subtasks.some(item => ids.has(item.taskId) && (item.status !== 'todo' || item.percentComplete > 0 || item.isCompleted || item.latestSubmissionId || item.completedAt))) return 'A subitem has already started. Move its task before deleting this group.';
}
