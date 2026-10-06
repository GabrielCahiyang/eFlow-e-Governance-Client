import { beforeEach,describe,expect,it,vi } from 'vitest';
const db=vi.hoisted(()=>({responses:{} as Record<string,unknown>,calls:[] as unknown[][]}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:(table:string)=>{
 const chain:any={};for(const method of ['select','update','eq','order','limit','in'])chain[method]=(...args:unknown[])=>{db.calls.push([table,method,...args]);return chain;};
 chain.then=(resolve:any,reject:any)=>Promise.resolve(db.responses[table] || {data:[],error:null}).then(resolve,reject);return chain;
}}}));
import { fetchRecentNotifications,markRecentNotificationRead,markNotificationRead } from '../../src/app/services/notificationService';
import { fetchPersonalSubtaskReviews,fetchPendingSubtaskReviews } from '../../src/app/features/subtasks/services/subtaskWorkflowService';
beforeEach(()=>{db.responses={};db.calls=[];});
describe('checked feed contract',()=>{
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
 it('personal subtask reads never include all reviewers; checked errors preserve legacy array behavior',async()=>{
  db.responses.subtask_submissions={data:null,error:{message:'Review denied'}};await expect(fetchPersonalSubtaskReviews('me')).rejects.toThrow('Review denied');expect(await fetchPendingSubtaskReviews('me')).toEqual([]);expect(db.calls).toContainEqual(['subtask_submissions','eq','reviewer_id','me']);
 });
 it('related evidence read failure remains failure, not a falsely complete review',async()=>{
  db.responses.subtask_submissions={data:[{id:'s',subtask_id:'child'}],error:null};db.responses.subtasks={data:null,error:{message:'Evidence denied'}};await expect(fetchPersonalSubtaskReviews('me')).rejects.toThrow('Evidence denied');
 });
});
