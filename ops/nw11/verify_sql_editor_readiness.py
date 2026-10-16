"""Read-only preflight and one exact native CLI dry run. No apply/export mode."""
import hashlib,json,os,re,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlsplit,unquote,quote
from dotenv import dotenv_values
import psycopg2

ROOT=Path(__file__).resolve().parents[2]
REVISION=sys.argv[1] if len(sys.argv)>1 else 'original'
assert REVISION in ('original','r2','r3'),'Only original, r2 or r3 read-only package selection is supported'
BASE=ROOT/({'original':'.refinement/nw11-current-20261016','r2':'.refinement/nw11-postcondition-20261016','r3':'.refinement/nw11-constraint-20261016'}[REVISION])
PACKAGE=ROOT/('docs/product-refinement/sql-editor/2026-10-16'+('' if REVISION=='original' else '-'+REVISION))
TARGET='ixnfphgjyelhckjwjkdv'
sha=lambda value:hashlib.sha256(value).hexdigest()

def verify():
 receipt=BASE/'sql-editor-hosted-readonly-and-dry-run.json'
 assert not receipt.exists(),'Inspect an existing receipt instead of overwriting it'
 manifest=json.loads((PACKAGE/'manifest.json').read_text(encoding='utf8'))
 assert manifest['target']==TARGET and not manifest['deployed']
 if REVISION=='r2':assert manifest['revision']==2 and manifest['previousAttemptRolledBack']
 if REVISION=='r3':assert manifest['revision']==3 and manifest['previousAttemptRolledBack'] and manifest['referenceMajorMatchesHosted']
 for item in manifest['files']:assert sha((PACKAGE/item['file']).read_bytes())==item['sha256']
 work=BASE/'workspace';migrations=work/'supabase/migrations'
 expected=manifest['installedHistory'];pending=f"{manifest['newVersion']}_{manifest['newName']}.sql"
 assert sorted(f.name for f in migrations.glob('*.sql'))==sorted([x['file'] for x in expected]+[pending])
 for item in expected:assert sha((migrations/item['file']).read_bytes())==item['sha256']
 assert sha((migrations/pending).read_bytes())==manifest['migrationBodySha256']
 cfg=dotenv_values(ROOT/'.env');uri=cfg.get('EFLOW_DATABASE_URL','');u=urlsplit(uri)
 username=unquote(u.username or '');password=unquote(u.password or '')
 assert password and u.scheme in ('postgres','postgresql') and u.port==5432 and u.path=='/postgres'
 assert (u.hostname==f'db.{TARGET}.supabase.co' and username=='postgres') or ((u.hostname or '').endswith('.pooler.supabase.com') and username==f'postgres.{TARGET}')
 assert cfg.get('VITE_SUPABASE_URL','').rstrip('/')==f'https://{TARGET}.supabase.co'
 def scrub(value):
  for secret in (uri,password,u.password):
   if secret:value=value.replace(secret,'[REDACTED]')
  return re.sub(r'postgres(?:ql)?://[^\s]+','[REDACTED_DATABASE_URI]',value)
 result={'target':TARGET,'startedAt':datetime.now(timezone.utc).isoformat(),'hostedApplyExecuted':False,'privateRowsRead':False,'dryRun':True,'skipVault':True,'includeAll':False,'roles':False,'seeds':False,'expectedPending':[pending]}
 conn=None
 try:
  conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,application_name='eflow_nw11_sql_editor_readonly_preflight')
  conn.set_session(readonly=True,autocommit=False,isolation_level='REPEATABLE READ')
  def inspect(label):
   with conn.cursor() as c:
    c.execute('show transaction_read_only');assert c.fetchone()[0]=='on'
    c.execute((PACKAGE/'01-read-only-preflight.sql').read_text(encoding='utf8'))
    c.execute('select version,name from supabase_migrations.schema_migrations order by version')
    assert [{'version':r[0],'name':r[1]} for r in c.fetchall()]==[{'version':m['version'],'name':m['name']} for m in expected]
    result[label]={'passed':True,'transactionReadOnly':True,'installedVersions':len(expected),'at':datetime.now(timezone.utc).isoformat()}
   conn.rollback()
  inspect('beforeDryRun')
  safe_uri='postgresql://'+quote(username,safe='')+'@'+u.hostname+':5432/postgres?sslmode=require'
  binary=ROOT/'.codex-tmp/phase65-live/tools/supabase.exe'
  args=[str(binary),'--workdir',str(work),'db','push','--db-url',safe_uri,'--skip-vault','--dry-run']
  assert '--dry-run' in args and '--skip-vault' in args and '--include-all' not in args
  env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
  env.update(PGPASSWORD=password,SUPABASE_DB_PASSWORD=password)
  native=subprocess.run(args,cwd=work,input=b'',capture_output=True,env=env,timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
  log=scrub((native.stdout+native.stderr).decode('utf8',errors='replace'))
  with (BASE/'sql-editor-native-dry-run-attempt1.log').open('x',encoding='utf8') as out:out.write(log)
  objects=[]
  for line in log.splitlines():
   if line.startswith('{'):
    try:objects.append(json.loads(line))
    except json.JSONDecodeError:continue
  selection=next((item for item in objects if 'migrations' in item and 'dryRun' in item),None)
  result.update(exitCode=native.returncode,selection=selection,nativeBinarySha256=sha(binary.read_bytes()))
  assert native.returncode==0 and selection and selection['dryRun'] is True
  assert selection['migrations']==[pending] and not selection.get('roles') and not selection.get('seeds')
  result['exactSelectionVerified']=True
  inspect('afterDryRun')
  result['passed']=True
 except Exception as exc:
  result.update(passed=False,errorType=type(exc).__name__,sqlState=getattr(exc,'pgcode',None),credentialsPrinted=False)
 finally:
  if conn is not None:conn.rollback();conn.close()
  result['endedAt']=datetime.now(timezone.utc).isoformat()
  with receipt.open('x',encoding='utf8') as out:json.dump(result,out,indent=2);out.write('\n')
 print(json.dumps(result));return result['passed']

if __name__=='__main__':sys.exit(0 if verify() else 1)
