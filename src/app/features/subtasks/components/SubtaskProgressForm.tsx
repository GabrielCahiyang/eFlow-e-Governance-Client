import type {Subtask} from '../../../services/subtaskService';
import {WorkExecutionForm} from '../../work-state';
import {saveSubtaskWorkUpdate,submitSubtaskForReview} from '../services/subtaskWorkflowService';

export function SubtaskProgressForm({subtask,prerequisite,onSaved,readOnly=false,disabled=false,canSubmit=true,initialBlocker=''}:{subtask:Subtask;prerequisite?:Subtask|null;onSaved:()=>void|Promise<void>;readOnly?:boolean;disabled?:boolean;canSubmit?:boolean;initialBlocker?:string}){
 return <WorkExecutionForm key={subtask.id} status={subtask.status} initialBlocker={initialBlocker} readOnly={readOnly} disabled={disabled} canSubmit={canSubmit} blockedBy={prerequisite&&!['completed','for_review'].includes(subtask.status)?`Waiting for “${prerequisite.title}” to be approved.`:undefined}
  onSave={async input=>{await saveSubtaskWorkUpdate({subtaskId:subtask.id,state:input.state,blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});await onSaved();}}
  onSubmit={async input=>{await submitSubtaskForReview({subtaskId:subtask.id,note:input.note,evidence:input.files});await onSaved();}}/>;
}
