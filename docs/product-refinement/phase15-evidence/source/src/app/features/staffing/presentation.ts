import type { Task } from '../tasks';
import type { UserProfile, Organization } from '../../types';
import { isAppointedOfficeHead } from '../../shared/officeAuthority';
export function staffingEntryReason(task: Task, actor: UserProfile | null, organizations: Organization[], readOnly: boolean) {
  if (!isAppointedOfficeHead(actor, organizations) || actor?.org_id !== task.orgId) return 'Only the appointed Head of the responsible Office can request staffing suggestions.';
  if (readOnly || task.archivedAt || task.proposedOfficeIdentityId) return 'Resolve project access and confirmed Office responsibility before staffing this task.';
  if (task.assigneeId || !['pending_assignment', 'todo'].includes(task.status)) return 'Staffing suggestions require unassigned, unstarted work. Manage an existing owner through the normal task workflow.';
  return '';
}
