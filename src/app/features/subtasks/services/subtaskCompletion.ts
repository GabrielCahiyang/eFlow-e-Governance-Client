import {supabase} from '../../../../lib/supabase';
import {attachmentError} from '../../../shared/fileValidation';
import {assertWorkAcceptanceAvailable,fetchWorkFinancialClearance} from '../../budget';
import {uploadSubtaskWorkFile} from './subtaskWorkflowService';
import type {SubtaskSubmissionAttachment} from '../types';

export interface SubitemCompletionAttempt {
 id:string;
 rootId?:string;
 subtaskId:string;
 note:string;
 files:File[];
 attachments:SubtaskSubmissionAttachment[];
 actorId?:string;
 sent?:boolean;
}
export function subitemCompletionAttempt(subtaskId:string,note:string,files:File[],rootId?:string):SubitemCompletionAttempt {
 const issue=attachmentError(files,{maxCount:10});if(issue)throw new Error(issue);
 if(note.length>3000)throw new Error('Keep the completion note under 3,000 characters.');
 return {id:crypto.randomUUID(),...(rootId?{rootId}:{}),subtaskId,note:note.trim(),files:[...files],attachments:[]};
}
/** Keep the same request, owner and uploaded paths when the response is lost. */
export async function completeSubitem(attempt:SubitemCompletionAttempt,recheck?:()=>Promise<void>){
 const {data,error}=await supabase.auth.getSession(),actor=data?.session?.user.id;
 if(error||!actor||attempt.actorId&&attempt.actorId!==actor)throw new Error('Sign in with the same account to verify this completion.');
 attempt.actorId=actor;
 // An uncertain result must retry its receipt, even if completion has since
 // removed the submit capability. New/confirmed-rejected writes recheck access.
 if(!attempt.sent){
  await recheck?.();
  if(attempt.rootId)await assertWorkAcceptanceAvailable(attempt.rootId,attempt.subtaskId);
 }
 for(let index=attempt.attachments.length;index<attempt.files.length;index++)attempt.attachments.push(await uploadSubtaskWorkFile(attempt.subtaskId,attempt.id,attempt.files[index]));
 attempt.sent=true;
 const response=await supabase.rpc('complete_subitem',{p_subtask_id:attempt.subtaskId,p_completion:{id:attempt.id,note:attempt.note,attachments:attempt.attachments}});
 if(response.error){
  const code=response.error.code||'';
  if(/^(22|23)/.test(code)||['42501','40001','P0001','40P01','55P03','PGRST202'].includes(code))attempt.sent=false;
  throw new Error(response.error.message);
 }
 const clearance=response.data?.status==='completed'||!attempt.rootId?undefined:await fetchWorkFinancialClearance(attempt.rootId,attempt.subtaskId);
 if(response.data?.id!==attempt.subtaskId||(response.data?.status!=='completed'&&!clearance?.workAccepted))throw new Error('Completion was not verified. Retry the same completion.');
 if(response.data?.status==='completed'&&typeof window!=='undefined'){
  window.dispatchEvent(new CustomEvent('eflow:work-updated',{detail:{taskId:attempt.rootId}}));
  window.dispatchEvent(new Event('eflow:project-setup'));
  window.dispatchEvent(new Event('eflow:finance-updated'));
  window.dispatchEvent(new Event('eflow:expenses-updated'));
  window.dispatchEvent(new CustomEvent('eflow:subtask-budget-changed',{detail:{taskId:attempt.rootId,subtaskId:attempt.subtaskId}}));
 }
 return response.data;
}
