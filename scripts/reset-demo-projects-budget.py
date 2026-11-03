"""User-authorized fresh demo reset; retain accounts and unrelated personal/chat data."""
import argparse,hashlib,json,os,socket
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
parser=argparse.ArgumentParser();parser.add_argument('--backup',required=True);parser.add_argument('--apply',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;target='ixnfphgjyelhckjwjkdv';backup=Path(args.backup).resolve()
assert backup.is_relative_to((Path(os.environ['LOCALAPPDATA'])/'eFlow/deployment-backups').resolve())
manifest=json.loads((backup/'manifest.json').read_text());assert manifest['project_ref']==target
assert (datetime.now(timezone.utc)-datetime.fromisoformat(manifest['created_at'])).total_seconds()<3600
for name,item in manifest['files'].items():assert hashlib.sha256((backup/name).read_bytes()).hexdigest()==item['sha256']
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.'+target
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor()
public_names=set('''projects milestones milestone_organizations office_project_homes tasks subtasks task_activities task_attachments task_comment_attachments task_comments task_organizations task_progress_updates task_reminders task_status_history task_submissions task_template_runs subtask_progress_updates subtask_submissions subtask_submission_attachments work_tree_events hierarchy_deadline_reminders department_accounting_settings department_budget_account_mappings department_budget_adjustments department_budget_lines department_fiscal_budgets budget_commitments budget_ledger_entries office_budget_sections work_budget_allocations work_budget_allocation_lines petty_cash_requests petty_cash_request_lines petty_cash_releases petty_cash_liquidations petty_cash_receipts petty_cash_receipt_items petty_cash_request_attachments general_journal_entries general_journal_lines liquidation_independent_reviews'''.split())
private_schemas={'eflow_budget','eflow_finance_review','eflow_office_cash','eflow_phase6','eflow_phase65','eflow_project','eflow_r7','eflow_r8','eflow_r9','eflow_r11','eflow_evidence'}
c.execute("select n.nspname,c.relname,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and (n.nspname in ('public','auth','private','supabase_migrations') or n.nspname like 'eflow_%') order by 1,2")
all_tables=c.fetchall()
targets=[(s,n,o) for s,n,o in all_tables if (s=='public' and (n in public_names or n.startswith('project_') or n.startswith('proposal_'))) or s in private_schemas or (s=='eflow_r3' and n=='backfill_exceptions')]
target_oids=[o for s,n,o in targets]
partial={'notifications','chat_channels','chat_messages','chat_channel_members','calls','audit_events','user_pds_documents','user_invitations','managed_account_invite_details'}
protected=[(s,n) for s,n,o in all_tables if o not in target_oids and not (s=='public' and n in partial) and (s,n)!=('eflow_activation','dispatches')]
c.execute('select id from public.user_invitations where project_office_id is not null or project_office_identity_id is not null');invitations=[row[0] for row in c.fetchall()]
def fingerprints():
 result={}
 for s,n in protected:
  condition=sql.SQL(" where t.key<>'ai_endpoint_heartbeat'") if s=='public' and n=='system_config' else sql.SQL('')
  c.execute(sql.SQL("select count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {}.{} t{}").format(sql.Identifier(s),sql.Identifier(n),condition));result[s+'.'+n]=c.fetchone()
 return result
def digest(query):c.execute(query);return c.fetchone()
def pds():return digest("select count(*),md5(coalesce(string_agg((to_jsonb(t)-'project_request_id'-'invitation_id')::text,'' order by id),'')) from public.user_pds_documents t")
before=fingerprints();pds_before=pds()
counts={}
for s,n,o in targets:
 c.execute(sql.SQL('select count(*) from {}.{}').format(sql.Identifier(s),sql.Identifier(n)));counts[s+'.'+n]=c.fetchone()[0]
c.execute("select conname,conrelid::regclass::text,confrelid::regclass::text,pg_get_constraintdef(oid) from pg_constraint where contype='f' and confrelid=any(%s::oid[]) and not conrelid=any(%s::oid[])",(target_oids,target_oids));retained=c.fetchall()
assert all(child in ('notifications','chat_channels','user_pds_documents','user_invitations') for name,child,parent,definition in retained),retained
report={'target':target,'backup_verified':True,'before':counts,'protected_tables':len(protected),'applied':False}
folder=root/'docs/demo-reset-2026-10-31';folder.mkdir(exist_ok=True)
try:
 if args.apply:
  # Task-linked chats disappear with their task; unrelated conversations are retained.
  c.execute('delete from public.calls where channel_id in (select id from public.chat_channels where task_id is not null)')
  c.execute('delete from public.chat_channels where task_id is not null')
  c.execute("delete from public.notifications n where task_id is not null or project_id is not null or coalesce(to_jsonb(n)->>'type','') ~ '(petty_cash|cash_|budget|project|task|subtask|liquidation)'")
  c.execute("delete from public.audit_events a where coalesce(to_jsonb(a)->>'entity_type','') ~ '(project|task|subtask|budget|cash|liquidation|journal)' or coalesce(to_jsonb(a)->>'action','') ~ '^(project|task|subtask|budget|petty_cash|cash|liquidation|journal)[._]' ")
  # Preserve PDS contents while clearing references to deleted project invitation requests.
  c.execute('update public.user_pds_documents set project_request_id=null where project_request_id is not null')
  c.execute('update public.user_pds_documents set invitation_id=null where invitation_id=any(%s::uuid[])',(invitations,))
  c.execute('delete from public.managed_account_invite_details where invitation_id=any(%s::uuid[])',(invitations,))
  c.execute('delete from eflow_activation.dispatches where invitation_id=any(%s::uuid[])',(invitations,))
  c.execute('delete from public.user_invitations where id=any(%s::uuid[])',(invitations,))
  for name,child,parent,definition in retained:c.execute(sql.SQL('alter table public.{} drop constraint {}').format(sql.Identifier(child),sql.Identifier(name)))
  c.execute(sql.SQL('truncate table {} restart identity').format(sql.SQL(',').join(sql.Identifier(s,n) for s,n,o in targets)))
  for name,child,parent,definition in retained:c.execute(sql.SQL('alter table public.{} add constraint {} {}').format(sql.Identifier(child),sql.Identifier(name),sql.SQL(definition)))
  assert pds()==pds_before,'PDS contents changed'
  assert fingerprints()==before,'Unrelated/account data changed'
  for s,n,o in targets:
   c.execute(sql.SQL('select count(*) from {}.{}').format(sql.Identifier(s),sql.Identifier(n)));assert c.fetchone()[0]==0,(s,n)
  # Record the existing office's automatic starting balance, not a replenishment.
  c.execute("select id,org_id from public.profiles where is_active and org_id='fdd4dfee-bbc3-42b4-9dcf-a9612c428460' and role='member' order by id limit 1");actor,office=c.fetchone()
  c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(actor),'role':'authenticated'}),));c.execute('set local role authenticated')
  c.execute('select public.office_petty_cash_snapshot(%s)',(office,));snapshot=c.fetchone()[0];assert snapshot['available']==30000 and snapshot['cash']==30000 and snapshot['requests']==[]
  c.execute('reset role');assert fingerprints()==before
  cn.commit();report.update(applied=True,protected_data_unchanged=True,projects=0,tasks=0,office_budgets=0,petty_cash_available=30000,completed_at=datetime.now(timezone.utc).isoformat())
 else:cn.rollback()
 (folder/('RESET_RECEIPT.json' if args.apply else 'RESET_PREFLIGHT.json')).write_text(json.dumps(report,indent=2))
 print(json.dumps({'applied':report['applied'],'tables':len(targets),'old_records':sum(counts.values()),'protected_tables':len(protected),'petty_cash_available':report.get('petty_cash_available')}))
except:cn.rollback();raise
finally:cn.close()
