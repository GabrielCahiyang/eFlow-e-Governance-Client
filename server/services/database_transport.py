"""Connection policy and bounded recovery for explicitly read-only operations."""
import time
from typing import Callable, TypeVar

import httpx
from fastapi import HTTPException

T = TypeVar('T')


def database_http_client() -> httpx.Client:
    # A disconnected multiplexed HTTP/2 connection poisoned simultaneous Office
    # Team requests. Separate HTTP/1.1 connections isolate failures; expire idle
    # connections before the upstream closes them. Keep the SDK's 120s timeout.
    return httpx.Client(
        http2=False,
        timeout=httpx.Timeout(120, connect=10, pool=10),
        limits=httpx.Limits(max_connections=100, max_keepalive_connections=20, keepalive_expiry=10),
    )


def database_read(operation: Callable[[], T]) -> T:
    """Retry one disconnected read, including its authorization check.

    Never wrap writes, invitations, uploads, or financial posting with this.
    A lost response to a write does not tell us whether it committed.
    """
    for attempt in range(2):
        try:
            return operation()
        except (httpx.RemoteProtocolError, httpx.ConnectError, httpx.TimeoutException) as exc:
            if attempt:
                raise HTTPException(503, 'The Office connection is temporarily unavailable. Please try again.') from exc
            time.sleep(0.1)
    raise AssertionError('unreachable')
