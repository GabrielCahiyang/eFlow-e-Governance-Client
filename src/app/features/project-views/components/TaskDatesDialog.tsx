import { useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import type { Task } from '../../tasks';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { timelineDraft, timelinePatch, timelineError, todayDate, type WorkspaceTaskPatch } from '../../project-table';

export function TaskDatesDialog({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (task: Task, patch: WorkspaceTaskPatch) => Promise<void> }) {
 const initial = timelineDraft(task);
 const [draft, updateDraft] = useState(initial);
 const [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const setDraft = (value: typeof draft) => { updateDraft(value); setError(''); };
 const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
 const today = todayDate(), validation = dirty ? timelineError(task, draft) : undefined;
 const guard = useExplicitDraft('Task dates', dirty, busy, () => setDraft(initial));
 const close = () => { if (!guard.pendingRef.current) void requestNavigation(onClose); };
 const save = async (event: React.FormEvent) => {
  event.preventDefault(); if (guard.pendingRef.current) return;
  const invalid = timelineError(task, draft);
  if (invalid) { setError(invalid); return; }
  guard.pendingRef.current = true; setBusy(true); setError('');
  try { await onSave(task, timelinePatch(task, draft)); guard.markClean(); onClose(); }
  catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save dates.'); }
  finally { guard.pendingRef.current = false; setBusy(false); }
 };
 return <FeatureDialog title="Task dates" description={task.title} onClose={close} preventClose={busy} contentClassName="max-w-md">
  <form noValidate className="pv-date-dialog p-5" onSubmit={save}>
   <h2 className="text-lg font-semibold">Task dates</h2><p className="mb-3 text-sm text-neutral-500">{task.title}</p>
   <FormField label="Start date"><TextInput type="date" min={today} value={draft.start} disabled={busy} onChange={e => setDraft({ ...draft, start: e.target.value })}/></FormField>
   <FormField label="Due date"><TextInput type="date" min={draft.start > today ? draft.start : today} value={draft.end} disabled={busy} onChange={e => setDraft({ ...draft, end: e.target.value, ...(!e.target.value ? { time: '' } : {}) })}/></FormField>
   <FormField label="Due time (optional)" description="Leave blank for 11:59 PM."><TextInput type="time" step={60} value={draft.time || ''} disabled={busy || !draft.end} onChange={e => setDraft({ ...draft, time: e.target.value })}/></FormField>
   {(validation || error) && <p role="alert">{validation || error}</p>}
   <div className="flex gap-2 mt-4"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="pv-primary" disabled={busy || !dirty || !!validation}>{busy ? 'Saving…' : 'Save dates'}</button></div>
  </form>
 </FeatureDialog>;
}
