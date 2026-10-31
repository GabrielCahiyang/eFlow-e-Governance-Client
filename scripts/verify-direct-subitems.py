"""Exercise direct completion in rollback-only transactions; never sends email."""
import json,socket,uuid,hashlib
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];p=urlparse(uri);assert p.username=='postgres.ixnfphgjyelhckjwjkdv'
conn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(p.hostname,p.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=conn.cursor();checks=[]
def query(s,args=None):c.execute(s,args);return c.fetchone()[0] if c.description else None
def actor(uid):query('reset role');query("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));query('set local role authenticated')
def check(name,value):assert value,name;checks.append(name)
def fails(s,args=None):
 query('savepoint negative')
 try:c.execute(s,args)
 except psycopg2.Error as exc:
  code=exc.pgcode;print('Negative probe:',code,exc.diag.message_primary,flush=True);query('rollback to savepoint negative');return code
 query('rollback to savepoint negative');return None
try:
 query("set local statement_timeout='25s'")
 c.execute("select t.id,t.assigned_to,p.org_id from public.tasks t join public.projects p on p.id=t.linked_project_id where t.deleted_at is null and t.archived_at is null and t.status in ('todo','in_progress','changes_requested') and p.status not in ('completed','archived') and t.proposed_office_identity_id is null and eflow_r3.eligible(t.assigned_to) order by t.created_at desc limit 1")
 task,lead,office=c.fetchone()
 other=query("select id from public.profiles where id<>%s and role<>'head' and eflow_r3.eligible(id) and eflow_r7.member((select linked_project_id from public.tasks where id=%s),%s,id) limit 1",(lead,task,office));assert other
 final_task_definition=query("select pg_get_functiondef('public.submit_task_for_review(uuid,jsonb)'::regprocedure)")
 installed=query("select to_regprocedure('public.complete_subitem(uuid,jsonb)')") is not None
 if not installed:c.execute((root/'supabase/migrations/20261030013255_direct_subitem_completion.sql').read_text(encoding='utf-8'))
 def create(title,parent=None,standalone=True):
  uid=str(uuid.uuid4());revision=query("select (public.r7_work_tree(%s)->>'revision')::integer",(task,));payload={'id':uid,'title':'QA DIRECT '+title,'parent':parent,'standalone':standalone,'lead':str(lead),'people':[str(lead),str(other)]}
  query("select public.r7_work_command(%s,%s,%s,'create',%s)",(task,revision,str(uuid.uuid4()),Json(payload)));return uid
 def completion(uid):return {'id':str(uuid.uuid4()),'note':'QA direct completion','attachments':[]}
 def finish(uid,payload=None):return query('select to_jsonb(public.complete_subitem(%s,%s))',(uid,Json(payload or completion(uid))))
 actor(lead);parent=create('container');first=create('first',parent,False);second=create('second',parent,False);old=create('legacy pending',parent,True);flat=create('legacy client')
 actor(other);check('contributor cannot complete another lead step',fails('select public.complete_subitem(%s,%s)',(first,Json(completion(first))))=='42501')
 actor(lead);check('parent cannot complete before children',fails('select public.complete_subitem(%s,%s)',(parent,Json(completion(parent)))) is not None)
 check('sequential second cannot complete before first',fails('select public.complete_subitem(%s,%s)',(second,Json(completion(second)))) is not None)
 payload=completion(first);result=finish(first,payload);check('task lead completes own step without review or mandatory evidence',result['status']=='completed' and result['is_completed'] and result['reviewer_id'] is None)
 check('ordinary progress cannot forge completion',fails("insert into public.subtask_progress_updates(id,subtask_id,task_id,author_id,author_name,percent_complete,blocker_category) values(%s,%s,%s,%s,'QA',100,'None')",(str(uuid.uuid4()),first,task,lead)) is not None)
 count=query('select count(*) from public.subtask_progress_updates where subtask_id=%s',(first,));finish(first,payload);check('same request retry writes no duplicate update',query('select count(*) from public.subtask_progress_updates where subtask_id=%s',(first,))==count)
 altered={**payload,'note':'changed'};check('same request cannot change terms',fails('select public.complete_subitem(%s,%s)',(first,Json(altered)))=='22023')
 bad=completion(second);bad['attachments']=[{'filePath':'other-user/file.pdf','fileName':'proof.pdf','fileSize':1}];check('foreign attachment is rejected',fails('select public.complete_subitem(%s,%s)',(second,Json(bad)))=='42501')
 finish(second);check('next ordered step unlocks on completion',query('select status from public.subtasks where id=%s',(second,))=='completed')
 # Persist old evidence in the transaction, then complete it without a fake approval.
 submission=str(uuid.uuid4())
 actor(other);query('reset role');query("select set_config('eflow.subtask_workflow_authorized','on',true)")
 query("insert into public.subtask_submissions(id,subtask_id,task_id,version,submitter_id,submitter_name,reviewer_id,note) values(%s,%s,%s,1,%s,'QA author',%s,'Earlier evidence')",(submission,old,task,other,lead))
 query("update public.subtasks set status='for_review',percent_complete=100,latest_submission_id=%s,reviewer_id=%s where id=%s",(submission,lead,old));query("select set_config('eflow.subtask_workflow_authorized','off',true)")
 actor(lead);result=finish(old);check('earlier pending step completes and clears active review binding',result['status']=='completed' and result['latest_submission_id'] is None)
 check('earlier evidence remains unchanged',query('select note from public.subtask_submissions where id=%s',(submission,))=='Earlier evidence')
 check('review queue contains no subitem approvals',query('select public.r7_pending_subtask_reviews()')==[])
 check('legacy review decision cannot approve or reject',fails('select public.decide_subtask_review(%s,true,null)',(old,))=='22023')
 finish(parent);check('container completes after all child steps',query('select is_completed from public.subtasks where id=%s',(parent,)))
 query('select public.submit_subtask_for_review(%s,%s)',(flat,Json(completion(flat))));check('legacy submit API completes directly without creating review',query('select status from public.subtasks where id=%s',(flat,))=='completed')
 actor(lead);check('no new submission approvals are created',query('select count(*) from public.subtask_submissions where subtask_id in (%s,%s,%s)',(first,second,flat))==0)
 query('reset role');check('final task review function remains unchanged',query("select pg_get_functiondef('public.submit_task_for_review(uuid,jsonb)'::regprocedure)")==final_task_definition)
 query('set local role anon');check('anonymous cannot complete',fails('select public.complete_subitem(%s,%s)',(first,Json(completion(first))))=='42501')
finally:conn.rollback();conn.close()
dest=root/'docs/direct-subitems-2026-10-30';dest.mkdir(exist_ok=True)
report={'target':'ixnfphgjyelhckjwjkdv','installed':installed,'rollback_only':True,'count':len(checks),'checks':checks}
(dest/('HOSTED_VERIFICATION.json' if installed else 'CANDIDATE_VERIFICATION.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
