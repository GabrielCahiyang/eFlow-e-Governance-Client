import { useId, useRef, useState } from 'react';
import { ShieldCheck, UserRoundCheck, RefreshCw } from 'lucide-react';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { DecisionModal } from '../../../components/ui/DecisionModal';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { useToast } from '../../../components/ui/Toast';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { Button } from '../../../components/ui/button';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import { formatManilaInstant } from '../../../shared/calendarDisplay';
import { textLengthError } from '../../../shared/inputLimits';
import { financialErrorMessage, financialFailureIsUncertain, financialWriteFeedback } from '../financialReceipts';
import { approveStaffingEscalation, decideIndependentReview, getIndependentReview, routeIndependentReview, type IndependentReviewContext } from '../services/independentReviewService';
import { fetchCashReturnClearance } from '../services/workFinancialClearanceService';

type ReviewDecision = 'approved' | 'changes_requested' | 'rejected' | 'approve_escalation';

export function IndependentReviewCard({ id, version, returnedAmount, context, error, onChanged, submittedByAccountingRequester }: {
  id: string; version: number; returnedAmount?: number; context?: IndependentReviewContext; error?: string; onChanged: () => Promise<void>;
  submittedByAccountingRequester?: boolean;
}) {
  const { userProfile } = useAuth();
  const {toast}=useToast();
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [reviewer, setReviewer] = useState(''), [reason, setReason] = useState('');
  const [reviewerTouched, setReviewerTouched] = useState(false);
  const [reviewerActive, setReviewerActive] = useState(false);
  const [routingReasonTouched, setRoutingReasonTouched] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [uncertain, setUncertain] = useState(false);
  const reviewerRef = useRef<HTMLSelectElement | null>(null);
  const reviewerId = useId();
  const reviewerTipId = useId();
  const routingReasonId = useId();
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
        const confirmed = fresh.version === attemptedVersion && (attemptedDecision === 'approve_escalation'
          ? fresh.headEscalationCommandId === attempt.key || (fresh.headSettlementPosted && fresh.headEscalationApproved)
          : !!fresh.review && (attemptedDecision
          ? fresh.review.status === attemptedDecision && fresh.review.decision_reason === attemptedReason
          : fresh.review.reviewer_id === attemptedReviewer && fresh.review.route_reason === attemptedReason));
        if (confirmed) {
          sessionStorage.setItem(key, JSON.stringify({ ...attempt, outcome: 'saved' }));
          draft.markClean(); setReason(''); setUncertain(false); setMessage('The saved review outcome is confirmed from current records.');
        } else { setUncertain(true); setMessage("We couldn't confirm the earlier decision. Keep this review open and check with Accounting before making another decision."); }
      } else { setMessage('Current review refreshed.'); setUncertain(false); }
      await onChanged();
    }
    catch (caught) { setMessage(financialErrorMessage(caught, 'We couldn’t check the current review. Reload its record before continuing.', 'read')); }
    finally { pending.current = false; setBusy(false); }
  };
  const run = async (decision?: ReviewDecision, takeReview = false) => {
    const selectedReviewer = takeReview ? userProfile?.id : reviewer;
    const findings = takeReview ? 'Office Head accepted the independent review.' : reason.trim();
    if (!context || pending.current || uncertain || !findings || (!decision && !selectedReviewer)) return;
    pending.current = true; draft.pendingRef.current = true; setBusy(true); setMessage('');
    const payload = JSON.stringify([id, version, selectedReviewer, findings, decision]);
    const key = `eflow:independent-review:${userProfile?.id}:${id}:${version}`;
    let submitted = false;
    let unconfirmed = false;
    let saved = false;
    try {
      const previous = sessionStorage.getItem(key);
      const attempt = previous ? JSON.parse(previous) as { payload: string; key: string; outcome: string } : null;
      if (attempt && attempt.payload !== payload && attempt.outcome === 'uncertain') {
        unconfirmed = true;
        setUncertain(true);
        throw new Error('An earlier review has an uncertain outcome.');
      }
      const command = attempt?.payload === payload ? attempt.key : crypto.randomUUID();
      if (!decision && !await confirmation.confirm({ title: takeReview ? 'Take this review?' : 'Route independent review?', description: `${findings} Review approval does not settle cash or post a journal.`, actionLabel: takeReview ? 'Yes, take review' : 'Yes, send to reviewer', tone:'approve' })) return;
      const fresh = await getIndependentReview(id);
      if (fresh.version !== version || JSON.stringify(fresh) !== JSON.stringify(context)) { await onChanged(); throw new Error('The review changed. Check the current package before deciding.'); }
      sessionStorage.setItem(key, JSON.stringify({ payload, key: command, outcome: 'uncertain' }));
      try {
        if (decision === 'approve_escalation') {
          if (!fresh.headEscalationFingerprint) throw new Error('This escalation is no longer awaiting your approval.');
          if (fresh.headCanPostSettlement && (returnedAmount ?? 0) > 0 && !(await fetchCashReturnClearance(id)).approved) {
            throw new Error('Verify physical receipt of the unused cash return before posting settlement.');
          }
          submitted = true;
          await approveStaffingEscalation(id, version, fresh.headEscalationFingerprint, findings, command);
        } else {
          submitted = true;
          if (decision) await decideIndependentReview(id, version, decision, findings, command);
          else await routeIndependentReview(id, version, selectedReviewer!, findings, command);
        }
      } catch (caught) {
        unconfirmed = submitted && financialFailureIsUncertain(caught);
        if (unconfirmed) setUncertain(true);
        else sessionStorage.removeItem(key);
        throw caught;
      }
      saved = true;
      sessionStorage.setItem(key, JSON.stringify({ payload, key: command, outcome: 'saved' }));
      draft.markClean(); setReason(''); setDecision(null); setMessage('');
      toast(decision === 'approve_escalation'
        ? fresh.headCanPostSettlement ? 'Settlement approved and posted.' : 'Approved. Waiting for Accounting settlement.'
        : 'Independent review saved. Accounting settlement remains separate.', decision === 'changes_requested' || decision === 'rejected' ? 'warning' : 'success');
      try { await onChanged(); } catch { toast('Review saved. Could not load the latest status.', 'warning'); }
    } catch (caught) {
      setMessage(financialWriteFeedback(caught, {
        outcome: saved ? 'saved' : unconfirmed ? 'uncertain' : undefined,
        submitted, action: decision ? 'Your review decision' : 'Your reviewer selection', record: 'the current review',
      }));
    }
    finally { pending.current = false; draft.pendingRef.current = false; setBusy(false); }
  };
  if (error) return <div className="mt-3 rounded-lg border border-amber-300 p-3 text-sm" role="status">Independent review unavailable: {error}<Button variant="outline" onClick={() => void verify()} disabled={busy}><RefreshCw size={14} /> Retry review check</Button></div>;
  if (!context) return <p role="status" className="mt-3 text-sm">Checking independent review…</p>;
  const canApproveEscalation = Boolean(context.headEscalationFingerprint);
  const canPostAsHead = context.headCanPostSettlement === true;
  const settlementBlocked = context.eligibleSettlers === 0;
  const showEscalation = settlementBlocked || canApproveEscalation || context.headEscalationApproved;
  const escalationHeading = canPostAsHead ? 'Head settlement required' : context.headEscalationApproved ? 'Head review approved · settlement pending'
    : context.headAlertStatus === 'notified' || canApproveEscalation ? 'Automatically escalated to the Head'
    : context.headAlertStatus === 'pending' ? 'Head notification pending'
    : context.headAlertStatus === 'no_head' ? 'No office Head appointed'
    : 'Settlement on hold';
  const escalationReason = settlementBlocked
    ? submittedByAccountingRequester
      ? 'The Accounting Officer who submitted this liquidation can’t settle their own request. No other eligible officer is available.'
      : 'No eligible Accounting Officer is available. Staff can’t settle cash they requested, received, or reviewed.'
    : context.headEscalationApproved ? 'Ready for separate Accounting settlement.'
    : 'No eligible Accounting Officer was available when this liquidation was escalated.';
  if (!showEscalation && !context.required && !uncertain) return null;
  const approved = context.headEscalationApproved || (context.current && context.review?.status === 'approved');
  const canDecide = !canPostAsHead && context.canReview && context.current && context.review?.status === 'pending';
  const canRoute = !canPostAsHead && context.required && !approved && !canDecide && context.candidates.length > 0;
  const canTakeReview = canRoute && context.headAlertStatus === 'notified'
    && !(context.current && context.review?.status === 'pending')
    && context.candidates.some(candidate => candidate.appointment === 'Head' && candidate.id === userProfile?.id);

  const reviewerError = canRoute && !reviewer ? 'Choose an independent leadership reviewer.' : '';
  const visibleReviewerError = reviewerTouched ? reviewerError : '';
  const routingReasonError = canRoute
    ? textLengthError(reason, 'Routing reason', { required: true, min: 5, max: 2000 })
    : '';
  const visibleRoutingReasonError =
    routingReasonTouched || reason.length > 0 ? routingReasonError : '';

  const takeReviewDisabled = busy || uncertain || Boolean(reviewer || reason.trim());
  const takeReviewTip = busy
    ? ''
    : uncertain
      ? 'Verify the earlier review outcome before continuing.'
      : Boolean(reviewer || reason.trim())
        ? 'Clear the reviewer and routing reason fields to take this review yourself.'
        : 'Assign this independent review directly to yourself as Office Head.';

  const sendReviewDisabled = busy || uncertain || !reviewer || Boolean(routingReasonError);
  const sendReviewTip = busy
    ? ''
    : uncertain
      ? 'Verify the earlier review outcome before continuing.'
      : !reviewer
        ? 'Choose an independent leadership reviewer first.'
        : routingReasonError || '';

  const decideBlockedTip = busy
    ? ''
    : uncertain
      ? 'Verify the earlier review outcome before continuing.'
      : '';

  const modalDisabled = uncertain || (decision === 'approve_escalation' ? !canApproveEscalation : !canDecide);
  const modalDisabledReason = uncertain
    ? 'Verify the earlier review outcome before recording another decision.'
    : decision === 'approve_escalation' && !canApproveEscalation
      ? 'This escalation is no longer awaiting your approval.'
      : !canDecide
        ? 'This review is no longer pending your decision.'
        : '';
  const modalWarningTooltip =
    decision === 'approve_escalation' && canPostAsHead
      ? 'Posts the settlement and accounting journal directly as Office Head.'
      : decision === 'changes_requested'
        ? 'Returns the package to the requester for corrections.'
        : decision === 'rejected'
          ? 'Formally rejects this liquidation package and notifies the requester.'
          : '';

  return <section className={`mt-3 space-y-3 rounded-xl border p-4 text-sm ${showEscalation ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-primary/25 bg-primary/5'}`} aria-label="Independent liquidation review">
    {confirmation.dialog}
    {showEscalation ? <div role="status" aria-label={settlementBlocked ? 'Settlement blocked' : 'Settlement escalation'}>
      <h4 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} aria-hidden="true" />{escalationHeading}</h4>
      <p className="mt-1">{escalationReason}</p>
      {context.required && !context.review && context.candidates.length === 0 && !canApproveEscalation && !context.headEscalationApproved && <p className="mt-1">An independent reviewer is also needed.</p>}
    </div> : <>
      <h4 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} aria-hidden="true" /> Independent leadership review</h4>
      <p>{approved ? 'Approved for separate Accounting settlement.' : context.review?.status === 'pending' && context.current ? `Waiting for ${context.candidates.find(candidate => candidate.id === context.review?.reviewer_id)?.name || 'the assigned reviewer'}.` : 'An independent appointed leadership reviewer must review this package.'}</p>
    </>}
    {context.review && <details className="rounded-lg border border-primary/20 p-3"><summary className="cursor-pointer font-medium">Review record · version {version}</summary><dl className="mt-3 space-y-2">
      <div><dt className="text-muted-foreground">Reviewer</dt><dd>{context.candidates.find(candidate => candidate.id === context.review?.reviewer_id)?.name || 'Previous appointed reviewer'}</dd></div>
      <div><dt className="text-muted-foreground">Status</dt><dd>{context.review.status.replace(/_/g, ' ')}{context.review.decided_at ? ` · ${formatManilaInstant(context.review.decided_at)}` : ''}</dd></div>
      <div><dt className="text-muted-foreground">Routing reason</dt><dd className="break-words">{context.review.route_reason}</dd></div>
      {context.review.decision_reason && <div><dt className="text-muted-foreground">Review note</dt><dd className="break-words">{context.review.decision_reason}</dd></div>}
    </dl></details>}
    {canApproveEscalation && (
      <ActionBlockerGroup
        actionLabel={canPostAsHead ? 'Approve & post settlement' : 'Approve'}
        blockers={uncertain ? decideBlockedTip : []}
        busy={busy}
        size="sm"
      >
        <WorkspaceTooltip
          content={!uncertain && canPostAsHead ? 'Settles this cash advance and posts the journal as Office Head.' : ''}
          disabled={uncertain || !canPostAsHead}
        >
          <span className="inline-flex">
            <Button disabled={busy || uncertain} onClick={() => { setMessage(''); setDecision('approve_escalation'); }}><UserRoundCheck size={15} /> {canPostAsHead ? 'Approve & post settlement' : 'Approve'}</Button>
          </span>
        </WorkspaceTooltip>
      </ActionBlockerGroup>
    )}
    {!settlementBlocked && !canApproveEscalation && !approved && context.escalationRequired && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">Escalation required: {context.candidates.length === 0 ? 'no independent appointed reviewer is available. ' : ''}{context.eligibleSettlers === 0 ? 'No separate eligible Accounting Officer is available to settle and post. ' : ''}Ask your administrator to resolve the appointment or Accounting assignment. No self-approval or delegated posting is allowed.</p>}
    {(canDecide || canRoute) && <>
      {canTakeReview && (
        <ActionBlockerGroup
          actionLabel="Take review"
          blockers={takeReviewDisabled ? takeReviewTip : []}
          busy={busy}
          size="sm"
        >
          <Button disabled={takeReviewDisabled} onClick={() => void run(undefined, true)}>Take review</Button>
        </ActionBlockerGroup>
      )}
      {canRoute && (
        <div className="block">
          <label htmlFor={reviewerId} className="block font-medium">
            Independent reviewer{' '}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <select
            ref={reviewerRef}
            id={reviewerId}
            aria-required="true"
            aria-invalid={Boolean(visibleReviewerError) || undefined}
            aria-describedby={reviewerActive && visibleReviewerError ? reviewerTipId : undefined}
            className={`mt-1 w-full rounded-lg border bg-background p-2 ${visibleReviewerError ? 'eflow-field-invalid border-destructive' : 'border-border'}`}
            value={reviewer}
            disabled={busy || uncertain}
            onFocus={() => setReviewerActive(true)}
            onMouseEnter={() => setReviewerActive(true)}
            onMouseLeave={() => setReviewerActive(false)}
            onBlur={() => {
              setReviewerActive(false);
              setReviewerTouched(true);
            }}
            onChange={event => {
              setReviewerTouched(true);
              setReviewer(event.target.value);
            }}
          >
            <option value="">Choose leadership reviewer</option>
            {context.candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.appointment}</option>)}
          </select>
          <FieldValidationTooltip
            id={reviewerTipId}
            anchorRef={reviewerRef}
            message={visibleReviewerError}
            open={reviewerActive && Boolean(visibleReviewerError)}
            tone="error"
          />
          {visibleReviewerError && <p role="alert" className="mt-1 text-xs text-destructive">{visibleReviewerError}</p>}
        </div>
      )}
      {canRoute && (
        <div className="block">
          <label htmlFor={routingReasonId} className="block font-medium">
            Routing reason{' '}
            <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
              *
            </span>
          </label>
          <BoundedTextarea
            id={routingReasonId}
            aria-required="true"
            rows={2}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-border bg-background p-2"
            value={reason}
            error={visibleRoutingReasonError || undefined}
            disabled={busy || uncertain}
            placeholder="Explain why this package is being routed for independent review (at least 5 characters)"
            onBlur={() => setRoutingReasonTouched(true)}
            onChange={event => {
              setRoutingReasonTouched(true);
              setReason(event.target.value);
            }}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {canDecide ? (
          <>
            <ActionBlockerGroup
              actionLabel="Approve review"
              blockers={uncertain ? decideBlockedTip : []}
              busy={busy}
              size="sm"
            >
              <Button disabled={busy || uncertain} onClick={() => { setMessage(''); setDecision('approved'); }}><UserRoundCheck size={15} /> Approve review</Button>
            </ActionBlockerGroup>
            <ActionBlockerGroup
              actionLabel="Request changes"
              blockers={uncertain ? decideBlockedTip : []}
              busy={busy}
              size="sm"
            >
              <Button variant="outline" className="border-amber-300 text-amber-800 bg-amber-50" disabled={busy || uncertain} onClick={() => { setMessage(''); setDecision('changes_requested'); }}>Request changes</Button>
            </ActionBlockerGroup>
            <ActionBlockerGroup
              actionLabel="Reject package"
              blockers={uncertain ? decideBlockedTip : []}
              busy={busy}
              size="sm"
            >
              <Button variant="outline" className="border-amber-300 text-amber-800 bg-amber-50" disabled={busy || uncertain} onClick={() => { setMessage(''); setDecision('rejected'); }}>Reject package</Button>
            </ActionBlockerGroup>
          </>
        ) : (
          <ActionBlockerGroup
            actionLabel="Send for independent review"
            blockers={sendReviewDisabled ? sendReviewTip : []}
            busy={busy}
            size="sm"
          >
            <Button disabled={sendReviewDisabled} onClick={() => void run()}>Send for independent review</Button>
          </ActionBlockerGroup>
        )}
      </div>
    </>}
    {decision && (
      <DecisionModal
        title={decision === 'approve_escalation' ? (canPostAsHead ? 'Approve and post this settlement?' : 'Approve this liquidation review?') : decision === 'approved' ? 'Approve this independent review?' : decision === 'rejected' ? 'Reject this package?' : 'Request changes to this package?'}
        description={decision === 'approve_escalation' ? (canPostAsHead ? 'No independent Accounting Officer is available. Your approval settles the cash advance and posts the journal.' : 'This records the Head’s approval. A separate Accounting Officer must settle and post.') : 'Are you sure? This records the independent review. Cash settlement and journal posting remain separate Accounting actions.'}
        decision={decision === 'approved' || decision === 'approve_escalation' ? 'approve' : decision === 'rejected' ? 'reject' : 'changes'}
        reason={reason}
        onReasonChange={setReason}
        reasonLabel="Review findings"
        minReasonLength={5}
        maxReasonLength={2000}
        requireReason
        busy={busy}
        disabled={modalDisabled}
        disabledReason={modalDisabledReason}
        warningTooltip={modalWarningTooltip}
        error={message}
        onCancel={() => { if (!busy) { setDecision(null); setMessage(''); } }}
        onConfirm={() => void run(decision)}
      />
    )}
    {!decision && message && <p role="status" className="break-words">{message}</p>}
    {uncertain && <Button variant="outline" disabled={busy} onClick={() => void verify()}><RefreshCw size={14} /> Verify review outcome</Button>}
  </section>;
}
