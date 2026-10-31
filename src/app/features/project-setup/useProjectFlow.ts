import {ProjectFlowContext} from './ProjectFlowContext';
import {useContext,useEffect,useRef,useState} from 'react';
import {useAuth} from '../../contexts/AuthContext';
import {readProjectFlow} from './services/projectFlow';
import type {ProjectFlow} from './types';
export function useProjectFlow(projectId:string,enabled=true){
 const parent=useContext(ProjectFlowContext),provided=parent?.projectId===projectId?parent.flow:undefined;
 const {user}=useAuth(),identity=projectId+':'+user?.id,current=useRef(identity),sequence=useRef(0);if(current.current!==identity){current.current=identity;sequence.current++;}
 const [state,setState]=useState<{identity:string;data?:ProjectFlow;error:string}>({identity,error:''});
 async function reload(){const run=++sequence.current;try{const data=await readProjectFlow(projectId);if(current.current===identity&&run===sequence.current)setState({identity,data,error:''});}catch(e){if(current.current===identity&&run===sequence.current)setState({identity,error:e instanceof Error?e.message:'Could not verify project setup.'});}}
 useEffect(()=>{if(!enabled||!projectId||provided)return;void reload();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void reload();},15000);const update=()=>void reload();window.addEventListener('eflow:project-setup',update);window.addEventListener('focus',update);return()=>{++sequence.current;window.clearInterval(timer);window.removeEventListener('eflow:project-setup',update);window.removeEventListener('focus',update);};},[identity,enabled,!!provided]);
 return provided||{data:state.identity===identity?state.data:undefined,error:state.identity===identity?state.error:'',reload};
}
