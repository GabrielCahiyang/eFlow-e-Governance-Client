import { budgetRouteViews } from '../navigation';
export type BudgetView = typeof budgetRouteViews[number];
export const budgetViewGroups: { label: string; views: { id: BudgetView; label: string }[] }[] = [
  { label: 'Budget position', views: [{ id: 'overview', label: 'Overview' }] },
  { label: 'Planning & Allocation', views: [{ id: 'annual', label: 'Annual Budget' }, { id: 'funding', label: 'Proposal & Task Funding' }] },
  { label: 'Requests & Settlement', views: [{ id: 'approvals', label: 'Funding Requests' }, { id: 'releases', label: 'Releases & Settlement' }, { id: 'expenses', label: 'Expenses' }, { id: 'vouchers', label: 'Petty Cash Vouchers' }] },
  { label: 'Ledger & Audit', views: [{ id: 'journal', label: 'General Journal' }, { id: 'audit', label: 'Accounting Trail' }] },
];
/** Display selection only. Child workflow handlers retain all eligibility checks. */
export function readBudgetView(value: string | null): BudgetView | null {
  return budgetRouteViews.some(view => view === value) ? value as BudgetView : null;
}
