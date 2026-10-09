"""Account-level eFlow login protection. Never trust client-reported failures."""
from datetime import datetime, timezone, timedelta
import httpx
from fastapi import HTTPException
from gateway_config import settings
from gateway_dependencies import supabase_admin

LOCKED_MESSAGE = "Your account is locked. Contact an Admin to unlock it."


def rpc(name, **data):
    return supabase_admin.rpc("eflow_login_" + name, data).execute().data


def finish(attempt, outcome, **extra):
    return rpc("finish", p_user=attempt["user_id"], p_lease=attempt["lease"], p_outcome=outcome, **extra)


def auth_request(method, path, **kwargs):
    # A fresh HTTP request avoids replacing the shared service client's session.
    return httpx.request(method, settings.supabase_url + "/auth/v1/" + path,
        headers={"apikey": settings.supabase_service_role_key,
                 "Authorization": "Bearer " + settings.supabase_service_role_key},
        timeout=15, **kwargs)


def apply_ban(attempt):
    if not attempt.get("lease"):
        return
    try:
        response = auth_request("PUT", "admin/users/" + attempt["user_id"], json={"ban_duration": "876000h"})
        response.raise_for_status()
        banned_until = response.json().get("banned_until")
        if not banned_until:
            raise ValueError("Missing ban confirmation")
        finish(attempt, "ban", p_ban_until=banned_until)
    except Exception:
        # The durable eFlow lock stays in force even if provider synchronization fails.
        # A subsequent locked login retries the provider ban; never retry a password.
        finish(attempt, "abort")


def login(email, password):
    attempt = rpc("begin", p_email=email.strip().lower())
    if attempt["status"] == "locked":
        apply_ban(attempt)
        raise HTTPException(423, LOCKED_MESSAGE)
    if attempt["status"] == "busy":
        raise HTTPException(429, "A sign-in is already being checked. Please try again shortly.")
    known = attempt["status"] == "ready"
    try:
        response = auth_request("POST", "token?grant_type=password", json={"email": email.strip().lower(), "password": password})
        body = response.json()
    except Exception:
        if known:
            finish(attempt, "abort")
        raise HTTPException(503, "Unable to sign in right now. Please try again.") from None
    invalid = body.get("error_code") == "invalid_credentials" or (
        not body.get("error_code") and response.status_code == 400 and body.get("error_description") == "Invalid login credentials")
    if invalid:
        result = finish(attempt, "invalid_credentials") if known else {"status": "invalid_credentials"}
        if result["status"] == "locked":
            apply_ban(attempt)
            raise HTTPException(423, LOCKED_MESSAGE)
        if result["status"] == "stale":
            raise HTTPException(503, "Unable to finish this sign-in. Please try again.")
        raise HTTPException(401, "Email or password is incorrect.")
    if not response.is_success or not body.get("access_token") or not body.get("refresh_token"):
        if known:
            finish(attempt, "abort")
        if body.get("error_code") == "email_not_confirmed":
            raise HTTPException(403, "Confirm your email address before signing in.")
        if body.get("error_code") == "user_banned":
            raise HTTPException(403, "This account cannot sign in. Contact an Admin.")
        raise HTTPException(429 if response.status_code == 429 else 503, "Unable to sign in right now. Please try again.")
    if known:
        if str(body.get("user", {}).get("id")) != str(attempt["user_id"]):
            finish(attempt, "abort")
            raise HTTPException(503, "Unable to verify this sign-in. Please try again.")
        result = finish(attempt, "success")
        if result["status"] != "success":
            raise HTTPException(423 if result["status"] == "locked" else 503,
                LOCKED_MESSAGE if result["status"] == "locked" else "Unable to finish this sign-in. Please try again.")
    return {"access_token": body["access_token"], "refresh_token": body["refresh_token"]}


def unlock(actor_id, user_id):
    attempt = rpc("admin", p_actor=actor_id, p_action="unlock_begin", p_user=user_id)
    if attempt["status"] == "not_locked":
        return {"status": "not_locked"}
    if attempt["status"] != "ready":
        raise HTTPException(409, "This account is being updated. Try again shortly.")
    attempt["user_id"] = user_id
    try:
        current = auth_request("GET", "admin/users/" + user_id)
        current.raise_for_status()
        actual = current.json().get("banned_until")
        if not attempt.get("auth_ban_until") and actual and datetime.fromisoformat(actual.replace("Z", "+00:00")) > datetime.now(timezone.utc):
            # A lost provider response may leave an unconfirmed ban. Never report
            # an unlock or remove another restriction without an ownership receipt.
            raise HTTPException(409, "An account restriction needs review in Supabase before unlocking.")
        if attempt.get("auth_ban_until"):
            expected = attempt["auth_ban_until"]
            # GoTrue returns nanoseconds; Postgres rounds to microseconds while
            # Python truncates. Allow only that one-microsecond representation gap.
            if actual and abs(datetime.fromisoformat(actual.replace("Z", "+00:00")) - datetime.fromisoformat(expected.replace("Z", "+00:00"))) > timedelta(microseconds=1):
                raise HTTPException(409, "A separate account restriction has changed. Review it in Supabase before unlocking.")
            response = auth_request("PUT", "admin/users/" + user_id, json={"ban_duration": "none"})
            response.raise_for_status()
        result = rpc("admin", p_actor=actor_id, p_action="unlock_finish", p_user=user_id, p_lease=attempt["lease"])
        if result["status"] not in {"unlocked", "not_locked"}:
            raise HTTPException(409, "Unlock could not be confirmed. Refresh the list before retrying.")
        return result
    except Exception:
        finish(attempt, "abort")
        raise
