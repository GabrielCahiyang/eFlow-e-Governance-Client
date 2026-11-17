import { readableUiError } from "../../../shared/userFacingError";
import { useState } from 'react';
import { WorkspacePopover } from '../../../components/ui/workspace';
import type { Organization } from '../../../types';
import type { Task } from '../../tasks';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { canHandoverTask } from '../selectors';
import { setResponsibleOffice } from '../services/projectOfficeService';
import { proposeTaskOffice, resolveTaskOffice } from '../services/officeIdentityService';
import { projectOfficeError } from '../presentation';
import { OfficeReadFeedback } from './OfficeReadFeedback';

export function TaskOfficeControl({ task, organizations, canManage, hasStaffedSubitems }: {
  task: Task; organizations: Organization[]; canManage: boolean; hasStaffedSubitems: boolean;
}) {
  const context = useProjectOfficeContext();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selection, setSelection] = useState('');
  const proposed = context.identities?.find(i => i.id === task.proposedOfficeIdentityId);
  const named = context.identities?.find(i=>i.id===context.workIdentities?.[task.id]);
  const participant = context.offices.find(o => o.id === proposed?.project_office_id);
  const name = task.proposedOfficeIdentityId ? `${proposed?.display_name || 'Unresolved Office'} · needs people` : named?.display_name || organizations.find(o => o.id === task.orgId)?.name || task.teamName || task.department || 'Office';
  const available = canManage && canHandoverTask(task, hasStaffedSubitems);
  const readUnavailable = context.loading || !!context.error || !!context.identityError;
  return <WorkspacePopover trigger={<button className="pt-office" aria-label={'Responsible Office for ' + task.title}>{name}</button>}><div className="pt-popover-form">
    <strong>{task.proposedOfficeIdentityId ? "Proposed Office" : 'Responsible Office'}</strong>
    <p>{task.proposedOfficeIdentityId ? 'Invite a project representative or employee from Project Offices before assigning this work. A department Head is optional.' : named?'Project-only Office. LEDIPO’s Head manages staffing; accepted people can work on their assigned tasks.':"The Office Head chooses the Task Lead and contributors."}</p>
    {available && <>
      <label>Responsible Office<select value={selection || (task.proposedOfficeIdentityId ? '' : task.orgId || '')} disabled={busy || readUnavailable} onChange={async event => {
        const value = event.target.value;
        if (!value || value.startsWith('proposed:')) { setSelection(value); return; }
        setBusy(true); setError('');
        try { await setResponsibleOffice(task.id, value); } catch (reason) { setError(projectOfficeError(reason, 'Could not change responsibility.')); } finally { setBusy(false); }
      }}>
        <option value="">Choose an Office</option>
        {!task.proposedOfficeIdentityId && context.offices.filter(o => o.invitation_status === 'joined' && o.relationship_type !== 'observer').map(o => <option key={o.id} value={o.office_id}>{organizations.find(n => n.id === o.office_id)?.name || 'Office'}</option>)}
        {(context.identities || []).filter(i => i.relationship_type !== 'observer' && i.provenance.source !== 'canonical_backfill').map(i => <option key={i.id} value={'proposed:' + i.id}>{i.display_name} · proposed</option>)}
      </select></label>
      <p>Confirming changes which Office is responsible for this task. Proposed work remains unassigned. Each joined Office manages its own team.</p>
      {selection && <button disabled={busy || readUnavailable} onClick={async () => {
        setBusy(true); setError('');
        try {
          await proposeTaskOffice(task.id, selection.slice(9));
          setSelection('');
        } catch (reason) { setError(projectOfficeError(reason, 'Could not change responsibility.')); }
        finally { setBusy(false); }
      }}>Assign proposed Office</button>}
    </>}
    {task.proposedOfficeIdentityId && canManage && <button disabled={busy || readUnavailable || participant?.invitation_status !== 'joined' || participant.relationship_type === 'observer'} onClick={async () => {
      setBusy(true); setError('');
      try { await resolveTaskOffice(task.id); } catch (reason) { setError(projectOfficeError(reason, 'Could not resolve responsibility.')); } finally { setBusy(false); }
    }}>Confirm Office assignment</button>}
    {!available && <p>{canManage ? "You can change the responsible Office only before work starts and before people are assigned to the task or its subtasks." : 'The Lead Office Head sets responsibility. Your Office controls its own staff.'}</p>}
    <OfficeReadFeedback errors={[context.error, context.identityError]} onRetry={context.refresh} busy={busy}/>
    {error && <p role="alert">{readableUiError(error, "We couldn't confirm the Office assignment. Check the task's current responsible Office before trying again.", "write")}</p>}
  </div></WorkspacePopover>;
}
