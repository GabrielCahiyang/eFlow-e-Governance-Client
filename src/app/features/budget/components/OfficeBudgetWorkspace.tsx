import {BudgetReleaseCalendar} from './BudgetReleaseCalendar';
import { useState, useEffect } from "react";
import {
  AlertTriangle,
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
import { BudgetExpensesReport } from "./BudgetExpensesReport";
import { BudgetOperationalSignals } from "./BudgetOperationalSignals";
import { getCurrentFiscalYear } from "../constants";
import { useGeneralJournal } from "../hooks/useGeneralJournal";
import { GeneralJournalWorkspace } from "./GeneralJournalWorkspace";
import { AccountingTrailPanel } from "./AccountingTrailPanel";
import { BudgetPositionSummary } from "./BudgetPositionSummary";
import { DirectWorkFunding } from "./DirectWorkFunding";
import { BudgetPartitionOverview } from "./BudgetPartitionOverview";
import {BudgetVersionBanner} from './BudgetVersionBanner';
import { BudgetAccountMappings } from "./BudgetAccountMappings";
import { PettyCashVoucherRegister } from "./PettyCashVoucherRegister";
import { WorkspaceHeader } from '../../../components/ui/workspace';
import { StatusPill } from '../../../components/ui/workspace/StatusPill';
import { OfficeBudgetTabSkeleton } from "./OfficeBudgetTabSkeleton";
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { writeNavigationLocation, readRouteFiscalYear } from '../../navigation';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';

import { BudgetViewControl } from './BudgetViewControl';
import { useNotificationNavigationIntent } from '../../notifications';
import { OfficePettyCash } from '../../office-petty-cash';
import { readBudgetView as tabFromUrl, type BudgetView as Tab } from '../budgetViews';

import { requestNavigation } from "../../../shared/navigationGuard";
export { OfficeBudgetTabSkeleton } from "./OfficeBudgetTabSkeleton";
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
  const groupedViews = canPrepare && !embedded;
  const budgetStatus = budget.summary?.status;
  const statusLabel = budgetStatus ? budgetStatus[0].toUpperCase() + budgetStatus.slice(1) : budget.error ? 'Unavailable' : 'Not configured';
  if (!orgId)
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Your account needs an organization before an Office budget can be opened.
      </div>
    );
  return (
    <div className={`eflow-budget-workspace min-h-full text-foreground ${embedded ? "eflow-budget-embedded" : "eflow-budget-standalone"}`}>
      <div className="eflow-budget-frame">
        {!embedded && <WorkspaceHeader title="Office Budget" description="Manage annual accounts, funding and settlements." actions={
          <div className="eflow-budget-header-actions">
            {!budget.loading && tab !== 'office-petty-cash' && <StatusPill label={statusLabel} tone={budgetStatus === 'locked' ? 'positive' : budgetStatus === 'draft' ? 'warning' : budget.error ? 'negative' : 'neutral'} />}
            <FiscalYearControl compact value={fiscalYear} onChange={setFiscalYear} />
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
        <div className={`eflow-budget-view-toolbar${groupedViews ? ' eflow-budget-view-toolbar--grouped' : ''}`}>
          <BudgetViewControl value={tab} onChange={setTab} grouped={groupedViews} />
          {embedded && <small>{budget.loading ? `Loading FY ${fiscalYear}…` : budget.error ? 'Pending financial actions unavailable' : `Pending financial actions: ${pendingCount}`} · FY {fiscalYear}</small>}
        </div>
        {budget.loading ? (
          <OfficeBudgetTabSkeleton tab={tab} label="Loading the office ledger…" />
        ) : (
          <>
            {tab === 'annual' && <BudgetVersionBanner data={budget} />}
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
                  <Overview
                    data={budget}
                    summary={budget.summary}
                    utilization={utilization}
                    underTarget={underTarget}
                    onNavigate={setTab}
                  />
                )}
                {tab === "annual" && (
                  <><AnnualBudgetSetup
                    key={`${orgId}:${fiscalYear}`}
                    orgId={orgId}
                    fiscalYear={fiscalYear}
                    data={budget}
                    canEdit={canPrepare}
                    onChanged={budget.refresh}
                  /><BudgetReleaseCalendar key={`releases:${orgId}:${fiscalYear}`} data={budget}/></>
                )}
                {tab === "funding" && (
                  <div className="eflow-budget-funding-layout">
                    <BudgetFundingHierarchy data={budget} tasks={tasks.filter((task) => task.orgId === orgId)} />
                    <div className="min-w-0 space-y-4">
                      {canPrepare && <DirectWorkFunding key={`${orgId}:${fiscalYear}`} data={budget} tasks={tasks.filter(task=>task.orgId===orgId)} onChanged={budget.refresh} />}
                      {["head","accounting_staff"].includes(userProfile?.role||"")&&<BudgetAccountMappings data={budget} onChanged={budget.refresh}/>}
                    </div>
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
            {tab !== 'annual' && tab !== 'office-petty-cash' && <BudgetVersionBanner data={budget} />}
          </>
        )}
      </div>
    </div>
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
        utilization={{ value: utilization, underTarget }}
      />
      {underTarget && (
        <div className="eflow-budget-warning flex gap-3 rounded-lg p-4">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            <div className="text-sm font-semibold">
              Q4 utilization is below target
            </div>
            <p className="mt-1 text-xs">
              Current utilization is {utilization.toFixed(1)}%; the office
              target is {summary.underutilizationThreshold}%. Review stalled
              commitments and pending liquidations.
            </p>
          </div>
        </div>
      )}
      <BudgetPartitionOverview data={data} />
      <BudgetReleaseCalendar key={summary.id} data={data} />
      <BudgetOperationalSignals data={data} />
    </div>
  );
}
