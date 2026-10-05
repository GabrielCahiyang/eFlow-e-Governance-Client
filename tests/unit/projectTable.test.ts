import { describe, expect, it } from 'vitest';
import { visibleProjectTasks, tasksInGroup, groupSummary, canEditProjectTask, inlineStatusOptions, dependencyWouldCycle } from '../../src/app/features/project-table/selectors';
import type { Task } from '../../src/app/features/tasks';
const task = (id: string, patch: Partial<Task> = {}): Task => ({ id, title: id, status: 'todo', createdAt: 1, updatedAt: 1, orgId: 'office', ...patch });
const group = { id: 'group', projectId: 'project', title: 'To do', color: '#087f8c', position: 0, isDefault: true };
describe('Project table over canonical work', () => {
  it('keeps legacy work in the default group and isolates explicit groups', () => {
    const tasks = [task('legacy'), task('same', { groupId: 'group' }), task('other', { groupId: 'other' })];
    expect(tasksInGroup(tasks, group).map(t => t.id)).toEqual(['legacy', 'same']);
    expect(tasksInGroup(tasks, { ...group, isDefault: false }).map(t => t.id)).toEqual(['same']);
  });
  it('combines search, owner, status and archived filtering without mutating the source', () => {
    const tasks = [task('a', { title: 'Budget review', assigneeId: 'member' }), task('b', { title: 'Budget review', archivedAt: 2 }), task('c', { title: 'Budget review', status: 'completed' })];
    expect(visibleProjectTasks(tasks, ' BUDGET ', 'todo', 'member', 'title').map(t => t.id)).toEqual(['a']);
    expect(tasks.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });
  it('preserves manual ordering and places undated work last', () => {
    const tasks = [task('a', { workspacePosition: 2 }), task('b', { workspacePosition: 0, deadline: '2026-10-08' }), task('c', { workspacePosition: 1, deadline: '2026-10-05' })];
    expect(visibleProjectTasks(tasks, '', '', '', 'manual').map(t => t.id)).toEqual(['b', 'c', 'a']);
    expect(visibleProjectTasks(tasks, '', '', '', 'deadline').map(t => t.id)).toEqual(['c', 'b', 'a']);
  });
  it('allows structural edits only for the responsible Head on open work', () => {
    expect(canEditProjectTask(task('a'), true, 'office')).toBe(true);
    expect(canEditProjectTask(task('a'), false, 'office')).toBe(false);
    expect(canEditProjectTask(task('a'), true, 'other')).toBe(false);
    expect(canEditProjectTask(task('a', { status: 'completed' }), true, 'office')).toBe(false);
    expect(canEditProjectTask(task('a', { archivedAt: 2 }), true, 'office')).toBe(false);
  });
  it('does not expose review approval or completion as arbitrary status edits', () => {
    expect(inlineStatusOptions(task('a', { assigneeId: 'member' }), 'member', false)).toEqual(['todo', 'in_progress']);
    expect(inlineStatusOptions(task('a', { assigneeId: 'member' }), 'stranger', true)).toEqual(['todo']);
    expect(inlineStatusOptions(task('a', { status: 'for_review' }), 'head', true)).toEqual(['for_review']);
  });
  it('rejects direct and transitive dependency cycles while allowing independent work', () => {
    const tasks = [task('a'), task('b', { dependencyIds: ['a'] }), task('c', { dependencyIds: ['b'] })];
    expect(dependencyWouldCycle(tasks, 'a', ['a'])).toBe(true);
    expect(dependencyWouldCycle(tasks, 'a', ['c'])).toBe(true);
    expect(dependencyWouldCycle(tasks, 'c', ['a'])).toBe(false);
  });
  it('summarizes planning estimates separately from completion progress', () => {
    expect(groupSummary([task('a', { status: 'completed', estimatedHours: 8, budgetImpact: 1200 }), task('b', { percentComplete: 40, estimatedHours: 2, budgetImpact: 300 })])).toEqual({ count: 2, completed: 1, effort: 10, budget: 1500, progress: 70 });
  });
});
