import { useState } from 'react';
import { WorkspacePopover } from '../../../components/ui/workspace';
import type { Organization } from '../../../types';
import type { Task } from '../../tasks';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { canHandoverTask } from '../selectors';
import { setResponsibleOffice } from '../services/projectOfficeService';
import { proposeTaskOffice, resolveTaskOffice } from '../services/officeIdentityService';
import { projectOfficeError } from '../presentation';

export function TaskOfficeControl({ task, organizations, canManage, hasStaffedSubitems }: {
  task: Task; organizations: Organization[]; canManage: boolean; hasStaffedSubitems: boolean;
}) {
  const context = useProjectOfficeContext();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [selection, setSelection] = useState('');
  const proposed = context.identities?.find(i => i.id === task.proposedOfficeIdentityId);
  const participant = context.offices.find(o => o.id === proposed?.project_office_id);
  const name = task.proposedOfficeIdentityId ? `${proposed?.display_name || 'Unresolved Office'} · proposed` : organizations.find(o => o.id === task.orgId)?.name || task.teamName || task.department || 'Office';
  const available = canManage && canHandoverTask(task, hasStaffedSubitems);
  return <WorkspacePopover trigger={<button className="pt-office" aria-label={'Responsible Office for ' + task.title}>{name}</button>}><div className="pt-popover-form">
    <strong>{task.proposedOfficeIdentityId ? 'Proposed responsibility' : 'Responsible Office'}</strong>
    <p>{task.proposedOfficeIdentityId ? 'Planning only. Directory linking and Head confirmation are required before staffing, execution, evidence or funding.' : 'Its Head chooses the owner and team.'}</p>
    {available && <>
      <label>Assign Office<select value={selection || (task.proposedOfficeIdentityId ? '' : task.orgId || '')} disabled={busy} onChange={async event => {
        const value = event.target.value;
        if (!value || value.startsWith('proposed:')) { setSelection(value); return; }
        setBusy(true); setError('');
        try { await setResponsibleOffice(task.id, value); } catch (reason) { setError(projectOfficeError(reason, 'Could not change responsibility.')); } finally { setBusy(false); }
      }}>
        <option value="">Choose responsibility</option>
        {!task.proposedOfficeIdentityId && context.offices.filter(o => o.invitation_status === 'joined' && o.relationship_type !== 'observer').map(o => <option key={o.id} value={o.office_id}>{organizations.find(n => n.id === o.office_id)?.name || 'Office'}</option>)}
        {(context.identities || []).filter(i => i.relationship_type !== 'observer' && i.provenance.source !== 'canonical_backfill').map(i => <option key={i.id} value={'proposed:' + i.id}>{i.display_name} · proposed</option>)}
      </select></label>
      <p>Confirming changes task responsibility. Proposed work remains unassigned; a joined canonical Office controls its own staffing.</p>
      {selection && <button disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try {
          await proposeTaskOffice(task.id, selection.slice(9));
          setSelection('');
        } catch (reason) { setError(projectOfficeError(reason, 'Could not change responsibility.')); }
        finally { setBusy(false); }
      }}>Confirm proposed responsibility</button>}
    </>}
    {task.proposedOfficeIdentityId && canManage && <button disabled={busy || participant?.invitation_status !== 'joined' || participant.relationship_type === 'observer'} onClick={async () => {
      setBusy(true); setError('');
      try { await resolveTaskOffice(task.id); } catch (reason) { setError(projectOfficeError(reason, 'Could not resolve responsibility.')); } finally { setBusy(false); }
    }}>Confirm canonical handover</button>}
    {!available && <p>{canManage ? 'Office handover requires unassigned, unstarted work without staffed or started subitems.' : 'The Lead Office Head sets responsibility. Your Office controls its own staff.'}</p>}
    {context.identityError && <p role="alert">{context.identityError}</p>}
    {error && <p role="alert">{error}</p>}
  </div></WorkspacePopover>;
}
