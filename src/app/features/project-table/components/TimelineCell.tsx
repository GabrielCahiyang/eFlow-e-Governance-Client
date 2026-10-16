import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/button';
import type { Task } from '../../tasks';
import type { WorkspaceTaskPatch } from '../types';
import { timelineDraft, timelinePatch, timelineError, todayDate } from '../planningDraft';
import { usePlanningEditor } from '../hooks/usePlanningEditor';

export function TimelineCell({ task, disabled, save }: { task: Task; disabled: boolean; save: (patch: WorkspaceTaskPatch) => Promise<void> }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const focusAfterSave = useRef(false);
  const editor = usePlanningEditor(() => timelineDraft(task), 'Task timeline: ' + task.title, { closeOnSuccess: true });
  const due = task.deadline || task.dueDate || '', date = timelineDraft(task).end;
  const today = todayDate();
  const validation = editor.dirty ? timelineError(task, editor.draft) : undefined;
  const text = date ? new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : due || 'Set dates';
  const dueTime = timelineDraft(task).time;
  const timeText = dueTime ? new Date(`2000-01-01T${dueTime}:00`).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
  return <Popover open={editor.open} onOpenChange={editor.onOpenChange}>
    <PopoverTrigger asChild><button ref={trigger} className="pt-date" disabled={disabled} aria-label={'Edit dates for ' + task.title}><Calendar size={14}/>{task.startDate ? task.startDate + ' → ' : ''}{text}{timeText ? `, ${timeText}` : ''}</button></PopoverTrigger>
    <PopoverContent className="eflow-workspace-popover pt-planning-editor pt-timeline-editor" aria-label={'Task timeline for ' + task.title} align="start" sticky="always" collisionPadding={12} onInteractOutside={event => { if (editor.pending) event.preventDefault(); }} onEscapeKeyDown={event => { if (editor.pending) event.preventDefault(); }} onCloseAutoFocus={event => {
      if (!focusAfterSave.current) return;
      focusAfterSave.current = false;
      event.preventDefault();
      requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); });
    }}>
      <form noValidate className="pt-planning-form" onSubmit={event => { event.preventDefault(); if (!disabled) void editor.submit(async draft => {
        await save(timelinePatch(task, draft)); focusAfterSave.current = true;
      }, 'Dates saved.'); }}>
        <strong>Task timeline</strong><p>Choose when this task starts and is due.</p>
        <FormField label="Start date"><TextInput type="date" min={today} value={editor.draft.start} disabled={disabled || editor.pending} onChange={event => editor.setDraft({ ...editor.draft, start: event.target.value })}/></FormField>
        <FormField label="Due date" error={validation || (editor.error ? editor.error + ' Retry with Save dates.' : undefined)}><TextInput type="date" min={editor.draft.start > today ? editor.draft.start : today} value={editor.draft.end} disabled={disabled || editor.pending} onChange={event => editor.setDraft({ ...editor.draft, end: event.target.value, ...(!event.target.value ? { time: '' } : {}) })}/></FormField>
        <FormField label="Due time (optional)" description="Leave blank for 11:59 PM."><TextInput type="time" step={60} value={editor.draft.time || ''} disabled={disabled || editor.pending || !editor.draft.end} onChange={event => editor.setDraft({ ...editor.draft, time: event.target.value })}/></FormField>
        {editor.notice && <p role="status">{editor.notice}</p>}
        <Button type="submit" pending={editor.pending} disabled={disabled || !editor.dirty || !!validation}>Save dates</Button>
      </form>
    </PopoverContent>
  </Popover>;
}
