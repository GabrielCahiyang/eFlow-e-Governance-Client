"""Executed only inside verify-financial-concurrency.py's disposable local server.
No environment containing a hosted DB URI is read. Actor numbers are synthetic.
"""
import datetime
import time

case_receipts = []

def ledger_snapshot():
    # Observable final state, in addition to the case-specific invariants below.
    # These are synthetic local rows, never a hosted database export.
    return sql(c, """select jsonb_build_object(
      'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'approved',approved_amount,'released',released_amount,'spent',actual_spent,'returned',returned_amount) order by id),'[]') from petty_cash_requests),
      'releases',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status,'amount',amount,'day',scheduled_date) order by id),'[]') from petty_cash_releases),
      'journals',(select coalesce(jsonb_agg(jsonb_build_object('id',j.id,'source',j.source_id,'type',j.source_type,'day',j.entry_date,
        'debits',(select sum(debit) from general_journal_lines where journal_entry_id=j.id),
        'credits',(select sum(credit) from general_journal_lines where journal_entry_id=j.id)) order by j.id),'[]') from general_journal_entries j))""")

def denied(who, statement, args, code='42501'):
    actor(c, who)
    try:
        sql(c, statement, args)
        raise AssertionError('Unauthorized operation succeeded')
    except psycopg2.Error as exc:
        equal(exc.pgcode, code, 'Expected denial for actor ' + str(who))

def set_active_people(ids, active):
    actor(c,1)
    sql(c,'update profiles set is_active=%s where id=any(%s::uuid[])',(active,ids))
    sql(c,'reset role')

def race(name, operations, verify):
    started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    begin = time.monotonic()
    outcomes = parallel(operations)
    print(json.dumps({'running_case':name,'outcomes':[(kind,str(value)) for kind,value in outcomes]}),flush=True)
    sql(c, 'reset role')
    verify(outcomes)
    case_receipts.append({'case': name, 'started_at': started_at,
        'completed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'elapsed_ms': round((time.monotonic()-begin)*1000),
        'final_ledger': ledger_snapshot(),
        'outcomes': [{'result': result, 'sqlstate': value if result=='error' else None}
            for result, value in outcomes]})
    return outcomes

# C03: the package created by the existing harness is awaiting Accounting.
def settle_for(who, liquidation_id):
    def operation(client):
        actor(client, who)
        return sql(client, "select settle_accounting_liquidation(%s,true,'Independent test settlement')", (liquidation_id,))
    return operation

race('C03 simultaneous settlement', [settle_for(4, liquidation), settle_for(4, liquidation)],
    lambda outcomes: equal(sorted(result for result, _ in outcomes), ['error','ok'], 'Only one settlement commits'))
equal(sql(c, "select count(*) from general_journal_entries where source_type='liquidation' and source_id=%s", (liquidation,)), 1, 'One settlement journal')

# Add a second Accounting Officer through the normal responsible Head RPC.
sql(c, """insert into auth.users(id,email,email_confirmed_at) values (%s,'independent@native.test',now()),(%s,'assistant@native.test',now());
 insert into profiles(id,email,full_name,employee_id,role,is_active,org_id) values
 (%s,'independent@native.test','Independent Accounting','nf6','member',true,%s),
 (%s,'assistant@native.test','Appointed Assistant','nf7','member',true,%s);""", (fid(6),fid(7),fid(6),fid(100),fid(7),fid(100)))
actor(c,2);sql(c,'select set_department_accounting_staff(%s,true)',(fid(6),))
expected=sql(c,"select coalesce(array_agg(user_id order by user_id),'{}'::uuid[]) from project_office_members where project_office_id=%s",(participation,))
sql(c,'select r7_select_office_members(%s,%s::uuid[],%s::uuid[],%s)',(participation,expected,[fid(4),fid(5),fid(6)],str(uuid.uuid4())))

def make_request(leader=5):
    work=task(1000)
    if leader!=5:
        actor(c,2)
        sql(c,'select assign_task_with_details(%s,%s,%s,null,null,%s::jsonb,%s::jsonb,null,null,false)',
            (work[0],fid(leader),'Accounting Lead',Json([fid(leader),fid(5)]),Json(['Accounting Lead','Lead'])))
    actor(c,leader)
    request_id=sql(c,"select create_contextual_cash_request(%s,null,%s,100,'Disposable remediation receipt',null,%s)",(work[0],work[1],str(uuid.uuid4())))
    actor(c,2);sql(c,"select decide_petty_cash_request(%s,true,'Approve native test')",(request_id,))
    release_id=sql(c,'select id from petty_cash_releases where request_id=%s',(request_id,))
    return work,request_id,release_id

def release_for(release_id):
    def operation(client):
        actor(client,6)
        return sql(client,"select record_accounting_petty_cash_release(%s,'cash',null)",(release_id,))
    return operation

def package(leader=5):
    work,request_id,release_id=make_request(leader)
    release_for(release_id)(c)
    actor(c,leader)
    voucher=sql(c,'select voucher_number from petty_cash_releases where id=%s',(release_id,))
    sql(c,'select acknowledge_accounting_release(%s,%s)',(release_id,voucher))
    day=sql(c,"select (now() at time zone 'Asia/Manila')::date::text")
    receipt=[{'vendor':'Synthetic QA store','receiptNumber':str(uuid.uuid4()),'receiptDate':day,
      'description':'QA supplies','amount':80,'fileName':'qa-receipt.pdf',
      'filePath':fid(100)+'/'+str(request_id)+'/qa-receipt.pdf','mimeType':'application/pdf','fileSize':12}]
    liq=sql(c,'select submit_accounting_cash_liquidation(%s,80,%s,%s::jsonb,%s,%s,%s::date)',
      (request_id,'QA only',Json(receipt),str(uuid.uuid4()),'QA-RETURN-20',day))
    return work,request_id,liq

# Q01: explicit local-only event fixture; no global now() override or production
# timezone mutation. The installed journal trigger still does all actual posting.
sql(c,'reset role')
historical_journals=sql(c,"select coalesce(jsonb_object_agg(id,to_jsonb(j)),'{}') from general_journal_entries j")
sql(c,"""create function eflow_finance_review.qa_event_clock() returns trigger language plpgsql as $$
 begin if new.status='approved' and old.status<>'approved' and nullif(current_setting('eflow.qa.event_time',true),'') is not null
 then new.decided_at:=current_setting('eflow.qa.event_time')::timestamptz;end if;return new;end $$;
 create trigger qa_event_clock before update of status on petty_cash_liquidations for each row execute function eflow_finance_review.qa_event_clock();""")
for event,expected_day in [('2026-10-22T16:30:00+00:00','2026-10-23'),('2026-10-23T04:30:00+00:00','2026-10-23')]:
    _,_,test_liq=package()
    sql(c,"select set_config('eflow.qa.event_time',%s,false)",(event,))
    settle_for(6,test_liq)(c)
    sql(c,'reset role')
    equal(sql(c,"select entry_date::text from general_journal_entries where source_type='liquidation' and source_id=%s",(test_liq,)),expected_day,'New post-fix journal uses Manila event date')
    equal(sql(c,'select decided_at=%s::timestamptz from petty_cash_liquidations where id=%s',(event,test_liq)),True,'Absolute decision instant is retained')
    equal(sql(c,"select sum(debit)=sum(credit) from general_journal_lines where journal_entry_id=(select id from general_journal_entries where source_type='liquidation' and source_id=%s)",(test_liq,)),True,'Post-fix journal balances')
    case_receipts.append({'case':'Q01 new settlement', 'event_instant':event,'expected_manila_day':expected_day,
      'liquidation_id':str(test_liq),'poster':fid(6),'final_ledger':ledger_snapshot()})
sql(c,"select set_config('eflow.qa.event_time','',false)")
equal(sql(c,"select coalesce(jsonb_object_agg(id,to_jsonb(j)),'{}') from general_journal_entries j where id=any(%s::uuid[])",(list(historical_journals),)),historical_journals,'New post-fix settlements never rewrite historical journal rows')

# C02: double release is real separate-session contention, not sequential retry.
_,_,cash_release=make_request()
denied(6,'select record_accounting_petty_cash_release(%s,null,null)',(cash_release,),'22023')
race('C02 simultaneous release',[release_for(cash_release),release_for(cash_release)],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'Only one physical release outcome'))
equal(sql(c,"select count(*) from general_journal_entries where source_type='cash_release' and source_id=%s",(cash_release,)),1,'One release journal')

# Q13: Accounting Officer 4 leads the task and requests its cash. The task-lead
# only predicate is also checked separately below using an unpersisted record.
conflict_work,conflict_request,conflict_liq=package(4)
denied(4,"select settle_accounting_liquidation(%s,true,'Forbidden task-lead settlement')",(conflict_liq,))
denied(6,"select settle_accounting_liquidation(%s,true,'Cannot skip leadership review')",(conflict_liq,))
actor(c,4)
context=sql(c,'select get_liquidation_independent_review(%s)',(conflict_liq,))
equal(context['required'],True,'Task-leading Accounting case requires independent review')
sql(c,'reset role')
equal(sql(c,"select eflow_finance_review.conflicted(jsonb_populate_record(null::public.petty_cash_requests,to_jsonb(r)||jsonb_build_object('requester_id',%s,'cash_recipient_id',%s)),%s) from petty_cash_requests r where id=%s",(fid(5),fid(5),fid(4),conflict_request)),True,'Task Lead conflict is enforced independently of requester/recipient')
actor(c,4)
equal([candidate['id'] for candidate in context['candidates']],[fid(2)],'Only eligible appointed Head is initially offered')
route_key=str(uuid.uuid4())
route_args=(conflict_liq,1,fid(2),'Task Leader conflict',route_key)
review=sql(c,'select route_liquidation_independent_review(%s,%s,%s,%s,%s)',route_args)
equal(sql(c,'select route_liquidation_independent_review(%s,%s,%s,%s,%s)',route_args),review,'Route retry preserves one assignment')
denied(4,'select route_liquidation_independent_review(%s,%s,%s,%s,%s)',(conflict_liq,1,fid(2),'Changed payload',route_key),'22023')
denied(5,'select decide_liquidation_independent_review(%s,1,%s,%s,%s)',(conflict_liq,'approved','Not assigned',str(uuid.uuid4())))
denied(2,"select settle_accounting_liquidation(%s,true,'Head cannot post')",(conflict_liq,))
actor(c,2);decision_key=str(uuid.uuid4())
decision=(conflict_liq,1,'approved','Independent receipt review approved',decision_key)
sql(c,'select decide_liquidation_independent_review(%s,%s,%s,%s,%s)',decision)
equal(sql(c,'select decide_liquidation_independent_review(%s,%s,%s,%s,%s)',decision),review,'Decision retry is idempotent')
sql(c,'reset role')
equal(sql(c,"select count(*) from general_journal_entries where source_type='liquidation' and source_id=%s",(conflict_liq,)),0,'Leadership review never posts a journal')
settle_for(6,conflict_liq)(c)
sql(c,'reset role')
equal(sql(c,'select settled_by=%s from petty_cash_requests where id=%s',(fid(6),conflict_request)),True,'Independent Accounting Officer posts after review')

# Assistant Head eligibility is appointment-based, without adding a role. The
# current app has no Assistant appointment; synthetic appointment is local only.
sql(c,'update organizations set assistant_head_user_id=%s where id=%s',(fid(7),fid(100)))
_,_,assistant_liq=package(4)
actor(c,4);context=sql(c,'select get_liquidation_independent_review(%s)',(assistant_liq,))
equal(len(context['candidates']),2,'Head and appointed Assistant are both supported')
sql(c,'select route_liquidation_independent_review(%s,1,%s,%s,%s)',(assistant_liq,fid(7),'Independent Assistant selected',str(uuid.uuid4())))
actor(c,7);assigned=sql(c,'select list_my_independent_liquidation_reviews()')
equal([row['liquidation']['id'] for row in assigned],[str(assistant_liq)],'Member-role Assistant receives only their assigned package in Inbox')
receipt_path=assigned[0]['receipts'][0]['file_path']
equal(sql(c,'select can_read_independent_review_receipt(%s)',(receipt_path,)),True,'Assigned current reviewer can read the receipt evidence')
sql(c,'reset role');sql(c,"insert into storage.objects(bucket_id,name,owner_id) values('budget-receipts',%s,%s)",(receipt_path,fid(4)))
actor(c,7);equal(sql(c,'select count(*) from storage.objects where name=%s',(receipt_path,)),1,'Storage RLS exposes the assigned pending evidence to a Member-role reviewer')
equal(sql(c,'select can_read_independent_review_receipt(%s)',('other-office/unrelated.pdf',)),False,'Review access does not expose arbitrary evidence')
actor(c,5);equal(sql(c,'select list_my_independent_liquidation_reviews()'),[],'Ordinary unappointed Member has no independent review feed')
actor(c,7);sql(c,'select decide_liquidation_independent_review(%s,1,%s,%s,%s)',(assistant_liq,'approved','Assistant independently verified',str(uuid.uuid4())))
equal(sql(c,'select list_my_independent_liquidation_reviews()'),[],'Completed review leaves the assigned action queue')
equal(sql(c,'select can_read_independent_review_receipt(%s)',(receipt_path,)),False,'Completed review cannot mint new review-only evidence URLs')
equal(sql(c,'select count(*) from storage.objects where name=%s',(receipt_path,)),0,'Review-only storage access ends with the assigned pending review')
denied(7,"select settle_accounting_liquidation(%s,true,'Assistant cannot post')",(assistant_liq,))
settle_for(6,assistant_liq)(c)
sql(c,'reset role')
equal(sql(c,'select count(*) from eflow_finance_review.events where review_id=%s',(review,)),2,'Route and decision audit events retained')
equal(sql(c,"select has_function_privilege('anon','public.route_liquidation_independent_review(uuid,integer,uuid,text,uuid)','execute')"),False,'Anonymous routing has no grant')
equal(sql(c,"select has_function_privilege('authenticated','eflow_finance_review.settle_accounting_liquidation(uuid,boolean,text)','execute')"),False,'Private writer cannot bypass wrapper')

# Q13: corrections and rejected review preserve the advance and old version,
# then require a new independent review for the worker's resubmitted version.
for independent_decision in ['changes_requested','rejected']:
    _,returned_request,returned_liq=package(4)
    actor(c,4);sql(c,'select route_liquidation_independent_review(%s,1,%s,%s,%s)',(returned_liq,fid(2),'QA independent correction',str(uuid.uuid4())))
    actor(c,2);sql(c,'select decide_liquidation_independent_review(%s,1,%s,%s,%s)',(returned_liq,independent_decision,'QA receipt correction required',str(uuid.uuid4())))
    sql(c,'reset role')
    equal(sql(c,'select status from petty_cash_requests where id=%s',(returned_request,)),'changes_requested','Declined independent review preserves cash liability')
    equal(sql(c,"select count(*) from general_journal_entries where source_type='liquidation' and source_id=%s",(returned_liq,)),0,'Declined review never posts')
    actor(c,4);day=sql(c,"select (now() at time zone 'Asia/Manila')::date::text")
    revised_receipt=[{'vendor':'Synthetic QA store','receiptNumber':str(uuid.uuid4()),'receiptDate':day,'description':'Revised QA receipt','amount':80,'fileName':'revised.pdf','filePath':fid(100)+'/'+str(returned_request)+'/revised.pdf','mimeType':'application/pdf','fileSize':12}]
    revised=sql(c,'select submit_accounting_cash_liquidation(%s,80,%s,%s::jsonb,%s,%s,%s::date)',(returned_request,'QA corrected submission',Json(revised_receipt),str(uuid.uuid4()),'QA-REVISED-20',day))
    equal(sql(c,'select version from petty_cash_liquidations where id=%s',(revised,)),2,'Resubmission creates a new immutable version')
    context=sql(c,'select get_liquidation_independent_review(%s)',(revised,))
    equal((context['required'],context['review']),(True,None),'New receipt version does not inherit the previous independent decision')
    denied(6,"select settle_accounting_liquidation(%s,true,'Cannot bypass renewed review')",(revised,))
    actor(c,4);sql(c,'select route_liquidation_independent_review(%s,2,%s,%s,%s)',(revised,fid(2),'QA corrected version routed',str(uuid.uuid4())))
    actor(c,2);sql(c,'select decide_liquidation_independent_review(%s,2,%s,%s,%s)',(revised,'approved','QA corrected version reviewed',str(uuid.uuid4())))
    if independent_decision=='rejected':
        # Test-only deadline fixture: conflict approval cannot replace the
        # existing, separate late-package Head authorization.
        sql(c,'reset role');sql(c,"update petty_cash_requests set liquidation_due_at=now()-interval '1 day' where id=%s",(returned_request,))
        denied(6,"select settle_accounting_liquidation(%s,true,'Late authorization still required')",(revised,))
        actor(c,2);sql(c,"select decide_petty_cash_liquidation(%s,true,'QA separate late authorization')",(revised,))
    settle_for(6,revised)(c)
    sql(c,'reset role')
    equal(sql(c,'select status from liquidation_independent_reviews where liquidation_id=%s',(returned_liq,)),independent_decision,'Original independent decision remains in history')

# C04: independent cash release and requester cancellation on the same record.
_,cancel_request,cancel_release=make_request()
def cancel_for(client):
    actor(client,5)
    return sql(client,'select cancel_contextual_cash_request(%s,%s)',(cancel_request,'QA competing cancellation'))
race('C04 release versus cancellation',[release_for(cancel_release),cancel_for],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'Cash release and cancellation cannot both commit'))
equal(sql(c,"select not (r.status='cancelled' and x.status='released') from petty_cash_requests r join petty_cash_releases x on x.request_id=r.id where x.id=%s",(cancel_release,)),True,'No released-but-cancelled record')

# C05: corrections and settlement serialize the exact same receipt version.
_,_,correction_liq=package()
denied(6,'select settle_accounting_liquidation(%s,null,null)',(correction_liq,),'22023')
def correct_for(client):
    actor(client,6)
    return sql(client,'select settle_accounting_liquidation(%s,false,%s)',(correction_liq,'QA correction requested before posting'))
race('C05 correction versus settlement',[settle_for(6,correction_liq),correct_for],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'One receipt-version decision commits'))
equal(sql(c,"select (l.status='approved')=(exists(select 1 from general_journal_entries j where j.source_type='liquidation' and j.source_id=l.id)) from petty_cash_liquidations l where l.id=%s",(correction_liq,)),True,'Only an approved immutable package has a settlement journal')

# C07 uses an owner-level local trigger probe, not a fabricated UI permission:
# even bypassing RLS cannot shrink a source under an existing reservation.
cap_work=task(1000)
actor(c,5)
cap_request=sql(c,"select create_contextual_cash_request(%s,null,%s,100,'QA cap contention',null,%s)",(cap_work[0],cap_work[1],str(uuid.uuid4())))
def shrink_cap(client):
    return sql(client,'update work_budget_allocation_lines set amount=50,unit_cost=50 where id=%s returning amount',(cap_work[1],))
race('C07 allocation shrink versus approved cash',[approve(cap_request),shrink_cap],
 lambda outcomes: equal(sum(result=='error' for result,_ in outcomes),1,'Reserved cash protects its source cap'))
equal(sql(c,'select amount>=100 from work_budget_allocation_lines where id=%s',(cap_work[1],)),True,'Allocation still covers the cash hold')

# C08: independent foreign Office identities and ordinary Members cannot read,
# route, decide or post the first Office's package through direct RPC calls.
sql(c,"""insert into organizations(id,name,slug,path,org_type) values (%s,'Second synthetic Office','second-native','second_native','department');
 insert into auth.users(id,email,email_confirmed_at) values (%s,'otherhead@native.test',now()),(%s,'otheracct@native.test',now());
 insert into profiles(id,email,full_name,employee_id,role,is_active,org_id) values
 (%s,'otherhead@native.test','Other Head','nf8','member',true,%s),(%s,'otheracct@native.test','Other Accounting','nf9','member',true,%s);""",(fid(101),fid(8),fid(9),fid(8),fid(101),fid(9),fid(101)))
actor(c,1);sql(c,'select set_organization_leadership(%s,%s,null)',(fid(101),fid(8)))
actor(c,8);sql(c,'select set_department_accounting_staff(%s,true)',(fid(9),))
_,_,foreign_liq=package(4)
for who in [1,5,8,9]:
    denied(who,'select get_liquidation_independent_review(%s)',(foreign_liq,))
    denied(who,'select route_liquidation_independent_review(%s,1,%s,%s,%s)',(foreign_liq,fid(2),'Forbidden foreign route',str(uuid.uuid4())))
    denied(who,"select settle_accounting_liquidation(%s,true,'Forbidden foreign settlement')",(foreign_liq,))
sql(c,'reset role')
equal(sql(c,'select count(*) from liquidation_independent_reviews where liquidation_id=%s',(foreign_liq,)),0,'Foreign attempts create no review rows')
race('C08 concurrent foreign Office financial calls',[settle_for(8,foreign_liq),settle_for(9,foreign_liq)],
 lambda outcomes: equal(outcomes,[('error','42501'),('error','42501')],'Both foreign Office callers are denied'))

# Q13: appointment/conflict/inactive/escalation and stale-version matrix. These
# local identity fixtures never appoint or promote real hosted users.
equal(sql(c,"select eflow_finance_review.eligible_reviewer(jsonb_populate_record(null::public.petty_cash_requests,to_jsonb(r)||jsonb_build_object('requester_id',%s)),%s) from petty_cash_requests r where id=%s",(fid(2),fid(2),conflict_request)),False,'Head cannot independently review their own request')
equal(sql(c,"select eflow_finance_review.eligible_reviewer(jsonb_populate_record(null::public.petty_cash_requests,to_jsonb(r)||jsonb_build_object('requester_id',%s)),%s) from petty_cash_requests r where id=%s",(fid(2),fid(7),conflict_request)),True,'Independent appointed Assistant remains an eligible fallback')
actor(c,1)
try:
    sql(c,'update profiles set is_active=false where id=%s',(fid(2),))
    raise AssertionError('An appointed Head was deactivated without clearing their appointment')
except psycopg2.Error as exc:equal(exc.pgcode,'23514','Leadership integrity already prevents an inactive appointed Head')
# Local appointment-matrix fixture only: the existing global appointment setter
# touches task reviewer rows and conflicts with its Admin read-only trigger.
# That separate baseline defect is documented, not bypassed in application code.
sql(c,'reset role');sql(c,'update organizations set head_user_id=null,assistant_head_user_id=null where id=%s',(fid(100),))
set_active_people([fid(7)],False)
actor(c,4);no_reviewer=sql(c,'select get_liquidation_independent_review(%s)',(foreign_liq,))
equal((no_reviewer['candidates'],no_reviewer['escalationRequired']),([],True),'No active reviewer produces explicit escalation')
sql(c,'reset role');sql(c,'update organizations set head_user_id=%s where id=%s',(fid(2),fid(100)))
set_active_people([fid(7)],True)
sql(c,'update organizations set assistant_head_user_id=%s where id=%s',(fid(7),fid(100)))
set_active_people([fid(6)],False)
actor(c,4);no_settler=sql(c,'select get_liquidation_independent_review(%s)',(foreign_liq,))
equal((no_settler['eligibleSettlers'],no_settler['escalationRequired']),(0,True),'No separate eligible Accounting Officer produces escalation')
set_active_people([fid(6)],True)
denied(4,'select route_liquidation_independent_review(%s,null,%s,%s,%s)',(foreign_liq,fid(2),'Missing version',str(uuid.uuid4())),'22023')
actor(c,4);sql(c,'select route_liquidation_independent_review(%s,1,%s,%s,%s)',(foreign_liq,fid(2),'QA stale review',str(uuid.uuid4())))
sql(c,'reset role');sql(c,"update liquidation_independent_reviews set fingerprint='stale-local-fixture' where liquidation_id=%s",(foreign_liq,))
denied(2,'select decide_liquidation_independent_review(%s,1,%s,%s,%s)',(foreign_liq,'approved','Cannot approve stale receipt metadata',str(uuid.uuid4())),'22023')
denied(2,'select decide_liquidation_independent_review(%s,1,null,%s,%s)',(foreign_liq,'Missing decision',str(uuid.uuid4())),'22023')

# C09: pause a release after its initial authorization at the fiscal lock.
# Remove the role through the real Head RPC, then allow the writer to resume.
# The original installed release body lacks the final authority recheck.
_,revoked_request,revoked_release=make_request()
revocation_started_at=datetime.datetime.now(datetime.timezone.utc).isoformat()
blocker=connect();blocker.autocommit=False
sql(blocker,'select id from department_fiscal_budgets where id=%s for update',(budget,))
worker=connect();worker_pid=sql(worker,'select pg_backend_pid()')
sql(c,'reset role')
def pending_release():
    try: release_for(revoked_release)(worker);return ('ok',None)
    except psycopg2.Error as exc:return ('error',exc.pgcode)
with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
    future=pool.submit(pending_release)
    try:
        deadline=time.monotonic()+8
        while not sql(c,"select wait_event_type='Lock' from pg_stat_activity where pid=%s",(worker_pid,)):
            assert time.monotonic()<deadline,'Release did not reach the controlled financial lock wait'
            time.sleep(.025)
        actor(c,2);sql(c,'select set_department_accounting_staff(%s,false)',(fid(6),))
    finally:blocker.rollback();blocker.close()
    revoked_outcome=future.result(timeout=15)
worker.close();sql(c,'reset role')
equal(revoked_outcome,('error','42501'),'Revoked Accounting role cannot commit a pending cash release')
equal(sql(c,"select status from petty_cash_releases where id=%s",(revoked_release,)),'scheduled','Revocation rolls back the physical-release record')
equal(sql(c,"select count(*) from general_journal_entries where source_type='cash_release' and source_id=%s",(revoked_release,)),0,'Revocation leaves no partial journal')
case_receipts.append({'case':'C09 revocation during fiscal lock wait','started_at':revocation_started_at,
 'completed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actors':{'revoker':fid(2),'release_actor':fid(6)},
 'outcomes':[{'result':revoked_outcome[0],'sqlstate':revoked_outcome[1]}],'final_ledger':ledger_snapshot()})
actor(c,2);sql(c,'select set_department_accounting_staff(%s,true)',(fid(6),))

# C10: two future tranches compete for the one remaining daily slot. Local
# owner changes below configure the synthetic clock/cap; both releases use RPC.
_,_,early_a=make_request();_,_,early_b=make_request()
sql(c,'reset role')
sql(c,"update petty_cash_releases set scheduled_date=(now() at time zone 'Asia/Manila')::date+1 where id=any(%s::uuid[])",([early_a,early_b],))
used=sql(c,"select coalesce(sum(amount),0) from petty_cash_releases where org_id=%s and ((status='released' and (released_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date) or(status='scheduled' and scheduled_date=(now() at time zone 'Asia/Manila')::date))",(fid(100),))
sql(c,'update department_fiscal_budgets set daily_petty_cash_release_limit=%s where id=%s',(used+100,budget))
def early(release_id):
    def operation(client):
        actor(client,6)
        return sql(client,"select override_accounting_petty_cash_release_schedule(%s,'QA justified early release','cash',null)",(release_id,))
    return operation
race('C10 competing audited early releases',[early(early_a),early(early_b)],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'Only one override fits the remaining daily ceiling'))
equal(sql(c,"select count(*) from petty_cash_releases where id=any(%s::uuid[]) and status='released'",([early_a,early_b],)),1,'One effective early release')
sql(c,'update department_fiscal_budgets set daily_petty_cash_release_limit=30000 where id=%s',(budget,))

# Multi-day split scheduling still uses the same daily bucket as normal and
# audited early releases. This complements the genuine competing-override race.
split_work=task(16000)
split_request=request_operation(split_work,str(uuid.uuid4()),15050)(c)
# request_operation's second source is 20, so use its valid 15,070 total; lower
# the temporary synthetic ceiling to force split scheduling without inventing
# a different request payload or bypassing a source cap.
sql(c,'reset role');sql(c,'update department_fiscal_budgets set daily_petty_cash_release_limit=5000 where id=%s',(budget,))
approve(split_request)(c);sql(c,'reset role')
equal(sql(c,'select count(*)>=3 from petty_cash_releases where request_id=%s',(split_request,)),True,'A large approved request splits across calendar days')
equal(sql(c,'select sum(amount)::numeric=15070 from petty_cash_releases where request_id=%s',(split_request,)),True,'Split tranches exactly equal the approved amount')
equal(sql(c,"select not exists(select 1 from petty_cash_releases where org_id=%s and status='scheduled' group by scheduled_date having sum(amount)>5000)",(fid(100),)),True,'Each scheduled day remains within its synthetic ceiling')
sql(c,'update department_fiscal_budgets set daily_petty_cash_release_limit=30000 where id=%s',(budget,))

# C01: genuine Head sessions authorize two different tasks against the same
# source's remaining appropriation. The winner consumes 60%; both cannot fit.
actor(c,2)
unfunded=[sql(c,'select (phase3_create_task(%s,%s,%s)).id',(project,group,'QA appropriation race '+str(index))) for index in range(2)]
for work_id in unfunded:sql(c,'select assign_task(%s,%s,%s)',(work_id,fid(5),'Lead'))
sql(c,'reset role')
remaining=sql(c,'select amount-held_amount-eflow_budget.partition_committed(id) from office_budget_sections where id=%s',(fid(200),))
each=round(float(remaining)*0.6,2)
def authorize(work_id):
    def operation(client):
        actor(client,2)
        return sql(client,'select fund_office_work(%s,2026,%s::jsonb,%s,%s)',(work_id,Json([{'partitionId':fid(200),'amount':float(each)}]),'QA source contention',str(uuid.uuid4())))
    return operation
race('C01 competing appropriation authorizations',[authorize(work_id) for work_id in unfunded],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'Only one commitment fits the remaining appropriation'))
equal(sql(c,'select eflow_budget.partition_committed(id)<=amount-held_amount from office_budget_sections where id=%s',(fid(200),)),True,'Committed never exceeds available appropriation')

# Q12: targeted trigger-invariant fixture. All original authority triggers are
# independently retained; only in this disposable server are they suspended to
# seed approved history without fabricating evidence approvals through the API.
sql(c,'alter table tasks disable trigger user')
dep_project=str(project)
a,b=str(uuid.uuid4()),str(uuid.uuid4())
sql(c,"insert into tasks(id,title,status,org_id,linked_project_id,dependency_ids) values (%s,'QA prerequisite','completed',%s,%s,'{}'),(%s,'QA dependent','in_progress',%s,%s,array[%s]::uuid[])",(a,fid(100),project,b,fid(100),project,a))
sql(c,'alter table tasks enable trigger tasks_00_dependency_completion;alter table tasks enable trigger tasks_01_prerequisite_lifecycle')
def change(task_id,status):
    def operation(client):
        return sql(client,'update tasks set status=%s where id=%s returning status',(status,task_id))
    return operation
race('Q12 dependent approval versus prerequisite reopening',[change(b,'completed'),change(a,'in_progress')],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'Final approval and prerequisite reopen cannot both commit'))
sql(c,'reset role')
equal(sql(c,"select not exists(select 1 from tasks d join tasks p on p.id=any(d.dependency_ids) where d.id=%s and d.status in ('for_review','completed') and p.status<>'completed')",(b,)),True,'No invalid approved dependent')
sql(c,"update tasks set status='in_progress' where id=%s",(b,))
sql(c,"update tasks set status='completed' where id=%s",(a,))
sql(c,"update tasks set status='for_review' where id=%s",(b,))
try:
    sql(c,'update tasks set deleted_at=now() where id=%s',(a,))
    raise AssertionError('Deleting a prerequisite with submitted dependent succeeded')
except psycopg2.Error as exc:
    equal(exc.pgcode,'22023','Submitted dependent blocks prerequisite soft deletion')
sql(c,"update tasks set status='in_progress' where id=%s",(b,))
sql(c,"update tasks set status='in_progress' where id=%s",(a,))
equal(sql(c,'select status from tasks where id=%s',(a,)),'in_progress','Reopen dependent first, then prerequisite')
sql(c,'alter table tasks enable trigger user')

# Q02: exact reviewed pending security migration, applied only after recording
# the original exposure. A rolled-back anonymous probe cannot alter fixtures.
security_path=pending.parent/'20261021175217_financial_rpc_grants_and_search_paths.sql'
security_before=sql(c,"select has_function_privilege('anon','public.schedule_petty_cash_releases(uuid,uuid)','execute')")
equal(security_before,True,'Original scheduler was exposed anonymously')
probe_work=task(1000)
probe_request=request_operation(probe_work,str(uuid.uuid4()),10)(c)
sql(c,'reset role');c.autocommit=False
anonymous_probe={'case':'Q02 original anonymous scheduler','rolled_back':True}
try:
    sql(c,"select set_config('request.jwt.claim.sub','',false);set local role anon")
    anonymous_probe['scheduled_amount']=str(sql(c,'select schedule_petty_cash_releases(%s,%s)',(probe_request,fid(2))))
    anonymous_probe['unauthorized_mutation_succeeded']=True
except psycopg2.Error as exc:
    anonymous_probe['unauthorized_mutation_succeeded']=False;anonymous_probe['sqlstate']=exc.pgcode
finally:c.rollback();c.autocommit=True
sql(c,'reset role');print(json.dumps(anonymous_probe),flush=True)
equal(sql(c,'select status from petty_cash_requests where id=%s',(probe_request,)),'pending_department_approval','Anonymous diagnostic did not retain a mutation')
sql(c,security_path.read_text(encoding='utf-8'))
equal(sql(c,"select has_function_privilege('anon','public.schedule_petty_cash_releases(uuid,uuid)','execute')"),False,'Internal scheduling is not an anonymous RPC')
equal(sql(c,"select has_function_privilege('authenticated','public.schedule_petty_cash_releases(uuid,uuid)','execute')"),False,'A caller cannot impersonate an approval actor through internal scheduling')
for identity in ['create_org_chat_channel()','prevent_self_privilege_escalation()','update_updated_at()','sync_task_subtask_counts()','set_user_preferences_updated_at()','touch_updated_at()','collaboration_storage_draft_id(text)','is_channel_member(uuid,uuid)','ensure_org_chat_channel()']:
    equal(sql(c,"select 'search_path=\"\"'=any(proconfig) from pg_proc where oid=%s::regprocedure",('public.'+identity,)),True,'Fixed search path: '+identity)
sql(c,"select set_config('request.jwt.claim.sub','',false);set role anon")
for statement,args in [('select schedule_petty_cash_releases(%s,%s)',(foreign_liq,fid(2))),('select run_department_budget_maintenance()',None)]:
    try:sql(c,statement,args);raise AssertionError('Anonymous privileged RPC succeeded')
    except psycopg2.Error as exc:equal(exc.pgcode,'42501','Anonymous privileged RPC denied')
sql(c,'reset role')
new_work,new_request,new_release=make_request()
equal(new_release is not None,True,'Real Head approval still calls the internal scheduler after grant hardening')
key=str(uuid.uuid4())
equal_retries=race('C06 equal idempotent payloads',[request_operation(new_work,key,10),request_operation(new_work,key,10)],
 lambda outcomes: equal([result for result,_ in outcomes],['ok','ok'],'Equal retries both receive an accepted result'))
equal(equal_retries[0][1],equal_retries[1][1],'Equal retries share one persisted request identity')
key=str(uuid.uuid4())
race('C06 changed concurrent idempotent payloads',[request_operation(new_work,key,11),request_operation(new_work,key,12)],
 lambda outcomes: equal(sum(result=='ok' for result,_ in outcomes),1,'Changed payload with same command key cannot double reserve'))
actor(c,5)
equal(isinstance(sql(c,'select run_department_budget_maintenance()'),int),True,'Ordinary active Office login maintenance remains compatible')
set_active_people([fid(9)],False)
denied(9,'select run_department_budget_maintenance()',None)
sql(c,'reset role')

print(json.dumps({'remediation_cases':case_receipts,'checks_so_far':checks,'hosted_writes':False},default=str))
