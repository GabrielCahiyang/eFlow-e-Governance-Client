"""Correct Not started tasks that already have work. Never complete/approve work."""
import argparse,hashlib,json,socket
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2 import sql
root=Path(__file__).resolve().parent.parent;parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor()
def q(s,a=None):c.execute(s,a);return c.fetchone()[0] if c.description else None
try:
 q("set local statement_timeout='30s'");q("select set_config('request.jwt.claims','{}',true)")
 assert q("select exists(select 1 from supabase_migrations.schema_migrations where version='20261102192953')")
 c.execute("select schemaname,tablename from pg_tables where schemaname in ('public','eflow_budget') and tablename not in ('tasks','task_status_history','audit_events') order by 1,2");tables=c.fetchall()
 def fingerprint():
  parts=[]
  for schema,table in tables:
   where=sql.SQL(" where t.key <> 'ai_endpoint_heartbeat'") if (schema,table)==('public','system_config') else sql.SQL('')
   parts.append(sql.SQL("select {} as name,count(*)::bigint,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) from {}.{} t{}").format(sql.Literal(schema+'.'+table),sql.Identifier(schema),sql.Identifier(table),where))
  c.execute(sql.SQL(' union all ').join(parts));return c.fetchall()
 protected=fingerprint()
 c.execute("select t.id,to_jsonb(t) from public.tasks t where t.deleted_at is null and t.archived_at is null and t.status='todo' and coalesce((eflow_r7.root(t.id)->>'open')::boolean,false) and exists(select 1 from public.subtasks s where s.task_id=t.id and (s.status<>'todo' or s.is_completed or exists(select 1 from public.subtask_progress_updates u where u.subtask_id=s.id))) order by t.id for update of t")
 rows=c.fetchall();repairs=[]
 for task,before in rows:
  q('select public.refresh_task_subtask_rollup(%s,false)',(task,));after=q('select to_jsonb(t) from public.tasks t where t.id=%s',(task,))
  assert after['status']=='in_progress'
  changed=[key for key in before if before[key]!=after[key]]
  assert set(changed)<=set(['status','updated_at','subtask_count','subtask_completed_count']),changed
  repairs.append({'task_id':str(task),'title':before['title'],'before':'todo','after':'in_progress','changed_fields':changed})
 assert fingerprint()==protected,'A protected record changed; repair rolled back.'
 q('set constraints all immediate')
 receipt={'target':'ixnfphgjyelhckjwjkdv','applied':args.apply,'completed_at':datetime.now(timezone.utc).isoformat(),'repaired_tasks':repairs,'other_tables_checked':len(tables),'other_tables_unchanged':True,'review_and_completion_unchanged':True,'audit_actor':'System (no user impersonation)'}
 if args.apply:cn.commit()
 else:cn.rollback()
 folder=root/'docs/work-status-sync-2026-11-03';folder.mkdir(exist_ok=True)
 (folder/('REPAIR_RECEIPT.json' if args.apply else 'REPAIR_PREFLIGHT.json')).write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt))
finally:cn.rollback();cn.close()
