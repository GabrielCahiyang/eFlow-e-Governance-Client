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
office='fdd4dfee-bbc3-42b4-9dcf-a9612c428460'
try:
 if not args.installed:c.execute((root/'supabase/migrations/20261031124511_remove_project_funding_quarters.sql').read_text())
 q("select pg_advisory_xact_lock(hashtext('annual-project-funding-verification'))")
 head=q('select head_user_id from public.organizations where id=%s',(office,));worker=q("select id from public.profiles where org_id=%s and is_active and role='member' limit 1",(office,))
 actor(head);project=q('select to_jsonb(public.create_project_with_details(%s))',(Json({'title':'QA annual funding rollback','org_id':office,'status':'planning'}),));pid=project['id']
 q('select public.save_project_definition(%s,%s)',(pid,Json({'version':project['updated_at'],'title':project['title'],'description':'Annual funding test','scope':'Two task packages','lead':str(head),'start':'2027-01-01','end':'2027-12-31','noFunding':False})))
 q('reset role');b=str(uuid.uuid4());source=str(uuid.uuid4());q("insert into public.department_fiscal_budgets(id,org_id,fiscal_year,status,approved_amount,created_by) values(%s,%s,2027,'locked',2000000,%s)",(b,office,head));q("insert into public.office_budget_sections(id,fiscal_budget_id,name,amount,held_amount,created_by) values(%s,%s,'Annual services',2000000,0,%s)",(source,b,head))
 actor(head);lines=[{'partitionId':source,'amount':300000},{'partitionId':source,'amount':400000}];key=str(uuid.uuid4())
 def authorize(lines_,key_=None):return q('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json(lines_),'Annual authority',key_ or str(uuid.uuid4())))
 def snap():return q('select public.project_flow_snapshot(%s)',(pid,))
 authorize(lines,key);check('quarter-free funding accepted and totalled',snap()['total']==700000)
 check('same account amounts consolidate into one annual source',len(snap()['funds'])==1 and snap()['funds'][0]['quarter'] is None)
 authorize(lines,key);check('retry does not reserve twice',snap()['total']==700000)
 authorize([{'partitionId':source,'quarter':4,'amount':1000}]);check('old client quarter payload works without creating quarterly funding',snap()['total']==701000 and len(snap()['funds'])==1)
 deny('source overspending still rejected',lambda:authorize([{'partitionId':source,'amount':1900000}]))
 q('select public.finish_project_setup(%s)',(pid,));q("select public.phase6_set_members((select id from public.project_offices where project_id=%s and office_id=%s),%s::uuid[])",(pid,office,[str(head),str(worker)]))
 def task(title,start,due):
  tid=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s,%s,'todo')",(tid,title,office,pid,worker,[str(worker)],head,start,due,due+'T23:59:00+08:00'));return tid
 tid=task('October work','2027-10-01','2027-11-05');fund=snap()['funds'][0]['id']
 q('select public.allocate_project_task_funding(%s,%s,%s,%s)',(tid,Json([{'sourceId':fund,'amount':5000}]),'Annual task allocation',str(uuid.uuid4())))
 check('late-year task uses annual source without quarter selection',snap()['allocated']==5000)
 q('reset role');check('task does not charge Office Budget again',q('select eflow_budget.partition_committed(%s)',(source,))==701000)
 # Preserve a historical Q1 row/ID and prove the old quarter no longer blocks October work.
 legacy=str(uuid.uuid4());commit=q('select commitment_id from eflow_project.funding where id=%s',(fund,))
 q('insert into eflow_project.funding(id,project_id,commitment_id,partition_id,fiscal_year,quarter,amount) values(%s,%s,%s,%s,2027,1,2000)',(legacy,pid,commit,source));q('update public.budget_commitments set amount=amount+2000 where id=%s',(commit,))
 actor(head);late=task('Legacy funding October work','2027-10-01','2027-10-31');q('select public.allocate_project_task_funding(%s,%s,%s,%s)',(late,Json([{'sourceId':legacy,'amount':1000}]),'Legacy annualized allocation',str(uuid.uuid4())))
 check('legacy Q1 source remains usable for October task',snap()['allocated']==6000)
 deny('task due beyond project still blocked',lambda:task('Invalid dates','2027-12-01','2028-01-01'))
 deny('project shortening cannot strand tasks',lambda:q("update public.projects set target_date='2027-11-04' where id=%s",(pid,)))
 actor(worker);deny('member cannot authorize Office funding',lambda:authorize([{'partitionId':source,'amount':1000}]))
finally:cn.rollback();cn.close()
folder=root/'docs/project-funding-annual-2026-10-31';folder.mkdir(exist_ok=True);(folder/('INSTALLED_CHECKS.json' if args.installed else 'CANDIDATE_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2));print(len(checks),'checks; rolled back')
