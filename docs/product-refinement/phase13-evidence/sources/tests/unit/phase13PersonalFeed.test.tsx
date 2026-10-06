// @vitest-environment jsdom
import { act,cleanup,renderHook,waitFor } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { usePersonalFeed } from '../../src/app/features/action-center/hooks/usePersonalFeed';
afterEach(()=>{cleanup();vi.useRealTimers();});
describe('personal source isolation',()=>{
 it('surfaces failure and retries only its source',async()=>{
  const reader=vi.fn().mockRejectedValueOnce(new Error('Source denied')).mockResolvedValueOnce(['new']);
  const view=renderHook(()=>usePersonalFeed('me',reader));await waitFor(()=>expect(view.result.current.error).toBe('Source denied'));
  expect(view.result.current.rows).toEqual([]);act(()=>view.result.current.retry());await waitFor(()=>expect(view.result.current.rows).toEqual(['new']));expect(view.result.current.error).toBe('');
 });
 it('ignores late results after recipient switch and cleans up after unmount',async()=>{
  let oldResolve!:(rows:string[])=>void;
  const reader=vi.fn((id:string)=>id==='old'?new Promise<string[]>(resolve=>{oldResolve=resolve;}):Promise.resolve(['new-recipient']));
  const view=renderHook(({id})=>usePersonalFeed(id,reader),{initialProps:{id:'old'}});view.rerender({id:'new'});await waitFor(()=>expect(view.result.current.rows).toEqual(['new-recipient']));
  await act(async()=>oldResolve(['old-private']));expect(view.result.current.rows).toEqual(['new-recipient']);view.unmount();
 });
 it('coalesces polling and focus while a slow read is still pending',async()=>{
  vi.useFakeTimers();let resolve!:(rows:string[])=>void;
  const reader=vi.fn(()=>new Promise<string[]>(done=>{resolve=done;}));
  const view=renderHook(()=>usePersonalFeed('me',reader));
  await act(async()=>{await vi.advanceTimersByTimeAsync(30000);window.dispatchEvent(new Event('focus'));});expect(reader).toHaveBeenCalledOnce();
  await act(async()=>resolve(['slow-result']));expect(view.result.current.rows).toEqual(['slow-result']);expect(view.result.current.loading).toBe(false);
 });
 it('does not fetch an unsupported or disabled queue' ,()=>{
  const reader=vi.fn();const view=renderHook(()=>usePersonalFeed('me',reader,false));expect(reader).not.toHaveBeenCalled();expect(view.result.current.loading).toBe(false);
 });
});
