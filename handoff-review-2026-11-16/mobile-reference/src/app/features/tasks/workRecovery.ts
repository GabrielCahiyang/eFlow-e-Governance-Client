import { WorkRequestFailure } from "../../../core/web/app/features/nested-work/types/editor";
import type {
  WorkCapabilityContext,
  WorkRequest,
} from "../../../core/web/app/features/nested-work/types";
import type {
  WorkEditorBaseline,
  WorkEditorFields,
} from "../../../core/web/app/features/nested-work/types/editor";
import { sameWorkEditorScope } from "../../../core/web/app/features/nested-work/selectors/editorDraft";
import { selectNodeWorkCapability } from "../../../core/web/app/features/nested-work/selectors/capabilities";
import { workScope } from "./branchInspector";
import { taskStaffingCapability } from "./workPermissions";
import { hiddenSubtasksMessage, subtasksVisibleForActor } from "./subtaskVisibility";
import { nodeSchedule } from "./subtaskSchedule";
import { detailEditError, readDetailEditState } from "./workDetailEditing";
import { supabase } from "../../../platform/supabase";
import {
  fetchWorkTree,
  saveWorkTree,
} from "../../../core/web/app/features/nested-work/services/workTreeService";

export async function recoverWorkRequest(
  rootId: string,
  request: WorkRequest,
  actorId: string,
) {
  const { data, error } = await supabase.rpc("nw_work_command_receipt", {
    p_root: rootId,
    p_request: request.id,
    p_command: request.command,
    p_payload: request.payload,
  });
  if (error)
    throw Object.assign(new Error(error.message), { code: error.code });
  if (data === true) return fetchWorkTree(rootId);
  if (data !== false)
    throw new Error("The original work receipt could not be verified.");
  const subtaskTree = request.command !== "root_lead" && request.command !== "contributors" ? await fetchWorkTree(rootId) : undefined;
  if (subtaskTree && !subtasksVisibleForActor(subtaskTree.root, actorId)) throw new WorkRequestFailure("confirmed_failure", hiddenSubtasksMessage);
  if (subtaskTree && request.command === "delete") {
    const node = subtaskTree.nodes.find((item) => item.id === request.payload.id);
    const access = selectNodeWorkCapability(subtaskTree, node?.id ?? "", "delete", workScope(subtaskTree, actorId));
    if (!node || !access.allowed || node.status !== "todo" || nodeSchedule(node)?.started_at || node.percent_complete ||
      (subtaskTree.root.kind === "office" && subtaskTree.root.lead !== actorId))
      throw new WorkRequestFailure("confirmed_failure", "Only the Task Lead can delete an unstarted subtask.");
  }
  if (subtaskTree && request.command === "edit") {
    const node = subtaskTree.nodes.find(item => item.id === request.payload.id);
    const access = selectNodeWorkCapability(subtaskTree, node?.id ?? "", "edit_details", workScope(subtaskTree, actorId));
    if (!node || !access.allowed)
      throw new WorkRequestFailure("confirmed_failure", access.disabledReason || "Current editing access is required.");
    if (subtaskTree.root.kind === "office") {
      const detail = node as typeof node & { detail_edit?: unknown; dependency_ids?: string[] | null };
      const policy = readDetailEditState(detail.detail_edit, rootId, node.id);
      if (policy || nodeSchedule(node)?.started_at || node.status !== "todo" || node.percent_complete) {
        const sameIds = (value: unknown) => Array.isArray(value) ? JSON.stringify([...new Set(value)].sort()) : JSON.stringify(value);
        const problem = detailEditError(policy, {
          planning: ("start" in request.payload && (request.payload.start || null) !== (node.start_date || null)) ||
            ("standalone" in request.payload && request.payload.standalone !== node.is_standalone) ||
            ("dependency_ids" in request.payload && sameIds(request.payload.dependency_ids) !== sameIds(detail.dependency_ids)),
          due: (request.payload.due || null) !== (node.due_date || null),
          reason: typeof request.payload.note === "string" ? request.payload.note : "",
        });
        if (problem) throw new WorkRequestFailure("confirmed_failure", problem);
      }
    }
  }
  if (request.command === "root_lead" || request.command === "contributors") {
    const latest = await fetchWorkTree(rootId);
    const access = taskStaffingCapability(
      latest,
      workScope(latest, actorId),
      request.command === "root_lead" ? "appoint_lead" : "manage_contributors",
    );
    if (!access.allowed)
      throw new WorkRequestFailure(
        "confirmed_failure",
        access.disabledReason || "Current task staffing access is required.",
      );
  }
  if (request.command === "staff") {
    const latest = subtaskTree!;
    const node = latest.nodes.find(
      (item) => item.id === request.payload.id && item.task_id === rootId,
    );
    const access = selectNodeWorkCapability(
      latest,
      node?.id ?? "",
      request.payload.lead !== node?.lead_id
        ? "appoint_lead"
        : "manage_contributors",
      workScope(latest, actorId),
    );
    if (!access.allowed)
      throw new WorkRequestFailure(
        "confirmed_failure",
        access.disabledReason || "Current subtask staffing access is required.",
      );
  }
  if (request.command === "progress" || request.command === "submit") {
    const latest = subtaskTree!;
    const nodeId = request.payload.id;
    if (
      typeof nodeId !== "string" ||
      !latest.nodes.some(
        (node) => node.id === nodeId && node.task_id === rootId,
      )
    )
      throw new WorkRequestFailure(
        "confirmed_failure",
        "The original subtask is unavailable.",
      );
    const action = request.command === "progress" ? "execute" : "submit";
    const capability = selectNodeWorkCapability(
      latest,
      nodeId,
      action,
      workScope(latest, actorId),
    );
    if (!capability.allowed)
      throw new WorkRequestFailure(
        "confirmed_failure",
        capability.disabledReason || "Current work access is required.",
      );
  }
  return saveWorkTree(rootId, request);
}
export interface NativeWorkRecovery {
  baseline: WorkEditorBaseline;
  fields: WorkEditorFields & { priority?: string; dependencies?: string[] };
  request: WorkRequest;
}
export function isNativeWorkRecovery(
  value: unknown,
  context: WorkCapabilityContext,
): value is NativeWorkRecovery {
  if (!value || typeof value !== "object") return false;
  const item = value as NativeWorkRecovery;
  return (
    !!item.baseline &&
    sameWorkEditorScope(item.baseline, context) &&
    !!item.request &&
    typeof item.request.id === "string" &&
    item.request.id.length > 0 &&
    item.request.revision === item.baseline.revision &&
    item.request.command === item.baseline.command &&
    !!item.request.payload &&
    typeof item.request.payload === "object" &&
    !Array.isArray(item.request.payload) &&
    !!item.fields &&
    typeof item.fields.title === "string" &&
    typeof item.fields.note === "string" &&
    typeof item.fields.due === "string" &&
    typeof item.fields.lead === "string" &&
    typeof item.fields.parent === "string" &&
    typeof item.fields.standalone === "boolean" &&
    (item.fields.dependencies === undefined ||
      (Array.isArray(item.fields.dependencies) &&
        item.fields.dependencies.every((id) => typeof id === "string"))) &&
    Number.isFinite(item.fields.progress) &&
    Array.isArray(item.fields.people) &&
    item.fields.people.every((id) => typeof id === "string") &&
    Array.isArray(item.fields.order) &&
    item.fields.order.every((id) => typeof id === "string")
  );
}
export function workRecoveryCanDiscard(error: unknown) {
  return (
    error instanceof WorkRequestFailure &&
    ["confirmed_failure", "stale_revision"].includes(error.kind)
  );
}
