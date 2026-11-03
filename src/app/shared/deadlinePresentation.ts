import {getPhilippineCalendarDate, isCalendarDate} from './calendarDates';

export type DeadlineTone = 'neutral' | 'green' | 'yellow' | 'red';
export function deadlinePresentation(value?: string | null, status?: string, now = Date.now()) {
  const raw = value?.trim() || '';
  const at = raw.length > 10 ? Date.parse(raw) : NaN;
  const date = Number.isFinite(at) ? getPhilippineCalendarDate(new Date(at)) : raw.slice(0, 10);
  if (!isCalendarDate(date)) return {tone: 'neutral' as DeadlineTone, date: '', label: raw || 'No deadline'};
  const terminal = ['completed', 'approved', 'cancelled', 'canceled'].includes(status || '');
  const today = getPhilippineCalendarDate(new Date(now));
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  const overdue = days < 0 || (Number.isFinite(at) && at < now);
  const count = Math.max(1, Math.abs(days));
  const label = terminal ? (status === 'cancelled' || status === 'canceled' ? 'Cancelled' : 'Completed')
    : overdue ? (days === 0 ? 'Overdue today' : `${count} ${count === 1 ? 'day' : 'days'} overdue`)
    : days === 0 ? 'Due today' : days === 1 ? '1 day left' : `${days} days left`;
  return {date, days, label, tone: (terminal ? 'neutral' : overdue ? 'red' : days <= 3 ? 'yellow' : 'green') as DeadlineTone};
}
