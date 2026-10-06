import { Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/button';
import type { Task } from '../../tasks';
import type { WorkspaceTaskPatch } from '../types';
import { timelineDraft, timelinePatch } from '../planningDraft';
import { usePlanningEditor } from '../hooks/usePlanningEditor';

export function TimelineCell({ task, disabled, save }: { task: Task; disabled: boolean; save: (patch: WorkspaceTaskPatch) => Promise<void> }) {
  const editor = usePlanningEditor(() => timelineDraft(task), 'Task timeline: ' + task.title);
  const due = task.deadline || task.dueDate || '', date = timelineDraft(task).end;
  const text = date ? new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : due || 'Set dates';
  return <Popover open={editor.open} onOpenChange={editor.onOpenChange}>
    <PopoverTrigger asChild><button className="pt-date" disabled={disabled} aria-label={'Edit dates for ' + task.title}><Calendar size={14}/>{task.startDate ? task.startDate + ' → ' : ''}{text}</button></PopoverTrigger>
    <PopoverContent className="eflow-workspace-popover pt-planning-editor" aria-label={'Task timeline for ' + task.title} align="start" onInteractOutside={event => { if (editor.pending) event.preventDefault(); }} onEscapeKeyDown={event => { if (editor.pending) event.preventDefault(); }}>
      <form className="pt-planning-form" onSubmit={event => { event.preventDefault(); if (!disabled) void editor.submit(draft => save(timelinePatch(task, draft)), 'Dates saved.'); }}>
        <strong>Task timeline</strong><p>Changing these dates updates the task schedule. Existing dependency and readiness checks still apply.</p>
        <FormField label="Start date"><TextInput type="date" value={editor.draft.start} disabled={disabled || editor.pending} onChange={event => editor.setDraft({ ...editor.draft, start: event.target.value })}/></FormField>
        <FormField label="Due date" error={editor.error ? editor.error + ' Retry with Save dates.' : undefined}><TextInput type="date" value={editor.draft.end} disabled={disabled || editor.pending} onChange={event => editor.setDraft({ ...editor.draft, end: event.target.value })}/></FormField>
        {editor.notice && <p role="status">{editor.notice}</p>}
        <Button type="submit" pending={editor.pending} disabled={disabled || !editor.dirty}>Save dates</Button>
      </form>
    </PopoverContent>
  </Popover>;
}
