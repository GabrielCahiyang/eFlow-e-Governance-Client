"""Project-local contact invitations reuse the opaque-token delivery engine."""
import secrets
from fastapi import HTTPException
from gateway_dependencies import supabase_admin
from invitations import service
from services.phase2_config import app_url, invitation_ttl


def context(item: dict, pending: bool = False) -> dict:
    office = supabase_admin.table('project_office_identities').select('project_id,display_name,relationship_type,contact_status,canonical_office_id').eq('id', item['project_office_identity_id']).single().execute().data
    project = supabase_admin.table('projects').select('id,title,status,org_id,source_collaboration_draft_id').eq('id', office['project_id']).single().execute().data
    if pending and (office['canonical_office_id'] is not None or office['contact_status'] != 'invited' or project['status'] in ('completed', 'archived') or project['source_collaboration_draft_id'] or project['org_id'] != item['office_id']):
        raise HTTPException(409, 'This project invitation is no longer available.')
    return {**office, 'office_name': office['display_name'], 'project_title': project['title'], 'invitation_status': 'awaiting_head'}


def create(user, identity_id: str, email: str, access: str) -> dict:
    service.require_head(user)
    app_url()
    token = secrets.token_urlsafe(32)
    item = service.rpc('phase65_create_invitation', {'p_actor': user.id, 'p_identity': identity_id, 'p_email': service.normalize_email(email), 'p_access': access, 'p_hash': service.token_hash(token), 'p_ttl': invitation_ttl()})
    return service.send_invitation(item, token)


def list_for_project(user, project_id: str) -> dict:
    service.require_head(user)
    if not supabase_admin.rpc('can_manage_project', {'target_project': project_id, 'caller_id': user.id}).execute().data:
        raise HTTPException(403, 'Only the Lead Office Head can manage project invitations.')
    identities = supabase_admin.table('project_office_identities').select('id').eq('project_id', project_id).execute().data or []
    if not identities:
        return {'invitations': []}
    rows = supabase_admin.table('user_invitations').select(service.IDENTITY_SAFE_FIELDS).eq('office_id', user.org_id).eq('invitation_type', 'project_office_identity').in_('project_office_identity_id', [i['id'] for i in identities]).order('created_at', desc=True).limit(250).execute().data or []
    now = service.datetime.now(service.timezone.utc)
    for item in rows:
        if item['status'] == 'pending' and service.datetime.fromisoformat(item['expires_at'].replace('Z', '+00:00')) <= now:
            item['status'] = 'expired'
    return {'invitations': rows}
