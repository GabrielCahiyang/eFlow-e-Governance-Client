import type {CSSProperties} from 'react';
import {ProgressBar,formatDate} from '../../../components/workflow/primitives';
import {StatusPill} from '../../../components/ui/workspace/StatusPill';
import type {WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';
import type {WorkDisplayRow} from '../selectors/displayTree';
import type {WorkNode,WorkPerson} from '../types';

export interface WorkHierarchyRow {node:WorkNode;display:WorkDisplayRow;actions:WorkspaceAction[]}
export interface WorkTreeRowsProps {
 rows:WorkHierarchyRow[];people:readonly WorkPerson[];collapsedIds:ReadonlySet<string>;focusedNodeId?:string;
 onToggle:(nodeId:string)=>void;onOpenNode:(nodeId:string)=>void;
}
export function WorkNodeTitle({row,collapsed,onToggle,onOpenNode}:{row:WorkHierarchyRow;collapsed:boolean;onToggle:()=>void;onOpenNode:()=>void}) {
 const {display,node}=row;
 return <div className="nw-hierarchy-title" style={{'--nw-indent':display.indentLevel} as CSSProperties}>
  <div className="nw-hierarchy-title-line">
   {display.hasChildren?<button type="button" className="nw-hierarchy-control nw-hierarchy-disclosure" aria-label={`${collapsed?'Expand':'Collapse'} children of ${node.title}`} aria-expanded={!collapsed} onClick={onToggle}><span aria-hidden="true">{collapsed?'▸':'▾'}</span></button>:<span className="nw-hierarchy-leaf" aria-hidden="true"/>}
   <button type="button" className="nw-hierarchy-open" title={display.pathLabel} data-work-open={node.id} onClick={onOpenNode}>{node.title}</button>
  </div>
  <p className="nw-hierarchy-path" aria-label={`Path for ${node.title}`}>{display.pathLabel}</p>
  {display.context&&<p className="nw-hierarchy-context">{display.context==='missing_parent'?'Parent context unavailable':'Hierarchy context incomplete'}</p>}
 </div>;
}
const statuses={todo:{label:'To do',tone:'neutral'},in_progress:{label:'In progress',tone:'info'},for_review:{label:'For review',tone:'warning'},changes_requested:{label:'Changes requested',tone:'negative'},completed:{label:'Completed',tone:'positive'}} as const;
export function WorkNodeStatus({node}:{node:WorkNode}){return <StatusPill {...statuses[node.status]}/>;}
export function WorkNodeDue({node}:{node:WorkNode}){return node.due_date?<time dateTime={node.due_date}>{formatDate(node.due_date)}</time>:<span>No due date</span>;}
export function WorkNodeProgress({node}:{node:WorkNode}){return <div className="nw-hierarchy-progress" role="group" aria-label={`Progress for ${node.title}`}><ProgressBar value={node.percent_complete}/></div>;}
