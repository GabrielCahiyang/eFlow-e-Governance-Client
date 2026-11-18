import { readableUiError } from '../../../shared/userFacingError';
import {useEffect,useRef,useState} from 'react';
import {Modal} from '../../../components/ui/Modal';
import {DateInput} from '../../../components/ui/DateInput';
import {useNavigationBlocker,requestNavigation} from '../../../shared/navigationGuard';
import {fetchTaskDetailEditState,type Task,type TaskDetailEditState} from '../../tasks';
import type {WorkspaceTaskPatch} from '../types';
import {timelineDraft,timelineError,timelinePatch} from '../planningDraft';
import {PrerequisiteField} from '../../../components/ui/workspace/PrerequisiteField';
import {projectPrerequisiteChoices,projectPrerequisiteError} from '../selectors';
import {useTasks} from '../../../hooks/useFirebaseData';

export function ProjectTaskEditDialog({task,projectStartDate,projectTargetDate,save,onClose}:{task:Task;projectStartDate?:string;projectTargetDate?:string;save:(patch:WorkspaceTaskPatch)=>Promise<void>;onClose:()=>void}){
 const {tasks}=useTasks();
 const [prerequisites,setPrerequisites]=useState(task.dependencyIds||[]);
 const dependenciesChanged=JSON.stringify([...prerequisites].sort())!==JSON.stringify([...(task.dependencyIds||[])].sort());
 const [title,setTitle]=useState(task.title),[priority,setPriority]=useState(task.priority),[dates,setDates]=useState(()=>timelineDraft(task)),[hours,setHours]=useState(task.estimatedHours||0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[policy,setPolicy]=useState<TaskDetailEditState|null>(null),[policyError,setPolicyError]=useState(''),[policyLoading,setPolicyLoading]=useState(true),[changeReason,setChangeReason]=useState('');
 const pending=useRef(false);
 useEffect(()=>{let active=true;setPolicy(null);setPolicyError('');setPolicyLoading(true);void fetchTaskDetailEditState(task.id).then(value=>{if(active)setPolicy(value);}).catch(reason=>{if(active)setPolicyError(readableUiError(reason, "Task editing access could not be verified.", 'write'));}).finally(()=>{if(active)setPolicyLoading(false);});return()=>{active=false;};},[task.id]);
 const verified=!policyLoading&&!policyError&&!!policy,detailsWritable=verified&&!!policy?.details,planningWritable=detailsWritable&&!!policy?.planning,dueWritable=detailsWritable&&!!policy?.due;
 const dirty=dependenciesChanged||title!==task.title||priority!==task.priority||hours!==(task.estimatedHours||0)||JSON.stringify(dates)!==JSON.stringify(timelineDraft(task));
 useNavigationBlocker({label:'Edit task',dirty,pending:busy,onDiscard:onClose});
 const close=()=>void requestNavigation(onClose);
 const projectBounds={start:projectStartDate?.slice(0,10)||'',end:projectTargetDate?.slice(0,10)||''};
 const dateValidation=timelineError(task,dates,undefined,projectBounds);
 async function submit(){if(pending.current||!verified||!detailsWritable)return;setError('');if(!title.trim()){setError('Enter a task title.');return;}if(dateValidation){setError(dateValidation);return;}pending.current=true;setBusy(true);try{
  if(policy?.started){const patch:WorkspaceTaskPatch={};if(title.trim()!==task.title)patch.title=title.trim();if(priority!==task.priority)patch.priority=priority;if(dates.end!==(task.deadline||task.dueDate||'')){if(!dueWritable)throw new Error('Only the supervising Lead or authorized Office Head can reschedule this task.');if(changeReason.trim().length<1||changeReason.trim().length>1000)throw new Error('Enter a due-date change reason (1–1,000 characters).');patch.deadline=dates.end;patch.change_reason=changeReason.trim();}if(Object.keys(patch).length)await save(patch);}
  else {
   if(dependenciesChanged){
    if(!planningWritable)throw new Error('Current access does not allow changing prerequisites.');
    const issue=projectPrerequisiteError(tasks,task.linkedProjectId,task.id,prerequisites,task.dependencyIds);
    if(issue)throw new Error(issue);
   }
   await save({title:title.trim(),priority,estimated_hours:hours,...timelinePatch(task,dates,undefined,projectBounds),...(dependenciesChanged?{dependency_ids:prerequisites}:{})});
  }
  onClose();
 }catch(reason){setError(readableUiError(reason, "Could not edit task.", 'write'));}finally{pending.current=false;setBusy(false);}}
 return <Modal isOpen title="Edit task" description="Update task details. The project timeline adjusts automatically to fit its tasks." width="max-w-2xl" onClose={close} preventClose={busy} footer={<div className="pf-actions"><button disabled={busy} onClick={close}>Cancel</button><button className="pf-primary" disabled={busy||!dirty||!verified||!detailsWritable} onClick={()=>void submit()}>{busy?'Saving…':'Save task'}</button></div>}>
  {policyLoading&&<p role="status" className="pf-panel">Checking current task editing access…</p>}
  {policyError&&<p role="alert" className="pf-error">{policyError} Editing is unavailable until access can be verified.</p>}
  {policy?.started&&<p role="status" className="pf-panel">Work has started. Authorized editors can correct the title and priority. Planning fields are locked; due-date changes require supervising authority and a reason.</p>}
  {error&&<div role="alert" className="pf-error">{error}</div>}
  <p>Use Budget to allocate project funding. Editing dates or hours does not authorize money.</p>
  <fieldset className="pf-panel" disabled={busy||!verified}>
   <label>Task title<input value={title} disabled={busy||!detailsWritable} maxLength={300} onChange={event=>setTitle(event.target.value)}/></label>
   <div className="pf-grid">
    <label>Priority<select value={priority} disabled={busy||!detailsWritable} onChange={event=>setPriority(event.target.value as Task['priority'])}>{['low','medium','high'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
    <label>Estimated hours<input type="number" min="0" max="100000" value={hours} disabled={busy||!planningWritable} onChange={event=>setHours(Number(event.target.value))}/></label>
    <label>Start date<DateInput min={projectBounds.start||undefined} max={(dates.end&&(!projectBounds.end||dates.end<projectBounds.end)?dates.end:projectBounds.end)||undefined} value={dates.start} disabled={busy||!planningWritable} onChange={event=>setDates({...dates,start:event.target.value})}/></label>
    <label>Due date<DateInput min={(dates.start&&(!projectBounds.start||dates.start>projectBounds.start)?dates.start:projectBounds.start)||undefined} max={projectBounds.end||undefined} value={dates.end} disabled={busy||!dueWritable} onChange={event=>setDates({...dates,end:event.target.value})}/></label>
   </div>
   {task.linkedProjectId&&<PrerequisiteField label="Prerequisite tasks" choices={projectPrerequisiteChoices(tasks,task.linkedProjectId,task.id,task.dependencyIds)} selected={prerequisites} disabled={!planningWritable||policy?.started} onChange={setPrerequisites}/>}
   {policy?.started&&dueWritable&&<label>Reason for due-date change<input value={changeReason} maxLength={1000} onChange={event=>setChangeReason(event.target.value)}/></label>}
  </fieldset>
 </Modal>;
}
