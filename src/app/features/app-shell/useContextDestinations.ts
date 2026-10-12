import {useEffect,useSyncExternalStore} from 'react';
import {getPresentationGroup,navigationParameters,type NavigationGroupId,type NavigationRestore,type ShellNavigationItem} from '../navigation';
import {NAVIGATION_LOCATION_EVENT} from '../../shared/navigationHistory';
interface Destination extends NavigationRestore {section:string;page:string}
const subscribe=(notify:()=>void)=>{window.addEventListener(NAVIGATION_LOCATION_EVENT,notify);window.addEventListener('popstate',notify);return()=>{window.removeEventListener(NAVIGATION_LOCATION_EVENT,notify);window.removeEventListener('popstate',notify);};};
const key=(user:string,group:NavigationGroupId)=>`eflow:context:v1:${user}:${group}`;
function contextParameters(group:NavigationGroupId,value:unknown){const parameters=navigationParameters(value);if(group!=='workspaces')for(const name of ['project','view','plans'])delete parameters[name];if(group!=='my-work')for(const name of ['date','q','workScope','recent'])delete parameters[name];return parameters;}
export function readContextDestination(user:string,group:NavigationGroupId,role:string,items:ShellNavigationItem[]):Destination|undefined{
 if(!user)return;
 try{const value=JSON.parse(localStorage.getItem(key(user,group))||'null');
  if(value?.version!==1||typeof value.section!=='string'||typeof value.page!=='string'||getPresentationGroup(role,value.section)!==group||!items.some(item=>item.id===value.section&&item.pages.some(page=>page.label===value.page)))return;
  return {section:value.section,page:value.page,workspaceId:typeof value.workspaceId==='string'?value.workspaceId:undefined,parameters:contextParameters(group,value.parameters)};
 }catch{return;}
}
/** Remembers accepted URL destinations; the URL and existing route owner still decide. */
export function useContextDestinations({user,role,group,section,page,workspaceId,items,loading,enabled=true}:{user:string;role:string;group:NavigationGroupId;section:string;page?:string;workspaceId:string;items:ShellNavigationItem[];loading:boolean;enabled?:boolean}){
 const search=useSyncExternalStore(subscribe,()=>window.location.search,()=> '');
 useEffect(()=>{
  if(!enabled||!user||!page||group==='workspaces'&&loading||!items.some(item=>item.id===section&&item.pages.some(candidate=>candidate.label===page)))return;
  const parameters=contextParameters(group,Object.fromEntries(new URLSearchParams(search)));
  try{localStorage.setItem(key(user,group),JSON.stringify({version:1,section,page,workspaceId,parameters}));}catch{/* The accepted URL remains usable without storage. */}
 },[user,role,group,section,page,workspaceId,items,loading,search,enabled]);
 return (next:NavigationGroupId)=>readContextDestination(user,next,role,items);
}
