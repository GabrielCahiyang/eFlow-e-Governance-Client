"""Admin Archive & Retention Maintenance endpoints."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field

from gateway_dependencies import AuthenticatedUser, require_admin
from services import retention_service

router = APIRouter(
    prefix="/controlpanelEflow/api/admin/retention",
    tags=["admin-retention"],
)

PublicArchiveMode = Literal[
    "keep_manifest_purge_files",
    "purge_all_public",
    "keep_full_public",
]


class RetentionPolicyPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_auto_archive_days: int = Field(ge=1, le=3650)
    archive_retention_days: int = Field(ge=1, le=7300)
    archive_retention_notice_days: int = Field(ge=1, le=365)
    archive_retention_require_seal: bool
    archive_retention_auto_purge: bool
    archive_retention_public_mode: PublicArchiveMode


class LegalHoldPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    hold: bool
    reason: str = Field(min_length=5, max_length=1000)


class PurgeProjectPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm_title: str = Field(min_length=1, max_length=300)
    reason: str = Field(min_length=5, max_length=1000)
    early_override: bool = False
    public_mode: PublicArchiveMode | None = None


@router.get("/overview")
def read_retention_overview(_user: AuthenticatedUser = Depends(require_admin)):
    return retention_service.get_retention_overview()


@router.put("/policy")
def save_retention_policy(
    payload: RetentionPolicyPayload,
    user: AuthenticatedUser = Depends(require_admin),
):
    return retention_service.update_retention_policy(payload.model_dump(), user)


@router.get("/projects/{project_id}/preview")
def preview_project_purge(
    project_id: UUID,
    public_mode: PublicArchiveMode | None = Query(default=None),
    _user: AuthenticatedUser = Depends(require_admin),
):
    return retention_service.preview_project_purge(str(project_id), public_mode)


@router.post("/projects/{project_id}/legal-hold")
def set_project_legal_hold(
    project_id: UUID,
    payload: LegalHoldPayload,
    user: AuthenticatedUser = Depends(require_admin),
):
    return retention_service.set_project_legal_hold(
        str(project_id), payload.hold, payload.reason, user
    )


@router.post("/projects/{project_id}/purge")
def execute_project_purge(
    project_id: UUID,
    payload: PurgeProjectPayload,
    user: AuthenticatedUser = Depends(require_admin),
):
    return retention_service.purge_project(
        str(project_id),
        payload.confirm_title,
        payload.reason,
        payload.early_override,
        payload.public_mode,
        user,
    )


@router.post("/run-maintenance")
def run_retention_maintenance(user: AuthenticatedUser = Depends(require_admin)):
    return retention_service.run_maintenance_cycle(user)


@router.get("/dispositions/{disposition_id}/certificate")
def read_disposition_certificate(
    disposition_id: UUID,
    _user: AuthenticatedUser = Depends(require_admin),
):
    return retention_service.get_disposition_certificate(str(disposition_id))
