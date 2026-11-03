// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({taskReads:0,subReads:0,firstTask:null as any,firstSub:null as any}));
vi.mock('../../src/app/services/notificationService',()=>({createNotification:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{
 channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:vi.fn(),
 from:(table:string)=>({select(){return this;},is(){return this;},eq(){return this;},order(){
   if(table==='subtasks'){api.subReads++;return api.subReads===1?api.firstSub:Promise.resolve({data:[{id:'step',task_id:'task',status:'completed',is_completed:true}],error:null});}return this;
 },range(){api.taskReads++;return api.taskReads===1?api.firstTask:Promise.resolve({data:[{id:'task',status:'in_progress'}],count:1,error:null});}})
}}));
import {subscribeToTasks} from '../../src/app/features/tasks/services/taskRealtimeService';
import {subscribeToSubtasks,clearSubtaskCache} from '../../src/app/services/subtaskService';
import {resetAuthCaches} from '../../src/app/shared/authCacheReset';
const stops:Array<()=>void>=[];
afterEach(()=>{stops.splice(0).forEach(stop=>stop());resetAuthCaches();clearSubtaskCache();api.taskReads=0;api.subReads=0;vi.useRealTimers();});
it('does not lose a task refresh when an older task read is still pending',async()=>{
 vi.useFakeTimers();let resolve:any;api.firstTask=new Promise(r=>resolve=r);const callback=vi.fn();stops.push(subscribeToTasks(callback));
 window.dispatchEvent(new Event('eflow:work-updated'));await vi.advanceTimersByTimeAsync(35);
 resolve({data:[{id:'task',status:'todo'}],count:1,error:null});await vi.advanceTimersByTimeAsync(0);
 expect(api.taskReads).toBe(2);expect(callback.mock.calls.at(-1)?.[0][0].status).toBe('in_progress');
});
it('refreshes subtask tables after a local completion even when Realtime never arrives',async()=>{
 vi.useFakeTimers();let resolve:any;api.firstSub=new Promise(r=>resolve=r);const callback=vi.fn();stops.push(subscribeToSubtasks('task',callback));
 window.dispatchEvent(new CustomEvent('eflow:work-updated',{detail:{taskId:'task'}}));await vi.advanceTimersByTimeAsync(35);
 resolve({data:[{id:'step',task_id:'task',status:'todo'}],error:null});await vi.advanceTimersByTimeAsync(0);
 expect(api.subReads).toBe(2);expect(callback.mock.calls.at(-1)?.[0][0].status).toBe('completed');
});
