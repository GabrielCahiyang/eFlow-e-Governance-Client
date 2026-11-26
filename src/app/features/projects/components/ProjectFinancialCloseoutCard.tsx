import { CheckCircle2, Coins, Loader2, ShieldAlert } from "lucide-react";
import { formatPeso, toCentavos } from "../../../shared/currency";
import { formatManilaDateTime } from "../../../shared/calendarDisplay";
import type { ProjectFinancialCloseoutSummary } from "../../project-setup";

export function ProjectFinancialCloseoutCard({
  summary,
  loading = false,
  error = "",
  mode = "archive",
}: {
  summary?: ProjectFinancialCloseoutSummary | null;
  loading?: boolean;
  error?: string;
  mode?: "completion" | "archive" | "overview";
}) {
  if (loading) {
    return (
      <section
        aria-label="Project financial closeout record"
        className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4 text-xs text-neutral-600"
      >
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-neutral-500" aria-hidden="true" />
          <span>Loading financial closeout summary…</span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        role="alert"
        aria-label="Project financial closeout record"
        className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700"
      >
        {error}
      </section>
    );
  }

  if (!summary) return null;

  const hasSupplemental = toCentavos(summary.supplementalBudgetAdded) > 0;
  const hasUnreturned = toCentavos(summary.unreturnedBalance) > 0;
  const hasTaskAdvances =
    toCentavos(summary.taskCashReleased) > 0 || toCentavos(summary.taskCashReturned) > 0;

  const heading =
    mode === "completion"
      ? "Financial closeout record (to be sealed at completion)"
      : mode === "archive"
        ? "Financial closeout record (preserved in archive)"
        : "Financial closeout summary";

  return (
    <section
      aria-label="Project financial closeout record"
      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold tracking-tight text-neutral-900">
          <Coins size={15} className="text-[var(--eflow-primary,#00006b)]" aria-hidden="true" />
          <span>{heading}</span>
        </div>
        {summary.fundingNotRequired && toCentavos(summary.totalCertifiedBudget) === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700">
            No Office Budget required
          </span>
        ) : hasUnreturned ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
            <ShieldAlert size={12} aria-hidden="true" />
            {formatPeso(summary.unreturnedBalance)} unreturned
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            <CheckCircle2 size={12} aria-hidden="true" />
            Reconciled · ₱0.00 unreturned
          </span>
        )}
      </div>

      {summary.fundingNotRequired && toCentavos(summary.totalCertifiedBudget) === 0 ? (
        <p className="text-xs text-neutral-600">
          This project operated without Office Budget funding. No project funds were committed, spent, or returned.
        </p>
      ) : (
        <>
          <div
            className={`grid grid-cols-1 gap-2.5 ${
              hasSupplemental ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-neutral-500">Budget before activation</div>
              <div className="mt-1 text-base font-bold tabular-nums text-neutral-950">
                {formatPeso(summary.budgetBeforeActivation)}
              </div>
            </div>

            {hasSupplemental && (
              <div className="rounded-lg border border-blue-200/80 bg-blue-50/50 px-3 py-2.5">
                <div className="text-[11px] font-medium text-blue-700">Supplemental added</div>
                <div className="mt-1 text-base font-bold tabular-nums text-blue-950">
                  +{formatPeso(summary.supplementalBudgetAdded)}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-neutral-200/80 bg-neutral-50/70 px-3 py-2.5">
              <div className="text-[11px] font-medium text-neutral-500">Actual money spent</div>
              <div className="mt-1 text-base font-bold tabular-nums text-neutral-950">
                {formatPeso(summary.actualSpent)}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5">
              <div className="text-[11px] font-medium text-emerald-800">Returned before completion</div>
              <div className="mt-1 text-base font-bold tabular-nums text-emerald-950">
                {formatPeso(summary.returnedToOfficeBudget)}
              </div>
            </div>
          </div>

          {summary.sources.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-neutral-200/80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50/80 text-[11px] font-semibold text-neutral-500">
                    <th className="px-3 py-2">Funding source</th>
                    <th className="px-3 py-2 text-right">Before activation</th>
                    <th className="px-3 py-2 text-right">Actual spent</th>
                    <th className="px-3 py-2 text-right">Returned to Office</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {summary.sources.map((src) => (
                    <tr key={src.sourceId}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-neutral-900">
                          {src.name}{" "}
                          <span className="font-normal text-neutral-500">· FY {src.fiscalYear}</span>
                        </div>
                        {src.lastReturnedAt && toCentavos(src.returnedToOfficeBudget) > 0 && (
                          <div className="text-[10.5px] text-neutral-500">
                            Returned {formatManilaDateTime(src.lastReturnedAt, "")}
                            {src.lastReturnedByName ? ` by ${src.lastReturnedByName}` : ""}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-800">
                        <div>{formatPeso(src.budgetBeforeActivation)}</div>
                        {toCentavos(src.supplementalAdded) > 0 && (
                          <div className="text-[10.5px] text-blue-700">
                            +{formatPeso(src.supplementalAdded)} added
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-neutral-900">
                        {formatPeso(src.actualSpent)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-800">
                        {formatPeso(src.returnedToOfficeBudget)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasTaskAdvances && (
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Task cash advances settled: <strong className="tabular-nums text-neutral-700">{formatPeso(summary.taskCashReleased)}</strong> released ·{" "}
              <strong className="tabular-nums text-neutral-700">{formatPeso(summary.actualSpent)}</strong> verified expenses ·{" "}
              <strong className="tabular-nums text-neutral-700">{formatPeso(summary.taskCashReturned)}</strong> unused task cash returned at Accounting settlement (already folded into the project balance returned above).
            </p>
          )}
        </>
      )}

      {(summary.activatedAt || summary.completedAt || summary.archivedAt) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 pt-2 text-[11px] text-neutral-500">
          {summary.activatedAt && (
            <span>Activated: <strong className="font-medium text-neutral-700">{formatManilaDateTime(summary.activatedAt, "—")}</strong></span>
          )}
          {summary.completedAt && (
            <span>Completed: <strong className="font-medium text-neutral-700">{formatManilaDateTime(summary.completedAt, "—")}</strong></span>
          )}
          {summary.archivedAt && (
            <span>Archived: <strong className="font-medium text-neutral-700">{formatManilaDateTime(summary.archivedAt, "—")}</strong></span>
          )}
        </div>
      )}
    </section>
  );
}
