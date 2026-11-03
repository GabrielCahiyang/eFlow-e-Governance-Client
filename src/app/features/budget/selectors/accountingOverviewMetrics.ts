import type { DepartmentBudgetBundle } from "../types";
import { sectionLeaves } from "./budgetSections";

/** Read-only summaries: active leaf accounts and actual released cash only. */
export function accountingOverviewMetrics(
  budget: DepartmentBudgetBundle,
  now = Date.now(),
) {
  const accounts = sectionLeaves(budget.sections || []);
  const scheduled = accounts.flatMap((account) =>
    (account.releaseSchedule || [])
      .filter((release) => release.status === "pending")
      .map((release) => ({ account: account.name, ...release })),
  );
  const released = budget.releases
    .filter((r) => r.status === "released")
    .reduce((sum, r) => sum + r.amount, 0);
  const settled = budget.requests.filter((r) => r.status === "settled");
  const spent = settled.reduce((sum, r) => sum + (r.actualSpent || 0), 0);
  const returned = settled.reduce((sum, r) => sum + (r.returnedAmount || 0), 0);
  const open = budget.requests.filter(
    (r) => (r.releasedAmount || 0) > 0 && r.status !== "settled",
  );
  const ages = [
    { id: "week", label: "Up to 7 days", min: 0, max: 7 },
    { id: "month", label: "8�30 days", min: 8, max: 30 },
    { id: "older", label: "Over 30 days", min: 31, max: Infinity },
  ].map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    value: open
      .filter((request) => {
        const first =
          budget.releases
            .filter(
              (r) => r.requestId === request.id && r.status === "released",
            )
            .map((r) => r.releasedAt || r.createdAt)
            .sort((a, b) => a - b)[0] || request.createdAt;
        const days = Math.max(0, Math.floor((now - first) / 86400000));
        return days >= bucket.min && days <= bucket.max;
      })
      .reduce((sum, r) => sum + (r.releasedAmount || 0), 0),
  }));
  const available = accounts.map((account) => ({
    id: account.id,
    label: account.name,
    authorized: account.amount,
    value: Math.max(
      0,
      account.amount -
        account.heldAmount -
        (account.protectedAmount ??
          Math.max(account.committedAmount || 0, account.spentAmount || 0)),
    ),
  }));
  return {
    released,
    spent,
    returned,
    outstanding: Math.max(0, released - spent - returned),
    open,
    ages,
    available,
    scheduled,
  };
}
