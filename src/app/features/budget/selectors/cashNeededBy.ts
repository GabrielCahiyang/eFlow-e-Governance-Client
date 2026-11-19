import { isCalendarDate } from '../../../shared/calendarDates';
import { formatManilaDate } from '../../../shared/calendarDisplay';

export function cashNeededByBounds(today: string, start?: string, end?: string) {
  const first = start?.slice(0, 10);
  const last = end?.slice(0, 10);
  const min = first && isCalendarDate(first) && first > today ? first : today;
  const max = last && isCalendarDate(last) ? last : undefined;
  return { min, max };
}

export function cashNeededByError(value: string, { min, max }: ReturnType<typeof cashNeededByBounds>) {
  if (max && min > max) return 'The task schedule has passed or is invalid. Update the task dates before requesting cash.';
  if (!value) return 'Needed-by date is required.';
  if (!isCalendarDate(value)) return 'Needed-by date must be a valid date.';
  if (value < min) return `Needed-by date must be on or after ${formatManilaDate(min, min)}.`;
  if (max && value > max) return `Needed-by date must be on or before ${formatManilaDate(max, max)}.`;
  return '';
}
