"""Server-only invitation configuration; absent email settings never break other routes."""
import os
from urllib.parse import urlparse
from fastapi import HTTPException

def invitation_ttl() -> int:
    try:
        return max(1, min(720, int(os.getenv('EFLOW_INVITE_TOKEN_TTL_HOURS', '168'))))
    except ValueError:
        return 168

def app_url() -> str:
    value = os.getenv('EFLOW_APP_URL', '').strip().rstrip('/')
    parsed = urlparse(value)
    local = parsed.hostname in ('localhost', '127.0.0.1')
    if not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment or (parsed.scheme != 'https' and not (local and parsed.scheme == 'http')):
        raise HTTPException(503, 'Invitation links are not configured. Ask Admin to configure the app URL.')
    return value
