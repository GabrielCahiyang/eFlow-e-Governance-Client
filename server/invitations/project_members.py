"""Head-approved project guests; deliberately separate from Office acceptance."""
import secrets
from urllib.parse import urlencode
from fastapi import HTTPException
from gateway_dependencies import supabase_admin
from invitations.service import token_hash
from services.phase2_config import app_url, invitation_ttl
from services.email_delivery import project_member_email, send_email


def rpc(name, params):
    try:
        return supabase_admin.rpc(name, params).execute().data
    except Exception as exc:
        message = getattr(exc, 'message', '')
        allowed = ('Stale approval', 'Please wait 60 seconds', 'Provider already accepted',
                   'Invitation resend limit', 'Invitation expired', 'Sign in with the invited',
                   'Acceptance is already', 'Deactivated or non-operational', 'Already a project member',
                   'Enter your full name', 'Current request uploader')
        detail = message if any(message.startswith(value) for value in allowed) else 'Project invitation could not finish. Refresh its status and retry.'
        raise HTTPException(409, detail) from exc


def dispatch(user, request_id, revision, resend=False):
    base = app_url()
    token = secrets.token_urlsafe(32)
    hashed = token_hash(token)
    item = rpc('r8_reserve_dispatch', {'p_actor': user.id, 'p_id': request_id,
               'p_revision': revision, 'p_hash': hashed, 'p_ttl': invitation_ttl(), 'p_resend': resend})
    provider_id, error = None, None
    try:
        # Reserve and lookup both recheck current authority. No raw token is stored.
        context = rpc('r8_lookup', {'p_hash': hashed})
        link = base + '/accept-project-invite?' + urlencode({'token': token})
        provider_id = send_email(item['email'], project_member_email(context, link),
                                 'project-invite/' + request_id + '/' + hashed[:32])
    except HTTPException as exc:
        error = str(exc.detail)
    except Exception:
        error = 'Delivery could not finish. Refresh the invitation and retry after the cooldown.'
    recorded = rpc('r8_finish_dispatch', {'p_id': request_id, 'p_hash': hashed, 'p_provider': provider_id, 'p_error': error})
    return {'invitation_created': True, 'delivery_status': 'provider_accepted' if provider_id else 'failed',
            'delivery_error': error, 'recorded': recorded,
            'receipt': 'Provider acceptance does not confirm mailbox delivery.'}


def validate(token):
    item = rpc('r8_lookup', {'p_hash': token_hash(token)})
    # No tokens, claims, uploader IDs or raw PDS metadata on the public endpoint.
    return {key: item.get(key) for key in ('id', 'email', 'office_name', 'project_title', 'project_id',
            'needs_full_name', 'home_workspace_id', 'kind', 'engagement', 'access_end', 'until_close', 'expires_at', 'existing_account', 'summary', 'skills')}


def accept(token, identity, name='', claim=None):
    item = validate(token)
    if identity.email.lower() != item['email']:
        raise HTTPException(403, 'Switch accounts and sign in with the invited email.')
    return rpc('r8_accept', {'p_hash': token_hash(token), 'p_user': identity.id,
               'p_name': name, 'p_claim': str(claim) if claim else None})


def create_account(token, name, password, claim):
    hashed = token_hash(token)
    item = rpc('r8_lookup', {'p_hash': hashed, 'p_claim': str(claim)})
    created_id = None
    try:
        result = supabase_admin.auth.admin.create_user({'email': item['email'], 'password': password,
                  'email_confirm': True, 'user_metadata': {'full_name': name}})
        created_id = str(result.user.id)
        return rpc('r8_accept', {'p_hash': hashed, 'p_user': created_id, 'p_name': name, 'p_claim': str(claim)})
    except Exception as exc:
        if created_id:
            # A lost response after commit must never delete the accepted identity.
            latest = supabase_admin.table('project_invitation_requests').select('accepted_by,project_id,kind').eq('id', item['id']).single().execute().data
            if latest.get('accepted_by') == created_id:
                return {'accepted': True, 'project_id': latest['project_id'], 'kind': latest['kind']}
            supabase_admin.auth.admin.delete_user(created_id)
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(409, 'Account creation could not finish. If an account exists, sign in with the invited email; otherwise retry with the same attempt.') from exc


def pds_context(user, request_id):
    return rpc('r8_pds_context', {'p_actor': user.id, 'p_id': request_id})
