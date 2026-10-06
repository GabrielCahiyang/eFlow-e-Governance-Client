import { isTaskVisibleInReviewQueue } from '../reviews';
import type { Task } from '../tasks';
import type { SubtaskReviewItem } from '../subtasks';
export interface ActionItem { key: string; title: string; context: string; source: 'task-review' | 'subtask-review'; taskId: string; entityLabel?: string; entityId?: string }
export function personalReviewActions(tasks: Task[], subtasks: SubtaskReviewItem[], userId?: string, role?: string): ActionItem[] {
  if (!userId || role === 'admin') return [];
  const parent = tasks.filter(task => isTaskVisibleInReviewQueue(task,userId,role)).map(task => ({key:`task-review:${task.id}`,title:task.title,context:task.projectTitle || task.teamName || 'Task review',source:'task-review' as const,taskId:task.id}));
  const children = subtasks.filter(item => item.submission.status === 'pending' && item.submission.reviewerId === userId && item.submission.submitterId !== userId && !['completed','cancelled'].includes(item.subtask.status)).map(item => ({key:`subtask-review:${item.subtask.id}`,title:item.subtask.title,context:item.projectTitle || item.taskTitle,source:'subtask-review' as const,taskId:item.subtask.taskId,entityLabel:item.subtask.title,entityId:item.subtask.id}));
  return Array.from(new Map([...parent,...children].map(item => [item.key,item])).values());
}
