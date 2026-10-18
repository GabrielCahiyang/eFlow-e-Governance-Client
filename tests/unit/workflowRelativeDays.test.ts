// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {relativeDays} from '../../src/app/components/workflow/primitives';
afterEach(()=>vi.useRealTimers());
describe('calendar-day deadline labels',()=>{
 it('keeps an end-of-today deadline on today rather than rounding it to tomorrow',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,18,8));
  expect(relativeDays(new Date(2026,9,18,23,59).getTime())).toEqual({label:'Due today',overdue:false});
 });
 it('distinguishes tomorrow from a date on the previous calendar day',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,18,8));
  expect(relativeDays(new Date(2026,9,19,23,59).getTime()).label).toBe('Due tomorrow');
  expect(relativeDays(new Date(2026,9,17,23,59).getTime())).toEqual({label:'1d overdue',overdue:true});
 });
});
