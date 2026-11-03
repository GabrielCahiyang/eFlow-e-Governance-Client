"""Rollback-only annual funding acceptance, including legacy funding compatibility."""
import json,socket,uuid,argparse
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent;parser=argparse.ArgumentParser();parser.add_argument('--installed',action='store_true');args=parser.parse_args();uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor();checks=[]
def q(s,a=None):c.execute(s,a);return c.fetchone()[0] if c.description else None
def actor(uid):
 q('reset role');q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));q('set local role authenticated')
def check(name,value):assert value,name;checks.append(name);print('PASS',name,flush=True)
def deny(name,fn):
 q('savepoint denied')
 try:fn()
 except psycopg2.Error:q('rollback to savepoint denied');check(name,True);return
 q('rollback to savepoint denied');raise AssertionError(name)

office='fdd4dfee-bbc3-42b4-9dcf-a9612c428460';year=2194
try:
 if not args.installed:c.execute((root/'supabase/migrations/20261102182541_task_multiple_budget_accounts.sql').read_text(encoding='utf-8'))
 head=q('select head_user_id from public.organizations where id=%s',(office,));worker=q("select id from public.profiles where org_id=%s and is_active and role='member' limit 1",(office,))
 actor(head);project=q('select to_jsonb(public.create_project_with_details(%s))',(Json({'title':'QA multiple task accounts','org_id':office,'status':'planning'}),));pid=project['id']
 q('select public.save_project_definition(%s,%s)',(pid,Json({'version':project['updated_at'],'title':project['title'],'description':'Rollback only','scope':'One or several budget accounts per task','lead':str(head),'start':f'{year}-01-01','end':f'{year}-12-31','noFunding':False})))
 q('reset role');bid=str(uuid.uuid4());accounts=[str(uuid.uuid4()) for _ in range(3)]
 q("insert into public.department_fiscal_budgets(id,org_id,fiscal_year,status,approved_amount,created_by) values(%s,%s,%s,'locked',60000,%s)",(bid,office,year,head))
 for account,name in zip(accounts,['QA Supplies','QA Travel','QA Logistics']):q("insert into public.office_budget_sections(id,fiscal_budget_id,name,amount,held_amount,created_by) values(%s,%s,%s,20000,0,%s)",(account,bid,name,head))
 actor(head);q('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json([{'partitionId':a,'amount':amount} for a,amount in zip(accounts[:2],[20000,10000])]),'QA authorized accounts',str(uuid.uuid4())))
 q('select public.finish_project_setup(%s)',(pid,));q('select public.phase6_set_members((select id from public.project_offices where project_id=%s and office_id=%s),%s::uuid[])',(pid,office,[str(head),str(worker)]))
 def snap():return q('select public.project_flow_snapshot(%s)',(pid,))
 funds={f['name']:f['id'] for f in snap()['funds']};supplies=funds['QA Supplies'];travel=funds['QA Travel']
 def task(name):
  tid=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s,%s,'todo')",(tid,name,office,pid,worker,[str(worker)],head,f'{year}-06-01',f'{year}-06-30',f'{year}-06-30T23:59:00+08:00'));return tid
 def allocate(t,lines,key=None):return q('select public.allocate_project_task_funding(%s,%s,%s,%s)',(t,Json(lines),'QA task allocation',key or str(uuid.uuid4())))
 first=task('QA single account');allocate(first,[{'sourceId':supplies,'amount':5000}]);check('one account remains supported',snap()['allocated']==5000)
 second=task('QA combined accounts');allocation=allocate(second,[{'sourceId':supplies,'amount':3000},{'sourceId':travel,'amount':2000}]);rows=[x for x in snap()['taskFunding'] if x['taskId']==second]
 check('two accounts combine into one task total',len(rows)==2 and sum(x['amount'] for x in rows)==5000)
 check('snapshot exposes exact account identities',{r['sourceId'] for r in rows}=={supplies,travel} and all(r['fiscalYear']==year for r in rows) and snap()['canExtendTaskFunding'])
 original_ids={r['id'] for r in rows};line=next(r for r in rows if r['sourceId']==supplies)
 actor(worker);sub=str(uuid.uuid4());revision=q("select (public.r7_work_tree(%s)->>'revision')::integer",(second,));q("select public.r7_work_command(%s,%s,%s,'create',%s)",(second,revision,str(uuid.uuid4()),Json({'id':sub,'title':'QA protected subtask','standalone':True,'lead':str(worker),'people':[str(worker)],'due':f'{year}-06-10'})));q('select public.set_subtask_budget_cap(%s,%s,%s,1000,%s,%s)',(second,sub,line['id'],'QA protected cap',str(uuid.uuid4())))
 actor(head);before_line=q('select to_jsonb(l) from public.work_budget_allocation_lines l where id=%s',(line['id'],));before_available=next(x['available'] for x in snap()['taskFunding'] if x['id']==line['id']);key=str(uuid.uuid4())
 q('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json([{'partitionId':accounts[2],'amount':8000}]),'QA additional project account',str(uuid.uuid4())));logistics=next(f['id'] for f in snap()['funds'] if f['name']=='QA Logistics')
 appended=allocate(second,[{'sourceId':logistics,'amount':1500}],key);rows=[x for x in snap()['taskFunding'] if x['taskId']==second]
 check('a funded task can add another account without cancellation',appended==allocation and len(rows)==3 and sum(x['amount'] for x in rows)==6500)
 check('existing allocation line IDs remain unchanged',original_ids.issubset({r['id'] for r in rows}))
 check('existing subtask protection is unchanged',q('select to_jsonb(l) from public.work_budget_allocation_lines l where id=%s',(line['id'],))==before_line and next(x['available'] for x in rows if x['id']==line['id'])==before_available)
 allocate(second,[{'sourceId':logistics,'amount':1500}],key);check('same request retry does not add money twice',sum(x['amount'] for x in snap()['taskFunding'] if x['taskId']==second)==6500)
 deny('request key cannot be reused for different amounts',lambda:allocate(second,[{'sourceId':logistics,'amount':1600}],key))
 deny('existing task account cannot be selected again',lambda:allocate(second,[{'sourceId':supplies,'amount':100}]))
 third=task('QA source limit');deny('source limit includes allocations to other tasks',lambda:allocate(third,[{'sourceId':supplies,'amount':13000}]))
 check('rejected allocation leaves both balances unchanged',snap()['allocated']==11500 and next(f['available'] for f in snap()['funds'] if f['id']==supplies)==12000)
 allocate(third,[{'sourceId':supplies,'amount':12000}]);check('exact remaining source balance can be allocated',next(f['available'] for f in snap()['funds'] if f['id']==supplies)==0)
 fourth=task('QA invalid allocation');deny('zero available account cannot be overdrawn',lambda:allocate(fourth,[{'sourceId':supplies,'amount':1}]))
 deny('duplicate accounts in one batch are rejected',lambda:allocate(fourth,[{'sourceId':travel,'amount':100},{'sourceId':travel,'amount':100}]))
 deny('null account list is rejected',lambda:allocate(fourth,None))
 deny('foreign project account is rejected',lambda:allocate(fourth,[{'sourceId':str(uuid.uuid4()),'amount':100}]))
 actor(worker);deny('member cannot add accounts without allocation authority',lambda:allocate(fourth,[{'sourceId':travel,'amount':100}]))
 actor(head);check('project authority is unchanged by task allocation',snap()['total']==38000 and snap()['allocated']==23500 and snap()['unallocated']==14500)
 q('reset role');check('Office Budget is charged only for original project authority',sum(q('select eflow_budget.partition_committed(%s)',(a,)) for a in accounts)==38000)
 check('one approved allocation header remains per task',q("select count(*) from public.work_budget_allocations where task_id=%s and subtask_id is null and status='approved'",(second,))==1)
 q('set constraints all immediate');check('all deferred budget invariants pass',True)
finally:cn.rollback();cn.close()
folder=root/'docs/task-multiple-accounts-2026-11-03';folder.mkdir(exist_ok=True);(folder/('INSTALLED_CHECKS.json' if args.installed else 'CANDIDATE_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2));print(len(checks),'checks; rolled back')
