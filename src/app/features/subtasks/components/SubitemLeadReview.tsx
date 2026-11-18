import { readableUiError } from '../../../shared/userFacingError';
import { useCallback, useEffect, useRef, useState } from 'react';
import { attachmentError, EVIDENCE_ACCEPT } from '../../../shared/fileValidation';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { subscribeWorkChanges } from '../../../shared/workChanges';
import { usePendingAction } from '../../../shared/usePendingAction';
import { requestNavigation } from '../../../shared/navigationGuard';
import { WorkExecutionForm, type WorkUpdate } from '../../work-state';
import { assertWorkAcceptanceAvailable } from '../../budget';
import {
  fetchSubitemLeadReview, openSubitemReviewEvidence, proposeSubitemWork, recoverSubitemProposal,
  proposalActionKey, proposalDecisionKey, saveSubitemDecision, type SavedProposal, type SavedProposalDecision,
  type LeadReview, type LeadSubmission, type ReviewAttempt, type ReviewKind,
} from '../services/subitemLeadReview';

type ReviewProps = {
  root: string; node?: string | null; actor: string; readOnly: boolean; pending: boolean;
  blocked?: string; completionBlocked?: string; reviewerName?: string; onChanged: () => Promise<void>;
  status?: string; initialBlocker?: string; currentProgress?: number | null;
};

export function SubitemLeadReview({ root, node, actor, readOnly, pending, blocked, completionBlocked, reviewerName, onChanged, status='in_progress', initialBlocker='', currentProgress }: ReviewProps) {
  const normalizedNode = node ?? null;
  const [review, setReview] = useState<LeadReview>();
  const [selectedKind, setSelectedKind] = useState<ReviewKind>();
  const recovery = usePendingAction<SavedProposal>(proposalActionKey(actor, root, normalizedNode));
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [error, setError] = useState('');
  const version = useRef(0);
  const load = useCallback(async () => {
    const run = ++version.current;
    try {
      const result = await fetchSubitemLeadReview(root, normalizedNode);
      if (run === version.current) { setReview(result); setError(''); }
    } catch (reason) {
      if (run === version.current) setError(readableUiError(reason, "Could not load Lead review.", 'read'));
    }
  }, [root, normalizedNode]);
  useEffect(() => {
    void load();
    const refresh = () => void load();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    const unsubscribe = subscribeWorkChanges(refresh, root);
    return () => { version.current++; window.clearInterval(timer); window.removeEventListener('focus', refresh); unsubscribe(); };
  }, [load, root]);

  async function changed() {
    await load();
    window.dispatchEvent(new CustomEvent('eflow:work-updated', { detail: { taskId: root } }));
    await onChanged().catch(() => {});
  }

  const chooseKind = review?.canProposeCompletion && review.canProposeProgress;
  const kind = chooseKind ? selectedKind : review?.canProposeCompletion ? 'completion' : review?.canProposeProgress ? 'progress' : undefined;
  const own = review?.items.find(item => item.author_id === actor && item.kind === kind && item.state === 'changes_requested' &&
    !review.items.some(replacement => replacement.supersedes === item.id));
  const awaitingReview = review?.items.some(item => item.author_id === actor && item.state === 'pending');
  const formBlocked = blocked || (kind === 'completion' ? completionBlocked : undefined);
  if (!review && !error) return <p role="status">Loading Lead review…</p>;
  if (!error && !kind && !chooseKind && !review?.items.length && !recovery.value && !recovery.error) return null;
  async function checkSavedProposal() {
    if (recovering || readOnly) return;
    setRecovering(true); setRecoveryError('');
    try {
      await recoverSubitemProposal(root, normalizedNode, actor);
      setSelectedKind(undefined);
      await changed();
    } catch (reason) {
      setRecoveryError(readableUiError(reason, 'Could not check the saved proposal.', 'write'));
    } finally { setRecovering(false); }
  }
  return <section className="work-execution space-y-3" aria-label="Lead review">
    <h3 className="font-semibold">Lead review</h3>
    {error && <p role="alert">{error} <button type="button" onClick={() => void load()}>Retry review</button></p>}
    {review?.items.map(item => <SubmissionReview key={item.id} root={root} node={normalizedNode} actor={actor} item={item} disabled={readOnly || pending || !!error} onChanged={changed}/>)}
    {(recovery.error || recoveryError) && <p role="alert">{recovery.error || recoveryError}</p>}
    {recovery.value && !readOnly && <button type="button" disabled={recovering || pending} onClick={() => void checkSavedProposal()}>
      {recovering ? 'Checking proposal…' : 'Check saved proposal'}
    </button>}
    {chooseKind && !readOnly && !awaitingReview && !selectedKind && recovery.ready && !recovery.value && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={pending || !!error || !!blocked} onClick={() => setSelectedKind('progress')}>Propose a progress update</button>
      <button type="button" disabled={pending || !!error || !!blocked || !!completionBlocked} onClick={() => setSelectedKind('completion')}>Propose completion</button>
    </div>}
    {chooseKind && selectedKind && !readOnly && !awaitingReview && !recovery.value &&
      <button type="button" onClick={() => void requestNavigation(() => setSelectedKind(undefined))}>Choose another proposal action</button>}
    {kind && !readOnly && !awaitingReview && recovery.ready && !recovery.value && (kind === 'progress' ? <ProgressReviewForm key={(normalizedNode ?? 'root') + (own?.id ?? '')}
      root={root} node={normalizedNode} actor={actor} status={status} initialBlocker={initialBlocker} currentProgress={currentProgress}
      supersedes={own?.state === 'changes_requested' ? own.id : undefined} disabled={pending || !!error} blocked={formBlocked}
      onSubmitted={item => {setSelectedKind(undefined);setReview(previous => previous && ({...previous,items:[item,...previous.items.filter(row=>row.id!==item.id)]}));void changed();}}/>
      : <ReviewForm key={kind + (own?.id ?? '')}
      root={root} node={normalizedNode} actor={actor} kind={kind} reviewerName={kind === 'completion' ? reviewerName : undefined}
      supersedes={own?.state === 'changes_requested' ? own.id : undefined} disabled={pending || !!error || !!formBlocked} blocked={formBlocked}
      onSubmitted={item => {
        setSelectedKind(undefined);
        setReview(previous => previous && ({ ...previous, items: [item, ...previous.items.filter(row => row.id !== item.id)] }));
        void changed();
      }}/>) }
  </section>;
}

function ProgressReviewForm({root,node,actor,status,initialBlocker,currentProgress,supersedes,disabled,blocked,onSubmitted}:{
  root:string;node:string|null;actor:string;status:string;initialBlocker:string;currentProgress?:number|null;supersedes?:string;disabled:boolean;blocked?:string;onSubmitted:(item:LeadSubmission)=>void;
}) {
  const attempt=useRef<ReviewAttempt|undefined>(undefined);
  const [retry,setRetry]=useState(false);
  const input=useRef<WorkUpdate|undefined>(undefined);
  return <><p>Your update goes to your lead for review.</p><WorkExecutionForm status={status} initialBlocker={initialBlocker}
    disabled={disabled} blockedBy={blocked} freezeFields={retry} onSave={async update=>{
      attempt.current??={id:crypto.randomUUID(),uploaded:[]};input.current??=update;setRetry(true);
      try {
        const item=await proposeSubitemWork({root,node,actor,kind:'progress',note:input.current.note,files:input.current.files,
          blocker:input.current.blocker,nextStep:input.current.nextStep,currentProgress,attempt:attempt.current,supersedes});
        attempt.current=undefined;input.current=undefined;setRetry(false);onSubmitted(item);
      } catch(reason) {
        if(!attempt.current?.sent){attempt.current=undefined;input.current=undefined;setRetry(false);}
        throw reason;
      }
    }}/></>;
}

function ReviewForm({ root, node, actor, kind, reviewerName, supersedes, disabled, blocked, onSubmitted }: {
  root: string; node: string | null; actor: string; kind: ReviewKind; reviewerName?: string; supersedes?: string;
  disabled: boolean; blocked?: string; onSubmitted: (item: LeadSubmission) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef<ReviewAttempt | undefined>(undefined);
  const guard = useExplicitDraft('Lead review submission', !!note || files.length > 0, busy, () => {
    setNote(''); setFiles([]); setError(''); attempt.current = undefined;
  });
  async function submit() {
    if (disabled || guard.pendingRef.current || !note.trim()) return;
    const issue = attachmentError(files);
    if (issue) { setError(issue); return; }
    attempt.current ??= { id: crypto.randomUUID(), uploaded: [] };
    guard.pendingRef.current = true;
    setBusy(true); setError('');
    try {
      const item = await proposeSubitemWork({ root, node, actor, kind, note: note.trim(), files, attempt: attempt.current, supersedes });
      guard.markClean();
      onSubmitted(item);
    } catch (reason) {
      setError(readableUiError(reason, "Could not submit work for review.", 'write'));
    } finally { guard.pendingRef.current = false; setBusy(false); }
  }
  const label = kind === 'completion' ? 'Submit for Task Lead review' : 'Send update for Lead review';
  if (!open) return <><p>{blocked || (kind === 'completion' ? `When this step is finished, send it to ${reviewerName || 'the Task Lead'} for approval.` : 'Send your progress and evidence to your lead for review.')}</p>
    <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" type="button" disabled={disabled} onClick={() => setOpen(true)}>{label}</button></>;
  return <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
    <label className="block">Work note<textarea required maxLength={3000} rows={4} className="block w-full rounded-md border bg-background p-2"
      value={note} disabled={busy} onChange={event => { setNote(event.target.value); attempt.current = undefined; }}/></label>
    <label className="block">Evidence files (optional)<input className="block" type="file" accept={EVIDENCE_ACCEPT} multiple disabled={busy}
      onChange={event => { setFiles(Array.from(event.target.files ?? [])); attempt.current = undefined; }}/></label>
    {error && <p role="alert">{error}</p>}
    <button className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={disabled || busy || !note.trim()}>{busy ? 'Submitting…' : label}</button>
  </form>;
}

function SubmissionReview({ root, node, actor, item, disabled, onChanged }: { root: string; node: string | null; actor: string; item: LeadSubmission; disabled: boolean; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeadSubmission['state']>();
  const recovery = usePendingAction<SavedProposalDecision>(proposalDecisionKey(actor, root, node, item.id));
  const inFlight = useRef(false);
  const acceptsWork = item.kind === 'completion' && item.submitted_as_lead === true;
  async function decide(approve: boolean, recovering = false) {
    if (disabled || !recovery.ready || item.author_id === actor || inFlight.current || result ||
        (!recovering && (!item.canDecide || recovery.value || (!approve && !note.trim())))) return;
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      if (approve && acceptsWork && !recovering) {
        await assertWorkAcceptanceAvailable(root, node);
      }
      const decision = await saveSubitemDecision(root, node, actor, item, recovering ? undefined : {
        id: crypto.randomUUID(), approve, note: note.trim(),
      });
      setResult(decision.state);
      await onChanged();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not save the review.';
      setError(readableUiError(reason, message, 'write'));
    }
    finally { inFlight.current = false; setBusy(false); }
  }
  const state = result ?? item.state;
  return <article className="space-y-2 rounded-md border p-3">
    <strong>{item.kind === 'completion' ? 'Completion' : 'Work update'} · {state === 'pending' ? 'Awaiting Lead review' : state === 'approved' ? 'Approved' : 'Changes requested'}</strong>
    <p className="whitespace-pre-wrap">{item.terms.note}</p>
    {item.terms.blocker && <p className="whitespace-pre-wrap"><strong>Blocker: </strong>{item.terms.blocker}</p>}
    {item.terms.next_step && <p><strong>Next step: </strong>{item.terms.next_step}</p>}
    {item.terms.attachments?.map(file => <ReviewEvidence key={file.filePath} name={file.fileName} path={file.filePath}/>)}
    {item.decision_note && <p>{item.decision_note}</p>}
    {recovery.value && !disabled && !result &&
      <button type="button" disabled={busy} onClick={() => void decide(recovery.value!.approve, true)}>Check saved decision</button>}
    {item.canDecide && item.author_id !== actor && state === 'pending' && recovery.ready && !recovery.value && <div className="space-y-2">
      <label className="block">Review note<textarea className="block w-full rounded-md border bg-background p-2" maxLength={3000} value={note} disabled={busy}
        onChange={event => setNote(event.target.value)}/></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={disabled || busy} onClick={() => void decide(true)}>{acceptsWork ? 'Approve work' : 'Approve update'}</button>
        <button type="button" className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={disabled || busy || !note.trim()} onClick={() => void decide(false)}>Request changes</button>
      </div>
    </div>}
    {(error || recovery.error) && <p role="alert">{error || recovery.error}</p>}
  </article>;
}

function ReviewEvidence({ name, path }: { name: string; path: string }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  return <div>{link ? <a className="underline" href={link} target="_blank" rel="noreferrer">Open {name}</a>
    : <button type="button" className="underline" onClick={() => void openSubitemReviewEvidence(path).then(setLink).catch(() => setError('Could not open this evidence file.'))}>Load {name}</button>}
    {error && <span role="alert">{error}</span>}</div>;
}
