export const PAGE_PERMISSION_KEYS = [
  "navigation.projects",
  "navigation.tasks",
  "navigation.reviews",
  "navigation.team_supervision",
  "navigation.team_intelligence",
  "navigation.reports",
  "navigation.announcements",
  "navigation.user_management",
  "navigation.organization",
  "navigation.audit",
  "navigation.system_settings",
  "navigation.data_tools",
  "navigation.accounting_overview",
  "navigation.accounting_releases",
  "navigation.accounting_journal",
  "navigation.accounting_audit",
  "navigation.department_budgets",
] as const;

export const ACTION_PERMISSION_KEYS = [
  "projects.create",
  "projects.archive",
  "projects.delete",
  "tasks.assign",
  "tasks.verify",
  "reports.export",
  "announcements.publish",
  "users.manage",
  "audit.read",
  "settings.manage",
  "database.backup",
  "accounting.release_cash",
  "accounting.settle_liquidation",
  "accounting.post_journal",
] as const;

export const PERMISSION_KEYS = [...PAGE_PERMISSION_KEYS, ...ACTION_PERMISSION_KEYS] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PagePermissionKey = (typeof PAGE_PERMISSION_KEYS)[number];

export const PERMISSIONS_CHANGED_EVENT = "eflow:permissions-changed";
export const PERMISSIONS_CHANGED_STORAGE_KEY = "eflow.permissions.changed";

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "navigation.projects": "Open Projects",
  "navigation.tasks": "Open Tasks and Subtasks",
  "navigation.reviews": "Open Review Queues",
  "navigation.team_supervision": "Open Team Supervision",
  "navigation.team_intelligence": "Open Team Intelligence",
  "navigation.reports": "Open Reports",
  "navigation.announcements": "Open Announcements",
  "navigation.user_management": "Open User Management",
  "navigation.organization": "Open Organization Structure",
  "navigation.audit": "Open Audit Log",
  "navigation.system_settings": "Open System Settings",
  "navigation.data_tools": "Open Data Tools",
  "navigation.accounting_overview": "Open Accounting Overview",
  "navigation.accounting_releases": "Open Voucher and Cash Releases",
  "navigation.accounting_journal": "Open General Journal",
  "navigation.accounting_audit": "Open Financial Audit Trail",
  "navigation.department_budgets": "Open Office Budget Ledgers",
  "projects.create": "Create projects",
  "projects.archive": "Archive or restore projects",
  "projects.delete": "Permanently delete projects",
  "tasks.assign": "Assign and reassign tasks",
  "tasks.verify": "Review and verify submissions",
  "reports.export": "Export reports (CSV or PDF)",
  "announcements.publish": "Publish announcements",
  "users.manage": "Manage users and accounts",
  "audit.read": "Read the audit log",
  "settings.manage": "Manage system settings",
  "database.backup": "Generate database backups",
  "accounting.release_cash": "Record cash and cheque releases",
  "accounting.settle_liquidation": "Verify and settle liquidations",
  "accounting.post_journal": "Post controlled journal entries",
};

export const MANAGED_ROLES = [
  { key: "admin", label: "Admin" }, { key: "head", label: "Head" },
  { key: "accounting_staff", label: "Accounting Staff" }, { key: "member", label: "Member" },
] as const;
export const ADMIN_PERMISSIONS: readonly PermissionKey[] = [
  "navigation.user_management", "users.manage", "navigation.organization", "navigation.audit",
  "audit.read", "navigation.system_settings", "settings.manage", "navigation.data_tools", "database.backup",
];
const MEMBER_PERMISSIONS: readonly PermissionKey[] = [
  "navigation.projects", "navigation.tasks", "navigation.reports", "navigation.announcements", "reports.export",
];
export const FALLBACK_DEFAULTS: Record<string, readonly PermissionKey[]> = {
  admin: ADMIN_PERMISSIONS,
  head: [...MEMBER_PERMISSIONS, "navigation.reviews", "navigation.team_supervision", "navigation.team_intelligence", "navigation.department_budgets",
    "projects.create", "projects.archive", "projects.delete", "tasks.assign", "tasks.verify"],
  member: MEMBER_PERMISSIONS,
  accounting_staff: [...MEMBER_PERMISSIONS, "navigation.accounting_overview", "navigation.accounting_releases",
    "navigation.accounting_journal", "navigation.accounting_audit", "navigation.department_budgets",
    "accounting.release_cash", "accounting.settle_liquidation", "accounting.post_journal"],
};
export const ACCESS_LEVELS = [
  { value: "read", label: "Read", description: "View scoped work and reports." },
  { value: "review", label: "Review", description: "View and review routed work." },
  { value: "manage", label: "Manage", description: "Manage scoped projects and tasks." },
] as const;
