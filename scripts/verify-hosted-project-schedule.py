"""Authenticated DB-role probes, always rolled back; no browser/login claim."""
import argparse
import hashlib
import json
from pathlib import Path
import socket
from urllib.parse import urlparse

from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json

parser = argparse.ArgumentParser()
parser.add_argument('--project', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
uri = dotenv_values(root / '.env')['EFLOW_DATABASE_URL']
parsed = urlparse(uri)
assert parsed.username == 'postgres.ixnfphgjyelhckjwjkdv'
connection = psycopg2.connect(uri, sslmode='require', connect_timeout=15,
    hostaddr=socket.getaddrinfo(parsed.hostname, parsed.port or 5432, socket.AF_INET, socket.SOCK_STREAM)[0][4][0])
connection.autocommit = True
cursor = connection.cursor()


def sql(statement, params=None):
    cursor.execute(statement, params)
    return cursor.fetchone()[0] if cursor.description else None


def snapshot():
    return sql("select jsonb_build_object('project',(select to_jsonb(p) from public.projects p where id=%s),'tasks',(select jsonb_agg(t order by id) from public.tasks t where linked_project_id=%s))", (args.project, args.project))


cases = []
before = snapshot()
assert before['project'] and before['project']['status'] == 'planning'
head = sql('select o.head_user_id from public.organizations o join public.projects p on p.org_id=o.id where p.id=%s', (args.project,))
assert head
task = sql('select id from public.tasks where linked_project_id=%s and deleted_at is null order by id limit 1', (args.project,))
assert task


def update(changes):
    observed = sql('select updated_at from public.projects where id=%s', (args.project,))
    return sql('select to_jsonb(public.update_project_metadata(%s,%s,%s::jsonb))', (args.project, observed, Json(changes)))


def denied(name, operation, expected):
    sql('savepoint rejected_change')
    try:
        operation()
    except psycopg2.Error as error:
        code, message = error.pgcode, error.diag.message_primary
        sql('rollback to savepoint rejected_change')
        assert code == '22023' and expected in message, (name, code, message)
        cases.append({'case': name, 'result': 'pass', 'sqlstate': code})
        return
    raise AssertionError(name + ': invalid write succeeded')


try:
    sql('begin')
    sql("set local statement_timeout='15s';set local lock_timeout='10s'")
    sql("select set_config('request.jwt.claim.sub',%s,true)", (str(head),))
    sql("select set_config('request.jwt.claims',%s,true)", (json.dumps({'sub': str(head), 'role': 'authenticated'}),))
    sql('set local role authenticated')
    readiness = sql('select public.phase7_project_readiness(%s)', (args.project,))
    assert not readiness['canActivate']
    assert any(check['key'] == 'schedule' and not check['ok'] for check in readiness['checks'])
    cases.append({'case': 'Existing Nov 4/Nov 5 mismatch is an activation blocker', 'result': 'pass'})
    update({'target_date': '2026-11-06'})
    denied('Metadata RPC rejects Nov 4 while task ends Nov 5', lambda: update({'target_date': '2026-11-04'}), 'Project target date cannot be before')
    update({'target_date': '2026-11-05'})
    cases.append({'case': 'Metadata RPC permits same-day Nov 5 target', 'result': 'pass'})
    denied('Metadata RPC rejects a start after existing task start', lambda: update({'start_date': '2026-11-01'}), 'Project start date cannot be after')
    denied('Main-table task patch rejects a due date outside project bounds',
           lambda: sql('select public.phase3_patch_task(%s,%s::jsonb)', (task, Json({'deadline': '2026-11-06T23:59:00+08:00'}))),
           'Task dates cannot be after the project target date')
finally:
    connection.rollback()
    # autocommit=True plus explicit BEGIN requires an explicit SQL ROLLBACK.
    sql('rollback')

after = snapshot()
assert before == after, 'Probe changed project/task data: inspect before continuing.'
receipt = {'target': 'ixnfphgjyelhckjwjkdv', 'method': 'Actual Head database role with existing RPCs, explicit rollback; not a browser session',
    'cases': cases, 'original_project_and_tasks_preserved': True,
    'snapshot_sha256': hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest()}
(root / 'docs/project-schedule-validation-2026-10-30/HOSTED_ROLLBACK_VERIFICATION.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'checks': len(cases), 'result': 'pass', 'original_project_and_tasks_preserved': True}))
cursor.close()
connection.close()
