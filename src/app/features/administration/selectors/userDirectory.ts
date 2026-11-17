import type { UserProfile } from "../../../types";

const BUILTIN_ROLES = new Set(["admin", "head", "accounting_staff", "member"]);

export type UserDirectoryStatus = "all" | "active" | "inactive";
export type UserDirectorySort = "name-asc" | "name-desc" | "organization-asc" | "organization-desc" | "workload-desc";

export interface UserDirectoryFilters {
  organizationId: string;
  role: string;
  status: UserDirectoryStatus;
  sort: UserDirectorySort;
}

export const DEFAULT_USER_DIRECTORY_FILTERS: UserDirectoryFilters = {
  organizationId: "all",
  role: "all",
  status: "all",
  sort: "name-asc",
};

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
}

export function filterAndSortUserDirectory(
  profiles: UserProfile[],
  organizationNames: Record<string, string>,
  filters: UserDirectoryFilters,
) {
  const filtered = profiles.filter((profile) => {
    if (filters.organizationId !== "all" && profile.org_id !== filters.organizationId) return false;
    if (filters.role !== "all") {
      if (BUILTIN_ROLES.has(filters.role)) {
        if (profile.role !== filters.role) return false;
      } else if (profile.custom_role_key !== filters.role) {
        return false;
      }
    }
    if (filters.status === "active" && !profile.is_active) return false;
    if (filters.status === "inactive" && profile.is_active) return false;
    return true;
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === "name-asc") return compareText(left.full_name, right.full_name);
    if (filters.sort === "name-desc") return compareText(right.full_name, left.full_name);
    if (filters.sort === "workload-desc") return right.workload - left.workload || compareText(left.full_name, right.full_name);

    const leftOrganization = organizationNames[left.org_id || ""] || "\uffff";
    const rightOrganization = organizationNames[right.org_id || ""] || "\uffff";
    const organizationOrder = compareText(leftOrganization, rightOrganization);
    const direction = filters.sort === "organization-desc" ? -1 : 1;
    return organizationOrder * direction || compareText(left.full_name, right.full_name);
  });
}

export function hasUserDirectoryFilters(filters: UserDirectoryFilters) {
  return filters.organizationId !== "all"
    || filters.role !== "all"
    || filters.status !== "all"
    || filters.sort !== "name-asc";
}
