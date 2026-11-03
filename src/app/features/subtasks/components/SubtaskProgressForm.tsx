import type {Subtask} from '../../../services/subtaskService';
import {WorkExecutionForm} from '../../work-state';
import {saveSubtaskWorkUpdate} from '../services/subtaskWorkflowService';
import {useRef,useState} from 'react';
import {completeSubitem,subitemCompletionAttempt,type SubitemCompletionAttempt} from '../services/subtaskCompletion';

export function SubtaskProgressForm({subtask,prerequisite,onSaved,readOnly=false,disabled=false,canSubmit=true,submitBlockedReason=null,initialBlocker=''}:{subtask:Subtask;prerequisite?:Subtask|null;onSaved:()=>void|Promise<void>;readOnly?:boolean;disabled?:boolean;canSubmit?:boolean;submitBlockedReason?:string|null;initialBlocker?:string}){
 const attempt=useRef<SubitemCompletionAttempt|undefined>(undefined),[retry,setRetry]=useState(false);
 return <WorkExecutionForm key={subtask.id} completionMode="direct" freezeFields={retry} status={subtask.status} initialBlocker={initialBlocker} initialAction={subtask.status==='for_review'?'submit':undefined} readOnly={readOnly} disabled={disabled} canSubmit={canSubmit} submitBlockedReason={submitBlockedReason} blockedBy={prerequisite&&subtask.status!=='completed'?`Complete “${prerequisite.title}” first.`:undefined}
  onSave={async input=>{await saveSubtaskWorkUpdate({subtaskId:subtask.id,state:input.state,blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});await Promise.resolve().then(onSaved).catch(()=>{});}}
  onSubmit={async input=>{attempt.current??=subitemCompletionAttempt(subtask.id,input.note,input.files);setRetry(true);await completeSubitem(attempt.current);await Promise.resolve().then(onSaved).catch(()=>{});attempt.current=undefined;setRetry(false);}}/>;
}
