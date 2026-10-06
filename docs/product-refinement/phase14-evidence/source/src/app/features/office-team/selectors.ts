export { isAppointedOfficeHead } from '../../shared/officeAuthority';
import type { OfficeMember } from './types';
export const accountRoleLabel = (role: string) => ({ head: 'Head', member: 'Member', accounting_staff: 'Accounting Staff', admin: 'Admin' }[role] || role);
export function filterOfficeMembers(members: OfficeMember[], query: string, role: string) {
  return members.filter(m => m.is_active && `${m.full_name} ${m.email}`.toLowerCase().includes(query.trim().toLowerCase()) && (role === 'all' || m.role === role));
}
