from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from gateway_dependencies import require_user
from routers.invitations import PrivateValidationRoute, TokenRequest, AcceptRequest, CreateAccountRequest, require_identity, public_limit
from invitations import project_members

router = APIRouter(prefix='/controlpanelEflow/api/project-invitations', tags=['project-invitations'], route_class=PrivateValidationRoute)

class DispatchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    revision: int = Field(ge=1)
    resend: bool = False

@router.post('/validate', dependencies=[Depends(public_limit)])
def validate(payload: TokenRequest):
    return project_members.validate(payload.token.get_secret_value())

@router.post('/accept', dependencies=[Depends(public_limit)])
def accept(payload: AcceptRequest, identity=Depends(require_identity)):
    return project_members.accept(payload.token.get_secret_value(), identity, payload.full_name or '')

@router.post('/create-account', dependencies=[Depends(public_limit)])
def create_account(payload: CreateAccountRequest):
    return project_members.create_account(payload.token.get_secret_value(), payload.full_name, payload.password.get_secret_value(), payload.attempt_id)

@router.post('/{request_id}/dispatch')
def dispatch(request_id: UUID, payload: DispatchRequest, user=Depends(require_user)):
    return project_members.dispatch(user, str(request_id), payload.revision, payload.resend)
