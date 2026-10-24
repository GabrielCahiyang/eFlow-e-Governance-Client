"""Independent PostgreSQL sessions, localhost disposable data only. No .env."""
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import psycopg2
from psycopg2.extras import Json

root = Path(__file__).resolve().parent.parent
pgbin = Path(os.environ.get('EFLOW_TEST_PG_BIN', 'C:/Program Files/PostgreSQL/17/bin'))
scratch = Path(tempfile.mkdtemp(prefix='eflow-leadership-pg-')).resolve()
assert scratch.parent == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith('eflow-leadership-pg-')
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0)); port = probe.getsockname()[1]
started = False
checks = 0
def run(name, args):
    handles = {'stdout':subprocess.DEVNULL,'stderr':subprocess.DEVNULL} if name == 'pg_ctl' else {'capture_output':True}
    result = subprocess.run([str(pgbin/(name+'.exe' if os.name == 'nt' else name)), *args], text=True, timeout=90, creationflags=flags, **handles)
    if result.returncode: raise RuntimeError(name+' failed; inspect disposable PostgreSQL log')
def connect():
    connection = psycopg2.connect(host='127.0.0.1',port=port,user='postgres',dbname='postgres')
    connection.autocommit = True
    return connection
def sql(connection, statement, args=None):
    with connection.cursor() as cursor:
        cursor.execute(statement,args)
        return cursor.fetchone()[0] if cursor.description else None
def uid(number): return '00000000-0000-4000-8000-'+str(number).zfill(12)
def actor(connection, number):
    sql(connection,'reset role');sql(connection,"select set_config('request.jwt.claim.sub',%s,false)",(uid(number),));sql(connection,'set role authenticated')
def equal(actual, expected, label):
    global checks
    assert actual == expected, label+': '+repr((actual,expected));checks += 1
def appoint(connection, number):
    return sql(connection,'select set_organization_leadership(%s,%s,null)',(uid(100),uid(number) if number else None))
def denial(connection, operation, code):
    global checks
    try: operation()
    except psycopg2.Error as error: equal(error.pgcode,code,'Expected denial');return
    raise AssertionError('Expected authorization denial')
try:
    run('initdb',['-D',str(scratch/'data'),'-U','postgres','--auth-local=trust','--auth-host=trust','--encoding=UTF8','--no-locale'])
    run('pg_ctl',['-D',str(scratch/'data'),'-l',str(scratch/'postgres.log'),'-o',f'-h 127.0.0.1 -p {port}','-w','start']);started=True
    c=connect()
    baseline=subprocess.run(['node','scripts/verify-leadership-reroute.mjs','--baseline-sql'],cwd=root,capture_output=True,text=True,timeout=120,creationflags=flags)
    assert baseline.returncode == 0, 'Cannot construct disposable source baseline'
    sql(c,baseline.stdout)
    sql(c,"insert into organizations(id,name,slug,path,org_type) values(%s,'QA leadership','qa-leadership','qa_leadership','department')",(uid(100),))
    for number in (1,2,5,6):
        sql(c,'insert into auth.users(id,email,email_confirmed_at) values(%s,%s,now())',(uid(number),f'qa{number}@example.test'))
        sql(c,'insert into profiles(id,email,full_name,employee_id,role,is_active,org_id) values(%s,%s,%s,%s,%s,true,%s)',
            (uid(number),f'qa{number}@example.test',f'QA {number}',f'qa{number}','admin' if number==1 else 'member',None if number==1 else uid(100)))
    actor(c,1);appoint(c,2)
    actor(c,2)
    project=sql(c,'select (create_project_with_details(%s::jsonb)).id',(Json({'title':'QA default review routing','org_id':uid(100)}),))
    group=sql(c,'select id from project_groups where project_id=%s and is_default',(project,))
    participation=sql(c,"select id from project_offices where project_id=%s and relationship_type='lead'",(project,))
    expected=sql(c,"select coalesce(array_agg(user_id order by user_id),'{}'::uuid[]) from project_office_members where project_office_id=%s",(participation,))
    sql(c,'select r7_select_office_members(%s,%s::uuid[],%s::uuid[],%s)',(participation,expected,[uid(5),uid(6)],uid(250)))
    task=sql(c,"select (phase3_create_task(%s,%s,'QA native routing')).id",(project,group))
    sql(c,"select assign_task(%s,%s,'QA Lead')",(task,uid(5)))
    actor(c,1);denial(c,lambda:appoint(c,6),'42501')
    sql(c,'reset role');equal(sql(c,'select head_user_id from organizations where id=%s',(uid(100),)),uid(2),'Original failure is atomic')
    sql(c,(root/'supabase/migrations/20261024002339_leadership_default_review_reroute.sql').read_text(encoding='utf-8'))
    actor(c,1);appoint(c,6)
    sql(c,'reset role');equal(sql(c,'select reviewer_id from tasks where id=%s',(task,)),uid(6),'Native derived reviewer follows Head')
    equal(sql(c,'select count(*) from eflow_leadership.reroutes'),0,'Capability consumed')
    actor(c,1)
    # Owner execution retains auth.uid(), proving no definer RPC can turn the
    # capability into general Admin task editing; direct table access also has RLS.
    sql(c,'reset role');denial(c,lambda:sql(c,"update tasks set title='Forbidden' where id=%s",(task,)),'42501')
    actor(c,5);denial(c,lambda:appoint(c,2),'42501')
    actor(c,1);denial(c,lambda:sql(c,'insert into eflow_leadership.reroutes(tx,actor,task_id) values(txid_current(),auth.uid(),%s)',(task,)),'42501')
    # Existing office leadership advisory lock must serialize independent sessions.
    first=connect();actor(first,1);sql(first,'begin');appoint(first,2)
    def second_assignment():
        second=connect()
        try: actor(second,1);appoint(second,6)
        finally: second.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        pending=pool.submit(second_assignment);time.sleep(.2)
        equal(pending.done(),False,'Second leadership transaction waits')
        sql(first,'commit');pending.result(timeout=20)
    first.close();sql(c,'reset role')
    equal(sql(c,'select head_user_id from organizations where id=%s',(uid(100),)),uid(6),'Serialized final Head')
    equal(sql(c,'select reviewer_id from tasks where id=%s',(task,)),uid(6),'Serialized final reviewer')
    equal(sql(c,'select role from profiles where id=%s',(uid(2),)),'member','Previous Head demoted atomically')
    equal(sql(c,'select role from profiles where id=%s',(uid(6),)),'head','New Head role retained')
    equal(sql(c,'select count(*) from eflow_leadership.reroutes'),0,'No capabilities after concurrent commits')
    sql(c,'set session_replication_role=replica');sql(c,"update tasks set status='for_review' where id=%s",(task,));sql(c,'set session_replication_role=origin')
    actor(c,1);denial(c,lambda:appoint(c,None),'22023')
    sql(c,'reset role');equal(sql(c,'select head_user_id from organizations where id=%s',(uid(100),)),uid(6),'Failed clearing keeps current Head')
    equal(sql(c,'select reviewer_id from tasks where id=%s',(task,)),uid(6),'Failed clearing keeps review route')
    c.close()
    print(json.dumps({'passed':True,'checks':checks,'nativePostgres':True,'independentSessions':True,'hostedWrites':False}))
finally:
    if started: run('pg_ctl',['-D',str(scratch/'data'),'-m','immediate','-w','stop'])
    assert scratch.parent == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith('eflow-leadership-pg-')
    shutil.rmtree(scratch)
