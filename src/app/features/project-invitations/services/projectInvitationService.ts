import {accessEnd} from '../../../shared/accessTerms';
export {accessEnd} from '../../../shared/accessTerms';
import {supabase} from '../../../../lib/supabase';
import {jsonRequest,phase2Request} from '../../../shared/phase2Api';
import type {InvitationContext,InvitationDraft,ProjectInvitation} from '../types';
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.code==='PGRST202'?'Project invitations require the R8 database migration.':error.message);return data as T;}
export const listProjectInvitations=(project:string)=>rpc<InvitationContext>('r8_list_requests',{p_project:project});
export const decideProjectInvitation=(item:ProjectInvitation,action:'approved'|'rejected'|'revoked')=>rpc<ProjectInvitation>('r8_decide_request',{p_id:item.id,p_revision:item.revision,p_action:action});
export const designateSponsor=(workspace:string,office:string)=>rpc<void>('r8_designate_sponsor',{p_workspace:workspace,p_office:office});
export const completeProjectOnboarding=(id:string)=>rpc<void>('r8_complete_onboarding',{p_id:id});
export const dispatchProjectInvitation=(item:ProjectInvitation,resend=false)=>phase2Request<{delivery_status:string;delivery_error:string|null;receipt:string}>(`/project-invitations/${item.id}/dispatch`,jsonRequest('POST',{revision:item.revision,resend}));
export const uploadRequestPds=(file:File,id:string)=>phase2Request(`/pds/upload?project_request_id=${encodeURIComponent(id)}`,{method:'POST',headers:{'Content-Type':'application/pdf','X-File-Name':encodeURIComponent(file.name)},body:file});
export const validateProjectInvitation=(token:string)=>phase2Request<ProjectInvitation&{existing_account:boolean;needs_full_name?:boolean;home_workspace_id?:string;project_title:string;office_name:string}>('/project-invitations/validate',jsonRequest('POST',{token}),true);
export const acceptProjectInvitation=(token:string,name?:string)=>phase2Request('/project-invitations/accept',jsonRequest('POST',{token,...(name?{full_name:name}:{})}));
export const createProjectGuest=(token:string,name:string,password:string,attempt:string)=>phase2Request('/project-invitations/create-account',jsonRequest('POST',{token,full_name:name,password,attempt_id:attempt}),true);

export function submitProjectInvitation(project:string,office:string,row:InvitationDraft,timezone:string,root?:string,node?:string){
 return rpc<ProjectInvitation>('r8_submit_request',{p_id:row.id,p_project:project,p_root:root||null,p_node:node||null,p_office:office,p_email:row.email.trim().toLowerCase(),p_summary:row.summary,p_skills:row.skills.split(',').map(s=>s.trim()).filter(Boolean),p_engagement:row.engagement,p_end:accessEnd(row.end,timezone),p_close:row.untilClose});
}

/** Reuse the saved request on retry; approval and delivery stay server-authorized. */
export async function sendProjectInvitation(project:string,office:string,row:InvitationDraft,timezone:string,root?:string,node?:string){
 let item=await submitProjectInvitation(project,office,row,timezone,root,node);
 if(item.state==='accepted')return {item,status:'Already accepted · view current membership in the project'};
 if(item.state==='approved'&&item.delivery_status==='provider_accepted')return {item,status:'Invitation already sent · waiting for acceptance'};
 if(item.state==='pending'){
  if(!item.can_approve)throw new Error('Your current sponsoring Head approval is required. The request is saved.');
  item=await decideProjectInvitation(item,'approved');
 }
 if(item.state!=='approved'||!item.can_dispatch)throw new Error('Invitation cannot be sent with your current authority. Review its saved status.');
 if(item.delivery_status==='attempting')throw new Error('The saved invitation is already being sent. Check its status before retrying.');
 const result=await dispatchProjectInvitation(item);
 if(result.delivery_status!=='provider_accepted')throw new Error(result.delivery_error||'Invitation saved, but email could not be sent. Retry this invitation.');
 return {item,status:'Invitation sent · waiting for acceptance'};
}
