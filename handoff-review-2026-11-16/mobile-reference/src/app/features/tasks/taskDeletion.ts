import type { Task } from "../../../core/web/app/features/tasks/taskTypes";
import { supabase } from "../../../platform/supabase";
import { PublicMessageError } from "../../shared/userMessages";
import { assertEvidenceActor } from "./taskEvidence";

export function taskCanBeDeletedBeforeStart(
  task: Pick<Task, "status" | "archivedAt" | "percentComplete">,
) {
  return (
    !task.archivedAt &&
    ["todo", "pending_assignment"].includes(task.status) &&
    !(task.percentComplete && task.percentComplete > 0)
  );
}

/** Every attempt rereads the Task and actor scope; never blindly repeat a lost delete. */
export async function deleteUnstartedTask(task: Task, actor: string) {
  await assertEvidenceActor(actor);
  const current = await supabase
    .from("tasks")
    .select("*")
    .eq("id", task.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (current.error) throw current.error;
  const row = current.data;
  if (!row)
    throw new PublicMessageError(
      "This task is unavailable or has already been deleted. Refresh the project.",
    );
  if (
    row.linked_project_id !== (task.linkedProjectId ?? null) ||
    row.org_id !== (task.orgId ?? null)
  )
    throw new PublicMessageError(
      "The task scope changed. Refresh before deleting it.",
    );
  if (
    !taskCanBeDeletedBeforeStart({
      status: row.status,
      archivedAt: row.archived_at ? 1 : undefined,
      percentComplete: row.percent_complete,
    })
  )
    throw new PublicMessageError(
      "Only an unstarted task can be deleted. Started work must be retained.",
    );
  const [authority, project, person] = await Promise.all([
    supabase.rpc("can_manage_task", { target_task: task.id, caller_id: actor }),
    row.linked_project_id
      ? supabase
          .from("projects")
          .select(
            "id,org_id,project_lead_id,status,source_collaboration_draft_id",
          )
          .eq("id", row.linked_project_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("profiles")
      .select("id,org_id,role,is_active")
      .eq("id", actor)
      .maybeSingle(),
  ]);
  if (authority.error || project.error || person.error)
    throw authority.error || project.error || person.error;
  const p = project.data,
    u = person.data;
  const projectLead =
    p?.project_lead_id === actor &&
    p.org_id === row.org_id &&
    !p.source_collaboration_draft_id &&
    ["planning", "active", "on_hold"].includes(p.status) &&
    u?.id === actor &&
    u.is_active === true &&
    u.org_id === p.org_id &&
    ["head", "member", "accounting_staff"].includes(u.role);
  if (authority.data !== true && !projectLead)
    throw new PublicMessageError(
      "Only an authorized Project Lead or Office Head can delete this task.",
    );
  await assertEvidenceActor(actor);
  const { error } = await supabase.rpc("soft_delete_task", {
    p_task_id: task.id,
  });
  if (error)
    throw Object.assign(new Error(error.message), { code: error.code });
}
