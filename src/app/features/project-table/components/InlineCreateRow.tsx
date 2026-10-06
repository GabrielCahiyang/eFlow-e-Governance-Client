import { useId, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import './inlineCreateRow.css';
import { useNavigationBlocker } from '../../../shared/navigationGuard';

interface InlineCreateRowProps {
  label: string;
  itemName: 'task' | 'subitem';
  maxLength: number;
  autoFocus?: boolean;
  onCreate: (title: string) => Promise<unknown>;
  onCreated?: () => Promise<void>;
  onBusyChange?: (busy: boolean) => void;
  extraFields?: (busy: boolean) => ReactNode;
}

export function InlineCreateRow({ label, itemName, maxLength, autoFocus, onCreate, onCreated, onBusyChange, extraFields }: InlineCreateRowProps) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const draft = useRef('');
  const saving = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const hintId = useId();
  const errorId = useId();
  useNavigationBlocker({label:`Unsaved ${itemName}`,dirty:Boolean(error && title.trim()),pending:busy,pendingCheck:()=>saving.current,onDiscard:()=>{draft.current='';setTitle('');setError('');}});

  async function save(keepAdding = false) {
    const nextTitle = draft.current.trim();
    if (!nextTitle || saving.current) return;
    saving.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      await onCreate(nextTitle);
      // Clear the draft before refreshing so a committed item cannot be added twice.
      draft.current = '';
      setTitle('');
      if (onCreated) {
        try { await onCreated(); }
        catch (error) { setRefreshFailed(true); setError('Added, but could not refresh: ' + (error instanceof Error ? error.message : 'Please reload the view.')); }
      }
      if (keepAdding && form.current?.contains(document.activeElement)) input.current?.focus();
    } catch (error) {
      setError(error instanceof Error ? error.message : `Could not add ${itemName}.`);
    } finally {
      saving.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return <form ref={form} className="pt-inline-create" aria-busy={busy}
    onBlur={event => {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      void save();
    }}
    onSubmit={event => { event.preventDefault(); void save(); input.current?.blur(); }}>
    <div className="pt-inline-create__fields">
      <Plus size={15} aria-hidden="true" />
      <input ref={input} className="pt-inline-create__title" autoFocus={autoFocus} aria-label={label} aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        aria-invalid={!!error} placeholder={`Add ${itemName}`} maxLength={maxLength} value={title} readOnly={busy}
        onChange={event => { draft.current = event.target.value; setTitle(event.target.value); setError(''); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            void save(event.shiftKey);
            if (!event.shiftKey) input.current?.blur();
          } else if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            if (saving.current) return;
            draft.current = ''; setTitle(''); setError(''); input.current?.blur();
          }
        }} />
      {extraFields?.(busy)}
      {busy && <span className="pt-inline-create__status" role="status">Adding…</span>}
    </div>
    <p id={hintId} className="pt-inline-create__hint">Press <strong>Shift + Enter</strong> to add another {itemName}</p>
    {error && <p id={errorId} className="pt-inline-create__error" role="alert">{error}{refreshFailed && <button type="button" disabled={busy} onClick={() => {
      if (!onCreated || saving.current) return;
      saving.current = true; setBusy(true); onBusyChange?.(true);
      void onCreated().then(() => { setRefreshFailed(false); setError(''); }).catch(caught => setError('Added, but could not refresh: ' + (caught instanceof Error ? caught.message : 'Please reload the view.'))).finally(() => { saving.current = false; setBusy(false); onBusyChange?.(false); });
    }}>Retry refresh</button>}</p>}
  </form>;
}
