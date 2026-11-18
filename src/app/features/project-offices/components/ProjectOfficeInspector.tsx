import { WorkspaceTooltip } from "../../../components/ui/workspace/WorkspaceTooltip";
import { EmptyState } from '../../../components/ui/EmptyState';
import { useState, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { InspectorPanel } from '../../../shared/motion/InspectorPanel';
import { requestNavigation } from '../../../shared/navigationGuard';
import { WorkspaceTabs } from '../../../components/ui/workspace';
import type { UserProfile } from '../../../types';
import { deliveryLabel, invitationCanManage, invitationValidity, type Invitation } from '../../invitations';
import type { Task } from '../../tasks';
import type { ProjectOffice, ProjectOfficeMember } from '../types';
import { officeParticipation, officeRelationship } from '../presentation';
export function ProjectOfficeInspector({ office, name, members, invitations, busy, onConfirm, onInviteMembers, onInviteContact, onInvitationAction, onClose, onReturnFocus, onProposalContext, invitationFeedback, staffingReason, canConfirm, canInviteMembers, canInviteContact, canManageInvitations }: {
  invitationFeedback?: ReactNode; office?: ProjectOffice; projectLeadId?:string; name: string; initialTeam?: boolean; members: ProjectOfficeMember[]; profiles?: UserProfile[]; tasks?: Task[]; actorId?: string; staffingReason: string; canConfirm: boolean; canInviteMembers: boolean; canInviteContact: boolean; invitations: Invitation[]; canManageInvitations: boolean; busy: boolean;
  onConfirm: () => void; onInviteMembers: () => void; onInviteContact: () => void; onInvitationAction: (i: Invitation, action: 'resend' | 'copy' | 'revoke') => void; onClose: () => void; onSaved?: () => Promise<void>; onOpenTask?: (id: string) => void; onReturnFocus: () => void; onProposalContext?: () => void;
}) {
  const descriptionId = useId();
  const [tab, setTab] = useState('overview');
  return <InspectorPanel open ariaDescriptionId={descriptionId} ariaLabel={`${name} — project Office`} onClose={() => void requestNavigation(onClose)} onReturnFocus={onReturnFocus} className="eflow-people-inspector">
    <header><div><h2>{name}</h2><p id={descriptionId}>Project participation · account roles stay unchanged</p></div><WorkspaceTooltip content="Close Office inspector"><button className="eflow-icon-button" aria-label="Close Office inspector" onClick={() => void requestNavigation(onClose)}><X size={20}/></button></WorkspaceTooltip></header>
    <div className="eflow-people-inspector-body">{invitationFeedback}{!office && <p role="status">This Office participation is unavailable. Refresh the project Office list.</p>}<WorkspaceTabs label="Project Office details" value={tab} onValueChange={next => void requestNavigation(() => setTab(next))} tabs={[
      { id: 'overview', label: 'Overview', content: office && <><dl><dt>Relationship</dt><dd>{officeRelationship(office)}</dd><dt>Participation</dt><dd>{officeParticipation(office, invitations[0])}</dd><dt>Contact</dt><dd>{office.contact_email || 'Not provided'}</dd><dt>Assigned members</dt><dd>{members.filter(m => m.project_office_id === office.id).length} people</dd></dl><p>{staffingReason || 'Eligible members of this Office can be assigned directly to tasks in Main table.'}</p>{canConfirm && <button className="eflow-primary-button" disabled={busy} onClick={onConfirm}>Confirm Office participation</button>}{canInviteMembers && <button className="eflow-text-button" disabled={busy} onClick={onInviteMembers}>Invite to your Office</button>}{canInviteContact && <button className="eflow-primary-button" disabled={busy} onClick={onInviteContact}>{office.invitation_status === 'revoked' ? 'Invite again' : 'Invite Office contact'}</button>}{onProposalContext && <button className="eflow-text-button" onClick={() => void requestNavigation(onProposalContext)}>Open Proposal Context</button>}</> },
      { id: 'invitations', label: 'Invitations', content: <><p className="po-help">Acceptance stays with the private invitation link. The Office Head confirms collaboration before tasks are assigned.</p>{invitations.length ? invitations.map(i => <div className="po-inspector-invitation" key={i.id}><p>{i.email} · {invitationValidity(i)} · Email: {deliveryLabel(i)}</p>{canManageInvitations && invitationCanManage(i) && <div className="po-card-actions"><button disabled={busy} onClick={() => onInvitationAction(i, 'resend')}>Resend</button><button disabled={busy} onClick={() => onInvitationAction(i, 'copy')}>Copy fresh link</button><button disabled={busy} onClick={() => onInvitationAction(i, 'revoke')}>Revoke</button></div>}</div>) : <EmptyState illustration="inbox" size="compact" title="No invitation history is available under your current access."/>}</> },
    ]}/></div>
  </InspectorPanel>;
}
