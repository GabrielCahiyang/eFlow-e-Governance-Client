import { supabase } from "../../../../lib/supabase";
import { MutationRejectedError } from '../../../shared/MutationRejectedError';
import type {
  TaskActor,
  TaskAssignmentDetails,
  TaskStatus,
  TaskUndoInput,
} from "../taskTypes";
import { notifyTaskListeners } from "./taskRealtimeService";
import { getReviewDecisionErrorMessage } from "./taskReviewError";

export const updateTaskStatus = async (
  taskId: string,
  status: TaskStatus,
  _actor?: TaskActor,
  reason?: string,
) => {
  const { error } = await supabase.rpc('transition_task_status', {
    p_task_id: taskId,
    p_to_status: status,
    p_feedback: status === 'changes_requested' ? (reason || null) : null,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
  await notifyTaskListeners();
};

// Starts newly delegated work without making callers reproduce lifecycle
// rules. The status read keeps this idempotent when realtime data is stale;
// the RPC remains the authority for permissions, history, audit, and notices.
export const startTaskIfTodo = async (taskId: string): Promise<boolean> => {
  const readStatus = async (): Promise<TaskStatus | null> => {
    const { data, error } = await supabase
      .from('tasks')
      .select('status')
      .eq('id', taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.status as TaskStatus | undefined) || null;
  };

  const currentStatus = await readStatus();
  if (currentStatus !== 'todo') return false;

  const { error } = await supabase.rpc('transition_task_status', {
    p_task_id: taskId,
    p_to_status: 'in_progress',
    p_feedback: null,
    p_reason: null,
  });

  if (error) {
    // Another client may have started the task between the read and the RPC.
    // Treat that race as success while preserving every other lifecycle error.
    if ((await readStatus()) === 'in_progress') return false;
    throw new Error(error.message);
  }

  await notifyTaskListeners();
  return true;
};

// â”€â”€â”€ submitTaskForReview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export { submitTaskForReview } from './taskEvidenceSubmission';

// â”€â”€â”€ verifyTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// The actor is derived server-side from auth.uid() inside the RPC, so the
// `_actor` argument is retained only for call-site compatibility.
export const verifyTask = async (
  taskId: string,
  approve: boolean,
  feedback?: string,
  _actor?: TaskActor,
) => {
  // A rejection is now the first-class `changes_requested` state (plan §2.1),
  // no longer an `in_progress` task carrying a rejection note — so history and
  // reports can tell ordinary work apart from rework. The RPC requires feedback
  // for that transition, so validate before we do any write.
  const reason = (feedback || '').trim();
  if (!approve && !reason) {
    throw new Error('Feedback is required when requesting changes.');
  }

  const { error } = await supabase.rpc('decide_task_review', {
    p_task_id: taskId,
    p_approve: approve,
    p_feedback: reason || null,
    p_audit_hash: null,
  });
  if (error) {
    // A deployment that received the UI but not the review RPC otherwise
    // surfaces as an opaque browser 404. Keep the next action explicit while
    // preserving all successful review behaviour.
    throw new Error(getReviewDecisionErrorMessage(error));
  }

  await notifyTaskListeners();
};

// â”€â”€â”€ deleteTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const deleteTask = async (taskId: string): Promise<void> => {
  const { error } = await supabase.rpc('soft_delete_task', { p_task_id: taskId });
  if (error) {
    // SQL constraint/authorization failures roll the entire command back.
    // Transport failures still have an unknown outcome and must be verified.
    if (/^(22|23|28|42|P0)/.test(error.code || '') || error.code === 'PGRST202')
      throw new MutationRejectedError(error.message, error.code);
    throw new Error(error.message);
  }
  await notifyTaskListeners();
};

// â”€â”€â”€ reassignTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Reassignment reuses the assign_task RPC (active-profile validation + history/
// activity/audit + assignee notification), then writes any team-detail columns.
// We add a reassignment-flavored notification on top of the RPC's generic
// assignment one so the new owner sees it framed as a handover.
export const reassignTask = async (
  taskId: string,
  newAssigneeId: string,
  newAssigneeName: string,
  newTeam?: TaskAssignmentDetails,
  _oldAssigneeName?: string,
) => {
  const { error } = await supabase.rpc('assign_task_with_details', {
    p_task_id: taskId,
    p_assignee: newAssigneeId || null,
    p_assignee_name: newAssigneeName || null,
    p_team_id: newTeam?.teamId ?? null,
    p_team_name: newTeam?.teamName ?? null,
    p_team_member_ids: newTeam?.teamMemberIds ?? null,
    p_team_member_names: newTeam?.teamMemberNames ?? null,
    p_reviewer: null,
    p_backup_reviewer: null,
    p_set_reviewers: false,
  });
  if (error) throw new Error(error.message);

  await notifyTaskListeners();
};

// â”€â”€â”€ undoCompletedTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const undoCompletedTask = async (
  taskId: string,
  undoInput: TaskUndoInput,
): Promise<void> => {
  const reason = undoInput.reason.trim();
  if (!reason) throw new Error('Undo reason is required.');

  // Reopen is the completed → in_progress transition. The RPC enforces the
  // mandatory reason, stamps reopen_reason/reopened_at/reopened_by_id, and
  // writes history/activity/audit + notifies the assignee — all atomically.
  const { error } = await supabase.rpc('transition_task_status', {
    p_task_id: taskId,
    p_to_status: 'in_progress',
    p_feedback: null,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);

  await notifyTaskListeners();
};

// â”€â”€â”€ Activity Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
