import {beforeEach,describe,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({reads:[] as {table:string;filters:[string,unknown][]}[],errors:{} as Record<string,string>,missing:false}));
vi.mock('../../src/lib/supabase',()=>({supabase:{from:(table:string)=>{
 const read={table,filters:[] as [string,unknown][]};api.reads.push(read);
 const response=()=>({data:table==='subtasks'?(api.missing?null:{id:'item',task_id:'root',title:'Item',assigned_to_ids:[]}):[],error:api.errors[table]?{message:api.errors[table]}:null});
 const query={select:()=>query,eq:(key:string,value:unknown)=>{read.filters.push([key,value]);return query;},in:()=>query,order:async()=>response(),maybeSingle:async()=>response()};return query;
}}}));
import {fetchSubitemInspectorRecord,fetchSubtaskProgressUpdates,fetchSubtaskSubmissions} from '../../src/app/features/subtasks/services/subtaskWorkflowService';
beforeEach(()=>{api.reads=[];api.errors={};api.missing=false;});
describe('NW8.1 strict scoped data adapter',()=>{
 it('filters the item and both histories by root/item IDs without querying ancestors or profiles',async()=>{
  const result=await fetchSubitemInspectorRecord('root','item');expect(result.subtask.id).toBe('item');
  expect(api.reads).toEqual([{table:'subtasks',filters:[['task_id','root'],['id','item']]},{table:'subtask_submissions',filters:[['subtask_id','item'],['task_id','root']]},{table:'subtask_progress_updates',filters:[['subtask_id','item'],['task_id','root']]}]);
 });
 for(const table of ['subtasks','subtask_submissions','subtask_progress_updates'])it(`reports ${table} denial instead of an empty writable Inspector`,async()=>{
  api.errors[table]='Access denied';await expect(fetchSubitemInspectorRecord('root','item')).rejects.toThrow('Access denied');
 });
 it('rejects removed/hidden items before reading their histories',async()=>{
  api.missing=true;await expect(fetchSubitemInspectorRecord('root','item')).rejects.toThrow('Subitem unavailable');expect(api.reads).toHaveLength(1);
 });
 it('retains the legacy reads error/empty-array contract',async()=>{
  api.errors.subtask_submissions='Denied';api.errors.subtask_progress_updates='Denied';
  expect(await fetchSubtaskSubmissions('item')).toEqual([]);expect(await fetchSubtaskProgressUpdates('item')).toEqual([]);expect(api.reads.every(read=>read.filters.length===1)).toBe(true);
 });
});
