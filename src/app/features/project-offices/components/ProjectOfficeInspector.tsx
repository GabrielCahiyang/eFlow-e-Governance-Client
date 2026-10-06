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
import { OfficeMembersEditor } from './OfficeMembersEditor';
export function ProjectOfficeInspector({ office, name, initialTeam, members, profiles, tasks, actorId, staffingReason, canConfirm, canInviteMembers, canInviteContact, invitations, canManageInvitations, busy, onConfirm, onInviteMembers, onInviteContact, onInvitationAction, onClose, onSaved, onOpenTask, onReturnFocus, onProposalContext, invitationFeedback }: {
  invitationFeedback?: ReactNode; office?: ProjectOffice; name: string; initialTeam: boolean; members: ProjectOfficeMember[]; profiles: UserProfile[]; tasks: Task[]; actorId: string; staffingReason: string; canConfirm: boolean; canInviteMembers: boolean; canInviteContact: boolean; invitations: Invitation[]; canManageInvitations: boolean; busy: boolean;
  onConfirm: () => void; onInviteMembers: () => void; onInviteContact: () => void; onInvitationAction: (i: Invitation, action: 'resend' | 'copy' | 'revoke') => void; onClose: () => void; onSaved: () => Promise<void>; onOpenTask?: (id: string) => void; onReturnFocus: () => void; onProposalContext?: () => void;
}) {
  const descriptionId = useId();
  const [tab, setTab] = useState(initialTeam ? 'team' : 'overview');
  const [editableAtOpen] = useState(!staffingReason);
  const [binding] = useState(() => ({ id: office?.id || '', project_id: office?.project_id || '', office_id: office?.office_id || '' }));
  return <InspectorPanel open ariaDescriptionId={descriptionId} ariaLabel={tab === 'team' ? `${name}’s project team` : `${name} — project Office`} onClose={() => void requestNavigation(onClose)} onReturnFocus={onReturnFocus} className="eflow-people-inspector">
    <header><div><h2>{name}</h2><p id={descriptionId}>Project participation · account roles stay unchanged</p></div><button className="eflow-icon-button" aria-label="Close Office inspector" onClick={() => void requestNavigation(onClose)}><X size={20}/></button></header>
    <div className="eflow-people-inspector-body">{invitationFeedback}{!office && <p role="status">This Office participation is unavailable. Refresh the project Office list.</p>}<WorkspaceTabs label="Project Office details" value={tab} onValueChange={next => void requestNavigation(() => setTab(next))} tabs={[
      { id: 'overview', label: 'Overview', content: office && <><dl><dt>Relationship</dt><dd>{officeRelationship(office)}</dd><dt>Participation</dt><dd>{officeParticipation(office, invitations[0])}</dd><dt>Contact</dt><dd>{office.contact_email || 'Not provided'}</dd><dt>Project team</dt><dd>{members.filter(m => m.project_office_id === office.id).length} selected people</dd></dl><p>{staffingReason || 'This Office’s appointed Head can select its own eligible project members.'}</p>{canConfirm && <button className="eflow-primary-button" disabled={busy} onClick={onConfirm}>Confirm Office participation</button>}{canInviteMembers && <button className="eflow-text-button" disabled={busy} onClick={onInviteMembers}>Invite to your Office</button>}{canInviteContact && <button className="eflow-primary-button" disabled={busy} onClick={onInviteContact}>{office.invitation_status === 'revoked' ? 'Invite again' : 'Invite Office contact'}</button>}{onProposalContext && <button className="eflow-text-button" onClick={() => void requestNavigation(onProposalContext)}>Open Proposal Context</button>}</> },
      { id: 'team', label: 'Project team', content: tab === 'team' ? editableAtOpen && binding.id ? <OfficeMembersEditor office={office || binding} profiles={profiles} members={members} tasks={tasks} actorId={actorId} disabledReason={staffingReason} onCancel={onClose} onSaved={onSaved} onOpenTask={onOpenTask}/> : <><p>{staffingReason}</p><ul>{members.filter(m => m.project_office_id === binding.id).map(m => <li key={m.user_id}>{profiles.find(p => p.id === m.user_id)?.full_name || 'Selected project member'}</li>)}</ul></> : null },
      { id: 'invitations', label: 'Invitations', content: <><p className="po-help">Acceptance stays with the private invitation link. The Office Head confirms collaboration before selecting staff.</p>{invitations.length ? invitations.map(i => <div className="po-inspector-invitation" key={i.id}><p>{i.email} · {invitationValidity(i)} · Email: {deliveryLabel(i)}</p>{canManageInvitations && invitationCanManage(i) && <div className="po-card-actions"><button disabled={busy} onClick={() => onInvitationAction(i, 'resend')}>Resend</button><button disabled={busy} onClick={() => onInvitationAction(i, 'copy')}>Copy fresh link</button><button disabled={busy} onClick={() => onInvitationAction(i, 'revoke')}>Revoke</button></div>}</div>) : <p>No invitation history is available under your current access.</p>}</> },
    ]}/></div>
  </InspectorPanel>;
}
