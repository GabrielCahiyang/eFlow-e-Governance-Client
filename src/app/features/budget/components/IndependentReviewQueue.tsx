import { useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useIndependentReviews } from '../hooks/useIndependentReviews';
import type { DepartmentBudgetBundle } from '../types';
import { IndependentReviewPackageCard } from './IndependentReviewPackageCard';

type ReviewQueueProps = { data: DepartmentBudgetBundle; onChanged: () => Promise<void>; focusRecordId?: string };

export function IndependentReviewQueue(props: ReviewQueueProps) {
  const independent = useIndependentReviews(props.data);
  return <IndependentReviewQueueContents {...props} independent={independent} />;
}

export function IndependentReviewQueueContents({ data, onChanged, focusRecordId, independent }: ReviewQueueProps & { independent: ReturnType<typeof useIndependentReviews> }) {
  const { userProfile } = useAuth();
  const focused = independent.contexts[focusRecordId || ''];
  const lastFocus = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!focusRecordId) { lastFocus.current = undefined; return; }
    if (!focused || lastFocus.current === focusRecordId) return;
    const target = document.getElementById(`independent-review-${focusRecordId}`);
    if (target) { target.focus(); lastFocus.current = focusRecordId; }
  }, [focusRecordId, focused]);
  // The context RPC enforces the current Office appointment. A role label alone
  // never grants decision authority; assigned reviewers are rechecked in SQL.
  if (userProfile?.role === 'accounting_staff') return null;
  const items = data.liquidations.filter(item => {
    const context = independent.contexts[item.id];
    return item.status === 'pending_department_settlement' && context && (context.required || context.headAlertStatus === 'notified' || context.headEscalationFingerprint || context.headEscalationApproved);
  });
  const unavailable = Boolean(focusRecordId && !data.liquidations.some(item => item.id === focusRecordId && item.status === 'pending_department_settlement'));
  return <section aria-label="Independent financial reviews" className="space-y-3">
    {items.length > 0 && <h2 className="text-base font-semibold">Independent financial reviews</h2>}
    {unavailable && <p role="status" className="text-sm text-muted-foreground">This liquidation is no longer waiting for settlement in this fiscal year.</p>}
    {Object.values(independent.errors).length > 0 && <p role="status" className="rounded-lg border border-amber-300 p-3 text-sm">Independent reviews could not be verified. <button className="underline" onClick={() => void independent.refresh()}>Retry independent reviews</button></p>}
    {items.map(item => <IndependentReviewPackageCard key={item.id} item={item} request={data.requests.find(candidate => candidate.id === item.requestId)} context={independent.contexts[item.id]} onChanged={async () => { await independent.refresh(); await onChanged(); }} />)}
  </section>;
}
