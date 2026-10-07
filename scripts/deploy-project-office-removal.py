"""Deploy the reviewed Office fix from isolated, exact live migration history."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from urllib.parse import urlparse, unquote
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser = argparse.ArgumentParser()
parser.add_argument('--cli', required=True)
parser.add_argument('--backup', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
root = Path.cwd()
cfg = dotenv_values(root / '.env')
uri = cfg['EFLOW_DATABASE_URL']
parsed = urlparse(uri)
target = 'ixnfphgjyelhckjwjkdv'
assert unquote(parsed.username or '') == 'postgres.' + target
backup = Path(args.backup).resolve()
protected_root = (Path(os.environ['LOCALAPPDATA']) / 'eFlow' / 'deployment-backups').resolve()
assert backup.is_relative_to(protected_root)
manifest = json.loads((backup / 'manifest.json').read_text())
assert manifest['project_ref'] == target
assert (datetime.now(timezone.utc) - datetime.fromisoformat(manifest['created_at'])).total_seconds() < 3600
for name, record in manifest['files'].items():
    assert hashlib.sha256((backup / name).read_bytes()).hexdigest() == record['sha256']
name = '20261007175525_project_office_removal_and_history.sql'
workspace = root / '.codex-tmp' / 'office-budget-main'
folder = workspace / 'supabase' / 'migrations'
password = unquote(parsed.password or '')
passwordless = parsed._replace(netloc=parsed.netloc.split(':', 1)[0] + '@' + parsed.netloc.split('@', 1)[1]).geturl()
env = {**os.environ, 'PGPASSWORD': password, 'SUPABASE_DB_PASSWORD': password, 'PGCONNECT_TIMEOUT': '15'}
def run(command):
    result = subprocess.run([args.cli, '--workdir', str(workspace), *command], env=env, capture_output=True, text=True, timeout=90)
    safe = (result.stdout + result.stderr).replace(uri, '[database connection]').replace(password, '[password]')
    print(safe, flush=True)
    assert result.returncode == 0, 'Inspect schema and history before retrying: ' + safe
    return result.stdout
conn = psycopg2.connect(uri, sslmode='require', connect_timeout=15)
conn.autocommit = True
cur = conn.cursor()
cur.execute('select version from supabase_migrations.schema_migrations order by version')
history = [r[0] for r in cur.fetchall()]
assert name[:14] not in history, 'Already applied: inspect before retrying'
cur.execute("select to_regprocedure('public.phase65_remove_project_office(uuid,uuid)')")
assert cur.fetchone()[0] is None, 'Partial installation: inspect before retrying'
run(['migration', 'fetch', '--db-url', passwordless, '--yes'])
shutil.copyfile(root / 'supabase' / 'migrations' / name, folder / name)
assert {p.name[:14] for p in folder.glob('*.sql')} == set(history) | {name[:14]}, 'Unexpected pending migrations'
dry = run(['db', 'push', '--db-url', passwordless, '--skip-vault', '--include-all', '--dry-run'])
selection = json.loads(next(line for line in dry.splitlines() if line.startswith('{')))
assert selection['dryRun'] and selection['migrations'] == [name] and not selection['seeds'] and not selection['roles']
if not args.apply:
    print('Reviewed Office-only dry run ready; no live schema writes.')
else:
    cur.execute("select tablename from pg_tables where schemaname='public' order by tablename")
    tables = [r[0] for r in cur.fetchall()]
    def snapshot():
        state = {}
        for table in tables:
            cur.execute(sql.SQL('select to_jsonb(t) from public.{} t').format(sql.Identifier(table)))
            state[table] = sorted((r[0] for r in cur.fetchall()), key=lambda r: json.dumps(r, sort_keys=True))
        return state
    before = snapshot()
    (backup / 'office-removal-before.json').write_text(json.dumps(before, sort_keys=True), encoding='utf-8')
    applied = run(['db', 'push', '--db-url', passwordless, '--skip-vault', '--include-all', '--yes'])
    assert snapshot() == before, 'Existing data changed: inspect protected snapshot'
    cur.execute('select version from supabase_migrations.schema_migrations order by version')
    assert [r[0] for r in cur.fetchall()] == sorted(history + [name[:14]])
    cur.execute("select has_function_privilege('authenticated','public.phase65_remove_project_office(uuid,uuid)','execute'), has_function_privilege('anon','public.phase65_remove_project_office(uuid,uuid)','execute'), has_column_privilege('authenticated','public.user_invitations','project_office_id','select'), has_column_privilege('authenticated','public.user_invitations','token_hash','select')")
    assert cur.fetchone() == (True, False, True, False)
    receipt = {'project_ref':target,'migration':name,'existing_data_unchanged':True,'grants_verified':True,'verified_at':datetime.now(timezone.utc).isoformat()}
    (backup / 'office-removal-deployment.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt))
conn.close()
