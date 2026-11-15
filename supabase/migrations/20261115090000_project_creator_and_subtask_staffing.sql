begin;
set local lock_timeout = '10s';

create function eflow_publication.apply_subtask_contract_patch(p_definition text,p_anchor text,p_replacement text,p_context text)
returns text language plpgsql set search_path = '' as $$
begin
 if p_definition is null or coalesce(p_anchor,'')='' or
  length(p_definition)-length(replace(p_definition,p_anchor,''))<>length(p_anchor) then
  raise exception 'Review the installed function before applying %',p_context;
 end if;
 return replace(p_definition,p_anchor,p_replacement);
end $$;


-- Apply at insertion, including non-wizard creation callers. Existing projects
-- and later, explicitly authorized lead transfers retain their current rules.
create function eflow_project.default_creator_lead()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.created_by=auth.uid() and public.phase2_is_office_head(auth.uid(),new.org_id) then
  new.project_lead_id:=auth.uid();
 end if;
 return new;
end $$;
revoke all on function eflow_project.default_creator_lead() from public,anon,authenticated,service_role;
create trigger aaa_project_creator_lead before insert on public.projects
 for each row execute function eflow_project.default_creator_lead();

create function eflow_publication.subtask_staffing_locked(p_root uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.tasks t join public.projects p on p.id=t.linked_project_id
  where t.id=p_root and p.status='active' and p.project_lead_id=auth.uid());
$$;
revoke all on function eflow_publication.subtask_staffing_locked(uuid) from public,anon,authenticated,service_role;

-- Every roster write is protected, including legacy and direct table callers.
-- Lock the project row so activation cannot race a planning assignment.
create function eflow_publication.guard_active_subtask_staffing()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_status text; project_lead uuid;
begin
 if auth.uid() is null then return new;end if;
 if tg_op='UPDATE' then
  if row(new.task_id,new.lead_id,new.assigned_to,new.assigned_to_ids)
    is not distinct from row(old.task_id,old.lead_id,old.assigned_to,old.assigned_to_ids) then return new;end if;
 else
  if new.lead_id is null and new.assigned_to is null and cardinality(coalesce(new.assigned_to_ids,'{}'::uuid[]))=0 then return new;end if;
 end if;
 select p.status,p.project_lead_id into project_status,project_lead
  from public.tasks t join public.projects p on p.id=t.linked_project_id
  where t.id=new.task_id for share of p;
 if project_status='active' and project_lead=auth.uid() then
  raise exception 'Subtask assignments are read-only for the Project Lead while the project is active'
   using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function eflow_publication.guard_active_subtask_staffing() from public,anon,authenticated,service_role;
create trigger aaa_active_subtask_staffing_lock before insert or update on public.subtasks
 for each row execute function eflow_publication.guard_active_subtask_staffing();

do $migration$
declare definition text; anchor text;
begin
 select pg_get_functiondef('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure) into definition;
 anchor:=substring(definition from $rx$if action[[:space:]]*=[[:space:]]*'appoint_lead' then$rx$);
 execute eflow_publication.apply_subtask_contract_patch(definition,anchor,
  'if p_node is not null and action in (''appoint_lead'',''manage_contributors'')
     and eflow_publication.subtask_staffing_locked(p_root) then reason:=''active_subtask_staffing_locked'';
   elsif action=''appoint_lead'' then','active subtask staffing capability');
end $migration$;

-- Creation still permits unassigned subtasks. The picker uses this server flag
-- independently of the capability to create the subtask itself.
create function eflow_publication.with_subtask_staffing(p_snapshot jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_set(p_snapshot,'{root,subtask_staffing_locked}',
  to_jsonb(eflow_publication.subtask_staffing_locked((p_snapshot->'root'->>'id')::uuid)));
$$;
revoke all on function eflow_publication.with_subtask_staffing(jsonb) from public,anon,authenticated,service_role;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('eflow_r7.snapshot(uuid)'::regprocedure) into definition;
 execute eflow_publication.apply_subtask_contract_patch(definition,
  'eflow_m7.with_schedule(eflow_r7.m7_baseline_snapshot(p_root))',
  'eflow_publication.with_subtask_staffing(eflow_m7.with_schedule(eflow_r7.m7_baseline_snapshot(p_root)))',
  'subtask creation staffing controls');
end $migration$;

-- Extend the existing reviewed-update terms; approval still owns the write.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('eflow_m7.propose_work(uuid,uuid,uuid,text,jsonb,uuid)'::regprocedure) into definition;
 definition:=eflow_publication.apply_subtask_contract_patch(definition,
  '(''note'',''progress'',''blocker'',''attachments'')',
  '(''note'',''progress'',''blocker'',''next_step'',''attachments'')','review next-step terms');
 definition:=eflow_publication.apply_subtask_contract_patch(definition,
  'if note is null or length(note)>3000 or length(coalesce(p_terms->>''blocker'',''''))>3000 then',
  'if (note is null and p_kind=''completion'') or length(note)>3000
   or length(coalesce(p_terms->>''blocker'',''''))>3000
   or length(coalesce(p_terms->>''next_step'',''''))>300 then','review update text limits');
 execute definition;
 select pg_get_functiondef('eflow_m7.decide_work(uuid,uuid,boolean,text)'::regprocedure) into definition;
 definition:=eflow_publication.apply_subtask_contract_patch(definition,
  'public.submit_task_progress(work.root_id,progress,null,work.terms->>''blocker'',null,work.terms->>''note'',null,null)',
  'public.submit_task_progress(work.root_id,progress,null,work.terms->>''blocker'',work.terms->>''next_step'',work.terms->>''note'',null,null)','task reviewed next step');
 definition:=eflow_publication.apply_subtask_contract_patch(definition,
  'public.save_subtask_progress(work.node_id,progress,null,work.terms->>''blocker'',null,work.terms->>''note'',null,null)',
  'public.save_subtask_progress(work.node_id,progress,null,work.terms->>''blocker'',work.terms->>''next_step'',work.terms->>''note'',null,null)','subtask reviewed progress next step');
 definition:=eflow_publication.apply_subtask_contract_patch(definition,
  'work.terms->>''blocker'',work.terms->>''note'',null,null,null',
  'work.terms->>''blocker'',work.terms->>''note'',work.terms->>''next_step'',null,null','subtask reviewed status next step');
 execute definition;
end $migration$;

drop function eflow_publication.apply_subtask_contract_patch(text,text,text,text);
notify pgrst, 'reload schema';
commit;
