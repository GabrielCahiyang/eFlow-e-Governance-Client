import type { Task } from '../../tasks';
import { parseCalendarDate } from '../../../shared/scheduling/relativeSchedule';

export function projectOverviewWork(tasks: Task[], now = Date.now()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const active = tasks.filter(task => !task.archivedAt && task.status !== 'cancelled');
  const open = active.filter(task => task.status !== 'completed');
  const scheduled = open.map(task => ({task, due:parseCalendarDate(task.deadline || task.dueDate)})).filter((item): item is {task:Task;due:number} => item.due !== null).sort((a,b)=>a.due-b.due || a.task.id.localeCompare(b.task.id));
  return {
    overdue: scheduled.filter(item=>item.due<today.getTime()).map(item=>item.task),
    upcoming: scheduled.filter(item=>item.due>=today.getTime()).map(item=>item.task),
    unscheduled: open.filter(task=>parseCalendarDate(task.deadline || task.dueDate)===null).length,
    counts: [
      {label:'To do',value:active.filter(task=>['pending_assignment','todo'].includes(task.status)).length},
      {label:'In progress',value:active.filter(task=>task.status==='in_progress').length},
      {label:'Awaiting review',value:active.filter(task=>task.status==='for_review').length},
      {label:'Completed',value:active.filter(task=>task.status==='completed').length},
    ],
  };
}
