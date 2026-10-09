import type { Organization, UserProfile } from '../../types';
import type { Task } from '../tasks';
import type { Invitation } from '../invitations';
import { isAppointedOfficeHead } from '../../shared/officeAuthority';
import type { ProjectOffice } from './types';
import { isSessionError, userFacingError } from '../../shared/userFacingError';
export const officeRelationship = (o: ProjectOffice) => o.relationship_type === 'lead' ? 'Lead Office' : o.relationship_type === 'observer' ? 'Observer · read only' : 'Collaborating Office';
export const projectOfficeError = (reason: unknown, fallback: string) => userFacingError(reason, fallback);
export function projectOfficeReadError(reasons: unknown[], fallback: string) {
  const messages = [...new Set(reasons.map(reason => projectOfficeError(reason, fallback)))];
  const failures = messages.filter(message => !isSessionError(message));
  return failures.length ? failures.join(' ') : messages[0] || '';
}
export function officeParticipation(o: ProjectOffice, invitation?: Invitation) {
  if (o.invitation_status === 'joined') return 'Joined';
  if (o.invitation_status === 'awaiting_head') return 'Awaiting Office Head confirmation';
  if (o.invitation_status === 'revoked' || invitation?.status === 'revoked') return 'Invitation revoked';
  return invitation?.status === 'expired' ? 'Invitation expired' : 'Invitation pending';
}
export function officeStaffingReason(office: ProjectOffice | undefined, user: UserProfile | null | undefined, organizations: Organization[], status: string, governed: boolean, error = '') {
  if (error) return 'Refresh the authoritative Office data before managing participation.';
  if (!office) return 'This Office participation is no longer available.';
  if (['completed', 'archived'].includes(status)) return 'This project is closed; participation is read only.';
  if (governed) return 'Manage governed participation in Proposal Context.';
  if (office.relationship_type === 'observer') return 'Observers follow progress without staffing work.';
  if (office.invitation_status !== 'joined') return 'The appointed Office Head must confirm joined participation first.';
  if (!isAppointedOfficeHead(user, organizations) || user?.org_id !== office.office_id) return 'Only the appointed Head of this Office selects its project members.';
  return '';
}
export function membershipDiff(baseline: string[], selected: string[]) {
  return { added: [...new Set(selected)].filter(id => !baseline.includes(id)), removed: [...new Set(baseline)].filter(id => !selected.includes(id)) };
}
export function removalWork(office: Pick<ProjectOffice, 'project_id' | 'office_id'>, removed: string[], tasks: Task[]) {
  return tasks.filter(t => t.linkedProjectId === office.project_id && t.orgId === office.office_id && !['completed', 'cancelled'].includes(t.status) && removed.some(id => id === t.assigneeId || id === t.recommendationLeadId || t.teamMemberIds?.includes(id)));
}
