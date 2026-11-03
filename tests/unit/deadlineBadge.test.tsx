// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {act, cleanup, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DeadlineBadge} from '../../src/app/components/ui/DeadlineBadge';
import {deadlinePresentation} from '../../src/app/shared/deadlinePresentation';

const now = Date.parse('2026-11-03T12:00:00+08:00');
afterEach(() => {cleanup(); vi.useRealTimers();});
it('uses green, yellow and red at the calendar-day boundaries', () => {
  expect(deadlinePresentation('2026-11-07', 'todo', now)).toMatchObject({tone:'green',label:'4 days left'});
  expect(deadlinePresentation('2026-11-06', 'todo', now)).toMatchObject({tone:'yellow',label:'3 days left'});
  expect(deadlinePresentation('2026-11-04', 'todo', now).label).toBe('1 day left');
  expect(deadlinePresentation('2026-11-03', 'todo', now)).toMatchObject({tone:'yellow',label:'Due today'});
  expect(deadlinePresentation('2026-11-02', 'todo', now)).toMatchObject({tone:'red',label:'1 day overdue'});
});
it('keeps completed, cancelled, missing and relative deadlines neutral', () => {
  for (const status of ['completed','cancelled']) expect(deadlinePresentation('2026-11-01',status,now).tone).toBe('neutral');
  expect(deadlinePresentation(null,'todo',now).label).toBe('No deadline');
  expect(deadlinePresentation('Month 1','todo',now)).toMatchObject({tone:'neutral',date:'',label:'Month 1'});
  expect(deadlinePresentation('2026-02-30','todo',now).date).toBe('');
});
it('uses Manila midnight and respects a specific due time', () => {
  expect(deadlinePresentation('2026-11-04','todo',Date.parse('2026-11-03T16:01:00Z')).label).toBe('Due today');
  expect(deadlinePresentation('2026-11-03T11:00:00+08:00','todo',now).label).toBe('Overdue today');
  expect(deadlinePresentation('2026-11-03T17:00:00Z','todo',now)).toMatchObject({date:'2026-11-04',days:1});
});
it('updates a mounted badge at midnight without a manual refresh', () => {
  vi.useFakeTimers(); vi.setSystemTime('2026-11-03T23:59:30+08:00');
  const {container,unmount}=render(<DeadlineBadge value="2026-11-03"/>);
  expect(screen.getByText('Due today')).toBeVisible();
  act(() => {vi.advanceTimersByTime(60_000);});
  expect(screen.getByText('1 day overdue')).toBeVisible();
  expect(container.firstChild).toHaveAttribute('data-tone','red');
  unmount(); expect(vi.getTimerCount()).toBe(0);
});
it('shows the date and words so urgency does not depend on color alone', () => {
  render(<DeadlineBadge value="2026-11-05" now={now}/>);
  expect(screen.getByText('Nov 5, 2026')).toBeVisible();
  expect(screen.getByText('2 days left')).toBeVisible();
});
