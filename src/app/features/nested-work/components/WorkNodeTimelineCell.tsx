import { useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DeadlineBadge } from '../../../components/ui/DeadlineBadge';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { getPhilippineCalendarDate, isCalendarDate } from '../../../shared/calendarDates';
import { formatManilaDate } from '../../../shared/calendarDisplay';
import { usePlanningEditor } from '../../../shared/usePlanningEditor';
import { useWorkImpactConfirmation } from '../hooks/useWorkImpactConfirmation';
import { isCurrentWorkSnapshot, selectNodeWorkCapability } from '../selectors/capabilities';
import { readNodeDetailEditState } from '../selectors/detailEditing';
import { subtaskDateLimits } from '../selectors/subtaskDates';
import { fetchWorkTree } from '../services/workTreeService';
import type { WorkCapabilityContext, WorkNode, WorkRequest, WorkTreeController, WorkTreeSnapshot } from '../types';

interface SubtaskTimelineDraft {
  start: string;
  end: string;
  reason: string;
}

function subtaskTimelineError(
  draft: SubtaskTimelineDraft,
  original: SubtaskTimelineDraft,
  bounds: ReturnType<typeof subtaskDateLimits>,
  started: boolean,
  planning: boolean,
  canChangeDue: boolean,
  reason: string,
  today: string,
): string | undefined {
  for (const day of [draft.start, draft.end]) {
    if (day && !isCalendarDate(day)) return 'Enter a valid date.';
  }
  if (!planning && draft.start !== original.start) return 'The planned start date is locked for this subtask.';
  if (started && draft.start !== original.start) return 'Started subtasks keep their start date.';
  if (!canChangeDue && draft.end !== original.end) return 'You do not have permission to change this due date.';
  if (original.start && !draft.start) return 'Start date cannot be cleared once set.';
  if (draft.start && draft.end && draft.start > draft.end) return 'Due date cannot be before the start date.';
  if ((draft.start !== original.start && draft.start && bounds.earliest && draft.start < bounds.earliest) || (draft.start !== original.start && draft.start && bounds.latest && draft.start > bounds.latest) || (draft.end !== original.end && draft.end && bounds.latest && draft.end > bounds.latest) || (draft.end !== original.end && draft.end && bounds.earliest && draft.end < bounds.earliest)) {
    return 'Subtask dates must stay within the parent schedule.';
  }
  if (draft.end && draft.end !== original.end) {
    if (draft.end < today) return 'Choose today or a future due date.';
  }
  if (draft.start && draft.start !== original.start) {
    if (draft.start < today) return 'Choose today or a future start date.';
  }
  if (draft.end !== original.end && (!reason.trim() || reason.trim().length > 1000)) return 'Enter a due-date change reason from 1 to 1,000 characters.';
  return undefined;
}

export interface WorkNodeTimelineCellProps {
  node: WorkNode;
  snapshot: WorkTreeSnapshot;
  context: WorkCapabilityContext;
  controller?: WorkTreeController;
  parentStartDate?: string;
  disabled?: boolean;
}

export function WorkNodeTimelineCell({ node, snapshot, context, controller, parentStartDate, disabled = false }: WorkNodeTimelineCellProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const focusAfterSave = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const start = (node.start_date || '').slice(0, 10);
  const due = (node.due_date || '').slice(0, 10);
  const effectiveStatus = node.effective_status || node.status;
  const policy = readNodeDetailEditState(node, snapshot.root.id);
  const policyRequired = snapshot.root.kind === 'office';
  const started = Boolean(node.started_at || policy?.started);
  const canEdit = !disabled && !!controller && (!policyRequired || !!policy?.details) && selectNodeWorkCapability(snapshot, node.id, 'edit_details', context).allowed;

  const editor = usePlanningEditor<SubtaskTimelineDraft>(
    () => ({ start, end: due, reason: '' }),
    'Subtask timeline: ' + node.title,
    { closeOnSuccess: true },
  );
  const confirmation = useWorkImpactConfirmation(snapshot.root.id);
  const dateBounds = subtaskDateLimits(snapshot, node.parent_subtask_id || '');
  const earliestBounds = [dateBounds.earliest, parentStartDate?.slice(0, 10)].filter((value): value is string => !!value).sort();
  const bounds = { ...dateBounds, earliest: earliestBounds[earliestBounds.length - 1] };
  const today = snapshot.root.scheduling?.today || getPhilippineCalendarDate();
  const minBound = bounds.earliest && bounds.earliest > today ? bounds.earliest : today;
  const startLocked = (policyRequired && !policy?.planning) || started;
  const dueLocked = policyRequired && !policy?.due;
  const validation = editor.dirty ? subtaskTimelineError(editor.draft, { start, end: due, reason: '' }, bounds, started, !policyRequired || !!policy?.planning && !started, !policyRequired || !!policy?.due, editor.draft.reason, today) : undefined;

  const startText = start ? formatManilaDate(start, start) : '';
  const dueText = due ? formatManilaDate(due, due) : 'Set dates';

  return (
    <>
      <Popover open={editor.open} onOpenChange={next => { if (!confirming) editor.onOpenChange(next); }}>
        <PopoverTrigger asChild>
          <button
            ref={trigger}
            type="button"
            className="pt-date"
            disabled={!canEdit}
            title={`${start ? start + ' → ' : ''}${due || 'Set dates'}`}
            aria-label={'Edit dates for ' + node.title}
          >
            <Calendar size={14} aria-hidden="true" />
            <span className="pt-date-label">
              <span>{startText ? startText + ' → ' : ''}{dueText}</span>
              {due && <DeadlineBadge value={due} status={effectiveStatus} showDate={false} />}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="eflow-workspace-popover pt-planning-editor pt-timeline-editor"
          aria-label={'Subtask timeline for ' + node.title}
          align="start"
          sticky="always"
          collisionPadding={12}
          onInteractOutside={event => { if (editor.pending || confirming) event.preventDefault(); }}
          onEscapeKeyDown={event => { if (editor.pending || confirming) event.preventDefault(); }}
          onCloseAutoFocus={event => {
            if (!focusAfterSave.current) return;
            focusAfterSave.current = false;
            event.preventDefault();
            requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); });
          }}
        >
          <form
            noValidate
            className="pt-planning-form"
            onSubmit={event => {
              event.preventDefault();
              if (!canEdit || !controller) return;
              void editor.submit(async draft => {
                if (validation) throw new Error(validation);
                const startChanged = draft.start !== start;
                const dueChanged = draft.end !== due;
                const request: WorkRequest = {
                  id: crypto.randomUUID(),
                  command: 'edit',
                  revision: snapshot.revision,
                  payload: {
                    id: node.id,
                    title: node.title,
                    due: draft.end || null,
                    ...(startChanged ? { start: draft.start || null } : {}),
                    standalone: node.is_standalone,
                    note: dueChanged ? draft.reason.trim() : '',
                  },
                };
                const requireFreshAuthorization = async () => {
                  if (!controller.authorityFresh || context.readOnly || !context.actorId) throw new Error('Your current access could not be verified. Reload the work and try again.');
                  const latest = await fetchWorkTree(context.rootId);
                  if (latest.root.id !== context.rootId || latest.root.project !== context.projectId || latest.root.office !== context.officeId || latest.root.kind !== context.kind || latest.revision !== request.revision) {
                    throw new Error('Work changed. Reload and review the current schedule before saving.');
                  }
                  const freshContext = { ...context, revision: latest.revision };
                  if (!isCurrentWorkSnapshot(latest, freshContext)) throw new Error('Your current access could not be verified. Reload the work and try again.');
                  const freshNode = latest.nodes.find(item => item.id === node.id);
                  const freshPolicy = readNodeDetailEditState(freshNode, latest.root.id);
                  if (!freshNode || (policyRequired && !freshPolicy?.details) || !selectNodeWorkCapability(latest, node.id, 'edit_details', freshContext).allowed) {
                    throw new Error('Your permission to edit this schedule is unavailable. Your changes are kept.');
                  }
                  if (freshNode.start_date !== node.start_date || freshNode.due_date !== node.due_date || Boolean(freshNode.started_at || freshPolicy?.started) !== started) {
                    throw new Error('This subtask schedule changed. Reload and review the current dates before saving.');
                  }
                  if (startChanged && (policyRequired && !freshPolicy?.planning || !!freshPolicy?.started || freshNode.started_at)) throw new Error('The planned start date is locked for this subtask.');
                  if (dueChanged && policyRequired && !freshPolicy?.due) throw new Error('You do not have permission to change this due date.');
                  if (dueChanged && (!draft.reason.trim() || draft.reason.trim().length > 1000)) throw new Error('Enter a due-date change reason from 1 to 1,000 characters.');
                  const rawBounds = subtaskDateLimits(latest, freshNode.parent_subtask_id || '');
                  const freshEarliest = [rawBounds.earliest, parentStartDate?.slice(0, 10)].filter((value): value is string => !!value).sort();
                  const freshBounds = { ...rawBounds, earliest: freshEarliest[freshEarliest.length - 1] };
                  const freshToday = latest.root.scheduling?.today || today;
                  const freshIssue = subtaskTimelineError(draft, { start: (freshNode.start_date || '').slice(0, 10), end: (freshNode.due_date || '').slice(0, 10), reason: '' }, freshBounds, Boolean(freshPolicy?.started || freshNode.started_at), !policyRequired || !!freshPolicy && !!freshPolicy.planning && !freshPolicy.started, !policyRequired || !!freshPolicy?.due, draft.reason, freshToday);
                  if (freshIssue) throw new Error(freshIssue);
                };
                if (dueChanged) {
                  setConfirming(true);
                  try {
                    const fingerprint = await confirmation.review(request, {
                      title: 'Review due-date impact?',
                      dateChange: true,
                      alwaysConfirm: false,
                      actionLabel: 'Confirm changes',
                      danger: false,
                      isCurrent: () => Boolean(
                        controller.authorityFresh &&
                        !context.readOnly &&
                        controller.data &&
                        selectNodeWorkCapability(controller.data, node.id, 'edit_details', context).allowed,
                      ),
                      description: 'Review the current affected work. The server checks this exact impact again before saving.',
                    });
                    if (fingerprint === null) {
                      throw new Error('Due date change was not confirmed.');
                    }
                    await requireFreshAuthorization();
                    await controller.save({ ...request, impactFingerprint: fingerprint });
                  } finally {
                    setConfirming(false);
                  }
                } else {
                  await requireFreshAuthorization();
                  await controller.save(request);
                }
                focusAfterSave.current = true;
              }, 'Dates saved.');
            }}
          >
            <strong>Subtask timeline</strong>
            <p>Subtask dates must fit within the parent task timeline.</p>
            {started && <p role="status">Work is already in progress. Start date and prerequisites cannot be changed.</p>}
            <FormField
              label="Start date"
              description={startLocked ? 'Started subtasks keep their start date.' : undefined}
            >
              <TextInput
                type="date"
                min={minBound}
                max={editor.draft.end || bounds.latest || undefined}
                value={editor.draft.start}
                disabled={!canEdit || editor.pending || startLocked}
                onChange={event => editor.setDraft({ ...editor.draft, start: event.target.value })}
              />
            </FormField>
            <FormField
              label="Due date"
              error={validation || (editor.error ? editor.error + ' Retry with Save dates.' : undefined)}
            >
              <TextInput
                type="date"
                min={editor.draft.start > minBound ? editor.draft.start : minBound}
                max={bounds.latest || undefined}
                value={editor.draft.end}
                disabled={!canEdit || editor.pending || dueLocked}
                onChange={event => editor.setDraft({ ...editor.draft, end: event.target.value })}
              />
            </FormField>
            {editor.draft.end !== due && !dueLocked && <FormField label="Due-date change reason" description="Required when changing the due date (1–1,000 characters).">
              <textarea rows={3} maxLength={1000} value={editor.draft.reason} disabled={!canEdit || editor.pending || dueLocked}
                onChange={event => editor.setDraft({ ...editor.draft, reason: event.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
            </FormField>}
            {editor.notice && <p role="status">{editor.notice}</p>}
            <Button type="submit" pending={editor.pending} disabled={!canEdit || !editor.dirty || !!validation}>
              Save dates
            </Button>
          </form>
        </PopoverContent>
      </Popover>
      {confirmation.dialog}
    </>
  );
}
