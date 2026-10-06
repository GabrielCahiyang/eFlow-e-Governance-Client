import { useRef, useState } from 'react';
import { ChevronDown,ChevronRight,MoreHorizontal,PanelRight } from 'lucide-react';
import { InlineEditableText,ActionMenu } from '../../../components/ui/workspace';
import { getTaskLeadId,isTaskLead,TASK_STATUS_LABELS,type Task } from '../../tasks';
import type { Subtask } from '../../subtasks';
import type { UserProfile,Organization } from '../../../types';
import { inlineStatusOptions } from '../selectors';
import { patchWorkspaceTask } from '../services/workspaceService';
import type { ProjectColumn,ProjectGroup } from '../types';
import { ProjectTaskCell } from './ProjectTaskCells';
import { useProjectOfficeContext, projectOfficePeople, moveProjectOfficeTask } from '../../project-offices';
import { useAuth } from '../../../contexts/AuthContext';
import { SubitemRows } from './SubitemRows';
import { StaffingDialog } from '../../staffing';
export function ProjectTaskRow({task,tasks,groups,profiles,orgs,columns,editable,canSetOffice=false,userId,subtasks,onOpen,onOpenSubitem,refreshSubitems,reorderable,onMove,run,locked=false}:{locked?:boolean;task:Task;tasks:Task[];groups:ProjectGroup[];profiles:UserProfile[];orgs:Organization[];columns:ProjectColumn[];editable:boolean;canSetOffice?:boolean;userId:string;subtasks:Subtask[];onOpen:()=>void;onOpenSubitem:(s:Subtask)=>void;refreshSubitems:()=>Promise<void>;reorderable:boolean;onMove:(offset:number)=>void;run:(fn:()=>Promise<void>)=>Promise<void>}){
 const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false);
 const focusSubitemOnClose=useRef(false), openTaskOnClose=useRef(false), actionTrigger=useRef<HTMLButtonElement>(null), pendingEdit=useRef(false);
 const [staffing,setStaffing]=useState(false);
 const officeState=useProjectOfficeContext(), {userProfile}=useAuth();
 const shared=officeState.offices.some(o=>o.relationship_type!=='lead');
 const own=officeState.offices.find(o=>o.office_id===userProfile?.org_id);
 const readOnly=locked||userProfile?.role==='admin'||!!officeState.error||shared&&(own?.invitation_status!=='joined'||own.relationship_type==='observer'||task.orgId!==userProfile?.org_id);
 const canSubitems=!readOnly&&isTaskLead(task,userId)&&!task.archivedAt&&!['for_review','completed','cancelled'].includes(task.status);
 const responsible=officeState.offices.find(o=>o.office_id===task.orgId);
 const people=responsible?projectOfficePeople(responsible,officeState.members,profiles,orgs):profiles.filter(p=>p.is_active&&p.org_id===task.orgId&&p.role!=='admin');
 const owner=getTaskLeadId(task),person=profiles.find(p=>p.id===owner),statuses=readOnly||task.proposedOfficeIdentityId?[task.status]:inlineStatusOptions(task,userId,editable);
 const subitemUnavailableReason=officeState.error?'Subitem changes are unavailable while Office access cannot be verified.'
  :readOnly?'This Office has read-only access to this task.'
  :task.archivedAt?'Subitems are locked because this task is archived.'
  :['for_review','completed','cancelled'].includes(task.status)?'Subitems are locked while this task is '+TASK_STATUS_LABELS[task.status].toLowerCase()+'.'
  :!owner?'Assign a task owner first. Only the assigned task lead can add subitems.'
  :'Only the assigned task lead'+(person?.full_name?' ('+person.full_name+')':'')+' can add subitems.';
 const write=async(operation:()=>Promise<void>)=>{if(pendingEdit.current)throw new Error('Finish the current task edit before saving another.');pendingEdit.current=true;setBusy(true);try{await operation();}finally{pendingEdit.current=false;setBusy(false);}};
 const save=(patch:Parameters<typeof patchWorkspaceTask>[1])=>write(()=>patchWorkspaceTask(task.id,patch));

 const moveActions=groups.filter(g=>g.id!==task.groupId).map(g=>({id:g.id,label:'Move to '+g.title,disabled:!canSetOffice&&!editable,onSelect:()=>{const position=Math.max(0,...tasks.filter(t=>t.groupId===g.id).map(t=>(t.workspacePosition||0)+1));void run(()=>canSetOffice&&shared?moveProjectOfficeTask(task.id,g.id,position):save({group_id:g.id,workspace_position:position}));}}));
 return <><tr className="pt-task-row">
  <td className="pt-row-actions-cell"><ActionMenu trigger={<button ref={actionTrigger} type="button" className="pt-row-actions-button" aria-label={'Actions for '+task.title}><MoreHorizontal size={16}/></button>} onCloseAutoFocus={event=>{
   if(openTaskOnClose.current){openTaskOnClose.current=false;event.preventDefault();requestAnimationFrame(()=>{actionTrigger.current?.focus();onOpen();});return;}
   if(!focusSubitemOnClose.current)return;
   focusSubitemOnClose.current=false;
   event.preventDefault();
   // The add action hands focus to the expanded editor instead of the menu trigger.
   requestAnimationFrame(()=>document.getElementById('pt-subitems-'+task.id)?.querySelector<HTMLInputElement>('.pt-inline-create__title')?.focus());
  }} actions={[{id:'open',label:'Task details, evidence & review',onSelect:()=>{openTaskOnClose.current=true;}},{id:'team',label:'Task team & contributors',disabled:shared&&!readOnly&&isTaskLead(task,userId)&&userProfile?.role!=='head',disabledReason:'Shared-task team changes require the responsible Office Head. View participants in task details.',onSelect:()=>{openTaskOnClose.current=true;}},...(editable&&!readOnly&&!task.proposedOfficeIdentityId&&userProfile?.role==='head'&&!task.assigneeId&&['pending_assignment','todo'].includes(task.status)?[{id:'staffing',label:'Recommend staff',onSelect:()=>setStaffing(true)}]:[]),{id:'subitem',label:'Add subitem',disabled:!canSubitems,disabledReason:subitemUnavailableReason,onSelect:()=>{focusSubitemOnClose.current=true;setExpanded(true);}},{id:'up',label:'Move up',disabled:!reorderable,disabledReason:'Manual ordering requires an unfiltered group in your own Office.',onSelect:()=>onMove(-1)},{id:'down',label:'Move down',disabled:!reorderable,disabledReason:'Manual ordering requires an unfiltered group in your own Office.',onSelect:()=>onMove(1)},...moveActions]}/></td>
  <td className="pt-task-name"><div><button type="button" aria-expanded={expanded} aria-controls={'pt-subitems-'+task.id} aria-label={'Subitems for '+task.title} onClick={()=>setExpanded(!expanded)}>{expanded?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button><InlineEditableText value={task.title} label={'task '+task.title} maxLength={300} disabled={!editable||readOnly||busy} onSave={title=>save({title})}/>{subtasks.length>0&&<span className="pt-subitem-count">{subtasks.length}</span>}<button type="button" aria-label={'Open '+task.title} onClick={onOpen}><PanelRight size={15}/></button></div></td>
  {columns.map(c=><td key={c} className={'pt-cell pt-cell--'+c}><ProjectTaskCell column={c} task={task} tasks={tasks} profiles={profiles} people={people} orgs={orgs} editable={editable&&!readOnly} busy={busy} canSetOffice={canSetOffice&&!readOnly} hasStaffedSubitems={subtasks.some(s=>s.status!=='todo'||!!s.assignedTo||s.assignedToIds.length>0)} statuses={statuses} save={save} write={write}/></td>)}

 </tr>{expanded&&<SubitemRows task={task} subtasks={subtasks} columns={columns.length+2} profiles={profiles} canAdd={canSubitems} unavailableReason={subitemUnavailableReason} onOpen={onOpenSubitem} onOpenTask={onOpen} refresh={refreshSubitems}/ >}{staffing&&<StaffingDialog task={task} onClose={()=>setStaffing(false)}/>}</>;
}
