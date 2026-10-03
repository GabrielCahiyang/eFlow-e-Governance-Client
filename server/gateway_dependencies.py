"""Supabase clients, authentication dependencies, and internal secrets."""

from dataclasses import dataclass
from datetime import datetime
import time
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from gateway_config import settings
from services.recent_auth import is_recent_sign_in
from services.administrative_roles import is_administrator
from services.account_roles import normalize_account_role, ADMIN_PERMISSIONS


supabase_admin: Client = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key,
)

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str
    role: str
    org_id: Optional[str]
    last_sign_in_at: Optional[str | datetime] = None


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
            .select("id,email,role,org_id,is_active")
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

    return AuthenticatedUser(
        id=str(auth_user.id),
        email=profile.get("email") or getattr(auth_user, "email", "") or "",
        role=account_role,
        org_id=profile.get("org_id"),
        last_sign_in_at=getattr(auth_user, "last_sign_in_at", None),
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


def _permission_allowed(user: AuthenticatedUser, permission: str) -> bool:
    if is_administrator(user.role):
        return permission in ADMIN_PERMISSIONS

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

    role_result = (
        supabase_admin.table("role_permissions")
        .select("allowed")
        .eq("role", user.role)
        .eq("permission", permission)
        .limit(1)
        .execute()
    )
    role_rows = role_result.data or []
    return bool(role_rows and role_rows[0].get("allowed") is True)


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
