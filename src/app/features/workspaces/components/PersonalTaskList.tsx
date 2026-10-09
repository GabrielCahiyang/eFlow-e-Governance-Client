import { useEffect, useState } from 'react';
import { FormField, SelectInput, TextInput } from '../../../components/ui/FormField';
import { useNavigationBlocker } from '../../../shared/navigationGuard';
import type { PersonalCommand, PersonalMember, PersonalSnapshot } from '../types';
import { PersonalTaskStaffing } from './PersonalTaskStaffing';
import {WorkTree,fetchPersonalWorkRoots} from '../../nested-work';
import {ProjectFileLibrary} from '../../project-files';
import {InspectorPanel} from '../../../shared/motion';
import {requestNavigation} from '../../../shared/navigationGuard';

type Run=(command:PersonalCommand,payload:Record<string,unknown>)=>Promise<boolean>;
export function PersonalTaskCreate({members,userId,busy,run}:{members:PersonalMember[];userId:string;busy:boolean;run:Run}){
 const [title,setTitle]=useState(''),[lead,setLead]=useState(userId),[reviewer,setReviewer]=useState('');
 const eligible=members.filter(m=>m.state==='active'&&m.eligible);
 useNavigationBlocker({label:'New personal task',dirty:Boolean(title.trim()),pending:busy,onDiscard:()=>setTitle('')});
 return <form className="r3-task-create" onSubmit={async e=>{e.preventDefault();if(title.trim()&&await run('create_task',{title:title.trim(),lead_id:lead,reviewer_id:reviewer||null}))setTitle('');}}>
  <FormField label="Task name"><TextInput value={title} maxLength={200} disabled={busy} onChange={e=>setTitle(e.target.value)}/></FormField>
  <FormField label="Task lead"><SelectInput value={lead} disabled={busy} onChange={e=>{setLead(e.target.value);if(reviewer===e.target.value)setReviewer('');}} options={eligible.map(m=>({value:m.user_id,label:m.name}))}/></FormField>
  <FormField label="Independent review"><SelectInput value={reviewer} disabled={busy} onChange={e=>setReviewer(e.target.value)} options={[{value:'',label:'No review required'},...eligible.filter(m=>m.user_id!==lead).map(m=>({value:m.user_id,label:m.name}))]}/></FormField>
  <button type="submit" className="pt-primary" disabled={busy||!title.trim()}>Add task</button>
 </form>;
}
export function PersonalTaskList({data,userId,busy,run,assignedOnly=false}:{data:PersonalSnapshot;userId:string;busy:boolean;run:Run;assignedOnly?:boolean}){
 const [descendantRoots,setDescendantRoots]=useState<string[]>([]),[workError,setWorkError]=useState(''),[retryWork,setRetryWork]=useState(0);
 useEffect(()=>{let active=true;setDescendantRoots([]);setWorkError('');if(assignedOnly)void fetchPersonalWorkRoots(data.project.id).then(ids=>{if(active)setDescendantRoots(ids);}).catch(reason=>{if(active)setWorkError((reason as Error).message);});return()=>{active=false;};},[data.project.id,userId,assignedOnly,retryWork]);
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const [staffing,setStaffing]=useState('');
 const [fileTask,setFileTask]=useState<string>();
 const selectedFileTask=data.tasks.find(t=>t.id===fileTask);
 const memberName=(id:string|null)=>data.members.find(m=>m.user_id===id)?.name||'Unassigned';
 const eligible=data.owner===userId||data.members.some(m=>m.user_id===userId&&m.state==='active'&&m.eligible);
 const tasks=data.tasks.filter(t=>!assignedOnly||t.lead_id===userId||t.reviewer_id===userId||descendantRoots.includes(t.id));
 return <div className="r3-task-list" aria-label="Personal tasks">
  {workError&&<p role="alert">{workError}<button type="button" onClick={()=>setRetryWork(value=>value+1)}>Retry assigned subitems</button></p>}
  {!tasks.length&&<p>No {assignedOnly?'assigned ':''}tasks in this project.</p>}
  {tasks.map(task=><article key={task.id} className="r3-task-row"><div><h3>{task.title}</h3><p>Lead: {memberName(task.lead_id)}{!task.lead_id&&task.status!=='done'?' · Needs reassignment':''} · {task.status.replace('_',' ')} · {task.progress}%</p>
   <p>{task.reviewer_id?`Independent reviewer: ${memberName(task.reviewer_id)}`:'Personal completion · No review required'}</p>
   {task.note&&<p>Update: {task.note}</p>}{task.review_note&&<p>Review: {task.review_note}</p>}</div>
   <button type="button" onClick={()=>setFileTask(task.id)}>Files for {task.title}</button>
   {data.project.status==='active'&&eligible&&<div className="r3-task-actions">
    {task.lead_id===userId&&['todo','in_progress'].includes(task.status)&&<>
     <button type="button" disabled={busy} onClick={()=>void run('progress_task',{task_id:task.id,revision:task.revision,progress:Math.min(task.progress+25,99),note:task.note})}>Record progress</button>
     <button type="button" disabled={busy} onClick={()=>void run('submit_task',{task_id:task.id,revision:task.revision,note:task.note})}>{task.reviewer_id?'Submit for review':'Mark done'}</button>
    </>}
    {task.reviewer_id===userId&&task.status==='submitted'&&<>
     <button type="button" disabled={busy} onClick={()=>void run('review_task',{task_id:task.id,revision:task.revision,decision:'approve'})}>Approve personal work</button>
     <button type="button" disabled={busy} onClick={()=>void run('review_task',{task_id:task.id,revision:task.revision,decision:'reject'})}>Return for changes</button>
    </>}
    {data.owner===userId&&task.status!=='done'&&<button type="button" disabled={busy} onClick={()=>setStaffing(task.id)}>Staff {task.title}</button>}
   </div>}
   <button type="button" aria-expanded={!!expanded[task.id]} onClick={()=>void requestNavigation(()=>setExpanded(current=>({...current,[task.id]:!current[task.id]})))}>Subitems for {task.title}</button>{expanded[task.id]&&<WorkTree rootId={task.id} readOnly={data.project.status!=='active'}/>}
   {staffing===task.id&&<PersonalTaskStaffing task={task} members={data.members} busy={busy} run={run} onClose={()=>setStaffing('')}/>}
  </article>)}
 {selectedFileTask&&<InspectorPanel open ariaLabel={`Task files: ${selectedFileTask.title}`} onClose={()=>void requestNavigation(()=>setFileTask(undefined))} className="w-full sm:w-[520px]"><div className="p-4 overflow-y-auto"><h2>{selectedFileTask.title}</h2><button type="button" onClick={()=>void requestNavigation(()=>setFileTask(undefined))}>Close task files</button><ProjectFileLibrary key={selectedFileTask.id} projectId={data.project.id} taskId={selectedFileTask.id} readOnly={data.project.status!=='active'}/></div></InspectorPanel>}
 </div>;
}
