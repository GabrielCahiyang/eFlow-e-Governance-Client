import { phase2Request, jsonRequest } from '../../../shared/phase2Api';
import { requestAiChat, readAiText, type AiQueueUpdate } from '../../ai';
import { parseStaffRecommendations } from './staffingService';
import type { StaffingContext } from '../types';

export async function prepareImportAssignment(projectId:string, task:{title:string;description:string;estimatedHours:number}, plannedAssignments:Array<{lead:string;hours:number}>, requestId:string, onQueueUpdate:(update:AiQueueUpdate)=>void) {
  const context=await phase2Request<StaffingContext>(`staffing/project/${projectId}/context`,jsonRequest('POST',{...task,plannedAssignments}));
  if(!context.candidates.length)return null;
  const response=await requestAiChat({model:'qwen3.5:4b',messages:[{role:'user',content:'Choose the best available lead and necessary contributors for this imported task.'}],
    workspace_staffing:{schemaVersion:1,taskId:projectId,projectId,draftTask:task,plannedAssignments,autoAssign:true}}, {requestId,onQueueUpdate});
  const people=parseStaffRecommendations(readAiText(response).replace(/<think>[\s\S]*?<\/think>/gi,'').trim(),context);
  return {lead:people[0].userId,people:people.map(person=>person.userId)};
}
