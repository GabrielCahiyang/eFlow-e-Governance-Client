"""Exercise the candidate project workflow in rollback-only synthetic transactions."""
import json,socket,uuid
from pathlib import Path
from urllib.parse import urlparse
from dotenv import dotenv_values
import psycopg2
from psycopg2.extras import Json
root=Path(__file__).resolve().parent.parent;uri=dotenv_values(root/'.env')['EFLOW_DATABASE_URL'];p=urlparse(uri);assert p.username=='postgres.ixnfphgjyelhckjwjkdv'
cn=psycopg2.connect(uri,sslmode='require',connect_timeout=15,hostaddr=socket.getaddrinfo(p.hostname,p.port,socket.AF_INET,socket.SOCK_STREAM)[0][4][0]);c=cn.cursor();checks=[]
def q(s,a=None):c.execute(s,a);return c.fetchone()[0] if c.description else None
def actor(uid):q('reset role');q("select set_config('request.jwt.claims',%s,true)",(json.dumps({'sub':str(uid),'role':'authenticated'}),));q('set local role authenticated')
def check(name,value):assert value,name;checks.append(name);print('PASS',name,flush=True)
def denied(s,a=None):
 q('savepoint denied')
 try:c.execute(s,a)
 except psycopg2.Error as e:q('rollback to savepoint denied');print('Blocked:',e.diag.message_primary,flush=True);return e.pgcode
 q('rollback to savepoint denied');return None
try:
 q("set local statement_timeout='30s'")
 installed=q("select to_regprocedure('public.project_flow_snapshot(uuid)')") is not None
 if not installed:c.execute((root/'supabase/migrations/20261030074704_project_definition_and_funding_flow.sql').read_text(encoding='utf-8'))
 guards_installed=q("select count(*) from pg_trigger where tgname='project_definition_before_sharing' and not tgisinternal")>0
 if not guards_installed:c.execute((root/'supabase/migrations/20261030083920_complete_project_setup_guards.sql').read_text(encoding='utf-8'))
 prerequisite_guard_installed=q("select position('public.can_see_task' in pg_get_functiondef('eflow_project.guard_dependencies()'::regprocedure))>0")
 if not prerequisite_guard_installed:c.execute((root/'supabase/migrations/20261030092810_enforce_project_prerequisite_visibility.sql').read_text(encoding='utf-8'))
 c.execute("select o.id,o.head_user_id from public.organizations o join public.profiles p on p.id=o.head_user_id where o.id='fdd4dfee-bbc3-42b4-9dcf-a9612c428460' and p.is_active");office,head=c.fetchone()
 c.execute("select id from public.profiles where org_id=%s and id<>%s and is_active and role='member' order by id limit 2",(office,head));members=[r[0] for r in c.fetchall()];assert len(members)>=1;lead=members[0];worker=members[-1]
 actor(head)
 project=q("select to_jsonb(public.create_project_with_details(%s))",(Json({'title':'QA FLOW — Quarter funding','org_id':str(office),'status':'planning'}),));pid=project['id']
 check('draft blocks task creation',denied("insert into public.tasks(title,org_id,linked_project_id,created_by) values('Blocked',%s,%s,%s)",(office,pid,head)) is not None)
 q('reset role')
 check('draft blocks sharing grants',denied("insert into public.project_access_grants(id,project_id,recipient,office_id,access,engagement,until_close,created_by) values(%s,%s,%s,%s,'viewer','consultant',true,%s)",(str(uuid.uuid4()),pid,worker,office,head))=='23514')
 check('draft blocks guest membership',denied("insert into public.project_guest_members(project_id,office_id,user_id,engagement,until_close) values(%s,%s,%s,'consultant',true)",(pid,office,worker))=='23514')
 check('draft blocks additional office invitation',denied("insert into public.project_offices(project_id,office_id,relationship_type) values(%s,%s,'supporting')",(pid,office))=='23514')
 actor(head)

 details={'version':project['updated_at'],'title':project['title'],'description':'Business readiness and support services','scope':'Deliver two approved work packages','lead':str(lead),'start':'2027-01-01','end':'2027-06-30','noFunding':False}
 project=q('select to_jsonb(public.save_project_definition(%s,%s))',(pid,Json(details)))
 check('missing project funding blocks finish',denied('select public.finish_project_setup(%s)',(pid,)) is not None)
 q('reset role');budget=str(uuid.uuid4());source=str(uuid.uuid4())
 q("insert into public.department_fiscal_budgets(id,org_id,fiscal_year,status,approved_amount,created_by) values(%s,%s,2027,'locked',2000000,%s)",(budget,office,head))
 q("insert into public.office_budget_sections(id,fiscal_budget_id,name,amount,held_amount,created_by) values(%s,%s,'QA Annual operating appropriation',2000000,0,%s)",(source,budget,head))
 actor(head);key=str(uuid.uuid4());lines=[{'partitionId':source,'quarter':1,'amount':300000},{'partitionId':source,'quarter':2,'amount':400000}]
 q('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json(lines),'QA authorized envelope',key))
 snap=q('select public.project_flow_snapshot(%s)',(pid,));check('project total is Q1 300k plus Q2 400k',snap['total']==700000 and len(snap['funds'])==2)
 q('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json(lines),'QA authorized envelope',key));check('same funding request cannot deduct twice',q('select public.project_flow_snapshot(%s)',(pid,))['total']==700000)
 check('source overspend blocked',denied('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json([{'partitionId':source,'quarter':1,'amount':1900000}]),'overspend',str(uuid.uuid4()))) is not None)
 q('select public.finish_project_setup(%s)',(pid,));check('complete setup becomes ready',q('select public.project_flow_snapshot(%s)',(pid,))['ready'])
 q("select public.phase6_set_members((select id from public.project_offices where project_id=%s and office_id=%s),%s::uuid[])",(pid,office,list(set(map(str,[head,lead,worker])))))
 task=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,'QA First work package',%s,%s,%s,%s::uuid[],%s,'2027-01-01','2027-03-15','2027-03-15T23:59:00+08:00','todo')",(task,office,pid,worker,[str(worker),str(lead)],head))
 check('task lead submission routes to project lead',q('select reviewer_id from public.tasks where id=%s',(task,))==(head if worker==lead else lead))
 check('task outside project dates blocked',denied("update public.tasks set due_date='2027-07-01',deadline='2027-07-01T23:59:00+08:00' where id=%s",(task,)) is not None)
 actor(lead);funds=q('select public.project_flow_snapshot(%s)',(pid,))['funds'];q1=next(f['id'] for f in funds if f['quarter']==1)
 allocation=q('select public.allocate_project_task_funding(%s,%s,%s,%s)',(task,Json([{'sourceId':q1,'amount':200000}]),'QA first package',str(uuid.uuid4())))
 snap=q('select public.project_flow_snapshot(%s)',(pid,));check('task draws 200k inside 700k project budget',snap['total']==700000 and snap['allocated']==200000 and snap['unallocated']==500000)
 q('reset role');check('Office source still reserved exactly 700k',q('select eflow_budget.partition_committed(%s)',(source,))==700000)
 actor(worker);q('savepoint subtask_funding')
 sub=str(uuid.uuid4());revision=q("select (public.r7_work_tree(%s)->>'revision')::integer",(task,))
 q("select public.r7_work_command(%s,%s,%s,'create',%s)",(task,revision,str(uuid.uuid4()),Json({'id':sub,'title':'QA Registration preparation','standalone':True,'lead':str(worker),'people':[str(worker)],'due':'2027-03-10'})))
 task_line=q('select id from public.work_budget_allocation_lines where allocation_id=%s',(allocation,))
 cap=q('select public.set_subtask_budget_cap(%s,%s,%s,50000,%s,%s)',(task,sub,task_line,'QA subtask allocation',str(uuid.uuid4())))
 check('subtask cap divides parent allocation',q('select public.task_budget_line_available(%s,null)',(task_line,))==150000)
 check('subtask cannot exceed task funding',denied('select public.set_subtask_budget_cap(%s,%s,%s,250000,%s,%s)',(task,sub,task_line,'QA excessive cap',str(uuid.uuid4()))) is not None)
 q('reset role');check('subtask allocation does not charge Office Budget again',q('select eflow_budget.partition_committed(%s)',(source,))==700000)
 q('rollback to savepoint subtask_funding')

 actor(lead);check('project lead cannot authorize Office funding',denied('select public.authorize_project_funding(%s,%s,%s,%s)',(pid,Json(lines),'unauthorized',str(uuid.uuid4()))) is not None)
 actor(head);check('cannot release allocated project funding',denied('select public.release_project_funding(%s,%s,%s,%s,%s)',(pid,q1,200000,'invalid release',str(uuid.uuid4()))) is not None)
 # The project lead's own task must route to the independent Head.
 own=str(uuid.uuid4());actor(head)
 q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,'QA Project lead work',%s,%s,%s,%s::uuid[],%s,'2027-03-16','2027-03-25','2027-03-25T23:59:00+08:00','todo')",(own,office,pid,lead,[str(lead)],head))
 check('project lead own task routes to Head',q('select reviewer_id from public.tasks where id=%s',(own,))==head)
 actor(lead);check('task source overspend blocked',denied('select public.allocate_project_task_funding(%s,%s,%s,%s)',(own,Json([{'sourceId':q1,'amount':150000}]),'too much',str(uuid.uuid4()))) is not None)
 actor(head);check('project shortening cannot strand tasks',denied("update public.projects set target_date='2027-03-01' where id=%s",(pid,)) is not None)
 q("update public.tasks set dependency_ids=%s::uuid[] where id=%s",([task],own))
 check('Task 2 cannot start while Task 1 is incomplete',denied("select public.transition_task_status(%s,'in_progress',null,null)",(own,)) is not None)
 check('dependency cycle blocked',denied("update public.tasks set dependency_ids=%s::uuid[] where id=%s",([own],task)) is not None)
 check('missing prerequisite is blocked without exposing a task title',denied("update public.tasks set dependency_ids=%s::uuid[] where id=%s",([str(uuid.uuid4())],own))=='23514')
 q('savepoint hidden_prerequisite')
 q('reset role');q("create or replace function public.can_see_task(target_task uuid,caller_id uuid) returns boolean language sql stable as $$select target_task<>%s::uuid$$",(task,))
 check('restricted prerequisite is blocked before reporting its title',denied("update public.tasks set dependency_ids=%s::uuid[] where id=%s",([task],own))=='23514')
 q('rollback to savepoint hidden_prerequisite')
 q("update public.tasks set dependency_ids='{}' where id=%s",(own,))
 actor(lead);line_id=q('select id from public.work_budget_allocation_lines where allocation_id=%s',(allocation,))
 release_key=str(uuid.uuid4());q('select public.release_project_task_funding(%s,50000,%s,%s)',(line_id,'Unused task allocation',release_key));q('select public.release_project_task_funding(%s,50000,%s,%s)',(line_id,'Unused task allocation',release_key))
 snap=q('select public.project_flow_snapshot(%s)',(pid,));check('task release returns funding to project once',snap['allocated']==150000 and snap['unallocated']==550000 and snap['total']==700000)
 actor(head);q('select public.release_project_funding(%s,%s,100000,%s,%s)',(pid,q1,'Unused appropriation release',str(uuid.uuid4())))
 snap=q('select public.project_flow_snapshot(%s)',(pid,));check('audited project release reduces authorized envelope',snap['total']==600000 and snap['allocated']==150000)
 q('reset role');check('Office reservation reflects project release once',q('select eflow_budget.partition_committed(%s)',(source,))==600000)
 actor(head)
 # A current-quarter envelope exercises real request/reject/re-request approval paths.
 actor(head);cash_project=q("select to_jsonb(public.create_project_with_details(%s))",(Json({'title':'QA FLOW — Current quarter cash','org_id':str(office),'status':'planning'}),));cp=cash_project['id']
 q('reset role');today=q("select (now() at time zone 'Asia/Manila')::date");year=today.year;quarter=(today.month-1)//3+1;end=q("select ((date_trunc('quarter',now() at time zone 'Asia/Manila')+interval '3 months'-interval '1 day')::date)")
 actor(head);cash_project=q('select to_jsonb(public.save_project_definition(%s,%s))',(cp,Json({'version':cash_project['updated_at'],'title':cash_project['title'],'description':'Community workshop supplies','scope':'Registration and participant materials','lead':str(lead),'start':str(today),'end':str(end),'noFunding':False})))
 q('reset role');cb=str(uuid.uuid4());cs=str(uuid.uuid4());q("insert into public.department_fiscal_budgets(id,org_id,fiscal_year,status,approved_amount,created_by,daily_petty_cash_release_limit) values(%s,%s,%s,'locked',1000000,%s,1000000)",(cb,office,year,head));q("insert into public.office_budget_sections(id,fiscal_budget_id,name,amount,held_amount,created_by) values(%s,%s,'QA Community services',1000000,0,%s)",(cs,cb,head))
 actor(head);q('select public.authorize_project_funding(%s,%s,%s,%s)',(cp,Json([{'partitionId':cs,'quarter':quarter,'amount':100000}]),'QA current-quarter authorization',str(uuid.uuid4())));q('select public.finish_project_setup(%s)',(cp,))
 q("select public.phase6_set_members((select id from public.project_offices where project_id=%s and office_id=%s),%s::uuid[])",(cp,office,list(set(map(str,[head,lead,worker])))))
 ct=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,'QA Supplies and registration',%s,%s,%s,%s::uuid[],%s,%s,%s,%s,'todo')",(ct,office,cp,worker,[str(worker),str(lead)],head,str(today),str(end),str(end)+'T23:59:00+08:00'))
 actor(lead);cf=q('select public.project_flow_snapshot(%s)',(cp,))['funds'][0]['id'];ca=q('select public.allocate_project_task_funding(%s,%s,%s,%s)',(ct,Json([{'sourceId':cf,'amount':20000}]),'QA supplies allocation',str(uuid.uuid4())));cl=q('select id from public.work_budget_allocation_lines where allocation_id=%s',(ca,))
 actor(worker);request_key=str(uuid.uuid4());cash_lines=[{'allocationLineId':str(cl),'amount':5000}]
 request=q('select public.create_contextual_cash_request_v2(%s,null,%s,%s,%s,%s,null)',(ct,Json(cash_lines),'QA workshop supplies',str(today),request_key))
 check('cash routes to project reviewer without task-lead self-review',q('select status from public.petty_cash_requests where id=%s',(request,))=='pending_department_approval')
 q('select public.create_contextual_cash_request_v2(%s,null,%s,%s,%s,%s,null)',(ct,Json(cash_lines),'QA workshop supplies',str(today),request_key));check('cash request retry returns same request',q('select count(*) from public.petty_cash_requests where task_id=%s',(ct,))==1)
 check('cash requester cannot approve own request',denied('select public.decide_petty_cash_request(%s,true,null)',(request,)) is not None)
 actor(lead if worker!=lead else head);q('select public.decide_petty_cash_request(%s,false,%s)',(request,'Revise quantities before purchase'));check('project reviewer can reject cash request',q('select status from public.petty_cash_requests where id=%s',(request,))=='rejected')
 actor(worker);request2=q('select public.create_contextual_cash_request_v2(%s,null,%s,%s,%s,%s,null)',(ct,Json(cash_lines),'QA revised workshop supplies',str(today),str(uuid.uuid4())))
 actor(lead if worker!=lead else head);q('select public.decide_petty_cash_request(%s,true,%s)',(request2,'Reviewed corrected quantities'));check('project reviewer can approve re-request',q('select status from public.petty_cash_requests where id=%s',(request2,))=='scheduled_for_release')
 check('approval does not claim cash already released',q('select released_amount from public.petty_cash_requests where id=%s',(request2,))==0)
 check('project lead cannot act as Accounting release officer',denied('select public.record_accounting_petty_cash_release((select id from public.petty_cash_releases where request_id=%s limit 1),%s,null)',(request2,'cash')) is not None)
 q('reset role');check('cash approval does not reserve Office Budget twice',q('select eflow_budget.partition_committed(%s)',(cs,))==100000)
 actor(head)
 # Accounting release and itemized receipt settlement use existing checked commands.
 q('reset role');accounting=q("select id from public.profiles where org_id=%s and role='accounting_staff' and is_active and id<>%s order by id limit 1",(office,worker));assert accounting
 q("insert into public.department_accounting_settings(fiscal_budget_id,configured_by) values(%s,%s) on conflict(fiscal_budget_id) do update set configured_by=excluded.configured_by",(cb,accounting));q("update public.office_budget_sections set journal_account_code='50299990' where id=%s",(cs,))
 actor(accounting);release=q('select id from public.petty_cash_releases where request_id=%s limit 1',(request2,));q("select public.record_accounting_petty_cash_release(%s,'cash',null)",(release,));check('Accounting records actual release',q('select released_amount from public.petty_cash_requests where id=%s',(request2,))==5000)
 check('release cannot be recorded twice',denied("select public.record_accounting_petty_cash_release(%s,'cash',null)",(release,)) is not None)
 actor(worker);q('select public.acknowledge_petty_cash_release(%s)',(release,))
 q('reset role');receipt_path=str(office)+'/'+str(request2)+'/qa-receipt.pdf';q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('budget-receipts',%s,%s,%s)",(receipt_path,str(worker),Json({'size':100,'mimetype':'application/pdf'})))
 actor(worker);receipts=[{'vendor':'QA Community Supply Store','receiptNumber':'QA-OR-001','receiptDate':str(today),'description':'Registration forms and workshop materials','amount':4000,'fileName':'qa-receipt.pdf','filePath':receipt_path,'mimeType':'application/pdf','fileSize':100,'items':[{'allocationLineId':str(cl),'quantity':100,'unit':'sets','particular':'Printed registration and workshop sets','purpose':'Participant registration','amount':4000}]}]
 liquidation=q('select public.submit_itemized_cash_liquidation(%s,4000,%s,%s,%s,%s,%s)',(request2,'QA materials delivered; unused cash returned',Json(receipts),str(uuid.uuid4()),'QA-REFUND-001',str(today)))
 check('receipts await independent project endorsement',q('select status from public.petty_cash_requests where id=%s',(request2,))=='pending_leader_liquidation_review')
 check('recipient cannot endorse own receipts',denied('select public.decide_petty_cash_liquidation_leader_review(%s,true,%s)',(liquidation,'self review')) is not None)
 actor(lead if worker!=lead else head);q('select public.decide_petty_cash_liquidation_leader_review(%s,true,%s)',(liquidation,'QA quantities, receipt and refund checked'))
 check('project reviewer endorsement remains separate from settlement',q('select status from public.petty_cash_requests where id=%s',(request2,))=='pending_department_settlement')
 check('project lead cannot settle or post journals',denied('select public.settle_accounting_liquidation(%s,true,%s)',(liquidation,'not accounting')) is not None)
 actor(accounting);q('select public.settle_accounting_liquidation(%s,true,%s)',(liquidation,'QA receipts reconciled and cash return verified'))
 check('Accounting settles actual spending and returned cash',q('select status from public.petty_cash_requests where id=%s',(request2,))=='settled' and q('select actual_spent from public.petty_cash_requests where id=%s',(request2,))==4000 and q('select returned_amount from public.petty_cash_requests where id=%s',(request2,))==1000)
 actor(head)
 check('cash summary separates returns and outstanding advances',q('select public.project_flow_snapshot(%s)',(cp,))['returned']==1000 and q('select public.project_flow_snapshot(%s)',(cp,))['outstanding']==0)
 actor(head)
 # Submit real task evidence and exercise the project lead final review route.
 actor(worker);q("select public.transition_task_status(%s,'in_progress',null,null)",(ct,))
 submission_key=str(uuid.uuid4());evidence_path=str(ct)+'/'+submission_key+'/qa-delivery.pdf'
 q('reset role');q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('task-attachments',%s,%s,%s)",(evidence_path,str(worker),Json({'size':100,'mimetype':'application/pdf'})))
 actor(worker);q('select public.submit_task_for_review(%s,%s)',(ct,Json({'id':submission_key,'note':'QA workshop materials delivered; receipts settled','attachments':[{'filePath':evidence_path,'fileName':'qa-delivery.pdf','fileSize':100,'mimeType':'application/pdf'}]})))
 check('finished task is sent to project reviewer',q('select reviewer_id from public.tasks where id=%s',(ct,))==(lead if worker!=lead else head))
 check('task submitter cannot approve own delivery',denied('select public.decide_task_review(%s,true,null,null)',(ct,)) is not None)
 actor(lead if worker!=lead else head);q('select public.decide_task_review(%s,true,null,null)',(ct,));check('project reviewer approves task after cash clearance',q('select status from public.tasks where id=%s',(ct,))=='completed')
 actor(head)
 # The project lead's own submitted task is independently approved by the Head.
 actor(head);lead_task=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status) values(%s,'QA Lead closeout report',%s,%s,%s,%s::uuid[],%s,%s,%s,%s,'todo')",(lead_task,office,cp,lead,[str(lead)],head,str(today),str(end),str(end)+'T23:59:00+08:00'))
 q('savepoint all_prerequisites')
 probe=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status,dependency_ids) values(%s,'QA Both prerequisites required',%s,%s,%s,%s::uuid[],%s,%s,%s,%s,'todo',%s::uuid[])",(probe,office,cp,worker,[str(worker)],head,str(end),str(end),str(end)+'T23:59:00+08:00',[ct,lead_task]))
 actor(worker);check('one completed prerequisite does not bypass another unfinished prerequisite',denied("select public.transition_task_status(%s,'in_progress',null,null)",(probe,)) is not None)
 q('rollback to savepoint all_prerequisites')
 actor(lead);q("select public.transition_task_status(%s,'in_progress',null,null)",(lead_task,));lead_submission=str(uuid.uuid4());lead_file=lead_task+'/'+lead_submission+'/qa-closeout.pdf'
 q('reset role');q("insert into storage.objects(bucket_id,name,owner_id,metadata) values('task-attachments',%s,%s,%s)",(lead_file,str(lead),Json({'size':100,'mimetype':'application/pdf'})))
 actor(lead);q('select public.submit_task_for_review(%s,%s)',(lead_task,Json({'id':lead_submission,'note':'QA project lead final delivery report','attachments':[{'filePath':lead_file,'fileName':'qa-closeout.pdf','fileSize':100,'mimeType':'application/pdf'}]})))
 check('project lead own submission reaches Head',q('select reviewer_id from public.tasks where id=%s',(lead_task,))==head)
 check('project lead cannot approve own submission',denied('select public.decide_task_review(%s,true,null,null)',(lead_task,)) is not None)
 actor(head);q('select public.decide_task_review(%s,true,null,null)',(lead_task,));check('Head approves project lead delivery',q('select status from public.tasks where id=%s',(lead_task,))=='completed')
 actor(head);q('savepoint all_prerequisites_complete')
 probe=str(uuid.uuid4());q("insert into public.tasks(id,title,org_id,linked_project_id,assigned_to,team_member_ids,created_by,start_date,due_date,deadline,status,dependency_ids) values(%s,'QA Both prerequisites complete',%s,%s,%s,%s::uuid[],%s,%s,%s,%s,'todo',%s::uuid[])",(probe,office,cp,worker,[str(worker)],head,str(end),str(end),str(end)+'T23:59:00+08:00',[ct,lead_task]))
 actor(worker);q("select public.transition_task_status(%s,'in_progress',null,null)",(probe,));check('both approved prerequisites unlock task start',q('select status from public.tasks where id=%s',(probe,))=='in_progress')
 q('rollback to savepoint all_prerequisites_complete')
 actor(lead);q('select public.release_project_task_funding(%s,16000,%s,%s)',(cl,'Return unused allocation after settlement',str(uuid.uuid4())));check('settled spending remains protected during task release',q('select public.project_flow_snapshot(%s)',(cp,))['allocated']==4000)
 actor(head);q('select public.release_project_funding(%s,%s,96000,%s,%s)',(cp,cf,'Release unused project envelope after delivery',str(uuid.uuid4())))
 snap=q('select public.project_flow_snapshot(%s)',(cp,));check('closeout retains actual spending and releases only unused funding',snap['total']==4000 and snap['allocated']==4000 and snap['spent']==4000)
 for kind in ['structure','dates','budget']:q('select public.phase7_review_project(%s,%s)',(cp,kind))
 q('select public.phase7_activate_project(%s)',(cp,));q('select public.complete_project(%s,%s)',(cp,'QA delivery and financial checks complete'));check('Head completes project after task and financial clearance',q('select status from public.projects where id=%s',(cp,))=='completed')
 q('select public.archive_completed_project(%s,%s)',(cp,'QA archive after completed delivery'));check('completed project archives without erasing spending',q('select status from public.projects where id=%s',(cp,))=='archived')
 check('anonymous cannot read setup',denied('set local role anon;select public.project_flow_snapshot(%s)',(pid,)) is not None)
finally:cn.rollback();cn.close()
folder=root/'docs/project-flow-redesign-2026-10-30';folder.mkdir(exist_ok=True);report={'installed':installed,'setup_guards_installed':guards_installed,'prerequisite_visibility_installed':prerequisite_guard_installed,'rollback_only':True,'checks':checks,'count':len(checks)};(folder/('HOSTED_VERIFICATION.json' if installed else 'CANDIDATE_VERIFICATION.json')).write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
