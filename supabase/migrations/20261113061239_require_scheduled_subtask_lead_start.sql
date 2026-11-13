begin;

-- Keep the old scheduler entry points inert for installed jobs and callers.
create or replace function eflow_m7.activate_root_children(p_root uuid)
returns integer language sql security definer set search_path='' as $$select 0$$;
create or replace function eflow_m7.activate_scheduled_subtasks(p_limit integer default 50)
returns integer language sql security definer set search_path='' as $$select 0$$;

do $migration$
begin
 perform eflow_m7.replace_body_part('eflow_m7.schedule_node()',
  'new.started_at := statement_timestamp();',
  'null; -- Subtask activation requires an explicit Lead command.');
end $migration$;

create or replace function eflow_m7.guard_root_start()
returns trigger language plpgsql security definer set search_path='' as $$
declare lead uuid; root jsonb;
begin
 if new.status='in_progress' and old.status in ('todo','pending_assignment','changes_requested') then
  if tg_table_name='tasks' then lead:=old.assigned_to; else lead:=old.lead_id; end if;
  root:=eflow_r7.root(new.id);
  if lead is null or lead is distinct from auth.uid() or not coalesce(eflow_r3.eligible(lead),false)
     or root is not null and not coalesce(eflow_r7.read_root(new.id),false) then
   raise exception 'Only the appointed Task Lead can start this task' using errcode='42501';
  end if;
  if tg_table_name='tasks' and old.status in ('todo','pending_assignment')
     and (to_jsonb(old)->>'start_date')::date is distinct from eflow_m7.work_day(new.id) then
   raise exception 'Start work is available on the planned start date' using errcode='22023';
  end if;
 end if;
 return new;
end $$;

-- Existing in-progress/finished rows remain usable. Unstarted legacy rows
-- require a planned date before starting, just like newly scheduled rows.
create or replace function eflow_m7.node_activated(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subtasks s join public.tasks t on t.id=s.task_id
  where s.id=p_node and t.id=p_root and t.deleted_at is null
    and t.status not in ('todo','pending_assignment')
    and (s.started_at is not null or s.status in ('in_progress','stuck','changes_requested','for_review','completed')));
$$;
create or replace function eflow_m7.personal_node_activated(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.personal_subtasks s join public.personal_tasks t on t.id=s.task_id
  where s.id=p_node and t.id=p_root and t.status<>'todo'
    and (s.started_at is not null or s.status in ('in_progress','changes_requested','for_review','completed')));
$$;

create function public.m7_start_subtask(p_root uuid,p_node uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=eflow_r3.actor(); r jsonb; n eflow_r7.nodes; planned date; started timestamptz;
begin
 if not eflow_r7.read_root(p_root) then raise exception 'Current work access is required' using errcode='42501'; end if;
 perform eflow_r7.lock_impact(p_root);
 r:=eflow_r7.root(p_root);
 if r->>'kind'='office' then
  perform 1 from public.tasks where id=p_root for update;
 else
  perform 1 from public.personal_tasks where id=p_root for update;
 end if;
 r:=eflow_r7.root(p_root);
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Current work access is required' using errcode='42501'; end if;
 select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
 if n.id is null or n.lead_id is distinct from actor then
  raise exception 'Only the appointed Subtask Lead can start this subtask' using errcode='42501';
 end if;
 if not coalesce((r->>'open')::boolean,false) or r->>'status'<>'in_progress' then
  raise exception 'The parent task must be in progress before starting this subtask' using errcode='22023';
 end if;
 if r->>'kind'='office' then
  if not exists(select 1 from public.projects where id=(r->>'project')::uuid and status='active') then
   raise exception 'Project is on hold' using errcode='22023';
  end if;
  select start_date,started_at into planned,started from public.subtasks where id=p_node and task_id=p_root for update;
 else
  if not exists(select 1 from public.personal_projects where id=(r->>'project')::uuid and status='active') then
   raise exception 'This project is closed' using errcode='22023';
  end if;
  select start_date,started_at into planned,started from public.personal_subtasks where id=p_node and task_id=p_root for update;
 end if;
 if started is not null then return jsonb_build_object('id',p_node,'started_at',started); end if;
 if n.status<>'todo' or planned is distinct from eflow_m7.work_day(p_root) then
  raise exception 'Start work is available on the planned start date' using errcode='22023';
 end if;
 if n.parent_subtask_id is not null and not exists (
  select 1 from eflow_r7.nodes parent where parent.id=n.parent_subtask_id and parent.task_id=p_root
   and case when r->>'kind'='office' then eflow_m7.node_activated(p_root,parent.id)
            else eflow_m7.personal_node_activated(p_root,parent.id) end
 ) then raise exception 'Start the parent subtask first' using errcode='22023'; end if;
 if not n.is_standalone and exists(select 1 from eflow_r7.nodes s where s.task_id=p_root
  and s.parent_subtask_id is not distinct from n.parent_subtask_id and s.sibling_order<n.sibling_order
  and not s.is_standalone and s.status<>'completed') then
  raise exception 'Complete earlier subtasks before starting this subtask' using errcode='22023';
 end if;
 insert into eflow_m7.activation values(txid_current(),p_root);
 if r->>'kind'='office' then
  update public.subtasks set started_at=statement_timestamp() where id=p_node returning started_at into started;
 else
  update public.personal_subtasks set started_at=statement_timestamp() where id=p_node returning started_at into started;
 end if;
 delete from eflow_m7.activation where tx=txid_current() and root=p_root;
 return jsonb_build_object('id',p_node,'started_at',started);
end $$;
revoke all on function public.m7_start_subtask(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.m7_start_subtask(uuid,uuid) to authenticated;

-- Keep the existing create route and defaults for legacy callers. The dated
-- route uses the same authorization and validates both dates under the lock.
create function public.m7_create_scheduled_task(p_project uuid,p_group uuid,p_title text,p_start date,p_due date)
returns public.tasks language plpgsql security invoker set search_path='' as $$
declare p public.projects; t public.tasks;
begin
 select * into p from public.projects where id=p_project for update;
 if not found or not public.can_manage_project(p_project,auth.uid()) then
  raise exception 'Only the responsible Office Head can add project work' using errcode='42501';
 end if;
 if p.start_date is null or p.target_date is null or p_start is null or p_due is null
   or p_start < p.start_date or p_due > p.target_date or p_due < p_start then
  raise exception 'Choose task dates within the project schedule' using errcode='22023';
 end if;
 t:=public.phase3_create_task(p_project,p_group,p_title);
 return public.phase3_patch_task(t.id,jsonb_build_object('start_date',p_start,'deadline',p_due));
end $$;
revoke all on function public.m7_create_scheduled_task(uuid,uuid,text,date,date) from public,anon,authenticated,service_role;
grant execute on function public.m7_create_scheduled_task(uuid,uuid,text,date,date) to authenticated;

notify pgrst, 'reload schema';
commit;
