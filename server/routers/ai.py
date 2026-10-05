"""Authenticated, owner-scoped proxy to the loopback AI API."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
import httpx
from pydantic import BaseModel, Field

from gateway_config import settings
from gateway_dependencies import AuthenticatedUser, internal_ai_key, require_user, supabase_admin
from uuid import UUID
from services.staffing_context import build_staffing_context


logger = logging.getLogger("eflow.ai")
router = APIRouter(prefix="/controlpanelEflow/api/ai", tags=["ai"])


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=500_000)


class WorkspaceDecompositionRequest(BaseModel):
    schemaVersion: int = Field(ge=1, le=1)
    projectId: UUID
    sourceText: str = Field(min_length=1, max_length=500_000)
    context: dict[str, Any] = Field(default_factory=dict)


class ChatRequest(BaseModel):
    model: str = Field(min_length=1, max_length=200)
    messages: list[ChatMessage] = Field(min_length=1, max_length=200)
    stream: bool = False
    request_id: str | None = Field(default=None, min_length=1, max_length=100)
    workspace_decomposition: WorkspaceDecompositionRequest | None = None
    workspace_staffing: dict[str, Any] | None = None


def checked_chat_payload(payload: ChatRequest, user: AuthenticatedUser) -> dict:
    body = payload.model_dump(mode="json", exclude_none=True)
    if payload.workspace_staffing is not None:
        if payload.workspace_decomposition is not None:
            raise HTTPException(422, 'Choose one AI operation.')
        try:
            task_id = str(UUID(str(payload.workspace_staffing.get('taskId', ''))))
        except ValueError:
            raise HTTPException(422, 'A valid task is required.')
        context = build_staffing_context(task_id, user)
        if not context['candidates']:
            raise HTTPException(409, 'Ask eligible Office members to confirm their professional profiles first.')
        body['workspace_staffing'] = {'schemaVersion': 1, 'taskId': task_id, 'context': context}
        body['messages'] = [{'role': 'user', 'content': 'Recommend eligible Office staff from confirmed professional context.'}]
        return body
    request = payload.workspace_decomposition
    if request is None:
        return body
    if user.role != "head" or not user.org_id:
        raise HTTPException(status_code=403, detail="Only an active Office Head can decompose project work.")
    project = supabase_admin.table("projects").select("id,org_id,title,description,start_date,target_date,status").eq("id", str(request.projectId)).maybe_single().execute().data
    if not project or str(project["org_id"]) != user.org_id or project["status"] in ("completed", "archived"):
        raise HTTPException(status_code=403, detail="Choose an open project belonging to your Office.")
    groups = supabase_admin.table("project_groups").select("id,title").eq("project_id", str(request.projectId)).order("position").execute().data or []
    tasks = supabase_admin.table("tasks").select("id,title,description,group_id").eq("linked_project_id", str(request.projectId)).is_("deleted_at", "null").limit(300).execute().data or []
    offices = supabase_admin.table("organizations").select("id,name,slug").execute().data or []
    receipts = supabase_admin.table("project_import_batches").select("review").eq("project_id", str(request.projectId)).order("created_at", desc=True).limit(5).execute().data or []
    responsibilities = []
    for receipt in receipts:
        review = receipt.get("review")
        proposals = review.get("offices") if isinstance(review, dict) else None
        if isinstance(proposals, list):
            responsibilities.extend(office for office in proposals if isinstance(office, dict))
    # Actual project state replaces caller-supplied context. No PDS or personnel
    # records are sent to the model and no service-role writes occur here.
    body["workspace_decomposition"]["context"] = {
        "title": project["title"], "description": project.get("description", ""),
        "startDate": project.get("start_date"), "targetDate": project.get("target_date"),
        "groups": groups, "existingTasks": tasks, "knownOffices": offices, "officeResponsibilities": responsibilities,
    }
    return body


def _internal_headers(user: AuthenticatedUser) -> dict[str, str]:
    try:
        internal_key = internal_ai_key.get()
    except Exception as exc:
        logger.exception("Internal AI key is unavailable")
        raise HTTPException(status_code=503, detail="AI gateway is not configured.") from exc
    return {
        "Authorization": f"Bearer {internal_key}",
        "X-eFlow-User-Id": user.id,
    }


async def _proxy(
    method: str,
    path: str,
    user: AuthenticatedUser,
    *,
    payload: dict[str, Any] | None = None,
    timeout_seconds: float = 30,
) -> Response:
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(timeout_seconds, connect=10.0),
        ) as client:
            upstream = await client.request(
                method,
                f"{settings.internal_ai_base_url}/{path.lstrip('/')}",
                json=payload,
                headers=_internal_headers(user),
            )
    except httpx.ConnectError as exc:
        raise HTTPException(status_code=503, detail="The local AI service is offline.") from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="The local AI request timed out.") from exc
    except httpx.HTTPError as exc:
        logger.exception("AI proxy request failed")
        raise HTTPException(status_code=502, detail="The AI gateway request failed.") from exc

    content_type = upstream.headers.get("content-type", "application/json")
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=content_type.split(";", 1)[0],
    )


_STATUS_KEYS = ("ai_endpoint", "ai_endpoint_status", "ai_endpoint_heartbeat")


async def _read_system_config(keys: tuple[str, ...]) -> dict[str, str | None]:
    """Read system_config rows using the service role key (bypasses RLS)."""
    service_headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }
    key_filter = "in.(" + ",".join(keys) + ")"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            resp = await client.get(
                f"{settings.supabase_url}/rest/v1/system_config",
                params={"select": "key,value", "key": key_filter},
                headers=service_headers,
            )
            resp.raise_for_status()
            rows = resp.json()
    except Exception as exc:
        logger.warning("Failed to read system_config for AI status: %s", exc)
        raise HTTPException(status_code=503, detail="Could not read AI configuration.") from exc

    return {row["key"]: row.get("value") for row in rows if isinstance(row, dict)}


@router.get("/status")
async def ai_status() -> dict[str, str | None]:
    """Return AI endpoint configuration for the browser without relying on the
    browser's Supabase session. Reads system_config via the server-side service
    role key so RLS does not apply. The tunnel URL is already public config —
    the RLS policy allows any authenticated Supabase user to read it, so
    exposing it here without a session check is equivalent."""
    config = await _read_system_config(_STATUS_KEYS)
    return {
        "ai_endpoint": config.get("ai_endpoint"),
        "ai_endpoint_status": config.get("ai_endpoint_status"),
        "ai_endpoint_heartbeat": config.get("ai_endpoint_heartbeat"),
    }


@router.post("/jobs")
async def enqueue_job(
    payload: ChatRequest,
    user: AuthenticatedUser = Depends(require_user),
):
    if payload.stream:
        raise HTTPException(status_code=400, detail="Queued AI jobs cannot stream.")
    return await _proxy("POST", "jobs", user, payload=checked_chat_payload(payload, user))


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    user: AuthenticatedUser = Depends(require_user),
):
    return await _proxy("GET", f"jobs/{job_id}", user)


@router.post("/chat")
async def proxy_chat(
    payload: ChatRequest,
    user: AuthenticatedUser = Depends(require_user),
):
    """Compatibility route; new eFlow callers use the queued job API."""
    return await _proxy(
        "POST",
        "chat",
        user,
        payload=checked_chat_payload(payload, user),
        timeout_seconds=settings.ai_timeout_seconds,
    )
