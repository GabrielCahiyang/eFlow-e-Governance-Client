import type { CSSProperties } from 'react';
import type { ProjectCommandData } from '../../projects';
import type { Organization, UserProfile } from '../../../types';
import { getTaskTeamMemberIds, isOverdue, TASK_STATUS_LABELS } from '../../tasks';
import { STATUS_COLORS } from '../../project-table';
import { peso } from '../../budget';
import { calendarDay, officeTaskSummaries } from '../selectors';
import '../projectViews.css';

export function ProjectInsightsView({ data, profiles, offices, onOpenTask }: { data: ProjectCommandData; profiles: UserProfile[]; offices: Organization[]; onOpenTask: (id: string) => void }) {
  const tasks = data.tasks, live = tasks.filter(t => t.status !== 'cancelled');
  const completed = live.filter(t => t.status === 'completed').length;
  const overdue = live.filter(t => t.status !== 'completed' && isOverdue(t));
  const statusCounts = Object.entries(TASK_STATUS_LABELS).map(([id, label]) => ({ id, label, count: tasks.filter(t => t.status === id).length }));
  const officeRows = officeTaskSummaries(tasks);
  const today = new Date();
  const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
  const upcoming = tasks.filter(t => !['completed', 'cancelled'].includes(t.status) && (calendarDay(t.deadline || t.dueDate) ?? -Infinity) >= currentDay).sort((a, b) => (a.deadline || a.dueDate || '').localeCompare(b.deadline || b.dueDate || ''));
  const people = new Map<string, number>();
  tasks.filter(t => !['completed', 'cancelled'].includes(t.status)).forEach(t => { const ids = getTaskTeamMemberIds(t); (ids.length ? ids : ['']).forEach(id => people.set(id, (people.get(id) || 0) + 1)); });
  // Only approved top-level task allocations count; delegated subtask pesos
  // are already part of those allocations. Planning estimates are excluded.
  const allocated = data.financial.allocations.filter(a => !a.subtaskId && a.status === 'approved').reduce((sum, a) => sum + a.amount, 0);
  const spent = data.financial.requests.filter(r => r.status === 'settled').reduce((sum, r) => sum + (r.actualSpent || 0), 0);
  const utilization = allocated ? Math.round(spent / allocated * 100) : null;
  return <section className="pv-dashboard" aria-label="Project dashboard"><div className="pv-view-heading"><div><h2>Project overview</h2><p>Delivery, ownership and spending for the visible project tasks.</p></div></div>
    <div className="pv-stat-strip">{[{label:'All tasks',value:tasks.length,color:'#579bfc'},{label:'Completed',value:completed,color:'#00b97d'},{label:'Active',value:live.length-completed,color:'#f4ae36'},{label:'Overdue',value:overdue.length,color:'#df526d'}].map(stat => <div key={stat.label}><span><i style={{background:stat.color}}/>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>
    <div className="pv-insight-grid">
      <article className="pv-widget"><h3>Overall completion</h3><div className="pv-completion"><strong>{live.length ? Math.round(completed/live.length*100) : 0}%</strong><progress aria-label="Overall task completion" value={completed} max={Math.max(1,live.length)}/><span>{completed} of {live.length} non-cancelled tasks approved as completed</span></div></article>
      <article className="pv-widget"><h3>Tasks by status</h3><div className="pv-chart-bars">{statusCounts.filter(s=>s.count).map(s=><div key={s.id}><span>{s.label}</span><progress aria-label={s.label} value={s.count} max={Math.max(1,tasks.length)} style={{'--pv-progress-color':STATUS_COLORS[s.id]} as CSSProperties}/><strong>{s.count}</strong></div>)}{!tasks.length&&<p>No tasks match these filters.</p>}</div></article>
      <article className="pv-widget"><h3>Tasks by Office</h3><div className="pv-chart-bars">{officeRows.map(row=><div key={row.officeId}><span>{offices.find(o=>o.id===row.officeId)?.name||'Office unavailable'}</span><progress aria-label={'Tasks for '+(offices.find(o=>o.id===row.officeId)?.name||'Office unavailable')} value={row.total} max={Math.max(1,tasks.length)}/><strong>{row.total}</strong></div>)}{!officeRows.length&&<p>No Office work to summarize.</p>}</div></article>
      <article className="pv-widget"><h3>Budget utilization</h3>{data.financialLoading?<p role="status">Loading financial records…</p>:data.financialError?<p role="alert">Financial records could not be loaded: {data.financialError}</p>:<div className="pv-completion"><strong>{utilization===null?'—':utilization+'%'}</strong><progress aria-label="Budget utilization" value={Math.min(100,utilization||0)} max={100}/><span>{peso.format(spent)} settled spending / {peso.format(allocated)} approved task allocations</span>{utilization===null&&<span>No approved task allocation is recorded.</span>}{utilization!==null&&utilization>100&&<span>Settled spending exceeds the recorded allocation.</span>}</div>}</article>
      <article className="pv-widget"><h3>Upcoming deadlines</h3><div className="pv-deadline-list">{upcoming.slice(0,8).map(t=><button key={t.id} onClick={()=>onOpenTask(t.id)}><span>{t.title}</span><time>{(t.deadline||t.dueDate)?.slice(0,10)}</time></button>)}{!upcoming.length&&<p>No upcoming task deadlines.</p>}</div></article>
      <article className="pv-widget"><h3>Workload · active task assignments</h3><div className="pv-chart-bars">{Array.from(people).sort((a,b)=>b[1]-a[1]).map(([id,count])=><div key={id}><span>{id?(profiles.find(p=>p.id===id)?.full_name||profiles.find(p=>p.id===id)?.fullName||'Assigned member'):'Unassigned'}</span><progress aria-label={'Active assignments '+id} value={count} max={Math.max(1,...people.values())}/><strong>{count}</strong></div>)}{!people.size&&<p>No active task assignments.</p>}</div></article>
      {overdue.length>0&&<article className="pv-widget pv-widget--wide"><h3>Overdue work</h3><div className="pv-deadline-list">{overdue.map(t=><button key={t.id} onClick={()=>onOpenTask(t.id)}><span>{t.title}</span><time>{(t.deadline||t.dueDate)?.slice(0,10)}</time></button>)}</div></article>}
    </div>
  </section>;
}
