"""Authenticated permission/workflow probes; every record is rolled back."""
import argparse,json,socket,uuid
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--baseline',action='store_true');parser.add_argument('--installed',action='store_true');args=parser.parse_args()
uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor();checks=[]
def q(s,a=None):c.execute(s,a);return c.fetchone()[0] if c.description else None
def actor(uid):
 q('reset role');q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));q('set local role authenticated')
def check(name,value):assert value,name;checks.append(name);print('PASS',name,flush=True)
def attempt(fn):
 q('savepoint probe')
 try:result=fn();q('release savepoint probe');return result,None
 except psycopg2.Error as e:
  text=e.diag.message_primary;code=e.pgcode;q('rollback to savepoint probe');return None,(code,text)
try:
 if not (args.baseline or args.installed):c.execute((root/'supabase/migrations/20261102190846_work_completion_and_update_notifications.sql').read_text(encoding='utf-8'))
 q("set local statement_timeout='25s'")
 c.execute("select t.linked_project_id,t.org_id,t.assigned_to,t.team_member_ids,p.project_lead_id,t.start_date,t.due_date from public.tasks t join public.projects p on p.id=t.linked_project_id where t.deleted_at is null and t.archived_at is null and t.status in ('todo','in_progress') and t.assigned_to is not null and p.project_lead_id is not null order by t.created_at desc limit 1")
 project,office,lead,team,head,start,end=c.fetchone();q('reset role')
 other=q("select id from public.profiles where org_id=%s and role='member' and id<>%s and eflow_r3.eligible(id) and eflow_r7.member(%s,%s,id) limit 1",(office,lead,project,office));assert other
 def task(label,status='in_progress',recommendation=None):
  actor(head);tid=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status,recommendation_lead_id) values(%s,%s,%s,%s,%s,%s::uuid[],%s,%s,%s,%s,%s,%s)",(tid,'QA work completion '+label,office,project,lead,[str(lead),str(other)],head,start,end,str(end)[:10]+'T23:59:00+08:00' if end else None,status,recommendation));return tid
 def submit(t):return q('select to_jsonb(public.submit_task_for_review(%s,%s))',(t,Json({'id':str(uuid.uuid4()),'note':'Completed QA work','attachments':[]})))
 def child(t,label,owner):
  actor(lead);sid=str(uuid.uuid4());tree=q('select public.r7_work_tree(%s)',(t,));q("select public.r7_work_command(%s,%s,%s,'create',%s)",(t,tree['revision'],str(uuid.uuid4()),Json({'id':sid,'title':label,'lead':str(owner),'people':[str(owner)],'standalone':True})));return sid
 t=task('contributor');actor(other);_,denial=attempt(lambda:submit(t))
 if args.baseline:print('BASELINE contributor submission:',denial or 'UNEXPECTEDLY ALLOWED',flush=True)
 else:check('contributor cannot submit parent when recommendation is empty',denial and denial[0]=='42501')
 t2=task('lead');actor(lead);result,denial=attempt(lambda:submit(t2));check('current lead can submit parent for project-lead review',not denial and result['status']=='for_review' and str(result['reviewer_id'])==str(head))
 t3=task('stale UI','todo');actor(lead);result,denial=attempt(lambda:submit(t3))
 if args.baseline:print('BASELINE submit from not-started:',denial or result['status'],flush=True)
 else:check('not-started work starts and submits atomically',not denial and result['status']=='for_review')
 t4=task('stale recommendation',recommendation=str(other));actor(other);_,denial=attempt(lambda:submit(t4))
 if args.baseline:print('BASELINE stale recommendation:',denial or 'UNEXPECTEDLY ALLOWED',flush=True)
 else:check('stale AI recommendation cannot submit the current lead work',denial and denial[0]=='42501')
 t5=task('subtask');sid=child(t5,'QA lead evidence check',other)
 actor(lead);req=str(uuid.uuid4());path=f'subtasks/{sid}/{req}/proof.txt'
 # Probe the same insert RLS that Storage uses, without storing any real blob.
 result,denial=attempt(lambda:q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('task-attachments',%s,%s,%s) returning id",(path,str(lead),Json({'size':32,'mimetype':'text/plain'}))))
 if args.baseline:print('BASELINE task lead evidence upload:',denial or 'allowed',flush=True)
 else:
  check('task lead can attach evidence to a delegated subtask',not denial)
  second_path=f'subtasks/{sid}/{req}/second.txt'
  q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('task-attachments',%s,%s,%s)",(second_path,str(lead),Json({'size':32,'mimetype':'text/plain'})))
  payload={'id':req,'note':'QA completed with evidence','attachments':[{'filePath':path,'fileName':'proof.txt','fileSize':32,'mimeType':'text/plain'},{'filePath':second_path,'fileName':'second.txt','fileSize':32,'mimeType':'text/plain'}]}
  done=q('select to_jsonb(public.complete_subitem(%s,%s))',(sid,Json(payload)))
  check('task lead completes delegated subtask with evidence',done['status']=='completed')
  q('reset role');notice=q("select to_jsonb(n) from public.notifications n where work_node_id=%s and title='Subtask completed' order by created_at desc limit 1",(sid,));check('completion notification reports status without numeric progress',notice and notice['title']=='Subtask completed' and notice['status_to']=='completed' and '100%' not in notice['message'])
  check('all completion attachments are preserved and sealed',q("select count(*) from eflow_evidence.objects where subtask_id=%s",(sid,))==2)
  actor(lead);q('select public.complete_subitem(%s,%s)',(sid,Json(payload)))
  q('reset role');check('multiple evidence files and retry send only one completion notification',q("select count(*) from public.notifications where work_node_id=%s and title='Subtask completed'",(sid,))==1)
 t6=task('updates');sid2=child(t6,'QA assigned subtask',other);actor(other)
 q("select public.save_subtask_work_update(%s,'in_progress',null,'Called the venue', 'Confirm booking',null,null)",(sid2,))
 q('reset role');notice=q("select to_jsonb(n) from public.notifications n where task_id=%s and actor_id=%s and title in ('Subtask progress updated','Subtask work updated') order by created_at desc limit 1",(t6,other))
 if args.baseline:print('BASELINE text-update notification:',notice['message'],flush=True)
 else:
  check('text update notification uses the note rather than zero percent','Called the venue' in notice['message'] and '0%' not in notice['message'] and notice['status_to']=='in_progress')
  check('notification points to the exact subtask',str(notice['work_node_id'])==sid2 and notice['entity_type']=='subtask')
  actor(other);q("select public.save_subtask_work_update(%s,'stuck','Venue unavailable','Need another date',null,null,null)",(sid2,))
  q('reset role');check('blocker is described without a completion percentage',q("select count(*) from public.notifications where work_node_id=%s and title='Subtask blocker reported' and reason like '%%Venue unavailable%%'",(sid2,))==1)
  actor(lead);sub=child(t6,'QA lead-only step',lead);actor(other);_,denial=attempt(lambda:q('select public.complete_subitem(%s,%s)',(sub,Json({'id':str(uuid.uuid4()),'attachments':[]}))))
  check('contributor cannot complete another lead subtask',denial and denial[0]=='42501')
  actor(lead);_,denial=attempt(lambda:submit(t6));check('unfinished subtasks still block parent submission',denial is not None)
  parent=task('parent evidence','todo');actor(lead);request=str(uuid.uuid4());evidence=f'{parent}/{request}/proof.pdf'
  q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('task-attachments',%s,%s,%s)",(evidence,str(lead),Json({'size':32,'mimetype':'application/pdf'})))
  result=q('select to_jsonb(public.submit_task_for_review(%s,%s))',(parent,Json({'id':request,'note':'Final venue confirmation','attachments':[{'filePath':evidence,'fileName':'proof.pdf','fileSize':32,'mimeType':'application/pdf'}]})))
  check('lead uploads evidence while not started and submits atomically',result['status']=='for_review')
  q('reset role');q('set constraints all immediate');check('all deferred workflow and financial guards pass',True)
finally:cn.rollback();cn.close()
dest=root/'docs/work-completion-fix-2026-11-03';dest.mkdir(exist_ok=True)
(dest/('BASELINE_CHECKS.json' if args.baseline else 'INSTALLED_CHECKS.json' if args.installed else 'CANDIDATE_CHECKS.json')).write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2),encoding='utf-8')
print(len(checks),'checks; QA records rolled back')

