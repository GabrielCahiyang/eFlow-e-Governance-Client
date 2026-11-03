// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({handlers:new Map<string,(payload:any)=>void>(),channel:vi.fn(),remove:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{channel:api.channel,removeChannel:api.remove}}));
import {subscribeWorkChanges} from '../../src/app/shared/workChanges';
const stops:Array<()=>void>=[];
afterEach(()=>{stops.splice(0).forEach(stop=>stop());vi.useRealTimers();vi.clearAllMocks();api.handlers.clear();});
function setup(){
 vi.useFakeTimers();const channel={on:vi.fn((_event:any,filter:any,callback:any)=>{api.handlers.set(filter.table,callback);return channel;}),subscribe:vi.fn(()=>channel)};api.channel.mockReturnValue(channel);return channel;
}
it('shares one channel, configures callbacks before subscribe and scopes root refreshes',async()=>{
 const channel=setup(),all=vi.fn(),a=vi.fn(),b=vi.fn();
 stops.push(subscribeWorkChanges(all),subscribeWorkChanges(a,'task-a'),subscribeWorkChanges(b,'task-b'));
 expect(api.channel).toHaveBeenCalledTimes(1);expect(channel.on.mock.calls.at(-1)!.length).toBe(3);
 expect([...api.handlers.keys()]).toEqual(['tasks','subtasks','subtask_progress_updates']);
 expect(channel.on.mock.invocationCallOrder.at(-1)).toBeLessThan(channel.subscribe.mock.invocationCallOrder[0]);
 api.handlers.get('subtasks')!({new:{id:'step',task_id:'task-a'},old:{}});
 api.handlers.get('tasks')!({new:{id:'task-a'},old:{}});
 await vi.advanceTimersByTimeAsync(35);expect(all).toHaveBeenCalledTimes(1);expect(a).toHaveBeenCalledTimes(1);expect(b).not.toHaveBeenCalled();
});
it('refreshes every open work view after a local committed update and cleans up',async()=>{
 setup();const callbacks=[vi.fn(),vi.fn(),vi.fn()];stops.push(...callbacks.map(refresh=>subscribeWorkChanges(refresh)));
 window.dispatchEvent(new Event('eflow:work-updated'));await vi.advanceTimersByTimeAsync(35);
 callbacks.forEach(refresh=>expect(refresh).toHaveBeenCalledOnce());stops.splice(0).forEach(stop=>stop());expect(api.remove).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
});
