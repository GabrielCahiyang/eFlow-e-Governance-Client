import { readableUiError } from '../../../shared/userFacingError';
import { useEffect, useId, useRef, useState } from 'react';
import { Info, Loader2, Lock } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { DateInput } from '../../../components/ui/DateInput';
import { BoundedTextInput, BoundedTextarea } from '../../../components/ui/BoundedInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { useNavigationBlocker, requestNavigation } from '../../../shared/navigationGuard';
import { calendarMinDate, getPhilippineCalendarDate } from '../../../shared/calendarDates';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { fetchTaskDetailEditState, type Task, type TaskDetailEditState } from '../../tasks';
import type { WorkspaceTaskPatch } from '../types';
import { timelineDraft, timelineError, timelinePatch } from '../planningDraft';
import { PrerequisiteField } from '../../../components/ui/workspace/PrerequisiteField';
import { projectPrerequisiteChoices, projectPrerequisiteError } from '../selectors';
import { useTasks } from '../../../hooks/useFirebaseData';

export function ProjectTaskEditDialog({ task, projectStartDate, projectTargetDate, save, onClose }: { task: Task; projectStartDate?: string; projectTargetDate?: string; save: (patch: WorkspaceTaskPatch) => Promise<void>; onClose: () => void }) {
  const { tasks } = useTasks();
  const titleId = useId();
  const priorityId = useId();
  const startDateId = useId();
  const dueDateId = useId();
  const reasonId = useId();
  const [prerequisites, setPrerequisites] = useState(task.dependencyIds || []);
  const dependenciesChanged = JSON.stringify([...prerequisites].sort()) !== JSON.stringify([...(task.dependencyIds || [])].sort());
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dates, setDates] = useState(() => timelineDraft(task));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState<TaskDetailEditState | null>(null);
  const [policyError, setPolicyError] = useState('');
  const [policyLoading, setPolicyLoading] = useState(true);
  const [changeReason, setChangeReason] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [reasonTouched, setReasonTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [startInvalidText, setStartInvalidText] = useState(false);
  const [dueInvalidText, setDueInvalidText] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    setPolicy(null);
    setPolicyError('');
    setPolicyLoading(true);
    void fetchTaskDetailEditState(task.id)
      .then(value => { if (active) setPolicy(value); })
      .catch(reason => { if (active) setPolicyError(readableUiError(reason, 'Task editing access could not be verified.', 'write')); })
      .finally(() => { if (active) setPolicyLoading(false); });
    return () => { active = false; };
  }, [task.id]);

  const verified = !policyLoading && !policyError && !!policy;
  const detailsWritable = verified && !!policy?.details;
  const planningWritable = detailsWritable && !!policy?.planning;
  const dueWritable = detailsWritable && !!policy?.due;
  const initialDates = timelineDraft(task);
  const startChanged = dates.start !== initialDates.start;
  const dueChanged = dates.end !== initialDates.end;
  const datesChanged = startChanged || dueChanged;
  const dirty = dependenciesChanged || title !== task.title || priority !== task.priority || datesChanged;

  useNavigationBlocker({ label: 'Edit task', dirty, pending: busy, onDiscard: onClose });
  const close = () => void requestNavigation(onClose);

  const projectBounds = { start: projectStartDate?.slice(0, 10) || '', end: projectTargetDate?.slice(0, 10) || '' };
  const today = getPhilippineCalendarDate();
  const baseStartMin = calendarMinDate(task.startDate || '');
  const startMin = projectBounds.start && projectBounds.start > baseStartMin ? projectBounds.start : baseStartMin;
  const startMax = (dates.end && (!projectBounds.end || dates.end < projectBounds.end) ? dates.end : projectBounds.end) || undefined;
  const dueMinCandidates = [today, dates.start, projectBounds.start].filter(Boolean).sort();
  const dueMin = dueMinCandidates[dueMinCandidates.length - 1] || undefined;
  const dueMax = projectBounds.end || undefined;

  const titleError = textLengthError(title, 'Task title', { required: true, max: INPUT_LIMITS.TASK_TITLE });
  const visibleTitleError = titleTouched || submitted || !title.trim() ? titleError : '';

  const dateValidation = datesChanged ? timelineError(task, dates, undefined, projectBounds) : undefined;
  const startDateError = startInvalidText
    ? 'Enter a valid start date in MM/DD/YYYY format.'
    : dateValidation && /start date/i.test(dateValidation) && !/due date cannot be before/i.test(dateValidation)
      ? dateValidation
      : '';
  const dueDateError = dueInvalidText
    ? 'Enter a valid due date in MM/DD/YYYY format.'
    : dateValidation && !startDateError
      ? dateValidation
      : '';

  const requiresChangeReason = Boolean(policy?.started && dueWritable && dueChanged);
  const reasonError = requiresChangeReason
    ? textLengthError(changeReason, 'Reason for due-date change', { required: true, min: 5, max: INPUT_LIMITS.REASON })
    : '';
  const visibleReasonError = requiresChangeReason && (reasonTouched || submitted || changeReason.trim().length > 0) ? reasonError : '';

  const prerequisiteError = task.linkedProjectId && dependenciesChanged && !policy?.started
    ? projectPrerequisiteError(tasks, task.linkedProjectId, task.id, prerequisites, task.dependencyIds)
    : '';

  const submitBlockers = !verified
    ? [policyError || 'Task editing access could not be verified.']
    : !detailsWritable
      ? ['You do not have permission to edit this task.']
      : [
          startDateError,
          dueDateError,
          !dirty ? 'Make a change before saving.' : '',
          titleError,
          reasonError,
          prerequisiteError,
        ].filter(Boolean);
  const submitDisabled = busy || policyLoading || submitBlockers.length > 0;

  async function submit() {
    setSubmitted(true);
    if (pending.current || !verified || !detailsWritable) return;
    setError('');
    if (titleError || startDateError || dueDateError || dateValidation || reasonError || prerequisiteError) return;
    pending.current = true;
    setBusy(true);
    try {
      if (policy?.started) {
        const patch: WorkspaceTaskPatch = {};
        if (title.trim() !== task.title) patch.title = title.trim();
        if (priority !== task.priority) patch.priority = priority;
        if (dueChanged) {
          if (!dueWritable) throw new Error('Only the supervising Lead or authorized Office Head can reschedule this task.');
          if (changeReason.trim().length < 5 || changeReason.trim().length > INPUT_LIMITS.REASON) {
            throw new Error('Reason for due-date change must be 5–1,000 characters.');
          }
          patch.deadline = dates.end;
          patch.change_reason = changeReason.trim();
        }
        if (Object.keys(patch).length) await save(patch);
      } else {
        if (dependenciesChanged) {
          if (!planningWritable) throw new Error('Current access does not allow changing prerequisites.');
          const issue = projectPrerequisiteError(tasks, task.linkedProjectId, task.id, prerequisites, task.dependencyIds);
          if (issue) throw new Error(issue);
        }
        await save({
          title: title.trim(),
          priority,
          ...(datesChanged ? timelinePatch(task, dates, undefined, projectBounds) : {}),
          ...(dependenciesChanged ? { dependency_ids: prerequisites } : {}),
        });
      }
      onClose();
    } catch (reason) {
      setError(readableUiError(reason, 'Could not edit task.', 'write'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      isOpen
      title="Edit task"
      description="Update task details within the project schedule."
      width="max-w-2xl"
      onClose={close}
      preventClose={busy}
      footer={
        <div className="pf-actions">
          <button type="button" disabled={busy} onClick={close}>Cancel</button>
          <ActionBlockerGroup actionLabel="Save task" blockers={submitBlockers} busy={busy || policyLoading}>
            <button type="button" className="pf-primary" disabled={submitDisabled} onClick={() => void submit()}>
              {busy ? 'Saving…' : 'Save task'}
            </button>
          </ActionBlockerGroup>
        </div>
      }
    >
      <div className="space-y-4">
        {policyLoading && (
          <div role="status" className="flex items-center gap-2.5 rounded-xl border border-[var(--eflow-border,#d5e2df)] bg-[var(--eflow-subtle,#f6f9f8)] px-3.5 py-2.5 text-[13px] text-[var(--eflow-text-secondary,#52746c)]">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#087972]" aria-hidden="true" />
            <span>Checking current task editing access…</span>
          </div>
        )}
        {policyError && <p role="alert" className="pf-error">{policyError} Editing is unavailable until access can be verified.</p>}
        {policy?.started && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-[#bfd8f8] bg-[#f0f7ff] px-4 py-3.5 text-[#123761] dark:border-sky-800/70 dark:bg-sky-950/50 dark:text-sky-100">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#dcebfb] text-[#0067d3] dark:bg-sky-900/80 dark:text-sky-300">
              <Info className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-semibold leading-tight text-[#0d2d52] dark:text-sky-50">Editing rules for in-progress work</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#dcebfb] px-2 py-0.5 text-[11px] font-medium text-[#0058b8] dark:bg-sky-900/80 dark:text-sky-200">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Schedule locked
                </span>
              </div>
              <p className="m-0 text-[12.5px] leading-relaxed text-[#264b75] dark:text-sky-200/90">Work is already in progress. Start date and prerequisites cannot be changed. Authorized editors can correct the title and priority; due-date changes require supervising authority and a reason.</p>
            </div>
          </div>
        )}
        {error && <div role="alert" className="pf-error">{error}</div>}
        <fieldset className="pf-panel" disabled={busy || !verified}>
          <div>
            <label htmlFor={titleId}>
              Task title <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <BoundedTextInput
              id={titleId}
              value={title}
              disabled={busy || !detailsWritable}
              maxLength={INPUT_LIMITS.TASK_TITLE}
              aria-required="true"
              error={visibleTitleError || undefined}
              onBlur={() => setTitleTouched(true)}
              onChange={event => { setTitle(event.target.value); setError(''); }}
            />
          </div>
          <div className="pf-grid">
            <div>
              <label htmlFor={priorityId}>Priority</label>
              <select
                id={priorityId}
                value={priority}
                disabled={busy || !detailsWritable}
                onChange={event => { setPriority(event.target.value as Task['priority']); setError(''); }}
              >
                {['low', 'medium', 'high'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={startDateId}>Start date</label>
              <DateInput
                id={startDateId}
                min={startMin || undefined}
                max={startMax}
                value={dates.start}
                hasError={Boolean(startDateError)}
                errorMessage={startDateError || undefined}
                onInvalidTextChange={setStartInvalidText}
                disabled={busy || !planningWritable}
                onChange={event => { setDates({ ...dates, start: event.target.value }); setError(''); }}
              />
              {startDateError && <p role="alert" className="eflow-field-error mt-1 text-xs">{startDateError}</p>}
            </div>
            <div>
              <label htmlFor={dueDateId}>Due date</label>
              <DateInput
                id={dueDateId}
                min={dueMin}
                max={dueMax}
                value={dates.end}
                hasError={Boolean(dueDateError)}
                errorMessage={dueDateError || undefined}
                onInvalidTextChange={setDueInvalidText}
                disabled={busy || !dueWritable}
                onChange={event => { setDates({ ...dates, end: event.target.value }); setError(''); }}
              />
              {dueDateError && <p role="alert" className="eflow-field-error mt-1 text-xs">{dueDateError}</p>}
              {requiresChangeReason && (
                <div className="mt-3">
                  <label htmlFor={reasonId}>
                    Reason for due-date change <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
                  </label>
                  <BoundedTextarea
                    id={reasonId}
                    rows={2}
                    value={changeReason}
                    maxLength={INPUT_LIMITS.REASON}
                    aria-required="true"
                    error={visibleReasonError || undefined}
                    placeholder="Explain why the due date is changing (min. 5 characters)…"
                    onBlur={() => setReasonTouched(true)}
                    onChange={event => { setChangeReason(event.target.value); setError(''); }}
                  />
                </div>
              )}
            </div>
          </div>
          {task.linkedProjectId && (
            <div>
              <PrerequisiteField
                label="Prerequisite tasks"
                choices={projectPrerequisiteChoices(tasks, task.linkedProjectId, task.id, task.dependencyIds)}
                selected={prerequisites}
                disabled={!planningWritable || policy?.started}
                onChange={next => { setPrerequisites(next); setError(''); }}
              />
              {prerequisiteError && <p role="alert" className="eflow-field-error mt-1 text-xs">{prerequisiteError}</p>}
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
}
