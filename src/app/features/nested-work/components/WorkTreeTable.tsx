import {WorkPeopleSummary} from './WorkPeopleSummary';
import {WorkNodeActionMenu} from './WorkNodeActionMenu';
import {WorkNodeTitle,WorkNodeStatus,WorkNodeDue,type WorkTreeRowsProps} from './WorkNodePresentation';
import type {WorkspaceAction} from '../../../components/ui/workspace/ActionMenu';
import {InlineWorkCreateRow} from './InlineWorkCreateRow';
import type {ReactNode} from 'react';

export function WorkTreeTable({rows,people,collapsedIds,focusedNodeId,onToggle,onOpenNode,tableSurface=false,createAction,headerAction}:WorkTreeRowsProps&{tableSurface?:boolean;createAction?:WorkspaceAction;headerAction?:ReactNode}) {
 return <div className="nw-hierarchy-table-scroll"><table className={`nw-hierarchy-table${tableSurface?' eflow-data-table':''}`} data-density={tableSurface?'compact':undefined}>
  <caption className="sr-only">Subtask hierarchy</caption>
  <thead><tr><th scope="col" className="nw-actions-cell" aria-label="Actions">{headerAction}</th>{['Subtask','Lead','Contributors','Status',tableSurface?'Due date':'Due'].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead>
  <tbody>{rows.map(row=><tr key={row.node.id} data-work-row={row.node.id} data-selected-work={row.node.id===focusedNodeId||undefined}>
   <td className="nw-actions-cell"><WorkNodeActionMenu compact={tableSurface} label={`Actions for ${row.node.title}`} actions={row.actions}/></td>
   <td><WorkNodeTitle row={row} collapsed={collapsedIds.has(row.node.id)} onToggle={()=>onToggle(row.node.id)} onOpenNode={()=>onOpenNode(row.node.id)}/></td>
   <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="lead"/></td>
   <td><WorkPeopleSummary leadId={row.node.lead_id} contributorIds={row.node.assigned_to_ids} people={people} compact part="contributors"/></td>
   <td><WorkNodeStatus node={row.node}/></td><td><WorkNodeDue node={row.node}/></td>
  </tr>)}{tableSurface&&!rows.length&&<tr><td colSpan={6} className="nw-empty-row">No subtasks yet.</td></tr>}</tbody>
  {tableSurface&&createAction&&<tfoot><InlineWorkCreateRow action={createAction}/></tfoot>}
 </table></div>;
}
