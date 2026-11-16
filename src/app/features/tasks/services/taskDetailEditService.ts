import { supabase } from "../../../../lib/supabase";
import type { Task } from "../taskTypes";
import { prerequisiteLinkingError } from "../../../shared/prerequisiteLinkingError";
import { workTimelineError } from "../../../shared/workTimelineError";

export interface TaskDetailEditState {
  version: 1;
  task_id: string;
  node_id: null;
  updated_at: string | null;
  started: boolean;
  details: boolean;
  due: boolean;
  planning: boolean;
}

/** A missing or malformed RPC is unavailable authority, never a client-side allow. */
export async function fetchTaskDetailEditState(taskId: string): Promise<TaskDetailEditState> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in again to check task editing access.");
  const { data, error } = await supabase.rpc("work_detail_edit_state", { p_task_id: taskId, p_node_id: null });
  if (error) throw new Error(/PGRST202|work_detail_edit_state/i.test(`${error.code || ""} ${error.message}`)
    ? "Limited task editing is unavailable until the approved database update is installed."
    : error.message);
  if (!data || typeof data !== "object") throw new Error("Task editing access could not be verified.");
  const value = data as Record<string, unknown>;
  if (value.version !== 1 || value.task_id !== taskId || value.node_id !== null ||
      (value.updated_at !== null && typeof value.updated_at !== "string") || typeof value.started !== "boolean" ||
      typeof value.details !== "boolean" || typeof value.due !== "boolean" ||
      typeof value.planning !== "boolean") {
    throw new Error("Task editing access returned an unsupported response. Refresh the task.");
  }
  const { data: { user: currentUser }, error: currentAuthError } = await supabase.auth.getUser();
  if (currentAuthError || !currentUser || currentUser.id !== user.id) throw new Error("Your sign-in changed while task editing access was checked. Refresh and try again.");
  return {
    version: 1, task_id: taskId, node_id: null,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : null,
    started: value.started as boolean, details: value.details as boolean,
    due: value.due as boolean, planning: value.planning as boolean,
  };
}

/** Writes only changed title/priority/due values through the guarded policy RPC. */
export async function saveStartedTaskDetails(
  task: Task,
  patch: { title?: string; priority?: Task["priority"]; deadline?: string },
  changeReason?: string,
): Promise<void> {
  const state = await fetchTaskDetailEditState(task.id);
  if (typeof task.updatedAt === "number" && state.updated_at && Date.parse(state.updated_at) !== task.updatedAt) {
    throw new Error("The task changed while editing access was checked. Refresh and review the current task.");
  }
  if (!state.started || !state.details) throw new Error("Task details are read-only. Refresh the task and check its current workflow.");
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined && patch.title !== task.title) body.title = patch.title;
  if (patch.priority !== undefined && patch.priority !== task.priority) body.priority = patch.priority;
  const previousDue = task.deadline || task.dueDate || "";
  if (patch.deadline !== undefined && patch.deadline !== previousDue) {
    if (!state.due) throw new Error("Only the supervising Lead or authorized Office Head can reschedule this task.");
    const reason = changeReason?.trim() || "";
    if (reason.length < 1 || reason.length > 1000) throw new Error("Enter a due-date change reason (1–1,000 characters).");
    body.deadline = patch.deadline;
    body.change_reason = reason;
  }
  if (!Object.keys(body).length) return;
  const rpc = task.linkedProjectId ? "edit_selected_project_task" : "phase3_patch_task";
  const { error } = await supabase.rpc(rpc, { p_task_id: task.id, p_patch: body });
  if (error) throw new Error(workTimelineError(prerequisiteLinkingError(error.message)));
}
