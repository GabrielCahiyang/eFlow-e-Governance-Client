import {supabase} from '../../../../lib/supabase';
import type {ProjectFlow} from '../types';
export class ProjectFlowError extends Error {constructor(message:string,public code?:string){super(message);}}
export async function projectFlowCall<T=unknown>(name:string,args:Record<string,unknown>):Promise<T>{const {data,error}=await supabase.rpc(name,args);if(error){if(error.code&&(/^[0-9A-Z]{5}$/.test(error.code)&&!error.code.startsWith('08')||/^PGRST[1-4]/.test(error.code)))throw new ProjectFlowError(error.message,error.code);throw new Error(error.message||'The server result could not be verified. Retry this saved request.');}return data as T;}
export const readProjectFlow=(id:string)=>projectFlowCall<ProjectFlow>('project_flow_snapshot',{p_project:id});
