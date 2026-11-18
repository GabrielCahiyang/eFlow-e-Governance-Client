"""Create, track, download, and clean up Supabase backup archives and SQL dumps."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
import json
import logging
from pathlib import Path
import subprocess
from threading import RLock
from typing import Any, Literal
from urllib.parse import quote
from uuid import uuid4
import zipfile

import httpx

from gateway_config import settings
from gateway_dependencies import AuthenticatedUser, supabase_admin
from services.backup_explorer import backup_explorer
from services.backup_manifest import file_sha256, write_checksums, write_json
from services.backup_security import (
    BACKUP_DOMAINS,
    IMPORTANT_EFLOW_TABLES,
    SENSITIVE_PUBLIC_TABLES,
    ensure_within,
    redact_row,
    remove_backup_path,
    resolve_pg_dump,
    validate_table_name,
)


LOGGER = logging.getLogger(__name__)
BACKUP_VERSION = "1.1"
PAGE_SIZE = 1000
BackupMode = Literal["operational", "disaster_recovery"]
BackupScope = Literal["full", "important", "selected"]
BackupExportFormat = Literal["archive", "sql_dump"]

try:
    import pyzipper
except ImportError:  # pragma: no cover - surfaced by preflight in incomplete runtimes
    pyzipper = None


@dataclass
class BackupJob:
    id: str
    actor_id: str
    actor_email: str
    mode: BackupMode
    status: str = "queued"
    phase: str = "Waiting to start"
    progress: int = 0
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: str | None = None
    expires_at: str | None = None
    archive_name: str | None = None
    archive_size: int | None = None
    archive_sha256: str | None = None
    table_count: int = 0
    row_count: int = 0
    error: str | None = None
    scope: BackupScope = "full"
    export_format: BackupExportFormat = "archive"
    selected_tables: list[str] = field(default_factory=list)
    archive_path: Path | None = field(default=None, repr=False)
    workspace_path: Path | None = field(default=None, repr=False)

    def public(self) -> dict[str, Any]:
        payload = asdict(self)
        payload.pop("archive_path", None)
        payload.pop("workspace_path", None)
        return payload


class BackupService:
    def __init__(self) -> None:
        self._jobs: dict[str, BackupJob] = {}
        self._lock = RLock()
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="eflow-backup")
        self._load_persisted_jobs()

    def _job_metadata_path(self, workspace: Path) -> Path:
        return ensure_within(settings.backup_root, workspace / "job.json")

    def _persist_job(self, job: BackupJob) -> None:
        if not job.workspace_path:
            return
        try:
            job.workspace_path.mkdir(parents=True, exist_ok=True)
            meta_path = self._job_metadata_path(job.workspace_path)
            payload = job.public()
            payload["archive_rel"] = job.archive_path.name if job.archive_path else None
            tmp_path = meta_path.with_suffix(".json.tmp")
            tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp_path.replace(meta_path)
        except Exception:
            LOGGER.exception("Could not persist backup job metadata for %s", job.id)

    def _load_persisted_jobs(self) -> None:
        root = settings.backup_root
        if not root.is_dir():
            return
        now = datetime.now(timezone.utc)
        for job_dir in root.iterdir():
            if not job_dir.is_dir():
                continue
            meta_path = job_dir / "job.json"
            if not meta_path.is_file():
                continue
            try:
                raw = json.loads(meta_path.read_text(encoding="utf-8"))
                expires_at = raw.get("expires_at")
                if expires_at and datetime.fromisoformat(expires_at) <= now:
                    remove_backup_path(root, job_dir)
                    continue
                archive_rel = raw.pop("archive_rel", None)
                archive_path: Path | None = None
                if isinstance(archive_rel, str) and archive_rel:
                    candidate = ensure_within(root, job_dir / archive_rel)
                    if candidate.is_file():
                        archive_path = candidate
                job = BackupJob(
                    id=str(raw["id"]),
                    actor_id=str(raw["actor_id"]),
                    actor_email=str(raw.get("actor_email", "")),
                    mode=raw.get("mode", "operational"),
                    status=str(raw.get("status", "failed")),
                    phase=str(raw.get("phase", "")),
                    progress=int(raw.get("progress", 0)),
                    created_at=str(raw.get("created_at", now.isoformat())),
                    completed_at=raw.get("completed_at"),
                    expires_at=expires_at,
                    archive_name=raw.get("archive_name"),
                    archive_size=raw.get("archive_size"),
                    archive_sha256=raw.get("archive_sha256"),
                    table_count=int(raw.get("table_count", 0)),
                    row_count=int(raw.get("row_count", 0)),
                    error=raw.get("error"),
                    scope=raw.get("scope", "full"),
                    export_format=raw.get("export_format", "archive"),
                    selected_tables=list(raw.get("selected_tables") or []),
                    archive_path=archive_path,
                    workspace_path=job_dir.resolve(),
                )
                if job.status in {"queued", "running"}:
                    job.status = "failed"
                    job.phase = "Interrupted by gateway restart"
                    job.error = "The gateway restarted while this backup was running. Start a new backup."
                    job.completed_at = now.isoformat()
                    job.expires_at = (now + timedelta(hours=1)).isoformat()
                    self._persist_job(job)
                elif job.status == "completed" and archive_path is None:
                    job.status = "failed"
                    job.phase = "Archive missing"
                    job.error = "Temporary backup archive was removed before download."
                self._jobs[job.id] = job
            except Exception:
                LOGGER.warning("Skipping unreadable persisted backup metadata in %s", job_dir)

    def preflight(self) -> dict[str, Any]:
        pg_dump = resolve_pg_dump(settings.pg_dump_path)
        configured = bool(settings.database_url and pg_dump)
        tables: list[str] = []
        discovery_error: str | None = None
        try:
            tables = self._discover_public_tables()
        except Exception as exc:  # connection diagnostics must not take down Data Tools
            discovery_error = str(exc)

        important_tables = [table for table in tables if table in IMPORTANT_EFLOW_TABLES]
        return {
            "configured": configured,
            "database_url_configured": bool(settings.database_url),
            "pg_dump_available": bool(pg_dump),
            "encryption_available": pyzipper is not None,
            "retention_hours": settings.backup_retention_hours,
            "tables": tables,
            "table_count": len(tables),
            "important_tables": important_tables,
            "important_table_count": len(important_tables),
            "domains": [
                {"id": domain_id, "label": label, "description": desc}
                for domain_id, label, desc in BACKUP_DOMAINS
            ],
            "safe_excluded_data_tables": sorted(SENSITIVE_PUBLIC_TABLES),
            "discovery_error": discovery_error,
        }

    def list_jobs(self, actor_id: str) -> list[dict[str, Any]]:
        self.cleanup_expired()
        with self._lock:
            jobs = [job.public() for job in self._jobs.values() if job.actor_id == actor_id]
        return sorted(jobs, key=lambda job: job["created_at"], reverse=True)

    def list_jobs_filtered(
        self,
        actor_id: str,
        *,
        page: int = 1,
        page_size: int = 10,
        status: str = "all",
        mode: str = "all",
        scope: str = "all",
        export_format: str = "all",
        search: str = "",
        date_from: str = "",
        date_to: str = "",
    ) -> dict[str, Any]:
        jobs = self.list_jobs(actor_id)
        needle = search.strip().lower()
        filtered: list[dict[str, Any]] = []
        for job in jobs:
            if status != "all" and job["status"] != status:
                continue
            if mode != "all" and job["mode"] != mode:
                continue
            if scope != "all" and job.get("scope", "full") != scope:
                continue
            if export_format != "all" and job.get("export_format", "archive") != export_format:
                continue
            if date_from and job["created_at"][:10] < date_from:
                continue
            if date_to and job["created_at"][:10] > date_to:
                continue
            if needle:
                haystack = " ".join(
                    str(part or "")
                    for part in (
                        job["id"],
                        job.get("archive_name"),
                        job.get("archive_sha256"),
                        job.get("phase"),
                        job.get("error"),
                        " ".join(job.get("selected_tables") or []),
                    )
                ).lower()
                if needle not in haystack:
                    continue
            filtered.append(job)

        total = len(filtered)
        safe_page_size = max(1, min(100, page_size))
        total_pages = max(1, (total + safe_page_size - 1) // safe_page_size)
        safe_page = max(1, min(total_pages, page))
        start = (safe_page - 1) * safe_page_size
        return {
            "items": filtered[start : start + safe_page_size],
            "total": total,
            "page": safe_page,
            "page_size": safe_page_size,
            "total_pages": total_pages,
        }

    def get_job(self, job_id: str, actor_id: str) -> BackupJob:
        self.cleanup_expired()
        with self._lock:
            job = self._jobs.get(job_id)
        if not job or job.actor_id != actor_id:
            raise KeyError(job_id)
        return job

    def start(
        self,
        actor: AuthenticatedUser,
        mode: BackupMode,
        confirmation: str,
        include_storage_manifest: bool,
        passphrase: str | None,
        *,
        scope: BackupScope = "full",
        export_format: BackupExportFormat = "archive",
        tables: list[str] | None = None,
    ) -> dict[str, Any]:
        self.cleanup_expired()
        expected = "BACK UP EFLOW" if mode == "operational" else "FULL EFLOW BACKUP"
        if confirmation.strip().upper() != expected:
            raise ValueError(f'Type "{expected}" to confirm this export.')
        if mode == "disaster_recovery":
            if pyzipper is None:
                raise ValueError("Encrypted backup support is not installed on the gateway.")
            if not passphrase or len(passphrase) < 12:
                raise ValueError("Disaster-recovery backups require a passphrase of at least 12 characters.")

        pg_dump = resolve_pg_dump(settings.pg_dump_path)
        if not settings.database_url or not pg_dump:
            raise RuntimeError(
                "Backup support is not configured. Set EFLOW_DATABASE_URL and install or configure pg_dump."
            )

        selected_tables: list[str] = []
        if scope == "selected":
            raw_tables = tables or []
            cleaned = sorted({validate_table_name(item.strip()) for item in raw_tables if item and item.strip()})
            if mode == "operational":
                cleaned = [name for name in cleaned if name not in SENSITIVE_PUBLIC_TABLES]
            if not cleaned:
                raise ValueError("Select at least one non-sensitive table for a custom table backup.")
            if len(cleaned) > 200:
                raise ValueError("Custom backups support up to 200 selected tables at once.")
            discovered = set(self._discover_public_tables())
            unknown = [name for name in cleaned if name not in discovered]
            if unknown:
                raise ValueError(f"Unknown public table(s): {', '.join(unknown[:5])}")
            selected_tables = cleaned
        elif scope == "important":
            discovered = self._discover_public_tables()
            selected_tables = [name for name in discovered if name in IMPORTANT_EFLOW_TABLES]
            if not selected_tables:
                raise ValueError("No important eFlow tables were discovered in the schema.")

        with self._lock:
            active = next(
                (job for job in self._jobs.values() if job.actor_id == actor.id and job.status in {"queued", "running"}),
                None,
            )
            if active:
                raise RuntimeError("You already have a backup job running.")

            job_id = str(uuid4())
            workspace = ensure_within(settings.backup_root, settings.backup_root / job_id)
            job = BackupJob(
                id=job_id,
                actor_id=actor.id,
                actor_email=actor.email,
                mode=mode,
                scope=scope,
                export_format=export_format,
                selected_tables=selected_tables,
                workspace_path=workspace,
            )
            self._jobs[job.id] = job
            self._persist_job(job)

        self._audit(
            job,
            "backup.started",
            {
                "mode": mode,
                "scope": scope,
                "export_format": export_format,
                "selected_table_count": len(selected_tables),
                "include_storage_manifest": include_storage_manifest,
            },
        )
        self._executor.submit(
            self._build_archive,
            job.id,
            pg_dump,
            include_storage_manifest,
            passphrase,
        )
        return job.public()

    def delete(self, job_id: str, actor: AuthenticatedUser) -> None:
        job = self.get_job(job_id, actor.id)
        if job.status in {"queued", "running"}:
            raise RuntimeError("A running backup cannot be deleted.")
        self._remove_job_files(job)
        with self._lock:
            self._jobs.pop(job.id, None)
        self._audit(job, "backup.deleted", {"archive_sha256": job.archive_sha256})

    def mark_downloaded(self, job: BackupJob) -> None:
        self._audit(job, "backup.downloaded", {"archive_sha256": job.archive_sha256})

    def cleanup_expired(self) -> None:
        cutoff = datetime.now(timezone.utc)
        expired: list[BackupJob] = []
        with self._lock:
            for job in self._jobs.values():
                if not job.expires_at or job.status in {"queued", "running"}:
                    continue
                if datetime.fromisoformat(job.expires_at) <= cutoff:
                    expired.append(job)
        for job in expired:
            self._remove_job_files(job)
            with self._lock:
                self._jobs.pop(job.id, None)

    def _set_job(self, job: BackupJob, **changes: Any) -> None:
        with self._lock:
            for key, value in changes.items():
                setattr(job, key, value)
            self._persist_job(job)

    def _build_archive(
        self,
        job_id: str,
        pg_dump: str,
        include_storage_manifest: bool,
        passphrase: str | None,
    ) -> None:
        with self._lock:
            job = self._jobs[job_id]
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
        scope_tag = "" if job.scope == "full" else f"-{job.scope}"
        archive_stem = f"eflow-backup{scope_tag}-{timestamp}-{job.id[:8]}"
        workspace = ensure_within(settings.backup_root, settings.backup_root / job.id)
        export_root = workspace / archive_stem

        try:
            settings.backup_root.mkdir(parents=True, exist_ok=True)
            export_root.mkdir(parents=True, exist_ok=True)
            self._set_job(job, status="running", phase="Discovering database schema", progress=5, workspace_path=workspace)

            schema_map = backup_explorer.discover_schema(force_refresh=True)
            all_tables = list(schema_map.keys())
            target_tables = list(job.selected_tables) if job.scope != "full" else all_tables
            table_filter_args = [f"--table=public.{table}" for table in target_tables] if job.scope != "full" else []

            if job.export_format == "sql_dump":
                self._set_job(
                    job,
                    table_count=len(target_tables),
                    phase="Generating PostgreSQL dump (.sql)",
                    progress=25,
                )
                dump_path = (workspace / f"{archive_stem}.sql") if job.mode == "operational" else (export_root / f"{archive_stem}.sql")
                dump_args = [
                    pg_dump,
                    f"--dbname={settings.database_url}",
                    "--schema=public",
                    "--no-owner",
                    "--no-privileges",
                    "--column-inserts",
                    *table_filter_args,
                    f"--file={dump_path}",
                ]
                if job.mode == "operational":
                    for table in sorted(SENSITIVE_PUBLIC_TABLES):
                        dump_args.append(f"--exclude-table-data=public.{table}")
                self._run_pg_dump(dump_args)

                if job.mode == "disaster_recovery":
                    write_json(
                        export_root / "manifest.json",
                        {
                            "format": "eFlow Supabase SQL Dump",
                            "version": BACKUP_VERSION,
                            "generated_at": datetime.now(timezone.utc).isoformat(),
                            "generated_by": {"id": job.actor_id, "email": job.actor_email},
                            "mode": job.mode,
                            "scope": job.scope,
                            "tables_included": target_tables,
                            "files": {"sql_dump": dump_path.name, "checksums": "checksums.sha256"},
                        },
                    )
                    self._set_job(job, phase="Calculating checksums", progress=75)
                    write_checksums(export_root)
                    final_path = workspace / f"{archive_stem}-sql.zip"
                    self._set_job(job, phase="Encrypting SQL dump archive", progress=88)
                    self._write_archive(export_root, final_path, passphrase)
                else:
                    final_path = dump_path

                completed_at = datetime.now(timezone.utc)
                expires_at = completed_at + timedelta(hours=settings.backup_retention_hours)
                self._set_job(
                    job,
                    status="completed",
                    phase="SQL dump ready",
                    progress=100,
                    completed_at=completed_at.isoformat(),
                    expires_at=expires_at.isoformat(),
                    archive_name=final_path.name,
                    archive_size=final_path.stat().st_size,
                    archive_sha256=file_sha256(final_path),
                    archive_path=final_path,
                    table_count=len(target_tables),
                    row_count=0,
                )
                self._audit(
                    job,
                    "backup.completed",
                    {
                        "mode": job.mode,
                        "scope": job.scope,
                        "export_format": job.export_format,
                        "archive_sha256": job.archive_sha256,
                        "archive_size": job.archive_size,
                        "table_count": job.table_count,
                    },
                )
                return

            self._set_job(job, phase="Exporting database schema", progress=8)
            schema_path = export_root / "schema.sql"
            schema_args = [
                pg_dump,
                f"--dbname={settings.database_url}",
                "--schema=public",
                "--schema-only",
                "--no-owner",
                "--no-privileges",
                *table_filter_args,
                f"--file={schema_path}",
            ]
            self._run_pg_dump(schema_args)

            self._set_job(job, phase="Exporting restore-grade data SQL", progress=18)
            data_path = export_root / "data.sql"
            data_args = [
                pg_dump,
                f"--dbname={settings.database_url}",
                "--schema=public",
                "--data-only",
                "--column-inserts",
                "--no-owner",
                "--no-privileges",
                *table_filter_args,
                f"--file={data_path}",
            ]
            if job.mode == "operational":
                for table in sorted(SENSITIVE_PUBLIC_TABLES):
                    data_args.append(f"--exclude-table-data=public.{table}")
            self._run_pg_dump(data_args)

            self._set_job(job, table_count=len(target_tables), phase="Writing readable JSONL table exports", progress=28)
            data_dir = export_root / "data"
            data_dir.mkdir(exist_ok=True)
            row_counts: dict[str, int] = {}
            jsonl_skipped_tables: dict[str, str] = {}
            included_tables = [
                table for table in target_tables
                if job.mode == "disaster_recovery" or table not in SENSITIVE_PUBLIC_TABLES
            ]

            for index, table in enumerate(included_tables):
                sort_col, sort_dir = backup_explorer.default_sort_for_table(table, schema_map)
                order_expr = f"{sort_col}.{sort_dir}" if sort_col else None
                exported_count, skipped_reason = self._write_table_jsonl(
                    table,
                    data_dir / f"{table}.jsonl",
                    order_expr=order_expr,
                    redact=job.mode == "operational",
                )
                if skipped_reason:
                    jsonl_skipped_tables[table] = skipped_reason
                else:
                    row_counts[table] = exported_count
                progress = 28 + round(((index + 1) / max(1, len(included_tables))) * 45)
                self._set_job(job, progress=progress, row_count=sum(row_counts.values()))

            storage_manifest = self._storage_manifest(include_storage_manifest)
            write_json(export_root / "storage-manifest.json", storage_manifest)

            manifest = {
                "format": "eFlow Supabase Backup",
                "version": BACKUP_VERSION,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "generated_by": {"id": job.actor_id, "email": job.actor_email},
                "mode": job.mode,
                "scope": job.scope,
                "export_format": job.export_format,
                "schema": "public",
                "tables_discovered": all_tables,
                "tables_targeted": target_tables,
                "tables_exported_to_jsonl": [t for t in included_tables if t not in jsonl_skipped_tables],
                "jsonl_skipped_tables": jsonl_skipped_tables,
                "excluded_table_data": sorted(SENSITIVE_PUBLIC_TABLES) if job.mode == "operational" else [],
                "row_counts": row_counts,
                "row_count_total": sum(row_counts.values()),
                "storage_manifest_included": include_storage_manifest,
                "files": {
                    "schema": "schema.sql",
                    "restore_data": "data.sql",
                    "readable_data": "data/*.jsonl",
                    "storage": "storage-manifest.json",
                    "checksums": "checksums.sha256",
                },
            }
            write_json(export_root / "manifest.json", manifest)
            self._set_job(job, phase="Calculating checksums", progress=80)
            write_checksums(export_root)

            archive_path = workspace / f"{archive_stem}.zip"
            self._set_job(job, phase="Compressing secure archive", progress=88)
            self._write_archive(export_root, archive_path, passphrase)

            completed_at = datetime.now(timezone.utc)
            expires_at = completed_at + timedelta(hours=settings.backup_retention_hours)
            self._set_job(
                job,
                status="completed",
                phase="Backup ready",
                progress=100,
                completed_at=completed_at.isoformat(),
                expires_at=expires_at.isoformat(),
                archive_name=archive_path.name,
                archive_size=archive_path.stat().st_size,
                archive_sha256=file_sha256(archive_path),
                archive_path=archive_path,
                row_count=sum(row_counts.values()),
            )
            self._audit(
                job,
                "backup.completed",
                {
                    "mode": job.mode,
                    "scope": job.scope,
                    "export_format": job.export_format,
                    "archive_sha256": job.archive_sha256,
                    "archive_size": job.archive_size,
                    "table_count": job.table_count,
                    "row_count": job.row_count,
                },
            )
        except Exception as exc:
            LOGGER.exception("Backup job %s failed", job.id)
            self._set_job(
                job,
                status="failed",
                phase="Backup failed",
                error=str(exc),
                completed_at=datetime.now(timezone.utc).isoformat(),
                expires_at=(datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            )
            self._audit(job, "backup.failed", {"mode": job.mode, "scope": job.scope, "error": str(exc)[:1000]})

    @staticmethod
    def _run_pg_dump(args: list[str]) -> None:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=30 * 60,
            check=False,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "pg_dump failed").strip()
            raise RuntimeError(detail[-2000:])

    def _discover_public_tables(self) -> list[str]:
        return backup_explorer.discover_public_tables()

    def _write_table_jsonl(
        self,
        table: str,
        path: Path,
        *,
        order_expr: str | None = None,
        redact: bool = True,
    ) -> tuple[int, str | None]:
        validate_table_name(table)
        total = 0
        with httpx.Client(timeout=120) as client:
            with path.open("w", encoding="utf-8", newline="\n") as output:
                while True:
                    params: dict[str, Any] = {"select": "*", "limit": PAGE_SIZE, "offset": total}
                    if order_expr:
                        params["order"] = order_expr
                    response = client.get(
                        f"{settings.supabase_url}/rest/v1/{quote(table, safe='')}",
                        params=params,
                        headers={
                            "apikey": settings.supabase_service_role_key,
                            "Authorization": f"Bearer {settings.supabase_service_role_key}",
                        },
                    )
                    if response.status_code in (401, 403):
                        output.close()
                        path.unlink(missing_ok=True)
                        return 0, f"HTTP {response.status_code} via PostgREST service_role (covered by pg_dump data.sql)"
                    response.raise_for_status()
                    rows = response.json()
                    for row in rows:
                        safe_row = redact_row(row) if redact else row
                        output.write(json.dumps(safe_row, ensure_ascii=False, separators=(",", ":"), default=str) + "\n")
                    total += len(rows)
                    if len(rows) < PAGE_SIZE:
                        break
        return total, None

    @staticmethod
    def _storage_manifest(include_objects: bool) -> dict[str, Any]:
        buckets = supabase_admin.storage.list_buckets()
        normalized = []
        for bucket in buckets or []:
            if isinstance(bucket, dict):
                normalized.append({
                    "id": bucket.get("id"),
                    "name": bucket.get("name"),
                    "public": bucket.get("public", False),
                    "file_size_limit": bucket.get("file_size_limit"),
                    "allowed_mime_types": bucket.get("allowed_mime_types"),
                })
            else:
                normalized.append({
                    "id": getattr(bucket, "id", None),
                    "name": getattr(bucket, "name", None),
                    "public": getattr(bucket, "public", False),
                })
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "buckets": normalized,
            "objects_included": False,
            "object_listing_requested": include_objects,
            "note": "Binary storage objects are not embedded in the database ZIP. Bucket metadata is recorded for restore planning.",
        }

    @staticmethod
    def _write_archive(export_root: Path, archive_path: Path, passphrase: str | None) -> None:
        files = [path for path in export_root.rglob("*") if path.is_file()]
        if passphrase:
            assert pyzipper is not None
            with pyzipper.AESZipFile(
                archive_path,
                "w",
                compression=pyzipper.ZIP_DEFLATED,
                encryption=pyzipper.WZ_AES,
            ) as archive:
                archive.setpassword(passphrase.encode("utf-8"))
                archive.setencryption(pyzipper.WZ_AES, nbits=256)
                for path in files:
                    archive.write(path, arcname=(Path(export_root.name) / path.relative_to(export_root)).as_posix())
            return

        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for path in files:
                archive.write(path, arcname=(Path(export_root.name) / path.relative_to(export_root)).as_posix())

    def _remove_job_files(self, job: BackupJob) -> None:
        if job.workspace_path:
            remove_backup_path(settings.backup_root, job.workspace_path)

    @staticmethod
    def _audit(job: BackupJob, action: str, metadata: dict[str, Any]) -> None:
        try:
            supabase_admin.table("audit_events").insert({
                "actor_id": job.actor_id,
                "actor_name": job.actor_email,
                "entity_type": "database_backup",
                "entity_id": job.id,
                "action": action,
                "metadata": metadata,
            }).execute()
        except Exception:
            LOGGER.exception("Could not record backup audit event %s", action)


backup_service = BackupService()
