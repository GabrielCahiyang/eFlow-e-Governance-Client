create table public.work_status_definitions (
  id text primary key default gen_random_uuid()::text,
  label text not null check (char_length(btrim(label)) between 1 and 50),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 100 check (position between 0 and 999),
  scope text not null check (scope in ('builtin','task','subtask','both')),
  retired boolean not null default false,
  check (
    (scope='builtin' and not retired and id in (
      'pending_assignment','todo','in_progress','stuck','for_review','changes_requested',
      'completed','cancelled','planning','active','on_hold','archived'
    )) or (scope<>'builtin' and id ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$')
  )
);
create unique index work_status_definitions_active_name
  on public.work_status_definitions (lower(regexp_replace(btrim(label),'\s+',' ','g')))
  where not retired;
alter table public.work_status_definitions enable row level security;
revoke all on public.work_status_definitions from public, anon, authenticated;
grant select, insert, update on public.work_status_definitions to authenticated;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
                     and schemaname='public' and tablename='work_status_definitions') then
    alter publication supabase_realtime add table public.work_status_definitions;
  end if;
end;
$$;
create policy work_status_read on public.work_status_definitions for select to authenticated
  using ((select public.auth_role(auth.uid())) is not null);
create policy work_status_insert on public.work_status_definitions for insert to authenticated
  with check ((select public.auth_role(auth.uid()))='admin');
create policy work_status_update on public.work_status_definitions for update to authenticated
  using ((select public.auth_role(auth.uid()))='admin')
  with check ((select public.auth_role(auth.uid()))='admin');

alter table public.tasks add column custom_status_id text references public.work_status_definitions(id);
alter table public.subtasks add column custom_status_id text references public.work_status_definitions(id);

create function eflow_r7.guard_custom_status() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.custom_status_id is not null then
      raise exception 'Choose a custom status after creating the work.' using errcode='42501';
    end if;
    return new;
  end if;
  if new.custom_status_id is distinct from old.custom_status_id
     and current_setting('eflow.work_custom_status',true) is distinct from 'on' then
    raise exception 'Use the custom status action to change this status.' using errcode='42501';
  end if;
  if new.status is distinct from old.status and new.status <> 'in_progress' then
    new.custom_status_id := null;
  end if;
  return new;
end;
$$;
create trigger guard_task_custom_status before insert or update of status,custom_status_id
  on public.tasks for each row execute function eflow_r7.guard_custom_status();
create trigger guard_subtask_custom_status before insert or update of status,custom_status_id
  on public.subtasks for each row execute function eflow_r7.guard_custom_status();
revoke all on function eflow_r7.guard_custom_status() from public,anon,authenticated;

create function eflow_r7.set_custom_status(p_task uuid, p_subtask uuid, p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare
  task_row public.tasks;
  step_row public.subtasks;
  actor_id uuid := auth.uid();
  previous_flag text := current_setting('eflow.work_custom_status',true);
begin
  perform eflow_r3.actor();
  perform eflow_r7.lock_impact(p_task);
  select * into task_row from public.tasks where id=p_task for update;
  if not found or task_row.deleted_at is not null or task_row.archived_at is not null
     or task_row.linked_project_id is null or task_row.proposed_office_identity_id is not null
     or not coalesce(eflow_r7.read_root(p_task),false)
     or not exists(select 1 from public.projects p where p.id=task_row.linked_project_id and p.status='active') then
    raise exception 'Custom statuses are available for active project work.' using errcode='42501';
  end if;
  if p_subtask is null then
    if task_row.status <> 'in_progress' or not coalesce(public.can_contribute_task(p_task,actor_id),false) then
      raise exception 'Only the task team can change the status of work in progress.' using errcode='42501';
    end if;
  else
    select * into step_row from public.subtasks where id=p_subtask and task_id=p_task for update;
    if not found or step_row.status <> 'in_progress'
       or not coalesce((eflow_r7.operation_capabilities(p_task,p_subtask)->'execute'->>'allowed')::boolean,false) then
      raise exception 'You need current permission to update this subtask.' using errcode='42501';
    end if;
  end if;
  if p_status is not null then
    perform 1 from public.work_status_definitions
      where id=p_status and not retired and scope in ('both',case when p_subtask is null then 'task' else 'subtask' end)
      for share;
    if not found then raise exception 'Choose an available status for this work.' using errcode='22023'; end if;
  end if;
  perform set_config('eflow.work_custom_status','on',true);
  if p_subtask is null then
    update public.tasks set custom_status_id=p_status where id=p_task and custom_status_id is distinct from p_status;
  else
    update public.subtasks set custom_status_id=p_status where id=p_subtask and custom_status_id is distinct from p_status;
  end if;
  perform set_config('eflow.work_custom_status',coalesce(previous_flag,'off'),true);
end;
$$;
revoke all on function eflow_r7.set_custom_status(uuid,uuid,text) from public,anon;
grant execute on function eflow_r7.set_custom_status(uuid,uuid,text) to authenticated;

create function public.set_work_custom_status(p_task uuid,p_subtask uuid,p_status text)
returns void language sql security invoker set search_path='' as
$$select eflow_r7.set_custom_status(p_task,p_subtask,p_status)$$;
revoke all on function public.set_work_custom_status(uuid,uuid,text) from public,anon;
grant execute on function public.set_work_custom_status(uuid,uuid,text) to authenticated;

-- Retain the existing authorized tree and attach each visible subtask's label reference.
create or replace function public.r7_work_tree(p_root uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v jsonb;
begin
  v := eflow_r7.snapshot(p_root);
  if v->'root'->>'kind' <> 'office' then return v; end if;
  v := jsonb_set(v,'{root,blocker}',coalesce((
    select to_jsonb(u.blocker) from public.task_progress_updates u
    where u.task_id=p_root order by u.created_at desc,u.id desc limit 1
  ),'null'::jsonb));
  return jsonb_set(v,'{nodes}',coalesce((select jsonb_agg(n.value || jsonb_build_object(
    'blocker',(select u.blocker from public.subtask_progress_updates u
      where u.task_id=p_root and u.subtask_id=s.id order by u.created_at desc,u.id desc limit 1),
    'custom_status_id',s.custom_status_id
  ) order by n.ordinality) from jsonb_array_elements(v->'nodes') with ordinality n
    left join public.subtasks s on s.task_id=p_root and s.id=(n.value->>'id')::uuid),'[]'::jsonb));
end;
$$;
