import { describe, it, expect } from 'vitest';
import type { Task } from '../../src/app/features/tasks';
import { EMPTY_PROJECT_FILTERS } from '../../src/app/features/project-views/types';
import { filterProjectViewTasks, shiftedTaskDates } from '../../src/app/features/project-views/selectors';
import { normalizeProjectFilters, projectViewPreferenceKey } from '../../src/app/features/project-views/preferences';
import { scopeProjectViewData } from '../../src/app/features/projects/selectors/projectViewContext';
import type { ProjectCommandData } from '../../src/app/features/projects';
const task = (id:string, patch:Partial<Task>={}):Task => ({id,title:id,status:'todo',createdAt:1,updatedAt:1,...patch});
describe('Phase 12 shared context',()=>{
 it('filters inclusive schedule overlap while excluding invalid and undated records only with a range',()=>{
  const tasks=[task('spans',{startDate:'2026-10-01',deadline:'2026-10-20'}),task('point',{deadline:'2026-10-10'}),task('outside',{deadline:'2026-10-09'}),task('none'),task('inverted',{startDate:'2026-10-20',deadline:'2026-10-10'})];
  expect(filterProjectViewTasks(tasks,{...EMPTY_PROJECT_FILTERS,dateFrom:'2026-10-10',dateTo:'2026-10-12'}).map(t=>t.id)).toEqual(['point','spans']);
  expect(filterProjectViewTasks(tasks,EMPTY_PROJECT_FILTERS)).toHaveLength(5);
 });
 it.each([null,[],{dateFrom:'2026-02-30',dateTo:'oops',sort:'unknown',status:'missing-status'},{dateFrom:'2026-10-12',dateTo:'2026-10-01'}])('normalizes malformed persisted dates and sort (%j)',value=>{
  const normalized=normalizeProjectFilters(value);expect(normalized.dateFrom).toBe('');expect(normalized.dateTo).toBe('');expect(normalized.sort).toBe('manual');expect(normalized.status).toBe('');
 });
 it('isolates personal presentation by account and project and preserves valid filters',()=>{
  expect(projectViewPreferenceKey('a','p')).not.toBe(projectViewPreferenceKey('b','p'));
  expect(projectViewPreferenceKey('a','p')).not.toBe(projectViewPreferenceKey('a','q'));
  expect(normalizeProjectFilters({query:'brief',dateFrom:'2028-02-29',sort:'deadline'})).toMatchObject({query:'brief',dateFrom:'2028-02-29',sort:'deadline'});
 });
 it.each(['2026-03-08T16:15:00-04:00','2026-11-01T16:15:00-05:00','2026-10-06T16:15:00+08:00','2026-10-06T16:15:00Z'])('preserves recorded wall time and timezone suffix for %s',deadline=>{
  const patch=shiftedTaskDates(task('dated',{deadline}),1,'move');expect(patch.deadline.slice(10)).toBe(deadline.slice(10));expect(patch.start_date).toBeNull();
 });
 it('scopes every fact and attention collection with the same task IDs without mutating canonical data',()=>{
  const tasks=[task('a'),task('b')], facts={subtasks:[{taskId:'a'},{taskId:'b'}],progress:[{taskId:'a'},{taskId:'b'}],submissions:[{taskId:'a'},{taskId:'b'}],statusHistory:[{taskId:'a'},{taskId:'b'}],evidence:[{taskId:'a'},{taskId:'b'}]};
  const financial={allocations:[{id:'aa',taskId:'a',commitmentId:'ca'},{id:'ab',taskId:'b',commitmentId:'cb'}],requests:[{id:'ra',taskId:'a',commitmentId:'ca'},{id:'rb',taskId:'b',commitmentId:'cb'}],liquidations:[],commitments:[{id:'ca'},{id:'cb'}],allocationLines:[],requestAttachments:[],releases:[],ledger:[],envelopes:[],summary:{approvedAmount:0,releasedAmount:0}};
  const data={project:{id:'p',title:'Project'},tasks,facts,attention:[{taskId:'a'},{taskId:'b'}],milestones:[],financial} as unknown as ProjectCommandData;
  const scoped=scopeProjectViewData(data,[tasks[0]]);
  expect(scoped.tasks).toEqual([tasks[0]]);for(const collection of Object.values(scoped.facts))expect(collection.map(f=>f.taskId)).toEqual(['a']);
  expect(scoped.financial.allocations.map(row=>row.id)).toEqual(['aa']);expect(scoped.financial.requests.map(row=>row.id)).toEqual(['ra']);expect(scoped.financial.commitments.map(row=>row.id)).toEqual(['ca']);expect(scoped.attention).toHaveLength(1);expect(data.facts.evidence).toHaveLength(2);expect(data.tasks).toHaveLength(2);
 });
});
