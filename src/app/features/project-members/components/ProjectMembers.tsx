import { Skeleton } from '@vibe/core';
import { Building2, Search, UserPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { FeatureDialog } from '../../../components/ui/FeatureDialog';
import { FeedbackState } from '../../../components/ui/FeedbackState';
import { StatusPill } from '../../../components/ui/workspace/StatusPill';
import { useAuth } from '../../../contexts/AuthContext';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { Organization, UserProfile } from '../../../types';
import { ACCESS_CHANGED_EVENT, fetchAccess, RemovalDialog, type AccessSnapshot } from '../../project-access';
import { ProjectPeoplePage, useProjectOfficeContext } from '../../project-offices';
import type { Task } from '../../tasks';
import { fetchMembers } from '../services/memberService';
import type { MemberOffice, MembersSnapshot, SelectedMember } from '../types';
import { MemberDirectory } from './MemberDirectory';
import '../projectMembers.css';

interface ProjectMembersProps {
  projectId: string;
  projectStatus: string;
  projectTitle?: string;
  projectLeadId?: string;
  governed?: boolean;
  organizations?: Organization[];
  profiles: UserProfile[];
  tasks: Task[];
  onOpenTask: (id: string) => void;
}

export function ProjectMembers(props: ProjectMembersProps) {
  const { user } = useAuth();
  return <MembersContent key={`${user?.id}:${props.projectId}`} {...props} />;
}

function MembersContent({ projectId, projectStatus, projectTitle, projectLeadId, governed = false, organizations = [], profiles, tasks, onOpenTask }: ProjectMembersProps) {
  const officeState = useProjectOfficeContext();
  const [data, setData] = useState<MembersSnapshot>();
  const [access, setAccess] = useState<AccessSnapshot>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [office, setOffice] = useState<MemberOffice>();
  const [removing, setRemoving] = useState<SelectedMember>();
  const active = useRef(true);
  const generation = useRef(0);
  const hold = useRef(false);
  hold.current = !!office || !!removing;

  async function reload() {
    const run = ++generation.current;
    setData(undefined);
    setError('');
    setLoading(true);
    try {
      const next = await fetchMembers(projectId);
      const permissions = await fetchAccess(projectId).catch(() => undefined);
      if (active.current && run === generation.current) {
        setData(next);
        setAccess(permissions);
      }
    } catch (reason) {
      if (active.current && run === generation.current) setError((reason as Error).message);
    } finally {
      if (active.current && run === generation.current) setLoading(false);
    }
  }

  useEffect(() => {
    active.current = true;
    void reload();
    const refresh = () => { if (!hold.current) void reload(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(ACCESS_CHANGED_EVENT, refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      active.current = false;
      ++generation.current;
      window.removeEventListener('focus', refresh);
      window.removeEventListener(ACCESS_CHANGED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [projectId]);

  const closed = ['completed', 'archived'].includes(projectStatus);
  const filter = query.trim().toLowerCase();
  const visible = data?.members.filter(member => `${member.name} ${member.office_name || ''} ${member.engagement}`.toLowerCase().includes(filter)) ?? [];

  return <section className="r7-members project-members" aria-label="Project Members">
    <header className="project-members-header">
      <div>
        <h2>Members</h2>
        {data && <p role="status">{filter ? `${visible.length} of ${data.members.length}` : data.members.length} {data.members.length === 1 ? 'member' : 'members'}</p>}
      </div>
      <label className="project-members-search">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Search project members</span>
        <input type="search" placeholder="Search name, office or engagement" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
    </header>

    {!!data?.offices.length && <ul className="project-members-offices" aria-label="Participating offices">
      {data.offices.map(item => {
        const count = data.members.filter(member => member.office === item.office_id).length;
        return <li key={item.id} className="project-members-office">
          <div className="project-members-office-main">
            <span className="project-members-office-icon"><Building2 size={18} aria-hidden="true" /></span>
            <div>
              <h3>{item.name}</h3>
              <p>{item.relationship_type === 'lead' ? 'Lead office' : item.relationship_type === 'observer' ? 'Observer office' : 'Collaborating office'} · {count} {count === 1 ? 'member' : 'members'}</p>
            </div>
            <StatusPill label={item.invitation_status.replace(/_/g, ' ')} tone={item.invitation_status === 'joined' ? 'positive' : 'neutral'} />
            {!closed && !governed && item.can_select && item.invitation_status === 'joined' && item.relationship_type !== 'observer' &&
              <button type="button" className="project-members-add" aria-label={`+ Add people · ${item.name}`} onClick={() => setOffice(item)}>
                <UserPlus size={16} aria-hidden="true" /> Add people
              </button>}
          </div>
          {item.eligible_count === 0 && <p className="project-members-office-note">No onboarded eligible staff in this office.</p>}
        </li>;
      })}
    </ul>}

    <div className="project-members-roster" aria-busy={loading}>
      {loading && <div role="status" aria-label="Loading project members" className="project-members-loading">
        {[0, 1, 2].map(row => <Skeleton key={row} type="rectangle" size="custom" height={40} fullWidth />)}
      </div>}
      {error && <FeedbackState tone="error" title="Project members unavailable" onRetry={() => void reload()}>{error}</FeedbackState>}
      {data && (visible.length ? <MemberDirectory members={visible} snapshot={data} access={access} closed={closed}
        onOpenTask={onOpenTask} onRemove={setRemoving} /> :
        <EmptyState illustration={filter ? 'search' : 'people'} title={filter ? 'No project members match' : 'No project members yet'}
          description={filter ? 'Try a different name, office or engagement.' : 'The appointed Office Head chooses who joins the project.'} size="compact" />)}
    </div>

    {removing && <RemovalDialog project={projectId} user={removing.user_id} office={data?.kind === 'personal' ? null : removing.office}
      name={removing.name} onClose={() => setRemoving(undefined)} onRemoved={async () => { await officeState?.refresh(); await reload(); }} />}
    {office && <FeatureDialog title="Add people" onClose={() => void requestNavigation(() => setOffice(undefined))} contentClassName="!max-w-3xl">
      <div className="project-members-people-dialog">
        <h2>Add people</h2><p>{projectTitle || office.name}</p>
        <ProjectPeoplePage modal projectLeadId={projectLeadId} projectTitle={projectTitle || office.name} projectStatus={projectStatus} governed={governed}
          profiles={profiles} organizations={organizations} tasks={tasks} onClose={() => setOffice(undefined)} onOpenTask={onOpenTask} onSaved={reload} />
      </div>
    </FeatureDialog>}
  </section>;
}
