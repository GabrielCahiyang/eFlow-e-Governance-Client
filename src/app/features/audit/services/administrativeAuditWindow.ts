import { supabase } from "../../../../lib/supabase";
import type { AuditEvent } from "../../../services/auditService";
export const ADMIN_AUDIT_WINDOW = 500;
export async function fetchAdministrativeAuditWindow(): Promise<{
  events: AuditEvent[];
  total: number;
}> {
  const { data, error, count } = await supabase
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ADMIN_AUDIT_WINDOW);
  if (error)
    throw new Error(
      "Administrative audit could not be read. Retry to verify its coverage.",
    );
  if (
    !Array.isArray(data) ||
    !Number.isInteger(count) ||
    count! < 0 ||
    data.length !== Math.min(count!, ADMIN_AUDIT_WINDOW)
  )
    throw new Error("Administrative audit coverage could not be verified.");
  return {
    total: count!,
    events: data.map((row) => ({
      id: row.id,
      actorId: row.actor_id || undefined,
      actorName: row.actor_name || "System",
      entityType: row.entity_type || "",
      entityId: row.entity_id || undefined,
      action: row.action || "",
      reason: row.reason || undefined,
      beforeData: row.before_data,
      afterData: row.after_data,
      metadata: row.metadata,
      orgId: row.org_id || undefined,
      createdAt: Date.parse(row.created_at),
    })),
  };
}
export function subscribeAdministrativeAuditInvalidation(onChange: () => void) {
  let live = true;
  const channel = supabase
    .channel(`r12-audit-${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "audit_events" },
      () => {
        if (live) onChange();
      },
    )
    .subscribe();
  return () => {
    live = false;
    void supabase.removeChannel(channel);
  };
}
