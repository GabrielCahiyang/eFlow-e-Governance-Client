// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateInput, formatIsoToUsDate } from '../../src/app/components/ui/DateInput';
import { formatManilaDate } from '../../src/app/shared/calendarDisplay';
import { workDateLabel } from '../../src/app/shared/workCalendar';

afterEach(cleanup);

describe('MM/DD/YYYY date formatting and DateInput control', () => {
  it('formats Manila dates and work labels as MM/DD/YYYY', () => {
    expect(formatIsoToUsDate('2026-11-20')).toBe('11/20/2026');
    expect(formatManilaDate('2026-11-20')).toBe('11/20/2026');
    expect(workDateLabel('2026-11-20', 'Asia/Manila')).toBe('11/20/2026');
  });

  it('displays MM/DD/YYYY while emitting ISO YYYY-MM-DD changes', () => {
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
});
