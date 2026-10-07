"""Verify draft publication using the real Head and authenticated role; roll back all writes."""
import json
from urllib.parse import urlparse, unquote
from dotenv import dotenv_values
import psycopg2

uri = dotenv_values('.env')['EFLOW_DATABASE_URL']
assert unquote(urlparse(uri).username) == 'postgres.ixnfphgjyelhckjwjkdv'
connection = psycopg2.connect(uri, sslmode='require', connect_timeout=15)
try:
    cursor = connection.cursor()
    cursor.execute("select o.id,o.head_user_id from public.organizations o join public.profiles p on p.id=o.head_user_id where p.is_active and p.role='head' limit 1")
    office, head = cursor.fetchone()
    cursor.execute("select id from public.profiles where id<>%s and is_active and role='member' limit 1", (head,))
    member = cursor.fetchone()[0]
    def actor(user):
        cursor.execute("select set_config('request.jwt.claim.sub',%s,true),set_config('request.jwt.claims',%s,true)", (str(user), json.dumps({'sub':str(user),'role':'authenticated'})))
    actor(head)
    cursor.execute('set local role authenticated')
    cursor.execute('select to_jsonb(public.create_project_with_details(%s::jsonb))', (json.dumps({'title':'Publication rollback verification','org_id':str(office),'owner_id':str(head),'status':'active','source_type':'manual'}),))
    project = cursor.fetchone()[0]
    project_id = project['id']
    assert project['publication_state']=='draft' and project['status']=='planning'
    assert project['published_at'] is None and project['published_by'] is None
    def blocked(statement, args):
        cursor.execute('savepoint publication_negative')
        try:
            cursor.execute(statement,args)
        except psycopg2.Error as error:
            assert error.pgcode in ('22023','42501'), error.pgcode
            cursor.execute('rollback to savepoint publication_negative')
        else:
            raise AssertionError('An invalid publication was accepted')
        cursor.execute('release savepoint publication_negative')
    blocked('select public.publish_project(%s)', (project_id,))
    blocked("update public.projects set status='active' where id=%s", (project_id,))
    cursor.execute("update public.projects set description='A real end-to-end rollback check',start_date=current_date,target_date=current_date+7 where id=%s", (project_id,))
    cursor.execute('select id from public.project_groups where project_id=%s limit 1', (project_id,))
    group = cursor.fetchone()[0]
    cursor.execute('select to_jsonb(public.phase3_create_task(%s,%s,%s))', (project_id,group,'Verify delivery'))
    task = cursor.fetchone()[0]
    cursor.execute('select public.assign_task_with_details(%s,%s)', (task['id'],head))
    for kind in ['structure','dates','budget']:
        cursor.execute('select public.phase7_review_project(%s,%s)', (project_id,kind))
    cursor.execute('select public.phase7_project_readiness(%s)', (project_id,))
    readiness = cursor.fetchone()[0]
    assert readiness['canActivate'] and readiness['canPublish'], readiness
    actor(member)
    blocked('select public.publish_project(%s)', (project_id,))
    actor(head)
    cursor.execute('select public.publish_project(%s)', (project_id,))
    cursor.execute('select publication_state,status,published_by,published_at is not null from public.projects where id=%s', (project_id,))
    assert cursor.fetchone()==('published','active',str(head),True)
    cursor.execute('select public.publish_project(%s)', (project_id,))
    cursor.execute("select count(*) from public.audit_events where entity_id=%s and action='project.published'", (project_id,))
    assert cursor.fetchone()[0]==1
    connection.rollback()
    cursor.execute('select count(*) from public.projects where id=%s', (project_id,))
    assert cursor.fetchone()[0]==0
    print(json.dumps({'target':'ixnfphgjyelhckjwjkdv','real_head_publication_passed':True,'member_denied':True,'incomplete_and_direct_activation_denied':True,'zero_budget_allowed':True,'publication_audited_once':True,'all_test_writes_rolled_back':True}))
finally:
    connection.rollback()
    connection.close()
