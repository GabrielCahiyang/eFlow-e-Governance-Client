import { readableUiError } from '../../../shared/userFacingError';
import { useMemo, useState } from "react";
import { Banknote, CalendarClock, CheckCircle2, Clock3, ReceiptText, Search, X } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { EmptyState } from "../../../components/ui/EmptyState";
import type {
  DepartmentBudgetBundle,
  PettyCashRelease,
  PettyCashRequest,
} from "../types";
import { BudgetEmpty, peso, StatusPill } from "./budgetUi";
import { CashReleaseOverrideDialog } from "./CashReleaseOverrideDialog";
import { DisbursementVoucherDialog } from "./DisbursementVoucherDialog";
import { VoucherConfirmDialog } from "./VoucherConfirmDialog";
import { getCurrentFiscalYear } from "../constants";
import { formatFundingRequestCode, getScheduledReleaseSummary } from "../selectors/cashWorkflowRules";
import { DEFAULT_BUDGET_PAGE_SIZE, useBudgetPagination } from "../hooks/useBudgetPagination";
import { BudgetPagination } from "./BudgetPagination";

type ActiveDialog =
  | { kind: "release"; release: PettyCashRelease; request?: PettyCashRequest }
  | {
      kind: "acknowledge";
      release: PettyCashRelease;
      request?: PettyCashRequest;
    };

export function BudgetReleasesPanel({
  data,
  onChanged,
  onOpenSettlements,
}: {
  data: DepartmentBudgetBundle;
  onChanged: () => Promise<void>;
  onOpenSettlements?: () => void;
}) {
  const { userProfile, can } = useAuth();
  const currentUserId = userProfile?.id || "";
  const canRelease =
    userProfile?.role === "accounting_staff" &&
    can("accounting.release_cash") &&
    !(data as DepartmentBudgetBundle & { error?: string }).error;
  const canOverride = canRelease;
  const fiscalYear = data.summary?.fiscalYear ?? getCurrentFiscalYear();
  const [override, setOverride] = useState<PettyCashRelease>();
  const [active, setActive] = useState<ActiveDialog>();
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "released">("all");
  const [query, setQuery] = useState("");
  const requestById = useMemo(
    () => new Map(data.requests.map((item) => [item.id, item])),
    [data.requests],
  );
  const releaseSummary = useMemo(
    () => getScheduledReleaseSummary(data.releases),
    [data.releases],
  );
  const orderedReleases = useMemo(
    () =>
      [...data.releases].sort((left, right) => {
        if (left.status === "scheduled" && right.status !== "scheduled")
          return -1;
        if (left.status !== "scheduled" && right.status === "scheduled")
          return 1;
        return left.scheduledDate.localeCompare(right.scheduledDate);
      }),
    [data.releases],
  );
  const visibleReleases = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orderedReleases.filter((release) => {
      if (statusFilter !== "all" && release.status !== statusFilter) return false;
      if (!needle) return true;
      const request = requestById.get(release.requestId);
      return `${formatFundingRequestCode(request?.requestNumber)} ${request?.subtaskTitle || ""} ${request?.taskTitle || ""} ${request?.cashRecipientName || ""} ${request?.requesterName || ""} ${release.voucherNumber || ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [orderedReleases, query, requestById, statusFilter]);
  const liquidationRequests = useMemo(
    () =>
      data.requests.filter(
        (request) =>
          request.releasedAmount ||
          ["settled", "overdue_liquidation"].includes(request.status),
      ),
    [data.requests],
  );
  const releasePagination = useBudgetPagination(
    visibleReleases,
    `${fiscalYear}:${statusFilter}:${query}`,
    DEFAULT_BUDGET_PAGE_SIZE,
  );
  const liquidationPagination = useBudgetPagination(
    liquidationRequests,
    `${fiscalYear}`,
    DEFAULT_BUDGET_PAGE_SIZE,
  );
  const refresh = async () => {
    setMessage("");
    try {
      await onChanged();
    } catch (caught) {
      setMessage(
        readableUiError(caught, "List could not refresh. Reload the page before taking another action.", 'read'),
      );
    }
  };
  const summaryCards = (
    <div className="eflow-accounting-kpis">
      <ReleaseSummaryCard
        icon={<Banknote size={16} aria-hidden="true" />}
        label="Cash to release"
        value={peso.format(releaseSummary.scheduledAmount)}
        note={`${releaseSummary.scheduledCount} scheduled tranche${releaseSummary.scheduledCount === 1 ? "" : "s"}`}
        urgent={releaseSummary.dueCount > 0}
      />
      <ReleaseSummaryCard
        icon={<Clock3 size={16} aria-hidden="true" />}
        label="Due now"
        value={peso.format(releaseSummary.dueAmount)}
        note={`${releaseSummary.dueCount} tranche${releaseSummary.dueCount === 1 ? "" : "s"} ready for release`}
        urgent={releaseSummary.dueCount > 0}
      />
      <ReleaseSummaryCard
        icon={<CalendarClock size={16} aria-hidden="true" />}
        label="Scheduled later"
        value={String(releaseSummary.futureCount)}
        note="Future release tranches"
      />
    </div>
  );
  if (!data.releases.length && !data.liquidations.length)
    return (
      <div className="space-y-4">
        {summaryCards}
        <BudgetEmpty
          title="No releases or liquidations"
          description="Approved requests will be scheduled for release. Released cash remains here until its receipts and returns are settled."
        />
      </div>
    );
  return (
    <div className="space-y-4">
      {message && (
        <div role="alert" className="rounded-[10px] border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {message}
        </div>
      )}
      {summaryCards}
      <section className="eflow-accounting-panel">
        <header className="eflow-accounting-panel__header">
          <div className="eflow-accounting-panel__title">
            <Banknote size={17} aria-hidden="true" />
            <div>
              <h3>Voucher &amp; release schedule</h3>
              <p>Confirm physical cash or cheque disbursements and track recipient receipts.</p>
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {visibleReleases.length} {visibleReleases.length === 1 ? "tranche" : "tranches"}
          </span>
        </header>
        {orderedReleases.length > 0 && (
          <div className="eflow-accounting-filter-bar">
            <label className="relative flex min-w-[220px] flex-1 items-center">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 text-muted-foreground" />
              <input
                type="search"
                aria-label="Search releases"
                placeholder="Search request code, voucher, task, or recipient…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-lg border border-border bg-card pl-9 pr-8 text-sm"
              />
              {query && (
                <button type="button" aria-label="Clear release search" onClick={() => setQuery("")} className="absolute right-2 inline-flex min-h-7 items-center text-muted-foreground hover:text-foreground">
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="eflow-accounting-filter-chips" role="group" aria-label="Filter release tranches">
              {([
                ["all", "All"],
                ["scheduled", "Scheduled"],
                ["released", "Released"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={statusFilter === key}
                  className="eflow-accounting-chip"
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {visibleReleases.length ? releasePagination.pageItems.map((release) => {
          const request = requestById.get(release.requestId);
          const canAcknowledge =
            release.status === "released" &&
            release.recipientId === currentUserId &&
            !release.acknowledgedAt;
          return (
            <div
              key={release.id}
              className="eflow-budget-release-row"
            >
              <div className="min-w-0 break-words">
                <div className="text-sm font-semibold text-foreground">
                  {formatFundingRequestCode(request?.requestNumber)} ·{" "}
                  {request?.subtaskTitle || request?.taskTitle || "Funded work"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Recipient:{" "}
                  {request?.cashRecipientName ||
                    request?.requesterName ||
                    "Assigned recipient"}{" "}
                  · Scheduled {release.scheduledDate}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {release.voucherNumber ||
                    "Voucher number assigned on release"}
                  {release.status === "released"
                    ? ` · ${release.releaseMethod || "cash"}${release.chequeNumber ? ` ${release.chequeNumber}` : ""}`
                    : ""}
                </div>
                {release.releasedAt && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Released {new Date(release.releasedAt).toLocaleString()}
                  </div>
                )}
              </div>
              <div className="eflow-budget-release-actions">
                <StatusPill status={release.status} />
                <strong className="text-sm tabular-nums text-foreground">{peso.format(release.amount)}</strong>
                {release.status === "scheduled" && canRelease ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMessage("");
                        setActive({ kind: "release", release, request });
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
                    >
                      <Banknote size={14} aria-hidden="true" /> Mark released
                    </button>
                    {canOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          setMessage("");
                          setOverride(release);
                        }}
                        className="eflow-budget-warning inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium disabled:opacity-40"
                      >
                        <Clock3 size={14} aria-hidden="true" /> Override schedule
                      </button>
                    )}
                  </>
                ) : canAcknowledge ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setActive({ kind: "acknowledge", release, request });
                    }}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-40"
                  >
                    <CheckCircle2 size={14} aria-hidden="true" /> Acknowledge
                  </button>
                ) : release.acknowledgedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 size={14} aria-hidden="true" /> Received
                  </span>
                ) : null}
              </div>
            </div>
          );
        }) : (
          <EmptyState
            size="compact"
            illustration={query || statusFilter !== "all" ? "search" : "tasks"}
            title={query || statusFilter !== "all" ? "No matching releases" : "No scheduled releases"}
            description={query || statusFilter !== "all" ? "Adjust your search or tranche status filter." : "Approved requests appear here when scheduled for release."}
          />
        )}
        <BudgetPagination
          page={releasePagination.page}
          pageSize={releasePagination.pageSize}
          totalItems={releasePagination.totalItems}
          visibleCount={releasePagination.pageItems.length}
          noun="tranche"
          onPageChange={releasePagination.setPage}
          onPageSizeChange={releasePagination.setPageSize}
        />
      </section>
      <section className="eflow-accounting-panel">
        <header className="eflow-accounting-panel__header">
          <div className="eflow-accounting-panel__title">
            <ReceiptText size={17} aria-hidden="true" />
            <div>
              <h3>Liquidation timeline</h3>
              <p>Post-release liquidation due dates and settlement status.</p>
            </div>
          </div>
        </header>
        {liquidationRequests.length ? liquidationPagination.pageItems.map((request) => {
            const latest = data.liquidations.filter(item => item.requestId === request.id)
              .sort((a, b) => b.version - a.version)[0];
            const settled = request.status === "settled";
            return (
              <div
                key={request.id}
                className="grid gap-3 border-b border-border p-4 last:border-0 md:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {request.subtaskTitle || request.taskTitle || "Funded work"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {request.requesterName} · {request.purpose}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  <Clock3 size={13} aria-hidden="true" className="mr-1 inline" />
                  {settled ? "Settlement posted" : request.liquidationDueAt
                    ? `Due ${new Date(request.liquidationDueAt).toLocaleDateString()}`
                    : "Awaiting full release"}
                </div>
                <div className="text-right">
                  <StatusPill status={request.status} />
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {settled && request.actualSpent != null
                      ? `${peso.format(request.actualSpent)} posted · ${peso.format(request.returnedAmount ?? 0)} returned`
                      : latest && !settled
                        ? `${peso.format(latest.declaredSpent)} declared spent · ${peso.format(latest.returnedAmount)} declared return`
                      : `${peso.format(request.releasedAmount || 0)} released`}
                  </div>
                  {request.status === "pending_department_settlement" && onOpenSettlements && (
                    <button type="button" onClick={onOpenSettlements} className="mt-2 text-xs font-medium text-primary underline">Open Accounting Settlements</button>
                  )}
                </div>
              </div>
            );
          }) : (
          <EmptyState size="compact" illustration="complete" title="No released advances to liquidate" description="Released cash requests appear here with their liquidation due dates." />
        )}
        <BudgetPagination
          page={liquidationPagination.page}
          pageSize={liquidationPagination.pageSize}
          totalItems={liquidationPagination.totalItems}
          visibleCount={liquidationPagination.pageItems.length}
          noun="liquidation"
          onPageChange={liquidationPagination.setPage}
          onPageSizeChange={liquidationPagination.setPageSize}
        />
      </section>
      {override && (
        <CashReleaseOverrideDialog
          fiscalYear={data.summary?.fiscalYear}
          key={override.id}
          release={override}
          request={requestById.get(override.requestId)}
          dailyLimit={data.summary?.dailyPettyCashReleaseLimit}
          onClose={() => setOverride(undefined)}
          onReleased={async () => {
            try {
              await onChanged();
            } catch {
              setMessage(
                "Cash was recorded as released, but the list could not refresh. Refresh the page before taking another action.",
              );
            }
          }}
        />
      )}
      {active?.kind === "release" && (
        <DisbursementVoucherDialog
          key={active.release.id}
          release={active.release}
          request={active.request}
          fiscalYear={fiscalYear}
          onClose={() => setActive(undefined)}
          onReleased={refresh}
        />
      )}
      {active?.kind === "acknowledge" && (
        <VoucherConfirmDialog
          key={active.release.id}
          release={active.release}
          request={active.request}
          fiscalYear={fiscalYear}
          onClose={() => setActive(undefined)}
          onAcknowledged={refresh}
        />
      )}
    </div>
  );
}

function ReleaseSummaryCard({
  icon,
  label,
  value,
  note,
  urgent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  urgent?: boolean;
}) {
  return (
    <div className="eflow-accounting-kpi" data-urgent={urgent ? "true" : undefined}>
      <div className="eflow-accounting-kpi__label">
        {icon}
        {label}
      </div>
      <div className="eflow-accounting-kpi__value">{value}</div>
      <div className="eflow-accounting-kpi__note">{note}</div>
    </div>
  );
}
