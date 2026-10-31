// Retired approval-queue coverage is replaced by retiredSubtaskReviewLinks.test.tsx.
import { beforeEach,describe,expect,it,vi } from 'vitest';
const db=vi.hoisted(()=>({responses:{} as Record<string,unknown>,calls:[] as unknown[][]}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:()=>Promise.resolve({data:null,error:{code:'PGRST202',message:'Legacy fixture'}}),from:(table:string)=>{
 const chain:any={};for(const method of ['select','update','eq','order','limit','in','range'])chain[method]=(...args:unknown[])=>{db.calls.push([table,method,...args]);return chain;};
 chain.then=(resolve:any,reject:any)=>Promise.resolve(db.responses[table] || {data:[],error:null}).then(resolve,reject);return chain;
}}}));
import { fetchRecentNotifications,markRecentNotificationRead,markNotificationRead } from '../../src/app/services/notificationService';
import { fetchPersonalSubtaskReviews,fetchPendingSubtaskReviews } from '../../src/app/features/subtasks/services/subtaskWorkflowService';
import {resolveNotificationDestination} from '../../src/app/features/notifications';
beforeEach(()=>{db.responses={};db.calls=[];});
describe('checked feed contract',()=>{
 it('keeps canonical wire work_node_id through the mapped feed and navigation intent without changing read/history fields',async()=>{
  db.responses.notifications={data:[{id:'notification',user_id:'me',type:'assignment',title:'Subtask assignment',message:'Assigned to "Old label".',task_id:'root',work_node_id:'eight',actor_id:'original-actor',actor_name:'Original actor',reason:'Original reason',read:true,created_at:'2026-10-12T01:00:00Z'}],error:null};
  const [item]=await fetchRecentNotifications('me');expect(item).toMatchObject({id:'notification',taskId:'root',workNodeId:'eight',actorId:'original-actor',actorName:'Original actor',reason:'Original reason',read:true,createdAt:Date.parse('2026-10-12T01:00:00Z')});
  expect(resolveNotificationDestination(item,'member')?.intent).toMatchObject({notificationId:'notification',kind:'subtask',taskId:'root',entityId:'eight',entityLabel:'Old label'});
 });
 it('limits recent notifications and filters recipient',async()=>{
  db.responses.notifications={data:[{id:'n',title:'Update',created_at:'2026-10-06',read:false}],error:null};
  expect(await fetchRecentNotifications('me')).toMatchObject([{id:'n',read:false}]);expect(db.calls).toContainEqual(['notifications','eq','user_id','me']);expect(db.calls).toContainEqual(['notifications','limit',50]);
 });
 it('rejects notification read errors instead of inventing an empty feed',async()=>{
  db.responses.notifications={data:null,error:{message:'Denied'}};await expect(fetchRecentNotifications('me')).rejects.toThrow('Denied');
 });
 it('verifies committed recipient read writes; legacy void signature remains compatible',async()=>{
  await expect(markRecentNotificationRead('me','n')).rejects.toThrow('no longer available');
  db.responses.notifications={data:[{id:'n'}],error:null};await expect(markRecentNotificationRead('me','n')).resolves.toBeUndefined();expect(db.calls).toContainEqual(['notifications','eq','user_id','me']);
  db.responses.notifications={data:null,error:{message:'Read denied'}};await expect(markRecentNotificationRead('me','n')).rejects.toThrow('Read denied');await expect(markNotificationRead('me','n')).resolves.toBeUndefined();
 });
 
 
});
