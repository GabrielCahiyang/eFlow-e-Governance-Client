import { supabase } from "../../../../lib/supabase";
import type {
  AppliedSubtaskTemplateItem,
  SubtaskTemplate,
  SubtaskTemplateApplyMode,
  SubtaskTemplateApplyResult,
  SubtaskTemplateDraft,
} from "../types";

const missingSchemaMessage =
  "Apply the work-template database migration, then refresh this page.";

// These public adapters still accept only flat checklist payloads. Reject the
// same hierarchy keys as the installed server guards before selecting fields.
function assertFlatItems(items:readonly object[]) {
  if(items.some(item=>Object.entries(item).some(([key,value])=>value!==undefined&&['parentSubtaskId','parent_subtask_id','children','subitems'].includes(key))))
    throw new Error("Nested work needs a hierarchy template format. This checklist format cannot flatten parent links.");
}

function isMissingSchema(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42P01"
  );
}

function mapTemplate(row: Record<string, unknown>): SubtaskTemplate {
  const rawItems = Array.isArray(row.subtask_template_items)
    ? (row.subtask_template_items as Record<string, unknown>[])
    : [];
  return {
    id: row.id as string,
    orgId: row.org_id as string,
    ownerId: (row.owner_id as string) || undefined,
    ownerName: (row.owner_name as string) || undefined,
    title: (row.title as string) || "Untitled template",
    description: (row.description as string) || "",
    visibility: row.visibility as SubtaskTemplate["visibility"],
    approvalStatus: row.approval_status as SubtaskTemplate["approvalStatus"],
    isStarter: Boolean(row.is_starter),
    items: rawItems
      .map((item) => ({
        id: item.id as string,
        title: (item.title as string) || "",
        position: Number(item.position || 0),
      }))
      .filter((item) => item.title.trim())
      .sort((a, b) => a.position - b.position),
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

export async function fetchSubtaskTemplates(): Promise<SubtaskTemplate[]> {
  const { data, error } = await supabase
    .from("subtask_templates")
    .select("*, subtask_template_items(*)")
    .order("is_starter", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMissingSchema(error)) throw new Error(missingSchemaMessage);
    throw new Error(error.message);
  }
  return (data || []).map((row) => mapTemplate(row));
}

export async function saveSubtaskTemplate(
  orgId: string,
  draft: SubtaskTemplateDraft,
): Promise<SubtaskTemplate> {
  assertFlatItems(draft.items);
  const { data, error } = await supabase.rpc("save_subtask_template", {
    p_template_id: draft.id || null,
    p_payload: {
      orgId,
      title: draft.title.trim(),
      description: draft.description.trim(),
      visibility: draft.visibility,
      items: draft.items.map((item, position) => ({
        title: item.title.trim(),
        position,
      })),
    },
  });
  if (error) {
    if (isMissingSchema(error)) throw new Error(missingSchemaMessage);
    throw new Error(error.message);
  }
  const rows = Array.isArray(data) ? data : [data];
  const savedId = rows[0]?.id as string | undefined;
  if (!savedId) throw new Error("The template was saved but could not be reloaded.");
  const { data: saved, error: reloadError } = await supabase
    .from("subtask_templates")
    .select("*, subtask_template_items(*)")
    .eq("id", savedId)
    .single();
  if (reloadError) throw new Error(reloadError.message);
  return mapTemplate(saved);
}

export async function deleteSubtaskTemplate(templateId: string): Promise<void> {
  const { error } = await supabase
    .from("subtask_templates")
    .delete()
    .eq("id", templateId);
  if (error) throw new Error(error.message);
}

export async function reviewSubtaskTemplate(
  templateId: string,
  approve: boolean,
): Promise<void> {
  const { error } = await supabase.rpc("review_subtask_template", {
    p_template_id: templateId,
    p_approve: approve,
  });
  if (error) {
    if (isMissingSchema(error)) throw new Error(missingSchemaMessage);
    throw new Error(error.message);
  }
}

export async function applySubtaskTemplate(input: {
  templateId: string;
  taskId: string;
  mode: SubtaskTemplateApplyMode;
  items: AppliedSubtaskTemplateItem[];
}): Promise<SubtaskTemplateApplyResult> {
  assertFlatItems(input.items);
  const { data, error } = await supabase.rpc("apply_subtask_template", {
    p_template_id: input.templateId,
    p_task_id: input.taskId,
    p_mode: input.mode,
    p_items: input.items.map((item) => ({
      title: item.title.trim(),
      assignedToIds: item.assignedToIds,
    })),
  });
  if (error) {
    if (isMissingSchema(error)) throw new Error(missingSchemaMessage);
    throw new Error(error.message);
  }
  const result = (data || {}) as Record<string, unknown>;
  return {
    created: Number(result.created || 0),
    skipped: Number(result.skipped || 0),
    replaced: Number(result.replaced || 0),
  };
}
