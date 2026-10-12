import {describe,expect,it} from 'vitest';
import {presentWorkEvent,type WorkEvent,type WorkNode,type WorkTreeSnapshot} from '../../src/app/features/nested-work';
const node=(id:string,parent:string|null=null):WorkNode=>({id,task_id:'root',parent_subtask_id:parent,title:id,lead_id:'old',assigned_to_ids:['worker','old','worker'],sibling_order:0,depth:1,due_date:null,is_standalone:true,status:'todo',percent_complete:0,can_manage:false,can_appoint:false,can_order:false,can_work:false,can_review:false});
const snapshot=(nodes=[node('parent'),node('child','parent')]):WorkTreeSnapshot=>({root:{id:'root',project:'project',office:'office',kind:'office',lead:'old',people:['old','worker'],open:true,due:null},nodes,people:[{id:'old',name:'Former Lead'},{id:'new',name:'New Lead'},{id:'worker',name:'Recorded worker'}],revision:1,can_manage:false,can_transfer:false,leaf_total:1,leaf_completed:0});
const event=(command:string,before=snapshot(),after=snapshot(),nodeId:string|null='child'):WorkEvent=>({id:'event',root_id:'root',node_id:nodeId,command,actor_name:'Historical actor',occurred_at:'2026-10-12T00:00:00Z',before_data:before,after_data:after});
describe('NW9.6 recorded work event presentation',()=>{
 it('describes deletion with its former path, people and subtree size',()=>{
  const result=presentWorkEvent(event('delete',snapshot(),snapshot([node('parent')])));
  expect(result.title).toBe('Subitem deleted');expect(result.detail).toContain('parent / child');expect(result.detail).toContain('Former Lead');expect(result.detail).toContain('Recorded worker');expect(result.detail).toContain('Removed 1 subitem(s)');
 });
 it('uses moved ancestor snapshots for both old and new paths, including depth eight',()=>{
  const nodes=Array.from({length:8},(_,i)=>node('level '+(i+1),i?'level '+i:null));
  const before=snapshot(nodes),after=snapshot(nodes.map(item=>({...item})));
  after.nodes[0].title='Moved ancestor';
  const result=presentWorkEvent(event('move',before,after,'level 8'));
  expect(result.detail).toContain(nodes.map(item=>item.title).join(' / ')+' → Moved ancestor');expect(result.detail).toContain('level 8');
 });
 it('keeps old and new Lead identities from their respective snapshots and distinct contributors',()=>{
  const before=snapshot(),after=snapshot();after.nodes[1].lead_id='new';after.nodes[1].assigned_to_ids=['new'];after.people[0].name='Renamed current profile';
  const result=presentWorkEvent(event('staff',before,after));expect(result.title).toBe('Subitem Lead transferred');expect(result.detail).toContain('Former Lead → New Lead');expect(result.detail).toContain('Contributors: Recorded worker → No contributors');expect(result.detail).not.toContain('Renamed current profile');
 });
 it('does not borrow a historical missing name from the other snapshot',()=>{
  const before=snapshot(),after=snapshot();before.people=[];after.nodes[1].lead_id='new';
  expect(presentWorkEvent(event('staff',before,after)).detail).toContain('Historical name unavailable → New Lead');
 });
 it('presents meaningful title, date and sequencing changes without raw field keys',()=>{
  const before=snapshot(),after=snapshot();Object.assign(after.nodes[1],{title:'Revised title',due_date:'2026-10-21',is_standalone:false});
  const result=presentWorkEvent(event('edit',before,after));for(const text of ['child → Revised title','No deadline → 2026-10-21','Independent → Sequential'])expect(result.detail).toContain(text);
  expect(result.detail).not.toContain('is_standalone');
 });
 it('shows ordered positions while keeping unrelated order changes out of the focused branch',()=>{
  const before=snapshot([...snapshot().nodes,node('unrelated')]),after=snapshot(before.nodes.map(item=>({...item,sibling_order:1})));
  const result=presentWorkEvent(event('order',before,after,null),{rootId:'root',nodeId:'parent'});
  expect(result.title).toBe('Subitems reordered');expect(result.detail).toContain('parent / child · Position: 1 → 2');expect(result.detail).not.toContain('unrelated');
 });
 it('uses readable copy for every existing command, including unknown future commands',()=>{
  for(const command of ['create','staff','root_lead','contributors','edit','move','order','delete','progress','submit','review','secret_future_key']){
   const result=presentWorkEvent(event(command));expect(result.title).not.toBe(command);expect(result.title).not.toContain('_');expect(result.detail).not.toContain('secret_future_key');
  }
 });
 it('refuses to combine foreign context and marks missing hierarchy explicitly',()=>{
  const before=snapshot(),after=snapshot();after.root.office='foreign';expect(presentWorkEvent(event('move',before,after)).detail).toContain('Historical path unavailable');
  before.nodes[1].parent_subtask_id='missing';expect(presentWorkEvent(event('delete',before,snapshot([]))).detail).toContain('Parent context unavailable / child');
 });
 it('is immutable and does not replace recorded actors or time',()=>{
  const recorded=event('staff'),bytes=JSON.stringify(recorded);presentWorkEvent(recorded);expect(JSON.stringify(recorded)).toBe(bytes);expect(recorded.actor_name).toBe('Historical actor');expect(recorded.occurred_at).toBe('2026-10-12T00:00:00Z');
 });
});
