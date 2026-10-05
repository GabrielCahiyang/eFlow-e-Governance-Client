from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from gateway_dependencies import require_user, supabase_admin
from invitations.service import rpc
from routers.invitations import PrivateValidationRoute

router = APIRouter(prefix='/controlpanelEflow/api/onboarding', tags=['onboarding'], route_class=PrivateValidationRoute)

def tour_key(role: str) -> str:
    return {'head': 'head-office-team-v1', 'member': 'member-web-v1', 'accounting_staff': 'accounting-web-v1', 'admin': 'admin-web-v1'}[role]

def record(user, key):
    rows = supabase_admin.table('user_onboarding').select('*').eq('user_id', user.id).eq('tour_key', key).limit(1).execute().data or []
    if rows:
        return rows[0]
    supabase_admin.table('user_onboarding').upsert({'user_id': user.id, 'tour_key': key}, on_conflict='user_id,tour_key', ignore_duplicates=True).execute()
    return supabase_admin.table('user_onboarding').select('*').eq('user_id', user.id).eq('tour_key', key).single().execute().data

@router.get('/me')
def read_onboarding(user=Depends(require_user)):
    return record(user, tour_key(user.role))

class ProgressUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    status: str | None = None
    current_step: str | None = Field(default=None, max_length=100)
    completed_steps: list[str] | None = Field(default=None, max_length=20)
    interests: list[str] | None = Field(default=None, max_length=10)
    tour_progress: dict | None = None

@router.patch('/me')
def update_onboarding(payload: ProgressUpdate, user=Depends(require_user)):
    current = record(user, tour_key(user.role))
    status = payload.status or current['status']
    if status not in ('not_started', 'in_progress', 'completed', 'dismissed'):
        raise HTTPException(422, 'Invalid onboarding status.')
    state = dict(current.get('state') or {})
    for key in ('completed_steps', 'interests', 'tour_progress'):
        value = getattr(payload, key)
        if value is not None:
            if key != 'tour_progress' and any(len(item) > 100 for item in value):
                raise HTTPException(422, 'Invalid onboarding step.')
            state[key] = value
    import json
    if len(json.dumps(state)) > 12000:
        raise HTTPException(422, 'Onboarding progress is too large.')
    return rpc('phase2_save_onboarding', {'p_user': user.id, 'p_key': current['tour_key'], 'p_patch': payload.model_dump(exclude_none=True)})
