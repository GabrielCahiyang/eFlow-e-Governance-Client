"""NW11 operational guards. No database connection or environment loading on import."""
import hashlib,json,os,re,subprocess
from datetime import datetime,timezone
from pathlib import Path
TARGET='ixnfphgjyelhckjwjkdv'
ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT/'.refinement/nw11-independent-20261015'
def read_json(file): return json.loads(Path(file).read_text(encoding='utf-8-sig'))
def write_json(file,value):
 file=Path(file);file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf8') as out:json.dump(value,out,indent=2);out.write('\n')
def sha(file):
 digest=hashlib.sha256()
 with Path(file).open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
 return digest.hexdigest()
def contained(file,root):
 file=Path(file).absolute();root=Path(root).resolve()
 for parent in [file,*file.parents]:
  if parent.exists() and (parent.is_symlink() or getattr(parent,'is_junction',lambda:False)()):raise ValueError('Links/junctions are not accepted')
 resolved=file.resolve()
 if resolved==root or not resolved.is_relative_to(root):raise ValueError('Path must be strictly inside the named workspace')
 return resolved
def secure_dir(directory):
 directory=Path(directory);directory.mkdir(parents=True,exist_ok=False)
 if os.name=='nt':
  account=os.environ.get('USERDOMAIN','')+'\\'+os.environ['USERNAME']
  r=subprocess.run(['icacls',str(directory),'/inheritance:r','/grant:r',account+':(OI)(CI)F','SYSTEM:(OI)(CI)F'],capture_output=True,timeout=15,creationflags=subprocess.CREATE_NO_WINDOW)
  if r.returncode:raise RuntimeError('Protected directory ACL setup failed')
 else:directory.chmod(0o700)
 return directory
def run(args,env=None,secrets=(),timeout=45):
 result=subprocess.run([str(x) for x in args],input=b'',capture_output=True,env=env,timeout=timeout,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
 text=(result.stdout+result.stderr).decode('utf8',errors='replace')
 for secret in secrets:
  if secret:text=text.replace(secret,'[REDACTED]')
 text=re.sub(r'postgres(?:ql)?://[^\s]+','[REDACTED_DATABASE_URI]',text)
 if result.returncode:raise RuntimeError('Native command failed ('+str(result.returncode)+'): '+text[:2500])
 return text
def native_tools(directory):
 directory=Path(directory).resolve();suffix='.exe' if os.name=='nt' else ''
 tools={name:directory/(name+suffix) for name in ['postgres','initdb','pg_ctl','psql','pg_dump','pg_dumpall','pg_restore']}
 if not all(p.is_file() for p in tools.values()):raise ValueError('Complete native PostgreSQL tools required')
 version=run([tools['postgres'],'--version'])
 if not re.search(r'\b17\.',version):raise ValueError('PostgreSQL 17 required; no automatic major-version substitution')
 return tools
def local_env(password):
 # Clear inherited PG endpoints, services and options; this tool owns its local connection.
 env={k:v for k,v in os.environ.items() if not k.startswith('PG') and k not in ('EFLOW_DATABASE_URL','EFLOW_NW11_DATABASE_URL','SUPABASE_DB_PASSWORD')}
 return {**env,'PGPASSWORD':password,'PGHOST':'127.0.0.1','PGSSLMODE':'disable','PGCONNECT_TIMEOUT':'5'}
def local_capability(root):
 root=contained(root,EVIDENCE/'recovery');cap=read_json(root/'local-cluster.json')
 if cap.get('host')!='127.0.0.1' or cap.get('kind')!='NW11_OWNED_LOCAL_CLUSTER':raise ValueError('Only an owned local cluster is accepted')
 if not isinstance(cap.get('port'),int) or not 49152<=cap['port']<=65535:raise ValueError('Invalid local port')
 data=contained(cap['data'],root)
 if data!=root/'data':raise ValueError('Unexpected local data directory')
 password=(root/'local-password.private').read_text();tools=native_tools(cap['pgBin']);env=local_env(password)
 args=[tools['psql'],'-X','-A','-t','-h','127.0.0.1','-p',str(cap['port']),'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 actual=run([*args,'-c','show data_directory'],env,secrets=[password]).strip()
 if Path(actual).resolve()!=data.resolve():raise ValueError('Connected server is not the owned recovery cluster')
 version=run([*args,'-c','show server_version_num'],env,secrets=[password]).strip()
 if not version.isdigit() or int(version)//10000!=17:raise ValueError('Connected server major version differs')
 return root,cap,tools,env,args
def approval(file,operation,plan_hash=None):
 value=read_json(file)
 if value.get('target')!=TARGET or value.get('operation')!=operation or value.get('approved') is not True:raise ValueError('Explicit matching operation approval required')
 if plan_hash and value.get('planSha256')!=plan_hash:raise ValueError('Approval is not bound to this plan')
 expires=datetime.fromisoformat(value['expiresAt'].replace('Z','+00:00'))
 if expires<=datetime.now(timezone.utc):raise ValueError('Approval expired')
 if not value.get('operator') or not value.get('authorizationReference'):raise ValueError('Human authorization reference required; a file alone does not grant permission')
 return value
def verify_files(root,manifest):
 root=Path(root).resolve()
 for item in manifest['files']:
  relative=Path(item['path'])
  if relative.is_absolute() or ':' in item['path'] or '\\' in item['path']:raise ValueError('Manifest paths must be relative slash-separated names')
  file=contained(root/relative,root)
  if not file.is_file() or file.stat().st_size!=item['bytes'] or sha(file)!=item['sha256']:raise ValueError('Backup integrity verification failed: '+item['path'])
 return True
