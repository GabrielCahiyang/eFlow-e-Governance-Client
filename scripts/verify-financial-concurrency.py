"""Real independent PostgreSQL sessions. Disposable localhost only; no .env/hosted URI."""
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import threading
import uuid

import psycopg2
from psycopg2.extras import Json

root = Path(__file__).resolve().parent.parent
pgbin = Path(os.environ.get('EFLOW_TEST_PG_BIN', 'C:/Program Files/PostgreSQL/17/bin'))
scratch = Path(tempfile.mkdtemp(prefix='eflow-financial-pg-')).resolve()
assert scratch.parent == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith('eflow-financial-pg-')
data = scratch / 'data'
sock = socket.socket(); sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]; sock.close()
flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
started = False
checks = 0

def run(name, args):
    # A Windows background server inherits pipe handles from pg_ctl. Do not
    # wait for those handles to close before its client tests can begin.
    output = {'stdout': subprocess.DEVNULL, 'stderr': subprocess.DEVNULL} if name == 'pg_ctl' else {'capture_output': True}
    result = subprocess.run([str(pgbin / (name + ('.exe' if os.name == 'nt' else ''))), *args], **output, text=True, timeout=60, creationflags=flags)
    if result.returncode:
        raise RuntimeError(name + ': ' + (result.stderr or 'See the disposable PostgreSQL log')[-2000:])
    return result.stdout

def connect():
    c = psycopg2.connect(host='127.0.0.1', port=port, user='postgres', dbname='postgres', connect_timeout=8)
    c.autocommit = True
    with c.cursor() as q:
        q.execute("set statement_timeout='20s';set lock_timeout='15s'")
    return c

def fid(n): return '00000000-0000-4000-8000-' + str(n).zfill(12)

def sql(c, statement, args=None):
    with c.cursor() as q:
        q.execute(statement, args)
        return q.fetchone()[0] if q.description else None

def actor(c, n):
    sql(c, 'reset role')
    sql(c, "select set_config('request.jwt.claim.sub',%s,false)", (fid(n),))
    sql(c, 'set role authenticated')

def equal(a, b, message):
    global checks
    assert a == b, message + ': ' + repr((a, b))
    checks += 1

def parallel(operations):
    barrier = threading.Barrier(len(operations))
    def work(operation):
        c = connect()
        try:
            barrier.wait(timeout=10)
            return ('ok', operation(c))
        except psycopg2.Error as e:
            return ('error', e.pgcode)
        finally:
            c.close()
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(operations)) as pool:
        return list(pool.map(work, operations))

try:
    run('initdb', ['-D', str(data), '-U', 'postgres', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale'])
    run('pg_ctl', ['-D', str(data), '-l', str(scratch / 'postgres.log'), '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'])
    started = True
    c = connect()
    baseline = subprocess.run(['node', 'scripts/verify-financial-compatibility.mjs', '--baseline-sql'], cwd=root, capture_output=True, text=True, timeout=30, creationflags=flags)
    assert baseline.returncode == 0, baseline.stderr[-2000:]
    sql(c, baseline.stdout)
    # Source is reviewed local input, never fetched/executed from a live server.
    migration = root / 'supabase/migrations/20261015125031_financial_cash_compatibility.sql'
    sql(c, migration.read_text(encoding='utf-8'))
    sql(c, (root / 'supabase/migrations/20261015142837_financial_journal_and_refund_integrity.sql').read_text(encoding='utf-8'))
    sql(c, """insert into organizations(id,name,slug,path,org_type) values (%s,'Native financial test','native-finance','native_finance','department');
      insert into auth.users(id,email,email_confirmed_at) values (%s,'admin@native.test',now()),(%s,'head@native.test',now()),(%s,'lead@native.test',now());
      insert into profiles(id,email,full_name,employee_id,role,is_active,org_id) values
      (%s,'admin@native.test','Admin','nf1','admin',true,null),(%s,'head@native.test','Head','nf2','member',true,%s),(%s,'lead@native.test','Lead','nf5','member',true,%s);
      insert into accounting_accounts(code,title,classification,normal_balance) values ('10102020','Cash','asset','debit'),('19901030','Advances','asset','debit'),('50299990','Expense','expense','debit') on conflict do nothing;""",
        (fid(100), fid(1), fid(2), fid(5), fid(1), fid(2), fid(100), fid(5), fid(100)))
    actor(c, 1); sql(c, 'select set_organization_leadership(%s,%s,null)', (fid(100), fid(2)))
    actor(c, 2)
    sections = [{'id': fid(200), 'name': 'Supplies', 'amount': 100000, 'heldAmount': 0, 'position': 0}, {'id': fid(201), 'name': 'Travel', 'amount': 100000, 'heldAmount': 0, 'position': 1}]
    settings = {'dailyReleaseLimit': 30000, 'perReceiptLimit': 5000, 'liquidationDueDays': 15, 'allowReceiptOverride': False, 'threshold': 75, 'notes': 'Disposable concurrency test'}
    budget = sql(c, 'select save_office_budget_sections(%s,2026,%s::jsonb,0,null,%s::jsonb)', (fid(100), Json(sections), Json(settings)))
    sql(c, 'select lock_department_fiscal_budget(%s)', (budget,))
    project = sql(c, 'select (create_project_with_details(%s::jsonb)).id', (Json({'title': 'Native financial races', 'org_id': fid(100)}),))
    group = sql(c, 'select id from project_groups where project_id=%s and is_default', (project,))
    participation = sql(c, "select id from project_offices where project_id=%s and relationship_type='lead'", (project,))
    expected = sql(c, "select coalesce(array_agg(user_id order by user_id),'{}'::uuid[]) from project_office_members where project_office_id=%s", (participation,))
    sql(c, 'select r7_select_office_members(%s,%s::uuid[],%s::uuid[],%s)', (participation, expected, [fid(5)], str(uuid.uuid4())))

    def task(amount=100):
        actor(c, 2)
        task_id = sql(c, 'select (phase3_create_task(%s,%s,%s)).id', (project, group, 'Concurrent financial work'))
        sql(c, 'select assign_task(%s,%s,%s)', (task_id, fid(5), 'Lead'))
        sql(c, 'select fund_office_work(%s,2026,%s::jsonb,%s,%s)', (task_id, Json([{'partitionId': fid(200), 'amount': amount}, {'partitionId': fid(201), 'amount': amount}]), 'Authorized native test', str(uuid.uuid4())))
        context = sql(c, 'select get_task_funding_context(%s,null)', (task_id,))
        return task_id, next(line['id'] for line in context['lines'] if line['category'] == 'Supplies'), next(line['id'] for line in context['lines'] if line['category'] == 'Travel')

    def request_operation(work, key, amount=60, existing=None):
        def perform(client):
            actor(client, 5)
            return sql(client, 'select create_contextual_cash_request_v2(%s,null,%s::jsonb,%s,null,%s,%s)', (work[0], Json([{'allocationLineId': work[1], 'amount': amount}, {'allocationLineId': work[2], 'amount': 20}]), 'Native request', key, existing))
        return perform

    work = task(); key = str(uuid.uuid4())
    results = parallel([request_operation(work, key), request_operation(work, key)])
    equal([r[0] for r in results], ['ok', 'ok'], 'Both same-key sessions succeed')
    equal(results[0][1], results[1][1], 'Same-key sessions receive one canonical request')
    request = results[0][1]; sql(c, 'reset role')
    equal(sql(c, 'select count(*) from eflow_budget.cash_commands where request_id=%s', (request,)), 1, 'One persisted command receipt')
    equal(sql(c, "select count(*) from budget_ledger_entries where petty_cash_request_id=%s and entry_type='cash_request_created'", (request,)), 1, 'One creation audit')
    equal(sql(c, 'select count(*) from notifications where financial_record_id=%s', (request,)), 1, 'One creation notification')

    work = task()
    results = parallel([request_operation(work, str(uuid.uuid4())), request_operation(work, str(uuid.uuid4()))])
    equal(sorted(r[0] for r in results), ['error', 'ok'], 'Competing source reservations serialize without overspending')
    equal(next(r[1] for r in results if r[0] == 'error'), '22023', 'Losing reservation gets an actionable balance rejection')
    sql(c, 'reset role')
    equal(sql(c, 'select sum(rl.amount)::text from petty_cash_request_lines rl join petty_cash_requests r on r.id=rl.request_id where r.task_id=%s and rl.allocation_line_id=%s', (work[0], work[1])), '60.00', 'Only one source reservation commits')

    # Reconstructed returned state is private fixture setup, not a new public
    # approval/correction permission. Both actual retries use authenticated RPCs.
    actor(c, 2); sql(c, 'reset role');sql(c, "update petty_cash_requests set status='department_changes_requested' where id=%s", (request,))
    results = parallel([request_operation((sql(c, 'select task_id from petty_cash_requests where id=%s', (request,)),
        sql(c, "select allocation_line_id from petty_cash_request_lines where request_id=%s order by amount desc limit 1", (request,)),
        sql(c, "select allocation_line_id from petty_cash_request_lines where request_id=%s order by amount limit 1", (request,))), str(uuid.uuid4()), 50, request) for _ in range(2)])
    equal(sorted(r[0] for r in results), ['error', 'ok'], 'Independent correction commands cannot both change the same returned request')

    # Independent Head sessions approve different requests in the same fiscal
    # budget; counter row/fiscal locks guarantee distinct durable PCVs.
    work = task(1000)
    c1, c2 = request_operation(work, str(uuid.uuid4()), 10)(c), request_operation(work, str(uuid.uuid4()), 10)(c)
    def approve(request_id):
        def perform(client):
            actor(client, 2);sql(client, 'select decide_petty_cash_request(%s,true,%s)', (request_id, 'Native approval'))
            return sql(client, 'select pcv_number from petty_cash_requests where id=%s', (request_id,))
        return perform
    results = parallel([approve(c1), approve(c2)])
    equal([r[0] for r in results], ['ok', 'ok'], 'Concurrent authorizations both complete')
    equal(len({r[1] for r in results}), 2, 'Concurrent authorizations never share a PCV')
    sql(c, 'reset role')
    equal(sql(c, 'select last_number=(select max(pcv_number) from petty_cash_requests where fiscal_budget_id=%s) from eflow_budget.pcv_counters where fiscal_budget_id=%s', (budget, budget)), True, 'Counter high-water matches committed documents')

    # Real separate connections also serialize the legacy liquidation API.
    sql(c, """insert into auth.users(id,email,email_confirmed_at) values (%s,'accounting@native.test',now());
      insert into profiles(id,email,full_name,employee_id,role,is_active,org_id)
      values (%s,'accounting@native.test','Accounting','nf4','member',true,%s);""", (fid(4), fid(4), fid(100)))
    actor(c, 2);sql(c, 'select set_department_accounting_staff(%s,true)', (fid(4),))
    work = task(1000);actor(c, 5)
    request = sql(c, "select create_contextual_cash_request(%s,null,%s,100,'Native refund race',null,%s)", (work[0], work[1], str(uuid.uuid4())))
    actor(c, 2);sql(c, "select decide_petty_cash_request(%s,true,'Approve refund race')", (request,))
    actor(c, 4);release = sql(c, 'select id from petty_cash_releases where request_id=%s', (request,))
    sql(c, "select record_accounting_petty_cash_release(%s,'cash',null)", (release,))
    voucher = sql(c, 'select voucher_number from petty_cash_releases where id=%s', (release,))
    actor(c, 5);sql(c, 'select acknowledge_accounting_release(%s,%s)', (release, voucher))
    date = sql(c, 'select current_date::text')
    receipts = [{'vendor': 'Native store', 'receiptNumber': 'RACE-1', 'receiptDate': date,
      'description': 'Supplies', 'amount': 80, 'fileName': 'receipt.pdf',
      'filePath': fid(100) + '/' + str(request) + '/receipt.pdf', 'mimeType': 'application/pdf', 'fileSize': 12}]
    liquidation_key = str(uuid.uuid4())
    def liquidation_operation(refund):
        def perform(client):
            actor(client, 5)
            return sql(client, 'select submit_accounting_cash_liquidation(%s,80,%s,%s::jsonb,%s,%s,%s::date)',
                (request, 'Native receipt package', Json(receipts), liquidation_key, refund, date))
        return perform
    results = parallel([liquidation_operation('REF-A'), liquidation_operation('REF-B')])
    equal(sorted(r[0] for r in results), ['error', 'ok'], 'Competing changed-payload liquidation keys cannot both succeed')
    equal(next(r[1] for r in results if r[0] == 'error'), '22023', 'Changed refund reference receives an explicit rejection')
    sql(c, 'reset role');liquidation = next(r[1] for r in results if r[0] == 'ok')
    winning_refund = sql(c, 'select refund_receipt_number from petty_cash_liquidations where id=%s', (liquidation,))
    equal(sql(c, 'select count(*) from petty_cash_liquidations where request_id=%s', (request,)), 1, 'One liquidation version commits')
    results = parallel([liquidation_operation(winning_refund), liquidation_operation(winning_refund)])
    equal([r[0] for r in results], ['ok', 'ok'], 'Identical concurrent liquidation retries both succeed')
    equal([str(r[1]) for r in results], [str(liquidation), str(liquidation)], 'Identical retries return the same committed version')
    equal(sql(c, 'select refund_receipt_number from petty_cash_liquidations where id=%s', (liquidation,)), winning_refund, 'Concurrent retries retain original refund evidence')
    c.close()
    print(json.dumps({'passed': True, 'checks': checks, 'independent_postgres_sessions': True, 'localhost_only': True, 'hosted_writes': False}))
finally:
    if started:
        run('pg_ctl', ['-D', str(data), '-m', 'immediate', '-w', 'stop'])
    # Exact checked temporary target, never a workspace, repository or home.
    assert scratch.parent == Path(tempfile.gettempdir()).resolve() and scratch.name.startswith('eflow-financial-pg-')
    shutil.rmtree(scratch)
