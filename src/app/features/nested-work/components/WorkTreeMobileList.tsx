import {WorkPeopleSummary} from './WorkPeopleSummary';
import {WorkNodeActionMenu} from './WorkNodeActionMenu';
import {WorkNodeTitle,WorkNodeStatus,WorkNodeDue,WorkNodeProgress,type WorkTreeRowsProps} from './WorkNodePresentation';

export function WorkTreeMobileList({rows,people,collapsedIds,focusedNodeId,onToggle,onOpenNode}:WorkTreeRowsProps) {
 return <ul className="nw-hierarchy-mobile" aria-label="Subitem hierarchy">{rows.map(row=><li key={row.node.id} data-work-row={row.node.id} data-selected-work={row.node.id===focusedNodeId||undefined}>
  <WorkNodeTitle row={row} collapsed={collapsedIds.has(row.node.id)} onToggle={()=>onToggle(row.node.id)} onOpenNode={()=>onOpenNode(row.node.id)}/>
  <WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact/>
  <div className="nw-hierarchy-mobile-meta"><WorkNodeStatus node={row.node}/><span>Due: <WorkNodeDue node={row.node}/></span></div>
  <WorkNodeProgress node={row.node}/><WorkNodeActionMenu label={`Actions for ${row.node.title}`} actions={row.actions}/>
 </li>)}</ul>;
}
