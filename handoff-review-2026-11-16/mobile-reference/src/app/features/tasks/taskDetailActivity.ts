import { supabase } from "../../../platform/supabase";
import { fetchTaskActivityHistory as fetchLegacyTaskActivityHistory } from "../../../core/web/app/features/tasks/services/taskActivityService";
import type { ActivityField } from "./activityPresentation";
import { readAllRows } from "../../../core/web/app/shared/readAllRows";

export function taskDetailActivityFields(
  metadata: unknown,
): ActivityField[] | undefined {
  if (!metadata || typeof metadata !== "object") return;
  const value = metadata as {
    version?: unknown;
    fields?: unknown;
    reason?: unknown;
  };
  if (value.version !== 1 || !Array.isArray(value.fields)) return;
  const fields: ActivityField[] = value.fields.flatMap((item) =>
    item &&
    typeof item === "object" &&
    typeof item.label === "string" &&
    typeof item.before === "string" &&
    typeof item.after === "string"
      ? [{ label: item.label, value: `${item.before} → ${item.after}` }]
      : [],
  );
  if (typeof value.reason === "string" && value.reason.trim())
    fields.push({ label: "Schedule change reason", value: value.reason });
  return fields.length ? fields : undefined;
}

/** Native adaptation: the generated reader deliberately drops metadata. */
export async function fetchTaskActivityHistory(taskIds: string[]) {
  const history = await fetchLegacyTaskActivityHistory(taskIds);
  const ids = history
    .filter(
      (item) =>
        item.kind === "activity" && item.action === "work_details_edited",
    )
    .map((item) => item.id);
  if (!ids.length)
    return history.map((item) => ({
      ...item,
      fields: undefined as ActivityField[] | undefined,
    }));
  const rows = await readAllRows<{ id: string; metadata: unknown }>(
    (from, to) =>
      supabase
        .from("task_activities")
        .select("id,metadata", { count: "exact" })
        .in("task_id", taskIds)
        .in("id", ids)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
  );
  const fields = new Map(
    rows.map((item) => [item.id, taskDetailActivityFields(item.metadata)]),
  );
  return history.map((item) => ({ ...item, fields: fields.get(item.id) }));
}
