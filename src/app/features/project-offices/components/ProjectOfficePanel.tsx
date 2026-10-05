import { useCallback, useEffect, useState } from 'react';
import { Building2, MailPlus, Users, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import type { Organization, UserProfile } from '../../../types';
import { resendInvitation, revokeInvitation, type Invitation } from '../../invitations';
import { InviteMemberDialog } from '../../invitations';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { confirmProjectOffice, fetchConfirmedOfficeProposals, projectOfficeInvitations } from '../services/projectOfficeService';
import type { OfficeProposal, ProjectOffice } from '../types';
import { InviteOfficeDialog } from './InviteOfficeDialog';
import { OfficeMembersDialog } from './OfficeMembersDialog';
import '../projectOffices.css';

export function ProjectOfficePanel({ projectId, projectTitle, projectStatus, leadOffice, governed, organizations, profiles }: { projectId: string; projectTitle: string; projectStatus: string; leadOffice: string; governed: boolean; organizations: Organization[]; profiles: UserProfile[] }) {
  const state = useProjectOfficeContext(), { userProfile } = useAuth();
  const head = !!userProfile?.is_active && userProfile.role === 'head' && organizations.some(o => o.id === userProfile.org_id && o.head_user_id === userProfile.id);
  const lead = head && userProfile?.org_id === leadOffice;
  const closed = ['completed', 'archived'].includes(projectStatus);
  const [invite, setInvite] = useState<{ office: string } | null>(null), [team, setTeam] = useState<ProjectOffice | null>(null), [inviteMember, setInviteMember] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]), [proposals, setProposals] = useState<OfficeProposal[]>([]), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [freshLink, setFreshLink] = useState('');
  const reload = useCallback(async () => { await state.refresh(); if (lead) { const list = await projectOfficeInvitations(projectId); setInvitations(list.invitations); } }, [state.refresh, lead, projectId]);
  useEffect(() => { void reload().catch(e => setNotice(e.message)); void fetchConfirmedOfficeProposals(projectId).then(setProposals).catch(e => setNotice(e.message)); }, [reload, projectId]);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setNotice(''); setFreshLink(''); try { await fn(); await reload(); } catch (e) { setNotice((e as Error).message); } finally { setBusy(false); } };
  const name = (id: string) => organizations.find(o => o.id === id)?.name || 'Office';
  return <section className="po-panel" aria-label="Project Office collaboration"><header><div><p className="po-eyebrow">WORKING TOGETHER</p><h2>Project Offices</h2><p>Shared responsibilities. Each Office chooses its own people.</p></div>{lead && !closed && !governed && <button className="po-primary" onClick={() => setInvite({ office: '' })}><MailPlus size={17}/>Invite Office</button>}</header>
    {(state.error || notice) && <p role="alert" className="po-error">{state.error || notice}<button onClick={() => void run(reload)}>Retry</button></p>}
    {freshLink && <div className="po-link"><label>Fresh invitation link<input readOnly value={freshLink} onFocus={e => e.target.select()}/></label><p>Keep this link private. It expires and replaces the previous link.</p></div>}
    {governed && <p className="po-help">This project uses its existing proposal governance and participating Office approvals. Manage participation in Proposal Context.</p>}
    {state.loading ? <p role="status">Loading project Offices…</p> : <div className="po-grid">{state.offices.map(o => {
      const ownHead = head && userProfile?.org_id === o.office_id;
      const invitation = invitations.find(i => i.project_office_id === o.id);
      const count = state.members.filter(m => m.project_office_id === o.id).length;
      return <article className={'po-card po-card--' + o.relationship_type} key={o.id}><div className="po-card-title"><Building2 size={23}/><div><h3>{name(o.office_id)}</h3><p>{o.relationship_type === 'lead' ? 'Lead Office' : o.relationship_type === 'collaborating' ? 'Collaborating Office' : 'Observer · read only'}</p></div></div>
        <span className={'po-badge po-badge--' + o.invitation_status}>{o.invitation_status === 'joined' ? <><CheckCircle2 size={14}/>Joined</> : o.invitation_status === 'awaiting_head' ? 'Awaiting Office Head confirmation' : invitation?.status === 'expired' ? 'Invitation expired' : invitation?.status === 'revoked' || o.invitation_status === 'revoked' ? 'Invitation revoked' : 'Invitation pending'}</span>
        {o.contact_email && <p className="po-contact">{o.contact_email}</p>}
        <p className="po-help">{o.relationship_type === 'lead' ? 'Defines project structure and Office responsibilities.' : o.relationship_type === 'collaborating' ? 'Its Head selects its own staff and manages its assigned work.' : 'Follows project progress without editing work.'}</p>
        <p><Users size={15}/> {count} selected project members</p>
        {ownHead && o.invitation_status === 'awaiting_head' && !closed && <button className="po-primary" disabled={busy} onClick={() => void run(() => confirmProjectOffice(o.id))}>Confirm Office participation</button>}
        {ownHead && o.invitation_status === 'joined' && !closed && !governed && <div className="po-card-actions"><button onClick={() => setTeam(o)}>Select own members</button><button onClick={() => setInviteMember(true)}>Invite to your Office</button></div>}
        {lead && invitation && ['pending','expired'].includes(invitation.status) && !closed && <div className="po-card-actions"><button disabled={busy} onClick={() => void run(async () => { const r = await resendInvitation(invitation.id); if (r.delivery_error) throw new Error(r.delivery_error); })}>Resend</button><button disabled={busy} onClick={() => void run(async () => { const r = await resendInvitation(invitation.id, true); setFreshLink(r.invitation_url || ''); if(r.invitation_url)await navigator.clipboard.writeText(r.invitation_url).catch(()=>{}); if (r.delivery_error) setNotice(r.delivery_error); })}>Copy fresh link</button><button disabled={busy} onClick={() => void run(async () => { await revokeInvitation(invitation.id); })}>Revoke</button></div>}
        {lead && (o.invitation_status === 'revoked' || invitation?.status === 'revoked') && !closed && <button onClick={() => setInvite({ office: o.office_id })}>Invite again</button>}
      </article>;
    })}</div>}
    {!!proposals.length && <section className="po-proposals"><h3>Offices confirmed during import</h3><p>Review the source context, then invite each Office explicitly.</p>{proposals.map(o => <div key={o.officeId || o.name}><div><strong>{o.name}</strong><p>{o.evidence}</p>{!o.officeId && <small>Match this name to an existing Office when inviting.</small>}</div>{lead && !closed && !governed && !state.offices.some(p => p.office_id === o.officeId && p.invitation_status !== 'revoked') && <button onClick={() => setInvite({ office: o.officeId })}>Review & invite</button>}</div>)}</section>}
    {invite && <InviteOfficeDialog key={invite.office} open onClose={() => setInvite(null)} projectId={projectId} projectTitle={projectTitle} offices={state.offices} organizations={organizations} profiles={profiles} initialOffice={invite.office} onSent={reload}/>}
    {team && <OfficeMembersDialog key={team.id} office={team} name={name(team.office_id)} profiles={profiles} members={state.members} onClose={() => setTeam(null)} onSaved={reload}/>}
    <InviteMemberDialog officeName={name(userProfile?.org_id || '')} open={inviteMember} onOpenChange={setInviteMember} onSent={() => { setInviteMember(false); void reload(); }}/>
  </section>;
}
