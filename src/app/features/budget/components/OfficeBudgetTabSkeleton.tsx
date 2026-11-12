import { Landmark } from 'lucide-react';
import { WorkspaceLoadingSkeleton } from '../../../components/workflow/WorkspaceLoadingSkeleton';
import type { BudgetView } from '../budgetViews';
import { BudgetExpensesReportSkeleton } from './BudgetExpensesReport';
import { JournalTableSkeleton } from './GeneralJournalWorkspace';

export function OfficeBudgetTabSkeleton({
  tab = "overview",
  label = "Loading the office ledger…",
}: {
  tab?: BudgetView;
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
            <div key={cardLabel} className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-2">
              <div className="text-[14px] uppercase tracking-wider text-neutral-500">{cardLabel}</div>
              <div className="ml-auto h-6 w-28 animate-pulse rounded bg-secondary" />
              <div className="ml-auto h-3 w-36 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-hidden="true">
          <div className="border-b border-border p-4 flex flex-wrap gap-2">
            <div className="h-9 flex-1 min-w-[200px] animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-36 animate-pulse rounded-lg bg-muted" />
          </div>
          <JournalTableSkeleton label={label} />
        </section>
      </WorkspaceLoadingSkeleton>
    );
  }
  if (tab === 'annual' || tab === 'funding' || tab === 'office-petty-cash' || tab === 'vouchers' || tab === 'audit') {
    return (
      <WorkspaceLoadingSkeleton label={label} className="space-y-4">
        <section aria-hidden="true" className="overflow-hidden rounded-[10px] border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="h-4 w-44 animate-pulse rounded bg-secondary" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
          </div>
          {tab === 'annual' || tab === 'funding' ? (
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {[0, 1, 2].map(field => <div key={field} className="space-y-2"><div className="h-3 w-24 animate-pulse rounded bg-secondary" /><div className="h-10 animate-pulse rounded-lg bg-muted" /></div>)}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[0, 1, 2, 3].map(row => <div key={row} className="flex items-center justify-between gap-3 p-4"><div className="h-4 w-40 animate-pulse rounded bg-secondary" /><div className="h-4 w-24 animate-pulse rounded bg-muted" /></div>)}
            </div>
          )}
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
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <header className="flex items-center justify-between border-b border-border p-4">
              <div className="space-y-1.5">
                <div className="h-4 w-48 animate-pulse rounded bg-secondary" />
                <div className="h-3 w-72 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-24 animate-pulse rounded-full bg-secondary" />
            </header>
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div className="space-y-2">
                    <div className="h-3.5 w-52 animate-pulse rounded bg-secondary" />
                    <div className="h-3 w-64 animate-pulse rounded bg-muted" />
                    <div className="flex gap-2 pt-1">
                      <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                      <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
                    <div className="h-8 w-28 animate-pulse rounded-lg bg-secondary" />
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
            <div className="ml-auto h-9 w-44 animate-pulse rounded-md bg-secondary" />
            <div className="ml-auto h-3 w-64 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-3 gap-3 border-t border-primary/15 pt-4">
              {["Annual authority", "Committed", "Actual spending"].map((item) => (
                <div key={item} className="space-y-1.5 text-right">
                  <div className="text-[13px] text-muted-foreground">{item}</div>
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-secondary" />
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
                  <div className="h-3 w-56 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-24 animate-pulse rounded bg-secondary" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section aria-hidden="true" className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-52 animate-pulse rounded bg-secondary" />
          <div className="flex gap-2">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
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
                          col === 0 ? "w-44 bg-secondary" : "ml-auto w-20 bg-muted"
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
