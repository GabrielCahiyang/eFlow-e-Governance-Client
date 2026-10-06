import type { Organization, UserProfile } from '../types';
export function isAppointedOfficeHead(user: UserProfile | null | undefined, organizations: Organization[]) {
  return !!user?.is_active && user.role === 'head' && organizations.some(o => o.id === user.org_id && o.head_user_id === user.id);
}
