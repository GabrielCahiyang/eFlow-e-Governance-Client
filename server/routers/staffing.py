from uuid import UUID
from fastapi import APIRouter, Depends
from gateway_dependencies import require_user
from services.staffing_context import build_staffing_context
from services.import_staffing_context import build_import_staffing_context
from pydantic import BaseModel, Field

router = APIRouter(prefix='/controlpanelEflow/api/staffing', tags=['staffing'])

@router.get('/{task_id}/context')
def staffing_context(task_id: UUID, auto_assign: bool = False, user=Depends(require_user)):
    return build_staffing_context(str(task_id), user, auto_assign=auto_assign)

class DraftStaffingRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default='', max_length=10000)
    estimatedHours: float = Field(default=0, ge=0, le=10000)
    plannedAssignments: list[dict] = Field(default_factory=list, max_length=100)

@router.post('/project/{project_id}/context')
def import_staffing_context(project_id: UUID, payload: DraftStaffingRequest, user=Depends(require_user)):
    return build_import_staffing_context(str(project_id), payload.model_dump(), user)
