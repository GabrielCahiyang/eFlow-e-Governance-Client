import {supabase} from '../../../../lib/supabase';
import {phase2Request} from '../../../shared/phase2Api';
import {readAiText,requestAiChat,type AiQueueUpdate} from '../../ai';
import type {WorkTreeSnapshot} from '../../nested-work';
import {notifyAccessChanged} from '../../project-access';
import {parseStaffRecommendations} from './staffingService';
import type {StaffingContext} from '../types';

export interface AutoAssignmentRequest {id:string;root:string;revision:number;lead:string;people:string[]}

/** The gateway rebuilds candidate context and enforces the model independently. */
export async function prepareAutoAssignment(snapshot:WorkTreeSnapshot,onQueueUpdate:(update:AiQueueUpdate)=>void):Promise<AutoAssignmentRequest> {
  const root=snapshot.root.id;
  const context=await phase2Request<StaffingContext>(`staffing/${encodeURIComponent(root)}/context?auto_assign=true`);
  const response=await requestAiChat({model:'qwen3.5:4b',messages:[{role:'user',content:'Choose a lead and the contributors needed for this task.'}],
    workspace_staffing:{schemaVersion:1,taskId:root,autoAssign:true},stream:false},{onQueueUpdate});
  const raw=readAiText(response).replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
  const pipeline=JSON.parse(raw).pipeline;
  if(pipeline?.laya!=='completed'||pipeline?.layaEngine!=='laya'||pipeline?.validation!=='completed')throw new Error('The AI server did not confirm LAYA review. Restart the updated AI server and retry. No team was saved.');
  const recommendations=parseStaffRecommendations(raw,context);
  return {id:crypto.randomUUID(),root,revision:snapshot.revision,lead:recommendations[0].userId,
    people:[...new Set([...snapshot.root.people,...recommendations.map(person=>person.userId)])].sort()};
}

/** Enrollment and assignment are one transaction; identical retries never reenroll. */
export async function applyAutoAssignment(request:AutoAssignmentRequest):Promise<WorkTreeSnapshot> {
  const {data:before}=await supabase.auth.getSession();
  if(!before.session)throw new Error('Sign in again before assigning work.');
  const {data,error}=await supabase.rpc('auto_assign_project_task',{p_root:request.root,p_revision:request.revision,p_request:request.id,p_lead:request.lead,p_people:request.people});
  if(error)throw Object.assign(new Error(error.message),{code:error.code});
  if(data?.root?.id!==request.root||!Array.isArray(data.nodes))throw new Error('The assignment receipt was not confirmed. Retry the same assignment.');
  const {data:after}=await supabase.auth.getSession();
  if(before.session.access_token!==after.session?.access_token)throw new Error('Your session changed. Reopen this task to check its saved team.');
  await Promise.allSettled([import('../../tasks').then(({notifyTaskListeners})=>notifyTaskListeners()),Promise.resolve().then(notifyAccessChanged)]);
  const {fetchWorkTree}=await import('../../nested-work');
  return fetchWorkTree(request.root);
}
