import type { ReactNode } from "react";
import { Folder, Report, Settings, UserMultiple } from "@carbon/icons-react";
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

function personalDestinations(role: string): RoleNavItem[] {
  if (role === 'admin') return [];
  return [
    { id: 'personal_work', label: 'My Work', icon: <Folder size={16} /> },
    { id: 'inbox', label: 'Inbox', icon: <Folder size={16} /> },
  ];
}

const administrativeDestinations: RoleNavItem[] = [
  { id: "users", icon: <UserMultiple size={16} />, label: "User Management" },
  { id: "audit", icon: <Report size={16} />, label: "Account Audit" },
  { id: "administration", icon: <Settings size={16} />, label: "System Settings" },
  { id: "migration", icon: <Folder size={16} />, label: "Data Tools" },
];

const delegatedOfficeDestinations: RoleNavItem[] = [
  { id: "budget", icon: <Report size={16} />, label: "Office Budget" },
  { id: "team", icon: <UserMultiple size={16} />, label: "Analytics" },
  { id: "intelligence", icon: <Report size={16} />, label: "Analytics" },
];

export function getRoleNavigation(role: string): RoleNavigation {
  try {
    return getCoreRoleNavigation(normalizeUserRole(role)) || { navItems: [], defaultSection: "unavailable" };
  } catch {
    return { navItems: [], defaultSection: "unavailable" };
  }
}

/** Explicit account-support and delegated office permissions can add destinations for operational roles. */
export function getRoleNavigationCandidates(role: string): RoleNavItem[] {
  const base = getRoleNavigation(role).navItems;
  let canonical;
  try { canonical = normalizeUserRole(role); } catch { return []; }
  if (canonical === "admin") return [...personalDestinations(canonical), ...base];
  const existing = new Set(base.map(item => item.id));
  const overview:RoleNavItem[] = existing.has('dashboard')?[]:[{id:'dashboard',label:'Workspace Overview',icon:<Folder size={16}/> }];
  const delegatedOfficeEntries = delegatedOfficeDestinations.filter(item => {
    if (existing.has(item.id)) return false;
    // Accounting Staff already exposes navigation.department_budgets via accounting_budgets.
    if (canonical === "accounting_staff" && item.id === "budget") return false;
    return true;
  });
  const adminEntries = canonical === "accounting_staff" ? [] : administrativeDestinations.filter(item => !existing.has(item.id));
  return [...personalDestinations(canonical), ...overview, ...base, ...delegatedOfficeEntries, ...adminEntries];
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
