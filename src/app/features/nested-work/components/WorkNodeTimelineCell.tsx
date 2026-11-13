import { useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DeadlineBadge } from '../../../components/ui/DeadlineBadge';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { getPhilippineCalendarDate, isCalendarDate } from '../../../shared/calendarDates';
import { usePlanningEditor } from '../../../shared/usePlanningEditor';
import { useWorkImpactConfirmation } from '../hooks/useWorkImpactConfirmation';
import { selectNodeWorkCapability } from '../selectors/capabilities';
import type { WorkCapabilityContext, WorkNode, WorkRequest, WorkTreeController, WorkTreeSnapshot } from '../types';

interface SubtaskTimelineDraft {
  start: string;
  end: string;
}

function ancestorDateBounds(snapshot: WorkTreeSnapshot, node: WorkNode, parentStartDate?: string) {
  const byId = new Map(snapshot.nodes.map(item => [item.id, item]));
  const visited = new Set([node.id]);
  let earliest = (parentStartDate || '').slice(0, 10);
  let latest = (snapshot.root.due || '').slice(0, 10);
  let cursor = node.parent_subtask_id;
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    const parent = byId.get(cursor);
    if (!parent) break;
    const pStart = (parent.start_date || '').slice(0, 10);
    const pDue = (parent.due_date || '').slice(0, 10);
    if (pStart && (!earliest || pStart > earliest)) earliest = pStart;
    if (pDue && (!latest || pDue < latest)) latest = pDue;
    cursor = parent.parent_subtask_id;
  }
  return { earliest, latest };
}

function subtaskTimelineError(
  draft: SubtaskTimelineDraft,
  original: SubtaskTimelineDraft,
  bounds: { earliest: string; latest: string },
  startedAt: string | null | undefined,
  today: string,
): string | undefined {
  for (const day of [draft.start, draft.end]) {
    if (day && !isCalendarDate(day)) return 'Enter a valid date.';
  }
  if (startedAt && draft.start !== original.start) return 'Started subtasks keep their start date.';
  if (original.start && !draft.start) return 'Start date cannot be cleared once set.';
  if (draft.start && draft.end && draft.start > draft.end) return 'Due date cannot be before the start date.';
  if (draft.end && draft.end !== original.end) {
    if (draft.end < today) return 'Choose today or a future due date.';
    if (bounds.earliest && draft.end < bounds.earliest) return 'Subtask dates must stay within the parent schedule.';
    if (bounds.latest && draft.end > bounds.latest) return 'Subtask dates must stay within the parent schedule.';
  }
  if (draft.start && draft.start !== original.start) {
    if (draft.start < today) return 'Choose today or a future start date.';
    if (bounds.earliest && draft.start < bounds.earliest) return 'Subtask dates must stay within the parent schedule.';
    if (bounds.latest && draft.start > bounds.latest) return 'Subtask dates must stay within the parent schedule.';
  }
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
  const canEdit = !disabled && !!controller && selectNodeWorkCapability(snapshot, node.id, 'edit_details', context).allowed;

  const editor = usePlanningEditor<SubtaskTimelineDraft>(
    () => ({ start, end: due }),
    'Subtask timeline: ' + node.title,
    { closeOnSuccess: true },
  );
  const confirmation = useWorkImpactConfirmation(snapshot.root.id);
  const bounds = ancestorDateBounds(snapshot, node, parentStartDate);
  const today = snapshot.root.scheduling?.today || getPhilippineCalendarDate();
  const minBound = bounds.earliest && bounds.earliest > today ? bounds.earliest : today;
  const startLocked = Boolean(node.started_at);
  const validation = editor.dirty ? subtaskTimelineError(editor.draft, { start, end: due }, bounds, node.started_at, today) : undefined;

  const startText = start ? new Date(start + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
  const dueText = due ? new Date(due + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Set dates';

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
                    note: '',
                  },
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
                    await controller.save({ ...request, impactFingerprint: fingerprint });
                  } finally {
                    setConfirming(false);
                  }
                } else {
                  await controller.save(request);
                }
                focusAfterSave.current = true;
              }, 'Dates saved.');
            }}
          >
            <strong>Subtask timeline</strong>
            <p>Subtask dates must fit within the parent task timeline.</p>
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
                disabled={!canEdit || editor.pending}
                onChange={event => editor.setDraft({ ...editor.draft, end: event.target.value })}
              />
            </FormField>
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
