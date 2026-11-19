"""Canonical eFlow account roles; workspace authority remains contextual."""
ROLE_ALIASES = {"admin":"admin", "super_admin":"admin", "head":"head", "dept_head":"head", "department_head":"head", "member":"member", "employee":"member", "assistant_head":"member", "accounting_staff":"accounting_staff"}
ADMIN_PERMISSIONS = frozenset({"navigation.user_management", "users.manage", "navigation.organization", "navigation.audit", "audit.read", "navigation.system_settings", "settings.manage", "navigation.data_tools", "database.backup"})

_MEMBER_DEFAULTS = frozenset({
    "navigation.projects",
    "navigation.tasks",
    "navigation.reports",
    "navigation.announcements",
    "reports.export",
})

FALLBACK_ROLE_DEFAULTS: dict[str, frozenset[str]] = {
    "admin": ADMIN_PERMISSIONS,
    "member": _MEMBER_DEFAULTS,
    "head": _MEMBER_DEFAULTS | frozenset({
        "navigation.reviews",
        "navigation.team_supervision",
        "navigation.team_intelligence",
        "navigation.department_budgets",
        "projects.create",
        "projects.archive",
        "projects.delete",
        "tasks.assign",
        "tasks.verify",
    }),
    "accounting_staff": _MEMBER_DEFAULTS | frozenset({
        "navigation.accounting_overview",
        "navigation.accounting_releases",
        "navigation.accounting_journal",
        "navigation.accounting_audit",
        "navigation.department_budgets",
        "accounting.release_cash",
        "accounting.settle_liquidation",
        "accounting.post_journal",
    }),
}

PERMISSION_PREREQUISITES: dict[str, tuple[str, ...]] = {
    "projects.create": ("navigation.projects",),
    "projects.archive": ("navigation.projects",),
    "projects.delete": ("navigation.projects",),
    "tasks.assign": ("navigation.tasks",),
    "tasks.verify": ("navigation.reviews",),
    "reports.export": ("navigation.reports",),
    "announcements.publish": ("navigation.announcements",),
    "users.manage": ("navigation.user_management",),
    "audit.read": ("navigation.audit",),
    "settings.manage": ("navigation.system_settings",),
    "database.backup": ("navigation.data_tools",),
    "accounting.release_cash": ("navigation.accounting_releases",),
    "accounting.settle_liquidation": ("navigation.accounting_releases",),
    "accounting.post_journal": ("navigation.accounting_journal",),
}


def normalize_account_role(role: str) -> str:
    if not isinstance(role, str) or role not in ROLE_ALIASES:
        raise ValueError("Unsupported account role. Ask an Admin to correct this account.")
    return ROLE_ALIASES[role]
