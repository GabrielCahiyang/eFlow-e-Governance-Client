import {supabase} from '../../../../lib/supabase';
import {attachmentError} from '../../../shared/fileValidation';
import {uploadSubtaskWorkFile} from './subtaskWorkflowService';
import type {SubtaskSubmissionAttachment} from '../types';

export interface SubitemCompletionAttempt {id:string;subtaskId:string;note:string;files:File[];attachments:SubtaskSubmissionAttachment[];actorId?:string;sent?:boolean}
export function subitemCompletionAttempt(subtaskId:string,note:string,files:File[]):SubitemCompletionAttempt {
 const issue=attachmentError(files,{maxCount:10});if(issue)throw new Error(issue);
 if(note.length>3000)throw new Error('Keep the completion note under 3,000 characters.');
 return {id:crypto.randomUUID(),subtaskId,note:note.trim(),files:[...files],attachments:[]};
}
/** Keep the same request, owner and uploaded paths when the response is lost. */
export async function completeSubitem(attempt:SubitemCompletionAttempt,recheck?:()=>Promise<void>){
 const {data,error}=await supabase.auth.getSession(),actor=data?.session?.user.id;
 if(error||!actor||attempt.actorId&&attempt.actorId!==actor)throw new Error('Sign in with the same account to verify this completion.');
 attempt.actorId=actor;
 // An uncertain result must retry its receipt, even if completion has since
 // removed the submit capability. New/confirmed-rejected writes recheck access.
 if(!attempt.sent)await recheck?.();
 for(let index=attempt.attachments.length;index<attempt.files.length;index++)attempt.attachments.push(await uploadSubtaskWorkFile(attempt.subtaskId,attempt.id,attempt.files[index]));
 attempt.sent=true;
 const response=await supabase.rpc('complete_subitem',{p_subtask_id:attempt.subtaskId,p_completion:{id:attempt.id,note:attempt.note,attachments:attempt.attachments}});
 if(response.error){if(/^[0-9A-Z]{5}$/.test(response.error.code||''))attempt.sent=false;throw new Error(response.error.message);}
 if(response.data?.id!==attempt.subtaskId||response.data?.status!=='completed')throw new Error('Completion was not verified. Retry the same completion.');
 return response.data;
}
