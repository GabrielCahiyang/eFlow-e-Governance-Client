import { readableUiError } from '../../../shared/userFacingError';
import {useEffect,useRef,useState} from 'react';
import {Info,Loader2,Lock} from 'lucide-react';
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
 const [title,setTitle]=useState(task.title),[priority,setPriority]=useState(task.priority),[dates,setDates]=useState(()=>timelineDraft(task)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[policy,setPolicy]=useState<TaskDetailEditState|null>(null),[policyError,setPolicyError]=useState(''),[policyLoading,setPolicyLoading]=useState(true),[changeReason,setChangeReason]=useState('');
 const pending=useRef(false);
 useEffect(()=>{let active=true;setPolicy(null);setPolicyError('');setPolicyLoading(true);void fetchTaskDetailEditState(task.id).then(value=>{if(active)setPolicy(value);}).catch(reason=>{if(active)setPolicyError(readableUiError(reason, "Task editing access could not be verified.", 'write'));}).finally(()=>{if(active)setPolicyLoading(false);});return()=>{active=false;};},[task.id]);
 const verified=!policyLoading&&!policyError&&!!policy,detailsWritable=verified&&!!policy?.details,planningWritable=detailsWritable&&!!policy?.planning,dueWritable=detailsWritable&&!!policy?.due;
 const initialDates=timelineDraft(task);
 const startChanged=dates.start!==initialDates.start;
 const dueChanged=dates.end!==initialDates.end;
 const datesChanged=startChanged||dueChanged;
 const dirty=dependenciesChanged||title!==task.title||priority!==task.priority||datesChanged;
 useNavigationBlocker({label:'Edit task',dirty,pending:busy,onDiscard:onClose});
 const close=()=>void requestNavigation(onClose);
 const projectBounds={start:projectStartDate?.slice(0,10)||'',end:projectTargetDate?.slice(0,10)||''};
 const dateValidation=datesChanged?timelineError(task,dates,undefined,projectBounds):undefined;
 async function submit(){if(pending.current||!verified||!detailsWritable)return;setError('');if(!title.trim()){setError('Enter a task title.');return;}if(dateValidation){setError(dateValidation);return;}pending.current=true;setBusy(true);try{
  if(policy?.started){const patch:WorkspaceTaskPatch={};if(title.trim()!==task.title)patch.title=title.trim();if(priority!==task.priority)patch.priority=priority;if(dueChanged){if(!dueWritable)throw new Error('Only the supervising Lead or authorized Office Head can reschedule this task.');if(changeReason.trim().length<1||changeReason.trim().length>1000)throw new Error('Enter a due-date change reason (1–1,000 characters).');patch.deadline=dates.end;patch.change_reason=changeReason.trim();}if(Object.keys(patch).length)await save(patch);}
  else {
   if(dependenciesChanged){
    if(!planningWritable)throw new Error('Current access does not allow changing prerequisites.');
    const issue=projectPrerequisiteError(tasks,task.linkedProjectId,task.id,prerequisites,task.dependencyIds);
    if(issue)throw new Error(issue);
   }
   await save({title:title.trim(),priority,...(datesChanged?timelinePatch(task,dates,undefined,projectBounds):{}),...(dependenciesChanged?{dependency_ids:prerequisites}:{})});
  }
  onClose();
 }catch(reason){setError(readableUiError(reason, "Could not edit task.", 'write'));}finally{pending.current=false;setBusy(false);}}
 return <Modal isOpen title="Edit task" description="Update task details within the project schedule." width="max-w-2xl" onClose={close} preventClose={busy} footer={<div className="pf-actions"><button disabled={busy} onClick={close}>Cancel</button><button className="pf-primary" disabled={busy||!dirty||!verified||!detailsWritable} onClick={()=>void submit()}>{busy?'Saving…':'Save task'}</button></div>}>
  <div className="space-y-4">
   {policyLoading&&(
    <div role="status" className="flex items-center gap-2.5 rounded-xl border border-[var(--eflow-border,#d5e2df)] bg-[var(--eflow-subtle,#f6f9f8)] px-3.5 py-2.5 text-[13px] text-[var(--eflow-text-secondary,#52746c)]">
     <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#087972]" aria-hidden="true"/>
     <span>Checking current task editing access…</span>
    </div>
   )}
   {policyError&&<p role="alert" className="pf-error">{policyError} Editing is unavailable until access can be verified.</p>}
   {policy?.started&&(
    <div role="status" className="flex items-start gap-3 rounded-xl border border-[#bfd8f8] bg-[#f0f7ff] px-4 py-3.5 text-[#123761] dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-100">
     <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#dcebfb] text-[#0067d3] dark:bg-sky-900/80 dark:text-sky-300">
      <Info className="h-4 w-4" aria-hidden="true"/>
     </span>
     <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
       <span className="text-[13px] font-semibold leading-tight text-[#0d2d52] dark:text-sky-50">Editing rules for in-progress work</span>
       <span className="inline-flex items-center gap-1 rounded-full bg-[#dcebfb] px-2 py-0.5 text-[11px] font-medium text-[#0058b8] dark:bg-sky-900/80 dark:text-sky-200">
        <Lock className="h-3 w-3" aria-hidden="true"/>
        Schedule locked
       </span>
      </div>
      <p className="m-0 text-[12.5px] leading-relaxed text-[#264b75] dark:text-sky-200/90">Work is already in progress. Start date and prerequisites cannot be changed. Authorized editors can correct the title and priority; due-date changes require supervising authority and a reason.</p>
     </div>
    </div>
   )}
   {error&&<div role="alert" className="pf-error">{error}</div>}
   <fieldset className="pf-panel" disabled={busy||!verified}>
    <label>Task title<input value={title} disabled={busy||!detailsWritable} maxLength={300} onChange={event=>setTitle(event.target.value)}/></label>
    <div className="pf-grid">
     <label>Priority<select value={priority} disabled={busy||!detailsWritable} onChange={event=>setPriority(event.target.value as Task['priority'])}>{['low','medium','high'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     <label>Start date<DateInput min={projectBounds.start||undefined} max={(dates.end&&(!projectBounds.end||dates.end<projectBounds.end)?dates.end:projectBounds.end)||undefined} value={dates.start} disabled={busy||!planningWritable} onChange={event=>setDates({...dates,start:event.target.value})}/></label>
     <div><label>Due date<DateInput min={(dates.start&&(!projectBounds.start||dates.start>projectBounds.start)?dates.start:projectBounds.start)||undefined} max={projectBounds.end||undefined} value={dates.end} disabled={busy||!dueWritable} onChange={event=>setDates({...dates,end:event.target.value})}/></label>
     {policy?.started&&dueWritable&&dueChanged&&<label className="mt-3">Reason for due-date change<input value={changeReason} maxLength={1000} required onChange={event=>setChangeReason(event.target.value)}/></label>}</div>
    </div>
    {task.linkedProjectId&&<PrerequisiteField label="Prerequisite tasks" choices={projectPrerequisiteChoices(tasks,task.linkedProjectId,task.id,task.dependencyIds)} selected={prerequisites} disabled={!planningWritable||policy?.started} onChange={setPrerequisites}/>}
   </fieldset>
  </div>
 </Modal>;
}
