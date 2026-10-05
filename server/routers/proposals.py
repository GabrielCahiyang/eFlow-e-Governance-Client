"""Authenticated document gate; retains the legacy proposal validation contract."""
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from gateway_dependencies import AuthenticatedUser, require_user
from routers.ai import _proxy

router = APIRouter(prefix="/controlpanelEflow/api/proposals", tags=["proposals"])

class DocumentValidationRequest(BaseModel):
    document_text: str = Field(min_length=1, max_length=500_000)
    file_name: str = Field(default="", max_length=255)
    mode: Literal["proposal", "workspace"] = "proposal"

@router.post("/validate")
async def validate_document(body: DocumentValidationRequest, user: AuthenticatedUser = Depends(require_user)):
    return await _proxy("POST", "proposals/validate", user, payload=body.model_dump())
