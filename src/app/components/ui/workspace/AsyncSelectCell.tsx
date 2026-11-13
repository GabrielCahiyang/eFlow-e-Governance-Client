import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigationBlocker } from '../../../shared/navigationGuard';

/** One direct-save select edit, with its own retained error and scoped retry. */
export function AsyncSelectCell({ value, label, disabled, onSave, children, className, style }: { value: string; label: string; disabled: boolean; onSave: (value: string) => Promise<boolean | void>; children: ReactNode; className?: string; style?: CSSProperties }) {
  const [draft, setDraft] = useState(value), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), baseline = useRef(value), input = useRef<HTMLSelectElement>(null), errorId = useId();
  useEffect(() => { if (!error && !pending.current) { baseline.current = value; setDraft(value); } }, [value]);
  useNavigationBlocker({ label, dirty: Boolean(error && draft !== baseline.current), pending: busy, pendingCheck: () => pending.current, onDiscard: () => { setDraft(baseline.current); setError(''); } });
  const commit = async (next: string) => {
    if (disabled || pending.current || next === baseline.current) return;
    pending.current = true; setBusy(true); setDraft(next); setError(''); setNotice('');
    try { if (await onSave(next) === false) setDraft(baseline.current); else { baseline.current = next; setNotice('Saved.'); } }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save this change.'); }
    finally { pending.current = false; setBusy(false); requestAnimationFrame(() => { if (document.activeElement === document.body) input.current?.focus(); }); }
  };
  return <div className="pt-inline-cell" aria-busy={busy}>
    <select ref={input} className={className} style={style} value={draft} aria-label={label} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} disabled={disabled || busy} onChange={event => { void commit(event.target.value); }}>{children}</select>
    {busy ? <small role="status">Saving…</small> : error ? <small id={errorId} role="alert">{error}<button type="button" disabled={disabled} onClick={() => { void commit(draft); }}>Retry</button></small> : notice && <small role="status" className="pt-cell-saved">{notice}</small>}
  </div>;
}
