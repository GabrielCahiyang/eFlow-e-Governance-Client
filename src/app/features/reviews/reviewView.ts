import { reviewRouteViews } from '../navigation';
import { canOpenBudgetReviewWorkspace, getInitialReviewWorkspaceKind } from './selectors';

export type ReviewKind = typeof reviewRouteViews[number];
export function canOpenMembershipReview(scope: 'department' | 'leading', role?: string): boolean {
  return scope === 'department' && role === 'head';
}
/** A display preference never grants review authority. */
export function resolveReviewView(view: string | null, scope: 'department' | 'leading', role?: string): ReviewKind {
  if (view === 'membership' && !canOpenMembershipReview(scope, role)) return getInitialReviewWorkspaceKind(scope);
  if (view === 'budget' && !canOpenBudgetReviewWorkspace(scope, role)) return getInitialReviewWorkspaceKind(scope);
  return reviewRouteViews.some(kind => kind === view) ? view as ReviewKind : getInitialReviewWorkspaceKind(scope);
}
