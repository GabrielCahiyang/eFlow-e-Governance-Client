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
office='fdd4dfee-bbc3-42b4-9dcf-a9612c428460';year=2198
settings={'dailyReleaseLimit':30000,'perReceiptLimit':5000,'liquidationDueDays':15,'allowReceiptOverride':False,'threshold':75,'notes':'Rollback acceptance'}
account=str(uuid.uuid4());other=str(uuid.uuid4());rows=[{'id':account,'name':'Meeting supplies','amount':30000,'heldAmount':0,'position':0}]
try:
 if not args.installed:c.execute((root/'supabase/migrations/20261101015139_head_budget_versions_and_adjustment_guards.sql').read_text(encoding='utf-8'))
 head=q('select head_user_id from public.organizations where id=%s',(office,));worker=q("select id from public.profiles where org_id=%s and is_active and role='member' limit 1",(office,));accountant=q("select id from public.profiles where org_id=%s and is_active and role='accounting_staff' limit 1",(office,))
 assert not q('select exists(select 1 from public.department_fiscal_budgets where org_id=%s and fiscal_year=%s)',(office,year))
 actor(head)
 def snap():return q('select public.get_office_budget_sections(%s,%s)',(office,year))
 def save(new,reason='Approved adjustment',version=None):return q('select public.save_office_budget_sections(%s,%s,%s,%s,%s,%s)',(office,year,Json(new),snap()['version'] if version is None else version,reason,Json(settings)))
 bid=save(rows,None,0);check('draft has no locked versions',snap()['versions']==[])
 q('select public.lock_department_fiscal_budget(%s)',(bid,));check('initial lock is V1',snap()['versions'][0]['version']==1 and snap()['versions'][0]['total']==30000)
 check('appointed Head can adjust',snap()['canAdjust'])
 def project(name,amount):
  p=q('select to_jsonb(public.create_project_with_details(%s))',(Json({'title':name,'org_id':office,'status':'planning'}),))
  q('select public.save_project_definition(%s,%s)',(p['id'],Json({'version':p['updated_at'],'title':name,'description':'Rollback only','scope':'Budget protection','lead':str(head),'start':f'{year}-01-01','end':f'{year}-12-31','noFunding':False})))
  q('select public.authorize_project_funding(%s,%s,%s,%s)',(p['id'],Json([{'partitionId':account,'amount':amount}]),'QA rollback funding',str(uuid.uuid4())))
  return p['id']
 project('QA Project 1',20000)
 source=snap()['sections'][0];check('project reservation is exposed by name and exact amount',source['protectedAmount']==20000 and source['reservations'][0]['name']=='QA Project 1')
 details=deny('19000 rejected against 20000 committed',lambda:save([{**rows[0],'amount':19000}]),'minimum allowed')
 check('rejection names the project and its minimum',details['minimum']==20000 and details['sources'][0]['name']=='QA Project 1')
 check('rejected adjustment leaves V1 and 30000 unchanged',len(snap()['versions'])==1 and snap()['versions'][0]['total']==30000)
 stale=snap()['version'];save([{**rows[0],'amount':50000}]);rows[0]['amount']=50000
 q('set constraints all immediate');q('set constraints all deferred')
 check('30000 to 50000 creates V2',snap()['versions'][-1]['version']==2 and snap()['versions'][-1]['total']==50000)
 check('commitment still 20000 and available becomes 30000',snap()['sections'][0]['protectedAmount']==20000 and snap()['sections'][0]['amount']-snap()['sections'][0]['committedAmount']==30000)
 check('V1 accounts remain 30000',snap()['versions'][0]['accounts'][0]['amount']==30000)
 check('V2 includes reason and Head name',snap()['versions'][1]['reason']=='Approved adjustment' and bool(snap()['versions'][1]['actorName']))
 deny('stale version cannot overwrite newer budget',lambda:save([{**rows[0],'amount':60000}],version=stale),'changed')
 deny('no-op save cannot create V3',lambda:save(rows),'No account changes')
 deny('locked changes require a reason',lambda:save([{**rows[0],'amount':60000}],reason=''),'reason')
 project('QA Project 2',5000)
 details=deny('multiple project commitments are protected together',lambda:save([{**rows[0],'amount':24000}]),'minimum allowed')
 check('both projects appear with 25000 total',details['minimum']==25000 and len(details['sources'])==2)
 save([{**rows[0],'amount':25000}]);rows[0]['amount']=25000
 check('reduction to exact protected amount succeeds as V3',snap()['versions'][-1]['version']==3 and snap()['versions'][-1]['total']==25000)
 deny('holding already committed money rejected',lambda:save([{**rows[0],'heldAmount':1}]),'minimum allowed')
 rows.append({'id':other,'name':'New travel account','amount':5000,'heldAmount':0,'position':1});save(rows)
 check('new account after locking creates V4',snap()['versions'][-1]['version']==4 and len([r for r in snap()['sections'] if not r['retired']])==2)
 deny('same total cannot move money out of funded account',lambda:save([{**rows[0],'amount':24999},{**rows[1],'amount':5001}]),'minimum allowed')
 deny('funded account cannot be removed',lambda:save([rows[1]]),'minimum allowed')
 deny('funded account cannot be converted to subtotal',lambda:save([{**rows[0],'amount':0},{**rows[1],'parentId':account,'amount':30000}]),'minimum allowed')
 save([{**rows[0],'name':'Renamed supplies'}]);check('unused account removal and rename create V5',snap()['versions'][-1]['version']==5 and snap()['versions'][-1]['accounts'][0]['name']=='Renamed supplies')
 count=len(snap()['versions'])
 for who,label in [(worker,'Member'),(accountant,'Accounting')]:
  actor(who);check(label+' reads history without adjustment permission',snap()['canAdjust'] is False and len(snap()['versions'])==count)
  deny(label+' cannot adjust through RPC',lambda:save([{**rows[0],'amount':40000}]),'Only the office Head')
  deny(label+' cannot execute private helper',lambda:q('select eflow_budget.account_reservations(%s)',(account,)))
 actor(head);q('set local role anon');deny('anonymous history access denied',lambda:snap())
 q('reset role');q('set constraints all immediate');check('all deferred account/annual balance checks pass',True)
finally:cn.rollback();cn.close()
folder=root/'docs/budget-versions-2026-11-01';folder.mkdir(exist_ok=True);(folder/('INSTALLED_CHECKS.json' if args.installed else 'CANDIDATE_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2));print('PASS',len(checks),'checks; all writes rolled back')
