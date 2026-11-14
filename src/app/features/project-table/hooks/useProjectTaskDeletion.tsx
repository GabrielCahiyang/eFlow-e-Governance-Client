import { useRef, useState } from 'react';
import { cancelTask, deleteTask, notifyTaskListeners, type Task } from '../../tasks';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { useReviewedMutation } from '../../../shared/useReviewedMutation';

/** Uses the existing audited soft-delete command; project history is retained. */
export function useProjectTaskDeletion(task: Task, allowed: boolean, hasSubtasks=false) {
  const current = useRef({ task, allowed });
  current.current = { task, allowed };
  const action = useReviewedMutation(`project-task-delete:${task.id}`);
  const [cancellation,setCancellation]=useState<{version:Task['updatedAt'];reason:string}>();
  const cancel=['in_progress','changes_requested'].includes(task.status)||hasSubtasks;
  const label=cancel?'Cancel task':'Delete task';
  const remove = async () => {
    if (!allowed) return;
    if(cancel){setCancellation({version:task.updatedAt,reason:''});return;}
    await action.run({
      key: `delete:${task.updatedAt}`,
      confirmation: {
        title: 'Delete task?',
        description: `Remove the unstarted task “${task.title}” from the project? Its audit record is retained.`,
        actionLabel: 'Delete task',
        danger: true,
      },
      validate: () => {
        if (!current.current.allowed || current.current.task.updatedAt !== task.updatedAt)
          throw new Error('This task changed. Reopen its menu and try again.');
      },
      operation: () => deleteTask(task.id),
      success: 'Task deleted.',
    });
  };
  const dialog=cancellation?<DecisionModal title="Cancel task" description={`Cancel “${task.title}” and preserve its work history.`}
   decision="changes" confirmLabel="Cancel task" requireReason reason={cancellation.reason} busy={action.pending}
   disabled={!allowed||cancellation.version!==task.updatedAt}
   onReasonChange={reason=>setCancellation({...cancellation,reason})} onCancel={()=>setCancellation(undefined)}
   onConfirm={()=>{void action.run({
    key:`cancel:${cancellation.version}`,operation:()=>cancelTask(task.id,cancellation.reason),
    success:'Task cancelled.',onSaved:()=>setCancellation(undefined),refresh:notifyTaskListeners,
   });}}
   error={action.tone==='error'?action.message:undefined}/>:action.dialog;
  return { ...action, dialog, label, remove };
}
