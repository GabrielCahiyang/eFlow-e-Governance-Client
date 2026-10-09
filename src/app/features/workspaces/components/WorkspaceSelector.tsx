import { useState } from 'react';
import { Building2, ChevronDown, Plus, UserRound } from 'lucide-react';
import { WorkspacePopover } from '../../../components/ui/workspace';
import { FormField, TextInput } from '../../../components/ui/FormField';
import { WorkspaceCreateDialog } from './WorkspaceCreateDialog';
import { createWorkspace } from '../services/workspaceService';
import type { Workspace } from '../types';
import { writeWorkspaceLocation } from '../workspaceLocation';
import '../workspaces.css';

export function WorkspaceSelector({name,currentId,workspaces,recent,userId,ownerName,loading,error,available,onSelect,onRefresh,onCreated}: {
 name:string;currentId?:string;workspaces:Workspace[];recent:string[];userId:string;ownerName:string;
 loading:boolean;error?:string;available:boolean;onSelect:(id:string)=>Promise<boolean>;onRefresh:()=>Promise<void>;
 onCreated?:()=>void;
}) {
 const [query,setQuery]=useState(''),[creating,setCreating]=useState(false),[selectError,setSelectError]=useState(''),[open,setOpen]=useState(false);
 const matches=workspaces.filter(w=>`${w.name} ${w.kind} ${w.owner_name||''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const groups=[{label:'Recent workspaces',rows:recent.map(id=>matches.find(w=>w.id===id)).filter((w):w is Workspace=>Boolean(w))},
 {label:'My workspaces',rows:matches.filter(w=>w.owner_id===userId)}, {label:'Available workspaces',rows:matches.filter(w=>w.owner_id!==userId)}];
 return <>
  <WorkspacePopover tooltip="Select workspace" open={open} onOpenChange={setOpen} trigger={<button type="button" className="eflow-workspace-selector" aria-label={`${name} Workspace`}><Building2 size={17}/><strong>{name} Workspace</strong><ChevronDown size={15}/></button>}>
   <div className="r3-workspace-selector"><FormField label="Find workspace"><TextInput value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, type or owner…"/></FormField>
    {loading&&<p role="status">Loading workspaces…</p>}{(error||selectError)&&<p role="alert">{selectError||error}</p>}
    {!matches.length&&!loading&&<p>No available workspaces match.</p>}
    {groups.filter(g=>g.rows.length).map(group=><section key={group.label} aria-label={group.label}><h3>{group.label}</h3>{group.rows.map(w=><button type="button" key={w.id} aria-current={currentId===w.id?'true':undefined} className="r3-workspace-choice" onClick={async()=>{
     setSelectError('');try{if(await onSelect(w.id)){setOpen(false);setQuery('');}}catch(error){setSelectError(error instanceof Error?error.message:'Could not select workspace.');}
    }}>{w.kind==='office'?<Building2 size={17}/>:<UserRound size={17}/>}<span>{w.name}<small>{w.kind==='office'?'Office':`Personal · ${w.owner_name||'Owner'}`}</small></span></button>)}</section>)}
    <button type="button" disabled={!available||loading} onClick={()=>{setOpen(false);setCreating(true);}}><Plus size={16}/> Create workspace</button>
    <button type="button" onClick={()=>void onRefresh()}>Refresh workspaces</button>
   </div>
  </WorkspacePopover>
  {creating&&<WorkspaceCreateDialog kind="workspace" context="Your workspaces" owner={ownerName} onClose={()=>setCreating(false)} onCreate={async(request,name,timezone)=>{
   const created=await createWorkspace(request,name,timezone);
   // The committed identity is authoritative even if the following refresh fails.
   writeWorkspaceLocation(created.id);
   onCreated?.();
  }}/>}
 </>;
}
