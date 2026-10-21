import { supabase } from '../../../../lib/supabase';
import { listProjectInvitations,dispatchProjectInvitation,type ProjectInvitation } from '../../project-invitations';

export interface OfficePerson {request_id:string;identity_id:string;participation_role:'representative'|'employee';invitation:ProjectInvitation;active?:boolean}
export function officePersonStatus(person:OfficePerson,now=Date.now()){
 const invite=person.invitation;if(person.active)return 'Joined';
 if(invite.state==='approved'){
  if(invite.expires_at&&Date.parse(invite.expires_at)<=now)return 'Invitation expired';
  return invite.delivery_status==='failed'?'Invite failed':invite.delivery_status==='provider_accepted'?'Invite pending':invite.delivery_status==='attempting'?'Sending invitation':'Ready to send';
 }
 return invite.state==='expired'?'Invitation expired':invite.state==='revoked'?'Invitation revoked':invite.state==='accepted'?'Access ended':'Needs people';
}
export async function fetchOfficePeople(project:string):Promise<OfficePerson[]>{
 const [rows,context,members]=await Promise.all([supabase.from('project_office_people').select('*').eq('project_id',project),listProjectInvitations(project),supabase.from('project_guest_members').select('request_id,ended_at,access_end').eq('project_id',project)]);
 if(rows.error)throw new Error(rows.error.message);
 if(members.error)throw new Error(members.error.message);
 return (rows.data||[]).map(row=>({...row,invitation:context.requests.find(item=>item.id===row.request_id),active:(members.data||[]).some(member=>member.request_id===row.request_id&&!member.ended_at&&(!member.access_end||Date.parse(member.access_end)>Date.now()))})).filter(row=>row.invitation) as OfficePerson[];
}
export async function inviteOfficePerson(request:string,identity:string,email:string,role:'representative'|'employee'){
 const {data,error}=await supabase.rpc('invite_project_office_person',{p_id:request,p_identity:identity,p_email:email.trim().toLowerCase(),p_role:role});
 if(error)throw new Error(error.message);
 if(data.state==='accepted'||data.delivery_status==='provider_accepted')return {delivery_status:data.delivery_status,delivery_error:null,receipt:'Invitation already sent.'};
 return dispatchProjectInvitation(data as ProjectInvitation);
}
export async function fetchOfficeWork(project:string){
 const {data,error}=await supabase.from('project_office_work').select('task_id,identity_id').eq('project_id',project);
 if(error)throw new Error(error.message);return data||[];
}
