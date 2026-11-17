import type {
  WorkNode,
  WorkTreeSnapshot,
  WorkCapabilityContext,
} from "../../../core/web/app/features/nested-work/types";
import { selectRootWorkCapability } from "../../../core/web/app/features/nested-work/selectors/capabilities";

/** Keep Lead appointment and contributor management as separate server powers. */
export function taskStaffingCapability(
  tree: WorkTreeSnapshot | undefined,
  context: WorkCapabilityContext,
  action?: "appoint_lead" | "manage_contributors",
) {
  const appointment = selectRootWorkCapability(tree, "appoint_lead", context);
  if (action === "appoint_lead" || (!action && appointment.allowed)) {
    return appointment.reason_code === "appointment_denied" &&
      tree?.root.kind === "office"
      ? {
          ...appointment,
          disabledReason:
            "Only the Project Lead or responsible Office Head can change the Task Lead.",
        }
      : appointment;
  }
  const contributors = selectRootWorkCapability(
    tree,
    "manage_contributors",
    context,
  );
  return contributors.reason_code === "active_staffing_locked"
    ? {
        ...contributors,
        disabledReason:
          "Contributor changes are currently locked by the server for this task.",
      }
    : contributors;
}

export interface ProjectPlanningAccessOptions {
  projectStatus?: string | null;
  projectLeadId?: string | null;
  actorRole?: string | null;
}

/** True only when the actor is the appointed Task Lead or an assigned Task Contributor. */
export function isTaskLeadOrContributor(
  task: {
    assigneeId?: string | null;
    teamMemberIds?: readonly string[] | null;
  },
  actorId?: string | null,
): boolean {
  if (!actorId) return false;
  return (
    task.assigneeId === actorId ||
    Boolean(task.teamMemberIds?.includes(actorId))
  );
}

/**
 * True only when the actor is a Lead (Task Lead or Subtask Lead) or Contributor
 * of this specific subtask node.
 */
export function isSubtaskLeadOrContributor(
  tree: Pick<WorkTreeSnapshot, "root">,
  node: Pick<WorkNode, "lead_id" | "assigned_to_ids">,
  actorId?: string | null,
): boolean {
  if (!actorId) return false;
  return (
    tree.root.lead === actorId ||
    node.lead_id === actorId ||
    Boolean(node.assigned_to_ids?.includes(actorId))
  );
}

/**
 * In office projects, once the project leaves planning (for example `active` or
 * `on_hold`), Project Leads and Heads who are not the appointed Task Lead may no
 * longer add/edit subtasks or assign/edit people on subtasks.
 */
export function isProjectLeadSubtaskPlanningBlocked(
  tree: Pick<WorkTreeSnapshot, "root">,
  actorId?: string | null,
  options?: ProjectPlanningAccessOptions,
): boolean {
  if (tree.root.kind !== "office" || !actorId) return false;
  const rootMeta = tree.root as unknown as {
    project_status?: string | null;
    project_lead_id?: string | null;
  };
  const status = options?.projectStatus ?? rootMeta.project_status;
  if (!status || status === "planning") return false;
  if (tree.root.lead === actorId) return false;
  const projectLeadId = options?.projectLeadId ?? rootMeta.project_lead_id;
  return (
    (!!projectLeadId && projectLeadId === actorId) ||
    options?.actorRole === "head"
  );
}

/** Only the Subtask Lead or Task Lead may decide contributor proposals on a subtask. */
export function canDecideSubtaskProposals(
  tree: Pick<WorkTreeSnapshot, "root">,
  node: Pick<WorkNode, "lead_id">,
  actorId?: string | null,
): boolean {
  if (!actorId) return false;
  return tree.root.lead === actorId || node.lead_id === actorId;
}
