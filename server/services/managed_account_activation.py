"""Admin-managed account activation. Secrets and Auth creation stay server-side."""
import hashlib
import secrets
from typing import Literal
from urllib.parse import urlencode
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from gateway_dependencies import supabase_admin
from invitations.service import normalize_email, token_hash
from services.email_delivery import managed_account_activation_email, send_email
from services.phase2_config import app_url, invitation_ttl


class PdsNotes(BaseModel):
    model_config = ConfigDict(extra='forbid')
    strengths: str = Field(default='', max_length=8000)
    weaknesses: str = Field(default='', max_length=8000)
    notes: str = Field(default='', max_length=16000)
    tags: list[str] = Field(default_factory=list, max_length=100)

    @field_validator('tags')
    @classmethod
    def valid_tags(cls, values):
        if any(len(x) > 100 or '\x00' in x for x in values):
            raise ValueError('Invalid skill tag')
        return values


class StageManagedAccountPayload(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_id: UUID
    mode: Literal['ledipo_create', 'office_invite']
    email: str = Field(max_length=254)
    full_name: str = Field(min_length=2, max_length=160)
    role: Literal['member', 'accounting_staff', 'head', 'admin']
    org_id: UUID
    skills: dict[str, bool] = Field(default_factory=dict)
    pds_notes: PdsNotes | None = None

    @field_validator('email')
    @classmethod
    def valid_email(cls, value):
        if any(c in value for c in '\r\n\x00'):
            raise ValueError('Invalid email')
        return normalize_email(value)

    @field_validator('full_name')
    @classmethod
    def valid_name(cls, value):
        if len(value.strip()) < 2 or '\x00' in value:
            raise ValueError('Enter a full name')
        return value.strip()

    @field_validator('skills')
    @classmethod
    def valid_skills(cls, value):
        if len(value) > 100 or any(not k.strip() or len(k) > 100 or '\x00' in k for k in value):
            raise ValueError('Enter at most 100 short skill names')
        return value


def rpc(name: str, values: dict):
    try:
        return supabase_admin.rpc(name, values).execute().data
    except Exception as exc:
        code = str(getattr(exc, 'code', ''))
        # Only intentionally raised SQL errors are shown; internal errors can
        # contain private data and are never echoed to the caller.
        message = getattr(exc, 'message', '')
        if code in ('22023', '23505', '42501', '54000'):
            raise HTTPException({'42501': 403, '54000': 429, '23505': 409}.get(code, 409), message) from exc
        raise HTTPException(503, 'Account activation could not finish. Please try again.') from exc


def safe(row: dict) -> dict:
    fields = {'invitation_id', 'email', 'full_name', 'office_id', 'office_name', 'account_role',
              'requested_privileged_role', 'source_mode', 'status', 'email_delivery_status',
              'expires_at', 'created_at', 'last_sent_at', 'awaiting_authority', 'needs_reconciliation'}
    return {k: v for k, v in row.items() if k in fields}


def ttl():
    return min(24, invitation_ttl())


def dispatch(row: dict, token: str) -> dict:
    digest = token_hash(token)
    # A repeat of a staged request can have a newly generated local token. Only
    # the token actually stored by the original transaction may be dispatched.
    if row.get('token_hash') != digest:
        return safe(row)
    reserved = rpc('eflow_reserve_managed_activation_email', {'p_id': row['invitation_id'], 'p_hash': digest})
    if not reserved:
        return safe(row)
    try:
        link = app_url() + '/activate-account?' + urlencode({'token': token})
        content = managed_account_activation_email(row['full_name'], row['office_name'], link, ttl())
        message_id = send_email(row['email'], content, 'managed-account/' + row['invitation_id'] + '/' + digest[:32])
        rpc('eflow_managed_activation_delivery', {'p_id': row['invitation_id'], 'p_hash': digest, 'p_status': 'sent', 'p_message': message_id})
        return {**safe(row), 'email_delivery_status': 'sent'}
    except HTTPException:
        rpc('eflow_managed_activation_delivery', {'p_id': row['invitation_id'], 'p_hash': digest, 'p_status': 'failed', 'p_message': None})
        return {**safe(row), 'email_delivery_status': 'failed', 'delivery_error': 'Invitation saved. Email could not be sent; check the email setup and resend.'}


def stage(payload: StageManagedAccountPayload, actor) -> dict:
    token = secrets.token_urlsafe(32)
    row = rpc('eflow_create_managed_activation', {'p_actor': actor.id, 'p_data': payload.model_dump(mode='json'), 'p_hash': token_hash(token), 'p_ttl': ttl()})
    return dispatch(row, token)


def options(actor):
    return rpc('eflow_managed_account_options', {'p_actor': actor.id})


def list_safe(actor):
    return rpc('eflow_list_managed_activations', {'p_actor': actor.id})


def manage(invitation_id: str, action: str, actor):
    token = secrets.token_urlsafe(32) if action == 'resend' else None
    row = rpc('eflow_manage_managed_activation', {'p_actor': actor.id, 'p_id': invitation_id, 'p_action': action, 'p_hash': token_hash(token) if token else None, 'p_ttl': ttl()})
    return dispatch(row, token) if token else safe(row)


def public_rate(token: str, ip: str):
    digest = token_hash(token)
    for key, maximum in [('token:' + digest, 12), ('ip:' + hashlib.sha256(ip.encode()).hexdigest(), 30)]:
        rpc('eflow_managed_activation_limit', {'p_key': key, 'p_max': maximum})
    return digest


def validate_public(token: str, ip: str):
    digest = public_rate(token, ip)
    try:
        preview = rpc('eflow_validate_managed_activation', {'p_hash': digest})
        return {k: v for k, v in preview.items() if k in {'email', 'full_name', 'office_name', 'account_role', 'requested_privileged_role', 'expires_at'}}
    except HTTPException as exc:
        if exc.status_code not in (403, 409):
            raise
        raise HTTPException(400, 'This activation link is no longer valid. Ask Admin to send a new invitation.') from exc


def _reconcile(invitation_id, attempt, created_id):
    """A timeout is not proof of rollback. Never delete an accepted identity."""
    latest = rpc('eflow_reconcile_managed_activation', {'p_id': invitation_id, 'p_claim': attempt, 'p_auth_user': created_id})
    if latest.get('accepted'):
        return latest
    # We only compensate an identity created by THIS request, after a successful
    # serialized check fenced any delayed completion. Unknown outcomes propagate.
    if latest.get('discard_created_identity'):
        supabase_admin.auth.admin.delete_user(created_id)
    return None


def activate(token: str, password: str, attempt: str, ip: str):
    if not 12 <= len(password) <= 128:
        raise HTTPException(422, 'Use a password with 12 to 128 characters.')
    digest = public_rate(token, ip)
    claim = rpc('eflow_claim_managed_activation', {'p_hash': digest, 'p_claim': attempt})
    if claim.get('accepted'):
        return {'activated': True, 'next_step': claim['next_step']}
    created_id = None
    uid = claim.get('auth_user_id')
    try:
        if not uid:
            result = supabase_admin.auth.admin.create_user({'email': claim['email'], 'password': password, 'email_confirm': True,
                'app_metadata': {'eflow_activation': claim['invitation_id'], 'eflow_activation_attempt': attempt}})
            uid = created_id = str(result.user.id)
        return rpc('eflow_complete_managed_activation', {'p_hash': digest, 'p_claim': attempt, 'p_auth_user': uid})
    except Exception as exc:
        if created_id:
            try:
                recovered = _reconcile(claim['invitation_id'], attempt, created_id)
                if recovered:
                    return {'activated': True, 'next_step': recovered['next_step']}
            except Exception:
                # Retain a possibly committed identity; its server-owned metadata
                # permits the same attempt to reconcile on retry without takeover.
                raise HTTPException(503, 'Activation needs verification. Retry the same request or contact Admin.') from exc
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(409, 'Account activation could not finish. Retry or contact Admin.') from exc
