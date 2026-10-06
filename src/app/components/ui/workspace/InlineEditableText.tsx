import { useEffect, useId, useRef, useState } from "react";
import { useNavigationBlocker } from '../../../shared/navigationGuard';
export function InlineEditableText({value, onSave, label, disabled = false, maxLength = 200}: {value: string; onSave: (value: string) => Promise<void> | void; label: string; disabled?: boolean; maxLength?: number}) {
  const [editing,setEditing] = useState(false), [draft,setDraft] = useState(value), [error,setError] = useState(""), [saving,setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null), pending = useRef(false), cancelBlur = useRef(false), errorId = useId();
  useNavigationBlocker({label:`Unsaved ${label}`,dirty:editing && Boolean(error) && draft!==value,pending:saving,pendingCheck:()=>pending.current,onDiscard:()=>{cancelBlur.current=true;setDraft(value);setError('');setEditing(false);}});
  useEffect(() => { if (!editing) setDraft(value); }, [editing,value]);
  useEffect(() => { if(editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const save = async () => {
    if (cancelBlur.current) { cancelBlur.current=false; return; }
    if (pending.current) return;
    const next=draft.trim();
    if (!next) {setError("Enter a value."); input.current?.focus(); return;}
    if (next===value) {setEditing(false);return;}
    pending.current=true;setSaving(true);setError("");
    try {await onSave(next);setEditing(false);} catch(err) {setError(err instanceof Error ? err.message : "Unable to save.");input.current?.focus();}
    finally {pending.current=false;setSaving(false);}
  };
  if (!editing) return <button type="button" className="eflow-inline-text" aria-label={`Edit ${label}`} disabled={disabled} onClick={() => {cancelBlur.current=false;setDraft(value);setError("");setEditing(true);}}>{value}</button>;
  return <span className="eflow-inline-editor"><input ref={input} aria-label={label} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} value={draft} disabled={saving} maxLength={maxLength} onChange={e => setDraft(e.target.value)} onBlur={() => {void save();}} onKeyDown={e => {if(e.key==="Enter") {e.preventDefault();void save();} if(e.key==="Escape" && !pending.current) {e.preventDefault();cancelBlur.current=true;setDraft(value);setError("");setEditing(false);}}} />{error && <span id={errorId} role="alert">{error}</span>}</span>;
}
