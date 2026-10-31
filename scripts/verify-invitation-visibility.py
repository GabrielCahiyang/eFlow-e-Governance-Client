"""Rollback-only invitation ACL checks against the installed hosted schema."""
import json, socket, uuid
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL']; parsed=urlparse(uri)
assert parsed.username=='postgres.ixnfphgjyelhckjwjkdv'
conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(parsed.hostname,parsed.port or 5432,socket.AF_INET,socket.SOCK_STREAM)[0][4][0])
c=conn.cursor(); checks=[]
def actor(uid):
 c.execute('reset role');c.execute("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));c.execute('set local role authenticated')
def check(name,test):
 assert test,name;checks.append(name)
def denied(query,params=None):
 c.execute('savepoint denied')
 try:c.execute(query,params)
 except psycopg2.Error as exc:
  code=exc.pgcode;c.execute('rollback to savepoint denied');return code=='42501'
 c.execute('rollback to savepoint denied');return False
try:
 c.execute("select i.id,i.project_id,p.org_id,o.head_user_id from public.project_office_identities i join public.projects p on p.id=i.project_id join public.organizations o on o.id=p.org_id where p.status not in ('archived','completed') and o.head_user_id is not null order by p.created_at desc limit 1")
 identity,project,office,head=c.fetchone()
 c.execute("select id from public.profiles where id<>%s and eflow_r3.eligible(id) order by id limit 2",(head,));others=[r[0] for r in c.fetchall()];assert len(others)==2
 recipient,outsider=others
 c.execute("select to_regprocedure('public.r8_office_people(uuid)')")
 installed=c.fetchone()[0] is not None
 if not installed:
  actor(head);check('original policy reproduces permission denied',denied('select * from public.project_office_people where project_id=%s',(project,)));c.execute('reset role')
  c.execute((root/'supabase/migrations/20261030010856_project_office_invitation_visibility.sql').read_text())
 request=str(uuid.uuid4())
 c.execute("insert into public.project_invitation_requests(id,project_id,office_id,kind,requester,email,engagement,until_close,state,accepted_by) values(%s,%s,%s,'office',%s,'qa-invitation-visibility@example.test','Other',true,'accepted',%s)",(request,project,office,head,recipient))
 c.execute("insert into public.project_office_people(request_id,identity_id,project_id,participation_role) values(%s,%s,%s,'employee')",(request,identity,project))
 actor(head)
 c.execute('select request_id from public.project_office_people where request_id=%s',(request,));check('appointed Head reads office people without private-table grants',bool(c.fetchone()))
 c.execute('select public.r8_office_people(%s)',(project,));rows=c.fetchone()[0];check('Head scoped API returns fixture and inactive membership',any(row['request_id']==request and row['active'] is False for row in rows))
 check('Head cannot directly read private invitations',denied('select * from public.project_invitation_requests'))
 check('Head cannot directly read private guest memberships',denied('select * from public.project_guest_members'))
 actor(recipient)
 c.execute('select public.r8_office_people(%s)',(project,));rows=c.fetchone()[0];check('recipient sees only own invitation',bool(rows) and all(row['invitation']['accepted_by']==str(recipient) for row in rows))
 actor(outsider)
 c.execute('select * from public.project_office_people where request_id=%s',(request,));check('unrelated actor cannot read recipient row',c.fetchone() is None)
 check('unrelated actor denied scoped API',denied('select public.r8_office_people(%s)',(project,)))
 c.execute('reset role');c.execute('set local role anon');check('anonymous denied API',denied('select public.r8_office_people(%s)',(project,)))
 c.execute('reset role');c.execute("select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') from pg_proc p where oid='public.r8_office_people(uuid)'::regprocedure")
 row=c.fetchone();check('public API is invoker with empty path and no anonymous grant',not row[0] and row[1]==['search_path=""'] and row[2] is False)
finally:
 conn.rollback();conn.close()
report={'target':'ixnfphgjyelhckjwjkdv','installed':installed,'rollback_only':True,'checks':checks,'count':len(checks)}
destination=root/'docs/invitation-fix-2026-10-30';destination.mkdir(parents=True,exist_ok=True)
(destination/('HOSTED_VERIFICATION.json' if installed else 'CANDIDATE_VERIFICATION.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
