import { afterEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({handlers:[] as ((event:unknown)=>void)[],read:vi.fn().mockResolvedValue({data:[],error:null})}));
vi.mock('../../src/lib/supabase',()=>({supabase:{
 from:()=>{const query={select:()=>query,is:()=>query,order:()=>query,range:api.read};return query;},removeChannel:vi.fn(),
 channel:()=>{const channel={on:(_type:string,_filter:unknown,callback:(event:unknown)=>void)=>{api.handlers.push(callback);return channel;},subscribe:()=>channel};return channel;},
}}));
import { subscribeToTasks } from '../../src/app/features/tasks/services/taskRealtimeService';
import { resetAuthCaches } from '../../src/app/shared/authCacheReset';
afterEach(()=>resetAuthCaches());
it('drops a late authorized-read response from a previous authenticated account',async()=>{
 let finish!:(result:unknown)=>void;api.read.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const first=vi.fn();const unsubscribeFirst=subscribeToTasks(first);resetAuthCaches();unsubscribeFirst();
 const next=vi.fn();const unsubscribeNext=subscribeToTasks(next);await vi.waitFor(()=>expect(next).toHaveBeenCalledWith([]));
 finish({data:[{id:'old-private-office-row',title:'Old actor work',created_at:new Date().toISOString()}],error:null});await new Promise(resolve=>setTimeout(resolve,0));
 expect(next.mock.calls.every(([rows])=>rows.length===0)).toBe(true);expect(api.handlers).toHaveLength(0);unsubscribeNext();
});
