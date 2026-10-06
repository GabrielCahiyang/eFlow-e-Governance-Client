import type { AuditEvent } from "../../services/auditService";
import { redactAuditDisplay } from "./presentation";
export interface AuditFilters {
  query: string;
  entityType: string;
  action: string;
  actor: string;
  office: string;
  from: string;
  to: string;
}
export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  query: "",
  entityType: "all",
  action: "all",
  actor: "all",
  office: "all",
  from: "",
  to: "",
};
export function filterAuditEvents(
  events: AuditEvent[],
  filters: AuditFilters,
  label: (event: AuditEvent) => string,
) {
  const from = filters.from
    ? new Date(`${filters.from}T00:00:00`).getTime()
    : -Infinity;
  const to = filters.to
    ? new Date(`${filters.to}T23:59:59.999`).getTime()
    : Infinity;
  return events.filter(
    (event) =>
      (filters.entityType === "all" ||
        filters.entityType === event.entityType) &&
      (filters.action === "all" || filters.action === event.action) &&
      (filters.actor === "all" ||
        filters.actor === (event.actorId || event.actorName)) &&
      (filters.office === "all" || filters.office === event.orgId) &&
      event.createdAt >= from &&
      event.createdAt <= to &&
      [
        event.actorName,
        event.action,
        event.entityId,
        redactAuditDisplay("reason", event.reason),
        label(event),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(filters.query.trim().toLowerCase()),
        ),
  );
}
