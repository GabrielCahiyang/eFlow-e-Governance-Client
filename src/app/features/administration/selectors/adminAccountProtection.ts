import { isAdminRole } from "../../../shared/roles";
import type { UserProfile } from "../../../types";

export function isLastActiveAdmin(
  profile: Pick<UserProfile, "id" | "role" | "is_active">,
  profiles: readonly Pick<UserProfile, "id" | "role" | "is_active">[],
): boolean {
  return profile.is_active && isAdminRole(profile.role)
    && !profiles.some((other) => other.id !== profile.id && other.is_active && isAdminRole(other.role));
}
