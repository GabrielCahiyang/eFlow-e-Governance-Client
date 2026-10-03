import { isAdminRole } from "../../../shared/roles";
import type { Employee } from "../../../services/employeeService";
import type { UserProfile } from "../../../types";

export interface DepartmentDirectoryEligibilityOptions {
  scopedOrgIds: ReadonlySet<string>;
  currentUserId?: string;
  currentUserEmail?: string;
  headUserIds?: ReadonlySet<string>;
  headUserEmails?: ReadonlySet<string>;
  includeCurrentUser?: boolean;
  includeDepartmentHeads?: boolean;
  activeOnly?: boolean;
  excludeAdmins?: boolean;
}

const isHeadRole = (role?: string) =>
  role === "head";

/**
 * Applies role and organization eligibility without coupling assignment rules
 * to React. Assignment surfaces opt into Head/self inclusion; reporting and
 * supervision consumers retain their existing directory behavior.
 */
export function isEligibleDepartmentDirectoryEmployee(
  employee: Employee,
  profile: Partial<UserProfile> | undefined,
  options: DepartmentDirectoryEligibilityOptions,
): boolean {
  if (!employee.department || !options.scopedOrgIds.has(employee.department)) {
    return false;
  }

  if (
    options.activeOnly &&
    profile &&
    (profile.is_active === false || profile.status === "inactive")
  ) {
    return false;
  }

  if (options.excludeAdmins && isAdminRole(profile?.role)) {
    return false;
  }

  const normalizedEmail = employee.email?.toLowerCase();
  if (!options.includeCurrentUser) {
    if (options.currentUserId && employee.id === options.currentUserId) {
      return false;
    }
    if (
      options.currentUserEmail &&
      normalizedEmail === options.currentUserEmail.toLowerCase()
    ) {
      return false;
    }
  }

  if (!options.includeDepartmentHeads) {
    if (isHeadRole(profile?.role)) return false;
    if (options.headUserIds?.has(employee.id)) return false;
    if (normalizedEmail && options.headUserEmails?.has(normalizedEmail)) {
      return false;
    }
  }

  return true;
}
