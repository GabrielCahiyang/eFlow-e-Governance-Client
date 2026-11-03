"""Rollback-only hosted acceptance for Head adjustments and budget history."""
import argparse,json,socket,uuid
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent;parser=argparse.ArgumentParser();parser.add_argument('--installed',action='store_true');args=parser.parse_args()
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor();checks=[]
def q(s,a=None):c.execute(s,a);return c.fetchone()[0] if c.description else None
def actor(who):
 q('reset role');q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(who),'role':'authenticated'}),));q('set local role authenticated')
def check(name,value):assert value,name;checks.append(name);print('PASS',name,flush=True)
def deny(name,fn,pattern=None):
 q('savepoint denied')
 try:fn()
 except psycopg2.Error as error:
  text=str(error);details=error.diag.message_detail;q('rollback to savepoint denied')
  if pattern:assert pattern in text,(name,text)
  check(name,True);return json.loads(details) if details and details.startswith('{') else None
 q('rollback to savepoint denied');raise AssertionError(name)

office='fdd4dfee-bbc3-42b4-9dcf-a9612c428460'
settings={'dailyReleaseLimit':30000,'perReceiptLimit':5000,'liquidationDueDays':15,'allowReceiptOverride':False,'threshold':75,'notes':'Rollback-only release calendar acceptance'}
account=str(uuid.uuid4());one=str(uuid.uuid4());two=str(uuid.uuid4())
try:
 if not args.installed:c.execute((root/'supabase/migrations/20261101130241_office_budget_release_calendar.sql').read_text(encoding='utf-8'))
 head=q('select head_user_id from public.organizations where id=%s',(office,));worker=q("select id from public.profiles where org_id=%s and is_active and role='member' limit 1",(office,));accountant=q("select id from public.profiles where org_id=%s and is_active and role='accounting_staff' limit 1",(office,))
 year=next(y for y in [2025,2024,2023] if not q('select exists(select 1 from public.department_fiscal_budgets where org_id=%s and fiscal_year=%s)',(office,y)))
 rows=[{'id':account,'name':'QA release calendar','amount':30000,'heldAmount':15000,'position':0,'releaseSchedule':[{'id':one,'date':f'{year}-01-01','amount':10000,'status':'pending'},{'id':two,'date':f'{year}-02-01','amount':5000,'status':'pending'}]}]
 actor(head)
 def snap():return q('select public.get_office_budget_sections(%s,%s)',(office,year))
 def save(new=None,version=None):return q('select public.save_office_budget_sections(%s,%s,%s,%s,%s,%s)',(office,year,Json(rows if new is None else new),snap()['version'] if version is None else version,'QA audited change',Json(settings)))
 bid=save(version=0);q('select public.lock_department_fiscal_budget(%s)',(bid,))
 check('multiple dated releases persist and withhold 15000',snap()['sections'][0]['heldAmount']==15000 and len(snap()['sections'][0]['releaseSchedule'])==2)
 check('read response advertises calendar and Head cannot confirm',snap()['releaseScheduleAvailable'] and not snap()['canConfirmReleases'])
 deny('invalid date rejected',lambda:save([{**rows[0],'releaseSchedule':[{'id':one,'date':f'{year}-02-30','amount':1,'status':'pending'}]}]))
 deny('zero amount rejected',lambda:save([{**rows[0],'releaseSchedule':[{'id':one,'date':f'{year}-01-01','amount':0,'status':'pending'}]}]),'positive')
 deny('out of fiscal year date rejected',lambda:save([{**rows[0],'releaseSchedule':[{'id':one,'date':f'{year+1}-01-01','amount':10000,'status':'pending'}]}]),'within fiscal year')
 deny('duplicate schedule IDs rejected',lambda:save([{**rows[0],'releaseSchedule':[rows[0]['releaseSchedule'][0],rows[0]['releaseSchedule'][0]]}]),'unique')
 deny('schedule cannot exceed account appropriation',lambda:save([{**rows[0],'releaseSchedule':[{**rows[0]['releaseSchedule'][0],'amount':31000}]}]),'exceed')
 deny('Head cannot free held money by deleting releases',lambda:save([{**rows[0],'releaseSchedule':[],'heldAmount':0}]),'Accounting must confirm')
 deny('Head cannot confirm releases through RPC',lambda:q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,one,snap()['version'],'QA confirmation')),'Only the office Accounting')
 deny('Head cannot forge confirmation in schedule JSON',lambda:save([{**rows[0],'releaseSchedule':[{**rows[0]['releaseSchedule'][0],'status':'confirmed'},rows[0]['releaseSchedule'][1]]}]),'Only Accounting')
 project=q('select to_jsonb(public.create_project_with_details(%s))',(Json({'title':'QA scheduled availability','org_id':office,'status':'planning'}),))
 q('select public.save_project_definition(%s,%s)',(project['id'],Json({'version':project['updated_at'],'title':'QA scheduled availability','description':'Rollback only','scope':'Verify held funding','lead':str(head),'start':f'{year}-01-01','end':f'{year}-12-31','noFunding':False})))
 def fund():return q('select public.authorize_project_funding(%s,%s,%s,%s)',(project['id'],Json([{'partitionId':account,'amount':16000}]),'QA rollback funding',str(uuid.uuid4())))
 deny('project cannot use money still held for release',lambda:fund(),'available')
 oldversion=snap()['version'];settings['threshold']=88.5;save();check('Head can change Q4 target after lock without account changes',snap()['versions'][-1]['q4Target']==88.5)
 check('target-only edit creates audited version with reason',snap()['versions'][-1]['version']==2 and snap()['versions'][-1]['reason']=='QA audited change')
 settings['threshold']=101;deny('target above 100 rejected',lambda:save(),'0 to 100');settings['threshold']=88.5
 actor(accountant);check('Accounting can confirm but cannot adjust',snap()['canConfirmReleases'] and not snap()['canAdjust'])
 deny('Accounting cannot change Q4 target or schedule',lambda:save(),'Only the office Head')
 deny('stale schedule version rejected',lambda:q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,one,oldversion,'QA confirmation')),'changed')
 q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,one,snap()['version'],'QA confirmation'))
 current=snap();entry=current['sections'][0]['releaseSchedule'][0]
 check('confirmation reduces held balance exactly once',current['sections'][0]['heldAmount']==5000)
 check('confirmation records Accounting identity and reference',entry['status']=='confirmed' and entry['confirmedBy']==str(accountant) and entry['reference']=='QA confirmation')
 check('confirmation does not change appropriation',q('select approved_amount from public.department_fiscal_budgets where id=%s',(bid,))==30000)
 version=current['version'];q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,one,oldversion,'QA retry'))
 check('duplicate confirmation is idempotent even with old revision',snap()['version']==version and snap()['sections'][0]['heldAmount']==5000)
 actor(head);fund();check('project can use confirmed availability',snap()['sections'][0]['protectedAmount']==16000);rows=snap()['sections'];deny('Head cannot edit a confirmed amount',lambda:save([{**rows[0],'releaseSchedule':[{**entry,'amount':9999},rows[0]['releaseSchedule'][1]]}]),'Confirmed releases cannot be edited')
 deny('Head cannot remove confirmed history',lambda:save([{**rows[0],'releaseSchedule':[rows[0]['releaseSchedule'][1]]}]),'history')
 actor(worker);deny('Member cannot confirm through RPC',lambda:q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,two,snap()['version'],'QA')),'Only the office Accounting')
 actor(accountant);deny('Accounting cannot confirm a foreign account',lambda:q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(str(uuid.uuid4()),two,snap()['version'],'QA')),'Only the office Accounting')
 q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,two,snap()['version'],'QA second release'));check('second release becomes available separately',snap()['sections'][0]['heldAmount']==0)
 # A separate future budget proves an early confirmation is rejected server-side.
 actor(head);year=2197;account=str(uuid.uuid4());one=str(uuid.uuid4());rows=[{'id':account,'name':'QA future release','amount':100,'heldAmount':100,'position':0,'releaseSchedule':[{'id':one,'date':'2197-01-01','amount':100,'status':'pending'}]}]
 assert not q('select exists(select 1 from public.department_fiscal_budgets where org_id=%s and fiscal_year=%s)',(office,year))
 bid=save(version=0);q('select public.lock_department_fiscal_budget(%s)',(bid,));actor(accountant)
 deny('future release cannot be confirmed early',lambda:q('select public.confirm_office_budget_release(%s,%s,%s,%s)',(account,one,snap()['version'],'QA future')),'not due')
 q('reset role');check('direct account writes remain unavailable',q("select not has_table_privilege('authenticated','public.office_budget_sections','update')"))
 check('anonymous release execution denied',not q("select has_function_privilege('anon','public.confirm_office_budget_release(uuid,uuid,integer,text)','execute')"))
 q('set constraints all immediate');check('deferred budget invariants pass',True)
finally:cn.rollback();cn.close()
folder=root/'docs/budget-release-calendar-2026-11-01';folder.mkdir(exist_ok=True);(folder/('INSTALLED_CHECKS.json' if args.installed else 'CANDIDATE_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2));print('PASS',len(checks),'checks; all writes rolled back')
