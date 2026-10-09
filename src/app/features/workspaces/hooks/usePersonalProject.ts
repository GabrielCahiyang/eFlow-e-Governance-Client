import {ACCESS_CHANGED_EVENT} from '../../project-access';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import { fetchPersonalProject, personalCommand } from '../services/workspaceService';
import type { PersonalCommand, PersonalSnapshot } from '../types';

export function usePersonalProject(workspace: string, project: string, user: string) {
 const key=`${user}:${workspace}:${project}`;
 const [state,setState]=useState<{key:string;data?:PersonalSnapshot;error?:string}>({key:''});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const generation=useRef(0),pending=useRef(false),requests=useRef(new Map<string,string>());
 const refresh=useCallback(async()=>{
  const token=++generation.current;
  if(!project){setState({key});return;}
  try{
   const data=await fetchPersonalProject(project);
   if(token!==generation.current)return;
   if(data.project.workspace_id!==workspace)throw new Error('This project belongs to another workspace.');
   setState({key,data});
  }catch(error){if(token===generation.current)setState({key,error:error instanceof Error?error.message:'Could not load personal project.'});}
 },[key,project,workspace]);
 useEffect(()=>{void refresh();const interval=setInterval(()=>void refresh(),15_000);window.addEventListener('focus',refresh);window.addEventListener(ACCESS_CHANGED_EVENT,refresh);
  return()=>{++generation.current;clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener(ACCESS_CHANGED_EVENT,refresh);};},[refresh]);
 useNavigationBlocker({label:'Saving personal work',identity:key,dirty:false,pending:busy,onDiscard:()=>{}});
 const run=async(command:PersonalCommand,payload:Record<string,unknown>)=>{
  if(pending.current)return false;
  pending.current=true;setBusy(true);setError('');setSaved('');
  const requestKey=JSON.stringify([key,command,payload]);
  const request=requests.current.get(requestKey)||crypto.randomUUID();requests.current.set(requestKey,request);
  try{await personalCommand(project,command,payload,request);requests.current.delete(requestKey);setSaved('Changes saved.');void refresh();return true;}
  catch(error){setError(error instanceof Error?error.message:'Save failed. Retry keeps the same request identity.');return false;}
  finally{pending.current=false;setBusy(false);}
 };
 const current=state.key===key?state:{key};
 return {...current,busy,mutationError:error,saved,run,refresh,loading:Boolean(project)&&!current.data&&!current.error};
}
