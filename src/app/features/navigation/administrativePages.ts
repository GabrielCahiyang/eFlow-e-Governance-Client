/** Five consolidated support-center destinations with backward-compatible deep-link resolution. */
export const administrativePages = [
  {
    label: "People & Accounts",
    supportGroup: "People & Access",
    section: "users",
    permission: "navigation.user_management",
  },
  {
    label: "Roles & Access",
    supportGroup: "People & Access",
    section: "users",
    permission: "navigation.user_management",
    adminOnly: true,
  },
  {
    label: "Account Audit",
    supportGroup: "Oversight",
    section: "audit",
    permission: "navigation.audit",
  },
  {
    label: "System & Maintenance",
    supportGroup: "System",
    section: "administration",
    permission: "navigation.system_settings",
  },
  {
    label: "Backup & Export",
    supportGroup: "System",
    section: "migration",
    permission: "navigation.data_tools",
  },
] as const;

export const administrativeSubPages = [
  { label: "Pending Invitations", kind: "People & Access", section: "users", page: "Pending Invitations", adminOnly: true },
  { label: "Lockouts & Security", kind: "People & Access", section: "users", page: "Locked out accounts", adminOnly: true },
  { label: "Role Defaults", kind: "People & Access", section: "users", page: "Role Defaults", adminOnly: true },
  { label: "Individual Access", kind: "People & Access", section: "users", page: "User Access", adminOnly: true },
  { label: "Work Statuses", kind: "System", section: "administration", page: "Status Maintenance", adminOnly: true },
  { label: "Skill Tags", kind: "System", section: "administration", page: "Skill Tags", adminOnly: true },
] as const;

const ADMIN_ONLY_LEGACY_PAGES = new Set([
  "Locked out accounts",
  "Lockouts & Security",
  "Pending Invitations",
  "Project Guests",
  "Role Defaults",
  "User Access",
  "Individual Access",
  "Roles & Access",
  "Status Maintenance",
  "Work Statuses",
  "Skill Tags",
]);

/** Presentation order only; the authorized page contract remains above. */
export const supportGroupOrder = ['People & Access', 'Oversight', 'System'] as const;
export function getSupportPageGroup(label: string) {
  return administrativePages.find(page => page.label === label)?.supportGroup;
}

export function getAuthorizedSupportPages(
  role: string,
  can: (permission: string) => boolean,
) {
  return administrativePages.filter(
    (page) =>
      can(page.permission) && (!("adminOnly" in page) || role === "admin"),
  );
}

export function isSupportPageAuthorized(
  role: string,
  section: string,
  requestedPage: string | undefined,
  can: (permission: string) => boolean,
) {
  const canonicalPage = resolveSupportPage(section, requestedPage);
  if (!canonicalPage) return false;
  const entry = administrativePages.find((item) => item.label === canonicalPage);
  if (!entry || !can(entry.permission)) return false;
  if ("adminOnly" in entry && entry.adminOnly && role !== "admin") return false;
  if (requestedPage && ADMIN_ONLY_LEGACY_PAGES.has(requestedPage) && role !== "admin") return false;
  return true;
}

const PAGE_TO_CANONICAL: Record<string, (typeof administrativePages)[number]["label"]> = {
  "People & Accounts": "People & Accounts",
  "All Users": "People & Accounts",
  "Office Structure": "People & Accounts",
  "Org Structure": "People & Accounts",
  "Pending Invitations": "People & Accounts",
  "Project Guests": "People & Accounts",
  "Locked out accounts": "People & Accounts",
  "Lockouts & Security": "People & Accounts",
  "Roles & Access": "Roles & Access",
  "Role Defaults": "Roles & Access",
  "User Access": "Roles & Access",
  "Individual Access": "Roles & Access",
  "Account Audit": "Account Audit",
  "Audit Log": "Account Audit",
  "System & Maintenance": "System & Maintenance",
  "System & Integrations": "System & Maintenance",
  "System Settings": "System & Maintenance",
  "Status Maintenance": "System & Maintenance",
  "Work Statuses": "System & Maintenance",
  "Skill Tags": "System & Maintenance",
  "Workspace Policy": "System & Maintenance",
  "Email & Integrations": "System & Maintenance",
  "Runtime / AI Health": "System & Maintenance",
  "Email & Runtime Health": "System & Maintenance",
  "Backup & Export": "Backup & Export",
  "Data Tools": "Backup & Export",
  "Backup": "Backup & Export",
};

export function resolveSupportPage(section: string, page?: string) {
  if (page && page in PAGE_TO_CANONICAL) return PAGE_TO_CANONICAL[page];
  if (section === "org_tree" || section === "users") return "People & Accounts";
  if (section === "permissions") return "Roles & Access";
  if (section === "audit") return "Account Audit";
  if (section === "administration") return "System & Maintenance";
  if (section === "migration") return "Backup & Export";
  return undefined;
}

export function resolveSupportSubTab(section: string, page?: string): string | undefined {
  if (page === "Pending Invitations") return "invitations";
  if (page === "Locked out accounts" || page === "Lockouts & Security") return "locked-accounts";
  if (page === "Role Defaults" || (section === "permissions" && !page)) return "role-defaults";
  if (page === "User Access" || page === "Individual Access") return "user-access";
  if (page === "Status Maintenance" || page === "Work Statuses") return "statuses";
  if (page === "Skill Tags") return "skills";
  if (page === "System Settings" || page === "Workspace Policy" || page === "System & Maintenance" || page === "System & Integrations" || page === "Email & Integrations" || page === "Runtime / AI Health" || page === "Email & Runtime Health" || section === "administration") return "general";
  if (page === "All Users" || page === "People & Accounts" || page === "Office Structure" || page === "Org Structure" || section === "users" || section === "org_tree") return "office";
  return undefined;
}
