import { updateProfile } from "../../../../lib/supabaseService";
import type { Organization, UserProfile, UserRole } from "../../../types";
import { assignOrganizationLeadership } from "../../organization";
import { getLeadershipSlotConflict, isManagedLeadershipRole } from "./leadershipConstraints";

export interface ManagedUserProfileChanges {
  full_name: string;
  role: UserRole;
  org_id: string | null;
  skills: Record<string, boolean>;
}

export async function updateManagedUserWithLeadership({
  user,
  changes,
  organizations,
  profiles,
}: {
  user: UserProfile;
  changes: ManagedUserProfileChanges;
  organizations: Organization[];
  profiles: UserProfile[];
}): Promise<void> {
  const targetOrgId = changes.org_id || "";
  const conflict = getLeadershipSlotConflict({
    role: changes.role,
    orgId: targetOrgId,
    currentUserId: user.id,
    organizations,
    profiles,
  });
  if (conflict) throw new Error(conflict);

  const targetIsLeadership = isManagedLeadershipRole(changes.role);
  const leadershipAssignmentChanged = user.role !== changes.role || (user.org_id || "") !== targetOrgId;
  const affectedOrganizations = leadershipAssignmentChanged
    ? organizations.filter((organization) =>
      organization.head_user_id === user.id
      || (targetIsLeadership && organization.id === targetOrgId),
    )
    : [];

  for (const organization of affectedOrganizations) {
    let headUserId = organization.head_user_id;
    if (headUserId === user.id) headUserId = null;
    if (targetIsLeadership && organization.id === targetOrgId) {
      headUserId = user.id;
    }

    if (headUserId !== organization.head_user_id) {
      await assignOrganizationLeadership(organization.id, { headUserId });
    }
  }

  await updateProfile(user.id, changes);
}
