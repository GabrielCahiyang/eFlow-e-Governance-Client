import type { UserRole } from "../types";
export const ADMIN_ROLE: UserRole = "admin";
export const HEAD_ROLE: UserRole = "head";
export const ACCOUNTING_ROLE: UserRole = "accounting_staff";
export const MEMBER_ROLE: UserRole = "member";
const ROLE_ALIASES: Record<string, UserRole> = {
  admin: ADMIN_ROLE, super_admin: ADMIN_ROLE,
  head: HEAD_ROLE, dept_head: HEAD_ROLE, department_head: HEAD_ROLE,
  accounting_staff: ACCOUNTING_ROLE,
  member: MEMBER_ROLE, employee: MEMBER_ROLE, assistant_head: MEMBER_ROLE,
};
/** The only translation boundary for persisted legacy account roles. */
export function normalizeUserRole(rawRole: unknown): UserRole {
  const role = typeof rawRole === "string" && Object.prototype.hasOwnProperty.call(ROLE_ALIASES, rawRole) ? ROLE_ALIASES[rawRole] : undefined;
  if (!role) throw new Error("Unsupported account role. Ask an Admin to correct this account.");
  return role;
}
export function isAdminRole(role: string | null | undefined): boolean { return role === ADMIN_ROLE || role === "super_admin"; }
export function isHeadWorkspaceRole(role: string | null | undefined): boolean { return role === HEAD_ROLE || role === "dept_head" || role === "department_head"; }
export function getRoleLabel(role: string): string {
  try { return { admin: "Admin", head: "Head", accounting_staff: "Accounting Staff", member: "Member" }[normalizeUserRole(role)]; }
  catch { return "Unsupported role"; }
}
export function getHeadWorkspaceLabel(_role?: string | null): "Head" { return "Head"; }
