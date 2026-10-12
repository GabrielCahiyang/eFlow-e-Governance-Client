import type {WorkEvent} from '../services/workTreeService';
import type {WorkNode,WorkTreeSnapshot} from '../types';
import {buildWorkDisplayTree} from './displayTree';
import {descendantIds} from './tree';
import type {WorkActivityFocus} from './workActivityScope';

export interface WorkEventPresentation {title:string;detail:string}
const labels:Record<string,string>={create:'Subitem created',staff:'Subitem people updated',root_lead:'Task Lead transferred',contributors:'Task contributors updated',edit:'Subitem details updated',move:'Subitem moved',order:'Subitems reordered',delete:'Subitem deleted',progress:'Subitem progress recorded',submit:'Subitem submitted for review',review:'Subitem review recorded'};
const statuses:Record<string,string>={todo:'To do',in_progress:'In progress',for_review:'For review',changes_requested:'Changes requested',completed:'Completed'};
export function workEventTitle(command:string):string{return labels[command]||'Work change recorded';}
/** Validate transport identity independently from optional historical context. */
export function isWorkEventRecord(value:unknown):value is WorkEvent {
 if(!value||typeof value!=='object')return false;
 const row=value as Record<string,unknown>;
 return typeof row.id==='string'&&!!row.id&&typeof row.root_id==='string'&&!!row.root_id&&(row.node_id===null||typeof row.node_id==='string'&&!!row.node_id)&&typeof row.command==='string'&&typeof row.actor_name==='string'&&typeof row.occurred_at==='string'&&Number.isFinite(Date.parse(row.occurred_at));
}

/** Recorded snapshots only: no current tree, profile lookup, or authority inference. */
export function presentWorkEvent(event:WorkEvent,focus?:WorkActivityFocus):WorkEventPresentation {
 const valid=(snapshot:WorkTreeSnapshot|undefined)=>snapshot?.root?.id===event.root_id&&typeof snapshot.root.project==='string'&&(snapshot.root.office===null||typeof snapshot.root.office==='string')&&['office','personal'].includes(snapshot.root.kind)&&Array.isArray(snapshot.nodes)?snapshot:undefined;
 let before=valid(event.before_data),after=valid(event.after_data);
 // Never combine histories from different Office/project/kind contexts.
 if(before&&after&&(before.root.project!==after.root.project||before.root.office!==after.root.office||before.root.kind!==after.root.kind))before=after=undefined;
 const nodes=(snapshot:WorkTreeSnapshot|undefined)=>snapshot?.nodes.filter(node=>node&&node.task_id===event.root_id&&typeof node.id==='string'&&typeof node.title==='string'&&(node.parent_subtask_id===null||typeof node.parent_subtask_id==='string')&&Number.isFinite(node.sibling_order)&&Array.isArray(node.assigned_to_ids))||[];
 const old=nodes(before).find(node=>node.id===event.node_id),next=nodes(after).find(node=>node.id===event.node_id);
 const path=(snapshot:WorkTreeSnapshot|undefined,id:string)=>buildWorkDisplayTree(nodes(snapshot)).find(row=>row.id===id)?.pathLabel||'Historical path unavailable';
 const person=(snapshot:WorkTreeSnapshot|undefined,id:string|null)=>!snapshot?'Historical name unavailable':id?(Array.isArray(snapshot.people)?snapshot.people.find(person=>person&&person.id===id)?.name:undefined)||'Historical name unavailable':'No Lead';
 const people=(snapshot:WorkTreeSnapshot|undefined,ids:readonly string[],lead:string|null)=>!snapshot?'Historical contributors unavailable':[...new Set(ids)].filter(id=>id!==lead).map(id=>person(snapshot,id)).join(', ')||'No contributors';
 const details:string[]=[];
 if(event.node_id){
  if(old&&next&&path(before,event.node_id)!==path(after,event.node_id))details.push(`Path: ${path(before,event.node_id)} → ${path(after,event.node_id)}`);
  else details.push(`Path: ${path(next?after:before,event.node_id)}`);
 }else if(event.command!=='order')details.push('Root task people');
 const staffing=(previous:WorkNode|undefined,current:WorkNode|undefined)=>{
  if(!previous&&!current)return;
  if(previous?.lead_id!==current?.lead_id||event.command==='create')details.push(`Lead: ${person(before,previous?.lead_id||null)} → ${person(after,current?.lead_id||null)}`);
  const ids=(node:WorkNode|undefined)=>[...new Set(node?.assigned_to_ids||[])].filter(id=>id!==node?.lead_id).sort();
  if(JSON.stringify(ids(previous))!==JSON.stringify(ids(current))||event.command==='create')details.push(`Contributors: ${people(before,previous?.assigned_to_ids||[],previous?.lead_id||null)} → ${people(after,current?.assigned_to_ids||[],current?.lead_id||null)}`);
 };
 let title=workEventTitle(event.command);
 if(event.command==='staff'||event.command==='create'){
  staffing(old,next);
  if(event.command==='staff'&&old&&next&&old.lead_id!==next.lead_id)title='Subitem Lead transferred';
  if(event.command==='staff'&&old&&next){
   const descendants=descendantIds(nodes(before),old.id);
   for(const previous of nodes(before).filter(node=>descendants.has(node.id))){
    const current=nodes(after).find(node=>node.id===previous.id);
    if(current&&previous.lead_id!==current.lead_id)details.push(`${path(before,previous.id)} · Lead: ${person(before,previous.lead_id)} → ${person(after,current.lead_id)}`);
   }
  }
 }
 if(event.command==='root_lead'){
  details.push(`Lead: ${person(before,before?.root.lead||null)} → ${person(after,after?.root.lead||null)}`);
  // A governed transfer can reset descendant appointments. Record those changes too.
  for(const previous of nodes(before)){
   const current=nodes(after).find(node=>node.id===previous.id);
   if(current&&previous.lead_id!==current.lead_id)details.push(`${path(before,previous.id)} · Lead: ${person(before,previous.lead_id)} → ${person(after,current.lead_id)}`);
  }
 }
 if(event.command==='contributors'||event.command==='root_lead'){
  if(event.command==='contributors'||JSON.stringify(before?.root.people)!==JSON.stringify(after?.root.people))details.push(`Contributors: ${people(before,before?.root.people||[],before?.root.lead||null)} → ${people(after,after?.root.people||[],after?.root.lead||null)}`);
 }
 if(event.command==='edit'||event.command==='create'){
  if(next&&(event.command==='create'||old?.title!==next.title))details.push(`Title: ${old?.title||'Not yet created'} → ${next.title}`);
  if(next&&(event.command==='create'||old?.due_date!==next.due_date))details.push(`Deadline: ${old?.due_date||'No deadline'} → ${next.due_date||'No deadline'}`);
  if(old&&next&&old.is_standalone!==next.is_standalone)details.push(`Sequencing: ${old.is_standalone?'Independent':'Sequential'} → ${next.is_standalone?'Independent':'Sequential'}`);
 }
 if(event.command==='order'){
  const branch=(snapshot:WorkTreeSnapshot|undefined)=>!focus?null:new Set([focus.nodeId,...descendantIds(nodes(snapshot),focus.nodeId)]);
  const priorBranch=branch(before),nextBranch=branch(after);
  for(const current of nodes(after)){
   const previous=nodes(before).find(node=>node.id===current.id);
   if(previous&&previous.sibling_order!==current.sibling_order&&(!focus||priorBranch?.has(current.id)&&nextBranch?.has(current.id)))details.push(`${path(after,current.id)} · Position: ${previous.sibling_order+1} → ${current.sibling_order+1}`);
  }
 }
 if(event.command==='delete'&&old){
  details.push(`Removed ${1+descendantIds(nodes(before),old.id).size} subitem(s)`);
  details.push(`Lead: ${person(before,old.lead_id)}; Contributors: ${people(before,old.assigned_to_ids,old.lead_id)}`);
 }
 if(event.command==='progress'&&next)details.push(`Progress: ${old?`${old.percent_complete}%`:'Unavailable'} → ${next.percent_complete}%`);
 if((event.command==='review'||event.command==='submit')&&next)details.push(`Status: ${old?statuses[old.status]||'Unavailable':'Unavailable'} → ${statuses[next.status]||'Unavailable'}`);
 return {title,detail:details.join(' · ')||'Historical changed fields unavailable'};
}
