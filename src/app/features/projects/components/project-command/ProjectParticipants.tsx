import type { ProjectOfficeState } from '../../../project-offices';
import type { UserProfile } from '../../../../types';
import { FeedbackState } from '../../../../components/ui/FeedbackState';
import { PeopleAvatarStack } from '../../../../components/ui/workspace';
import { useParticipantAvatars } from '../../hooks/useParticipantAvatars';

/** Present already loaded participants; identity labels never grant project access. */
export function ProjectParticipants({ offices, profiles, contributorIds, scope = '', profilesLoading = false }: { offices: ProjectOfficeState; profiles: UserProfile[]; contributorIds: string[]; scope?: string; profilesLoading?: boolean }) {
  const contributors = [...new Set(contributorIds.filter(Boolean))];
  const joined = offices.offices.filter(office => office.invitation_status === 'joined').length;
  const avatars = useParticipantAvatars(profiles, contributors, scope);
  if (offices.loading || profilesLoading) return <p role="status">Loading project participants…</p>;
  if (offices.error) return <FeedbackState tone="error" title="Project participants unavailable" onRetry={() => { void offices.refresh(); }}>{offices.error}</FeedbackState>;
  return <div className="eflow-project-identity__participants">
    <span className="sr-only">{joined} joined {joined === 1 ? 'Office' : 'Offices'}; {contributors.length} project {contributors.length === 1 ? 'contributor' : 'contributors'}.</span>
    <PeopleAvatarStack people={contributors.map(id => ({id, name: profiles.find(profile => profile.id === id)?.full_name || 'Name unavailable', avatarUrl: avatars[id]}))} />
    {offices.identityError && <FeedbackState tone="warning" title="Local Office identities unavailable" onRetry={() => { void offices.refresh(); }}>{offices.identityError}</FeedbackState>}
  </div>;
}
