// Retired approval-queue coverage is replaced by retiredSubtaskReviewLinks.test.tsx.
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rows:{} as Record<string,Record<string,unknown>[]>,queue:[] as Record<string,unknown>[],calls:[] as unknown[][],headers:[] as unknown[][],denied:'',rpcError:'',sessionActor:'current',swapOnDecision:false}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{getSession:async()=>({data:{session:{user:{id:api.sessionActor},access_token:'synthetic-'+api.sessionActor}},error:null})},rpc:(name:string,args:unknown)=>{
 api.calls.push([name,'rpc',args]);if(name==='decide_subtask_review'&&api.swapOnDecision)api.sessionActor='another-account';
 const request:any={setHeader:(name:string,value:string)=>{api.headers.push([name,value]);return request;},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve({data:api.queue,error:api.rpcError?{code:api.rpcError,message:'Current access denied'}:null}).then(resolve)};return request;
},from:(table:string)=>{
 const filters:[string,unknown][]=[];let count=false;
 const query:any={};
 query.select=(columns:string,options?:{count:string})=>{count=!!options?.count;api.calls.push([table,'select',columns]);return query;};
 query.in=(key:string,ids:string[])=>{filters.push([key,ids]);api.calls.push([table,'in',key,ids]);return query;};
 query.eq=(key:string,value:unknown)=>{filters.push([key,value]);return query;};
 query.order=()=>query;
 const response=(from=0)=>{
  api.calls.push([table,'read',from]);
  if(table===api.denied)return {data:null,error:{message:'Context denied'}};
  const rows=(api.rows[table]||[]).filter(row=>filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));
  return {data:count?rows.slice(from,from+2):rows,count:count?rows.length:undefined,error:null};
 };
 query.range=(from:number)=>Promise.resolve(response(from));
 query.then=(resolve:(value:unknown)=>unknown)=>Promise.resolve(response()).then(resolve);
 return query;
}}}));
import {fetchPendingSubtaskReviews,fetchPersonalSubtaskReviews,fetchSubtaskSubmissions,decideSubtaskReview} from '../../src/app/features/subtasks/services/subtaskWorkflowService';
beforeEach(()=>{api.rows={};api.queue=[];api.calls=[];api.headers=[];api.denied='';api.rpcError='';api.sessionActor='current';api.swapOnDecision=false;});
afterEach(()=>vi.useRealTimers());
function fixture(){
 api.rows.tasks=[{id:'root',title:'Office Task'}];
 api.rows.subtasks=Array.from({length:8},(_,i)=>({id:`n${i}`,task_id:'root',title:'Same',parent_subtask_id:i?`n${i-1}`:null,lead_id:'appointed',assigned_to_ids:i===7?['worker','appointed','worker']:[],position:0,sibling_order:0,due_date:`2026-10-${20+i}`}));
 api.queue=[{id:'attempt',task_id:'root',subtask_id:'n7',version:3,submitter_id:'original',submitter_name:'Original submitter',reviewer_id:'old-reviewer',note:'Original note',status:'pending',submitted_at:'2026-10-10'}];
 api.rows.profiles=[{id:'appointed',full_name:'Appointed Lead'},{id:'worker',full_name:'Worker'},{id:'secret',full_name:'SECRET'}];
 api.rows.subtask_submission_attachments=[{id:'evidence',submission_id:'attempt',file_name:'proof.pdf',file_path:'sealed/proof'}];
}
describe('NW9.4 authorized queue context and recorded history',()=>{
 it('rejects a changed account before sending private feedback and leaves the RPC payload contract unchanged',async()=>{
  api.sessionActor='another-account';await expect(decideSubtaskReview('node',false,'Private feedback','current')).rejects.toThrow('Your account changed');
  expect(api.calls).toEqual([]);expect(api.headers).toEqual([]);
  await decideSubtaskReview('node',false,' Legacy feedback ');
  expect(api.calls).toEqual([['decide_subtask_review','rpc',{p_subtask_id:'node',p_approve:false,p_feedback:'Legacy feedback'}]]);expect(api.headers).toEqual([]);
 });
 it('binds an explicit decision to its originating account even if the default session changes while the request is constructed',async()=>{
  api.swapOnDecision=true;await decideSubtaskReview('node',false,'Private feedback','current');
  expect(api.sessionActor).toBe('another-account');expect(api.headers).toEqual([['Authorization','Bearer synthetic-current']]);
  expect(api.calls).toEqual([['decide_subtask_review','rpc',{p_subtask_id:'node',p_approve:false,p_feedback:'Private feedback'}]]);
 });
 
 
 
 it('maps actual decision ID/name/time separately and preserves legacy history reads without new authority queries',async()=>{
  fixture();api.rows.subtask_submissions=[{...api.queue[0],status:'approved',decided_by:'actual-decider',decided_by_name:'Original decision actor',decided_at:'2026-10-11'}];
  const [attempt]=await fetchSubtaskSubmissions('n7');
  expect(attempt).toMatchObject({reviewerId:'old-reviewer',decidedById:'actual-decider',decidedByName:'Original decision actor',decidedAt:Date.parse('2026-10-11'),submitterName:'Original submitter'});
  expect(api.calls.filter(call=>call[1]==='read').map(call=>call[0])).toEqual(['subtask_submissions','subtask_submission_attachments']);
 });
 
});
