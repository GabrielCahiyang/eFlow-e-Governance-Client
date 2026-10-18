import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {fetchWorkTree,saveWorkTree,WorkTreeUnavailable} from '../services/workTreeService';
import type {WorkRequest,WorkTreeController,WorkTreeSnapshot} from '../types';
import {isolateWorkDraftActor} from '../services/workDraftStore';
import {isCurrentWorkSnapshot} from '../selectors/capabilities';

export function useWorkTree(rootId:string):WorkTreeController & {fresh:boolean} {
 const {user}=useAuth(),actorId=user?.id||null,identity=JSON.stringify([actorId,rootId]);
 const [state,setState]=useState<{identity:string;data?:WorkTreeSnapshot;error:string;unavailable:boolean;loading:boolean;fresh:boolean;pending:boolean}>(
  {identity,error:'',unavailable:false,loading:true,fresh:false,pending:false});
 const generation=useRef(0),active=useRef(true),pending=useRef<number|undefined>(undefined),reading=useRef<number|undefined>(undefined);
 const scope=useRef(identity),verified=useRef(false);
 // Fail closed during the switching render, before the new owner's effect runs.
 if(scope.current!==identity){scope.current=identity;++generation.current;verified.current=false;pending.current=undefined;reading.current=undefined;}
 const current=()=>active.current&&identity===scope.current;
 function accept(next:WorkTreeSnapshot){
  const fresh=isCurrentWorkSnapshot(next,{actorId,rootId,projectId:next.root.project,officeId:next.root.office,kind:next.root.kind,revision:next.revision});verified.current=fresh;
  // A response without the service's verified current identity cannot restore
  // authority or replace protected display. A prior verified display may remain.
  setState(previous=>fresh?{...previous,identity,data:next,error:'',unavailable:false,fresh:true}
   :{...previous,fresh:false,error:'Verify current work access. Reload the work.'});
 }
 async function reload(preserve=true):Promise<void> {
  if(!current())return;
  const run=++generation.current;reading.current=run;
  if(!preserve)verified.current=false;
  setState(previous=>({identity,data:preserve&&previous.identity===identity?previous.data:undefined,error:'',unavailable:preserve&&previous.identity===identity&&previous.unavailable,loading:true,
   fresh:preserve&&previous.identity===identity&&previous.fresh,pending:pending.current!==undefined}));
  try{const next=await fetchWorkTree(rootId);if(current()&&run===generation.current)accept(next);}
  catch(reason){if(current()&&run===generation.current){
   const code=(reason as {code?:string})?.code,message=reason instanceof Error?reason.message:'Could not load work.';
   const denied=['42501','PGRST301','PGRST302','PGRST303'].includes(code||'')||/^(Current (project )?|Nested work |Work |Project )?access denied[.!]?$/i.test(message);
   verified.current=false;
   setState(previous=>({...previous,identity,data:denied||reason instanceof WorkTreeUnavailable?undefined:previous.data,
    fresh:false,unavailable:reason instanceof WorkTreeUnavailable,error:reason instanceof WorkTreeUnavailable?'':message}));
  }}
  finally{if(reading.current===run)reading.current=undefined;if(current()&&run===generation.current)setState(previous=>({...previous,loading:false}));}
 }
 useEffect(()=>{
  active.current=true;isolateWorkDraftActor(actorId);void reload(false);
  const refresh=()=>{if(pending.current===undefined&&reading.current===undefined)void reload(true);};
  const timer=window.setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('eflow:work-updated',refresh);
  return()=>{active.current=false;++generation.current;window.clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('eflow:work-updated',refresh);};
 },[rootId,actorId]);
 async function save(request:WorkRequest):Promise<WorkTreeSnapshot> {
  if(!current()||!verified.current)throw new Error('Verify current work access before saving.');
  if(pending.current!==undefined)throw new Error('A work operation is already pending.');
  const run=++generation.current;pending.current=run;reading.current=undefined;
  setState(previous=>({...previous,loading:false,pending:true}));
  try{const next=await saveWorkTree(rootId,request);if(current()&&run===generation.current)accept(next);return next;}
  finally{if(current()&&pending.current===run){pending.current=undefined;setState(previous=>({...previous,pending:false}));}}
 }
 const sameScope=state.identity===identity,authorityFresh=sameScope&&state.fresh&&verified.current;
 return {rootId,actorId,data:sameScope?state.data:undefined,error:sameScope?state.error:'',unavailable:sameScope&&state.unavailable,
  loading:!sameScope||state.loading,authorityFresh,refreshPending:!sameScope||state.loading,pending:sameScope&&state.pending,reload,save,fresh:authorityFresh};
}
