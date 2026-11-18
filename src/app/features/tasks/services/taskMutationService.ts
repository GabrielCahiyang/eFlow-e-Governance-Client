import { supabase } from "../../../../lib/supabase";
import { createNotification } from "../../../services/notificationService";
import type {
  CreateTaskPayload,
  Task,
  TaskAssignmentDetails,
  TaskStatus,
  UpdateTaskPayload,
} from "../taskTypes";
import { readString, readStringArray, rowToTask, taskToRow } from "./taskMapper";
import { fetchTaskById, notifyTaskListeners } from "./taskRealtimeService";
import { prerequisiteLinkingError } from "../../../shared/prerequisiteLinkingError";

export const createTask = async (
  titleOrPayload: string | CreateTaskPayload,
  description?: string,
  deadline?: string,
) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Your sign-in session has expired. Sign in again, then retry creating the task.');
  }

  let userOrgId: string | null = null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('org_id')
    .eq('id', user.id)
    .single();
  if (profile) {
    userOrgId = profile.org_id;
  }

  let newTask: Record<string, unknown>;

  if (typeof titleOrPayload === 'object') {
    const p = titleOrPayload;
    const initialStatus: TaskStatus = p.assigneeId ? 'todo' : 'pending_assignment';
    const row = taskToRow({
      title: p.title,
      description: p.description,
      deadline: p.deadline,
      status: initialStatus,
      priority: p.priority || 'medium',
      tags: p.tags || [],
      department: p.department || p.teamId || '',
      orgId: p.orgId || userOrgId || undefined,
      teamId: p.teamId || p.department || '',
      teamName: p.teamName || '',
      teamMemberIds: p.teamMemberIds || [],
      teamMemberNames: p.teamMemberNames || [],
      assigneeId: p.assigneeId || '',
      assigneeName: p.assigneeName || '',
      barangay: p.barangay || '',
      budgetImpact: p.budgetImpact || 0,
      proposalId: p.proposalId || '',
      proposalTitle: p.proposalTitle || '',
      programId: p.programId || '',
      programTitle: p.programTitle || '',
      projectId: p.projectId || '',
      projectTitle: p.projectTitle || '',
      activityId: p.activityId || '',
      activityTitle: p.activityTitle || '',
      activitySchedule: p.activitySchedule || '',
      hierarchyPath: p.hierarchyPath || '',
      importBatchId: p.importBatchId || '',
      recommendedEmployeeIds: p.recommendedEmployeeIds,
      recommendationReasoning: p.recommendationReasoning,
      recommendationSource: p.recommendationSource,
      recommendationLeadId: p.recommendationLeadId,
      reviewerId: p.reviewerId,
      backupReviewerId: p.backupReviewerId,
      acceptanceCriteria: p.acceptanceCriteria,
      definitionOfDone: p.definitionOfDone,
      dependencyIds: p.dependencyIds,
      burnoutWarning: p.burnoutWarning,
      linkedProjectId: p.linkedProjectId,
      milestoneId: p.milestoneId,
      percentComplete: p.percentComplete ?? 0,
    });
    newTask = row;
  } else {
    newTask = {
      title: titleOrPayload,
      description: description || '',
      deadline: deadline || '',
      due_date: deadline || '',
      status: 'pending_assignment',
      team_id: '',
      team_name: '',
      team_member_ids: [],
      team_member_names: [],
      org_id: userOrgId,
    };
  }

  const { data, error } = await supabase.rpc('create_task_with_details', {
    p_payload: newTask,
  });

  if (error) {
    if (error.code === 'PGRST202' || error.message.includes('create_task_with_details')) {
      throw new Error('The task database upgrade has not been applied yet. Apply the atomic task creation migration, then retry.');
    }
    throw error;
  }

  const taskRow = Array.isArray(data) ? data[0] : data;
  if (!taskRow) throw new Error('The database did not return the created task.');
  const task = rowToTask(taskRow as Record<string, unknown>);

  const taskTitle = (newTask.title as string) || 'Task';
  // Notify assignee if assigned at creation
  const assigneeId = readString(newTask.assigned_to);
  if (assigneeId) {
    await createNotification(assigneeId, {
      type: 'assignment',
      title: 'New Task Assignment',
      message: `New assignment: ${taskTitle}`,
      taskId: task.id,
      taskTitle,
    });
  }

  await notifyTaskListeners();
  return task;
};

// â”€â”€â”€ assignTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Assignment goes through the assign_task RPC: it validates the assignee is an
// active profile, advances pending_assignment → todo, and writes history +
// activity + audit + the assignee notification in one transaction. Team/detail
// columns (not status) are still a plain update — the guard trigger only blocks
// status writes, so this is allowed.
export const assignTask = async (
  taskId: string,
  assigneeId: string,
  assigneeName: string,
  assignment?: TaskAssignmentDetails,
) => {
  const { error } = await supabase.rpc('assign_task_with_details', {
    p_task_id: taskId,
    p_assignee: assigneeId || null,
    p_assignee_name: assigneeName || null,
    p_team_id: assignment?.teamId ?? null,
    p_team_name: assignment?.teamName ?? null,
    p_team_member_ids: assignment?.teamMemberIds ?? null,
    p_team_member_names: assignment?.teamMemberNames ?? null,
    p_reviewer: null,
    p_backup_reviewer: null,
    p_set_reviewers: false,
  });
  if (error) throw new Error(error.message);

  await notifyTaskListeners();
};

// â”€â”€â”€ updateTask â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Generic field update. Status can NO LONGER be written here — the guard
// trigger rejects any direct status change. If a caller still passes `status`
// (e.g. the task editor advancing pending_assignment → todo on assignment), we
// route that part through the authoritative RPC and strip it from the plain
// column update, so one call keeps working without bypassing the lifecycle.
const sameStringList = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * The editor submits a complete assignment snapshot with ordinary task
 * fields. Avoid sending an unchanged snapshot through the protected
 * assignment RPC: a rejected no-op call would otherwise be reported as a
 * failed save after the ordinary task update has already completed.
 */
const hasAssignmentDetailsChanged = (
  current: Record<string, unknown>,
  details: Pick<
    UpdateTaskPayload,
    | "assigneeId"
    | "teamId"
    | "teamName"
    | "teamMemberIds"
    | "teamMemberNames"
    | "reviewerId"
    | "backupReviewerId"
  >,
) => {
  if (
    details.assigneeId !== undefined &&
    (details.assigneeId || "") !== (readString(current.assigned_to) || "")
  ) return true;
  if (
    details.teamId !== undefined &&
    (details.teamId || "") !== (readString(current.team_id) || "")
  ) return true;
  if (
    details.teamName !== undefined &&
    (details.teamName || "") !== (readString(current.team_name) || "")
  ) return true;
  if (
    details.teamMemberIds !== undefined &&
    !sameStringList(details.teamMemberIds, readStringArray(current.team_member_ids))
  ) return true;
  if (
    details.teamMemberNames !== undefined &&
    !sameStringList(details.teamMemberNames, readStringArray(current.team_member_names))
  ) return true;
  if (
    details.reviewerId !== undefined &&
    (details.reviewerId || "") !== (readString(current.reviewer_id) || "")
  ) return true;
  return (
    details.backupReviewerId !== undefined &&
    (details.backupReviewerId || "") !==
      (readString(current.backup_reviewer_id) || "")
  );
};

export const updateTask = async (
  taskId: string,
  payload: UpdateTaskPayload,
) => {
  const {
    status,
    assigneeId,
    assigneeName: _assigneeName,
    teamId,
    teamName,
    teamMemberIds,
    teamMemberNames,
    reviewerId,
    backupReviewerId,
    ...rest
  } = payload;
  const current = await fetchTaskById(taskId);
  if (!current) throw new Error('Task not found.');

  const hasAssignmentChanges = hasAssignmentDetailsChanged(current, {
    assigneeId,
    teamId,
    teamName,
    teamMemberIds,
    teamMemberNames,
    reviewerId,
    backupReviewerId,
  }) || (status === 'todo' && current.status === 'pending_assignment' &&
    Boolean(assigneeId === undefined ? current.assigned_to : assigneeId));
  const savedParts: string[] = [];
  let savingPart = 'task details';
  try {
    const row = taskToRow(rest as Partial<Task>);
    if (Object.keys(row).length > 0) {
      const { error } = await supabase.from('tasks').update(row).eq('id', taskId);
      if (error) throw error;
      savedParts.push('task details');
    }

    if (hasAssignmentChanges) {
      savingPart = 'team and reviewer changes';
      const nextAssignee = assigneeId === undefined
        ? readString(current.assigned_to)
        : assigneeId || undefined;
      const { error } = await supabase.rpc('assign_task_with_details', {
        p_task_id: taskId,
        p_assignee: nextAssignee || null,
        p_assignee_name: null,
        p_team_id: teamId ?? null,
        p_team_name: teamName ?? null,
        p_team_member_ids: teamMemberIds ?? null,
        p_team_member_names: teamMemberNames ?? null,
        p_reviewer: (reviewerId === undefined ? readString(current.reviewer_id) : reviewerId) || null,
        p_backup_reviewer: (backupReviewerId === undefined ? readString(current.backup_reviewer_id) : backupReviewerId) || null,
        p_set_reviewers: reviewerId !== undefined || backupReviewerId !== undefined,
      });
      if (error) throw new Error(error.message);
      savedParts.push('team and reviewer changes');
    }

    if (status) {
      savingPart = 'status change';
      const refreshed = await fetchTaskById(taskId);
      if (!refreshed) throw new Error('Could not verify the current task status.');
      if (refreshed.status !== status) {
        const { error } = await supabase.rpc('transition_task_status', {
          p_task_id: taskId,
          p_to_status: status,
          p_feedback: null,
          p_reason: null,
        });
        if (error) throw new Error(error.message);
        savedParts.push('status change');
      }
    }
  } catch (error) {
    // Multiple existing workflow calls can partially succeed. Refresh committed
    // changes and tell the editor precisely which part still needs attention.
    if (savedParts.length > 0) await notifyTaskListeners();
    const rawReason = error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : 'Please try again.';
    const reason = prerequisiteLinkingError(rawReason);
    const saved = savedParts.length > 0
      ? `Saved ${savedParts.join(' and ')}, but could not save ${savingPart}. `
      : `Could not save ${savingPart}. `;
    throw new Error(saved + reason);
  }

  await notifyTaskListeners();
};

// â”€â”€â”€ updateTaskStatus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// The single client entry point for a lifecycle move (board drag, "Start work",
// reopen, etc.). It delegates to the transition_task_status RPC, which validates
// the transition table + actor authorization and writes history/activity/audit/
// notification atomically. `reason` carries a reopen reason or feedback when the
// transition requires one (completed → in_progress, → changes_requested).
