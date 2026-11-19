// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateInput, formatIsoToUsDate } from '../../src/app/components/ui/DateInput';
import { DateTimeInput } from '../../src/app/components/ui/DateTimeInput';
import { scheduledDateError } from '../../src/app/shared/calendarDates';
import {
  formatManilaDate,
  formatManilaDateTime,
  formatManilaInstant,
  formatManilaTime,
  formatManilaWeekdayDate,
} from '../../src/app/shared/calendarDisplay';
import { workDateLabel } from '../../src/app/shared/workCalendar';

afterEach(cleanup);

describe('Philippine Time (Asia/Manila) MM/DD/YYYY standardization', () => {
  it('formats dates, date-times, instants, times, and weekday dates in Asia/Manila MM/DD/YYYY', () => {
    expect(formatIsoToUsDate('2026-11-20')).toBe('11/20/2026');
    expect(formatManilaDate('2026-11-20')).toBe('11/20/2026');
    expect(workDateLabel('2026-11-20', 'Asia/Manila')).toBe('11/20/2026');

    // 2026-11-19T16:30:00Z is 2026-11-20 12:30 AM in Asia/Manila (UTC+8)
    expect(formatManilaDate('2026-11-19T16:30:00Z')).toBe('11/20/2026');
    expect(formatManilaDateTime('2026-11-19T16:30:00Z')).toBe('11/20/2026, 12:30 AM');
    expect(formatManilaInstant('2026-11-19T16:30:00Z')).toBe('11/20/2026, 12:30 AM PHT');
    expect(formatManilaTime('2026-11-19T07:45:09Z')).toBe('03:45 PM');
    expect(formatManilaTime('2026-11-19T07:45:09Z', '—', { withSeconds: true })).toBe('03:45:09 PM');
    expect(formatManilaWeekdayDate('2026-11-19')).toBe('Thursday, 11/19/2026');
    expect(formatManilaWeekdayDate('2026-11-19', { shortWeekday: true })).toBe('Thu, 11/19/2026');

    // Zoneless timestamp strings and impossible dates stay rejected to prevent silent timezone/calendar shifts
    expect(formatManilaDate('2026-02-30')).toBe('Not set');
    expect(formatManilaDate('2026-11-19T16:30:00')).toBe('Not set');
    expect(formatManilaDateTime('2026-11-19T16:30:00')).toBe('Not recorded');
  });

  it('formats scheduledDateError bounds in MM/DD/YYYY instead of ISO', () => {
    expect(scheduledDateError('2026-11-18', { earliest: '2026-11-19', label: 'Start date' })).toBe(
      'Start date cannot be before 11/19/2026.',
    );
    expect(scheduledDateError('2026-11-25', { earliest: '2026-11-19', latest: '2026-11-20', label: 'Due date' })).toBe(
      'Due date cannot be after 11/20/2026.',
    );
  });

  it('displays MM/DD/YYYY in DateInput while emitting ISO YYYY-MM-DD changes', () => {
    const onChange = vi.fn();
    render(<DateInput aria-label="Target date" value="2026-11-20" onChange={onChange} />);
    const input = screen.getByLabelText('Target date') as HTMLInputElement;
    expect(input.value).toBe('11/20/2026');

    fireEvent.change(input, { target: { value: '12/15/2026' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2026-12-15' }) }),
    );

    fireEvent.change(input, { target: { value: '2027-01-05' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: expect.objectContaining({ value: '2027-01-05' }) }),
    );
  });

  it('displays MM/DD/YYYY and 12-hour AM/PM in DateTimeInput while emitting ISO YYYY-MM-DDTHH:mm', () => {
    const onChange = vi.fn();
    render(<DateTimeInput aria-label="First scheduled run" value="2026-11-20T15:30" onChange={onChange} />);
    expect((screen.getByLabelText('First scheduled run date') as HTMLInputElement).value).toBe('11/20/2026');
    expect((screen.getByLabelText('First scheduled run hour') as HTMLSelectElement).value).toBe('03');
    expect((screen.getByLabelText('First scheduled run minute') as HTMLSelectElement).value).toBe('30');
    expect((screen.getByLabelText('First scheduled run AM/PM') as HTMLSelectElement).value).toBe('PM');

    fireEvent.change(screen.getByLabelText('First scheduled run AM/PM'), { target: { value: 'AM' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-11-20T03:30');
  });
});
