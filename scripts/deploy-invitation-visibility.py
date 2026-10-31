"""Apply only the reviewed invitation ACL/API delta using exact live history."""
import argparse,hashlib,json,os,shutil,socket,subprocess
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,unquote
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
parser=argparse.ArgumentParser();parser.add_argument('--backup',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;target='ixnfphgjyelhckjwjkdv'
name='20261030010856_project_office_invitation_visibility.sql';version=name[:14]
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];parsed=urlparse(uri);password=unquote(parsed.password or '')
assert unquote(parsed.username or '')=='postgres.'+target
backup=Path(args.backup).resolve();assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text());assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for file,record in manifest['files'].items():assert hashlib.sha256((backup/file).read_bytes()).hexdigest()==record['sha256']
cli=Path(os.environ['LOCALAPPDATA'])/'npm-cache/_npx/ade306d1eb8b9835/node_modules/@supabase/cli-windows-x64/bin/supabase.exe'
workspace=root/'.codex-tmp/invitation-visibility-20261030';workspace.mkdir(parents=True,exist_ok=True)
passwordless=parsed._replace(netloc=parsed.netloc.split(':',1)[0]+'@'+parsed.netloc.split('@',1)[1]).geturl()
env={**os.environ,'PGPASSWORD':password,'SUPABASE_DB_PASSWORD':password,'PGCONNECT_TIMEOUT':'15'}
def run(command):
 result=subprocess.run([str(cli),'--workdir',str(workspace),'--agent','yes',*command],env=env,capture_output=True,text=True,timeout=150)
 output=(result.stdout+result.stderr).replace(uri,'[database connection]').replace(password,'[redacted]');assert result.returncode==0,output
 print(output,flush=True);return result.stdout
conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(parsed.hostname,parsed.port or 5432,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);conn.autocommit=True;c=conn.cursor()
c.execute('select version from supabase_migrations.schema_migrations order by version');history=[r[0] for r in c.fetchall()];assert version not in history
c.execute("select qual from pg_policies where schemaname='public' and tablename='project_office_people' and policyname='project_office_people_read'");policy=c.fetchone()[0];assert 'project_invitation_requests' in policy
(backup/'office-people-original-policy.sql').write_text(policy)
c.execute("select tablename from pg_tables where schemaname='public' order by tablename");tables=[r[0] for r in c.fetchall()]
def fingerprint():
 queries=[]
 for table in tables:
  condition=sql.SQL(" where t.key <> 'ai_endpoint_heartbeat'") if table=='system_config' else sql.SQL('')
  queries.append(sql.SQL("select {} as name,count(*)::bigint,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from public.{} t{}").format(sql.Literal(table),sql.Identifier(table),condition))
 c.execute(sql.SQL(' union all ').join(queries));return c.fetchall()
before=fingerprint();(backup/'invitation-preflight-rows.json').write_text(json.dumps(before))
run(['migration','fetch','--db-url',passwordless,'--yes'])
folder=workspace/'supabase/migrations';shutil.copyfile(root/'supabase/migrations'/name,folder/name)
assert {file.name[:14] for file in folder.glob('*.sql')}==set(history)|{version}
dry=run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--dry-run'])
selection=next(json.loads(line) for line in dry.splitlines() if line.startswith('{') and 'migrations' in json.loads(line))
assert selection['migrations']==[name] and selection['dryRun'] and not selection['seeds'] and not selection['roles']
assert fingerprint()==before,'Public data changed during preflight. Stop and review.'
receipt={'target':target,'migration':name,'sha256':hashlib.sha256((root/'supabase/migrations'/name).read_bytes()).hexdigest(),'backup_verified':True,'prior_migrations':len(history),'dry_run_only_reviewed_delta':True,'public_tables_checked':len(tables),'applied':False}
destination=root/'docs/invitation-fix-2026-10-30';destination.mkdir(parents=True,exist_ok=True)
(destination/'DEPLOYMENT_PREFLIGHT.json').write_text(json.dumps(receipt,indent=2))
if args.apply:
 run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--yes'])
 assert fingerprint()==before,'Public data changed; inspect before continuing.'
 c.execute('select version from supabase_migrations.schema_migrations order by version');assert [r[0] for r in c.fetchall()]==sorted(history+[version])
 c.execute("select has_table_privilege('authenticated','public.project_invitation_requests','select'),has_table_privilege('authenticated','public.project_guest_members','select'),has_function_privilege('anon','public.r8_office_people(uuid)','execute')");assert c.fetchone()==(False,False,False)
 receipt.update(applied=True,non_heartbeat_public_rows_unchanged=True,private_tables_still_private=True,completed_at=datetime.now(timezone.utc).isoformat())
 (destination/'DEPLOYMENT_RECEIPT.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt));conn.close()
