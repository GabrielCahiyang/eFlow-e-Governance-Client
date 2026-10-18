import { EmptyState } from '../../../components/ui/EmptyState';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import type {WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';
import {isCurrentWorkSnapshot,selectNodeWorkCapability,selectRootWorkCapability} from '../selectors/capabilities';
import {selectWorkDisplayTree} from '../selectors/displayTree';
import {descendantIds} from '../selectors/tree';
import type {NodeWorkAction,RootWorkAction,WorkHierarchyAction,WorkTreeSnapshot} from '../types';
import {WorkTreeTable} from './WorkTreeTable';
import {WorkTreeMobileList} from './WorkTreeMobileList';
import {WorkNodeActionMenu} from './WorkNodeActionMenu';
import type {WorkHierarchyRow} from './WorkNodePresentation';
import '../workHierarchy.css';

export interface WorkHierarchyProps {
 snapshot:WorkTreeSnapshot;readOnly:boolean;executionBlocked:boolean;authorityFresh:boolean;focusedNodeId?:string;
 collapsedIds:Set<string>;onCollapsedIdsChange:(next:Set<string>)=>void;onOpenNode:(nodeId:string)=>void;
 onRequestAction:(action:WorkHierarchyAction,nodeId?:string)=>void;
 officeReviewAvailable?:boolean;
 /** Display descendants of this canonical parent using the complete snapshot. */
 branchParentId?:string;
 branchActions?:boolean;
 presentation?:'standard'|'project-table';
}
const mobileQuery='(max-width: 639px)';
/** Presentation only: one supplied authorized snapshot, no tree/service ownership. */
export function WorkHierarchy({snapshot,readOnly,executionBlocked,authorityFresh,focusedNodeId,collapsedIds,onCollapsedIdsChange,onOpenNode,onRequestAction,officeReviewAvailable=true,branchParentId,branchActions=false,presentation='standard'}:WorkHierarchyProps) {
 const {user}=useAuth();
 const context={actorId:user?.id||null,rootId:snapshot.root.id,projectId:snapshot.root.project,officeId:snapshot.root.office,kind:snapshot.root.kind,revision:snapshot.revision,readOnly,executionBlocked};
 const snapshotCurrent=isCurrentWorkSnapshot(snapshot,context);
 const [mobile,setMobile]=useState(()=>typeof window.matchMedia==='function'&&window.matchMedia(mobileQuery).matches);
 useEffect(()=>{if(typeof window.matchMedia!=='function')return;const query=window.matchMedia(mobileQuery),change=()=>setMobile(query.matches);change();query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 const display=useMemo(()=>selectWorkDisplayTree(snapshotCurrent?snapshot.nodes:[],collapsedIds,focusedNodeId),[snapshot.nodes,snapshotCurrent,collapsedIds,focusedNodeId]);
 useEffect(()=>{if(display.collapsedIds.size!==collapsedIds.size||[...display.collapsedIds].some(id=>!collapsedIds.has(id)))onCollapsedIdsChange(new Set(display.collapsedIds));},[display.collapsedIds,collapsedIds,onCollapsedIdsChange]);
 const section=useRef<HTMLElement>(null),lastFocus=useRef('');
 useEffect(()=>{
  const key=JSON.stringify([snapshot.root.id,focusedNodeId]);
  if(!focusedNodeId){lastFocus.current='';return;}
  if(lastFocus.current===key)return;
  const target=[...section.current?.querySelectorAll<HTMLElement>('[data-work-open]')||[]].find(element=>element.dataset.workOpen===focusedNodeId);
  if(target){target.focus();target.scrollIntoView?.({block:'nearest'});lastFocus.current=key;}
 },[snapshot.root.id,focusedNodeId,display.rows,mobile]);
 function actionsFor(nodeId?:string):WorkspaceAction[] {
  const node=nodeId?snapshot.nodes.find(item=>item.id===nodeId):undefined;
  const actions:WorkspaceAction[]=node?[
   {id:'open',label:snapshot.root.kind==='office'?'Open work / evidence':'Open work',onSelect:()=>onOpenNode(node.id)},
   ...(!branchParentId?[{id:'activity',label:'Activity',onSelect:()=>onRequestAction('activity',node.id)}]:[]),
  ]:[];
  const allowed=(capability:NodeWorkAction)=>node?selectNodeWorkCapability(snapshot,node.id,capability,context).allowed:selectRootWorkCapability(snapshot,capability as RootWorkAction,context).allowed;
  const add=(action:WorkHierarchyAction,label:string,capabilities:NodeWorkAction[])=>{
   if(!capabilities.some(allowed))return;
   actions.push({id:action,label,variant:action==='delete'?'destructive':'default',disabled:!authorityFresh,
    disabledReason:!authorityFresh?'Verify current work access before making changes.':undefined,
    // Recheck at selection; callers also use controller.save's current identity guard.
    onSelect:()=>{if(authorityFresh&&capabilities.some(allowed))onRequestAction(action,nodeId);}});
  };
  add('staff','Choose people',['manage_contributors','appoint_lead']);
  add('create','Add subitem',['create_child']);
  // nodeId names the parent. No displayed/filtered IDs are sent as an order list.
  add('order','Reorder children',['order_children']);
  if(node){
   add('edit','Edit details',['edit_details']);add('move','Move',['move']);add('delete','Delete subtree',['delete']);
   if(snapshot.root.kind==='personal'){add('progress','Update progress',['execute']);add('submit','Submit for review',['submit']);}
   if(snapshot.root.kind==='personal'||officeReviewAvailable)add('review','Review',['review']);
  }
  return actions;
 }
 const byId=new Map(snapshot.nodes.map(node=>[node.id,node]));
 const branch=branchParentId?descendantIds(snapshot.nodes,branchParentId):undefined;
 const rows:WorkHierarchyRow[]=display.rows.filter(row=>!branch||branch.has(row.id)).map(row=>({node:byId.get(row.id)!,display:row,actions:actionsFor(row.id)}));
 const toggle=(nodeId:string)=>{const next=new Set(display.collapsedIds);if(next.has(nodeId))next.delete(nodeId);else next.add(nodeId);onCollapsedIdsChange(next);};
 const props={rows,people:snapshot.people,collapsedIds:display.collapsedIds,focusedNodeId,onToggle:toggle,onOpenNode};
 if(!snapshotCurrent||branchParentId&&!byId.has(branchParentId))return <section className="nw-hierarchy" aria-label="Subitem work"><p role="alert">Verify current work access. Reload the work.</p></section>;
 return <section ref={section} className="nw-hierarchy" aria-label="Subitem work">
  <div className="nw-hierarchy-toolbar"><WorkNodeActionMenu compact={presentation==='project-table'} label={branchParentId?'Child work actions':'Task work actions'} actions={actionsFor(branchParentId).filter(action=>!branchParentId||(branchActions?!['open','review'].includes(action.id):['create','order'].includes(action.id)))}/></div>
  {presentation==='project-table'?<WorkTreeTable {...props} tableSurface createAction={actionsFor(branchParentId).find(action=>action.id==='create')}/>:!rows.length?<EmptyState illustration="tasks" size="compact" title="No subitems yet."/>:mobile?<WorkTreeMobileList {...props}/>:<WorkTreeTable {...props}/>}
 </section>;
}
