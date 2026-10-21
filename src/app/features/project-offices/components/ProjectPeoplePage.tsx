import { Button, Heading, Skeleton } from '@vibe/core';
import { MoveArrowLeft } from '@vibe/icons';
import { useRef } from 'react';
import type { Organization, UserProfile } from '../../../types';
import type { Task } from '../../tasks';
import { useAuth } from '../../../contexts/AuthContext';
import { useProjectOfficeContext } from '../hooks/useProjectOffices';
import { canStaffProjectOffice } from '../selectors';
import { OfficeMembersEditor } from './OfficeMembersEditor';
import { requestNavigation } from '../../../shared/navigationGuard';
import type { ProjectOffice } from '../types';

/** Direct entry to the canonical Office staffing editor, with no alternate membership write. */
export function ProjectPeoplePage({ projectTitle, projectStatus, governed, profiles, profilesLoading = false, organizations, tasks, onClose, onOpenTask, onSaved }: {
  projectTitle: string; projectStatus: string; governed: boolean; profiles: UserProfile[]; profilesLoading?: boolean; organizations: Organization[]; tasks: Task[];
  onClose: () => void; onOpenTask: (id: string) => void; onSaved?: () => Promise<void>;
}) {
  const { user, userProfile } = useAuth();
  const state = useProjectOfficeContext();
  const office = state.offices.find(item => item.office_id === userProfile?.org_id);
  const allowed = !state.loading && !state.error && !governed && !['completed','archived'].includes(projectStatus) && canStaffProjectOffice(office, userProfile, organizations);
  const scope = `${user?.id}:${state.projectId}:${userProfile?.org_id}`;
  const opened = useRef<{scope:string;office:ProjectOffice} | undefined>(undefined);
  if (allowed && office && !profilesLoading) opened.current = {scope,office};
  const editorOffice = opened.current?.scope === scope ? opened.current.office : undefined;
  const reason = state.error || (state.loading || profilesLoading ? 'Checking current project access…' : governed ? 'Manage this team through the approved work plan’s participation workflow.' : ['completed','archived'].includes(projectStatus) ? 'This project is closed. Its team is read-only.' : 'Only the appointed Head of a joined, participating office can choose its project team.');
  return <section className="eflow-project-people-page" aria-label="Add people to project">
    <header><div><Heading type="h2">Add people</Heading><p>{projectTitle}</p>{organizations.find(item=>item.id===userProfile?.org_id)?.name && <p>From your office: {organizations.find(item=>item.id===userProfile?.org_id)?.name}</p>}</div><Button leftIcon={MoveArrowLeft} kind="tertiary" size="small" onClick={() => { void requestNavigation(onClose); }}>Back to project</Button></header>
    <p>Choose colleagues from your office now, or return to this project and add them later.</p>
    <p>Selected people can access this project. AI auto assign also adds its chosen people here.</p>
    {editorOffice ? <>
      {state.error && <div role="alert"><p>{state.error}</p><Button size="small" onClick={() => void state.refresh()}>Retry project people</Button></div>}
      <OfficeMembersEditor key={`${user?.id}:${editorOffice.id}`} office={editorOffice} profiles={profiles} members={state.members} tasks={tasks} actorId={user?.id || ''} disabledReason={allowed && !profilesLoading ? '' : reason} onOpenTask={onOpenTask} onCancel={onClose} onSaved={async () => { await state.refresh(); await onSaved?.(); }}/>
    </> : state.loading || profilesLoading ? <div role="status" aria-label="Loading project people"><Skeleton type="rectangle" size="custom" height={180} fullWidth/></div>
      : state.error ? <div role="alert"><p>{state.error}</p><Button size="small" onClick={() => void state.refresh()}>Retry project people</Button></div>
      : <p role="status">{reason}</p>}
  </section>;
}
