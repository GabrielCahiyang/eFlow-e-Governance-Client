"""Reproduce and verify the reported contributor update in a rollback-only transaction."""
import json,socket,uuid
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent;uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];u=urlparse(uri);assert u.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(u.hostname,u.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor();checks=[]
def q(s,a=None):c.execute(s,a);return c.fetchone()[0] if c.description else None
def check(name,value):assert value,name;checks.append(name);print('PASS',name,flush=True)
actor='044b2ba8-842a-46f6-9b37-70ea4cc706d5';sub='432a543e-86c9-4fc8-bef5-ab5fa3a0e151'
try:
 task=q('select task_id from public.subtasks where id=%s',(sub,));assert task
 q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':actor,'role':'authenticated'}),));q('set local role authenticated')
 old=f'subtasks/{sub}/updates/qa-{uuid.uuid4()}.docx';path=f'subtasks/{sub}/progress/qa-{uuid.uuid4()}.docx'
 check('reported updates path is rejected by existing storage guard',q('select eflow_evidence.can_upload(%s)',(old,)) is False)
 check('contributor can upload to the correct progress path',q('select eflow_evidence.can_upload(%s)',(path,)) is True)
 q('insert into storage.objects(bucket_id,name,owner_id,metadata) values(%s,%s,%s,%s)',('task-attachments',path,actor,Json({'size':4,'mimetype':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})))
 check('authenticated storage row insert passes restrictive evidence policy',q("select count(*) from storage.objects where bucket_id='task-attachments' and name=%s",(path,))==1)
 q("select public.save_subtask_work_update(%s,'in_progress',null,'QA rollback attachment verification','Continue work',%s,'qa.docx')",(sub,path))
 check('work update saves and changes subtask status',q('select status from public.subtasks where id=%s',(sub,))=='in_progress')
 check('attachment is linked to saved progress update',q('select count(*) from public.subtask_progress_updates where subtask_id=%s and attachment_path=%s',(sub,path))==1)
 tree=q('select public.r7_work_tree(%s)',(task,));node=next(n for n in tree['nodes'] if n['id']==sub)
 check('Assigned work canonical tree reads the updated status',node['status']=='in_progress')
 check('completion remains restricted independently of update permission',not node.get('capabilities',{}).get('submit',{}).get('allowed',False))
finally:cn.rollback();cn.close()
folder=root/'docs/subtask-update-fix-2026-10-31';folder.mkdir(exist_ok=True);(folder/'DATABASE_CHECKS.json').write_text(json.dumps({'rollback_only':True,'count':len(checks),'checks':checks},indent=2));print(len(checks),'checks; all test writes rolled back')
