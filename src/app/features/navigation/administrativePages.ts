/** One support-page contract for discovery and direct content resolution. */
export const administrativePages = [
  {
    label: "All Users",
    supportGroup: "People",
    section: "users",
    permission: "navigation.user_management",
  },
  {
    label: "Locked out accounts",
    supportGroup: "People",
    section: "users",
    permission: "navigation.user_management",
    adminOnly: true,
  },
  {
    label: "Role Defaults",
    supportGroup: "Access",
    section: "users",
    permission: "navigation.user_management",
    adminOnly: true,
  },
  {
    label: "User Access",
    supportGroup: "Access",
    section: "users",
    permission: "navigation.user_management",
    adminOnly: true,
  },
  {
    label: "Office Structure",
    supportGroup: "Offices",
    section: "org_tree",
    permission: "navigation.organization",
  },
  { label: "Account Audit", supportGroup: "Audit", section: "audit", permission: "navigation.audit" },
  {
    label: "System Settings",
    supportGroup: "Configuration",
    section: "administration",
    permission: "navigation.system_settings",
  },
  {
    label: "Workspace Policy",
    supportGroup: "Configuration",
    section: "administration",
    permission: "navigation.system_settings",
  },
  {
    label: "Email & Integrations",
    supportGroup: "Configuration",
    section: "administration",
    permission: "navigation.system_settings",
  },
  {
    label: "Runtime / AI Health",
    supportGroup: "Configuration",
    section: "administration",
    permission: "navigation.system_settings",
  },
  {
    label: "Backup & Export",
    supportGroup: "Data",
    section: "migration",
    permission: "navigation.data_tools",
  },
] as const;

/** Presentation order only; the authorized page contract remains above. */
export const supportGroupOrder = ['People', 'Offices', 'Access', 'Configuration', 'Audit', 'Data'] as const;
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

export function resolveSupportPage(section: string, page?: string) {
  if (section === "permissions") return "Role Defaults";
  if (section !== "users")
    return (
      administrativePages.find(
        (item) => item.section === section && item.label === page,
      )?.label ||
      administrativePages.find((item) => item.section === section)?.label
    );
  return (
    administrativePages.find((item) => item.label === page)?.label ||
    "All Users"
  );
}
