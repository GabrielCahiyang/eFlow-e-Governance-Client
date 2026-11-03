import { AnalyticsBars, AnalyticsDonut } from "../../analytics";
import { OfficeCashOverview } from "../../office-petty-cash";
import type { DepartmentBudgetBundle } from "../types";
import { peso } from "./budgetUi";
import { accountingOverviewMetrics } from "../selectors/accountingOverviewMetrics";
export function AccountingAnalytics({
  budget,
  onReleases,
  onSettlements,
  onBudgets,
}: {
  budget: DepartmentBudgetBundle & { error?: string };
  onReleases?: () => void;
  onSettlements?: () => void;
  onBudgets?: () => void;
}) {
  const { spent, returned, outstanding, open, ages, available, scheduled } =
    accountingOverviewMetrics(budget);
  const confirmations = scheduled.length;
  const cards = [
    {
      label: "Requests awaiting a decision",
      value: budget.requests.filter((r) =>
        [
          "pending",
          "pending_leader_review",
          "pending_department_approval",
        ].includes(r.status),
      ).length,
      click: onReleases,
    },
    {
      label: "Cash awaiting receipt",
      value: budget.releases.filter(
        (r) => r.status === "released" && !r.acknowledgedAt,
      ).length,
      click: onReleases,
    },
    {
      label: "Overdue liquidations",
      value: open.filter(
        (r) => r.liquidationDueAt && r.liquidationDueAt < Date.now(),
      ).length,
      click: onSettlements,
    },
    {
      label: "Budget releases to confirm",
      value: confirmations,
      click: onBudgets,
    },
  ];
  return (
    <div className="ea-workspace">
      <div className="ea-metrics">
        {cards.map((card) => (
          <button
            type="button"
            key={card.label}
            disabled={!!budget.error || !card.click}
            onClick={card.click}
          >
            <span>{card.label}</span>
            <strong>{budget.error ? "—" : card.value}</strong>
          </button>
        ))}
      </div>
      {!budget.error && (
        <div className="ea-grid">
          <AnalyticsDonut
            title="Released cash breakdown"
            items={[
              { id: "spent", label: "Settled spending", value: spent },
              { id: "returned", label: "Returned cash", value: returned },
              {
                id: "outstanding",
                label: "Outstanding advances",
                value: outstanding,
              },
            ]}
            onSelect={() => onSettlements?.()}
          />
          <AnalyticsBars
            title="Outstanding advances by age"
            unit="PHP"
            items={ages}
            onSelect={() => onSettlements?.()}
          />
          <AnalyticsBars
            title="Available budget by account"
            unit="PHP"
            items={available.map((account) => ({
              ...account,
              secondary: `${peso.format(account.authorized)} authorized`,
            }))}
            onSelect={() => onBudgets?.()}
          />
          <section className="ea-panel">
            <h2>Scheduled budget availability</h2>
            {scheduled.map((release) => (
              <p key={release.id}>
                <strong>{release.account}</strong>
                <span className="ea-help">
                  {" "}
                  � {release.date} � {peso.format(release.amount)} � Accounting
                  confirmation needed
                </span>
              </p>
            ))}
            {!confirmations && (
              <p className="ea-empty">No budget releases await confirmation.</p>
            )}
            <p className="ea-help">
              A budget confirmation makes funds available. Physical cash release
              remains a separate action.
            </p>
          </section>
        </div>
      )}
      <OfficeCashOverview />
    </div>
  );
}
