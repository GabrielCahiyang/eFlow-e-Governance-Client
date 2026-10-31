"""Deploy only the reviewed schedule guard, preserving exact hosted history."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
from urllib.parse import urlparse, unquote

from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser = argparse.ArgumentParser()
parser.add_argument('--cli', required=True)
parser.add_argument('--backup', required=True)
parser.add_argument('--apply', action='store_true')
parser.add_argument('--insert-guard', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
target = 'ixnfphgjyelhckjwjkdv'
name = '20261029235308_project_schedule_insert_guard.sql' if args.insert_guard else '20261029232938_project_task_schedule_bounds.sql'
version = name[:14]
uri = dotenv_values(root / '.env')['EFLOW_DATABASE_URL']
parsed = urlparse(uri)
password = unquote(parsed.password or '')
assert unquote(parsed.username or '') == 'postgres.' + target
backup = Path(args.backup).resolve()
assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA']) / 'eFlow/deployment-backups').resolve())
manifest = json.loads((backup / 'manifest.json').read_text())
assert manifest['project_ref'] == target
assert (datetime.now(timezone.utc) - datetime.fromisoformat(manifest['created_at'])).total_seconds() < 3600
for file, record in manifest['files'].items():
    assert hashlib.sha256((backup / file).read_bytes()).hexdigest() == record['sha256']
workspace = root / '.codex-tmp/project-schedule-20261030'
workspace.mkdir(parents=True, exist_ok=True)
passwordless = parsed._replace(netloc=parsed.netloc.split(':', 1)[0] + '@' + parsed.netloc.split('@', 1)[1]).geturl()
env = {**os.environ, 'PGPASSWORD': password, 'SUPABASE_DB_PASSWORD': password, 'PGCONNECT_TIMEOUT': '15'}


def run(command):
    result = subprocess.run([args.cli, '--workdir', str(workspace), '--agent', 'yes', *command], env=env,
                            capture_output=True, text=True, timeout=120)
    output = (result.stdout + result.stderr).replace(uri, '[database connection]').replace(password, '[redacted]')
    assert result.returncode == 0, output
    print(output, flush=True)
    return result.stdout


connection = psycopg2.connect(uri, sslmode='require', connect_timeout=15,
    hostaddr=socket.getaddrinfo(parsed.hostname, parsed.port or 5432, socket.AF_INET, socket.SOCK_STREAM)[0][4][0])
connection.autocommit = True
with connection, connection.cursor() as cursor:
    cursor.execute('select version from supabase_migrations.schema_migrations order by version')
    history = [row[0] for row in cursor.fetchall()]
    assert version not in history, 'Already installed: verify instead of replaying.'
    cursor.execute("select to_regnamespace('eflow_schedule')")
    existing_schema = cursor.fetchone()[0]
    assert (existing_schema is not None) if args.insert_guard else (existing_schema is None), 'Unexpected installation state: inspect before proceeding.'
    checked_function = 'eflow_schedule.guard_project()' if args.insert_guard else 'eflow_phase7.readiness(uuid)'
    cursor.execute('select prosrc from pg_proc where oid=%s::regprocedure', (checked_function,))
    current_body = cursor.fetchone()[0].replace('\r\n', '\n').strip()
    baseline_name = '20261029232938_project_task_schedule_bounds.sql' if args.insert_guard else '20261005170822_phase65_project_local_office_identity.sql'
    baseline = (root / 'supabase/migrations' / baseline_name).read_text()
    pattern = r'CREATE FUNCTION eflow_schedule.guard_project.*?\$\$(.*?)\$\$;' if args.insert_guard else r'create or replace function eflow_phase7.readiness.*?\$\$(.*?)\$\$;'
    expected_body = re.search(pattern, baseline, re.S).group(1).strip()
    assert current_body == expected_body, 'Readiness wrapper drifted from the reviewed baseline.'
    cursor.execute('select pg_get_functiondef(%s::regprocedure)', (checked_function,))
    (backup / ('pre-insert-guard.sql' if args.insert_guard else 'pre-schedule-readiness.sql')).write_text(cursor.fetchone()[0], encoding='utf-8')
    cursor.execute("select tablename from pg_tables where schemaname='public' order by tablename")
    tables = [row[0] for row in cursor.fetchall()]

    def fingerprint():
        queries = []
        for table in tables:
            # The running AI gateway updates this one heartbeat row normally.
            # Every other config row and every workflow/identity row stays checked.
            condition = sql.SQL(" where t.key <> 'ai_endpoint_heartbeat'") if table == 'system_config' else sql.SQL('')
            queries.append(sql.SQL("select {} as table_name,count(*)::bigint as count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as digest from public.{} t{}").format(sql.Literal(table), sql.Identifier(table), condition))
        cursor.execute(sql.SQL(' union all ').join(queries))
        return cursor.fetchall()

    before = fingerprint()
    (backup / 'schedule-preflight-fingerprints.json').write_text(json.dumps(before, indent=2) + '\n')
    run(['migration', 'fetch', '--db-url', passwordless, '--yes'])
    folder = workspace / 'supabase/migrations'
    shutil.copyfile(root / 'supabase/migrations' / name, folder / name)
    assert {file.name[:14] for file in folder.glob('*.sql')} == set(history) | {version}
    dry = run(['db', 'push', '--db-url', passwordless, '--include-all', '--skip-vault', '--dry-run'])
    selection = next(json.loads(line) for line in dry.splitlines() if line.startswith('{') and 'migrations' in json.loads(line))
    assert selection['migrations'] == [name] and selection['dryRun'] and not selection['seeds'] and not selection['roles']
    receipt = {'target': target, 'migration': name, 'sha256': hashlib.sha256((root / 'supabase/migrations' / name).read_bytes()).hexdigest(),
        'prior_migrations': len(history), 'backup_verified': True, 'reviewed_function_baseline_matched': checked_function,
        'dry_run_selected_only_this_migration': True,
        'excluded_runtime_rows': {'system_config': ['ai_endpoint_heartbeat']}, 'applied': False}
    destination = root / 'docs/project-schedule-validation-2026-10-30'
    destination.mkdir(parents=True, exist_ok=True)
    prefix = 'INSERT_GUARD_' if args.insert_guard else ''
    (destination / (prefix + 'DEPLOYMENT_PREFLIGHT.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    checked = fingerprint()
    changed = [left[0] for left, right in zip(before, checked) if left != right]
    if changed:
        print(json.dumps({'public_tables_changed_during_preflight': changed}), flush=True)
    if args.apply:
        assert not changed, 'Public data changed during preflight: stop and recheck.'
        # End the read-only catalog/preservation transaction before the separate
        # CLI connection takes DDL locks. Keep no preflight relation locks open.
        connection.commit()
        run(['db', 'push', '--db-url', passwordless, '--include-all', '--skip-vault', '--yes'])
        assert fingerprint() == before, 'Public rows changed; inspect before further work.'
        cursor.execute('select version from supabase_migrations.schema_migrations order by version')
        assert [row[0] for row in cursor.fetchall()] == sorted(history + [version])
        cursor.execute("select count(*) from pg_trigger where tgname in ('zz_project_schedule_bounds','zz_task_project_schedule_bounds') and tgenabled='O'")
        assert cursor.fetchone()[0] == 2
        cursor.execute("select has_schema_privilege('anon','eflow_schedule','usage'),has_schema_privilege('authenticated','eflow_schedule','usage')")
        assert cursor.fetchone() == (False, False)
        receipt.update(applied=True, public_tables_checked=len(tables), non_heartbeat_public_rows_unchanged=True,
            guards_enabled=True, private_helpers_inaccessible_to_clients=True, completed_at=datetime.now(timezone.utc).isoformat())
        (destination / (prefix + 'DEPLOYMENT_RECEIPT.json')).write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt), flush=True)
connection.close()
