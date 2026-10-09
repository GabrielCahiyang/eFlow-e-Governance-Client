import { useRef } from 'react';
import { X } from 'lucide-react';
import type { Task } from '../../tasks';
import { requestNavigation } from '../../../shared/navigationGuard';
export function InspectorHeader({task, tab, tabs, onTab, onClose, busy, actions}: {task: Task; tab:string; tabs:{id:string;label:string}[];onTab:(id:string)=>void;onClose:()=>void;busy:boolean;actions?:React.ReactNode}) {
 const controls = useRef<(HTMLButtonElement|null)[]>([]);
 return <header className="p-4 border-b border-neutral-100 shrink-0">
  <div className="flex items-start justify-between gap-2"><h2 className="min-w-0 text-base font-semibold text-neutral-900 leading-snug">{task.title}</h2><button type="button" className="p-2 rounded-md hover:bg-neutral-100" aria-label="Close task detail" disabled={busy} onClick={()=>{void requestNavigation(onClose);}}><X size={18}/></button></div>
  {actions&&<div className="flex gap-2 flex-wrap mt-2">{actions}</div>}
  <div role="tablist" aria-label="Task sections" className="flex gap-1 overflow-x-auto mt-3">
   {tabs.map((item,index)=><button key={item.id} type="button" role="tab" ref={node=>{controls.current[index]=node;}} id={`task-${task.id}-${item.id}`} aria-controls={`task-panel-${task.id}`} aria-selected={tab===item.id} tabIndex={tab===item.id?0:-1} className={`px-2.5 py-2 text-sm whitespace-nowrap border-b-2 ${tab===item.id?'border-teal-600 text-teal-700':'border-transparent text-neutral-500'}`} onClick={()=>{void requestNavigation(()=>onTab(item.id));}} onKeyDown={event=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault(); const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    void requestNavigation(()=>{onTab(tabs[next].id);controls.current[next]?.focus();});
   }}>{item.label}</button>)}
  </div>
 </header>;
}
