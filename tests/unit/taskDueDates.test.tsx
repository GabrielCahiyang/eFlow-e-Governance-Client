// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { timelineDraft, timelineError, timelinePatch, todayDate } from '../../src/app/features/project-table/planningDraft';
import { TimelineCell } from '../../src/app/features/project-table/components/TimelineCell';
import { TaskDatesDialog } from '../../src/app/features/project-views/components/TaskDatesDialog';

const task: Task = { id: 'dates', title: 'Prepare meeting', orgId: 'office', status: 'todo', createdAt: 1, updatedAt: 1 };
const now = new Date(2026, 9, 17, 12, 30, 45);
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('task due date validation', () => {
  it('rejects past days, reversed dates, invalid dates and elapsed times while allowing today', () => {
    expect(todayDate()).toBe('2026-10-17');
    expect(timelineError(task, { start: '', end: '2026-10-16' })).toContain('future due date');
    expect(timelineError(task, { start: '2026-10-19', end: '2026-10-18' })).toContain('before the start');
    expect(timelineError(task, { start: '', end: '2026-02-30' })).toBe('Enter a valid date.');
    expect(timelineError(task, { start: '', end: '2026-10-17', time: '12:29' })).toContain('has not passed');
    expect(timelineError(task, { start: '', end: '2026-10-17', time: '12:30' })).toBeUndefined();
    expect(timelineError(task, { start: '', end: '2026-10-17' })).toBeUndefined();
    expect(timelineError(task, { start: '', end: '', time: '13:00' })).toContain('Choose a due date');
    expect(() => timelinePatch(task, { start: '', end: '2026-10-16' })).toThrow('future due date');
  });
  it('defaults blank times to local 11:59 PM and round-trips hours and minutes', () => {
    const patch = timelinePatch(task, { start: '', end: '2026-10-17', time: '' });
    const deadline = new Date(patch.deadline!);
    expect([deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), deadline.getHours(), deadline.getMinutes()]).toEqual([2026, 9, 17, 23, 59]);
    const timed = timelinePatch(task, { start: '', end: '2026-10-18', time: '09:05' });
    expect(timelineDraft({ ...task, deadline: timed.deadline })).toEqual({ start: '', end: '2026-10-18', time: '09:05' });
    expect(timelinePatch({ ...task, deadline: '2026-10-17T17:45:00+08:00' }, { start: '', end: '2026-10-18', time: '10:15' }).deadline).toBe('2026-10-18T10:15:00+08:00');
    expect(timelinePatch({ ...task, deadline: '2026-10-17T17:45:00+08:00' }, { start: '', end: '2026-10-18', time: '' }).deadline).toBe('2026-10-18T23:59:00+08:00');
  });
  it('preserves historical start dates but rejects newly chosen past starts, and permits clearing dates', () => {
    const started = { ...task, startDate: '2026-10-01' };
    expect(timelineError(started, { start: '2026-10-01', end: '2026-10-18' })).toBeUndefined();
    expect(timelineError(started, { start: '2026-10-02', end: '2026-10-18' })).toContain('future start date');
    expect(timelinePatch(task, { start: '', end: '', time: '' })).toEqual({ start_date: null, deadline: '' });
  });
  it.each(['table', 'dialog'])('%s disables past calendar dates and rejects bypassed invalid submissions', async kind => {
    const save = vi.fn().mockResolvedValue(undefined);
    if (kind === 'table') {
      render(<TimelineCell task={task} disabled={false} save={save}/>);
      fireEvent.click(screen.getByRole('button', { name: 'Edit dates for Prepare meeting' }));
    } else render(<TaskDatesDialog task={task} onClose={vi.fn()} onSave={save}/>);
    const due = screen.getByLabelText('Due date'), start = screen.getByLabelText('Start date');
    const time = screen.getByLabelText('Due time (optional)');
    expect(due.getAttribute('min')).toBe('2026-10-17');
    expect(start.getAttribute('min')).toBe('2026-10-17');
    expect(time).toHaveProperty('disabled', true);
    fireEvent.change(due, { target: { value: '2026-10-16' } });
    expect(screen.getByRole('button', { name: 'Save dates' })).toHaveProperty('disabled', true);
    fireEvent.submit(due.closest('form')!);
    await screen.findByRole('alert'); expect(save).not.toHaveBeenCalled();
    fireEvent.change(due, { target: { value: '2026-10-17' } });
    fireEvent.change(time, { target: { value: '13:05' } });
    fireEvent.submit(due.closest('form')!);
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const patch = save.mock.calls[0][kind === 'table' ? 0 : 1];
    expect(patch.deadline).toMatch(/^2026-10-17T13:05:00[+-]\d{2}:\d{2}$/);
  });
});
