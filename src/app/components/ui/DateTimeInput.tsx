import { DateInput } from './DateInput';

export interface DateTimeInputProps {
  value?: string;
  min?: string;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
  onChange?: (nextIsoLocal: string) => void;
}

const HOURS_12 = Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, idx) => String(idx).padStart(2, '0'));

function parseLocalDateTime(value?: string): { date: string; hour12: string; minute: string; period: 'AM' | 'PM' } {
  const trimmed = (value || '').trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(trimmed);
  if (!match) {
    return { date: '', hour12: '09', minute: '00', period: 'AM' };
  }
  const [, date, hhStr, mmStr] = match;
  const hh = Number(hhStr);
  const period: 'AM' | 'PM' = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return {
    date,
    hour12: String(h12).padStart(2, '0'),
    minute: mmStr,
    period,
  };
}

function buildLocalDateTime(date: string, hour12: string, minute: string, period: 'AM' | 'PM'): string {
  if (!date) return '';
  const h12 = Number(hour12);
  let hh24 = h12 % 12;
  if (period === 'PM') hh24 += 12;
  return `${date}T${String(hh24).padStart(2, '0')}:${minute}`;
}

/**
 * Philippine Time (Asia/Manila) MM/DD/YYYY + 12-hour AM/PM date-time input.
 * Emits standard `YYYY-MM-DDTHH:mm` strings internally so existing form/API contracts stay unchanged.
 */
export function DateTimeInput({
  value = '',
  min,
  disabled,
  'aria-label': ariaLabel = 'Date and time',
  className = '',
  onChange,
}: DateTimeInputProps) {
  const parts = parseLocalDateTime(value);
  const minDate = min && /^\d{4}-\d{2}-\d{2}/.test(min) ? min.slice(0, 10) : undefined;

  const update = (next: Partial<typeof parts>) => {
    const merged = { ...parts, ...next };
    onChange?.(buildLocalDateTime(merged.date, merged.hour12, merged.minute, merged.period));
  };

  const selectClass =
    'eflow-form-input h-10 rounded-lg border border-border bg-input-background px-2 text-[13px] font-normal text-foreground outline-none transition-all hover:border-neutral-400 focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:opacity-50';

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} role="group" aria-label={ariaLabel}>
      <div className="min-w-[136px] flex-1">
        <DateInput
          aria-label={`${ariaLabel} date`}
          value={parts.date}
          min={minDate}
          disabled={disabled}
          onChange={(event) => update({ date: event.target.value })}
        />
      </div>
      <div className="flex items-center gap-1">
        <select
          aria-label={`${ariaLabel} hour`}
          value={parts.hour12}
          disabled={disabled || !parts.date}
          onChange={(event) => update({ hour12: event.target.value })}
          className={selectClass}
        >
          {HOURS_12.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-xs font-medium text-muted-foreground" aria-hidden="true">:</span>
        <select
          aria-label={`${ariaLabel} minute`}
          value={parts.minute}
          disabled={disabled || !parts.date}
          onChange={(event) => update({ minute: event.target.value })}
          className={selectClass}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          aria-label={`${ariaLabel} AM/PM`}
          value={parts.period}
          disabled={disabled || !parts.date}
          onChange={(event) => update({ period: event.target.value as 'AM' | 'PM' })}
          className={selectClass}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
