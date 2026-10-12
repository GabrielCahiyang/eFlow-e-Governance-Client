-- Reviewed R0-R13 Dashboard SQL Editor bundle, 9 October 2026.
-- TARGET ONLY: https://supabase.com/dashboard/project/ixnfphgjyelhckjwjkdv/sql/new
-- No existing migration records are repaired, renamed or overwritten.
-- Native backup restore rehearsal remains unverified (Windows blocks initdb.exe).
-- Run the ENTIRE file as postgres; do not select individual statements.

-- Read-only. Every row must be PASS before considering 02-apply.sql.
select check_name,case when ok then 'PASS' else 'FAIL' end as result from (values
 ('01 installed history matches reviewed 18 entries',(not exists(with expected(version,name) as (values
('20261003000004','simplified_roles_and_office_authority'),
('20261004123126','phase2_invitation_onboarding_pds'),
('20261004132527','phase2_invitation_dispatch_limits'),
('20261004133412','phase2_existing_identity_acceptance'),
('20261004140128','phase3_project_table_workspace'),
('20261004164937','phase5_workspace_ai_import'),
('20261004181549','phase6_project_office_collaboration'),
('20261004182806','phase6_shared_structure_guards'),
('20261004194130','phase7_readiness_governance'),
('20261005170822','phase65_project_local_office_identity'),
('20261007152648','office_budget_dynamic_sections'),
('20261007153615','office_budget_partition_funding'),
('20261007175525','project_office_removal_and_history'),
('20261007191654','account_login_lockout'),
('20261007195837','login_gateway_discovery'),
('20261007201249','project_draft_publication'),
('20261007203525','project_publication_history_retention'),
('20261008004900','withdraw_office_invitation')
) select version,name from expected except select version,name from supabase_migrations.schema_migrations)
 and not exists(with expected(version,name) as (values
('20261003000004','simplified_roles_and_office_authority'),
('20261004123126','phase2_invitation_onboarding_pds'),
('20261004132527','phase2_invitation_dispatch_limits'),
('20261004133412','phase2_existing_identity_acceptance'),
('20261004140128','phase3_project_table_workspace'),
('20261004164937','phase5_workspace_ai_import'),
('20261004181549','phase6_project_office_collaboration'),
('20261004182806','phase6_shared_structure_guards'),
('20261004194130','phase7_readiness_governance'),
('20261005170822','phase65_project_local_office_identity'),
('20261007152648','office_budget_dynamic_sections'),
('20261007153615','office_budget_partition_funding'),
('20261007175525','project_office_removal_and_history'),
('20261007191654','account_login_lockout'),
('20261007195837','login_gateway_discovery'),
('20261007201249','project_draft_publication'),
('20261007203525','project_publication_history_retention'),
('20261008004900','withdraw_office_invitation')
) select version,name from supabase_migrations.schema_migrations except select version,name from expected))),
 ('02 no partially installed refinement schema',(not exists(select 1 from pg_namespace where nspname in ('eflow_r3','eflow_r6','eflow_r7','eflow_r8','eflow_r9','eflow_r11')) and not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('office_project_homes','personal_project_members','personal_project_shortcuts','personal_projects','personal_subtasks','personal_tasks','personal_work_events','project_access_grants','project_guest_members','project_invitation_events','project_invitation_requests','project_library_events','project_library_files','project_library_links','work_tree_events','workspace_members','workspaces')) and to_regprocedure('public.r12_save_presentation_settings(uuid,jsonb,jsonb)') is null)),
 ('03 existing compatibility prerequisites installed',(to_regprocedure('eflow_phase65.require_lead(uuid,uuid)') is not null and to_regprocedure('eflow_publication.baseline_readiness(uuid)') is not null and to_regprocedure('eflow_office_management.remove_office(uuid,uuid)') is not null and to_regprocedure('public.phase6_withdraw_office_invitation(uuid)') is not null)),
 ('04 subtask positions suitable for R7 backfill',(not exists(select 1 from public.subtasks where position is null or position<0))),
 ('05 current role is postgres',(current_user='postgres'))
) checks(check_name,ok) order by check_name;
