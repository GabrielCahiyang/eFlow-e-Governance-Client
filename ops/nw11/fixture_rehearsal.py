"""Non-sensitive native PG17 custom-archive rehearsal. No hosted credentials/data or policy changes."""
import argparse,json,secrets,socket,uuid
from datetime import datetime,timezone
from pathlib import Path
from common import TARGET,EVIDENCE,contained,secure_dir,native_tools,local_env,run,write_json,sha
from restore_only import restore
def fixture(pg_bin,run_name):
 if not run_name.replace('-','').isalnum():raise ValueError('Use a simple unique run name')
 root=contained(EVIDENCE/'recovery'/run_name,EVIDENCE/'recovery');root.parent.mkdir(parents=True,exist_ok=True);secure_dir(root)
 receipt={'kind':'NW11_SYNTHETIC_ENVIRONMENT_REHEARSAL','target':TARGET,'startedAt':datetime.now(timezone.utc).isoformat(),'hostedWrites':False,'privateDataRead':False,'windowsSecurityChanged':False,'liveRecoverabilityProven':False,'pgBin':str(Path(pg_bin).resolve()),'steps':[]};started=False;tools=None;env=None
 try:
  tools=native_tools(pg_bin);receipt['steps'].append({'step':'native PostgreSQL 17 version','passed':True})
  password=secrets.token_urlsafe(32);(root/'local-password.private').write_text(password);env=local_env(password)
  run([tools['initdb'],'-D',root/'data','-U','postgres','-A','scram-sha-256','--pwfile',root/'local-password.private','--encoding=UTF8','--locale=C'],env,[password]);receipt['steps'].append({'step':'initdb','passed':True})
  with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
  if not 49152<=port<=65535:raise ValueError('Ephemeral port outside allowed owned-cluster range')
  write_json(root/'local-cluster.json',{'kind':'NW11_OWNED_LOCAL_CLUSTER','host':'127.0.0.1','port':port,'data':str(root/'data'),'pgBin':str(Path(pg_bin).resolve())})
  run([tools['pg_ctl'],'start','-D',root/'data','-l',root/'postgres.private.log','-o',f'-h 127.0.0.1 -p {port}','-w'],env,[password]);started=True
  psql=[tools['psql'],'-X','-A','-t','-h','127.0.0.1','-p',str(port),'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
  run([*psql,'-c','create database nw11_synthetic'],env,[password]);source=[*psql];source[source.index('postgres',source.index('-d'))]='nw11_synthetic'
  sql="""create role nw11_fixture_actor;create schema auth;create schema eflow_fixture;create schema storage;
create table auth.users(id uuid primary key,label text not null);insert into auth.users values('00000000-0000-4000-8000-000000000001','SYNTHETIC ONLY');
create table eflow_fixture.nodes(id integer primary key,parent_id integer references eflow_fixture.nodes(id),lead_id uuid references auth.users(id),depth integer check(depth between 1 and 8));
insert into eflow_fixture.nodes values(1,null,'00000000-0000-4000-8000-000000000001',1),(2,1,'00000000-0000-4000-8000-000000000001',8);
create table eflow_fixture.history(id bigint generated always as identity primary key,event text not null);insert into eflow_fixture.history(event) values('immutable synthetic history');
create function eflow_fixture.no_change() returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;
create trigger append_only before update or delete on eflow_fixture.history for each row execute function eflow_fixture.no_change();
alter table eflow_fixture.nodes enable row level security;create policy own_node on eflow_fixture.nodes for select to nw11_fixture_actor using(lead_id='00000000-0000-4000-8000-000000000001'::uuid);
grant usage on schema eflow_fixture to nw11_fixture_actor;grant select on eflow_fixture.nodes to nw11_fixture_actor;
create table storage.buckets(id text primary key,public boolean not null);insert into storage.buckets values('budget-receipts',false),('pds-documents',false),('profile-avatars',false),('project-library',false),('proposal-drafts',false),('task-attachments',false),('task-comment-attachments',false);
create table eflow_fixture.ledger(version text primary key,checksum text not null);insert into eflow_fixture.ledger values('SYNTHETIC','fixture-only');
"""
  run([*source,'-c',sql],env,[password]);receipt['steps'].append({'step':'synthetic Auth/private/hierarchy/history/RLS/seven-bucket metadata fixture','passed':True})
  backup=root/'synthetic-backup';backup.mkdir();run([tools['pg_dump'],'-h','127.0.0.1','-p',str(port),'-U','postgres','--no-password','--dbname=nw11_synthetic','--format=custom','--file',backup/'database.dump'],env,[password]);run([tools['pg_restore'],'--list',backup/'database.dump'],env,[password]);run([tools['pg_restore'],'--file='+__import__('os').devnull,backup/'database.dump'],env,[password])
  write_json(backup/'manifest.json',{'target':TARGET,'kind':'NW11_SYNTHETIC_BACKUP','files':[{'path':'database.dump','bytes':(backup/'database.dump').stat().st_size,'sha256':sha(backup/'database.dump')}]})
  restored=restore(root,backup,backup/'manifest.json');destination=[*source];destination[destination.index('nw11_synthetic')]=restored['database']
  query="select json_build_object('auth',(select count(*) from auth.users),'nodes',(select count(*) from eflow_fixture.nodes),'history',(select count(*) from eflow_fixture.history),'buckets',(select count(*) from storage.buckets),'rls',(select relrowsecurity from pg_class where oid='eflow_fixture.nodes'::regclass),'policy',(select count(*) from pg_policies where schemaname='eflow_fixture'),'grant',has_table_privilege('nw11_fixture_actor','eflow_fixture.nodes','select'))"
  before=json.loads(run([*source,'-c',query],env,[password]));after=json.loads(run([*destination,'-c',query],env,[password]));assert before==after and after=={'auth':1,'nodes':2,'history':1,'buckets':7,'rls':True,'policy':1,'grant':True}
  try:run([*destination,'-c',"update eflow_fixture.history set event='forbidden'"],env,[password]);raise AssertionError('Immutable-history denial missing')
  except RuntimeError as error:assert 'immutable' in str(error)
  run([*destination,'-c',"set role nw11_fixture_actor; select * from eflow_fixture.nodes;reset role"],env,[password])
  receipt.update(status='passed',restoredDatabase=restored['database'],verified=after,archiveSha256=sha(backup/'database.dump'),storageObjectBytes='Not tested; seven-bucket metadata only',nativeRestorePassed=True)
 except Exception as exc:
  receipt.update(status='blocked',errorType=type(exc).__name__,error=str(exc)[:3000],nativeRestorePassed=False)
 finally:
  if started:
   try:run([tools['pg_ctl'],'stop','-D',root/'data','-m','fast','-w'],env);receipt['ownedClusterStopped']=True
   except Exception as exc:receipt['ownedClusterStopped']=False;receipt['stopErrorType']=type(exc).__name__
  receipt['endedAt']=datetime.now(timezone.utc).isoformat();write_json(root/'rehearsal-receipt.json',receipt)
 return receipt
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--pg-bin',required=True);p.add_argument('--run-name',required=True);a=p.parse_args();result=fixture(a.pg_bin,a.run_name);print(json.dumps(result));raise SystemExit(0 if result['status']=='passed' else 2)
