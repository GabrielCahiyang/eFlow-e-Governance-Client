"""Read-only deployed-data check; no login, invitations, or membership changes."""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import sys
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'server'))
from gateway_dependencies import AuthenticatedUser, supabase_admin
from gateway_config import settings
from routers.invitations import office_team, list_invitations
from fastapi import HTTPException

assert settings.supabase_url == 'https://ixnfphgjyelhckjwjkdv.supabase.co'
protocols = set()
supabase_admin.options.httpx_client.event_hooks['response'].append(lambda response: protocols.add(response.http_version))
profile = supabase_admin.table('profiles').select('id,email,role,org_id,is_active').eq('id', '4526a77a-14d0-40e8-aa1d-eab54b3afbb8').single().execute().data
assert profile['is_active'] and profile['role'] == 'head'
user = AuthenticatedUser(id=profile['id'], email=profile['email'], role=profile['role'], org_id=profile['org_id'])
rounds = []
with ThreadPoolExecutor(max_workers=2) as pool:
    for index in range(3):
        if index:
            time.sleep(12)  # verify new connections after our keepalive expiry
        team_future = pool.submit(office_team, user)
        invitations_future = pool.submit(list_invitations, user)
        team, invitations = team_future.result(), invitations_future.result()
        assert team['office_name'] and team['members']
        assert all(set(member) <= {'id', 'full_name', 'email', 'role', 'is_active'} for member in team['members'])
        assert all('token_hash' not in invitation for invitation in invitations['invitations'])
        rounds.append({'round': index + 1, 'office': team['office_name'], 'members': len(team['members']), 'active_members': sum(member['is_active'] for member in team['members']), 'invitations': len(invitations['invitations'])})
denials = []
for role in ('member', 'accounting_staff', 'admin'):
    for handler in (office_team, list_invitations):
        try:
            handler(AuthenticatedUser(id=user.id, email=user.email, role=role, org_id=user.org_id))
        except HTTPException as error:
            assert error.status_code == 403
            denials.append({'role': role, 'handler': handler.__name__, 'status': 403})
        else:
            raise AssertionError('Unauthorized role was permitted')
receipt = {'checked_at': datetime.now(timezone.utc).isoformat(), 'target': 'ixnfphgjyelhckjwjkdv', 'boundary': 'Actual Python list handlers with existing active appointed Head and live database; browser session/auth middleware not exercised', 'protocols': sorted(protocols), 'rounds': rounds, 'denials': denials, 'writes': 0}
assert receipt['protocols'] == ['HTTP/1.1']
target = Path(__file__).with_name('office-team-live-read.json')
target.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt, indent=2))
