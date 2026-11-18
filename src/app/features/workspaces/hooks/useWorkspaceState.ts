import {ACCESS_CHANGED_EVENT} from '../../project-access';
import { PROJECTS_BROADCAST_EVENT, type Project } from '../../projects';
import { isDocumentVisible } from '../../../shared/queryCache';
import { isQueryAccessDenied } from '../../../shared/queryAccess';
import { isNetworkError, isServerUnavailableError, userFacingError } from '../../../shared/userFacingError';
import { probeConnectivity } from '../../../shared/networkConnectivity';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';
import { requestNavigation } from '../../../shared/navigationGuard';
import { listWorkspaces, selectWorkspace, WorkspaceApiUnavailable } from '../services/workspaceService';
import { readWorkspacePreference, saveWorkspacePreference, WORKSPACE_QUERY, writeWorkspaceLocation, type WorkspaceDestination } from '../workspaceLocation';
import type { Workspace, WorkspaceSnapshot } from '../types';

/** Scope snapshots have no shared/global cache. A late response cannot populate another scope. */
export function useWorkspaceState(userId: string, officeId: string, enabled: boolean, officeOnly = false) {
  const read = () => new URLSearchParams(window.location.search).get(WORKSPACE_QUERY) || readWorkspacePreference(userId).current || officeId;
  const [requested,setRequested] = useState(read);
  const [state,setState] = useState<{ key: string; workspaces: Workspace[]; snapshot?: WorkspaceSnapshot; loading: boolean; error?: string; unavailable?: boolean }>({ key:'',workspaces:[],loading:true });
  const generation=useRef(0);
  const scopeKey=`${userId}:${requested}`;
  const refresh=useCallback(async () => {
    const token=++generation.current;
    if (!enabled || !userId) { setState({key:scopeKey,workspaces:[],loading:false,unavailable:true}); return; }
    try {
      const rawWorkspaces=await listWorkspaces();
      if (token!==generation.current) return;
      const workspaces=officeOnly?rawWorkspaces.filter(w=>w.kind==='office'):rawWorkspaces;
      const defaultOfficeId=workspaces.find(w=>w.office_id===officeId)?.id || workspaces[0]?.id;
      const selected=officeOnly
        ? (requested && workspaces.some(w=>w.id===requested) ? requested : defaultOfficeId)
        : (requested || defaultOfficeId);
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
      if (isNetworkError(error) || isServerUnavailableError(error)) {
        void probeConnectivity();
      }
      const denied = isQueryAccessDenied(error);
      setState(previous => {
        const keepSnapshot = !denied && previous.key === scopeKey && Boolean(previous.snapshot);
        return {
          key: scopeKey,
          workspaces: keepSnapshot ? previous.workspaces : [],
          snapshot: keepSnapshot ? previous.snapshot : undefined,
          loading: false,
          error: userFacingError(error, 'Could not load workspaces.'),
          unavailable: error instanceof WorkspaceApiUnavailable,
        };
      });
    }
  },[enabled,userId,requested,officeId,officeOnly,scopeKey]);
  useEffect(()=>{
    const sync=()=>setRequested(read());
    sync(); window.addEventListener(NAVIGATION_LOCATION_EVENT,sync); window.addEventListener('popstate',sync);
    return ()=>{ window.removeEventListener(NAVIGATION_LOCATION_EVENT,sync); window.removeEventListener('popstate',sync); };
  },[userId,officeId]);
  useEffect(()=>{
    void refresh(); const interval=window.setInterval(()=>{if(isDocumentVisible())void refresh();},15_000);
    const focus=()=>void refresh(); window.addEventListener('focus',focus);window.addEventListener('online',focus);window.addEventListener(ACCESS_CHANGED_EVENT,focus);
    const syncBroadcast=(event:Event)=>{
      const projects=(event as CustomEvent<Project[]>).detail;
      if(!Array.isArray(projects))return;
      const byId=new Map(projects.map(p=>[p.id,p]));
      setState(previous=>{
        if(previous.key!==scopeKey || !previous.snapshot)return previous;
        let changed=false;
        const nextProjects=previous.snapshot.projects.map(item=>{
          const latest=byId.get(item.id);
          if(!latest || (latest.status===item.status && latest.title===item.title))return item;
          changed=true;
          return {...item,status:latest.status,title:latest.title};
        });
        return changed ? {...previous,snapshot:{...previous.snapshot,projects:nextProjects}} : previous;
      });
    };
    window.addEventListener(PROJECTS_BROADCAST_EVENT,syncBroadcast);
    return ()=>{ ++generation.current; window.clearInterval(interval); window.removeEventListener('focus',focus);window.removeEventListener('online',focus);window.removeEventListener(ACCESS_CHANGED_EVENT,focus);window.removeEventListener(PROJECTS_BROADCAST_EVENT,syncBroadcast); };
  },[refresh,scopeKey]);
  const select=useCallback(async(id:string,destination?:WorkspaceDestination)=>{let moved=false;const accepted=await requestNavigation(()=>{if(destination?.isCurrent?.()===false)return;moved=true;writeWorkspaceLocation(id,true,'push',destination);});return accepted&&moved;},[]);
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
