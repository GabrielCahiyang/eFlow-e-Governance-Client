"""Rollback-only acceptance for the independent office imprest. No live test data retained."""
import json,socket,uuid,argparse
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--installed',action='store_true');parser.add_argument('--starting-fund',action='store_true');parser.add_argument('--candidate-delta',action='store_true');args=parser.parse_args()
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor();checks=[]
def q(s,a=None):
 c.execute(s,a);return c.fetchone()[0] if c.description else None
def actor(uid):
 q('reset role');q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));q('set local role authenticated')
def check(name,value):
 assert value,name;checks.append(name);print('PASS',name,flush=True)
def deny(name,fn):
 q('savepoint denied')
 try:fn()
 except psycopg2.Error:q('rollback to savepoint denied');check(name,True);return
 q('rollback to savepoint denied');raise AssertionError(name)
office='fdd4dfee-bbc3-42b4-9dcf-a9612c428460'
try:
 if not args.installed:c.execute((root/'supabase/migrations/20261031094730_office_petty_cash_fund.sql').read_text(encoding='utf-8'))
 if args.candidate_delta:
  assert args.starting_fund
  c.execute((root/'supabase/migrations/20261031140336_automatic_office_petty_cash_starting_fund.sql').read_text(encoding='utf-8'))
 protected=['projects','tasks','subtasks','department_fiscal_budgets','office_budget_sections','work_budget_allocation_lines','petty_cash_requests','budget_commitments']
 def fingerprint():return {table:q("select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from public."+table+' t') for table in protected}
 before=fingerprint()
 c.execute("select id,role from public.profiles where org_id=%s and is_active",(office,));people=c.fetchall();head=next(i for i,r in people if r=='head');worker=next(i for i,r in people if r=='member');account=next(i for i,r in people if r=='accounting_staff')
 def command(action,data,key=None):return q('select public.office_petty_cash_command(%s,%s,%s,%s)',(office,key or str(uuid.uuid4()),action,Json(data)))
 def snap():return q('select public.office_petty_cash_snapshot(%s)',(office,))
 # Fresh private test office fund only, inside rollback. Do not disturb public work.
 q('delete from eflow_office_cash.commands');q('delete from eflow_office_cash.events where office=%s',(office,));q('delete from eflow_office_cash.requests where office=%s',(office,));q('delete from eflow_office_cash.funds where office=%s',(office,))
 actor(worker);check('new fund starts with 30000 without a deposit' if args.starting_fund else 'new fund starts unfunded',snap()['cash']==(30000 if args.starting_fund else 0))
 if args.starting_fund:
  check('reopening fund never adds a second starting balance',snap()['cash']==30000 and snap()['available']==30000)
  actor(account);check('one automatic starting fund event',len(snap()['events'])==1 and snap()['events'][0]['action']=='initialize')
  actor(worker)
 deny('member cannot replenish',lambda:command('replenish',{'amount':30000,'reference':'initial'}))
 actor(head);deny('Head cannot replenish',lambda:command('replenish',{'amount':30000,'reference':'initial'}))
 actor(account)
 if not args.starting_fund:
  key=str(uuid.uuid4());command('replenish',{'amount':30000,'reference':'initial'},key);command('replenish',{'amount':30000,'reference':'initial'},key)
  check('Accounting initializes 30000 once',snap()['cash']==30000)
  deny('same key cannot change amount',lambda:command('replenish',{'amount':1,'reference':'initial'},key))
 deny('fund ceiling enforced',lambda:command('replenish',{'amount':1,'reference':'over'}))
 actor(worker);k=str(uuid.uuid4());command('request',{'amount':6000,'reference':'Office supplies'},k);command('request',{'amount':6000,'reference':'Office supplies'},k)
 check('request reserves once without releasing',snap()['available']==24000 and snap()['cash']==30000 and len(snap()['requests'])==1)
 deny('request cannot overspend fund',lambda:command('request',{'amount':25000,'reference':'excess'}))
 deny('requester cannot self approve',lambda:command('approve',{'request':k,'reference':'self'}))
 actor(head);command('reject',{'request':k,'reference':'Revise purchase'});check('rejection returns reservation',snap()['available']==30000)
 actor(worker);k=str(uuid.uuid4());command('request',{'amount':6000,'reference':'Revised supplies'},k)
 actor(head);command('approve',{'request':k,'reference':'Approved office supplies'});check('approval not a cash release',snap()['cash']==30000)
 deny('Head cannot release',lambda:command('release',{'request':k,'reference':'release'}))
 actor(account);command('release',{'request':k,'reference':'PCV-TEST'});check('release reduces fund and tracks advance',snap()['cash']==24000 and snap()['outstanding']==6000)
 deny('outstanding advances cannot be replenished',lambda:command('replenish',{'amount':6000,'reference':'premature'}))
 deny('cash cannot be released twice',lambda:command('release',{'request':k,'reference':'again'}))
 q('reset role');path=k+'/receipt1';path2=k+'/receipt2'
 for path_ in [path,path2]:q("insert into storage.objects(bucket_id,name,owner_id) values('office-petty-receipts',%s,%s)",(path_,str(worker)))
 today=str(q("select (now() at time zone 'Asia/Manila')::date"));receipts=[{'vendor':'Test Vendor','number':'OR-1','date':today,'amount':4000,'path':path},{'vendor':'Test Vendor','number':'OR-2','date':today,'amount':1000,'path':path2}]
 actor(worker);deny('5000 receipt hard cap',lambda:command('receipts',{'request':k,'reference':'oversize','receipts':[{**receipts[0],'amount':5001}]}))
 q('savepoint exact_receipt_limit');command('receipts',{'request':k,'reference':'Exact maximum receipt','receipts':[{**receipts[0],'amount':5000}]});check('exact 5000 receipt accepted',snap()['requests'][0]['status']=='receipt_review');q('rollback to savepoint exact_receipt_limit')
 deny('receipt file required',lambda:command('receipts',{'request':k,'reference':'missing file','receipts':[{**receipts[0],'path':k+'/missing'}]}))
 deny('duplicate receipt rejected',lambda:command('receipts',{'request':k,'reference':'duplicate','receipts':[receipts[0],receipts[0]]}))
 command('receipts',{'request':k,'reference':'Receipts submitted','receipts':receipts})
 actor(account);deny('Accounting cannot bypass receipt endorsement',lambda:command('settle',{'request':k,'reference':'shortcut'}))
 actor(head);command('return_receipts',{'request':k,'reference':'Please verify receipt numbers'})
 actor(worker);command('receipts',{'request':k,'reference':'Receipt numbers checked','receipts':receipts})
 actor(head);command('endorse',{'request':k,'reference':'Receipts checked'})
 deny('Head cannot settle',lambda:command('settle',{'request':k,'reference':'shortcut'}))
 actor(account);command('settle',{'request':k,'reference':'OR refund 1000 confirmed'})
 check('settlement returns unused cash and clears advance',snap()['cash']==25000 and snap()['outstanding']==0 and snap()['replenishable']==5000)
 refill=str(uuid.uuid4());command('replenish',{'amount':3000,'reference':'Partial replenishment 1'},refill);command('replenish',{'amount':3000,'reference':'Partial replenishment 1'},refill);check('partial replenishment supported and retried once',snap()['cash']==28000)
 deny('same replenishment key cannot change amount',lambda:command('replenish',{'amount':1,'reference':'Partial replenishment 1'},refill))
 deny('duplicate reference cannot refill even with capacity',lambda:command('replenish',{'amount':1,'reference':'Partial replenishment 1'}))
 command('replenish',{'amount':2000,'reference':'Partial replenishment 2'});check('replenishment restores 30000 without resetting receipts',snap()['cash']==30000 and snap()['requests'][0]['status']=='settled' and len(snap()['events'])>10)
 deny('duplicate replenishment reference rejected',lambda:command('replenish',{'amount':1,'reference':'Partial replenishment 1'}))
 actor(worker);k2=str(uuid.uuid4());command('request',{'amount':30000,'reference':'Exhaust fund'},k2);check('entire pool can be reserved',snap()['available']==0)
 deny('exhausted pool blocks requests',lambda:command('request',{'amount':1,'reference':'overdraw'}))
 command('cancel',{'request':k2,'reference':'Cancel full reservation'});check('cancellation restores availability',snap()['available']==30000)
 k3=str(uuid.uuid4());command('request',{'amount':1000,'reference':'Unused advance'},k3)
 actor(head);command('approve',{'request':k3,'reference':'Approved'})
 actor(account);command('release',{'request':k3,'reference':'Release unused'})
 actor(worker);command('receipts',{'request':k3,'reference':'Nothing spent; entire advance returned','receipts':[]})
 actor(head);command('endorse',{'request':k3,'reference':'No expenditure verified'})
 actor(account);command('settle',{'request':k3,'reference':'Full cash return confirmed'});check('full unspent advance can be returned without fake receipts',snap()['cash']==30000 and snap()['outstanding']==0)
 q('reset role');check('office petty cash never changes task/project/annual funding',fingerprint()==before)
 actor(worker)
 deny('member cannot alter private fund table',lambda:q('update eflow_office_cash.funds set cash=1 where office=%s',(office,)))
 deny('foreign office rejected',lambda:q('select public.office_petty_cash_snapshot(%s)',(str(uuid.uuid4()),)))
 q('set local role anon');deny('anonymous rejected',lambda:q('select public.office_petty_cash_snapshot(%s)',(office,)))
finally:cn.rollback();cn.close()
folder=root/('docs/office-cash-starting-fund-2026-10-31' if args.starting_fund else 'docs/office-petty-cash-2026-10-31');folder.mkdir(parents=True,exist_ok=True);(folder/('CANDIDATE_CHECKS.json' if args.candidate_delta or not args.installed else 'INSTALLED_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2));print('PASS',len(checks),'checks; all test writes rolled back')
