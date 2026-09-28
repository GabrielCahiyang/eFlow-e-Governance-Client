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
  "navigation.department_budgets": "Open Department Budget Ledgers",
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
  { key: "admin", label: "Admin" },
  { key: "dept_head", label: "Head" },
  { key: "assistant_head", label: "Assistant Head" },
  { key: "employee", label: "Employee" },
  { key: "accounting_staff", label: "Accounting Staff" },
  { key: "super_admin", label: "Super Admin" },
] as const;

export const FALLBACK_DEFAULTS: Record<string, readonly PermissionKey[]> = {
  super_admin: PERMISSION_KEYS,
  admin: [
    "navigation.projects", "navigation.reports", "navigation.announcements",
    "navigation.user_management", "navigation.organization", "navigation.audit",
    "navigation.system_settings", "navigation.data_tools", "reports.export",
    "announcements.publish", "users.manage", "audit.read", "settings.manage",
    "database.backup",
  ],
  dept_head: [
    "navigation.projects", "navigation.tasks", "navigation.reviews",
    "navigation.team_supervision", "navigation.team_intelligence",
    "navigation.reports", "navigation.announcements", "projects.create",
    "projects.archive", "projects.delete", "tasks.assign", "tasks.verify", "reports.export",
    "accounting.release_cash", "accounting.settle_liquidation", "accounting.post_journal",
  ],
  assistant_head: [
    "navigation.projects", "navigation.tasks", "navigation.reviews",
    "navigation.team_supervision", "navigation.team_intelligence",
    "navigation.reports", "navigation.announcements", "projects.create",
    "projects.archive", "projects.delete", "tasks.assign", "tasks.verify", "reports.export",
    "accounting.release_cash", "accounting.settle_liquidation", "accounting.post_journal",
  ],
  employee: [
    "navigation.projects", "navigation.tasks", "navigation.reviews",
    "navigation.reports", "navigation.announcements", "reports.export",
  ],
  accounting_staff: [
    // Employee workspace — kept intact when accounting access is assigned
    "navigation.projects", "navigation.tasks", "navigation.reviews",
    "navigation.reports", "navigation.announcements", "reports.export",
    // Accounting-specific workspace — added on top
    "navigation.accounting_overview", "navigation.accounting_releases",
    "navigation.accounting_journal", "navigation.accounting_audit",
    "navigation.department_budgets", "accounting.release_cash",
    "accounting.settle_liquidation", "accounting.post_journal",
  ],
};

export const ACCESS_LEVELS = [
  { value: "read", label: "Read", description: "View scoped work and reports." },
  { value: "review", label: "Review", description: "View and review routed work." },
  { value: "manage", label: "Manage", description: "Manage scoped projects and tasks." },
] as const;
