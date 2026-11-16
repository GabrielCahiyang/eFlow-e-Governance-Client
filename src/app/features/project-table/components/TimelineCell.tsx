import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
import {useProjectFlow} from '../../project-setup';
import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { Button } from '../../../components/ui/button';
import { fetchTaskDetailEditState, type Task, type TaskDetailEditState } from '../../tasks';
import type { WorkspaceTaskPatch } from '../types';
import { timelineDraft, timelinePatch, timelineError, todayDate } from '../planningDraft';
import { usePlanningEditor } from '../hooks/usePlanningEditor';

export function TimelineCell({ task, disabled, save }: { task: Task; disabled: boolean; save: (patch: WorkspaceTaskPatch) => Promise<void> }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const focusAfterSave = useRef(false);
  const editor = usePlanningEditor(() => timelineDraft(task), 'Task timeline: ' + task.title, { closeOnSuccess: true });
  const flow=useProjectFlow(task.linkedProjectId||'',editor.open);
  const [editState,setEditState]=useState<TaskDetailEditState|null>(null),[policyError,setPolicyError]=useState(''),[policyLoading,setPolicyLoading]=useState(false),[changeReason,setChangeReason]=useState('');
  useEffect(()=>{if(!editor.open)return;let active=true;setEditState(null);setPolicyError('');setChangeReason('');setPolicyLoading(true);void fetchTaskDetailEditState(task.id).then(value=>{if(active)setEditState(value);}).catch(reason=>{if(active)setPolicyError(reason instanceof Error?reason.message:'Task editing access could not be verified.');}).finally(()=>{if(active)setPolicyLoading(false);});return()=>{active=false;};},[editor.open,task.id]);
  const policyReady=!policyLoading&&!policyError&&!!editState,canPlan=policyReady&&!!editState?.details&&!!editState.planning,canChangeDue=policyReady&&!!editState?.details&&!!editState.due;
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
      <form noValidate className="pt-planning-form" onSubmit={event => { event.preventDefault(); if (!disabled&&policyReady) void editor.submit(async draft => {
        if(validation)throw new Error(validation);
        const changedDue=draft.end!==(task.deadline||task.dueDate||'');
        if(editState?.started){if(draft.start!==(task.startDate||''))throw new Error('Start dates and planning definitions are locked after work starts.');if(changedDue&&!canChangeDue)throw new Error('Only the supervising Lead or authorized Office Head can reschedule this task.');if(changedDue&&(!changeReason.trim()||changeReason.trim().length>1000))throw new Error('Enter a due-date change reason (1–1,000 characters).');if(changedDue)await save({deadline:draft.end,change_reason:changeReason.trim()});}
        else await save(timelinePatch(task,draft));
        focusAfterSave.current = true;
      }, 'Dates saved.'); }}>
        <strong>Task timeline</strong><p>Task dates must fit within the project timeline.</p>
        {policyLoading&&<p role="status">Checking current task editing access…</p>}{policyError&&<p role="alert">{policyError} Editing is unavailable until access can be verified.</p>}{editState?.started&&<p role="status">Work has started. Planned start and structure are locked. Due-date changes require supervising authority and a reason.</p>}
        {editor.notice && <p role="status">{editor.notice}</p>}
        <FormField label="Start date"><TextInput type="date" min={minimumStart} max={editor.draft.end||projectEnd||undefined} value={editor.draft.start} disabled={disabled || editor.pending || !canPlan} onChange={event => editor.setDraft({ ...editor.draft, start: event.target.value })}/></FormField>
        <FormField label="Due date" error={validation || (editor.error ? editor.error + ' Retry with Save dates.' : undefined)}><TextInput type="date" min={editor.draft.start > minimumStart ? editor.draft.start : minimumStart} max={projectEnd||undefined} value={editor.draft.end} disabled={disabled || editor.pending || !canChangeDue} onChange={event => editor.setDraft({ ...editor.draft, end: event.target.value })}/></FormField>
        {editState?.started&&canChangeDue&&<FormField label="Reason for due-date change"><TextInput value={changeReason} maxLength={1000} disabled={disabled||editor.pending} onChange={event=>setChangeReason(event.target.value)}/></FormField>}
        <Button type="submit" pending={editor.pending} disabled={disabled || !policyReady || !editor.dirty || !!validation}>Save dates</Button>
      </form>
    </PopoverContent>
  </Popover>;
}
