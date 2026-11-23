import { supabase } from "../../../../lib/supabase";
import { notifyProjectListeners } from "./projectQueryService";
import type { ProjectCompletionReviewStatus, ProjectStatus } from "./types";
import type { UnusedProjectFunding } from "../../project-setup";

export interface ProjectCompletionBlocker {
  kind: "work" | "task" | "subtask" | "cash" | "governance" | "funding" | "lead_review";
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
  workBlockersCount?: number;
  projectLeadId?: string | null;
  projectLeadName?: string;
  requiresHeadCompletionReview?: boolean;
  completionReviewStatus?: ProjectCompletionReviewStatus;
  completionRequestedBy?: string | null;
  completionRequestedByName?: string;
  completionRequestedAt?: string | null;
  completionRequestNote?: string;
  completionReviewFeedback?: string;
  completionReviewedByName?: string;
  completionReviewedAt?: string | null;
  canRequestCompletionReview?: boolean;
  canApproveCompletion?: boolean;
}
export interface PendingProjectCompletionReview {
  projectId: string;
  projectTitle: string;
  orgId: string;
  projectLeadId: string | null;
  projectLeadName: string;
  requestedBy: string | null;
  requestedByName: string;
  requestedAt: string | null;
  note: string;
  startDate: string | null;
  targetDate: string | null;
}

export interface PendingProjectTaskPreview {
  id: string;
  title: string;
  dueDate: string | null;
  assigneeName: string;
}

export interface PendingNonHeadProjectApproval {
  projectId: string;
  title: string;
  description: string;
  scope: string;
  orgId: string;
  officeName?: string;
  startDate: string | null;
  targetDate: string | null;
  fundingNotRequired: boolean;
  requestedBy: string | null;
  requestedByName: string;
  requestedAt: string | null;
  createdAt?: string | null;
  projectLeadId: string | null;
  projectLeadName: string;
  taskCount?: number;
  memberCount?: number;
  tasksPreview?: PendingProjectTaskPreview[];
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

const inFlightCompletionReadiness = new Map<string, Promise<ProjectCompletionReadiness>>();

export function fetchProjectCompletionReadiness(projectId: string): Promise<ProjectCompletionReadiness> {
  const existing = inFlightCompletionReadiness.get(projectId);
  if (existing) return existing;
  const request = (async () => {
    const { data, error } = await supabase.rpc("get_project_completion_readiness", { p_project_id: projectId });
    if (error) throw lifecycleError(error);
    if (!data || !Array.isArray(data.blockers)) throw new Error("Project completion checks did not return a valid result. Retry before completing the project.");
    return data as ProjectCompletionReadiness;
  })().finally(() => {
    if (inFlightCompletionReadiness.get(projectId) === request) {
      inFlightCompletionReadiness.delete(projectId);
    }
  });
  inFlightCompletionReadiness.set(projectId, request);
  return request;
}

export async function fetchProjectDeletionBlockers(projectId: string): Promise<string[] | null> {
  const { data, error } = await supabase.rpc("get_project_deletion_blockers", { p_project_id: projectId });
  if (error?.code === "42501") return null;
  if (error || !Array.isArray(data) || data.some((blocker) => typeof blocker !== "string")) {
    throw new Error("Could not check whether this project can be deleted. Try again.");
  }
  return data;
}

export async function requestProjectCompletionReview(
  projectId: string,
  note?: string,
): Promise<ProjectCompletionReadiness> {
  const { data, error } = await supabase.rpc("request_project_completion_review", {
    p_project_id: projectId,
    p_note: note?.trim() || null,
  });
  if (error) throw lifecycleError(error);
  await notifyProjectListeners();
  return data as ProjectCompletionReadiness;
}

export async function returnProjectCompletionReview(
  projectId: string,
  feedback: string,
): Promise<ProjectCompletionReadiness> {
  const { data, error } = await supabase.rpc("return_project_completion_review", {
    p_project_id: projectId,
    p_feedback: feedback.trim(),
  });
  if (error) throw lifecycleError(error);
  await notifyProjectListeners();
  return data as ProjectCompletionReadiness;
}

export async function listPendingProjectCompletionReviews(
  orgId?: string,
): Promise<PendingProjectCompletionReview[]> {
  const { data, error } = await supabase.rpc("list_pending_project_completion_reviews", {
    p_org_id: orgId || null,
  });
  if (error) throw lifecycleError(error);
  return Array.isArray(data) ? (data as PendingProjectCompletionReview[]) : [];
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

export async function decideNonHeadProjectApproval(
  projectId: string,
  approve: boolean,
  feedback = "",
): Promise<{ projectId: string; status: string; projectApprovalStatus: string }> {
  const { data, error } = await supabase.rpc("decide_non_head_project_approval", {
    p_project: projectId,
    p_approve: approve,
    p_feedback: feedback.trim(),
  });
  if (error) throw lifecycleError(error);
  await notifyProjectListeners();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eflow:project-setup"));
  }
  return data as { projectId: string; status: string; projectApprovalStatus: string };
}

export async function resubmitProjectForHeadApproval(projectId: string): Promise<void> {
  const { error } = await supabase.rpc("resubmit_project_for_head_approval", {
    p_project: projectId,
  });
  if (error) throw lifecycleError(error);
  await notifyProjectListeners();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("eflow:project-setup"));
  }
}

export async function listPendingProjectApprovals(
  orgId?: string,
): Promise<PendingNonHeadProjectApproval[]> {
  if (typeof supabase.rpc !== "function") return [];
  const { data, error } = await supabase.rpc("list_pending_project_approvals", {
    p_org_id: orgId || null,
  });
  if (error) {
    if (error.code === "PGRST202") return [];
    throw lifecycleError(error);
  }
  return Array.isArray(data) ? (data as PendingNonHeadProjectApproval[]) : [];
}
