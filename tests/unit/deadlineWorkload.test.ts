import { describe, expect, it } from 'vitest';
import { calculateDeadlineWorkload, workingHoursBetween, workloadDeadline } from '../../src/app/features/tasks/selectors/deadlineWorkload';
import type { Task } from '../../src/app/features/tasks/taskTypes';
import { withEmployeeDeadlineWorkload } from '../../src/app/features/tasks/selectors/employeeDeadlineWorkload';
const task = (deadline: string, patch: Partial<Task> = {}): Task => ({ id: crypto.randomUUID(), title: 'Work', status: 'todo', createdAt: 1, updatedAt: 1, deadline, ...patch });
const monday = Date.parse('2026-09-28T08:00:00+08:00');

describe('deadline workload without duration estimates', () => {
 it('counts assigned and supporting work without inventing remaining hours or capacity', () => {
  const employees=[{id:'a',currentWorkload:0},{id:'b',currentWorkload:100}];
  const rows=withEmployeeDeadlineWorkload(employees,[task('2026-10-02',{assigneeId:'a',teamMemberIds:['a','b']})],monday);
  expect(rows.map(row=>row.deadlineWorkload.label)).toEqual(['Active work','Active work']);
  expect(rows[1].deadlineWorkload.activeTasks).toBe(1);
  expect(rows[1].deadlineWorkload).not.toHaveProperty('remainingHours');
  expect(employees[0].currentWorkload).toBe(0);
 });
 it('distinguishes recorded overdue dates and missing dates',()=>{
  const result=calculateDeadlineWorkload([task('2026-09-27'),task(''),task('2026-10-02')],monday);
  expect(result).toMatchObject({activeTasks:3,overdue:1,missingDeadlines:1,label:'Overdue work',signal:100});
  expect(calculateDeadlineWorkload([task('2026-10-02')],monday).label).toBe('Active work');
 });
 it('excludes finished, review, archived and unrelated work',()=>{
  const result=calculateDeadlineWorkload([task('2026-09-27',{status:'completed'}),task('2026-09-27',{status:'for_review'}),task('2026-09-27',{archivedAt:1})],monday);
  expect(result).toMatchObject({activeTasks:0,signal:0,label:'No active work'});
  expect(calculateDeadlineWorkload([task('2026-09-27',{assigneeId:'other'})],monday,'a').activeTasks).toBe(0);
 });
 it('preserves Manila date and working calendar semantics',()=>{
  expect(workloadDeadline(task('2026-09-28'))).toBe(Date.parse('2026-09-28T23:59:59.999+08:00'));
  expect(workingHoursBetween(Date.parse('2026-10-02T08:00+08:00'),Date.parse('2026-10-05T17:00+08:00'))).toBe(16);
 });
});
