import { supabase } from "../../../platform/supabase";
import { PublicMessageError } from "../../shared/userMessages";

export type WorkDetailEditState = {
  version: 1;
  task_id: string;
  node_id: string | null;
  updated_at: string | null;
  started: boolean;
  details: boolean;
  due: boolean;
  planning: boolean;
};

export const detailEditingUnavailable =
  "Editing permissions could not be verified. Refresh this work. If this continues, the shared editing update may still need installation.";

export function readDetailEditState(
  value: unknown,
  taskId: string,
  nodeId: string | null = null,
): WorkDetailEditState | undefined {
  if (!value || typeof value !== "object") return;
  const state = value as WorkDetailEditState;
  if (
    state.version !== 1 ||
    state.task_id !== taskId ||
    state.node_id !== nodeId ||
    ![state.started, state.details, state.due, state.planning].every(
      (v) => typeof v === "boolean",
    )
  )
    return;
  return state;
}

export async function fetchDetailEditState(
  taskId: string,
): Promise<WorkDetailEditState> {
  const result = await supabase.rpc("work_detail_edit_state", {
    p_task_id: taskId,
    p_node_id: null,
  });
  if (result.error) throw new PublicMessageError(detailEditingUnavailable);
  const state = readDetailEditState(result.data, taskId);
  if (!state) throw new PublicMessageError(detailEditingUnavailable);
  return state;
}

/** Compare actual changes, so old forms may resend unchanged planning values. */
export function detailEditError(
  state: WorkDetailEditState | undefined,
  changes: {
    planning?: boolean;
    due?: boolean;
    reason?: string;
  },
): string {
  if (!state) return detailEditingUnavailable;
  if (!state.details)
    return "These work details are read-only. Refresh the work or use its existing review or reopen action.";
  if (changes.planning && !state.planning)
    return "Start date, prerequisites and structure cannot change after work has started.";
  if (changes.due && !state.due)
    return "Only the supervising Lead or authorized Office Head can reschedule this work.";
  if (changes.due && state.started && !changes.reason?.trim())
    return "Enter a reason for changing the due date.";
  if (changes.reason && changes.reason.trim().length > 1000)
    return "Keep the schedule change reason within 1,000 characters.";
  return "";
}
