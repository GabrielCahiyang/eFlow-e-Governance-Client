"""Reviewed lockout-only deployment from isolated exact hosted migration history."""
import argparse
from datetime import datetime,timezone
import hashlib,json,os,shutil,subprocess
from pathlib import Path
from urllib.parse import urlparse,unquote
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser=argparse.ArgumentParser()
parser.add_argument('--cli',required=True)
parser.add_argument('--backup',required=True)
parser.add_argument('--apply',action='store_true')
parser.add_argument('--migration',default='20261007191654_account_login_lockout.sql',choices=['20261007191654_account_login_lockout.sql','20261007195837_login_gateway_discovery.sql'])
args=parser.parse_args()
root=Path.cwd(); target='ixnfphgjyelhckjwjkdv'
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL']; parsed=urlparse(uri)
assert unquote(parsed.username or '')=='postgres.'+target
backup=Path(args.backup).resolve()
assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow'/'deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text())
assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for name,record in manifest['files'].items(): assert hashlib.sha256((backup/name).read_bytes()).hexdigest()==record['sha256']
migration=args.migration
workspace=root/'.codex-tmp'/'login-security-main'; workspace.mkdir(parents=True,exist_ok=True)
password=unquote(parsed.password or '')
passwordless=parsed._replace(netloc=parsed.netloc.split(':',1)[0]+'@'+parsed.netloc.split('@',1)[1]).geturl()
env={**os.environ,'PGPASSWORD':password,'SUPABASE_DB_PASSWORD':password,'PGCONNECT_TIMEOUT':'15'}
def run(command):
    result=subprocess.run([args.cli,'--workdir',str(workspace),*command],env=env,capture_output=True,text=True,timeout=120)
    safe=(result.stdout+result.stderr).replace(uri,'[database connection]').replace(password,'[redacted]')
    assert result.returncode==0,safe
    print(safe,flush=True)
    return result.stdout
conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15);conn.autocommit=True;cur=conn.cursor()
cur.execute('select version from supabase_migrations.schema_migrations order by version'); history=[r[0] for r in cur.fetchall()]
assert migration[:14] not in history
if migration=='20261007191654_account_login_lockout.sql':
    cur.execute("select to_regclass('private.eflow_login_settings')");assert cur.fetchone()[0] is None
run(['migration','fetch','--db-url',passwordless,'--yes'])
folder=workspace/'supabase'/'migrations';shutil.copyfile(root/'supabase'/'migrations'/migration,folder/migration)
assert {p.name[:14] for p in folder.glob('*.sql')}==set(history)|{migration[:14]}
dry=run(['db','push','--db-url',passwordless,'--skip-vault','--include-all','--dry-run'])
selection=json.loads(next(line for line in dry.splitlines() if line.startswith('{')))
assert selection['dryRun'] and selection['migrations']==[migration] and not selection['roles'] and not selection['seeds']
if args.apply:
    cur.execute("select tablename from pg_tables where schemaname='public' order by tablename");tables=[r[0] for r in cur.fetchall()]
    def fingerprint():
        values={}
        for table in tables:
            cur.execute(sql.SQL('select to_jsonb(t) from public.{} t').format(sql.Identifier(table)))
            values[table]=hashlib.sha256(json.dumps(sorted((r[0] for r in cur.fetchall()),key=lambda r:json.dumps(r,sort_keys=True)),sort_keys=True).encode()).hexdigest()
        return values
    before=fingerprint()
    run(['db','push','--db-url',passwordless,'--skip-vault','--include-all','--yes'])
    assert fingerprint()==before,'Existing public data changed: inspect before continuing'
    cur.execute('select version from supabase_migrations.schema_migrations order by version');assert [r[0] for r in cur.fetchall()]==sorted(history+[migration[:14]])
    cur.execute("select has_function_privilege('authenticated','public.eflow_login_begin(text)','execute'),has_function_privilege('anon','public.eflow_login_begin(text)','execute'),has_function_privilege('service_role','public.eflow_login_begin(text)','execute'),(select max_attempts from private.eflow_login_settings)")
    assert cur.fetchone()==(False,False,True,3)
    receipt={'target':target,'migration':migration,'public_data_unchanged':True,'gateway_only_grants':True,'default_attempts':3}
    (backup/(migration[:14]+'-login-security-deployment.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8')
    print(json.dumps(receipt))
conn.close()
