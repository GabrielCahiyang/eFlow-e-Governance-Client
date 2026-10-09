import {ACCESS_CHANGED_EVENT} from '../../project-access';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';
import { requestNavigation } from '../../../shared/navigationGuard';
import { listWorkspaces, selectWorkspace, WorkspaceApiUnavailable } from '../services/workspaceService';
import { readWorkspacePreference, saveWorkspacePreference, WORKSPACE_QUERY, writeWorkspaceLocation, type WorkspaceDestination } from '../workspaceLocation';
import type { Workspace, WorkspaceSnapshot } from '../types';

/** Scope snapshots have no shared/global cache. A late response cannot populate another scope. */
export function useWorkspaceState(userId: string, officeId: string, enabled: boolean) {
  const read = () => new URLSearchParams(window.location.search).get(WORKSPACE_QUERY) || readWorkspacePreference(userId).current || officeId;
  const [requested,setRequested] = useState(read);
  const [state,setState] = useState<{ key: string; workspaces: Workspace[]; snapshot?: WorkspaceSnapshot; loading: boolean; error?: string; unavailable?: boolean }>({ key:'',workspaces:[],loading:true });
  const generation=useRef(0);
  const scopeKey=`${userId}:${requested}`;
  const refresh=useCallback(async () => {
    const token=++generation.current;
    if (!enabled || !userId) { setState({key:scopeKey,workspaces:[],loading:false,unavailable:true}); return; }
    try {
      const workspaces=await listWorkspaces();
      if (token!==generation.current) return;
      const selected=requested || workspaces.find(w=>w.office_id===officeId)?.id || workspaces[0]?.id;
      if (!selected) { setState({key:scopeKey,workspaces,loading:false}); return; }
      if (!workspaces.some(w=>w.id===selected)) { setState({key:scopeKey,workspaces,loading:false,error:'This workspace is unavailable or your membership has ended.'}); return; }
      const snapshot=await selectWorkspace(selected);
      if (token!==generation.current) return;
      saveWorkspacePreference(userId,selected);
      setState({key:scopeKey,workspaces,snapshot,loading:false});
      // URL becomes authoritative for reload and history; restoration retains the selected project.
      if (new URLSearchParams(window.location.search).get(WORKSPACE_QUERY)!==selected) writeWorkspaceLocation(selected,false,'replace');
    } catch(error) {
      if (token!==generation.current) return;
      setState({key:scopeKey,workspaces:[],loading:false,error:error instanceof Error?error.message:'Could not load workspaces.',unavailable:error instanceof WorkspaceApiUnavailable});
    }
  },[enabled,userId,requested,officeId,scopeKey]);
  useEffect(()=>{
    const sync=()=>setRequested(read());
    sync(); window.addEventListener(NAVIGATION_LOCATION_EVENT,sync); window.addEventListener('popstate',sync);
    return ()=>{ window.removeEventListener(NAVIGATION_LOCATION_EVENT,sync); window.removeEventListener('popstate',sync); };
  },[userId,officeId]);
  useEffect(()=>{
    void refresh(); const interval=window.setInterval(()=>void refresh(),15_000);
    const focus=()=>void refresh(); window.addEventListener('focus',focus);window.addEventListener(ACCESS_CHANGED_EVENT,focus);
    return ()=>{ ++generation.current; window.clearInterval(interval); window.removeEventListener('focus',focus);window.removeEventListener(ACCESS_CHANGED_EVENT,focus); };
  },[refresh]);
  const select=useCallback((id:string,destination?:WorkspaceDestination)=>requestNavigation(()=>writeWorkspaceLocation(id,true,'push',destination)),[]);
  const includeCreatedOfficeProject=useCallback((project:{id:string;title:string;status:string;orgId?:string})=>{
    // Only a committed legacy create receipt in the current canonical Office may bridge refresh latency.
    setState(previous=>{
      if(previous.key!==scopeKey || previous.snapshot?.workspace.kind!=='office' || previous.snapshot.workspace.office_id!==project.orgId)return previous;
      return {...previous,snapshot:{...previous.snapshot,projects:[...previous.snapshot.projects.filter(p=>p.id!==project.id),{id:project.id,title:project.title,status:project.status,kind:'office',home_workspace_id:previous.snapshot.workspace.id}]}};
    });
    void refresh();
  },[scopeKey,refresh]);
  const current=!enabled ? {key:scopeKey,workspaces:[],loading:false,unavailable:true} : state.key===scopeKey?state:{key:scopeKey,workspaces:state.key.startsWith(`${userId}:`)?state.workspaces:[],loading:true};
  return {...current,requested,select,refresh,includeCreatedOfficeProject,recent:readWorkspacePreference(userId).recent};
}
