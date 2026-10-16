-- REVISION 3: PG17-matched reference; direct column NOT NULL/type/default checks.
-- Retains revision-2 CRLF/LF fingerprints and canonical ledger storage.
-- Target ixnfphgjyelhckjwjkdv; user elected direct MANUAL SQL Editor application.
-- Backup/restore/runtime/security verification remains incomplete, not counted passed.
-- Prior failed applications rolled back; version 20261015230935 is NOT installed.
-- Run the entire file in one execution. Never select a subset or retry blindly.
-- Existing 29 migration rows remain unchanged; one new row is atomic with DDL.
-- Already installed finance migrations are NOT reapplied. No include-all/history repair.
-- Frozen candidate 591302e923d9e1286f7379979406d254391dc814a9063c5fb6ff22f341b11976.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
LOCK TABLE supabase_migrations.schema_migrations IN SHARE ROW EXCLUSIVE MODE;
-- 20261015230935_nested_work_verified_corrections; candidate-bound nine-source integration.
DO $nw11_preflight$ BEGIN
 perform pg_advisory_xact_lock(1751011,20261016);
 if current_user<>'postgres' or current_database()<>'postgres' then raise exception 'NW11 requires the reviewed postgres SQL Editor role/database';end if;
 if current_setting('server_version_num')::int/10000<>17 then raise exception 'NW11 requires PostgreSQL 17; review another major before applying';end if;
 if (select system_identifier::text from pg_catalog.pg_control_system())<>'7642734024280108049' then raise exception 'NW11 wrong cluster: use project ixnfphgjyelhckjwjkdv';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select jsonb_agg(element order by element::text) from jsonb_array_elements(value) element) else value end) from jsonb_each(q.metadata-'captured_at_utc')))::text,'UTF8')),'hex') from (select jsonb_build_object(
'captured_at_utc',now(),
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),'body',p.prosrc,'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'service_role_execute',has_function_privilege('service_role',p.oid,'execute')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname='public' or n.nspname like 'eflow_%') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'options',c.reloptions,'acl',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' or n.nspname like 'eflow_%' or n.nspname='storage') and c.relkind in ('r','v','m')),
'columns',(select jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema='public' or table_schema like 'eflow_%' or table_schema='storage'),
'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' or n.nspname like 'eflow_%'),
'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or n.nspname like 'eflow_%')),
'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname='public' or p.schemaname like 'eflow_%' or p.schemaname='storage'),
'bucket_configuration',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets where id in('project-library','task-attachments'))
) as metadata) q)<>'802d57a27822aad7d58315093570d3cb4d904dfeaacc37203872dd4d1a5b8acb' then raise exception 'NW11 baseline/ledger drift or already applied: STOP and inspect, do not retry or repair history';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select jsonb_agg(element order by element::text) from jsonb_array_elements(value) element) else value end) from jsonb_each(q.metadata-'captured_at_utc')))::text,'UTF8')),'hex') from (select jsonb_build_object('captured_at_utc',now(),'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'acl',nspacl,'owner',pg_get_userbyid(nspowner))) from pg_namespace where nspname='public' or nspname like 'eflow_%' or nspname in ('auth','storage','extensions')),'memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option,'grantor',g.rolname)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor),'default_acl',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(d.defaclrole),'kind',d.defaclobjtype,'acl',d.defaclacl)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),'buckets',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets)) as metadata) q)<>'f7e99b18898ac3492f8911a57590531a80c0bf21758a14c42652225329a77ab5' then raise exception 'NW11 recovery/role/Storage configuration drift: STOP';end if;
 perform set_config('eflow.nw11_preserved_catalog',(select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select coalesce(jsonb_agg(element order by element::text),'[]'::jsonb) from jsonb_array_elements(value) element where not exists(select 1 from jsonb_array_elements(coalesce('{"functions":[{"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"},{"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"},{"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"},{"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"},{"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""},{"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""},{"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"},{"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""},{"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"},{"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""},{"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"},{"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"},{"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"},{"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""},{"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"},{"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"},{"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"},{"schema":"eflow_r7","name":"serialize_history","identity_arguments":""},{"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"},{"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""},{"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"},{"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"},{"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"},{"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"},{"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"},{"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"},{"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"},{"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"},{"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"},{"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"},{"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"},{"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""},{"schema":"public","name":"guard_subtask_mutation","identity_arguments":""},{"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"},{"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"route_organization_leadership_review","identity_arguments":""},{"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"},{"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"},{"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"},{"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"},{"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"},{"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"},{"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"},{"schema":"public","name":"sync_task_chat_channel","identity_arguments":""},{"schema":"public","name":"validate_task_reviewers","identity_arguments":""}],"tables":[{"schema":"eflow_r7","name":"completion_locks"},{"schema":"eflow_r9","name":"staffing_removals"}],"columns":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"column_attributes":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"constraints":[{"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"},{"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"}],"triggers":[{"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"},{"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"},{"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"},{"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"},{"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_lock"},{"schema":"public","table":"tasks","name":"nw51_operation_safety"},{"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}]}'::jsonb->key,'[]'::jsonb)) permitted where element @> permitted)) else value end) from jsonb_each(q.metadata-'captured_at_utc'-'migrations')))::text,'UTF8')),'hex') from (select q.metadata||jsonb_build_object('column_attributes',(select coalesce(jsonb_agg(jsonb_build_object(
 'schema',n.nspname,'table',c.relname,'column',a.attname,
 'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
 'identity',a.attidentity::text,'generated',a.attgenerated::text,
 'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 'collation_schema',cn.nspname,'collation_name',co.collname)
 order by n.nspname,c.relname,a.attnum),'[]'::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m')
 and (n.nspname='public' or n.nspname like 'eflow_%'))) metadata from (select jsonb_build_object(
'captured_at_utc',now(),
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),'body',p.prosrc,'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'service_role_execute',has_function_privilege('service_role',p.oid,'execute')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname='public' or n.nspname like 'eflow_%') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'options',c.reloptions,'acl',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' or n.nspname like 'eflow_%' or n.nspname='storage') and c.relkind in ('r','v','m')),
'columns',(select jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema='public' or table_schema like 'eflow_%' or table_schema='storage'),
'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' or n.nspname like 'eflow_%'),
'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or n.nspname like 'eflow_%')),
'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname='public' or p.schemaname like 'eflow_%' or p.schemaname='storage'),
'bucket_configuration',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets where id in('project-library','task-attachments'))
) as metadata) q) q),true);
 END $nw11_preflight$;
-- Accepted 20261010103936_nested_work_capabilities_and_execution.sql; SHA256 6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c

set local lock_timeout = '10s';

create function eflow_r7.operation_capabilities(p_root uuid, p_node uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 r jsonb := eflow_r7.root(p_root);
 n eflow_r7.nodes;
 actions text[] := case when p_node is null then
  array['manage_contributors','appoint_lead','create_child','order_children'] else
  array['manage_contributors','appoint_lead','create_child','edit_details','move','order_children','delete','execute','submit','review'] end;
 action text;
 reason text;
 common_reason text;
 result jsonb := '{}';
 manager boolean;
 untouched boolean;
 descendants_complete boolean;
 ordered_ready boolean;
 node_depth integer;
begin
 -- Do not disclose row state through the private projector to an unavailable
 -- actor/scope. Snapshot retains its existing read exception.
 if r is null or auth.uid() is null or not coalesce(eflow_r7.read_root(p_root),false) then
  common_reason := 'access_unavailable';
 elsif not coalesce(eflow_r3.eligible(auth.uid()),false) then
  common_reason := 'read_only';
 elsif not coalesce((r->>'open')::boolean,false) then
  common_reason := 'lifecycle_blocked';
 end if;
 if p_node is not null then
  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
  if not found then common_reason := 'access_unavailable'; end if;
 end if;
 if common_reason is null then
  manager := coalesce(eflow_r7.manage(p_root,p_node),false);
  if p_node is not null then
   with recursive below as (
    select * from eflow_r7.nodes where id=p_node and task_id=p_root
    union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root
   ) select not exists(select 1 from below where status<>'todo' or percent_complete<>0),
    not exists(select 1 from below where id<>p_node and status<>'completed')
    into untouched,descendants_complete;
   with recursive above as (
    select id,parent_subtask_id,1 depth from eflow_r7.nodes where id=p_node and task_id=p_root
    union all select c.id,c.parent_subtask_id,a.depth+1 from eflow_r7.nodes c join above a on c.id=a.parent_subtask_id where c.task_id=p_root and a.depth<8
   ) select max(depth) into node_depth from above;
   ordered_ready := n.is_standalone or not exists(select 1 from eflow_r7.nodes c
    where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id
    and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed');
  end if;
 end if;
 foreach action in array actions loop
  reason := common_reason;
  if reason is null then
   if action='appoint_lead' then
    if not coalesce(case when p_node is null then eflow_r7.head(p_root)
     else eflow_r7.manage(p_root,p_node,true) end,false) then reason := 'appointment_denied';
    elsif p_node is not null and n.status='completed' then reason := 'lifecycle_blocked'; end if;
   elsif action in ('execute','submit') then
    if not coalesce(eflow_r7.node_work(p_node,auth.uid()),false) then reason := 'branch_denied';
    elsif n.status in ('for_review','completed') or
     r->>'kind'='office' and r->>'status' not in ('todo','in_progress','changes_requested') then reason := 'lifecycle_blocked';
    elsif not ordered_ready then reason := 'lifecycle_blocked';
    elsif action='submit' and (not descendants_complete or eflow_r7.reviewer(p_node,auth.uid()) is null) then reason := 'lifecycle_blocked'; end if;
   elsif action='review' then
    if auth.uid() is distinct from eflow_r7.pending_reviewer(p_node) then reason := 'branch_denied';
    elsif n.status<>'for_review' or not descendants_complete or r->>'kind'='office' and not exists(
     select 1 from public.subtasks s join public.subtask_submissions sub on sub.id=s.latest_submission_id
     where s.id=p_node and sub.status='pending' and sub.submitter_id<>auth.uid()) then reason := 'lifecycle_blocked'; end if;
   elsif not manager then reason := 'branch_denied';
   elsif action='manage_contributors' then
    if p_node is null and r->>'kind'<>'office' then reason := 'read_only';
    elsif p_node is null and r->>'lead' is null or p_node is not null and (n.lead_id is null or n.status='completed') then reason := 'lifecycle_blocked'; end if;
   elsif action='create_child' then
    if p_node is not null and (n.status<>'todo' or n.percent_complete<>0 or node_depth>=8) then reason := 'lifecycle_blocked'; end if;
   elsif action='order_children' then
    -- This is parent:p_node, including parent:null for root direct children.
    if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root
     and c.parent_subtask_id is not distinct from p_node and (c.status<>'todo' or c.percent_complete<>0)) then reason := 'lifecycle_blocked'; end if;
   elsif action in ('edit_details','move','delete') then
    if not untouched then reason := 'lifecycle_blocked';
    elsif action='delete' and r->>'kind'='office' and exists(
     with recursive below as (select id from eflow_r7.nodes where id=p_node and task_id=p_root
      union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root)
     select 1 from below b where
      exists(select 1 from public.subtask_progress_updates where subtask_id=b.id) or
      exists(select 1 from public.subtask_submissions where subtask_id=b.id) or
      exists(select 1 from public.work_budget_allocations where subtask_id=b.id) or
      exists(select 1 from public.petty_cash_requests where subtask_id=b.id) or
      exists(select 1 from public.budget_ledger_entries where subtask_id=b.id)
    ) then reason := 'history_blocked'; end if;
   end if;
  end if;
  result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));
 end loop;
 return result;
end $$;
revoke all on function eflow_r7.operation_capabilities(uuid,uuid) from public,anon,authenticated,service_role;


-- Preserve every legacy snapshot field, value and grant.
create or replace function eflow_r7.snapshot(p_root uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);v_nodes jsonb;v_people jsonb;begin
 if not eflow_r7.read_root(p_root) then raise exception 'Nested work access denied' using errcode='42501';end if;
 with recursive tree as (
  select n.*,1 depth,array[n.sibling_order] path from eflow_r7.nodes n where n.task_id=p_root and n.parent_subtask_id is null
  union all select n.*,t.depth+1,t.path||n.sibling_order from eflow_r7.nodes n join tree t on n.parent_subtask_id=t.id where n.task_id=p_root and t.depth<8
 ) select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('capabilities',eflow_r7.operation_capabilities(p_root,t.id),'can_manage',eflow_r7.manage(p_root,t.id),'can_appoint',eflow_r7.manage(p_root,t.id,true),'can_order',eflow_r7.manage(p_root,t.parent_subtask_id),'can_work',eflow_r7.node_work(t.id,auth.uid()),'can_review',t.status='for_review' and eflow_r7.pending_reviewer(t.id)=auth.uid(),'current_reviewer',eflow_r7.pending_reviewer(t.id)) order by path,id),'[]'::jsonb) into v_nodes from tree t;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'office',p.org_id,'eligible',eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id)) order by p.full_name,p.id),'[]'::jsonb) into v_people from public.profiles p where eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id) or p.id=(r->>'lead')::uuid or coalesce(r->'people','[]') ? p.id::text or exists(select 1 from eflow_r7.nodes n where n.task_id=p_root and (n.lead_id=p.id or p.id=any(n.assigned_to_ids)));
 return jsonb_build_object('root',r||jsonb_build_object('capabilities',eflow_r7.operation_capabilities(p_root)),'revision',coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1),'can_manage',eflow_r7.manage(p_root,null),'can_transfer',eflow_r7.head(p_root),'nodes',v_nodes,'people',v_people,
 'leaf_total',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)),
 'leaf_completed',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and n.status='completed' and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)));
end $$;
-- Accepted 20261010105440_nested_work_own_lead_execution.sql; SHA256 7f36fea512aa28ce00e322e21ef4d226095dff87d3d074172b802300eb2fe3c9

set local lock_timeout = '10s';

-- Rewrite only reviewed assignment expressions in effective definitions.
-- CREATE OR REPLACE retains signatures, defaults, search paths and ACLs.
-- Fail setup if an anchor is absent/ambiguous; never guess a replacement body.
do $$
declare sig text; before_text text; after_text text; definition text;
begin
 for sig,before_text,after_text in select * from (values
  ('eflow_r7.node_work(uuid,uuid)',
   $before$p_user=any(coalesce(n.assigned_to_ids,'{}'::uuid[]))$before$,
   $after$(p_user=any(coalesce(n.assigned_to_ids,'{}'::uuid[]))
    or n.kind='office' and r->>'kind'='office' and n.lead_id=p_user
     and eflow_r7.chain(n.task_id,n.id))$after$),
  ('public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)',
   $before$subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[]))$before$,
   $after$case when eflow_r7.root(subtask_row.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[])) end$after$),
  ('public.submit_subtask_for_review(uuid,jsonb)',
   $before$subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[]))$before$,
   $after$case when eflow_r7.root(subtask_row.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[])) end$after$),
  ('public.guard_subtask_contributor_update()',
   $before$old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, '{}'::uuid[]))$before$,
   $after$case when eflow_r7.root(old.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(old.id,caller),false)
   else old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, '{}'::uuid[])) end$after$),
  ('eflow_evidence.can_upload(text)',
   $before$(coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text)$before$,
   $after$(case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end)$after$),
  ('eflow_evidence.guard_attempt()',
   $before$coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text$before$,
   $after$case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end$after$),
  ('eflow_evidence.guard_progress()',
   $before$coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text$before$,
   $after$case when eflow_r7.root(s.task_id)->>'kind'='office' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text end$after$)
 ) as changes(signature,assignment_before,assignment_after)
 loop
  if to_regprocedure(sig) is null then raise exception 'NW2.2 prerequisite function missing: %',sig; end if;
  definition := replace(pg_get_functiondef(sig::regprocedure),chr(13),'');
  before_text := replace(before_text,chr(13),'');
  after_text := replace(after_text,chr(13),'');
  if (length(definition)-length(replace(definition,before_text,'')))/length(before_text)<>1 then
   raise exception 'NW2.2 assignment anchor changed: %; inspect effective baseline',sig;
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $$;
-- Accepted 20261010144145_nested_work_office_review_routing.sql; SHA256 9993a5ed5ecca0acdf756eee2bb5b32b2619b678711229af792dfdf532dc38fc

do $$
declare
 definition text;
 anchor constant text := 'r:=eflow_r7.root(n.task_id);v_id:=n.parent_subtask_id;';
 replacement constant text := 'r:=eflow_r7.root(n.task_id);v_id:=case when r->>''kind''=''office'' and not exists(select 1 from public.tasks t where t.id=n.task_id and t.proposed_office_identity_id is not null) then n.id else n.parent_subtask_id end;';
begin
 select pg_get_functiondef('eflow_r7.reviewer(uuid,uuid)'::regprocedure) into definition;
 if strpos(definition,anchor)=0 and (length(definition)-length(replace(definition,replacement,'')))/length(replacement)=1 then
  return; -- Exact correction already installed; preserve its definition/ACL.
 end if;
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor) <> 1 then
  raise exception 'NW4.1 reviewer prerequisite changed; review effective definition';
 end if;
 definition:=replace(definition,anchor,replacement);
 execute definition;
end $$;
notify pgrst, 'reload schema';
-- Accepted 20261010161650_nested_work_approval_consistency.sql; SHA256 58fceb9b3d629ecbd35533ebe9ca30c9e0ccd7e2d07909ad3ad06806b01c6a02


-- Private serialization state only: no work, evidence or historical decisions
-- are backfilled. A real row update makes stale RR/Serializable writers fail.
create table if not exists eflow_r7.completion_locks (
 root_id uuid primary key,
 version bigint not null default 1,
 approval_xid xid8 not null,
 approved_ids uuid[] not null default '{}'
);
alter table eflow_r7.completion_locks enable row level security;
revoke all on eflow_r7.completion_locks from public,anon,authenticated,service_role;

create or replace function eflow_r7.lock_completion(p_root uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_root is null then return;end if;
 insert into eflow_r7.completion_locks(root_id,approval_xid)
 values(p_root,pg_catalog.pg_current_xact_id())
 on conflict(root_id) do update set
  version=eflow_r7.completion_locks.version+1,
  approval_xid=excluded.approval_xid,
  approved_ids=case when eflow_r7.completion_locks.approval_xid=excluded.approval_xid
   then eflow_r7.completion_locks.approved_ids else '{}'::uuid[] end;
end $$;

create or replace function eflow_r7.require_completed_descendants(p_root uuid,p_target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare personal boolean;bad record;
begin
 personal:=exists(select 1 from public.personal_tasks where id=p_root);
 with recursive required as (
  select n.* from eflow_r7.nodes n where n.task_id=p_root and
   (p_target=p_root or n.parent_subtask_id=p_target)
  union
  select c.* from eflow_r7.nodes c join required p on c.parent_subtask_id=p.id where c.task_id=p_root
 )
 select n.id,n.title into bad from required n
 left join public.subtasks s on s.id=n.id and not personal
 where n.status is distinct from 'completed' or not personal and (
  not coalesce(s.is_completed,false) or
  -- Legacy completed rows without an attempt remain valid. An existing formal
  -- binding must still identify its own approved attempt, never pending/rejected.
  s.latest_submission_id is not null and not exists(
   select 1 from public.subtask_submissions a where a.id=s.latest_submission_id
    and a.subtask_id=s.id and a.task_id=p_root and a.status='approved'))
 order by n.id limit 1;
 if found then
  raise exception 'Complete and review every descendant first: resolve descendant "%" (%) before approval.',bad.title,bad.id
   using errcode='23514',hint='Resolve or reapprove this descendant, reload the current work tree, then retry approval.';
 end if;
end $$;

create or replace function eflow_r7.lock_completion_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare r uuid;v_id uuid;approved boolean:=false;
begin
 if tg_table_name in ('tasks','personal_tasks') then r:=case when tg_op='DELETE' then old.id else new.id end;
 else r:=case when tg_op='DELETE' then old.task_id else new.task_id end;end if;
 perform eflow_r7.lock_completion(r);
 if tg_op<>'DELETE' and tg_table_name in ('tasks','subtasks','personal_tasks','personal_subtasks') then
  approved:=(tg_op='INSERT' or new.status is distinct from old.status) and new.status=case when tg_table_name='personal_tasks' then 'done' else 'completed' end;
  if approved then v_id:=new.id;end if;
 end if;
 if approved then
  update eflow_r7.completion_locks set approved_ids=array_append(approved_ids,v_id)
  where root_id=r and not(v_id=any(approved_ids));
  -- Give an actionable error before the unchanged legacy parent guard; the
  -- deferred check below still enforces the final state at commit.
  perform eflow_r7.require_completed_descendants(r,v_id);
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

create or replace function eflow_r7.check_completion_commit()
returns trigger language plpgsql security definer set search_path='' as $$
declare r uuid;target uuid;is_root boolean;personal boolean;
begin
 if tg_table_name in ('tasks','personal_tasks') then r:=case when tg_op='DELETE' then old.id else new.id end;
 else r:=case when tg_op='DELETE' then old.task_id else new.task_id end;end if;
 -- The BEFORE writer/entry-point lock remains held through this deferred check
 -- and commit. Later writes in this transaction also schedule this check, even
 -- when the caller switches constraints to IMMEDIATE. Historical approvals
 -- from another transaction are intentionally not re-decided or revoked.
 for target in select unnest(approved_ids) from eflow_r7.completion_locks
  where root_id=r and approval_xid=pg_catalog.pg_current_xact_id() loop
  personal:=exists(select 1 from public.personal_tasks where id=r);
  is_root:=target=r;
  if personal then
   if is_root then
    if not exists(select 1 from public.personal_tasks where id=target and status='done') then continue;end if;
   elsif not exists(select 1 from public.personal_subtasks where id=target and status='completed') then continue;
   end if;
  else
   if is_root then
    if not exists(select 1 from public.tasks where id=target and status='completed') then continue;end if;
   elsif not exists(select 1 from public.subtasks where id=target and status='completed') then continue;
   end if;
  end if;
  perform eflow_r7.require_completed_descendants(r,target);
 end loop;
 return null;
end $$;

-- Cover insertion/deletion/reparenting as well as status and formal attempt
-- changes. RLS, existing BEFORE guards and review-time locks remain installed.
do $$ declare t text;begin
 foreach t in array array['tasks','subtasks','personal_tasks','personal_subtasks','subtask_submissions'] loop
  execute format('drop trigger if exists nw42_completion_lock on public.%I',t);
  execute format('create trigger nw42_completion_lock before insert or update or delete on public.%I for each row execute function eflow_r7.lock_completion_write()',t);
  execute format('drop trigger if exists nw42_completion_commit on public.%I',t);
  execute format('create constraint trigger nw42_completion_commit after insert or update or delete on public.%I deferrable initially deferred for each row execute function eflow_r7.check_completion_commit()',t);
  -- A trusted repair may bypass historical workflow triggers using replica
  -- mode; this final consistency invariant must still participate in its lock.
  execute format('alter table public.%I enable always trigger nw42_completion_lock',t);
  execute format('alter table public.%I enable always trigger nw42_completion_commit',t);
 end loop;
end $$;

-- Acquire the common lock before the existing RPC row locks. Preserve the
-- entire effective definition, signature, ACL and original authority checks.
do $$ declare sig text;d text;call text;anchor text;marker text:='/* NW4.2 completion serialization */';begin
 foreach sig in array array[
  'public.decide_task_review(uuid,boolean,text,text)',
  'public.submit_task_for_review(uuid,jsonb)',
  'public.decide_subtask_review(uuid,boolean,text)',
  'public.submit_subtask_for_review(uuid,jsonb)',
  'public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)',
  'eflow_r7.command(uuid,integer,uuid,text,jsonb)'] loop
  d:=pg_catalog.pg_get_functiondef(sig::regprocedure);
  if strpos(d,marker)>0 then continue;end if;
  call:=case when sig like 'eflow_r7.command%' then 'p_root'
   when sig like 'public.%subtask%' then '(select task_id from public.subtasks where id=p_subtask_id)'
   else 'p_task_id' end;
  if d!~* '\mbegin\M' then raise exception 'Expected PL/pgSQL entry point: %',sig;end if;
  if sig like 'eflow_r7.command%' then
   -- Keep its project-before-root order, shared by access/appointment changes.
   anchor:='perform 1 from public.tasks where id=p_root for update;';
   if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'Expected command root lock: %',sig;end if;
   d:=replace(d,anchor,marker||' perform eflow_r7.lock_completion(p_root); '||anchor);
  else
   d:=regexp_replace(d,'\mbegin\M','begin '||marker||' perform eflow_r7.lock_completion('||call||');','i');
  end if;
  execute d;
 end loop;
end $$;
revoke all on function eflow_r7.lock_completion(uuid),eflow_r7.lock_completion_write(),eflow_r7.check_completion_commit(),eflow_r7.require_completed_descendants(uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
-- Accepted 20261010164510_nested_work_operation_safety.sql; SHA256 82d72c71808ca6111979016ffc067aa74378d8535a87c3bcc3425045d99d3fe0

set local lock_timeout='10s';

create or replace function eflow_r7.subtree_ids(p_root uuid,p_node uuid)
returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare ids uuid[]; invalid boolean;
begin
 if eflow_r7.root(p_root) is null then raise exception 'Work scope unavailable' using errcode='42501';end if;
 if p_node is not null and not exists(select 1 from eflow_r7.nodes where id=p_node and task_id=p_root) then
  raise exception 'Choose a node in this root' using errcode='23514';
 end if;
 -- Inspect ancestry as well as descendants: an orphan/cycle must not silently
 -- disappear from a rooted traversal. The ninth hop is diagnostic, not allowed.
 with recursive above as (
  select n.id origin,n.id,n.parent_subtask_id,array[n.id] path,1 depth,false cycle
  from eflow_r7.nodes n where n.task_id=p_root
  union all select a.origin,n.id,n.parent_subtask_id,a.path||n.id,a.depth+1,n.id=any(a.path)
  from above a join eflow_r7.nodes n on n.id=a.parent_subtask_id and n.task_id=p_root
  where not a.cycle and a.depth<=8
 ) select exists(select 1 from above a where a.cycle or a.depth>8 or
  a.parent_subtask_id is not null and not exists(select 1 from eflow_r7.nodes n where n.id=a.parent_subtask_id and n.task_id=p_root)) into invalid;
 if invalid then raise exception 'Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first' using errcode='23514';end if;
 with recursive below as (
  select id from eflow_r7.nodes where task_id=p_root and (p_node is null or id=p_node)
  union select n.id from eflow_r7.nodes n join below b on n.parent_subtask_id=b.id where n.task_id=p_root
 ) select coalesce(array_agg(id order by id),'{}') into ids from below;
 return ids;
end $$;

create or replace function eflow_r7.history_facts(p_root uuid,p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root); facts jsonb; codes text[]:='{}'; k text; v bigint;
begin
 if r is null or p_ids is null or exists(select 1 from unnest(p_ids) x where not exists(select 1 from eflow_r7.nodes n where n.id=x and n.task_id=p_root)) then
  raise exception 'Required history scope unavailable' using errcode='23514';end if;
 select jsonb_build_object('state',(select count(*) from eflow_r7.nodes where task_id=p_root and id=any(p_ids) and (status<>'todo' or percent_complete<>0)),
  'progress',0,'submissions',0,'reviews',0,'attachments',0,'evidence',0,'attempts',0,'allocations',0,'allocation_lines',0,'cash',0,'ledger',0,'execution_events',0) into facts;
 if r->>'kind'='office' then
  -- Missing canonical relations/columns cause an error; never treat unavailable
  -- history as an empty result. Count inactive/cancelled/rejected finance too.
  with allocations as (select id from public.work_budget_allocations where subtask_id=any(p_ids)),
  lines as (select id from public.work_budget_allocation_lines where allocation_id in(select id from allocations)),
  cash as (select c.id from public.petty_cash_requests c where c.subtask_id=any(p_ids) or c.allocation_id in(select id from allocations)
   or c.allocation_line_id in(select id from lines) or exists(select 1 from public.petty_cash_request_lines l where l.request_id=c.id and l.allocation_line_id in(select id from lines)))
  select facts||jsonb_build_object(
   'state',(select count(*) from public.subtasks where task_id=p_root and id=any(p_ids) and (status<>'todo' or percent_complete<>0 or is_completed or latest_submission_id is not null or completed_by is not null or completed_at is not null)),
   'progress',(select count(*) from public.subtask_progress_updates where subtask_id=any(p_ids)),
   'submissions',(select count(*) from public.subtask_submissions where subtask_id=any(p_ids)),
   'reviews',(select count(*) from public.subtask_submissions where subtask_id=any(p_ids) and (status<>'pending' or decided_by is not null or decided_at is not null)),
   'attachments',(select count(*) from public.subtask_submission_attachments a where a.subtask_id=any(p_ids) or a.submission_id in(select id from public.subtask_submissions where subtask_id=any(p_ids))),
   'evidence',(select count(*) from eflow_evidence.objects o where o.subtask_id=any(p_ids)
    or o.reference_kind='subtask_attachment' and o.reference_id in(select id from public.subtask_submission_attachments where subtask_id=any(p_ids))
    or o.reference_kind='progress' and o.reference_id in(select id from public.subtask_progress_updates where subtask_id=any(p_ids))),
   'attempts',(select count(*) from eflow_evidence.attempts a where a.subtask_id=any(p_ids) or a.kind='subtask' and a.submission_id in(select id from public.subtask_submissions where subtask_id=any(p_ids))),
   'allocations',(select count(*) from allocations),'allocation_lines',(select count(*) from lines),'cash',(select count(*) from cash),
   'ledger',(select count(*) from public.budget_ledger_entries l where l.subtask_id=any(p_ids) or l.allocation_id in(select id from allocations) or l.petty_cash_request_id in(select id from cash))) into facts;
 else
  facts:=facts||jsonb_build_object('state',(select count(*) from public.personal_subtasks where task_id=p_root and id=any(p_ids) and
   (status<>'todo' or percent_complete<>0 or submitted_by is not null or reviewer_id is not null)),
   'execution_events',(select count(*) from public.work_tree_events e where e.root_id=p_root and
    (e.command in ('progress','submit','review') and e.node_id=any(p_ids) or exists(
     select 1 from jsonb_array_elements(coalesce(e.before_data->'nodes','[]')||coalesce(e.after_data->'nodes','[]')) n
     where n->>'id'=any(p_ids::text[]) and (not(n ? 'status' and n ? 'percent_complete') or coalesce(n->>'status','todo')<>'todo' or coalesce((n->>'percent_complete')::numeric,0)<>0
      or nullif(n->>'submitted_by','') is not null))))) ;
 end if;
 for k,v in select key,value::bigint from jsonb_each_text(facts) order by key loop
  if v>0 then codes:=array_append(codes,case when k='state' then 'lifecycle_blocked' else 'history_'||k end);end if;
 end loop;
 return jsonb_build_object('counts',facts,'blocker_codes',to_jsonb(codes),'untouched',cardinality(codes)=0);
end $$;

create or replace function eflow_r7.operation_impact(p_root uuid,p_command text,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);n eflow_r7.nodes; target uuid:=(p_payload->>'id')::uuid;
 parent uuid:=(p_payload->>'parent')::uuid;ids uuid[]:='{}';selected uuid[]:='{}';extra uuid[];row_id uuid;
 structural boolean:=false;facts jsonb;codes text[]:='{}';incoming uuid[];old_people uuid[];lead uuid;compatibility_ids uuid[]:='{}';
begin
 if r is null then raise exception 'Work scope unavailable' using errcode='42501';end if;
 -- Validate bounded topology even when the command's selected scope is empty.
 extra:=eflow_r7.subtree_ids(p_root,null);
 if target is not null and p_command<>'create' then
  select * into n from eflow_r7.nodes where id=target and task_id=p_root;
  if not found then raise exception 'Choose a node in this root' using errcode='23514';end if;
 end if;
 if p_command in ('delete','edit','move','staff') then selected:=eflow_r7.subtree_ids(p_root,target);ids:=selected;
 elsif p_command in ('root_lead','contributors') then selected:=extra;ids:=selected;
 elsif p_command='create' then
  if parent is not null then selected:=array[parent];ids:=eflow_r7.subtree_ids(p_root,parent);end if;
 elsif p_command='order' then
  if parent is not null then perform eflow_r7.subtree_ids(p_root,parent);end if;
  for row_id in select id from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent loop
   selected:=array_append(selected,row_id);ids:=ids||eflow_r7.subtree_ids(p_root,row_id);
  end loop;
 end if;
 structural:=p_command in ('move','order','delete','create') or p_command='edit' and p_payload ? 'standalone' and (p_payload->>'standalone')::boolean is distinct from n.is_standalone;
 if p_command='move' or p_command='edit' and structural then
  if p_command='move' and n.parent_subtask_id is not null then ids:=ids||array[n.parent_subtask_id];end if;
  if p_command='move' and parent is not null then perform eflow_r7.subtree_ids(p_root,parent);ids:=ids||array[parent];end if;
  -- Dependency scopes at both endpoints; include every sibling's descendants.
  for row_id in select id from eflow_r7.nodes where task_id=p_root and
   (parent_subtask_id is not distinct from n.parent_subtask_id or p_command='move' and parent_subtask_id is not distinct from parent) loop
   ids:=ids||eflow_r7.subtree_ids(p_root,row_id);
  end loop;
 end if;
 select coalesce(array_agg(distinct x order by x),'{}') into ids from unnest(ids) x;
 facts:=eflow_r7.history_facts(p_root,ids);
 if structural then select coalesce(array_agg(value),'{}') into codes from jsonb_array_elements_text(facts->'blocker_codes');end if;
 if p_command in ('staff','root_lead','contributors') then
  lead:=case when p_command='contributors' then (r->>'lead')::uuid else (p_payload->>'lead')::uuid end;
  old_people:=case when target is null then array(select value::uuid from jsonb_array_elements_text(coalesce(r->'people','[]'))) else coalesce(n.assigned_to_ids,'{}') end;
  if r->>'kind'='office' or target is not null then
   incoming:=case when p_payload ? 'people' then array(select value::uuid from jsonb_array_elements_text(p_payload->'people'))
    when p_command='root_lead' then array_remove(old_people||array[lead],null) else '{}'::uuid[] end;
   if p_command in ('staff','root_lead') and lead is distinct from (case when target is null then (r->>'lead')::uuid else n.lead_id end) and not(old_people <@ incoming) then
    codes:=codes||array['transfer_worker_removal'];
   end if;
   if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.id=any(selected) and c.id is distinct from target
    and c.status<>'completed' and exists(select 1 from unnest(c.assigned_to_ids) worker where worker=any(old_people) and not worker=any(incoming))) then
    codes:=codes||array['unfinished_worker_removal'];
   end if;
  end if;
 end if;
 if r->>'kind'='office' and p_command in ('create','edit','staff','root_lead','move','order','delete') then
  -- Existing R7 writes derived global positions after these commands. Track
  -- prospective position changes separately from canonical dependency scopes:
  -- changing a compatibility number does not itself reopen historical work.
  with recursive planned as (
   select c.id,case when p_command='move' and c.id=target then parent else c.parent_subtask_id end parent_id,
    case when p_command='move' and c.id=target then (select coalesce(max(sibling_order),-1)+1 from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent)
     when p_command='order' and p_payload ? 'order' and c.parent_subtask_id is not distinct from parent then
      (select ordinality::integer-1 from jsonb_array_elements_text(p_payload->'order') with ordinality x where x.value=c.id::text)
     else c.sibling_order end sibling_order
   from eflow_r7.nodes c where c.task_id=p_root and not(p_command='delete' and c.id=any(selected))
   union all select target,parent,(select coalesce(max(sibling_order),-1)+1 from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent)
    where p_command='create' and target is not null and not exists(select 1 from eflow_r7.nodes where id=target)
  ), ordered as (
   select id,array[lpad(sibling_order::text,10,'0')||id::text] path,1 depth from planned where parent_id is null
   union all select c.id,o.path||(lpad(c.sibling_order::text,10,'0')||c.id::text),o.depth+1 from planned c join ordered o on c.parent_id=o.id where o.depth<8
  ), ranked as (select id,row_number() over(order by path)-1 position from ordered)
  select coalesce(array_agg(c.id order by c.id),'{}') into compatibility_ids from public.subtasks c join ranked x on x.id=c.id where c.task_id=p_root and c.position<>x.position;
 end if;
 return jsonb_build_object('root_id',p_root,'command',p_command,'allowed',cardinality(codes)=0,'blocker_codes',to_jsonb(codes),
  'ids',to_jsonb(ids),'selected_count',cardinality(selected),'descendant_count',greatest(cardinality(selected)-case when target is null then 0 else 1 end,0),
  'affected_appointment_count',(select count(*) from eflow_r7.nodes where task_id=p_root and id=any(selected) and lead_id is not null
   and (p_command='root_lead' and (p_payload->>'lead')::uuid is distinct from (r->>'lead')::uuid
    or p_command='move' and id<>target or p_command='staff' and (p_payload->>'lead')::uuid is distinct from n.lead_id and id<>target)),
  'compatibility_position_ids',to_jsonb(compatibility_ids),'history',facts,'structural',structural);
end $$;

create or replace function eflow_r7.require_operation(p_root uuid,p_command text,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare impact jsonb;
begin
 impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);
 if not (impact->>'allowed')::boolean then raise exception 'Work history or dependent responsibilities block this operation: %; resolve affected work first',impact->'blocker_codes'
  using errcode='23514',hint='Preserve recorded evidence and finance; resolve staffing separately. Confirmation cannot override protected history.';end if;
end $$;

create or replace function eflow_r7.guard_operation_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb:=case when tg_op<>'INSERT' then to_jsonb(old) else '{}' end;
 b jsonb:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}' end;
 root_id uuid; r jsonb; node_id uuid; cmd text;payload jsonb;
begin
 root_id:=case when tg_table_name in ('tasks','personal_tasks') then (b->>'id')::uuid else coalesce((a->>'task_id')::uuid,(b->>'task_id')::uuid) end;
 r:=eflow_r7.root(root_id);if r is null then if tg_op='DELETE' then return old;else return new;end if;end if;
 -- Preserve the private R9 UPDATE-only staffing removal, never a client marker
 -- or a structural bypass. Existing R9 authority/preview/serialization is kept.
 if tg_op='UPDATE' and eflow_r9.internal((r->>'project')::uuid) and
  (a-array['lead_id','assigned_to','recommendation_lead_id','assigned_to_ids','team_member_ids','team_member_names','assignee_name','reviewer_id','backup_reviewer_id','revision','updated_at'])=
  (b-array['lead_id','assigned_to','recommendation_lead_id','assigned_to_ids','team_member_ids','team_member_names','assignee_name','reviewer_id','backup_reviewer_id','revision','updated_at']) then return new;end if;
 if auth.uid() is not null and not coalesce(eflow_r7.read_root(root_id),false) then raise exception 'Current work access required' using errcode='42501';end if;
 if tg_table_name in ('tasks','personal_tasks') then
  if tg_op='UPDATE' and coalesce(b->>'lead_id',b->>'assigned_to',b->>'recommendation_lead_id') is distinct from coalesce(a->>'lead_id',a->>'assigned_to',a->>'recommendation_lead_id') then
   cmd:='root_lead';payload:=jsonb_build_object('lead',coalesce(b->>'lead_id',b->>'assigned_to',b->>'recommendation_lead_id'),'people',b->'team_member_ids');
   if tg_table_name='personal_tasks' then payload:=payload-'people';end if;
  elsif tg_op='UPDATE' and b->'team_member_ids' is distinct from a->'team_member_ids' then cmd:='contributors';payload:=jsonb_build_object('people',b->'team_member_ids');end if;
 else
  node_id:=coalesce((a->>'id')::uuid,(b->>'id')::uuid);
  if tg_op='DELETE' then cmd:='delete';payload:=jsonb_build_object('id',node_id);
  elsif tg_op='INSERT' then cmd:='create';payload:=jsonb_build_object('id',node_id,'parent',b->'parent_subtask_id');
  elsif b->'parent_subtask_id' is distinct from a->'parent_subtask_id' then cmd:='move';payload:=jsonb_build_object('id',node_id,'parent',b->'parent_subtask_id');
  elsif b->'sibling_order' is distinct from a->'sibling_order' or b->'position' is distinct from a->'position' and not eflow_r7.internal(root_id) then cmd:='order';payload:=jsonb_build_object('parent',a->'parent_subtask_id');
  elsif b->'is_standalone' is distinct from a->'is_standalone' then cmd:='edit';payload:=jsonb_build_object('id',node_id,'standalone',b->'is_standalone');
  elsif b->'lead_id' is distinct from a->'lead_id' or b->'assigned_to_ids' is distinct from a->'assigned_to_ids' then
   -- Canonical transfer/move clears descendants after checking the full scope.
   if b->>'lead_id' is null and eflow_r7.internal(root_id) and b->'assigned_to_ids'=a->'assigned_to_ids' then return new;end if;
   cmd:='staff';payload:=jsonb_build_object('id',node_id,'lead',b->'lead_id','people',b->'assigned_to_ids');
  elsif b->'title' is distinct from a->'title' or b->'due_date' is distinct from a->'due_date' then
   cmd:='edit';payload:=jsonb_build_object('id',node_id,'title',b->'title','due',b->'due_date','standalone',b->'is_standalone');
  end if;
 end if;
 if cmd is not null then perform eflow_r7.require_operation(root_id,cmd,payload);end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

revoke all on function eflow_r7.subtree_ids(uuid,uuid),eflow_r7.history_facts(uuid,uuid[]),eflow_r7.operation_impact(uuid,text,jsonb),
 eflow_r7.require_operation(uuid,text,jsonb),eflow_r7.guard_operation_write() from public,anon,authenticated,service_role;

-- Original R7 entry: after authority/payload/revision checks and before any
-- snapshot/marker/write. Exact receipt retries return through the old early path.
do $$declare d text;anchor text:='v_before:=eflow_r7.snapshot(p_root);';begin
 select pg_get_functiondef('eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure) into d;
 if strpos(d,'/* NW5.1 operation safety */')=0 then
  if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'Review changed R7 command before adding history checks';end if;
  execute replace(d,anchor,'/* NW5.1 operation safety */ if p_command not in (''progress'',''submit'',''review'') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if; '||anchor);
 end if;
end $$;

drop trigger if exists nw51_operation_safety on public.subtasks;
create trigger nw51_operation_safety before insert or update or delete on public.subtasks for each row execute function eflow_r7.guard_operation_write();
drop trigger if exists nw51_operation_safety on public.personal_subtasks;
create trigger nw51_operation_safety before insert or update or delete on public.personal_subtasks for each row execute function eflow_r7.guard_operation_write();
drop trigger if exists nw51_operation_safety on public.tasks;
create trigger nw51_operation_safety before update on public.tasks for each row execute function eflow_r7.guard_operation_write();
drop trigger if exists nw51_operation_safety on public.personal_tasks;
create trigger nw51_operation_safety before update on public.personal_tasks for each row execute function eflow_r7.guard_operation_write();

-- Keep NW2's authority/lifecycle and JSON shape. Additional history predicates
-- use the same collector; staffing remains an authorized active-work amendment.
do $$declare d text;anchor text:='result := result || jsonb_build_object(action,jsonb_build_object(''allowed'',reason is null,''reason_code'',reason));';addition text;begin
 select pg_get_functiondef('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure) into d;
 addition:=$patch$/* NW5.1 history capability */
  if reason is null and action in ('create_child','order_children','move','delete') then
   if not (eflow_r7.operation_impact(p_root,case action when 'create_child' then 'create' when 'order_children' then 'order' else action end,
    case when action in ('create_child','order_children') then jsonb_build_object('parent',p_node) else jsonb_build_object('id',p_node,'parent',n.parent_subtask_id) end)->>'allowed')::boolean then reason:='history_blocked';end if;
  end if;
 $patch$;
 if strpos(d,'/* NW5.1 history capability */')=0 then
  if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'Review changed capability projector';end if;
  execute replace(d,anchor,addition||anchor);
 end if;
end $$;
-- Accepted 20261010172348_nested_work_r9_staffing_removal.sql; SHA256 efe8559aa96c36a6b057e05ee4487b7711ddc46a0cc4a7796c3c8e07080815ec


-- NW5.1: exact UPDATE permissions, created only by the private confirmed R9
-- removal path after current authority/fingerprint validation under its locks.
-- Neither a client-set GUC nor R9's older generic mutation marker grants this.
create table if not exists eflow_r9.staffing_removals (
 tx xid8 not null, actor uuid not null, project_id uuid not null,
 office_id uuid, removed_user uuid not null, request_id uuid not null, fingerprint text not null,
 relation_name text not null, row_id uuid not null,
 before_row jsonb not null, after_row jsonb not null,
 primary key(tx,relation_name,row_id)
);
alter table eflow_r9.staffing_removals enable row level security;
revoke all on eflow_r9.staffing_removals from public,anon,authenticated,service_role;

create or replace function eflow_r9.staffing_removal_allowed(p_table text,p_old jsonb,p_new jsonb)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eflow_r9.staffing_removals m
  where m.tx=pg_catalog.pg_current_xact_id() and m.actor=auth.uid()
   and m.relation_name=p_table and m.row_id=(p_old->>'id')::uuid
   and eflow_r9.person_head(m.project_id,m.office_id)
   and m.before_row=p_old-'updated_at' and m.after_row=p_new-'updated_at')
$$;

create or replace function eflow_r9.guard_staffing_removal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id()) then
  if tg_op<>'UPDATE' then
   raise exception 'Confirmed member removal permits only its exact current staffing cleanup' using errcode='42501';
  end if;
  if not eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then
   raise exception 'Confirmed member removal cannot change work facts or unrelated staffing' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;

create or replace function eflow_r9.lock_removal_work(p_project uuid,p_office uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r record;
begin
 -- Caller already holds the original R9 project advisory lock. Acquire root
 -- completion serialization before root/item rows, as NW4.2 approval does.
 perform 1 from public.projects where id=p_project for update;
 perform 1 from public.personal_projects where id=p_project for update;
 for r in select id from public.tasks where linked_project_id=p_project and org_id=p_office
  union all select id from public.personal_tasks where project_id=p_project order by id loop
  perform eflow_r7.lock_completion(r.id);
  perform 1 from public.tasks where id=r.id for update;
  perform 1 from public.personal_tasks where id=r.id for update;
 end loop;
 perform 1 from public.subtasks n join public.tasks t on t.id=n.task_id
  where t.linked_project_id=p_project and t.org_id=p_office order by n.id for update of n;
 perform 1 from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id
  where t.project_id=p_project order by n.id for update of n;
 perform 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id
  where o.project_id=p_project and o.office_id=p_office order by m.user_id for update of m;
 perform 1 from public.personal_project_members where project_id=p_project order by user_id for update;
end $$;

create or replace function eflow_r9.clear_removed_staff(p_project uuid,p_user uuid,p_office uuid,p_request uuid,p_fingerprint text)
returns void language plpgsql security definer set search_path='' as $$
declare v jsonb; roots uuid[];v_nodes uuid[];clear_leads uuid[];r record;a jsonb;b jsonb;
begin
 perform eflow_r3.actor();
 if p_request is null or not eflow_r9.person_head(p_project,p_office) then
  raise exception 'Current confirmed removal authority required' using errcode='42501';end if;
 v:=eflow_r9.preview(p_project,p_user,p_office);
 if v->>'fingerprint' is distinct from p_fingerprint then
  raise exception 'Membership or assignments changed. Refresh the impact preview before confirming.' using errcode='40001';end if;
 v:=v-'fingerprint';
 select coalesce(array_agg((x->>'id')::uuid),'{}') into roots from jsonb_array_elements(v->'tasks') x
  where coalesce((x->>'lead')::uuid,(x->>'recommendation_lead')::uuid)=p_user;
 select coalesce(array_agg((x->>'id')::uuid),'{}') into v_nodes from jsonb_array_elements(v->'nodes') x;
 select coalesce(array_agg(id),'{}') into clear_leads from eflow_r7.nodes
  where id=any(v_nodes) and (lead_id=p_user or task_id=any(roots) or id in
   (with recursive below as (select id from eflow_r7.nodes where lead_id=p_user
    union select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select id from below));
 -- Copy every work fact unchanged. Only the exact R9 staffing deltas are
 -- projected. Stored reviewer IDs/names/decisions are deliberately untouched.
 for r in select * from (
  select 'subtasks' relation_name,to_jsonb(n) j from public.subtasks n where id=any(v_nodes)
  union all select 'personal_subtasks',to_jsonb(n) from public.personal_subtasks n where id=any(v_nodes)
  union all select 'tasks',to_jsonb(t) from public.tasks t where linked_project_id=p_project and org_id=p_office
   and id in(select (x->>'id')::uuid from jsonb_array_elements(v->'tasks') x)
  union all select 'personal_tasks',to_jsonb(t) from public.personal_tasks t where project_id=p_project
   and id in(select (x->>'id')::uuid from jsonb_array_elements(v->'tasks') x)
  ) affected order by relation_name,j->>'id'
 loop
  a:=r.j-'updated_at';b:=a;
  if r.relation_name in ('subtasks','personal_subtasks') then
   b:=b||jsonb_build_object('assigned_to_ids',array_remove(array(select x::uuid from jsonb_array_elements_text(a->'assigned_to_ids') x),p_user),
    'lead_id',case when (a->>'id')::uuid=any(clear_leads) then null else (a->>'lead_id')::uuid end);
   if r.relation_name='subtasks' and (a->>'assigned_to')::uuid=p_user then b:=b||jsonb_build_object('assigned_to',null);end if;
  elsif r.relation_name='tasks' then
   b:=b||jsonb_build_object('assigned_to',case when (a->>'id')::uuid=any(roots) then null else (a->>'assigned_to')::uuid end,
    'recommendation_lead_id',case when (a->>'id')::uuid=any(roots) or (a->>'recommendation_lead_id')::uuid=p_user then null else (a->>'recommendation_lead_id')::uuid end,
    'assignee_name',case when (a->>'id')::uuid=any(roots) then '' else a->>'assignee_name' end);
   if a->'team_member_ids' @> jsonb_build_array(p_user) then
    b:=b||jsonb_build_object('team_member_ids',array(select x::uuid from jsonb_array_elements_text(a->'team_member_ids') x where x::uuid<>p_user),
     'team_member_names',array(select a->'team_member_names'->>(pos::int-1) from jsonb_array_elements_text(a->'team_member_ids') with ordinality x(uid,pos) where uid::uuid<>p_user order by pos));
   end if;
  else
   b:=b||jsonb_build_object('lead_id',case when (a->>'lead_id')::uuid=p_user then null else (a->>'lead_id')::uuid end);
   if b<>a then b:=b||jsonb_build_object('revision',(a->>'revision')::integer+1);end if;
  end if;
  if b<>a then insert into eflow_r9.staffing_removals values(pg_catalog.pg_current_xact_id(),auth.uid(),p_project,p_office,p_user,p_request,p_fingerprint,r.relation_name,(a->>'id')::uuid,a,b);end if;
 end loop;
 insert into eflow_r9.mutations values(txid_current(),p_project);
 for r in select * from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id() order by relation_name,row_id loop
  if r.relation_name='subtasks' then
   update public.subtasks set assigned_to=(r.after_row->>'assigned_to')::uuid,
    assigned_to_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->'assigned_to_ids') x),lead_id=(r.after_row->>'lead_id')::uuid where id=r.row_id;
  elsif r.relation_name='personal_subtasks' then
   update public.personal_subtasks set assigned_to_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->'assigned_to_ids') x),lead_id=(r.after_row->>'lead_id')::uuid where id=r.row_id;
  elsif r.relation_name='tasks' then
   update public.tasks set assigned_to=(r.after_row->>'assigned_to')::uuid,recommendation_lead_id=(r.after_row->>'recommendation_lead_id')::uuid,
    assignee_name=r.after_row->>'assignee_name',team_member_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->'team_member_ids') x),
    team_member_names=array(select x from jsonb_array_elements_text(r.after_row->'team_member_names') x) where id=r.row_id;
  else
   update public.personal_tasks set lead_id=(r.after_row->>'lead_id')::uuid,revision=(r.after_row->>'revision')::integer where id=r.row_id;
  end if;
 end loop;
 -- Verify the persisted rows too, including any trigger effects. An unexpected
 -- side effect rolls back the entire removal, membership, audit and receipt.
 for r in select * from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id() loop
  execute format('select to_jsonb(t)-''updated_at'' from public.%I t where id=$1',r.relation_name) into b using r.row_id;
  if b is distinct from r.after_row then raise exception 'Member removal changed protected work facts' using errcode='42501',
   detail=r.relation_name||': '||(select string_agg(k,', ' order by k) from jsonb_object_keys(r.after_row) k where r.after_row->k is distinct from b->k);end if;
 end loop;
 delete from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id();
 delete from eflow_r9.mutations where tx=txid_current() and project_id=p_project;
 insert into eflow_r7.tree_state(root_id,revision) select id,2 from public.tasks where linked_project_id=p_project and org_id=p_office
  union all select id,2 from public.personal_tasks where project_id=p_project on conflict(root_id) do update set revision=eflow_r7.tree_state.revision+1;
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,auth.uid(),'assignments_cleared',v);
end $$;

revoke all on function eflow_r9.staffing_removal_allowed(text,jsonb,jsonb),eflow_r9.guard_staffing_removal(),eflow_r9.lock_removal_work(uuid,uuid),eflow_r9.clear_removed_staff(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

do $$declare d text;n text;begin
 select pg_get_functiondef('eflow_r9.remove_person(uuid,uuid,uuid,text,uuid)'::regprocedure) into d;
 if strpos(d,'/* NW5.1 confirmed staffing */')=0 then
  if strpos(d,'v:=eflow_r9.preview(p_project,p_user,p_office);')=0 or strpos(d,'perform eflow_r9.clear_staff(p_project,p_user,p_office);')=0 then raise exception 'Unexpected R9 removal definition';end if;
  d:=replace(d,'v:=eflow_r9.preview(p_project,p_user,p_office);','/* NW5.1 confirmed staffing */ perform eflow_r9.lock_removal_work(p_project,p_office); v:=eflow_r9.preview(p_project,p_user,p_office);');
  d:=replace(d,'perform eflow_r9.clear_staff(p_project,p_user,p_office);','perform eflow_r9.clear_removed_staff(p_project,p_user,p_office,p_request,p_fingerprint);');execute d;
 end if;
 select pg_get_functiondef('public.guard_subtask_mutation()'::regprocedure) into d;
 if strpos(d,'/* NW5.1 exact R9 UPDATE */')=0 then
  d:=overlay(d placing 'begin /* NW5.1 exact R9 UPDATE */ if tg_op=''UPDATE'' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;' from strpos(lower(d),'begin') for 5);execute d;
 end if;
 -- These existing INVOKER triggers otherwise reroute/revalidate historical
 -- reviewer metadata merely because a current staffing column is updated.
 -- Keep their normal routing/validation bodies and invoker security unchanged.
 -- API roles cannot execute the predicate; nested IF avoids calling it at all
 -- in their direct writes. Other definer RPCs have no exact removal capability.
 foreach n in array array['public.route_organization_leadership_review()','public.validate_task_reviewers()'] loop
  select pg_get_functiondef(n::regprocedure) into d;
  if strpos(d,'/* NW5.1 preserve historical reviewers */')=0 then
   d:=overlay(d placing 'begin /* NW5.1 preserve historical reviewers */ if tg_op=''UPDATE'' then if pg_catalog.has_function_privilege(current_user,''eflow_r9.staffing_removal_allowed(text,jsonb,jsonb)'',''EXECUTE'') then if eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;end if;end if;' from strpos(lower(d),'begin') for 5);execute d;
  end if;
 end loop;
 -- The existing AFTER staffing hook normally rebuilds channel membership.
 -- In a removal it must clear only the departing person's derived current
 -- task access, retaining other participants and all chat/activity history.
 select pg_get_functiondef('public.sync_task_chat_channel()'::regprocedure) into d;
 if strpos(d,'/* NW5.1 current chat access only */')=0 then
  d:=overlay(d placing 'begin /* NW5.1 current chat access only */ if tg_op=''UPDATE'' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then delete from public.chat_channel_members c using public.chat_channels h,eflow_r9.staffing_removals m where c.channel_id=h.id and h.task_id=new.id and m.tx=pg_catalog.pg_current_xact_id() and m.relation_name=tg_table_name and m.row_id=new.id and c.user_id=m.removed_user;return new;end if;' from strpos(lower(d),'begin') for 5);execute d;
 end if;
 foreach n in array array['tasks','subtasks','personal_tasks','personal_subtasks'] loop
  execute format('drop trigger if exists a0_nw51_staffing_boundary on public.%I',n);
  execute format('create trigger a0_nw51_staffing_boundary before insert or update or delete on public.%I for each row execute function eflow_r9.guard_staffing_removal()',n);
 end loop;
end $$;
-- Accepted 20261010175812_nested_work_checked_confirmation.sql; SHA256 43b0c624ae81fda5b59398f00ce1a4b0f96f61ff934a8c8be261ccd3e4c31708

set local lock_timeout='10s';

-- Resolve all canonical and historical fallback links. No caller-controlled
-- relation names or dynamic lookup paths are accepted by this resolver.
create or replace function eflow_r7.history_roots(p_row jsonb) returns uuid[]
language sql stable security definer set search_path='' as $$
 with links as (
  select nullif(p_row->>'task_id','')::uuid id
  union select nullif(p_row->>'root_id','')::uuid
  union select task_id from public.subtasks where id=nullif(p_row->>'subtask_id','')::uuid
  union select task_id from public.subtask_submissions where id=nullif(p_row->>'submission_id','')::uuid
  union select task_id from public.task_submissions where id=nullif(p_row->>'submission_id','')::uuid
  union select task_id from public.work_budget_allocations where id=nullif(p_row->>'allocation_id','')::uuid
  union select a.task_id from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id
   where l.id=any(array[nullif(p_row->>'allocation_line_id','')::uuid,nullif(p_row->>'parent_allocation_line_id','')::uuid])
  union select c.task_id from public.petty_cash_requests c where c.id=any(array[nullif(p_row->>'request_id','')::uuid,nullif(p_row->>'petty_cash_request_id','')::uuid])
  union select a.task_id from public.petty_cash_requests c join public.work_budget_allocations a on a.id=c.allocation_id
   where c.id=any(array[nullif(p_row->>'request_id','')::uuid,nullif(p_row->>'petty_cash_request_id','')::uuid])
  union select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id
   where l.id=nullif(p_row->>'liquidation_id','')::uuid
  union select c.task_id from public.petty_cash_receipts r join public.petty_cash_liquidations l on l.id=r.liquidation_id
   join public.petty_cash_requests c on c.id=l.request_id where r.id=nullif(p_row->>'receipt_id','')::uuid
 ) select coalesce(array_agg(distinct id order by id) filter(where id is not null),'{}'::uuid[]) from links
$$;

-- Advisory precedes explicit project/completion/root/node row locks in RPCs.
-- The real completion-version write also rejects old repeatable-read snapshots.
create or replace function eflow_r7.lock_impact(p_root uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);pid uuid;
begin
 if r is null then return;end if;pid:=(r->>'project')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:'||pid::text,0));
 perform 1 from public.projects where id=pid for update;
 perform 1 from public.personal_projects where id=pid for update;
 perform eflow_r7.lock_completion(p_root);
 perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 perform 1 from public.subtasks where task_id=p_root order by id for update;
 perform 1 from public.personal_subtasks where task_id=p_root order by id for update;
end $$;

create or replace function eflow_r7.serialize_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare roots uuid[]:='{}';root_id uuid;r jsonb;row_data jsonb;
begin
 if tg_op<>'INSERT' then roots:=roots||eflow_r7.history_roots(to_jsonb(old));end if;
 if tg_op<>'DELETE' then roots:=roots||eflow_r7.history_roots(to_jsonb(new));end if;
 -- Direct writes already hold their target tuple when a row trigger runs.
 -- Take the advisory and real version lock without acquiring unrelated nodes:
 -- opposite tuple/advisory order may abort with a deadlock, never bypass safety.
 for root_id in select distinct x from unnest(roots) x order by x loop
  r:=eflow_r7.root(root_id);
  if r is not null then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:'||(r->>'project'),0));
   perform eflow_r7.lock_completion(root_id);
  end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

-- BEFORE guards, including evidence sealing and AFTER financial audit producers.
-- No policies/permissions/financial or evidence validation are replaced.
do $$declare rel text;begin
 foreach rel in array array[
 'public.subtask_progress_updates','public.subtask_submissions','public.subtask_submission_attachments',
 'public.task_submissions','public.task_attachments','eflow_evidence.attempts','eflow_evidence.objects',
 'public.work_budget_allocations','public.work_budget_allocation_lines','public.petty_cash_requests',
 'public.petty_cash_request_lines','public.petty_cash_releases','public.petty_cash_liquidations','public.petty_cash_receipts',
 'public.petty_cash_receipt_items','public.petty_cash_request_attachments','public.budget_ledger_entries','public.work_tree_events'
 ] loop
  if pg_catalog.to_regclass(rel) is null then raise exception 'Required NW5.2 writer relation missing: %',rel;end if;
  execute pg_catalog.format('drop trigger if exists a_nw52_history_serialization on %s',rel);
  execute pg_catalog.format('create trigger a_nw52_history_serialization before insert or update or delete on %s for each row execute function eflow_r7.serialize_history()',rel);
 end loop;
end $$;

-- Fingerprint rows stay private. Conservatively include the entire root's
-- current topology and root-linked history: independent sibling history may
-- require another preview, but does not become a branch eligibility blocker.
create or replace function eflow_r7.impact_fingerprint(p_root uuid,p_command text,p_payload jsonb,p_impact jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare facts jsonb;history jsonb:='{}';rel text;rows jsonb;
begin
 facts:=jsonb_build_object('root',eflow_r7.root(p_root),'nodes',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from eflow_r7.nodes n where task_id=p_root),
  'office_root',(select to_jsonb(t) from public.tasks t where id=p_root),'personal_root',(select to_jsonb(t) from public.personal_tasks t where id=p_root),
  'office_nodes',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.subtasks n where task_id=p_root),
  'personal_nodes',(select coalesce(jsonb_agg(to_jsonb(n) order by id),'[]') from public.personal_subtasks n where task_id=p_root),
  'snapshot',eflow_r7.snapshot(p_root),'impact',p_impact,'command',p_command,'payload',p_payload);
 foreach rel in array array[
 'public.subtask_progress_updates','public.subtask_submissions','public.subtask_submission_attachments',
 'public.task_submissions','public.task_attachments','eflow_evidence.attempts','eflow_evidence.objects',
 'public.work_budget_allocations','public.work_budget_allocation_lines','public.petty_cash_requests',
 'public.petty_cash_request_lines','public.petty_cash_releases','public.petty_cash_liquidations','public.petty_cash_receipts',
 'public.petty_cash_receipt_items','public.petty_cash_request_attachments','public.budget_ledger_entries','public.work_tree_events'
 ] loop
  execute pg_catalog.format('select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''[]''::jsonb) from %s x where $1=any(eflow_r7.history_roots(to_jsonb(x)))',rel) into rows using p_root;
  history:=history||jsonb_build_object(rel,rows);
 end loop;
 return pg_catalog.encode(extensions.digest((facts||jsonb_build_object('history',history))::text,'sha256'),'hex');
end $$;

create or replace function eflow_r7.work_path(p_root uuid,p_node uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='[]';n eflow_r7.nodes;depth integer:=0;
begin
 while p_node is not null loop
  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
  if not found or depth>=8 then raise exception 'Choose a valid path in this root' using errcode='23514';end if;
  result:=jsonb_build_array(n.title)||result;p_node:=n.parent_subtask_id;depth:=depth+1;
 end loop;return result;
end $$;

create or replace function eflow_r7.work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;current_revision integer;impact jsonb;snapshot jsonb;cap jsonb;codes jsonb:='[]';
 target uuid;parent uuid;action text;before_path jsonb:='[]';after_path jsonb:='[]';allowed boolean;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 perform eflow_r7.lock_impact(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 if p_command not in ('create','staff','edit','move','delete','order','contributors','root_lead','progress','submit','review') or p_command is null
  or p_payload is null or jsonb_typeof(p_payload)<>'object' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('id','parent','lead','people','title','due','standalone','order','note','progress','approve')) then
  raise exception 'Invalid work command or payload' using errcode='22023';end if;
 target:=nullif(p_payload->>'id','')::uuid;parent:=nullif(p_payload->>'parent','')::uuid;
 r:=eflow_r7.root(p_root);snapshot:=eflow_r7.snapshot(p_root);current_revision:=(snapshot->>'revision')::integer;
 if p_revision is null or p_revision<>current_revision then raise exception 'Work changed; reload and review the impact again' using errcode='40001';end if;
 action:=case p_command when 'create' then 'create_child' when 'order' then 'order_children' when 'root_lead' then 'appoint_lead'
  when 'contributors' then 'manage_contributors' when 'staff' then case when (p_payload->>'lead')::uuid is distinct from (select lead_id from eflow_r7.nodes where id=target and task_id=p_root) then 'appoint_lead' else 'manage_contributors' end
  when 'edit' then 'edit_details' when 'progress' then 'execute' else p_command end;
 if p_command in ('root_lead','contributors') or p_command in ('create','order') and parent is null then cap:=snapshot->'root'->'capabilities'->action;
 else select x->'capabilities'->action into cap from jsonb_array_elements(snapshot->'nodes') x where x->>'id'=coalesce(case when p_command in ('create','order') then parent else target end::text,'');end if;
 allowed:=coalesce((cap->>'allowed')::boolean,false);
 if p_command in ('progress','submit','review') and r->>'kind'<>'personal' then allowed:=false;cap:=jsonb_build_object('reason_code','branch_denied');end if;
 if not allowed then codes:=jsonb_build_array(coalesce(cap->>'reason_code','branch_denied'));end if;
 -- Do not collect private history or paths on an unauthorized branch/action.
 if allowed then
  impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);
  if not (impact->>'allowed')::boolean then allowed:=false;codes:=jsonb_build_array(case when impact->'blocker_codes' ? 'lifecycle_blocked' then 'lifecycle_blocked' else 'history_blocked' end);end if;
  if p_command='move' and not eflow_r7.manage(p_root,parent) then allowed:=false;codes:=jsonb_build_array('branch_denied');end if;
  if target is not null and p_command<>'create' then before_path:=eflow_r7.work_path(p_root,target);end if;
  after_path:=case when p_command='delete' then '[]'::jsonb when p_command in ('move','create') then eflow_r7.work_path(p_root,parent)||jsonb_build_array(coalesce(p_payload->>'title',(select title from eflow_r7.nodes where id=target and task_id=p_root),'New subitem')) else before_path end;
 end if;
 return jsonb_build_object('root_id',p_root,'expected_revision',p_revision,'current_revision',current_revision,'command',p_command,'allowed',allowed,'blocker_codes',codes,
  'selected_count',coalesce((impact->>'selected_count')::integer,0),'descendant_count',coalesce((impact->>'descendant_count')::integer,0),
  'affected_appointment_count',coalesce((impact->>'affected_appointment_count')::integer,0),'before_path',before_path,'after_path',after_path,
  'fingerprint',case when impact is null then pg_catalog.md5(jsonb_build_object('root',p_root,'actor',auth.uid(),'revision',current_revision,'command',p_command,'payload',p_payload,'codes',codes)::text)
   else eflow_r7.impact_fingerprint(p_root,p_command,p_payload,impact) end);
end $$;

create or replace function eflow_r7.checked_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt eflow_r7.receipts;impact jsonb;terms jsonb;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 if p_request is null then raise exception 'Work request identity required' using errcode='22023';end if;
 perform eflow_r7.lock_impact(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 terms:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.root_id<>p_root or receipt.payload<>terms then raise exception 'Request identity already used for different work' using errcode='23505';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 impact:=eflow_r7.work_impact(p_root,p_revision,p_command,p_payload);
 if p_impact_fingerprint is null or p_impact_fingerprint is distinct from impact->>'fingerprint' then
  raise exception 'Work impact changed; reload and review affected work before confirming again' using errcode='40001';end if;
 if not (impact->>'allowed')::boolean then raise exception 'This work operation is blocked: %; resolve affected work first',impact->'blocker_codes' using errcode='42501';end if;
 return eflow_r7.command(p_root,p_revision,p_request,p_command,p_payload);
end $$;

create or replace function public.nw_work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$select eflow_r7.work_impact(p_root,p_revision,p_command,p_payload)$$;
create or replace function public.nw_work_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text) returns jsonb
language sql security invoker set search_path='' as $$select eflow_r7.checked_command(p_root,p_revision,p_request,p_command,p_payload,p_impact_fingerprint)$$;

revoke all on function eflow_r7.history_roots(jsonb),eflow_r7.lock_impact(uuid),eflow_r7.serialize_history(),
 eflow_r7.impact_fingerprint(uuid,text,jsonb,jsonb),eflow_r7.work_path(uuid,uuid),eflow_r7.work_impact(uuid,integer,text,jsonb),
 eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text),public.nw_work_impact(uuid,integer,text,jsonb),
 public.nw_work_command(uuid,integer,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function eflow_r7.work_impact(uuid,integer,text,jsonb),eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text),
 public.nw_work_impact(uuid,integer,text,jsonb),public.nw_work_command(uuid,integer,uuid,text,jsonb,text) to authenticated;

-- Writer preambles are appended below. Migration remains atomic.

do $$declare entry record;definition text;changed text;begin
 for entry in select * from (values
 ('eflow_r7.command(uuid,integer,uuid,text,jsonb)','perform eflow_r3.actor(); if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''Work access denied'' using errcode=''42501'';end if; perform eflow_r7.lock_impact(p_root);'),
 ('save_subtask_progress(uuid,integer,text,text,text,text,text,text)','perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));'),
 ('submit_subtask_for_review(uuid,jsonb)','perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));'),
 ('decide_subtask_review(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));'),
 ('submit_task_for_review(uuid,jsonb)','perform eflow_r7.lock_impact(p_task_id);'),
 ('decide_task_review(uuid,boolean,text,text)','perform eflow_r7.lock_impact(p_task_id);'),
 ('create_subtask_budget_allocation(uuid,uuid,uuid,numeric,text)','perform eflow_r7.lock_impact(p_task_id);'),
 ('set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)','perform eflow_r7.lock_impact(p_task_id);'),
 ('create_work_budget_allocation(uuid,uuid,numeric,text)','perform eflow_r7.lock_impact(p_task_id);'),
 ('create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)','perform eflow_r7.lock_impact(p_task_id);'),
 ('eflow_budget.fund_work(uuid,integer,jsonb,text,uuid)','perform eflow_r7.lock_impact(p_task_id);'),
 ('eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)','perform eflow_r7.lock_impact(p_task);'),
 ('eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request));'),
 ('eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('cancel_contextual_cash_request(uuid,text)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('decide_petty_cash_leader_review(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('decide_petty_cash_request(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('schedule_petty_cash_releases(uuid,uuid)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('add_cash_request_attachment(uuid,text,text,text,bigint)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('submit_petty_cash_liquidation(uuid,numeric,text,jsonb)','perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));'),
 ('create_petty_cash_request(uuid,numeric,text,date)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('create_petty_cash_request(uuid,numeric,text,date,uuid)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('decide_work_budget_allocation(uuid,boolean,text)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('delete_subtask_budget_allocation(uuid)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));'),
 ('remove_subtask_budget_cap(uuid,text,uuid)','perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_cap_allocation_id));'),
 ('record_petty_cash_release_internal(uuid,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('acknowledge_petty_cash_release(uuid)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('record_accounting_petty_cash_release(uuid,text,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('override_accounting_petty_cash_release_schedule(uuid,text,text,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));'),
 ('decide_petty_cash_liquidation(uuid,boolean,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));'),
 ('decide_petty_cash_liquidation_leader_review(uuid,boolean,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));'),
 ('settle_accounting_liquidation(uuid,boolean,text)','perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));'),
 ('eflow_evidence.seal_file(text,uuid,uuid,text,text,uuid)','perform eflow_r7.lock_impact(p_task);'),
 ('claim_task_evidence_cleanup(text,text)','perform eflow_r7.lock_impact((select task_id from eflow_evidence.path_context(p_object_name)));')
 ) as patches(signature,preamble) loop
  if pg_catalog.to_regprocedure(entry.signature) is null then raise exception 'Required NW5.2 writer missing: %',entry.signature;end if;
  select pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(entry.signature)) into definition;
  changed:=pg_catalog.regexp_replace(definition,'\mbegin\M','begin /* NW5.2 shared writer lock */ '||entry.preamble,'i');
  if definition like '%NW5.2 shared writer lock%' then continue;end if;
  if changed=definition then raise exception 'Unexpected NW5.2 writer body: %',entry.signature;end if;
  execute changed;
 end loop;
end $$;
-- Accepted 20261011071015_nested_work_material_date_preview.sql; SHA256 6200c5ecff31e2032be121fe2f4ac7c6f76564c4e4b6d4b3a30d7a39c26f7f5d

set local lock_timeout='10s';

-- Called only from the authorized preview under its existing impact lock.
-- Expose schedule facts and aggregate history counts, never evidence/finance rows.
create or replace function eflow_r7.date_impact(p_root uuid,p_payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare target uuid:=(p_payload->>'id')::uuid;ids uuid[];n eflow_r7.nodes;a eflow_r7.nodes;
 r jsonb:=eflow_r7.root(p_root);old_due date;new_due date:=(p_payload->>'due')::date;
 root_due date:=(r->>'due')::date;ancestor_due date;old_bound date;new_bound date;
 cursor_id uuid;facts jsonb;items jsonb:='[]';material boolean:=false;bound_changed boolean;
begin
 ids:=eflow_r7.subtree_ids(p_root,target);
 select due_date into old_due from eflow_r7.nodes where id=target and task_id=p_root;
 if old_due is not distinct from new_due then
  return jsonb_build_object('requires_date_confirmation',false,'date_impact',jsonb_build_object('old_due',old_due,'new_due',new_due,'items','[]'::jsonb));
 end if;
 select parent_subtask_id into cursor_id from eflow_r7.nodes where id=target and task_id=p_root;
 ancestor_due:=root_due;
 while cursor_id is not null loop
  select * into a from eflow_r7.nodes where id=cursor_id and task_id=p_root;
  ancestor_due:=least(ancestor_due,a.due_date);cursor_id:=a.parent_subtask_id;
 end loop;
 -- Match existing canonical write constraints. Confirmation never overrides them.
 if new_due>ancestor_due then raise exception 'Child deadline cannot exceed an ancestor deadline' using errcode='23514';end if;
 if exists(select 1 from eflow_r7.nodes where task_id=p_root and id=any(ids) and id<>target and due_date>new_due) then
  raise exception 'Edit descendant dates before shortening this deadline' using errcode='23514';
 end if;
 for n in select * from eflow_r7.nodes where task_id=p_root and id=any(ids) order by id loop
  old_bound:=root_due;new_bound:=root_due;cursor_id:=n.id;
  while cursor_id is not null loop
   select * into a from eflow_r7.nodes where id=cursor_id and task_id=p_root;
   old_bound:=least(old_bound,a.due_date);
   new_bound:=least(new_bound,case when a.id=target then new_due else a.due_date end);
   cursor_id:=a.parent_subtask_id;
  end loop;
  facts:=eflow_r7.history_facts(p_root,array[n.id]);
  bound_changed:=n.id<>target and old_bound is distinct from new_bound;
  -- A changed inherited bound affects a child with no own deadline. Children
  -- whose earlier own deadline still governs do not alone make an edit material.
  -- Recorded work/commitments in this schedule scope also require review.
  material:=material or bound_changed or not (facts->>'untouched')::boolean;
  if n.id=target or bound_changed or not (facts->>'untouched')::boolean then
   items:=items||jsonb_build_array(jsonb_build_object('id',n.id,'path',eflow_r7.work_path(p_root,n.id),
    'old_bound',old_bound,'new_bound',new_bound,'bound_changed',bound_changed,'history_counts',facts->'counts'));
  end if;
 end loop;
 return jsonb_build_object('requires_date_confirmation',material,'date_impact',jsonb_build_object('old_due',old_due,'new_due',new_due,'items',items));
end $$;
revoke all on function eflow_r7.date_impact(uuid,jsonb) from public,anon,authenticated,service_role;

-- Keep the existing RPC signatures, authorization, locks, opaque fingerprint,
-- denied-branch redaction and checked transaction/receipt logic byte-for-byte.
do $$declare definition text;changed text;begin
 select pg_catalog.pg_get_functiondef('eflow_r7.work_impact(uuid,integer,text,jsonb)'::regprocedure) into definition;
 if definition like '%date_impact jsonb:=''{}'';%' then return;end if;
 changed:=replace(definition,'allowed boolean;','allowed boolean;date_impact jsonb:=''{}'';');
 changed:=replace(changed,'impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);',
  'impact:=eflow_r7.operation_impact(p_root,p_command,p_payload); if p_command=''edit'' and p_payload ? ''due'' then date_impact:=eflow_r7.date_impact(p_root,p_payload);end if;');
 changed:=replace(changed,'return jsonb_build_object(''root_id'',p_root,','return date_impact||jsonb_build_object(''root_id'',p_root,');
 if changed=definition or changed not like '%date_impact jsonb%' or changed not like '%return date_impact||%' then
  raise exception 'Unexpected NW5.2 preview body; inspect before extending';
 end if;
 execute changed;
end $$;
-- Accepted 20261012231500_nested_work_activity_projection.sql; SHA256 c9bac7d726bf10b33fa35b0f3b8fb2e451635cb19971234dab91ca679b3a55eb
-- NW9.6 separately reviewed additive projection slice; local and undeployed.
-- Appends only recorded work-event metadata. Existing columns, kinds, source
-- policies, invoker security, RPC, expiry and bounded reads remain unchanged.
create or replace view eflow_r11.events with (security_invoker=true) as
select p.id project_id, 'audit:'||a.id event_id, 'project'::text kind,
 replace(replace(a.action,'.',' '),'_',' ') title,
 coalesce(nullif(a.reason,''),replace(a.entity_type,'_',' ')||' update') detail,
 coalesce(nullif(a.actor_name,''),'System') actor_name, a.created_at occurred_at,
 case when a.entity_type='task' then t.id end task_id, null::jsonb as work_event
from public.audit_events a
join public.projects p on a.entity_id=p.id::text
 or exists(select 1 from public.tasks x where x.linked_project_id=p.id and x.id::text=a.entity_id)
 or exists(select 1 from public.milestones m where m.project_id=p.id and m.id::text=a.entity_id)
left join public.tasks t on t.id::text=a.entity_id
union all
select t.linked_project_id,'status:'||s.id,'status','Task moved to '||replace(s.to_status,'_',' '),coalesce(nullif(s.note,''),'Status updated'),coalesce(nullif(s.actor_name,''),'System'),s.created_at,t.id, null::jsonb as work_event
from public.task_status_history s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'progress:task:'||s.id,'progress','Task progress updated',coalesce(nullif(s.blocker,''),nullif(s.note,''),nullif(s.next_step,''),s.percent_complete::text||'% complete','Progress recorded'),s.author_name,s.created_at,t.id, null::jsonb as work_event
from public.task_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'progress:subtask:'||s.id,'progress','Subtask progress updated',coalesce(nullif(s.blocker,''),nullif(s.note,''),nullif(s.next_step,''),s.percent_complete::text||'% complete'),s.author_name,s.created_at,t.id, null::jsonb as work_event
from public.subtask_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'submission:task:'||s.id,'submission','Task submitted for review','Attempt '||s.version||' · '||s.note,s.submitter_name,s.submitted_at,t.id, null::jsonb as work_event
from public.task_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'decision:task:'||s.id,'submission','Task '||replace(s.status,'_',' '),coalesce(s.decision_feedback,'Attempt '||s.version),coalesce(s.decided_by_name,'Reviewer'),s.decided_at,t.id, null::jsonb as work_event
from public.task_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select t.linked_project_id,'submission:subtask:'||s.id,'submission','Subtask submitted for review','Attempt '||s.version||' · '||s.note,s.submitter_name,s.submitted_at,t.id, null::jsonb as work_event
from public.subtask_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'decision:subtask:'||s.id,'submission','Subtask '||replace(s.status,'_',' '),coalesce(s.decision_feedback,'Attempt '||s.version),coalesce(s.decided_by_name,'Reviewer'),s.decided_at,t.id, null::jsonb as work_event
from public.subtask_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select e.project_id,'work:'||e.id,case when e.command='progress' then 'progress' when e.command in ('submit','review') then 'submission' else 'project' end,replace(e.command,'_',' '),
 coalesce((select n->>'title' from jsonb_array_elements(coalesce(e.after_data->'nodes','[]')||coalesce(e.before_data->'nodes','[]')) n where n->>'id'=e.node_id::text limit 1),'Root task people'),e.actor_name,e.occurred_at,e.root_id, jsonb_build_object('id',e.id,'root_id',e.root_id,'node_id',e.node_id,'command',e.command,'actor_name',e.actor_name,'occurred_at',e.occurred_at,'before_data',e.before_data,'after_data',e.after_data) as work_event
from public.work_tree_events e
union all
select e.project_id,'personal:'||e.id,case when e.command='progress_task' then 'progress' when e.command in ('submit_task','review_task') then 'submission' else 'project' end,replace(e.command,'_',' '),coalesce(nullif(e.payload->>'note',''),nullif(e.payload->>'title',''),'Personal project work change'),p.full_name,e.occurred_at,null::uuid, null::jsonb as work_event
from public.personal_work_events e left join public.profiles p on p.id=e.actor_id;
DO $nw11_postconditions$ DECLARE nw11_metadata jsonb; BEGIN
 select metadata into nw11_metadata from (select q.metadata||jsonb_build_object('column_attributes',(select coalesce(jsonb_agg(jsonb_build_object(
 'schema',n.nspname,'table',c.relname,'column',a.attname,
 'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
 'identity',a.attidentity::text,'generated',a.attgenerated::text,
 'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 'collation_schema',cn.nspname,'collation_name',co.collname)
 order by n.nspname,c.relname,a.attnum),'[]'::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m')
 and (n.nspname='public' or n.nspname like 'eflow_%'))) metadata from (select jsonb_build_object(
'captured_at_utc',now(),
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),'body',p.prosrc,'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'service_role_execute',has_function_privilege('service_role',p.oid,'execute')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname='public' or n.nspname like 'eflow_%') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'options',c.reloptions,'acl',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' or n.nspname like 'eflow_%' or n.nspname='storage') and c.relkind in ('r','v','m')),
'columns',(select jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema='public' or table_schema like 'eflow_%' or table_schema='storage'),
'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' or n.nspname like 'eflow_%'),
'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or n.nspname like 'eflow_%')),
'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname='public' or p.schemaname like 'eflow_%' or p.schemaname='storage'),
'bucket_configuration',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets where id in('project-library','task-attachments'))
) as metadata) q) q;
 if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='4c0537f40b9b9f4cab24a2f3c2d8cfeefe85e3117c13b61eaed9bda2b4a71665')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='7f6c4537126c3acf2d9b6bbe4dc399cab3fca1e47513837ac20dfc56b360d63c')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='c45c81e0334881f6ea1fe2a72a035ed7f81c66d177ca305f5291dcfc8fbd46e7')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='411dead4027fba7ab7d9e2ee056d08115b5c25e9c7d2f37a858e8ec6af8f9f23')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='c1dc43c1674e1bf086736fe0b9b0dfe4e218a351e8b7446ec31b1a3743b4b445')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='864abdf49624312adc001d67f3a3970ffa4e320c4ce19961e18ed3f9b8a61ddc')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='666e14f31bbf7b2ed9b65b939a5ee0802da0a48b4e07dca7fbb5c33be38057af')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='fc09ecfe9b8f3b21daa6b0babcf8af36ad9fc51e9f0be98a58f18f34ebfdd842')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d83d2ea720661fe13b7b84ac36ce36648e0536441658779dc188a0804e04dd1d')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='3689ad0548b2b45030a08d0f4e92997a862f40b04fbc6b53da604cd89588aec1')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='33eaafdd7e0ef782dc68d6637119a1ac4cb91d9a6bf2c7b12c76dfbe8a593377')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='40cb803f48175f9425871f22333ebf3a4beac6cb277ae6cb04ffb8106ea90be8')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='b5069827bb979a7dd2f46c12645e7ea67dbdde5cae1726aae06afba0bafe4241')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='573a6791387a2044ef60dd3d78bcbe0bf2b2a7ac2b532f194dc277dfe209fc82')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='f8fa27ef2f7a007ae407485b73f5128aea272e869ec250685f954313bc52d04d')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='f758c0a7f7834ff5e70b440148b9eda18afeafbfdecda0be10fbf2f8b2279e5e')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d3691c14170abfc3cffb651494f9b82033abea9cea645be1e47815a695da693e')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='f032192e13d08172e4b4c56de6addbf29b10f4aa6c8fb6e8fcc3e6ac61bc69b3')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='9f4ba38308ee23591930c5a525c0696522487519e244323f7b3d7835b34abe1a')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='359262e3f8a85d8b111becb4c70107f4a4531973734c78467f78d663eebd51f7')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='896e04cb6aac59b6c3815a55dbda14a483f9564b0fbe30ab0c75acea7c507911')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='663aabd8ecdfaf61512c3553eff2f80ff1b75e8e0e722a5cfe3029de642ecd29')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='91355d17290d04f54512dc571c2d0431d6774b267d8270b8bfa5e36f94078864')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='8fd71e304f8208c5363ca2e826c85eb04a6c3420efcf4bd1e788080c64d67ea9')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='8f1b12cb9448611ad98538fdbdb2c5a58f1b5f57f43f289e8e0a2e43f0e10779')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"serialize_history","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='3b1b56584947ded40a803c36229795b9fa66448e23b73dcc7b645e81e1efd324')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"serialize_history","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='27aeee18976cd8923aaf49660b04984ce4c3686991be8e10363d842f41597125')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='01f74d98e0172fbdddf5abf07bebb46de0b695f9e07e25faf79f436970381139')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='50a29b61d63e3fcc8c7e33761e2ef4ef95d1d3c64e76bfee2977074f75c6c10d')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='b63afb27b9cd5dbcaa0feeb098d8dc834242f20a658254297ccc176508ff5e7e')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='2c0c7436f038aa86164904fe7fd9167ee03cff728e3c587a24683c888ef8253a')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='f6e82dd29f2c4582ee60c1a77ce1b2a7331548e854ffc945ab71ddc2bab0a1db')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d8c9d533fe39ff441dcb68e6cf751c0025c00abab2cc58091fc03ae757aa6f9a')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='38a91854510a3780653eb6b82c78e17e4196cd022af1f5fb5bea4c0adb69d999')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='3c5124f285474c4eabe082ff021cb34dcfeed9041680ee2cf2904899687be5bc')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='029d3500f158386f635164fa9dbca6d8cb5653c2e517fbdcc7399cab0c87ae6b')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='a1af37a73a0209ef0b6876d34b02a6e82b3a169f690d462410cb0fcf815cf4ae')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='085af80daf2e554f89eed097358831e3b6cba56d18dc0bf5b03dcb1179a47f14')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='e832c02cda1088772dc419e319ca7a32f0c33584be5b3ff36e53e69567bf1f58')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='be23aeb1c770926670cae4a7511274d00959d47940e5ce948ed85d32dc24280a')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d23c3ccba7c09e4314b5ef0fcf7042fd1417e98bc23ebeabcb9df6f0683882ef')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='8b3e6b3e9d106af500296fb744e2f69458b90e04db5a82d755535fd9d8d80150')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='68a8d78caab330bae35772453e1ce0b553d911d613933930ef3f5d73b63ab52a')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='25517e7f761de8698cc99633d0e3e19830e2f94f7421b85c81c58feea3b66776')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='ab642e28e9a4ca909b0cd33200502c20fb757836641b6f71b1553dd698eb117c')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='83ddcfb8ef8e44f1bb362f4e27309cd6bfb6d6239aa14bb10b2ab34e0b2f73f1')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='55f1b4d857a41c4a2f638042d81f5520f3187f5fc669f50a19046e53ea1bce36')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='e3ec556cd6e3a7fa39d79cb3a498f9a6871f1891b7cbfde9501cc7e32d48323f')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='a9cbc7be9712483cd1c40aeb8ee640462b9cbde5481dd90258552cd38d9a70f5')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='80beef550dda06d18fc6c8176046dbac92c84718653307ff6b05a555e8a5b505')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='f63990d39c6fb9d8a0381877c66806a230a096d7840596cd050d4f54c9ce39eb')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='7f220e2a2cd65f7a075436fab36c51de22d0947908eb9cb35c68831d39214ecc')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d167daca1aefb10447cb1d57413184678a96168120c9e66929f0667e4a1607a1')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"guard_subtask_mutation","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='3ff572acad31abd73243a91de39a6195172403a02883695a524c47724b737b67')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"guard_subtask_mutation","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d06741da514a5f13cdf5e94d9adf0e5d3f9f8b8850caf224e63d59d97134cd1a')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='ee072f4c7a602ca982f20563398386ddbac7763c6166539075a0ecf115f42cc9')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='ed1a8de072aad3df894dbed4192e4b4be415a509719f0992a07b204551743078')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='47f4ee197493c78315a030c4b4813894e249cbcda4a17e46dbe641cac8f2d1d4')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='d343f28d1981ac5077769391236d02eec31b1d07b3cfef73e52d90ef5b263d96')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='de6fcd9a79ff2475b3c58e0d45935f86e4ee58e1512592fbe60f093c0d1a6c16')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='8a7e9a1bfe40afa854cb8def622d71b6e0002f61838d37a37d9a04ce57b1da57')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"route_organization_leadership_review","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='8359ea836a614fc35cdaa70e051beb82c5de5b15c58c5defa5940f4af631e203')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"route_organization_leadership_review","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='31f2c93f9a25a4b91d962dca4d2f6b901910fc9988042c4bd90081f19d29eb20')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='89743665ca8e77a399f147140aef3e4e91678de8d312b0263dacac60f2ca1408')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='12e07f82cdf66f19b78a5bdc8f7575c03feb7affaddca05f41ed9f08e41f4c01')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='47862df185e0956bb07ccab5e238eeaadf0a715f5b3d6940d4b24f803230cf80')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='1e4010bad44ec7d116c17b1b33f35467b7f84adb01941413874b10c56b31bb37')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='007e3c85318a3242104ce6cfaf560c1845e453c5a0adfa4b5979211dac008ebc')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='6a08203374abc4dedfc9d96392b9c2f371f8fccd500cd4c5b6a42e6098dd516c')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='3f134cee2fff7d5ce35e12059db4094caed975a30cee2b075d8f7dd997a10b8d')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='7d57dd2c3aa18370742bed746967c7b91cad8a70f0b116ae638b95856f81d1a6')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"sync_task_chat_channel","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='4d5769d2a13a1a928ffdf4adad1c9264501def607c27f8020ccfc9ed89029463')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"sync_task_chat_channel","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'functions') element where element @> '{"schema":"public","name":"validate_task_reviewers","identity_arguments":""}'::jsonb and encode(pg_catalog.sha256(convert_to((case when element->'acl'='null'::jsonb then jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,'{definition}',to_jsonb(replace(element->>'definition',chr(13)||chr(10),chr(10)))),'{body}',to_jsonb(replace(element->>'body',chr(13)||chr(10),chr(10)))),'{acl}',(select jsonb_agg(a order by a) from jsonb_array_elements(element->'acl') a)) end)::text,'UTF8')),'hex')='f392623898574b6dd24fa7e23db6663558d53ac1d24d0d12551a2e33f8a283cc')<>1 then raise exception 'NW11 postcondition mismatch: functions {"schema":"public","name":"validate_task_reviewers","identity_arguments":""}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'tables') element where element @> '{"schema":"eflow_r7","name":"completion_locks"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='8aef89a63702bb98090dd69a4ac2dd86043d1e819452e442d294a5acf2ba54f4')<>1 then raise exception 'NW11 postcondition mismatch: tables {"schema":"eflow_r7","name":"completion_locks"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'tables') element where element @> '{"schema":"eflow_r9","name":"staffing_removals"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='762c637c407d47ce4a0c583748b7c069569ac5b4c56e3a47b8a55bea701b4da9')<>1 then raise exception 'NW11 postcondition mismatch: tables {"schema":"eflow_r9","name":"staffing_removals"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r11","table":"events","column":"work_event"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='94ae44f7c83dc83b49bceee88fb72416a25bd92995edd29c71ab9eeea87b34d5')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r11","table":"events","column":"work_event"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"root_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='2c94528624e87eb45acf8ff79a0132cde7f86be04540f05123c8e23292aaa82d')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"root_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"version"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='0711cea53d924525db0246de80590168e6f101575e9b36c9a8c9af365e275d07')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"version"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='76a8d99909c338770168c2b5c7e2f6487d88783b55d852de3cacfcd1b9ac6c0f')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='cd3978fdbe8ea5e9f33b5e41e0aa82ec7c8a70c76b1e5ded311618ba37027058')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"tx"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='862105036ae110f44da92c19f7fd0fbc28e8c319051b82cf23d15749ec55733d')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"tx"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"actor"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='d3e3ed12a1d73afe80e76897722f7b4f3ad5b1e34576d9ce1eb5b103f2ce13a6')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"actor"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='cf41594e0b5b3d7cab80cbe9098c3d3024cf17413f5211d7c0747239f98ca20f')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='83d72235e318e36abddc9642eb6d2fa1bab4f9a863407d336721baf9993dbff9')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='330ddf37f6d69c2eb0dac19a8be9723c53dda68bdc5118380e9423c54b8e95f9')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='2f2b99267f30bd6324fb046a28bc6414f652b95f21cbc9d7cc79ff515255a5e2')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='6999d484529b60ec6c1853c48ff1543f143b621da4234a464297fb2ec34fe59e')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='46320660e21100eee04b9cdbbb51f91c5ae746e9fccaf8cfbb674c6e1e06e760')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='1b22abc56804d01ee7ad656be2c965119c55066d58a4f99d8a9e3b5a4d33cb4a')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='c5670ec2c4b4c71c0583dd4a47b739a58b0096dbb08aea9754603f5abd7adec4')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'columns') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='bcec53e42a46bd3180a19fde8eadac0bc8a8ee6017836103c40ac9b79f0ba62b')<>1 then raise exception 'NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r11","table":"events","column":"work_event"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='085309a5f53794dbcd61b888c5f0dc909e8569224b42b706f286ffd9c8115520')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r11","table":"events","column":"work_event"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"root_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='aeb7c030ef9674863a47380e4aa814b0e98688285abd53b8253ce79579f2998f')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"root_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"version"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='021b8f3a930dd4d994d8190f93ce8c7088fcd3f0a522232e3c3495dfe7545c8a')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"version"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='b7dad12a7888ac8cd93b2914f99c59303eaf79f4e7fe60d0a9a10f035da84bdf')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='f1654fa08d32b778288186ea98264e5f3770abbb07d946462b5eb7c772ade57f')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"tx"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='9ac5fa3b6e6a6238a67f9952758ba2124322d66233f9afccb31916fb18d45123')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"tx"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"actor"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='8d7df0d103174979b1d988a16008e3a98e6a69ba0a5936b538bb4a2aae72aa70')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"actor"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='f685803840e0921d319c0d65ff4d1593a717baaf9728057eeda3ea5fe7a2dc5b')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='c3bab9f0435ccd7c6ee8abb9384ed4a0b4e845bcf8e2a444927c85aa037b95c4')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='f10313c3f248258471bd558585744ea4167002a8ec6deb6eaf1b168d2380bb12')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='a6fc8b399db5d2b04693a3645258977d9251ebf4b97ae7f34bb1c0bf914154fb')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='ab1ea53f52a5603ed519109bc6c68cef95b70e593e8c32120afd302cc1123172')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='e0f8db2c10a52fa8d7ae9bae20cceb25d1d63b58a908a493ac11aee103548e79')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='6a35c8428f5bd3a034618ea79b14c587e80f2c51e972155fa829d82802f28812')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='a7fddc70827a6659bc87ad34b3f1db6f44a14d6d4ca4431cbc80f6dbddbfc8f4')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'column_attributes') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='6b713f1a5b9013ac6ddc667782521dafa49a0023568609c7cbeb84d520220475')<>1 then raise exception 'NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='3da00e3fbf8cf087ece53a03ef10fdc11a5460df143de29867ab2351ff2c3081')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='405a0c38deb9ce08faa8dcab9fa03a72aa62894fd5b61dd7c68cd55d90106598')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='15974313491a3a50c028cd16f7cd880f67ee3469ffc1256487e8e4449b364cc5')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='4633b593e61bab37fedf586f5c30fae72bc473518aebdbd9e3b77ebf5cc4f89e')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='de606ec71a1a5e544e79d67c3b246d67e201edede9f54579c8641652273bc763')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"public","table":"subtasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='b2ef5fac1ebed9527139502e616edbd6e4755226d7fac3d37336347948c072f0')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"public","table":"subtasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'constraints') element where element @> '{"schema":"public","table":"tasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='8d486cddbedb4bd13099a91d733bfffa4e80b5699c6eea3606c7097efa12c81e')<>1 then raise exception 'NW11 postcondition mismatch: constraints {"schema":"public","table":"tasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='e87cc82672ef98a28fc49b49fb70b8e787fcbde4f00c574252e7bc88b589b891')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='61d4492355ab2d544bb1d76681f0a9ebba65d4b0feb6dc450096643958e4cecd')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='89479d8e76a723c84dce769872e578775ed2bc63b058eea9adc28853e23094af')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='7404268fca1695133425e195d5ea66cf37180579065d2992218a34d663ab156e')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='37a8d977bff417ec3fe264dc27842645ad34881f399ad98b133dafa9a44ec156')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='bc4371c3cc42e0469b1bc1f38100bd4e86d2387c6f132e735da826a25c303612')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='519d237e9edb5521312bfc3909bec3230c99dc0e861b4fce56cbf3b4172f1cb7')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='64fa2400e9595938c6980b57bd8aed0d0d3eac3fc96f3dccd446230c56734053')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='c8ab530c380b2fd6e3e1c67041325a7d87e1889bfa822c216d6b37142514f221')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='5689656de9bbe6f7afcfb2f084f4118445078010f7be816ca065e47f43f3fbee')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='8da6bcf0f7670e768c9ec81b347a8c52c987f0fa2f842ee9a310216ab3dd92f4')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='2052b4a3e748b8bfe555b2b5d33abed93dbd76eed834f58a22385d6bbbd9e78c')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='d770a7337cb94f22f75532b9f0281384b2fc9c6c74dab6ee7517c96162ee8a3b')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='ed794e238c110e0835d5bf37eac3bf4bea77ad9df4a822110b1db7eedf3bb988')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='43dc874beec024301759cb035368128fd41e727c97c3f98a7a4ecc6f086d0cbe')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='741955286e35db156a6e85403471689d67ecf0275bf89fced1aba96a7023af56')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='2eaf877eb2f9fecf4e2f06b956123c4ca6ee507c6b526f183d259e3ca87c9ae4')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='9874f53e06867d2d288a3f8c0756fb1fe70eb91afdb30f9bc03f9bc970daada1')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='35a39aaaeefafaa6ae104b36ca2e07c6d247cd2f6bb8e00373161820255cc405')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='04e22670db527cdb3b5dd4abc161f4ef480d19659c2bf62871707782d9cdcafe')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='300e9ce008969bd63b171321a99fbc7ea2ad75a3d621ce2af05400b0c512e4a6')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='045159099c5c13aea8c0282e23721274f45d76b8296f2ad88e3ddd4c573ffdfb')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='aa254cbf53f8c65ff2a24921b10a49d84b47c76b732c3e7ed24811f5d6e137f7')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='eae5927998c540bec0901da8aa4bb303e69c1f836d411fc2a712245969c5c4f6')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='599cdbc92aafc20484f468871a9e3a010f2a110f660ffb20f39df80069f2c747')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtasks","name":"nw42_completion_lock"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='4febe2325693bd5c115c0c4686dd39fcbc1690a82fe08c5b71b990ad372a554b')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"nw42_completion_lock"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"subtasks","name":"nw51_operation_safety"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='6946bc39e2b7b49fceed3eb511680401b990ac3860a23de2d44f96aed1f8bb6c')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"nw51_operation_safety"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='bc6f4e81d1d7780bac6555740187fc3a55243cc1d20b0c8f7270b8187c4eb8f0')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='e689884a2ead2de688bb6a7c52a084467e93e758f1ddc2769de7a12f098337cf')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='9fc013b03e2cf265a9137427347271b626ea7a8925e6d128d64255f5c197934e')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"tasks","name":"nw42_completion_commit"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='f931564843f1e2084a50246c007b54bc6c73522ebcb20013668359b9b2cdbf21')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"nw42_completion_commit"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"tasks","name":"nw42_completion_lock"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='793bbe6adbb97f1e7508832899074a26433f0bdce3b79bfe9ea1934d405ce98c')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"nw42_completion_lock"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"tasks","name":"nw51_operation_safety"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='98274e64c38a53c15eacf0f692b5cc6cdf3a788fceeffc1efdfb0cbb2ba6e59e')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"nw51_operation_safety"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='28c688c8d78f0345bf94ecb64b8be04db1c8975c4c200285a34a8e38c09e0278')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='2779c5fa113dad6c53d88ef1daeb2cb88f8b41a9c8137efb6a13279d8fbed239')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"}';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->'triggers') element where element @> '{"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}'::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,'UTF8')),'hex')='5cc882893bed17c2c94b6893805e8a17b055ed9d7b6e8325fc18e590ff640916')<>1 then raise exception 'NW11 postcondition mismatch: triggers {"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select coalesce(jsonb_agg(element order by element::text),'[]'::jsonb) from jsonb_array_elements(value) element where not exists(select 1 from jsonb_array_elements(coalesce('{"functions":[{"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"},{"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"},{"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"},{"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"},{"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""},{"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""},{"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"},{"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""},{"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"},{"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""},{"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"},{"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"},{"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"},{"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""},{"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"},{"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"},{"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"},{"schema":"eflow_r7","name":"serialize_history","identity_arguments":""},{"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"},{"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""},{"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"},{"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"},{"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"},{"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"},{"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"},{"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"},{"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"},{"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"},{"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"},{"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"},{"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"},{"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""},{"schema":"public","name":"guard_subtask_mutation","identity_arguments":""},{"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"},{"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"route_organization_leadership_review","identity_arguments":""},{"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"},{"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"},{"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"},{"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"},{"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"},{"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"},{"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"},{"schema":"public","name":"sync_task_chat_channel","identity_arguments":""},{"schema":"public","name":"validate_task_reviewers","identity_arguments":""}],"tables":[{"schema":"eflow_r7","name":"completion_locks"},{"schema":"eflow_r9","name":"staffing_removals"}],"columns":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"column_attributes":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"constraints":[{"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"},{"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"}],"triggers":[{"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"},{"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"},{"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"},{"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"},{"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_lock"},{"schema":"public","table":"tasks","name":"nw51_operation_safety"},{"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}]}'::jsonb->key,'[]'::jsonb)) permitted where element @> permitted)) else value end) from jsonb_each(q.metadata-'captured_at_utc'-'migrations')))::text,'UTF8')),'hex') from (select q.metadata||jsonb_build_object('column_attributes',(select coalesce(jsonb_agg(jsonb_build_object(
 'schema',n.nspname,'table',c.relname,'column',a.attname,
 'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
 'identity',a.attidentity::text,'generated',a.attgenerated::text,
 'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 'collation_schema',cn.nspname,'collation_name',co.collname)
 order by n.nspname,c.relname,a.attnum),'[]'::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in ('r','v','m')
 and (n.nspname='public' or n.nspname like 'eflow_%'))) metadata from (select jsonb_build_object(
'captured_at_utc',now(),
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',statements) order by version) from supabase_migrations.schema_migrations),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity_arguments',pg_get_function_identity_arguments(p.oid),'arguments',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'definition',pg_get_functiondef(p.oid),'body',p.prosrc,'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'service_role_execute',has_function_privilege('service_role',p.oid,'execute')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname='public' or n.nspname like 'eflow_%') and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
'tables',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'options',c.reloptions,'acl',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' or n.nspname like 'eflow_%' or n.nspname='storage') and c.relkind in ('r','v','m')),
'columns',(select jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema='public' or table_schema like 'eflow_%' or table_schema='storage'),
'constraints',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' or n.nspname like 'eflow_%'),
'triggers',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname='public' or n.nspname like 'eflow_%')),
'policies',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname='public' or p.schemaname like 'eflow_%' or p.schemaname='storage'),
'bucket_configuration',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets where id in('project-library','task-attachments'))
) as metadata) q) q)<>current_setting('eflow.nw11_preserved_catalog') then raise exception 'NW11 changed an unapproved catalog contract, including financial/evidence authority';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)='array' then (select jsonb_agg(element order by element::text) from jsonb_array_elements(value) element) else value end) from jsonb_each(q.metadata-'captured_at_utc')))::text,'UTF8')),'hex') from (select jsonb_build_object('captured_at_utc',now(),'schemas',(select jsonb_agg(jsonb_build_object('name',nspname,'acl',nspacl,'owner',pg_get_userbyid(nspowner))) from pg_namespace where nspname='public' or nspname like 'eflow_%' or nspname in ('auth','storage','extensions')),'memberships',(select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option,'grantor',g.rolname)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor),'default_acl',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(d.defaclrole),'kind',d.defaclobjtype,'acl',d.defaclacl)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),'buckets',(select jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id) from storage.buckets)) as metadata) q)<>'f7e99b18898ac3492f8911a57590531a80c0bf21758a14c42652225329a77ab5' then raise exception 'NW11 changed recovery/role/Storage configuration';end if;
 END $nw11_postconditions$;
DO $nw11_view$ BEGIN if (select encode(pg_catalog.sha256(convert_to(pg_get_viewdef('eflow_r11.events'::regclass,true),'UTF8')),'hex'))<>'510d8b6c37304c0c06670ffb332f1dc1c1a68915d3d277c0d92a1274d4037b86' then raise exception 'NW11 activity view definition mismatch';end if; END $nw11_view$;

INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261015230935','nested_work_verified_corrections',ARRAY[replace('-- 20261015230935_nested_work_verified_corrections; candidate-bound nine-source integration.
DO $nw11_preflight$ BEGIN
 perform pg_advisory_xact_lock(1751011,20261016);
 if current_user<>''postgres'' or current_database()<>''postgres'' then raise exception ''NW11 requires the reviewed postgres SQL Editor role/database'';end if;
 if current_setting(''server_version_num'')::int/10000<>17 then raise exception ''NW11 requires PostgreSQL 17; review another major before applying'';end if;
 if (select system_identifier::text from pg_catalog.pg_control_system())<>''7642734024280108049'' then raise exception ''NW11 wrong cluster: use project ixnfphgjyelhckjwjkdv'';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)=''array'' then (select jsonb_agg(element order by element::text) from jsonb_array_elements(value) element) else value end) from jsonb_each(q.metadata-''captured_at_utc'')))::text,''UTF8'')),''hex'') from (select jsonb_build_object(
''captured_at_utc'',now(),
''migrations'',(select jsonb_agg(jsonb_build_object(''version'',version,''name'',name,''statements'',statements) order by version) from supabase_migrations.schema_migrations),
''functions'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',p.proname,''identity_arguments'',pg_get_function_identity_arguments(p.oid),''arguments'',pg_get_function_arguments(p.oid),''returns'',pg_get_function_result(p.oid),''definition'',pg_get_functiondef(p.oid),''body'',p.prosrc,''security_definer'',p.prosecdef,''config'',p.proconfig,''acl'',p.proacl,''owner'',pg_get_userbyid(p.proowner),''anon_execute'',has_function_privilege(''anon'',p.oid,''execute''),''authenticated_execute'',has_function_privilege(''authenticated'',p.oid,''execute''),''service_role_execute'',has_function_privilege(''service_role'',p.oid,''execute'')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind=''f'' and (n.nspname=''public'' or n.nspname like ''eflow_%'') and not exists(select 1 from pg_depend d where d.classid=''pg_proc''::regclass and d.objid=p.oid and d.deptype=''e'')),
''tables'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',c.relname,''kind'',c.relkind,''rls'',c.relrowsecurity,''forced_rls'',c.relforcerowsecurity,''options'',c.reloptions,''acl'',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname=''public'' or n.nspname like ''eflow_%'' or n.nspname=''storage'') and c.relkind in (''r'',''v'',''m'')),
''columns'',(select jsonb_agg(jsonb_build_object(''schema'',table_schema,''table'',table_name,''column'',column_name,''type'',data_type,''udt'',udt_name,''nullable'',is_nullable,''default'',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema=''public'' or table_schema like ''eflow_%'' or table_schema=''storage''),
''constraints'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',co.conname,''definition'',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' or n.nspname like ''eflow_%''),
''triggers'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',t.tgname,''enabled'',t.tgenabled,''definition'',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname=''public'' or n.nspname like ''eflow_%'')),
''policies'',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname=''public'' or p.schemaname like ''eflow_%'' or p.schemaname=''storage''),
''bucket_configuration'',(select jsonb_agg(jsonb_build_object(''id'',id,''public'',public,''file_size_limit'',file_size_limit,''allowed_mime_types'',allowed_mime_types) order by id) from storage.buckets where id in(''project-library'',''task-attachments''))
) as metadata) q)<>''802d57a27822aad7d58315093570d3cb4d904dfeaacc37203872dd4d1a5b8acb'' then raise exception ''NW11 baseline/ledger drift or already applied: STOP and inspect, do not retry or repair history'';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)=''array'' then (select jsonb_agg(element order by element::text) from jsonb_array_elements(value) element) else value end) from jsonb_each(q.metadata-''captured_at_utc'')))::text,''UTF8'')),''hex'') from (select jsonb_build_object(''captured_at_utc'',now(),''schemas'',(select jsonb_agg(jsonb_build_object(''name'',nspname,''acl'',nspacl,''owner'',pg_get_userbyid(nspowner))) from pg_namespace where nspname=''public'' or nspname like ''eflow_%'' or nspname in (''auth'',''storage'',''extensions'')),''memberships'',(select jsonb_agg(jsonb_build_object(''role'',r.rolname,''member'',m.rolname,''admin'',a.admin_option,''inherit'',a.inherit_option,''set'',a.set_option,''grantor'',g.rolname)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor),''default_acl'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''owner'',pg_get_userbyid(d.defaclrole),''kind'',d.defaclobjtype,''acl'',d.defaclacl)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),''buckets'',(select jsonb_agg(jsonb_build_object(''id'',id,''public'',public,''file_size_limit'',file_size_limit,''allowed_mime_types'',allowed_mime_types) order by id) from storage.buckets)) as metadata) q)<>''f7e99b18898ac3492f8911a57590531a80c0bf21758a14c42652225329a77ab5'' then raise exception ''NW11 recovery/role/Storage configuration drift: STOP'';end if;
 perform set_config(''eflow.nw11_preserved_catalog'',(select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)=''array'' then (select coalesce(jsonb_agg(element order by element::text),''[]''::jsonb) from jsonb_array_elements(value) element where not exists(select 1 from jsonb_array_elements(coalesce(''{"functions":[{"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"},{"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"},{"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"},{"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"},{"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""},{"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""},{"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"},{"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""},{"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"},{"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""},{"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"},{"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"},{"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"},{"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""},{"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"},{"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"},{"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"},{"schema":"eflow_r7","name":"serialize_history","identity_arguments":""},{"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"},{"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""},{"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"},{"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"},{"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"},{"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"},{"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"},{"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"},{"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"},{"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"},{"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"},{"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"},{"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"},{"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""},{"schema":"public","name":"guard_subtask_mutation","identity_arguments":""},{"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"},{"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"route_organization_leadership_review","identity_arguments":""},{"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"},{"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"},{"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"},{"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"},{"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"},{"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"},{"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"},{"schema":"public","name":"sync_task_chat_channel","identity_arguments":""},{"schema":"public","name":"validate_task_reviewers","identity_arguments":""}],"tables":[{"schema":"eflow_r7","name":"completion_locks"},{"schema":"eflow_r9","name":"staffing_removals"}],"columns":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"column_attributes":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"constraints":[{"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"},{"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"}],"triggers":[{"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"},{"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"},{"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"},{"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"},{"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_lock"},{"schema":"public","table":"tasks","name":"nw51_operation_safety"},{"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}]}''::jsonb->key,''[]''::jsonb)) permitted where element @> permitted)) else value end) from jsonb_each(q.metadata-''captured_at_utc''-''migrations'')))::text,''UTF8'')),''hex'') from (select q.metadata||jsonb_build_object(''column_attributes'',(select coalesce(jsonb_agg(jsonb_build_object(
 ''schema'',n.nspname,''table'',c.relname,''column'',a.attname,
 ''type'',pg_catalog.format_type(a.atttypid,a.atttypmod),''not_null'',a.attnotnull,
 ''identity'',a.attidentity::text,''generated'',a.attgenerated::text,
 ''default'',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 ''collation_schema'',cn.nspname,''collation_name'',co.collname)
 order by n.nspname,c.relname,a.attnum),''[]''::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in (''r'',''v'',''m'')
 and (n.nspname=''public'' or n.nspname like ''eflow_%''))) metadata from (select jsonb_build_object(
''captured_at_utc'',now(),
''migrations'',(select jsonb_agg(jsonb_build_object(''version'',version,''name'',name,''statements'',statements) order by version) from supabase_migrations.schema_migrations),
''functions'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',p.proname,''identity_arguments'',pg_get_function_identity_arguments(p.oid),''arguments'',pg_get_function_arguments(p.oid),''returns'',pg_get_function_result(p.oid),''definition'',pg_get_functiondef(p.oid),''body'',p.prosrc,''security_definer'',p.prosecdef,''config'',p.proconfig,''acl'',p.proacl,''owner'',pg_get_userbyid(p.proowner),''anon_execute'',has_function_privilege(''anon'',p.oid,''execute''),''authenticated_execute'',has_function_privilege(''authenticated'',p.oid,''execute''),''service_role_execute'',has_function_privilege(''service_role'',p.oid,''execute'')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind=''f'' and (n.nspname=''public'' or n.nspname like ''eflow_%'') and not exists(select 1 from pg_depend d where d.classid=''pg_proc''::regclass and d.objid=p.oid and d.deptype=''e'')),
''tables'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',c.relname,''kind'',c.relkind,''rls'',c.relrowsecurity,''forced_rls'',c.relforcerowsecurity,''options'',c.reloptions,''acl'',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname=''public'' or n.nspname like ''eflow_%'' or n.nspname=''storage'') and c.relkind in (''r'',''v'',''m'')),
''columns'',(select jsonb_agg(jsonb_build_object(''schema'',table_schema,''table'',table_name,''column'',column_name,''type'',data_type,''udt'',udt_name,''nullable'',is_nullable,''default'',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema=''public'' or table_schema like ''eflow_%'' or table_schema=''storage''),
''constraints'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',co.conname,''definition'',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' or n.nspname like ''eflow_%''),
''triggers'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',t.tgname,''enabled'',t.tgenabled,''definition'',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname=''public'' or n.nspname like ''eflow_%'')),
''policies'',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname=''public'' or p.schemaname like ''eflow_%'' or p.schemaname=''storage''),
''bucket_configuration'',(select jsonb_agg(jsonb_build_object(''id'',id,''public'',public,''file_size_limit'',file_size_limit,''allowed_mime_types'',allowed_mime_types) order by id) from storage.buckets where id in(''project-library'',''task-attachments''))
) as metadata) q) q),true);
 END $nw11_preflight$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010103936_nested_work_capabilities_and_execution.sql; SHA256 6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c

set local lock_timeout = ''10s'';',chr(13)||chr(10),chr(10)),
replace('create function eflow_r7.operation_capabilities(p_root uuid, p_node uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '''' as $$
declare
 r jsonb := eflow_r7.root(p_root);
 n eflow_r7.nodes;
 actions text[] := case when p_node is null then
  array[''manage_contributors'',''appoint_lead'',''create_child'',''order_children''] else
  array[''manage_contributors'',''appoint_lead'',''create_child'',''edit_details'',''move'',''order_children'',''delete'',''execute'',''submit'',''review''] end;
 action text;
 reason text;
 common_reason text;
 result jsonb := ''{}'';
 manager boolean;
 untouched boolean;
 descendants_complete boolean;
 ordered_ready boolean;
 node_depth integer;
begin
 -- Do not disclose row state through the private projector to an unavailable
 -- actor/scope. Snapshot retains its existing read exception.
 if r is null or auth.uid() is null or not coalesce(eflow_r7.read_root(p_root),false) then
  common_reason := ''access_unavailable'';
 elsif not coalesce(eflow_r3.eligible(auth.uid()),false) then
  common_reason := ''read_only'';
 elsif not coalesce((r->>''open'')::boolean,false) then
  common_reason := ''lifecycle_blocked'';
 end if;
 if p_node is not null then
  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
  if not found then common_reason := ''access_unavailable''; end if;
 end if;
 if common_reason is null then
  manager := coalesce(eflow_r7.manage(p_root,p_node),false);
  if p_node is not null then
   with recursive below as (
    select * from eflow_r7.nodes where id=p_node and task_id=p_root
    union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root
   ) select not exists(select 1 from below where status<>''todo'' or percent_complete<>0),
    not exists(select 1 from below where id<>p_node and status<>''completed'')
    into untouched,descendants_complete;
   with recursive above as (
    select id,parent_subtask_id,1 depth from eflow_r7.nodes where id=p_node and task_id=p_root
    union all select c.id,c.parent_subtask_id,a.depth+1 from eflow_r7.nodes c join above a on c.id=a.parent_subtask_id where c.task_id=p_root and a.depth<8
   ) select max(depth) into node_depth from above;
   ordered_ready := n.is_standalone or not exists(select 1 from eflow_r7.nodes c
    where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id
    and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>''completed'');
  end if;
 end if;
 foreach action in array actions loop
  reason := common_reason;
  if reason is null then
   if action=''appoint_lead'' then
    if not coalesce(case when p_node is null then eflow_r7.head(p_root)
     else eflow_r7.manage(p_root,p_node,true) end,false) then reason := ''appointment_denied'';
    elsif p_node is not null and n.status=''completed'' then reason := ''lifecycle_blocked''; end if;
   elsif action in (''execute'',''submit'') then
    if not coalesce(eflow_r7.node_work(p_node,auth.uid()),false) then reason := ''branch_denied'';
    elsif n.status in (''for_review'',''completed'') or
     r->>''kind''=''office'' and r->>''status'' not in (''todo'',''in_progress'',''changes_requested'') then reason := ''lifecycle_blocked'';
    elsif not ordered_ready then reason := ''lifecycle_blocked'';
    elsif action=''submit'' and (not descendants_complete or eflow_r7.reviewer(p_node,auth.uid()) is null) then reason := ''lifecycle_blocked''; end if;
   elsif action=''review'' then
    if auth.uid() is distinct from eflow_r7.pending_reviewer(p_node) then reason := ''branch_denied'';
    elsif n.status<>''for_review'' or not descendants_complete or r->>''kind''=''office'' and not exists(
     select 1 from public.subtasks s join public.subtask_submissions sub on sub.id=s.latest_submission_id
     where s.id=p_node and sub.status=''pending'' and sub.submitter_id<>auth.uid()) then reason := ''lifecycle_blocked''; end if;
   elsif not manager then reason := ''branch_denied'';
   elsif action=''manage_contributors'' then
    if p_node is null and r->>''kind''<>''office'' then reason := ''read_only'';
    elsif p_node is null and r->>''lead'' is null or p_node is not null and (n.lead_id is null or n.status=''completed'') then reason := ''lifecycle_blocked''; end if;
   elsif action=''create_child'' then
    if p_node is not null and (n.status<>''todo'' or n.percent_complete<>0 or node_depth>=8) then reason := ''lifecycle_blocked''; end if;
   elsif action=''order_children'' then
    -- This is parent:p_node, including parent:null for root direct children.
    if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root
     and c.parent_subtask_id is not distinct from p_node and (c.status<>''todo'' or c.percent_complete<>0)) then reason := ''lifecycle_blocked''; end if;
   elsif action in (''edit_details'',''move'',''delete'') then
    if not untouched then reason := ''lifecycle_blocked'';
    elsif action=''delete'' and r->>''kind''=''office'' and exists(
     with recursive below as (select id from eflow_r7.nodes where id=p_node and task_id=p_root
      union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root)
     select 1 from below b where
      exists(select 1 from public.subtask_progress_updates where subtask_id=b.id) or
      exists(select 1 from public.subtask_submissions where subtask_id=b.id) or
      exists(select 1 from public.work_budget_allocations where subtask_id=b.id) or
      exists(select 1 from public.petty_cash_requests where subtask_id=b.id) or
      exists(select 1 from public.budget_ledger_entries where subtask_id=b.id)
    ) then reason := ''history_blocked''; end if;
   end if;
  end if;
  result := result || jsonb_build_object(action,jsonb_build_object(''allowed'',reason is null,''reason_code'',reason));
 end loop;
 return result;
end $$;',chr(13)||chr(10),chr(10)),
replace('revoke all on function eflow_r7.operation_capabilities(uuid,uuid) from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('-- Preserve every legacy snapshot field, value and grant.
create or replace function eflow_r7.snapshot(p_root uuid) returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare r jsonb:=eflow_r7.root(p_root);v_nodes jsonb;v_people jsonb;begin
 if not eflow_r7.read_root(p_root) then raise exception ''Nested work access denied'' using errcode=''42501'';end if;
 with recursive tree as (
  select n.*,1 depth,array[n.sibling_order] path from eflow_r7.nodes n where n.task_id=p_root and n.parent_subtask_id is null
  union all select n.*,t.depth+1,t.path||n.sibling_order from eflow_r7.nodes n join tree t on n.parent_subtask_id=t.id where n.task_id=p_root and t.depth<8
 ) select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object(''capabilities'',eflow_r7.operation_capabilities(p_root,t.id),''can_manage'',eflow_r7.manage(p_root,t.id),''can_appoint'',eflow_r7.manage(p_root,t.id,true),''can_order'',eflow_r7.manage(p_root,t.parent_subtask_id),''can_work'',eflow_r7.node_work(t.id,auth.uid()),''can_review'',t.status=''for_review'' and eflow_r7.pending_reviewer(t.id)=auth.uid(),''current_reviewer'',eflow_r7.pending_reviewer(t.id)) order by path,id),''[]''::jsonb) into v_nodes from tree t;
 select coalesce(jsonb_agg(jsonb_build_object(''id'',p.id,''name'',p.full_name,''office'',p.org_id,''eligible'',eflow_r7.member((r->>''project'')::uuid,(r->>''office'')::uuid,p.id)) order by p.full_name,p.id),''[]''::jsonb) into v_people from public.profiles p where eflow_r7.member((r->>''project'')::uuid,(r->>''office'')::uuid,p.id) or p.id=(r->>''lead'')::uuid or coalesce(r->''people'',''[]'') ? p.id::text or exists(select 1 from eflow_r7.nodes n where n.task_id=p_root and (n.lead_id=p.id or p.id=any(n.assigned_to_ids)));
 return jsonb_build_object(''root'',r||jsonb_build_object(''capabilities'',eflow_r7.operation_capabilities(p_root)),''revision'',coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1),''can_manage'',eflow_r7.manage(p_root,null),''can_transfer'',eflow_r7.head(p_root),''nodes'',v_nodes,''people'',v_people,
 ''leaf_total'',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)),
 ''leaf_completed'',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and n.status=''completed'' and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)));
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010105440_nested_work_own_lead_execution.sql; SHA256 7f36fea512aa28ce00e322e21ef4d226095dff87d3d074172b802300eb2fe3c9

set local lock_timeout = ''10s'';',chr(13)||chr(10),chr(10)),
replace('-- Rewrite only reviewed assignment expressions in effective definitions.
-- CREATE OR REPLACE retains signatures, defaults, search paths and ACLs.
-- Fail setup if an anchor is absent/ambiguous; never guess a replacement body.
do $$
declare sig text; before_text text; after_text text; definition text;
begin
 for sig,before_text,after_text in select * from (values
  (''eflow_r7.node_work(uuid,uuid)'',
   $before$p_user=any(coalesce(n.assigned_to_ids,''{}''::uuid[]))$before$,
   $after$(p_user=any(coalesce(n.assigned_to_ids,''{}''::uuid[]))
    or n.kind=''office'' and r->>''kind''=''office'' and n.lead_id=p_user
     and eflow_r7.chain(n.task_id,n.id))$after$),
  (''public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)'',
   $before$subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, ''{}''::uuid[]))$before$,
   $after$case when eflow_r7.root(subtask_row.task_id)->>''kind''=''office'' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, ''{}''::uuid[])) end$after$),
  (''public.submit_subtask_for_review(uuid,jsonb)'',
   $before$subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, ''{}''::uuid[]))$before$,
   $after$case when eflow_r7.root(subtask_row.task_id)->>''kind''=''office'' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, ''{}''::uuid[])) end$after$),
  (''public.guard_subtask_contributor_update()'',
   $before$old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, ''{}''::uuid[]))$before$,
   $after$case when eflow_r7.root(old.task_id)->>''kind''=''office'' then
    coalesce(eflow_r7.node_work(old.id,caller),false)
   else old.assigned_to = caller
    or caller = any(coalesce(old.assigned_to_ids, ''{}''::uuid[])) end$after$),
  (''eflow_evidence.can_upload(text)'',
   $before$(coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), ''[]''::jsonb) ? auth.uid()::text)$before$,
   $after$(case when eflow_r7.root(s.task_id)->>''kind''=''office'' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), ''[]''::jsonb) ? auth.uid()::text end)$after$),
  (''eflow_evidence.guard_attempt()'',
   $before$coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), ''[]''::jsonb) ? auth.uid()::text$before$,
   $after$case when eflow_r7.root(s.task_id)->>''kind''=''office'' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), ''[]''::jsonb) ? auth.uid()::text end$after$),
  (''eflow_evidence.guard_progress()'',
   $before$coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), ''[]''::jsonb) ? auth.uid()::text$before$,
   $after$case when eflow_r7.root(s.task_id)->>''kind''=''office'' then
      coalesce(eflow_r7.node_work(s.id,auth.uid()),false)
     else coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), ''[]''::jsonb) ? auth.uid()::text end$after$)
 ) as changes(signature,assignment_before,assignment_after)
 loop
  if to_regprocedure(sig) is null then raise exception ''NW2.2 prerequisite function missing: %'',sig; end if;
  definition := replace(pg_get_functiondef(sig::regprocedure),chr(13),'''');
  before_text := replace(before_text,chr(13),'''');
  after_text := replace(after_text,chr(13),'''');
  if (length(definition)-length(replace(definition,before_text,'''')))/length(before_text)<>1 then
   raise exception ''NW2.2 assignment anchor changed: %; inspect effective baseline'',sig;
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010144145_nested_work_office_review_routing.sql; SHA256 9993a5ed5ecca0acdf756eee2bb5b32b2619b678711229af792dfdf532dc38fc

do $$
declare
 definition text;
 anchor constant text := ''r:=eflow_r7.root(n.task_id);v_id:=n.parent_subtask_id;'';
 replacement constant text := ''r:=eflow_r7.root(n.task_id);v_id:=case when r->>''''kind''''=''''office'''' and not exists(select 1 from public.tasks t where t.id=n.task_id and t.proposed_office_identity_id is not null) then n.id else n.parent_subtask_id end;'';
begin
 select pg_get_functiondef(''eflow_r7.reviewer(uuid,uuid)''::regprocedure) into definition;
 if strpos(definition,anchor)=0 and (length(definition)-length(replace(definition,replacement,'''')))/length(replacement)=1 then
  return; -- Exact correction already installed; preserve its definition/ACL.
 end if;
 if (length(definition)-length(replace(definition,anchor,'''')))/length(anchor) <> 1 then
  raise exception ''NW4.1 reviewer prerequisite changed; review effective definition'';
 end if;
 definition:=replace(definition,anchor,replacement);
 execute definition;
end $$;',chr(13)||chr(10),chr(10)),
replace('notify pgrst, ''reload schema'';',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010161650_nested_work_approval_consistency.sql; SHA256 58fceb9b3d629ecbd35533ebe9ca30c9e0ccd7e2d07909ad3ad06806b01c6a02


-- Private serialization state only: no work, evidence or historical decisions
-- are backfilled. A real row update makes stale RR/Serializable writers fail.
create table if not exists eflow_r7.completion_locks (
 root_id uuid primary key,
 version bigint not null default 1,
 approval_xid xid8 not null,
 approved_ids uuid[] not null default ''{}''
);',chr(13)||chr(10),chr(10)),
replace('alter table eflow_r7.completion_locks enable row level security;',chr(13)||chr(10),chr(10)),
replace('revoke all on eflow_r7.completion_locks from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.lock_completion(p_root uuid)
returns void language plpgsql security definer set search_path='''' as $$
begin
 if p_root is null then return;end if;
 insert into eflow_r7.completion_locks(root_id,approval_xid)
 values(p_root,pg_catalog.pg_current_xact_id())
 on conflict(root_id) do update set
  version=eflow_r7.completion_locks.version+1,
  approval_xid=excluded.approval_xid,
  approved_ids=case when eflow_r7.completion_locks.approval_xid=excluded.approval_xid
   then eflow_r7.completion_locks.approved_ids else ''{}''::uuid[] end;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.require_completed_descendants(p_root uuid,p_target uuid)
returns void language plpgsql security definer set search_path='''' as $$
declare personal boolean;bad record;
begin
 personal:=exists(select 1 from public.personal_tasks where id=p_root);
 with recursive required as (
  select n.* from eflow_r7.nodes n where n.task_id=p_root and
   (p_target=p_root or n.parent_subtask_id=p_target)
  union
  select c.* from eflow_r7.nodes c join required p on c.parent_subtask_id=p.id where c.task_id=p_root
 )
 select n.id,n.title into bad from required n
 left join public.subtasks s on s.id=n.id and not personal
 where n.status is distinct from ''completed'' or not personal and (
  not coalesce(s.is_completed,false) or
  -- Legacy completed rows without an attempt remain valid. An existing formal
  -- binding must still identify its own approved attempt, never pending/rejected.
  s.latest_submission_id is not null and not exists(
   select 1 from public.subtask_submissions a where a.id=s.latest_submission_id
    and a.subtask_id=s.id and a.task_id=p_root and a.status=''approved''))
 order by n.id limit 1;
 if found then
  raise exception ''Complete and review every descendant first: resolve descendant "%" (%) before approval.'',bad.title,bad.id
   using errcode=''23514'',hint=''Resolve or reapprove this descendant, reload the current work tree, then retry approval.'';
 end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.lock_completion_write()
returns trigger language plpgsql security definer set search_path='''' as $$
declare r uuid;v_id uuid;approved boolean:=false;
begin
 if tg_table_name in (''tasks'',''personal_tasks'') then r:=case when tg_op=''DELETE'' then old.id else new.id end;
 else r:=case when tg_op=''DELETE'' then old.task_id else new.task_id end;end if;
 perform eflow_r7.lock_completion(r);
 if tg_op<>''DELETE'' and tg_table_name in (''tasks'',''subtasks'',''personal_tasks'',''personal_subtasks'') then
  approved:=(tg_op=''INSERT'' or new.status is distinct from old.status) and new.status=case when tg_table_name=''personal_tasks'' then ''done'' else ''completed'' end;
  if approved then v_id:=new.id;end if;
 end if;
 if approved then
  update eflow_r7.completion_locks set approved_ids=array_append(approved_ids,v_id)
  where root_id=r and not(v_id=any(approved_ids));
  -- Give an actionable error before the unchanged legacy parent guard; the
  -- deferred check below still enforces the final state at commit.
  perform eflow_r7.require_completed_descendants(r,v_id);
 end if;
 if tg_op=''DELETE'' then return old;else return new;end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.check_completion_commit()
returns trigger language plpgsql security definer set search_path='''' as $$
declare r uuid;target uuid;is_root boolean;personal boolean;
begin
 if tg_table_name in (''tasks'',''personal_tasks'') then r:=case when tg_op=''DELETE'' then old.id else new.id end;
 else r:=case when tg_op=''DELETE'' then old.task_id else new.task_id end;end if;
 -- The BEFORE writer/entry-point lock remains held through this deferred check
 -- and commit. Later writes in this transaction also schedule this check, even
 -- when the caller switches constraints to IMMEDIATE. Historical approvals
 -- from another transaction are intentionally not re-decided or revoked.
 for target in select unnest(approved_ids) from eflow_r7.completion_locks
  where root_id=r and approval_xid=pg_catalog.pg_current_xact_id() loop
  personal:=exists(select 1 from public.personal_tasks where id=r);
  is_root:=target=r;
  if personal then
   if is_root then
    if not exists(select 1 from public.personal_tasks where id=target and status=''done'') then continue;end if;
   elsif not exists(select 1 from public.personal_subtasks where id=target and status=''completed'') then continue;
   end if;
  else
   if is_root then
    if not exists(select 1 from public.tasks where id=target and status=''completed'') then continue;end if;
   elsif not exists(select 1 from public.subtasks where id=target and status=''completed'') then continue;
   end if;
  end if;
  perform eflow_r7.require_completed_descendants(r,target);
 end loop;
 return null;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Cover insertion/deletion/reparenting as well as status and formal attempt
-- changes. RLS, existing BEFORE guards and review-time locks remain installed.
do $$ declare t text;begin
 foreach t in array array[''tasks'',''subtasks'',''personal_tasks'',''personal_subtasks'',''subtask_submissions''] loop
  execute format(''drop trigger if exists nw42_completion_lock on public.%I'',t);
  execute format(''create trigger nw42_completion_lock before insert or update or delete on public.%I for each row execute function eflow_r7.lock_completion_write()'',t);
  execute format(''drop trigger if exists nw42_completion_commit on public.%I'',t);
  execute format(''create constraint trigger nw42_completion_commit after insert or update or delete on public.%I deferrable initially deferred for each row execute function eflow_r7.check_completion_commit()'',t);
  -- A trusted repair may bypass historical workflow triggers using replica
  -- mode; this final consistency invariant must still participate in its lock.
  execute format(''alter table public.%I enable always trigger nw42_completion_lock'',t);
  execute format(''alter table public.%I enable always trigger nw42_completion_commit'',t);
 end loop;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Acquire the common lock before the existing RPC row locks. Preserve the
-- entire effective definition, signature, ACL and original authority checks.
do $$ declare sig text;d text;call text;anchor text;marker text:=''/* NW4.2 completion serialization */'';begin
 foreach sig in array array[
  ''public.decide_task_review(uuid,boolean,text,text)'',
  ''public.submit_task_for_review(uuid,jsonb)'',
  ''public.decide_subtask_review(uuid,boolean,text)'',
  ''public.submit_subtask_for_review(uuid,jsonb)'',
  ''public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)'',
  ''eflow_r7.command(uuid,integer,uuid,text,jsonb)''] loop
  d:=pg_catalog.pg_get_functiondef(sig::regprocedure);
  if strpos(d,marker)>0 then continue;end if;
  call:=case when sig like ''eflow_r7.command%'' then ''p_root''
   when sig like ''public.%subtask%'' then ''(select task_id from public.subtasks where id=p_subtask_id)''
   else ''p_task_id'' end;
  if d!~* ''\mbegin\M'' then raise exception ''Expected PL/pgSQL entry point: %'',sig;end if;
  if sig like ''eflow_r7.command%'' then
   -- Keep its project-before-root order, shared by access/appointment changes.
   anchor:=''perform 1 from public.tasks where id=p_root for update;'';
   if (length(d)-length(replace(d,anchor,'''')))/length(anchor)<>1 then raise exception ''Expected command root lock: %'',sig;end if;
   d:=replace(d,anchor,marker||'' perform eflow_r7.lock_completion(p_root); ''||anchor);
  else
   d:=regexp_replace(d,''\mbegin\M'',''begin ''||marker||'' perform eflow_r7.lock_completion(''||call||'');'',''i'');
  end if;
  execute d;
 end loop;
end $$;',chr(13)||chr(10),chr(10)),
replace('revoke all on function eflow_r7.lock_completion(uuid),eflow_r7.lock_completion_write(),eflow_r7.check_completion_commit(),eflow_r7.require_completed_descendants(uuid,uuid) from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('notify pgrst,''reload schema'';',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010164510_nested_work_operation_safety.sql; SHA256 82d72c71808ca6111979016ffc067aa74378d8535a87c3bcc3425045d99d3fe0

set local lock_timeout=''10s'';',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.subtree_ids(p_root uuid,p_node uuid)
returns uuid[] language plpgsql stable security definer set search_path='''' as $$
declare ids uuid[]; invalid boolean;
begin
 if eflow_r7.root(p_root) is null then raise exception ''Work scope unavailable'' using errcode=''42501'';end if;
 if p_node is not null and not exists(select 1 from eflow_r7.nodes where id=p_node and task_id=p_root) then
  raise exception ''Choose a node in this root'' using errcode=''23514'';
 end if;
 -- Inspect ancestry as well as descendants: an orphan/cycle must not silently
 -- disappear from a rooted traversal. The ninth hop is diagnostic, not allowed.
 with recursive above as (
  select n.id origin,n.id,n.parent_subtask_id,array[n.id] path,1 depth,false cycle
  from eflow_r7.nodes n where n.task_id=p_root
  union all select a.origin,n.id,n.parent_subtask_id,a.path||n.id,a.depth+1,n.id=any(a.path)
  from above a join eflow_r7.nodes n on n.id=a.parent_subtask_id and n.task_id=p_root
  where not a.cycle and a.depth<=8
 ) select exists(select 1 from above a where a.cycle or a.depth>8 or
  a.parent_subtask_id is not null and not exists(select 1 from eflow_r7.nodes n where n.id=a.parent_subtask_id and n.task_id=p_root)) into invalid;
 if invalid then raise exception ''Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first'' using errcode=''23514'';end if;
 with recursive below as (
  select id from eflow_r7.nodes where task_id=p_root and (p_node is null or id=p_node)
  union select n.id from eflow_r7.nodes n join below b on n.parent_subtask_id=b.id where n.task_id=p_root
 ) select coalesce(array_agg(id order by id),''{}'') into ids from below;
 return ids;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.history_facts(p_root uuid,p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare r jsonb:=eflow_r7.root(p_root); facts jsonb; codes text[]:=''{}''; k text; v bigint;
begin
 if r is null or p_ids is null or exists(select 1 from unnest(p_ids) x where not exists(select 1 from eflow_r7.nodes n where n.id=x and n.task_id=p_root)) then
  raise exception ''Required history scope unavailable'' using errcode=''23514'';end if;
 select jsonb_build_object(''state'',(select count(*) from eflow_r7.nodes where task_id=p_root and id=any(p_ids) and (status<>''todo'' or percent_complete<>0)),
  ''progress'',0,''submissions'',0,''reviews'',0,''attachments'',0,''evidence'',0,''attempts'',0,''allocations'',0,''allocation_lines'',0,''cash'',0,''ledger'',0,''execution_events'',0) into facts;
 if r->>''kind''=''office'' then
  -- Missing canonical relations/columns cause an error; never treat unavailable
  -- history as an empty result. Count inactive/cancelled/rejected finance too.
  with allocations as (select id from public.work_budget_allocations where subtask_id=any(p_ids)),
  lines as (select id from public.work_budget_allocation_lines where allocation_id in(select id from allocations)),
  cash as (select c.id from public.petty_cash_requests c where c.subtask_id=any(p_ids) or c.allocation_id in(select id from allocations)
   or c.allocation_line_id in(select id from lines) or exists(select 1 from public.petty_cash_request_lines l where l.request_id=c.id and l.allocation_line_id in(select id from lines)))
  select facts||jsonb_build_object(
   ''state'',(select count(*) from public.subtasks where task_id=p_root and id=any(p_ids) and (status<>''todo'' or percent_complete<>0 or is_completed or latest_submission_id is not null or completed_by is not null or completed_at is not null)),
   ''progress'',(select count(*) from public.subtask_progress_updates where subtask_id=any(p_ids)),
   ''submissions'',(select count(*) from public.subtask_submissions where subtask_id=any(p_ids)),
   ''reviews'',(select count(*) from public.subtask_submissions where subtask_id=any(p_ids) and (status<>''pending'' or decided_by is not null or decided_at is not null)),
   ''attachments'',(select count(*) from public.subtask_submission_attachments a where a.subtask_id=any(p_ids) or a.submission_id in(select id from public.subtask_submissions where subtask_id=any(p_ids))),
   ''evidence'',(select count(*) from eflow_evidence.objects o where o.subtask_id=any(p_ids)
    or o.reference_kind=''subtask_attachment'' and o.reference_id in(select id from public.subtask_submission_attachments where subtask_id=any(p_ids))
    or o.reference_kind=''progress'' and o.reference_id in(select id from public.subtask_progress_updates where subtask_id=any(p_ids))),
   ''attempts'',(select count(*) from eflow_evidence.attempts a where a.subtask_id=any(p_ids) or a.kind=''subtask'' and a.submission_id in(select id from public.subtask_submissions where subtask_id=any(p_ids))),
   ''allocations'',(select count(*) from allocations),''allocation_lines'',(select count(*) from lines),''cash'',(select count(*) from cash),
   ''ledger'',(select count(*) from public.budget_ledger_entries l where l.subtask_id=any(p_ids) or l.allocation_id in(select id from allocations) or l.petty_cash_request_id in(select id from cash))) into facts;
 else
  facts:=facts||jsonb_build_object(''state'',(select count(*) from public.personal_subtasks where task_id=p_root and id=any(p_ids) and
   (status<>''todo'' or percent_complete<>0 or submitted_by is not null or reviewer_id is not null)),
   ''execution_events'',(select count(*) from public.work_tree_events e where e.root_id=p_root and
    (e.command in (''progress'',''submit'',''review'') and e.node_id=any(p_ids) or exists(
     select 1 from jsonb_array_elements(coalesce(e.before_data->''nodes'',''[]'')||coalesce(e.after_data->''nodes'',''[]'')) n
     where n->>''id''=any(p_ids::text[]) and (not(n ? ''status'' and n ? ''percent_complete'') or coalesce(n->>''status'',''todo'')<>''todo'' or coalesce((n->>''percent_complete'')::numeric,0)<>0
      or nullif(n->>''submitted_by'','''') is not null))))) ;
 end if;
 for k,v in select key,value::bigint from jsonb_each_text(facts) order by key loop
  if v>0 then codes:=array_append(codes,case when k=''state'' then ''lifecycle_blocked'' else ''history_''||k end);end if;
 end loop;
 return jsonb_build_object(''counts'',facts,''blocker_codes'',to_jsonb(codes),''untouched'',cardinality(codes)=0);
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.operation_impact(p_root uuid,p_command text,p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path='''' as $$
declare r jsonb:=eflow_r7.root(p_root);n eflow_r7.nodes; target uuid:=(p_payload->>''id'')::uuid;
 parent uuid:=(p_payload->>''parent'')::uuid;ids uuid[]:=''{}'';selected uuid[]:=''{}'';extra uuid[];row_id uuid;
 structural boolean:=false;facts jsonb;codes text[]:=''{}'';incoming uuid[];old_people uuid[];lead uuid;compatibility_ids uuid[]:=''{}'';
begin
 if r is null then raise exception ''Work scope unavailable'' using errcode=''42501'';end if;
 -- Validate bounded topology even when the command''s selected scope is empty.
 extra:=eflow_r7.subtree_ids(p_root,null);
 if target is not null and p_command<>''create'' then
  select * into n from eflow_r7.nodes where id=target and task_id=p_root;
  if not found then raise exception ''Choose a node in this root'' using errcode=''23514'';end if;
 end if;
 if p_command in (''delete'',''edit'',''move'',''staff'') then selected:=eflow_r7.subtree_ids(p_root,target);ids:=selected;
 elsif p_command in (''root_lead'',''contributors'') then selected:=extra;ids:=selected;
 elsif p_command=''create'' then
  if parent is not null then selected:=array[parent];ids:=eflow_r7.subtree_ids(p_root,parent);end if;
 elsif p_command=''order'' then
  if parent is not null then perform eflow_r7.subtree_ids(p_root,parent);end if;
  for row_id in select id from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent loop
   selected:=array_append(selected,row_id);ids:=ids||eflow_r7.subtree_ids(p_root,row_id);
  end loop;
 end if;
 structural:=p_command in (''move'',''order'',''delete'',''create'') or p_command=''edit'' and p_payload ? ''standalone'' and (p_payload->>''standalone'')::boolean is distinct from n.is_standalone;
 if p_command=''move'' or p_command=''edit'' and structural then
  if p_command=''move'' and n.parent_subtask_id is not null then ids:=ids||array[n.parent_subtask_id];end if;
  if p_command=''move'' and parent is not null then perform eflow_r7.subtree_ids(p_root,parent);ids:=ids||array[parent];end if;
  -- Dependency scopes at both endpoints; include every sibling''s descendants.
  for row_id in select id from eflow_r7.nodes where task_id=p_root and
   (parent_subtask_id is not distinct from n.parent_subtask_id or p_command=''move'' and parent_subtask_id is not distinct from parent) loop
   ids:=ids||eflow_r7.subtree_ids(p_root,row_id);
  end loop;
 end if;
 select coalesce(array_agg(distinct x order by x),''{}'') into ids from unnest(ids) x;
 facts:=eflow_r7.history_facts(p_root,ids);
 if structural then select coalesce(array_agg(value),''{}'') into codes from jsonb_array_elements_text(facts->''blocker_codes'');end if;
 if p_command in (''staff'',''root_lead'',''contributors'') then
  lead:=case when p_command=''contributors'' then (r->>''lead'')::uuid else (p_payload->>''lead'')::uuid end;
  old_people:=case when target is null then array(select value::uuid from jsonb_array_elements_text(coalesce(r->''people'',''[]''))) else coalesce(n.assigned_to_ids,''{}'') end;
  if r->>''kind''=''office'' or target is not null then
   incoming:=case when p_payload ? ''people'' then array(select value::uuid from jsonb_array_elements_text(p_payload->''people''))
    when p_command=''root_lead'' then array_remove(old_people||array[lead],null) else ''{}''::uuid[] end;
   if p_command in (''staff'',''root_lead'') and lead is distinct from (case when target is null then (r->>''lead'')::uuid else n.lead_id end) and not(old_people <@ incoming) then
    codes:=codes||array[''transfer_worker_removal''];
   end if;
   if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.id=any(selected) and c.id is distinct from target
    and c.status<>''completed'' and exists(select 1 from unnest(c.assigned_to_ids) worker where worker=any(old_people) and not worker=any(incoming))) then
    codes:=codes||array[''unfinished_worker_removal''];
   end if;
  end if;
 end if;
 if r->>''kind''=''office'' and p_command in (''create'',''edit'',''staff'',''root_lead'',''move'',''order'',''delete'') then
  -- Existing R7 writes derived global positions after these commands. Track
  -- prospective position changes separately from canonical dependency scopes:
  -- changing a compatibility number does not itself reopen historical work.
  with recursive planned as (
   select c.id,case when p_command=''move'' and c.id=target then parent else c.parent_subtask_id end parent_id,
    case when p_command=''move'' and c.id=target then (select coalesce(max(sibling_order),-1)+1 from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent)
     when p_command=''order'' and p_payload ? ''order'' and c.parent_subtask_id is not distinct from parent then
      (select ordinality::integer-1 from jsonb_array_elements_text(p_payload->''order'') with ordinality x where x.value=c.id::text)
     else c.sibling_order end sibling_order
   from eflow_r7.nodes c where c.task_id=p_root and not(p_command=''delete'' and c.id=any(selected))
   union all select target,parent,(select coalesce(max(sibling_order),-1)+1 from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from parent)
    where p_command=''create'' and target is not null and not exists(select 1 from eflow_r7.nodes where id=target)
  ), ordered as (
   select id,array[lpad(sibling_order::text,10,''0'')||id::text] path,1 depth from planned where parent_id is null
   union all select c.id,o.path||(lpad(c.sibling_order::text,10,''0'')||c.id::text),o.depth+1 from planned c join ordered o on c.parent_id=o.id where o.depth<8
  ), ranked as (select id,row_number() over(order by path)-1 position from ordered)
  select coalesce(array_agg(c.id order by c.id),''{}'') into compatibility_ids from public.subtasks c join ranked x on x.id=c.id where c.task_id=p_root and c.position<>x.position;
 end if;
 return jsonb_build_object(''root_id'',p_root,''command'',p_command,''allowed'',cardinality(codes)=0,''blocker_codes'',to_jsonb(codes),
  ''ids'',to_jsonb(ids),''selected_count'',cardinality(selected),''descendant_count'',greatest(cardinality(selected)-case when target is null then 0 else 1 end,0),
  ''affected_appointment_count'',(select count(*) from eflow_r7.nodes where task_id=p_root and id=any(selected) and lead_id is not null
   and (p_command=''root_lead'' and (p_payload->>''lead'')::uuid is distinct from (r->>''lead'')::uuid
    or p_command=''move'' and id<>target or p_command=''staff'' and (p_payload->>''lead'')::uuid is distinct from n.lead_id and id<>target)),
  ''compatibility_position_ids'',to_jsonb(compatibility_ids),''history'',facts,''structural'',structural);
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.require_operation(p_root uuid,p_command text,p_payload jsonb)
returns void language plpgsql security definer set search_path='''' as $$
declare impact jsonb;
begin
 impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);
 if not (impact->>''allowed'')::boolean then raise exception ''Work history or dependent responsibilities block this operation: %; resolve affected work first'',impact->''blocker_codes''
  using errcode=''23514'',hint=''Preserve recorded evidence and finance; resolve staffing separately. Confirmation cannot override protected history.'';end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.guard_operation_write()
returns trigger language plpgsql security definer set search_path='''' as $$
declare a jsonb:=case when tg_op<>''INSERT'' then to_jsonb(old) else ''{}'' end;
 b jsonb:=case when tg_op<>''DELETE'' then to_jsonb(new) else ''{}'' end;
 root_id uuid; r jsonb; node_id uuid; cmd text;payload jsonb;
begin
 root_id:=case when tg_table_name in (''tasks'',''personal_tasks'') then (b->>''id'')::uuid else coalesce((a->>''task_id'')::uuid,(b->>''task_id'')::uuid) end;
 r:=eflow_r7.root(root_id);if r is null then if tg_op=''DELETE'' then return old;else return new;end if;end if;
 -- Preserve the private R9 UPDATE-only staffing removal, never a client marker
 -- or a structural bypass. Existing R9 authority/preview/serialization is kept.
 if tg_op=''UPDATE'' and eflow_r9.internal((r->>''project'')::uuid) and
  (a-array[''lead_id'',''assigned_to'',''recommendation_lead_id'',''assigned_to_ids'',''team_member_ids'',''team_member_names'',''assignee_name'',''reviewer_id'',''backup_reviewer_id'',''revision'',''updated_at''])=
  (b-array[''lead_id'',''assigned_to'',''recommendation_lead_id'',''assigned_to_ids'',''team_member_ids'',''team_member_names'',''assignee_name'',''reviewer_id'',''backup_reviewer_id'',''revision'',''updated_at'']) then return new;end if;
 if auth.uid() is not null and not coalesce(eflow_r7.read_root(root_id),false) then raise exception ''Current work access required'' using errcode=''42501'';end if;
 if tg_table_name in (''tasks'',''personal_tasks'') then
  if tg_op=''UPDATE'' and coalesce(b->>''lead_id'',b->>''assigned_to'',b->>''recommendation_lead_id'') is distinct from coalesce(a->>''lead_id'',a->>''assigned_to'',a->>''recommendation_lead_id'') then
   cmd:=''root_lead'';payload:=jsonb_build_object(''lead'',coalesce(b->>''lead_id'',b->>''assigned_to'',b->>''recommendation_lead_id''),''people'',b->''team_member_ids'');
   if tg_table_name=''personal_tasks'' then payload:=payload-''people'';end if;
  elsif tg_op=''UPDATE'' and b->''team_member_ids'' is distinct from a->''team_member_ids'' then cmd:=''contributors'';payload:=jsonb_build_object(''people'',b->''team_member_ids'');end if;
 else
  node_id:=coalesce((a->>''id'')::uuid,(b->>''id'')::uuid);
  if tg_op=''DELETE'' then cmd:=''delete'';payload:=jsonb_build_object(''id'',node_id);
  elsif tg_op=''INSERT'' then cmd:=''create'';payload:=jsonb_build_object(''id'',node_id,''parent'',b->''parent_subtask_id'');
  elsif b->''parent_subtask_id'' is distinct from a->''parent_subtask_id'' then cmd:=''move'';payload:=jsonb_build_object(''id'',node_id,''parent'',b->''parent_subtask_id'');
  elsif b->''sibling_order'' is distinct from a->''sibling_order'' or b->''position'' is distinct from a->''position'' and not eflow_r7.internal(root_id) then cmd:=''order'';payload:=jsonb_build_object(''parent'',a->''parent_subtask_id'');
  elsif b->''is_standalone'' is distinct from a->''is_standalone'' then cmd:=''edit'';payload:=jsonb_build_object(''id'',node_id,''standalone'',b->''is_standalone'');
  elsif b->''lead_id'' is distinct from a->''lead_id'' or b->''assigned_to_ids'' is distinct from a->''assigned_to_ids'' then
   -- Canonical transfer/move clears descendants after checking the full scope.
   if b->>''lead_id'' is null and eflow_r7.internal(root_id) and b->''assigned_to_ids''=a->''assigned_to_ids'' then return new;end if;
   cmd:=''staff'';payload:=jsonb_build_object(''id'',node_id,''lead'',b->''lead_id'',''people'',b->''assigned_to_ids'');
  elsif b->''title'' is distinct from a->''title'' or b->''due_date'' is distinct from a->''due_date'' then
   cmd:=''edit'';payload:=jsonb_build_object(''id'',node_id,''title'',b->''title'',''due'',b->''due_date'',''standalone'',b->''is_standalone'');
  end if;
 end if;
 if cmd is not null then perform eflow_r7.require_operation(root_id,cmd,payload);end if;
 if tg_op=''DELETE'' then return old;else return new;end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('revoke all on function eflow_r7.subtree_ids(uuid,uuid),eflow_r7.history_facts(uuid,uuid[]),eflow_r7.operation_impact(uuid,text,jsonb),
 eflow_r7.require_operation(uuid,text,jsonb),eflow_r7.guard_operation_write() from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('-- Original R7 entry: after authority/payload/revision checks and before any
-- snapshot/marker/write. Exact receipt retries return through the old early path.
do $$declare d text;anchor text:=''v_before:=eflow_r7.snapshot(p_root);'';begin
 select pg_get_functiondef(''eflow_r7.command(uuid,integer,uuid,text,jsonb)''::regprocedure) into d;
 if strpos(d,''/* NW5.1 operation safety */'')=0 then
  if (length(d)-length(replace(d,anchor,'''')))/length(anchor)<>1 then raise exception ''Review changed R7 command before adding history checks'';end if;
  execute replace(d,anchor,''/* NW5.1 operation safety */ if p_command not in (''''progress'''',''''submit'''',''''review'''') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if; ''||anchor);
 end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('drop trigger if exists nw51_operation_safety on public.subtasks;',chr(13)||chr(10),chr(10)),
replace('create trigger nw51_operation_safety before insert or update or delete on public.subtasks for each row execute function eflow_r7.guard_operation_write();',chr(13)||chr(10),chr(10)),
replace('drop trigger if exists nw51_operation_safety on public.personal_subtasks;',chr(13)||chr(10),chr(10)),
replace('create trigger nw51_operation_safety before insert or update or delete on public.personal_subtasks for each row execute function eflow_r7.guard_operation_write();',chr(13)||chr(10),chr(10)),
replace('drop trigger if exists nw51_operation_safety on public.tasks;',chr(13)||chr(10),chr(10)),
replace('create trigger nw51_operation_safety before update on public.tasks for each row execute function eflow_r7.guard_operation_write();',chr(13)||chr(10),chr(10)),
replace('drop trigger if exists nw51_operation_safety on public.personal_tasks;',chr(13)||chr(10),chr(10)),
replace('create trigger nw51_operation_safety before update on public.personal_tasks for each row execute function eflow_r7.guard_operation_write();',chr(13)||chr(10),chr(10)),
replace('-- Keep NW2''s authority/lifecycle and JSON shape. Additional history predicates
-- use the same collector; staffing remains an authorized active-work amendment.
do $$declare d text;anchor text:=''result := result || jsonb_build_object(action,jsonb_build_object(''''allowed'''',reason is null,''''reason_code'''',reason));'';addition text;begin
 select pg_get_functiondef(''eflow_r7.operation_capabilities(uuid,uuid)''::regprocedure) into d;
 addition:=$patch$/* NW5.1 history capability */
  if reason is null and action in (''create_child'',''order_children'',''move'',''delete'') then
   if not (eflow_r7.operation_impact(p_root,case action when ''create_child'' then ''create'' when ''order_children'' then ''order'' else action end,
    case when action in (''create_child'',''order_children'') then jsonb_build_object(''parent'',p_node) else jsonb_build_object(''id'',p_node,''parent'',n.parent_subtask_id) end)->>''allowed'')::boolean then reason:=''history_blocked'';end if;
  end if;
 $patch$;
 if strpos(d,''/* NW5.1 history capability */'')=0 then
  if (length(d)-length(replace(d,anchor,'''')))/length(anchor)<>1 then raise exception ''Review changed capability projector'';end if;
  execute replace(d,anchor,addition||anchor);
 end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010172348_nested_work_r9_staffing_removal.sql; SHA256 efe8559aa96c36a6b057e05ee4487b7711ddc46a0cc4a7796c3c8e07080815ec


-- NW5.1: exact UPDATE permissions, created only by the private confirmed R9
-- removal path after current authority/fingerprint validation under its locks.
-- Neither a client-set GUC nor R9''s older generic mutation marker grants this.
create table if not exists eflow_r9.staffing_removals (
 tx xid8 not null, actor uuid not null, project_id uuid not null,
 office_id uuid, removed_user uuid not null, request_id uuid not null, fingerprint text not null,
 relation_name text not null, row_id uuid not null,
 before_row jsonb not null, after_row jsonb not null,
 primary key(tx,relation_name,row_id)
);',chr(13)||chr(10),chr(10)),
replace('alter table eflow_r9.staffing_removals enable row level security;',chr(13)||chr(10),chr(10)),
replace('revoke all on eflow_r9.staffing_removals from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r9.staffing_removal_allowed(p_table text,p_old jsonb,p_new jsonb)
returns boolean language sql stable security definer set search_path='''' as $$
 select exists(select 1 from eflow_r9.staffing_removals m
  where m.tx=pg_catalog.pg_current_xact_id() and m.actor=auth.uid()
   and m.relation_name=p_table and m.row_id=(p_old->>''id'')::uuid
   and eflow_r9.person_head(m.project_id,m.office_id)
   and m.before_row=p_old-''updated_at'' and m.after_row=p_new-''updated_at'')
$$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r9.guard_staffing_removal()
returns trigger language plpgsql security definer set search_path='''' as $$
begin
 if exists(select 1 from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id()) then
  if tg_op<>''UPDATE'' then
   raise exception ''Confirmed member removal permits only its exact current staffing cleanup'' using errcode=''42501'';
  end if;
  if not eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then
   raise exception ''Confirmed member removal cannot change work facts or unrelated staffing'' using errcode=''42501'';
  end if;
 end if;
 if tg_op=''DELETE'' then return old;end if;return new;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r9.lock_removal_work(p_project uuid,p_office uuid)
returns void language plpgsql security definer set search_path='''' as $$
declare r record;
begin
 -- Caller already holds the original R9 project advisory lock. Acquire root
 -- completion serialization before root/item rows, as NW4.2 approval does.
 perform 1 from public.projects where id=p_project for update;
 perform 1 from public.personal_projects where id=p_project for update;
 for r in select id from public.tasks where linked_project_id=p_project and org_id=p_office
  union all select id from public.personal_tasks where project_id=p_project order by id loop
  perform eflow_r7.lock_completion(r.id);
  perform 1 from public.tasks where id=r.id for update;
  perform 1 from public.personal_tasks where id=r.id for update;
 end loop;
 perform 1 from public.subtasks n join public.tasks t on t.id=n.task_id
  where t.linked_project_id=p_project and t.org_id=p_office order by n.id for update of n;
 perform 1 from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id
  where t.project_id=p_project order by n.id for update of n;
 perform 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id
  where o.project_id=p_project and o.office_id=p_office order by m.user_id for update of m;
 perform 1 from public.personal_project_members where project_id=p_project order by user_id for update;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r9.clear_removed_staff(p_project uuid,p_user uuid,p_office uuid,p_request uuid,p_fingerprint text)
returns void language plpgsql security definer set search_path='''' as $$
declare v jsonb; roots uuid[];v_nodes uuid[];clear_leads uuid[];r record;a jsonb;b jsonb;
begin
 perform eflow_r3.actor();
 if p_request is null or not eflow_r9.person_head(p_project,p_office) then
  raise exception ''Current confirmed removal authority required'' using errcode=''42501'';end if;
 v:=eflow_r9.preview(p_project,p_user,p_office);
 if v->>''fingerprint'' is distinct from p_fingerprint then
  raise exception ''Membership or assignments changed. Refresh the impact preview before confirming.'' using errcode=''40001'';end if;
 v:=v-''fingerprint'';
 select coalesce(array_agg((x->>''id'')::uuid),''{}'') into roots from jsonb_array_elements(v->''tasks'') x
  where coalesce((x->>''lead'')::uuid,(x->>''recommendation_lead'')::uuid)=p_user;
 select coalesce(array_agg((x->>''id'')::uuid),''{}'') into v_nodes from jsonb_array_elements(v->''nodes'') x;
 select coalesce(array_agg(id),''{}'') into clear_leads from eflow_r7.nodes
  where id=any(v_nodes) and (lead_id=p_user or task_id=any(roots) or id in
   (with recursive below as (select id from eflow_r7.nodes where lead_id=p_user
    union select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select id from below));
 -- Copy every work fact unchanged. Only the exact R9 staffing deltas are
 -- projected. Stored reviewer IDs/names/decisions are deliberately untouched.
 for r in select * from (
  select ''subtasks'' relation_name,to_jsonb(n) j from public.subtasks n where id=any(v_nodes)
  union all select ''personal_subtasks'',to_jsonb(n) from public.personal_subtasks n where id=any(v_nodes)
  union all select ''tasks'',to_jsonb(t) from public.tasks t where linked_project_id=p_project and org_id=p_office
   and id in(select (x->>''id'')::uuid from jsonb_array_elements(v->''tasks'') x)
  union all select ''personal_tasks'',to_jsonb(t) from public.personal_tasks t where project_id=p_project
   and id in(select (x->>''id'')::uuid from jsonb_array_elements(v->''tasks'') x)
  ) affected order by relation_name,j->>''id''
 loop
  a:=r.j-''updated_at'';b:=a;
  if r.relation_name in (''subtasks'',''personal_subtasks'') then
   b:=b||jsonb_build_object(''assigned_to_ids'',array_remove(array(select x::uuid from jsonb_array_elements_text(a->''assigned_to_ids'') x),p_user),
    ''lead_id'',case when (a->>''id'')::uuid=any(clear_leads) then null else (a->>''lead_id'')::uuid end);
   if r.relation_name=''subtasks'' and (a->>''assigned_to'')::uuid=p_user then b:=b||jsonb_build_object(''assigned_to'',null);end if;
  elsif r.relation_name=''tasks'' then
   b:=b||jsonb_build_object(''assigned_to'',case when (a->>''id'')::uuid=any(roots) then null else (a->>''assigned_to'')::uuid end,
    ''recommendation_lead_id'',case when (a->>''id'')::uuid=any(roots) or (a->>''recommendation_lead_id'')::uuid=p_user then null else (a->>''recommendation_lead_id'')::uuid end,
    ''assignee_name'',case when (a->>''id'')::uuid=any(roots) then '''' else a->>''assignee_name'' end);
   if a->''team_member_ids'' @> jsonb_build_array(p_user) then
    b:=b||jsonb_build_object(''team_member_ids'',array(select x::uuid from jsonb_array_elements_text(a->''team_member_ids'') x where x::uuid<>p_user),
     ''team_member_names'',array(select a->''team_member_names''->>(pos::int-1) from jsonb_array_elements_text(a->''team_member_ids'') with ordinality x(uid,pos) where uid::uuid<>p_user order by pos));
   end if;
  else
   b:=b||jsonb_build_object(''lead_id'',case when (a->>''lead_id'')::uuid=p_user then null else (a->>''lead_id'')::uuid end);
   if b<>a then b:=b||jsonb_build_object(''revision'',(a->>''revision'')::integer+1);end if;
  end if;
  if b<>a then insert into eflow_r9.staffing_removals values(pg_catalog.pg_current_xact_id(),auth.uid(),p_project,p_office,p_user,p_request,p_fingerprint,r.relation_name,(a->>''id'')::uuid,a,b);end if;
 end loop;
 insert into eflow_r9.mutations values(txid_current(),p_project);
 for r in select * from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id() order by relation_name,row_id loop
  if r.relation_name=''subtasks'' then
   update public.subtasks set assigned_to=(r.after_row->>''assigned_to'')::uuid,
    assigned_to_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->''assigned_to_ids'') x),lead_id=(r.after_row->>''lead_id'')::uuid where id=r.row_id;
  elsif r.relation_name=''personal_subtasks'' then
   update public.personal_subtasks set assigned_to_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->''assigned_to_ids'') x),lead_id=(r.after_row->>''lead_id'')::uuid where id=r.row_id;
  elsif r.relation_name=''tasks'' then
   update public.tasks set assigned_to=(r.after_row->>''assigned_to'')::uuid,recommendation_lead_id=(r.after_row->>''recommendation_lead_id'')::uuid,
    assignee_name=r.after_row->>''assignee_name'',team_member_ids=array(select x::uuid from jsonb_array_elements_text(r.after_row->''team_member_ids'') x),
    team_member_names=array(select x from jsonb_array_elements_text(r.after_row->''team_member_names'') x) where id=r.row_id;
  else
   update public.personal_tasks set lead_id=(r.after_row->>''lead_id'')::uuid,revision=(r.after_row->>''revision'')::integer where id=r.row_id;
  end if;
 end loop;
 -- Verify the persisted rows too, including any trigger effects. An unexpected
 -- side effect rolls back the entire removal, membership, audit and receipt.
 for r in select * from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id() loop
  execute format(''select to_jsonb(t)-''''updated_at'''' from public.%I t where id=$1'',r.relation_name) into b using r.row_id;
  if b is distinct from r.after_row then raise exception ''Member removal changed protected work facts'' using errcode=''42501'',
   detail=r.relation_name||'': ''||(select string_agg(k,'', '' order by k) from jsonb_object_keys(r.after_row) k where r.after_row->k is distinct from b->k);end if;
 end loop;
 delete from eflow_r9.staffing_removals where tx=pg_catalog.pg_current_xact_id();
 delete from eflow_r9.mutations where tx=txid_current() and project_id=p_project;
 insert into eflow_r7.tree_state(root_id,revision) select id,2 from public.tasks where linked_project_id=p_project and org_id=p_office
  union all select id,2 from public.personal_tasks where project_id=p_project on conflict(root_id) do update set revision=eflow_r7.tree_state.revision+1;
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,auth.uid(),''assignments_cleared'',v);
end $$;',chr(13)||chr(10),chr(10)),
replace('revoke all on function eflow_r9.staffing_removal_allowed(text,jsonb,jsonb),eflow_r9.guard_staffing_removal(),eflow_r9.lock_removal_work(uuid,uuid),eflow_r9.clear_removed_staff(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('do $$declare d text;n text;begin
 select pg_get_functiondef(''eflow_r9.remove_person(uuid,uuid,uuid,text,uuid)''::regprocedure) into d;
 if strpos(d,''/* NW5.1 confirmed staffing */'')=0 then
  if strpos(d,''v:=eflow_r9.preview(p_project,p_user,p_office);'')=0 or strpos(d,''perform eflow_r9.clear_staff(p_project,p_user,p_office);'')=0 then raise exception ''Unexpected R9 removal definition'';end if;
  d:=replace(d,''v:=eflow_r9.preview(p_project,p_user,p_office);'',''/* NW5.1 confirmed staffing */ perform eflow_r9.lock_removal_work(p_project,p_office); v:=eflow_r9.preview(p_project,p_user,p_office);'');
  d:=replace(d,''perform eflow_r9.clear_staff(p_project,p_user,p_office);'',''perform eflow_r9.clear_removed_staff(p_project,p_user,p_office,p_request,p_fingerprint);'');execute d;
 end if;
 select pg_get_functiondef(''public.guard_subtask_mutation()''::regprocedure) into d;
 if strpos(d,''/* NW5.1 exact R9 UPDATE */'')=0 then
  d:=overlay(d placing ''begin /* NW5.1 exact R9 UPDATE */ if tg_op=''''UPDATE'''' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;'' from strpos(lower(d),''begin'') for 5);execute d;
 end if;
 -- These existing INVOKER triggers otherwise reroute/revalidate historical
 -- reviewer metadata merely because a current staffing column is updated.
 -- Keep their normal routing/validation bodies and invoker security unchanged.
 -- API roles cannot execute the predicate; nested IF avoids calling it at all
 -- in their direct writes. Other definer RPCs have no exact removal capability.
 foreach n in array array[''public.route_organization_leadership_review()'',''public.validate_task_reviewers()''] loop
  select pg_get_functiondef(n::regprocedure) into d;
  if strpos(d,''/* NW5.1 preserve historical reviewers */'')=0 then
   d:=overlay(d placing ''begin /* NW5.1 preserve historical reviewers */ if tg_op=''''UPDATE'''' then if pg_catalog.has_function_privilege(current_user,''''eflow_r9.staffing_removal_allowed(text,jsonb,jsonb)'''',''''EXECUTE'''') then if eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then return new;end if;end if;end if;'' from strpos(lower(d),''begin'') for 5);execute d;
  end if;
 end loop;
 -- The existing AFTER staffing hook normally rebuilds channel membership.
 -- In a removal it must clear only the departing person''s derived current
 -- task access, retaining other participants and all chat/activity history.
 select pg_get_functiondef(''public.sync_task_chat_channel()''::regprocedure) into d;
 if strpos(d,''/* NW5.1 current chat access only */'')=0 then
  d:=overlay(d placing ''begin /* NW5.1 current chat access only */ if tg_op=''''UPDATE'''' and eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then delete from public.chat_channel_members c using public.chat_channels h,eflow_r9.staffing_removals m where c.channel_id=h.id and h.task_id=new.id and m.tx=pg_catalog.pg_current_xact_id() and m.relation_name=tg_table_name and m.row_id=new.id and c.user_id=m.removed_user;return new;end if;'' from strpos(lower(d),''begin'') for 5);execute d;
 end if;
 foreach n in array array[''tasks'',''subtasks'',''personal_tasks'',''personal_subtasks''] loop
  execute format(''drop trigger if exists a0_nw51_staffing_boundary on public.%I'',n);
  execute format(''create trigger a0_nw51_staffing_boundary before insert or update or delete on public.%I for each row execute function eflow_r9.guard_staffing_removal()'',n);
 end loop;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261010175812_nested_work_checked_confirmation.sql; SHA256 43b0c624ae81fda5b59398f00ce1a4b0f96f61ff934a8c8be261ccd3e4c31708

set local lock_timeout=''10s'';',chr(13)||chr(10),chr(10)),
replace('-- Resolve all canonical and historical fallback links. No caller-controlled
-- relation names or dynamic lookup paths are accepted by this resolver.
create or replace function eflow_r7.history_roots(p_row jsonb) returns uuid[]
language sql stable security definer set search_path='''' as $$
 with links as (
  select nullif(p_row->>''task_id'','''')::uuid id
  union select nullif(p_row->>''root_id'','''')::uuid
  union select task_id from public.subtasks where id=nullif(p_row->>''subtask_id'','''')::uuid
  union select task_id from public.subtask_submissions where id=nullif(p_row->>''submission_id'','''')::uuid
  union select task_id from public.task_submissions where id=nullif(p_row->>''submission_id'','''')::uuid
  union select task_id from public.work_budget_allocations where id=nullif(p_row->>''allocation_id'','''')::uuid
  union select a.task_id from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id
   where l.id=any(array[nullif(p_row->>''allocation_line_id'','''')::uuid,nullif(p_row->>''parent_allocation_line_id'','''')::uuid])
  union select c.task_id from public.petty_cash_requests c where c.id=any(array[nullif(p_row->>''request_id'','''')::uuid,nullif(p_row->>''petty_cash_request_id'','''')::uuid])
  union select a.task_id from public.petty_cash_requests c join public.work_budget_allocations a on a.id=c.allocation_id
   where c.id=any(array[nullif(p_row->>''request_id'','''')::uuid,nullif(p_row->>''petty_cash_request_id'','''')::uuid])
  union select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id
   where l.id=nullif(p_row->>''liquidation_id'','''')::uuid
  union select c.task_id from public.petty_cash_receipts r join public.petty_cash_liquidations l on l.id=r.liquidation_id
   join public.petty_cash_requests c on c.id=l.request_id where r.id=nullif(p_row->>''receipt_id'','''')::uuid
 ) select coalesce(array_agg(distinct id order by id) filter(where id is not null),''{}''::uuid[]) from links
$$;',chr(13)||chr(10),chr(10)),
replace('-- Advisory precedes explicit project/completion/root/node row locks in RPCs.
-- The real completion-version write also rejects old repeatable-read snapshots.
create or replace function eflow_r7.lock_impact(p_root uuid) returns void
language plpgsql security definer set search_path='''' as $$
declare r jsonb:=eflow_r7.root(p_root);pid uuid;
begin
 if r is null then return;end if;pid:=(r->>''project'')::uuid;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''r9:''||pid::text,0));
 perform 1 from public.projects where id=pid for update;
 perform 1 from public.personal_projects where id=pid for update;
 perform eflow_r7.lock_completion(p_root);
 perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 perform 1 from public.subtasks where task_id=p_root order by id for update;
 perform 1 from public.personal_subtasks where task_id=p_root order by id for update;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.serialize_history() returns trigger
language plpgsql security definer set search_path='''' as $$
declare roots uuid[]:=''{}'';root_id uuid;r jsonb;row_data jsonb;
begin
 if tg_op<>''INSERT'' then roots:=roots||eflow_r7.history_roots(to_jsonb(old));end if;
 if tg_op<>''DELETE'' then roots:=roots||eflow_r7.history_roots(to_jsonb(new));end if;
 -- Direct writes already hold their target tuple when a row trigger runs.
 -- Take the advisory and real version lock without acquiring unrelated nodes:
 -- opposite tuple/advisory order may abort with a deadlock, never bypass safety.
 for root_id in select distinct x from unnest(roots) x order by x loop
  r:=eflow_r7.root(root_id);
  if r is not null then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''r9:''||(r->>''project''),0));
   perform eflow_r7.lock_completion(root_id);
  end if;
 end loop;
 if tg_op=''DELETE'' then return old;else return new;end if;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- BEFORE guards, including evidence sealing and AFTER financial audit producers.
-- No policies/permissions/financial or evidence validation are replaced.
do $$declare rel text;begin
 foreach rel in array array[
 ''public.subtask_progress_updates'',''public.subtask_submissions'',''public.subtask_submission_attachments'',
 ''public.task_submissions'',''public.task_attachments'',''eflow_evidence.attempts'',''eflow_evidence.objects'',
 ''public.work_budget_allocations'',''public.work_budget_allocation_lines'',''public.petty_cash_requests'',
 ''public.petty_cash_request_lines'',''public.petty_cash_releases'',''public.petty_cash_liquidations'',''public.petty_cash_receipts'',
 ''public.petty_cash_receipt_items'',''public.petty_cash_request_attachments'',''public.budget_ledger_entries'',''public.work_tree_events''
 ] loop
  if pg_catalog.to_regclass(rel) is null then raise exception ''Required NW5.2 writer relation missing: %'',rel;end if;
  execute pg_catalog.format(''drop trigger if exists a_nw52_history_serialization on %s'',rel);
  execute pg_catalog.format(''create trigger a_nw52_history_serialization before insert or update or delete on %s for each row execute function eflow_r7.serialize_history()'',rel);
 end loop;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Fingerprint rows stay private. Conservatively include the entire root''s
-- current topology and root-linked history: independent sibling history may
-- require another preview, but does not become a branch eligibility blocker.
create or replace function eflow_r7.impact_fingerprint(p_root uuid,p_command text,p_payload jsonb,p_impact jsonb)
returns text language plpgsql security definer set search_path='''' as $$
declare facts jsonb;history jsonb:=''{}'';rel text;rows jsonb;
begin
 facts:=jsonb_build_object(''root'',eflow_r7.root(p_root),''nodes'',(select coalesce(jsonb_agg(to_jsonb(n) order by id),''[]'') from eflow_r7.nodes n where task_id=p_root),
  ''office_root'',(select to_jsonb(t) from public.tasks t where id=p_root),''personal_root'',(select to_jsonb(t) from public.personal_tasks t where id=p_root),
  ''office_nodes'',(select coalesce(jsonb_agg(to_jsonb(n) order by id),''[]'') from public.subtasks n where task_id=p_root),
  ''personal_nodes'',(select coalesce(jsonb_agg(to_jsonb(n) order by id),''[]'') from public.personal_subtasks n where task_id=p_root),
  ''snapshot'',eflow_r7.snapshot(p_root),''impact'',p_impact,''command'',p_command,''payload'',p_payload);
 foreach rel in array array[
 ''public.subtask_progress_updates'',''public.subtask_submissions'',''public.subtask_submission_attachments'',
 ''public.task_submissions'',''public.task_attachments'',''eflow_evidence.attempts'',''eflow_evidence.objects'',
 ''public.work_budget_allocations'',''public.work_budget_allocation_lines'',''public.petty_cash_requests'',
 ''public.petty_cash_request_lines'',''public.petty_cash_releases'',''public.petty_cash_liquidations'',''public.petty_cash_receipts'',
 ''public.petty_cash_receipt_items'',''public.petty_cash_request_attachments'',''public.budget_ledger_entries'',''public.work_tree_events''
 ] loop
  execute pg_catalog.format(''select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),''''[]''''::jsonb) from %s x where $1=any(eflow_r7.history_roots(to_jsonb(x)))'',rel) into rows using p_root;
  history:=history||jsonb_build_object(rel,rows);
 end loop;
 return pg_catalog.encode(extensions.digest((facts||jsonb_build_object(''history'',history))::text,''sha256''),''hex'');
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.work_path(p_root uuid,p_node uuid) returns jsonb
language plpgsql stable security definer set search_path='''' as $$
declare result jsonb:=''[]'';n eflow_r7.nodes;depth integer:=0;
begin
 while p_node is not null loop
  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
  if not found or depth>=8 then raise exception ''Choose a valid path in this root'' using errcode=''23514'';end if;
  result:=jsonb_build_array(n.title)||result;p_node:=n.parent_subtask_id;depth:=depth+1;
 end loop;return result;
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='''' as $$
declare r jsonb;current_revision integer;impact jsonb;snapshot jsonb;cap jsonb;codes jsonb:=''[]'';
 target uuid;parent uuid;action text;before_path jsonb:=''[]'';after_path jsonb:=''[]'';allowed boolean;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''Work access denied'' using errcode=''42501'';end if;
 perform eflow_r7.lock_impact(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''Work access denied'' using errcode=''42501'';end if;
 if p_command not in (''create'',''staff'',''edit'',''move'',''delete'',''order'',''contributors'',''root_lead'',''progress'',''submit'',''review'') or p_command is null
  or p_payload is null or jsonb_typeof(p_payload)<>''object'' or exists(select 1 from jsonb_object_keys(p_payload) k where k not in (''id'',''parent'',''lead'',''people'',''title'',''due'',''standalone'',''order'',''note'',''progress'',''approve'')) then
  raise exception ''Invalid work command or payload'' using errcode=''22023'';end if;
 target:=nullif(p_payload->>''id'','''')::uuid;parent:=nullif(p_payload->>''parent'','''')::uuid;
 r:=eflow_r7.root(p_root);snapshot:=eflow_r7.snapshot(p_root);current_revision:=(snapshot->>''revision'')::integer;
 if p_revision is null or p_revision<>current_revision then raise exception ''Work changed; reload and review the impact again'' using errcode=''40001'';end if;
 action:=case p_command when ''create'' then ''create_child'' when ''order'' then ''order_children'' when ''root_lead'' then ''appoint_lead''
  when ''contributors'' then ''manage_contributors'' when ''staff'' then case when (p_payload->>''lead'')::uuid is distinct from (select lead_id from eflow_r7.nodes where id=target and task_id=p_root) then ''appoint_lead'' else ''manage_contributors'' end
  when ''edit'' then ''edit_details'' when ''progress'' then ''execute'' else p_command end;
 if p_command in (''root_lead'',''contributors'') or p_command in (''create'',''order'') and parent is null then cap:=snapshot->''root''->''capabilities''->action;
 else select x->''capabilities''->action into cap from jsonb_array_elements(snapshot->''nodes'') x where x->>''id''=coalesce(case when p_command in (''create'',''order'') then parent else target end::text,'''');end if;
 allowed:=coalesce((cap->>''allowed'')::boolean,false);
 if p_command in (''progress'',''submit'',''review'') and r->>''kind''<>''personal'' then allowed:=false;cap:=jsonb_build_object(''reason_code'',''branch_denied'');end if;
 if not allowed then codes:=jsonb_build_array(coalesce(cap->>''reason_code'',''branch_denied''));end if;
 -- Do not collect private history or paths on an unauthorized branch/action.
 if allowed then
  impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);
  if not (impact->>''allowed'')::boolean then allowed:=false;codes:=jsonb_build_array(case when impact->''blocker_codes'' ? ''lifecycle_blocked'' then ''lifecycle_blocked'' else ''history_blocked'' end);end if;
  if p_command=''move'' and not eflow_r7.manage(p_root,parent) then allowed:=false;codes:=jsonb_build_array(''branch_denied'');end if;
  if target is not null and p_command<>''create'' then before_path:=eflow_r7.work_path(p_root,target);end if;
  after_path:=case when p_command=''delete'' then ''[]''::jsonb when p_command in (''move'',''create'') then eflow_r7.work_path(p_root,parent)||jsonb_build_array(coalesce(p_payload->>''title'',(select title from eflow_r7.nodes where id=target and task_id=p_root),''New subitem'')) else before_path end;
 end if;
 return jsonb_build_object(''root_id'',p_root,''expected_revision'',p_revision,''current_revision'',current_revision,''command'',p_command,''allowed'',allowed,''blocker_codes'',codes,
  ''selected_count'',coalesce((impact->>''selected_count'')::integer,0),''descendant_count'',coalesce((impact->>''descendant_count'')::integer,0),
  ''affected_appointment_count'',coalesce((impact->>''affected_appointment_count'')::integer,0),''before_path'',before_path,''after_path'',after_path,
  ''fingerprint'',case when impact is null then pg_catalog.md5(jsonb_build_object(''root'',p_root,''actor'',auth.uid(),''revision'',current_revision,''command'',p_command,''payload'',p_payload,''codes'',codes)::text)
   else eflow_r7.impact_fingerprint(p_root,p_command,p_payload,impact) end);
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function eflow_r7.checked_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text)
returns jsonb language plpgsql security definer set search_path='''' as $$
declare receipt eflow_r7.receipts;impact jsonb;terms jsonb;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''Work access denied'' using errcode=''42501'';end if;
 if p_request is null then raise exception ''Work request identity required'' using errcode=''22023'';end if;
 perform eflow_r7.lock_impact(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''Work access denied'' using errcode=''42501'';end if;
 terms:=jsonb_build_object(''command'',p_command,''payload'',p_payload);
 select * into receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.root_id<>p_root or receipt.payload<>terms then raise exception ''Request identity already used for different work'' using errcode=''23505'';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 impact:=eflow_r7.work_impact(p_root,p_revision,p_command,p_payload);
 if p_impact_fingerprint is null or p_impact_fingerprint is distinct from impact->>''fingerprint'' then
  raise exception ''Work impact changed; reload and review affected work before confirming again'' using errcode=''40001'';end if;
 if not (impact->>''allowed'')::boolean then raise exception ''This work operation is blocked: %; resolve affected work first'',impact->''blocker_codes'' using errcode=''42501'';end if;
 return eflow_r7.command(p_root,p_revision,p_request,p_command,p_payload);
end $$;',chr(13)||chr(10),chr(10)),
replace('create or replace function public.nw_work_impact(p_root uuid,p_revision integer,p_command text,p_payload jsonb) returns jsonb
language sql security invoker set search_path='''' as $$select eflow_r7.work_impact(p_root,p_revision,p_command,p_payload)$$;',chr(13)||chr(10),chr(10)),
replace('create or replace function public.nw_work_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb,p_impact_fingerprint text) returns jsonb
language sql security invoker set search_path='''' as $$select eflow_r7.checked_command(p_root,p_revision,p_request,p_command,p_payload,p_impact_fingerprint)$$;',chr(13)||chr(10),chr(10)),
replace('revoke all on function eflow_r7.history_roots(jsonb),eflow_r7.lock_impact(uuid),eflow_r7.serialize_history(),
 eflow_r7.impact_fingerprint(uuid,text,jsonb,jsonb),eflow_r7.work_path(uuid,uuid),eflow_r7.work_impact(uuid,integer,text,jsonb),
 eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text),public.nw_work_impact(uuid,integer,text,jsonb),
 public.nw_work_command(uuid,integer,uuid,text,jsonb,text) from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('grant execute on function eflow_r7.work_impact(uuid,integer,text,jsonb),eflow_r7.checked_command(uuid,integer,uuid,text,jsonb,text),
 public.nw_work_impact(uuid,integer,text,jsonb),public.nw_work_command(uuid,integer,uuid,text,jsonb,text) to authenticated;',chr(13)||chr(10),chr(10)),
replace('-- Writer preambles are appended below. Migration remains atomic.

do $$declare entry record;definition text;changed text;begin
 for entry in select * from (values
 (''eflow_r7.command(uuid,integer,uuid,text,jsonb)'',''perform eflow_r3.actor(); if not coalesce(eflow_r7.read_root(p_root),false) then raise exception ''''Work access denied'''' using errcode=''''42501'''';end if; perform eflow_r7.lock_impact(p_root);''),
 (''save_subtask_progress(uuid,integer,text,text,text,text,text,text)'',''perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));''),
 (''submit_subtask_for_review(uuid,jsonb)'',''perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));''),
 (''decide_subtask_review(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id));''),
 (''submit_task_for_review(uuid,jsonb)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''decide_task_review(uuid,boolean,text,text)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''create_subtask_budget_allocation(uuid,uuid,uuid,numeric,text)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''create_work_budget_allocation(uuid,uuid,numeric,text)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''eflow_budget.fund_work(uuid,integer,jsonb,text,uuid)'',''perform eflow_r7.lock_impact(p_task_id);''),
 (''eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)'',''perform eflow_r7.lock_impact(p_task);''),
 (''eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request));''),
 (''eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''cancel_contextual_cash_request(uuid,text)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''decide_petty_cash_leader_review(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''decide_petty_cash_request(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''schedule_petty_cash_releases(uuid,uuid)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''add_cash_request_attachment(uuid,text,text,text,bigint)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''submit_petty_cash_liquidation(uuid,numeric,text,jsonb)'',''perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));''),
 (''create_petty_cash_request(uuid,numeric,text,date)'',''perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));''),
 (''create_petty_cash_request(uuid,numeric,text,date,uuid)'',''perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));''),
 (''decide_work_budget_allocation(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));''),
 (''delete_subtask_budget_allocation(uuid)'',''perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_allocation_id));''),
 (''remove_subtask_budget_cap(uuid,text,uuid)'',''perform eflow_r7.lock_impact((select task_id from public.work_budget_allocations where id=p_cap_allocation_id));''),
 (''record_petty_cash_release_internal(uuid,text)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));''),
 (''acknowledge_petty_cash_release(uuid)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));''),
 (''record_accounting_petty_cash_release(uuid,text,text)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));''),
 (''override_accounting_petty_cash_release_schedule(uuid,text,text,text)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_releases r join public.petty_cash_requests c on c.id=r.request_id where r.id=p_release_id));''),
 (''decide_petty_cash_liquidation(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));''),
 (''decide_petty_cash_liquidation_leader_review(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));''),
 (''settle_accounting_liquidation(uuid,boolean,text)'',''perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));''),
 (''eflow_evidence.seal_file(text,uuid,uuid,text,text,uuid)'',''perform eflow_r7.lock_impact(p_task);''),
 (''claim_task_evidence_cleanup(text,text)'',''perform eflow_r7.lock_impact((select task_id from eflow_evidence.path_context(p_object_name)));'')
 ) as patches(signature,preamble) loop
  if pg_catalog.to_regprocedure(entry.signature) is null then raise exception ''Required NW5.2 writer missing: %'',entry.signature;end if;
  select pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(entry.signature)) into definition;
  changed:=pg_catalog.regexp_replace(definition,''\mbegin\M'',''begin /* NW5.2 shared writer lock */ ''||entry.preamble,''i'');
  if definition like ''%NW5.2 shared writer lock%'' then continue;end if;
  if changed=definition then raise exception ''Unexpected NW5.2 writer body: %'',entry.signature;end if;
  execute changed;
 end loop;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261011071015_nested_work_material_date_preview.sql; SHA256 6200c5ecff31e2032be121fe2f4ac7c6f76564c4e4b6d4b3a30d7a39c26f7f5d

set local lock_timeout=''10s'';',chr(13)||chr(10),chr(10)),
replace('-- Called only from the authorized preview under its existing impact lock.
-- Expose schedule facts and aggregate history counts, never evidence/finance rows.
create or replace function eflow_r7.date_impact(p_root uuid,p_payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='''' as $$
declare target uuid:=(p_payload->>''id'')::uuid;ids uuid[];n eflow_r7.nodes;a eflow_r7.nodes;
 r jsonb:=eflow_r7.root(p_root);old_due date;new_due date:=(p_payload->>''due'')::date;
 root_due date:=(r->>''due'')::date;ancestor_due date;old_bound date;new_bound date;
 cursor_id uuid;facts jsonb;items jsonb:=''[]'';material boolean:=false;bound_changed boolean;
begin
 ids:=eflow_r7.subtree_ids(p_root,target);
 select due_date into old_due from eflow_r7.nodes where id=target and task_id=p_root;
 if old_due is not distinct from new_due then
  return jsonb_build_object(''requires_date_confirmation'',false,''date_impact'',jsonb_build_object(''old_due'',old_due,''new_due'',new_due,''items'',''[]''::jsonb));
 end if;
 select parent_subtask_id into cursor_id from eflow_r7.nodes where id=target and task_id=p_root;
 ancestor_due:=root_due;
 while cursor_id is not null loop
  select * into a from eflow_r7.nodes where id=cursor_id and task_id=p_root;
  ancestor_due:=least(ancestor_due,a.due_date);cursor_id:=a.parent_subtask_id;
 end loop;
 -- Match existing canonical write constraints. Confirmation never overrides them.
 if new_due>ancestor_due then raise exception ''Child deadline cannot exceed an ancestor deadline'' using errcode=''23514'';end if;
 if exists(select 1 from eflow_r7.nodes where task_id=p_root and id=any(ids) and id<>target and due_date>new_due) then
  raise exception ''Edit descendant dates before shortening this deadline'' using errcode=''23514'';
 end if;
 for n in select * from eflow_r7.nodes where task_id=p_root and id=any(ids) order by id loop
  old_bound:=root_due;new_bound:=root_due;cursor_id:=n.id;
  while cursor_id is not null loop
   select * into a from eflow_r7.nodes where id=cursor_id and task_id=p_root;
   old_bound:=least(old_bound,a.due_date);
   new_bound:=least(new_bound,case when a.id=target then new_due else a.due_date end);
   cursor_id:=a.parent_subtask_id;
  end loop;
  facts:=eflow_r7.history_facts(p_root,array[n.id]);
  bound_changed:=n.id<>target and old_bound is distinct from new_bound;
  -- A changed inherited bound affects a child with no own deadline. Children
  -- whose earlier own deadline still governs do not alone make an edit material.
  -- Recorded work/commitments in this schedule scope also require review.
  material:=material or bound_changed or not (facts->>''untouched'')::boolean;
  if n.id=target or bound_changed or not (facts->>''untouched'')::boolean then
   items:=items||jsonb_build_array(jsonb_build_object(''id'',n.id,''path'',eflow_r7.work_path(p_root,n.id),
    ''old_bound'',old_bound,''new_bound'',new_bound,''bound_changed'',bound_changed,''history_counts'',facts->''counts''));
  end if;
 end loop;
 return jsonb_build_object(''requires_date_confirmation'',material,''date_impact'',jsonb_build_object(''old_due'',old_due,''new_due'',new_due,''items'',items));
end $$;',chr(13)||chr(10),chr(10)),
replace('revoke all on function eflow_r7.date_impact(uuid,jsonb) from public,anon,authenticated,service_role;',chr(13)||chr(10),chr(10)),
replace('-- Keep the existing RPC signatures, authorization, locks, opaque fingerprint,
-- denied-branch redaction and checked transaction/receipt logic byte-for-byte.
do $$declare definition text;changed text;begin
 select pg_catalog.pg_get_functiondef(''eflow_r7.work_impact(uuid,integer,text,jsonb)''::regprocedure) into definition;
 if definition like ''%date_impact jsonb:=''''{}'''';%'' then return;end if;
 changed:=replace(definition,''allowed boolean;'',''allowed boolean;date_impact jsonb:=''''{}'''';'');
 changed:=replace(changed,''impact:=eflow_r7.operation_impact(p_root,p_command,p_payload);'',
  ''impact:=eflow_r7.operation_impact(p_root,p_command,p_payload); if p_command=''''edit'''' and p_payload ? ''''due'''' then date_impact:=eflow_r7.date_impact(p_root,p_payload);end if;'');
 changed:=replace(changed,''return jsonb_build_object(''''root_id'''',p_root,'',''return date_impact||jsonb_build_object(''''root_id'''',p_root,'');
 if changed=definition or changed not like ''%date_impact jsonb%'' or changed not like ''%return date_impact||%'' then
  raise exception ''Unexpected NW5.2 preview body; inspect before extending'';
 end if;
 execute changed;
end $$;',chr(13)||chr(10),chr(10)),
replace('-- Accepted 20261012231500_nested_work_activity_projection.sql; SHA256 c9bac7d726bf10b33fa35b0f3b8fb2e451635cb19971234dab91ca679b3a55eb
-- NW9.6 separately reviewed additive projection slice; local and undeployed.
-- Appends only recorded work-event metadata. Existing columns, kinds, source
-- policies, invoker security, RPC, expiry and bounded reads remain unchanged.
create or replace view eflow_r11.events with (security_invoker=true) as
select p.id project_id, ''audit:''||a.id event_id, ''project''::text kind,
 replace(replace(a.action,''.'','' ''),''_'','' '') title,
 coalesce(nullif(a.reason,''''),replace(a.entity_type,''_'','' '')||'' update'') detail,
 coalesce(nullif(a.actor_name,''''),''System'') actor_name, a.created_at occurred_at,
 case when a.entity_type=''task'' then t.id end task_id, null::jsonb as work_event
from public.audit_events a
join public.projects p on a.entity_id=p.id::text
 or exists(select 1 from public.tasks x where x.linked_project_id=p.id and x.id::text=a.entity_id)
 or exists(select 1 from public.milestones m where m.project_id=p.id and m.id::text=a.entity_id)
left join public.tasks t on t.id::text=a.entity_id
union all
select t.linked_project_id,''status:''||s.id,''status'',''Task moved to ''||replace(s.to_status,''_'','' ''),coalesce(nullif(s.note,''''),''Status updated''),coalesce(nullif(s.actor_name,''''),''System''),s.created_at,t.id, null::jsonb as work_event
from public.task_status_history s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,''progress:task:''||s.id,''progress'',''Task progress updated'',coalesce(nullif(s.blocker,''''),nullif(s.note,''''),nullif(s.next_step,''''),s.percent_complete::text||''% complete'',''Progress recorded''),s.author_name,s.created_at,t.id, null::jsonb as work_event
from public.task_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,''progress:subtask:''||s.id,''progress'',''Subtask progress updated'',coalesce(nullif(s.blocker,''''),nullif(s.note,''''),nullif(s.next_step,''''),s.percent_complete::text||''% complete''),s.author_name,s.created_at,t.id, null::jsonb as work_event
from public.subtask_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,''submission:task:''||s.id,''submission'',''Task submitted for review'',''Attempt ''||s.version||'' · ''||s.note,s.submitter_name,s.submitted_at,t.id, null::jsonb as work_event
from public.task_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,''decision:task:''||s.id,''submission'',''Task ''||replace(s.status,''_'','' ''),coalesce(s.decision_feedback,''Attempt ''||s.version),coalesce(s.decided_by_name,''Reviewer''),s.decided_at,t.id, null::jsonb as work_event
from public.task_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select t.linked_project_id,''submission:subtask:''||s.id,''submission'',''Subtask submitted for review'',''Attempt ''||s.version||'' · ''||s.note,s.submitter_name,s.submitted_at,t.id, null::jsonb as work_event
from public.subtask_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,''decision:subtask:''||s.id,''submission'',''Subtask ''||replace(s.status,''_'','' ''),coalesce(s.decision_feedback,''Attempt ''||s.version),coalesce(s.decided_by_name,''Reviewer''),s.decided_at,t.id, null::jsonb as work_event
from public.subtask_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select e.project_id,''work:''||e.id,case when e.command=''progress'' then ''progress'' when e.command in (''submit'',''review'') then ''submission'' else ''project'' end,replace(e.command,''_'','' ''),
 coalesce((select n->>''title'' from jsonb_array_elements(coalesce(e.after_data->''nodes'',''[]'')||coalesce(e.before_data->''nodes'',''[]'')) n where n->>''id''=e.node_id::text limit 1),''Root task people''),e.actor_name,e.occurred_at,e.root_id, jsonb_build_object(''id'',e.id,''root_id'',e.root_id,''node_id'',e.node_id,''command'',e.command,''actor_name'',e.actor_name,''occurred_at'',e.occurred_at,''before_data'',e.before_data,''after_data'',e.after_data) as work_event
from public.work_tree_events e
union all
select e.project_id,''personal:''||e.id,case when e.command=''progress_task'' then ''progress'' when e.command in (''submit_task'',''review_task'') then ''submission'' else ''project'' end,replace(e.command,''_'','' ''),coalesce(nullif(e.payload->>''note'',''''),nullif(e.payload->>''title'',''''),''Personal project work change''),p.full_name,e.occurred_at,null::uuid, null::jsonb as work_event
from public.personal_work_events e left join public.profiles p on p.id=e.actor_id;',chr(13)||chr(10),chr(10)),
replace('DO $nw11_postconditions$ DECLARE nw11_metadata jsonb; BEGIN
 select metadata into nw11_metadata from (select q.metadata||jsonb_build_object(''column_attributes'',(select coalesce(jsonb_agg(jsonb_build_object(
 ''schema'',n.nspname,''table'',c.relname,''column'',a.attname,
 ''type'',pg_catalog.format_type(a.atttypid,a.atttypmod),''not_null'',a.attnotnull,
 ''identity'',a.attidentity::text,''generated'',a.attgenerated::text,
 ''default'',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 ''collation_schema'',cn.nspname,''collation_name'',co.collname)
 order by n.nspname,c.relname,a.attnum),''[]''::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in (''r'',''v'',''m'')
 and (n.nspname=''public'' or n.nspname like ''eflow_%''))) metadata from (select jsonb_build_object(
''captured_at_utc'',now(),
''migrations'',(select jsonb_agg(jsonb_build_object(''version'',version,''name'',name,''statements'',statements) order by version) from supabase_migrations.schema_migrations),
''functions'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',p.proname,''identity_arguments'',pg_get_function_identity_arguments(p.oid),''arguments'',pg_get_function_arguments(p.oid),''returns'',pg_get_function_result(p.oid),''definition'',pg_get_functiondef(p.oid),''body'',p.prosrc,''security_definer'',p.prosecdef,''config'',p.proconfig,''acl'',p.proacl,''owner'',pg_get_userbyid(p.proowner),''anon_execute'',has_function_privilege(''anon'',p.oid,''execute''),''authenticated_execute'',has_function_privilege(''authenticated'',p.oid,''execute''),''service_role_execute'',has_function_privilege(''service_role'',p.oid,''execute'')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind=''f'' and (n.nspname=''public'' or n.nspname like ''eflow_%'') and not exists(select 1 from pg_depend d where d.classid=''pg_proc''::regclass and d.objid=p.oid and d.deptype=''e'')),
''tables'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',c.relname,''kind'',c.relkind,''rls'',c.relrowsecurity,''forced_rls'',c.relforcerowsecurity,''options'',c.reloptions,''acl'',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname=''public'' or n.nspname like ''eflow_%'' or n.nspname=''storage'') and c.relkind in (''r'',''v'',''m'')),
''columns'',(select jsonb_agg(jsonb_build_object(''schema'',table_schema,''table'',table_name,''column'',column_name,''type'',data_type,''udt'',udt_name,''nullable'',is_nullable,''default'',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema=''public'' or table_schema like ''eflow_%'' or table_schema=''storage''),
''constraints'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',co.conname,''definition'',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' or n.nspname like ''eflow_%''),
''triggers'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',t.tgname,''enabled'',t.tgenabled,''definition'',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname=''public'' or n.nspname like ''eflow_%'')),
''policies'',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname=''public'' or p.schemaname like ''eflow_%'' or p.schemaname=''storage''),
''bucket_configuration'',(select jsonb_agg(jsonb_build_object(''id'',id,''public'',public,''file_size_limit'',file_size_limit,''allowed_mime_types'',allowed_mime_types) order by id) from storage.buckets where id in(''project-library'',''task-attachments''))
) as metadata) q) q;
 if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''4c0537f40b9b9f4cab24a2f3c2d8cfeefe85e3117c13b61eaed9bda2b4a71665'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''7f6c4537126c3acf2d9b6bbe4dc399cab3fca1e47513837ac20dfc56b360d63c'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''c45c81e0334881f6ea1fe2a72a035ed7f81c66d177ca305f5291dcfc8fbd46e7'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''411dead4027fba7ab7d9e2ee056d08115b5c25e9c7d2f37a858e8ec6af8f9f23'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''c1dc43c1674e1bf086736fe0b9b0dfe4e218a351e8b7446ec31b1a3743b4b445'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''864abdf49624312adc001d67f3a3970ffa4e320c4ce19961e18ed3f9b8a61ddc'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''666e14f31bbf7b2ed9b65b939a5ee0802da0a48b4e07dca7fbb5c33be38057af'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''fc09ecfe9b8f3b21daa6b0babcf8af36ad9fc51e9f0be98a58f18f34ebfdd842'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d83d2ea720661fe13b7b84ac36ce36648e0536441658779dc188a0804e04dd1d'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''3689ad0548b2b45030a08d0f4e92997a862f40b04fbc6b53da604cd89588aec1'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''33eaafdd7e0ef782dc68d6637119a1ac4cb91d9a6bf2c7b12c76dfbe8a593377'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''40cb803f48175f9425871f22333ebf3a4beac6cb277ae6cb04ffb8106ea90be8'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''b5069827bb979a7dd2f46c12645e7ea67dbdde5cae1726aae06afba0bafe4241'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''573a6791387a2044ef60dd3d78bcbe0bf2b2a7ac2b532f194dc277dfe209fc82'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''f8fa27ef2f7a007ae407485b73f5128aea272e869ec250685f954313bc52d04d'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''f758c0a7f7834ff5e70b440148b9eda18afeafbfdecda0be10fbf2f8b2279e5e'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d3691c14170abfc3cffb651494f9b82033abea9cea645be1e47815a695da693e'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''f032192e13d08172e4b4c56de6addbf29b10f4aa6c8fb6e8fcc3e6ac61bc69b3'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''9f4ba38308ee23591930c5a525c0696522487519e244323f7b3d7835b34abe1a'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''359262e3f8a85d8b111becb4c70107f4a4531973734c78467f78d663eebd51f7'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''896e04cb6aac59b6c3815a55dbda14a483f9564b0fbe30ab0c75acea7c507911'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''663aabd8ecdfaf61512c3553eff2f80ff1b75e8e0e722a5cfe3029de642ecd29'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''91355d17290d04f54512dc571c2d0431d6774b267d8270b8bfa5e36f94078864'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''8fd71e304f8208c5363ca2e826c85eb04a6c3420efcf4bd1e788080c64d67ea9'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''8f1b12cb9448611ad98538fdbdb2c5a58f1b5f57f43f289e8e0a2e43f0e10779'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"serialize_history","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''3b1b56584947ded40a803c36229795b9fa66448e23b73dcc7b645e81e1efd324'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"serialize_history","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''27aeee18976cd8923aaf49660b04984ce4c3686991be8e10363d842f41597125'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''01f74d98e0172fbdddf5abf07bebb46de0b695f9e07e25faf79f436970381139'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''50a29b61d63e3fcc8c7e33761e2ef4ef95d1d3c64e76bfee2977074f75c6c10d'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''b63afb27b9cd5dbcaa0feeb098d8dc834242f20a658254297ccc176508ff5e7e'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''2c0c7436f038aa86164904fe7fd9167ee03cff728e3c587a24683c888ef8253a'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''f6e82dd29f2c4582ee60c1a77ce1b2a7331548e854ffc945ab71ddc2bab0a1db'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d8c9d533fe39ff441dcb68e6cf751c0025c00abab2cc58091fc03ae757aa6f9a'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''38a91854510a3780653eb6b82c78e17e4196cd022af1f5fb5bea4c0adb69d999'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''3c5124f285474c4eabe082ff021cb34dcfeed9041680ee2cf2904899687be5bc'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''029d3500f158386f635164fa9dbca6d8cb5653c2e517fbdcc7399cab0c87ae6b'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''a1af37a73a0209ef0b6876d34b02a6e82b3a169f690d462410cb0fcf815cf4ae'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''085af80daf2e554f89eed097358831e3b6cba56d18dc0bf5b03dcb1179a47f14'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''e832c02cda1088772dc419e319ca7a32f0c33584be5b3ff36e53e69567bf1f58'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''be23aeb1c770926670cae4a7511274d00959d47940e5ce948ed85d32dc24280a'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d23c3ccba7c09e4314b5ef0fcf7042fd1417e98bc23ebeabcb9df6f0683882ef'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''8b3e6b3e9d106af500296fb744e2f69458b90e04db5a82d755535fd9d8d80150'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''68a8d78caab330bae35772453e1ce0b553d911d613933930ef3f5d73b63ab52a'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''25517e7f761de8698cc99633d0e3e19830e2f94f7421b85c81c58feea3b66776'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''ab642e28e9a4ca909b0cd33200502c20fb757836641b6f71b1553dd698eb117c'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''83ddcfb8ef8e44f1bb362f4e27309cd6bfb6d6239aa14bb10b2ab34e0b2f73f1'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''55f1b4d857a41c4a2f638042d81f5520f3187f5fc669f50a19046e53ea1bce36'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''e3ec556cd6e3a7fa39d79cb3a498f9a6871f1891b7cbfde9501cc7e32d48323f'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''a9cbc7be9712483cd1c40aeb8ee640462b9cbde5481dd90258552cd38d9a70f5'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''80beef550dda06d18fc6c8176046dbac92c84718653307ff6b05a555e8a5b505'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''f63990d39c6fb9d8a0381877c66806a230a096d7840596cd050d4f54c9ce39eb'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''7f220e2a2cd65f7a075436fab36c51de22d0947908eb9cb35c68831d39214ecc'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d167daca1aefb10447cb1d57413184678a96168120c9e66929f0667e4a1607a1'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"guard_subtask_mutation","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''3ff572acad31abd73243a91de39a6195172403a02883695a524c47724b737b67'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"guard_subtask_mutation","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d06741da514a5f13cdf5e94d9adf0e5d3f9f8b8850caf224e63d59d97134cd1a'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''ee072f4c7a602ca982f20563398386ddbac7763c6166539075a0ecf115f42cc9'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''ed1a8de072aad3df894dbed4192e4b4be415a509719f0992a07b204551743078'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''47f4ee197493c78315a030c4b4813894e249cbcda4a17e46dbe641cac8f2d1d4'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''d343f28d1981ac5077769391236d02eec31b1d07b3cfef73e52d90ef5b263d96'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''de6fcd9a79ff2475b3c58e0d45935f86e4ee58e1512592fbe60f093c0d1a6c16'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''8a7e9a1bfe40afa854cb8def622d71b6e0002f61838d37a37d9a04ce57b1da57'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"route_organization_leadership_review","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''8359ea836a614fc35cdaa70e051beb82c5de5b15c58c5defa5940f4af631e203'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"route_organization_leadership_review","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''31f2c93f9a25a4b91d962dca4d2f6b901910fc9988042c4bd90081f19d29eb20'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''89743665ca8e77a399f147140aef3e4e91678de8d312b0263dacac60f2ca1408'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''12e07f82cdf66f19b78a5bdc8f7575c03feb7affaddca05f41ed9f08e41f4c01'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''47862df185e0956bb07ccab5e238eeaadf0a715f5b3d6940d4b24f803230cf80'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''1e4010bad44ec7d116c17b1b33f35467b7f84adb01941413874b10c56b31bb37'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''007e3c85318a3242104ce6cfaf560c1845e453c5a0adfa4b5979211dac008ebc'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''6a08203374abc4dedfc9d96392b9c2f371f8fccd500cd4c5b6a42e6098dd516c'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''3f134cee2fff7d5ce35e12059db4094caed975a30cee2b075d8f7dd997a10b8d'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''7d57dd2c3aa18370742bed746967c7b91cad8a70f0b116ae638b95856f81d1a6'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"sync_task_chat_channel","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''4d5769d2a13a1a928ffdf4adad1c9264501def607c27f8020ccfc9ed89029463'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"sync_task_chat_channel","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''functions'') element where element @> ''{"schema":"public","name":"validate_task_reviewers","identity_arguments":""}''::jsonb and encode(pg_catalog.sha256(convert_to((case when element->''acl''=''null''::jsonb then jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))) else jsonb_set(jsonb_set(jsonb_set(element,''{definition}'',to_jsonb(replace(element->>''definition'',chr(13)||chr(10),chr(10)))),''{body}'',to_jsonb(replace(element->>''body'',chr(13)||chr(10),chr(10)))),''{acl}'',(select jsonb_agg(a order by a) from jsonb_array_elements(element->''acl'') a)) end)::text,''UTF8'')),''hex'')=''f392623898574b6dd24fa7e23db6663558d53ac1d24d0d12551a2e33f8a283cc'')<>1 then raise exception ''NW11 postcondition mismatch: functions {"schema":"public","name":"validate_task_reviewers","identity_arguments":""}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''tables'') element where element @> ''{"schema":"eflow_r7","name":"completion_locks"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''8aef89a63702bb98090dd69a4ac2dd86043d1e819452e442d294a5acf2ba54f4'')<>1 then raise exception ''NW11 postcondition mismatch: tables {"schema":"eflow_r7","name":"completion_locks"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''tables'') element where element @> ''{"schema":"eflow_r9","name":"staffing_removals"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''762c637c407d47ce4a0c583748b7c069569ac5b4c56e3a47b8a55bea701b4da9'')<>1 then raise exception ''NW11 postcondition mismatch: tables {"schema":"eflow_r9","name":"staffing_removals"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r11","table":"events","column":"work_event"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''94ae44f7c83dc83b49bceee88fb72416a25bd92995edd29c71ab9eeea87b34d5'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r11","table":"events","column":"work_event"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"root_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''2c94528624e87eb45acf8ff79a0132cde7f86be04540f05123c8e23292aaa82d'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"root_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"version"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''0711cea53d924525db0246de80590168e6f101575e9b36c9a8c9af365e275d07'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"version"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''76a8d99909c338770168c2b5c7e2f6487d88783b55d852de3cacfcd1b9ac6c0f'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''cd3978fdbe8ea5e9f33b5e41e0aa82ec7c8a70c76b1e5ded311618ba37027058'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"tx"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''862105036ae110f44da92c19f7fd0fbc28e8c319051b82cf23d15749ec55733d'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"tx"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"actor"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''d3e3ed12a1d73afe80e76897722f7b4f3ad5b1e34576d9ce1eb5b103f2ce13a6'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"actor"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''cf41594e0b5b3d7cab80cbe9098c3d3024cf17413f5211d7c0747239f98ca20f'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''83d72235e318e36abddc9642eb6d2fa1bab4f9a863407d336721baf9993dbff9'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''330ddf37f6d69c2eb0dac19a8be9723c53dda68bdc5118380e9423c54b8e95f9'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''2f2b99267f30bd6324fb046a28bc6414f652b95f21cbc9d7cc79ff515255a5e2'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''6999d484529b60ec6c1853c48ff1543f143b621da4234a464297fb2ec34fe59e'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''46320660e21100eee04b9cdbbb51f91c5ae746e9fccaf8cfbb674c6e1e06e760'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''1b22abc56804d01ee7ad656be2c965119c55066d58a4f99d8a9e3b5a4d33cb4a'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''c5670ec2c4b4c71c0583dd4a47b739a58b0096dbb08aea9754603f5abd7adec4'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''columns'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''bcec53e42a46bd3180a19fde8eadac0bc8a8ee6017836103c40ac9b79f0ba62b'')<>1 then raise exception ''NW11 postcondition mismatch: columns {"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r11","table":"events","column":"work_event"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''085309a5f53794dbcd61b888c5f0dc909e8569224b42b706f286ffd9c8115520'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r11","table":"events","column":"work_event"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"root_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''aeb7c030ef9674863a47380e4aa814b0e98688285abd53b8253ce79579f2998f'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"root_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"version"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''021b8f3a930dd4d994d8190f93ce8c7088fcd3f0a522232e3c3495dfe7545c8a'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"version"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''b7dad12a7888ac8cd93b2914f99c59303eaf79f4e7fe60d0a9a10f035da84bdf'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''f1654fa08d32b778288186ea98264e5f3770abbb07d946462b5eb7c772ade57f'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"tx"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''9ac5fa3b6e6a6238a67f9952758ba2124322d66233f9afccb31916fb18d45123'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"tx"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"actor"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''8d7df0d103174979b1d988a16008e3a98e6a69ba0a5936b538bb4a2aae72aa70'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"actor"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''f685803840e0921d319c0d65ff4d1593a717baaf9728057eeda3ea5fe7a2dc5b'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"project_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''c3bab9f0435ccd7c6ee8abb9384ed4a0b4e845bcf8e2a444927c85aa037b95c4'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"office_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''f10313c3f248258471bd558585744ea4167002a8ec6deb6eaf1b168d2380bb12'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''a6fc8b399db5d2b04693a3645258977d9251ebf4b97ae7f34bb1c0bf914154fb'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"request_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''ab1ea53f52a5603ed519109bc6c68cef95b70e593e8c32120afd302cc1123172'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''e0f8db2c10a52fa8d7ae9bae20cceb25d1d63b58a908a493ac11aee103548e79'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''6a35c8428f5bd3a034618ea79b14c587e80f2c51e972155fa829d82802f28812'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"row_id"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''a7fddc70827a6659bc87ad34b3f1db6f44a14d6d4ca4431cbc80f6dbddbfc8f4'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"before_row"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''column_attributes'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''6b713f1a5b9013ac6ddc667782521dafa49a0023568609c7cbeb84d520220475'')<>1 then raise exception ''NW11 postcondition mismatch: column_attributes {"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''3da00e3fbf8cf087ece53a03ef10fdc11a5460df143de29867ab2351ff2c3081'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''405a0c38deb9ce08faa8dcab9fa03a72aa62894fd5b61dd7c68cd55d90106598'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''15974313491a3a50c028cd16f7cd880f67ee3469ffc1256487e8e4449b364cc5'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''4633b593e61bab37fedf586f5c30fae72bc473518aebdbd9e3b77ebf5cc4f89e'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''de606ec71a1a5e544e79d67c3b246d67e201edede9f54579c8641652273bc763'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"public","table":"subtasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''b2ef5fac1ebed9527139502e616edbd6e4755226d7fac3d37336347948c072f0'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"public","table":"subtasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''constraints'') element where element @> ''{"schema":"public","table":"tasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''8d486cddbedb4bd13099a91d733bfffa4e80b5699c6eea3606c7097efa12c81e'')<>1 then raise exception ''NW11 postcondition mismatch: constraints {"schema":"public","table":"tasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''e87cc82672ef98a28fc49b49fb70b8e787fcbde4f00c574252e7bc88b589b891'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''61d4492355ab2d544bb1d76681f0a9ebba65d4b0feb6dc450096643958e4cecd'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''89479d8e76a723c84dce769872e578775ed2bc63b058eea9adc28853e23094af'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''7404268fca1695133425e195d5ea66cf37180579065d2992218a34d663ab156e'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''37a8d977bff417ec3fe264dc27842645ad34881f399ad98b133dafa9a44ec156'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''bc4371c3cc42e0469b1bc1f38100bd4e86d2387c6f132e735da826a25c303612'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''519d237e9edb5521312bfc3909bec3230c99dc0e861b4fce56cbf3b4172f1cb7'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''64fa2400e9595938c6980b57bd8aed0d0d3eac3fc96f3dccd446230c56734053'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''c8ab530c380b2fd6e3e1c67041325a7d87e1889bfa822c216d6b37142514f221'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''5689656de9bbe6f7afcfb2f084f4118445078010f7be816ca065e47f43f3fbee'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''8da6bcf0f7670e768c9ec81b347a8c52c987f0fa2f842ee9a310216ab3dd92f4'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''2052b4a3e748b8bfe555b2b5d33abed93dbd76eed834f58a22385d6bbbd9e78c'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''d770a7337cb94f22f75532b9f0281384b2fc9c6c74dab6ee7517c96162ee8a3b'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''ed794e238c110e0835d5bf37eac3bf4bea77ad9df4a822110b1db7eedf3bb988'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''43dc874beec024301759cb035368128fd41e727c97c3f98a7a4ecc6f086d0cbe'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''741955286e35db156a6e85403471689d67ecf0275bf89fced1aba96a7023af56'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''2eaf877eb2f9fecf4e2f06b956123c4ca6ee507c6b526f183d259e3ca87c9ae4'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''9874f53e06867d2d288a3f8c0756fb1fe70eb91afdb30f9bc03f9bc970daada1'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''35a39aaaeefafaa6ae104b36ca2e07c6d247cd2f6bb8e00373161820255cc405'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''04e22670db527cdb3b5dd4abc161f4ef480d19659c2bf62871707782d9cdcafe'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''300e9ce008969bd63b171321a99fbc7ea2ad75a3d621ce2af05400b0c512e4a6'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''045159099c5c13aea8c0282e23721274f45d76b8296f2ad88e3ddd4c573ffdfb'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''aa254cbf53f8c65ff2a24921b10a49d84b47c76b732c3e7ed24811f5d6e137f7'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''eae5927998c540bec0901da8aa4bb303e69c1f836d411fc2a712245969c5c4f6'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''599cdbc92aafc20484f468871a9e3a010f2a110f660ffb20f39df80069f2c747'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtasks","name":"nw42_completion_lock"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''4febe2325693bd5c115c0c4686dd39fcbc1690a82fe08c5b71b990ad372a554b'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"nw42_completion_lock"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"subtasks","name":"nw51_operation_safety"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''6946bc39e2b7b49fceed3eb511680401b990ac3860a23de2d44f96aed1f8bb6c'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"subtasks","name":"nw51_operation_safety"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''bc6f4e81d1d7780bac6555740187fc3a55243cc1d20b0c8f7270b8187c4eb8f0'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''e689884a2ead2de688bb6a7c52a084467e93e758f1ddc2769de7a12f098337cf'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''9fc013b03e2cf265a9137427347271b626ea7a8925e6d128d64255f5c197934e'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"tasks","name":"nw42_completion_commit"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''f931564843f1e2084a50246c007b54bc6c73522ebcb20013668359b9b2cdbf21'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"nw42_completion_commit"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"tasks","name":"nw42_completion_lock"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''793bbe6adbb97f1e7508832899074a26433f0bdce3b79bfe9ea1934d405ce98c'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"nw42_completion_lock"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"tasks","name":"nw51_operation_safety"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''98274e64c38a53c15eacf0f692b5cc6cdf3a788fceeffc1efdfb0cbb2ba6e59e'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"tasks","name":"nw51_operation_safety"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''28c688c8d78f0345bf94ecb64b8be04db1c8975c4c200285a34a8e38c09e0278'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''2779c5fa113dad6c53d88ef1daeb2cb88f8b41a9c8137efb6a13279d8fbed239'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"}'';end if;
if (select count(*) from jsonb_array_elements(nw11_metadata->''triggers'') element where element @> ''{"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}''::jsonb and encode(pg_catalog.sha256(convert_to((element)::text,''UTF8'')),''hex'')=''5cc882893bed17c2c94b6893805e8a17b055ed9d7b6e8325fc18e590ff640916'')<>1 then raise exception ''NW11 postcondition mismatch: triggers {"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}'';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)=''array'' then (select coalesce(jsonb_agg(element order by element::text),''[]''::jsonb) from jsonb_array_elements(value) element where not exists(select 1 from jsonb_array_elements(coalesce(''{"functions":[{"schema":"eflow_budget","name":"cash_request_v2","identity_arguments":"p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid"},{"schema":"eflow_budget","name":"fund_work","identity_arguments":"p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid"},{"schema":"eflow_budget","name":"legacy_resubmit_cash","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"eflow_budget","name":"submit_items","identity_arguments":"p_request uuid, p_spent numeric, p_note text, p_receipts jsonb, p_key uuid, p_refund_number text, p_refund_date date"},{"schema":"eflow_evidence","name":"can_upload","identity_arguments":"p_name text"},{"schema":"eflow_evidence","name":"guard_attempt","identity_arguments":""},{"schema":"eflow_evidence","name":"guard_progress","identity_arguments":""},{"schema":"eflow_evidence","name":"seal_file","identity_arguments":"p_name text, p_task uuid, p_subtask uuid, p_attempt text, p_kind text, p_reference uuid"},{"schema":"eflow_r7","name":"check_completion_commit","identity_arguments":""},{"schema":"eflow_r7","name":"checked_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"eflow_r7","name":"command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"date_impact","identity_arguments":"p_root uuid, p_payload jsonb"},{"schema":"eflow_r7","name":"guard_operation_write","identity_arguments":""},{"schema":"eflow_r7","name":"history_facts","identity_arguments":"p_root uuid, p_ids uuid[]"},{"schema":"eflow_r7","name":"history_roots","identity_arguments":"p_row jsonb"},{"schema":"eflow_r7","name":"impact_fingerprint","identity_arguments":"p_root uuid, p_command text, p_payload jsonb, p_impact jsonb"},{"schema":"eflow_r7","name":"lock_completion","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"lock_completion_write","identity_arguments":""},{"schema":"eflow_r7","name":"lock_impact","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"node_work","identity_arguments":"p_node uuid, p_user uuid"},{"schema":"eflow_r7","name":"operation_capabilities","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"operation_impact","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"require_completed_descendants","identity_arguments":"p_root uuid, p_target uuid"},{"schema":"eflow_r7","name":"require_operation","identity_arguments":"p_root uuid, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"reviewer","identity_arguments":"p_node uuid, p_submitter uuid"},{"schema":"eflow_r7","name":"serialize_history","identity_arguments":""},{"schema":"eflow_r7","name":"snapshot","identity_arguments":"p_root uuid"},{"schema":"eflow_r7","name":"subtree_ids","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r7","name":"work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"eflow_r7","name":"work_path","identity_arguments":"p_root uuid, p_node uuid"},{"schema":"eflow_r9","name":"clear_removed_staff","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_request uuid, p_fingerprint text"},{"schema":"eflow_r9","name":"guard_staffing_removal","identity_arguments":""},{"schema":"eflow_r9","name":"lock_removal_work","identity_arguments":"p_project uuid, p_office uuid"},{"schema":"eflow_r9","name":"remove_person","identity_arguments":"p_project uuid, p_user uuid, p_office uuid, p_fingerprint text, p_request uuid"},{"schema":"eflow_r9","name":"staffing_removal_allowed","identity_arguments":"p_table text, p_old jsonb, p_new jsonb"},{"schema":"public","name":"acknowledge_petty_cash_release","identity_arguments":"p_release_id uuid"},{"schema":"public","name":"add_cash_request_attachment","identity_arguments":"p_request_id uuid, p_file_name text, p_file_path text, p_mime_type text, p_file_size bigint"},{"schema":"public","name":"cancel_contextual_cash_request","identity_arguments":"p_request_id uuid, p_reason text"},{"schema":"public","name":"claim_task_evidence_cleanup","identity_arguments":"p_object_name text, p_bucket_id text"},{"schema":"public","name":"create_contextual_cash_request","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_idempotency_key uuid"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"create_petty_cash_request","identity_arguments":"p_allocation_id uuid, p_amount numeric, p_purpose text, p_needed_by date, p_subtask_id uuid"},{"schema":"public","name":"create_subtask_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"create_work_budget_allocation","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_amount numeric, p_reason text"},{"schema":"public","name":"decide_petty_cash_leader_review","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_liquidation_leader_review","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_petty_cash_request","identity_arguments":"p_request_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"decide_subtask_review","identity_arguments":"p_subtask_id uuid, p_approve boolean, p_feedback text"},{"schema":"public","name":"decide_task_review","identity_arguments":"p_task_id uuid, p_approve boolean, p_feedback text, p_audit_hash text"},{"schema":"public","name":"decide_work_budget_allocation","identity_arguments":"p_allocation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"delete_subtask_budget_allocation","identity_arguments":"p_allocation_id uuid"},{"schema":"public","name":"guard_subtask_contributor_update","identity_arguments":""},{"schema":"public","name":"guard_subtask_mutation","identity_arguments":""},{"schema":"public","name":"nw_work_command","identity_arguments":"p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb, p_impact_fingerprint text"},{"schema":"public","name":"nw_work_impact","identity_arguments":"p_root uuid, p_revision integer, p_command text, p_payload jsonb"},{"schema":"public","name":"override_accounting_petty_cash_release_schedule","identity_arguments":"p_release_id uuid, p_reason text, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_accounting_petty_cash_release","identity_arguments":"p_release_id uuid, p_release_method text, p_cheque_number text"},{"schema":"public","name":"record_petty_cash_release_internal","identity_arguments":"p_release_id uuid, p_override_reason text"},{"schema":"public","name":"remove_subtask_budget_cap","identity_arguments":"p_cap_allocation_id uuid, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"resubmit_contextual_cash_request","identity_arguments":"p_request_id uuid, p_allocation_line_id uuid, p_amount numeric, p_purpose text, p_needed_by date"},{"schema":"public","name":"route_organization_leadership_review","identity_arguments":""},{"schema":"public","name":"save_subtask_progress","identity_arguments":"p_subtask_id uuid, p_percent_complete integer, p_blocker_category text, p_blocker text, p_next_step text, p_note text, p_attachment_path text, p_attachment_name text"},{"schema":"public","name":"schedule_petty_cash_releases","identity_arguments":"p_request_id uuid, p_actor uuid"},{"schema":"public","name":"set_subtask_budget_cap","identity_arguments":"p_task_id uuid, p_subtask_id uuid, p_parent_allocation_line_id uuid, p_amount numeric, p_reason text, p_idempotency_key uuid"},{"schema":"public","name":"settle_accounting_liquidation","identity_arguments":"p_liquidation_id uuid, p_approve boolean, p_reason text"},{"schema":"public","name":"submit_accounting_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid, p_refund_receipt_number text, p_refund_date date"},{"schema":"public","name":"submit_contextual_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb, p_idempotency_key uuid"},{"schema":"public","name":"submit_petty_cash_liquidation","identity_arguments":"p_request_id uuid, p_declared_spent numeric, p_note text, p_receipts jsonb"},{"schema":"public","name":"submit_subtask_for_review","identity_arguments":"p_subtask_id uuid, p_submission jsonb"},{"schema":"public","name":"submit_task_for_review","identity_arguments":"p_task_id uuid, p_submission jsonb"},{"schema":"public","name":"sync_task_chat_channel","identity_arguments":""},{"schema":"public","name":"validate_task_reviewers","identity_arguments":""}],"tables":[{"schema":"eflow_r7","name":"completion_locks"},{"schema":"eflow_r9","name":"staffing_removals"}],"columns":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"column_attributes":[{"schema":"eflow_r11","table":"events","column":"work_event"},{"schema":"eflow_r7","table":"completion_locks","column":"root_id"},{"schema":"eflow_r7","table":"completion_locks","column":"version"},{"schema":"eflow_r7","table":"completion_locks","column":"approval_xid"},{"schema":"eflow_r7","table":"completion_locks","column":"approved_ids"},{"schema":"eflow_r9","table":"staffing_removals","column":"tx"},{"schema":"eflow_r9","table":"staffing_removals","column":"actor"},{"schema":"eflow_r9","table":"staffing_removals","column":"project_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"office_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"removed_user"},{"schema":"eflow_r9","table":"staffing_removals","column":"request_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"fingerprint"},{"schema":"eflow_r9","table":"staffing_removals","column":"relation_name"},{"schema":"eflow_r9","table":"staffing_removals","column":"row_id"},{"schema":"eflow_r9","table":"staffing_removals","column":"before_row"},{"schema":"eflow_r9","table":"staffing_removals","column":"after_row"}],"constraints":[{"schema":"eflow_r7","table":"completion_locks","name":"completion_locks_pkey"},{"schema":"eflow_r9","table":"staffing_removals","name":"staffing_removals_pkey"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"}],"triggers":[{"schema":"eflow_evidence","table":"attempts","name":"a_nw52_history_serialization"},{"schema":"eflow_evidence","table":"objects","name":"a_nw52_history_serialization"},{"schema":"public","table":"budget_ledger_entries","name":"a_nw52_history_serialization"},{"schema":"public","table":"personal_subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"personal_tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_commit"},{"schema":"public","table":"personal_tasks","name":"nw42_completion_lock"},{"schema":"public","table":"personal_tasks","name":"nw51_operation_safety"},{"schema":"public","table":"petty_cash_liquidations","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipt_items","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_receipts","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_releases","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_request_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"petty_cash_requests","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_progress_updates","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submission_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_commit"},{"schema":"public","table":"subtask_submissions","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"subtasks","name":"nw42_completion_commit"},{"schema":"public","table":"subtasks","name":"nw42_completion_lock"},{"schema":"public","table":"subtasks","name":"nw51_operation_safety"},{"schema":"public","table":"task_attachments","name":"a_nw52_history_serialization"},{"schema":"public","table":"task_submissions","name":"a_nw52_history_serialization"},{"schema":"public","table":"tasks","name":"a0_nw51_staffing_boundary"},{"schema":"public","table":"tasks","name":"nw42_completion_commit"},{"schema":"public","table":"tasks","name":"nw42_completion_lock"},{"schema":"public","table":"tasks","name":"nw51_operation_safety"},{"schema":"public","table":"work_budget_allocation_lines","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_budget_allocations","name":"a_nw52_history_serialization"},{"schema":"public","table":"work_tree_events","name":"a_nw52_history_serialization"}]}''::jsonb->key,''[]''::jsonb)) permitted where element @> permitted)) else value end) from jsonb_each(q.metadata-''captured_at_utc''-''migrations'')))::text,''UTF8'')),''hex'') from (select q.metadata||jsonb_build_object(''column_attributes'',(select coalesce(jsonb_agg(jsonb_build_object(
 ''schema'',n.nspname,''table'',c.relname,''column'',a.attname,
 ''type'',pg_catalog.format_type(a.atttypid,a.atttypmod),''not_null'',a.attnotnull,
 ''identity'',a.attidentity::text,''generated'',a.attgenerated::text,
 ''default'',pg_catalog.pg_get_expr(d.adbin,d.adrelid),
 ''collation_schema'',cn.nspname,''collation_name'',co.collname)
 order by n.nspname,c.relname,a.attnum),''[]''::jsonb)
 from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace
 left join pg_catalog.pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum
 left join pg_catalog.pg_collation co on co.oid=a.attcollation
 left join pg_catalog.pg_namespace cn on cn.oid=co.collnamespace
 where a.attnum>0 and not a.attisdropped and c.relkind in (''r'',''v'',''m'')
 and (n.nspname=''public'' or n.nspname like ''eflow_%''))) metadata from (select jsonb_build_object(
''captured_at_utc'',now(),
''migrations'',(select jsonb_agg(jsonb_build_object(''version'',version,''name'',name,''statements'',statements) order by version) from supabase_migrations.schema_migrations),
''functions'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',p.proname,''identity_arguments'',pg_get_function_identity_arguments(p.oid),''arguments'',pg_get_function_arguments(p.oid),''returns'',pg_get_function_result(p.oid),''definition'',pg_get_functiondef(p.oid),''body'',p.prosrc,''security_definer'',p.prosecdef,''config'',p.proconfig,''acl'',p.proacl,''owner'',pg_get_userbyid(p.proowner),''anon_execute'',has_function_privilege(''anon'',p.oid,''execute''),''authenticated_execute'',has_function_privilege(''authenticated'',p.oid,''execute''),''service_role_execute'',has_function_privilege(''service_role'',p.oid,''execute'')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind=''f'' and (n.nspname=''public'' or n.nspname like ''eflow_%'') and not exists(select 1 from pg_depend d where d.classid=''pg_proc''::regclass and d.objid=p.oid and d.deptype=''e'')),
''tables'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''name'',c.relname,''kind'',c.relkind,''rls'',c.relrowsecurity,''forced_rls'',c.relforcerowsecurity,''options'',c.reloptions,''acl'',c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname=''public'' or n.nspname like ''eflow_%'' or n.nspname=''storage'') and c.relkind in (''r'',''v'',''m'')),
''columns'',(select jsonb_agg(jsonb_build_object(''schema'',table_schema,''table'',table_name,''column'',column_name,''type'',data_type,''udt'',udt_name,''nullable'',is_nullable,''default'',column_default) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema=''public'' or table_schema like ''eflow_%'' or table_schema=''storage''),
''constraints'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',co.conname,''definition'',pg_get_constraintdef(co.oid)) order by n.nspname,c.relname,co.conname) from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=''public'' or n.nspname like ''eflow_%''),
''triggers'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''table'',c.relname,''name'',t.tgname,''enabled'',t.tgenabled,''definition'',pg_get_triggerdef(t.oid)) order by n.nspname,c.relname,t.tgname) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and (n.nspname=''public'' or n.nspname like ''eflow_%'')),
''policies'',(select jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname) from pg_policies p where p.schemaname=''public'' or p.schemaname like ''eflow_%'' or p.schemaname=''storage''),
''bucket_configuration'',(select jsonb_agg(jsonb_build_object(''id'',id,''public'',public,''file_size_limit'',file_size_limit,''allowed_mime_types'',allowed_mime_types) order by id) from storage.buckets where id in(''project-library'',''task-attachments''))
) as metadata) q) q)<>current_setting(''eflow.nw11_preserved_catalog'') then raise exception ''NW11 changed an unapproved catalog contract, including financial/evidence authority'';end if;
 if (select encode(pg_catalog.sha256(convert_to(((select jsonb_object_agg(key,case when jsonb_typeof(value)=''array'' then (select jsonb_agg(element order by element::text) from jsonb_array_elements(value) element) else value end) from jsonb_each(q.metadata-''captured_at_utc'')))::text,''UTF8'')),''hex'') from (select jsonb_build_object(''captured_at_utc'',now(),''schemas'',(select jsonb_agg(jsonb_build_object(''name'',nspname,''acl'',nspacl,''owner'',pg_get_userbyid(nspowner))) from pg_namespace where nspname=''public'' or nspname like ''eflow_%'' or nspname in (''auth'',''storage'',''extensions'')),''memberships'',(select jsonb_agg(jsonb_build_object(''role'',r.rolname,''member'',m.rolname,''admin'',a.admin_option,''inherit'',a.inherit_option,''set'',a.set_option,''grantor'',g.rolname)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor),''default_acl'',(select jsonb_agg(jsonb_build_object(''schema'',n.nspname,''owner'',pg_get_userbyid(d.defaclrole),''kind'',d.defaclobjtype,''acl'',d.defaclacl)) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),''buckets'',(select jsonb_agg(jsonb_build_object(''id'',id,''public'',public,''file_size_limit'',file_size_limit,''allowed_mime_types'',allowed_mime_types) order by id) from storage.buckets)) as metadata) q)<>''f7e99b18898ac3492f8911a57590531a80c0bf21758a14c42652225329a77ab5'' then raise exception ''NW11 changed recovery/role/Storage configuration'';end if;
 END $nw11_postconditions$;',chr(13)||chr(10),chr(10)),
replace('DO $nw11_view$ BEGIN if (select encode(pg_catalog.sha256(convert_to(pg_get_viewdef(''eflow_r11.events''::regclass,true),''UTF8'')),''hex''))<>''510d8b6c37304c0c06670ffb332f1dc1c1a68915d3d277c0d92a1274d4037b86'' then raise exception ''NW11 activity view definition mismatch'';end if; END $nw11_view$;',chr(13)||chr(10),chr(10))]::text[]);
COMMIT;
SELECT 'NW11_DATABASE_APPLIED_RUNTIME_ACCEPTANCE_PENDING' status,version,name FROM supabase_migrations.schema_migrations WHERE version='20261015230935';
