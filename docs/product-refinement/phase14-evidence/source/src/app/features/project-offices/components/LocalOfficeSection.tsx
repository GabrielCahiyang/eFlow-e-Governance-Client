import { useCallback, useEffect, useRef, useState } from 'react';
import { resendInvitation, revokeInvitation, type Invitation } from '../../invitations';
import type { Organization } from '../../../types';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { fetchProposedOfficeTasks, identityInvitations, resolveTaskOffice } from '../services/officeIdentityService';
import type { OfficeIdentity, ProposedOfficeTask } from '../types';
import { LocalOfficeDialog } from './LocalOfficeDialog';
import { LinkOfficeDialog } from './LinkOfficeDialog';

export function LocalOfficeSection({ projectId, leadOffice, canManage, organizations }: {
  projectId: string; leadOffice: string; canManage: boolean; organizations: Organization[];
}) {
  const context = useProjectOfficeContext();
  const [invites, setInvites] = useState<Invitation[]>([]), [tasks, setTasks] = useState<ProposedOfficeTask[]>([]);
  const [invite, setInvite] = useState<OfficeIdentity | null>(null), [link, setLink] = useState<OfficeIdentity | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [freshLink, setFreshLink] = useState('');
  const [confirm, setConfirm] = useState<{ label: string; run: () => Promise<unknown> } | null>(null);
  const inFlight = useRef(false), requestVersion = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    const [list, pending] = await Promise.all([canManage ? identityInvitations(projectId) : Promise.resolve({ invitations: [] }), fetchProposedOfficeTasks(projectId)]);
    if (version === requestVersion.current) { setInvites(list.invitations || []); setTasks(pending); setError(''); }
  }, [projectId, canManage]);
  useEffect(() => { void refresh().catch(reason => setError(reason.message)); return () => { ++requestVersion.current; }; }, [refresh, context.identities]);
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this change.'); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const local = (context.identities || []).filter(i => i.provenance.source !== 'canonical_backfill');
  return <section className="po-proposals" aria-label="Named project Offices">
    <h3>Named project Offices</h3><p>Names can exist before directory linking. Proposed responsibilities remain planning-only until explicitly resolved.</p>
    {context.identityError && <p role="alert" className="po-error">{context.identityError}</p>}
    {error && <p role="alert" className="po-error">{error}<button type="button" onClick={() => void refresh().catch(reason => setError(reason.message))}>Retry loading</button></p>}
    {notice && <p role="status">{notice}</p>}
    {freshLink && <label className="po-link">Fresh private invitation link<input readOnly value={freshLink} onFocus={event => event.target.select()}/><small>This replaces the previous link. Keep it private.</small></label>}
    {!local.length && <p className="po-help">No named Offices yet.</p>}
    {local.map(identity => {
      const invitation = invites.find(i => i.project_office_identity_id === identity.id);
      const participant = context.offices.find(o => o.id === identity.project_office_id);
      const pendingInvitation = invitation && ['pending', 'expired'].includes(invitation.status);
      const pending = tasks.filter(t => t.proposed_office_identity_id === identity.id);
      const ready = participant?.invitation_status === 'joined' && participant.relationship_type !== 'observer';
      return <article className="po-local-card" key={identity.id}>
        <h3>{identity.display_name}</h3>
        <p>{identity.canonical_office_id ? `Linked · ${participant?.invitation_status === 'joined' ? 'Joined' : participant?.invitation_status === 'awaiting_head' ? 'Awaiting Office Head confirmation' : participant?.invitation_status === 'revoked' ? 'Participation revoked' : 'Contact invitation required'}` : 'Unlinked · planning only'} · {identity.relationship_type === 'observer' ? 'Observer · read only' : 'Collaborating Office'}</p>
        <p>{identity.contact_status === 'accepted' ? 'Contact accepted; account role and Office membership unchanged.' : invitation?.status === 'expired' ? 'Contact invitation expired' : `Contact ${identity.contact_status}`}{identity.contact_email && ` · ${identity.contact_email}`}</p>
        {identity.provenance.evidence && <p className="po-help">Source: {identity.provenance.evidence}</p>}
        {canManage && !identity.canonical_office_id && <div className="po-card-actions">
          {!pendingInvitation && identity.contact_status !== 'accepted' && <button disabled={busy} onClick={() => setInvite(identity)}>Invite contact</button>}
          {pendingInvitation && <><button disabled={busy} onClick={() => void run(() => resendInvitation(invitation.id))}>Resend contact invitation</button><button disabled={busy} onClick={() => void run(() => resendInvitation(invitation.id, true))}>Copy fresh contact link</button><button disabled={busy} onClick={() => setConfirm({ label: `Revoke the contact invitation to ${identity.contact_email}? The link will stop working.`, run: () => revokeInvitation(invitation.id) })}>Revoke contact invitation</button></>}
          <button disabled={busy || invitation?.status === 'pending'} onClick={() => setLink(identity)}>Link directory Office</button>
          {invitation?.status === 'pending' && <small>Accept or revoke the pending invitation before linking.</small>}
        </div>}
        {pending.length > 0 && <ul>{pending.map(task => <li key={task.id}><span>{task.title} · proposed responsibility</span>{canManage && <button disabled={busy || !ready} onClick={() => setConfirm({ label: `Hand over “${task.title}” to ${identity.display_name}? Its canonical Office will control staffing and review. Started or staffed work remains blocked.`, run: () => resolveTaskOffice(task.id) })}>Resolve task responsibility</button>}{!ready && <small>Directory linking and the canonical Office Head’s confirmation are required.</small>}</li>)}</ul>}
      </article>;
    })}
    {confirm && <div role="alert" className="po-discard"><p>{confirm.label}</p><button disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button disabled={busy} onClick={() => void run(confirm.run)}>{busy ? 'Saving…' : 'Confirm change'}</button></div>}
    {invite && <LocalOfficeDialog projectId={projectId} identity={invite} onClose={() => setInvite(null)} onSaved={async () => { await context.refresh(); await refresh(); }}/>}
    {link && <LinkOfficeDialog identity={link} leadOffice={leadOffice} organizations={organizations} onClose={() => setLink(null)} onLinked={async () => { await context.refresh(); await refresh(); }}/>}
  </section>;
}
