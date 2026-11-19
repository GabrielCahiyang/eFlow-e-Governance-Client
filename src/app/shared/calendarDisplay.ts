import { isCalendarDate } from './calendarDates';

export const MANILA_TIMEZONE = 'Asia/Manila';

const EXPLICIT_ZONE_RE = /(?:T|\s)\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const timeFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const timeWithSecondsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const weekdayDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  weekday: 'long',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

const shortWeekdayDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TIMEZONE,
  weekday: 'short',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

function parseInstant(value?: string | number | Date | null): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.valueOf()) ? value : null;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isFinite(d.valueOf()) ? d : null;
  }
  const trimmed = value.trim();
  if (!trimmed || !EXPLICIT_ZONE_RE.test(trimmed)) return null;
  const d = new Date(trimmed);
  return Number.isFinite(d.valueOf()) ? d : null;
}

/**
 * Formats a calendar date (`YYYY-MM-DD`) or explicit-zone instant into Philippine Time `MM/DD/YYYY`.
 * Rejects zoneless timestamp strings so ambiguous local times are never silently shifted.
 */
export function formatManilaDate(value?: string | number | Date | null, fallback = 'Not set'): string {
  if (value == null || value === '') return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isCalendarDate(trimmed)) {
      return dateFormat.format(new Date(`${trimmed}T00:00:00+08:00`));
    }
    const instant = parseInstant(trimmed);
    return instant ? dateFormat.format(instant) : fallback;
  }
  const instant = parseInstant(value);
  return instant ? dateFormat.format(instant) : fallback;
}

/**
 * Formats an instant into Philippine Time `MM/DD/YYYY, hh:mm AM/PM` (no `PHT` suffix).
 * For calendar-only strings (`YYYY-MM-DD`), falls back cleanly to `MM/DD/YYYY`.
 */
export function formatManilaDateTime(value?: string | number | Date | null, fallback = 'Not recorded'): string {
  if (typeof value === 'string' && isCalendarDate(value.trim())) {
    return formatManilaDate(value, fallback);
  }
  const instant = parseInstant(value);
  return instant ? dateTimeFormat.format(instant) : fallback;
}

/** Formats an instant into Philippine Time `MM/DD/YYYY, hh:mm AM/PM PHT`. */
export function formatManilaInstant(value?: string | number | Date | null, fallback = 'Not recorded'): string {
  const instant = parseInstant(value);
  return instant ? `${dateTimeFormat.format(instant)} PHT` : fallback;
}

/** Formats an instant into Philippine Time `hh:mm AM/PM` (or `hh:mm:ss AM/PM`). */
export function formatManilaTime(
  value?: string | number | Date | null,
  fallback = '—',
  options?: { withSeconds?: boolean },
): string {
  const instant = parseInstant(value);
  if (!instant) return fallback;
  return options?.withSeconds ? timeWithSecondsFormat.format(instant) : timeFormat.format(instant);
}

/** Formats a date or instant into `Thursday, 11/19/2026` (or `Thu, 11/19/2026` when short). */
export function formatManilaWeekdayDate(
  value?: string | number | Date | null,
  options?: { shortWeekday?: boolean; fallback?: string },
): string {
  const fallback = options?.fallback ?? 'Not set';
  if (value == null || value === '') return fallback;
  const target =
    typeof value === 'string' && isCalendarDate(value.trim())
      ? new Date(`${value.trim()}T00:00:00+08:00`)
      : parseInstant(value);
  if (!target) return fallback;
  return (options?.shortWeekday ? shortWeekdayDateFormat : weekdayDateFormat).format(target);
}
