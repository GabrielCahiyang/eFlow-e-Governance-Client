import { useCallback, useEffect, useRef, useState } from 'react';
import { attachmentError, EVIDENCE_ACCEPT } from '../../../shared/fileValidation';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { subscribeWorkChanges } from '../../../shared/workChanges';
import {
  decideSubitemWork, fetchSubitemLeadReview, openSubitemReviewEvidence, proposeSubitemWork,
  type LeadReview, type LeadSubmission, type ReviewAttempt, type ReviewKind,
} from '../services/subitemLeadReview';

type ReviewProps = {
  root: string; node: string; actor: string; readOnly: boolean; pending: boolean;
  blocked?: string; completionBlocked?: string; reviewerName?: string; onChanged: () => Promise<void>;
};

export function SubitemLeadReview({ root, node, actor, readOnly, pending, blocked, completionBlocked, reviewerName, onChanged }: ReviewProps) {
  const [review, setReview] = useState<LeadReview>();
  const [error, setError] = useState('');
  const version = useRef(0);
  const load = useCallback(async () => {
    const run = ++version.current;
    try {
      const result = await fetchSubitemLeadReview(root, node);
      if (run === version.current) { setReview(result); setError(''); }
    } catch (reason) {
      if (run === version.current) setError(reason instanceof Error ? reason.message : 'Could not load Lead review.');
    }
  }, [root, node]);
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

  const kind = review?.canProposeCompletion ? 'completion' : review?.canProposeProgress ? 'progress' : undefined;
  const own = review?.items.find(item => item.author_id === actor && item.kind === kind);
  const awaitingReview = review?.items.some(item => item.author_id === actor && item.state === 'pending');
  const formBlocked = blocked || (kind === 'completion' ? completionBlocked : undefined);
  if (!review && !error) return <p role="status">Loading Lead review…</p>;
  if (!error && !kind && !review?.items.length) return null;
  return <section className="work-execution space-y-3" aria-label="Lead review">
    <h3 className="font-semibold">Lead review</h3>
    {error && <p role="alert">{error} <button type="button" onClick={() => void load()}>Retry review</button></p>}
    {review?.items.map(item => <SubmissionReview key={item.id} item={item} disabled={readOnly || pending || !!error} onChanged={changed}/>)}
    {kind && !readOnly && !awaitingReview && <ReviewForm key={kind + (own?.id ?? '')}
      root={root} node={node} actor={actor} kind={kind} reviewerName={kind === 'completion' ? reviewerName : undefined}
      supersedes={own?.state === 'changes_requested' ? own.id : undefined} disabled={pending || !!error || !!formBlocked} blocked={formBlocked}
      onSubmitted={item => {
        setReview(previous => previous && ({ ...previous, items: [item, ...previous.items.filter(row => row.id !== item.id)] }));
        void changed();
      }}/>}
  </section>;
}

function ReviewForm({ root, node, actor, kind, reviewerName, supersedes, disabled, blocked, onSubmitted }: {
  root: string; node: string; actor: string; kind: ReviewKind; reviewerName?: string; supersedes?: string;
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
      setError(reason instanceof Error ? reason.message : 'Could not submit work for review.');
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

function SubmissionReview({ item, disabled, onChanged }: { item: LeadSubmission; disabled: boolean; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LeadSubmission['state']>();
  const attempt = useRef<{ id: string; terms: string } | undefined>(undefined);
  const inFlight = useRef(false);
  async function decide(approve: boolean) {
    if (disabled || !item.canDecide || inFlight.current || result || (!approve && !note.trim())) return;
    const terms = JSON.stringify([approve, note.trim()]);
    if (attempt.current?.terms !== terms) attempt.current = { id: crypto.randomUUID(), terms };
    inFlight.current = true;
    setBusy(true); setError('');
    try {
      setResult((await decideSubitemWork(item.id, attempt.current.id, approve, note.trim())).state);
      await onChanged();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Could not save the review.';
      setError(message.includes('Settle all released or reserved cash')
        ? 'Completion is waiting for cash settlement. The cash recipient must record expenses and return any unused cash. Once the cash item is settled, you can approve this submission.'
        : message);
    }
    finally { inFlight.current = false; setBusy(false); }
  }
  const state = result ?? item.state;
  return <article className="space-y-2 rounded-md border p-3">
    <strong>{item.kind === 'completion' ? 'Completion' : 'Work update'} · {state === 'pending' ? 'Awaiting Lead review' : state === 'approved' ? 'Approved' : 'Changes requested'}</strong>
    <p className="whitespace-pre-wrap">{item.terms.note}</p>
    {item.terms.attachments?.map(file => <ReviewEvidence key={file.filePath} name={file.fileName} path={file.filePath}/>)}
    {item.decision_note && <p>{item.decision_note}</p>}
    {item.canDecide && state === 'pending' && <div className="space-y-2">
      <label className="block">Review note<textarea className="block w-full rounded-md border bg-background p-2" maxLength={3000} value={note} disabled={busy}
        onChange={event => setNote(event.target.value)}/></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={disabled || busy} onClick={() => void decide(true)}>{item.kind === 'completion' ? 'Approve and complete subtask' : 'Approve update'}</button>
        <button type="button" className="rounded-md border px-3 py-2 disabled:opacity-50" disabled={disabled || busy || !note.trim()} onClick={() => void decide(false)}>Request changes</button>
      </div>
    </div>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

function ReviewEvidence({ name, path }: { name: string; path: string }) {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  return <div>{link ? <a className="underline" href={link} target="_blank" rel="noreferrer">Open {name}</a>
    : <button type="button" className="underline" onClick={() => void openSubitemReviewEvidence(path).then(setLink).catch(() => setError('Could not open this evidence file.'))}>Load {name}</button>}
    {error && <span role="alert">{error}</span>}</div>;
}
