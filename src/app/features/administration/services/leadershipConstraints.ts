import type { Organization, UserProfile, UserRole } from "../../../types";
export type ManagedLeadershipRole = "head";
export function isManagedLeadershipRole(role: UserRole | string): role is ManagedLeadershipRole { return role === "head"; }
export function getLeadershipSlotConflict({role,orgId,currentUserId,organizations,profiles,customRoleLabel}: {
  role: UserRole | string; orgId: string; currentUserId?: string; organizations: Organization[]; profiles: UserProfile[]; customRoleLabel?: string;
}): string | null {
  if (!isManagedLeadershipRole(role)) return null;
  if (!orgId) return "Head requires an office.";
  const organization = organizations.find(candidate => candidate.id === orgId);
  if (!organization || !organization.is_active) return "Select a valid active office.";
  const occupantId = organization.head_user_id && organization.head_user_id !== currentUserId
    ? organization.head_user_id : profiles.find(profile => profile.id !== currentUserId && profile.is_active && profile.org_id === orgId && profile.role === "head")?.id;
  if (!occupantId) return null;
  const occupant = profiles.find(profile => profile.id === occupantId);
  const conflict = `${organization.name} already has ${occupant?.full_name || 'an assigned user'} as Head.`;
  if (customRoleLabel) return `${customRoleLabel} uses the Head account type. ${conflict} For a Member assignment, change the custom role’s account type in Roles & Access.`;
  return `${conflict} Update the current Head's role in User Management before appointing a replacement.`;
}
