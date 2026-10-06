import { useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { WorkspaceHeader, WorkspaceTabs, WorkspaceSkeleton } from '../../../components/ui/workspace';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { useAuth } from '../../../contexts/AuthContext';
import { useOrgs } from '../../../hooks/useSupabaseData';
import { InviteMemberDialog, useInvitationManagement, invitationValidity, type Invitation } from '../../invitations';
import { uploadPds } from '../../professional-profile';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useOfficeTeam } from '../hooks/useOfficeTeam';
import { filterOfficeMembers, isAppointedOfficeHead } from '../selectors';
import { OfficeTeamTable } from './OfficeTeamTable';
import { InvitationTable } from './InvitationTable';
import { OfficeMemberInspector } from './OfficeMemberInspector';
import '../officeTeam.css';
import '../../../../styles/people-management.css';
export function OfficeTeamWorkspace() {
  const { userProfile } = useAuth(), { orgs } = useOrgs();
  const scope = `${userProfile?.id || ''}:${userProfile?.org_id || ''}`;
  const canManage = isAppointedOfficeHead(userProfile, orgs);
  const state = useOfficeTeam(scope, !!userProfile?.is_active && userProfile.role === 'head');
  const [search, setSearch] = useState(''), [role, setRole] = useState('all'), [status, setStatus] = useState('all'), [tab, setTab] = useState('active');
  const [invite, setInvite] = useState(false), [detailId, setDetailId] = useState(''), [uploadBusy, setUploadBusy] = useState(''), [uploadError, setUploadError] = useState('');
  const uploadPending = useRef(false);
  const actions = useInvitationManagement(scope, state.refresh);
  const current = useRef({ canManage, scope, invitations: state.invitations }); current.current = { canManage, scope, invitations: state.invitations };
  const shownMembers = filterOfficeMembers(state.members, search, role);
  const shownInvitations = state.invitations.filter(i => i.email.toLowerCase().includes(search.trim().toLowerCase()) && (role === 'all' || role === i.account_role) && (status === 'all' || status === invitationValidity(i)));
  const clear = () => { setSearch(''); setRole('all'); setStatus('all'); };
  async function attach(item: Invitation, file: File) {
    if (!current.current.canManage || uploadPending.current || actions.busy) return;
    if (file.size > 10485760 || !file.name.toLowerCase().endsWith('.pdf')) { setUploadError('Choose a PDF smaller than 10 MB.'); return; }
    const origin = scope; uploadPending.current = true; setUploadBusy(item.id); setUploadError('');
    try { await uploadPds(file, item.id); if (current.current.scope === origin) await state.refresh(); }
    catch (e) { if (current.current.scope === origin) setUploadError((e as Error).message); }
    finally { uploadPending.current = false; if (current.current.scope === origin) setUploadBusy(''); }
  }
  const empty = (filtered: boolean, members: boolean) => <div className="eflow-team-empty"><h2>{filtered ? 'No matching results' : members ? 'No active Office members' : 'No invitations yet'}</h2><p>{filtered ? 'Try another search or clear the filters.' : 'Account membership belongs to your Office; project teams are managed separately.'}</p>{filtered ? <button className="eflow-text-button" onClick={clear}>Clear filters</button> : canManage && <button className="eflow-primary-button" onClick={() => setInvite(true)}>Invite Member</button>}</div>;
  return <section className="eflow-office-team" aria-label="Office Team" data-tour-id="office-team">
    <WorkspaceHeader title="Office Team" description={`Account members and invitations in ${state.office}.`} actions={canManage ? <button className="eflow-primary-button" onClick={() => setInvite(true)} data-tour-id="invite-member"><Plus size={17}/>Invite Member</button> : undefined}/>
    {!canManage && <p className="eflow-invite-help">Invitations are managed by the appointed Head of this Office.</p>}
    <div className="eflow-team-toolbar"><label><Search size={16}/><span className="sr-only">Search Office Team</span><input id="office-team-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your team"/></label><label><span className="sr-only">Filter by account role</span><select value={role} onChange={e => setRole(e.target.value)}><option value="all">All roles</option><option value="head">Head</option><option value="member">Member</option><option value="accounting_staff">Accounting Staff</option></select></label>{tab === 'pending' && <label><span className="sr-only">Filter invitation validity</span><select value={status} onChange={e => setStatus(e.target.value)}>{['all', 'pending', 'accepted', 'expired', 'revoked'].map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>}<button className="eflow-text-button" disabled={state.refreshing} onClick={() => void state.refresh()}>{state.refreshing ? 'Refreshing…' : 'Refresh'}</button></div>
    {actions.error && <FeedbackState tone="error" title="Invitation action">{actions.error}</FeedbackState>}{actions.receipt && <p role="status">{actions.receipt}</p>}{uploadError && <FeedbackState tone="error" title="PDS upload failed">{uploadError}</FeedbackState>}
    {actions.freshLink && <div className="eflow-fresh-link"><label>Fresh invitation link<input readOnly value={actions.freshLink} onFocus={e => e.target.select()}/></label><p>Private · expires · replaces the previous link.</p><button className="eflow-text-button" onClick={actions.clearLink}>Hide link</button></div>}
    {state.loading ? <WorkspaceSkeleton label="Loading your Office Team…"/> : <WorkspaceTabs value={tab} onValueChange={next => void requestNavigation(() => { setTab(next); actions.clearLink(); })} label="Office Team views" tabs={[
      { id: 'active', label: `Active Members (${state.members.filter(m => m.is_active).length})`, content: <>{state.teamError && <FeedbackState tone="error" title="Office members unavailable" onRetry={() => void state.refresh()}>{state.teamError}</FeedbackState>}{shownMembers.length ? <OfficeTeamTable members={shownMembers} onOpen={id => void requestNavigation(() => setDetailId(id))}/> : !state.teamError && empty(!!search || role !== 'all', true)}</> },
      { id: 'pending', label: `Invitations (${state.invitations.length})`, content: <>{state.inviteError && <FeedbackState tone="error" title="Invitations unavailable" onRetry={() => void state.refresh()}>{state.inviteError}</FeedbackState>}{shownInvitations.length ? <InvitationTable rows={shownInvitations} busy={uploadBusy || actions.busy} canManage={canManage && !state.inviteError} onAction={(item, action) => void actions.manage(item, action, () => current.current.canManage && current.current.scope === scope && current.current.invitations.some(i => i.id === item.id && ['pending', 'expired'].includes(i.status)))} onPds={(i, f) => void attach(i, f)}/> : !state.inviteError && empty(!!search || role !== 'all' || status !== 'all', false)}</> },
    ]}/>}
    <InviteMemberDialog key={scope} officeName={state.office} open={invite && canManage} onOpenChange={setInvite} onSent={() => { setTab('pending'); void state.refresh(); }}/>
    {detailId && <OfficeMemberInspector key={`${scope}:${detailId}`} member={state.members.find(m => m.id === detailId && m.is_active)} office={state.office} onClose={() => setDetailId('')} onReturnFocus={() => (Array.from(document.querySelectorAll<HTMLElement>('[data-member-id]')).find(el => el.dataset.memberId === detailId) || document.getElementById('office-team-search'))?.focus()}/>}
    {actions.confirmation}
  </section>;
}
