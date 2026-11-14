import {useEffect,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {submitProgressUpdate,subscribeToProgressUpdates} from '../../../services/taskDiscussionService';
import {submitTaskForReview,type Task} from '../../tasks';
import {WorkExecutionForm,approvedWorkProgress} from '../../work-state';
import type {Subtask} from '../../subtasks';
import {getTaskSubmissionReadiness} from '../../tasks/selectors/submissionReadiness';

export function InspectorExecution({task,subtasks,canStart,canResume,canSubmit,canPostProgress,busy,onChanged,onSubmitted,initialAction,pendingDependencies=0,isProjectOnHold=false}:{initialAction?:'stuck'|'submit';pendingDependencies?:number;task:Task;canStart:boolean;canResume:boolean;canSubmit:boolean;canPostProgress:boolean;busy:boolean;onStart:()=>void;onChanged?:()=>void;onSubmitted:()=>void;subtasks:Subtask[];isProjectOnHold?:boolean}){
 const {user,userProfile}=useAuth();
 const [blocker,setBlocker]=useState('');
 useEffect(()=>subscribeToProgressUpdates(task.id,updates=>setBlocker(updates[0]?.blocker||'')),[task.id]);
 const readiness=getTaskSubmissionReadiness(task,subtasks);

 const steps=approvedWorkProgress(subtasks.map(item=>({id:item.id,parent_subtask_id:item.parentSubtaskId,status:item.status})));
 const editable=canPostProgress||canStart||canResume||canSubmit;
 return <div className="space-y-4">
  {isProjectOnHold && (
   <div role="status" className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 space-y-1">
    <div className="flex items-center justify-between">
     <strong className="text-sm font-semibold text-amber-900">Project on hold</strong>
     <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded">Work actions unavailable</span>
    </div>
    <p className="text-xs text-amber-800 leading-relaxed">Work updates are paused while the project is under review.</p>
   </div>
  )}
  {pendingDependencies>0&&<div role="status" className="work-state-message"><strong>Waiting for {pendingDependencies} prerequisite task{pendingDependencies===1?'':'s'}</strong><span>You can prepare this work. Final submission waits until the linked tasks are approved.</span></div>}
  {task.rejectionNote&&task.status==='changes_requested'&&<div className="work-state-message"><strong>Requested changes</strong><p>{task.rejectionNote}</p></div>}
  {readiness.totalSubtasks>0&&<div className="work-state-message"><strong>{steps.total?steps.approved:readiness.approvedSubtasks} of {steps.total||readiness.totalSubtasks} steps complete</strong><span>{task.status==='completed'?'Task approved':task.status==='for_review'?'Final review in progress':readiness.ready?'Ready for final review':'Finish the remaining steps before final submission.'}</span></div>}
  {!isProjectOnHold && <WorkExecutionForm initialAction={initialAction} key={task.id} initialBlocker={blocker} status={task.status} statusTarget={{taskId:task.id,customId:task.customStatusId,onChanged}} readOnly={!editable||busy} canSubmit={readiness.ready&&!pendingDependencies&&(canSubmit||canStart||canResume)} onCommitted={submitted=>{if(submitted)onSubmitted();else onChanged?.();}} onSave={async input=>{
   if(!user?.id)throw new Error('Sign in to update work.');
   await submitProgressUpdate({taskId:task.id,author:{id:user.id,name:userProfile?.full_name||'You'},blockerCategory:input.state==='stuck'?'Other':'None',blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});

  }} onSubmit={async input=>{
   if(!user?.id)throw new Error('Sign in to submit work.');
   if(!(canSubmit||canStart||canResume))throw new Error('Only the task lead can submit this work.');
   if(!readiness.ready)throw new Error('Wait for the remaining steps to be completed.');
   if(pendingDependencies)throw new Error('Wait for prerequisite task approval before final submission.');
   await submitTaskForReview(task.id,{note:input.note,attachments:input.files,submitterId:user.id,submitterName:userProfile?.full_name||'You'});
  }}/>}
 </div>;
}
