"""One additive guest lifecycle migration; isolated exact hosted history only."""
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
from urllib.parse import unquote, urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser = argparse.ArgumentParser()
parser.add_argument('--backup', required=True)
parser.add_argument('--apply', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
target = 'ixnfphgjyelhckjwjkdv'
name = '20261108193508_project_guest_account_lifecycle.sql'
backup = Path(args.backup).resolve()
assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve())
manifest = json.loads((backup/'manifest.json').read_text())
assert manifest['project_ref'] == target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for filename, record in manifest['files'].items():
    assert hashlib.sha256((backup/filename).read_bytes()).hexdigest()==record['sha256']
uri = dotenv_values(root/'.env')['EFLOW_DATABASE_URL']
parsed = urlparse(uri)
assert unquote(parsed.username or '') == 'postgres.'+target
password = unquote(parsed.password or '')
passwordless = parsed._replace(netloc=parsed.netloc.split(':',1)[0]+'@'+parsed.netloc.split('@',1)[1]).geturl()
cli = Path(os.environ['LOCALAPPDATA'])/'npm-cache/_npx/ade306d1eb8b9835/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
workspace = root/'.codex-tmp/guest-lifecycle-deployment'
workspace.mkdir(parents=True, exist_ok=True)
env = {**os.environ,'PGPASSWORD':password,'SUPABASE_DB_PASSWORD':password,'PGCONNECT_TIMEOUT':'15'}
def run(command):
    result = subprocess.run([str(cli),'--workdir',str(workspace),'--agent','yes',*command],env=env,capture_output=True,text=True,timeout=180)
    safe = (result.stdout+result.stderr).replace(uri,'[database connection]').replace(password,'[redacted]')
    assert result.returncode==0,safe
    print(safe,flush=True)
    return result.stdout

conn = psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(parsed.hostname,parsed.port or 5432,socket.AF_INET,socket.SOCK_STREAM)[0][4][0])
c = conn.cursor()
c.execute('select version from supabase_migrations.schema_migrations order by version')
history = [row[0] for row in c.fetchall()]
assert name[:14] not in history
c.execute("select to_regnamespace('eflow_guests') is null, exists(select 1 from pg_extension where extname='pg_cron')")
assert c.fetchone() == (True,True), 'Guest schema already exists or Cron is unavailable.'
conn.rollback()
source = (root/'supabase/migrations'/name).read_text(encoding='utf-8')
# Compile and inspect the migration against actual hosted contracts, then roll
# everything back, including publication membership and the scheduled job.
try:
    c.execute(re.sub(r'(?m)^commit;\s*$', '', re.sub(r'(?m)^begin;\s*$', '', source, count=1)))
    c.execute("select id from public.profiles where role='admin' and is_active order by id limit 1")
    actor = c.fetchone()[0]
    c.execute("select set_config('request.jwt.claim.sub',%s,true)", (str(actor),))
    c.execute('select public.admin_project_guests()')
    guest_count = len(c.fetchone()[0])
    c.execute("select count(*) from cron.job where jobname='eflow-project-guest-lifecycle'")
    assert c.fetchone()[0]==1
    c.execute("select has_function_privilege('anon','public.admin_project_guests()','execute'),has_function_privilege('authenticated','eflow_guests.maintain()','execute'),has_table_privilege('authenticated','public.project_guest_accounts','update')")
    assert c.fetchone()==(False,False,False)
finally:
    conn.rollback()
c.execute("select to_regnamespace('eflow_guests') is null")
assert c.fetchone()[0], 'Preflight did not roll back.'
conn.rollback()
print(json.dumps({'hosted_compile_rolled_back':True,'existing_guest_accounts':guest_count}),flush=True)
run(['migration','fetch','--db-url',passwordless,'--yes'])
folder = workspace/'supabase/migrations'
shutil.copyfile(root/'supabase/migrations'/name, folder/name)
assert {p.name[:14] for p in folder.glob('*.sql')}==set(history)|{name[:14]}
dry = run(['db','push','--db-url',passwordless,'--skip-vault','--include-all','--dry-run'])
selection = json.loads(next(line for line in dry.splitlines() if line.startswith('{')))
assert selection['dryRun'] and selection['migrations']==[name] and not selection['roles'] and not selection['seeds']
receipt = {'target':target,'migration':name,'sha256':hashlib.sha256(source.encode()).hexdigest(),'hosted_compile_rolled_back':True,'only_selected_migration':True,'applied':False,'existing_guest_accounts':guest_count}
if args.apply:
    def protected():
        result = {}
        for schema, table in [('public','profiles'),('public','organizations'),('auth','users'),('public','petty_cash_requests'),('public','petty_cash_liquidations'),('eflow_office_cash','requests')]:
            c.execute(sql.SQL('select to_jsonb(x)::text from {}.{} x order by 1').format(sql.Identifier(schema),sql.Identifier(table)))
            result[schema+'.'+table] = hashlib.sha256(json.dumps(c.fetchall()).encode()).hexdigest()
        return result
    before = protected()
    conn.rollback()
    run(['db','push','--db-url',passwordless,'--skip-vault','--include-all','--yes'])
    assert protected()==before, 'Existing protected data changed; inspect preservation before continuing.'
    c.execute('select version from supabase_migrations.schema_migrations order by version')
    assert [r[0] for r in c.fetchall()]==sorted(history+[name[:14]])
    c.execute("select schedule,active from cron.job where jobname='eflow-project-guest-lifecycle'")
    assert c.fetchone()==('*/15 * * * *',True)
    receipt.update(applied=True,protected_data_unchanged=True,schedule='Every 15 minutes',completed_at=datetime.now(timezone.utc).isoformat())
destination=root/'docs/project-guest-lifecycle-2026-11-09'
destination.mkdir(parents=True,exist_ok=True)
(destination/('DEPLOYMENT_RECEIPT.json' if args.apply else 'PREFLIGHT.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt))
conn.rollback()
conn.close()
