import {WorkPeopleSummary} from './WorkPeopleSummary';
import {WorkNodeActionMenu} from './WorkNodeActionMenu';
import {WorkNodeTitle,WorkNodeStatus,WorkNodeDue,WorkNodeProgress,type WorkTreeRowsProps} from './WorkNodePresentation';

export function WorkTreeTable({rows,people,collapsedIds,focusedNodeId,onToggle,onOpenNode}:WorkTreeRowsProps) {
 return <div className="nw-hierarchy-table-scroll"><table className="nw-hierarchy-table">
  <caption className="sr-only">Subitem hierarchy</caption>
  <thead><tr>{['Subitem','Lead','Contributors','Status','Due','Progress','Actions'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
  <tbody>{rows.map(row=><tr key={row.node.id} data-work-row={row.node.id} data-selected-work={row.node.id===focusedNodeId||undefined}>
   <td><WorkNodeTitle row={row} collapsed={collapsedIds.has(row.node.id)} onToggle={()=>onToggle(row.node.id)} onOpenNode={()=>onOpenNode(row.node.id)}/></td>
   <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="lead"/></td>
   <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="contributors"/></td>
   <td><WorkNodeStatus node={row.node}/></td><td><WorkNodeDue node={row.node}/></td><td><WorkNodeProgress node={row.node}/></td>
   <td><WorkNodeActionMenu label={`Actions for ${row.node.title}`} actions={row.actions}/></td>
  </tr>)}</tbody>
 </table></div>;
}
