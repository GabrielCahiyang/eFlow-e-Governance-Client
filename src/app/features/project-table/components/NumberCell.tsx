import { useEffect, useId, useRef, useState } from 'react';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import type { WorkspaceTaskPatch } from '../types';
import { numericPatch } from '../planningDraft';

export function NumberCell({ value, label, disabled, save, field }: { value: number; label: string; disabled: boolean; save: (patch: WorkspaceTaskPatch) => Promise<void>; field: 'estimated_hours' | 'budget_impact' }) {
  const [draft, setDraft] = useState(value ? String(value) : ''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const pending = useRef(false), baseline = useRef(value), control = useRef<HTMLInputElement>(null), errorId = useId();
  useEffect(() => { if (!error && !pending.current) { baseline.current = value; setDraft(value ? String(value) : ''); } }, [value]);
  useNavigationBlocker({ label, dirty: Boolean(error && Number(draft) !== baseline.current), pending: busy, pendingCheck: () => pending.current, onDiscard: () => { setDraft(baseline.current ? String(baseline.current) : ''); setError(''); } });
  const commit = async () => {
    if (disabled || pending.current || Number(draft) === baseline.current) return;
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try { const patch = numericPatch(field, draft); await save(patch); baseline.current = Number(draft); setNotice('Saved.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save this amount.'); }
    finally { pending.current = false; setBusy(false); }
  };
  return <div className="pt-inline-cell" aria-busy={busy}>
    <input ref={control} type="number" min="0" max={field === 'estimated_hours' ? 100000 : 1e12} step={field === 'estimated_hours' ? '0.5' : '0.01'} value={draft} placeholder="—" aria-label={label} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} disabled={disabled || busy}
      onChange={event => { setDraft(event.target.value); setNotice(''); }} onBlur={() => { void commit(); }} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
        if (event.key === 'Escape' && !pending.current) { event.preventDefault(); setDraft(baseline.current ? String(baseline.current) : ''); setError(''); setNotice(''); }
      }}/>
    {busy ? <small role="status">Saving…</small> : error ? <small id={errorId} role="alert">{error}<button type="button" disabled={disabled} onClick={() => { void commit(); }}>Retry</button></small> : notice && <small role="status" className="pt-cell-saved">{notice}</small>}
  </div>;
}
