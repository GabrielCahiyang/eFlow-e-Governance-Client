import { isAdminRole } from "../../shared/roles";
import { FALLBACK_DEFAULTS, type PermissionKey } from "./constants";
import type { CustomRoleSummary, RolePermissionRow, UserOverrideRow } from "./types";

export function resolvePermissions(
  role: string,
  rolePermissions: RolePermissionRow[],
  overrides: UserOverrideRow[],
  customRole?: Pick<CustomRoleSummary, "key" | "baseRole"> | null,
): Set<string> {
  if (isAdminRole(role)) return new Set(FALLBACK_DEFAULTS.admin);
  const result = new Set<string>();
  const targetRole = customRole?.key || role;
  const fallbackRole = customRole?.baseRole || role;
  const roleRows = rolePermissions.filter((row) => row.role === targetRole);
  const persisted = new Set(roleRows.map((row) => row.permission));
  (FALLBACK_DEFAULTS[fallbackRole] || []).forEach((permission) => {
    if (!persisted.has(permission)) result.add(permission);
  });
  roleRows.forEach((row) => row.allowed ? result.add(row.permission) : result.delete(row.permission));
  overrides.forEach((row) => row.allowed ? result.add(row.permission) : result.delete(row.permission));
  return result;
}

export function rolePermissionAllowed(
  role: string,
  permission: string,
  rows: RolePermissionRow[],
  fallbackRole?: string,
): boolean {
  if (isAdminRole(role)) return FALLBACK_DEFAULTS.admin.includes(permission as PermissionKey);
  const stored = rows.find((row) => row.role === role && row.permission === permission);
  if (stored) return stored.allowed;
  const baseKey = fallbackRole || role;
  return (FALLBACK_DEFAULTS[baseKey] || []).includes(permission as PermissionKey);
}
