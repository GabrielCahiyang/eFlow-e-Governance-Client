import { PeopleAvatarStack } from '../../../../components/ui/workspace';
import type { UserProfile } from '../../../../types';
import { ProjectScheduleLabel } from '../../presentation/projectPresentation';
import { projectOverviewWork } from '../../selectors/projectOverview';
import type { ProjectCommandData } from './types';
import './projectOverview.css';

export function ProjectOverviewTab({data,profiles,onOpenTask}: {data:ProjectCommandData;profiles:UserProfile[];onOpenTask:(id:string)=>void}) {
 const work=projectOverviewWork(data.tasks);
 const ids=[...new Set([data.project.ownerId,...data.metrics.activeLeadIds].filter((id):id is string=>Boolean(id)))];
 const owner=profiles.find(profile=>profile.id===data.project.ownerId);
 const people=ids.map(id=>({id,name:profiles.find(profile=>profile.id===id)?.full_name||'Name unavailable'}));
 const taskList=(label:string,tasks:ProjectCommandData['tasks'],empty:string)=><section className="r4-overview-section" aria-label={label}>
  <header><h3>{label}</h3><span>{tasks.length}</span></header>
  {tasks.length ? <ul>{tasks.slice(0,5).map(task=><li key={task.id}><button type="button" data-task-inspector-source={task.id} onClick={()=>onOpenTask(task.id)}>
   <strong>{task.title}</strong><span>{task.deadline||task.dueDate} · {profiles.find(p=>p.id===(task.recommendationLeadId||task.assigneeId))?.full_name||'Unassigned'}</span>
  </button></li>)}</ul> : <p>{empty}</p>}
  {tasks.length>5&&<p>{tasks.length-5} more in Main table.</p>}
 </section>;
 return <div className="r4-project-overview">
  <section className="r4-overview-section r4-overview-purpose" aria-label="Project purpose"><header><h2>Purpose</h2><ProjectScheduleLabel health={data.metrics.scheduleHealth} empty={!data.project.targetDate&&!data.metrics.nextDeadline}/></header>
   <p>{data.project.description?.trim()||'No project purpose has been recorded yet.'}</p>
   {data.project.proposalTitle&&<p>Work plan: {data.project.proposalTitle}</p>}
  </section>
  <section className="r4-overview-section" aria-label="Project progress"><header><h2>Progress</h2><strong>{data.metrics.progress}%</strong></header>
   <div role="progressbar" aria-label="Project delivery progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.metrics.progress} className="eflow-progress-track"><span style={{width:`${data.metrics.progress}%`}}/></div>
   <dl className="r4-overview-stats">{work.counts.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
  </section>
  <div className="r4-overview-grid"><div>
   {taskList('Overdue work',work.overdue,'No overdue work.')}
   {taskList('Upcoming work',work.upcoming,'No upcoming deadlines recorded.')}
   {work.unscheduled>0&&<p>{work.unscheduled} unfinished task(s) have no calendar deadline.</p>}
   <section className="r4-overview-section" aria-label="Delivery activities"><header><h3>Delivery activities</h3><span>{data.metrics.milestoneCompleted} / {data.milestones.length} complete</span></header>
    {data.milestones.length ? <ul>{data.milestones.map(milestone=><li key={milestone.id}><strong>{milestone.title}</strong><span>{milestone.dueDate||'No target'} · {(milestone.manualStatus||milestone.status||'not_started').replace(/_/g,' ')}</span></li>)}</ul> : <p>No delivery activities recorded yet.</p>}
   </section>
  </div><aside>
   <section className="r4-overview-section" aria-label="Responsible people"><header><h3>Responsible people</h3></header><PeopleAvatarStack people={people}/><dl className="r4-overview-details">
    <dt>Project lead</dt><dd>{owner?.full_name||'Unassigned'}</dd><dt>Start date</dt><dd>{data.project.startDate||'Not scheduled'}</dd><dt>Target date</dt><dd>{data.project.targetDate||'Not scheduled'}</dd><dt>Last activity</dt><dd>{data.metrics.lastActivityAt?new Date(data.metrics.lastActivityAt).toLocaleDateString():'No activity recorded'}</dd>
   </dl></section>
   <section className="r4-overview-section" aria-label="Needs attention"><header><h3>Needs attention</h3><span>{data.attention.length}</span></header>
    {data.attention.length ? <ul>{data.attention.slice(0,5).map(item=><li key={item.id}>{item.taskId?<button type="button" onClick={()=>onOpenTask(item.taskId!)}><strong>{item.title}</strong><span>{item.detail}</span></button>:<><strong>{item.title}</strong><span>{item.detail}</span></>}</li>)}</ul>:<p>No attention items in the loaded project work.</p>}
   </section>
   <section className="r4-overview-section" aria-label="Recent activity"><header><h3>Recent activity</h3></header>
    {data.activity.length?<ul>{data.activity.slice(0,4).map(item=><li key={item.id}><strong>{item.actorName&&item.actorName!=='System'?`${item.actorName} · `:''}{item.title}</strong><span>{item.detail} · {new Date(item.occurredAt).toLocaleString()}</span></li>)}</ul>:<p>No recent activity recorded.</p>}
   </section>
  </aside></div>
 </div>;
}
