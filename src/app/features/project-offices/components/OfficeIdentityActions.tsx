import type { Invitation } from '../../invitations';
import type { OfficeIdentity, ProposedOfficeTask } from '../types';

export function OfficeIdentityActions({ identity, invitation, tasks, ready, linked, canManage, busy, onInvite, onLink, onRemove, onInvitation, onResolve }: {
  identity: OfficeIdentity; invitation?: Invitation; tasks: ProposedOfficeTask[]; ready: boolean; linked: boolean;
  canManage: boolean; busy: boolean; onInvite: () => void; onLink: () => void; onRemove: () => void;
  onInvitation: (invitation: Invitation, action: 'resend' | 'copy' | 'revoke') => void;
  onResolve: (task: ProposedOfficeTask) => void;
}) {
  const pendingInvitation = invitation && ['pending', 'expired'].includes(invitation.status);
  return <>
    {canManage && !linked && identity.relationship_type !== 'lead' && <button className="po-withdraw-btn" disabled={busy} aria-label={`Remove ${identity.display_name} from project`} onClick={onRemove}>Remove Office</button>}
    {canManage && !identity.canonical_office_id && <>
      {!pendingInvitation && identity.contact_status !== 'accepted' && <button disabled={busy} onClick={onInvite}>Invite contact</button>}
      {pendingInvitation && <>
        <button disabled={busy} onClick={() => onInvitation(invitation, 'resend')}>Resend contact invitation</button>
        <button disabled={busy} onClick={() => onInvitation(invitation, 'copy')}>Copy fresh contact link</button>
        <button disabled={busy} onClick={() => onInvitation(invitation, 'revoke')}>Revoke contact invitation</button>
      </>}
      <button disabled={busy || invitation?.status === 'pending'} onClick={onLink}>Link directory Office</button>
      {invitation?.status === 'pending' && <small className="po-office-detail">Accept or revoke the pending invitation before linking.</small>}
    </>}
    {!!tasks.length && <ul className="po-office-responsibilities">{tasks.map(task => <li key={task.id}>
      <span>{task.title} · proposed responsibility</span>
      {canManage && <button disabled={busy || !ready} onClick={() => onResolve(task)}>Resolve task responsibility</button>}
      {!ready && <small className="po-office-detail">Directory linking and the Office Head’s confirmation are required.</small>}
    </li>)}</ul>}
  </>;
}
