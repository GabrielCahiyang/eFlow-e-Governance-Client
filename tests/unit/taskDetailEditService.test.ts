import { beforeEach, describe, expect, it, vi } from 'vitest';

const api=vi.hoisted(()=>({user:'actor-1',rpc:vi.fn(),getUser:vi.fn()}));
vi.mock('../../src/lib/supabase',()=>({supabase:{auth:{getUser:api.getUser},rpc:api.rpc}}));
import {fetchTaskDetailEditState,saveStartedTaskDetails} from '../../src/app/features/tasks/services/taskDetailEditService';

const state=(patch:Record<string,unknown>={})=>({version:1,task_id:'task-1',node_id:null,updated_at:'2026-11-16T00:00:00Z',started:true,details:true,due:true,planning:false,...patch});
const task={id:'task-1',title:'Original',priority:'medium',deadline:'2026-11-20',linkedProjectId:'project-1'} as any;
beforeEach(()=>{vi.clearAllMocks();api.user='actor-1';api.getUser.mockImplementation(async()=>({data:{user:{id:api.user}},error:null}));api.rpc.mockImplementation(async(name:string)=>({data:name==='work_detail_edit_state'?state():null,error:null}));});

describe('Task detail edit policy',()=>{
 it('fails closed on wrong-record or unsupported policy responses',async()=>{
  api.rpc.mockResolvedValueOnce({data:{...state(),task_id:'other'},error:null});
  await expect(fetchTaskDetailEditState('task-1')).rejects.toThrow('unsupported response');
 });
 it('rechecks actor after the policy read',async()=>{
  api.getUser.mockResolvedValueOnce({data:{user:{id:'actor-1'}},error:null}).mockResolvedValueOnce({data:{user:{id:'actor-2'}},error:null});
  await expect(fetchTaskDetailEditState('task-1')).rejects.toThrow('sign-in changed');
 });
 it('writes only changed title and priority through the project task RPC',async()=>{
  await saveStartedTaskDetails(task,{title:' Corrected ',priority:'high'});
  expect(api.rpc).toHaveBeenLastCalledWith('edit_selected_project_task',{p_task_id:'task-1',p_patch:{title:' Corrected ',priority:'high'}});
 });
 it('requires supervising due authority and a reason before writing a due change',async()=>{
  api.rpc.mockImplementation(async(name:string)=>({data:name==='work_detail_edit_state'?state({due:false}):null,error:null}));
  await expect(saveStartedTaskDetails(task,{deadline:'2026-11-21'},'reason')).rejects.toThrow('supervising Lead');
  expect(api.rpc).toHaveBeenCalledTimes(1);
 });
 it('records a due date reason in the narrow guarded write',async()=>{
  await saveStartedTaskDetails(task,{deadline:'2026-11-21'},'Approved reschedule');
  expect(api.rpc).toHaveBeenLastCalledWith('edit_selected_project_task',{p_task_id:'task-1',p_patch:{deadline:'2026-11-21',change_reason:'Approved reschedule'}});
 });
 it('does not request a schedule reason or due permission for the same calendar date stored as a timestamp',async()=>{
  api.rpc.mockImplementation(async(name:string)=>({data:name==='work_detail_edit_state'?state({due:false}):null,error:null}));
  await saveStartedTaskDetails({...task,deadline:'2026-11-19T20:00:00Z'},{title:'Corrected',deadline:'2026-11-20'});
  expect(api.rpc).toHaveBeenLastCalledWith('edit_selected_project_task',{p_task_id:'task-1',p_patch:{title:'Corrected'}});
 });
});
