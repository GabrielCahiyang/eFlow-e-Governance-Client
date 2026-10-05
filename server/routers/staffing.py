from uuid import UUID
from fastapi import APIRouter, Depends
from gateway_dependencies import require_user
from services.staffing_context import build_staffing_context

router = APIRouter(prefix='/controlpanelEflow/api/staffing', tags=['staffing'])

@router.get('/{task_id}/context')
def staffing_context(task_id: UUID, user=Depends(require_user)):
    return build_staffing_context(str(task_id), user)
