import { supabase } from "../../../../lib/supabase";
import { notifyProjectListeners } from "./projectQueryService";
import type { ProjectStatus } from "./types";
import type { UnusedProjectFunding } from "../../project-setup";

export interface ProjectCompletionBlocker {
  kind: "work" | "task" | "subtask" | "cash" | "governance" | "funding";
  id: string;
  taskId?: string;
  title: string;
  status: string;
  detail: string;
  amount?: number;
  unusedFunding?: UnusedProjectFunding;
}
export interface ProjectCompletionReadiness {
  projectId: string;
  title: string;
  status: ProjectStatus;
  canComplete: boolean;
  blockers: ProjectCompletionBlocker[];
}

function lifecycleError(error: { code?: string; message: string; details?: string | null }): Error {
  if (error.code === "PGRST202") {
    return new Error("Project completion is not installed in Supabase yet. Apply migration 20260831000003_project_completion_lifecycle.sql, then retry.");
  }
  let blockers: ProjectCompletionBlocker[] = [];
  try { const parsed = JSON.parse(error.details || "null"); if (Array.isArray(parsed)) blockers = parsed; } catch { /* ordinary database detail */ }
  const details = blockers.map((item) => `${item.title}: ${item.detail}`).join("\n");
  return new Error(details || error.message);
}

export async function fetchProjectCompletionReadiness(projectId: string): Promise<ProjectCompletionReadiness> {
  const { data, error } = await supabase.rpc("get_project_completion_readiness", { p_project_id: projectId });
  if (error) throw lifecycleError(error);
  if (!data || !Array.isArray(data.blockers)) throw new Error("Project completion checks did not return a valid result. Retry before completing the project.");
  return data as ProjectCompletionReadiness;
}

export async function completeProject(projectId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc("complete_project", { p_project_id: projectId, p_note: note?.trim() || null });
  if (error) throw lifecycleError(error);
  await notifyProjectListeners();
}

export async function archiveCompletedProject(projectId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("archive_completed_project", { p_project_id: projectId, p_reason: reason?.trim() || null });
  if (error) throw lifecycleError(error);
  await notifyProjectListeners();
}
