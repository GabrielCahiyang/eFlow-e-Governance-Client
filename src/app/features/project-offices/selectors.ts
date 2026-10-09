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
  if (!office) return [];
  void organizations;
  return profiles.filter(p => p.is_active && p.role !== 'admin' && p.org_id === office.office_id && members.some(m => m.project_office_id === office.id && m.user_id === p.id));
}
