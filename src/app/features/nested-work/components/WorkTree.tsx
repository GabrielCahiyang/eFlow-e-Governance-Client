import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {useWorkTree} from '../hooks/useWorkTree';
import {WorkTreeEditor,type WorkEdit} from './WorkTreeEditor';
import type {WorkNode,WorkRequest,WorkTreeSnapshot,WorkTreeController} from '../types';
import '../nestedWork.css';
import {readWorkDrafts} from '../services/workDraftStore';
import {requestNavigation} from '../../../shared/navigationGuard';
import {isCurrentWorkSnapshot,selectRootWorkCapability} from '../selectors/capabilities';
import {WorkHierarchy} from './WorkHierarchy';
import {descendantIds} from '../selectors/tree';
import {WorkActivity} from './WorkActivity';
import {WorkNodeReadSummary} from './WorkNodeReadSummary';
import type {WorkHierarchyAction} from '../types';
const draftLabels:Record<string,string>={create:'new subitem',edit:'details',move:'move',order:'sequence',delete:'deletion',progress:'progress',submit:'submission',review:'review'};
export interface WorkTreeProps {rootId:string;branchParentId?:string;branchActions?:boolean;controller?:WorkTreeController;fallback?:ReactNode;readOnly?:boolean;executionBlocked?:boolean;createRequest?:number;createFocusTarget?:HTMLElement;collapsedIds?:Set<string>;onCollapsedIdsChange?:(next:Set<string>)=>void;focusedNodeId?:string;onOpenOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void;onReviewOfficeNode?:(node:WorkNode,tree:WorkTreeSnapshot)=>void}
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
function WorkTreeContent({rootId,branchParentId,branchActions=false,fallback,readOnly=false,executionBlocked=false,createRequest=0,createFocusTarget,collapsedIds:controlledCollapsed,onCollapsedIdsChange,focusedNodeId,onOpenOfficeNode,onReviewOfficeNode,tree}:WorkTreeProps & {tree:WorkTreeController}){
 const {user}=useAuth();
 const [edit,setEdit]=useState<WorkEdit>(),[saved,setSaved]=useState('');
 const [localCollapsed,setLocalCollapsed]=useState(new Set<string>()),[opened,setOpened]=useState<string>(),[activity,setActivity]=useState(false);
 const collapsedIds=controlledCollapsed||localCollapsed;
 const setCollapsedIds=onCollapsedIdsChange||setLocalCollapsed;
 const section=useRef<HTMLElement>(null),createHandled=useRef(0),returnFocus=useRef<HTMLElement|null>(null);
 const data=tree.data;
 const branchIds=branchParentId&&data?descendantIds(data.nodes,branchParentId):undefined;
 const isBranchNode=(id:string)=>!branchIds||branchIds.has(id);

 useEffect(()=>{
  if(!createRequest||createHandled.current===createRequest)return;
  createHandled.current=createRequest;
  if(!data||!tree.authorityFresh||tree.pending)return;
  const allowed=selectRootWorkCapability(data,'create_child',{actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision,readOnly,executionBlocked}).allowed;
  if(allowed)void requestNavigation(()=>{returnFocus.current=createFocusTarget||null;setEdit({command:'create',parent:null});});
 },[createRequest,createFocusTarget,data,tree.authorityFresh,tree.pending,readOnly,executionBlocked,rootId,user?.id]);
 useEffect(()=>{if(edit){const frame=requestAnimationFrame(()=>section.current?.querySelector<HTMLInputElement>('.r7-form input:not([disabled]),.r7-form select:not([disabled]),.r7-form button:not([disabled])')?.focus());return()=>cancelAnimationFrame(frame);}},[edit]);
 const finish=()=>{setEdit(undefined);requestAnimationFrame(()=>returnFocus.current?.isConnected&&returnFocus.current.focus());};
 const openNode=(id:string)=>{const node=data?.nodes.find(item=>item.id===id);if(!node||!data||!isBranchNode(id))return;void requestNavigation(()=>{if(data.root.kind==='office'&&onOpenOfficeNode)onOpenOfficeNode(node,data);else setOpened(id);});};
 const action=(command:WorkHierarchyAction,id?:string)=>{
  if(command==='open'){if(id)openNode(id);return;}
  if(command==='activity'&&!branchParentId){void requestNavigation(()=>setActivity(true));return;}
  if(command==='activity'||branchParentId&&(id!==branchParentId&&!isBranchNode(id||'')||!id))return;
  if(!data||!tree.authorityFresh||tree.pending||readOnly)return;
  const node=data.nodes.find(item=>item.id===id);
  returnFocus.current=document.activeElement instanceof HTMLElement&&section.current?.contains(document.activeElement)?document.activeElement:(id?[...section.current?.querySelectorAll<HTMLElement>('[data-work-open]')||[]].find(element=>element.dataset.workOpen===id):section.current?.querySelector<HTMLElement>('[aria-label="Task work actions"]'))||null;
  void requestNavigation(()=>{if(command==='review'&&data.root.kind==='office'){if(node)onReviewOfficeNode?.(node,data);return;}
   setEdit({command,node:command==='create'||command==='order'?undefined:node,parent:command==='create'||command==='order'?id||null:undefined,root:command==='staff'&&!id});});
 };
 if(tree.unavailable)return <>{fallback}</>;
 const recovered=data&&tree.authorityFresh?readWorkDrafts(data,{actorId:user?.id||null,rootId,projectId:data.root.project,officeId:data.root.office,kind:data.root.kind,revision:data.revision}).filter(record=>!record.mode.startsWith('staffing')&&(!branchParentId||record.baseline.nodeId===branchParentId||record.baseline.fields.parent===branchParentId||isBranchNode(record.baseline.nodeId||record.baseline.fields.parent||''))):[];
 const save=async(request:WorkRequest)=>{const result=await tree.save(request);setSaved('Work saved.');return result;};
 return <section ref={section} className="r7-work" aria-label="Nested project work"><h3>{branchParentId?'Child work':'Subitems'}</h3><p className="r7-help">Subitems can contain further work. Work in sequence waits for earlier siblings; each subitem keeps its own review.</p>
  {tree.loading&&<p role="status">Loading subitems…</p>}{tree.error&&<p role="alert">{tree.error}<button type="button" onClick={()=>void tree.reload()}>Retry work</button></p>}{saved&&<p role="status">{saved}</p>}
  {data&&<>{!branchParentId&&<p>Subitems with no children: {data.leaf_completed}/{data.leaf_total} reviewed · Task progress is managed separately.</p>}
   {!edit&&recovered.map(record=><button type="button" key={`${record.mode}:${record.baseline.nodeId}:${record.baseline.fields.parent}:${record.baseline.revision}`} onClick={()=>void requestNavigation(()=>setEdit({command:record.baseline.command,itemId:record.baseline.nodeId||undefined,recoveryRevision:record.baseline.revision,node:data.nodes.find(node=>node.id===record.baseline.nodeId),parent:record.baseline.fields.parent||null}))}>Recover {draftLabels[record.baseline.command]||'work'} draft</button>)}
   <WorkHierarchy snapshot={data} readOnly={readOnly} executionBlocked={executionBlocked} authorityFresh={tree.authorityFresh&&!tree.pending&&!edit} focusedNodeId={focusedNodeId} branchParentId={branchParentId} branchActions={branchActions} officeReviewAvailable={!!onReviewOfficeNode}
    collapsedIds={collapsedIds} onCollapsedIdsChange={next=>{void requestNavigation(()=>setCollapsedIds(next));}} onOpenNode={openNode} onRequestAction={action}/>
   {opened&&data.nodes.some(node=>node.id===opened)&&<WorkNodeReadSummary node={data.nodes.find(node=>node.id===opened)!} snapshot={data} onClose={()=>setOpened(undefined)}/>}
   {activity&&<aside aria-label="Task work activity"><h4>Task work activity</h4><p>Work changes for this task and its subitems.</p><WorkActivity roots={[rootId]}/><button type="button" onClick={()=>setActivity(false)}>Close activity</button></aside>}
   {edit&&<WorkTreeEditor key={`${edit.command}:${edit.node?.id||edit.itemId}:${edit.parent}`} data={data} edit={edit} save={save} readOnly={readOnly||executionBlocked&&['progress','submit'].includes(edit.command)} refreshPending={tree.refreshPending||tree.pending||!tree.authorityFresh} onDone={finish} onCancel={()=>{finish();void tree.reload();}}/>}
  </>}
 </section>;
}
