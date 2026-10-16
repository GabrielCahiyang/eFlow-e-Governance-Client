import type { Task } from '../tasks';
import type { ProjectGroup } from './types';

export function groupDeleteBlocker(group: ProjectGroup, tasks: Task[], canManage: boolean): string | undefined {
  if (!canManage) return 'Only the project’s authorized Head can change its groups.';
  if (group.isDefault) return 'The default group must remain available for project work.';
  if (tasks.some(task => task.groupId === group.id)) return 'This group still has tasks. Move or delete them first. Archived tasks must be moved too.';
}
