"""Canonical eFlow account roles; workspace authority remains contextual."""
ROLE_ALIASES = {"admin":"admin", "super_admin":"admin", "head":"head", "dept_head":"head", "department_head":"head", "member":"member", "employee":"member", "assistant_head":"member", "accounting_staff":"accounting_staff"}
ADMIN_PERMISSIONS = frozenset({"navigation.user_management", "users.manage", "navigation.organization", "navigation.audit", "audit.read", "navigation.system_settings", "settings.manage", "navigation.data_tools", "database.backup"})
def normalize_account_role(role: str) -> str:
    if not isinstance(role, str) or role not in ROLE_ALIASES:
        raise ValueError("Unsupported account role. Ask an Admin to correct this account.")
    return ROLE_ALIASES[role]
