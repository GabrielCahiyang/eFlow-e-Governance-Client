import { useCallback, useRef, useState } from 'react';
import { MailPlus, Search } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { isAppointedOfficeHead } from '../../../shared/officeAuthority';
import { requestNavigation } from '../../../shared/navigationGuard';
import { useConfirmation } from '../../../components/ui/useConfirmation';
import type { Organization, UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import { InviteMemberDialog, useInvitationManagement } from '../../invitations';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { useOfficeParticipationDetails } from '../hooks/useOfficeParticipationDetails';
import { confirmProjectOffice } from '../services/projectOfficeService';
import { removeProjectOffice } from '../services/removeProjectOffice';
import { officeStaffingReason, officeRelationship, projectOfficeError } from '../presentation';
import { InviteOfficeDialog } from './InviteOfficeDialog';
import { ProjectOfficeInspector } from './ProjectOfficeInspector';
import { LocalOfficeDialog } from './LocalOfficeDialog';
import { ProjectOfficeDirectory } from './ProjectOfficeDirectory';
import { OfficeReadFeedback } from './OfficeReadFeedback';
import '../projectOffices.css';
import '../../../../styles/people-management.css';

export function ProjectOfficePanel({ projectId, projectTitle, projectStatus, leadOffice, governed, organizations, profiles, tasks = [], onOpenTask, onProposalContext }: { projectId: string; projectTitle: string; projectStatus: string; leadOffice: string; governed: boolean; organizations: Organization[]; profiles: UserProfile[]; tasks?: Task[]; onOpenTask?: (id: string, afterOpen?: () => void) => void; onProposalContext?: () => void }) {
  const state = useProjectOfficeContext(), { userProfile } = useAuth();
  const head = isAppointedOfficeHead(userProfile, organizations), lead = head && userProfile?.org_id === leadOffice;
  const closed = ['completed', 'archived'].includes(projectStatus);
  const details = useOfficeParticipationDetails(projectId, lead);
  // Named identities and directory Offices keep their distinct invitation workflows.
  const [invite, setInvite] = useState<{ office: string } | null>(null), [inviteMember, setInviteMember] = useState(false);
  const [localOffice, setLocalOffice] = useState<{ name: string; evidence: string } | null>(null);
  const [selection, setSelection] = useState<{id:string; team:boolean} | null>(null);
  const [query, setQuery] = useState(''), [relationship, setRelationship] = useState('all'), [status, setStatus] = useState('all');
  const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), pending = useRef(false);
  const scope = `${projectId}:${userProfile?.id || ''}:${lead}`;
  const current = useRef({scope, state, lead, closed, governed}); current.current = {scope, state, lead, closed, governed};
  const reload = useCallback(async () => { await Promise.all([state.refresh(), details.refresh()]); }, [state.refresh, details.refresh]);
  const actions = useInvitationManagement(scope, reload), confirmation = useConfirmation();
  const name = (id: string) => organizations.find(o => o.id === id)?.name || 'Office';
  const reason = (id: string) => officeStaffingReason(state.offices.find(o => o.id === id), userProfile, organizations, projectStatus, governed, state.error);
  const office = state.offices.find(o => o.id === selection?.id);
  const open = (id: string, team = false) => void requestNavigation(() => setSelection({id, team}));

  async function confirmOffice() {
    if (!office || pending.current || closed || !head || userProfile?.org_id !== office.office_id || office.invitation_status !== 'awaiting_head') return;
    pending.current = true;
    try {
      if (!await confirmation.confirm({title:'Confirm Office participation?',description:`${name(office.office_id)} joins ${projectTitle} as ${officeRelationship(office)}. Account roles stay unchanged; its Head chooses its project team.`,actionLabel:'Confirm participation'})) return;
      if (current.current.scope !== scope || current.current.closed || !current.current.state.offices.some(o => o.id === office.id && o.invitation_status === 'awaiting_head')) return;
      setBusy(true); setNotice(''); await confirmProjectOffice(office.id); setNotice('Office participation confirmed.'); await reload();
    } catch(e) { setNotice(projectOfficeError(e, 'Could not confirm this Office yet.')); }
    finally { pending.current = false; setBusy(false); }
  }

  async function removeOffice(target: import('../types').ProjectOffice) {
    if (pending.current || closed || !lead || !current.current.lead || !current.current.state.offices.some(o => o.id === target.id)) return;
    pending.current = true;
    try {
      if (!await confirmation.confirm({title:'Remove Office?', description:`Remove ${name(target.office_id)} from this project and cancel any pending invitation. You can add it again later.`, actionLabel:'Remove Office', danger:true})) return;
      if (current.current.scope !== scope || !current.current.lead || current.current.closed || current.current.governed) return;
      setBusy(true); setNotice(''); await removeProjectOffice({participationId:target.id});
      setSelection(s => s?.id === target.id ? null : s);
      setNotice(`${name(target.office_id)} removed from this project.`); await reload();
    } catch(e) { setNotice(projectOfficeError(e, 'Could not remove this Office yet.')); }
    finally { pending.current = false; setBusy(false); }
  }

  const clear = () => { setQuery(''); setRelationship('all'); setStatus('all'); };

  return <section className="po-panel" aria-label="Project Office collaboration">
    <header>
      <div><p className="po-eyebrow">WORKING TOGETHER</p><h2>Project Offices</h2><p>Shared responsibilities. Each Office chooses its own people.</p></div>
      {lead && !closed && !governed && <div className="po-card-actions">
        <button disabled={!!state.identityError || state.loading || !!state.error} onClick={() => setLocalOffice({name:'',evidence:''})}>Add named Office</button>
        <button className="po-primary" disabled={!!state.error} onClick={() => setInvite({office:''})}><MailPlus size={17}/>Invite Office</button>
      </div>}
    </header>
    <OfficeReadFeedback errors={[state.error, details.error]} onRetry={reload} busy={busy || !!actions.busy}/>
    {notice && <p role="status" className="po-help">{notice}</p>}{actions.error && <p role="alert" className="po-error">{actions.error}</p>}{actions.receipt && <p role="status">{actions.receipt}</p>}
    {actions.freshLink && <div className="po-link"><label>Fresh invitation link<input readOnly value={actions.freshLink} onFocus={e => e.target.select()}/></label><p>Private · expires · replaces the previous link.</p><button onClick={actions.clearLink}>Hide link</button></div>}
    {governed && <p className="po-help">This project uses its existing proposal governance and participating Office approvals. Manage participation in Proposal Context.{onProposalContext && <button onClick={onProposalContext}>Open Proposal Context</button>}</p>}
    {closed && <p className="po-help">This project is closed; project participation is read only.</p>}
    <div className="po-office-toolbar"><label><Search size={16}/><span className="sr-only">Search project Offices</span><input id="project-office-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Office or contact"/></label><label><span className="sr-only">Filter Office relationship</span><select value={relationship} onChange={e => setRelationship(e.target.value)}><option value="all">All relationships</option><option value="lead">Lead Office</option><option value="collaborating">Collaborating Office</option><option value="observer">Observer</option></select></label><label><span className="sr-only">Filter participation status</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All participation</option>{['joined','awaiting_head','pending','revoked','planning','contact_accepted'].map(s=><option key={s} value={s}>{s === 'planning' ? 'Planning only' : s === 'contact_accepted' ? 'Contact accepted' : s.replace(/_/g,' ')}</option>)}</select></label><button onClick={() => void reload()}>Refresh Offices</button></div>
    <ProjectOfficeDirectory key={`directory:${scope}`} projectId={projectId} leadOffice={leadOffice} canManage={lead && !closed && !governed} organizations={organizations}
      includeNamed={!governed} filters={{query, relationship, status}} onClearFilters={clear} invitations={details.invitations}
      tableProps={{offices:state.offices, members:state.members, name, onOpen:open, canStaff:o => !reason(o.id),
        canRemove:lead && !closed && !governed, removalBusy:busy, onRemove:o => void removeOffice(o)}}/>
    {!!details.proposals.length && <section className="po-proposals"><h3>Offices confirmed during import</h3><p>Review the source context, then add each Office explicitly.</p>{details.proposals.map(o => <div key={o.officeId || o.name}><div><strong>{o.name}</strong><p>{o.evidence}</p>{!o.officeId && <small>Retain the name and invite a contact before directory linking.</small>}</div>{lead && !closed && !governed && !state.offices.some(p => p.office_id === o.officeId && p.invitation_status !== 'revoked') && <button disabled={!!state.error || !o.officeId && !!state.identityError} onClick={() => o.officeId ? setInvite({office:o.officeId}) : setLocalOffice({name:o.name,evidence:o.evidence})}>Review &amp; add</button>}</div>)}</section>}
    {localOffice && <LocalOfficeDialog projectId={projectId} initialName={localOffice.name} evidence={localOffice.evidence} onClose={() => setLocalOffice(null)} onSaved={reload}/>}
    {invite && <InviteOfficeDialog key={invite.office} open onClose={() => setInvite(null)} projectId={projectId} projectTitle={projectTitle} offices={state.offices} organizations={organizations} profiles={profiles} initialOffice={invite.office} onSent={reload}/>}
    <InviteMemberDialog key={scope} officeName={name(userProfile?.org_id || '')} open={inviteMember} onOpenChange={setInviteMember} onSent={() => { void reload(); }}/>
    {selection && <ProjectOfficeInspector key={`${scope}:${selection.id}:${selection.team}`} office={office} name={office ? name(office.office_id) : 'Office'} initialTeam={selection.team} members={state.members} profiles={profiles} tasks={tasks} actorId={userProfile?.id || ''} staffingReason={reason(selection.id)} canConfirm={!!office && head && userProfile?.org_id === office.office_id && office.invitation_status === 'awaiting_head' && !closed && !state.error} canInviteMembers={!!office && !reason(office.id)} canInviteContact={!!office && lead && !closed && !governed && !state.error && (office.invitation_status === 'revoked' || office.invitation_status === 'pending' && !details.invitations.some(i => i.project_office_id === office.id))} invitations={details.invitations.filter(i => i.project_office_id === selection.id)} canManageInvitations={lead && !closed && !details.error && !state.error} busy={busy || !!actions.busy} onConfirm={() => void confirmOffice()} onInviteMembers={() => setInviteMember(true)} onInviteContact={() => office && setInvite({office:office.office_id})} onInvitationAction={(i, action) => void actions.manage(i, action, () => current.current.scope === scope && current.current.lead && !current.current.closed && !current.current.state.error)} onClose={() => setSelection(null)} onSaved={async () => { await reload(); setNotice('Project team saved.'); }} onOpenTask={onOpenTask ? id => onOpenTask(id, () => setSelection(null)) : undefined} onReturnFocus={() => (Array.from(document.querySelectorAll<HTMLElement>('[data-project-office-id]')).find(el => el.dataset.projectOfficeId === selection.id) || document.getElementById('project-office-search'))?.focus()} onProposalContext={governed ? onProposalContext : undefined} invitationFeedback={<><button className="eflow-text-button" disabled={busy || !!actions.busy} onClick={() => void reload()}>Refresh participation</button><OfficeReadFeedback errors={[state.error, details.error]} onRetry={reload} busy={busy || !!actions.busy}/>{notice && <p role="status">{notice}</p>}{actions.error && <p role="alert" className="po-error">{actions.error}</p>}{actions.receipt && <p role="status">{actions.receipt}</p>}{actions.freshLink && <div className="po-link"><label>Fresh invitation link<input readOnly value={actions.freshLink} onFocus={e => e.target.select()}/></label><p>Private · expires · replaces the previous link.</p><button onClick={actions.clearLink}>Hide link</button></div>}</>}/>}
    {actions.confirmation}{confirmation.dialog}
  </section>;
}
