import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkTreeEditor,type WorkEdit} from './WorkTreeEditor';
import type {WorkNode,WorkRequest,WorkTreeSnapshot,WorkTreeController} from '../types';
import '../nestedWork.css';
import {readWorkDrafts} from '../services/workDraftStore';
import { InlineCreateRejected, type InlineCreateRequest } from '../../../components/ui/workspace';
import { duplicateWorkNameError } from '../../../shared/workNames';
import { workRequestFailure } from '../services/workRequestOutcome';
import {requestNavigation} from '../../../shared/navigationGuard';
import {getPhilippineCalendarDate} from '../../../shared/calendarDates';
import {isCurrentWorkSnapshot,selectRootWorkCapability} from '../selectors/capabilities';
import {WorkHierarchy} from './WorkHierarchy';
import {descendantIds} from '../selectors/tree';
import {WorkActivity} from './WorkActivity';
import {WorkNodeReadSummary} from './WorkNodeReadSummary';
import type {Task} from '../../tasks';
import type {WorkHierarchyAction} from '../types';
const draftLabels:Record<string,string>={create:'new subtask',edit:'details',move:'move',order:'sequence',delete:'deletion',progress:'progress',submit:'submission',review:'review'};
export interface WorkTreeProps {rootId:string;branchParentId?:string;branchActions?:boolean;presentation?:'standard'|'project-table';parentTask?:Task;parentTitle?:string;parentStartDate?:string;controller?:WorkTreeController;fallback?:ReactNode;readOnly?:boolean;executionBlocked?:boolean;createRequest?:number;createFocusTarget?:HTMLElement;collapsedIds?:Set<string>;onCollapsedIdsChange?:(next:Set<string>)=>void;focusedNodeId?:string;onOpenOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void;onReviewOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void}
export function WorkTree(props:WorkTreeProps){
 const {user}=useAuth(),key=JSON.stringify([user?.id,props.rootId]);
 if(props.controller){
  if(props.controller.rootId!==props.rootId||props.controller.actorId!==(user?.id||null)||props.controller.data&&props.controller.data.root.id!==props.rootId)return <>{props.fallback}</>;
  const data=props.controller.data;
  if(data&&!isCurrentWorkSnapshot(data,{actorId:props.controller.actorId,rootId:props.rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision}))return <>{props.fallback}</>;
  return <WorkTreeContent key={key} {...props} tree={props.controller}/>;
 }
 return <ConnectedWorkTree key={key} {...props}/>;
}
function ConnectedWorkTree(props:WorkTreeProps){const tree=useWorkTree(props.rootId);return <WorkTreeContent {...props} tree={tree}/>;}
function WorkTreeContent({rootId,branchParentId,branchActions=false,presentation='standard',parentTask,parentTitle,parentStartDate,fallback,readOnly=false,executionBlocked=false,createRequest=0,createFocusTarget,collapsedIds:controlledCollapsed,onCollapsedIdsChange,focusedNodeId,onOpenOfficeNode,onReviewOfficeNode,tree}:WorkTreeProps & {tree:WorkTreeController}){
 const {user}=useAuth();
 const [edit,setEdit]=useState<WorkEdit>(),[saved,setSaved]=useState('');
 const [localCollapsed,setLocalCollapsed]=useState(new Set<string>()),[opened,setOpened]=useState<string>(),[activity,setActivity]=useState(false);
 const collapsedIds=controlledCollapsed||localCollapsed;
 const setCollapsedIds=onCollapsedIdsChange||setLocalCollapsed;
 const section=useRef<HTMLElement>(null),createHandled=useRef(0),returnFocus=useRef<HTMLElement|null>(null);
 const waitingForFocus=useRef(false);
 const inlineCreateTerms=useRef(new Map<string,{createdId:string;revision:number}>());
 const data=tree.data;
 const branchIds=branchParentId&&data?descendantIds(data.nodes,branchParentId):undefined;
 const isBranchNode=(id:string)=>!branchIds||branchIds.has(id);

 useEffect(()=>{
  if(!createRequest||createHandled.current===createRequest)return;
  createHandled.current=createRequest;
  if(!data||!tree.authorityFresh||tree.pending)return;
  const allowed=selectRootWorkCapability(data,'create_child',{actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly,executionBlocked}).allowed;
  if(!allowed)return;
  if(presentation==='project-table'){
   returnFocus.current=createFocusTarget||null;
   requestAnimationFrame(()=>section.current?.querySelector<HTMLInputElement>('.pt-inline-create__title')?.focus());
   return;
  }
  void requestNavigation(()=>{returnFocus.current=createFocusTarget||null;setEdit({command:'create',parent:null});});
 },[createRequest,createFocusTarget,data,presentation,tree.authorityFresh,tree.pending,readOnly,executionBlocked,rootId,user?.id]);
 useLayoutEffect(()=>{
  if(!edit)return;
  const form=section.current?.querySelector<HTMLFormElement>('.r7-form'),entryFocus=document.activeElement;
  const focusEditor=()=>{
   if(!form?.isConnected)return;
   const active=document.activeElement;
   // Entry must precede typing; its fallback must not take focus from a
   // selected field or a newer dialog/menu that now owns the interaction.
   if(form.contains(active)||active!==entryFocus&&active?.closest('[role="dialog"],[role="alertdialog"],[role="menu"]'))return;
   form.querySelector<HTMLElement>('input:not([disabled]),select:not([disabled]),button:not([disabled])')?.focus();
  };
  focusEditor();
  const frame=requestAnimationFrame(focusEditor);return()=>cancelAnimationFrame(frame);
 },[edit]);
 const finish=()=>{setEdit(undefined);requestAnimationFrame(()=>{const opener=returnFocus.current;if(opener?.isConnected&&!(opener instanceof HTMLButtonElement&&opener.disabled)){opener.focus();return;}if(presentation==='project-table'){waitingForFocus.current=true;section.current?.focus();}});};
 useEffect(()=>{if(!waitingForFocus.current||edit||!tree.authorityFresh)return;waitingForFocus.current=false;const opener=returnFocus.current;if(document.activeElement===section.current&&opener?.isConnected&&!(opener instanceof HTMLButtonElement&&opener.disabled))opener.focus();},[tree.authorityFresh,edit,data]);
 const openNode=(id:string)=>{const node=data?.nodes.find(item=>item.id===id);if(!node||!data||!isBranchNode(id))return;void requestNavigation(()=>{if(data.root.kind==='office'&&onOpenOfficeNode)onOpenOfficeNode(node,data);else setOpened(id);});};
 const action=(command:WorkHierarchyAction,id?:string)=>{
  if(command==='open'){if(id)openNode(id);return;}
  if(command==='activity'&&!branchParentId){void requestNavigation(()=>setActivity(true));return;}
  if(command==='activity'||branchParentId&&(id!==branchParentId&&!isBranchNode(id||'')||!id))return;
  if(!data||!tree.authorityFresh||tree.pending||readOnly)return;
  if(data.root.project&&(command==='move'||id&&(command==='create'||command==='order')))return;
  if(presentation==='project-table'&&command==='create'&&!id){
   requestAnimationFrame(()=>section.current?.querySelector<HTMLInputElement>('.pt-inline-create__title')?.focus());
   return;
  }
  const node=data.nodes.find(item=>item.id===id);
  returnFocus.current=document.activeElement instanceof HTMLElement&&section.current?.contains(document.activeElement)?document.activeElement:(id?[...section.current?.querySelectorAll<HTMLElement>('[data-work-open]')||[]].find(element=>element.dataset.workOpen===id):section.current?.querySelector<HTMLElement>('[aria-label="Task work actions"]'))||null;
  void requestNavigation(()=>{if(command==='review'&&data.root.kind==='office'){if(node)onReviewOfficeNode?.(node,data);return;}
   setEdit({command,node:command==='create'||command==='order'?undefined:node,parent:command==='create'||command==='order'?id||null:undefined,root:command==='staff'&&!id});});
 };
 if(tree.unavailable)return <>{fallback}</>;
 const recovered=data&&tree.authorityFresh?readWorkDrafts(data,{actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision}).filter(record=>{
  const {command,fields,nodeId}=record.baseline;
  if(record.mode.startsWith('staffing')||data.root.project&&(command==='move'||fields.parent&&(command==='create'||command==='order')))return false;
  return !branchParentId||nodeId===branchParentId||fields.parent===branchParentId||isBranchNode(nodeId||fields.parent||'');
 }):[];
 const save=async(request:WorkRequest)=>{const result=await tree.save(request);setSaved('Work saved.');return result;};
 const onCreateInline=presentation==='project-table'?async(title:string,request:InlineCreateRequest)=>{
  if(!data||!tree.authorityFresh||readOnly)throw new InlineCreateRejected('Verify current work access before adding a subtask.');
  if(!request.verifyFirst){
   const issue=duplicateWorkNameError(title,data.nodes.filter(node=>(node.parent_subtask_id||'')===(branchParentId||'')),'Subitem');
   if(issue)throw new InlineCreateRejected(issue);
  }
  const parentNode=branchParentId?data.nodes.find(node=>node.id===branchParentId):undefined;
  const defaultDue=(parentNode?.due_date||data.root.due||parentTask?.deadline||parentTask?.dueDate||'').slice(0,10)||null;
  const rawStart=(parentNode?.start_date||parentStartDate||parentTask?.startDate||'').slice(0,10);
  const effectiveToday=data.root.scheduling?.today||(defaultDue?getPhilippineCalendarDate():'');
  const defaultStart=rawStart
   ?(defaultDue&&rawStart>defaultDue?defaultDue:rawStart)
   :(effectiveToday&&(defaultDue?effectiveToday<=defaultDue:true)?effectiveToday:defaultDue)||null;
  let terms=inlineCreateTerms.current.get(request.id);
  if(!terms){terms={createdId:crypto.randomUUID(),revision:data.revision};inlineCreateTerms.current.set(request.id,terms);}
  try{
   await save({id:request.id,command:'create',revision:terms.revision,payload:{id:terms.createdId,title,parent:branchParentId||null,lead:null,people:[],due:defaultDue,...(defaultStart?{start:defaultStart}:{}),standalone:false}});
   inlineCreateTerms.current.delete(request.id);
  }catch(reason){
   const failure=workRequestFailure(reason);
   if(failure.kind==='confirmed_failure'||!request.verifyFirst&&['stale_revision','revoked_authority'].includes(failure.kind)){
    inlineCreateTerms.current.delete(request.id);
    if(failure.kind!=='confirmed_failure')void tree.reload();
    if(failure.kind==='confirmed_failure'&&(!rawStart||!defaultDue)&&/schedule|start date|due date/i.test(failure.message)){
     throw new InlineCreateRejected(`${failure.message} Set start and due dates on the parent task first if they are missing.`);
    }
    throw new InlineCreateRejected(failure.message);
   }
   throw new Error(failure.message);
  }
 }:undefined;
 const onRenameNode=presentation==='project-table'?async(node:WorkNode,nextTitle:string)=>{
  if(!data||!tree.authorityFresh||readOnly)throw new Error('Verify current work access before renaming a subtask.');
  const issue=duplicateWorkNameError(nextTitle,data.nodes.filter(item=>(item.parent_subtask_id||'')===(node.parent_subtask_id||'')),'Subitem',node.id);
  if(issue)throw new Error(issue);
  await save({id:crypto.randomUUID(),command:'edit',revision:data.revision,payload:{id:node.id,title:nextTitle,due:node.due_date||null,standalone:node.is_standalone,note:''}});
 }:undefined;
 const heading=presentation==='standard'?<div className="nw-work-heading"><div><h3>{branchParentId?'Child work':'Subtasks'}</h3><p>Steps managed by the task lead.</p></div>{data&&!branchParentId&&data.leaf_total>0&&<span className="nw-work-approved">{data.leaf_completed}/{data.leaf_total} steps complete</span>}</div>:undefined;
 return <section ref={section} tabIndex={presentation==='project-table'?-1:undefined} className={`r7-work${presentation==='project-table'?' r7-work--project-table':''}`} data-work-presentation={presentation} aria-label="Nested project work">{!data&&heading}
  {tree.loading&&!data&&<p role="status">Loading subtasks…</p>}{tree.error&&<p role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry work</button></p>}{saved&&<p role="status">{saved}</p>}
  {data&&<>
   {!edit&&recovered.map(record=><button type="button" key={`${record.mode}:${record.baseline.nodeId}:${record.baseline.fields.parent}:${record.baseline.revision}`} onClick={()=>void requestNavigation(()=>setEdit({command:record.baseline.command,itemId:record.baseline.nodeId||undefined,recoveryRevision:record.baseline.revision,node:data.nodes.find(node=>node.id===record.baseline.nodeId),parent:record.baseline.fields.parent||null}))}>Recover {draftLabels[record.baseline.command]||'work'} draft</button>)}
   <WorkHierarchy heading={heading} presentation={presentation} snapshot={data} readOnly={readOnly} executionBlocked={executionBlocked} authorityFresh={tree.authorityFresh&&!tree.pending&&!edit} focusedNodeId={focusedNodeId} branchParentId={branchParentId} branchActions={branchActions} officeReviewAvailable={!!onReviewOfficeNode} controller={{...tree,save}} parentTask={parentTask} parentTitle={parentTitle} parentStartDate={parentStartDate} onCreateInline={onCreateInline} onRenameNode={onRenameNode}
    collapsedIds={collapsedIds} onCollapsedIdsChange={next=>{void requestNavigation(()=>setCollapsedIds(next));}} onOpenNode={openNode} onRequestAction={action}/>
   {opened&&data.nodes.some(node=>node.id===opened)&&<WorkNodeReadSummary node={data.nodes.find(node=>node.id===opened)!} snapshot={data} onClose={()=>setOpened(undefined)}/>}
   {activity&&<aside aria-label="Task work activity"><h4>Task work activity</h4><p>Work changes for this task and its subtasks.</p><WorkActivity roots={[rootId]}/><button type="button" onClick={()=>setActivity(false)}>Close activity</button></aside>}
   {edit&&<WorkTreeEditor key={`${edit.command}:${edit.node?.id||edit.itemId}:${edit.parent}`} data={data} edit={edit} save={save} reload={tree.reload} readOnly={readOnly||executionBlocked&&['progress','submit'].includes(edit.command)} refreshPending={tree.refreshPending||tree.pending||!tree.authorityFresh} onDone={finish} onCancel={()=>{finish();void tree.reload();}}/>}
  </>}
 </section>;
}
