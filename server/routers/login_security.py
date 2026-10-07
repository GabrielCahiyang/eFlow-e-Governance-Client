"""Public password submission and strictly Admin-only lockout management."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from gateway_dependencies import AuthenticatedUser, require_admin
from services import login_security as service


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


@router.post("/auth/login")
def login(payload: LoginPayload):
    return safe(lambda: service.login(payload.email, payload.password.get_secret_value()))


@router.get("/admin/login-security")
def read_security(user: AuthenticatedUser = Depends(require_admin)):
    return safe(lambda: service.rpc("admin", p_actor=user.id, p_action="read"))


@router.patch("/admin/login-security")
def update_security(payload: SettingsPayload, user: AuthenticatedUser = Depends(require_admin)):
    return safe(lambda: service.rpc("admin", p_actor=user.id, p_action="settings", p_limit=payload.max_attempts))


@router.post("/admin/login-security/{user_id}/unlock")
def unlock_account(user_id: UUID, user: AuthenticatedUser = Depends(require_admin)):
    return safe(lambda: service.unlock(user.id, str(user_id)))
