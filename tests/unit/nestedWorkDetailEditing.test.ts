import {describe,expect,it} from 'vitest';
import {readNodeDetailEditState} from '../../src/app/features/nested-work/selectors/detailEditing';
import type {WorkNode} from '../../src/app/features/nested-work/types';

const node=(detail_edit:WorkNode['detail_edit']):WorkNode=>({id:'node-1',task_id:'task-1',parent_subtask_id:null,lead_id:null,title:'Prepare report',assigned_to_ids:[],sibling_order:0,depth:0,due_date:'2026-12-20',is_standalone:false,status:'todo',percent_complete:0,can_manage:false,can_appoint:false,can_order:false,can_work:false,can_review:false,detail_edit});
const policy={version:1 as const,task_id:'task-1',node_id:'node-1',updated_at:null,started:true,details:true,due:true,planning:false};

describe('readNodeDetailEditState',()=>{
 it('accepts a versioned policy bound to the exact task and node',()=>expect(readNodeDetailEditState(node(policy),'task-1')).toEqual(policy));
 it.each([
  ['missing',undefined],
  ['unsupported version',{...policy,version:2}],
  ['wrong task',{...policy,task_id:'other-task'}],
  ['wrong node',{...policy,node_id:'other-node'}],
  ['malformed permission',{...policy,due:'yes'}],
 ] as const)('fails closed for %s state',(_,value)=>expect(readNodeDetailEditState(node(value as WorkNode['detail_edit']),'task-1')).toBeNull());
 it('fails closed when the row belongs to another task',()=>expect(readNodeDetailEditState(node(policy),'other-task')).toBeNull());
});
