import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import type { Task } from '../../tasks';
import { calendarDay, dayString, replaceDatePart } from '../selectors';
import type { WorkspaceTaskPatch } from '../../project-table';

export function TaskDatesDialog({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (task: Task, patch: WorkspaceTaskPatch) => Promise<void> }) {
  const due = calendarDay(task.deadline || task.dueDate);
  const [start, setStart] = useState(task.startDate || '');
  const [end, setEnd] = useState(due === null ? '' : dayString(due));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="pv-date-dialog"><DialogTitle>Task dates</DialogTitle><DialogDescription>{task.title}</DialogDescription>
    <form onSubmit={async e => { e.preventDefault(); if (start && end && start > end) { setError('Start date must precede the due date.'); return; } setBusy(true); setError(''); try { await onSave(task, { start_date: start || null, deadline: end ? replaceDatePart(task.deadline || task.dueDate, end) : '' }); onClose(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not save dates.'); } finally { setBusy(false); } }}>
      <label>Start date<input aria-label="Start date" type="date" value={start} disabled={busy} onChange={e => setStart(e.target.value)}/></label>
      <label>Due date<input aria-label="Due date" type="date" value={end} disabled={busy} onChange={e => setEnd(e.target.value)}/></label>
      {error && <p role="alert">{error}</p>}<button className="pv-primary" disabled={busy}>{busy ? 'Saving…' : 'Save dates'}</button>
    </form>
  </DialogContent></Dialog>;
}
