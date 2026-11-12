import {useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {InspectorSurface} from '../../task-inspector';
import {Button} from '../../../components/ui/button';
import {DeadlineBadge} from '../../../components/ui/DeadlineBadge';
import {workDateLabel} from '../../../shared/workCalendar';
import {requestNavigation} from '../../../shared/navigationGuard';
import type {Task} from '../../tasks';
import {useWorkTree,WorkActivity,WorkTreeEditor,type WorkTreeController} from '../../nested-work';
import type {TaskInspectorOrigin} from '../../task-inspector';
import type {Subtask} from '../../../services/subtaskService';
import {useSubitemInspectorData} from '../hooks/useSubitemInspectorData';
import {getSubtaskPrerequisite} from '../selectors/sequencing';
import {SubitemContext} from './SubitemContext';
import {SubitemChildWork} from './SubitemChildWork';
import {SubitemWorkflow} from './SubitemWorkflow';
import {SubtaskLoadState} from './SubtaskLoadState';
import {selectSubitemInspectorCapabilities} from '../selectors/inspectorCapabilities';

export interface SubitemInspectorProps {
 rootTask:Task;itemId:string;controller?:WorkTreeController;readOnly?:boolean;executionBlocked?:boolean;
 canManageDeadline?:boolean;currentReviewerId?:string;prerequisite?:Subtask|null;origin?:TaskInspectorOrigin;
 onClose:()=>void;onChanged?:()=>void;onReviewItem?:(id:string)=>void;
 initialSection?:'work'|'activity'|'review';
}
export function SubitemInspector(props:SubitemInspectorProps){
 const {user}=useAuth(),key=JSON.stringify([user?.id,props.rootTask.id,props.itemId]);
 return props.controller?<SubitemInspectorContent key={key} {...props} controller={props.controller}/>:<ConnectedSubitemInspector key={key} {...props}/>;
}
function ConnectedSubitemInspector(props:SubitemInspectorProps){const controller=useWorkTree(props.rootTask.id);return <SubitemInspectorContent {...props} controller={controller}/>;}
function SubitemInspectorContent(props:SubitemInspectorProps&{controller:WorkTreeController}){
 const [itemId,setItemId]=useState(props.itemId);
 const [editingSchedule,setEditingSchedule]=useState(false);
 const [section,setSection]=useState<'work'|'activity'>(props.initialSection==='activity'?'activity':'work');
 const {user}=useAuth();
 // Loading and loaded panels must keep the real opener, not each other's buttons.
 const [origin]=useState<TaskInspectorOrigin>(()=>props.origin||{view:'Subitem',returnFocus:typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null});
 const data=useSubitemInspectorData(props.rootTask.id,itemId,props.controller);
 const close=()=>void requestNavigation(props.onClose);
 const openItem=(id:string)=>{if(data.tree?.nodes.some(node=>node.id===id))void requestNavigation(()=>{setItemId(id);});};
 const {node,tree}=data;
 const scopeMatches=tree?.root.project===props.rootTask.linkedProjectId&&(tree?.root.kind==='personal'?tree.root.office===null:tree?.root.office===props.rootTask.orgId);
 const scopeReadOnly=!!props.readOnly||!!props.rootTask.archivedAt||!!props.rootTask.proposedOfficeIdentityId||['completed','cancelled'].includes(props.rootTask.status)||!data.fresh||!scopeMatches;
 const context=tree?{actorId:user?.id||null,rootId:props.rootTask.id,projectId:tree.root.project,officeId:tree.root.office,kind:tree.root.kind,revision:tree.revision,readOnly:scopeReadOnly,executionBlocked:!!props.executionBlocked}:undefined;
 const reviewNode=(id:string)=>openItem(id);
 const loadError=data.error||(tree&&!scopeMatches?'Subtask unavailable in this project or Office.':'');
 if(!node||!tree||!data.data||!scopeMatches)return <><InspectorSurface presentation="page" open onClose={close} ariaLabel={data.loading&&!loadError?'Loading subtask':'Subtask unavailable'} layer={60} className="w-full sm:w-[460px]" returnFocus={origin.returnFocus} onReturnFocus={origin.restoreFocus}>
  <SubtaskLoadState loading={data.loading&&!loadError} error={loadError} onRetry={()=>void data.reload()} onClose={close}/>
 </InspectorSurface></>;
 const current:Subtask={...data.data.subtask,customStatusId:node.custom_status_id === undefined ? data.data.subtask.customStatusId : node.custom_status_id ?? undefined,title:node.title,parentSubtaskId:node.parent_subtask_id||undefined,leadId:node.lead_id||undefined,
  assignedToIds:node.assigned_to_ids,siblingOrder:node.sibling_order,dueDate:node.due_date||undefined,isStandalone:node.is_standalone,status:node.status,isCompleted:node.status==='completed',percentComplete:node.percent_complete};
 const siblings=tree.nodes.map(node=>({id:node.id,title:node.title,parentSubtaskId:node.parent_subtask_id||undefined,position:node.sibling_order,siblingOrder:node.sibling_order,isStandalone:node.is_standalone,isCompleted:node.status==='completed'}));
 const previous=getSubtaskPrerequisite(siblings.find(row=>row.id===itemId)!,siblings);
 // Only authorized sibling context can be used; never carry another item's prior step.
 const prerequisite=previous?{...current,...previous} as Subtask:null;
 const capabilities=selectSubitemInspectorCapabilities(tree,itemId,context!);
 const fundingTask:Task={...props.rootTask,assigneeId:tree.root.lead||undefined,recommendationLeadId:undefined};
 const reload=async()=>{await data.reload();props.onChanged?.();};
 const schedule=tree.root.scheduleBounds?<div className="space-y-3">
  <dl className="grid grid-cols-2 gap-3">
   <div><dt>Start date</dt><dd>{node.start_date?workDateLabel(node.start_date,'Asia/Manila'):'No start date'}</dd></div>
   <div><dt>Due date</dt><dd>{node.due_date?<DeadlineBadge value={node.due_date} status={node.status}/>:'No due date'}</dd></div>
  </dl>
  {capabilities.editDetails&&<Button type="button" variant="outline" size="sm" onClick={()=>setEditingSchedule(true)}>Edit schedule</Button>}
 </div>:undefined;
 return <InspectorSurface presentation="page" open onClose={close} ariaLabel={`Subtask: ${node.title}`} returnFocus={origin.returnFocus} onReturnFocus={origin.restoreFocus}>
  <SubitemContext stuck={!!data.data.progressUpdates[0]?.blocker} node={node} tree={tree} rootTitle={props.rootTask.title} onOpenItem={openItem} onClose={close}/>
  <nav className="task-page__tabs" aria-label="Subtask sections">{(['work','activity'] as const).map(value=><button key={value} type="button" aria-current={section===value?'page':undefined} onClick={()=>void requestNavigation(()=>setSection(value))}>{value==='work'?'Work':'Activity'}</button>)}</nav>
  <div className="task-page__body subitem-page-body">
   <div hidden={section!=='work'} className="subitem-work-layout"><main><SubitemWorkflow task={fundingTask} subtask={current} prerequisite={prerequisite} capabilities={capabilities} pending={data.pending} submissions={data.data.submissions} progressUpdates={data.data.progressUpdates} onSaved={reload} schedule={schedule} onReview={()=>reviewNode(itemId)}/></main>
   <section className="subitem-child-work"><SubitemChildWork itemId={itemId} controller={props.controller} readOnly={scopeReadOnly} executionBlocked={!!props.executionBlocked} onOpenItem={openItem} onReviewItem={reviewNode}/></section></div>
   {section==='activity'&&<section aria-label="Subtask activity"><WorkActivity roots={[props.rootTask.id]} focusedNode={{rootId:props.rootTask.id,nodeId:itemId}} snapshot={data.tree}/></section>}
  </div>
  {editingSchedule&&<WorkTreeEditor data={tree} edit={{command:'edit',node}} save={props.controller.save} reload={props.controller.reload}
    readOnly={scopeReadOnly} refreshPending={data.pending} onCancel={()=>setEditingSchedule(false)} onDone={async()=>{setEditingSchedule(false);await reload();}}/>}
 </InspectorSurface>;
}
