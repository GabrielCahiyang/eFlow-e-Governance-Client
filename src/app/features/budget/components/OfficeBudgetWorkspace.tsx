import { useState } from "react";
import { useEffect } from "react";
import { Tab, TabList, TabsContext } from "@vibe/core";
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  Landmark,
  WalletCards,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { useTasks } from "../../../hooks/useFirebaseData";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { getBudgetUtilizationSignal } from "../selectors/budgetSelectors";
import { AnnualBudgetSetup } from "./AnnualBudgetSetup";
import { BudgetApprovalQueue } from "./BudgetApprovalQueue";
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
import { WorkspaceLoadingSkeleton } from "../../../components/workflow/WorkspaceLoadingSkeleton";
import { BudgetPositionSummary } from "./BudgetPositionSummary";
import { DirectWorkFunding } from "./DirectWorkFunding";
import { BudgetPartitionOverview } from "./BudgetPartitionOverview";
import { BudgetAccountMappings } from "./BudgetAccountMappings";
import { PettyCashVoucherRegister } from "./PettyCashVoucherRegister";

type Tab =
  | "overview"
  | "annual"
  | "funding"
  | "approvals"
  | "releases"
  | "expenses"
  | "vouchers"
  | "journal"
  | "audit";
type BudgetArea = "overview" | "planning" | "requests" | "ledger";

const areaTabs: Record<BudgetArea, Array<{ id: Tab; label: string }>> = {
  overview: [{ id: "overview", label: "Overview" }],
  planning: [
    { id: "annual", label: "Annual Budget" },
    { id: "funding", label: "Proposal & Task Funding" },
  ],
  requests: [
    { id: "approvals", label: "Funding Requests" },
    { id: "releases", label: "Releases & Settlement" },
    { id: "expenses", label: "Expenses" },
    { id: "vouchers", label: "Petty Cash Vouchers" },
  ],
  ledger: [
    { id: "journal", label: "General Journal" },
    { id: "audit", label: "Accounting Trail" },
  ],
};

const areaForTab = (tab: Tab): BudgetArea =>
  tab === "overview"
    ? "overview"
    : tab === "annual" || tab === "funding"
      ? "planning"
      : tab === "approvals" || tab === "releases" || tab === "expenses" || tab === "vouchers"
        ? "requests"
        : "ledger";

const tabFromUrl = (value: string | null): Tab | null => {
  const valid: Tab[] = [
    "overview",
    "annual",
    "funding",
    "approvals",
    "releases",
    "expenses",
    "vouchers",
    "journal",
    "audit",
  ];
  return value && valid.includes(value as Tab) ? (value as Tab) : null;
};

import { requestNavigation } from "../../../shared/navigationGuard";
export function OfficeBudgetWorkspace({
  fiscalYear: suppliedYear,
  embedded = false,
}: { fiscalYear?: number; embedded?: boolean } = {}) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id || userProfile?.departmentId || "";
  const [fiscalYearState, setFiscalYearState] = useState(() => {
    if (typeof window !== "undefined") {
      const value = Number(
        new URLSearchParams(window.location.search).get("fy"),
      );
      if (Number.isInteger(value) && value >= 2000 && value <= 2200)
        return value;
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
  const fiscalYear = suppliedYear ?? fiscalYearState;
  const tab = tabState;
  const updateBudgetUrl = (nextTab: Tab, nextYear: number) => {
    if (embedded || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.pathname = "/office-budget";
    url.searchParams.set("page", "Office Budget");
    url.searchParams.set("view", nextTab);
    url.searchParams.set("fy", String(nextYear));
    window.history.pushState(
      { page: "Office Budget", view: nextTab, fy: nextYear },
      "",
      `${url.pathname}?${url.searchParams.toString()}`,
    );
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
    if (embedded) return;
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = tabFromUrl(params.get("view"));
      const nextYear = Number(params.get("fy"));
      if (nextTab) setTabState(nextTab);
      if (Number.isInteger(nextYear) && nextYear >= 2000 && nextYear <= 2200)
        setFiscalYearState(nextYear);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [embedded]);
  const budget = useDepartmentBudget(orgId, fiscalYear);
  const journal = useGeneralJournal(orgId, fiscalYear);
  const { tasks } = useTasks();
  const canPrepare = ["head", "head"].includes(userProfile?.role || "");
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
      <div className="p-8 text-[12px] text-neutral-500">
        Your account needs an organization before a office budget can be opened.
      </div>
    );
  const activeArea = areaForTab(tab);
  const areaIndex = ["overview", "planning", "requests", "ledger"].indexOf(
    activeArea,
  );
  return (
    <div className="eflow-budget-workspace min-h-full bg-neutral-50 p-4 font-normal sm:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-neutral-500">
              Office · Fiscal control
            </div>
            <h1 className="mt-1 text-[24px] font-semibold text-neutral-950">
              Office Budget
            </h1>
            <p className="mt-1 max-w-3xl text-[14px] leading-relaxed text-neutral-600">
              Annual appropriation → proposal → task funding → contextual cash
              request → receipts → verified expense. Every amount remains
              traceable to the work that authorized it.
            </p>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-neutral-500">
              <span
                className={`rounded-full px-2 py-1 capitalize ${budget.summary?.status === "locked" ? "bg-emerald-50 text-emerald-700" : budget.summary?.status === "closed" ? "bg-neutral-100 text-neutral-600" : "bg-amber-50 text-amber-700"}`}
              >
                {budget.summary?.status || "Not configured"}
              </span>
              {budget.summary?.updatedAt && (
                <span>
                  Updated {new Date(budget.summary.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </header>
        {budget.error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[12px] text-rose-700">
            {budget.error}
          </div>
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
        {budget.loading ? (
          <WorkspaceLoadingSkeleton
            label="Loading the office ledger…"
            rows={6}
          />
        ) : (
          <>
            <div
              aria-label="Budget fiscal scope and view filters"
              className="sticky top-3 z-20 rounded-2xl border border-neutral-200 bg-white/95 p-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-white/80"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Fiscal scope &amp; views
                  </div>
                  <div className="mt-0.5 text-[12px] text-neutral-600">
                    FY {fiscalYear} ·{" "}
                    {activeArea === "overview"
                      ? "Budget position"
                      : activeArea === "planning"
                        ? "Planning and allocation"
                        : activeArea === "requests"
                          ? "Requests and settlement"
                          : "Ledger and audit"}
                  </div>
                </div>
                {!embedded && (
                  <FiscalYearControl
                    compact
                    value={fiscalYear}
                    onChange={setFiscalYear}
                  />
                )}
              </div>
              <TabsContext activeTabId={areaIndex} id="office-budget-areas">
                <TabList id="office-budget-area-list">
                  <Tab
                    active={activeArea === "overview"}
                    id="budget-overview"
                    onClick={() => setTab("overview")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Landmark size={14} /> Overview
                    </span>
                  </Tab>
                  <Tab
                    active={activeArea === "planning"}
                    id="budget-planning"
                    onClick={() => setTab("annual")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpenCheck size={14} /> Planning &amp; Allocation
                    </span>
                  </Tab>
                  <Tab
                    active={activeArea === "requests"}
                    id="budget-requests"
                    onClick={() => setTab("approvals")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <WalletCards size={14} /> Requests &amp; Settlement
                      {pendingCount ? ` · ${pendingCount}` : ""}
                    </span>
                  </Tab>
                  <Tab
                    active={activeArea === "ledger"}
                    id="budget-ledger"
                    onClick={() => setTab("journal")}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Archive size={14} /> Ledger &amp; Audit
                    </span>
                  </Tab>
                </TabList>
              </TabsContext>
              {areaTabs[activeArea].length > 1 && (
                <div
                  className="mt-1 flex min-w-0 gap-1 overflow-x-auto border-t border-neutral-100 pt-1"
                  aria-label={`${activeArea} budget views`}
                >
                  {areaTabs[activeArea].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-medium transition ${tab === item.id ? "bg-neutral-100 text-neutral-950" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!budget.summary && tab !== "annual" ? (
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
                  <AnnualBudgetSetup
                    key={`${orgId}:${fiscalYear}`}
                    orgId={orgId}
                    fiscalYear={fiscalYear}
                    data={budget}
                    canEdit={canPrepare}
                    onChanged={budget.refresh}
                  />
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
                  <BudgetApprovalQueue
                    data={budget}
                    onChanged={budget.refresh}
                  />
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
                    orgId={orgId}
                    fiscalYear={fiscalYear}
                    fiscalBudgetId={budget.summary?.id}
                    approvedBudget={budget.summary?.approvedAmount}
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
        <div className="flex justify-between text-[12px] text-neutral-500">
          <span>Annual utilization</span>
          <span className="tabular-nums">{utilization.toFixed(1)}%</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-neutral-100">
          <div
            className={`h-full rounded-full ${underTarget ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
        <div className="mt-3 text-[12px] text-neutral-500">
          Actual spending as a share of the approved annual authority.
          Commitments and cash awaiting settlement are shown above as separate
          operational exposures.
        </div>
      </section>
      <BudgetOperationalSignals data={data} />
    </div>
  );
}
