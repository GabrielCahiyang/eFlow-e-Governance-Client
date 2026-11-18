import type {Subtask} from '../../../services/subtaskService';
import {WorkExecutionForm} from '../../work-state';
import {useSubtaskProgressSave} from '../hooks/useSubtaskProgressSave';
import {useRef,useState} from 'react';
import {completeSubitem,subitemCompletionAttempt,type SubitemCompletionAttempt} from '../services/subtaskCompletion';

export function SubtaskProgressForm({subtask,prerequisite,onSaved,readOnly=false,disabled=false,canSubmit=true,showCompletion=true,submitBlockedReason=null,initialBlocker='',dependencyBlockedReason,recheckCompletion,recheckProgress}:{subtask:Subtask;prerequisite?:Subtask|null;onSaved:()=>void|Promise<void>;readOnly?:boolean;disabled?:boolean;canSubmit?:boolean;showCompletion?:boolean;submitBlockedReason?:string|null;initialBlocker?:string;dependencyBlockedReason?:string|null;recheckCompletion?:()=>Promise<void>;recheckProgress?:()=>Promise<void>}){
 const attempt=useRef<SubitemCompletionAttempt|undefined>(undefined),[retry,setRetry]=useState(false);
 const progress=useSubtaskProgressSave(subtask.id,onSaved,recheckProgress);
 const applicablePrerequisite=prerequisite&&(subtask.dependencyIds==null||subtask.dependencyIds.includes(prerequisite.id))?prerequisite:null;
 return <>{progress.message&&<p role="status">{progress.message}</p>}<WorkExecutionForm key={subtask.id+showCompletion} completionMode={showCompletion?'direct':'review'} freezeFields={retry} status={subtask.status} statusTarget={{taskId:subtask.taskId,subtaskId:subtask.id,customId:subtask.customStatusId,onChanged:onSaved}} initialBlocker={initialBlocker} initialAction={showCompletion&&subtask.status==='for_review'?'submit':undefined} readOnly={readOnly} disabled={disabled||progress.blocked} canSubmit={canSubmit} submitBlockedReason={submitBlockedReason} blockedBy={dependencyBlockedReason|| (applicablePrerequisite&&subtask.status!=='completed'?`Complete “${applicablePrerequisite.title}” first.`:undefined)}
  onSave={progress.save}
  onSubmit={showCompletion?async input=>{attempt.current??=subitemCompletionAttempt(subtask.id,input.note,input.files,subtask.taskId);setRetry(true);await completeSubitem(attempt.current,recheckCompletion);await Promise.resolve().then(onSaved).catch(()=>{});attempt.current=undefined;setRetry(false);}:undefined}/></>;
}
