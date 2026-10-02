import { isAdminRole } from "../../shared/roles";
import { FALLBACK_DEFAULTS, type PermissionKey } from "./constants";
import type { RolePermissionRow, UserOverrideRow } from "./types";

export function resolvePermissions(
  role: string,
  rolePermissions: RolePermissionRow[],
  overrides: UserOverrideRow[],
): Set<string> {
  if (isAdminRole(role)) return new Set(FALLBACK_DEFAULTS.admin);
  const result = new Set<string>();
  const roleRows = rolePermissions.filter((row) => row.role === role);
  const persisted = new Set(roleRows.map((row) => row.permission));
  (FALLBACK_DEFAULTS[role] || []).forEach((permission) => {
    if (!persisted.has(permission)) result.add(permission);
  });
  roleRows.forEach((row) => row.allowed ? result.add(row.permission) : result.delete(row.permission));
  overrides.forEach((row) => row.allowed ? result.add(row.permission) : result.delete(row.permission));
  return result;
}

export function rolePermissionAllowed(role: string, permission: string, rows: RolePermissionRow[]): boolean {
  if (isAdminRole(role)) return true;
  const stored = rows.find((row) => row.role === role && row.permission === permission);
  if (stored) return stored.allowed;
  return (FALLBACK_DEFAULTS[role] || []).includes(permission as PermissionKey);
}
