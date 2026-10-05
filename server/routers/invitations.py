from collections import defaultdict, deque
from dataclasses import dataclass
import time
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field, SecretStr
from gateway_dependencies import bearer, require_user, supabase_admin
from invitations import service

class PrivateValidationRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError as exc:
                raise HTTPException(422, 'Check the invitation fields and password requirements.') from exc
        return handler

router = APIRouter(prefix='/controlpanelEflow/api/invitations', tags=['invitations'], route_class=PrivateValidationRoute)

class TokenRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    token: SecretStr = Field(min_length=40, max_length=128)

class CreateAccountRequest(TokenRequest):
    full_name: str = Field(min_length=2, max_length=160)
    password: SecretStr = Field(min_length=12, max_length=128)
    attempt_id: UUID

class AcceptRequest(TokenRequest):
    full_name: str | None = Field(default=None, min_length=2, max_length=160)

class InviteRow(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=254)
    account_role: str

class InviteBatch(BaseModel):
    model_config = ConfigDict(extra='forbid')
    invitations: list[InviteRow] = Field(min_length=1, max_length=5)

class ResendRequest(BaseModel):
    copy_link: bool = False

class ProjectOfficeInvite(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project_id: UUID
    office_id: UUID
    email: str = Field(min_length=3, max_length=254)
    access: str = Field(pattern='^(collaborating|observer)$')

_attempts = defaultdict(deque)
def public_limit(request: Request):
    key = request.client.host if request.client else 'unknown'
    now = time.monotonic()
    if len(_attempts) > 10000:
        for stale in list(_attempts):
            if not _attempts[stale] or _attempts[stale][-1] < now - 60:
                del _attempts[stale]
    attempts = _attempts[key]
    while attempts and attempts[0] < now - 60:
        attempts.popleft()
    if len(attempts) >= 30:
        raise HTTPException(429, 'Please wait before trying again.')
    attempts.append(now)

@dataclass
class Identity:
    id: str
    email: str

def require_identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> Identity:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(401, 'Sign in with the invited email.')
    try:
        user = supabase_admin.auth.get_user(credentials.credentials).user
    except Exception as exc:
        raise HTTPException(401, 'Sign in with the invited email.') from exc
    if not user or not user.email or not user.email_confirmed_at:
        raise HTTPException(401, 'A verified account is required.')
    return Identity(str(user.id), user.email)

@router.get('')
def list_invitations(user=Depends(require_user)):
    service.require_head(user)
    rows = supabase_admin.table('user_invitations').select(service.SAFE_FIELDS).eq('office_id', user.org_id).eq('invitation_type', 'office_member').order('created_at', desc=True).limit(250).execute().data or []
    now = service.datetime.now(service.timezone.utc)
    for item in rows:
        if item['status'] == 'pending' and service.datetime.fromisoformat(item['expires_at'].replace('Z', '+00:00')) <= now:
            item['status'] = 'expired'
    documents = supabase_admin.table('user_pds_documents').select('id,invitation_id,original_filename,processing_status,processing_error').eq('office_id', user.org_id).eq('uploaded_by', user.id).order('created_at', desc=True).limit(250).execute().data or []
    for item in rows:
        item['pds_documents'] = [document for document in documents if document['invitation_id'] == item['id']]
    return {'invitations': rows}

team_router = APIRouter(prefix='/controlpanelEflow/api/office-team', tags=['office-team'])

@team_router.get('')
def office_team(user=Depends(require_user)):
    service.require_head(user)
    office = supabase_admin.table('organizations').select('name').eq('id', user.org_id).single().execute().data
    members = supabase_admin.table('profiles').select('id,full_name,email,role,is_active').eq('org_id', user.org_id).order('full_name').execute().data or []
    return {'office_name': office['name'], 'members': members}

@router.post('')
def create_invitations(payload: InviteBatch, user=Depends(require_user)):
    service.require_head(user)
    results = []
    for row in payload.invitations:
        try:
            results.append({'email': row.email, 'invitation': service.create(user, row.email, row.account_role)})
        except HTTPException as exc:
            results.append({'email': row.email, 'error': exc.detail})
    return {'results': results}

@router.post('/validate', dependencies=[Depends(public_limit)])
def validate_invitation(payload: TokenRequest):
    item = service.lookup(payload.token.get_secret_value())
    office = supabase_admin.table('organizations').select('name').eq('id', item['office_id']).single().execute().data
    # Existing-identity detection stays server-side, accessible only with the opaque token.
    exists = supabase_admin.rpc('phase2_identity_exists', {'p_email': item['email_normalized']}).execute().data
    has_profile = supabase_admin.rpc('phase2_profile_exists', {'p_email': item['email_normalized']}).execute().data if exists else False
    result = {'email': item['email'], 'office_name': office['name'], 'account_role': item['account_role'], 'expires_at': item['expires_at'], 'existing_account': bool(exists), 'needs_full_name': bool(exists and not has_profile)}
    if item.get('invitation_type') == 'project_office':
        context = service.project_context(item, pending=True)
        result.update(invitation_type='project_office', office_name=context['office_name'], project_title=context['project_title'], project_id=context['project_id'], workspace_access=context['relationship_type'])
    return result

@router.post('/project-office')
def invite_project_office(payload: ProjectOfficeInvite, user=Depends(require_user)):
    return service.create_project_invitation(user, str(payload.project_id), str(payload.office_id), payload.email, payload.access)

@router.get('/project/{project_id}')
def project_invitations(project_id: UUID, user=Depends(require_user)):
    service.require_head(user)
    if not supabase_admin.rpc('can_manage_project', {'target_project': str(project_id), 'caller_id': user.id}).execute().data:
        raise HTTPException(403, 'Only the Lead Office Head can manage project invitations.')
    offices = supabase_admin.table('project_offices').select('id').eq('project_id', str(project_id)).execute().data or []
    if not offices:
        return {'invitations': []}
    rows = supabase_admin.table('user_invitations').select(service.SAFE_FIELDS).eq('office_id', user.org_id).in_('project_office_id', [o['id'] for o in offices]).order('created_at', desc=True).limit(250).execute().data or []
    now = service.datetime.now(service.timezone.utc)
    for item in rows:
        if item['status'] == 'pending' and service.datetime.fromisoformat(item['expires_at'].replace('Z', '+00:00')) <= now:
            item['status'] = 'expired'
    return {'invitations': rows}

@router.post('/create-account', dependencies=[Depends(public_limit)])
def create_invited_account(payload: CreateAccountRequest):
    return service.create_account(payload.token.get_secret_value(), payload.full_name, payload.password.get_secret_value(), payload.attempt_id)

@router.post('/accept', dependencies=[Depends(public_limit)])
def accept_invitation(payload: AcceptRequest, identity=Depends(require_identity)):
    return service.accept_existing(payload.token.get_secret_value(), identity, full_name=payload.full_name or '')

@router.post('/{invitation_id}/resend')
def resend(invitation_id: UUID, payload: ResendRequest, user=Depends(require_user)):
    return service.manage(user, str(invitation_id), 'resend', payload.copy_link)

@router.post('/{invitation_id}/revoke')
def revoke(invitation_id: UUID, user=Depends(require_user)):
    return service.manage(user, str(invitation_id), 'revoke')
