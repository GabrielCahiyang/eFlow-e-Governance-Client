"""Admin database Backup, DB Dump, Table Explorer & Export endpoints."""

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from gateway_config import settings
from gateway_dependencies import AuthenticatedUser, require_database_backup, require_recent_database_backup
from services.backup_explorer import (
    ExplorerPermissionError,
    ExplorerValidationError,
    backup_explorer,
)
from services.backup_security import ensure_within
from services.backup_service import backup_service


router = APIRouter(prefix="/controlpanelEflow/api/admin/backups", tags=["backups"])


class CreateBackupPayload(BaseModel):
    mode: Literal["operational", "disaster_recovery"] = "operational"
    confirmation: str = Field(min_length=1, max_length=80)
    include_storage_manifest: bool = True
    passphrase: str | None = Field(default=None, max_length=256)
    scope: Literal["full", "important", "selected"] = "full"
    export_format: Literal["archive", "sql_dump"] = "archive"
    tables: list[str] = Field(default_factory=list, max_length=200)


@router.get("")
async def backup_overview(user: AuthenticatedUser = Depends(require_database_backup)):
    return {
        "preflight": backup_service.preflight(),
        "jobs": backup_service.list_jobs(user.id),
    }


@router.post("", status_code=202)
async def create_backup(
    payload: CreateBackupPayload,
    user: AuthenticatedUser = Depends(require_recent_database_backup),
):
    try:
        return backup_service.start(
            actor=user,
            mode=payload.mode,
            confirmation=payload.confirmation,
            include_storage_manifest=payload.include_storage_manifest,
            passphrase=payload.passphrase,
            scope=payload.scope,
            export_format=payload.export_format,
            tables=payload.tables,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/jobs")
async def list_backup_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: str = Query("all"),
    mode: str = Query("all"),
    scope: str = Query("all"),
    export_format: str = Query("all"),
    search: str = Query(""),
    date_from: str = Query(""),
    date_to: str = Query(""),
    user: AuthenticatedUser = Depends(require_database_backup),
):
    return backup_service.list_jobs_filtered(
        user.id,
        page=page,
        page_size=page_size,
        status=status,
        mode=mode,
        scope=scope,
        export_format=export_format,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/tables")
async def list_backup_tables(
    search: str = Query(""),
    category: str = Query("all"),
    importance: str = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    include_counts: bool = Query(True),
    _user: AuthenticatedUser = Depends(require_database_backup),
):
    try:
        return await backup_explorer.list_tables(
            search=search,
            category=category,
            importance=importance,
            page=page,
            page_size=page_size,
            include_counts=include_counts,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not inspect public tables: {exc}") from exc


@router.get("/tables/{table_name}/rows")
async def browse_table_rows(
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str = Query(""),
    sort_by: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    filter_col: str | None = Query(None),
    filter_val: str | None = Query(None),
    date_col: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    _user: AuthenticatedUser = Depends(require_database_backup),
):
    try:
        return backup_explorer.browse_table_rows(
            table_name,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filter_col=filter_col,
            filter_val=filter_val,
            date_col=date_col,
            date_from=date_from,
            date_to=date_to,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' was not found.") from exc
    except ExplorerPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (ExplorerValidationError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not query table '{table_name}': {exc}") from exc


@router.get("/tables/{table_name}/export")
async def export_table_rows(
    table_name: str,
    export_format: Literal["csv", "json", "jsonl", "sql"] = Query("csv", alias="format"),
    scope: Literal["page", "filtered", "all"] = Query("filtered"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str = Query(""),
    sort_by: str | None = Query(None),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    filter_col: str | None = Query(None),
    filter_val: str | None = Query(None),
    date_col: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    user: AuthenticatedUser = Depends(require_database_backup),
):
    try:
        exported = backup_explorer.export_table_data(
            user,
            table_name,
            export_format=export_format,
            scope=scope,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            filter_col=filter_col,
            filter_val=filter_val,
            date_col=date_col,
            date_from=date_from,
            date_to=date_to,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Table '{table_name}' was not found.") from exc
    except ExplorerPermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (ExplorerValidationError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not export table '{table_name}': {exc}") from exc

    headers = {
        "Content-Disposition": f'attachment; filename="{exported["filename"]}"',
        "X-Export-Row-Count": str(exported["row_count"]),
        "X-Export-Total-Matching": str(exported["total_matching"]),
        "X-Export-Truncated": "true" if exported["truncated"] else "false",
    }
    return Response(content=exported["content"], media_type=exported["media_type"], headers=headers)


@router.get("/{job_id}")
async def backup_status(
    job_id: str,
    user: AuthenticatedUser = Depends(require_database_backup),
):
    try:
        return backup_service.get_job(job_id, user.id).public()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Backup job not found.") from exc


@router.get("/{job_id}/download")
async def download_backup(
    job_id: str,
    user: AuthenticatedUser = Depends(require_database_backup),
):
    try:
        job = backup_service.get_job(job_id, user.id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Backup job not found.") from exc
    if job.status != "completed" or not job.archive_path or not job.archive_name:
        raise HTTPException(status_code=409, detail="Backup archive is not ready.")
    archive_path = ensure_within(settings.backup_root, Path(job.archive_path))
    if not archive_path.is_file():
        raise HTTPException(status_code=410, detail="Backup archive has expired.")
    backup_service.mark_downloaded(job)
    media_type = "application/sql" if job.archive_name.lower().endswith(".sql") else "application/zip"
    return FileResponse(
        path=archive_path,
        filename=job.archive_name,
        media_type=media_type,
    )


@router.delete("/{job_id}", status_code=204)
async def delete_backup(
    job_id: str,
    user: AuthenticatedUser = Depends(require_database_backup),
):
    try:
        backup_service.delete(job_id, user)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Backup job not found.") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
