import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({rpc:vi.fn(),read:vi.fn(),channel:vi.fn(),remove:vi.fn(),payload:undefined as undefined|((value:any)=>void),taskNotify:vi.fn(),projectNotify:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{rpc:api.rpc,from:()=>{const query={select:()=>query,eq:()=>query,in:()=>query,single:()=>api.read(),order:()=>api.read()};return query;},channel:api.channel,removeChannel:api.remove}}));
vi.mock('../../src/app/features/tasks',()=>({notifyTaskListeners:api.taskNotify}));
vi.mock('../../src/app/features/projects',()=>({notifyProjectListeners:api.projectNotify}));
vi.mock('../../src/app/features/ai',()=>({requestAiChat:vi.fn(),readAiText:vi.fn()}));
import {applySubtaskTemplate,saveSubtaskTemplate} from '../../src/app/features/work-templates/services/subtaskTemplateService';
import {importReviewedProject,importReviewedProjectWithOffices,ProjectImportSaveError} from '../../src/app/features/project-import/services/projectImportService';
import {clearSubtaskCache,fetchTaskSubtasks,fetchSubtasksForTasks,getCachedSubtasks,setCachedSubtasks,setSubtaskDueDate,subscribeToSubtasks,type Subtask} from '../../src/app/services/subtaskService';
import {resetAuthCaches} from '../../src/app/shared/authCacheReset';
const row={id:'item',task_id:'root',title:'Authorized flat item',assigned_to_ids:['worker'],position:1,parent_subtask_id:'parent',lead_id:'lead',sibling_order:2,created_by:'historical-author',created_at:'2026-10-12',updated_at:'2026-10-12'};
const cached={id:'cached',taskId:'root',title:'Previous actor private item'} as Subtask;
beforeEach(()=>{vi.clearAllMocks();clearSubtaskCache();api.payload=undefined;api.channel.mockImplementation(()=>{const channel={on:(_type:any,_config:any,callback:any)=>{api.payload=callback;return channel;},subscribe:()=>channel};return channel;});api.read.mockResolvedValue({data:[row],error:null});});
afterEach(()=>clearSubtaskCache());
describe('NW9.7 retained flat adapters and actor-owned cache',()=>{
 it.each(['parentSubtaskId','parent_subtask_id','children','subitems'])('rejects %s on save and apply before stripping fields or calling the RPC',async key=>{
  for(const value of ['parent',null,[],'']){
   const item={title:'Child',position:0,assignedToIds:['worker'],[key]:value};
   await expect(saveSubtaskTemplate('office',{title:'Flat',description:'',visibility:'personal',items:[item]})).rejects.toThrow('cannot flatten parent links');
   await expect(applySubtaskTemplate({templateId:'template',taskId:'root',mode:'merge',items:[item]})).rejects.toThrow('cannot flatten parent links');
  }
  expect(api.rpc).not.toHaveBeenCalled();
 });
 it('preserves exact flat save/apply RPC payloads, reload and public result fields',async()=>{
  api.rpc.mockResolvedValueOnce({data:{id:'template'},error:null}).mockResolvedValueOnce({data:{created:2,skipped:1,replaced:0},error:null});
  api.read.mockResolvedValueOnce({data:{id:'template',org_id:'office',visibility:'personal',approval_status:'approved',created_at:'2026-10-12',updated_at:'2026-10-12',subtask_template_items:[{id:'flat',title:'Child',position:0}]},error:null});
  const saved=await saveSubtaskTemplate('office',{title:' Flat ',description:' Note ',visibility:'personal',items:[{title:' Child ',position:7,parentSubtaskId:undefined}]});
  expect(api.rpc).toHaveBeenNthCalledWith(1,'save_subtask_template',{p_template_id:null,p_payload:{orgId:'office',title:'Flat',description:'Note',visibility:'personal',items:[{title:'Child',position:0}]}});expect(saved.items).toEqual([{id:'flat',title:'Child',position:0}]);
  const flat={title:' Child ',assignedToIds:['worker'],parentSubtaskId:undefined};
  expect(await applySubtaskTemplate({templateId:'template',taskId:'root',mode:'merge',items:[flat]})).toEqual({created:2,skipped:1,replaced:0});
  expect(api.rpc).toHaveBeenNthCalledWith(2,'apply_subtask_template',{p_template_id:'template',p_task_id:'root',p_mode:'merge',p_items:[{title:'Child',assignedToIds:['worker']}]});
 });
 it('propagates denied/ordinary template and due-date failures despite operation names, and recognizes only checked missing codes',async()=>{
  for(const code of ['42501','23514']){
   const message='Failure in apply_subtask_template or save_subtask_template: '+code;api.rpc.mockResolvedValueOnce({data:null,error:{code,message}});
   await expect(applySubtaskTemplate({templateId:'template',taskId:'root',mode:'replace',items:[]})).rejects.toThrow(message);
   api.rpc.mockResolvedValueOnce({data:null,error:{code,message:'Failure in set_subtask_due_date: '+code}});await expect(setSubtaskDueDate('item','2026-10-21')).rejects.toThrow('Failure in set_subtask_due_date: '+code);
  }
  api.rpc.mockResolvedValueOnce({data:null,error:{code:'PGRST202',message:'Missing'}});await expect(applySubtaskTemplate({templateId:'template',taskId:'root',mode:'merge',items:[]})).rejects.toThrow('database migration');
 });
 it('keeps both reviewed import payloads intact so existing server hierarchy guards receive every key',async()=>{
  const review={groups:[{tasks:[{subitems:[{title:'Child',parentSubtaskId:'parent'}]}]}]},result={groupCount:1,taskCount:1,subitemCount:1};
  api.rpc.mockResolvedValue({data:result,error:null});
  expect(await importReviewedProject('project','request',review)).toBe(result);expect(await importReviewedProjectWithOffices('project','request',review)).toBe(result);
  expect(api.rpc).toHaveBeenNthCalledWith(1,'phase5_import_project_work',{p_project_id:'project',p_request_id:'request',p_review:review});expect(api.rpc).toHaveBeenNthCalledWith(2,'phase65_import_project_work',{p_project_id:'project',p_request_id:'request',p_review:review});
  api.rpc.mockResolvedValueOnce({data:null,error:{code:'22023',message:'Nested imports cannot be flattened'}});await expect(importReviewedProjectWithOffices('project','request',review)).rejects.toMatchObject({message:'Nested imports cannot be flattened',retrySameBatch:false});expect(api.taskNotify).toHaveBeenCalledTimes(2);expect(api.projectNotify).toHaveBeenCalledTimes(2);
 });
 it('keeps cache instant rendering and canonical parent/Lead/authorship values for the current actor',async()=>{
  const rows=await fetchTaskSubtasks('root');expect(rows[0]).toMatchObject({parentSubtaskId:'parent',leadId:'lead',assignedToIds:['worker'],siblingOrder:2,createdBy:'historical-author'});
  expect(getCachedSubtasks('root')).toBe(rows);const callback=vi.fn(),stop=subscribeToSubtasks('root',callback);expect(callback).toHaveBeenCalledWith(rows);stop();
 });
 it.each(['single','batch'])('account reset prevents a late %s read from repopulating the cache',async kind=>{
  let resolve!:(value:any)=>void;api.read.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));
  setCachedSubtasks('root',[cached]);const pending=kind==='single'?fetchTaskSubtasks('root'):fetchSubtasksForTasks(['root']);resetAuthCaches();expect(getCachedSubtasks('root')).toBeUndefined();
  resolve({data:[row],error:null});await expect(pending).rejects.toThrow('Subtask context changed');expect(getCachedSubtasks('root')).toBeUndefined();
 });
 it('ignores old subscription reads/realtime after reset and removes channels on unsubscribe',async()=>{
  let resolve!:(value:any)=>void;api.read.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));const callback=vi.fn(),stop=subscribeToSubtasks('root',callback),oldPayload=api.payload;
  resetAuthCaches();oldPayload?.({eventType:'INSERT',new:row});resolve({data:[row],error:null});await Promise.resolve();await Promise.resolve();expect(callback).not.toHaveBeenCalled();expect(getCachedSubtasks('root')).toBeUndefined();stop();expect(api.remove).toHaveBeenCalledOnce();
 });
 it('ignores a late read after unsubscribe and clears cached records after permission denial',async()=>{
  let resolve!:(value:any)=>void;api.read.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));const callback=vi.fn(),stop=subscribeToSubtasks('root',callback);stop();resolve({data:[row],error:null});await Promise.resolve();await Promise.resolve();expect(callback).not.toHaveBeenCalled();
  setCachedSubtasks('root',[cached]);api.read.mockResolvedValueOnce({data:null,error:{code:'42501',message:'Access expired'}});const denied=vi.fn(),cancel=subscribeToSubtasks('root',denied);await vi.waitFor(()=>expect(denied).toHaveBeenLastCalledWith([]));expect(getCachedSubtasks('root')).toBeUndefined();cancel();
 });
});
