export interface ProjectGuest {
  user_id: string; full_name: string; email: string; sponsor_office: string;
  is_active: boolean; unassigned_since: string | null; deactivates_at: string | null;
  deactivated_at: string | null; deactivation_reason: string | null; registered_at: string;
  finance_open: boolean; projects: { id: string; title: string }[];
}
export interface GuestAccountEvent { id: string; action: string; reason: string; created_at: string; actor: string }
export type GuestFilter = 'all' | 'active' | 'unassigned' | 'soon' | 'deactivated';

export function guestStatus(guest: ProjectGuest, now = Date.now()) {
  if (!guest.is_active) return { label: 'Deactivated', tone: 'neutral' };
  if (guest.projects.length) return { label: 'Active', tone: 'positive' };
  if (guest.finance_open) return { label: 'Cleanup paused · open cash', tone: 'warning' };
  const remaining = guest.deactivates_at ? Date.parse(guest.deactivates_at) - now : 7 * 86400000;
  return { label: remaining <= 0 ? 'Deactivation due' : `Deactivates in ${Math.ceil(remaining / 86400000)} day${Math.ceil(remaining / 86400000) === 1 ? '' : 's'}`, tone: 'warning' };
}
export function guestMatches(guest: ProjectGuest, filter: GuestFilter, now = Date.now()) {
  if (filter === 'active') return guest.is_active;
  if (filter === 'unassigned') return guest.is_active && !guest.projects.length;
  if (filter === 'deactivated') return !guest.is_active;
  if (filter === 'soon') return guest.is_active && !guest.projects.length && !guest.finance_open && !!guest.deactivates_at && Date.parse(guest.deactivates_at) - now <= 2 * 86400000;
  return true;
}
/** An ordinary invitation does not make a permanent employee a project guest. */
export function isTemporaryGuestProfile(profile: {id: string; employee_id?: string; org_id?: string | null; role: string}) {
  return profile.role === 'member' && !profile.org_id && profile.employee_id === 'GUEST-' + profile.id;
}
