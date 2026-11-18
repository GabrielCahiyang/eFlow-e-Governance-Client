"""Clean up orphaned workflow storage objects while preserving archived projects,
seal artifacts, avatars, and any object still referenced in PostgreSQL.

Target: ixnfphgjyelhckjwjkdv (from .env EFLOW_DATABASE_URL + VITE_SUPABASE_URL)

Usage:
  python scripts/reset-workflow-storage-keep-archived.py           # Dry-run preview
  python scripts/reset-workflow-storage-keep-archived.py --apply   # Delete orphaned objects
"""

import argparse
import json
import os
import socket
from pathlib import Path
from urllib.parse import quote, urlparse

import httpx
import psycopg2
from dotenv import dotenv_values

TARGET_REF = "ixnfphgjyelhckjwjkdv"

# Only inspect workflow buckets; never touch avatars, PDS, or blockchain seal buckets.
WORKFLOW_BUCKETS = [
    "task-attachments",
    "budget-receipts",
    "m7-work-evidence",
    "office-petty-receipts",
    "conversation-images",
    "project-library",
    "proposal-pdfs",
    "project-pdfs",
    "proposal-documents",
    "project-seal-private",
    "project-seal-public",
]


def collect_referenced_paths(cur) -> tuple[set[str], set[str]]:
    """Collect every storage object path or seal prefix still referenced in PostgreSQL."""
    queries = [
        "select file_path from public.task_attachments where file_path is not null",
        "select attachment_path from public.task_progress_updates where attachment_path is not null",
        "select file_path from public.subtask_submission_attachments where file_path is not null",
        "select attachment_path from public.subtask_progress_updates where attachment_path is not null",
        "select storage_path from public.task_comment_attachments where storage_path is not null",
        "select file_path from public.petty_cash_receipts where file_path is not null",
        "select file_path from public.petty_cash_request_attachments where file_path is not null",
        "select object_name from eflow_evidence.objects where object_name is not null",
        "select object_path from public.project_library_files where object_path is not null",
        "select image_path from public.chat_messages where image_path is not null",
        "select avatar_path from public.chat_channels where avatar_path is not null",
        "select avatar_path from public.profiles where avatar_path is not null",
        "select storage_path from public.user_pds_documents where storage_path is not null",
    ]
    referenced: set[str] = set()
    for sql in queries:
        cur.execute(sql)
        for (path,) in cur.fetchall():
            if path:
                referenced.add(path.lstrip("/"))

    seal_prefixes: set[str] = set()
    cur.execute("select id::text, manifest_hash from eflow_seal.snapshots")
    for snap_id, mhash in cur.fetchall():
        if snap_id:
            seal_prefixes.add(f"{snap_id}/")
        if mhash:
            seal_prefixes.add(f"{mhash}/")
    cur.execute("select manifest_hash from public.project_seal_certificates where manifest_hash is not null")
    for (mhash,) in cur.fetchall():
        if mhash:
            seal_prefixes.add(f"{mhash}/")
    return referenced, seal_prefixes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually remove unreferenced workflow objects.")
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent
    cfg = dotenv_values(root / ".env")
    db_url = cfg["EFLOW_DATABASE_URL"]
    parsed = urlparse(db_url)
    assert parsed.username == f"postgres.{TARGET_REF}", f"Unexpected DB target: {parsed.username}"

    supa_url = cfg["VITE_SUPABASE_URL"].rstrip("/")
    assert TARGET_REF in supa_url, f"Unexpected Supabase URL: {supa_url}"
    service_key = cfg.get("SUPABASE_SECRET_KEY") or cfg["SUPABASE_SERVICE_ROLE_KEY"]

    conn = psycopg2.connect(
        db_url,
        sslmode="require",
        connect_timeout=15,
        hostaddr=socket.getaddrinfo(parsed.hostname, parsed.port or 5432, socket.AF_INET, socket.SOCK_STREAM)[0][4][0],
    )
    try:
        with conn.cursor() as cur:
            referenced, seal_prefixes = collect_referenced_paths(cur)
            cur.execute(
                "select bucket_id, name from storage.objects where bucket_id = any(%s) order by bucket_id, name",
                (WORKFLOW_BUCKETS,),
            )
            candidates = cur.fetchall()
    finally:
        conn.close()

    to_delete: dict[str, list[str]] = {}
    kept: list[tuple[str, str]] = []
    for bucket, name in candidates:
        clean = name.lstrip("/")
        if bucket in ("project-seal-private", "project-seal-public"):
            is_kept = any(clean.startswith(prefix) for prefix in seal_prefixes)
        else:
            is_kept = clean in referenced
        if is_kept:
            kept.append((bucket, name))
        else:
            to_delete.setdefault(bucket, []).append(name)

    total_delete = sum(len(v) for v in to_delete.values())
    print(json.dumps({
        "mode": "apply" if args.apply else "dry-run",
        "referenced_kept_in_workflow_buckets": len(kept),
        "orphaned_to_delete": total_delete,
        "by_bucket": {k: len(v) for k, v in to_delete.items()},
    }, indent=2))

    if not args.apply or total_delete == 0:
        return

    client = httpx.Client(
        headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
        timeout=60,
    )
    deleted = 0
    for bucket, names in to_delete.items():
        resp = client.request(
            "DELETE",
            f"{supa_url}/storage/v1/object/{quote(bucket)}",
            json={"prefixes": names},
        )
        resp.raise_for_status()
        deleted += len(names)
    print(json.dumps({"deleted": deleted}))


if __name__ == "__main__":
    main()
