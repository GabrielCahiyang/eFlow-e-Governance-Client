"""Project publication uses the existing private host through an authenticated bridge."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request
from gateway_dependencies import require_user, bearer
from routers.ai import _proxy
from pydantic import BaseModel,Field

class Preparation(BaseModel):
    correction:str|None=Field(default=None,max_length=4000)

class PublicationCopy(BaseModel):
    original_sha256:str=Field(pattern=r'^[a-f0-9]{64}$')
    copy_path:str=Field(min_length=1,max_length=200)
    file_name:str=Field(min_length=1,max_length=200)
    mime_type:str=Field(min_length=1,max_length=120)
    reason:str=Field(min_length=5,max_length=2000)

router=APIRouter(prefix='/controlpanelEflow/api/project-seals',tags=['project-publication'])

@router.get('/configuration')
async def configuration(user=Depends(require_user),credentials=Depends(bearer)):
    return await _proxy('GET','project-seals/configuration',user,session_token=credentials.credentials)

@router.post('/{project_id}/prepare')
async def prepare(project_id:UUID,body:Preparation,user=Depends(require_user),credentials=Depends(bearer)):
    return await _proxy('POST',f'project-seals/{project_id}/prepare',user,payload=body.model_dump(),session_token=credentials.credentials)

@router.get('/snapshots/{snapshot_id}')
async def preview(snapshot_id:UUID,user=Depends(require_user),credentials=Depends(bearer)):
    return await _proxy('GET',f'project-seals/snapshots/{snapshot_id}',user,session_token=credentials.credentials)

@router.get('/snapshots/{snapshot_id}/files/{sha256}')
async def file(snapshot_id:UUID,sha256:str,user=Depends(require_user),credentials=Depends(bearer)):
    if len(sha256)!=64 or any(c not in '0123456789abcdef' for c in sha256):
        raise HTTPException(422,'Choose a valid archive file.')
    response=await _proxy('GET',f'project-seals/snapshots/{snapshot_id}/files/{sha256}',user,session_token=credentials.credentials,timeout_seconds=100)
    response.headers['Content-Disposition']='attachment'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Cache-Control']='no-store'
    return response

@router.post('/snapshots/{snapshot_id}/publication-copy')
async def publication_copy(snapshot_id:UUID,body:PublicationCopy,user=Depends(require_user),credentials=Depends(bearer)):
    return await _proxy('POST',f'project-seals/snapshots/{snapshot_id}/publication-copy',user,payload=body.model_dump(),session_token=credentials.credentials,timeout_seconds=110)
