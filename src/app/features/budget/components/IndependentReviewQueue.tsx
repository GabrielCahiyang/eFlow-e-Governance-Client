import { useAuth } from '../../../contexts/AuthContext';
import { useIndependentReviews } from '../hooks/useIndependentReviews';
import type { DepartmentBudgetBundle } from '../types';
import { IndependentReviewPackageCard } from './IndependentReviewPackageCard';

export function IndependentReviewQueue({ data, onChanged }: { data: DepartmentBudgetBundle; onChanged: () => Promise<void> }) {
  const { userProfile } = useAuth();
  const independent = useIndependentReviews(data);
  // The context RPC enforces the current Office appointment. A role label alone
  // never grants decision authority; assigned reviewers are rechecked in SQL.
  if (userProfile?.role === 'accounting_staff') return null;
  const items = data.liquidations.filter(item => item.status === 'pending_department_settlement' && independent.contexts[item.id]?.required);
  return <section aria-label="Independent financial reviews" className="space-y-3">
    {Object.values(independent.errors).length > 0 && <p role="status" className="rounded-lg border border-amber-300 p-3 text-sm">Independent reviews could not be verified. <button className="underline" onClick={() => void independent.refresh()}>Retry independent reviews</button></p>}
    {items.map(item => <IndependentReviewPackageCard key={item.id} item={item} request={data.requests.find(candidate => candidate.id === item.requestId)} context={independent.contexts[item.id]} onChanged={async () => { await independent.refresh(); await onChanged(); }} />)}
  </section>;
}
