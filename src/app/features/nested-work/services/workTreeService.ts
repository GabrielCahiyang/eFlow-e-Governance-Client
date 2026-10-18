import {rowToTask,type Task} from '../../tasks';
import {supabase} from '../../../../lib/supabase';
import type {WorkImpact,WorkRequest,WorkTreeSnapshot} from '../types';
import {rememberWorkCapabilityContext} from '../selectors/capabilities';
import {workRpcFailure} from './workRequestOutcome';
import {WorkRequestFailure} from '../types/editor';
import {isWorkEventRecord} from '../selectors/workEventPresentation';
import {notifyTaskListeners} from '../../tasks';
import {integerError} from '../../../shared/numericValidation';
export class WorkTreeUnavailable extends Error {}
// Identity is only for rejecting stale client presentation. The RPC remains the
// authority. Context failures must not change existing reads/receipt contracts.
async function clientSession(){
 try{
  const {data,error}=await supabase.auth.getSession(),session=data?.session;
  return !error&&typeof session?.user?.id==='string'&&session.user.id&&typeof session.access_token==='string'&&session.access_token?{actorId:session.user.id,token:session.access_token}:null;
 }catch{return null;}
}
async function rememberResponse(data:WorkTreeSnapshot,before:Awaited<ReturnType<typeof clientSession>>){
 const after=await clientSession();
 if(before&&after&&before.actorId===after.actorId&&before.token===after.token)rememberWorkCapabilityContext(data,before.actorId);
}
export async function fetchWorkTree(root:string):Promise<WorkTreeSnapshot>{
 const before=await clientSession();
 const {data,error}=await supabase.rpc('r7_work_tree',{p_root:root});
 if(error){if(error.code==='PGRST202')throw new WorkTreeUnavailable('Nested work is not installed on this server yet.');throw Object.assign(new Error(error.message),{code:error.code});}
 if(!data?.root?.id||data.root.id!==root||!Array.isArray(data.nodes)||!Array.isArray(data.people))throw new Error('Could not verify the current work tree.');
 await rememberResponse(data,before);
 return data as WorkTreeSnapshot;
}
export async function saveWorkTree(root:string,request:WorkRequest):Promise<WorkTreeSnapshot>{
 if(request.command==='progress'){const issue=integerError(request.payload.progress,'Progress',0,99);if(issue)throw new WorkRequestFailure('confirmed_failure',issue);}
 const before=await clientSession();
 const terms={p_root:root,p_revision:request.revision,p_request:request.id,p_command:request.command,p_payload:request.payload};
 // A supplied confirmation is never discarded, including an empty/malformed
 // fingerprint. The checked RPC must decide; errors never retry unchecked.
 const {data,error}=request.impactFingerprint!==undefined
  ?await supabase.rpc('nw_work_command',{...terms,p_impact_fingerprint:request.impactFingerprint})
  :await supabase.rpc('r7_work_command',terms);
 if(error)throw workRpcFailure(error);
 if(data?.root?.id!==root||!Array.isArray(data.nodes))throw new WorkRequestFailure('unknown_result','No work receipt was returned. Retry the same request.');
 await rememberResponse(data,before);
 // These commands also change the existing Office task record. Refresh its
 // authorized subscribers from the confirmed receipt, without changing the
 // command outcome if a secondary read fails or issuing another mutation.
 if(data.root.kind==='office'&&['root_lead','contributors'].includes(request.command))
  await Promise.allSettled([Promise.resolve().then(notifyTaskListeners)]);
 return data as WorkTreeSnapshot;
}

const impactCodes=['access_unavailable','read_only','branch_denied','appointment_denied','lifecycle_blocked','history_blocked'];
export async function fetchWorkImpact(root:string,request:Pick<WorkRequest,'revision'|'command'|'payload'>):Promise<WorkImpact>{
 const before=await clientSession();
 if(!before)throw new Error('Sign in to verify the current work impact.');
 const {data,error}=await supabase.rpc('nw_work_impact',{p_root:root,p_revision:request.revision,p_command:request.command,p_payload:request.payload});
 if(error){if(error.code==='PGRST202')throw new WorkTreeUnavailable('Work impact confirmation is not installed on this server yet.');throw new Error(error.message);}
 const after=await clientSession();
 if(!after||before.actorId!==after.actorId||before.token!==after.token)throw new Error('Your session changed. Verify the work impact again.');
 const strings=(value:unknown):value is string[]=>Array.isArray(value)&&value.every(item=>typeof item==='string');
 const count=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;
 const date=(value:unknown)=>value===null||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
 const dateImpact=data?.date_impact;
 const validDateImpact=dateImpact&&date(dateImpact.old_due)&&date(dateImpact.new_due)&&Array.isArray(dateImpact.items)&&dateImpact.items.every((item:NonNullable<WorkImpact['date_impact']>['items'][number])=>
  item&&typeof item.id==='string'&&strings(item.path)&&date(item.old_bound)&&date(item.new_bound)&&typeof item.bound_changed==='boolean'&&item.history_counts&&typeof item.history_counts==='object'&&!Array.isArray(item.history_counts)&&Object.values(item.history_counts).every(count));
 if(!data||data.root_id!==root||data.command!==request.command||data.expected_revision!==request.revision||!count(data.current_revision)
  ||typeof data.allowed!=='boolean'||!strings(data.blocker_codes)||data.blocker_codes.some((code:string)=>!impactCodes.includes(code))
  ||!count(data.selected_count)||!count(data.descendant_count)||!count(data.affected_appointment_count)
  ||!strings(data.before_path)||!strings(data.after_path)||typeof data.fingerprint!=='string'||!data.fingerprint
  ||data.allowed&&data.blocker_codes.length>0||!data.allowed&&data.blocker_codes.length===0
  ||data.requires_date_confirmation!==undefined&&(typeof data.requires_date_confirmation!=='boolean'||!validDateImpact)
  ||dateImpact!==undefined&&(!validDateImpact||typeof data.requires_date_confirmation!=='boolean'||request.command!=='edit'||!Object.prototype.hasOwnProperty.call(request.payload,'due')||dateImpact.new_due!==request.payload.due))throw new Error('Could not verify the current work impact.');
 return data as WorkImpact;
}

export async function fetchPersonalWorkRoots(project:string):Promise<string[]>{
 const {data,error}=await supabase.rpc('r7_personal_work_roots',{p_project:project});
 if(error){if(error.code==='PGRST202')return [];throw new Error(error.message);}
 if(!Array.isArray(data)||data.some(id=>typeof id!=='string'))throw new Error('Personal descendant discovery unavailable.');return data;
}

export async function fetchOfficeWorkRoots():Promise<Task[]>{
 const {data,error}=await supabase.rpc('r7_office_work_roots');
 if(error){if(error.code==='PGRST202')return [];throw new Error(error.message);}
 if(!Array.isArray(data))throw new Error('Assigned descendant work could not be loaded.');return data.map(rowToTask);
}
export interface WorkEvent {id:string;root_id:string;node_id:string|null;command:string;actor_name:string;occurred_at:string;before_data:WorkTreeSnapshot;after_data:WorkTreeSnapshot}
export async function fetchWorkEvents(roots:string[],before?:{time:string;id:string}):Promise<{events:WorkEvent[];more:boolean}>{
 if(!roots.length)return {events:[],more:false};
 const {data,error}=await supabase.rpc('r7_work_activity',{p_roots:roots,p_before:before?.time||null,p_id:before?.id||null});
 if(error){if(error.code==='PGRST202')return {events:[],more:false};throw new Error(error.message);}
 if(!Array.isArray(data?.events)||typeof data.more!=='boolean'||data.events.length>25||new Set(data.events.map((event:WorkEvent)=>event?.id)).size!==data.events.length
  ||data.events.some((event:unknown)=>!isWorkEventRecord(event)||!roots.includes(event.root_id)))throw new Error('Delegation history could not be verified.');return data;
}
