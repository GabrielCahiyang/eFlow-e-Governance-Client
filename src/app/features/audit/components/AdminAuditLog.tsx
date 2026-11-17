import { useMemo, useRef, useState } from "react";
import { Activity, Eye, List, RefreshCw, RotateCcw } from "lucide-react";
import {useAuth} from '../../../contexts/AuthContext';
import { useProfiles, useOrgs } from "../../../hooks/useSupabaseData";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SearchInput, WSelect } from "../../../components/workflow/primitives";
import type { AuditEvent } from "../../../services/auditService";
import { useAdministrativeAuditWindow } from "../hooks/useAdministrativeAuditWindow";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { AuditEventFeed } from "./AuditEventFeed";
import {
  humanizeAuditAction,
  humanizeEntityType,
  shortenIdentifier,
} from "../presentation";
import { EMPTY_AUDIT_FILTERS, filterAuditEvents } from "../auditFilters";
import { AuditEventDetailPage } from "./AuditEventDetailPage";
import {useAuditDetailNavigation} from '../hooks/useAuditDetailNavigation';

export function AdminAuditLog() {
  const {userProfile,permissionsLoading,can}=useAuth();
  if(permissionsLoading||!userProfile||!can('navigation.audit'))return <FeedbackState tone="error" title="Audit access unavailable">Your current account does not have access to Account Audit.</FeedbackState>;
  return <AdministrativeAuditView key={`${userProfile.id}:${userProfile.role}:${userProfile.org_id||''}`}/>;
}

function AdministrativeAuditView() {
  const { events, total, loading, refreshing, checking, error, refresh } =
    useAdministrativeAuditWindow();
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const list=useRef<HTMLDivElement>(null);
  const detail=useAuditDetailNavigation(list);
  const selected=events.find(event=>event.id===detail.selectedId);
  const { profiles } = useProfiles();
  const { orgs } = useOrgs();
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
      header: "Changed by",
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
          onClick={(click) => detail.open(event.id,click.currentTarget)}
          aria-label={`Inspect audit event ${event.id}`}
        >
          <Eye size={13} aria-hidden="true" />
          Inspect
        </Button>
      ),
    },
  ];
  const hasFilters = Boolean(
    filters.query ||
      filters.entityType !== "all" ||
      filters.action !== "all" ||
      filters.actor !== "all" ||
      filters.office !== "all" ||
      filters.from ||
      filters.to,
  );
  return (
    <div className="min-w-0">
    <div ref={list} className="audit-list min-w-0 space-y-4" hidden={!!detail.selectedId}>
      <WorkspaceHeader
        title="Account Audit"
        description="Review who changed user accounts, roles, office assignments, or system settings."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Audit layout"
              className="inline-flex rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-subtle)] p-0.5"
            >
              <Button
                type="button"
                size="sm"
                variant={viewMode === "table" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
              >
                <List size={13} aria-hidden="true" />
                Table
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "timeline" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "timeline"}
                onClick={() => setViewMode("timeline")}
              >
                <Activity size={13} aria-hidden="true" />
                Timeline
              </Button>
            </div>
            <Button
              variant="outline"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw size={13} aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing…" : "Refresh audit"}
            </Button>
          </div>
        }
      />
      {!error && (
        <FeedbackState tone="info" title="Latest 500 permitted events">
          The filters apply to the events loaded into this view.
          {total === undefined && " The total number of permitted events is unavailable."}
        </FeedbackState>
      )}
      {error && (
        <FeedbackState tone="error" title="Audit unavailable" onRetry={() => void refresh()}>
          {error}
        </FeedbackState>
      )}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={filters.query}
          onChange={(value) => set("query", value)}
          placeholder="Search person, action or record…"
        />
        <WSelect
          ariaLabel="Type of record"
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
          ariaLabel="Changed by"
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
        <label className="text-xs text-[var(--eflow-text-muted)]">
          From
          <input
            className="mt-1 h-10 w-full rounded-lg border border-[var(--eflow-border)] px-3 text-sm"
            type="date"
            value={filters.from}
            onChange={(event) => set("from", event.target.value)}
          />
        </label>
        <label className="text-xs text-[var(--eflow-text-muted)]">
          Through
          <input
            className="mt-1 h-10 w-full rounded-lg border border-[var(--eflow-border)] px-3 text-sm"
            type="date"
            value={filters.to}
            onChange={(event) => set("to", event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Button
            variant="outline"
            disabled={!hasFilters}
            onClick={() => setFilters(EMPTY_AUDIT_FILTERS)}
          >
            <RotateCcw size={13} aria-hidden="true" />
            Clear audit filters
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--eflow-text-muted)]">
        <p role="status" className="eflow-tabular">
          {error
            ? "Coverage unavailable"
            : `${filtered.length} matching · ${events.length} loaded${
                total === undefined
                  ? ""
                  : ` of ${total} permitted events${total > events.length ? " (latest 500 window)" : ""}`
              }`}
          {refreshing ? " · Refreshing…" : ""}
        </p>
        <span>Project task activity appears inside each project’s Activity view.</span>
      </div>
      {viewMode === "timeline" ? (
        <AuditEventFeed
          events={filtered}
          entityLabel={entityLabel}
          onSelect={(event, trigger) => detail.open(event.id, trigger)}
        />
      ) : (
        <DataTable
          ariaLabel="Account audit events"
          error={error || undefined}
          onRetry={() => void refresh()}
          emptyIllustration={events.length ? "search" : "empty"}
          density="compact"
          loading={loading}
          data={filtered}
          columns={columns}
          keyExtractor={(event) => event.id}
          emptyMessage={
            events.length
              ? "No loaded events match. Clear filters to see the loaded set."
              : error
                ? "Audit unavailable. Refresh to retry."
                : "No permitted administrative events."
          }
        />
      )}
    </div>
    {detail.selectedId&&<AuditEventDetailPage key={detail.selectedId} event={checking||error?undefined:selected} checking={checking} error={error}
      entityLabel={selected?entityLabel(selected):''} officeLabel={orgs.find(org=>org.id===selected?.orgId)?.name||selected?.orgId||'Not recorded'}
      onBack={detail.back} onRefresh={()=>void refresh()}/>}
    </div>
  );
}
