"""Public password submission and strictly Admin-only lockout management."""
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from gateway_dependencies import AuthenticatedUser, require_admin, supabase_admin
from services import login_security as service
from services import password_reset


class PrivateLoginRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                response = await original(request)
                response.headers["Cache-Control"] = "no-store"
                return response
            except RequestValidationError:
                raise HTTPException(422, "Check the sign-in fields.") from None
        return handler


router = APIRouter(prefix="/controlpanelEflow/api", tags=["login-security"], route_class=PrivateLoginRoute)


class LoginPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)
    password: SecretStr = Field(min_length=1, max_length=4096)
    portal: Literal["client", "admin"] | None = None


class ForgotPasswordPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str = Field(min_length=3, max_length=320)


class SettingsPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_attempts: int = Field(ge=1, le=20, strict=True)


def safe(operation):
    try:
        return operation()
    except HTTPException:
        raise
    except Exception:
        # Do not leak provider bodies, database details or credentials.
        raise HTTPException(503, "The account security service is unavailable. Please try again shortly.") from None


@router.get("/auth/public-branding")
def public_branding():
    default_title = "LGU Ormoc City"
    default_subtitle = "Use your official LGU account."
    try:
        rows = (
            supabase_admin.table("system_config")
            .select("key,value")
            .in_("key", ["login_portal_title", "login_portal_subtitle"])
            .execute()
            .data
            or []
        )
        cfg = {
            str(row["key"]): str(row["value"]).strip()
            for row in rows
            if isinstance(row, dict) and isinstance(row.get("key"), str) and isinstance(row.get("value"), str)
        }
        title = cfg.get("login_portal_title") or default_title
        subtitle = cfg.get("login_portal_subtitle") or default_subtitle
        return {
            "login_portal_title": title,
            "login_portal_subtitle": subtitle,
            "organization_name": title,
            "organization_subtitle": subtitle,
        }
    except Exception:
        return {
            "login_portal_title": default_title,
            "login_portal_subtitle": default_subtitle,
            "organization_name": default_title,
            "organization_subtitle": default_subtitle,
        }


@router.post("/auth/login")
def login(payload: LoginPayload):
    return safe(lambda: service.login(payload.email, payload.password.get_secret_value(), payload.portal))


@router.post("/auth/forgot-password")
def forgot_password(payload: ForgotPasswordPayload, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    return safe(lambda: password_reset.request_public_reset(payload.email, client_ip))


@router.get("/admin/login-security")
def read_security(user: AuthenticatedUser = Depends(require_admin)):
    return safe(lambda: service.rpc("admin", p_actor=user.id, p_action="read"))


@router.patch("/admin/login-security")
def update_security(payload: SettingsPayload, user: AuthenticatedUser = Depends(require_admin)):
    return safe(lambda: service.rpc("admin", p_actor=user.id, p_action="settings", p_limit=payload.max_attempts))


@router.post("/admin/login-security/{user_id}/unlock")
def unlock_account(user_id: UUID, user: AuthenticatedUser = Depends(require_admin)):
    return safe(lambda: service.unlock(user.id, str(user_id)))
