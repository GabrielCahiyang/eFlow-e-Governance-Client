import { useState, useId } from 'react';
import { X } from 'lucide-react';
import { InspectorPanel } from '../../../shared/motion/InspectorPanel';
import { requestNavigation } from '../../../shared/navigationGuard';
import { WorkspaceTabs } from '../../../components/ui/workspace';
import { ProfessionalProfilePanel } from '../../professional-profile';
import { accountRoleLabel } from '../selectors';
import type { OfficeMember } from '../types';
export function OfficeMemberInspector({ member, office, onClose, onReturnFocus }: { member?: OfficeMember; office: string; onClose: () => void; onReturnFocus: () => void }) {
  const descriptionId = useId();
  const [tab, setTab] = useState('overview');
  return <InspectorPanel open ariaDescriptionId={descriptionId} ariaLabel={member ? `${member.full_name} — Office member` : 'Office member unavailable'} onClose={() => void requestNavigation(onClose)} onReturnFocus={onReturnFocus} className="eflow-people-inspector">
    <header><div><h2>{member?.full_name || 'Member unavailable'}</h2><p id={descriptionId}>{office} · Account membership</p></div><button className="eflow-icon-button" aria-label="Close member inspector" onClick={() => void requestNavigation(onClose)}><X size={20}/></button></header>
    <div className="eflow-people-inspector-body">{member ? <WorkspaceTabs value={tab} onValueChange={next => void requestNavigation(() => setTab(next))} label="Member details" tabs={[
      { id: 'overview', label: 'Overview', content: <><dl><dt>Email</dt><dd>{member.email}</dd><dt>Account role</dt><dd>{accountRoleLabel(member.role)}</dd><dt>Status</dt><dd>{member.is_active ? 'Active' : 'Inactive'}</dd><dt>Professional summary</dt><dd>Not loaded · open Professional Profile to view authorized work qualifications.</dd></dl><p>Office membership is separate from project participation and task execution teams. Manage task contributors in the task inspector.</p></> },
      { id: 'profile', label: 'Professional Profile', content: tab === 'profile' ? <ProfessionalProfilePanel key={member.id} userId={member.id}/> : null },
    ]}/> : <p role="status">This member is no longer available in the authorized Office list. Close this inspector and refresh.</p>}</div>
  </InspectorPanel>;
}
