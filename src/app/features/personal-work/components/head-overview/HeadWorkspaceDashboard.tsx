import { EmptyState } from '../../../../components/ui/EmptyState';
import type { EmptyIllustration } from '../../../../components/ui/EmptyStateIllustration';
import {useMemo,useState} from 'react';
import {Button,Heading,ProgressBar,Skeleton} from '@vibe/core';
import {ArrowRight,CalendarClock,CheckCircle2,Clock3,FolderKanban,RefreshCw,TriangleAlert} from 'lucide-react';
import {workDateLabel} from '../../../../shared/workCalendar';
import {attentionViews,headOverview,type HeadAttentionView} from '../../selectors/headOverview';
import type {WorkRow,WorkSnapshot} from '../../types';
import './headWorkspaceDashboard.css';

interface Props {
  actorId?:string;name:string; data?:WorkSnapshot; loading:boolean; error?:string;
  onRefresh:()=>void; onNavigate:(section:string,page:string,project?:string)=>void;
  onOpen:(row:WorkRow,element:HTMLElement)=>void; canReports:boolean;
}
const statusLabel=(status:string)=>({todo:'Not started',in_progress:'In progress',for_review:'Awaiting review',submitted:'Awaiting review',completed:'Completed',done:'Completed',pending_assignment:'Needs a lead'}[status]||status.replace(/_/g,' '));
export function HeadWorkspaceDashboard({actorId,name,data,loading,error,onRefresh,onNavigate,onOpen,canReports}:Props){
  const [focus,setFocus]=useState<HeadAttentionView>('overdue');
  const model=useMemo(()=>data?headOverview(data,new Date(),actorId):undefined,[data,actorId]);
  const incomplete=!!data?.issues.length||!!error;
  const trusted=!!data&&!incomplete;
  const date=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Manila',weekday:'long',day:'numeric',month:'long'}).format(new Date());
  const cards=[
    {label:'Active projects',value:model?.projects.length,detail:'Track delivery across your office',icon:FolderKanban,action:()=>onNavigate('projects','Projects'),tone:'blue'},
    {label:'Open tasks',value:model?.open.length,detail:'Work still to be completed',icon:CheckCircle2,action:()=>onNavigate('tasks','Task Board'),tone:'teal'},
    {label:'Overdue tasks',value:model?.attention.overdue.length,detail:'Past their due date',icon:TriangleAlert,action:()=>setFocus('overdue'),tone:'red'},
    {label:'Awaiting review',value:model?.attention.review.length,detail:'Waiting for a reviewer’s decision',icon:Clock3,action:()=>setFocus('review'),tone:'amber'},
  ];
  return <section className="head-home" aria-label="Head dashboard" aria-busy={loading}>
    <header className="head-home__header"><div><p className="head-home__eyebrow">{name} <span>{date}</span></p><Heading type="h1">Office dashboard</Heading><p className="head-home__intro">See where work stands and what needs your attention.</p></div>
      <div className="head-home__actions"><Button kind="tertiary" size="small" disabled={loading} onClick={onRefresh} aria-label="Refresh dashboard"><RefreshCw size={15}/></Button>{canReports&&<Button kind="secondary" size="small" onClick={()=>onNavigate('reports','Reports')}>Open reports <ArrowRight size={14}/></Button>}</div>
    </header>
    {incomplete&&<div role="alert" className="head-home__notice"><TriangleAlert size={18}/><div><strong>Some work couldn’t be loaded.</strong><p>Totals and project progress are unavailable until everything loads. You can still open the work shown below.</p><Button kind="tertiary" size="small" onClick={onRefresh}>Try again</Button></div></div>}
    <div className="head-home__metrics" aria-label="Office totals">{cards.map(card=><button type="button" key={card.label} className={`head-home__metric head-home__metric--${card.tone}`} onClick={card.action}><span className="head-home__metric-label">{card.label}<card.icon size={18}/></span><strong>{loading&&!data?<Skeleton width={56} height={34}/>:trusted?card.value:'—'}</strong><small>{card.detail}</small></button>)}</div>
    <div className="head-home__columns">
      <section className="head-home__panel" aria-label="Project progress"><div className="head-home__panel-heading"><div><Heading type="h2">Project progress</Heading><p>Completed tasks out of the project’s total.</p></div><Button kind="tertiary" size="small" onClick={()=>onNavigate('projects','Projects')}>All projects <ArrowRight size={14}/></Button></div>
        {loading&&!data?<PanelSkeleton/>:model?.projects.length?<div className="head-home__project-list">{model.projects.slice(0,6).map(item=><button type="button" key={item.project.id} className="head-home__project" onClick={()=>onNavigate('projects','Projects',item.project.id)}><div className="head-home__project-title"><strong>{item.project.title}</strong><ArrowRight size={15}/></div><div className="head-home__project-meta"><span>{!trusted?'Progress unavailable':item.total?`${item.done} of ${item.total} tasks completed`:'No tasks yet'}</span>{trusted&&item.percent!==null&&<b>{item.percent}%</b>}</div>{trusted&&item.percent!==null&&<ProgressBar value={item.percent} aria-label={`${item.project.title}: ${item.percent}% of tasks completed`} fullWidth/>}<div className="head-home__project-flags">{trusted&&item.overdue>0&&<span className="head-home__flag head-home__flag--red">{item.overdue} overdue</span>}{trusted&&item.review>0&&<span className="head-home__flag head-home__flag--amber">{item.review} awaiting review</span>}</div></button>)}</div>:<Empty illustration={trusted?'projects':false} icon={FolderKanban} title={trusted?'No active projects yet':'Project progress is unavailable'} description={trusted?'Open Projects to create a project and start tracking its tasks.':'Refresh the dashboard to load your projects.'}/>}
      </section>
      <section className="head-home__panel" aria-label="Tasks needing attention"><div className="head-home__panel-heading"><div><Heading type="h2">Needs attention</Heading><p>Open a task to see its updates and next steps.</p></div></div>
        <div className="head-home__filters" role="group" aria-label="Task attention filter">{Object.entries(attentionViews).map(([key,label])=><button type="button" key={key} aria-pressed={focus===key} onClick={()=>setFocus(key as HeadAttentionView)}>{label}{trusted&&<span>{model?.attention[key as HeadAttentionView].length}</span>}</button>)}</div>
        {loading&&!data?<PanelSkeleton/>:model?.attention[focus].length?<ul className="head-home__task-list">{model.attention[focus].slice(0,6).map(row=><TaskLine key={row.key} row={row} onOpen={onOpen} overdue={focus==='overdue'}/>)}</ul>:<Empty illustration={trusted?'complete':false} icon={focus==='upcoming'?CalendarClock:CheckCircle2} title={trusted?{overdue:'No overdue tasks',upcoming:'No tasks due in the next 7 days',review:'No tasks awaiting review',unassigned:'Every open task has a lead'}[focus]:'Task coverage is incomplete'} description={trusted?'New work will appear here as your team updates its tasks.':'Refresh to check this list.'}/>}
        {(model?.attention[focus].length||0)>6&&<div className="head-home__panel-footer"><Button kind="tertiary" size="small" onClick={()=>onNavigate('tasks','Task Board')}>See all tasks <ArrowRight size={14}/></Button></div>}
      </section>
    </div>
    <section className="head-home__panel head-home__recent" aria-label="Recent task updates"><div className="head-home__panel-heading"><div><Heading type="h2">Recent task updates</Heading><p>Latest changes in the past 7 days. Open a task for its full progress report.</p></div></div>
      {loading&&!data?<PanelSkeleton/>:model?.latest.length?<ul className="head-home__task-list">{model.latest.map(row=><TaskLine key={row.key} row={row} onOpen={onOpen} recent/>)}</ul>:trusted?<EmptyState illustration="tasks" size="compact" title="No task updates in the past 7 days."/>:<div className="head-home__quiet">Updates will appear when the workspace loads.</div>}
    </section>
  </section>;
}
function TaskLine({row,onOpen,overdue=false,recent=false}:{row:WorkRow;onOpen:Props['onOpen'];overdue?:boolean;recent?:boolean}){

  return <li><button type="button" data-work-key={row.key} className="head-home__task" onClick={event=>onOpen(row,event.currentTarget)}><div className="head-home__task-name"><strong>{row.title}</strong><small>{row.projectTitle}</small></div><span className={`head-home__status head-home__status--${row.status}`}>{statusLabel(row.status)}</span><span className={overdue?'head-home__date head-home__date--late':'head-home__date'}>{recent?`Updated ${workDateLabel(row.updatedAt?new Date(row.updatedAt).toISOString():'',row.timezone)}`:row.due?`Due ${workDateLabel(row.due,row.timezone)}`:'No due date'}</span><ArrowRight size={15}/></button></li>;
}
function Empty({icon:Icon,title,description,illustration}:{icon:typeof FolderKanban;title:string;description:string;illustration:EmptyIllustration|false}){return <EmptyState size="compact" illustration={illustration} icon={<Icon size={26}/>} title={title} description={description}/>;}
function PanelSkeleton(){return <div className="head-home__panel-skeleton" role="status" aria-label="Loading dashboard data">{[0,1,2].map(i=><div key={i}><Skeleton fullWidth height={18}/><Skeleton width={150} height={12}/></div>)}</div>;}
