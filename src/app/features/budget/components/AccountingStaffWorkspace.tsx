import { useState } from "react";
import { AttentionBox, Label, Loader } from "@vibe/core";
import * as m from "motion/react-m";
import {
  Banknote,
  BookOpenCheck,
  Landmark,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { motionTransition } from "../../../shared/motion/motionTokens";
import { getCurrentFiscalYear } from "../constants";
import { useDepartmentBudget } from "../hooks/useDepartmentBudget";
import { useGeneralJournal } from "../hooks/useGeneralJournal";
import { AccountingSettlementQueue } from "./AccountingSettlementQueue";
import { AccountingTrailPanel } from "./AccountingTrailPanel";
import { BudgetReleasesPanel } from "./BudgetReleasesPanel";
import { OfficeBudgetWorkspace } from "./OfficeBudgetWorkspace";
import { FiscalYearControl } from "./FiscalYearControl";
import { GeneralJournalWorkspace } from "./GeneralJournalWorkspace";
import { peso } from "./budgetUi";
import { getScheduledReleaseSummary } from "../selectors/cashWorkflowRules";

export type AccountingWorkspaceView =
  "overview" | "releases" | "journal" | "audit" | "budgets";

export function AccountingStaffWorkspace({
  view,
}: {
  view: AccountingWorkspaceView;
}) {
  const { userProfile } = useAuth();
  const orgId = userProfile?.org_id || userProfile?.departmentId || "";
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const budget = useDepartmentBudget(orgId, fiscalYear);
  const journal = useGeneralJournal(orgId, fiscalYear);
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
  if (view === "budgets") return <OfficeBudgetWorkspace />;
  return (
    <div className="min-h-full min-w-0 bg-neutral-50 p-3 sm:p-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <m.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition.productive}
          className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-blue-600">
              Office · Accounting
            </div>
            <h1 className="mt-1 text-[22px] font-semibold text-neutral-950">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-[11px] text-neutral-500">
              Office-scoped releases, settlement, journal reconciliation,
              and immutable financial evidence.
            </p>
            <div className="mt-2">
              <Label color="positive" text="Accounting Staff · scoped access" />
            </div>
          </div>
          <FiscalYearControl value={fiscalYear} onChange={setFiscalYear} />
        </m.header>
        {budget.error && <AttentionBox type="negative" text={budget.error} />}
        {budget.loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white p-12 text-[11px] text-neutral-500">
            <Loader size="small" /> Loading accounting workspace…
          </div>
        ) : view === "overview" ? (
          <AccountingOverview
            budget={budget}
            journalCount={journal.entries.length}
          />
        ) : view === "releases" ? (
          <div className="space-y-4">
            <AccountingSettlementQueue
              data={budget}
              onChanged={budget.refresh}
            />
            <BudgetReleasesPanel data={budget} onChanged={budget.refresh} />
          </div>
        ) : view === "journal" ? (
          <GeneralJournalWorkspace
            orgId={orgId}
            fiscalYear={fiscalYear}
            fiscalBudgetId={budget.summary?.id}
            approvedBudget={budget.summary?.approvedAmount}
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

function AccountingOverview({
  budget,
  journalCount,
}: {
  budget: ReturnType<typeof useDepartmentBudget>;
  journalCount: number;
}) {
  const releases = getScheduledReleaseSummary(budget.releases);
  const settlements = budget.liquidations.filter(
    (liquidation) => liquidation.status === "pending_department_settlement",
  ).length;
  const cards = [
    {
      label: "Cash to release",
      value: peso.format(releases.scheduledAmount),
      note: `${releases.dueCount} due now · ${releases.futureCount} scheduled later`,
      icon: <Banknote size={16} />,
      tone: releases.dueCount ? "text-amber-700" : "text-blue-700",
    },
    {
      label: "Release room today",
      value: peso.format(budget.summary?.dailyReleaseRemaining || 0),
      note: `${peso.format(releases.dueAmount)} due today`,
      icon: <Banknote size={16} />,
      tone: releases.dueCount ? "text-amber-700" : "text-emerald-700",
    },
    {
      label: "Pending settlement",
      value: String(settlements),
      note: "Leader-endorsed liquidations",
      icon: <ReceiptText size={16} />,
      tone: settlements ? "text-amber-700" : "text-emerald-700",
    },
    {
      label: "Journal entries",
      value: String(journalCount),
      note: `${budget.summary?.fiscalYear || "Current"} fiscal year`,
      icon: <BookOpenCheck size={16} />,
      tone: "text-blue-700",
    },
    {
      label: "Actual spending",
      value: peso.format(budget.summary?.spentAmount || 0),
      note: `of ${peso.format(budget.summary?.approvedAmount || 0)} authorized`,
      icon: <Landmark size={16} />,
      tone: "text-neutral-800",
    },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card, index) => (
          <m.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionTransition.productive, delay: index * 0.04 }}
            className="rounded-[10px] border border-border bg-card p-4 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]"
          >
            <div
              className={`flex items-center gap-2 text-[9.5px] uppercase tracking-wider ${card.tone}`}
            >
              {card.icon}
              {card.label}
            </div>
            <div className="mt-2 text-right text-[20px] font-semibold tabular-nums text-foreground">
              {card.value}
            </div>
            <p className="mt-1 text-[9.5px] text-neutral-500">{card.note}</p>
          </m.div>
        ))}
      </div>
      <AttentionBox
        type="primary"
        title="Balanced, traceable posting"
        text="Cash and cheque releases automatically debit member advances and credit cash. Approved liquidations debit expense and returned cash, then clear the advance in one balanced journal entry."
      />
      <AccountingSettlementQueue data={budget} onChanged={budget.refresh} />
      <div className="rounded-[10px] border border-border bg-card p-5 shadow-[0_4px_6px_-4px_rgba(0,0,0,0.10)]">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-emerald-700" />
          <h2 className="text-[12px] font-semibold">Authority boundary</h2>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
          Accounting Staff can record releases, verify settlement evidence, post
          balanced corrections, and read office ledgers. They cannot approve
          funding requests, manage users outside their office, or access
          system administration.
        </p>
      </div>
    </div>
  );
}
