import { useState } from 'react';
import { Building2, ChevronDown, Plus, UserRound,Check,RefreshCw } from 'lucide-react';
import { WorkspacePopover } from '../../../components/ui/workspace';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { WorkspaceCreateDialog } from './WorkspaceCreateDialog';
import { createWorkspace } from '../services/workspaceService';
import type { Workspace } from '../types';
import { writeWorkspaceLocation } from '../workspaceLocation';
import '../workspaces.css';
import {workspaceChoices} from '../selectors/workspaceChoices';
import {WorkspaceSwitcherControls} from './WorkspaceSwitcherControls';

export function WorkspaceSelector({name,currentId,workspaces,recent,ownerName,loading,error,available,onSelect,onRefresh,onCreated}: {
 name:string;currentId?:string;workspaces:Workspace[];recent:string[];userId:string;ownerName:string;
 loading:boolean;error?:string;available:boolean;onSelect:(id:string)=>Promise<boolean>;onRefresh:()=>Promise<void>;
 onCreated?:()=>void;
}) {
 const [query,setQuery]=useState(''),[creating,setCreating]=useState(false),[selectError,setSelectError]=useState(''),[open,setOpen]=useState(false);
 const groups=workspaceChoices(workspaces,recent,query),matches=groups.flatMap(group=>group.rows);
 const create=()=>{if(!available||loading)return;setOpen(false);setCreating(true);};
 return <>
  <WorkspaceSwitcherControls disabled={!available||loading} onCreate={create}><WorkspacePopover tooltip="Select workspace" open={open} onOpenChange={setOpen} trigger={<button type="button" className="eflow-workspace-selector" aria-label={`${name} Workspace`}><Building2 size={17}/><strong>{name} Workspace</strong><ChevronDown size={15}/></button>}>
   <div className="r3-workspace-selector" role="region" aria-label="Workspace switcher" onKeyDown={event=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    if(event.target instanceof HTMLInputElement&&['Home','End'].includes(event.key))return;
    const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];if(!buttons.length)return;
    event.preventDefault();const index=buttons.indexOf(document.activeElement as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:index<0?buttons.length-1:(index-1+buttons.length)%buttons.length;buttons[next].focus();
   }}><FormField label="Find workspace"><TextInput value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, type or owner…"/></FormField>
    {loading&&<p role="status">Loading workspaces…</p>}{(error||selectError)&&<p role="alert">{selectError||error}</p>}
    {!matches.length&&!loading&&<p>No available workspaces match.</p>}
    {groups.filter(g=>g.rows.length).map(group=><section key={group.label} aria-label={group.label}><h3>{group.label}</h3>{group.rows.map(w=><button type="button" key={w.id} aria-current={currentId===w.id?'true':undefined} className="r3-workspace-choice" onClick={async()=>{
     setSelectError('');try{if(await onSelect(w.id)){setOpen(false);setQuery('');}}catch(error){setSelectError(error instanceof Error?error.message:'Could not select workspace.');}
    }}>{w.kind==='office'?<Building2 size={17}/>:<UserRound size={17}/>}<span>{w.name}<small>{w.kind==='office'?'Office':`Personal · ${w.owner_name||'Owner'}`}</small></span>{currentId===w.id&&<Check size={16} aria-hidden="true"/>}</button>)}</section>)}
    <div className="r3-workspace-utilities"><button type="button" disabled={!available||loading} onClick={create}><Plus size={16}/> Create workspace</button>
    <button type="button" className="r3-workspace-refresh" disabled={loading} onClick={()=>void onRefresh()}><RefreshCw size={15}/>Refresh workspaces</button></div>
   </div>
  </WorkspacePopover></WorkspaceSwitcherControls>
  {creating&&<WorkspaceCreateDialog kind="workspace" context="Your workspaces" owner={ownerName} onClose={()=>setCreating(false)} onCreate={async(request,name,timezone)=>{
   const created=await createWorkspace(request,name,timezone);
   // The committed identity is authoritative even if the following refresh fails.
   writeWorkspaceLocation(created.id);
   onCreated?.();
  }}/>}
 </>;
}
