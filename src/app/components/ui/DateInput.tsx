import React, { useEffect, useId, useRef, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { getPhilippineCalendarDate } from '../../shared/calendarDates';
import { INPUT_LIMITS } from '../../shared/inputLimits';
import { Calendar } from './calendar';
import { FieldValidationTooltip } from './FieldValidationTooltip';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2199 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function formatIsoToUsDate(iso?: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [year, month, day] = iso.split('-');
  return `${month}/${day}/${year}`;
}

export function parseDateInputToIso(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return isValidYmd(Number(y), Number(m), Number(d)) ? trimmed : null;
  }
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

function isoToLocalNoonDate(iso?: string | null): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return isValidYmd(y, m, d) ? new Date(y, m - 1, d, 12, 0, 0) : undefined;
}

function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue'> {
  value?: string;
  hasError?: boolean;
  errorMessage?: string;
  onInvalidTextChange?: (invalid: boolean) => void;
}

export function DateInput({
  value = '',
  min,
  max,
  maxLength,
  disabled,
  hasError,
  errorMessage,
  className = '',
  placeholder = 'MM/DD/YYYY',
  onChange,
  onBlur,
  onFocus,
  onMouseEnter,
  onMouseLeave,
  onInvalidTextChange,
  ...props
}: DateInputProps) {
  const [text, setText] = useState(() => formatIsoToUsDate(value));
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [invalidTextError, setInvalidTextError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    setText(formatIsoToUsDate(value));
    setInvalidTextError('');
  }, [value]);

  const effectiveError = invalidTextError || errorMessage || '';
  const invalid =
    Boolean(effectiveError) ||
    Boolean(hasError) ||
    props['aria-invalid'] === true ||
    props['aria-invalid'] === 'true';

  const phTodayDate = isoToLocalNoonDate(getPhilippineCalendarDate());
  const minDate = typeof min === 'string' ? isoToLocalNoonDate(min) : undefined;
  const selectedDate = isoToLocalNoonDate(value);

  const emitChange = (nextIso: string) => {
    setInvalidTextError('');
    onInvalidTextChange?.(false);
    if (!onChange) return;
    const node = inputRef.current;
    const target = {
      value: nextIso,
      name: props.name || node?.name || '',
      id: props.id || node?.id || '',
      type: 'date',
    } as unknown as HTMLInputElement;
    onChange({
      target,
      currentTarget: target,
    } as React.ChangeEvent<HTMLInputElement>);
  };

  const showTooltip = Boolean(effectiveError) && (focused || hovered || Boolean(invalidTextError));

  return (
    <div className="eflow-date-input-wrap relative inline-flex w-full min-w-0 items-center">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={maxLength ?? INPUT_LIMITS.DATE_TEXT_MAX}
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        min={min}
        max={max}
        data-min={min}
        data-max={max}
        aria-invalid={invalid || undefined}
        aria-describedby={showTooltip ? tooltipId : props['aria-describedby']}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onMouseEnter={(event) => {
          setHovered(true);
          onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          setHovered(false);
          onMouseLeave?.(event);
        }}
        onChange={(event) => {
          const raw = event.target.value;
          const parsed = parseDateInputToIso(raw);
          if (parsed === '') {
            setText('');
            emitChange('');
            return;
          }
          if (parsed !== null) {
            setText(formatIsoToUsDate(parsed));
            emitChange(parsed);
            return;
          }
          // Auto-insert slashes while typing digits cleanly (MM/DD/YYYY).
          const digitsOnly = raw.replace(/\D/g, '');
          if (/^[\d/]*$/.test(raw) && digitsOnly.length <= 8 && !raw.endsWith('/')) {
            let formatted = digitsOnly;
            if (digitsOnly.length > 2) formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
            if (digitsOnly.length > 4) formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`;
            setText(formatted);
            const reparsed = parseDateInputToIso(formatted);
            if (reparsed) {
              emitChange(reparsed);
            } else if (reparsed === null) {
              onInvalidTextChange?.(true);
              if (digitsOnly.length === 8) {
                setInvalidTextError('Enter a valid calendar date in MM/DD/YYYY format.');
              } else {
                setInvalidTextError('');
              }
            }
            return;
          }
          setText(raw);
          setInvalidTextError('Use MM/DD/YYYY format (numbers and slashes only).');
          onInvalidTextChange?.(true);
        }}
        onBlur={(event) => {
          setFocused(false);
          const parsed = parseDateInputToIso(text);
          if (parsed === null) {
            if (onInvalidTextChange) {
              setInvalidTextError('Enter a valid date in MM/DD/YYYY format.');
              onInvalidTextChange(true);
            } else {
              setInvalidTextError('');
              setText(formatIsoToUsDate(value));
            }
          } else if (parsed !== value) {
            setText(formatIsoToUsDate(parsed));
            emitChange(parsed);
          } else {
            setInvalidTextError('');
          }
          onBlur?.(event);
        }}
        className={`eflow-form-input h-10 w-full rounded-lg border bg-input-background pl-3 pr-9 text-[13px] font-normal text-foreground placeholder:text-muted-foreground outline-none transition-all ${
          invalid
            ? 'eflow-field-invalid border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/10'
            : 'border-border hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15'
        } ${className}`}
        style={{ paddingRight: '2.25rem' }}
        {...props}
      />
      <FieldValidationTooltip
        id={tooltipId}
        anchorRef={inputRef}
        message={effectiveError}
        open={showTooltip}
        tone="error"
      />
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={props['aria-label'] ? `Open calendar for ${props['aria-label']}` : 'Open calendar'}
            className="eflow-date-input-trigger absolute right-2 inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            style={{
              border: 0,
              background: 'transparent',
              padding: 0,
              width: '24px',
              height: '24px',
            }}
          >
            <CalendarIcon size={15} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="eflow-workspace-popover w-auto p-0" align="start">
          <Calendar
            mode="single"
            today={phTodayDate}
            selected={selectedDate}
            defaultMonth={selectedDate || minDate || phTodayDate}
            disabled={(day) => {
              const iso = dateToIso(day);
              if (typeof min === 'string' && min && iso < min) return true;
              if (typeof max === 'string' && max && iso > max) return true;
              return false;
            }}
            onSelect={(day) => {
              if (!day) return;
              const iso = dateToIso(day);
              setText(formatIsoToUsDate(iso));
              emitChange(iso);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
