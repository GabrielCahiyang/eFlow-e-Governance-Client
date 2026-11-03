"""Verify real lifecycle state for three roles. All QA data is rolled back."""
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
def actor(uid):
 q('reset role');q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));q('set local role authenticated')
def check(name,value):assert value,name;checks.append(name);print('PASS',name,flush=True)
def deny(fn):
 q('savepoint denied')
 try:fn()
 except psycopg2.Error:q('rollback to savepoint denied');return True
 q('rollback to savepoint denied');return False
try:
 if not args.installed:c.execute((root/'supabase/migrations/20261102192953_work_status_lifecycle_sync.sql').read_text(encoding='utf-8'))
 q("set local statement_timeout='25s'")
 c.execute("select t.linked_project_id,t.org_id,t.assigned_to,p.project_lead_id,t.start_date,t.due_date from public.tasks t join public.projects p on p.id=t.linked_project_id where t.deleted_at is null and t.archived_at is null and t.status in ('todo','in_progress') and t.assigned_to is not null and p.project_lead_id is not null order by t.created_at desc limit 1")
 project,office,lead,head,start,end=c.fetchone()
 worker=q("select id from public.profiles where org_id=%s and role='member' and id<>%s and eflow_r3.eligible(id) and eflow_r7.member(%s,%s,id) limit 1",(office,lead,project,office));assert worker
 def task(label,status='todo'):
  actor(head);tid=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s,%s,%s)",(tid,'QA status sync '+label,office,project,lead,[str(lead),str(worker)],head,start,end,str(end)[:10]+'T23:59:00+08:00' if end else None,status));return tid
 def child(t):
  actor(lead);sid=str(uuid.uuid4());rev=q('select (public.r7_work_tree(%s)->>\'revision\')::int',(t,));q("select public.r7_work_command(%s,%s,%s,'create',%s)",(t,rev,str(uuid.uuid4()),Json({'id':sid,'title':'QA started step','lead':str(worker),'people':[str(worker)],'standalone':True})));return sid
 t=task('child work');sid=child(t);check('planning subtasks does not prematurely start the task',q('select status from public.tasks where id=%s',(t,))=='todo')
 actor(worker);q("select public.save_subtask_work_update(%s,'in_progress',null,'Called the venue',null,null,null)",(sid,))
 for label,uid in [('Head',head),('Task Lead / Accounting',lead),('Member contributor',worker)]:
  actor(uid);snap=q('select public.r7_work_tree(%s)',(t,));check(label+' reads parent and step In progress',snap['root']['status']=='in_progress' and next(n['status'] for n in snap['nodes'] if n['id']==sid)=='in_progress')
 actor(worker);q("select public.save_subtask_work_update(%s,'stuck','Waiting for venue confirmation','Need a response',null,null,null)",(sid,))
 snap=q('select public.r7_work_tree(%s)',(t,));check('blocker is visible without resetting work to Not started',snap['root']['status']=='in_progress' and next(n for n in snap['nodes'] if n['id']==sid).get('blocker')=='Waiting for venue confirmation')
 actor(worker);q('select public.complete_subitem(%s,%s)',(sid,Json({'id':str(uuid.uuid4()),'note':'Confirmed','attachments':[]})))
 for label,uid in [('Head',head),('Task Lead / Accounting',lead),('Member contributor',worker)]:
  actor(uid);snap=q('select public.r7_work_tree(%s)',(t,));check(label+' reads completed step with parent still awaiting lead submission',snap['root']['status']=='in_progress' and next(n['status'] for n in snap['nodes'] if n['id']==sid)=='completed')
 q('reset role');check('automatic start is audited only once',q("select count(*) from public.task_status_history where task_id=%s and from_status='todo' and to_status='in_progress'",(t,))==1)
 direct=task('direct update');actor(worker);q("select public.submit_task_progress(%s,null,null,null,'Confirm date','Made the first call',null,null)",(direct,))
 check('a text-only parent update starts the task without percentage input',q('select status from public.tasks where id=%s',(direct,))=='in_progress')
 flat=task('direct completion');sid2=child(flat);actor(worker);q('select public.complete_subitem(%s,%s)',(sid2,Json({'id':str(uuid.uuid4()),'attachments':[]})))
 check('direct subtask completion also starts a previously untouched parent',q('select status from public.tasks where id=%s',(flat,))=='in_progress')
 rework=task('returned work','changes_requested');actor(worker)
 check('a contributor cannot resume returned parent work',deny(lambda:q('select public.submit_task_progress(%s,null,null,null,null,%s,null,null)',(rework,'Contributor attempt'))))
 actor(lead);q('select public.submit_task_progress(%s,null,null,null,null,%s,null,null)',(rework,'Lead resumed work'))
 check('the Task Lead can resume returned work through one status update',q('select status from public.tasks where id=%s',(rework,))=='in_progress')
 actor(lead);q('select public.submit_task_for_review(%s,%s)',(flat,Json({'id':str(uuid.uuid4()),'note':'Ready for review','attachments':[]})))
 q('reset role');q('select public.refresh_task_subtask_rollup(%s,false)',(flat,));check('rollups never overwrite review-pending status',q('select status from public.tasks where id=%s',(flat,))=='for_review')
 q('reset role');q("select set_config('request.jwt.claims','{}',true)")
 c.execute("select t.id,t.status from public.tasks t where t.deleted_at is null and t.archived_at is null and t.status='todo' and coalesce((eflow_r7.root(t.id)->>'open')::boolean,false) and exists(select 1 from public.subtasks s where s.task_id=t.id and (s.status<>'todo' or s.is_completed or exists(select 1 from public.subtask_progress_updates u where u.subtask_id=s.id)))")
 repair_ids=c.fetchall()
 for tid,status in repair_ids:
  q('select public.refresh_task_subtask_rollup(%s,false)',(tid,));check('existing started task can be repaired without approval: '+str(tid),q('select status from public.tasks where id=%s',(tid,))=='in_progress')
 q('set constraints all immediate');check('all deferred lifecycle and financial guards pass',True)
finally:cn.rollback();cn.close()
dest=root/'docs/work-status-sync-2026-11-03';dest.mkdir(exist_ok=True)
(dest/('INSTALLED_CHECKS.json' if args.installed else 'CANDIDATE_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2),encoding='utf-8')
print(len(checks),'checks; all QA and repair probes rolled back')
