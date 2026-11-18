import type { ProjectOffice, ProjectOfficeMember } from './types';
import type { Task } from '../tasks';
import type { UserProfile, Organization } from '../../types';
import { isAppointedOfficeHead } from '../../shared/officeAuthority';

export function canStaffProjectOffice(office: ProjectOffice | undefined, user: UserProfile | null | undefined, organizations: Organization[]) {
  return !!office && office.invitation_status === 'joined' && office.relationship_type !== 'observer' && isAppointedOfficeHead(user, organizations) && user?.org_id === office.office_id;
}
export function canHandoverTask(task: Task, hasSubitems: boolean) {
  return task.status === 'pending_assignment' && !task.archivedAt && !task.assigneeId && !task.recommendationLeadId && !(task.teamMemberIds || []).length && !hasSubitems;
}
export function projectOfficePeople(office: ProjectOffice | undefined, members: ProjectOfficeMember[], profiles: UserProfile[], organizations: Organization[]) {
  if (!office || office.invitation_status !== 'joined' || office.relationship_type === 'observer') return [];
  void members;
  void organizations;
  return profiles.filter(p => p.is_active && !['admin', 'super_admin', 'viewer'].includes(p.role) && p.org_id === office.office_id);
}
