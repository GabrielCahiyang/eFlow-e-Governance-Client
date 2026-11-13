import { supabase } from "../../../../lib/supabase";

export async function cancelTask(taskId: string, reason: string): Promise<void> {
  const normalizedReason = reason.trim();
  if (!normalizedReason) throw new Error("A cancellation reason is required.");

  const { error } = await supabase.rpc("cancel_task", {
    p_task_id: taskId,
    p_reason: normalizedReason,
  });
  if (error?.code === "57014" || /canceling statement due to statement timeout/i.test(error?.message || "")) {
    throw new Error("Task cancellation took longer than the server allows. No changes were saved. Refresh the task, then try again.");
  }
  if (error) throw new Error(error.message);
}
