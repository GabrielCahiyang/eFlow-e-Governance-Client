import {useRef,useState} from 'react';
import {Modal} from '../../../components/ui/Modal';
import {useNavigationBlocker,requestNavigation} from '../../../shared/navigationGuard';
import {useProjectFlow} from '../../project-setup';
import type {Task} from '../../tasks';
import type {WorkspaceTaskPatch} from '../types';
import {timelineDraft,timelinePatch} from '../planningDraft';
export function ProjectTaskEditDialog({task,save,onClose}:{task:Task;save:(patch:WorkspaceTaskPatch)=>Promise<void>;onClose:()=>void}){
 const flow=useProjectFlow(task.linkedProjectId||''),[title,setTitle]=useState(task.title),[priority,setPriority]=useState(task.priority),[dates,setDates]=useState(()=>timelineDraft(task)),[hours,setHours]=useState(task.estimatedHours||0),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false);
 const dirty=title!==task.title||priority!==task.priority||hours!==(task.estimatedHours||0)||JSON.stringify(dates)!==JSON.stringify(timelineDraft(task));
 useNavigationBlocker({label:'Edit task',dirty,pending:busy,onDiscard:onClose});
 const close=()=>void requestNavigation(onClose);
 async function submit(){if(pending.current)return;setError('');if(!title.trim()){setError('Enter a task title.');return;}pending.current=true;setBusy(true);try{
 const p=flow.data?.project;if(p&&(dates.start&&p.start_date&&dates.start<p.start_date||dates.end&&p.target_date&&dates.end>p.target_date))throw new Error('Task dates must stay within the project timeline.');
 await save({title:title.trim(),priority,estimated_hours:hours,...timelinePatch(task,dates)});onClose();
 }catch(e){setError(e instanceof Error?e.message:'Could not edit task.');}finally{pending.current=false;setBusy(false);}}
 return <Modal isOpen title="Edit task" description="Update task details within the project’s dates and funding rules." width="max-w-2xl" onClose={close} preventClose={busy} footer={<div className="pf-actions"><button disabled={busy} onClick={close}>Cancel</button><button className="pf-primary" disabled={busy||!dirty} onClick={()=>void submit()}>{busy?'Saving…':'Save task'}</button></div>}><fieldset className="pf-panel" disabled={busy}><label>Task title<input value={title} maxLength={300} onChange={e=>setTitle(e.target.value)}/></label><div className="pf-grid"><label>Priority<select value={priority} onChange={e=>setPriority(e.target.value as Task['priority'])}>{['low','medium','high'].map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Estimated hours<input type="number" min="0" max="100000" value={hours} onChange={e=>setHours(Number(e.target.value))}/></label><label>Start date<input type="date" min={flow.data?.project.start_date||undefined} max={dates.end||flow.data?.project.target_date||undefined} value={dates.start} onChange={e=>setDates({...dates,start:e.target.value})}/></label><label>Due date<input type="date" min={dates.start||flow.data?.project.start_date||undefined} max={flow.data?.project.target_date||undefined} value={dates.end} onChange={e=>setDates({...dates,end:e.target.value})}/></label></div><p>Use Budget to allocate project funding. Editing dates or hours does not authorize money.</p>{error&&<div role="alert" className="pf-error">{error}</div>}</fieldset></Modal>;
}
