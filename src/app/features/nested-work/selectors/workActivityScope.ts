import type {WorkEvent} from '../services/workTreeService';
import type {WorkTreeSnapshot} from '../types';
import {descendantIds} from './tree';

export interface WorkActivityFocus {rootId:string;nodeId:string}
/** Read-only projection of server-authorized events. No current path rewrites history. */
export function selectFocusedWorkEvents(events:readonly WorkEvent[],focus:WorkActivityFocus,current:WorkTreeSnapshot):{event:WorkEvent;title:string}[]{
 if(current.root.id!==focus.rootId||!current.nodes.some(node=>node.id===focus.nodeId&&node.task_id===focus.rootId))return [];
 const relevant=(snapshot:WorkTreeSnapshot|undefined)=>{
  if(!snapshot||snapshot.root?.id!==focus.rootId||snapshot.root.project!==current.root.project||snapshot.root.office!==current.root.office||snapshot.root.kind!==current.root.kind||!Array.isArray(snapshot.nodes)||!snapshot.nodes.some(node=>node.id===focus.nodeId&&node.task_id===focus.rootId))return undefined;
  const nodes=snapshot.nodes.filter(node=>node.task_id===focus.rootId);
  return {snapshot:{...snapshot,nodes},ids:new Set([focus.nodeId,...descendantIds(nodes,focus.nodeId)])};
 };
 return events.flatMap(event=>{
  if(event.root_id!==focus.rootId)return [];
  const before=relevant(event.before_data),after=relevant(event.after_data);
  if(event.node_id){
   const context=after?.ids.has(event.node_id)?after:before?.ids.has(event.node_id)?before:undefined;
   const node=context?.snapshot.nodes.find(node=>node.id===event.node_id&&node.task_id===focus.rootId);
   return node?[{event,title:node.title}]:[];
  }
  // Existing order events identify their parent in the payload, not node_id.
  // Include only a changed selected-branch position; omit root staffing events.
  if(event.command!=='order'||!before||!after)return [];
  const changed=after.snapshot.nodes.some(node=>after.ids.has(node.id)&&before.ids.has(node.id)&&before.snapshot.nodes.some(old=>old.id===node.id&&old.sibling_order!==node.sibling_order));
  const node=after.snapshot.nodes.find(node=>node.id===focus.nodeId);
  return changed&&node?[{event,title:node.title}]:[];
 });
}
