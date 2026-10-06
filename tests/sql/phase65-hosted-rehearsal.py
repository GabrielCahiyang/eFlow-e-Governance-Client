"""Explicit non-production target; migration/workflow tests always roll back.

Requires python-dotenv and psycopg2-binary in an isolated tooling environment.
Uses only EFLOW_REHEARSAL_DATABASE_URL; never falls back to the main connection.
"""
import argparse
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlparse
from uuid import uuid4

from dotenv import dotenv_values
import psycopg2

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--project-ref', required=True)
args = parser.parse_args()
config = dotenv_values(root / '.env')
dsn = config.get('EFLOW_REHEARSAL_DATABASE_URL', '')
target = urlparse(dsn)
assert dsn and dsn != config.get('EFLOW_DATABASE_URL'), 'Use a separate rehearsal connection'
assert args.project_ref != 'ixnfphgjyelhckjwjkdv', 'The main Eflow project is forbidden'
assert unquote(target.username or '') == 'postgres.' + args.project_ref or target.hostname == 'db.' + args.project_ref + '.supabase.co', 'Explicit rehearsal target mismatch'

connection = None
checks = 0


def q(query, values=None):
    cursor.execute(query, values)
    return cursor.fetchone()[0] if cursor.description else None


def check(value, label):
    global checks
    assert value, label
    checks += 1
    print('Passed: ' + label, flush=True)


def denied(query, values, label):
    cursor.execute('savepoint denied_operation')
    try:
        cursor.execute(query, values)
    except psycopg2.Error as error:
        cursor.execute('rollback to savepoint denied_operation')
        # A missing function/table or syntax error is not authorization proof.
        assert error.pgcode in ('42501', '22023', 'P0001', '23514', '23503'), label + ': unexpected failure category'
        check(True, label)
    else:
        raise AssertionError(label + ': unexpectedly allowed')
    finally:
        cursor.execute('release savepoint denied_operation')


def identity(user=None):
    cursor.execute('reset role')
    q("select set_config('request.jwt.claim.sub',%s,true)", (user or '',))
    q("select set_config('request.jwt.claim.role',%s,true)", ('authenticated' if user else 'service_role',))
    if user:
        cursor.execute('set local role authenticated')


try:
    connection = psycopg2.connect(dsn, sslmode='require', connect_timeout=15)
    cursor = connection.cursor()
    q("set local statement_timeout='60s'")
    q("set local lock_timeout='3s'")
    versions = set(q("select array_agg(version) from supabase_migrations.schema_migrations") or [])
    required = {'20261003000004', '20261004123126', '20261004132527', '20261004133412'}
    assert required.issubset(versions), 'Rehearsal must already have the verified Phase 1/2 baseline'
    assert q("select to_regclass('public.project_office_identities')") is None, 'Use an unmigrated rehearsal target'
    before = q("select md5(coalesce(jsonb_agg(jsonb_build_array(id,org_id,assigned_to,status) order by id)::text,'[]')) from tasks")
    # Rehearsal was restored before Phase 3. Missing compatible predecessors are
    # tested in the same transaction, never permanently applied or ledgered.
    migrations = [
        '20261004140128_phase3_project_table_workspace.sql',
        '20261004164937_phase5_workspace_ai_import.sql',
        '20261004174950_phase6_project_office_collaboration.sql',
        '20261004182453_phase6_shared_structure_guards.sql',
        '20261004194130_phase7_readiness_governance.sql',
        '20261005170822_phase65_project_local_office_identity.sql',
    ]
    for name in migrations:
        if name.split('_')[0] in versions:
            continue
        source = (root / 'supabase/migrations' / name).read_text(encoding='utf-8')
        source = re.sub(r'(?im)^\s*begin;\s*$', '', source, count=1)
        source = re.sub(r'(?im)^\s*commit;\s*\Z', '', source)
        assert not re.search(r'(?im)^\s*(begin|commit);\s*$', source), 'Unexpected transaction boundary'
        cursor.execute(source)
    check(before == q("select md5(coalesce(jsonb_agg(jsonb_build_array(id,org_id,assigned_to,status) order by id)::text,'[]')) from tasks"), 'Backfill preserves existing task ownership and execution state')
    cursor.execute("select p.id,p.org_id from profiles p join organizations o on o.head_user_id=p.id where p.role='head' and p.is_active and o.is_active and exists(select 1 from profiles m where m.org_id=p.org_id and m.role='member' and m.is_active) order by p.id limit 2")
    heads = cursor.fetchall()
    assert len(heads) == 2, 'Two eligible rehearsal Offices required'
    head, office = map(str, heads[0]); other_head, partner = map(str, heads[1])
    cursor.execute("select p.id,u.email,p.role,p.org_id from profiles p join auth.users u on u.id=p.id where p.org_id=%s and p.role='member' and p.is_active and u.email_confirmed_at is not null limit 1", (partner,))
    row = cursor.fetchone(); assert row, 'Verified rehearsal contact required'
    contact, email, role, original_office = str(row[0]), row[1], row[2], str(row[3])
    member = str(q("select id from profiles where org_id=%s and role='member' and is_active limit 1", (office,)))
    admin = str(q("select id from profiles where role='admin' and is_active limit 1"))
    identity(head)
    project = str(q('select (create_project_with_details(%s::jsonb)).id', (json.dumps({'title': 'Phase 6.5 rollback-only rehearsal', 'org_id': office}),)))
    group = str(q('select id from project_groups where project_id=%s and is_default', (project,)))
    task = str(q("select (phase3_create_task(%s,%s,'Unresolved responsibility')).id", (project, group)))
    local_id = str(uuid4())
    local = q('select to_jsonb(phase65_save_office_identity(%s,%s,%s))', (project, local_id, 'Source Office absent from directory'))
    check(local['canonical_office_id'] is None, 'Retain absent-directory name without authority')
    check(str(q('select (phase65_save_office_identity(%s,%s,%s)).id', (project, local_id, local['display_name']))) == local_id, 'Stable identity retry')
    q('select phase65_propose_task_office(%s,%s)', (task, local_id))
    denied("update tasks set status='in_progress' where id=%s", (task,), 'Direct execution denied')
    denied('select assign_task(%s,%s,%s)', (task, member, 'Member'), 'Legacy staffing cannot bypass proposal')
    denied('update tasks set proposed_office_identity_id=null where id=%s', (task,), 'Direct unresolved marker clearing denied')
    readiness = q('select phase7_project_readiness(%s)', (project,))
    check(any(x['key'] == 'office_identity' and not x['ok'] for x in readiness['checks']) and not readiness['canActivate'], 'Readiness reports authoritative proposal blocker')
    for actor, label in ((member, 'Member'), (admin, 'Admin'), (other_head, 'Other Head')):
        identity(actor)
        denied('select phase65_save_office_identity(%s,%s,%s)', (project, str(uuid4()), 'Unauthorized'), label + ' cannot retain Lead identity')
    identity()
    token = uuid4().hex + uuid4().hex
    invitation = q('select to_jsonb(phase65_create_invitation(%s,%s,%s,%s,%s,168))', (head, local_id, email, 'collaborating', token))
    denied('select phase2_accept_invitation(%s,%s,%s,null)', (token, member, ''), 'Wrong email acceptance denied')
    accepted = q('select to_jsonb(phase2_accept_invitation(%s,%s,%s,null))', (token, contact, ''))
    check(accepted['role'] == role and accepted['org_id'] == original_office, 'Accepted contact role and membership unchanged')
    check(str(q('select (phase2_accept_invitation(%s,%s,%s,null)).id', (token, contact, ''))) == contact, 'Accepted retry preserves identity')
    identity(contact)
    check(q('select can_see_project(%s,%s) and not coalesce(can_manage_task(%s,%s),false) and not coalesce(can_contribute_task(%s,%s),false)', (project, contact, task, contact, task, contact)), 'Accepted contact receives read context without execution authority')
    check(q('select count(*) from project_office_identities where project_id=%s', (project,)) > 0, 'Hosted RLS allows scoped contact reads')
    denied('update project_office_identities set display_name=%s where id=%s', ('Direct write', local_id), 'Hosted RLS/grants reject direct identity mutation')
    identity(head)
    q('select phase65_link_office_identity(%s,%s)', (local_id, partner))
    participation = str(q('select project_office_id from project_office_identities where id=%s', (local_id,)))
    denied('select phase65_resolve_task_office(%s)', (task,), 'Canonical Head confirmation required')
    identity(other_head)
    q('select phase6_confirm_office(%s)', (participation,))
    q('select phase6_set_members(%s,%s::uuid[])', (participation, [contact]))
    identity(head)
    q('select phase65_resolve_task_office(%s)', (task,))
    check(q('select org_id=%s and proposed_office_identity_id is null from tasks where id=%s', (partner, task)), 'Explicit handover clears proposal atomically')
    denied('select assign_task(%s,%s,%s)', (task, contact, 'Member'), 'Lead cannot staff another canonical Office')
    identity(other_head)
    q('select assign_task(%s,%s,%s)', (task, contact, 'Member'))
    check(q('select assigned_to=%s and reviewer_id=%s from tasks where id=%s', (contact, other_head, task)), 'Responsible Office Head controls staffing and review')
    identity()
    connection.rollback()
    check(q("select to_regclass('public.project_office_identities')") is None, 'Migration and fixture records rolled back')
    print(f'Hosted Phase 6.5 rehearsal passed ({checks} assertions) on {args.project_ref}; no changes committed.')
except Exception as error:
    detail = getattr(getattr(error, 'diag', None), 'message_primary', None)
    # Never print connection strings or exception arguments containing secrets.
    print('Hosted rehearsal failed: ' + (detail or type(error).__name__), flush=True)
    raise SystemExit(1)
finally:
    if connection:
        connection.rollback()
        connection.close()
