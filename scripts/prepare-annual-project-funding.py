"""Create the reviewed additive delta from exact live funding definitions."""
import socket
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
root=Path(__file__).resolve().parent.parent;uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor()
baseline=root/'.codex-tmp/project-funding-annual-baseline';baseline.mkdir(exist_ok=True)
parts=['-- Preserve historical quarterly rows and their allocation references. New funding is annual.\nalter table eflow_project.funding alter column quarter drop not null;\ncreate unique index project_annual_funding_source on eflow_project.funding(project_id,partition_id) where quarter is null;']
def replace(s,old,new):
 assert s.count(old)==1,old;return s.replace(old,new)
for name in ['authorize_funding','allocate_task']:
 c.execute("select pg_get_functiondef(oid) from pg_proc where pronamespace='eflow_project'::regnamespace and proname=%s",(name,));rows=c.fetchall();assert len(rows)==1;s=rows[0][0];(baseline/('eflow_project.'+name+'.sql')).write_text(s,encoding='utf-8')
 if name=='authorize_funding':
  s=replace(s,"amount:=(line->>'amount')::numeric;q:=(line->>'quarter')::int;","amount:=(line->>'amount')::numeric;q:=null; -- Quarter on old client payloads is ignored; raw payload retained for idempotency.")
  s=replace(s," or q not between 1 and 4",'')
  s=replace(s,"Enter a positive amount in cents and a quarter from Q1 to Q4","Enter a positive amount in cents")
  s=replace(s,"source_start:=make_date(b.fiscal_year,(q-1)*3+1,1);source_end:=(source_start+interval '3 months'-interval '1 day')::date;","source_start:=make_date(b.fiscal_year,1,1);source_end:=make_date(b.fiscal_year,12,31);")
  s=replace(s,"'FY % Q% does not overlap the project timeline',b.fiscal_year,q","'FY % does not overlap the project timeline',b.fiscal_year")
  s=replace(s,'on conflict(project_id,partition_id,quarter) do update','on conflict(project_id,partition_id) where quarter is null do update')
  s=replace(s,"jsonb_build_object('projectId',p.id,'quarter',q,'partitionId',s.id)","jsonb_build_object('projectId',p.id,'partitionId',s.id)")
 else:
  s=replace(s,'Set the task start and due dates before allocating quarterly funding','Set the task start and due dates before allocating funding')
  s=replace(s,"if t.start_date::date> (make_date(source.fiscal_year,(source.quarter-1)*3+1,1)+interval '3 months'-interval '1 day')::date or t.due_date::date<make_date(source.fiscal_year,(source.quarter-1)*3+1,1) then raise exception 'Selected FY % Q% funding does not overlap this task timeline',source.fiscal_year,source.quarter using errcode='23514';end if;","if t.start_date::date>make_date(source.fiscal_year,12,31) or t.due_date::date<make_date(source.fiscal_year,1,1) then raise exception 'Selected FY % funding does not overlap this task timeline',source.fiscal_year using errcode='23514';end if;")
 parts.append(s+';')
(root/'supabase/migrations/20261031124511_remove_project_funding_quarters.sql').write_text('\n\n'.join(parts),encoding='utf-8');cn.close();print('Prepared annual funding delta from two exact live definitions')
