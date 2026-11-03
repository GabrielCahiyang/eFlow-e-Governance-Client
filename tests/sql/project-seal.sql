create function test_assert(value boolean,message text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'Assertion failed: %',message; end if;end$$;
create function test_throws(command text,expected text) returns void language plpgsql as $$begin begin execute command;exception when others then if position(expected in sqlerrm)=0 then raise exception 'Expected %, got %',expected,sqlerrm;end if;return;end;raise exception 'Expected failure: %',expected;end$$;
insert into profiles(id,full_name,role,is_active) values
 ('20000000-0000-4000-8000-000000000001','Test Head','head',true),
 ('20000000-0000-4000-8000-000000000002','Test Member','member',true);
insert into organizations(id,name,head_user_id,is_active) values('10000000-0000-4000-8000-000000000001','QA Office','20000000-0000-4000-8000-000000000001',true);
insert into projects(id,org_id,title,status,completed_at) values
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Due archive','completed',now()-interval '30 days'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Not yet due','completed',now()-interval '22 days 23 hours'),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Cash outstanding','completed',now()-interval '31 days'),
 ('30000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','Reminder due','completed',now()-interval '23 days'),
 ('30000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000001','No historical clock','completed',null);
insert into test_closeout values('30000000-0000-4000-8000-000000000003','[{"title":"Settle cash"}]');
insert into tasks(id,linked_project_id,title,status)values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','QA completed task','completed');
insert into subtasks(id,task_id,title,status)values('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','QA completed subtask','completed');
insert into audit_events(entity_id,entity_type,action,before_data)values('30000000-0000-4000-8000-000000000001','project','project.updated','{"scope":"Keep this","secret":"Never publish","health":{"note":"Private"},"nested":{"password":"Never publish"}}');
select eflow_seal.archive_due_projects();select eflow_seal.archive_due_projects();
select test_assert((select status='archived' from projects where title='Due archive'),'30-day archive');
select test_assert((select count(*)=1 from audit_events where action='project.auto_archived'),'deduplicated system archive');
select test_assert((select count(*)=3 from notifications where type='project_archive_reminder'),'day-23 reminder per cycle');
select test_assert((select count(*)=1 from notifications where type='project_archive_blocked'),'deduplicated blocked notice');
select test_assert((select status='completed' from projects where title='Cash outstanding'),'financial checks preserved');
select test_assert((select status='completed' from projects where title='No historical clock'),'do not guess historical completion');
update projects set status='active' where title='Reminder due';
select test_assert((select completed_at is null and archive_reminded_at is null from projects where title='Reminder due'),'reopen resets cycle');
update projects set status='completed' where title='Reminder due';
select test_assert((select completed_at>now()-interval '1 minute' from projects where title='Reminder due'),'recompletion starts fresh clock');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',false);
select test_throws($q$select prepare_project_seal('30000000-0000-4000-8000-000000000001')$q$,'appointed Head');
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',false);
select test_throws($q$select prepare_project_seal('30000000-0000-4000-8000-000000000004')$q$,'Archive this project');
select prepare_project_seal('30000000-0000-4000-8000-000000000001');
select prepare_project_seal('30000000-0000-4000-8000-000000000001');
select test_assert((select count(*)=1 from eflow_seal.snapshots),'duplicate prepare resumes');
select test_assert((select not (dossier::text like '%burnout%') from eflow_seal.snapshots),'private health fields excluded');
do $$declare s eflow_seal.snapshots; w uuid:=gen_random_uuid();m text:='{"schema_version":1,"files":[]}';begin
 perform seal_worker_claim(w);select * into s from eflow_seal.snapshots;
 perform seal_worker_save(w,s.id,jsonb_build_object('state','review_ready','manifest',m,'manifest_hash',encode(sha256(convert_to(m,'UTF8')),'hex')));
 perform test_throws(format('select approve_project_seal(%L,%L)',s.id,'bad'),'reviewed record changed');
 perform approve_project_seal(s.id,encode(sha256(convert_to(m,'UTF8')),'hex'));
 perform approve_project_seal(s.id,encode(sha256(convert_to(m,'UTF8')),'hex'));
 perform test_throws($q$update projects set title='Edited' where title='Due archive'$q$,'locked for blockchain');
 perform test_throws($q$update tasks set title='Edited' where title='QA completed task'$q$,'locked for blockchain');
 perform test_throws($q$delete from subtasks where title='QA completed subtask'$q$,'locked for blockchain');
 perform test_throws($q$update tasks set linked_project_id='30000000-0000-4000-8000-000000000002' where title='QA completed task'$q$,'locked for blockchain');
 perform test_throws(format('select discard_project_seal(%L)',s.id),'Publication has started');
 perform seal_worker_claim(w);
 perform test_throws(format('select seal_worker_save(%L,%L,''{"state":"confirmed"}''::jsonb)',w,s.id),'verified Amoy');
 perform seal_worker_save(w,s.id,'{"state":"simulation"}');
 perform test_assert((select count(*)=0 from project_seal_certificates),'simulation never creates public certificate');
end$$;
select test_assert((select dossier::text not like '%Never publish%' and dossier::text like '%Keep this%' from eflow_seal.snapshots limit 1),'private fields removed recursively; business history retained');
-- A discarded/stale preview must never publish an unreviewed changed dossier.
do $$declare s eflow_seal.snapshots; w uuid:=gen_random_uuid(); m text:='{"schema_version":1,"files":[]}';begin
 perform prepare_project_seal('30000000-0000-4000-8000-000000000001');
 perform seal_worker_claim(w); select * into s from eflow_seal.snapshots where state='preparing';
 perform seal_worker_save(w,s.id,jsonb_build_object('state','review_ready','manifest',m,'manifest_hash',encode(sha256(convert_to(m,'UTF8')),'hex')));
 update projects set description='Changed after preview' where id=s.project_id;
 perform test_throws(format('select approve_project_seal(%L,%L)',s.id,encode(sha256(convert_to(m,'UTF8')),'hex')),'Project records changed');
 perform discard_project_seal(s.id);
end$$;
-- RLS remains restrictive even if an unrelated future policy is overly broad.
insert into projects(id,org_id,title,status)values('30000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000001','Unsealed disposable preview','archived');
do $$declare s uuid;begin
 s:=(prepare_project_seal('30000000-0000-4000-8000-000000000006')->>'id')::uuid;
 perform discard_project_seal(s);
 delete from projects where id='30000000-0000-4000-8000-000000000006';
 perform test_assert(not exists(select 1 from projects where id='30000000-0000-4000-8000-000000000006'),'Discarding a private preview does not block unsealed project deletion');
end$$;
do $$declare s eflow_seal.snapshots; w uuid:=gen_random_uuid();m jsonb;h text;h2 text;old_id uuid;begin
 perform prepare_project_seal('30000000-0000-4000-8000-000000000001');
 perform seal_worker_claim(w);select * into s from eflow_seal.snapshots where state='preparing';
 m:=jsonb_build_object('schema_version',1,'snapshot_id',s.id,'source_hash',s.source_hash,'records',s.dossier,'files','[]'::jsonb);
 h:=encode(sha256(convert_to(m::text,'UTF8')),'hex');
 perform seal_worker_save(w,s.id,jsonb_build_object('state','review_ready','manifest',m::text,'manifest_hash',h));
 perform test_assert(public.can_upload_project_seal_copy(s.id::text||'/'||auth.uid()::text||'/'||gen_random_uuid()::text),'Head may stage a publication copy');
 perform test_throws(format('select seal_replace_preview(%L,%L,%L,%L,%L)',s.id,auth.uid(),h,'{}',encode(sha256(convert_to('{}','UTF8')),'hex')),'cannot rewrite project records');
 m:=m||'{"copy_note":"Private original retained"}'::jsonb;h2:=encode(sha256(convert_to(m::text,'UTF8')),'hex');
 perform seal_replace_preview(s.id,auth.uid(),h,m::text,h2);
 perform test_throws(format('select approve_project_seal(%L,%L)',s.id,h),'reviewed record changed');
 perform approve_project_seal(s.id,h2);
 perform test_assert(not public.can_upload_project_seal_copy(s.id::text||'/'||auth.uid()::text||'/'||gen_random_uuid()::text),'Approval closes copy uploads');
 perform seal_worker_claim(w);
 perform seal_worker_save(w,s.id,'{"state":"broadcast","archive_uri":"https://archive/manifest.json","storage_kind":"test","tx_hash":"0x111","signed_tx":"0x111","nonce":0,"publisher":"0xpublisher","contract_address":"0xregistry","chain_id":80002}'::jsonb);
 perform seal_worker_claim(w);
 perform test_throws(format('select seal_worker_save(%L,%L,''{"state":"simulation"}''::jsonb)',w,s.id),'live publication cannot become a simulation');
 perform test_throws(format('select seal_worker_save(%L,%L,''{"tx_hash":"0xchanged"}''::jsonb)',w,s.id),'transaction is immutable');
 perform seal_worker_save(w,s.id,'{"state":"failed","reverted":true,"block_number":10,"block_hash":"0xfailed"}'::jsonb);
 perform retry_project_seal(s.id);
 perform test_assert((select signed_tx is null and not reverted from eflow_seal.snapshots where id=s.id),'Only a verified reverted attempt permits a new transaction');
 perform test_assert((select count(*)=1 from eflow_seal.transaction_attempts where snapshot_id=s.id and receipt_status=0),'Failed identity retained');
 perform seal_worker_claim(w);
 perform seal_worker_save(w,s.id,'{"state":"broadcast","tx_hash":"0x222","signed_tx":"0x222","nonce":1}'::jsonb);
 perform seal_worker_claim(w);
 perform seal_worker_save(w,s.id,'{"state":"confirmed","block_number":11,"block_hash":"0xconfirmed"}'::jsonb);
 perform test_assert((select count(*)=1 from project_seal_certificates where id=s.id),'Only confirmed receipt creates a public index entry');
 perform test_throws(format('select prepare_project_seal(%L)',s.project_id),'Explain the correction');
 perform prepare_project_seal(s.project_id,'Correct the reported venue name; original record stays available.');
 perform test_assert((select previous_id=s.id from eflow_seal.snapshots where project_id=s.project_id order by version desc limit 1),'Corrections link to the confirmed certificate');
end$$;
create policy test_storage_permissive on storage.objects for all to authenticated using(true) with check(true);
grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;
insert into storage.objects values(gen_random_uuid(),'project-seal-private','private'),(gen_random_uuid(),'project-seal-public','public'),(gen_random_uuid(),'other-bucket','unchanged');
set role authenticated;
select public.test_assert((select count(*)=1 from storage.objects),'browser cannot read archive storage metadata');
select public.test_throws($q$insert into storage.objects values(gen_random_uuid(),'project-seal-private','forged')$q$,'row-level security');
reset role;
select test_assert(not has_function_privilege('authenticated','public.seal_worker_claim(uuid)','execute'),'users cannot run worker');
select test_assert(not has_table_privilege('anon','eflow_seal.snapshots','select'),'private dossier hidden');
select test_assert(has_table_privilege('anon','public.project_seal_certificates','select'),'public proof readable');
