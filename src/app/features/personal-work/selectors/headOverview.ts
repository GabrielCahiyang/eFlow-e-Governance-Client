import {workDay} from '../../../shared/workCalendar';
import {workloadDeadline} from '../../tasks';
import type {WorkRow, WorkSnapshot} from '../types';

export const attentionViews = {overdue:'Overdue', upcoming:'Due next 7 days', review:'Awaiting review', unassigned:'Needs a lead'} as const;
export type HeadAttentionView = keyof typeof attentionViews;
const completed = (row:WorkRow) => ['completed','done'].includes(row.status);

/** Count root tasks once. Subitems remain available inside each task's inspector. */
export function headOverview(data:WorkSnapshot, now=new Date()) {
  const roots=data.rows.filter(row=>row.kind==='office-task'&&!row.task?.archivedAt&&!['cancelled','archived'].includes(row.status));
  const open=roots.filter(row=>!row.history&&row.actionable&&!completed(row));
  const overdue=(row:WorkRow)=>{if(row.task){const deadline=workloadDeadline(row.task);return deadline!==null&&deadline<now.getTime();}const due=workDay(row.due,row.timezone),today=workDay(now,row.timezone);return due!==null&&today!==null&&due<today;};
  const dueOrder=(a:WorkRow,b:WorkRow)=>(workDay(a.due,a.timezone)??Infinity)-(workDay(b.due,b.timezone)??Infinity)||a.title.localeCompare(b.title);
  const attention={
    overdue:open.filter(overdue).sort(dueOrder),
    upcoming:open.filter(row=>{const due=workDay(row.due,row.timezone),today=workDay(now,row.timezone);return !overdue(row)&&due!==null&&today!==null&&due>=today&&due<=today+6;}).sort(dueOrder),
    review:open.filter(row=>['for_review','submitted'].includes(row.status)).sort(dueOrder),
    unassigned:open.filter(row=>row.relation==='Needs reassignment'||row.status==='pending_assignment').sort(dueOrder),
  };
  const projects=data.projects.filter(p=>p.kind==='office'&&!['completed','archived'].includes(p.status)).map(project=>{
    const tasks=roots.filter(row=>row.projectId===project.id),done=tasks.filter(completed).length;
    const late=tasks.filter(row=>!row.history&&overdue(row)&&!completed(row)).length;
    const review=tasks.filter(row=>['for_review','submitted'].includes(row.status)).length;
    return {project,total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):null,overdue:late,review};
  }).sort((a,b)=>b.overdue-a.overdue||b.review-a.review||a.project.title.localeCompare(b.project.title));
  const latest=roots.filter(row=>row.updatedAt&&row.updatedAt>=now.getTime()-7*86400000&&row.updatedAt<=now.getTime()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,5);
  return {open,attention,projects,latest};
}
