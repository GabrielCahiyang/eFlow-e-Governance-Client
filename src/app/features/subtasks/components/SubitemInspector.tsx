import {useEffect,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {InspectorSurface} from '../../task-inspector';
import {requestNavigation} from '../../../shared/navigationGuard';
import type {Task} from '../../tasks';
import {useWorkTree,selectNodeWorkCapability,WorkActivity,type WorkTreeController} from '../../nested-work';
import type {TaskInspectorOrigin} from '../../task-inspector';
import type {Subtask} from '../../../services/subtaskService';
import {useSubitemInspectorData} from '../hooks/useSubitemInspectorData';
import {useSubtaskReviewerDirectory} from '../hooks/useSubtaskReviewerDirectory';
import {getSubtaskPrerequisite} from '../selectors/sequencing';
import {SubtaskReviewerBadge} from './SubtaskReviewerBadge';
import {SubitemContext} from './SubitemContext';
import {SubitemChildWork} from './SubitemChildWork';
import {SubitemWorkflow} from './SubitemWorkflow';
import {SubitemReviewGate} from './SubitemReviewGate';
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
 const [reviewItem,setReviewItem]=useState<string>();
 const [section,setSection]=useState<'work'|'activity'>(props.initialSection==='activity'?'activity':'work');
 const initialReviewHandled=useRef(false);
 const [reviewError,setReviewError]=useState('');
 const {user}=useAuth();
 // Loading and loaded panels must keep the real opener, not each other's buttons.
 const [origin]=useState<TaskInspectorOrigin>(()=>props.origin||{view:'Subitem',returnFocus:typeof document!=='undefined'&&document.activeElement instanceof HTMLElement?document.activeElement:null});
 const data=useSubitemInspectorData(props.rootTask.id,itemId,props.controller);
 const reviewerId=data.node?.status==='for_review'?data.node.current_reviewer??(data.node.current_reviewer===undefined&&itemId===props.itemId?props.currentReviewerId:undefined):data.data?.subtask.reviewerId;
 const {reviewersById,loading:reviewerLoading}=useSubtaskReviewerDirectory(reviewerId?[reviewerId]:[]);
 const close=()=>void requestNavigation(props.onClose);
 const openItem=(id:string)=>{if(data.tree?.nodes.some(node=>node.id===id))void requestNavigation(()=>{setReviewItem(undefined);setItemId(id);});};
 const {node,tree}=data;
 const scopeMatches=tree?.root.project===props.rootTask.linkedProjectId&&(tree?.root.kind==='personal'?tree.root.office===null:tree?.root.office===props.rootTask.orgId);
 const scopeReadOnly=!!props.readOnly||!!props.rootTask.archivedAt||!!props.rootTask.proposedOfficeIdentityId||['completed','cancelled'].includes(props.rootTask.status)||!data.fresh||!scopeMatches;
 const context=tree?{actorId:user?.id||null,rootId:props.rootTask.id,projectId:tree.root.project,officeId:tree.root.office,kind:tree.root.kind,revision:tree.revision,readOnly:scopeReadOnly,executionBlocked:!!props.executionBlocked}:undefined;
 const canReview=(id:string)=>!!tree&&!!context&&!scopeReadOnly&&!data.pending&&selectNodeWorkCapability(tree,id,'review',context).allowed;
 const reviewNode=(id:string)=>{if(canReview(id))void requestNavigation(()=>props.onReviewItem?props.onReviewItem(id):setReviewItem(id));};
 useEffect(()=>{
  if(props.initialSection!=='review'||initialReviewHandled.current||!data.fresh||data.pending)return;
  initialReviewHandled.current=true;
  if(canReview(itemId))setReviewItem(itemId);else setReviewError('This subitem is no longer available for your review.');
 },[props.initialSection,data.fresh,data.pending,tree,itemId]);
 // Keep the existing review owner mounted when authority changes; disable decisions.
 const reviewSurface=reviewItem?<SubitemReviewGate key={reviewItem} rootId={props.rootTask.id} itemId={reviewItem} readOnly={!canReview(reviewItem)} tree={data.fresh&&scopeMatches?tree:undefined} rootTitle={props.rootTask.title} onClose={()=>setReviewItem(undefined)}/>:null;
 if(!node||!tree||!data.data||!scopeMatches)return <><InspectorSurface presentation="page" open onClose={close} ariaLabel="Subtask unavailable" layer={60} className="w-full sm:w-[460px]" returnFocus={origin.returnFocus} onReturnFocus={origin.restoreFocus}>
  <div className="p-4 space-y-3"><h2>{data.loading?'Loading subitem…':'Subtask unavailable'}</h2><p role={data.error||tree&&!scopeMatches?'alert':'status'}>{data.error||(tree&&!scopeMatches?'Subitem unavailable in this project or Office.':'Verifying current subitem context.')}</p><button type="button" onClick={()=>void data.reload()}>Retry subitem</button><button type="button" onClick={close}>Close subtask detail</button></div>
 </InspectorSurface>{reviewSurface}</>;
 const current:Subtask={...data.data.subtask,title:node.title,parentSubtaskId:node.parent_subtask_id||undefined,leadId:node.lead_id||undefined,
  assignedToIds:node.assigned_to_ids,siblingOrder:node.sibling_order,dueDate:node.due_date||undefined,isStandalone:node.is_standalone,status:node.status,isCompleted:node.status==='completed',percentComplete:node.percent_complete};
 const siblings=tree.nodes.map(node=>({id:node.id,title:node.title,parentSubtaskId:node.parent_subtask_id||undefined,position:node.sibling_order,siblingOrder:node.sibling_order,isStandalone:node.is_standalone,isCompleted:node.status==='completed'}));
 const previous=getSubtaskPrerequisite(siblings.find(row=>row.id===itemId)!,siblings);
 // Only authorized sibling context can be used; never carry another item's prior step.
 const prerequisite=previous?{...current,...previous} as Subtask:null;
 const capabilities=selectSubitemInspectorCapabilities(tree,itemId,context!);
 const fundingTask:Task={...props.rootTask,assigneeId:tree.root.lead||undefined,recommendationLeadId:undefined};
 const reload=async()=>{await data.reload();props.onChanged?.();};
 if(reviewSurface)return <InspectorSurface presentation="page" open onClose={close} ariaLabel="Subitem evidence review" returnFocus={origin.returnFocus}>{reviewSurface}</InspectorSurface>;
 return <InspectorSurface presentation="page" open onClose={close} ariaLabel={`Subtask: ${node.title}`} returnFocus={origin.returnFocus} onReturnFocus={origin.restoreFocus}>
  <SubitemContext stuck={!!data.data.progressUpdates[0]?.blocker} node={node} tree={tree} rootTitle={props.rootTask.title} onOpenItem={openItem} onClose={close}/>
  <nav className="task-page__tabs" aria-label="Subitem sections">{(['work','activity'] as const).map(value=><button key={value} type="button" aria-current={section===value?'page':undefined} onClick={()=>void requestNavigation(()=>setSection(value))}>{value==='work'?'Work':'Activity'}</button>)}</nav>
  <div className="task-page__body subitem-page-body">
   {reviewError&&<p role="alert">{reviewError}</p>}
   {reviewerId&&<SubtaskReviewerBadge reviewer={reviewersById[reviewerId]} status={node.status} loading={reviewerLoading}/>}
   <div hidden={section!=='work'} className="subitem-work-layout"><main><SubitemWorkflow task={fundingTask} subtask={current} prerequisite={prerequisite} capabilities={capabilities} pending={data.pending} submissions={data.data.submissions} progressUpdates={data.data.progressUpdates} onSaved={reload} onReview={()=>reviewNode(itemId)} currentReviewerName={!data.pending&&node.status==='for_review'&&reviewerId?reviewersById[reviewerId]?.name:undefined}/></main>
   <section className="subitem-child-work"><SubitemChildWork itemId={itemId} controller={props.controller} readOnly={scopeReadOnly} executionBlocked={!!props.executionBlocked} onOpenItem={openItem} onReviewItem={reviewNode}/></section></div>
   {section==='activity'&&<section aria-label="Subitem activity"><h3>Activity</h3><WorkActivity roots={[props.rootTask.id]} focusedNode={{rootId:props.rootTask.id,nodeId:itemId}} snapshot={data.tree}/></section>}
  </div>
 </InspectorSurface>;
}
