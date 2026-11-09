import {BudgetReleaseCalendar} from './BudgetReleaseCalendar';
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Landmark,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { getBudgetUtilizationSignal } from "../selectors/budgetSelectors";
import { AnnualBudgetSetup } from "./AnnualBudgetSetup";
import { BudgetApprovalQueue } from "./BudgetApprovalQueue";
import { IndependentReviewQueue } from './IndependentReviewQueue';
import { BudgetEmpty } from "./budgetUi";
import { FiscalYearControl } from "./FiscalYearControl";
import { BudgetFundingHierarchy } from "./BudgetFundingHierarchy";
import { BudgetReleasesPanel } from "./BudgetReleasesPanel";
import { BudgetExpensesReport, BudgetExpensesReportSkeleton } from "./BudgetExpensesReport";
import { BudgetOperationalSignals } from "./BudgetOperationalSignals";
import { getCurrentFiscalYear } from "../constants";
import { useGeneralJournal } from "../hooks/useGeneralJournal";
import { GeneralJournalWorkspace, JournalTableSkeleton } from "./GeneralJournalWorkspace";
import { AccountingTrailPanel } from "./AccountingTrailPanel";
import { BudgetPositionSummary } from "./BudgetPositionSummary";
import { DirectWorkFunding } from "./DirectWorkFunding";
import { BudgetPartitionOverview } from "./BudgetPartitionOverview";
import {BudgetVersionBanner} from './BudgetVersionBanner';
import { BudgetAccountMappings } from "./BudgetAccountMappings";
import { PettyCashVoucherRegister } from "./PettyCashVoucherRegister";
import { WorkspaceHeader } from '../../../components/ui/workspace';
import { WorkspaceLoadingSkeleton } from "../../../components/workflow/WorkspaceLoadingSkeleton";
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { writeNavigationLocation, readRouteFiscalYear } from '../../navigation';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';

import { BudgetViewControl } from './BudgetViewControl';
import { useNotificationNavigationIntent } from '../../notifications';
import { OfficePettyCash } from '../../office-petty-cash';
import { readBudgetView as tabFromUrl, type BudgetView as Tab } from '../budgetViews';

import { requestNavigation } from "../../../shared/navigationGuard";
type BudgetOwner = { budget: ReturnType<typeof useDepartmentBudget>; journal: ReturnType<typeof useGeneralJournal> };
type OfficeBudgetProps = { fiscalYear?: number; embedded?: boolean; dataOwner?: BudgetOwner };
type BudgetContentProps = BudgetOwner & { focusRequestId?: string; orgId: string; fiscalYear: number; embedded: boolean; tab: Tab; setTab: (tab: Tab) => void; setFiscalYear: (year: number) => void };

export function OfficeBudgetWorkspace(props: OfficeBudgetProps = {}) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id || userProfile?.departmentId || '';
  return <OfficeBudgetRoute key={`${userProfile?.id}:${userProfile?.role}:${orgId}`} {...props} orgId={orgId} actorId={userProfile?.id} />;
}

function OfficeBudgetRoute({ fiscalYear: suppliedYear, embedded = false, dataOwner, orgId, actorId }: OfficeBudgetProps & { orgId: string; actorId?: string }) {
  const [fiscalYearState, setFiscalYearState] = useState(() => {
    if (typeof window !== "undefined") {
      const value = readRouteFiscalYear(new URLSearchParams(window.location.search).get('fy'));
      if (value !== undefined) return value;
    }
    return getCurrentFiscalYear();
  });
  const [tabState, setTabState] = useState<Tab>(
    () =>
      tabFromUrl(
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("view")
          : null,
      ) || "overview",
  );
  const [focusRequestId, setFocusRequestId] = useState<string>();
  const fiscalYear = suppliedYear ?? fiscalYearState;
  const tab = tabState;
  const updateBudgetUrl = (nextTab: Tab, nextYear: number) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    writeNavigationLocation(embedded ? 'accounting_budgets' : 'budget', embedded ? 'Office Budget Ledgers' : 'Office Budget', 'push', {
      parameters: { ...Object.fromEntries(url.searchParams), view: nextTab, fy: String(nextYear) },
    });
  };
  const setTab = (next: Tab) => {
    void requestNavigation(() => {
      setTabState(next);
      updateBudgetUrl(next, fiscalYear);
    });
  };
  const setFiscalYear = (next: number) => {
    void requestNavigation(() => {
      setFiscalYearState(next);
      updateBudgetUrl(tab, next);
    });
  };
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = tabFromUrl(params.get("view"));
      const nextYear = readRouteFiscalYear(params.get('fy'));
      setTabState(nextTab || 'overview');
      setFiscalYearState(nextYear ?? getCurrentFiscalYear());
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener(NAVIGATION_LOCATION_EVENT, onPopState);
    return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener(NAVIGATION_LOCATION_EVENT, onPopState); };
  }, [embedded]);
  useNotificationNavigationIntent(
    intent => !embedded && intent.financialRecordType === 'office_petty_cash_staffing',
    intent => {
      if (!intent.financialRecordId) return 'unavailable';
      setFocusRequestId(intent.financialRecordId);
      setTabState('office-petty-cash');
      updateBudgetUrl('office-petty-cash', fiscalYear);
      return true;
    },
    [embedded, fiscalYear],
  );
  const content = { orgId, fiscalYear, embedded, tab, setTab, setFiscalYear, focusRequestId };
  return dataOwner ? <OfficeBudgetContent {...content} {...dataOwner} /> : <StandaloneOfficeBudgetContent {...content} actorId={actorId} />;
}

function StandaloneOfficeBudgetContent(props: Omit<BudgetContentProps, keyof BudgetOwner> & { actorId?: string }) {
  const budget = useDepartmentBudget(props.orgId, props.fiscalYear);
  const journal = useGeneralJournal(props.orgId, props.fiscalYear, props.actorId);
  return <OfficeBudgetContent {...props} budget={budget} journal={journal} />;
}

function OfficeBudgetContent({ orgId, fiscalYear, embedded, tab, setTab, setFiscalYear, budget, journal, focusRequestId }: BudgetContentProps) {
  const { userProfile } = useAuth();
  const { tasks } = useTasks();
  const canPrepare = userProfile?.role === 'head';
  const pendingCount =
    budget.allocations.filter((item) => item.status === "pending").length +
    budget.requests.filter(
      (item) => item.status === "pending_department_approval",
    ).length +
    budget.liquidations.filter(
      (item) => item.status === "pending_department_settlement",
    ).length +
    budget.releases.filter(
      (item) =>
        item.status === "scheduled" &&
        item.scheduledDate <= new Date().toISOString().slice(0, 10),
    ).length;
  const utilizationSignal = budget.summary
    ? getBudgetUtilizationSignal(budget.summary)
    : { utilization: 0, isQ4: false, underTarget: false };
  const { utilization, underTarget } = utilizationSignal;
  if (!orgId)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Your account needs an organization before an Office budget can be opened.
      </div>
    );
  return (
    <div className={`eflow-budget-workspace min-h-full bg-background text-foreground font-normal ${embedded ? "eflow-budget-embedded" : "p-4 sm:p-8"}`}>
      <div className="mx-auto max-w-[1500px] space-y-5">
        {!embedded && <WorkspaceHeader title="Office Budget" description="Annual appropriation → proposal → task funding → contextual cash request → receipts → verified expense. Every amount remains traceable to the work that authorized it." actions={
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span
                className="eflow-budget-status"
                data-status={budget.summary?.status || (budget.error ? 'unavailable' : 'unconfigured')}
              >
                {budget.summary?.status || (budget.error ? "Unavailable" : "Not configured")}
              </span>
              {budget.summary?.updatedAt && (
                <span>
                  Updated {new Date(budget.summary.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
        } />}
        {embedded && <div className="eflow-budget-ledger-status"><span className="eflow-budget-status" data-status={budget.summary?.status || (budget.error ? "unavailable" : "unconfigured")}>{budget.summary?.status || (budget.error ? "Unavailable" : "Not configured")}</span>{budget.summary?.updatedAt && <span>Updated {new Date(budget.summary.updatedAt).toLocaleString()}</span>}</div>}
        {budget.error && (
          <FeedbackState tone="error" title="Budget data unavailable" onRetry={() => void budget.refresh()}>
            {budget.error}
          </FeedbackState>
        )}
        {budget.schemaWarnings?.map((warning) => (
          <div
            key={warning}
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12px] text-amber-900"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <div>
              <strong className="block font-semibold">
                Fiscal controls update pending
              </strong>
              <span className="mt-0.5 block text-amber-800">
                {warning} Existing budgets remain readable, but audited
                adjustments, correction resubmission, release acknowledgement,
                and final financial completion guards require the update.
              </span>
            </div>
          </div>
        ))}
        <div aria-label="Budget fiscal scope and view filters" className="eflow-budget-view-toolbar sticky top-3 z-20">
          <BudgetViewControl value={tab} onChange={setTab} />
          {!embedded && <FiscalYearControl compact value={fiscalYear} onChange={setFiscalYear} />}
          <small>{budget.loading ? `Loading FY ${fiscalYear}…` : budget.error ? 'Pending financial actions unavailable' : `Pending financial actions: ${pendingCount}`} · FY {fiscalYear}</small>
        </div>
        {budget.loading ? (
          <OfficeBudgetTabSkeleton tab={tab} label="Loading the office ledger…" />
        ) : (
          <>
            {tab!=='office-petty-cash'&&<BudgetVersionBanner data={budget}/>}
            {tab === 'office-petty-cash' ? <OfficePettyCash focusRequestId={focusRequestId}/> : !budget.summary && budget.error ? null : !budget.summary && tab !== "annual" ? (
              <BudgetEmpty
                title={`No ${fiscalYear} annual budget yet`}
                description="The Head must create and lock the annual budget before proposals and task-level cash requests can be funded."
                action={
                  canPrepare ? (
                    <button
                      onClick={() => setTab("annual")}
                      className="rounded-xl bg-primary px-4 py-2.5 text-[10.5px] font-medium text-primary-foreground transition hover:bg-primary/90"
                    >
                      Create annual budget
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                {tab === "overview" && budget.summary && (
                  <><BudgetReleaseCalendar key={`releases:${orgId}:${fiscalYear}`} data={budget} onChanged={budget.refresh}/><Overview
                    data={budget}
                    summary={budget.summary}
                    utilization={utilization}
                    underTarget={underTarget}
                    onNavigate={setTab}
                  /></>
                )}
                {tab === "annual" && (
                  <><BudgetReleaseCalendar key={`releases:${orgId}:${fiscalYear}`} data={budget} onChanged={budget.refresh}/><AnnualBudgetSetup
                    key={`${orgId}:${fiscalYear}`}
                    orgId={orgId}
                    fiscalYear={fiscalYear}
                    data={budget}
                    canEdit={canPrepare}
                    onChanged={budget.refresh}
                  /></>
                )}
                {tab === "funding" && (
                  <div className="space-y-4">
                  {canPrepare && <DirectWorkFunding data={budget} tasks={tasks.filter(task=>task.orgId===orgId)} onChanged={budget.refresh} />}
                  <BudgetFundingHierarchy
                    data={budget}
                    tasks={tasks.filter((task) => task.orgId === orgId)}
                  />
                  {["head","accounting_staff"].includes(userProfile?.role||"")&&<BudgetAccountMappings data={budget} onChanged={budget.refresh}/>}
                  </div>
                )}
                {tab === "approvals" && (
                  <><BudgetApprovalQueue
                    data={budget}
                    onChanged={budget.refresh}
                  /><IndependentReviewQueue data={budget} onChanged={budget.refresh} /></>
                )}
                {tab === "releases" && (
                  <BudgetReleasesPanel
                    data={budget}
                    onChanged={budget.refresh}
                  />
                )}
                {tab === "expenses" && <BudgetExpensesReport data={budget} />}
                {tab === "vouchers" && <PettyCashVoucherRegister data={budget} />}
                {tab === "journal" && (
                  <GeneralJournalWorkspace
                    journal={journal}
                    orgId={orgId}
                    fiscalYear={fiscalYear}
                    fiscalBudgetId={budget.summary?.id}
                    approvedBudget={budget.summary?.approvedAmount}
                    availableBudget={budget.summary?.availableAmount}
                    settledExpenses={budget.summary?.spentAmount}
                    returnedCash={budget.requests.reduce(
                      (sum, request) =>
                        sum +
                        (request.status === "settled"
                          ? request.returnedAmount || 0
                          : 0),
                      0,
                    )}
                  />
                )}
                {tab === "audit" && (
                  <AccountingTrailPanel
                    data={budget}
                    journalEntries={journal.entries}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function OfficeBudgetTabSkeleton({
  tab = "overview",
  label = "Loading the office ledger…",
}: {
  tab?: Tab;
  label?: string;
}) {
  if (tab === "expenses") {
    return <BudgetExpensesReportSkeleton label={label} />;
  }
  if (tab === "journal") {
    return (
      <WorkspaceLoadingSkeleton label={label} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3" aria-hidden="true">
          {["Trial balance", "Balance delta", "Appropriation available"].map((cardLabel) => (
            <div key={cardLabel} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm space-y-2">
              <div className="text-[14px] uppercase tracking-wider text-neutral-500">{cardLabel}</div>
              <div className="ml-auto h-6 w-28 animate-pulse rounded bg-neutral-200/80" />
              <div className="ml-auto h-3 w-36 animate-pulse rounded bg-neutral-100" />
            </div>
          ))}
        </div>
        <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm" aria-hidden="true">
          <div className="border-b border-neutral-100 p-4 flex flex-wrap gap-2">
            <div className="h-9 flex-1 min-w-[200px] animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-9 w-36 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-9 w-36 animate-pulse rounded-lg bg-neutral-100" />
          </div>
          <JournalTableSkeleton label={label} />
        </section>
      </WorkspaceLoadingSkeleton>
    );
  }
  if (tab === "approvals" || tab === "releases") {
    return (
      <WorkspaceLoadingSkeleton label={label} className="space-y-4">
        {[0, 1].map((panel) => (
          <section
            key={panel}
            aria-hidden="true"
            className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
          >
            <header className="flex items-center justify-between border-b border-neutral-100 p-4">
              <div className="space-y-1.5">
                <div className="h-4 w-48 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-3 w-72 animate-pulse rounded bg-neutral-100" />
              </div>
              <div className="h-6 w-24 animate-pulse rounded-full bg-neutral-200/70" />
            </header>
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
                  <div className="space-y-2">
                    <div className="h-3.5 w-52 animate-pulse rounded bg-neutral-200/80" />
                    <div className="h-3 w-64 animate-pulse rounded bg-neutral-100" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
                      <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
                    <div className="h-8 w-28 animate-pulse rounded-lg bg-neutral-200/80" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </WorkspaceLoadingSkeleton>
    );
  }
  return (
    <WorkspaceLoadingSkeleton label={label} className="space-y-4">
      <section
        aria-hidden="true"
        className="overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
      >
        <div className="grid xl:grid-cols-[minmax(20rem,0.9fr)_minmax(34rem,1.6fr)]">
          <div className="border-b border-primary/20 bg-primary/5 p-5 xl:border-b-0 xl:border-r space-y-4">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-primary">
              <Landmark size={15} /> Available to fund
            </div>
            <div className="ml-auto h-9 w-44 animate-pulse rounded-md bg-neutral-200/80" />
            <div className="ml-auto h-3 w-64 animate-pulse rounded bg-neutral-200/60" />
            <div className="grid grid-cols-3 gap-3 border-t border-primary/15 pt-4">
              {["Annual authority", "Committed", "Actual spending"].map((item) => (
                <div key={item} className="space-y-1.5 text-right">
                  <div className="text-[13px] text-muted-foreground">{item}</div>
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-neutral-200/80" />
                </div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border/70">
            {[
              "Proposal commitments",
              "Pending approvals",
              "Release deadlines",
              "Settlement exposure",
            ].map((rowTitle) => (
              <div
                key={rowTitle}
                className="grid w-full gap-3 p-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto_auto] sm:items-center"
              >
                <span className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-1.5">
                  <div className="text-[13px] font-semibold text-foreground">{rowTitle}</div>
                  <div className="h-3 w-56 animate-pulse rounded bg-neutral-100" />
                </div>
                <div className="h-5 w-24 animate-pulse rounded bg-neutral-200/80" />
                <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section aria-hidden="true" className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-52 animate-pulse rounded bg-neutral-200/80" />
          <div className="flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-neutral-100" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-[12px]">
            <thead>
              <tr>
                {[
                  "Account",
                  "Appropriated",
                  "For later release",
                  "Budget released",
                  "Obligated",
                  "% of total appropriation",
                  "% of account",
                  "Balance",
                ].map((h, i) => (
                  <th key={h} className={`border-b p-2 ${i ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((row) => (
                <tr key={row}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
                    <td key={col} className="border-b p-2.5">
                      <div
                        className={`h-3.5 animate-pulse rounded ${
                          col === 0 ? "w-44 bg-neutral-200/80" : "ml-auto w-20 bg-neutral-100"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </WorkspaceLoadingSkeleton>
  );
}

function Overview({
  data,
  summary,
  utilization,
  underTarget,
  onNavigate,
}: {
  data: ReturnType<typeof useDepartmentBudget>;
  summary: NonNullable<ReturnType<typeof useDepartmentBudget>["summary"]>;
  utilization: number;
  underTarget: boolean;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <div className="space-y-4">
      <BudgetPositionSummary
        data={data}
        summary={summary}
        onNavigate={onNavigate}
      />
      <BudgetPartitionOverview data={data} />
      {underTarget && (
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="shrink-0 text-amber-700" />
          <div>
            <div className="text-[12px] font-semibold text-amber-950">
              Q4 utilization is below target
            </div>
            <p className="mt-1 text-[12px] text-amber-800">
              Current utilization is {utilization.toFixed(1)}%; the office
              target is {summary.underutilizationThreshold}%. Review stalled
              commitments and pending liquidations.
            </p>
          </div>
        </div>
      )}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Annual utilization</span>
          <span className="tabular-nums">{utilization.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${underTarget ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          Actual spending as a share of the approved annual authority.
          Commitments and cash awaiting settlement are shown above as separate
          operational exposures.
        </div>
      </section>
      <BudgetOperationalSignals data={data} />
    </div>
  );
}
