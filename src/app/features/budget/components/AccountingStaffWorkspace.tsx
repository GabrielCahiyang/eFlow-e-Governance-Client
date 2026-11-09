import { useEffect, useRef, useState } from "react";
import { AttentionBox } from "@vibe/core";
import { Banknote, BookOpenCheck, Landmark, ReceiptText } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { getCurrentFiscalYear } from "../constants";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { useGeneralJournal } from "../hooks/useGeneralJournal";
import { AccountingSettlementQueue } from "./AccountingSettlementQueue";
import { AccountingTrailPanel } from "./AccountingTrailPanel";
import { BudgetReleasesPanel } from "./BudgetReleasesPanel";
import { OfficeBudgetWorkspace, OfficeBudgetTabSkeleton } from "./OfficeBudgetWorkspace";
import { FiscalYearControl } from "./FiscalYearControl";
import { GeneralJournalWorkspace } from "./GeneralJournalWorkspace";
import { AccountingOverview } from "./AccountingOverview";
import { AccountingDestinationControl } from "./AccountingDestinationControl";
import { WorkspaceHeader } from "../../../components/ui/workspace";

import {
  ACCOUNTING_VIEWS,
  type AccountingWorkspaceView,
} from "../accountingNavigation";
export type { AccountingWorkspaceView } from "../accountingNavigation";
import {
  NAVIGATION_LOCATION_EVENT,
  pushNavigationHistory,
} from "../../../shared/navigationHistory";
import { requestNavigation } from "../../../shared/navigationGuard";
import { Button } from "../../../components/ui/button";
import { getNavigationPermission, readRouteFiscalYear, writeNavigationLocation } from "../../navigation";
import { useOrgs } from "../../../hooks/useSupabaseData";
import "../accountingWorkspace.css";

type AccountingWorkspaceProps = { view: AccountingWorkspaceView; onNavigate?: (section: string, page: string) => void };
export function AccountingStaffWorkspace(props: AccountingWorkspaceProps) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id || userProfile?.departmentId || '';
  return <ScopedAccountingWorkspace key={`${userProfile?.id}:${userProfile?.role}:${orgId}`} {...props} />;
}
function ScopedAccountingWorkspace({ view: suppliedView, onNavigate }: AccountingWorkspaceProps) {
  const { userProfile, can } = useAuth();
  const { orgs } = useOrgs();
  const [view, setView] = useState(suppliedView);
  useEffect(() => setView(suppliedView), [suppliedView]);
  const selectView = (next: AccountingWorkspaceView) => {
    const target = ACCOUNTING_VIEWS.find((item) => item.id === next)!;
    if (onNavigate) onNavigate(target.section, target.page);
    else void requestNavigation(() => {
      setView(next);
      writeNavigationLocation(target.section, target.page, 'push', { parameters: { ...Object.fromEntries(new URLSearchParams(window.location.search)), fy: String(fiscalYear) } });
    });
  };
  const orgId = userProfile?.org_id || userProfile?.departmentId || "";
  const [fiscalYear, setFiscalYear] = useState(() => {
    return readRouteFiscalYear(new URLSearchParams(window.location.search).get('fy')) ?? getCurrentFiscalYear();
  });
  useEffect(() => {
    const sync = () => {
      setFiscalYear(readRouteFiscalYear(new URLSearchParams(window.location.search).get('fy')) ?? getCurrentFiscalYear());
    };
    window.addEventListener(NAVIGATION_LOCATION_EVENT, sync);
    window.addEventListener('popstate', sync);
    return () => { window.removeEventListener(NAVIGATION_LOCATION_EVENT, sync); window.removeEventListener('popstate', sync); };
  }, []);
  const budget = useDepartmentBudget(orgId, fiscalYear);
  const journal = useGeneralJournal(orgId, fiscalYear, userProfile?.id);
  const previousView = useRef(view);
  useEffect(() => {
    if (view === "journal" && previousView.current !== "journal")
      void journal.refresh();
    previousView.current = view;
  }, [view, journal.refresh]);

  const settledExpenses = budget.requests.reduce(
    (sum, request) =>
      sum + (request.status === "settled" ? request.actualSpent || 0 : 0),
    0,
  );
  const returnedCash = budget.requests.reduce(
    (sum, request) =>
      sum + (request.status === "settled" ? request.returnedAmount || 0 : 0),
    0,
  );
  const title = {
    overview: "Accounting Overview",
    releases: "Voucher & Cash Releases",
    settlements: "Accounting Settlements",
    journal: "General Journal",
    audit: "Financial Audit Trail",
    budgets: "Office Budget Ledgers",
  }[view];
  if (!orgId)
    return (
      <div className="p-8">
        <AttentionBox
          type="warning"
          title="Office assignment required"
          text="Accounting Staff access is always scoped to one office. Ask the Head or Admin to assign your account to a office."
        />
      </div>
    );

  return (
    <div className="eflow-accounting-workspace min-h-full min-w-0 bg-background text-foreground">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <WorkspaceHeader title={title} description={`${orgs.find(org => org.id === orgId)?.name || orgId} · FY ${fiscalYear}`} actions={
          <FiscalYearControl value={fiscalYear} onChange={year => {
            void requestNavigation(() => {
              setFiscalYear(year);
              const url = new URL(window.location.href);
              url.searchParams.set('fy', String(year));
              pushNavigationHistory(url.toString());
            });
          }} />
        } />
        <AccountingDestinationControl value={view} items={ACCOUNTING_VIEWS.filter(item => {
          const permission = getNavigationPermission(userProfile?.role || '', item.section);
          return Boolean(permission && can(permission));
        })} onChange={selectView} />
        {budget.error && view !== "budgets" && (
          <div role="alert">
            <AttentionBox
              type="negative"
              title="Financial records could not be refreshed"
              text={
                budget.error +
                " Displayed records may be outdated. Verify before a financial action."
              }
            />
            <Button variant="outline" onClick={() => void budget.refresh()}>
              Refresh financial records
            </Button>
          </div>
        )}
        {journal.error && view !== "journal" && view !== "budgets" && <AttentionBox type="negative" text={journal.error} />}
        {budget.refreshing && (
          <p role="status">Refreshing financial records…</p>
        )}
        {budget.loading ? (
          <AccountingWorkspaceViewSkeleton view={view} />
        ) : budget.error && !budget.summary && ["releases", "settlements", "audit"].includes(view) ? null : view === "overview" ? (
          <AccountingOverview
            budget={budget}
            journalCount={journal.error || journal.loading ? undefined : journal.entries.length}
            onSettlements={can("navigation.accounting_releases") ? () => selectView("settlements") : undefined}
            onReleases={can('navigation.accounting_releases')?()=>selectView('releases'):undefined}
            onBudgets={can('navigation.department_budgets')?()=>selectView('budgets'):undefined}
          />
        ) : view === "releases" ? (
          <BudgetReleasesPanel data={budget} onChanged={budget.refresh} onOpenSettlements={() => selectView("settlements")} />
        ) : view === "settlements" ? (
          <AccountingSettlementQueue data={budget} onChanged={budget.refresh} />
        ) : view === "budgets" ? (
          <OfficeBudgetWorkspace fiscalYear={fiscalYear} embedded dataOwner={{ budget, journal }} />
        ) : view === "journal" ? (
          <GeneralJournalWorkspace
            journal={journal}
            orgId={orgId}
            fiscalYear={fiscalYear}
            fiscalBudgetId={budget.summary?.id}
            approvedBudget={budget.summary?.approvedAmount}
            availableBudget={budget.summary?.availableAmount}
            settledExpenses={settledExpenses}
            returnedCash={returnedCash}
          />
        ) : (
          <AccountingTrailPanel
            data={budget}
            journalEntries={journal.entries}
          />
        )}
      </div>
    </div>
  );
}

function AccountingWorkspaceViewSkeleton({ view }: { view: AccountingWorkspaceView }) {
  if (view === "budgets") {
    return <OfficeBudgetTabSkeleton tab="overview" label="Loading accounting workspace…" />;
  }
  if (view === "journal") {
    return <OfficeBudgetTabSkeleton tab="journal" label="Loading accounting workspace…" />;
  }
  if (view === "releases" || view === "settlements" || view === "audit") {
    return <OfficeBudgetTabSkeleton tab="approvals" label="Loading accounting workspace…" />;
  }
  return (
    <div role="status" aria-live="polite" aria-label="Loading accounting workspace…" className="eflow-accounting-overview space-y-4">
      <span className="sr-only">Loading accounting workspace…</span>
      <section className="eflow-accounting-summary" aria-hidden="true">
        {[
          { label: "Cash to release", icon: Banknote },
          { label: "Release room today", icon: Banknote },
          { label: "Pending settlement", icon: ReceiptText },
          { label: "Journal entries", icon: BookOpenCheck },
          { label: "Actual spending", icon: Landmark },
        ].map(({ label, icon: Icon }) => (
          <article key={label}>
            <h2>
              <Icon size={16} aria-hidden="true" />
              {label}
            </h2>
            <strong>
              <span className="inline-block h-6 w-28 animate-pulse rounded bg-neutral-200/80 align-middle" />
            </strong>
            <p>
              <span className="inline-block h-3 w-36 animate-pulse rounded bg-neutral-100" />
            </p>
          </article>
        ))}
      </section>
      <section className="eflow-accounting-settlement-handoff" aria-hidden="true">
        <div className="space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-neutral-200/80" />
          <div className="h-3 w-80 max-w-full animate-pulse rounded bg-neutral-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-lg bg-neutral-100" />
      </section>
    </div>
  );
}
