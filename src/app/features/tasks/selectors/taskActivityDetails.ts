import type { TaskActivity } from "../taskTypes";

type DetailField = { key: string; label: string; before: string; after: string };
type DetailMetadata = { version: 1; fields: DetailField[]; reason?: string | null };

/** Present only the committed, recorded values. Never infer an old value from a live Task row. */
export function taskActivityDetails(item: Pick<TaskActivity, "action" | "details" | "metadata">): string[] {
  if (item.action !== "work_details_edited") return item.details ? [item.details] : [];
  const value = item.metadata;
  if (!value || typeof value !== "object") return item.details ? [item.details] : [];
  const metadata = value as Partial<DetailMetadata>;
  if (metadata.version !== 1 || !Array.isArray(metadata.fields)) return item.details ? [item.details] : [];
  const fields = metadata.fields.filter((field): field is DetailField =>
    !!field && typeof field.key === "string" && typeof field.label === "string" &&
    typeof field.before === "string" && typeof field.after === "string",
  );
  if (!fields.length) return item.details ? [item.details] : [];
  const lines = fields.map((field) => `${field.label}: ${field.before || "(empty)"} → ${field.after || "(empty)"}`);
  if (typeof metadata.reason === "string" && metadata.reason.trim()) lines.push(`Reason: ${metadata.reason.trim()}`);
  return lines;
}
