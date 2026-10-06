// @vitest-environment jsdom
import {act, cleanup, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {useGeneralJournal} from '../../src/app/features/budget/hooks/useGeneralJournal';
const api=vi.hoisted(()=>({read:vi.fn(),accounts:vi.fn(),remove:vi.fn(),listeners:[] as {table:string; callback:(payload:any)=>void}[]}));
vi.mock('../../src/lib/supabase',()=>({supabase:{channel:()=>{const channel={on:(_event:string,options:{table:string},callback:(payload:any)=>void)=>{api.listeners.push({table:options.table,callback});return channel;},subscribe:()=>channel};return channel;},removeChannel:api.remove}}));
vi.mock('../../src/app/features/budget/services/budgetService',()=>({fetchGeneralJournal:api.read,fetchAccountingAccounts:api.accounts}));
beforeEach(()=>{vi.clearAllMocks();api.listeners=[];api.read.mockResolvedValue([{id:'known-entry'}]);api.accounts.mockResolvedValue([]);});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('ignores foreign lines, coalesces local bursts and cancels queued reads on unmount',async()=>{
 const hook=renderHook(()=>useGeneralJournal('office',2026,'actor'));
 await waitFor(()=>expect(hook.result.current.entries).toHaveLength(1));
 vi.useFakeTimers();
 const line=api.listeners.find(item=>item.table==='general_journal_lines')!.callback;
 act(()=>{line({new:{journal_entry_id:'foreign'}});vi.advanceTimersByTime(100);});
 expect(api.read).toHaveBeenCalledTimes(1);
 await act(async()=>{for(let i=0;i<4;i++)line({new:{journal_entry_id:'known-entry'}});vi.advanceTimersByTime(100);});
 expect(api.read).toHaveBeenCalledTimes(2);
 act(()=>line({new:{journal_entry_id:'known-entry'}}));hook.unmount();
 await act(async()=>vi.advanceTimersByTime(100));
 expect(api.read).toHaveBeenCalledTimes(2);expect(api.remove).toHaveBeenCalledOnce();
});
it('clears rows immediately when the authenticated actor changes and rejects old callbacks',async()=>{
 const hook=renderHook(({actor})=>useGeneralJournal('office',2026,actor),{initialProps:{actor:'first'}});
 await waitFor(()=>expect(hook.result.current.entries).toHaveLength(1));
 const oldCallback=api.listeners[0].callback;
 let finish!:(entries:any[])=>void;api.read.mockReturnValueOnce(new Promise(done=>{finish=done;}));
 hook.rerender({actor:'second'});expect(hook.result.current.entries).toEqual([]);
 vi.useFakeTimers();await act(async()=>{oldCallback({new:{}});vi.advanceTimersByTime(100);});
 expect(api.read).toHaveBeenCalledTimes(2);
 await act(async()=>finish([{id:'second-actor'}]));expect(hook.result.current.entries[0].id).toBe('second-actor');
});
