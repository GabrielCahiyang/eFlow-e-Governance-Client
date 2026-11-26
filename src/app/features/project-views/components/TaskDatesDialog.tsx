import { readableUiError } from '../../../shared/userFacingError';
import { useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { DateInput } from '../../../components/ui/DateInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { calendarMinDate } from '../../../shared/calendarDates';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import type { Task } from '../../tasks';
import { FormField } from '../../../components/ui/FormField';
import { timelineDraft, timelinePatch, timelineError, todayDate, type WorkspaceTaskPatch } from '../../project-table';

export function TaskDatesDialog({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (task: Task, patch: WorkspaceTaskPatch) => Promise<void> }) {
  const initial = timelineDraft(task);
  const [draft, updateDraft] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [startInvalidText, setStartInvalidText] = useState(false);
  const [dueInvalidText, setDueInvalidText] = useState(false);

  const setDraft = (value: typeof draft) => { updateDraft(value); setError(''); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const today = todayDate();
  const startMin = calendarMinDate(task.startDate || '');
  const dueMin = draft.start && draft.start > today ? draft.start : today;
  const validation = dirty ? timelineError(task, draft) : undefined;

  const startError = startInvalidText
    ? 'Enter a valid start date in MM/DD/YYYY format.'
    : validation && /start date/i.test(validation) && !/due date cannot be before/i.test(validation)
      ? validation
      : '';
  const dueError = dueInvalidText
    ? 'Enter a valid due date in MM/DD/YYYY format.'
    : validation && !startError
      ? validation
      : '';

  const submitBlockers = [
    startError,
    dueError,
    !dirty ? 'Change the start or due date to save.' : '',
    !startError && !dueError && validation ? validation : '',
  ].filter(Boolean);
  const submitDisabled = busy || submitBlockers.length > 0;

  const guard = useExplicitDraft('Task dates', dirty, busy, () => setDraft(initial));
  const close = () => { if (!guard.pendingRef.current) void requestNavigation(onClose); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (guard.pendingRef.current || startInvalidText || dueInvalidText) return;
    const invalid = timelineError(task, draft);
    if (invalid) { setError(invalid); return; }
    guard.pendingRef.current = true;
    setBusy(true);
    setError('');
    try {
      await onSave(task, timelinePatch(task, draft));
      guard.markClean();
      onClose();
    } catch (reason) {
      setError(readableUiError(reason, 'Could not save dates.', 'write'));
    } finally {
      guard.pendingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <FeatureDialog title="Task dates" description={task.title} onClose={close} preventClose={busy} contentClassName="max-w-md">
      <form noValidate className="pv-date-dialog p-5" onSubmit={save}>
        <h2 className="text-lg font-semibold">Task dates</h2>
        <p className="mb-3 text-sm text-neutral-500">{task.title}</p>
        <FormField label="Start date" error={startError || undefined}>
          <DateInput
            min={startMin}
            max={draft.end || undefined}
            value={draft.start}
            hasError={Boolean(startError)}
            errorMessage={startError || undefined}
            onInvalidTextChange={setStartInvalidText}
            disabled={busy}
            onChange={e => setDraft({ ...draft, start: e.target.value })}
          />
        </FormField>
        <FormField label="Due date" error={dueError || undefined}>
          <DateInput
            min={dueMin}
            value={draft.end}
            hasError={Boolean(dueError)}
            errorMessage={dueError || undefined}
            onInvalidTextChange={setDueInvalidText}
            disabled={busy}
            onChange={e => setDraft({ ...draft, end: e.target.value })}
          />
        </FormField>
        {error && <p role="alert" className="eflow-field-error mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button type="button" disabled={busy} onClick={close}>Cancel</button>
          <ActionBlockerGroup actionLabel="Save dates" blockers={submitBlockers} busy={busy}>
            <button type="submit" className="pv-primary" disabled={submitDisabled}>
              {busy ? 'Saving…' : 'Save dates'}
            </button>
          </ActionBlockerGroup>
        </div>
      </form>
    </FeatureDialog>
  );
}
