"""Administrative diagnostic and sign-in branding endpoints."""
from datetime import datetime, timezone
import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from gateway_dependencies import AuthenticatedUser, require_admin, supabase_admin
from services.admin_configuration_health import configuration_health

router = APIRouter(prefix='/controlpanelEflow/api/admin', tags=['admin-configuration'])

_CONTROL_CHAR_RE = re.compile(r'[\x00-\x1f\x7f]')
_DEFAULT_LOGIN_TITLE = 'LGU Ormoc City'
_DEFAULT_LOGIN_SUBTITLE = 'Use your official LGU account.'


class LoginBrandingPayload(BaseModel):
    model_config = ConfigDict(extra='forbid')
    login_portal_title: str = Field(min_length=1, max_length=120)
    login_portal_subtitle: str = Field(min_length=1, max_length=160)


@router.get('/configuration-health')
def read_configuration_health(_user=Depends(require_admin)):
    return configuration_health()


@router.put('/login-branding')
def update_login_branding(
    payload: LoginBrandingPayload,
    user: AuthenticatedUser = Depends(require_admin),
):
    title = payload.login_portal_title.strip()
    subtitle = payload.login_portal_subtitle.strip()
    if not title or len(title) > 120 or _CONTROL_CHAR_RE.search(payload.login_portal_title):
        raise HTTPException(422, 'Sign-in organization label must contain 1–120 printable characters.')
    if not subtitle or len(subtitle) > 160 or _CONTROL_CHAR_RE.search(payload.login_portal_subtitle):
        raise HTTPException(422, 'Sign-in prompt must contain 1–160 printable characters.')

    existing_rows = (
        supabase_admin.table('system_config')
        .select('key,value')
        .in_('key', ['login_portal_title', 'login_portal_subtitle'])
        .execute()
        .data
        or []
    )
    existing = {
        str(row['key']): str(row['value']).strip()
        for row in existing_rows
        if isinstance(row, dict) and isinstance(row.get('key'), str) and isinstance(row.get('value'), str)
    }
    before_data = {
        'login_portal_title': existing.get('login_portal_title') or _DEFAULT_LOGIN_TITLE,
        'login_portal_subtitle': existing.get('login_portal_subtitle') or _DEFAULT_LOGIN_SUBTITLE,
    }
    after_data = {
        'login_portal_title': title,
        'login_portal_subtitle': subtitle,
    }
    now_iso = datetime.now(timezone.utc).isoformat()
    supabase_admin.table('system_config').upsert(
        [
            {'key': 'login_portal_title', 'value': title, 'updated_at': now_iso},
            {'key': 'login_portal_subtitle', 'value': subtitle, 'updated_at': now_iso},
        ],
        on_conflict='key',
    ).execute()

    if before_data != after_data:
        profile_rows = (
            supabase_admin.table('profiles')
            .select('full_name')
            .eq('id', user.id)
            .limit(1)
            .execute()
            .data
            or []
        )
        actor_name = str((profile_rows[0] if profile_rows else {}).get('full_name') or user.email or 'Admin').strip()
        supabase_admin.table('audit_events').insert(
            {
                'actor_id': user.id,
                'actor_name': actor_name,
                'entity_type': 'system_config',
                'action': 'settings.login_branding.updated',
                'before_data': before_data,
                'after_data': after_data,
                'reason': f'Updated sign-in screen branding to “{title}” / “{subtitle}”.',
            }
        ).execute()

    return after_data
