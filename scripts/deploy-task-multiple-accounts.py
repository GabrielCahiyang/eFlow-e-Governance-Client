"""Deploy reviewed additional budget accounts on funded tasks."""
import argparse,hashlib,json,os,shutil,socket,subprocess
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,unquote
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
parser=argparse.ArgumentParser();parser.add_argument('--backup',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;target='ixnfphgjyelhckjwjkdv'
name='20261102182541_task_multiple_budget_accounts.sql';version=name[:14]
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);password=unquote(u.password or '')
assert unquote(u.username or '')=='postgres.'+target
backup=Path(args.backup).resolve();assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text());assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for file,record in manifest['files'].items():assert hashlib.sha256((backup/file).read_bytes()).hexdigest()==record['sha256']
cli=Path(os.environ['LOCALAPPDATA'])/'npm-cache/_npx/ade306d1eb8b9835/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
workspace=root/'.codex-tmp/task-multiple-accounts-deployment';workspace.mkdir(parents=True,exist_ok=True)
passwordless=u._replace(netloc=u.netloc.split(':',1)[0]+'@'+u.netloc.split('@',1)[1]).geturl()
env={**os.environ,'PGPASSWORD':password,'SUPABASE_DB_PASSWORD':password,'PGCONNECT_TIMEOUT':'15'}
def run(command):
 result=subprocess.run([str(cli),'--workdir',str(workspace),'--agent','yes',*command],env=env,capture_output=True,text=True,timeout=150)
 output=(result.stdout+result.stderr).replace(uri,'[database connection]').replace(password,'[redacted]');assert result.returncode==0,output
 print(output,flush=True);return result.stdout
conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);conn.autocommit=True;c=conn.cursor()
c.execute('select version from supabase_migrations.schema_migrations order by version');history=[r[0] for r in c.fetchall()];assert version not in history
normalize=lambda value:'\n'.join(line.rstrip() for line in value.replace('\r\n','\n').strip().rstrip(';').strip().splitlines() if line.strip())
for file in (root/'.codex-tmp/task-multiple-accounts-baseline').glob('*.sql'):
 c.execute("select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||'.'||p.proname=%s and p.prokind='f'",(file.stem,));rows=c.fetchall();assert len(rows)==1
 assert normalize(rows[0][0])==normalize(file.read_text(encoding='utf-8')),'Function drift: '+file.stem
c.execute("select schemaname,tablename from pg_tables where schemaname in ('public','eflow_budget') order by 1,2");tables=c.fetchall()
def fingerprint():
 queries=[]
 for schema,table in tables:
  condition=sql.SQL(" where t.key <> 'ai_endpoint_heartbeat'") if schema=='public' and table=='system_config' else sql.SQL('')
  queries.append(sql.SQL("select {} as name,count(*)::bigint,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {}.{} t{}").format(sql.Literal(schema+'.'+table),sql.Identifier(schema),sql.Identifier(table),condition))
 c.execute(sql.SQL(' union all ').join(queries));return c.fetchall()
before=fingerprint();(backup/'task-multiple-accounts-preflight.json').write_text(json.dumps(before))
run(['migration','fetch','--db-url',passwordless,'--yes'])
folder=workspace/'supabase/migrations';shutil.copyfile(root/'supabase/migrations'/name,folder/name)
assert {file.name[:14] for file in folder.glob('*.sql')}==set(history)|{version}
dry=run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--dry-run'])
selection=next(json.loads(line) for line in dry.splitlines() if line.startswith('{') and 'migrations' in json.loads(line))
assert selection['migrations']==[name] and selection['dryRun'] and not selection['seeds'] and not selection['roles']
assert fingerprint()==before,'Data changed during preflight.'
receipt={'target':target,'migration':name,'sha256':hashlib.sha256((root/'supabase/migrations'/name).read_bytes()).hexdigest(),'backup_verified':True,'prior_migrations':len(history),'dry_run_only_reviewed_delta':True,'tables_checked':len(tables),'applied':False}
destination=root/'docs/task-multiple-accounts-2026-11-03';destination.mkdir(parents=True,exist_ok=True)
(destination/'DEPLOYMENT_PREFLIGHT.json').write_text(json.dumps(receipt,indent=2))
if args.apply:
 run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--yes'])
 assert fingerprint()==before,'Existing rows changed; inspect before continuing.'
 c.execute('select version from supabase_migrations.schema_migrations order by version');assert [r[0] for r in c.fetchall()]==sorted(history+[version])
 c.execute("select has_function_privilege('authenticated','public.allocate_project_task_funding(uuid,jsonb,text,uuid)','execute'),has_function_privilege('anon','public.allocate_project_task_funding(uuid,jsonb,text,uuid)','execute'),has_function_privilege('authenticated','eflow_budget.account_reservations(uuid)','execute')");assert c.fetchone()==(True,False,False)
 c.execute("notify pgrst, 'reload schema'")
 receipt.update(applied=True,existing_rows_unchanged=True,completed_at=datetime.now(timezone.utc).isoformat())
 (destination/'DEPLOYMENT_RECEIPT.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt));conn.close()
