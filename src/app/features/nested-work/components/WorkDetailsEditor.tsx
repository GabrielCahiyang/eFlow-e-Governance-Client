import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { CalendarDays, ListPlus, UsersRound } from 'lucide-react';
import { BoundedTextInput } from '../../../components/ui/BoundedInput';
import { DateInput } from '../../../components/ui/DateInput';
import { getPhilippineCalendarDate } from '../../../shared/calendarDates';
import { INPUT_LIMITS, textLengthError } from '../../../shared/inputLimits';
import type { WorkEditorFields } from '../types/editor';
import { WorkPeoplePicker } from './WorkPeoplePicker';

export interface WorkDetailsEditorProps {
  fields: WorkEditorFields;
  disabled: boolean;
  maxDue?: string;
  minDue?: string;
  showStart?: boolean;
  presentation?: 'default' | 'dialog';
  planningLocked?: boolean;
  dueDisabled?: boolean;
  staffingLocked?: boolean;
  titleError?: string;
  startDateError?: string;
  dueDateError?: string;
  onStartInvalidTextChange?: (invalid: boolean) => void;
  onDueInvalidTextChange?: (invalid: boolean) => void;
  update: <K extends keyof WorkEditorFields>(key: K, value: WorkEditorFields[K]) => void;
  peoplePicker?: ComponentProps<typeof WorkPeoplePicker>;
  prerequisiteField?: ReactNode;
  dueChangeReason?: ReactNode;
  showWorkOrder?: boolean;
  showPriority?: boolean;
  leadRequired?: boolean;
}

export function WorkDetailsEditor({
  fields,
  disabled,
  maxDue,
  minDue = getPhilippineCalendarDate(),
  update,
  peoplePicker,
  showStart = false,
  presentation = 'default',
  planningLocked = false,
  dueDisabled = false,
  staffingLocked = false,
  titleError,
  startDateError,
  dueDateError,
  onStartInvalidTextChange,
  onDueInvalidTextChange,
  prerequisiteField,
  dueChangeReason,
  showWorkOrder = false,
  showPriority = false,
  leadRequired = false,
}: WorkDetailsEditorProps) {
  const titleId = useId();
  const startId = useId();
  const dueId = useId();
  const priorityId = useId();
  const modeId = useId();
  const [titleTouched, setTitleTouched] = useState(false);
  const [localStartInvalid, setLocalStartInvalid] = useState(false);
  const [localDueInvalid, setLocalDueInvalid] = useState(false);

  const dialog = presentation === 'dialog';
  const localTitleError = !disabled && titleTouched
    ? textLengthError(fields.title, 'Subtask title', { required: true, max: INPUT_LIMITS.TITLE })
    : '';
  const visibleTitleError = titleError || localTitleError;

  const startMax = fields.due && (!maxDue || fields.due < maxDue) ? fields.due : maxDue;
  const effectiveStartError = localStartInvalid
    ? 'Enter a valid start date in MM/DD/YYYY format.'
    : (startDateError || '');
  const effectiveDueError = localDueInvalid
    ? 'Enter a valid due date in MM/DD/YYYY format.'
    : (dueDateError || '');

  const title = (
    <div className="grid gap-1">
      <label htmlFor={titleId}>
        Subtask title <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
      </label>
      <BoundedTextInput
        id={titleId}
        value={fields.title}
        maxLength={INPUT_LIMITS.TITLE}
        aria-required="true"
        disabled={disabled}
        error={visibleTitleError || undefined}
        placeholder={dialog ? 'What needs to be done?' : undefined}
        onBlur={() => setTitleTouched(true)}
        onChange={event => update('title', event.target.value)}
      />
    </div>
  );

  const start = showStart ? (
    <div className="grid gap-1">
      <label htmlFor={startId}>Subtask start date</label>
      <DateInput
        id={startId}
        value={fields.start || ''}
        min={minDue || undefined}
        max={startMax}
        hasError={Boolean(effectiveStartError)}
        errorMessage={effectiveStartError || undefined}
        onInvalidTextChange={invalid => {
          setLocalStartInvalid(invalid);
          onStartInvalidTextChange?.(invalid);
        }}
        disabled={disabled || planningLocked}
        onChange={event => update('start', event.target.value)}
      />
      {effectiveStartError && <p role="alert" className="eflow-field-error text-xs">{effectiveStartError}</p>}
    </div>
  ) : null;

  const due = (
    <div className="grid gap-1">
      <label htmlFor={dueId}>Subtask due date</label>
      <DateInput
        id={dueId}
        value={fields.due}
        min={fields.start || minDue || undefined}
        max={maxDue}
        hasError={Boolean(effectiveDueError)}
        errorMessage={effectiveDueError || undefined}
        onInvalidTextChange={invalid => {
          setLocalDueInvalid(invalid);
          onDueInvalidTextChange?.(invalid);
        }}
        disabled={disabled || dueDisabled}
        onChange={event => update('due', event.target.value)}
      />
      {effectiveDueError && <p role="alert" className="eflow-field-error text-xs">{effectiveDueError}</p>}
      {dueChangeReason}
    </div>
  );

  const priority = (
    <div className="grid gap-1">
      <label htmlFor={priorityId}>Priority</label>
      <select
        id={priorityId}
        value={fields.priority || 'medium'}
        disabled={disabled}
        onChange={event => update('priority', event.target.value as 'low' | 'medium' | 'high')}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>
  );

  const mode = showWorkOrder && (
    <div className="grid gap-1">
      <label htmlFor={modeId}>Work order</label>
      <select
        id={modeId}
        value={fields.standalone ? 'independent' : 'sequence'}
        disabled={disabled || planningLocked}
        onChange={event => {
          const value = event.target.value;
          update('standalone', value === 'independent');
        }}
      >
        <option value="sequence">In sequence</option>
        <option value="independent">Can start out of order</option>
      </select>
    </div>
  );

  return <>
    {dialog ? (
      <section className="nw-create-details" aria-label="Subtask details">
        <div className="nw-create-section-title"><ListPlus size={18} aria-hidden="true" /><h3>Subtask details</h3></div>
        {title}
        {showPriority && priority}
        <div className="nw-create-schedule">{start}{due}</div>
        {mode}
        {prerequisiteField}
        <p className="nw-create-hint">
          <CalendarDays size={15} aria-hidden="true" />
          {!showWorkOrder
            ? 'Selected prerequisites must finish before this subtask can start.'
            : fields.standalone
              ? 'This subtask can start without waiting for earlier steps. Its start date and other requirements still apply.'
              : 'Finish earlier steps before starting this subtask.'}
        </p>
      </section>
    ) : (
      <>{title}{priority}{start}{due}{mode}{prerequisiteField}</>
    )}
    {peoplePicker && (
      <section className="nw-create-team" aria-label="Subtask Lead and contributors">
        <div className="nw-create-team__header">
          <UsersRound size={18} aria-hidden="true" />
          <span>
            <strong>Subtask Lead and contributors</strong>
            <small>{leadRequired ? 'Lead required · Contributors optional' : 'Optional'}</small>
          </span>
        </div>
        <WorkPeoplePicker {...peoplePicker} />
      </section>
    )}
    {dialog && staffingLocked && (
      <p className="nw-create-team-locked" role="status">
        <UsersRound size={16} aria-hidden="true" />
        <span><strong>Lead and contributors:</strong> Managed by the Task Lead while this project is active. This subtask starts unassigned.</span>
      </p>
    )}
  </>;
}
