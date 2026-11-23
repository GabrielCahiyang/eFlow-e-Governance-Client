import { useId, useRef, useState } from 'react';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { SelectInput } from '../../../components/ui/FormField';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { Button } from '../../../components/ui/button';
import { requestNavigation, useNavigationBlocker } from '../../../shared/navigationGuard';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import { createProjectGroup, createWorkspaceTask, patchWorkspaceTask } from '../services/workspaceService';
import type { ProjectGroup } from '../types';
import { duplicateWorkNameError } from '../../../shared/workNames';
import { useTasks } from '../../../hooks/useFirebaseData';
import { PrerequisiteField } from '../../../components/ui/workspace/PrerequisiteField';
import { projectPrerequisiteChoices, projectPrerequisiteError } from '../selectors';

/** Explicit creation from the toolbar; inline rows continue creating on blur. */
export function CreateWorkDialog({ kind, projectId, groups, onClose, onCreated }: { kind: 'task' | 'group'; projectId: string; groups: ProjectGroup[]; onClose: () => void; onCreated?: () => void }) {
  const { tasks } = useTasks();
  const titleId = useId();
  const groupIdAttr = useId();
  const groupTooltipId = useId();
  const groupWrapRef = useRef<HTMLDivElement | null>(null);
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [created, setCreated] = useState(false);
  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [titleTouched, setTitleTouched] = useState(false);
  const [groupTouched, setGroupTouched] = useState(false);
  const [groupFocused, setGroupFocused] = useState(false);
  const [groupHovered, setGroupHovered] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [prereqSubmitError, setPrereqSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false), originalGroup = useRef(groupId);
  const dirty = !created && (Boolean(title.trim()) || groupId !== originalGroup.current || prerequisites.length > 0);
  useNavigationBlocker({ label: `New ${kind}`, dirty, pending: busy, pendingCheck: () => pending.current, onDiscard: () => { setTitle(''); setSubmitError(''); setPrereqSubmitError(''); onClose(); } });
  const close = () => { void requestNavigation(() => { if (!dirty) onClose(); }); };

  const titleMax = kind === 'task' ? INPUT_LIMITS.TASK_TITLE : INPUT_LIMITS.GROUP_TITLE;
  const titleLabel = kind === 'task' ? 'Task name' : 'Group name';
  const duplicateIssue = title.trim()
    ? duplicateWorkNameError(
        title,
        kind === 'group' ? groups : tasks.filter(task => task.linkedProjectId === projectId && task.groupId === groupId),
        kind === 'group' ? 'Group' : 'Task',
      ) || ''
    : '';
  const titleError = textLengthError(title, titleLabel, { required: true, max: titleMax }) || duplicateIssue;
  const visibleTitleError = titleTouched || submitted || Boolean(duplicateIssue) ? titleError : '';

  const groupError = kind === 'task'
    ? (!groups.length ? 'Add a group to this project before creating a task.' : !groupId ? 'Choose a group for this task.' : '')
    : '';
  const visibleGroupError = kind === 'task' && (!groups.length || groupTouched || submitted) ? groupError : '';

  const livePrereqError = kind === 'task' ? projectPrerequisiteError(tasks, projectId, '', prerequisites) : '';
  const visiblePrereqError = livePrereqError || prereqSubmitError;

  const submitDisabledReason = busy
    ? `Adding ${kind}…`
    : titleError
      ? titleError
      : groupError
        ? groupError
        : livePrereqError
          ? livePrereqError
          : '';
  const submitDisabled = Boolean(submitDisabledReason);

  return <FeatureDialog title={`New ${kind}`} onClose={close} preventClose={busy} contentClassName="pt-small-dialog pt-create-work-dialog">
    <form noValidate className="pt-planning-form" aria-busy={busy} onSubmit={event => {
      event.preventDefault();
      setSubmitted(true);
      if (created || pending.current || titleError || groupError || livePrereqError) return;
      pending.current = true; setBusy(true); setSubmitError(''); setPrereqSubmitError('');
      void (async () => {
        try {
          if (kind === 'task') {
            const task = await createWorkspaceTask(projectId, groupId, title);
            if (prerequisites.length) {
              try { await patchWorkspaceTask(task.id, { dependency_ids: prerequisites }); }
              catch (reason) {
                setCreated(true);
                setPrereqSubmitError(`Task created. Open Edit task to verify or save its prerequisites. ${reason instanceof Error ? reason.message : ''}`);
                onCreated?.();
                return;
              }
            }
          }
          else await createProjectGroup(projectId, title, Math.max(-1, ...groups.map(group => group.position)) + 1);
          // Close the committed draft before any refresh; refresh failure must not recreate it.
          setTitle(''); pending.current = false; setBusy(false); onClose(); onCreated?.();
        } catch (caught) { setSubmitError(caught instanceof Error ? caught.message : `Could not add ${kind}.`); }
        finally { pending.current = false; setBusy(false); }
      })();
    }}>
      <h2>New {kind}</h2><p>{kind === 'task' ? 'Add work to this project. Appoint its owner and set details in the table.' : 'Organize related tasks without changing their workflow.'}</p>
      <div className="eflow-form-field">
        <label className="eflow-field-label" htmlFor={titleId}>
          {titleLabel}
          <span className="eflow-field-required" aria-hidden="true"> *</span>
        </label>
        <BoundedTextInput
          id={titleId}
          autoFocus
          value={title}
          maxLength={titleMax}
          error={visibleTitleError || undefined}
          aria-required="true"
          disabled={busy || created}
          className="eflow-form-input h-10 w-full rounded-lg border border-border bg-input-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15"
          onBlur={() => setTitleTouched(true)}
          onChange={event => { setTitle(event.target.value); setSubmitError(''); }}
        />
      </div>
      {kind === 'task' && <>
        <div className="eflow-form-field">
          <label className="eflow-field-label" htmlFor={groupIdAttr}>
            Group
            <span className="eflow-field-required" aria-hidden="true"> *</span>
          </label>
          <div
            ref={groupWrapRef}
            onMouseEnter={() => setGroupHovered(true)}
            onMouseLeave={() => setGroupHovered(false)}
          >
            <SelectInput
              id={groupIdAttr}
              value={groupId}
              placeholder={!groups.length ? 'No groups available' : 'Choose a group'}
              options={groups.map(group => ({ value: group.id, label: group.title }))}
              hasError={Boolean(visibleGroupError)}
              aria-required="true"
              aria-invalid={Boolean(visibleGroupError) || undefined}
              aria-describedby={visibleGroupError ? `${groupIdAttr}-error` : undefined}
              disabled={busy || created || !groups.length}
              onFocus={() => setGroupFocused(true)}
              onBlur={() => { setGroupFocused(false); setGroupTouched(true); }}
              onChange={event => { setGroupId(event.target.value); setSubmitError(''); }}
            />
          </div>
          <FieldValidationTooltip
            id={groupTooltipId}
            anchorRef={groupWrapRef}
            message={visibleGroupError}
            open={Boolean(visibleGroupError) && (groupFocused || groupHovered)}
            tone="error"
          />
          {visibleGroupError && <span id={`${groupIdAttr}-error`} role="alert" className="eflow-field-error">{visibleGroupError}</span>}
        </div>
        <div>
          <PrerequisiteField
            label="Prerequisite tasks"
            choices={projectPrerequisiteChoices(tasks, projectId)}
            selected={prerequisites}
            disabled={busy || created}
            onChange={next => { setPrerequisites(next); setPrereqSubmitError(''); setSubmitError(''); }}
          />
          {visiblePrereqError && <span role="alert" className="eflow-field-error mt-1 block">{visiblePrereqError}</span>}
        </div>
      </>}
      {submitError && <p role="alert" className="eflow-field-error">{submitError}</p>}
      <div className="pt-planning-actions">
        <Button type="button" variant="outline" disabled={busy} onClick={close}>{created ? 'Close' : 'Cancel'}</Button>
        {!created && (
          <WorkspaceTooltip content={submitDisabledReason} disabled={!submitDisabledReason}>
            <span className="inline-flex">
              <Button type="submit" disabled={submitDisabled}>{busy ? 'Adding…' : `Add ${kind}`}</Button>
            </span>
          </WorkspaceTooltip>
        )}
      </div>
    </form>
  </FeatureDialog>;
}
