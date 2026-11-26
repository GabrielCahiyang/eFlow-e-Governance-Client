import { BoundedTextarea, BoundedTextInput } from '../../../components/ui/BoundedInput';
import { ActionBlockerGroup } from '../../../components/ui/action-blockers';
import { WorkspaceTooltip } from '../../../components/ui/workspace/WorkspaceTooltip';
import { DateInput } from '../../../components/ui/DateInput';
import { getPhilippineCalendarDate, scheduledDateError } from '../../../shared/calendarDates';
import { INPUT_LIMITS } from '../../../shared/inputLimits';
import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ImportTask, ProposedOffice } from '../types';

export function ImportTaskReview({ tasks, allTasks, offices, disabled, onChange }: {
  tasks: ImportTask[]; allTasks: ImportTask[]; offices: ProposedOffice[]; disabled: boolean; onChange: (key: string, value: Partial<ImportTask>) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [invalidDates, setInvalidDates] = useState<Record<string, boolean>>({});
  const today = getPhilippineCalendarDate();

  return <div className="pi-table-scroll"><table className="pi-review-table"><thead><tr><th scope="col">Include</th><th scope="col">Task and deliverable</th><th scope="col">Priority</th><th scope="col">Timeline</th><th scope="col">Proposed responsibility</th></tr></thead><tbody>
    {tasks.map(task => {
      const startKey = `${task.key}:start`;
      const dueKey = `${task.key}:due`;
      const earliestDue = task.startDate && task.startDate > today ? task.startDate : today;
      const startError = invalidDates[startKey]
        ? 'Enter a valid start date in MM/DD/YYYY format.'
        : task.startDate && task.dueDate && task.startDate > task.dueDate
          ? 'Start date must be on or before due date.'
          : scheduledDateError(task.startDate, { earliest: today, latest: task.dueDate || '', label: 'Start date' });
      const dueError = invalidDates[dueKey]
        ? 'Enter a valid due date in MM/DD/YYYY format.'
        : task.startDate && task.dueDate && task.dueDate < task.startDate
          ? 'Due date cannot be before start date.'
          : scheduledDateError(task.dueDate, { earliest: earliestDue, label: 'Due date' });
      const addSubtaskDisabled = disabled || task.subitems.length >= 30;
      const addSubtaskBlocker = task.subitems.length >= 30 ? 'Maximum of 30 subtasks per task reached.' : '';

      return <Fragment key={task.key}>
        <tr className={!task.included ? 'pi-omitted' : ''}>
          <td><input type="checkbox" aria-label={`Include ${task.title}`} checked={task.included} disabled={disabled} onChange={e => onChange(task.key, { included: e.target.checked })}/></td>
          <td>
            <BoundedTextInput
              aria-label={`Task name ${task.key}`}
              aria-required={task.included || undefined}
              value={task.title}
              maxLength={INPUT_LIMITS.TASK_TITLE}
              disabled={disabled}
              error={task.included && !task.title.trim() ? 'Task name is required.' : undefined}
              onChange={e => onChange(task.key, { title: e.target.value })}
            />
            <BoundedTextarea
              aria-label={`Description ${task.key}`}
              value={task.description}
              rows={2}
              maxLength={INPUT_LIMITS.DESCRIPTION}
              disabled={disabled}
              onChange={e => onChange(task.key, { description: e.target.value })}
            />
            <button type="button" className="pi-details-button" aria-expanded={expanded.includes(task.key)} onClick={() => setExpanded(prev => prev.includes(task.key) ? prev.filter(k => k !== task.key) : [...prev, task.key])}>{expanded.includes(task.key) ? <ChevronDown size={15}/> : <ChevronRight size={15}/>} {task.subitems.length} subitems · dependencies · source</button>
          </td>
          <td><select aria-label={`Priority ${task.key}`} value={task.priority} disabled={disabled} onChange={e => onChange(task.key, { priority: e.target.value as ImportTask['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></td>
          <td className="pi-dates">
            <label>
              Start
              <DateInput
                min={today}
                max={task.dueDate || undefined}
                value={task.startDate}
                disabled={disabled}
                hasError={Boolean(startError)}
                errorMessage={startError || undefined}
                onInvalidTextChange={inv => setInvalidDates(prev => ({ ...prev, [startKey]: inv }))}
                onChange={e => onChange(task.key, { startDate: e.target.value })}
              />
              {startError && <span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{startError}</span>}
            </label>
            <label>
              Due
              <DateInput
                min={earliestDue}
                value={task.dueDate}
                disabled={disabled}
                hasError={Boolean(dueError)}
                errorMessage={dueError || undefined}
                onInvalidTextChange={inv => setInvalidDates(prev => ({ ...prev, [dueKey]: inv }))}
                onChange={e => onChange(task.key, { dueDate: e.target.value })}
              />
              {dueError && <span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{dueError}</span>}
            </label>
          </td>
          <td><select aria-label={`Office responsibility ${task.key}`} value={task.officeKey} disabled={disabled} onChange={e => onChange(task.key, { officeKey: e.target.value })}><option value="">No proposal</option>{offices.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}</select><small>People remain unassigned.</small></td>
        </tr>
        {expanded.includes(task.key) && <tr><td/><td colSpan={5}><div className="pi-expanded">
          <div className="pi-subitems"><strong>Subtasks</strong>{task.subitems.map((subitem, index) => {
            const subKey = `${task.key}:sub:${index}`;
            const subDateError = invalidDates[subKey]
              ? 'Enter a valid subtask due date in MM/DD/YYYY format.'
              : scheduledDateError(subitem.dueDate, { earliest: earliestDue, latest: task.dueDate || '', label: 'Subtask due date' });
            return <div className="pi-subitem" key={index}>
              <BoundedTextInput
                aria-label={`Subtask ${task.key} ${index + 1}`}
                aria-required={task.included || undefined}
                value={subitem.title}
                maxLength={INPUT_LIMITS.TASK_TITLE}
                disabled={disabled}
                error={task.included && !subitem.title.trim() ? 'Subtask name is required.' : undefined}
                onChange={e => onChange(task.key, { subitems: task.subitems.map((s, i) => i === index ? { ...s, title: e.target.value } : s) })}
              />
              <div className="grid gap-1">
                <DateInput
                  aria-label={`Subtask due date ${task.key} ${index + 1}`}
                  min={earliestDue}
                  max={task.dueDate || undefined}
                  value={subitem.dueDate}
                  disabled={disabled}
                  hasError={Boolean(subDateError)}
                  errorMessage={subDateError || undefined}
                  onInvalidTextChange={inv => setInvalidDates(prev => ({ ...prev, [subKey]: inv }))}
                  onChange={e => onChange(task.key, { subitems: task.subitems.map((s, i) => i === index ? { ...s, dueDate: e.target.value } : s) })}
                />
                {subDateError && <span className="eflow-bounded-meta__hint" data-tone="error" role="alert">{subDateError}</span>}
              </div>
              <WorkspaceTooltip content={`Remove subtask ${task.key} ${index + 1}`} disabled={disabled}>
                <span className="inline-flex">
                  <button type="button" aria-label={`Remove subtask ${task.key} ${index + 1}`} disabled={disabled} onClick={() => onChange(task.key, { subitems: task.subitems.filter((_, i) => i !== index) })}><Trash2 size={14}/></button>
                </span>
              </WorkspaceTooltip>
            </div>;
          })}
          <ActionBlockerGroup actionLabel="Add subtask" blockers={addSubtaskBlocker} busy={disabled} compact size="sm">
            <button type="button" disabled={addSubtaskDisabled} onClick={() => onChange(task.key, { subitems: [...task.subitems, { title: '', dueDate: '' }] })}><Plus size={14}/>Add subtask</button>
          </ActionBlockerGroup></div>
          <div><label>Depends on<select multiple aria-label={`Dependencies ${task.key}`} value={task.dependencies} disabled={disabled} onChange={e => onChange(task.key, { dependencies: Array.from(e.target.selectedOptions, o => o.value) })}>{allTasks.filter(t => t.key !== task.key).map(t => <option key={t.key} value={t.key}>{t.title}{!t.included ? ' (omitted)' : ''}</option>)}</select></label><small>Use Ctrl / Cmd to select or clear dependencies.</small></div>
          <div className="pi-source-quote"><strong>Source evidence</strong><blockquote>{task.sourceQuote || 'AI suggestion; no verified quote. Check it against your source.'}</blockquote>{task.advisory && <details><summary>Routing and review suggestions</summary><p>{String(task.advisory.recommendationReasoning || 'Review required.')}</p></details>}</div>
        </div></td></tr>}
      </Fragment>;
    })}
  </tbody></table></div>;
}
