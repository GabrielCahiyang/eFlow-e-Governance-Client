import { useMemo, useRef, useState } from "react";
import { Activity, Eye, List, RefreshCw, RotateCcw } from "lucide-react";
import {useAuth} from '../../../contexts/AuthContext';
import { useProfiles, useOrgs } from "../../../hooks/useSupabaseData";
import { getRoleLabel } from "../../../shared/roles";
import { PERMISSION_LABELS, useRoleCatalog } from "../../permissions";
import { DateInput } from "../../../components/ui/DateInput";
import { DataTable, type Column, type DataTableViewState } from "../../../components/ui/DataTable";
import { PaginationBar } from "../../../components/ui/PaginationBar";
import { Button } from "../../../components/ui/button";
import { FeedbackState } from "../../../components/ui/FeedbackState";
import { SearchInput, WSelect } from "../../../components/workflow/primitives";
import type { AuditEvent } from "../../../services/auditService";
import { useAdministrativeAuditWindow } from "../hooks/useAdministrativeAuditWindow";
import { WorkspaceHeader } from "../../../components/ui/workspace";
import { AuditEventFeed } from "./AuditEventFeed";
import {
  enrichAdministrativeAuditEvents,
  humanizeAuditAction,
  humanizeEntityType,
  shortenIdentifier,
  summarizeAuditChanges,
} from "../presentation";
import { EMPTY_AUDIT_FILTERS, filterAuditEvents } from "../auditFilters";
import { AuditEventDetailPage } from "./AuditEventDetailPage";
import {useAuditDetailNavigation} from '../hooks/useAuditDetailNavigation';
import { formatManilaDateTime, formatManilaInstant } from "../../../shared/calendarDisplay";

function formatAuditTimestamp(timestamp: number): string {
  return formatManilaDateTime(timestamp, "Not recorded");
}

export function AdminAuditLog() {
  const {userProfile,permissionsLoading,can}=useAuth();
  if(permissionsLoading||!userProfile||!can('navigation.audit'))return <FeedbackState tone="error" title="Audit access unavailable">Your current account does not have access to Account Audit.</FeedbackState>;
  return <AdministrativeAuditView key={`${userProfile.id}:${userProfile.role}:${userProfile.org_id||''}`}/>;
}

function AdministrativeAuditView() {
  const { events: rawEvents, total, loading, refreshing, checking, error, refresh } =
    useAdministrativeAuditWindow();
  const [filters, setFilters] = useState(EMPTY_AUDIT_FILTERS);
  const [viewMode, setViewMode] = useState<"table" | "timeline">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tableView, setTableView] = useState<DataTableViewState>({
    search: "",
    sortKey: null,
    sortDir: "asc",
  });
  const list=useRef<HTMLDivElement>(null);
  const detail=useAuditDetailNavigation(list);
  const { profiles } = useProfiles();
  const { orgs } = useOrgs();
  const { roleCatalog } = useRoleCatalog();
  const profileNames = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.full_name])),
    [profiles],
  );
  const profileRoles = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.role])),
    [profiles],
  );
  const roleLabelByKey = useMemo(
    () => new Map(roleCatalog.map((entry) => [entry.key, entry.label])),
    [roleCatalog],
  );
  const orgNames = useMemo(
    () => new Map(orgs.map((org) => [org.id, org.name])),
    [orgs],
  );
  const lookup = useMemo(
    () => ({ profileNames, orgNames }),
    [profileNames, orgNames],
  );
  const events = useMemo(
    () => enrichAdministrativeAuditEvents(rawEvents, profileNames, orgNames, profileRoles),
    [rawEvents, profileNames, orgNames, profileRoles],
  );
  const selected=events.find(event=>event.id===detail.selectedId);
  const formatRoleOrPerm = (roleKey: string, permission?: string) => {
    const roleLabel =
      roleLabelByKey.get(roleKey) ||
      (roleKey ? getRoleLabel(roleKey) : "Role");
    const resolvedRole =
      roleLabel === "Unsupported role" ? roleKey : roleLabel;
    if (!permission) return resolvedRole;
    const permLabel =
      PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS] ||
      permission;
    return `${resolvedRole} · ${permLabel}`;
  };
  const entityLabel = (event: AuditEvent) =>
    event.targetLabel ||
    (/^(profile|profiles|user|users|employee|account)$/i.test(event.entityType) &&
      (profileNames.get(event.entityId || "") ||
        (typeof event.metadata?.full_name === "string" && event.metadata.full_name) ||
        (typeof event.metadata?.email === "string" && event.metadata.email))) ||
    (/^(role_permissions)$/i.test(event.entityType) &&
      (() => {
        const [roleKey, perm] = String(event.entityId || "").split(":");
        return roleKey ? formatRoleOrPerm(roleKey, perm) : undefined;
      })()) ||
    (/^(custom_roles)$/i.test(event.entityType) &&
      event.entityId &&
      formatRoleOrPerm(event.entityId)) ||
    (/^(user_permission_override|user_permission_overrides)$/i.test(event.entityType) &&
      (() => {
        const [uid, perm] = String(event.entityId || "").split(":");
        const who = profileNames.get(uid || "");
        const permLabel = perm
          ? PERMISSION_LABELS[perm as keyof typeof PERMISSION_LABELS] || perm
          : undefined;
        if (who && permLabel) return `${who} · ${permLabel}`;
        return who || permLabel || undefined;
      })()) ||
    (/^(organization|organizations|office|offices|org)$/i.test(event.entityType) &&
      orgNames.get(event.entityId || "")) ||
    `${humanizeEntityType(event.entityType)}${event.entityId ? " · " + shortenIdentifier(event.entityId) : ""}`;
  const filtered = filterAuditEvents(events, filters, entityLabel);
  const set = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const distinct = (key: "entityType" | "action") =>
    [...new Set(events.map((event) => event[key]))].sort();
  const columns: Column<AuditEvent>[] = [
    {
      key: "time",
      header: "Recorded at",
      sortable: true,
      defaultWidthPx: 185,
      minWidthPx: 155,
      nowrap: true,
      sortValue: (event) => event.createdAt,
      render: (event) => (
        <span
          className="eflow-tabular whitespace-nowrap text-xs text-[var(--eflow-text)]"
          title={formatManilaInstant(event.createdAt)}
        >
          {formatAuditTimestamp(event.createdAt)}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Changed by",
      sortable: true,
      defaultWidthPx: 160,
      minWidthPx: 130,
      sortValue: (event) => event.actorName,
      render: (event) => (
        <span className="block truncate font-medium text-[var(--eflow-text)]" title={event.actorName}>
          {event.actorName}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      defaultWidthPx: 215,
      minWidthPx: 170,
      sortValue: (event) => humanizeAuditAction(event.action),
      render: (event) => {
        const label = humanizeAuditAction(event.action);
        return (
          <span className="block truncate text-[var(--eflow-text)]" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: "record",
      header: "Resource",
      defaultWidthPx: 240,
      minWidthPx: 180,
      render: (event) => {
        const label = entityLabel(event);
        return (
          <span className="block truncate text-[var(--eflow-text)]" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: "changes",
      header: "What changed",
      defaultWidthPx: 280,
      minWidthPx: 210,
      render: (event) => {
        const summary = summarizeAuditChanges(event, lookup);
        return (
          <span className="block truncate text-xs text-[var(--eflow-text-muted)]" title={summary}>
            {summary}
          </span>
        );
      },
    },
    {
      key: "office",
      header: "Office",
      defaultWidthPx: 130,
      minWidthPx: 108,
      nowrap: true,
      render: (event) => {
        const officeLabel = orgNames.get(event.orgId || "") || event.orgId || "";
        return officeLabel ? (
          <span className="block truncate" title={officeLabel}>
            {officeLabel}
          </span>
        ) : (
          <span title="Not recorded" aria-label="Not recorded" className="text-[var(--eflow-text-muted)]">
            —
          </span>
        );
      },
    },
    {
      key: "details",
      header: "Details",
      action: true,
      defaultWidthPx: 112,
      minWidthPx: 104,
      nowrap: true,
      render: (event) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(click) => detail.open(event.id,click.currentTarget)}
          aria-label={`Inspect audit event ${event.id}`}
          className="whitespace-nowrap"
        >
          <Eye size={13} aria-hidden="true" />
          Inspect
        </Button>
      ),
    },
  ];
  const sortedFiltered = useMemo(() => {
    if (!tableView.sortKey) return filtered;
    const col = columns.find((candidate) => candidate.key === tableView.sortKey);
    if (!col?.sortValue) return filtered;
    const getSortValue = col.sortValue;
    return [...filtered].sort((left, right) => {
      const leftVal = getSortValue(left);
      const rightVal = getSortValue(right);
      const cmp =
        typeof leftVal === "number" && typeof rightVal === "number"
          ? leftVal - rightVal
          : String(leftVal).localeCompare(String(rightVal));
      return tableView.sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, tableView.sortKey, tableView.sortDir]);
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedEvents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFiltered.slice(start, start + pageSize);
  }, [sortedFiltered, currentPage, pageSize]);
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
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
          className="w-full !min-w-0"
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
          className="w-full !min-w-0"
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
          className="w-full !min-w-0"
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
          className="w-full !min-w-0"
        />
        <label className="text-xs text-[var(--eflow-text-muted)]">
          From
          <DateInput
            className="mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border)] px-3 text-xs"
            value={filters.from}
            onChange={(event) => set("from", event.target.value)}
          />
        </label>
        <label className="text-xs text-[var(--eflow-text-muted)]">
          Through
          <DateInput
            className="mt-1 h-9 w-full rounded-lg border border-[var(--eflow-border)] px-3 text-xs"
            value={filters.to}
            onChange={(event) => set("to", event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Button
            variant="outline"
            disabled={!hasFilters}
            onClick={() => {
              setFilters(EMPTY_AUDIT_FILTERS);
              setPage(1);
            }}
            className="h-9 whitespace-nowrap"
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
        <div className="space-y-3">
          <AuditEventFeed
            events={pagedEvents}
            totalCount={sortedFiltered.length}
            entityLabel={entityLabel}
            lookup={lookup}
            onSelect={(event, trigger) => detail.open(event.id, trigger)}
          />
          {sortedFiltered.length > 0 && (
            <PaginationBar
              page={currentPage}
              pageSize={pageSize}
              total={sortedFiltered.length}
              totalPages={totalPages}
              itemLabel="events"
              disabled={loading}
              onPageChange={setPage}
              onPageSizeChange={(nextSize) => {
                setPageSize(nextSize);
                setPage(1);
              }}
            />
          )}
        </div>
      ) : (
        <DataTable
          ariaLabel="Account audit events"
          resizable
          emptyIllustration={events.length ? "search" : "empty"}
          density="compact"
          loading={loading}
          data={pagedEvents}
          columns={columns}
          keyExtractor={(event) => event.id}
          viewState={tableView}
          onViewStateChange={(next) => {
            setTableView(next);
            setPage(1);
          }}
          hideFooterCount
          footer={
            sortedFiltered.length > 0 ? (
              <PaginationBar
                page={currentPage}
                pageSize={pageSize}
                total={sortedFiltered.length}
                totalPages={totalPages}
                itemLabel="events"
                disabled={loading}
                onPageChange={setPage}
                onPageSizeChange={(nextSize) => {
                  setPageSize(nextSize);
                  setPage(1);
                }}
              />
            ) : undefined
          }
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
      entityLabel={selected?entityLabel(selected):''} officeLabel={orgNames.get(selected?.orgId||'')||selected?.orgId||'Not recorded'}
      lookup={lookup} onBack={detail.back} onRefresh={()=>void refresh()}/>}
    </div>
  );
}
