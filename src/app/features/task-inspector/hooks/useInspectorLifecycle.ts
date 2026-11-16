import { useRef, useState } from 'react';
import { fetchTaskById, updateTaskStatus, type Task } from '../../tasks';
import { useAuth } from '../../../contexts/AuthContext';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';
import { useConfirmation } from '../../../components/ui/useConfirmation';
export function useInspectorLifecycle(task: Task | null, onChanged?: () => void, _onClose?: () => void) {
 const { user, userProfile } = useAuth();
 const pending = useRef(false);
 const currentScope = useRef({taskId:task?.id,actorId:user?.id});
 currentScope.current={taskId:task?.id,actorId:user?.id};
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 const confirmation=useConfirmation();
 useNavigationBlocker({ dirty: false, pending: busy, pendingCheck: () => pending.current, label: 'Task lifecycle', onDiscard: () => {} });
 const runStart=async()=>{
  if(!task||pending.current)return;pending.current=true;setBusy(true);setError('');
  try{
   const action=task.status==='changes_requested'?'Resume work':'Start work';
   const accepted=await confirmation.confirm({title:action+'?',description:`${action} on “${task.title}”? This records work in progress and makes its subtasks visible to authorized project readers.`,actionLabel:action});
   if(!accepted)return;
   if(currentScope.current.taskId!==task.id||currentScope.current.actorId!==user?.id)throw new Error('Your current task or sign-in changed. Refresh before starting work.');
   const current=await fetchTaskById(task.id);
   if(currentScope.current.taskId!==task.id||currentScope.current.actorId!==user?.id)throw new Error('Your current task or sign-in changed. Refresh before starting work.');
   if(!current||current.status!==task.status||!['todo','changes_requested'].includes(String(current.status))||Date.parse(String(current.updated_at||''))!==task.updatedAt)throw new Error('The task changed while Start work was open. Refresh and review the current task.');
   await updateTaskStatus(task.id,'in_progress',user?.id?{id:user.id,name:userProfile?.full_name||''}:undefined);onChanged?.();
  }catch(reason){setError(reason instanceof Error?reason.message:'Could not update this task.');}
  finally{pending.current=false;setBusy(false);}
 };
 const start = () => {if(!task||pending.current)return;void requestNavigation(()=>{void runStart();});};
 return { busy, error, start, dialog:confirmation.dialog };
}
