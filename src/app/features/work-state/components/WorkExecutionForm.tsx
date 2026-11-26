import { readableUiError } from '../../../shared/userFacingError';
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { BoundedTextInput, BoundedTextarea } from '../../../components/ui/BoundedInput';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@vibe/core';
import { AlertCircle, CheckCircle2, CirclePause, FileUp, MessageSquareText, Paperclip, Send, X } from 'lucide-react';
import { useExplicitDraft } from '../../../shared/useExplicitDraft';
import { attachmentError, EVIDENCE_ACCEPT } from '../../../shared/fileValidation';
import type { WorkUpdate } from '../types';
import { CustomWorkStatusSelect, resolveStatus, useWorkStatuses, type WorkStatusTarget } from '../../work-status';
import { workStateLabel } from '../selectors';
import './workState.css';

export function WorkExecutionForm({ status, readOnly = false, disabled = false, loading = false, disabledReason = null, canSubmit = true, submitBlockedReason = null, blockedBy, onSave, onSubmit, onCommitted, initialAction, initialBlocker = '', completionMode = 'review', freezeFields = false, statusTarget }: {
  statusTarget?: WorkStatusTarget;
  completionMode?: 'review' | 'direct'; freezeFields?: boolean; initialAction?: 'stuck' | 'submit'; status: string; readOnly?: boolean; disabled?: boolean; loading?: boolean; disabledReason?: string | null; canSubmit?: boolean; submitBlockedReason?: string | null; blockedBy?: string; initialBlocker?: string;
  onSave: (update: WorkUpdate) => Promise<void>; onSubmit?: (update: WorkUpdate) => Promise<void>; onCommitted?: (submitted: boolean) => void;
}) {
  const blockerId = useId();
  const noteId = useId();
  const nextStepId = useId();
  const [mode, setMode] = useState<'in_progress' | 'stuck' | 'submit'>(initialAction || (initialBlocker ? 'stuck' : 'in_progress'));
  const [blocker, setBlocker] = useState(initialBlocker);
  const [note, setNote] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [blockerTouched, setBlockerTouched] = useState(false);
  const [noteTouched, setNoteTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirmedBlocker = useRef(initialBlocker);
  const reset = () => { setNote(''); setNextStep(''); setFiles([]); setFileError(''); setError(''); setBlockerTouched(false); setNoteTouched(false); setSubmitted(false); };
  const dirty = freezeFields || !!note || !!nextStep || files.length > 0 || blocker !== initialBlocker;
  const guard = useExplicitDraft('Work update', dirty, busy, reset);

  useEffect(() => {
    if (!freezeFields && !busy && !note && !nextStep && !files.length && blocker === confirmedBlocker.current) {
      setMode(initialAction || (initialBlocker ? 'stuck' : 'in_progress'));
      setBlocker(initialBlocker);
    }
    confirmedBlocker.current = initialBlocker;
  }, [initialBlocker]);

  const submit = mode === 'submit';
  const direct = completionMode === 'direct';
  const fieldsLocked = busy || disabled || freezeFields;
  const { definitions } = useWorkStatuses();
  const displayStatus = resolveStatus(definitions, initialBlocker && status === 'in_progress' ? 'stuck' : status, direct && status === 'for_review' ? 'Ready to finish' : workStateLabel(status, !!initialBlocker), statusTarget?.customId);

  const noteRequired = submit && !direct;
  const blockerError = mode === 'stuck'
    ? (blocker.trim() ? textLengthError(blocker, 'Blocker reason', { max: INPUT_LIMITS.FUNDING_REASON }) : 'Tell your lead what is blocking you.')
    : '';
  const visibleBlockerError = mode === 'stuck' && (blockerTouched || submitted) ? blockerError : '';

  const noteError = noteRequired
    ? (note.trim() ? textLengthError(note, 'Completion note', { max: INPUT_LIMITS.FUNDING_REASON }) : 'Add a completion note for the reviewer.')
    : textLengthError(note, 'Work update', { max: INPUT_LIMITS.FUNDING_REASON });
  const visibleNoteError = (noteTouched || submitted) ? noteError : '';

  const nextStepError = !submit ? textLengthError(nextStep, 'Next step', { max: INPUT_LIMITS.TASK_TITLE }) : '';

  const submitBusy = busy || loading;
  const submitBlockers = [
    disabled && !loading ? (disabledReason || 'Updating this work is currently unavailable.') : '',
    fileError,
    submit && !canSubmit
      ? (submitBlockedReason || (direct ? 'This step cannot be marked complete right now.' : 'This work cannot be submitted for review right now.'))
      : '',
    submit && !direct && !note.trim() ? 'Add a completion note for the reviewer.' : '',
  ].filter(Boolean);
  const submitDisabled = submitBusy || disabled || submitBlockers.length > 0;
  const submitActionLabel = submit
    ? (direct ? (freezeFields ? 'Retry completion' : 'Mark complete') : 'Submit for review')
    : status === 'todo'
      ? 'Start work'
      : mode === 'stuck'
        ? 'Report blocker'
        : 'Save update';

  async function save() {
    setSubmitted(true);
    if (readOnly || disabled || busy || guard.pendingRef.current || blockedBy) return;
    const issue = attachmentError(files, { maxCount: submit ? 10 : 1 });
    if (issue) { setFileError(issue); return; }
    if (blockerError || noteError || nextStepError) return;
    const clearingBlocker = Boolean(initialBlocker.trim());
    const hasUpdateContent = Boolean(note.trim() || nextStep.trim() || files.length > 0);
    if (mode === 'in_progress' && status !== 'todo' && !clearingBlocker && !hasUpdateContent) {
      setError('Enter an update note, next step, or attach a file before saving.');
      return;
    }
    guard.pendingRef.current = true; setBusy(true); setError(''); setFileError('');
    try {
      const input: WorkUpdate = { state: mode === 'stuck' ? 'stuck' : 'in_progress', blocker: mode === 'stuck' ? blocker.trim() : '', note: note.trim(), nextStep: nextStep.trim(), files };
      if (submit) { if (!canSubmit || !onSubmit) return; await onSubmit(input); } else await onSave(input);
      reset(); setMode(mode === 'stuck' ? 'stuck' : 'in_progress'); if (mode !== 'stuck') setBlocker(''); guard.markClean(); window.dispatchEvent(new CustomEvent('eflow:work-updated')); onCommitted?.(submit);
    } catch (reason) { setError(readableUiError(reason, "Could not save. Your update is still here.", 'write')); }
    finally { guard.pendingRef.current = false; setBusy(false); }
  }

  if (['completed', 'cancelled'].includes(status) || !direct && status === 'for_review') return <div className="work-state-message" role="status"><CheckCircle2 size={20} /><div><strong>{resolveStatus(definitions, status, workStateLabel(status)).label}</strong><p>{status === 'for_review' ? 'Your submission is with the assigned reviewer.' : status === 'completed' ? direct ? 'This step is complete.' : 'The reviewer approved this work.' : 'This work is closed.'}</p></div></div>;
  if (blockedBy) return <div className="work-state-message" role="status"><CirclePause size={20} /><div><strong>Waiting for prerequisites</strong><p>{blockedBy}</p></div></div>;
  if (readOnly) return <p className="work-state-muted">Only the assigned team can update this work.</p>;

  return <section className="work-execution" aria-label="Work status and update">
    <div className="work-execution-heading"><div className="work-execution-intro"><span className="work-execution-icon"><MessageSquareText size={21} aria-hidden="true" /></span><div><h3>Update work</h3><p>{!onSubmit ? 'Share progress or flag a blocker. Completion goes through Lead review when ready.' : direct ? 'Post a progress update or mark this step complete.' : 'Share progress, flag a blocker or submit finished work.'}</p></div></div>
      <label className="work-status-choice">Status<select aria-label="Work status" disabled={fieldsLocked} value={mode} onChange={event => { setMode(event.target.value as typeof mode); setError(''); setFileError(''); setSubmitted(false); }}>
        <option value="in_progress">{resolveStatus(definitions, 'in_progress', 'In progress').label}</option><option value="stuck">{resolveStatus(definitions, 'stuck', 'Stuck').label}</option>{onSubmit && <option value="submit" disabled={!canSubmit}>{direct ? 'Mark complete' : 'Submit finished work'}</option>}
      </select></label></div>
    {onSubmit && !canSubmit && submitBlockedReason && <p className="work-state-muted" role="status" data-testid="mark-complete-blocked">Mark complete is unavailable: {submitBlockedReason}</p>}
    <div className="work-execution-current"><span>Current status</span><strong style={displayStatus.color ? { borderInlineStart: `3px solid ${displayStatus.color}` } : undefined}>{displayStatus.label}</strong></div>
    {status === 'in_progress' && !initialBlocker && !fieldsLocked && statusTarget && <CustomWorkStatusSelect {...statusTarget} />}
    {!direct && status === 'changes_requested' && <p className="work-state-message">Changes requested. Check the feedback, then submit your revised work.</p>}
    {mode === 'stuck' && (
      <div className="grid gap-1">
        <label htmlFor={blockerId}>
          What is blocking you? <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
        </label>
        <BoundedTextarea
          id={blockerId}
          aria-label="Blocker reason"
          aria-required="true"
          maxLength={INPUT_LIMITS.FUNDING_REASON}
          rows={3}
          value={blocker}
          error={visibleBlockerError || undefined}
          disabled={fieldsLocked}
          onBlur={() => setBlockerTouched(true)}
          onChange={event => { setBlocker(event.target.value); if (error) setError(''); }}
          placeholder="Tell your lead what you need to continue."
        />
      </div>
    )}
    <div className="grid gap-1">
      <label htmlFor={noteId}>
        {submit
          ? (direct
              ? 'Completion note (optional)'
              : <>Completion note <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span></>)
          : 'Update (optional)'}
      </label>
      <BoundedTextarea
        id={noteId}
        aria-label={submit ? 'Completion note' : 'Work update'}
        aria-required={noteRequired || undefined}
        maxLength={INPUT_LIMITS.FUNDING_REASON}
        rows={5}
        value={note}
        error={visibleNoteError || undefined}
        disabled={fieldsLocked}
        onBlur={() => setNoteTouched(true)}
        onChange={event => { setNote(event.target.value); if (error) setError(''); }}
        placeholder={submit ? direct ? 'Add any useful completion details.' : 'Describe what you finished and what the reviewer should check.' : 'What changed since your last update?'}
      />
    </div>
    {!submit && (
      <div className="grid gap-1">
        <label htmlFor={nextStepId}>Next step (optional)</label>
        <BoundedTextInput
          id={nextStepId}
          aria-label="Next step"
          maxLength={INPUT_LIMITS.TASK_TITLE}
          error={nextStepError || undefined}
          disabled={fieldsLocked}
          value={nextStep}
          onChange={event => { setNextStep(event.target.value); if (error) setError(''); }}
          placeholder="What will you work on next?"
        />
      </div>
    )}
    <div className="work-evidence-upload">
      <label className="work-evidence-picker" data-disabled={fieldsLocked || undefined}>
        <span className="work-evidence-icon"><FileUp size={22} aria-hidden="true" /></span>
        <span><strong>{submit ? 'Add evidence (optional)' : 'Attach a file (optional)'}</strong><small>Images, PDF, Word or Excel · up to 25 MB per file</small></span>
        <input
          className="work-evidence-input"
          aria-label={submit ? 'Evidence files' : 'Update attachment'}
          type="file"
          accept={EVIDENCE_ACCEPT}
          multiple={submit}
          disabled={fieldsLocked}
          onChange={event => {
            const chosen = Array.from(event.target.files || []);
            const issue = attachmentError(chosen, { maxCount: submit ? 10 : 1 });
            if (issue) {
              setFileError(issue);
            } else {
              setFileError('');
              setFiles(chosen);
              if (error) setError('');
            }
            event.target.value = '';
          }}
        />
      </label>
      {fileError && <p role="alert" className="eflow-field-error mt-1.5 text-xs">{fileError}</p>}
    </div>
    {files.length > 0 && <ul className="work-evidence-files">{files.map((file, index) => <li key={`${file.name}:${index}`}><Paperclip size={15} /><span>{file.name}</span><WorkspaceTooltip content="Remove attachment" disabled={fieldsLocked}><button type="button" aria-label={`Remove ${file.name}`} disabled={fieldsLocked} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); setFileError(''); if (error) setError(''); }}><X size={16} /></button></WorkspaceTooltip></li>)}</ul>}
    {error && <div role="alert" className="work-state-error"><AlertCircle size={18} aria-hidden="true" /><div><strong>{submit ? direct ? "Could not complete this subtask" : "Could not submit this task" : "Could not save this update"}</strong><p>{error}</p></div></div>}
    <div className="work-execution-footer">
      <p>{submit ? direct ? 'Marking complete finishes this subtask step; parent task approval stays with the task.' : 'Your completion note and any attached files go to the reviewer.' : 'Updates are shared with your task team.'}</p>
      <ActionBlockerGroup actionLabel={submitActionLabel} blockers={submitBlockers} busy={submitBusy} size="md">
        <Button size="medium" disabled={submitDisabled} onClick={() => void save()}>
          {busy ? 'Saving…' : submit ? <><Send size={16} />{direct ? freezeFields ? 'Retry completion' : 'Mark complete' : 'Submit for review'}</> : status === 'todo' ? 'Start work' : mode === 'stuck' ? 'Report blocker' : 'Save update'}
        </Button>
      </ActionBlockerGroup>
    </div>
  </section>;
}
