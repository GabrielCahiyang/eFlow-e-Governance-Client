begin;
set local lock_timeout = '10s';

-- The previous JSON anti-join expanded the same complete tree once per node.
-- Materialize it once and count leaves with a single set join.
create or replace function eflow_m7.with_visible_counts(p_snapshot jsonb)
returns jsonb language sql stable set search_path = '' as $$
 with nodes as materialized (
  select node.value from jsonb_array_elements(coalesce(p_snapshot->'nodes','[]'::jsonb)) as node(value)
 ), parent_ids as materialized (
  select distinct n.value->>'parent_subtask_id' AS id
  from nodes n where nullif(n.value->>'parent_subtask_id','') is not null
 ), leaves as (
  select n.value
  from nodes n left join parent_ids p on p.id=n.value->>'id'
  where p.id is null
 )
 select p_snapshot || jsonb_build_object(
  'leaf_total',count(*),
  'leaf_completed',count(*) filter (where leaves.value->>'status'='completed')
 ) from leaves;
$$;

-- Task Leads lose root contributor editing after activation. The appointed
-- Project Lead and responsible Office Head keep their existing authority.
create function eflow_publication.root_contributor_change_locked(p_root uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select coalesce(
  p.status='active'
  and coalesce(t.assigned_to,t.recommendation_lead_id)=auth.uid()
  and not coalesce(eflow_phase6.head(p.id,t.org_id,auth.uid()),false)
  and not coalesce(eflow_publication.planning_lead(p.id,t.org_id),false),
  false
 )
 from public.tasks t join public.projects p on p.id=t.linked_project_id
 where t.id=p_root and t.deleted_at is null and t.proposed_office_identity_id is null
  and t.source_collaboration_draft_id is null and p.source_collaboration_draft_id is null;
$$;
revoke all on function eflow_publication.root_contributor_change_locked(uuid) from public,anon,authenticated,service_role;

-- The capability tells the screen why the controls are read-only.
do $migration$
declare
 definition text;
 anchor text;
 replacement text;
begin
 select pg_get_functiondef('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure) into definition;
 anchor := 'elsif not eflow_publication.manage_plan(p_root,p_node) then reason := ''branch_denied'';';
 replacement := 'elsif action = ''manage_contributors'' and p_node is null and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then reason := ''active_staffing_locked'';'
  ||' elsif not eflow_publication.manage_plan(p_root,p_node) then reason := ''branch_denied'';';
 if length(definition)-length(replace(definition,anchor,'')) <> length(anchor) then
  raise exception 'Expected exactly one active Task Lead capability anchor';
 end if;
 execute replace(definition,anchor,replacement);

 -- Check the restriction before snapshot/history work for the legacy command
 -- path. Confirmed receipts remain replayable because the check follows lookup.
 select pg_get_functiondef('eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure) into definition;
 anchor := 'if not coalesce((r->>''open'')::boolean,false) then raise exception ''Closed or unresolved work is read-only'' using errcode=''42501'';end if;';
 replacement := 'if p_command=''contributors'' and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then raise exception ''Root task contributors are read-only for the Task Lead after the project becomes active'' using errcode=''42501'';end if;'
  ||' if not coalesce((r->>''open'')::boolean,false) then raise exception ''Closed or unresolved work is read-only'' using errcode=''42501'';end if;';
 if length(definition)-length(replace(definition,anchor,'')) <> length(anchor) then
  raise exception 'Expected exactly one active Task Lead command anchor';
 end if;
 execute replace(definition,anchor,replacement);
end
$migration$;

-- Enforce the same rule on every task-roster write and serialize it with a
-- concurrent project activation. Higher-level RPC checks remain in place.
create function eflow_publication.guard_active_root_contributor_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare project_status text;
begin
 if auth.uid() is null or old.linked_project_id is null
  or new.team_member_ids is not distinct from old.team_member_ids then return new; end if;

 select p.status into project_status from public.projects p
 where p.id=old.linked_project_id for share;
 if project_status='active'
  and coalesce(old.assigned_to,old.recommendation_lead_id)=auth.uid()
  and not coalesce(eflow_phase6.head(old.linked_project_id,old.org_id,auth.uid()),false)
  and not coalesce(eflow_publication.planning_lead(old.linked_project_id,old.org_id),false) then
  raise exception 'Root task contributors are read-only for the Task Lead after the project becomes active'
   using errcode='42501';
 end if;
 return new;
end
$$;
revoke all on function eflow_publication.guard_active_root_contributor_change() from public,anon,authenticated,service_role;
drop trigger if exists aaa_active_root_contributor_lock on public.tasks;
create trigger aaa_active_root_contributor_lock
 before update of team_member_ids on public.tasks
 for each row execute function eflow_publication.guard_active_root_contributor_change();

-- Nested work snapshots and reviewed mutations can take longer than the
-- default 8-second authenticated-role timeout. Keep the higher ceiling local
-- to these RPCs and Task cancellation; leave the database-wide limit intact.
alter function public.r7_work_tree(uuid) set statement_timeout = '15s';
alter function public.r7_work_command(uuid,integer,uuid,text,jsonb) set statement_timeout = '15s';
alter function public.nw_work_impact(uuid,integer,text,jsonb) set statement_timeout = '15s';
alter function public.nw_work_command(uuid,integer,uuid,text,jsonb,text) set statement_timeout = '15s';
alter function public.nw_work_command_receipt(uuid,uuid,text,jsonb) set statement_timeout = '15s';
alter function public.cancel_task(uuid,text) set statement_timeout = '15s';

notify pgrst, 'reload schema';
commit;
