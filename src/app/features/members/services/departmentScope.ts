import { getDescendantOrgIds } from "../../../../lib/supabaseService";
import type { Organization } from "../../../types";

export type DepartmentEmployeeScope = "exact" | "with_children";

export function getDepartmentEmployeeScopeIds(
  organizations: Organization[],
  departmentId: string | null | undefined,
  scope: DepartmentEmployeeScope,
) {
  if (!departmentId) return new Set<string>();
  if (scope === "exact") return new Set([departmentId]);
  return new Set(getDescendantOrgIds(organizations, departmentId));
}
