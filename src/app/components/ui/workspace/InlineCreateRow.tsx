import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import './inlineCreateRow.css';
import { useNavigationBlocker } from '../../../shared/navigationGuard';

export interface InlineCreateRequest { id: string; verifyFirst: boolean }
export class InlineCreateRejected extends Error {}

type InlineCreateRowProps = {
  label: string;
  maxLength: number;
  autoFocus?: boolean;
  disabled?: boolean;
  onCreated?: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  extraFields?: (busy: boolean) => ReactNode;
  recoveryKey?: string;
} & (
  | { itemName: 'task'; saveOnLeave?: boolean; onCreate: (title: string, request: InlineCreateRequest) => Promise<unknown> }
  | { itemName: 'subitem'; saveOnLeave: true; onCreate: (title: string, request: InlineCreateRequest) => Promise<unknown> }
  | { itemName: 'subitem'; saveOnLeave?: false; onCreate: (title: string) => Promise<unknown>; recoveryKey?: never }
);

export function InlineCreateRow(props: InlineCreateRowProps) {
  const { label, itemName, maxLength, autoFocus, disabled = false, onCreated, onBusyChange, extraFields, recoveryKey } = props;
  const saveOnLeave = itemName === 'task' || Boolean(props.saveOnLeave);
  const visibleItemName = itemName === 'subitem' ? 'subtask' : itemName;
  const [recovered] = useState(() => {
    if (!recoveryKey) return null;
    try {
      const record = JSON.parse(sessionStorage.getItem(recoveryKey) ?? 'null');
      if (typeof record?.title !== 'string' || !record.title.trim()) return null;
      if (typeof record.id === 'string') return { id: record.id, title: record.title, error: 'The previous save could not be confirmed.' };
      if (typeof record.error === 'string' && record.error) return { title: record.title, error: record.error };
    } catch { /* Recovery is also kept in memory if storage is unavailable. */ }
    return null;
  });
  const [title, setTitle] = useState(recovered?.title ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(recovered?.error ?? '');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [uncertain, setUncertain] = useState(Boolean(recovered?.id));
  const draft = useRef(title);
  const saving = useRef(false);
  const request = useRef<InlineCreateRequest | null>(recovered?.id ? { id: recovered.id, verifyFirst: true } : null);
  const failed = useRef(Boolean(recovered));
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const hintId = useId();
  const errorId = useId();
  useNavigationBlocker({ label: `Unsaved ${visibleItemName}`, dirty: Boolean(title.trim()), pending: busy, pendingCheck: () => saving.current, onDiscard: clearDraft });

  function removeRecovery() {
    if (!recoveryKey) return;
    try { sessionStorage.removeItem(recoveryKey); } catch { /* Storage may be unavailable. */ }
  }

  function keepRecovery(record: { title: string; id?: string; error?: string }) {
    if (!recoveryKey) return;
    try { sessionStorage.setItem(recoveryKey, JSON.stringify(record)); }
    catch { /* The mounted row still retains the draft. */ }
  }

  function clearDraft() {
    removeRecovery();
    draft.current = '';
    request.current = null;
    failed.current = false;
    setTitle('');
    setError('');
    setUncertain(false);
  }

  async function save(keepAdding = false) {
    const nextTitle = draft.current.trim();
    if (!nextTitle || saving.current || refreshFailed || disabled) return;
    saving.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      if (saveOnLeave) {
        request.current ??= { id: crypto.randomUUID(), verifyFirst: false };
        keepRecovery({ id: request.current.id, title: nextTitle });
        await (props.onCreate as (title: string, request: InlineCreateRequest) => Promise<unknown>)(nextTitle, request.current);
      } else {
        await (props.onCreate as (title: string) => Promise<unknown>)(nextTitle);
      }
      clearDraft();
      if (onCreated) {
        try { await onCreated(); }
        catch (err) { setRefreshFailed(true); setError('Added, but could not refresh: ' + (err instanceof Error ? err.message : 'Please reload the view.')); }
      }
      if (keepAdding && form.current?.contains(document.activeElement)) input.current?.focus();
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not add ${visibleItemName}.`;
      failed.current = true;
      if (request.current && !(err instanceof InlineCreateRejected)) {
        request.current = { ...request.current, verifyFirst: true };
        setUncertain(true);
      } else {
        keepRecovery({ title: draft.current, error: message });
        request.current = null;
        setUncertain(false);
      }
      setError(message);
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  const leave = useRef<(target: EventTarget | null) => void>(() => {});
  leave.current = target => {
    if (!(target instanceof Node) || failed.current) return;
    const row = form.current?.closest('.pt-add-row') ?? form.current;
    if (row && !row.contains(target)) void save();
  };
  const watchOutside = saveOnLeave && Boolean(title.trim()) && !error && !disabled;
  useEffect(() => {
    if (!watchOutside) return;
    const handleClick = (event: MouseEvent) => leave.current(event.target);
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [watchOutside]);

  return <form ref={form} className="pt-inline-create" aria-busy={busy}
    onBlur={saveOnLeave ? event => leave.current(event.relatedTarget) : undefined}
    onSubmit={event => { event.preventDefault(); void save(); input.current?.blur(); }}>
    <div className="pt-inline-create__fields">
      <Plus size={15} aria-hidden="true" />
      <input ref={input} className="pt-inline-create__title" autoFocus={autoFocus} aria-label={label} aria-describedby={error ? errorId : hintId}
        aria-invalid={!!error} placeholder={`Add ${visibleItemName}`} maxLength={maxLength} value={title} disabled={disabled} readOnly={busy || uncertain}
        onChange={event => { if (saving.current || request.current?.verifyFirst) return; if (failed.current) removeRecovery(); draft.current = event.target.value; setTitle(event.target.value); failed.current = false; if (!refreshFailed) setError(''); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            void save(event.shiftKey);
            if (!event.shiftKey) input.current?.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            if (saving.current || request.current?.verifyFirst || refreshFailed) return;
            clearDraft(); input.current?.blur();
          }
        }} />
      {extraFields?.(busy)}
      {!saveOnLeave && <button type="submit" disabled={busy || refreshFailed || disabled || !title.trim()}>Add {visibleItemName}</button>}
      {busy && <span className="pt-inline-create__status" role="status">Adding…</span>}
    </div>
    {!error && <p id={hintId} className="pt-inline-create__hint">{saveOnLeave && 'Click outside or press Enter to add. '}Press <strong>Shift + Enter</strong> to add another {visibleItemName}</p>}
    {error && <p id={errorId} className="pt-inline-create__error" role="alert">{error}{uncertain && ` Retry to check whether the ${visibleItemName} was saved.`}{saveOnLeave && !refreshFailed && <button type="button" disabled={busy || disabled} onClick={() => { void save(); }}>Retry {visibleItemName} creation</button>}{refreshFailed && <button type="button" disabled={busy} onClick={() => {
      if (!onCreated || saving.current) return;
      saving.current = true; setBusy(true); onBusyChange?.(true);
      void onCreated().then(() => { setRefreshFailed(false); setError(''); }).catch(caught => setError('Added, but could not refresh: ' + (caught instanceof Error ? caught.message : 'Please reload the view.'))).finally(() => { saving.current = false; setBusy(false); onBusyChange?.(false); });
    }}>Retry refresh</button>}</p>}
  </form>;
}
