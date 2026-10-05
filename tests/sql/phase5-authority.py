"""Rollback-only import checks on the explicitly selected eFlow database."""
import argparse
import copy
import json
from pathlib import Path
from uuid import uuid4
from dotenv import dotenv_values
import psycopg2

parser = argparse.ArgumentParser()
parser.add_argument('--project-ref', required=True)
parser.add_argument('--preflight', action='store_true')
args = parser.parse_args()
config = dotenv_values(Path.cwd() / '.env')
dsn = config.get('EFLOW_DATABASE_URL', '')
assert args.project_ref in dsn, 'Configured database must match the explicit project reference.'
conn = psycopg2.connect(dsn, connect_timeout=15)
c = conn.cursor()
checks = []
def q(sql, params=None):
    c.execute(sql, params)
    return c.fetchone()[0] if c.description else None
def ok(label, value):
    assert value, label
    checks.append(label)
    print('Passed: ' + label, flush=True)
def denied(label, sql, params=None):
    c.execute('savepoint deny')
    try:
        c.execute(sql, params)
    except psycopg2.Error:
        c.execute('rollback to savepoint deny')
        checks.append(label)
        print('Passed: ' + label, flush=True)
    else:
        raise AssertionError(label + ' unexpectedly allowed')
    finally:
        c.execute('release savepoint deny')
def identity(uid=None):
    c.execute('reset role')
    q("select set_config('request.jwt.claim.sub',%s,true)", (uid or '',))
    if uid:
        c.execute('set local role authenticated')
def call(project, request, review):
    return q('select phase5_import_project_work(%s,%s,%s::jsonb)', (project, request, json.dumps(review)))
try:
    if args.preflight:
        c.execute(next(Path('supabase/migrations').glob('*phase5_workspace_ai_import.sql')).read_text(encoding='utf-8'))
    c.execute("select p.id,p.org_id from profiles p where p.role='head' and p.is_active and p.org_id is not null and exists(select 1 from profiles m where m.role='member' and m.is_active and m.org_id=p.org_id) limit 1")
    head, office = map(str, c.fetchone())
    member = str(q("select id from profiles where role='member' and is_active and org_id=%s limit 1", (office,)))
    other = str(q("select id from profiles where role='head' and is_active and org_id<>%s limit 1", (office,)))
    admin = str(q("select id from profiles where role='admin' and is_active limit 1"))
    identity(head)
    project = str(q('select (create_project_with_details(%s::jsonb)).id', (json.dumps({'title': 'Phase 5 rollback check', 'org_id': office}),)))
    group = str(q('select id from project_groups where project_id=%s and is_default', (project,)))
    review = {'schemaVersion': 1, 'sourceName': 'Project plan.md', 'applyProjectDetails': False,
      'project': {'title': 'Reviewed project', 'description': 'Reviewed scope', 'objectives': 'Complete outreach', 'startDate': '2026-10-05', 'targetDate': '2026-10-31'},
      'offices': [{'key': 'planning', 'name': 'Planning Office', 'evidence': 'Planning Office prepares the assessment.', 'officeId': office, 'confirmed': True}],
      'groups': [{'key': 'g1', 'title': 'Preparation', 'color': '#579bfc', 'existingGroupId': '', 'tasks': [
        {'key': 'a', 'title': 'Assess needs', 'description': 'Produce a community needs report.', 'priority': 'high', 'estimatedHours': 16, 'startDate': '2026-10-05', 'dueDate': '2026-10-09', 'officeKey': 'planning', 'dependencies': [], 'sourceQuote': 'Planning Office prepares the assessment.', 'subitems': [{'title': 'Gather data', 'dueDate': '2026-10-06'}, {'title': 'Review findings', 'dueDate': ''}]},
        {'key': 'b', 'title': 'Prepare outreach', 'description': 'Use the assessment to prepare materials.', 'priority': 'medium', 'estimatedHours': 8, 'startDate': '', 'dueDate': '', 'officeKey': '', 'dependencies': ['a'], 'subitems': []}]}]}
    request = str(uuid4()); result = call(project, request, review)
    ok('Groups, tasks and subitems inserted in the canonical model', result['taskCount'] == 2 and result['subitemCount'] == 2 and result['groupCount'] == 1)
    task = result['taskIds']['a']; second = result['taskIds']['b']
    ok('Source details and effort retained without automatic staffing', q("select description='Produce a community needs report.' and assigned_to is null and status='pending_assignment' and estimated_hours=16 and org_id=%s and import_batch_id=%s from tasks where id=%s", (office, request, task)))
    ok('Local dependencies translate to canonical task IDs', q('select dependency_ids=%s::uuid[] from tasks where id=%s', ([task], second)))
    ok('Subitems keep their existing workflow and dates', q("select count(*)=2 and bool_and(status='todo') and min(due_date)='2026-10-06'::date and max(due_date)='2026-10-09'::date from subtasks where task_id=%s", (task,)))
    ok('Import receipt preserves reviewed Office proposals', q("select review->'offices'->0->>'confirmed'='true' from project_import_batches where id=%s", (request,)))
    ok('Identical retry returns the same records', call(project, request, review) == result and q('select count(*)=2 from tasks where linked_project_id=%s', (project,)))
    changed = copy.deepcopy(review); changed['groups'][0]['tasks'][0]['title'] = 'Changed review'
    denied('Changed review cannot reuse an import ID', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, request, json.dumps(changed)))
    # Fail late, after insert paths have executed, to prove transaction rollback.
    bad = copy.deepcopy(review); bad['groups'][0]['tasks'][1]['dependencies'] = ['missing']
    before = q('select count(*) from tasks where linked_project_id=%s', (project,))
    denied('Unknown dependency rejects the entire batch', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(bad)))
    ok('Failed batch leaves no partial group/task/subitem inserts', q('select count(*) from tasks where linked_project_id=%s', (project,)) == before and q('select count(*)=2 from project_groups where project_id=%s', (project,)))
    bad = copy.deepcopy(review); bad['groups'][0]['tasks'][0]['dependencies'] = ['b']
    denied('Dependency cycles rejected', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(bad)))
    bad = copy.deepcopy(review); bad['offices'][0]['confirmed'] = False
    denied('Unconfirmed Office responsibility rejected', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(bad)))
    bad = copy.deepcopy(review); bad['groups'][0]['tasks'][0]['assigned_to'] = head
    denied('Model staffing fields cannot bypass import review', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(bad)))
    bad = copy.deepcopy(review); bad['groups'][0]['tasks'][0]['startDate'] = '2026-11-01'
    denied('Invalid date order rejected atomically', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(bad)))
    valid = copy.deepcopy(review); valid['applyProjectDetails'] = True; valid['groups'][0]['existingGroupId'] = group
    result2 = call(project, str(uuid4()), valid)
    ok('Explicitly reviewed project metadata and existing group supported', result2['groupCount'] == 0 and q("select title='Reviewed project' and description like '%%Objectives%%' from projects where id=%s", (project,)))
    foreign_project = str(q('select (create_project_with_details(%s::jsonb)).id', (json.dumps({'title': 'Other project', 'org_id': office}),)))
    foreign_group = str(q('select id from project_groups where project_id=%s', (foreign_project,)))
    bad = copy.deepcopy(review); bad['groups'][0]['existingGroupId'] = foreign_group
    denied('Cross-project group ID rejected', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(bad)))
    for label, uid in [('Member', member), ('Admin', admin), ('Other Office Head', other)]:
        identity(uid)
        denied(label + ' cannot import into the project', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(review)))
    identity(other)
    ok('Other Office cannot read source evidence', q('select count(*)=0 from project_import_batches where project_id=%s', (project,)))
    identity(head)
    denied('Import receipts cannot be edited', "update project_import_batches set review='{}' where id=%s", (request,))
    identity(); c.execute('set local role anon')
    denied('Anonymous cannot import', 'select phase5_import_project_work(%s,%s,%s::jsonb)', (project, str(uuid4()), json.dumps(review)))
    print(f'{len(checks)} checks passed; all verification records rolled back.', flush=True)
finally:
    conn.rollback(); conn.close()
