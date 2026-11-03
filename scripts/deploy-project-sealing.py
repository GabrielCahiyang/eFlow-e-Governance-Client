"""Preflight one reviewed migration in an isolated workspace with live history.

Default is a read-only dry run. --apply requires a matching prior reviewed
preflight, fresh backup and unchanged schema/function fingerprints.
"""
import argparse,hashlib,json,os,shutil,socket,subprocess
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,unquote
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql

parser=argparse.ArgumentParser();parser.add_argument('--backup',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;target='ixnfphgjyelhckjwjkdv'
name='20261103070206_project_archive_publication_lifecycle.sql';version=name[:14]
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);password=unquote(u.password or '')
assert unquote(u.username or '')=='postgres.'+target,'Wrong hosted project.'
backup=Path(args.backup).resolve();assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text(encoding='utf-8'));assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600,'Create a fresh verified backup.'
for file,record in manifest['files'].items():assert hashlib.sha256((backup/file).read_bytes()).hexdigest()==record['sha256']
cli=Path(os.environ['LOCALAPPDATA'])/'npm-cache/_npx/ade306d1eb8b9835/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
assert cli.is_file(),'The reviewed Supabase CLI is unavailable.'
workspace=root/'.codex-tmp/project-sealing-deployment';workspace.mkdir(parents=True,exist_ok=True)
destination=root/'docs/blockchain-project-sealing-2026-11-03';destination.mkdir(parents=True,exist_ok=True)
baseline_path=workspace/'reviewed-schema.json';preflight_path=destination/'DEPLOYMENT_PREFLIGHT.json'
sha=hashlib.sha256((root/'supabase/migrations'/name).read_bytes()).hexdigest()
passwordless=u._replace(netloc=u.netloc.split(':',1)[0]+'@'+u.netloc.split('@',1)[1]).geturl()
env={**os.environ,'PGPASSWORD':password,'SUPABASE_DB_PASSWORD':password,'PGCONNECT_TIMEOUT':'15'}

def run(command):
 result=subprocess.run([str(cli),'--workdir',str(workspace),'--agent','yes',*command],env=env,capture_output=True,text=True,timeout=180)
 output=(result.stdout+result.stderr).replace(uri,'[database connection]').replace(password,'[redacted]')
 assert result.returncode==0,output
 print(output,flush=True);return result.stdout

conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);conn.autocommit=True;c=conn.cursor()
c.execute('select version from supabase_migrations.schema_migrations order by version');history=[r[0] for r in c.fetchall()];assert version not in history
c.execute("select n.nspname||'.'||p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname like 'eflow_%' or n.nspname='public') order by 1")
functions=c.fetchall()
c.execute("select table_schema,table_name,column_name,data_type,udt_name from information_schema.columns where table_schema in('public','eflow_project','eflow_budget','eflow_office_cash','storage') order by 1,2,3")
columns=c.fetchall();baseline={'history':history,'functions':functions,'columns':columns}
normalized=json.loads(json.dumps(baseline))
if args.apply:
 assert baseline_path.exists() and preflight_path.exists(),'Run and review the dry run first.'
 prior=json.loads(preflight_path.read_text(encoding='utf-8'));assert prior['sha256']==sha and prior['target']==target and prior['dry_run_only_reviewed_delta']
 assert json.loads(baseline_path.read_text(encoding='utf-8'))==normalized,'Live schema/function drift: review again.'
else:baseline_path.write_text(json.dumps(normalized),encoding='utf-8')

c.execute("select schemaname,tablename from pg_tables where schemaname in('public','eflow_budget','eflow_project','eflow_office_cash') or schemaname='auth' and tablename='users' order by 1,2");tables=c.fetchall()
def fingerprint():
 parts=[]
 for schema,table in tables:
  expr=sql.SQL("to_jsonb(t)-array['completed_at','archive_reminded_at','archive_blocked_at','updated_at']") if (schema,table)==('public','projects') else sql.SQL('to_jsonb(t)')
  condition=sql.SQL(" where t.key<>'ai_endpoint_heartbeat'") if (schema,table)==('public','system_config') else sql.SQL('')
  parts.append(sql.SQL("select {} name,count(*)::bigint,md5(coalesce(string_agg(md5(({})::text),'' order by md5(({})::text)),'')) from {}.{} t{}").format(sql.Literal(schema+'.'+table),expr,expr,sql.Identifier(schema),sql.Identifier(table),condition))
 c.execute(sql.SQL(' union all ').join(parts));return c.fetchall()
before=fingerprint();(backup/'project-sealing-preflight.json').write_text(json.dumps(before),encoding='utf-8')
run(['migration','fetch','--db-url',passwordless,'--yes'])
folder=workspace/'supabase/migrations';shutil.copyfile(root/'supabase/migrations'/name,folder/name)
assert {p.name[:14] for p in folder.glob('*.sql')}==set(history)|{version},'Unexpected pending migration.'
dry=run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--dry-run'])
selection=next(json.loads(line) for line in dry.splitlines() if line.startswith('{') and 'migrations' in json.loads(line))
assert selection['migrations']==[name] and selection['dryRun'] and not selection['seeds'] and not selection['roles']
assert fingerprint()==before,'Data changed during preflight.'
receipt={'target':target,'migration':name,'sha256':sha,'backup_verified':True,'prior_migrations':len(history),'dry_run_only_reviewed_delta':True,'tables_checked':len(tables),'applied':False,'completed_at':datetime.now(timezone.utc).isoformat()}
preflight_path.write_text(json.dumps(receipt,indent=2),encoding='utf-8')
if args.apply:
 run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--yes'])
 assert fingerprint()==before,'Existing operational rows changed unexpectedly. Inspect before continuing.'
 c.execute('select version from supabase_migrations.schema_migrations order by version');assert [r[0] for r in c.fetchall()]==sorted(history+[version])
 c.execute("select has_function_privilege('authenticated','public.approve_project_seal(uuid,text)','execute'),has_function_privilege('anon','public.approve_project_seal(uuid,text)','execute'),has_function_privilege('authenticated','public.seal_worker_claim(uuid)','execute')");assert c.fetchone()==(True,False,False)
 c.execute("select count(*) from cron.job where jobname='eflow-project-auto-archive'");assert c.fetchone()[0]==1
 receipt.update(applied=True,existing_rows_preserved=True,completed_at=datetime.now(timezone.utc).isoformat())
 (destination/'DEPLOYMENT_RECEIPT.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt));conn.close()
