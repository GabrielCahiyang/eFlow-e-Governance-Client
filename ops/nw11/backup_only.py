"""Prepare a backup plan; future private export requires separately approved scope. Never applies SQL."""
import argparse,json,os,ssl,secrets
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse,unquote
from common import TARGET,EVIDENCE,read_json,write_json,sha,approval,native_tools,secure_dir,run,contained
BUCKETS=['budget-receipts','pds-documents','profile-avatars','project-library','proposal-drafts','task-attachments','task-comment-attachments']
def plan(metadata,output):
 source=read_json(metadata)
 if source.get('target')!=TARGET:raise ValueError('Backup metadata target mismatch')
 live=source['metadata']
 value={'target':TARGET,'kind':'NW11_FULL_PRIVATE_BACKUP_PLAN','preparedAt':datetime.now(timezone.utc).isoformat(),'operation':'export-private-database','installedLedger':[{'version':m['version'],'name':m['name']} for m in live['migrations']],'scope':{'database':'entire database, including Auth, Storage metadata and all public/private schemas','roles':'password-free definitions; memberships separately recorded','storageBuckets':BUCKETS,'storageBytes':'Separate explicit Storage payload authorization and copy/verification procedure; not part of pg_dump','providerConfiguration':'Separate approved Auth/provider/secrets/project configuration inventory'},'security':{'destination':'Protected eFlow/deployment-backups outside Git','acl':'Current operator and SYSTEM only','encryption':'Verified encrypted destination plus AES-256 archive; key via separate password manager/env','retentionDays':7,'offsite':'Operator-approved encrypted copy; do not upload automatically','plaintextWorkingFiles':'Retained only inside protected encrypted destination; cleanup requires operator retention procedure'},'executionApproved':False,'requiredApprovals':['target/ledger/hash-bound private DB/Auth/private-schema export','protected destination and encryption evidence','separate Storage bytes and provider configuration scope'],'freshness':'Under one hour and no intervening data change immediately before separately authorized apply'}
 write_json(output,value);return value
def export(plan_file,approval_file,pg_bin,destination,ca_file):
 p=read_json(plan_file);a=approval(approval_file,'export-private-database',sha(plan_file));assert p['target']==TARGET and p['kind']=='NW11_FULL_PRIVATE_BACKUP_PLAN'
 if not a.get('destinationEncryptionVerified') or not a.get('encryptionEvidence'):raise ValueError('Verified encrypted destination evidence required')
 approved_root=(Path(os.environ.get('LOCALAPPDATA',Path.home()))/'eFlow/deployment-backups').resolve();destination=contained(destination,approved_root)
 if str(destination)!=a.get('destination'):raise ValueError('Destination differs from explicit approval')
 uri=os.environ.get('EFLOW_NW11_DATABASE_URL','');u=urlparse(uri);password=unquote(u.password or '');username=unquote(u.username or '')
 if not password or u.path!='/postgres' or u.scheme not in ('postgres','postgresql') or (u.port or 5432)!=5432:raise ValueError('Explicit session/direct database credential on 5432 required; none auto-loaded')
 if not ((username=='postgres.'+TARGET and (u.hostname or '').endswith('.pooler.supabase.com')) or (username=='postgres' and u.hostname=='db.'+TARGET+'.supabase.co')):raise ValueError('Configured credential target mismatch')
 key=os.environ.get('EFLOW_NW11_BACKUP_KEY','')
 if len(key)<24:raise ValueError('Separate strong archive encryption key required')
 tools=native_tools(pg_bin);ca=Path(ca_file).resolve()
 if not ca.is_file():raise ValueError('TLS root certificate bundle required')
 import pg8000.dbapi
 import pyzipper
 context=ssl.create_default_context(cafile=str(ca));connection=pg8000.dbapi.connect(host=u.hostname,port=u.port or 5432,user=username,password=password,database='postgres',ssl_context=context,timeout=20)
 directory=None
 try:
  cur=connection.cursor();cur.execute('set transaction isolation level serializable read only deferrable');cur.execute('select version,name from supabase_migrations.schema_migrations order by version');ledger=[{'version':r[0],'name':r[1]} for r in cur.fetchall()]
  if ledger!=p['installedLedger']:raise ValueError('Live ledger differs from approved backup plan')
  cur.execute('show server_version_num')
  if int(cur.fetchone()[0])//10000!=17:raise ValueError('Target server is not approved PG17')
  cur.execute('select pg_export_snapshot()');snapshot=cur.fetchone()[0]
  cur.execute('select rolname from pg_roles order by rolname');roles=[r[0] for r in cur.fetchall()]
  cur.execute('select r.rolname,m.rolname,a.admin_option,a.inherit_option,a.set_option,g.rolname from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by 1,2');memberships=[list(r) for r in cur.fetchall()]
  directory=secure_dir(destination)
  env={k:v for k,v in os.environ.items() if not k.startswith('PG')};env.update(PGPASSWORD=password,PGSSLMODE='verify-full',PGSSLROOTCERT=str(ca),PGCONNECT_TIMEOUT='15')
  args=['-h',u.hostname,'-p',str(u.port or 5432),'-U',username,'--no-password']
  run([tools['pg_dump'],*args,'--dbname=postgres','--format=custom','--snapshot='+snapshot,'--file',directory/'database.dump'],env,[password,uri,key],timeout=1800)
  run([tools['pg_dumpall'],*args,'--roles-only','--no-role-passwords','--file',directory/'roles.sql'],env,[password,uri,key],timeout=180)
  toc=run([tools['pg_restore'],'--list',directory/'database.dump'],secrets=[password,uri,key]);(directory/'archive-list.private').write_text(toc,encoding='utf8')
  run([tools['pg_restore'],'--file='+os.devnull,directory/'database.dump'],secrets=[password,uri,key],timeout=1800)
  write_json(directory/'scope.private.json',{'target':TARGET,'ledger':ledger,'roles':roles,'memberships':memberships,'fullDatabase':True,'storageBytes':False,'schemaGrantsPreservedInArchive':True,'providerConfigurationBackedUp':False})
  files=[{'path':f,'bytes':(directory/f).stat().st_size,'sha256':sha(directory/f)} for f in ['database.dump','roles.sql','archive-list.private','scope.private.json']]
  manifest={'kind':'NW11_APPROVED_PRIVATE_DATABASE_BACKUP','target':TARGET,'capturedAt':datetime.now(timezone.utc).isoformat(),'planSha256':sha(plan_file),'authorizationReference':a['authorizationReference'],'files':files,'storageBytes':False,'providerConfiguration':False,'restoreVerified':False}
  write_json(directory/'manifest.json',manifest)
  with pyzipper.AESZipFile(directory/'database-package.aes.zip','x',compression=pyzipper.ZIP_DEFLATED,encryption=pyzipper.WZ_AES) as archive:
   archive.setpassword(key.encode());archive.setencryption(pyzipper.WZ_AES,nbits=256)
   for file in [*files,{'path':'manifest.json'}]:archive.write(directory/file['path'],file['path'])
  with pyzipper.AESZipFile(directory/'database-package.aes.zip','r') as archive:
   archive.setpassword(key.encode())
   import hashlib
   for file in files:
    digest=hashlib.sha256()
    with archive.open(file['path']) as stream:
     for chunk in iter(lambda:stream.read(1024*1024),b''):digest.update(chunk)
    if digest.hexdigest()!=file['sha256']:raise ValueError('Encrypted archive verification failed')
  write_json(directory/'encrypted-package-receipt.json',{'sha256':sha(directory/'database-package.aes.zip'),'bytes':(directory/'database-package.aes.zip').stat().st_size,'encryption':'AES-256; key not recorded','plaintextWorkingFiles':'Remain in the separately approved encrypted restricted directory','storageBytes':False,'restored':False})
  return {'backupCreated':True,'target':TARGET,'manifestSha256':sha(directory/'manifest.json'),'storageBytes':False,'restored':False}
 finally:connection.rollback();connection.close()
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['plan','export']);parser.add_argument('--metadata');parser.add_argument('--output');parser.add_argument('--plan');parser.add_argument('--approval');parser.add_argument('--pg-bin');parser.add_argument('--destination');parser.add_argument('--ca');args=parser.parse_args()
 if args.mode=='plan':p=plan(args.metadata,args.output);print(json.dumps({'target':p['target'],'executionApproved':False,'storageBytes':False}))
 else:
  try:print(json.dumps(export(args.plan,args.approval,args.pg_bin,args.destination,args.ca)))
  except Exception as exc:print(json.dumps({'status':'failed closed','errorType':type(exc).__name__,'privateExportCompleted':False}));raise SystemExit(2)
