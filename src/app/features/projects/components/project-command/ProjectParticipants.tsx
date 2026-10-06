import type { ProjectOfficeState } from '../../../project-offices';
import type { UserProfile } from '../../../../types';
import { FeedbackState } from '../../../../components/ui/FeedbackState';

/** Present already loaded participants; identity labels never grant project access. */
export function ProjectParticipants({ offices, profiles, contributorIds }: { offices: ProjectOfficeState; profiles: UserProfile[]; contributorIds: string[] }) {
  const contributors = [...new Set(contributorIds.filter(Boolean))];
  const joined = offices.offices.filter(office => office.invitation_status === 'joined').length;
  if (offices.loading) return <p role="status">Loading project participants…</p>;
  if (offices.error) return <FeedbackState tone="error" title="Project participants unavailable" onRetry={() => { void offices.refresh(); }}>{offices.error}</FeedbackState>;
  return <div className="eflow-project-identity__participants">
    <span>{joined} joined {joined === 1 ? 'Office' : 'Offices'} · {contributors.length} {contributors.length === 1 ? 'contributor' : 'contributors'}</span>
    <span className="eflow-project-identity__names">{contributors.slice(0, 3).map(id => profiles.find(profile => profile.id === id)?.full_name || 'Name unavailable').join(', ')}{contributors.length > 3 ? ` +${contributors.length - 3}` : ''}</span>
    {offices.identityError && <FeedbackState tone="warning" title="Local Office identities unavailable" onRetry={() => { void offices.refresh(); }}>{offices.identityError}</FeedbackState>}
  </div>;
}
