import { useEffect, useState } from 'react';
import { WorkspaceHeader, WorkspaceShell } from '../../../components/ui/workspace';
import { NAVIGATION_LOCATION_EVENT } from '../../../shared/navigationHistory';
import { createPersonalProject } from '../services/workspaceService';
import { usePersonalProject } from '../hooks/usePersonalProject';
import { WorkspaceCreateDialog } from './WorkspaceCreateDialog';
import { PersonalTaskCreate, PersonalTaskList } from './PersonalTaskList';
import { PersonalProjectMembers } from './PersonalProjectMembers';
import { PersonalProjectShortcut } from './PersonalProjectShortcut';
import type { Workspace, WorkspaceProject } from '../types';
import '../workspaces.css';
import { writeNavigationLocation } from '../../navigation';
import {ProjectMembers} from '../../project-members';
import {ProjectFileLibrary} from '../../project-files';
import {ProjectActivityHistory} from '../../projects';

export function PersonalWorkspace({workspace,projects,userId,ownerName,officeId,section,onOpen,onRefresh}: {
 workspace:Workspace;projects:WorkspaceProject[];userId:string;ownerName:string;officeId?:string;section:string;
 onOpen:(id:string)=>void;onRefresh:()=>Promise<void>;
}){
 const [creating,setCreating]=useState(false);
 const [activityOpen,setActivityOpen]=useState(false);
 const read=()=>new URLSearchParams(window.location.search).get('project')||'';
 const [selected,setSelected]=useState(read);
 useEffect(()=>{const sync=()=>setSelected(read());window.addEventListener(NAVIGATION_LOCATION_EVENT,sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener(NAVIGATION_LOCATION_EVENT,sync);window.removeEventListener('popstate',sync);};},[]);
 const detail=usePersonalProject(workspace.id,selected,userId);
 const isOwner=workspace.owner_id===userId;
 const data=detail.data;
 const assignedOnly=section==='personal_work';
 return <WorkspaceShell className="r3-personal-workspace">
  <WorkspaceHeader title={assignedOnly?'My Work':workspace.name} description={`Personal workspace · Owner: ${workspace.owner_name||ownerName} · ${workspace.timezone}`} actions={isOwner&&<button type="button" className="pt-primary" onClick={()=>setCreating(true)}>Create personal project</button>}/>
  <p>Personal review and closeout apply here. Office evidence, approvals and finance stay in their Office projects.</p>
  <nav aria-label="Personal projects" className="r3-project-list">{projects.map(project=><button type="button" key={project.id} aria-current={selected===project.id?'page':undefined} onClick={()=>onOpen(project.id)}>{project.title}<small>{project.status}</small></button>)}</nav>
  {!projects.length&&<p>No personal projects yet.{isOwner?' Create a project to start working.':' Your selected project memberships will appear here.'}</p>}
  {!selected&&projects.length>0&&<p>Select a personal project to view its work and members.</p>}
  {detail.loading&&<p role="status">Loading personal project…</p>}
  {detail.error&&<p role="alert">{detail.error} <button type="button" onClick={()=>void detail.refresh()}>Retry project</button></p>}
  {detail.mutationError&&<p role="alert">{detail.mutationError}</p>}{detail.saved&&<p role="status">{detail.saved}</p>}
  {data&&<section aria-label="Selected personal project"><WorkspaceHeader title={data.project.title} description={`Personal · ${data.project.status}`} actions={isOwner&&<>{data.project.status==='active'&&<button type="button" disabled={detail.busy||data.tasks.some(t=>t.status!=='done')} onClick={()=>void detail.run('complete_project',{}).then(saved=>{if(saved)void onRefresh();})}>Complete personal project</button>}{data.project.status==='completed'&&<button type="button" disabled={detail.busy} onClick={()=>void detail.run('archive_project',{}).then(saved=>{if(saved)void onRefresh();})}>Archive personal project</button>}</>}/>
   {data.tasks.some(t=>t.status!=='done')&&isOwner&&<p>Closeout requires every task and required independent review to finish.</p>}
   {isOwner&&data.project.status==='active'&&<PersonalTaskCreate key={`create-${data.project.id}`} members={data.members} userId={userId} busy={detail.busy} run={detail.run}/>}
   <PersonalTaskList key={`tasks-${data.project.id}`} data={data} userId={userId} busy={detail.busy} run={detail.run} assignedOnly={assignedOnly}/>
   <details><summary>Members and access terms</summary><ProjectMembers projectId={data.project.id} projectStatus={data.project.status} profiles={[]} tasks={[]} onOpenTask={()=>{}}/></details>
   <details><summary>Project files</summary><ProjectFileLibrary key={`files-${data.project.id}`} projectId={data.project.id} readOnly={data.project.status!=='active'}/></details>
   <details onToggle={event=>setActivityOpen(event.currentTarget.open)}><summary>Project activity</summary>{activityOpen&&<ProjectActivityHistory projectId={data.project.id} title={data.project.title}/>}</details>
   {isOwner&&data.project.status==='active'&&<>
    <PersonalProjectMembers key={data.project.id} data={data} busy={detail.busy} run={detail.run}/>
    {officeId&&<PersonalProjectShortcut officeId={officeId} shortcuts={data.shortcuts} busy={detail.busy} run={detail.run} onRefresh={onRefresh}/>}
   </>}
  </section>}
  {creating&&<WorkspaceCreateDialog kind="project" context={workspace.name} owner={workspace.owner_name||ownerName} onClose={()=>setCreating(false)} onCreate={async(request,title)=>{
   const project=await createPersonalProject(workspace.id,request,title);
   writeNavigationLocation('projects','Projects','push',{project:project.id,view:'tasks'});void onRefresh();
  }}/>}
 </WorkspaceShell>;
}
