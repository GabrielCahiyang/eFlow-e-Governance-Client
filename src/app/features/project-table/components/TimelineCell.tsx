import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
import {useProjectFlow} from '../../project-setup';
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
  const flow=useProjectFlow(task.linkedProjectId||'',editor.open);
  const projectStart=flow.data?.project.start_date||'',projectEnd=flow.data?.project.target_date||'';
  const minimumStart=projectStart>todayDate()?projectStart:todayDate();
  const due = task.deadline || task.dueDate || '', date = timelineDraft(task).end;
  const validation = editor.dirty ? (projectStart&&editor.draft.start&&editor.draft.start<projectStart||projectEnd&&editor.draft.end&&editor.draft.end>projectEnd?'Task dates must stay within the project timeline.':timelineError(task,editor.draft)) : undefined;
  const text = date ? new Date(date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : due || 'Set dates';
  const startText=task.startDate ? new Date(task.startDate.slice(0,10)+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '';
  return <Popover open={editor.open} onOpenChange={editor.onOpenChange}>
    <PopoverTrigger asChild><button ref={trigger} className="pt-date" disabled={disabled} title={`${task.startDate ? task.startDate+' → ' : ''}${date||due}`} aria-label={'Edit dates for ' + task.title}><Calendar size={14}/><span className="pt-date-label"><span>{startText ? startText+' → ' : ''}{text}</span>{date&&<DeadlineBadge value={date} status={task.status} showDate={false}/>}
</span></button></PopoverTrigger>
    <PopoverContent className="eflow-workspace-popover pt-planning-editor pt-timeline-editor" aria-label={'Task timeline for ' + task.title} align="start" sticky="always" collisionPadding={12} onInteractOutside={event => { if (editor.pending) event.preventDefault(); }} onEscapeKeyDown={event => { if (editor.pending) event.preventDefault(); }} onCloseAutoFocus={event => {
      if (!focusAfterSave.current) return;
      focusAfterSave.current = false;
      event.preventDefault();
      requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); });
    }}>
      <form noValidate className="pt-planning-form" onSubmit={event => { event.preventDefault(); if (!disabled) void editor.submit(async draft => {
        if(validation)throw new Error(validation);await save(timelinePatch(task, draft)); focusAfterSave.current = true;
      }, 'Dates saved.'); }}>
        <strong>Task timeline</strong><p>Task dates must fit within the project timeline.</p>
        <FormField label="Start date"><TextInput type="date" min={minimumStart} max={editor.draft.end||projectEnd||undefined} value={editor.draft.start} disabled={disabled || editor.pending} onChange={event => editor.setDraft({ ...editor.draft, start: event.target.value })}/></FormField>
        <FormField label="Due date" error={validation || (editor.error ? editor.error + ' Retry with Save dates.' : undefined)}><TextInput type="date" min={editor.draft.start > minimumStart ? editor.draft.start : minimumStart} max={projectEnd||undefined} value={editor.draft.end} disabled={disabled || editor.pending} onChange={event => editor.setDraft({ ...editor.draft, end: event.target.value })}/></FormField>
        {editor.notice && <p role="status">{editor.notice}</p>}
        <Button type="submit" pending={editor.pending} disabled={disabled || !editor.dirty || !!validation}>Save dates</Button>
      </form>
    </PopoverContent>
  </Popover>;
}
