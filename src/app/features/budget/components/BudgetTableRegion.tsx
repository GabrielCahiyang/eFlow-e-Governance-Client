import type { ReactNode } from 'react';

/** Keeps wide financial tables scrollable and reachable by keyboard. */
export function BudgetTableRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div className="eflow-budget-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}
