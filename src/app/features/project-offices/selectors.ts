import type { ProjectOffice, ProjectOfficeMember } from './types';
import type { Task } from '../tasks';
import type { UserProfile, Organization } from '../../types';

export function canStaffProjectOffice(office: ProjectOffice | undefined, user: UserProfile | null | undefined, organizations: Organization[]) {
  return !!office && office.invitation_status === 'joined' && office.relationship_type !== 'observer' && !!user?.is_active && user.role === 'head' && user.org_id === office.office_id && organizations.some(o => o.id === office.office_id && o.head_user_id === user.id);
}
export function canHandoverTask(task: Task, hasSubitems: boolean) {
  return task.status === 'pending_assignment' && !task.archivedAt && !task.assigneeId && !task.recommendationLeadId && !(task.teamMemberIds || []).length && !hasSubitems;
}
export function projectOfficePeople(office: ProjectOffice | undefined, members: ProjectOfficeMember[], profiles: UserProfile[], organizations: Organization[]) {
  if (!office) return [];
  const head = organizations.find(o => o.id === office.office_id)?.head_user_id;
  return profiles.filter(p => p.is_active && p.role !== 'admin' && p.org_id === office.office_id && (office.relationship_type === 'lead' || p.id === head || members.some(m => m.project_office_id === office.id && m.user_id === p.id)));
}
