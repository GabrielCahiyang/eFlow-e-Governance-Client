import { useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import type { Task } from '../../tasks';
import { calendarDay, dayString, replaceDatePart } from '../selectors';
import type { WorkspaceTaskPatch } from '../../project-table';

export function TaskDatesDialog({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (task: Task, patch: WorkspaceTaskPatch) => Promise<void> }) {
 const due = calendarDay(task.deadline || task.dueDate), initialEnd = due === null ? '' : dayString(due);
 const initialStart = task.startDate || '';
 const [start, setStart] = useState(initialStart), [end, setEnd] = useState(initialEnd);
 const [error, setError] = useState(''), [busy, setBusy] = useState(false);
 const dirty = start !== initialStart || end !== initialEnd;
 const guard = useExplicitDraft('Task dates', dirty, busy, () => { setStart(initialStart); setEnd(initialEnd); });
 const close = () => { if (!guard.pendingRef.current) void requestNavigation(onClose); };
 const save = async (event: React.FormEvent) => {
  event.preventDefault(); if (guard.pendingRef.current) return;
  if (start && end && start > end) { setError('Start date must precede the due date.'); return; }
  guard.pendingRef.current = true; setBusy(true); setError('');
  try { await onSave(task, { start_date: start || null, deadline: end ? replaceDatePart(task.deadline || task.dueDate, end) : '' }); guard.markClean(); onClose(); }
  catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save dates.'); }
  finally { guard.pendingRef.current = false; setBusy(false); }
 };
 return <FeatureDialog title="Task dates" description={task.title} onClose={close} preventClose={busy} contentClassName="max-w-md">
  <form className="pv-date-dialog p-5" onSubmit={save}>
   <h2 className="text-lg font-semibold">Task dates</h2><p className="mb-3 text-sm text-neutral-500">{task.title}</p>
   <label>Start date<input aria-label="Start date" type="date" value={start} disabled={busy} onChange={e => setStart(e.target.value)}/></label>
   <label>Due date<input aria-label="Due date" type="date" value={end} disabled={busy} onChange={e => setEnd(e.target.value)}/></label>
   {error && <p role="alert">{error}</p>}
   <div className="flex gap-2 mt-4"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="pv-primary" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save dates'}</button></div>
  </form>
 </FeatureDialog>;
}
