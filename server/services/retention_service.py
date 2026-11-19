"""Admin archive retention policy, controlled purge, and Storage outbox worker."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import logging
import os
from threading import Event, Thread
from typing import Any

from fastapi import HTTPException
from postgrest.exceptions import APIError

from gateway_dependencies import AuthenticatedUser, supabase_admin
from services.database_transport import database_read

logger = logging.getLogger("eflow.retention")

PUBLIC_ARCHIVE_MODES = (
    "keep_manifest_purge_files",
    "purge_all_public",
    "keep_full_public",
)

POLICY_KEYS = (
    "project_auto_archive_days",
    "archive_retention_days",
    "archive_retention_notice_days",
    "archive_retention_require_seal",
    "archive_retention_auto_purge",
    "archive_retention_public_mode",
)

DEFAULT_POLICY: dict[str, Any] = {
    "project_auto_archive_days": 30,
    "archive_retention_days": 1825,
    "archive_retention_notice_days": 30,
    "archive_retention_require_seal": True,
    "archive_retention_auto_purge": False,
    "archive_retention_public_mode": "keep_manifest_purge_files",
}


def _raise_from_api_error(exc: Exception, fallback: str) -> None:
    if isinstance(exc, HTTPException):
        raise exc
    if isinstance(exc, APIError):
        code = str(getattr(exc, "code", "") or "")
        message = str(getattr(exc, "message", "") or str(exc) or fallback).strip()
        if code == "P0002":
            raise HTTPException(404, message) from exc
        if code == "42501":
            raise HTTPException(403, message) from exc
        if code in ("22023", "22P02", "23514"):
            raise HTTPException(422, message) from exc
        if code == "PGRST202":
            raise HTTPException(
                503,
                "Archive retention database migration is not installed yet.",
            ) from exc
        raise HTTPException(400, message or fallback) from exc
    raise HTTPException(500, fallback) from exc


def _actor_name(user: AuthenticatedUser) -> str:
    try:
        rows = (
            supabase_admin.table("profiles")
            .select("full_name")
            .eq("id", user.id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if rows and rows[0].get("full_name"):
            return str(rows[0]["full_name"]).strip()
    except Exception:
        pass
    return user.email or "Admin"


def _parse_policy_rows(rows: list[dict[str, Any]]) -> dict[str, Any]:
    raw = {
        str(row["key"]): str(row["value"]).strip()
        for row in rows
        if isinstance(row, dict) and row.get("key") in POLICY_KEYS and row.get("value") is not None
    }
    result = dict(DEFAULT_POLICY)
    for int_key, lo, hi in (
        ("project_auto_archive_days", 1, 3650),
        ("archive_retention_days", 1, 7300),
        ("archive_retention_notice_days", 1, 365),
    ):
        val = raw.get(int_key, "")
        if val.isdigit():
            result[int_key] = max(lo, min(hi, int(val)))
    for bool_key in ("archive_retention_require_seal", "archive_retention_auto_purge"):
        val = raw.get(bool_key, "").lower()
        if val in ("true", "false"):
            result[bool_key] = val == "true"
    mode = raw.get("archive_retention_public_mode", "")
    if mode in PUBLIC_ARCHIVE_MODES:
        result["archive_retention_public_mode"] = mode
    return result


def get_retention_overview() -> dict[str, Any]:
    try:
        res = database_read(lambda: supabase_admin.rpc("retention_admin_overview", {}).execute())
        return res.data or {}
    except Exception as exc:
        _raise_from_api_error(exc, "Could not load archive retention overview.")


def update_retention_policy(payload: dict[str, Any], actor: AuthenticatedUser) -> dict[str, Any]:
    auto_archive = int(payload["project_auto_archive_days"])
    retention_days = int(payload["archive_retention_days"])
    notice_days = int(payload["archive_retention_notice_days"])
    require_seal = bool(payload["archive_retention_require_seal"])
    auto_purge = bool(payload["archive_retention_auto_purge"])
    public_mode = str(payload["archive_retention_public_mode"]).strip()

    if not (1 <= auto_archive <= 3650):
        raise HTTPException(422, "Auto-archive delay must be between 1 and 3,650 days.")
    if not (1 <= retention_days <= 7300):
        raise HTTPException(422, "Retention period must be between 1 and 7,300 days (20 years).")
    if not (1 <= notice_days <= 365):
        raise HTTPException(422, "Pre-purge warning window must be between 1 and 365 days.")
    if public_mode not in PUBLIC_ARCHIVE_MODES:
        raise HTTPException(422, "Choose a valid public archive disposition mode.")

    existing_rows = (
        supabase_admin.table("system_config")
        .select("key,value")
        .in_("key", list(POLICY_KEYS))
        .execute()
        .data
        or []
    )
    before_policy = _parse_policy_rows(existing_rows)
    after_policy = {
        "project_auto_archive_days": auto_archive,
        "archive_retention_days": retention_days,
        "archive_retention_notice_days": notice_days,
        "archive_retention_require_seal": require_seal,
        "archive_retention_auto_purge": auto_purge,
        "archive_retention_public_mode": public_mode,
    }

    now_iso = datetime.now(timezone.utc).isoformat()
    upsert_rows = [
        {
            "key": k,
            "value": str(v).lower() if isinstance(v, bool) else str(v),
            "updated_at": now_iso,
        }
        for k, v in after_policy.items()
    ]
    supabase_admin.table("system_config").upsert(upsert_rows, on_conflict="key").execute()

    if before_policy != after_policy:
        supabase_admin.table("audit_events").insert(
            {
                "actor_id": actor.id,
                "actor_name": _actor_name(actor),
                "entity_type": "system_config",
                "entity_id": "archive_retention_policy",
                "action": "retention.policy_updated",
                "before_data": before_policy,
                "after_data": after_policy,
                "reason": (
                    f"Updated archive retention policy: {retention_days}d retention, "
                    f"require_seal={require_seal}, auto_purge={auto_purge}, mode={public_mode}."
                ),
            }
        ).execute()

    return after_policy


def preview_project_purge(project_id: str, public_mode: str | None = None) -> dict[str, Any]:
    if public_mode is not None and public_mode not in PUBLIC_ARCHIVE_MODES:
        raise HTTPException(422, "Choose a valid public archive disposition mode.")
    try:
        params: dict[str, Any] = {"p_project_id": project_id}
        if public_mode:
            params["p_public_mode"] = public_mode
        res = database_read(lambda: supabase_admin.rpc("retention_admin_preview", params).execute())
        return res.data or {}
    except Exception as exc:
        _raise_from_api_error(exc, "Could not preview project retention purge.")


def set_project_legal_hold(
    project_id: str,
    hold: bool,
    reason: str,
    actor: AuthenticatedUser,
) -> dict[str, Any]:
    clean_reason = reason.strip()
    if len(clean_reason) < 5 or len(clean_reason) > 1000:
        raise HTTPException(422, "Enter a reason between 5 and 1,000 characters.")
    try:
        res = supabase_admin.rpc(
            "retention_admin_set_hold",
            {
                "p_project_id": project_id,
                "p_hold": hold,
                "p_reason": clean_reason,
                "p_actor_id": actor.id,
            },
        ).execute()
        return res.data or {"projectId": project_id, "legalHold": hold, "saved": True}
    except Exception as exc:
        _raise_from_api_error(exc, "Could not update legal hold.")


def purge_project(
    project_id: str,
    confirm_title: str,
    reason: str,
    early_override: bool,
    public_mode: str | None,
    actor: AuthenticatedUser,
) -> dict[str, Any]:
    clean_reason = reason.strip()
    if len(clean_reason) < 5 or len(clean_reason) > 1000:
        raise HTTPException(422, "Enter a purge reason between 5 and 1,000 characters.")
    if public_mode is not None and public_mode not in PUBLIC_ARCHIVE_MODES:
        raise HTTPException(422, "Choose a valid public archive disposition mode.")

    preview = preview_project_purge(project_id, public_mode)
    expected_title = str(preview.get("projectTitle") or "").strip()
    if not expected_title or confirm_title.strip().lower() != expected_title.lower():
        raise HTTPException(
            422,
            f'Type the exact project title "{expected_title}" to confirm permanent purge.',
        )

    try:
        params: dict[str, Any] = {
            "p_project_id": project_id,
            "p_actor_id": actor.id,
            "p_reason": clean_reason,
            "p_early_override": bool(early_override),
        }
        if public_mode:
            params["p_public_mode"] = public_mode
        res = supabase_admin.rpc("retention_admin_purge_project", params).execute()
        disposition = res.data or {}
    except Exception as exc:
        _raise_from_api_error(exc, "Could not purge archived project.")

    storage_drain = drain_storage_delete_queue(limit=200)
    wake_retention_worker()
    return {"disposition": disposition, "storageDrain": storage_drain}


def drain_storage_delete_queue(limit: int = 100) -> dict[str, int]:
    """Delete queued storage objects through Supabase's official Storage API."""
    try:
        claimed = (
            supabase_admin.rpc(
                "retention_admin_claim_storage_queue",
                {"p_limit": max(1, min(200, limit))},
            )
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logger.warning("Retention storage queue claim skipped: %s", exc)
        return {"claimed": 0, "deleted": 0, "failed": 0}

    if not isinstance(claimed, list) or not claimed:
        return {"claimed": 0, "deleted": 0, "failed": 0}

    by_bucket: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in claimed:
        if isinstance(item, dict) and item.get("bucketId") and item.get("objectPath"):
            by_bucket[str(item["bucketId"])].append(item)

    deleted_count = 0
    failed_count = 0

    for bucket, items in by_bucket.items():
        # Process in safe chunks of 50 objects per Storage API request.
        for start in range(0, len(items), 50):
            chunk = items[start : start + 50]
            paths = [str(row["objectPath"]) for row in chunk]
            try:
                supabase_admin.storage.from_(bucket).remove(paths)
                for row in chunk:
                    supabase_admin.rpc(
                        "retention_admin_finish_storage_item",
                        {"p_id": int(row["id"]), "p_deleted": True, "p_error": None},
                    ).execute()
                    deleted_count += 1
            except Exception as batch_exc:
                logger.warning(
                    "Batch storage remove failed for bucket %s (%d files): %s; retrying individually",
                    bucket,
                    len(chunk),
                    batch_exc,
                )
                for row in chunk:
                    try:
                        supabase_admin.storage.from_(bucket).remove([str(row["objectPath"])])
                        supabase_admin.rpc(
                            "retention_admin_finish_storage_item",
                            {"p_id": int(row["id"]), "p_deleted": True, "p_error": None},
                        ).execute()
                        deleted_count += 1
                    except Exception as item_exc:
                        err_text = str(item_exc)
                        # Missing objects are already gone — treat 404/not found as completed.
                        is_missing = "not found" in err_text.lower() or "404" in err_text
                        supabase_admin.rpc(
                            "retention_admin_finish_storage_item",
                            {
                                "p_id": int(row["id"]),
                                "p_deleted": is_missing,
                                "p_error": None if is_missing else err_text[:500],
                            },
                        ).execute()
                        if is_missing:
                            deleted_count += 1
                        else:
                            failed_count += 1

    return {"claimed": len(claimed), "deleted": deleted_count, "failed": failed_count}


def run_maintenance_cycle(actor: AuthenticatedUser) -> dict[str, Any]:
    try:
        evaluation = (
            supabase_admin.rpc("retention_admin_evaluate_due", {}).execute().data or {}
        )
    except Exception as exc:
        _raise_from_api_error(exc, "Could not run retention evaluation.")

    storage_drain = drain_storage_delete_queue(limit=200)

    try:
        supabase_admin.table("audit_events").insert(
            {
                "actor_id": actor.id,
                "actor_name": _actor_name(actor),
                "entity_type": "system_config",
                "entity_id": "archive_retention_maintenance",
                "action": "retention.maintenance_run",
                "after_data": {
                    "evaluation": evaluation,
                    "storageDrain": storage_drain,
                },
                "reason": "Admin triggered manual archive retention check and storage cleanup.",
            }
        ).execute()
    except Exception:
        pass

    return {"evaluation": evaluation, "storageDrain": storage_drain}


def get_disposition_certificate(disposition_id: str) -> dict[str, Any]:
    try:
        res = database_read(
            lambda: supabase_admin.rpc(
                "retention_admin_disposition_detail",
                {"p_disposition_id": disposition_id},
            ).execute()
        )
        if not res.data:
            raise HTTPException(404, "Disposition certificate not found.")
        return res.data
    except Exception as exc:
        _raise_from_api_error(exc, "Could not load disposition certificate.")


# ---------------------------------------------------------------------------
# Background Storage Outbox Worker (drains blobs queued by pg_cron auto-purge)
# ---------------------------------------------------------------------------
_POLL_INTERVAL_SECONDS = 900.0  # 15 minutes
_wake_event = Event()


class _RetentionWorkerStop(Event):
    def set(self) -> None:
        super().set()
        _wake_event.set()


def wake_retention_worker() -> None:
    _wake_event.set()


def start_retention_worker() -> Event:
    stopped = _RetentionWorkerStop()

    def run() -> None:
        while not stopped.is_set():
            try:
                drain_storage_delete_queue(limit=100)
            except Exception as exc:
                logger.debug("Retention storage worker tick skipped: %s", exc)
            if _wake_event.wait(timeout=_POLL_INTERVAL_SECONDS):
                _wake_event.clear()

    if os.getenv("EFLOW_RETENTION_WORKER_ENABLED", "true").lower() == "true":
        thread = Thread(target=run, name="eflow-retention-storage-worker", daemon=True)
        thread.start()
    return stopped
