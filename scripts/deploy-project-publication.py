"""Deploy only the reviewed draft-first migration using exact hosted history."""
import argparse, hashlib, json, os, shutil, subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, unquote
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
parser=argparse.ArgumentParser();parser.add_argument('--cli',required=True);parser.add_argument('--backup',required=True);parser.add_argument('--apply',action='store_true');parser.add_argument('--history-retention',action='store_true');args=parser.parse_args()
root=Path.cwd();target='ixnfphgjyelhckjwjkdv';name='20261007203525_project_publication_history_retention.sql' if args.history_retention else '20261007201249_project_draft_publication.sql'
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];parsed=urlparse(uri);password=unquote(parsed.password or '')
assert unquote(parsed.username or '')=='postgres.'+target
backup=Path(args.backup).resolve();assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow'/'deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text());assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for file,record in manifest['files'].items(): assert hashlib.sha256((backup/file).read_bytes()).hexdigest()==record['sha256']
workspace=root/'.codex-tmp'/'project-publication-main';workspace.mkdir(parents=True,exist_ok=True)
passwordless=parsed._replace(netloc=parsed.netloc.split(':',1)[0]+'@'+parsed.netloc.split('@',1)[1]).geturl()
env={**os.environ,'PGPASSWORD':password,'SUPABASE_DB_PASSWORD':password,'PGCONNECT_TIMEOUT':'15'}
def run(command):
 result=subprocess.run([args.cli,'--workdir',str(workspace),*command],env=env,capture_output=True,text=True,timeout=120)
 output=(result.stdout+result.stderr).replace(uri,'[database connection]').replace(password,'[redacted]')
 assert result.returncode==0,output
 print(output,flush=True);return result.stdout
conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15);conn.autocommit=True;cur=conn.cursor()
cur.execute('select version from supabase_migrations.schema_migrations order by version');history=[r[0] for r in cur.fetchall()]
assert name[:14] not in history
cur.execute("select count(*) from information_schema.columns where table_schema='public' and table_name='projects' and column_name='publication_state'");assert cur.fetchone()[0]==(1 if args.history_retention else 0)
run(['migration','fetch','--db-url',passwordless,'--yes']);folder=workspace/'supabase'/'migrations';shutil.copyfile(root/'supabase'/'migrations'/name,folder/name)
assert {p.name[:14] for p in folder.glob('*.sql')}==set(history)|{name[:14]}
dry=run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--dry-run']);selection=json.loads(next(line for line in dry.splitlines() if line.startswith('{')))
assert selection['migrations']==[name] and selection['dryRun'] and not selection['seeds'] and not selection['roles']
if args.apply:
 cur.execute("select tablename from pg_tables where schemaname='public' order by tablename");tables=[r[0] for r in cur.fetchall()]
 def fingerprint():
  parts=[]
  for table in tables:
   expression=sql.SQL("to_jsonb(t)-'publication_state'-'published_at'-'published_by'") if table=='projects' and not args.history_retention else sql.SQL('to_jsonb(t)')
   parts.append(sql.SQL("select {} as table_name,count(*)::bigint as count,md5(coalesce(string_agg(md5(({})::text),'' order by md5(({})::text)),'')) as digest from public.{} t").format(sql.Literal(table),expression,expression,sql.Identifier(table)))
  cur.execute(sql.SQL(' union all ').join(parts));return cur.fetchall()
 before=fingerprint()
 run(['db','push','--db-url',passwordless,'--include-all','--skip-vault','--yes'])
 assert fingerprint()==before,'Existing data changed; inspect before further deployment.'
 cur.execute("select count(*) from public.projects where publication_state<>'published' or published_at is not null or published_by is not null");assert cur.fetchone()[0]==0
 cur.execute("select has_function_privilege('anon','public.publish_project(uuid)','execute'),has_function_privilege('authenticated','public.publish_project(uuid)','execute')");assert cur.fetchone()==(False,True)
 cur.execute('select version from supabase_migrations.schema_migrations order by version');assert [r[0] for r in cur.fetchall()]==sorted(history+[name[:14]])
 receipt={'target':target,'migration':name,'existing_data_preserved':True,'legacy_projects_preserved':True,'anonymous_publish_denied':True}
 (backup/('project-publication-retention-deployment.json' if args.history_retention else 'project-publication-deployment.json')).write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
conn.close()
