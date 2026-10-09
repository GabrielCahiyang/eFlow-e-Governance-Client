import {rowToTask,type Task} from '../../tasks';
import {supabase} from '../../../../lib/supabase';
import type {WorkRequest,WorkTreeSnapshot} from '../types';
export class WorkTreeUnavailable extends Error {}
export async function fetchWorkTree(root:string):Promise<WorkTreeSnapshot>{
 const {data,error}=await supabase.rpc('r7_work_tree',{p_root:root});
 if(error){if(error.code==='PGRST202')throw new WorkTreeUnavailable('Nested work is not installed on this server yet.');throw new Error(error.message);}
 if(!data?.root?.id||data.root.id!==root||!Array.isArray(data.nodes)||!Array.isArray(data.people))throw new Error('Could not verify the current work tree.');
 return data as WorkTreeSnapshot;
}
export async function saveWorkTree(root:string,request:WorkRequest):Promise<WorkTreeSnapshot>{
 const {data,error}=await supabase.rpc('r7_work_command',{p_root:root,p_revision:request.revision,p_request:request.id,p_command:request.command,p_payload:request.payload});
 if(error)throw new Error(error.message);
 if(data?.root?.id!==root||!Array.isArray(data.nodes))throw new Error('No work receipt was returned. Retry the same request.');
 return data as WorkTreeSnapshot;
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
 if(!Array.isArray(data?.events)||typeof data.more!=='boolean')throw new Error('Delegation history could not be verified.');return data;
}
