import { supabase } from '../../../../lib/supabase';
import { InlineCreateRejected, type InlineCreateRequest } from '../../../components/ui/workspace';
import { fetchTaskById, fetchTaskDetailEditState, notifyTaskListeners } from '../../tasks';
import type { ProjectGroup, WorkspaceTaskPatch } from '../types';
import { prerequisiteLinkingError } from '../../../shared/prerequisiteLinkingError';
import { workTimelineError } from '../../../shared/workTimelineError';
const groupFromRow=(r:Record<string,unknown>):ProjectGroup=>({id:String(r.id),projectId:String(r.project_id),title:String(r.title),color:String(r.color),position:Number(r.position),isDefault:r.is_default===true});
const errorMessage=(error:{message:string;code?:string})=>error.code==='23505'&&error.message.includes('eflow_unique_')?'A task with this name already exists here. Use a different name.':error.code==='42P01'||error.code==='PGRST202'?'The project workspace database upgrade is not available yet.':workTimelineError(prerequisiteLinkingError(error.message));
const fail=(error:{message:string;code?:string}|null)=>{if(error)throw new Error(errorMessage(error));};
async function validateTaskPatch(taskId:string,patch:WorkspaceTaskPatch){
 const before=await fetchTaskById(taskId);if(!before)throw new Error('Task is unavailable. Refresh the project and try again.');
 const policy=await fetchTaskDetailEditState(taskId);const current=await fetchTaskById(taskId);
 if(!current||current.updated_at!==before.updated_at||current.status!==before.status)throw new Error('The task changed while editing access was checked. Refresh and review the current task.');
 if(!policy.details)throw new Error('Task details are read-only for your current authority or workflow state.');
 const planningChanged=(patch.start_date!==undefined&&(patch.start_date||'')!==(current.start_date||''))||
  (patch.dependency_ids!==undefined&&(current.dependency_ids==null||JSON.stringify(patch.dependency_ids)!==JSON.stringify(current.dependency_ids)))||
  (patch.estimated_hours!==undefined&&patch.estimated_hours!==Number(current.estimated_hours||0))||
  (patch.budget_impact!==undefined&&patch.budget_impact!==Number(current.budget_impact||0))||
  (patch.group_id!==undefined&&patch.group_id!==current.group_id)||(patch.workspace_position!==undefined&&patch.workspace_position!==current.workspace_position);
 if(planningChanged&&(!policy.planning||policy.started))throw new Error('Planning fields are read-only after work has started. Your current changes were kept.');
 const dueChanged=patch.deadline!==undefined&&patch.deadline!==(String(current.deadline||current.due_date||'').slice(0,10));
 if(dueChanged&&!policy.due)throw new Error('Only the supervising Lead or authorized Office Head can reschedule this task.');
 if(dueChanged&&policy.started&&(!patch.change_reason?.trim()||patch.change_reason.trim().length>1000))throw new Error('Enter a due-date change reason (1–1,000 characters).');
 if(policy.started){
  const unsupported=Object.keys(patch).some(key=>!['title','priority','deadline','change_reason'].includes(key));
  if(unsupported)throw new Error('Work has started. Planning definitions are locked; your current changes were kept.');
 }
}
export async function fetchProjectGroups(projectId:string) { const {data,error}=await supabase.from('project_groups').select('*').eq('project_id',projectId).order('position').order('created_at');fail(error);return (data||[]).map(groupFromRow); }
export async function createProjectGroup(projectId:string,title:string,position:number) { const {data,error}=await supabase.from('project_groups').insert({project_id:projectId,title:title.trim(),position,color:['#087f8c','#579bfc','#00b97d','#8b6be8'][position%4]}).select().single();fail(error);return groupFromRow(data!); }
export async function updateProjectGroup(id:string,changes:{title?:string;color?:string;position?:number}) {const {data,error}=await supabase.from('project_groups').update(changes).eq('id',id).select('id');fail(error);if(!data?.length)throw new Error('You cannot edit this group.');}
export async function deleteProjectGroup(id:string) {const {error}=await supabase.rpc('delete_project_group',{p_group_id:id});fail(error);await notifyTaskListeners();}
export async function createWorkspaceTask(projectId:string,groupId:string,title:string) {const {data,error}=await supabase.rpc('phase3_create_task',{p_project_id:projectId,p_group_id:groupId,p_title:title.trim()});fail(error);await notifyTaskListeners();return data as {id:string};}

export type InlineTaskRequest = InlineCreateRequest;
export const InlineTaskRejected = InlineCreateRejected;

export async function createInlineWorkspaceTask(projectId: string, groupId: string, actorId: string, title: string, request: InlineTaskRequest) {
  const terms = { p_project: projectId, p_group: groupId, p_title: title, p_request: request.id, p_actor: actorId };
  if (request.verifyFirst) {
    const { data, error } = await supabase.rpc('create_inline_project_task', { ...terms, p_verify_only: true });
    fail(error);
    if (typeof data === 'string' && data) return data;
    if (data !== null) throw new Error('Could not verify the original task request.');
  }
  const { data, error } = await supabase.rpc('create_inline_project_task', { ...terms, p_verify_only: false });
  if (error && (/^(22|23)/.test(error.code) || ['42501', 'P0001', 'PGRST202'].includes(error.code))) {
    throw new InlineTaskRejected(errorMessage(error));
  }
  fail(error);
  if (typeof data !== 'string' || !data) throw new Error('No task receipt was returned. Retry to check whether it was saved.');
  return data;
}
export async function patchWorkspaceTask(taskId:string,patch:WorkspaceTaskPatch) {await validateTaskPatch(taskId,patch);const {error}=await supabase.rpc('phase3_patch_task',{p_task_id:taskId,p_patch:patch});fail(error);await notifyTaskListeners();}
export async function editSelectedProjectTask(taskId:string,patch:WorkspaceTaskPatch) {
 await validateTaskPatch(taskId,patch);
 const {error}=await supabase.rpc('edit_selected_project_task',{p_task_id:taskId,p_patch:patch});
 fail(error);
 await notifyTaskListeners();
}
export async function reorderWorkspaceTasks(projectId:string,groupId:string,ids:string[]) {const {error}=await supabase.rpc('phase3_reorder_tasks',{p_project_id:projectId,p_group_id:groupId,p_ids:ids});fail(error);await notifyTaskListeners();}
