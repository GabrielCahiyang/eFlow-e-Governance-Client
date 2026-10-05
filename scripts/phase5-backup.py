"""Fresh database-only safety archive before the additive Phase 5 migration.

No storage files are changed by this migration. Secrets stay in local config and
the password is passed to pg_dump through its environment, never argv or logs.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
from urllib.parse import urlparse, unquote
from dotenv import dotenv_values
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--phase', choices=('5','6','7'), default='5')
args = parser.parse_args()

cfg = dotenv_values('.env')
url = urlparse(cfg['EFLOW_DATABASE_URL'])
assert 'ixnfphgjyelhckjwjkdv' in (url.username or ''), 'Use the main eFlow project connection.'
root = Path(os.environ['LOCALAPPDATA']) / 'eFlow' / 'deployment-backups' / (datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+f'-phase{args.phase}-main')
root.mkdir(parents=True, exist_ok=False)
bin_dir = Path('C:/Program Files/PostgreSQL/17/bin')
env = {**os.environ, 'PGPASSWORD': unquote(url.password or ''), 'PGSSLMODE': 'require'}
connection = ['--host', url.hostname, '--port', str(url.port or 5432), '--username', unquote(url.username or ''), '--no-password']
archive = root / 'database.dump'
subprocess.run([str(bin_dir/'pg_dump.exe'), *connection, '--dbname', url.path.lstrip('/'), '--format=custom', '--file', str(archive)], env=env, check=True, capture_output=True)
subprocess.run([str(bin_dir/'pg_restore.exe'), '--list', str(archive)], check=True, capture_output=True)
roles = root / 'roles.sql'
subprocess.run([str(bin_dir/'pg_dumpall.exe'), *connection, '--roles-only', '--no-role-passwords', '--file', str(roles)], env=env, check=True, capture_output=True)
manifest = {'project_ref': 'ixnfphgjyelhckjwjkdv', 'created_at': datetime.now(timezone.utc).isoformat(), 'files': {p.name: {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in (archive, roles)}}
(root/'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('Verified database archive and role definitions: '+str(root))
