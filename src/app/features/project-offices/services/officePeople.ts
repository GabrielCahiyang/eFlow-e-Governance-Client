import { supabase } from '../../../../lib/supabase';
import { dispatchProjectInvitation,type ProjectInvitation } from '../../project-invitations';

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
 const {data,error}=await supabase.rpc('r8_office_people',{p_project:project});
 if(error)throw new Error(error.message);
 return (data||[]) as OfficePerson[];
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
