import { useState } from 'react';
import { Calendar,Link2 } from 'lucide-react';
import { WorkspacePopover } from '../../../components/ui/workspace';
import type { Task } from '../../tasks';
import { dependencyWouldCycle } from '../selectors';
import type { WorkspaceTaskPatch } from '../types';
type Save=(patch:WorkspaceTaskPatch)=>Promise<void>;
export function NumberCell({value,label,disabled,save,field}:{value:number;label:string;disabled:boolean;save:Save;field:'estimated_hours'|'budget_impact'}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <div><input key={value} type="number" min="0" max={field==='estimated_hours'?100000:1e12} step={field==='estimated_hours'?'0.5':'0.01'} defaultValue={value||''} placeholder="—" aria-label={label} disabled={disabled||busy} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.currentTarget.value=value?String(value):'';e.currentTarget.blur();}}} onBlur={async e=>{const next=Number(e.target.value);if(next===value)return;if(!Number.isFinite(next)||next<0){setError('Enter a positive amount.');return;}setBusy(true);setError('');try{await save({[field]:next});}catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}}/>{error&&<small role="alert">{error}</small>}</div>;
}
export function TimelineCell({task,disabled,save}:{task:Task;disabled:boolean;save:Save}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const due=task.deadline||task.dueDate||'';
 const date=due.match(/^\d{4}-\d{2}-\d{2}/)?.[0]||'';
 const text=date?new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):due||'Set dates';
 return <WorkspacePopover trigger={<button className="pt-date" disabled={disabled} aria-label={'Edit dates for '+task.title}><Calendar size={14}/>{task.startDate?task.startDate+' → ':''}{text}</button>}>
  <form className="pt-popover-form" onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);const start=String(form.get('start')||''),end=String(form.get('end')||'');if(start&&end&&start>end){setError('Start date must precede the due date.');return;}setBusy(true);setError('');setSaved(false);try{await save({start_date:start||null,deadline:end});setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Could not save dates.');}finally{setBusy(false);}}}>
   <strong>Task timeline</strong><label>Start date<input type="date" name="start" defaultValue={task.startDate||''}/></label><label>Due date<input type="date" name="end" defaultValue={date}/></label>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Dates saved.</p>}<button className="pt-primary" disabled={busy}>{busy?'Saving…':'Save dates'}</button>
  </form>
 </WorkspacePopover>;
}
export function DependencyCell({task,tasks,disabled,save}:{task:Task;tasks:Task[];disabled:boolean;save:Save}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const titles=(task.dependencyIds||[]).map(id=>tasks.find(t=>t.id===id)?.title||'Restricted task');
 return <WorkspacePopover trigger={<button className="pt-dependencies" disabled={disabled} title={titles.join(', ')} aria-label={'Edit dependencies for '+task.title}><Link2 size={14}/>{titles.length?titles.length+' linked':'Add'}</button>}>
  <form className="pt-popover-form" onSubmit={async e=>{e.preventDefault();const ids=new FormData(e.currentTarget).getAll('dependency').map(String);if(dependencyWouldCycle(tasks,task.id,ids)){setError('Dependencies cannot form a cycle.');return;}setBusy(true);setError('');setSaved(false);try{await save({dependency_ids:ids});setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Could not save dependencies.');}finally{setBusy(false);}}}>
   <strong>Depends on</strong><div className="pt-dependency-options">{tasks.filter(t=>t.id!==task.id&&!t.archivedAt).map(t=><label key={t.id}><input type="checkbox" name="dependency" value={t.id} defaultChecked={task.dependencyIds?.includes(t.id)}/>{t.title}</label>)}</div>
   {!tasks.some(t=>t.id!==task.id)&&<p>Add another task first.</p>}{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Dependencies saved.</p>}<button className="pt-primary" disabled={busy}>Save dependencies</button>
  </form>
 </WorkspacePopover>;
}
