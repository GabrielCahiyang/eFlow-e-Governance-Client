import {Modal} from '../../../components/ui/Modal';
import {workDateLabel} from '../../../shared/workCalendar';
import {WorkPeopleSummary} from './WorkPeopleSummary';
import {WorkNodeDue,WorkNodeStatus} from './WorkNodePresentation';
import type {WorkNode,WorkTreeSnapshot} from '../types';

/** Authorized snapshot only. Canonical Inspector integration is a later task. */
export function WorkNodeReadSummary({node,snapshot,onClose}:{node:WorkNode;snapshot:WorkTreeSnapshot;onClose:()=>void}){
 return <Modal isOpen title={node.title} description="Subtask details" width="max-w-lg" bodyClassName="r7-work" footer={<div className="r7-work nw-create-footer"><div className="r7-actions"><button type="button" onClick={onClose}>Close subtask details</button></div></div>} onClose={onClose}>
  <aside className="nw-read-summary space-y-3 border-0 p-0" aria-label={`Subtask details for ${node.title}`}>
   <div className="rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] p-3">
    <WorkPeopleSummary leadId={node.lead_id} contributorIds={node.assigned_to_ids} people={snapshot.people}/>
   </div>
   <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
    <div className="rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#fff)] p-3">
     <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--eflow-text-muted,#5e6b85)]">Status &amp; order</span>
     <div className="mt-1.5 flex flex-wrap items-center gap-2">
      <WorkNodeStatus node={node}/>
      <span className="inline-flex items-center rounded-full border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-subtle,#f0f4fb)] px-2 py-0.5 text-[11px] font-medium text-[var(--eflow-text-secondary,#505c77)]">
       {node.is_standalone?'Can start independently':'In sequence'}
      </span>
     </div>
    </div>
    <div className="rounded-xl border border-[var(--eflow-border,#d6deed)] bg-[var(--eflow-surface,#fff)] p-3">
     <span className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--eflow-text-muted,#5e6b85)]">Schedule</span>
     <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] font-medium text-[var(--eflow-text,#161b35)]">
      <span>Start: {node.start_date?workDateLabel(node.start_date,'Asia/Manila'):'No start date'}</span>
      <WorkNodeDue node={node}/>
     </div>
    </div>
   </div>
  </aside>
 </Modal>;
}
