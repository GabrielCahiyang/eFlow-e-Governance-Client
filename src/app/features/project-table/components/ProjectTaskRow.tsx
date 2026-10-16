import { useRef, useState } from 'react';
import { ChevronDown,ChevronRight,MoreHorizontal,PanelRight } from 'lucide-react';
import { InlineEditableText,ActionMenu } from '../../../components/ui/workspace';
import { getTaskLeadId,isTaskLead,TASK_STATUS_LABELS,TaskTeamEditorDialog,type Task } from '../../tasks';
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
import {supportsNestedWork,useWorkTree,selectRootWorkCapability,type WorkTreeController} from '../../nested-work';
import {requestNavigation} from '../../../shared/navigationGuard';
import type {TaskInspectorOrigin} from '../../task-inspector';
import { useProjectTaskDeletion } from '../hooks/useProjectTaskDeletion';
type ProjectTaskRowProps={locked?:boolean;task:Task;tasks:Task[];groups:ProjectGroup[];profiles:UserProfile[];orgs:Organization[];columns:ProjectColumn[];editable:boolean;canSetOffice?:boolean;userId:string;subtasks:Subtask[];onOpen:(section?:TaskInspectorOrigin['section'])=>void;onOpenSubitem:(s:Subtask,readOnly?:boolean)=>void;refreshSubitems:()=>Promise<void>;reorderable:boolean;onMove:(offset:number)=>void;run:(fn:()=>Promise<void>)=>Promise<void>};
export function ProjectTaskRow(props:ProjectTaskRowProps){
 const {user}=useAuth(),key=JSON.stringify([user?.id,props.task.id]);
 return supportsNestedWork(props.task)?<SupportedTaskRow key={key} {...props}/>:<ProjectTaskRowContent key={key} {...props}/>;
}
function SupportedTaskRow(props:ProjectTaskRowProps){const controller=useWorkTree(props.task.id);return <ProjectTaskRowContent {...props} controller={controller}/>;}
function ProjectTaskRowContent({task,tasks,groups,profiles,orgs,columns,editable,canSetOffice=false,userId,subtasks,onOpen,onOpenSubitem,refreshSubitems,reorderable,onMove,run,locked=false,controller}:ProjectTaskRowProps & {controller?:WorkTreeController}){
 const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[createRequest,setCreateRequest]=useState(0),[collapsedIds,setCollapsedIds]=useState(new Set<string>());
 const focusSubitemOnClose=useRef(false), openTaskOnClose=useRef<boolean|TaskInspectorOrigin['section']>(false),openTeamOnClose=useRef(false),deleteOnClose=useRef(false), actionTrigger=useRef<HTMLButtonElement>(null), pendingEdit=useRef(false);
 const [staffing,setStaffing]=useState(false),[teamEditor,setTeamEditor]=useState(false);
 const officeState=useProjectOfficeContext(), {user,userProfile}=useAuth();
 const shared=officeState.offices.some(o=>o.relationship_type!=='lead');
 const own=officeState.offices.find(o=>o.office_id===userProfile?.org_id);
 const readOnly=locked||!!task.archivedAt||!userProfile||userProfile.is_active===false||userProfile.role==='admin'||officeState.loading||!!officeState.error||shared&&(own?.invitation_status!=='joined'||own.relationship_type==='observer'||task.orgId!==userProfile?.org_id);
 const canDelete=editable&&!readOnly&&userProfile?.role==='head'&&!task.proposedOfficeIdentityId;
 const deletion=useProjectTaskDeletion(task,canDelete&&!busy);
 const workReadOnly=readOnly||busy||!!task.proposedOfficeIdentityId||['for_review','completed','cancelled'].includes(task.status);
 const data=controller?.data;
 const createCapability=data?selectRootWorkCapability(data,'create_child',{actorId:user?.id||null,rootId:task.id,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly:workReadOnly}):undefined;
 const legacyCanSubitems=!workReadOnly&&isTaskLead(task,userId);
 const canSubitems=controller&&!controller.unavailable?!!createCapability?.allowed&&controller.authorityFresh&&!controller.pending:legacyCanSubitems;
 const responsible=officeState.offices.find(o=>o.office_id===task.orgId);
 const people=responsible?projectOfficePeople(responsible,officeState.members,profiles,orgs):profiles.filter(p=>p.is_active&&p.org_id===task.orgId&&p.role!=='admin');
 const owner=getTaskLeadId(task),person=profiles.find(p=>p.id===owner),statuses=readOnly||task.proposedOfficeIdentityId?[task.status]:inlineStatusOptions(task,userId,editable);
 const subitemUnavailableReason=controller&&!controller.unavailable?(!controller.authorityFresh?'Verify current work access before adding a subitem.':controller.pending?'Wait for the current work change.':createCapability?.disabledReason||'Subitem creation is unavailable.') :officeState.error?'Subitem changes are unavailable while Office access cannot be verified.'
  :readOnly?'This Office has read-only access to this task.'
  :task.archivedAt?'Subitems are locked because this task is archived.'
  :['for_review','completed','cancelled'].includes(task.status)?'Subitems are locked while this task is '+TASK_STATUS_LABELS[task.status].toLowerCase()+'.'
  :!owner?'Assign a task owner first. Only the assigned task lead can add subitems.'
  :'Only the assigned task lead'+(person?.full_name?' ('+person.full_name+')':'')+' can add subitems.';
 const write=async(operation:()=>Promise<void>)=>{if(pendingEdit.current||deletion.pending)throw new Error('Finish the current task edit before saving another.');pendingEdit.current=true;setBusy(true);try{await operation();}finally{pendingEdit.current=false;setBusy(false);}};
 const save=(patch:Parameters<typeof patchWorkspaceTask>[1])=>write(()=>patchWorkspaceTask(task.id,patch));

 const moveActions=groups.filter(g=>g.id!==task.groupId).map(g=>({id:g.id,label:'Move to '+g.title,disabled:!canSetOffice&&!editable,onSelect:()=>{const position=Math.max(0,...tasks.filter(t=>t.groupId===g.id).map(t=>(t.workspacePosition||0)+1));void run(()=>canSetOffice&&shared?moveProjectOfficeTask(task.id,g.id,position):save({group_id:g.id,workspace_position:position}));}}));
 return <><tr className="pt-task-row">
 <td className="pt-row-actions-cell"><ActionMenu trigger={<button ref={actionTrigger} type="button" disabled={busy||deletion.pending} className="pt-row-actions-button" aria-label={'Actions for '+task.title}><MoreHorizontal size={16}/></button>} onCloseAutoFocus={event=>{
   if(deleteOnClose.current){deleteOnClose.current=false;event.preventDefault();requestAnimationFrame(()=>{actionTrigger.current?.focus();void deletion.remove();});return;}
   if(openTeamOnClose.current){openTeamOnClose.current=false;event.preventDefault();requestAnimationFrame(()=>{actionTrigger.current?.focus();setTeamEditor(true);});return;}
   if(openTaskOnClose.current){const section=openTaskOnClose.current;openTaskOnClose.current=false;event.preventDefault();requestAnimationFrame(()=>{actionTrigger.current?.focus();onOpen(typeof section==='string'?section:undefined);});return;}
   if(!focusSubitemOnClose.current)return;
   focusSubitemOnClose.current=false;
   event.preventDefault();
   // The add action hands focus to the expanded editor instead of the menu trigger.
   requestAnimationFrame(()=>document.getElementById('pt-subitems-'+task.id)?.querySelector<HTMLInputElement>('.pt-inline-create__title')?.focus());
  }} actions={[{id:'open',label:'Task details, evidence & review',onSelect:()=>{openTaskOnClose.current=true;}},{id:'team',label:'Task team & contributors',disabled:!supportsNestedWork(task)&&shared&&!readOnly&&isTaskLead(task,userId)&&userProfile?.role!=='head',disabledReason:'Shared-task team changes require the responsible Office Head. View participants in task details.',onSelect:()=>{if(supportsNestedWork(task))openTeamOnClose.current=true;else openTaskOnClose.current='work';}},...(editable&&!readOnly&&!task.proposedOfficeIdentityId&&userProfile?.role==='head'&&!task.assigneeId&&['pending_assignment','todo'].includes(task.status)?[{id:'staffing',label:'Recommend staff',onSelect:()=>setStaffing(true)}]:[]),{id:'subitem',label:'Add subitem',disabled:!canSubitems,disabledReason:subitemUnavailableReason,onSelect:()=>{void requestNavigation(()=>{focusSubitemOnClose.current=true;setExpanded(true);if(controller&&!controller.unavailable)setCreateRequest(value=>value+1);});}},{id:'up',label:'Move up',disabled:!reorderable,disabledReason:'Manual ordering requires an unfiltered group in your own Office.',onSelect:()=>onMove(-1)},{id:'down',label:'Move down',disabled:!reorderable,disabledReason:'Manual ordering requires an unfiltered group in your own Office.',onSelect:()=>onMove(1)},...moveActions,...(canDelete?[{id:'delete',label:'Delete task',variant:'destructive' as const,disabled:busy||deletion.pending,onSelect:()=>{deleteOnClose.current=true;}}]:[])]}/></td>
  <td className="pt-task-name"><div><button type="button" aria-expanded={expanded} aria-controls={'pt-subitems-'+task.id} aria-label={'Subitems for '+task.title} onClick={()=>void requestNavigation(()=>{setExpanded(!expanded);if(expanded)setCreateRequest(0);})}>{expanded?<ChevronDown size={15}/>:<ChevronRight size={15}/>}</button><InlineEditableText value={task.title} label={'task '+task.title} maxLength={300} disabled={!editable||readOnly||busy} onSave={title=>save({title})}/>{subtasks.length>0&&<span className="pt-subitem-count">{subtasks.length}</span>}<button type="button" aria-label={'Open '+task.title} onClick={()=>onOpen()}><PanelRight size={15}/></button></div></td>
  {columns.map(c=><td key={c} className={'pt-cell pt-cell--'+c}><ProjectTaskCell column={c} task={task} tasks={tasks} profiles={profiles} people={people} orgs={orgs} editable={editable&&!readOnly} readOnly={workReadOnly} controller={controller} busy={busy} canSetOffice={canSetOffice&&!readOnly} hasStaffedSubitems={subtasks.some(s=>s.status!=='todo'||!!s.assignedTo||s.assignedToIds.length>0)} statuses={statuses} save={save} write={write}/></td>)}

  <td className="pt-column-spacer"/>
 </tr>{deletion.message&&<tr><td colSpan={columns.length+3}><p role={deletion.tone==='success'?'status':'alert'} className="pt-error">{deletion.message}</p></td></tr>}{deletion.dialog}{expanded&&<SubitemRows task={task} subtasks={subtasks} columns={columns.length+3} profiles={profiles} canAdd={canSubitems} readOnly={workReadOnly} controller={controller} createRequest={createRequest} createFocusTarget={actionTrigger.current||undefined} collapsedIds={collapsedIds} onCollapsedIdsChange={setCollapsedIds} unavailableReason={subitemUnavailableReason} onOpen={onOpenSubitem} onOpenTask={onOpen} refresh={refreshSubitems}/ >}{teamEditor&&<TaskTeamEditorDialog task={task} profiles={profiles} subtasks={subtasks} controller={controller} readOnly={workReadOnly} onClose={()=>setTeamEditor(false)}/ >}{staffing&&<StaffingDialog task={task} onClose={()=>setStaffing(false)}/>}</>;
}
