import type { PagePermissionKey } from "../permissions";

const SECTION_PERMISSIONS: Record<string, PagePermissionKey> = {
  personal_work: "navigation.tasks",
  projects: "navigation.projects",
  budget: "navigation.projects",
  tasks: "navigation.tasks",
  subtasks: "navigation.tasks",
  leading: "navigation.tasks",
  deadlines: "navigation.tasks",
  history: "navigation.tasks",
  performance: "navigation.reports",
  reviews: "navigation.reviews",
  team: "navigation.team_supervision",
  identity: "navigation.team_supervision",
  intelligence: "navigation.team_intelligence",
  reports: "navigation.reports",
  announcements: "navigation.announcements",
  users: "navigation.user_management",
  permissions: "navigation.user_management",
  org_tree: "navigation.organization",
  audit: "navigation.audit",
  administration: "navigation.system_settings",
  migration: "navigation.data_tools",
  accounting_overview: "navigation.accounting_overview",
  accounting_releases: "navigation.accounting_releases",
  accounting_journal: "navigation.accounting_journal",
  accounting_audit: "navigation.accounting_audit",
  accounting_budgets: "navigation.department_budgets",
};

const ENTITLEMENT_ROLES = new Set([
  "admin",
  "head",
  "member",
  "accounting_staff",
]);

export const ADMINISTRATIVE_NAVIGATION_SECTIONS = [
  "users",
  "org_tree",
  "audit",
  "administration",
  "migration",
] as const;

const ADMINISTRATIVE_SECTION_SET = new Set<string>(
  ADMINISTRATIVE_NAVIGATION_SECTIONS,
);

export function isAdministrativeNavigationSection(section: string): boolean {
  return ADMINISTRATIVE_SECTION_SET.has(section);
}

export function getNavigationPermission(
  role: string,
  section: string,
): PagePermissionKey | undefined {
  if (
    section === "settings" ||
    section === "dashboard" ||
    section === "command"
  )
    return undefined;
  if (!ENTITLEMENT_ROLES.has(role)) return undefined;
  return SECTION_PERMISSIONS[section];
}

export function canOpenNavigationSection(
  role: string,
  section: string,
  can: (permission: string) => boolean,
  contextualLeadershipAccess = false,
): boolean {
  if (!ENTITLEMENT_ROLES.has(role)) return false;
  if (section === "inbox") return true;
  if (role === "admin" && !isAdministrativeNavigationSection(section) && section !== "permissions" && section !== "settings") return false;
  // Task leadership is assigned operationally, not through a permanent
  // account role. An assigned Task Lead must always be able to open both the
  // leading-work surface and its paired review queue. Database reviewer/RLS
  // rules still decide which records and actions are actually available.
  if (contextualLeadershipAccess) return true;
  const permission = getNavigationPermission(role, section);
  return !permission || can(permission);
}
