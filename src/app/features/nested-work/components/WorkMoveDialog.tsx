import { useId, useRef, useState } from 'react';
import { FieldValidationTooltip } from '../../../components/ui/FieldValidationTooltip';
import { staffingNodePath } from '../selectors/staffing';
import type { WorkNode, WorkTreeSnapshot } from '../types';

/** Choices are already filtered by current capability and reparentChoices. */
export function WorkMoveDialog({
  data,
  destinations,
  allowTask,
  parent,
  disabled,
  error,
  onChange,
}: {
  data: WorkTreeSnapshot;
  destinations: WorkNode[];
  allowTask: boolean;
  parent: string;
  disabled: boolean;
  error?: string;
  onChange: (parent: string) => void;
}) {
  const selectId = useId();
  const tooltipId = useId();
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const hasDestinations = allowTask || destinations.length > 0;
  const validSelection = (parent === '' && allowTask) || destinations.some(node => node.id === parent);
  const computedError = !hasDestinations
    ? 'No valid destination parents are available for this subtask.'
    : !validSelection
      ? 'Choose a valid destination parent.'
      : '';
  const visibleError = error || (!hasDestinations || touched ? computedError : '');
  const isInvalid = Boolean(visibleError);

  return (
    <div className="grid gap-1.5">
      <label htmlFor={selectId}>
        Destination parent <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">*</span>
      </label>
      <select
        ref={selectRef}
        id={selectId}
        value={validSelection ? parent : ''}
        disabled={disabled || !hasDestinations}
        aria-required="true"
        aria-invalid={isInvalid || undefined}
        aria-describedby={isInvalid ? `${selectId}-error` : undefined}
        className={isInvalid ? 'eflow-field-invalid' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setTouched(true); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onChange={event => { setTouched(true); onChange(event.target.value); }}
      >
        {!hasDestinations && <option value="" disabled>No valid destinations available</option>}
        {hasDestinations && !validSelection && <option value="" disabled>Choose a destination parent</option>}
        {allowTask && <option value="">This task</option>}
        {destinations.map(node => (
          <option key={node.id} value={node.id}>
            {staffingNodePath(data, node.id)}
          </option>
        ))}
      </select>
      <FieldValidationTooltip
        id={tooltipId}
        anchorRef={selectRef}
        message={visibleError}
        open={isInvalid && (focused || hovered)}
        tone="error"
      />
      {isInvalid && (
        <p id={`${selectId}-error`} role="alert" className="eflow-field-error text-xs">
          {visibleError}
        </p>
      )}
      {!hasDestinations && (
        <p role="status" className="text-xs text-[var(--eflow-text-secondary,#505c77)]">
          There are no other parents you have permission to move this subtask under.
        </p>
      )}
    </div>
  );
}
