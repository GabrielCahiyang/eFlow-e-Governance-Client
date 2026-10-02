"""Administrative identity shared by the gateway and legacy-profile adapter."""


def is_administrator(role: str | None) -> bool:
    return role in {"admin", "super_admin"}


def normalize_administrative_role(role: str) -> str:
    return "admin" if is_administrator(role) else role
