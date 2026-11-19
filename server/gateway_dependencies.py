"""Supabase clients, authentication dependencies, and internal secrets."""

from dataclasses import dataclass
from datetime import datetime
import time
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from gateway_config import settings
from services.recent_auth import is_recent_sign_in
from services.administrative_roles import is_administrator
from services.account_roles import (
    normalize_account_role,
    ADMIN_PERMISSIONS,
    FALLBACK_ROLE_DEFAULTS,
    PERMISSION_PREREQUISITES,
)
from services.database_transport import database_http_client


supabase_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key,
    options=SyncClientOptions(httpx_client=database_http_client()),
)

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str
    role: str
    org_id: Optional[str]
    last_sign_in_at: Optional[str | datetime] = None
    custom_role_key: Optional[str] = None


def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> AuthenticatedUser:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid Supabase session is required.",
        )

    try:
        auth_result = supabase_admin.auth.get_user(credentials.credentials)
        auth_user = auth_result.user
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase session.",
        ) from exc

    if not auth_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase session.",
        )

    try:
        profile_result = (
            supabase_admin.table("profiles")
            .select("id,email,role,custom_role_key,org_id,is_active")
            .eq("id", str(auth_user.id))
            .single()
            .execute()
        )
        profile = profile_result.data
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The authenticated user does not have an eFlow profile.",
        ) from exc

    if not profile or profile.get("is_active") is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This eFlow account is inactive.",
        )

    try:
        account_role = normalize_account_role(profile.get("role"))
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="Unsupported account role. Ask an Admin to correct this account.") from exc

    raw_custom_role = profile.get("custom_role_key")
    custom_role_key = (
        raw_custom_role.strip()
        if isinstance(raw_custom_role, str) and raw_custom_role.strip()
        else None
    )

    return AuthenticatedUser(
        id=str(auth_user.id),
        email=profile.get("email") or getattr(auth_user, "email", "") or "",
        role=account_role,
        org_id=profile.get("org_id"),
        last_sign_in_at=getattr(auth_user, "last_sign_in_at", None),
        custom_role_key=custom_role_key,
    )


def require_admin(
    user: AuthenticatedUser = Depends(require_user),
) -> AuthenticatedUser:
    if not is_administrator(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required.",
        )
    return user


# Compatibility for gateway extensions importing the old dependency name.
require_super_admin = require_admin


def _resolve_role_target(user: AuthenticatedUser) -> tuple[str, str]:
    """Return (role_permissions_key, fallback_base_role) honoring active custom_role_key."""
    custom_key = (user.custom_role_key or "").strip()
    if custom_key:
        custom_result = (
            supabase_admin.table("custom_roles")
            .select("key,base_role")
            .eq("key", custom_key)
            .limit(1)
            .execute()
        )
        custom_rows = custom_result.data or []
        if custom_rows:
            base_role = custom_rows[0].get("base_role") or user.role
            return custom_key, str(base_role)
    return user.role, user.role


def _raw_permission_allowed(
    user: AuthenticatedUser,
    permission: str,
    role_target: tuple[str, str],
) -> bool:
    if is_administrator(user.role):
        return permission in ADMIN_PERMISSIONS

    if permission in ADMIN_PERMISSIONS:
        return False

    override_result = (
        supabase_admin.table("user_permission_overrides")
        .select("allowed")
        .eq("user_id", user.id)
        .eq("permission", permission)
        .limit(1)
        .execute()
    )
    override_rows = override_result.data or []
    if override_rows:
        return override_rows[0].get("allowed") is True

    effective_role, fallback_role = role_target
    role_result = (
        supabase_admin.table("role_permissions")
        .select("allowed")
        .eq("role", effective_role)
        .eq("permission", permission)
        .limit(1)
        .execute()
    )
    role_rows = role_result.data or []
    if role_rows:
        return role_rows[0].get("allowed") is True

    return permission in FALLBACK_ROLE_DEFAULTS.get(fallback_role, frozenset())


def _permission_allowed(user: AuthenticatedUser, permission: str) -> bool:
    if is_administrator(user.role):
        return permission in ADMIN_PERMISSIONS

    if permission in ADMIN_PERMISSIONS:
        return False

    role_target = _resolve_role_target(user)
    if not _raw_permission_allowed(user, permission, role_target):
        return False

    for prerequisite in PERMISSION_PREREQUISITES.get(permission, ()):
        if not _raw_permission_allowed(user, prerequisite, role_target):
            return False

    return True


def require_user_manager(
    user: AuthenticatedUser = Depends(require_user),
) -> AuthenticatedUser:
    try:
        allowed = _permission_allowed(user, "users.manage")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="User-management authorization could not be verified.",
        ) from exc

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The users.manage capability is required.",
        )
    return user


def require_database_backup(
    user: AuthenticatedUser = Depends(require_user),
) -> AuthenticatedUser:
    """Require the explicit database.backup capability."""
    if not is_administrator(user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Database exports are limited to administrative accounts.",
        )
    try:
        allowed = _permission_allowed(user, "database.backup")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Backup authorization could not be verified.",
        ) from exc

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The database.backup capability is required.",
        )
    return user


def require_recent_database_backup(
    user: AuthenticatedUser = Depends(require_database_backup),
) -> AuthenticatedUser:
    """Require password reauthentication within five minutes for new exports."""
    if not user.last_sign_in_at:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Confirm your password again before starting a database export.",
        )
    if not is_recent_sign_in(user.last_sign_in_at):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="For security, confirm your password again before starting a database export.",
        )
    return user


class InternalAiKeyProvider:
    """Short-lived cache for the secret shared only by ports 8322 and 8321."""

    def __init__(self, ttl_seconds: int = 300):
        self._ttl_seconds = ttl_seconds
        self._value: str | None = None
        self._loaded_at = 0.0

    def get(self) -> str:
        now = time.monotonic()
        if self._value and now - self._loaded_at < self._ttl_seconds:
            return self._value

        result = (
            supabase_admin.table("app_config")
            .select("value")
            .eq("key", "llm_auth_key")
            .single()
            .execute()
        )
        value = (result.data or {}).get("value", "").strip()
        if not value:
            raise RuntimeError("app_config.llm_auth_key is missing or empty")

        self._value = value
        self._loaded_at = now
        return value


internal_ai_key = InternalAiKeyProvider()
