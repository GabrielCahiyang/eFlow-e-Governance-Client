import {supabase} from '../../../../lib/supabase';
import type {AccessSnapshot,AccessGrant,RemovalImpact,SelectionImpact,AccessPermission,Engagement} from '../types';
export const ACCESS_CHANGED_EVENT='eflow-project-access-changed';
export class AccessUnavailable extends Error {}
async function rpc<T>(name:string,args:Record<string,unknown>):Promise<T>{
 const {data,error}=await supabase.rpc(name,args);
 if(error)throw ['PGRST202','42883'].includes(error.code)?new AccessUnavailable('Sharing and reviewed removal require the R9 database migration.'):new Error(error.message);
 if(data===undefined)throw new Error('Missing access receipt. Retry the same operation.');return data as T;
}
export const notifyAccessChanged=()=>window.dispatchEvent(new Event(ACCESS_CHANGED_EVENT));
export async function fetchAccess(project:string){const data=await rpc<AccessSnapshot>('r9_project_access',{p_project:project});if(!Array.isArray(data?.grants)||!Array.isArray(data.can_remove_offices))throw new Error('Invalid project access response.');return data;}
export async function previewRemoval(project:string,user:string,office?:string|null){const data=await rpc<RemovalImpact>('r9_removal_preview',{p_project:project,p_user:user,p_office:office||null});if(!data?.fingerprint||!Array.isArray(data.tasks)||!Array.isArray(data.nodes))throw new Error('Invalid removal impact. Refresh before confirming.');return data;}
export async function removePerson(impact:RemovalImpact,request:string){const receipt=await rpc<{removed:string}>('r9_remove_person',{p_project:impact.project,p_user:impact.user,p_office:impact.office,p_fingerprint:impact.fingerprint,p_request:request});if(receipt?.removed!==impact.user)throw new Error('Missing removal receipt. Retry this request.');notifyAccessChanged();return receipt;}
export async function grantAccess(id:string,project:string,email:string,access:AccessPermission,engagement:Engagement,end:string|null,close:boolean,ttl=7){const receipt=await rpc<AccessGrant>('r9_grant_access',{p_id:id,p_project:project,p_email:email,p_access:access,p_engagement:engagement,p_end:end,p_close:close,p_ttl:ttl});if(receipt?.id!==id)throw new Error('Missing grant receipt. Keep this draft and retry.');notifyAccessChanged();return receipt;}
export async function revokeViewer(id:string){await rpc('r9_revoke_grant',{p_id:id});notifyAccessChanged();}
export const openShare=(id:string)=>rpc<{project:string;workspace:string;access:AccessPermission}>('r9_open_share',{p_id:id});
export async function previewSelection(office:string,users:string[]):Promise<SelectionImpact|null>{try{const data=await rpc<SelectionImpact>('r9_selection_preview',{p_office:office,p_users:users});if(!data?.fingerprint||!Array.isArray(data.removed))throw new Error('Invalid selection impact. Reload before saving.');return data;}catch(error){if(error instanceof AccessUnavailable)return null;throw error;}}
export async function saveSelection(office:string,users:string[],fingerprint:string,request:string){const receipt=await rpc('r9_select_members',{p_office:office,p_users:users,p_fingerprint:fingerprint,p_request:request});if(!Array.isArray(receipt))throw new Error('Missing selection receipt. Retry the original request.');notifyAccessChanged();}
export function shareUrl(id:string){const url=new URL('/project-share',window.location.origin);url.searchParams.set('grant',id);return url.href;}
