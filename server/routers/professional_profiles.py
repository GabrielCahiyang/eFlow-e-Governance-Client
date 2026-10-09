from datetime import datetime, timezone
import hashlib
from pathlib import PurePath
from urllib.parse import unquote
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from gateway_dependencies import require_user, supabase_admin
from invitations.service import audit, require_head
from pds.parser import clean_professional_profile, validate_pdf
from routers.invitations import PrivateValidationRoute

router = APIRouter(prefix='/controlpanelEflow/api', tags=['professional-profiles'], route_class=PrivateValidationRoute)
DOCUMENT_FIELDS = 'id,user_id,invitation_id,office_id,original_filename,mime_type,file_size,uploaded_by,processing_status,extraction_version,processing_error,created_at,processed_at'

def owned_document(document_id: str, user):
    rows = supabase_admin.table('user_pds_documents').select('*').eq('id', document_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(404, 'PDS document not found.')
    document = rows[0]
    if document.get('project_request_id') and document['user_id'] != user.id:
        if document['uploaded_by'] != user.id:
            raise HTTPException(403, 'This PDS is private to its owner and authorized uploader.')
        from invitations.project_members import pds_context
        pds_context(user, document['project_request_id'])
        return document
    if document['user_id'] != user.id:
        if document['uploaded_by'] != user.id or document['office_id'] != user.org_id:
            raise HTTPException(403, 'This PDS is private to its owner and authorized uploader.')
        require_head(user)
    return document

@router.post('/pds/upload')
async def upload_pds(request: Request, invitation_id: UUID | None = None, project_request_id: UUID | None = None, user=Depends(require_user)):
    if request.headers.get('content-type', '').split(';')[0] != 'application/pdf':
        raise HTTPException(415, 'Upload a PDF file.')
    filename = PurePath(unquote(request.headers.get('x-file-name', 'PDS.pdf')).replace('\\', '/')).name[:150]
    if not filename.lower().endswith('.pdf'):
        raise HTTPException(415, 'Upload a PDF file.')
    invited_user = None
    if invitation_id and project_request_id:
        raise HTTPException(422, 'Choose one invitation scope.')
    if project_request_id:
        from invitations.project_members import pds_context
        context = pds_context(user, str(project_request_id))
        office, invited_user = context['office_id'], context['accepted_by']
    elif invitation_id:
        require_head(user)
        items = supabase_admin.table('user_invitations').select('office_id,status,accepted_by').eq('id', str(invitation_id)).limit(1).execute().data or []
        if not items or items[0]['office_id'] != user.org_id or items[0]['status'] not in ('pending', 'accepted'):
            raise HTTPException(403, 'Only an invitation in your Office can receive this PDS.')
        office, invited_user = user.org_id, items[0]['accepted_by']
    else:
        if not user.org_id or user.role not in ('member', 'head', 'accounting_staff'):
            raise HTTPException(403, 'An active Office account is required.')
        office, invited_user = user.org_id, user.id
    payload = bytearray()
    async for chunk in request.stream():
        payload.extend(chunk)
        if len(payload) > 10485760:
            raise HTTPException(413, 'PDS files must be smaller than 10 MB.')
    try:
        validate_pdf(bytes(payload))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    digest = hashlib.sha256(payload).hexdigest()
    def existing_attachment():
        if not project_request_id:
            return None
        rows = supabase_admin.table('user_pds_documents').select(DOCUMENT_FIELDS).eq('project_request_id', str(project_request_id)).eq('uploaded_by', user.id).eq('content_sha256', digest).limit(1).execute().data or []
        return rows[0] if rows else None
    existing = existing_attachment()
    if existing:
        return existing
    document_id = str(uuid4())
    directory = 'project-requests/' + str(project_request_id) if project_request_id else 'invitations/' + str(invitation_id) if invitation_id else 'users/' + user.id
    path = f'office/{office}/{directory}/{document_id}.pdf'
    storage = supabase_admin.storage.from_('pds-documents')
    try:
        storage.upload(path, bytes(payload), {'content-type': 'application/pdf', 'upsert': 'false'})
        values = {'id': document_id, 'user_id': invited_user, 'invitation_id': str(invitation_id) if invitation_id else None, 'office_id': office, 'storage_path': path, 'original_filename': filename, 'mime_type': 'application/pdf', 'file_size': len(payload), 'uploaded_by': user.id, 'content_sha256': digest}
        if project_request_id:
            values['project_request_id'] = str(project_request_id)
        row = supabase_admin.table('user_pds_documents').insert(values).execute().data[0]
    except Exception as exc:
        try:
            storage.remove([path])
        except Exception:
            pass
        # A concurrent/lost-response retry can find the already committed upload.
        try:
            existing = existing_attachment()
            if existing:
                return existing
        except Exception:
            pass
        raise HTTPException(503, 'PDS upload could not finish. Please retry.') from exc
    audit(user.id, office, document_id, 'pds_uploaded')
    return {key: row.get(key) for key in DOCUMENT_FIELDS.split(',')}

@router.get('/pds/me')
def my_documents(user=Depends(require_user)):
    return {'documents': supabase_admin.table('user_pds_documents').select(DOCUMENT_FIELDS).eq('user_id', user.id).order('created_at', desc=True).limit(20).execute().data or []}

@router.post('/pds/{document_id}/process')
def retry_processing(document_id: UUID, user=Depends(require_user)):
    document = owned_document(str(document_id), user)
    if document['processing_status'] not in ('failed', 'pending'):
        raise HTTPException(409, 'This document is processing or already extracted.')
    supabase_admin.table('user_pds_documents').update({'processing_status': 'pending', 'processing_error': None}).eq('id', str(document_id)).in_('processing_status', ['failed', 'pending']).execute()
    return {'processing_status': 'pending'}

@router.get('/pds/{document_id}/download')
def download(document_id: UUID, user=Depends(require_user)):
    document = owned_document(str(document_id), user)
    audit(user.id, document['office_id'], str(document_id), 'pds_raw_accessed')
    result = supabase_admin.storage.from_('pds-documents').create_signed_url(document['storage_path'], 60)
    return {'url': result.get('signedURL') or result.get('signedUrl'), 'expires_in': 60}

@router.get('/pds/{document_id}/professional-draft')
def professional_draft(document_id: UUID, user=Depends(require_user)):
    document = owned_document(str(document_id), user)
    if document['user_id'] != user.id:
        raise HTTPException(403, 'Only the owner can review an extracted draft.')
    if document['processing_status'] != 'completed':
        raise HTTPException(409, 'The professional draft is not ready yet.')
    return {'draft': clean_professional_profile(document.get('professional_draft') or {})}

class ProfessionalProfile(BaseModel):
    model_config = ConfigDict(extra='forbid')
    skills: list[str] = Field(default_factory=list, max_length=40)
    education: list[str] = Field(default_factory=list, max_length=40)
    trainings: list[str] = Field(default_factory=list, max_length=40)
    certifications: list[str] = Field(default_factory=list, max_length=40)
    work_experience: list[str] = Field(default_factory=list, max_length=40)
    specializations: list[str] = Field(default_factory=list, max_length=40)
    competency_summary: str = Field(default='', max_length=1500)

@router.get('/professional-profile/{user_id}')
def read_profile(user_id: UUID, user=Depends(require_user)):
    target = str(user_id)
    own = target == user.id
    if not own:
        require_head(user)
        profiles = supabase_admin.table('profiles').select('org_id,is_active').eq('id', target).limit(1).execute().data or []
        if not profiles or profiles[0]['org_id'] != user.org_id or not profiles[0]['is_active']:
            raise HTTPException(403, 'Only your Office professional summaries are available.')
    query = supabase_admin.table('user_professional_profiles').select('*').eq('user_id', target)
    if not own:
        query = query.eq('confirmed_by_user', True)
    rows = query.limit(1).execute().data or []
    return {'profile': rows[0] if rows else None}

@router.patch('/professional-profile/me')
def update_profile(payload: ProfessionalProfile, user=Depends(require_user)):
    values = clean_professional_profile(payload.model_dump())
    now = datetime.now(timezone.utc).isoformat()
    result = supabase_admin.table('user_professional_profiles').upsert({'user_id': user.id, **values, 'source': 'manual', 'confirmed_by_user': False, 'confirmed_at': None, 'updated_at': now}).execute().data[0]
    audit(user.id, user.org_id, user.id, 'professional_profile_updated')
    return {'profile': result}

@router.post('/professional-profile/me/confirm')
def confirm_profile(user=Depends(require_user)):
    now = datetime.now(timezone.utc).isoformat()
    rows = supabase_admin.table('user_professional_profiles').update({'confirmed_by_user': True, 'confirmed_at': now, 'updated_at': now}).eq('user_id', user.id).execute().data or []
    if not rows:
        raise HTTPException(409, 'Complete your professional profile first.')
    audit(user.id, user.org_id, user.id, 'professional_profile_confirmed')
    return {'profile': rows[0]}
