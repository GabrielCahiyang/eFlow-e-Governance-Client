import type { WorkTreeSnapshot } from "../../../core/web/app/features/nested-work/types";

/** Native presentation guard. Shared RLS/RPC enforcement is required as well. */
export function subtasksVisibleForActor(
  root: Pick<WorkTreeSnapshot["root"], "kind" | "lead" | "status">,
  actor?: string | null,
) {
  if (root.kind === "personal") return true;
  if (!actor) return false;
  if (root.lead === actor) return true;
  return [
    "in_progress",
    "for_review",
    "changes_requested",
    "completed",
  ].includes(root.status ?? "");
}

export const hiddenSubtasksMessage =
  "Subtasks will be available when the Task Lead starts the parent task.";
