import { isCalendarDate } from './calendarDates';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric',
});
const instantFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
});

/** Calendar values are dates, not browser-local instants. */
export function formatManilaDate(value?: string | null, fallback = 'Not set') {
  if (!value) return fallback;
  if (isCalendarDate(value)) return dateFormat.format(new Date(`${value}T00:00:00+08:00`));
  // Accept explicit-zone instants only; never guess a zone for a local timestamp.
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? dateFormat.format(date) : fallback;
}

export function formatManilaInstant(value?: string | number | null, fallback = 'Not recorded') {
  if (value == null || (typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))) return fallback;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) ? `${instantFormat.format(date)} PHT` : fallback;
}
