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
 it('builds depth-eight duplicate-title context and distinct people without replacing recorded reviewer, authors or evidence',async()=>{
  fixture();const [item]=await fetchPendingSubtaskReviews('current-server-actor');
  expect(item.subtask.workContext).toMatchObject({pathLabel:['Office Task',...Array(8).fill('Same')].join(' / '),leadName:'Appointed Lead',contributors:[{id:'worker',name:'Worker'}],dueDate:'2026-10-27'});
  expect(item.submission).toMatchObject({id:'attempt',reviewerId:'old-reviewer',submitterName:'Original submitter',note:'Original note',attachments:[{id:'evidence',fileName:'proof.pdf',filePath:'sealed/proof',fileSize:0,mimeType:''}]});
  expect(item.submission.workContext).toBe(item.subtask.workContext);
  expect(api.calls.filter(call=>call[0]==='profiles'&&call[1]==='in')).toEqual([['profiles','in','id',['appointed','worker']]]);
  expect(api.calls.filter(call=>call[0]==='subtasks'&&call[1]==='read').map(call=>call[2])).toEqual([0,0,2,4,6]);
  expect(api.calls.filter(call=>call[0]==='subtask_submissions'&&call[1]==='read')).toEqual([]);
 });
 it('does not fetch denied or foreign ancestors, and drops a node removed during the authorized refresh',async()=>{
  fixture();api.rows.subtasks=api.rows.subtasks.filter(row=>row.id==='n7');
  api.rows.subtasks.push({id:'n6',task_id:'foreign',title:'SECRET',assigned_to_ids:[]});
  const [item]=await fetchPendingSubtaskReviews('current');
  expect(item.subtask.workContext?.pathLabel).toBe('Parent context unavailable / Same');
  expect(item.subtask.workContext?.pathLabel).not.toContain('SECRET');
  api.rows.subtasks=[];expect(await fetchPendingSubtaskReviews('current')).toEqual([]);
 });
 it('propagates strict context denial and never turns current RPC denial into a legacy queue',async()=>{
  fixture();api.denied='profiles';
  await expect(fetchPersonalSubtaskReviews('current')).rejects.toThrow('Context denied');
  expect(await fetchPendingSubtaskReviews('current')).toEqual([]);
  api.denied='';api.rpcError='42501';api.calls=[];
  await expect(fetchPersonalSubtaskReviews('current')).rejects.toThrow('Current access denied');
  expect(api.calls.filter(call=>call[1]==='read')).toEqual([]);
 });
 it('maps actual decision ID/name/time separately and preserves legacy history reads without new authority queries',async()=>{
  fixture();api.rows.subtask_submissions=[{...api.queue[0],status:'approved',decided_by:'actual-decider',decided_by_name:'Original decision actor',decided_at:'2026-10-11'}];
  const [attempt]=await fetchSubtaskSubmissions('n7');
  expect(attempt).toMatchObject({reviewerId:'old-reviewer',decidedById:'actual-decider',decidedByName:'Original decision actor',decidedAt:Date.parse('2026-10-11'),submitterName:'Original submitter'});
  expect(api.calls.filter(call=>call[1]==='read').map(call=>call[0])).toEqual(['subtask_submissions','subtask_submission_attachments']);
 });
 it('bounds profile and root identifier batches rather than issuing a parent read for every queued item',async()=>{
  fixture();api.rows.tasks=[];api.rows.subtasks=[];api.queue=[];api.rows.profiles=[];
  for(let i=0;i<205;i++){
   api.rows.tasks.push({id:`root${i}`,title:'Task'});api.rows.subtasks.push({id:`node${i}`,task_id:`root${i}`,title:'Same',lead_id:`lead${i}`,assigned_to_ids:[],position:0});
   api.queue.push({id:`attempt${i}`,task_id:`root${i}`,subtask_id:`node${i}`,status:'pending',submitter_id:'original',reviewer_id:'old'});api.rows.profiles.push({id:`lead${i}`,full_name:`Lead ${i}`});
  }
  const items=await fetchPendingSubtaskReviews('current');expect(items).toHaveLength(205);
  for(const table of ['profiles','subtasks']){
   const batches=api.calls.filter(call=>call[0]===table&&call[1]==='in'&&call[2]===(table==='profiles'?'id':'task_id'));
   expect([...new Set(batches.map(call=>JSON.stringify(call[3])))].map(batch=>JSON.parse(batch).length)).toEqual([100,100,5]);
  }
  for(const table of ['subtasks','tasks','subtask_submission_attachments'])expect(api.calls.filter(call=>call[0]===table&&call[1]==='in').every(call=>(call[3] as string[]).length<=100)).toBe(true);
 });
});
