import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { useNotificationNavigationIntent } from '../../notifications';
import { Button } from '../../../components/ui/button';
import { financialErrorMessage } from '../financialReceipts';
import { requestNavigation } from '../../../shared/navigationGuard';
import { getAssignedIndependentReviews, type IndependentReviewPackage } from '../services/independentReviewService';
import { IndependentReviewPackageCard } from './IndependentReviewPackageCard';

/** Shared Inbox entrance for assigned appointments, including Member accounts. */
export function AssignedIndependentReviews({ onPendingChange }: { onPendingChange?: (count: number) => void }) {
  const { userProfile } = useAuth();
  const { orgs } = useOrgs();
  const office = orgs.find(org => org.id === userProfile?.org_id && org.is_active);
  const eligible = Boolean(userProfile?.is_active && userProfile.role !== 'admin' && office && (office.assistant_head_user_id === userProfile.id || userProfile.role === 'head' && office.head_user_id === userProfile.id));
  const scope = `${userProfile?.id}:${userProfile?.org_id}:${eligible}`;
  const latestScope = useRef(scope); latestScope.current = scope;
  const generation = useRef(0);
  const [state, setState] = useState<{ scope: string; rows: IndependentReviewPackage[]; error: string; loading: boolean }>({ scope: '', rows: [], error: '', loading: false });
  const [notice, setNotice] = useState('');
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!eligible || !userProfile?.id) return;
    setState(previous => ({ scope, rows: previous.scope === scope ? previous.rows : [], error: '', loading: true }));
    try {
      const rows = await getAssignedIndependentReviews(userProfile.id);
      if (request === generation.current && scope === latestScope.current) setState({ scope, rows, error: '', loading: false });
    } catch (caught) { if (request === generation.current && scope === latestScope.current) setState({ scope, rows: [], error: financialErrorMessage(caught), loading: false }); }
  }, [scope]);
  useEffect(() => { setNotice(''); void refresh(); return () => { ++generation.current; }; }, [refresh]);
  const current = state.scope === scope ? state : { rows: [], error: '', loading: eligible };
  useEffect(() => { onPendingChange?.(eligible ? current.rows.length : 0); }, [eligible, current.rows.length, onPendingChange]);
  useNotificationNavigationIntent(intent => intent.financialRecordType === 'independent_liquidation_review', intent => {
    if (!eligible || current.error) return 'unavailable';
    if (current.loading) return false;
    if (!current.rows.some(row => row.liquidation.id === intent.financialRecordId)) { setNotice('This financial review is no longer assigned or available under your current appointment.'); return 'unavailable'; }
    document.getElementById(`independent-review-${intent.financialRecordId}`)?.focus(); return true;
  }, [scope, current.rows, current.loading, current.error]);
  if (!eligible || !current.rows.length && !current.error && !notice) return null;
  return <section aria-label="Assigned independent financial reviews" className="space-y-3">
    <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Independent financial reviews</h2><Button variant="outline" disabled={current.loading} onClick={() => { void requestNavigation(() => refresh()); }}>Refresh assigned reviews</Button></header>
    <p className="text-sm text-muted-foreground">Your appointed review work. Approval does not settle cash or grant permission to post journals.</p>
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {current.error && <p role="alert" className="rounded-lg border border-amber-300 p-3 text-sm">Assigned reviews unavailable: {current.error}</p>}
    {current.rows.map(row => <IndependentReviewPackageCard key={row.liquidation.id} item={row.liquidation} request={row.request} context={row.context} onChanged={async () => { await refresh(); setNotice('Review recorded. Current assignments refreshed.'); }} />)}
  </section>;
}
