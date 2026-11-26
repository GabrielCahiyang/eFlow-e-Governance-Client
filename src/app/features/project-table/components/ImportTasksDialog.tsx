import { useId, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { BoundedTextarea } from '../../../components/ui/BoundedInput';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import type { ProjectGroup } from '../types';
import { createWorkspaceTask } from '../services/workspaceService';

export function ImportTasksDialog({ open, onClose, projectId, groups, initialText = '' }: { open: boolean; onClose: () => void; projectId: string; groups: ProjectGroup[]; initialText?: string }) {
  const groupSelectId = useId();
  const groupTooltipId = useId();
  const titlesId = useId();
  const groupRef = useRef<HTMLSelectElement | null>(null);
  const [text, setText] = useState(initialText);
  const [groupId, setGroupId] = useState('');
  const [groupTouched, setGroupTouched] = useState(false);
  const [groupFocused, setGroupFocused] = useState(false);
  const [groupHovered, setGroupHovered] = useState(false);
  const [titlesTouched, setTitlesTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const effectiveGroupId = groupId || groups[0]?.id || '';
  const titles = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const groupError = !groups.length
    ? 'Create a group in this project before importing tasks.'
    : !effectiveGroupId
      ? 'Choose a destination group.'
      : '';
  const visibleGroupError = !groups.length || groupTouched || submitted ? groupError : '';

  const hasLongTitle = titles.some(t => t.length > INPUT_LIMITS.TASK_TITLE);
  const titlesError = !titles.length
    ? 'Enter at least one task title (one per line).'
    : titles.length > 100
      ? `Import up to 100 tasks at a time (${titles.length} entered — remove ${titles.length - 100}).`
      : hasLongTitle
        ? 'Keep task titles under 300 characters.'
        : '';
  const visibleTitlesError = titles.length > 100 || hasLongTitle || ((titlesTouched || submitted) && !titles.length)
    ? titlesError
    : '';

  const submitBlockers = [groupError, titlesError].filter(Boolean);
  const submitDisabled = busy || submitBlockers.length > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !busy) onClose(); }}>
      <DialogContent className="pt-small-dialog" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogTitle>Import tasks</DialogTitle>
        <DialogDescription>Paste one task title per line. Review the list before adding it to this project. Up to 100 tasks per import.</DialogDescription>
        <form
          noValidate
          className="pt-popover-form"
          onSubmit={async e => {
            e.preventDefault();
            setSubmitted(true);
            if (busy || groupError || titlesError) return;
            setBusy(true);
            setMessage('');
            let created = 0;
            try {
              for (const title of titles) {
                await createWorkspaceTask(projectId, effectiveGroupId, title);
                created++;
                setText(titles.slice(created).join('\n'));
              }
              setMessage(`${created} tasks added.`);
            } catch (err) {
              setMessage(`${created} tasks added. Remaining titles retained for retry. ${err instanceof Error ? err.message : 'Import failed.'}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="eflow-form-field">
            <label htmlFor={groupSelectId}>
              Destination group <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <select
              ref={groupRef}
              id={groupSelectId}
              value={effectiveGroupId}
              aria-required="true"
              aria-invalid={Boolean(visibleGroupError) || undefined}
              aria-describedby={visibleGroupError ? `${groupSelectId}-error` : undefined}
              className={visibleGroupError ? 'eflow-field-invalid' : undefined}
              onFocus={() => setGroupFocused(true)}
              onBlur={() => { setGroupFocused(false); setGroupTouched(true); }}
              onMouseEnter={() => setGroupHovered(true)}
              onMouseLeave={() => setGroupHovered(false)}
              onChange={e => { setGroupId(e.target.value); setMessage(''); }}
              disabled={busy || !groups.length}
            >
              {!groups.length && <option value="">No groups available</option>}
              {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
            <FieldValidationTooltip
              id={groupTooltipId}
              anchorRef={groupRef}
              message={visibleGroupError}
              open={Boolean(visibleGroupError) && (groupFocused || groupHovered)}
              tone="error"
            />
            {visibleGroupError && <span id={`${groupSelectId}-error`} role="alert" className="eflow-field-error text-xs">{visibleGroupError}</span>}
          </div>

          <div className="eflow-form-field">
            <label htmlFor={titlesId}>
              Task titles <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
            </label>
            <BoundedTextarea
              id={titlesId}
              aria-label="Task titles to import"
              aria-required="true"
              rows={9}
              maxLength={30100}
              value={text}
              error={visibleTitlesError || undefined}
              onBlur={() => setTitlesTouched(true)}
              onChange={e => { setText(e.target.value); setMessage(''); }}
              disabled={busy}
            />
          </div>

          <p>{titles.length} tasks ready to add</p>
          {message && <p role="status">{message}</p>}
          <ActionBlockerGroup actionLabel="Add to project" blockers={submitBlockers} busy={busy}>
            <button type="submit" className="pt-primary" disabled={submitDisabled}>
              {busy ? 'Adding tasks…' : 'Add to project'}
            </button>
          </ActionBlockerGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
