import {supabase} from '../../../../lib/supabase';
import {isQueryAccessDenied,isQueryConnectionFailure} from '../../../shared/queryAccess';
import type {OfficeFundingSourcesPreview,ProjectFlow} from '../types';

export class ProjectFlowError extends Error {
 constructor(message:string,public code?:string,public status?:number){super(message);}
}

const inFlightSnapshots=new Map<string,Promise<unknown>>();
const SNAPSHOT_RETRY_DELAY_MS=350;
const REALTIME_COALESCE_MS=250;

function toRpcError(error:{message?:string;code?:string},status?:number){
 const message=error.message||'The server result could not be verified. Retry this saved request.';
 if(error.code&&(/^[0-9A-Z]{5}$/.test(error.code)&&!error.code.startsWith('08')||/^PGRST[1-4]/.test(error.code))){
  return new ProjectFlowError(message,error.code,status);
 }
 return Object.assign(new Error(message),{code:error.code,status});
}

function isTransientSnapshotFailure(error:unknown):boolean{
 if(typeof navigator!=='undefined'&&navigator.onLine===false)return false;
 if(isQueryAccessDenied(error))return false;
 if(error instanceof ProjectFlowError&&error.code!=='57014')return false;
 const code=(error as {code?:string}|null)?.code||'';
 const abort=(error instanceof DOMException&&error.name==='AbortError')||(error instanceof Error&&error.name==='AbortError');
 return isQueryConnectionFailure(error)||code.startsWith('08')||/^PGRST00[1-3]$/.test(code)||abort;
}

async function executeProjectFlowRpc<T>(name:string,args:Record<string,unknown>,retryTransient:boolean):Promise<T>{
 let attempt=0;
 while(true){
  try{
   const response=await supabase.rpc(name,args) as {data:T;error:{message?:string;code?:string}|null;status?:number};
   if(response.error)throw toRpcError(response.error,response.status);
   return response.data;
  }catch(error){
   if(retryTransient&&attempt===0&&isTransientSnapshotFailure(error)){
    attempt+=1;
    await new Promise(resolve=>setTimeout(resolve,SNAPSHOT_RETRY_DELAY_MS));
    continue;
   }
   throw error;
  }
 }
}

export function projectFlowCall<T=unknown>(name:string,args:Record<string,unknown>,options?:{fresh?:boolean}):Promise<T>{
 const isSnapshot=name==='project_flow_snapshot'&&typeof args?.p_project==='string';
 const key=isSnapshot&&!options?.fresh?String(args.p_project):'';
 if(key){const existing=inFlightSnapshots.get(key);if(existing)return existing as Promise<T>;}
 const request=executeProjectFlowRpc<T>(name,args,isSnapshot)
  .finally(()=>{if(key&&inFlightSnapshots.get(key)===request)inFlightSnapshots.delete(key);});
 if(key)inFlightSnapshots.set(key,request);
 return request;
}

export const readProjectFlow=(id:string)=>projectFlowCall<ProjectFlow>('project_flow_snapshot',{p_project:id});
export const refreshProjectFlow=(id:string)=>projectFlowCall<ProjectFlow>('project_flow_snapshot',{p_project:id},{fresh:true});
export const readOfficeFundingSourcesPreview=()=>projectFlowCall<OfficeFundingSourcesPreview>('office_funding_sources_preview',{});

/** Subscribe to Realtime updates that can affect a project's setup or funding snapshot. */
export function subscribeProjectFlowChanges(projectId:string,onChanged:()=>void):()=>void{
 if(!projectId||typeof supabase.channel!=='function')return()=>{};
 let active=true;
 let connectedOnce=false;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const trigger=()=>{
  if(!active)return;
  if(timer!==undefined)return;
  timer=setTimeout(()=>{
   timer=undefined;
   if(active)onChanged();
  },REALTIME_COALESCE_MS);
 };
 const suffix=typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():Math.random().toString(36).slice(2);
 try{
  const channel=supabase.channel(`project-flow-${projectId}-${suffix}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'projects',filter:`id=eq.${projectId}`},trigger)
   .on('postgres_changes',{event:'*',schema:'public',table:'work_budget_allocations'},trigger)
   .on('postgres_changes',{event:'*',schema:'public',table:'petty_cash_requests'},trigger)
   .on('postgres_changes',{event:'*',schema:'public',table:'petty_cash_liquidations'},trigger)
   .on('postgres_changes',{event:'*',schema:'public',table:'budget_commitments'},trigger)
   .on('postgres_changes',{event:'*',schema:'public',table:'office_budget_sections'},trigger)
   .subscribe(status=>{
    if(!active)return;
    if(status==='SUBSCRIBED'){
     if(connectedOnce)trigger();
     connectedOnce=true;
    }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
     connectedOnce=true;
    }
   });
  return()=>{
   active=false;
   if(timer!==undefined)clearTimeout(timer);
   void supabase.removeChannel(channel);
  };
 }catch{
  return()=>{
   active=false;
   if(timer!==undefined)clearTimeout(timer);
  };
 }
}
