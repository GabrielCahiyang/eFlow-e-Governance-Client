import { useRef, useState } from 'react';
import { ShieldCheck, UserRoundCheck, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { formatManilaInstant } from '../../../shared/calendarDisplay';
import { financialErrorMessage, financialFailureIsUncertain } from '../financialReceipts';
import { decideIndependentReview, getIndependentReview, routeIndependentReview, type IndependentReviewContext } from '../services/independentReviewService';

export function IndependentReviewCard({ id, version, context, error, onChanged }: {
  id: string; version: number; context?: IndependentReviewContext; error?: string; onChanged: () => Promise<void>;
}) {
  const { userProfile } = useAuth();
  const [reviewer, setReviewer] = useState(''), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [uncertain, setUncertain] = useState(false);
  const pending = useRef(false);
  const confirmation = useConfirmation();
  const draft = useExplicitDraft('Independent liquidation review', Boolean(reason.trim()), busy, () => { setReason(''); setReviewer(''); });
  const verify = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const fresh = await getIndependentReview(id);
      const key = `eflow:independent-review:${userProfile?.id}:${id}:${version}`;
      const saved = sessionStorage.getItem(key);
      const attempt = saved ? JSON.parse(saved) as { payload: string; key: string; outcome: string } : null;
      if (attempt?.outcome === 'uncertain') {
        const [, attemptedVersion, attemptedReviewer, attemptedReason, attemptedDecision] = JSON.parse(attempt.payload);
        const confirmed = fresh.version === attemptedVersion && !!fresh.review && (attemptedDecision
          ? fresh.review.status === attemptedDecision && fresh.review.decision_reason === attemptedReason
          : fresh.review.reviewer_id === attemptedReviewer && fresh.review.route_reason === attemptedReason);
        if (confirmed) {
          sessionStorage.setItem(key, JSON.stringify({ ...attempt, outcome: 'saved' }));
          draft.markClean(); setReason(''); setUncertain(false); setMessage('The saved review outcome is confirmed from current records.');
        } else { setUncertain(true); setMessage('The earlier outcome is not confirmed. Keep this request identity and verify with Accounting before changing the decision.'); }
      } else { setMessage('Current review refreshed.'); setUncertain(false); }
      await onChanged();
    }
    catch (caught) { setMessage(financialErrorMessage(caught)); }
    finally { pending.current = false; setBusy(false); }
  };
  const run = async (decision?: 'approved' | 'changes_requested' | 'rejected') => {
    if (!context || pending.current || uncertain || !reason.trim() || (!decision && !reviewer)) return;
    pending.current = true; draft.pendingRef.current = true; setBusy(true); setMessage('');
    const payload = JSON.stringify([id, version, reviewer, reason.trim(), decision]);
    const key = `eflow:independent-review:${userProfile?.id}:${id}:${version}`;
    try {
      const previous = sessionStorage.getItem(key);
      const attempt = previous ? JSON.parse(previous) as { payload: string; key: string; outcome: string } : null;
      if (attempt && attempt.payload !== payload && attempt.outcome === 'uncertain') throw new Error('An earlier review has an uncertain outcome. Verify its decision before changing details.');
      const command = attempt?.payload === payload ? attempt.key : crypto.randomUUID();
      if (!await confirmation.confirm({ title: decision ? 'Record independent review?' : 'Route independent review?', description: `${reason.trim()} Review approval does not settle cash or post a journal.`, actionLabel: decision ? 'Record review' : 'Send to reviewer' })) return;
      const fresh = await getIndependentReview(id);
      if (fresh.version !== version || JSON.stringify(fresh) !== JSON.stringify(context)) { await onChanged(); throw new Error('The review changed. Check the current package before deciding.'); }
      sessionStorage.setItem(key, JSON.stringify({ payload, key: command, outcome: 'uncertain' }));
      try {
        if (decision) await decideIndependentReview(id, version, decision, reason.trim(), command);
        else await routeIndependentReview(id, version, reviewer, reason.trim(), command);
      } catch (caught) {
        if (financialFailureIsUncertain(caught)) setUncertain(true);
        else sessionStorage.removeItem(key);
        throw caught;
      }
      sessionStorage.setItem(key, JSON.stringify({ payload, key: command, outcome: 'saved' }));
      draft.markClean(); setReason(''); setMessage('Independent review saved. Accounting settlement remains separate.');
      await onChanged();
    } catch (caught) { setMessage(financialErrorMessage(caught)); }
    finally { pending.current = false; draft.pendingRef.current = false; setBusy(false); }
  };
  if (error) return <div className="mt-3 rounded-lg border border-amber-300 p-3 text-sm" role="status">Independent review unavailable: {error}<Button variant="outline" onClick={() => void verify()} disabled={busy}><RefreshCw size={14} /> Retry review check</Button></div>;
  if (!context) return <p role="status" className="mt-3 text-sm">Checking independent review…</p>;
  if (!context.required) return null;
  const approved = context.current && context.review?.status === 'approved';
  const canDecide = context.canReview && context.current && context.review?.status === 'pending';
  const canRoute = !approved && !canDecide && context.candidates.length > 0;
  return <section className="mt-3 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4 text-sm" aria-label="Independent liquidation review">
    {confirmation.dialog}
    <h4 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> Independent leadership review</h4>
    <p>{approved ? 'Approved for separate Accounting settlement.' : context.review?.status === 'pending' && context.current ? `Waiting for ${context.candidates.find(candidate => candidate.id === context.review?.reviewer_id)?.name || 'the assigned reviewer'}.` : 'An independent appointed leadership reviewer must review this package.'}</p>
    {context.review && <details className="rounded-lg border border-primary/20 p-3"><summary className="cursor-pointer font-medium">Review record · version {version}</summary><dl className="mt-3 space-y-2">
      <div><dt className="text-muted-foreground">Reviewer</dt><dd>{context.candidates.find(candidate => candidate.id === context.review?.reviewer_id)?.name || 'Previous appointed reviewer'}</dd></div>
      <div><dt className="text-muted-foreground">Status</dt><dd>{context.review.status.replace(/_/g, ' ')}{context.review.decided_at ? ` · ${formatManilaInstant(context.review.decided_at)}` : ''}</dd></div>
      <div><dt className="text-muted-foreground">Routing reason</dt><dd className="break-words">{context.review.route_reason}</dd></div>
      {context.review.decision_reason && <div><dt className="text-muted-foreground">Review note</dt><dd className="break-words">{context.review.decision_reason}</dd></div>}
    </dl></details>}
    {context.escalationRequired && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">Escalation required: {context.candidates.length === 0 ? 'no independent appointed reviewer is available. ' : ''}{context.eligibleSettlers === 0 ? 'No separate eligible Accounting Officer is available to settle and post. ' : ''}Ask your administrator to resolve the appointment or Accounting assignment. No self-approval or delegated posting is allowed.</p>}
    {(canDecide || canRoute) && <>
      {canRoute && <label className="block">Independent reviewer<select className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={reviewer} disabled={busy || uncertain} onChange={event => setReviewer(event.target.value)}><option value="">Choose leadership reviewer</option>{context.candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.appointment}</option>)}</select></label>}
      <label className="block">{canDecide ? 'Review findings' : 'Routing reason'}<textarea rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-border bg-background p-2" value={reason} disabled={busy || uncertain} onChange={event => setReason(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">{canDecide ? <><Button disabled={busy || uncertain || !reason.trim()} onClick={() => void run('approved')}><UserRoundCheck size={15} /> Approve review</Button><Button variant="outline" disabled={busy || uncertain || !reason.trim()} onClick={() => void run('changes_requested')}>Request changes</Button><Button variant="outline" disabled={busy || uncertain || !reason.trim()} onClick={() => void run('rejected')}>Reject package</Button></> : <Button disabled={busy || uncertain || !reviewer || !reason.trim()} onClick={() => void run()}>Send for independent review</Button>}</div>
    </>}
    {message && <p role="status" className="break-words">{message}</p>}
    <Button variant="outline" disabled={busy} onClick={() => void verify()}><RefreshCw size={14} /> {uncertain ? 'Verify review outcome' : 'Refresh review'}</Button>
  </section>;
}
