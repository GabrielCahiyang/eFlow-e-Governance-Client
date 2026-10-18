import {useRef} from 'react';
import {Button,Heading,Tab} from '@vibe/core';
import {ArrowLeft,CalendarDays,FolderKanban} from 'lucide-react';
import type {Task} from '../../tasks';
import {TaskStatusBadge,PriorityPill} from '../../../components/workflow/StatusBadges';
import {formatDate} from '../../../components/workflow/primitives';
import {requestNavigation} from '../../../shared/navigationGuard';
import type {TaskInspectorSection} from '../types';

export function TaskPageHeader({task,projectTitle,tab,tabs,onTab,onClose,busy,backLabel="Back to My Work"}: {
 task:Task;projectTitle?:string;tab:TaskInspectorSection;tabs:ReadonlyArray<{id:TaskInspectorSection;label:string}>;
 onTab:(tab:TaskInspectorSection)=>void;onClose:()=>void;busy:boolean;backLabel?:string;
}){
 const tabList=useRef<HTMLUListElement>(null);
 const controls=()=>Array.from(tabList.current?.querySelectorAll<HTMLElement>('[role=tab]')||[]);
 const select=(index:number,focus=false)=>void requestNavigation(()=>{onTab(tabs[index].id);if(focus)controls()[index]?.focus();});
 return <header className="task-page__header">
  <div className="task-page__back"><Button kind="tertiary" size="small" disabled={busy} onClick={()=>void requestNavigation(onClose)}><ArrowLeft size={16} aria-hidden="true"/>{backLabel}</Button><span>Task</span></div>
  <div className="task-page__heading"><div className="task-page__title"><Heading type="h1">{task.title}</Heading>{projectTitle&&<p><FolderKanban size={15} aria-hidden="true"/>{projectTitle}</p>}</div><div className="task-page__badges"><TaskStatusBadge status={task.status}/><PriorityPill priority={task.priority}/><span className="task-page__due"><CalendarDays size={15} aria-hidden="true"/>{task.deadline||task.dueDate?`Due ${formatDate(task.deadline||task.dueDate)}`:'No due date'}</span></div></div>
  <div className="task-page__tabs"><ul ref={tabList} role="tablist" aria-label="Task sections" onKeyDown={event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
   event.preventDefault();const index=controls().findIndex(control=>control===document.activeElement);
   const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(Math.max(0,index)+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(next,true);
  }}>
   {tabs.map((item,index)=><Tab key={item.id} id={`task-${task.id}-${item.id}`} aria-controls={`task-panel-${task.id}`} active={tab===item.id} tabIndex={tab===item.id?0:-1} onClick={()=>select(index)}>{item.label}</Tab>)}
  </ul></div>
 </header>;
}
