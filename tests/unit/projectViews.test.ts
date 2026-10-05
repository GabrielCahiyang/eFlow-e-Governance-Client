import { describe, expect, it } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { filterProjectViewTasks, calendarDay, dayString, scheduledTaskRows, shiftedTaskDates, projectBoardMoveError, longestDependencyChain, officeTaskSummaries } from '../../src/app/features/project-views/selectors';
import { EMPTY_PROJECT_FILTERS } from '../../src/app/features/project-views/types';

const task = (id: string, patch: Partial<Task> = {}): Task => ({ id, title: id, orgId: 'office', status: 'todo', createdAt: 1, updatedAt: 1, ...patch });
describe('One canonical project across views', () => {
  it('combines all shared filters without changing source records', () => {
    const tasks = [task('A', { title: 'Briefing', assigneeId: 'member' }), task('B', { title: 'Briefing', orgId: 'other', assigneeId: 'member' }), task('C', { title: 'Briefing', status: 'completed' }), task('D', { title: 'Briefing', archivedAt: 2 })];
    expect(filterProjectViewTasks(tasks, { ...EMPTY_PROJECT_FILTERS, query: 'brief', owner: 'member', office: 'office', status: 'todo' }).map(t => t.id)).toEqual(['A']);
    expect(tasks).toHaveLength(4);
  });
  it('keeps due-only work as points and excludes invalid, missing and inverted dates', () => {
    const rows = scheduledTaskRows([task('span', { startDate: '2026-10-01', deadline: '2026-10-03' }), task('point', { deadline: '2026-10-03' }), task('none'), task('relative', { deadline: 'Month 1-2' }), task('bad', { startDate: '2026-10-05', deadline: '2026-10-03' })]);
    expect(rows.map(r => [r.task.id, r.point, r.end-r.start])).toEqual([['span', false, 2], ['point', true, 0]]);
  });
  it('rejects impossible calendar dates and round-trips real dates independently of timezone', () => {
    expect(calendarDay('2026-02-30')).toBeNull();
    expect(calendarDay('Month 3')).toBeNull();
    expect(dayString(calendarDay('2028-02-29')!)).toBe('2028-02-29');
  });
  it('moves the recorded range while preserving the due-time suffix', () => {
    expect(shiftedTaskDates(task('a', { startDate: '2026-10-01', deadline: '2026-10-03T16:00:00+08:00' }), 2, 'move')).toEqual({ start_date: '2026-10-03', deadline: '2026-10-05T16:00:00+08:00' });
  });
  it('resizes one edge and never manufactures a start date for a point', () => {
    expect(shiftedTaskDates(task('a', { startDate: '2026-10-01', deadline: '2026-10-03' }), 1, 'end')).toEqual({ start_date: '2026-10-01', deadline: '2026-10-04' });
    expect(shiftedTaskDates(task('a', { deadline: '2026-10-03' }), 1, 'move')).toEqual({ start_date: null, deadline: '2026-10-04' });
    expect(()=>shiftedTaskDates(task('a', { startDate: '2026-10-01', deadline: '2026-10-03' }), 4, 'start')).toThrow('Start date');
  });
  it('allows starting assigned work and resuming the scoped Head workflow', () => {
    expect(projectBoardMoveError(task('a', { assigneeId: 'member' }), 'in_progress', 'member', false, false)).toBeNull();
    expect(projectBoardMoveError(task('a', { status: 'changes_requested' }), 'in_progress', 'head', true, false)).toBeNull();
    expect(projectBoardMoveError(task('a'), 'in_progress', 'stranger', false, false)).toBeTruthy();
  });
  it('blocks oversight, closed tasks, evidence bypass and arbitrary review decisions', () => {
    expect(projectBoardMoveError(task('a', { assigneeId: 'admin' }), 'in_progress', 'admin', true, true)).toContain('read-only');
    expect(projectBoardMoveError(task('a', { status: 'completed' }), 'in_progress', 'head', true, false)).toContain('read-only');
    expect(projectBoardMoveError(task('a'), 'for_review', 'head', true, false)).toContain('evidence');
    expect(projectBoardMoveError(task('a'), 'completed', 'head', true, false)).toContain('review workflow');
  });
  it('finds a dated dependency chain without using unrelated or completed work', () => {
    const tasks = [task('a', { startDate: '2026-10-01', deadline: '2026-10-02' }), task('b', { startDate: '2026-10-03', deadline: '2026-10-05', dependencyIds: ['a'] }), task('done', { status:'completed', startDate:'2026-09-01', deadline:'2026-10-05' })];
    expect(longestDependencyChain(tasks)).toEqual(['a','b']);
    expect(longestDependencyChain([task('x',{deadline:'2026-10-02'})])).toEqual([]);
  });
  it('does not invent a critical chain for cyclic imported dependencies', () => {
    expect(longestDependencyChain([task('a',{startDate:'2026-10-01',deadline:'2026-10-02',dependencyIds:['b']}),task('b',{startDate:'2026-10-03',deadline:'2026-10-04',dependencyIds:['a']})])).toEqual([]);
  });
  it('keeps cancelled work distinct from completed and overdue Office work', () => {
    const rows = officeTaskSummaries([task('done',{status:'completed',deadline:'2000-01-01'}),task('cancelled',{status:'cancelled',deadline:'2000-01-01'}),task('late',{deadline:'2000-01-01'}),task('other',{orgId:'other'})]);
    expect(rows[0]).toMatchObject({officeId:'office',total:3,completed:1,active:1,overdue:1});
    expect(rows[1]).toMatchObject({officeId:'other',total:1});
  });
});
