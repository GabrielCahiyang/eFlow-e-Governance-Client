"""Server-side password reset link generation and branded email delivery."""
from collections import defaultdict, deque
import hashlib
import smtplib
import threading
import time
from urllib.parse import urlencode
from fastapi import HTTPException

from gateway_dependencies import AuthenticatedUser, supabase_admin
from invitations.service import normalize_email
from services.administrative_roles import is_administrator
from services.email_delivery import password_reset_email, send_email
from services.phase2_config import app_url

_RATE_LOCK = threading.Lock()
_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_WINDOW_SECONDS = 600.0
_MAX_EMAIL_REQUESTS = 5
_MAX_IP_REQUESTS = 20


def _enforce_rate_limit(key: str, limit: int) -> None:
    now = time.monotonic()
    cutoff = now - _WINDOW_SECONDS
    with _RATE_LOCK:
        bucket = _RATE_BUCKETS[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                429,
                "Too many password reset requests. Please wait a few minutes and try again.",
            )
        bucket.append(now)


def _general_branding() -> tuple[str | None, str | None]:
    try:
        rows = (
            supabase_admin.table("system_config")
            .select("key,value")
            .in_("key", ["organization_name", "support_email"])
            .execute()
            .data
            or []
        )
        cfg = {
            str(row["key"]): str(row["value"]).strip()
            for row in rows
            if isinstance(row, dict) and isinstance(row.get("key"), str) and isinstance(row.get("value"), str)
        }
        return cfg.get("organization_name") or None, cfg.get("support_email") or None
    except Exception:
        return None, None


def _build_recovery_url(email: str, base_url: str) -> str:
    redirect_to = f"{base_url}/reset-password"
    response = supabase_admin.auth.admin.generate_link(
        {
            "type": "recovery",
            "email": email,
            "options": {"redirect_to": redirect_to},
        }
    )
    props = getattr(response, "properties", None)
    hashed_token = getattr(props, "hashed_token", None) if props else None
    action_link = getattr(props, "action_link", None) if props else None
    if isinstance(hashed_token, str) and hashed_token.strip():
        return f"{redirect_to}?{urlencode({'token_hash': hashed_token.strip(), 'type': 'recovery'})}"
    if isinstance(action_link, str) and action_link.strip():
        return action_link.strip()
    raise HTTPException(502, "Could not generate a password reset link.")


def _deliver_reset_email(
    *,
    email: str,
    full_name: str | None,
    initiated_by: str | None = None,
) -> None:
    base_url = app_url()
    reset_url = _build_recovery_url(email, base_url)
    org_name, support_email = _general_branding()
    content = password_reset_email(
        full_name,
        reset_url,
        initiated_by=initiated_by,
        organization_name=org_name,
        support_email=support_email,
    )
    digest = hashlib.sha256(f"{email}:{int(time.time() * 1000)}".encode("utf-8")).hexdigest()[:24]
    try:
        send_email(
            email,
            content,
            f"password-reset/{digest}",
            reply_to=support_email,
        )
    except HTTPException as exc:
        raise HTTPException(
            502,
            "Could not send the password reset email right now. Check the server email configuration and try again.",
        ) from exc
    except (smtplib.SMTPException, OSError) as exc:
        raise HTTPException(
            502,
            "Could not send the password reset email via SMTP. Check the server email configuration and try again.",
        ) from exc


def request_public_reset(raw_email: str, client_ip: str) -> dict:
    email = normalize_email(raw_email)
    _enforce_rate_limit(f"ip:{client_ip or 'unknown'}", _MAX_IP_REQUESTS)
    _enforce_rate_limit(f"email:{email}", _MAX_EMAIL_REQUESTS)

    rows = (
        supabase_admin.table("profiles")
        .select("id,email,full_name,is_active")
        .ilike("email", email)
        .limit(1)
        .execute()
        .data
        or []
    )
    profile = rows[0] if rows else None
    if not profile or profile.get("is_active") is False:
        return {"sent": True}

    target_email = str(profile.get("email") or email).strip().lower()
    _deliver_reset_email(
        email=target_email,
        full_name=str(profile.get("full_name") or "").strip() or None,
    )
    return {"sent": True}


def send_admin_reset(target_uid: str, actor: AuthenticatedUser) -> dict:
    rows = (
        supabase_admin.table("profiles")
        .select("id,email,full_name,role,org_id,is_active")
        .eq("id", target_uid)
        .limit(1)
        .execute()
        .data
        or []
    )
    target = rows[0] if rows else None
    if not target:
        raise HTTPException(404, "Account not found.")

    target_role = str(target.get("role") or "")
    if is_administrator(target_role) and not is_administrator(actor.role):
        raise HTTPException(403, "Only Admin can send a password reset for an Admin account.")
    if target_role in {"head", "dept_head", "department_head"} and not is_administrator(actor.role):
        raise HTTPException(403, "Only Admin can send a password reset for a leadership account.")
    if not is_administrator(actor.role) and actor.org_id and str(target.get("org_id") or "") != actor.org_id:
        raise HTTPException(403, "You can only reset passwords for accounts in your Office.")
    if target.get("is_active") is False:
        raise HTTPException(400, "This account is inactive. Activate it before sending a password reset link.")

    target_email = str(target.get("email") or "").strip().lower()
    if not target_email:
        raise HTTPException(400, "This account does not have an email address.")

    actor_rows = (
        supabase_admin.table("profiles")
        .select("full_name")
        .eq("id", actor.id)
        .limit(1)
        .execute()
        .data
        or []
    )
    actor_name = str((actor_rows[0] if actor_rows else {}).get("full_name") or actor.email or "Administrator").strip()

    _deliver_reset_email(
        email=target_email,
        full_name=str(target.get("full_name") or "").strip() or None,
        initiated_by=actor_name,
    )
    return {"sent": True, "email": target_email}
