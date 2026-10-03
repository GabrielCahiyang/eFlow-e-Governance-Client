import type { ReactNode } from "react";
import { Folder, Renew, Report, Settings, UserMultiple } from "@carbon/icons-react";
import { normalizeUserRole } from "../../shared/roles";
import { getCoreRoleNavigation } from "../../components/Layout/coreWorkflowNavigation";

export interface RoleNavItem {
  id: string;
  icon: ReactNode;
  label: string;
  requiresLeadership?: boolean;
  requiresHead?: boolean;
}
export interface RoleNavigation {
  navItems: RoleNavItem[];
  defaultSection: string;
  defaultPages?: Record<string, string>;
}

const administrativeDestinations: RoleNavItem[] = [
  { id: "users", icon: <UserMultiple size={16} />, label: "User Management" },
  { id: "org_tree", icon: <Folder size={16} />, label: "Office Structure" },
  { id: "audit", icon: <Report size={16} />, label: "Account Audit" },
  { id: "administration", icon: <Settings size={16} />, label: "System Settings" },
  { id: "migration", icon: <Renew size={16} />, label: "Backup & Export" },
];

export function getRoleNavigation(role: string): RoleNavigation {
  try {
    return getCoreRoleNavigation(normalizeUserRole(role)) || { navItems: [], defaultSection: "unavailable" };
  } catch {
    return { navItems: [], defaultSection: "unavailable" };
  }
}

/** Explicit account-support permissions can add destinations for operational roles. */
export function getRoleNavigationCandidates(role: string): RoleNavItem[] {
  const base = getRoleNavigation(role).navItems;
  let canonical;
  try { canonical = normalizeUserRole(role); } catch { return []; }
  if (canonical === "admin") return base;
  const existing = new Set(base.map(item => item.id));
  return [...base, ...administrativeDestinations.filter(item => !existing.has(item.id))];
}

/** A Task Lead gains contextual destinations while actually leading visible work. */
export function isRoleNavigationItemVisible(
  item: Pick<RoleNavItem, "requiresLeadership" | "requiresHead">,
  hasLeadingWork: boolean,
  persistedRole?: string,
): boolean {
  if (item.requiresHead && persistedRole !== "head") return false;
  return !item.requiresLeadership || hasLeadingWork;
}

export function getDefaultSection(role: string): string {
  return getRoleNavigation(role).defaultSection;
}
