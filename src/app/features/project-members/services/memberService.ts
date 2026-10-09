import {supabase} from '../../../../lib/supabase';
import type {Engagement,MembersSnapshot,SelectedMember} from '../types';
export async function fetchMembers(project:string):Promise<MembersSnapshot>{
 const {data,error}=await supabase.rpc('r7_project_members',{p_project:project});
 if(error)throw new Error(error.code==='PGRST202'?'Members is not available on this server yet. Continue using Offices.':error.message);
 if(!data||!Array.isArray(data.members)||!Array.isArray(data.offices))throw new Error('Invalid Members response.');return data as MembersSnapshot;
}
export async function saveMemberTerms(project:string,member:SelectedMember,engagement:Engagement,end:string|null,until:boolean,request:string=crypto.randomUUID()){
 const args={p_project:project,p_user:member.user_id,p_office:member.project_office_id?member.office||null:null,p_engagement:engagement,p_end:end,p_until_close:until,p_request:request,p_expected:{engagement:member.engagement,access_end:member.access_end,until_close:member.until_close,access_ended_at:member.access_ended_at}};
 let result=await supabase.rpc('r9_member_terms',args);if(['PGRST202','42883'].includes(result.error?.code||''))result=await supabase.rpc('r7_member_terms',args);const {data,error}=result;
 if(error)throw new Error(error.message);if(!data?.user_id)throw new Error('Missing saved member receipt. Reload Members before trying again.');return data;
}
