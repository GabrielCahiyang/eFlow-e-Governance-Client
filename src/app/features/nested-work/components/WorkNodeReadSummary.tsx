import {WorkPeopleSummary} from './WorkPeopleSummary';
import {WorkNodeDue,WorkNodeProgress,WorkNodeStatus} from './WorkNodePresentation';
import type {WorkNode,WorkTreeSnapshot} from '../types';

/** Authorized snapshot only. Canonical Inspector integration is a later task. */
export function WorkNodeReadSummary({node,snapshot,onClose}:{node:WorkNode;snapshot:WorkTreeSnapshot;onClose:()=>void}){
 return <aside className="nw-read-summary" aria-label={`Subitem details for ${node.title}`}>
  <h4>{node.title}</h4><WorkPeopleSummary leadId={node.lead_id} contributorIds={node.assigned_to_ids} people={snapshot.people}/>
  <WorkNodeStatus node={node}/><WorkNodeDue node={node}/><WorkNodeProgress node={node}/>
  <p>{node.is_standalone?'Can start independently':'In sequence'}</p>
  <button type="button" onClick={onClose}>Close subitem details</button>
 </aside>;
}
