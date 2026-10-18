import {useAuth} from '../../contexts/AuthContext';
import {submitProgressUpdate} from '../../services/taskDiscussionService';
import {WorkExecutionForm} from '../../features/work-state';

/** Compatibility facade; work updates no longer ask for a percentage. */
export function ProgressUpdateForm({taskId,onSaved,status='in_progress'}:{taskId:string;initialPercent?:number;status?:string;onSaved?:()=>void}){
 const {user,userProfile}=useAuth();
 return <WorkExecutionForm status={status} onSave={async input=>{
  if(!user?.id)throw new Error('Sign in to update work.');
  await submitProgressUpdate({taskId,author:{id:user.id,name:userProfile?.full_name||'You'},blockerCategory:input.state==='stuck'?'Other':'None',blocker:input.blocker,note:input.note,nextStep:input.nextStep,attachment:input.files[0]});
  onSaved?.();
 }}/>;
}
