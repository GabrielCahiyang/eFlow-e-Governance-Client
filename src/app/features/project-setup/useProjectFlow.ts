import {ProjectFlowContext} from './ProjectFlowContext';
import {useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {ProjectFlowError,readProjectFlow} from './services/projectFlow';
import type {ProjectFlow} from './types';
export function useProjectFlow(projectId:string,enabled=true){
 const parent=useContext(ProjectFlowContext),provided=parent?.projectId===projectId?parent.flow:undefined;
 const {user}=useAuth(),identity=projectId+':'+user?.id,current=useRef(identity),sequence=useRef(0);if(current.current!==identity){current.current=identity;sequence.current++;}
 const [state,setState]=useState<{identity:string;data?:ProjectFlow;error:string}>({identity,error:''});
 async function reload(){
  const run=++sequence.current;
  try{
   const data=await readProjectFlow(projectId);
   if(current.current===identity&&run===sequence.current)setState({identity,data,error:''});
  }catch(error){
   if(current.current!==identity||run!==sequence.current)return;
   const denied=error instanceof ProjectFlowError&&['42501','P0002','PGRST116','PGRST301','PGRST302','PGRST303'].includes(error.code||'');
   const message=denied?'Your access to this project could not be verified.':navigator.onLine?'Could not refresh project details. Retry when the connection is available.':'You’re offline. Reconnect to refresh project details.';
   setState(previous=>({
    identity,error:message,
    data:!denied&&previous.identity===identity?previous.data:undefined,
   }));
  }
 }
 useEffect(()=>{if(!enabled||!projectId||provided)return;void reload();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void reload();},15000);const update=()=>void reload();window.addEventListener('eflow:project-setup',update);window.addEventListener('focus',update);return()=>{++sequence.current;window.clearInterval(timer);window.removeEventListener('eflow:project-setup',update);window.removeEventListener('focus',update);};},[identity,enabled,!!provided]);
 const data=state.identity===identity?state.data:undefined;
 const error=state.identity===identity?state.error:'';
 return provided||{data:error&&data?{
  ...data,canAllocate:false,canAuthorize:false,canExtendTaskFunding:false,
  requests:data.requests.map(item=>({...item,canReview:false})),
  liquidations:data.liquidations?.map(item=>({...item,canReview:false})),
 }:data,error,reload};
}
