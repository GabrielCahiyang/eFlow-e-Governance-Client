const manila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
export const getPhilippineCalendarDate = (now = new Date()) => manila.format(now);
export function getPhilippineLocalDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return `${getPhilippineCalendarDate(now)}T${parts}`;
}
export function isCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
/** Unchanged historical dates remain valid when editing an existing record. */
export function scheduledDateError(value: string, { original = '', earliest = getPhilippineCalendarDate(), latest = '', label = 'Date' } = {}) {
  if (!value) return '';
  if (!isCalendarDate(value)) return `${label} must be a valid date.`;
  if (value !== original && value < earliest) return `${label} cannot be before ${earliest}.`;
  if (latest && value > latest && value !== original) return `${label} cannot be after ${latest}.`;
  return '';
}
export function scheduleRangeError(start: string, due: string, originalStart = '', originalDue = '') {
  if (start && due && due < start) return 'Due date cannot be before the start date.';
  return scheduledDateError(start, { original: originalStart, label: 'Start date' }) || scheduledDateError(due, { original: originalDue, label: 'Due date' });
}
export function historicalDateError(value: string, label = 'Date', required = true) {
  if (!value) return required ? `${label} is required.` : '';
  if (!isCalendarDate(value)) return `${label} must be a valid date.`;
  return value > getPhilippineCalendarDate() ? `${label} cannot be in the future.` : '';
}
export function calendarMinDate(original = '') {
  const today = getPhilippineCalendarDate();
  return original && isCalendarDate(original) && original < today ? original : today;
}
