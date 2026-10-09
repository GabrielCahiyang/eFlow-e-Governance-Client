import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {fetchWorkTree,saveWorkTree,WorkTreeUnavailable} from '../services/workTreeService';
import type {WorkRequest,WorkTreeSnapshot} from '../types';
export function useWorkTree(root:string){
 const {user}=useAuth();
 const [data,setData]=useState<WorkTreeSnapshot>(),[error,setError]=useState(''),[unavailable,setUnavailable]=useState(false),[loading,setLoading]=useState(true);
 const generation=useRef(0),active=useRef(true),pending=useRef(false),hold=useRef(false);
 async function reload(preserve=false){const run=++generation.current;setLoading(true);setError('');if(!preserve)setData(undefined);
  try{const next=await fetchWorkTree(root);if(active.current&&run===generation.current){setData(next);setUnavailable(false);}}
  catch(reason){if(active.current&&run===generation.current){setData(undefined);setUnavailable(reason instanceof WorkTreeUnavailable);if(!(reason instanceof WorkTreeUnavailable))setError(reason instanceof Error?reason.message:'Could not load work.');}}
  finally{if(active.current&&run===generation.current)setLoading(false);}
 }
 useEffect(()=>{active.current=true;void reload();const refresh=()=>{if(!pending.current)void reload(hold.current);};const timer=window.setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{active.current=false;++generation.current;window.clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[root,user?.id]);
 async function save(request:WorkRequest){if(pending.current)throw new Error('A work operation is already pending.');pending.current=true;
  try{const next=await saveWorkTree(root,request);if(active.current){++generation.current;setData(next);setError('');}return next;}
  finally{pending.current=false;}
 }
 return {data,error,loading,unavailable,reload,save,hold};
}
