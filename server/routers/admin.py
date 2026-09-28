"""Privileged user-management and moderated chat operations."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from gateway_dependencies import (
    AuthenticatedUser,
    require_user_manager,
    require_user,
    supabase_admin,
)


router = APIRouter(prefix="/controlpanelEflow/api/admin", tags=["admin"])


class CreateUserPayload(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str
    role: str = "employee"
    org_id: str | None = None
    employee_id: str | None = None
    skills: dict = {}


def _employee_id_for_profile(employee_id: str | None, uid: str) -> str:
    """The deployed schema requires a unique non-empty employee_id."""
    normalized = (employee_id or "").strip()
    return normalized or f"UNASSIGNED-{uid}"


def _find_auth_user_by_email(email: str):
    normalized_email = email.strip().lower()
    for user in supabase_admin.auth.admin.list_users(per_page=1000):
        if (user.email or "").strip().lower() == normalized_email:
            return user
    return None


def _profile_exists(uid: str) -> bool:
    result = (
        supabase_admin.table("profiles")
        .select("id")
        .eq("id", uid)
        .maybe_single()
        .execute()
    )
    return bool(result.data)


def _profile_role(uid: str) -> str | None:
    result = (
        supabase_admin.table("profiles")
        .select("role")
        .eq("id", uid)
        .maybe_single()
        .execute()
    )
    return str(result.data.get("role")) if result.data else None


@router.post("/users/create")
async def create_managed_user(
    payload: CreateUserPayload,
    user: AuthenticatedUser = Depends(require_user_manager),
):
    allowed_roles = {
        "admin", "dept_head", "assistant_head", "accounting_staff", "employee",
        "department_head", "executive", "legislative", "hrmo", "finance", "councilor_pad",
    }
    if payload.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Choose a supported account role.")
    if user.role != "super_admin" and payload.role not in {"employee", "accounting_staff"}:
        raise HTTPException(
            status_code=403,
            detail="Only the Super Admin can create administrative or leadership accounts.",
        )
    created_uid: str | None = None
    try:
        existing_user = _find_auth_user_by_email(payload.email)
        if existing_user:
            uid = str(existing_user.id)
            if _profile_exists(uid):
                raise HTTPException(
                    status_code=409,
                    detail="A user with this email already exists.",
                )
            # Recover an Auth account left behind by an older failed profile insert.
            supabase_admin.auth.admin.update_user_by_id(
                uid,
                {"password": payload.password, "email_confirm": True},
            )
        else:
            auth_response = supabase_admin.auth.admin.create_user(
                {
                    "email": payload.email,
                    "password": payload.password,
                    "email_confirm": True,
                }
            )
            uid = str(auth_response.user.id)
            created_uid = uid

        supabase_admin.table("profiles").insert(
            {
                "id": uid,
                "full_name": payload.full_name,
                "email": payload.email,
                "role": payload.role,
                "org_id": payload.org_id,
                "employee_id": _employee_id_for_profile(payload.employee_id, uid),
                "is_active": True,
                "skills": payload.skills,
            }
        ).execute()
        return {"uid": uid, "email": payload.email}
    except HTTPException:
        raise
    except Exception as exc:
        # Auth and profile creation are separate Supabase operations. Compensate
        # if the second step fails so retrying does not hit an orphan account.
        if created_uid:
            try:
                supabase_admin.auth.admin.delete_user(created_uid)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/users/{uid}")
async def delete_managed_user(
    uid: str,
    user: AuthenticatedUser = Depends(require_user_manager),
):
    if uid == user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot permanently delete the account you are currently using.",
        )
    try:
        target_role = _profile_role(uid)
        if target_role == "super_admin":
            raise HTTPException(status_code=403, detail="The Super Admin account is protected.")
        if target_role == "admin" and user.role != "super_admin":
            raise HTTPException(status_code=403, detail="Only the Super Admin can delete an Admin account.")
        supabase_admin.auth.admin.delete_user(uid)
        return {"deleted": uid}
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        if "foreign key" in message.lower() or "still referenced" in message.lower():
            message = (
                "This account is linked to work or audit history and cannot be permanently deleted. "
                "Deactivate it to preserve those records."
            )
        raise HTTPException(status_code=400, detail=message) from exc


class UpdateMessagePayload(BaseModel):
    messageId: str
    newContent: str = Field(min_length=1)


class DeleteMessagePayload(BaseModel):
    messageId: str


def _require_message_moderator(message_id: str, user: AuthenticatedUser) -> None:
    result = (
        supabase_admin.table("chat_messages")
        .select("sender_id")
        .eq("id", message_id)
        .single()
        .execute()
    )
    sender_id = str((result.data or {}).get("sender_id", ""))
    if user.role not in {"super_admin", "dept_head", "assistant_head"} and sender_id != user.id:
        raise HTTPException(status_code=403, detail="You cannot modify this message.")


@router.post("/chat/messages/update")
async def update_chat_message(
    payload: UpdateMessagePayload,
    user: AuthenticatedUser = Depends(require_user),
):
    try:
        _require_message_moderator(payload.messageId, user)
        supabase_admin.table("chat_messages").update(
            {"content": payload.newContent}
        ).eq("id", payload.messageId).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/chat/messages/delete")
async def delete_chat_message(
    payload: DeleteMessagePayload,
    user: AuthenticatedUser = Depends(require_user),
):
    try:
        _require_message_moderator(payload.messageId, user)
        supabase_admin.table("chat_messages").delete().eq(
            "id", payload.messageId
        ).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
