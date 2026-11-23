"""Authenticated gateway proxy for server-side Process Mining Deep Analysis."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

from gateway_dependencies import (
    AuthenticatedUser,
    _permission_allowed,
    bearer,
    is_administrator,
    require_user,
)
from routers.ai import _proxy

router = APIRouter(prefix="/controlpanelEflow/api/process-mining", tags=["process-mining"])

_PM_OFFLINE = (
    "The Process Mining analysis service (:8321) is offline. "
    "Start the AI/analysis server to run Deep Process Analysis."
)


class ProcessMiningJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    project_id: Optional[UUID] = None
    include_completed: bool = True
    from_date: Optional[str] = Field(default=None, max_length=40)
    to_date: Optional[str] = Field(default=None, max_length=40)
    request_id: Optional[str] = Field(default=None, min_length=1, max_length=100)


def require_process_mining_head(
    user: AuthenticatedUser = Depends(require_user),
) -> AuthenticatedUser:
    if is_administrator(user.role) or not user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Deep Process Analysis is available only to active operational office accounts.",
        )
    try:
        allowed = _permission_allowed(user, "navigation.team_intelligence")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Analytics authorization could not be verified.",
        ) from exc
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The navigation.team_intelligence capability is required.",
        )
    return user


@router.post("/jobs")
async def create_job(
    body: ProcessMiningJobRequest,
    user: AuthenticatedUser = Depends(require_process_mining_head),
    credentials=Depends(bearer),
):
    return await _proxy(
        "POST",
        "process-mining/jobs",
        user,
        payload=body.model_dump(mode="json", exclude_none=True),
        session_token=credentials.credentials,
        timeout_seconds=30,
        offline_detail=_PM_OFFLINE,
    )


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: UUID,
    user: AuthenticatedUser = Depends(require_process_mining_head),
    credentials=Depends(bearer),
):
    return await _proxy(
        "GET",
        f"process-mining/jobs/{job_id}",
        user,
        session_token=credentials.credentials,
        timeout_seconds=30,
        offline_detail=_PM_OFFLINE,
    )


@router.delete("/jobs/{job_id}")
async def cancel_job(
    job_id: UUID,
    user: AuthenticatedUser = Depends(require_process_mining_head),
    credentials=Depends(bearer),
):
    return await _proxy(
        "DELETE",
        f"process-mining/jobs/{job_id}",
        user,
        session_token=credentials.credentials,
        timeout_seconds=30,
        offline_detail=_PM_OFFLINE,
    )
