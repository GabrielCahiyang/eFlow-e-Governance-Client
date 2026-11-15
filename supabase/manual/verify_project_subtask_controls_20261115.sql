-- Run in the Supabase SQL Editor for ixnfphgjyelhckjwjkdv.
-- Read-only catalog inspection: no app login, fixture writes or migration replay.
-- PASS verifies installed definitions/wiring, not authenticated workflow acceptance.
begin read only;
set local statement_timeout = '15s';

with requested(key, signature) as (values
 ('creator', 'eflow_project.default_creator_lead()'),
 ('locked', 'eflow_publication.subtask_staffing_locked(uuid)'),
 ('guard', 'eflow_publication.guard_active_subtask_staffing()'),
 ('decorate', 'eflow_publication.with_subtask_staffing(jsonb)'),
 ('capabilities', 'eflow_r7.operation_capabilities(uuid,uuid)'),
 ('snapshot', 'eflow_r7.snapshot(uuid)'),
 ('propose', 'eflow_m7.propose_work(uuid,uuid,uuid,text,jsonb,uuid)'),
 ('decide', 'eflow_m7.decide_work(uuid,uuid,boolean,text)'),
 ('direct', 'public.save_subtask_work_update(uuid,text,text,text,text,text,text)')
), functions as (
 select r.key, p.oid, p.prosecdef,
  regexp_replace(coalesce(p.prosrc,''), '[[:space:]]', '', 'g') as body
 from requested r left join pg_proc p on p.oid=to_regprocedure(r.signature)
), checks(number, check_name, passed) as (
 select 1, 'Existing direct subtask blocker / next-step support',
  oid is not null and body like '%p_blocker%' and body like '%p_next_step%'
 from functions where key='direct'
 union all
 select 2, 'Creator defaults to Project Lead (Office Head check)',
  oid is not null and prosecdef
  and body like '%new.created_by=auth.uid()%'
  and body like '%public.phase2_is_office_head(auth.uid(),new.org_id)%'
  and body like '%new.project_lead_id:=auth.uid()%'
 from functions where key='creator'
 union all
 select 3, 'Creator default is connected to an enabled BEFORE INSERT trigger',
  exists(select 1 from pg_trigger t join functions f on f.key='creator' and f.oid=t.tgfoid
   where t.tgrelid='public.projects'::regclass and not t.tgisinternal
    and t.tgenabled in ('O','A') and t.tgtype=7)
 union all
 select 4, 'Staffing lock applies to the current Project Lead on Active projects',
  oid is not null and prosecdef and body like '%p.status=''active''%'
  and body like '%p.project_lead_id=auth.uid()%'
 from functions where key='locked'
 union all
 select 5, 'Assignment writer checks Active project, current lead and all assignment fields',
  oid is not null and prosecdef and body like '%project_status=''active''%'
  and body like '%project_lead=auth.uid()%'
  and body like '%new.lead_id%' and body like '%new.assigned_to%'
  and body like '%new.assigned_to_ids%' and body like '%forshareofp%'
  and body like '%errcode=''42501''%'
 from functions where key='guard'
 union all
 select 6, 'Assignment guard is connected to an enabled BEFORE INSERT / UPDATE trigger',
  exists(select 1 from pg_trigger t join functions f on f.key='guard' and f.oid=t.tgfoid
   where t.tgrelid='public.subtasks'::regclass and not t.tgisinternal
    and t.tgenabled in ('O','A') and t.tgtype=23)
 union all
 select 7, 'Subtask assignment capabilities include the Active staffing restriction',
  oid is not null and body like '%p_nodeisnotnull%'
  and body like '%actionin(''appoint_lead'',''manage_contributors'')%'
  and body like '%eflow_publication.subtask_staffing_locked(p_root)%'
  and body like '%active_subtask_staffing_locked%'
 from functions where key='capabilities'
 union all
 select 8, 'Creation snapshot includes the subtask staffing lock flag',
  (select oid is not null and body like '%{root,subtask_staffing_locked}%'
    and body like '%eflow_publication.subtask_staffing_locked(%' from functions where key='decorate')
  and (select oid is not null and body like '%eflow_publication.with_subtask_staffing(%'
    from functions where key='snapshot')
 union all
 select 9, 'Lead-review submissions accept next_step with its 300-character limit',
  oid is not null
  and body like '%(''note'',''progress'',''blocker'',''next_step'',''attachments'')%'
  and body like '%length(coalesce(p_terms->>''next_step'',''''))>300%'
 from functions where key='propose'
 union all
 select 10, 'Progress notes are optional; completion notes remain required',
  oid is not null and body like '%noteisnullandp_kind=''completion''%'
 from functions where key='propose'
 union all
 select 11, 'Review approval preserves next step in status-based subtask updates',
  oid is not null and body like '%work.terms->>''blocker'',work.terms->>''note'',work.terms->>''next_step'',null,null%'
 from functions where key='decide'
 union all
 select 12, 'Review approval preserves next step in percentage-based subtask updates',
  oid is not null and body like '%public.save_subtask_progress(work.node_id,progress,null,work.terms->>''blocker'',work.terms->>''next_step'',work.terms->>''note'',null,null)%'
 from functions where key='decide'
 union all
 select 13, 'Review approval preserves next step in task updates',
  oid is not null and body like '%public.submit_task_progress(work.root_id,progress,null,work.terms->>''blocker'',work.terms->>''next_step'',work.terms->>''note'',null,null)%'
 from functions where key='decide'
 union all
 select 14, 'Temporary migration patch helper was cleaned up',
  to_regprocedure('eflow_publication.apply_subtask_contract_patch(text,text,text,text)') is null
), results as (
 select 0 as number, 'Overall installed state'::text as check_name,
  case when bool_and(coalesce(passed,false)) then 'PASS'
       else 'INCOMPLETE / DIFFERENT DEFINITIONS' end as status
 from checks
 union all
 select number,check_name,case when coalesce(passed,false) then 'PASS' else 'MISSING / DIFFERENT' end
 from checks
 union all
 select 15, 'Migration ledger (informational; SQL Editor does not register versions)',
  case when exists(select 1 from supabase_migrations.schema_migrations
    where version='20261115090000') then 'RECORDED' else 'NOT RECORDED' end
)
select check_name,status from results order by number;

rollback;
