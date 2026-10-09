import { isTaskLead, type Task } from '../tasks';
import { calendarDay } from '../project-views';
export const workBuckets = ['All my work', 'Assigned to me', 'Leading', 'Due today', 'Due this week', 'Overdue', 'Recently completed'] as const;
export type WorkBucket = typeof workBuckets[number];
export function isPersonalTask(task: Task, userId?: string): boolean {
  return Boolean(userId && (task.assigneeId === userId || task.recommendationLeadId === userId || task.teamMemberIds?.includes(userId)));
}
export function personalTaskRelation(task: Task, userId?: string): string {
  if (isTaskLead(task, userId)) return 'Task Lead';
  if (task.teamMemberIds?.includes(userId || '')) return 'Team member';
  return 'Recommended lead';
}
/** Local calendar days; week runs Monday–Sunday. Completed uses the existing updatedAt proxy. */
export function selectPersonalWork(tasks: Task[], userId: string | undefined, bucket: WorkBucket, query = '', now = new Date(), assignedBranches:readonly string[]=[]): Task[] {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  const monday = today - (now.getDay() + 6) % 7;
  const needle = query.trim().toLocaleLowerCase();
  return tasks.filter(task => {
    if ((!isPersonalTask(task, userId)&&!assignedBranches.includes(task.id)) || task.archivedAt || task.status === 'cancelled') return false;
    if (bucket === 'Recently completed') {
      const updated = new Date(task.updatedAt);
      const day = Date.UTC(updated.getFullYear(), updated.getMonth(), updated.getDate()) / 86400000;
      if (task.status !== 'completed' || day < today - 6 || day > today) return false;
    } else if (task.status === 'completed') return false;
    if (bucket === 'Assigned to me' && task.assigneeId !== userId && !task.teamMemberIds?.includes(userId || '')&&!assignedBranches.includes(task.id)) return false;
    if (bucket === 'Leading' && !isTaskLead(task, userId)) return false;
    const due = calendarDay(task.deadline || task.dueDate);
    if (bucket === 'Due today' && due !== today) return false;
    if (bucket === 'Due this week' && (due === null || due < monday || due > monday + 6)) return false;
    if (bucket === 'Overdue' && (due === null || due >= today)) return false;
    return !needle || [task.title, task.projectTitle, task.activityTitle, task.teamName, task.department].some(value => value?.toLocaleLowerCase().includes(needle));
  }).sort((a,b) => bucket === 'Recently completed' ? b.updatedAt - a.updatedAt : (calendarDay(a.deadline || a.dueDate) ?? Infinity) - (calendarDay(b.deadline || b.dueDate) ?? Infinity) || a.title.localeCompare(b.title));
}
