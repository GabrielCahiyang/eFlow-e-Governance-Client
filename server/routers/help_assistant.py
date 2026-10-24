"""Bounded, authenticated bridge to the AI host's read-only help service."""
import json
import asyncio
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from gateway_dependencies import require_user, bearer
from routers.ai import _proxy

router = APIRouter(prefix='/controlpanelEflow/api/help-assistant', tags=['help-assistant'])

@router.api_route('/{operation}', methods=['GET', 'POST'])
async def assistant(operation: Literal['status', 'projects', 'chat', 'transcribe', 'speech'], request: Request, user=Depends(require_user), credentials=Depends(bearer)):
    expected = 'GET' if operation in ('status', 'projects') else 'POST'
    if request.method != expected:
        raise HTTPException(405, 'Method not allowed.')
    payload = None
    if expected == 'POST':
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 1_600_000:
                raise HTTPException(413, 'This help request is too large.')
        try:
            payload = json.loads(raw)
        except ValueError:
            raise HTTPException(422, 'Send a valid help request.')
    task = asyncio.create_task(_proxy(expected, 'help-assistant/' + operation, user, payload=payload, timeout_seconds=210, session_token=credentials.credentials))
    try:
        while not task.done():
            if await request.is_disconnected():
                raise asyncio.CancelledError()
            # Wake on the proxy response; the timeout only bounds disconnect
            # checks, rather than adding 0–200ms to every speech/ASR chunk.
            await asyncio.wait({task}, timeout=.2)
        return await task
    finally:
        if not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
