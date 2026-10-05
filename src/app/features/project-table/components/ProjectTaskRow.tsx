import { useRef, useState } from 'react';
import { ChevronDown,ChevronRight,MoreHorizontal,PanelRight } from 'lucide-react';
import { InlineEditableText,ActionMenu,WorkspacePopover } from '../../../components/ui/workspace';
import { assignTask,getTaskLeadId,isTaskLead,TASK_STATUS_LABELS,updateTaskStatus,type Task } from '../../tasks';
import type { Subtask } from '../../subtasks';
import type { UserProfile,Organization } from '../../../types';
import { STATUS_COLORS,inlineStatusOptions } from '../selectors';
import { patchWorkspaceTask } from '../services/workspaceService';
import type { ProjectColumn,ProjectGroup } from '../types';
import { TimelineCell,DependencyCell,NumberCell } from './PlanningCells';
import { useProjectOfficeContext, canHandoverTask, projectOfficePeople, setResponsibleOffice, moveProjectOfficeTask } from '../../project-offices';
import { useAuth } from '../../../contexts/AuthContext';
import { SubitemRows } from './SubitemRows';
import { StaffingDialog } from '../../staffing';
export function ProjectTaskRow({task,tasks,groups,profiles,orgs,columns,editable,canSetOffice=false,userId,subtasks,onOpen,onOpenSubitem,refreshSubitems,reorderable,onMove,run}:{task:Task;tasks:Task[];groups:ProjectGroup[];profiles:UserProfile[];orgs:Organization[];columns:ProjectColumn[];editable:boolean;canSetOffice?:boolean;userId:string;subtasks:Subtask[];onOpen:()=>void;onOpenSubitem:(s:Subtask)=>void;refreshSubitems:()=>Promise<void>;reorderable:boolean;onMove:(offset:number)=>void;run:(fn:()=>Promise<void>)=>Promise<void>}){
 const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false);
 const focusSubitemOnClose=useRef(false);
 const [staffing,setStaffing]=useState(false);
 const officeState=useProjectOfficeContext(), {userProfile}=useAuth();
 const shared=officeState.offices.some(o=>o.relationship_type!=='lead');
 const own=officeState.offices.find(o=>o.office_id===userProfile?.org_id);
 const readOnly=!!officeState.error||shared&&(own?.invitation_status!=='joined'||own.relationship_type==='observer'||task.orgId!==userProfile?.org_id);
 const canSubitems=!readOnly&&isTaskLead(task,userId)&&!task.archivedAt&&!['for_review','completed','cancelled'].includes(task.status);
 const responsible=officeState.offices.find(o=>o.office_id===task.orgId);
 const people=responsible?projectOfficePeople(responsible,officeState.members,profiles,orgs):profiles.filter(p=>p.is_active&&p.org_id===task.orgId&&p.role!=='admin');
 const owner=getTaskLeadId(task),person=profiles.find(p=>p.id===owner),statuses=readOnly?[task.status]:inlineStatusOptions(task,userId,editable);
 const subitemUnavailableReason=officeState.error?'Subitem changes are unavailable while Office access cannot be verified.'
  :readOnly?'This Office has read-only access to this task.'
  :task.archivedAt?'Subitems are locked because this task is archived.'
  :['for_review','completed','cancelled'].includes(task.status)?'Subitems are locked while this task is '+TASK_STATUS_LABELS[task.status].toLowerCase()+'.'
  :!owner?'Assign a task owner first. Only the assigned task lead can add subitems.'
  :'Only the assigned task lead'+(person?.full_name?' ('+person.full_name+')':'')+' can add subitems.';
 const save=async(patch:Parameters<typeof patchWorkspaceTask>[1])=>{setBusy(true);try{await patchWorkspaceTask(task.id,patch);}finally{setBusy(false);}};
 const office=orgs.find(o=>o.id===task.orgId)?.name||task.teamName||task.department||'Office';
 const moveActions=groups.filter(g=>g.id!==task.groupId).map(g=>({id:g.id,label:'Move to '+g.title,disabled:!canSetOffice&&!editable,onSelect:()=>{const position=Math.max(0,...tasks.filter(t=>t.groupId===g.id).map(t=>(t.workspacePosition||0)+1));void run(()=>canSetOffice&&shared?moveProjectOfficeTask(task.id,g.id,position):save({group_id:g.id,workspace_position:position}));}}));
 const cell=(id:ProjectColumn)=>{
  if(id==='office')return <WorkspacePopover trigger={<button className="pt-office" aria-label={'Responsible Office for '+task.title}>{office}</button>}><div className="pt-popover-form"><strong>Responsible Office</strong><p>Its Head chooses the owner and team.</p>{canSetOffice&&canHandoverTask(task,subtasks.some(s=>s.status!=='todo'||!!s.assignedTo||s.assignedToIds.length>0))?<label>Assign Office<select value={task.orgId||''} disabled={busy} onChange={e=>{const id=e.target.value;void run(async()=>{setBusy(true);try{await setResponsibleOffice(task.id,id);}finally{setBusy(false);}});}}>{officeState.offices.filter(o=>o.invitation_status==='joined'&&o.relationship_type!=='observer').map(o=><option key={o.id} value={o.office_id}>{orgs.find(n=>n.id===o.office_id)?.name||'Office'}</option>)}</select></label>:<p>{canSetOffice?'Office handover requires an unassigned, unstarted task without staffed or started subitems. Invite and confirm a collaborating Office first.':'The Lead Office Head sets responsibility. Your Office controls its own staff.'}</p>}</div></WorkspacePopover>;
  if(id==='owner')return <div className="pt-owner"><span className="pt-avatar" aria-hidden="true">{person?.full_name.split(' ').map(x=>x[0]).slice(0,2).join('')||'+'}</span><select aria-label={'Owner for '+task.title} value={task.assigneeId||''} disabled={!editable||busy||task.status==='for_review'} onChange={e=>{const id=e.target.value;const p=people.find(p=>p.id===id);void run(async()=>{setBusy(true);try{await assignTask(task.id,id,p?.full_name||'',{teamId:task.teamId,teamName:task.teamName,teamMemberIds:Array.from(new Set([...(task.teamMemberIds||[]),id].filter(Boolean)))});}finally{setBusy(false);}});}}><option value="">Unassigned</option>{people.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}{owner&&!people.some(p=>p.id===owner)&&<option value={owner}>{person?.full_name||task.assigneeName||'Assigned person'}</option>}</select></div>;
  if(id==='status')return <select className="pt-status" style={{background:STATUS_COLORS[task.status]}} value={task.status} aria-label={'Status for '+task.title} disabled={statuses.length<2||busy} onChange={e=>{void run(()=>updateTaskStatus(task.id,e.target.value as Task['status']));}}>{statuses.map(s=><option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}</select>;
  if(id==='priority')return <select className={'pt-priority pt-priority--'+task.priority} aria-label={'Priority for '+task.title} value={task.priority||'medium'} disabled={!editable||busy} onChange={e=>{void run(()=>save({priority:e.target.value as Task['priority']}));}}>{['low','medium','high'].map(p=><option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select>;
  if(id==='timeline')return <TimelineCell task={task} disabled={!editable||busy} save={save}/>;
  if(id==='effort')return <NumberCell label={'Effort hours for '+task.title} value={task.estimatedHours||0} disabled={!editable} field="estimated_hours" save={save}/>;
  if(id==='dependencies')return <DependencyCell task={task} tasks={tasks} disabled={!editable||busy} save={save}/>;
  if(id==='budget')return <NumberCell label={'Budget estimate for '+task.title} value={task.budgetImpact||0} disabled={!editable} field="budget_impact" save={save}/>;
  return <div className="pt-progress" aria-label={'Progress for '+task.title}><progress max={100} value={task.status==='completed'?100:task.status==='cancelled'?0:task.percentComplete||0}/><span>{task.status==='completed'?100:task.status==='cancelled'?0:task.percentComplete||0}%</span></div>;
 };
 return <><tr className="pt-task-row">
  <td className="pt-row-actions-cell"><ActionMenu trigger={<button type="button" className="pt-row-actions-button" aria-label={'Actions for '+task.title}><MoreHorizontal size={16}/></button>} onCloseAutoFocus={event=>{
   if(!focusSubitemOnClose.current)return;
   focusSubitemOnClose.current=false;
   event.preventDefault();
   // The add action hands focus to the expanded editor instead of the menu trigger.
   requestAnimationFrame(()=>document.getElementById('pt-subitems-'+task.id)?.querySelector<HTMLInputElement>('.pt-inline-create__title')?.focus());
  }} actions={[{id:'open',label:'Task details, evidence & review',onSelect:onOpen},...(editable&&!readOnly&&userProfile?.role==='head'&&!task.assigneeId&&['pending_assignment','todo'].includes(task.status)?[{id:'staffing',label:'Recommend staff',onSelect:()=>setStaffing(true)}]:[]),{id:'subitem',label:'Add subitem',disabled:!canSubitems,onSelect:()=>{focusSubitemOnClose.current=true;setExpanded(true);}},{id:'up',label:'Move up',disabled:!reorderable,onSelect:()=>onMove(-1)},{id:'down',label:'Move down',disabled:!reorderable,onSelect:()=>onMove(1)},...moveActions]}/></td>
  <td className="pt-task-name"><div><button type="button" aria-expanded={expanded} aria-controls={'pt-subitems-'+task.id} aria-label={'Subitems for '+task.title} onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button><InlineEditableText value={task.title} label={'task '+task.title} maxLength={300} disabled={!editable||busy} onSave={title=>save({title})}/>{subtasks.length>0&&<span className="pt-subitem-count">{subtasks.length}</span>}<button type="button" aria-label={'Open '+task.title} onClick={onOpen}><PanelRight size={15}/></button></div></td>
  {columns.map(c=><td key={c} className={'pt-cell pt-cell--'+c}>{cell(c)}</td>)}

 </tr>{expanded&&<SubitemRows task={task} subtasks={subtasks} columns={columns.length+2} profiles={profiles} canAdd={canSubitems} unavailableReason={subitemUnavailableReason} onOpen={onOpenSubitem} onOpenTask={onOpen} refresh={refreshSubitems}/ >}{staffing&&<StaffingDialog task={task} onClose={()=>setStaffing(false)}/>}</>;
}
