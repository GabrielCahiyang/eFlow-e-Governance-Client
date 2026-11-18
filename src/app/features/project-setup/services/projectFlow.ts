import {supabase} from '../../../../lib/supabase';
import type {ProjectFlow} from '../types';
export class ProjectFlowError extends Error {constructor(message:string,public code?:string){super(message);}}
const inFlightSnapshots=new Map<string,Promise<unknown>>();
export function projectFlowCall<T=unknown>(name:string,args:Record<string,unknown>):Promise<T>{
 const key=name==='project_flow_snapshot'&&typeof args?.p_project==='string'?args.p_project:'';
 if(key){const existing=inFlightSnapshots.get(key);if(existing)return existing as Promise<T>;}
 const request=(async()=>{
  const {data,error}=await supabase.rpc(name,args);
  if(error){if(error.code&&(/^[0-9A-Z]{5}$/.test(error.code)&&!error.code.startsWith('08')||/^PGRST[1-4]/.test(error.code)))throw new ProjectFlowError(error.message,error.code);throw new Error(error.message||'The server result could not be verified. Retry this saved request.');}
  return data as T;
 })().finally(()=>{if(key&&inFlightSnapshots.get(key)===request)inFlightSnapshots.delete(key);});
 if(key)inFlightSnapshots.set(key,request);
 return request;
}
export const readProjectFlow=(id:string)=>projectFlowCall<ProjectFlow>('project_flow_snapshot',{p_project:id});
