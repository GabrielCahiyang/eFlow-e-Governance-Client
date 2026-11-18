import {useEffect,useState} from 'react';
import {Button} from '@vibe/core';
import {Clock3} from 'lucide-react';
import {useAuth} from '../../../contexts/AuthContext';
import {submitProgressUpdate,subscribeToProgressUpdates} from '../../../services/taskDiscussionService';
import {getTaskSubmissionReadiness,isTaskLead,submitTaskForReview,type Task} from '../../tasks';
import {WorkExecutionForm} from '../../work-state';
import {SubitemLeadReview,type Subtask} from '../../subtasks';
import {assertWorkAcceptanceAvailable,WorkFinancialClearancePanel} from '../../budget';

export function InspectorExecution({task,subtasks,canStart,canResume,canSubmit,canPostProgress,busy,onStart,onChanged,onSubmitted,initialAction,pendingDependencies=0,startBlockedReason=null,isProjectOnHold=false,hideClearancePanel=false}:{initialAction?:'stuck'|'submit';pendingDependencies?:number;startBlockedReason?:string|null;task:Task;canStart:boolean;canResume:boolean;canSubmit:boolean;canPostProgress:boolean;busy:boolean;onStart:()=>void;onChanged?:()=>void;onSubmitted:()=>void;subtasks:Subtask[];isProjectOnHold?:boolean;hideClearancePanel?:boolean}){
 const {user,userProfile}=useAuth();
 const [progress,setProgress]=useState({taskId:task.id,blocker:'',confirmed:false,error:''});
 const [retry,setRetry]=useState(0);
 useEffect(()=>subscribeToProgressUpdates(task.id,updates=>setProgress({taskId:task.id,blocker:updates[0]?.blocker||'',confirmed:true,error:''}),
  message=>setProgress(previous=>({taskId:task.id,blocker:previous.taskId===task.id?previous.blocker:'',confirmed:previous.taskId===task.id&&previous.confirmed,error:message}))),[task.id,retry]);
 const sameTask=progress.taskId===task.id;
 const blocker=sameTask?progress.blocker:'';
 const progressPending=!sameTask||!progress.confirmed;
 const progressError=sameTask?progress.error:'';
 const readiness=getTaskSubmissionReadiness(task,subtasks);

 const steps=subtasks.filter(item=>!item.parentSubtaskId);
 const completedSteps=steps.filter(item=>item.status==='completed').length;
 const waitingToStart=['todo','changes_requested'].includes(task.status);
 const editable=!waitingToStart&&(canPostProgress||canSubmit);
 const projectWork=!!task.linkedProjectId&&!task.sourceCollaborationDraftId;
 const directExecution=!projectWork||isTaskLead(task,user?.id);
 return <div className="space-y-4">
  {isProjectOnHold && (
   <div role="status" className="task-page__hold-banner">
    <div className="task-page__hold-banner-head">
     <strong>Project on hold</strong>
     <span>Work actions unavailable</span>
    </div>
    <p>Work updates are paused while the project is under review.</p>
   </div>
  )}
  {pendingDependencies>0&&<div role="status" className="work-state-message"><strong>Waiting for {pendingDependencies} prerequisite task{pendingDependencies===1?'':'s'}</strong><span>Starting work and final submission both wait until every prerequisite task is completed and approved.</span></div>}
  {startBlockedReason&&!pendingDependencies&&<p role="status" className="work-state-message">{startBlockedReason}</p>}
  {!hideClearancePanel&&typeof WorkFinancialClearancePanel==='function'&&<WorkFinancialClearancePanel root={task.id} readOnly={isProjectOnHold||!editable} onSaved={()=>{onChanged?.();}}/>}
  {projectWork&&!waitingToStart&&user?.id&&typeof SubitemLeadReview==='function'&&<SubitemLeadReview key={`${user.id}:${task.id}`} root={task.id} node={null} actor={user.id} status={task.status} initialBlocker={blocker} currentProgress={task.percentComplete} readOnly={isProjectOnHold||!editable} pending={busy||progressPending||!!progressError} blocked={pendingDependencies?'Wait for prerequisite task approval before submitting work.':undefined} reviewerName={task.assigneeName} onChanged={async()=>{onChanged?.();}}/>}
  {progressError?<div role="alert"><p>Could not refresh work updates. {progress.confirmed?'The last confirmed blocker is still shown.':'Blocker status could not be verified.'} {progressError}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Retry work updates</button></div>:progressPending&&!(waitingToStart&&!(canStart||canResume))&&<p role="status">Checking work updates…</p>}
  {task.rejectionNote&&task.status==='changes_requested'&&<div className="work-state-message"><strong>Requested changes</strong><p>{task.rejectionNote}</p></div>}
  {steps.length>0&&<div className="work-state-message"><strong>{completedSteps} of {steps.length} steps complete</strong><span>{task.status==='completed'?'Task approved':task.status==='for_review'?'Final review in progress':readiness.ready?'Ready for final review':'Finish the remaining steps before final submission.'}</span></div>}
  {!isProjectOnHold&&waitingToStart&&(canStart||canResume)&&<Button disabled={busy||progressPending||!!progressError} onClick={onStart}>{busy?'Starting.':canResume?'Resume work':'Start work'}</Button>}
  {!isProjectOnHold&&waitingToStart&&!(canStart||canResume)&&!pendingDependencies&&!startBlockedReason&&(
   <div role="status" className="work-state-message">
    <Clock3 size={18} className="mt-0.5 shrink-0 text-[var(--eflow-text-muted)]" />
    <div>
     <strong>{task.status==='changes_requested'?'Waiting for task lead to resume work':'Work hasn\'t started yet'}</strong>
     <p>
      {task.status==='changes_requested'
       ?`Only the task lead${task.assigneeName?` (${task.assigneeName})`:''} can resume this task. You can't update progress until work resumes.`
       :`Only the task lead${task.assigneeName?` (${task.assigneeName})`:''} can start this task. You can't update progress on this work until it is started.`}
     </p>
    </div>
   </div>
  )}
  {directExecution && !isProjectOnHold && !waitingToStart && <WorkExecutionForm initialAction={initialAction} key={task.id} initialBlocker={blocker} status={task.status} statusTarget={{taskId:task.id,customId:task.customStatusId,onChanged}} readOnly={!editable} disabled={busy||progressPending||!!progressError} canSubmit={readiness.ready&&!pendingDependencies&&(canSubmit||canStart||canResume)} onCommitted={submitted=>{if(submitted)onSubmitted();else onChanged?.();}} onSave={async input=>{
   if(!user?.id)throw new Error('Sign in to update work.');
   if(!editable)throw new Error(startBlockedReason||'This task cannot be updated yet.');
   await submitProgressUpdate({taskId:task.id,author:{id:user.id,name:userProfile?.full_name||'You'},blockerCategory:input.state==='stuck'?'Other':'None',blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});

  }} onSubmit={async input=>{
   if(!user?.id)throw new Error('Sign in to submit work.');
   if(!(canSubmit||canStart||canResume))throw new Error('Only the task lead can submit this work.');
   if(!readiness.ready)throw new Error('Wait for the remaining steps to be completed.');
   if(pendingDependencies)throw new Error('Wait for prerequisite task approval before final submission.');
   if(typeof assertWorkAcceptanceAvailable==='function')await assertWorkAcceptanceAvailable(task.id);
   await submitTaskForReview(task.id,{note:input.note,attachments:input.files,submitterId:user.id,submitterName:userProfile?.full_name||'You'});
  }}/>}
 </div>;
}
