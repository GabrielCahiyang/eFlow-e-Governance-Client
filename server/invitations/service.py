import hashlib
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode
from uuid import UUID
from fastapi import HTTPException
from gateway_dependencies import supabase_admin
from services.phase2_config import app_url, invitation_ttl
from services.email_delivery import invitation_email, send_email
from services.skill_tags import validate_skill_map

SAFE_FIELDS = 'id,email,invited_by,office_id,account_role,invitation_type,project_office_id,status,expires_at,accepted_at,revoked_at,last_sent_at,send_count,email_delivery_status,created_at'
IDENTITY_SAFE_FIELDS = SAFE_FIELDS + ',project_office_identity_id'


def normalize_skill_list(skills: list[str] | None) -> list[str]:
    if not skills:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in skills:
        if not isinstance(item, str):
            continue
        label = item.strip()
        if not label or label in seen:
            continue
        seen.add(label)
        cleaned.append(label)
    validate_skill_map({label: True for label in cleaned})
    return cleaned


def _stage_invitation_skills(actor_id: str, office_id: str, invitation_id: str | None, skills: list[str] | None) -> None:
    cleaned = normalize_skill_list(skills)
    if not cleaned or not invitation_id:
        return
    try:
        supabase_admin.table('audit_events').insert({
            'actor_id': actor_id,
            'action': 'invitation_skills_staged',
            'entity_type': 'account',
            'entity_id': str(invitation_id),
            'after_data': {'skills': cleaned, 'office_id': office_id},
        }).execute()
    except Exception:
        pass


def staged_invitation_skills(invitation_id: str | None) -> list[str]:
    if not invitation_id:
        return []
    try:
        rows = (
            supabase_admin.table('audit_events')
            .select('after_data')
            .eq('action', 'invitation_skills_staged')
            .eq('entity_id', str(invitation_id))
            .order('created_at', desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not isinstance(rows, list) or not rows:
            return []
        first = rows[0] if isinstance(rows[0], dict) else {}
        after_data = first.get('after_data') if isinstance(first.get('after_data'), dict) else {}
        raw_skills = after_data.get('skills')
        if not isinstance(raw_skills, list):
            return []
        return [item.strip() for item in raw_skills if isinstance(item, str) and item.strip()]
    except Exception:
        return []


def _apply_profile_skills(user_id: str | None, invitation_id: str | None, explicit_skills: list[str] | None) -> None:
    if not user_id:
        return
    final_skills = (
        normalize_skill_list(explicit_skills)
        if explicit_skills is not None
        else staged_invitation_skills(invitation_id)
    )
    if not final_skills:
        return
    try:
        supabase_admin.table('profiles').update({
            'skills': {label: True for label in final_skills},
        }).eq('id', str(user_id)).execute()
    except Exception:
        pass

def normalize_email(value: str) -> str:
    value = value.strip().lower()
    if len(value) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', value):
        raise HTTPException(422, 'Enter a valid email address.')
    return value

def token_hash(token: str) -> str:
    if not re.fullmatch(r'[A-Za-z0-9_-]{40,128}', token):
        raise HTTPException(400, 'Invitation link is invalid.')
    return hashlib.sha256(token.encode()).hexdigest()

def rpc(name: str, values: dict):
    try:
        result = supabase_admin.rpc(name, values).execute().data
        return result[0] if isinstance(result, list) and result else result
    except Exception as exc:
        message = getattr(exc, 'message', '')
        safe_phrases = ['Only the appointed', 'Head may invite', 'Accounting Staff requires', 'Invalid invitation', 'Invitation limit', 'already a member', 'another Office', 'deactivated', 'Head and Admin', 'already pending', 'Office invitation access denied', 'no longer pending', 'Please wait', 'Resend limit', 'Acceptance is', 'Invitation expired', 'Inviter no longer', 'Sign in with', 'Admin resolution', 'Enter your full name']
        if any(phrase.lower() in message.lower() for phrase in safe_phrases):
            raise HTTPException(409, message) from exc
        raise HTTPException(503, 'The invitation service could not finish. Please retry.') from exc

def audit(actor: str, office: str, subject: str, action: str):
    rpc('phase2_audit', {'p_actor': actor, 'p_office': office, 'p_subject': subject, 'p_action': action})

def require_head(user):
    if user.role != 'head' or not user.org_id or not supabase_admin.rpc('phase2_is_office_head', {'p_user': user.id, 'p_office': user.org_id}).execute().data:
        raise HTTPException(403, 'Only the appointed active Office Head can manage invitations.')
    return user

def safe_invitation(row: dict) -> dict:
    fields = IDENTITY_SAFE_FIELDS if row.get('invitation_type') == 'project_office_identity' else SAFE_FIELDS
    return {field: row.get(field) for field in fields.split(',')}

def lookup(token: str, allow_accepted: bool = False) -> dict:
    rows = supabase_admin.table('user_invitations').select('*').eq('token_hash', token_hash(token)).limit(1).execute().data or []
    if not rows:
        raise HTTPException(400, 'Invitation expired, revoked, or invalid.')
    item = rows[0]
    if item.get('invitation_type') == 'managed_account':
        raise HTTPException(400, 'Use the account activation link for this invitation.')
    if allow_accepted and item['status'] == 'accepted':
        return item
    if item['status'] == 'pending' and datetime.fromisoformat(item['expires_at'].replace('Z', '+00:00')) <= datetime.now(timezone.utc):
        supabase_admin.table('user_invitations').update({'status': 'expired'}).eq('id', item['id']).eq('status', 'pending').execute()
        audit(item['invited_by'], item['office_id'], item['id'], 'invitation_expired')
        item['status'] = 'expired'
    if item['status'] != 'pending':
        raise HTTPException(400, 'Invitation expired, revoked, or already accepted.')
    if not supabase_admin.rpc('phase2_is_office_head', {'p_user': item['invited_by'], 'p_office': item['office_id']}).execute().data:
        raise HTTPException(409, 'The inviter no longer leads this Office. Request a new invitation.')
    if item.get('invitation_type') in ('project_office', 'project_office_identity'):
        project_context(item, pending=True)
    return item

def project_context(item: dict, pending: bool = False) -> dict:
    if item.get('invitation_type') == 'project_office_identity':
        from invitations.local_offices import context
        return context(item, pending)
    office = supabase_admin.table('project_offices').select('project_id,office_id,relationship_type,invitation_status').eq('id', item['project_office_id']).single().execute().data
    project = supabase_admin.table('projects').select('id,title,status,org_id').eq('id', office['project_id']).single().execute().data
    if pending and (office['invitation_status'] != 'pending' or project['status'] in ('completed', 'archived') or project['org_id'] != item['office_id']):
        raise HTTPException(409, 'This project invitation is no longer available.')
    name = supabase_admin.table('organizations').select('name').eq('id', office['office_id']).single().execute().data['name']
    return {**office, 'office_name': name, 'project_title': project['title']}

def acceptance_result(item: dict, profile: dict) -> dict:
    result = {'accepted': True, 'user_id': profile['id'], 'account_role': profile['role']}
    if item.get('invitation_type') in ('project_office', 'project_office_identity'):
        context = project_context(item)
        result.update(project_id=context['project_id'], awaiting_head=context['invitation_status'] == 'awaiting_head')
    return result

def send_invitation(item: dict, token: str) -> dict:
    item = rpc('phase2_reserve_invitation_email', {'p_id': item['id'], 'p_hash': item['token_hash']})
    office = supabase_admin.table('organizations').select('name').eq('id', item['office_id']).single().execute().data
    inviter = supabase_admin.table('profiles').select('full_name').eq('id', item['invited_by']).single().execute().data
    now = datetime.now(timezone.utc).isoformat()
    changes = {'updated_at': now}
    try:
        link = app_url() + '/accept-invite?' + urlencode({'token': token})
        context = project_context(item, pending=True) if item.get('invitation_type') in ('project_office', 'project_office_identity') else None
        message = invitation_email(inviter['full_name'], context['office_name'] if context else office['name'], item['account_role'], link, invitation_ttl(), project=context)
        message_id = send_email(item['email'], message, 'office-invite/' + item['id'] + '/' + item['token_hash'][:32])
        changes.update(email_delivery_status='sent', resend_email_id=message_id)
    except HTTPException as exc:
        changes.update(email_delivery_status='failed')
        # Invitation remains pending; a retry rotates the token rather than storing it.
        supabase_admin.table('user_invitations').update(changes).eq('id', item['id']).eq('token_hash', item['token_hash']).execute()
        audit(item['invited_by'], item['office_id'], item['id'], 'invitation_email_failed')
        return {**safe_invitation({**item, **changes}), 'delivery_error': exc.detail}
    supabase_admin.table('user_invitations').update(changes).eq('id', item['id']).eq('token_hash', item['token_hash']).execute()
    audit(item['invited_by'], item['office_id'], item['id'], 'invitation_email_sent')
    return safe_invitation({**item, **changes})

def _clear_failed_cooldown_if_needed(invitation_id: str, office_id: str) -> None:
    rows = (
        supabase_admin.table('user_invitations')
        .select('id,email_delivery_status')
        .eq('id', invitation_id)
        .eq('office_id', office_id)
        .eq('status', 'pending')
        .limit(1)
        .execute()
        .data
        or []
    )
    if rows and rows[0].get('email_delivery_status') in ('failed', 'queued'):
        past = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() - 120, tz=timezone.utc).isoformat()
        supabase_admin.table('user_invitations').update({'last_sent_at': past, 'updated_at': past}).eq('id', invitation_id).execute()


def create(user, email: str, role: str, skills: list[str] | None = None) -> dict:
    require_head(user)
    app_url()
    cleaned_skills = normalize_skill_list(skills)
    token = secrets.token_urlsafe(32)
    normalized = normalize_email(email)
    try:
        item = rpc('phase2_create_invitation', {'p_actor': user.id, 'p_email': normalized, 'p_role': role, 'p_hash': token_hash(token), 'p_ttl': invitation_ttl()})
    except HTTPException as exc:
        if exc.status_code == 409 and 'already pending' in str(exc.detail).lower():
            existing = supabase_admin.table('user_invitations').select('id,email_delivery_status,account_role').eq('office_id', user.org_id).eq('email_normalized', normalized).eq('invitation_type', 'office_member').eq('status', 'pending').limit(1).execute().data or []
            if existing and existing[0].get('email_delivery_status') in ('failed', 'queued') and existing[0].get('account_role') == role:
                _clear_failed_cooldown_if_needed(existing[0]['id'], user.org_id)
                item = rpc('phase2_manage_invitation', {'p_actor': user.id, 'p_id': existing[0]['id'], 'p_action': 'resend', 'p_hash': token_hash(token), 'p_ttl': invitation_ttl()})
                _stage_invitation_skills(user.id, user.org_id, item.get('id'), cleaned_skills)
                return send_invitation(item, token)
        raise
    _stage_invitation_skills(user.id, user.org_id, item.get('id'), cleaned_skills)
    return send_invitation(item, token)

def manage(user, invitation_id: str, action: str, copy_link: bool = False) -> dict:
    require_head(user)
    if action == 'resend':
        app_url()
        _clear_failed_cooldown_if_needed(invitation_id, user.org_id)
    token = secrets.token_urlsafe(32)
    item = rpc('phase2_manage_invitation', {'p_actor': user.id, 'p_id': invitation_id, 'p_action': action, 'p_hash': token_hash(token) if action == 'resend' else None, 'p_ttl': invitation_ttl()})
    if action == 'revoke':
        return safe_invitation(item)
    result = send_invitation(item, token)
    # Copy is an explicit rotation; never persist or return tokens from a list endpoint.
    if copy_link:
        result['invitation_url'] = app_url() + '/accept-invite?' + urlencode({'token': token})
    return result

def create_project_invitation(user, project_id: str, office_id: str, email: str, access: str) -> dict:
    require_head(user)
    app_url()
    token = secrets.token_urlsafe(32)
    item = rpc('phase6_create_invitation', {'p_actor': user.id, 'p_project': project_id, 'p_office': office_id, 'p_email': normalize_email(email), 'p_access': access, 'p_hash': token_hash(token), 'p_ttl': invitation_ttl()})
    return send_invitation(item, token)

def accept_existing(token: str, identity, claim: UUID | None = None, full_name: str = '', skills: list[str] | None = None) -> dict:
    item = lookup(token, allow_accepted=True)
    if identity.email.lower() != item['email_normalized']:
        raise HTTPException(403, 'Switch accounts and sign in with the invited email.')
    profile = rpc('phase2_accept_invitation', {'p_hash': token_hash(token), 'p_user': identity.id, 'p_name': full_name, 'p_claim': str(claim) if claim else None})
    _apply_profile_skills(profile.get('id') if isinstance(profile, dict) else identity.id, item.get('id'), skills)
    return acceptance_result(item, profile)

def create_account(token: str, name: str, password: str, claim: UUID, skills: list[str] | None = None) -> dict:
    item = rpc('phase2_claim_invitation', {'p_hash': token_hash(token), 'p_claim': str(claim)})
    created_id = None
    try:
        result = supabase_admin.auth.admin.create_user({'email': item['email_normalized'], 'password': password, 'email_confirm': True, 'user_metadata': {'full_name': name}})
        created_id = str(result.user.id)
        profile = rpc('phase2_accept_invitation', {'p_hash': token_hash(token), 'p_user': created_id, 'p_name': name, 'p_claim': str(claim)})
        _apply_profile_skills(created_id, item.get('id'), skills)
        return acceptance_result(item, profile)
    except Exception as exc:
        if created_id:
            # A lost response may follow a committed acceptance: never delete its identity.
            latest = supabase_admin.table('user_invitations').select('status,accepted_by').eq('id', item['id']).single().execute().data
            if latest.get('accepted_by') == created_id and latest.get('status') == 'accepted':
                return acceptance_result(item, {'id': created_id, 'role': item['account_role']})
            supabase_admin.auth.admin.delete_user(created_id)
        supabase_admin.table('user_invitations').update({'acceptance_claim': None, 'acceptance_claimed_at': None}).eq('id', item['id']).eq('acceptance_claim', str(claim)).eq('status', 'pending').execute()
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(409, 'Account creation could not finish. If this email already has an account, sign in to accept; otherwise retry.') from exc
