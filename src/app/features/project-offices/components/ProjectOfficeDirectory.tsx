import { useCallback, useEffect, useRef, useState } from 'react';
import { resendInvitation, revokeInvitation, type Invitation } from '../../invitations';
import { WorkspaceSkeleton } from '../../../components/ui/workspace';
import { ProjectOfficeTable, type ProjectOfficeTableProps } from './ProjectOfficeTable';
import { OfficeIdentityActions } from './OfficeIdentityActions';
import { officeTableRows, filterOfficeTableRows, type OfficeTableFilters } from '../officeTableRows';
import type { Organization } from '../../../types';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { fetchProposedOfficeTasks, identityInvitations, resolveTaskOffice } from '../services/officeIdentityService';
import type { OfficeIdentity, ProposedOfficeTask } from '../types';
import { LocalOfficeDialog } from './LocalOfficeDialog';
import { LinkOfficeDialog } from './LinkOfficeDialog';
import { projectOfficeError, projectOfficeReadError } from '../presentation';
import { removeProjectOffice } from '../services/removeProjectOffice';
import { useQuietOfficeRefresh } from '../hooks/useQuietOfficeRefresh';
import { OfficeReadFeedback } from './OfficeReadFeedback';

export function ProjectOfficeDirectory({ projectId, leadOffice, canManage, organizations, includeNamed, filters, invitations, tableProps, onClearFilters }: {
  projectId: string; leadOffice: string; canManage: boolean; organizations: Organization[];
  includeNamed: boolean; filters: OfficeTableFilters; invitations: Invitation[]; onClearFilters: () => void;
  tableProps: Omit<ProjectOfficeTableProps, 'rows' | 'identityActions'> & { offices: import('../types').ProjectOffice[] };
}) {
  const context = useProjectOfficeContext();
  const [invites, setInvites] = useState<Invitation[]>([]), [tasks, setTasks] = useState<ProposedOfficeTask[]>([]);
  const [invite, setInvite] = useState<OfficeIdentity | null>(null), [link, setLink] = useState<OfficeIdentity | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [freshLink, setFreshLink] = useState('');
  const [readError, setReadError] = useState('');
  const [confirm, setConfirm] = useState<{ label: string; run: () => Promise<unknown> } | null>(null);
  const inFlight = useRef(false), requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const [list, pending] = await Promise.allSettled([canManage && includeNamed ? identityInvitations(projectId) : Promise.resolve({ invitations: [] }), includeNamed ? fetchProposedOfficeTasks(projectId) : Promise.resolve([])]);
    if (version !== requestVersion.current) return;
    if (list.status === 'fulfilled') setInvites(list.value.invitations || []);
    if (pending.status === 'fulfilled') setTasks(pending.value);
    setReadError(projectOfficeReadError([list, pending].filter(result => result.status === 'rejected').map(result => (result as PromiseRejectedResult).reason), 'Could not load Office invitations and responsibilities.'));
  }, [projectId, canManage, includeNamed]);
  useQuietOfficeRefresh(refresh, !!readError, `${projectId}:${canManage}:${includeNamed}`);
  useEffect(() => { void refresh(); return () => { ++requestVersion.current; }; }, [refresh, context.identities]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const run = async (operation: () => Promise<unknown>) => {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(''); setNotice(''); setFreshLink('');
    try {
      const result = await operation(); setConfirm(null); setNotice('Change saved.');
      if (result && typeof result === 'object') {
        const delivery = result as Invitation;
        if (delivery.invitation_url) setFreshLink(delivery.invitation_url);
        if (delivery.delivery_error) setNotice('Invitation saved; email delivery failed. ' + delivery.delivery_error);
      }
      try { await context.refresh(); await refresh(); } catch { setError('Saved, but could not refresh. Retry loading; do not repeat the mutation.'); }
    } catch (reason) { setError(projectOfficeError(reason, 'Could not save this change.')); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const allRows = officeTableRows(tableProps.offices, includeNamed ? context.identities || [] : [], tableProps.name, [...invitations, ...invites]);
  const rows = filterOfficeTableRows(allRows, filters);
  return <div className="po-directory">
    <OfficeReadFeedback errors={[context.identityError, readError]} onRetry={async () => { await Promise.all([context.refresh(), refresh()]); }} busy={busy || tableProps.removalBusy}/>
    {error && <p role="alert" className="po-error">{error}</p>}
    {notice && <p role="status" className="po-help">{notice}</p>}
    {freshLink && <label className="po-link">Fresh private invitation link<input readOnly value={freshLink} onFocus={event => event.target.select()}/><small>This replaces the previous link. Keep it private.</small></label>}
    {context.loading ? <WorkspaceSkeleton label="Loading project Offices…"/> : rows.length ? <ProjectOfficeTable {...tableProps} rows={rows} removalBusy={tableProps.removalBusy || busy} identityActions={row => {
      const identity = row.identity;
      if (!identity || !includeNamed || identity.provenance.source === 'canonical_backfill') return null;
      return <OfficeIdentityActions identity={identity} invitation={invites.find(i => i.project_office_identity_id === identity.id)}
        tasks={tasks.filter(t => t.proposed_office_identity_id === identity.id)} linked={!!row.participation}
        ready={row.participation?.invitation_status === 'joined' && row.participation.relationship_type !== 'observer'}
        canManage={canManage} busy={busy || tableProps.removalBusy || !!context.identityError || !!readError} onInvite={() => setInvite(identity)} onLink={() => setLink(identity)}
        onRemove={() => setConfirm({ label: 'Remove ' + identity.display_name + ' from this project and cancel any pending invitation? You can add it again later.', run: () => removeProjectOffice({ identityId: identity.id }) })}
        onInvitation={(invitation, action) => action === 'revoke'
          ? setConfirm({ label: 'Revoke the contact invitation to ' + identity.contact_email + '? The link will stop working.', run: () => revokeInvitation(invitation.id) })
          : void run(() => resendInvitation(invitation.id, action === 'copy'))}
        onResolve={task => setConfirm({ label: 'Hand over “' + task.title + '” to ' + identity.display_name + '? Its Office will control staffing and review. Started or staffed work remains blocked.', run: () => resolveTaskOffice(task.id) })}/>;
    }}/> : !context.error && !context.identityError && !readError && <div className="po-office-empty">
      <h3>{allRows.length ? 'No matching Offices' : 'No project Offices yet'}</h3>
      <p>{allRows.length ? 'Try another search or clear filters.' : 'Add an Office to bring collaborators in.'}</p>
      {(filters.query || filters.relationship !== 'all' || filters.status !== 'all') && <button onClick={onClearFilters}>Clear filters</button>}
    </div>}
    {confirm && <div role="alert" className="po-discard"><p>{confirm.label}</p><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button disabled={busy} onClick={() => void run(confirm.run)}>{busy ? 'Saving…' : 'Confirm change'}</button></div>}
    {invite && <LocalOfficeDialog projectId={projectId} identity={invite} onClose={() => setInvite(null)} onSaved={async () => { await context.refresh(); await refresh(); }}/>}
    {link && <LinkOfficeDialog identity={link} leadOffice={leadOffice} organizations={organizations} onClose={() => setLink(null)} onLinked={async () => { await context.refresh(); await refresh(); }}/>}
  </div>;
}
