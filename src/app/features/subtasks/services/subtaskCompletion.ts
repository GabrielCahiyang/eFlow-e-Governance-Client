import {supabase} from '../../../../lib/supabase';
import {attachmentError} from '../../../shared/fileValidation';
import {uploadSubtaskWorkFile} from './subtaskWorkflowService';
import type {SubtaskSubmissionAttachment} from '../types';

export interface SubitemCompletionAttempt {id:string;subtaskId:string;note:string;files:File[];attachments:SubtaskSubmissionAttachment[];actorId?:string}
export function subitemCompletionAttempt(subtaskId:string,note:string,files:File[]):SubitemCompletionAttempt {
 const issue=attachmentError(files,{maxCount:10});if(issue)throw new Error(issue);
 if(note.length>3000)throw new Error('Keep the completion note under 3,000 characters.');
 return {id:crypto.randomUUID(),subtaskId,note:note.trim(),files:[...files],attachments:[]};
}
/** Keep the same request, owner and uploaded paths when the response is lost. */
export async function completeSubitem(attempt:SubitemCompletionAttempt){
 const {data,error}=await supabase.auth.getSession(),actor=data?.session?.user.id;
 if(error||!actor||attempt.actorId&&attempt.actorId!==actor)throw new Error('Sign in with the same account to verify this completion.');
 attempt.actorId=actor;
 for(let index=attempt.attachments.length;index<attempt.files.length;index++)attempt.attachments.push(await uploadSubtaskWorkFile(attempt.subtaskId,attempt.id,attempt.files[index]));
 const response=await supabase.rpc('complete_subitem',{p_subtask_id:attempt.subtaskId,p_completion:{id:attempt.id,note:attempt.note,attachments:attempt.attachments}});
 if(response.error)throw new Error(response.error.message);
 if(response.data?.id!==attempt.subtaskId||response.data?.status!=='completed')throw new Error('Completion was not verified. Retry the same completion.');
 return response.data;
}
