"""Explicitly authorized workflow reset. Preserve accounts, credentials, skills and configuration."""
import argparse,json,socket,os,hashlib
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
args=argparse.ArgumentParser();args.add_argument('--backup',required=True);args.add_argument('--apply',action='store_true');a=args.parse_args()
root=Path(__file__).resolve().parent.parent;target='ixnfphgjyelhckjwjkdv';backup=Path(a.backup).resolve()
assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text());assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for name,record in manifest['files'].items():assert hashlib.sha256((backup/name).read_bytes()).hexdigest()==record['sha256']
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];p=urlparse(uri);assert p.username=='postgres.'+target
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(p.hostname,p.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor()
keep={'accounting_accounts','app_config','system_config','profiles','organizations','organization_memberships','role_permissions','user_permission_overrides','user_org_scope_grants','user_preferences','user_professional_profiles','user_pds_documents','user_onboarding','workspaces','workspace_members','task_templates','subtask_templates','subtask_template_items'}
c.execute("select n.nspname,c.relname,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and (n.nspname='public' or n.nspname like 'eflow_%') order by 1,2")
all_tables=c.fetchall();targets=[(schema,name,oid) for schema,name,oid in all_tables if not (schema=='public' and (name in keep or 'backup' in name or name in ('phase1_authority_row_backup','phase2_rollback_archive','server_logs')))];target_oids=[row[2] for row in targets]
c.execute("select conrelid::regclass::text,confrelid::regclass::text from pg_constraint where contype='f' and confrelid=any(%s::oid[]) and not conrelid=any(%s::oid[])",(target_oids,target_oids));unexpected=c.fetchall();assert all(parent=='user_pds_documents' and child in ('user_invitations','project_invitation_requests') for parent,child in unexpected),('Unexpected retained references',unexpected)
protected=[('public',name) for name in keep]+[('auth','users'),('auth','identities'),('auth','sessions'),('auth','refresh_tokens'),('private','eflow_login_accounts'),('private','eflow_login_settings')]
def fingerprints():
 result={}
 for schema,name in protected:
  c.execute(sql.SQL("select count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {}.{} t").format(sql.Identifier(schema),sql.Identifier(name)));result[schema+'.'+name]=c.fetchone()
 return result
def pds_canonical():
 c.execute("select count(*),md5(coalesce(string_agg(md5((to_jsonb(d)-'invitation_id'-'project_request_id')::text),'' order by md5((to_jsonb(d)-'invitation_id'-'project_request_id')::text)),'')) from public.user_pds_documents d");return c.fetchone()
pds_before=pds_canonical()
c.execute("select conname,pg_get_constraintdef(oid) from pg_constraint where conrelid='public.user_pds_documents'::regclass and contype='f' and confrelid in ('public.user_invitations'::regclass,'public.project_invitation_requests'::regclass)");pds_constraints=c.fetchall()
protected=[table for table in protected if table!=('public','user_pds_documents')]
before=fingerprints();counts={}
for schema,name,oid in targets:c.execute(sql.SQL('select count(*) from {}.{}').format(sql.Identifier(schema),sql.Identifier(name)));counts[schema+'.'+name]=c.fetchone()[0]
report={'target':target,'backup':str(backup),'workflow_tables':counts,'protected_tables':list(before),'applied':False}
folder=root/'docs/project-flow-redesign-2026-10-30';folder.mkdir(exist_ok=True)
if a.apply:
 for name,definition in pds_constraints:c.execute(sql.SQL('alter table public.user_pds_documents drop constraint {}').format(sql.Identifier(name)))
 c.execute("update public.user_pds_documents set invitation_id=null,project_request_id=null where invitation_id is not null or project_request_id is not null")
 c.execute(sql.SQL('truncate table {} restart identity').format(sql.SQL(',').join(sql.Identifier(schema,name) for schema,name,oid in targets)))
 for name,definition in pds_constraints:c.execute(sql.SQL('alter table public.user_pds_documents add constraint {} {}').format(sql.Identifier(name),sql.SQL(definition)))
 assert pds_canonical()==pds_before,'Personal document contents changed'
 after=fingerprints();assert after==before,'Protected account/configuration data changed'
 for schema,name,oid in targets:
  if name=='user_pds_documents':continue
  c.execute(sql.SQL('select count(*) from {}.{}').format(sql.Identifier(schema),sql.Identifier(name)));assert c.fetchone()[0]==0
 cn.commit();report.update(applied=True,protected_data_unchanged=True,completed_at=datetime.now(timezone.utc).isoformat())
else:cn.rollback()
(folder/('RESET_RECEIPT.json' if a.apply else 'RESET_PREFLIGHT.json')).write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'applied':report['applied'],'workflow_tables':len(counts),'records':sum(counts.values()),'protected_tables':len(before)}));cn.close()
