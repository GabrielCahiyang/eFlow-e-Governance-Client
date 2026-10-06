import { useEffect, useMemo, useRef, useState } from "react";
import { useProfiles, useOrgs } from "../../../hooks/useSupabaseData";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import {
  PageHeader,
  SearchInput,
  WSelect,
} from "../../../components/workflow/primitives";
import {
  fetchAuditEvents,
  subscribeToAuditEvents,
  type AuditEvent,
} from "../../../services/auditService";
import {
  humanizeAuditAction,
  humanizeEntityType,
  shortenIdentifier,
} from "../presentation";
import { EMPTY_AUDIT_FILTERS, filterAuditEvents } from "../auditFilters";
import { AuditDetailDrawer } from "./AuditDetailDrawer";

export function AdminAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const { profiles } = useProfiles();
  const { orgs } = useOrgs();
  const mounted = useRef(true);
  const refreshPending = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    mounted.current = true;
    const stop = subscribeToAuditEvents(
      (next) => {
        if (mounted.current) {
          revision.current++;
          setEvents(next);
          setLoading(false);
        }
      },
      { limit: 500 },
    );
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);
  const refresh = async () => {
    if (refreshPending.current) return;
    refreshPending.current = true;
    setRefreshing(true);
    const version = revision.current;
    try {
      const next = await fetchAuditEvents({ limit: 500 });
      if (mounted.current && version === revision.current) {
        setEvents(next);
        setLoading(false);
      }
    } finally {
      refreshPending.current = false;
      if (mounted.current) setRefreshing(false);
    }
  };
  const profileNames = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.full_name])),
    [profiles],
  );
  const entityLabel = (event: AuditEvent) =>
    (/^(profile|profiles|user|users|employee)$/.test(event.entityType) &&
      profileNames.get(event.entityId || "")) ||
    `${humanizeEntityType(event.entityType)}${event.entityId ? " · " + shortenIdentifier(event.entityId) : ""}`;
  const filtered = filterAuditEvents(events, filters, entityLabel);
  const set = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const distinct = (key: "entityType" | "action") =>
    [...new Set(events.map((event) => event[key]))].sort();
  const columns: Column<AuditEvent>[] = [
    {
      key: "time",
      header: "Recorded at",
      sortable: true,
      sortValue: (event) => event.createdAt,
      render: (event) => new Date(event.createdAt).toLocaleString("en-PH"),
    },
    {
      key: "actor",
      header: "Actor",
      sortable: true,
      sortValue: (event) => event.actorName,
      render: (event) => event.actorName,
    },
    {
      key: "action",
      header: "Action",
      render: (event) => humanizeAuditAction(event.action),
    },
    { key: "record", header: "Resource", render: entityLabel },
    {
      key: "office",
      header: "Office",
      render: (event) =>
        orgs.find((org) => org.id === event.orgId)?.name ||
        event.orgId ||
        "Not recorded",
    },
    {
      key: "details",
      header: "Details",
      action: true,
      render: (event) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSelected(event)}
          aria-label={`Inspect audit event ${event.id}`}
        >
          Inspect
        </Button>
      ),
    },
  ];
  return (
    <div className="min-w-0 space-y-4 p-3 sm:p-6">
      <PageHeader
        eyebrow="Admin Center · Audit"
        title="Account Audit"
        subtitle="Accounts, access, Office assignments and administrative support history."
        actions={
          <Button
            variant="outline"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            {refreshing ? "Refreshing…" : "Refresh audit"}
          </Button>
        }
      />
      <FeedbackState tone="info" title="Latest 500 permitted events">
        Filters apply to this bounded set, not complete history. The current
        reader returns an empty set for both an empty audit and a failed read;
        it cannot confirm that no events exist. Admin access covers
        administrative records only.
      </FeedbackState>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={filters.query}
          onChange={(value) => set("query", value)}
          placeholder="Search person, action or record…"
        />
        <WSelect
          ariaLabel="Audit resource type"
          value={filters.entityType}
          onChange={(value) => set("entityType", value)}
          options={[
            { value: "all", label: "All record types" },
            ...distinct("entityType").map((value) => ({
              value,
              label: humanizeEntityType(value),
            })),
          ]}
        />
        <WSelect
          ariaLabel="Audit action"
          value={filters.action}
          onChange={(value) => set("action", value)}
          options={[
            { value: "all", label: "All actions" },
            ...distinct("action").map((value) => ({
              value,
              label: humanizeAuditAction(value),
            })),
          ]}
        />
        <WSelect
          ariaLabel="Audit actor"
          value={filters.actor}
          onChange={(value) => set("actor", value)}
          options={[
            { value: "all", label: "All actors" },
            ...[
              ...new Map(
                events.map((event) => [
                  event.actorId || event.actorName,
                  event.actorName,
                ]),
              ).entries(),
            ].map(([value, label]) => ({ value, label })),
          ]}
        />
        <WSelect
          ariaLabel="Audit Office"
          value={filters.office}
          onChange={(value) => set("office", value)}
          options={[
            { value: "all", label: "All permitted Offices" },
            ...[
              ...new Set(
                events
                  .map((event) => event.orgId)
                  .filter((id): id is string => Boolean(id)),
              ),
            ].map((value) => ({
              value,
              label: orgs.find((org) => org.id === value)?.name || value,
            })),
          ]}
        />
        <label className="text-xs">
          From
          <input
            className="w-full rounded-lg border p-2"
            type="date"
            value={filters.from}
            onChange={(event) => set("from", event.target.value)}
          />
        </label>
        <label className="text-xs">
          Through
          <input
            className="w-full rounded-lg border p-2"
            type="date"
            value={filters.to}
            onChange={(event) => set("to", event.target.value)}
          />
        </label>
        <Button
          variant="outline"
          onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
        >
          Clear audit filters
        </Button>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        {filtered.length} matching · {events.length} loaded
        {refreshing ? " · Refreshing…" : ""}
      </p>
      <DataTable
        ariaLabel="Account audit events"
        density="compact"
        loading={loading}
        data={filtered}
        columns={columns}
        keyExtractor={(event) => event.id}
        emptyMessage={
          events.length
            ? "No loaded events match. Clear filters to see the loaded set."
            : "No events returned. Audit history may be empty or unavailable; refresh to check the current reader."
        }
      />
      {selected && (
        <AuditDetailDrawer
          event={selected}
          entityLabel={entityLabel(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
