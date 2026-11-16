import {describe,expect,it} from 'vitest';
import type {WorkEvent,WorkNode,WorkTreeSnapshot} from '../../src/app/features/nested-work';
import {presentWorkEvent} from '../../src/app/features/nested-work';

type RecordedNode=WorkNode&{priority?:string;dependency_ids?:string[]|null;due_date_change_reason?:string};
const node=(id:string,title:string,extra:Partial<RecordedNode>={}):RecordedNode=>({
 id,task_id:'root',parent_subtask_id:null,lead_id:null,title,assigned_to_ids:[],sibling_order:0,depth:1,due_date:null,
 is_standalone:true,status:'todo',percent_complete:0,can_manage:false,can_appoint:false,can_order:false,can_work:false,can_review:false,...extra,
});
const snapshot=(nodes:RecordedNode[],people:WorkTreeSnapshot['people']=[]):WorkTreeSnapshot=>({
 root:{id:'root',project:'project',office:'office',kind:'office',lead:null,people:[],open:true,due:null},revision:1,nodes,people,
 can_manage:false,can_transfer:false,leaf_total:0,leaf_completed:0,
});
const event=(before:WorkTreeSnapshot,after:WorkTreeSnapshot):WorkEvent=>({id:'e',root_id:'root',node_id:'item',command:'edit',actor_name:'Recorded editor',occurred_at:'2026-11-16T00:00:00Z',before_data:before,after_data:after});

describe('nested work event presentation',()=>{
 it('presents priority, start, prerequisite null versus empty, historical names and reason from recorded snapshots',()=>{
  const old=node('item','Work',{priority:'medium',start_date:'2026-11-16',dependency_ids:null});
  const next=node('item','Work',{priority:'high',start_date:'2026-11-17',due_date:'2026-11-24',dependency_ids:['prior','missing'],due_date_change_reason:'Approved extension'});
  const result=presentWorkEvent(event(snapshot([old,node('prior','Prior name')]),snapshot([next,node('prior','Historical prior name')])));
  expect(result.entries).toEqual(expect.arrayContaining([
   'Priority: Medium → High','Start date: 2026-11-16 → 2026-11-17',
   'Prerequisites: Legacy sequential prerequisites → Historical prior name, Historical prerequisite unavailable',
   'Schedule change reason: Approved extension',
  ]));
  const none=presentWorkEvent(event(snapshot([node('item','Work',{dependency_ids:['prior']}) ,node('prior','Recorded name')]),snapshot([node('item','Work',{dependency_ids:[]})])));
  expect(none.entries).toContain('Prerequisites: Recorded name → None');
 });

 it('shows unavailable historical values honestly and omits a reason without a committed schedule delta',()=>{
  const old=node('item','Work',{priority:'medium',dependency_ids:[]});
  const next=node('item','Work',{priority:'high',dependency_ids:['gone'],due_date_change_reason:'Uncommitted draft'});
  const result=presentWorkEvent(event(snapshot([old]),snapshot([next])));
  expect(result.entries).toContain('Prerequisites: None → Historical prerequisite unavailable');
  const noDelta=presentWorkEvent(event(snapshot([next]),snapshot([{...next,due_date_change_reason:'Draft only'}])));
  expect(noDelta.entries).not.toContain('Schedule change reason: Draft only');
 });
});
