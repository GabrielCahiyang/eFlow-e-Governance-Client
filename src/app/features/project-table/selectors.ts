import type { Task } from '../tasks';
import { getTaskTeamMemberIds } from '../tasks';
import type { ProjectGroup } from './types';
export const STATUS_COLORS: Record<string,string> = {pending_assignment:'#7b8495',todo:'#579bfc',in_progress:'#f4ae36',for_review:'#8b6be8',changes_requested:'#df526d',completed:'#00b97d',cancelled:'#76808c'};
export type TableSort = 'manual' | 'title' | 'deadline' | 'priority';
export function visibleProjectTasks(tasks: Task[], query: string, status: string, owner: string, sort: TableSort): Task[] {
 const needle=query.toLocaleLowerCase().trim(); const priority={high:0,medium:1,low:2};
 const manualTie=(a:Task,b:Task)=>(a.workspacePosition||0)-(b.workspacePosition||0) || a.createdAt-b.createdAt || a.id.localeCompare(b.id);
 return tasks.filter(t => !t.archivedAt && (!needle || [t.title,t.description,t.department,t.assigneeName,...(t.teamMemberNames||[])].some(v=>v?.toLocaleLowerCase().includes(needle))) && (!status || t.status===status) && (!owner || (t.assigneeId||t.assignedTo)===owner)).sort((a,b)=>{
  if(sort==='title')return a.title.localeCompare(b.title) || manualTie(a,b);
  if(sort==='priority')return priority[a.priority||'medium']-priority[b.priority||'medium'] || a.title.localeCompare(b.title) || manualTie(a,b);
  if(sort==='deadline')return (a.deadline||a.dueDate||'9999').localeCompare(b.deadline||b.dueDate||'9999') || manualTie(a,b);
  return manualTie(a,b);
 });
}
export function tasksInGroup(tasks: Task[], group: ProjectGroup) { return tasks.filter(t=>t.groupId===group.id || (!t.groupId && group.isDefault)); }
export function groupSummary(tasks: Task[]) {
 const completed=tasks.filter(t=>t.status==='completed').length;
 return {count:tasks.length,completed,budget:tasks.reduce((n,t)=>n+(t.budgetImpact||0),0),effort:tasks.reduce((n,t)=>n+(t.estimatedHours||0),0),progress:tasks.length?Math.round(tasks.reduce((n,t)=>n+(t.status==='completed'?100:t.status==='cancelled'?0:t.percentComplete||0),0)/tasks.length):0};
}
export function canEditProjectTask(task: Task, head: boolean, officeId: string) {
 return head && task.orgId===officeId && !task.archivedAt && !['completed','cancelled'].includes(task.status);
}
export function inlineStatusOptions(task: Task, userId: string, editable: boolean): Task['status'][] {
 const result: Task['status'][]=[task.status];
 if(task.status==='todo' && getTaskTeamMemberIds(task).includes(userId))result.push('in_progress');
 if(task.status==='changes_requested' && ((task.assigneeId||task.assignedTo)===userId||editable))result.push('in_progress');
 return result;
}
export function dependencyWouldCycle(tasks: Task[], taskId: string, candidates: string[]): boolean {
 const map=new Map(tasks.map(t=>[t.id,t.dependencyIds||[]]));const visited=new Set<string>();const queue=[...candidates];
 while(queue.length){const id=queue.pop()!;if(id===taskId)return true;if(visited.has(id))continue;visited.add(id);queue.push(...(map.get(id)||[]));}return false;
}
