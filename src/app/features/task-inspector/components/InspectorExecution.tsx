import {useEffect,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {submitProgressUpdate,subscribeToProgressUpdates} from '../../../services/taskDiscussionService';
import {submitTaskForReview,updateTaskStatus,type Task} from '../../tasks';
import {WorkExecutionForm,approvedWorkProgress} from '../../work-state';
import type {Subtask} from '../../subtasks';
import {getTaskSubmissionReadiness} from '../../tasks/selectors/submissionReadiness';

export function InspectorExecution({task,subtasks,canStart,canResume,canSubmit,canPostProgress,busy,onChanged,onSubmitted,initialAction,pendingDependencies=0}:{initialAction?:'stuck'|'submit';pendingDependencies?:number;task:Task;canStart:boolean;canResume:boolean;canSubmit:boolean;canPostProgress:boolean;busy:boolean;onStart:()=>void;onChanged?:()=>void;onSubmitted:()=>void;subtasks:Subtask[]}){
 const {user,userProfile}=useAuth();
 const [blocker,setBlocker]=useState('');
 useEffect(()=>subscribeToProgressUpdates(task.id,updates=>setBlocker(updates[0]?.blocker||'')),[task.id]);
 const readiness=getTaskSubmissionReadiness(task,subtasks);

 const steps=approvedWorkProgress(subtasks.map(item=>({id:item.id,parent_subtask_id:item.parentSubtaskId,status:item.status})));
 const editable=canPostProgress||canStart||canResume||canSubmit;
 async function start(){if(task.status==='todo'||task.status==='changes_requested')await updateTaskStatus(task.id,'in_progress',user?.id?{id:user.id,name:userProfile?.full_name||''}:undefined);}
 return <div className="space-y-4">
  {pendingDependencies>0&&<div role="status" className="work-state-message"><strong>Waiting for {pendingDependencies} prerequisite task{pendingDependencies===1?'':'s'}</strong><span>You can prepare this work. Final submission waits until the linked tasks are approved.</span></div>}
  {task.rejectionNote&&task.status==='changes_requested'&&<div className="work-state-message"><strong>Requested changes</strong><p>{task.rejectionNote}</p></div>}
  {readiness.totalSubtasks>0&&<div className="work-state-message"><strong>{steps.total?steps.approved:readiness.approvedSubtasks} of {steps.total||readiness.totalSubtasks} steps approved</strong><span>{task.status==='completed'?'Task approved':task.status==='for_review'?'Final review in progress':readiness.ready?'Ready for final review':'Finish the remaining step reviews before final submission.'}</span></div>}
  <WorkExecutionForm initialAction={initialAction} key={task.id} initialBlocker={blocker} status={task.status} readOnly={!editable||busy} canSubmit={readiness.ready&&!pendingDependencies&&(canSubmit||canStart||canResume)} onCommitted={submitted=>{if(submitted)onSubmitted();else onChanged?.();}} onSave={async input=>{
   if(!user?.id)throw new Error('Sign in to update work.');
   if((canStart||canResume)&&['todo','changes_requested'].includes(task.status))await start();
   await submitProgressUpdate({taskId:task.id,author:{id:user.id,name:userProfile?.full_name||'You'},blockerCategory:input.state==='stuck'?'Other':'None',blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});

  }} onSubmit={async input=>{
   if(!user?.id)throw new Error('Sign in to submit work.');
   if(!(canSubmit||canStart||canResume))throw new Error('Only the task lead can submit this work.');
   if(!readiness.ready)throw new Error('Wait for the remaining step approvals.');
   if(pendingDependencies)throw new Error('Wait for prerequisite task approval before final submission.');
   await start();await submitTaskForReview(task.id,{note:input.note,attachments:input.files,submitterId:user.id,submitterName:userProfile?.full_name||'You'});
  }}/>
 </div>;
}
