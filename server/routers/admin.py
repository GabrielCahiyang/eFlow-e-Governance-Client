"""Privileged user-management and moderated chat operations."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from services.administrative_roles import is_administrator
from services.private_validation import PrivateValidationRoute
from services import managed_account_activation as activation
from gateway_dependencies import AuthenticatedUser, require_user_manager, require_user, supabase_admin

router = APIRouter(prefix="/controlpanelEflow/api/admin", tags=["admin"], route_class=PrivateValidationRoute)
CreateUserPayload = activation.StageManagedAccountPayload

def _profile_role(uid: str) -> str | None:
    result = supabase_admin.table("profiles").select("role").eq("id", uid).maybe_single().execute()
    return str(result.data.get("role")) if result.data else None

@router.post("/users/create", status_code=201)
async def create_managed_user(payload: CreateUserPayload, user: AuthenticatedUser = Depends(require_user_manager)):
    if payload.mode != 'ledipo_create':
        raise HTTPException(422, 'Use Create LEDIPO User for this request.')
    return await run_in_threadpool(activation.stage, payload, user)

@router.post("/users/invite", status_code=201)
def invite_managed_user(payload: CreateUserPayload, user: AuthenticatedUser = Depends(require_user_manager)):
    if payload.mode != 'office_invite':
        raise HTTPException(422, 'Use Invite eFlow User for this request.')
    return activation.stage(payload, user)

@router.get("/users/invite-options")
def managed_invite_options(user: AuthenticatedUser = Depends(require_user_manager)):
    return activation.options(user)

@router.get("/users/pending-activation")
def pending_activations(user: AuthenticatedUser = Depends(require_user_manager)):
    return activation.list_safe(user)

@router.post("/users/pending-activation/{invitation_id}/resend")
def resend_activation(invitation_id: UUID, user: AuthenticatedUser = Depends(require_user_manager)):
    return activation.manage(str(invitation_id), 'resend', user)

@router.post("/users/pending-activation/{invitation_id}/revoke")
def revoke_activation(invitation_id: UUID, user: AuthenticatedUser = Depends(require_user_manager)):
    return activation.manage(str(invitation_id), 'revoke', user)

@router.post("/users/pending-activation/{invitation_id}/approve")
def approve_activation(invitation_id: UUID, user: AuthenticatedUser = Depends(require_user_manager)):
    return activation.manage(str(invitation_id), 'approve', user)



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
        if is_administrator(target_role):
            if not is_administrator(user.role):
                raise HTTPException(status_code=403, detail="Only Admin can delete an Admin account.")
            active_admins = supabase_admin.table("profiles").select("id").in_(
                "role", ["admin", "super_admin"]
            ).eq("is_active", True).execute().data or []
            if any(str(profile["id"]) == uid for profile in active_admins) and len(active_admins) <= 1:
                raise HTTPException(status_code=400, detail="The last active Admin account is protected.")
        if target_role in {"head", "dept_head", "department_head"} and not is_administrator(user.role):
            raise HTTPException(status_code=403, detail="Only Admin can delete a leadership account.")
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
    if sender_id == user.id:
        return
    if user.role == "head" and user.org_id:
        sender = supabase_admin.table("profiles").select("org_id").eq("id", sender_id).single().execute()
        if (sender.data or {}).get("org_id") == user.org_id:
            return
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
