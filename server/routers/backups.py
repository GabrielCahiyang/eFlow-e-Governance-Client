"""Admin database Backup & Export endpoints."""

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from gateway_dependencies import AuthenticatedUser, require_database_backup, require_recent_database_backup
from services.backup_security import ensure_within
from services.backup_service import backup_service
from gateway_config import settings


router = APIRouter(prefix="/controlpanelEflow/api/admin/backups", tags=["backups"])


class CreateBackupPayload(BaseModel):
    mode: Literal["operational", "disaster_recovery"] = "operational"
    confirmation: str = Field(min_length=1, max_length=80)
    include_storage_manifest: bool = True
    passphrase: str | None = Field(default=None, max_length=256)


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
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


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
    return FileResponse(
        path=archive_path,
        filename=job.archive_name,
        media_type="application/zip",
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
