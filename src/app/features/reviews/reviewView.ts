import { reviewRouteViews } from '../navigation';
import { canOpenBudgetReviewWorkspace, getInitialReviewWorkspaceKind } from './selectors';

export type ReviewKind = typeof reviewRouteViews[number];
export function canOpenMembershipReview(_scope: 'department' | 'leading', _role?: string): boolean {
  return false;
}
/** A display preference never grants review authority. */
export function resolveReviewView(view: string | null, scope: 'department' | 'leading', role?: string): ReviewKind {
  if (view === 'budget' && canOpenBudgetReviewWorkspace(scope, role)) return 'budget';
  if (view === 'clearance') return 'clearance';
  if (view === 'subtasks') return 'subtasks';
  if (view === 'tasks') return 'tasks';
  return getInitialReviewWorkspaceKind(scope);
}
