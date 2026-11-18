import {ProjectFlowContext} from './ProjectFlowContext';
import {useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {registerAuthCacheReset} from '../../shared/authCacheReset';
import {isQueryAccessDenied} from '../../shared/queryAccess';
import {
 ProjectFlowError,
 readProjectFlow,
 refreshProjectFlow,
 subscribeProjectFlowChanges,
} from './services/projectFlow';
import type {ProjectFlow} from './types';

const DENIED_FLOW_CODES=['42501','P0002','PGRST116','PGRST301','PGRST302','PGRST303'];
const RESUME_RELOAD_COOLDOWN_MS=60_000;
const ERROR_RETRY_BASE_MS=1_500;
const ERROR_RETRY_MAX_MS=15_000;
const MAX_ERROR_RETRIES=4;
const PROJECT_FLOW_EVENTS=['eflow:project-setup','eflow:finance-updated','eflow:expenses-updated','eflow:subtask-budget-changed'];
const cachedFlowByIdentity=new Map<string,ProjectFlow>();

registerAuthCacheReset(()=>{
 cachedFlowByIdentity.clear();
});

export function useProjectFlow(projectId:string,enabled=true){
 const parent=useContext(ProjectFlowContext),provided=parent?.projectId===projectId?parent.flow:undefined;
 const {user}=useAuth(),identity=`${projectId}:${user?.id??''}`,current=useRef(identity),sequence=useRef(0);
 const retryTimerRef=useRef<number|undefined>(undefined),errorAttemptRef=useRef(0),inFlightRef=useRef(false);
 const queuedFreshRef=useRef(false),staleWhileHiddenRef=useRef(false),hadErrorRef=useRef(false),lastSyncedAtRef=useRef(0);
 if(current.current!==identity){
  current.current=identity;
  sequence.current++;
  errorAttemptRef.current=0;
  inFlightRef.current=false;
  queuedFreshRef.current=false;
  staleWhileHiddenRef.current=false;
  hadErrorRef.current=false;
  lastSyncedAtRef.current=0;
 }
 const cached=enabled&&projectId&&!provided?cachedFlowByIdentity.get(identity):undefined;
 const [state,setState]=useState<{identity:string;data?:ProjectFlow;error:string;denied:boolean;loading:boolean}>(()=>({
  identity,
  data:cached,
  error:'',
  denied:false,
  loading:Boolean(enabled&&projectId&&!provided&&!cached),
 }));

 function clearRetryTimer(){
  if(retryTimerRef.current!==undefined){
   window.clearTimeout(retryTimerRef.current);
   retryTimerRef.current=undefined;
  }
 }

 async function executeReload(markLoadingWhenEmpty:boolean,fresh=false){
  if(!projectId)return;
  clearRetryTimer();
  inFlightRef.current=true;
  const run=++sequence.current;
  if(markLoadingWhenEmpty){
   setState(previous=>{
    const existing=(previous.identity===identity?previous.data:undefined)??cachedFlowByIdentity.get(identity);
    if(existing)return previous;
    return {identity,data:undefined,error:'',denied:false,loading:true};
   });
  }
  try{
   const load=fresh&&typeof refreshProjectFlow==='function'?refreshProjectFlow:readProjectFlow;
   const data=await load(projectId);
   if(current.current===identity&&run===sequence.current){
    cachedFlowByIdentity.set(identity,data);
    errorAttemptRef.current=0;
    hadErrorRef.current=false;
    staleWhileHiddenRef.current=false;
    lastSyncedAtRef.current=Date.now();
    setState({identity,data,error:'',denied:false,loading:false});
   }
  }catch(error){
   if(current.current!==identity||run!==sequence.current)return;
   const isDenied=(error instanceof ProjectFlowError&&DENIED_FLOW_CODES.includes(error.code||''))||isQueryAccessDenied(error);
   const message=isDenied?"Couldn't verify access to this project.":navigator.onLine?"Couldn't load project details. Please try again.":"You're offline. Check your connection and try again.";
   if(isDenied){
    cachedFlowByIdentity.delete(identity);
    hadErrorRef.current=false;
    errorAttemptRef.current=0;
   }else{
    hadErrorRef.current=true;
    if(enabled&&!provided&&(typeof navigator==='undefined'||navigator.onLine!==false)&&errorAttemptRef.current<MAX_ERROR_RETRIES){
     const attempt=errorAttemptRef.current++;
     const delay=Math.min(ERROR_RETRY_MAX_MS,ERROR_RETRY_BASE_MS*2**attempt);
     retryTimerRef.current=window.setTimeout(()=>{
      retryTimerRef.current=undefined;
      if(current.current!==identity||run!==sequence.current)return;
      if(typeof document!=='undefined'&&document.visibilityState!=='visible'){
       staleWhileHiddenRef.current=true;
       return;
      }
      void executeReload(false,true);
     },delay);
    }
   }
   setState(previous=>{
    const preserved=!isDenied?((previous.identity===identity?previous.data:undefined)??cachedFlowByIdentity.get(identity)):undefined;
    return {identity,error:message,denied:isDenied,loading:false,data:preserved};
   });
  }finally{
   if(run===sequence.current){
    inFlightRef.current=false;
    if(queuedFreshRef.current&&current.current===identity){
     queuedFreshRef.current=false;
     void executeReload(false,true);
    }
   }
  }
 }

 const reload=()=>{
  errorAttemptRef.current=0;
  return executeReload(true,true);
 };

 useEffect(()=>{
  if(!enabled||!projectId||provided)return;
  errorAttemptRef.current=0;
  hadErrorRef.current=false;
  queuedFreshRef.current=false;
  staleWhileHiddenRef.current=false;
  lastSyncedAtRef.current=Date.now();
  void executeReload(false,false);
  const triggerActionRefresh=()=>{
   if(inFlightRef.current){
    queuedFreshRef.current=true;
    return;
   }
   void executeReload(false,true);
  };
  const triggerResumeRefresh=()=>{
   if(typeof document!=='undefined'&&document.visibilityState!=='visible')return;
   if(inFlightRef.current)return;
   if(hadErrorRef.current||staleWhileHiddenRef.current||Date.now()-lastSyncedAtRef.current>=RESUME_RELOAD_COOLDOWN_MS){
    staleWhileHiddenRef.current=false;
    void executeReload(false,true);
   }
  };
  const triggerOnline=()=>{
   errorAttemptRef.current=0;
   if(typeof document!=='undefined'&&document.visibilityState!=='visible'){
    staleWhileHiddenRef.current=true;
    return;
   }
   if(hadErrorRef.current||staleWhileHiddenRef.current){
    staleWhileHiddenRef.current=false;
    void executeReload(false,true);
   }
  };
  const triggerRealtime=()=>{
   if(typeof document!=='undefined'&&document.visibilityState!=='visible'){
    staleWhileHiddenRef.current=true;
    return;
   }
   triggerActionRefresh();
  };
  for(const eventName of PROJECT_FLOW_EVENTS)window.addEventListener(eventName,triggerActionRefresh);
  window.addEventListener('focus',triggerResumeRefresh);
  window.addEventListener('online',triggerOnline);
  document.addEventListener('visibilitychange',triggerResumeRefresh);
  const unsubscribeRealtime=typeof subscribeProjectFlowChanges==='function'?subscribeProjectFlowChanges(projectId,triggerRealtime):()=>{};
  return()=>{
   ++sequence.current;
   clearRetryTimer();
   inFlightRef.current=false;
   queuedFreshRef.current=false;
   for(const eventName of PROJECT_FLOW_EVENTS)window.removeEventListener(eventName,triggerActionRefresh);
   window.removeEventListener('focus',triggerResumeRefresh);
   window.removeEventListener('online',triggerOnline);
   document.removeEventListener('visibilitychange',triggerResumeRefresh);
   unsubscribeRealtime();
  };
 },[identity,enabled,!!provided]);

 const sameIdentity=state.identity===identity;
 const data=sameIdentity?state.data:cached;
 const error=sameIdentity?state.error:'';
 const denied=sameIdentity?state.denied:false;
 const loading=sameIdentity?state.loading:Boolean(enabled&&projectId&&!provided&&!data);
 return provided||{data:error&&data?{
  ...data,canAllocate:false,canAuthorize:false,canExtendTaskFunding:false,
  requests:data.requests.map(item=>({...item,canReview:false})),
  liquidations:data.liquidations?.map(item=>({...item,canReview:false})),
 }:data,error,denied,loading,reload};
}
