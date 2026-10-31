"""Real PostgreSQL date/race checks on a disposable localhost-only database."""
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

root = Path(__file__).resolve().parent.parent
migration = '20261029232938_project_task_schedule_bounds.sql'
insert_guard_migration = '20261029235308_project_schedule_insert_guard.sql'
pgbin = Path('C:/Program Files/PostgreSQL/17/bin')
scratch = Path(tempfile.mkdtemp(prefix='eflow-schedule-pg-')).resolve()
assert scratch.parent == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith('eflow-schedule-pg-')
data = scratch / 'data'
sock = socket.socket()
sock.bind(('127.0.0.1', 0))
port = sock.getsockname()[1]
sock.close()
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
checks = []
started = False
project = '00000000-0000-4000-8000-000000000001'
task = '00000000-0000-4000-8000-000000000002'


def run(name, args):
    options = {'stdout': subprocess.DEVNULL, 'stderr': subprocess.DEVNULL} if name == 'pg_ctl' else {'capture_output': True}
    result = subprocess.run([str(pgbin / (name + '.exe')), *args], text=True, timeout=60, creationflags=flags, **options)
    assert result.returncode == 0, name + ': ' + (result.stderr or 'See disposable PostgreSQL log')[-1500:]


def connect():
    client = psycopg2.connect(host='127.0.0.1', port=port, user='postgres', dbname='postgres', connect_timeout=8)
    client.autocommit = True
    sql(client, "set statement_timeout='15s';set lock_timeout='10s';set timezone='UTC'")
    return client


def sql(client, statement, args=None):
    with client.cursor() as cursor:
        cursor.execute(statement, args)
        return cursor.fetchone()[0] if cursor.description else None


def ok(name, condition=True):
    assert condition, name
    checks.append({'case': name, 'result': 'pass'})


def denied(name, statement, args=None):
    before = sql(c, "select jsonb_build_object('projects',(select jsonb_agg(p) from projects p),'tasks',(select jsonb_agg(t) from tasks t))")
    try:
        sql(c, statement, args)
    except psycopg2.Error as error:
        assert error.pgcode == '22023', (name, error.pgcode, str(error))
        after = sql(c, "select jsonb_build_object('projects',(select jsonb_agg(p) from projects p),'tasks',(select jsonb_agg(t) from tasks t))")
        ok(name, before == after)
        return
    raise AssertionError(name + ': invalid write succeeded')


def reset():
    sql(c, "reset role;truncate tasks,projects;insert into projects values (%s,'2099-10-30','2099-11-06','planning');insert into tasks(id,title,linked_project_id,start_date,deadline,due_date,status) values (%s,'TestTask',%s,'2099-10-30','2099-11-05T23:59:00+08:00','','todo')", (project, task, project))


try:
    run('initdb', ['-D', str(data), '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale'])
    run('pg_ctl', ['-D', str(data), '-l', str(scratch / 'postgres.log'), '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'])
    started = True
    c = connect()
    sql(c, """create role authenticated;create role anon;
      create table projects(id uuid primary key,start_date date,target_date date,status text);
      create table tasks(id uuid primary key,title text,linked_project_id uuid,start_date date,deadline text,due_date text,deleted_at timestamptz,status text,proposed_office_identity_id uuid);
      grant select,insert,update,delete on projects,tasks to authenticated;
      alter table tasks enable row level security;
      create policy hidden_task on tasks for all to authenticated using(false) with check(false);
      create schema eflow_phase65;create schema eflow_phase7;
      create function eflow_phase65.baseline_readiness(p_id uuid) returns jsonb language sql as $$
        select jsonb_build_object('checks',jsonb_build_array(
          jsonb_build_object('key','schedule','ok',true,'detail','Original schedule check'),
          jsonb_build_object('key','structure','ok',true,'detail','Current revision reviewed'),
          jsonb_build_object('key','budget','ok',false,'detail','Budget review required')),
          'ready',false,'canActivate',false,'stage','Planning','governed',false)
      $$;
    """)
    sql(c, (root / 'supabase/migrations' / migration).read_text(encoding='utf-8'))
    sql(c, (root / 'supabase/migrations' / insert_guard_migration).read_text(encoding='utf-8'))
    reset()
    denied('Nov 4 project end rejects Nov 5 task; rows unchanged', 'update projects set target_date=\'2099-11-04\' where id=%s', (project,))
    sql(c, "update projects set target_date='2099-11-05' where id=%s", (project,))
    ok('Inclusive target day accepts 11:59 PM Manila task')
    denied('Project start cannot exclude existing task start', "update projects set start_date='2099-10-31' where id=%s", (project,))
    denied('Task due cannot exceed project end', "update tasks set deadline='2099-11-06' where id=%s", (task,))
    denied('Task start cannot precede project start', "update tasks set start_date='2099-10-29' where id=%s", (task,))
    denied('Task due cannot precede own start', "update tasks set deadline='2099-10-29' where id=%s", (task,))
    denied('UTC timestamp crossing Manila midnight is next calendar day', "update tasks set deadline='2099-11-05T16:00:00Z' where id=%s", (task,))
    sql(c, "update tasks set deadline='',due_date='2099-11-05' where id=%s", (task,))
    denied('Due date fallback also constrains project end', "update projects set target_date='2099-11-04' where id=%s", (project,))
    sql(c, "update tasks set deleted_at=now() where id=%s;update projects set target_date='2099-11-04' where id=%s", (task, project))
    ok('Soft-deleted tasks do not constrain the project')
    denied('Restoring an out-of-range task is blocked', 'update tasks set deleted_at=null where id=%s', (task,))
    reset()
    for status in ['todo', 'in_progress', 'completed', 'cancelled']:
        sql(c, 'update tasks set status=%s where id=%s', (status, task))
        denied(status + ' task still constrains project dates', "update projects set target_date='2099-11-04' where id=%s", (project,))
    sql(c, 'set role authenticated')
    ok('Conflicting task remains invisible under RLS', sql(c, 'select count(*) from tasks') == 0)
    denied('Integrity check sees conflicts hidden by task RLS', "update projects set target_date='2099-11-04' where id=%s", (project,))
    ok('Private schema has no authenticated usage', not sql(c, "select has_schema_privilege('authenticated','eflow_schedule','usage')"))
    try:
        sql(c, "insert into projects values (%s,'2099-10-30','2099-11-04','planning')", (project,))
        raise AssertionError('Duplicate project UUID accepted')
    except psycopg2.Error as error:
        ok('Duplicate project insert reaches uniqueness without reading hidden task schedule', error.pgcode == '23505')
    sql(c, 'reset role')
    reset()
    sql(c, "update tasks set linked_project_id=null where id=%s;update projects set target_date='2099-11-04' where id=%s", (task, project))
    denied('Linking out-of-range work to a project is blocked', 'update tasks set linked_project_id=%s where id=%s', (project, task))
    sql(c, "update tasks set deadline='Month 1',start_date=null where id=%s;update tasks set linked_project_id=%s where id=%s", (task, project, task))
    ok('Unresolved relative schedules remain planning values')
    sql(c, "update projects set start_date=null,target_date=null where id=%s;update tasks set deadline='2099-12-20' where id=%s", (project, task))
    ok('Unbounded planning dates remain supported')
    denied('Setting bounds validates existing due-only tasks', "update projects set target_date='2099-12-19' where id=%s", (project,))
    # Simulate a row created before installation. Status/title changes do not
    # silently repair its dates, but activation must not approve the conflict.
    sql(c, "alter table projects disable trigger zz_project_schedule_bounds;update projects set target_date='2099-11-04' where id=%s;alter table projects enable trigger zz_project_schedule_bounds", (project,))
    denied('Existing invalid schedule cannot activate', "update projects set status='active' where id=%s", (project,))
    readiness = sql(c, 'select eflow_phase7.readiness(%s)', (project,))
    ok('Readiness exposes the existing invalid schedule and blocks activation', not readiness['canActivate'] and not next(item['ok'] for item in readiness['checks'] if item['key'] == 'schedule'))
    ok('Readiness retains unrelated review blockers', next(item for item in readiness['checks'] if item['key'] == 'budget') == {'key': 'budget', 'ok': False, 'detail': 'Budget review required'})
    ok('Readiness retains current structure review', next(item['ok'] for item in readiness['checks'] if item['key'] == 'structure'))
    sql(c, "update tasks set title='Existing history retained' where id=%s", (task,))
    ok('Unrelated edits do not rewrite or block legacy dates')
    # Each edit below is valid against the starting state but the combination
    # would be invalid. Exercise both advisory-lock wait orders with real sessions.
    for project_first in [True, False]:
        reset()
        sql(c, "update tasks set deadline='2099-11-04' where id=%s", (task,))
        first = connect()
        first.autocommit = False
        project_sql = "update projects set target_date='2099-11-04' where id=%s"
        task_sql = "update tasks set deadline='2099-11-05' where id=%s"
        sql(first, project_sql if project_first else task_sql, (project if project_first else task,))

        def second_writer():
            second = connect()
            try:
                sql(second, task_sql if project_first else project_sql, (task if project_first else project,))
                return 'unexpected success'
            except psycopg2.Error as error:
                return error.pgcode
            finally:
                second.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(second_writer)
            time.sleep(0.25)
            first.commit()
            first.close()
            ok('Concurrent edits reject stale task' if project_first else 'Concurrent edits reject stale project range', future.result(timeout=15) == '22023')
        ok('Concurrent final invariant: ' + str(project_first), sql(c, "select p.target_date >= eflow_schedule.calendar_day(t.deadline) from projects p join tasks t on t.linked_project_id=p.id"))
    c.close()
    receipt = {'database': 'disposable localhost PostgreSQL 17', 'migrations': [migration, insert_guard_migration], 'checks': checks}
    destination = root / 'docs/project-schedule-validation-2026-10-30'
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'SQL_VERIFICATION.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'result': 'pass', 'checks': len(checks), 'receipt': str(destination / 'SQL_VERIFICATION.json')}))
finally:
    if started:
        run('pg_ctl', ['-D', str(data), '-m', 'immediate', '-w', 'stop'])
    # Only this script's verified disposable directory is removed.
    assert scratch.parent == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith('eflow-schedule-pg-')
    shutil.rmtree(scratch)
