"""Phase 6 authority checks run in one rollback-only transaction; no email sent."""
import argparse
import hashlib
import json
from pathlib import Path
from uuid import uuid4
from dotenv import dotenv_values
import psycopg2

parser = argparse.ArgumentParser()
parser.add_argument('--project-ref', required=True)
parser.add_argument('--preflight', action='store_true')
parser.add_argument('--migration', help='Additional tracked migration to rehearse without committing')
args = parser.parse_args()
dsn = dotenv_values('.env').get('EFLOW_DATABASE_URL', '')
assert args.project_ref in dsn, 'The local connection must match the explicit project reference.'
conn = psycopg2.connect(dsn, connect_timeout=15)
c = conn.cursor(); checks = []
def q(sql, params=None):
    c.execute(sql, params); return c.fetchone()[0] if c.description else None
def ok(label, value):
    assert value, label
    checks.append(label); print('Passed: ' + label, flush=True)
def denied(label, sql, params=None):
    c.execute('savepoint denied')
    try: c.execute(sql, params)
    except psycopg2.Error:
        c.execute('rollback to savepoint denied'); ok(label, True)
    else: raise AssertionError(label + ' unexpectedly allowed')
    finally: c.execute('release savepoint denied')
def identity(uid=None):
    c.execute('reset role'); q("select set_config('request.jwt.claim.sub',%s,true)", (uid or '',))
    if uid: c.execute('set local role authenticated')
def invite(project, office, email, access='collaborating'):
    identity(); token = hashlib.sha256(str(uuid4()).encode()).hexdigest()
    item = q('select to_jsonb(phase6_create_invitation(%s,%s,%s,%s,%s,%s,168))', (head,project,office,email,access,token))
    return item, token
try:
    if args.migration:
        path=Path(args.migration).resolve()
        assert path.parent==Path('supabase/migrations').resolve(), 'Only a tracked repository migration can be rehearsed.'
        sql=path.read_text(encoding='utf-8');c.execute(sql.replace('begin;\n','',1).removesuffix('commit;\n').removesuffix('commit;'))
    if args.preflight:
        for path in sorted(Path('supabase/migrations').glob('*phase6_*.sql')):
            migration=path.read_text(encoding='utf-8')
            c.execute(migration.replace('begin;\n','',1).removesuffix('commit;\n').removesuffix('commit;'))
    c.execute("select p.id,p.org_id,p.email from profiles p join organizations o on o.head_user_id=p.id where p.role='head' and p.is_active and exists(select 1 from profiles m where m.role='member' and m.is_active and m.org_id=p.org_id) order by p.id limit 2")
    rows = c.fetchall(); assert len(rows)==2, 'Two populated Offices are required.'
    head, office, email = map(str, rows[0]); other, other_office, other_email = map(str, rows[1])
    member = str(q("select id from profiles where role='member' and is_active and org_id=%s limit 1", (office,)))
    other_member = str(q("select id from profiles where role='member' and is_active and org_id=%s limit 1", (other_office,)))
    identity(head)
    project = str(q('select (create_project_with_details(%s::jsonb)).id', (json.dumps({'title':'Phase 6 rollback check','org_id':office}),)))
    group = str(q('select id from project_groups where project_id=%s and is_default', (project,)))
    task = str(q('select (phase3_create_task(%s,%s,%s)).id', (project,group,'Partner assessment')))
    ok('Project receives its Lead Office atomically', q("select count(*)=1 from project_offices where project_id=%s and relationship_type='lead'", (project,)))
    item, token = invite(project,other_office,other_email)
    ok('Project invitation reuses the token table and Lead dispatch scope', item['invitation_type']=='project_office' and item['office_id']==office)
    denied('Lead cannot select another Office personnel', 'select phase6_set_members(%s,%s::uuid[])', (item['project_office_id'],[other_member]))
    identity()
    result = q('select to_jsonb(phase2_accept_invitation(%s,%s,%s,null))', (token,other,''))
    ok('Existing Head accepts through Phase 2 without changing global identity', result['role']=='head' and result['org_id']==other_office)
    ok('Appointed Head joins without a second confirmation', q("select invitation_status='joined' from project_offices where id=%s", (item['project_office_id'],)))
    ok('Acceptance retry is idempotent', q('select (phase2_accept_invitation(%s,%s,%s,null)).id', (token,other,''))==rows[1][0])
    identity(other)
    ok('Collaborating Head sees only the invited project', q('select can_see_project(%s,%s)', (project,other)))
    q('select phase6_set_members(%s,%s::uuid[])', (item['project_office_id'],[other_member]))
    denied('Collaborator cannot select Lead employees', 'select phase6_set_members(%s,%s::uuid[])', (item['project_office_id'],[member]))
    identity(head); q('select phase6_responsible_office(%s,%s)', (task,other_office))
    ok('Canonical responsible Office follows handover', q('select org_id=%s from tasks where id=%s', (other_office,task)))
    denied('Lead cannot assign a collaborating employee', 'select assign_task(%s,%s,%s)', (task,other_member,'Member'))
    denied('Lead cannot masquerade as another Office in task creation', 'select create_task_with_details(%s::jsonb)', (json.dumps({'title':'Cross Office','org_id':other_office,'linked_project_id':project}),))
    identity(other)
    q('select phase3_patch_task(%s,%s::jsonb)', (task,json.dumps({'estimated_hours':12,'deadline':'2026-10-31'})))
    ok('Collaborating Head edits its own work through Phase 3', q('select estimated_hours=12 from tasks where id=%s', (task,)))
    q('select assign_task(%s,%s,%s)', (task,other_member,'Member'))
    ok('Head review follows the responsible Office after assignment', q('select reviewer_id=%s from tasks where id=%s', (other,task)))
    ok('Responsible Head assigns its selected own member', q('select assigned_to=%s from tasks where id=%s', (other_member,task)))
    denied('Active project member removal requires reassignment', 'select phase6_set_members(%s,%s::uuid[])', (item['project_office_id'],[]))
    denied('Collaborating Head cannot assign a Lead employee', 'select assign_task(%s,%s,%s)', (task,member,'Member'))
    identity(head)
    denied('Staffed task cannot be handed to another Office', 'select phase6_responsible_office(%s,%s)', (task,office))
    identity(other_member)
    ok('Selected member can access and contribute to its assigned work', q('select can_see_project(%s,%s) and can_contribute_task(%s,%s)', (project,other_member,task,other_member)))
    denied('Member cannot select Office personnel', 'select phase6_set_members(%s,%s::uuid[])', (item['project_office_id'],[other_member]))
    identity()
    observer_office = str(q('select id from organizations where id not in (%s,%s) limit 1', (office,other_office)))
    observer_id=str(uuid4()); observer_email='phase6-'+observer_id+'@example.invalid'
    q('insert into auth.users(id,email,email_confirmed_at) values(%s,%s,now())', (observer_id,observer_email))
    observer, token2=invite(project,observer_office,observer_email,'observer')
    new_profile=q('select to_jsonb(phase2_accept_invitation(%s,%s,%s,null))',(token2,observer_id,'Phase 6 Observer'))
    ok('New project contact receives no global Office membership or Head role', new_profile['org_id'] is None and new_profile['role']=='member')
    identity(observer_id)
    ok('Observer reads project context without task authority', q('select can_see_project(%s,%s) and not coalesce(can_manage_task(%s,%s),false) and not coalesce(can_contribute_task(%s,%s),false)', (project,observer_id,task,observer_id,task,observer_id)))
    denied('Observer cannot insert participation rows', "insert into project_offices(project_id,office_id,relationship_type) values(%s,%s,'lead')", (project,office))
    denied('Observer cannot edit task planning', 'select phase3_patch_task(%s,%s::jsonb)', (task,json.dumps({'title':'Observer changed title'})))
    identity(head)
    unrelated=str(q('select (create_project_with_details(%s::jsonb)).id',(json.dumps({'title':'Unrelated project','org_id':office}),)))
    identity(other)
    ok('Participation grants no access to another project', not q('select can_see_project(%s,%s)',(unrelated,other)))
    identity(head)
    extra_group=str(q("insert into project_groups(project_id,title) values(%s,'Partner delivery') returning id",(project,)))
    q('select phase6_move_task(%s,%s,0)',(task,extra_group))
    ok('Lead organizes a partner task without changing its staff',q('select group_id=%s and assigned_to=%s and org_id=%s from tasks where id=%s',(extra_group,other_member,other_office,task)))
    identity(other)
    denied('Collaborator cannot move work out of the shared project', 'update tasks set linked_project_id=%s where id=%s',(unrelated,task))
    denied('Collaborator cannot use the Lead group management RPC','select phase6_move_task(%s,%s,0)',(task,group))
    identity()
    member_email=q('select email from profiles where id=%s',(other_member,))
    contact,contact_token=invite(unrelated,other_office,member_email)
    contact_profile=q('select to_jsonb(phase2_accept_invitation(%s,%s,%s,null))',(contact_token,other_member,''))
    ok('Ordinary contact acceptance preserves the account role and awaits its Head', contact_profile['role']=='member' and q("select invitation_status='awaiting_head' from project_offices where id=%s",(contact['project_office_id'],)))
    identity(other_member)
    denied('Contact cannot confirm itself as Office Head','select phase6_confirm_office(%s)',(contact['project_office_id'],))
    identity(other);q('select phase6_confirm_office(%s)',(contact['project_office_id'],))
    ok('Target Office Head confirms contact-led participation',q("select invitation_status='joined' from project_offices where id=%s",(contact['project_office_id'],)))
    revokable,revoke_token=invite(unrelated,observer_office,observer_email,'observer')
    q("select phase2_manage_invitation(%s,%s,'revoke',null,168)",(head,revokable['id']))
    ok('Phase 2 revocation updates project participation',q("select invitation_status='revoked' from project_offices where id=%s",(revokable['project_office_id'],)))
    denied('Revoked project token cannot be accepted','select phase2_accept_invitation(%s,%s,%s,null)',(revoke_token,observer_id,''))
    identity()
    ok('New tables enforce RLS and service-only invite/accept RPCs', q("select (select bool_and(relrowsecurity) from pg_class where oid in ('public.project_offices'::regclass,'public.project_office_members'::regclass)) and not has_function_privilege('authenticated','public.phase6_create_invitation(uuid,uuid,uuid,text,text,text,integer)','execute') and not has_function_privilege('anon','public.phase6_accept_invitation(text,uuid,text,uuid)','execute')"))
    print(f'{len(checks)} Phase 6 checks passed; all records rolled back.',flush=True)
finally:
    conn.rollback(); conn.close()
