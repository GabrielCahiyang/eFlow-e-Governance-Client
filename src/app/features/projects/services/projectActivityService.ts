import { supabase } from "../../../../lib/supabase";
import { readAllRows } from "../../../shared/readAllRows";
import { formatPeso, toCentavos } from "../../../shared/currency";
import type { ProjectActivityItem } from "../components/project-command/types";

function presentAuditAction(action: string, entityType: string): string {
  const known: Record<string, string> = {
    "project.milestones_reordered": "reordered project milestones",
    "project.updated": "updated the project",
    "project.funding_submitted_for_certification": "submitted project funding for Accounting certification",
    "project.funding_certified_by_accounting": "certified project funding",
    "project.funding_returned_to_office_budget": "returned unused project budget to Office Budget",
    "project.completed": "marked the project complete",
    "project.archived": "archived the project",
    "project.auto_archived": "auto-archived the project",
    "project.restored": "restored the project from archive",
    "milestone.status_override": "updated an activity status",
    "milestone.created": "added a delivery activity",
    "milestone.updated": "updated a delivery activity",
    "milestone.deleted": "removed a delivery activity",
  };
  if (known[action]) return known[action];
  const label = action.replace(/[._]/g, " ").trim();
  if (label) return label.charAt(0).toLowerCase() + label.slice(1);
  return `updated ${entityType || "a record"}`;
}

function presentAuditDetail(row: Record<string, unknown>): string {
  const action = String(row.action || "");
  const reason = String(row.reason || "").trim();
  const after = (row.after_data && typeof row.after_data === "object"
    ? row.after_data
    : null) as Record<string, unknown> | null;

  if (action === "project.funding_returned_to_office_budget" && after) {
    const sourceName = String(after.sourceName || "Funding source");
    const fiscalYear = after.fiscalYear ? ` (FY ${String(after.fiscalYear)})` : "";
    const returned = Number(after.returnedAmount || 0);
    const amountPart = toCentavos(returned) > 0 ? `${sourceName}${fiscalYear}: ${formatPeso(returned)} returned` : `${sourceName}${fiscalYear}`;
    return reason ? `${amountPart} · Reason: ${reason}` : amountPart;
  }

  if ((action === "project.completed" || action === "project.archived" || action === "project.auto_archived") && after?.financialCloseout && typeof after.financialCloseout === "object") {
    const fc = after.financialCloseout as Record<string, unknown>;
    const parts: string[] = [];
    if (fc.fundingNotRequired) {
      parts.push("No Office Budget funding required");
    } else {
      parts.push(`Before activation: ${formatPeso(Number(fc.budgetBeforeActivation || 0))}`);
      const supplemental = Number(fc.supplementalBudgetAdded || 0);
      if (toCentavos(supplemental) > 0) parts.push(`Supplemental: ${formatPeso(supplemental)}`);
      parts.push(`Actual spent: ${formatPeso(Number(fc.actualSpent || 0))}`);
      parts.push(`Returned to Office Budget: ${formatPeso(Number(fc.returnedToOfficeBudget || 0))}`);
    }
    const financialLine = parts.join(" · ");
    return reason ? `${financialLine} · Note: ${reason}` : financialLine;
  }

  if (action === "project.funding_certified_by_accounting" && after) {
    const authorized = Number(after.authorized || 0);
    if (toCentavos(authorized) > 0) {
      return reason ? `Certified ${formatPeso(authorized)} · ${reason}` : `Certified ${formatPeso(authorized)}`;
    }
  }

  return String(reason || `${String(row.entity_type || "Record").replace(/_/g, " ")} update`).trim();
}

export async function fetchProjectAuditActivity(entityIds: string[]): Promise<ProjectActivityItem[]> {
  const ids = Array.from(new Set(entityIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const data: Record<string, unknown>[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    data.push(
      ...(await readAllRows<Record<string, unknown>>((from, to) =>
        supabase
          .from("audit_events")
          .select("id,entity_type,entity_id,action,reason,actor_name,after_data,created_at", { count: "exact" })
          .in("entity_id", ids.slice(offset, offset + 100))
          .order("id", { ascending: true })
          .range(from, to),
      )),
    );
  }
  return (data || [])
    .map((row) => ({
      id: `audit:${row.id}`,
      kind: "project" as const,
      title: presentAuditAction(String(row.action || ""), String(row.entity_type || "")),
      detail: presentAuditDetail(row),
      actorName: String(row.actor_name || "System"),
      occurredAt: new Date(String(row.created_at)).getTime(),
      taskId: row.entity_type === "task" ? String(row.entity_id) : undefined,
    }))
    .sort((a, b) => b.occurredAt - a.occurredAt || b.id.localeCompare(a.id));
}
