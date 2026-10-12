import {WorkPeopleSummary} from './WorkPeopleSummary';
import {WorkNodeActionMenu} from './WorkNodeActionMenu';
import {WorkNodeTitle,WorkNodeStatus,WorkNodeDue,WorkNodeProgress,type WorkTreeRowsProps} from './WorkNodePresentation';
import type {WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';
import {InlineWorkCreateRow} from './InlineWorkCreateRow';

export function WorkTreeTable({rows,people,collapsedIds,focusedNodeId,onToggle,onOpenNode,tableSurface=false,createAction}:WorkTreeRowsProps&{tableSurface?:boolean;createAction?:WorkspaceAction}) {
 return <div className="nw-hierarchy-table-scroll"><table className={`nw-hierarchy-table${tableSurface?' eflow-data-table':''}`} data-density={tableSurface?'compact':undefined}>
  <caption className="sr-only">Subitem hierarchy</caption>
  <thead><tr>{['Subitem','Lead','Contributors','Status',tableSurface?'Due date':'Due','Progress','Actions'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
  <tbody>{rows.map(row=><tr key={row.node.id} data-work-row={row.node.id} data-selected-work={row.node.id===focusedNodeId||undefined}>
   <td><WorkNodeTitle row={row} collapsed={collapsedIds.has(row.node.id)} onToggle={()=>onToggle(row.node.id)} onOpenNode={()=>onOpenNode(row.node.id)}/></td>
   <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="lead"/></td>
   <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="contributors"/></td>
   <td><WorkNodeStatus node={row.node}/></td><td><WorkNodeDue node={row.node}/></td><td><WorkNodeProgress node={row.node}/></td>
   <td><WorkNodeActionMenu compact={tableSurface} label={`Actions for ${row.node.title}`} actions={row.actions}/></td>
  </tr>)}{tableSurface&&!rows.length&&<tr><td colSpan={7} className="nw-empty-row">No subitems yet.</td></tr>}</tbody>
  {tableSurface&&createAction&&<tfoot><InlineWorkCreateRow action={createAction}/></tfoot>}
 </table></div>;
}
