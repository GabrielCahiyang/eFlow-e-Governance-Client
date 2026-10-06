-- Phase 3 adds presentation structure to canonical tasks; review, evidence and
-- financial records stay attached to their existing IDs and lifecycle RPCs.
begin;
set local lock_timeout = '10s';
create table public.project_groups (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 color text not null default '#087f8c' check(color ~ '^#[0-9a-fA-F]{6}$'),
 position integer not null default 0 check(position>=0),
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,project_id)
);
create unique index project_groups_default_idx on public.project_groups(project_id) where is_default;
create index project_groups_order_idx on public.project_groups(project_id,position,id);
alter table public.project_groups enable row level security;
revoke all on public.project_groups from public,anon,authenticated;
grant select,insert,update,delete on public.project_groups to authenticated;
grant all on public.project_groups to service_role;
create policy project_groups_read on public.project_groups for select to authenticated
 using(public.can_see_project(project_id,(select auth.uid())));
create policy project_groups_insert on public.project_groups for insert to authenticated
 with check(exists(select 1 from public.projects p where p.id=project_id and p.status not in ('completed','archived')
 and public.can_create_scoped_work(p.org_id,(select auth.uid())) and public.can_manage_project(p.id,(select auth.uid()))));
create policy project_groups_update on public.project_groups for update to authenticated
 using(exists(select 1 from public.projects p where p.id=project_id and p.status not in ('completed','archived') and public.can_create_scoped_work(p.org_id,(select auth.uid())) and public.can_manage_project(p.id,(select auth.uid()))))
 with check(exists(select 1 from public.projects p where p.id=project_id and p.status not in ('completed','archived') and public.can_create_scoped_work(p.org_id,(select auth.uid())) and public.can_manage_project(p.id,(select auth.uid()))));
create policy project_groups_delete on public.project_groups for delete to authenticated
 using(not is_default and exists(select 1 from public.projects p where p.id=project_id and p.status not in ('completed','archived') and public.can_create_scoped_work(p.org_id,(select auth.uid())) and public.can_manage_project(p.id,(select auth.uid()))));

-- Internal project trigger needs definer privileges: existing creation/import
-- RPCs must receive the default group atomically, including legacy clients.
create function public.phase3_default_project_group() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into public.project_groups(project_id,title,is_default) values(new.id,'To do',true);
 return new;
end; $$;
revoke all on function public.phase3_default_project_group() from public,anon,authenticated;
create trigger phase3_project_default_group after insert on public.projects
 for each row execute function public.phase3_default_project_group();
insert into public.project_groups(project_id,title,is_default) select id,'To do',true from public.projects;

alter table public.tasks add column group_id uuid, add column workspace_position integer not null default 0 check(workspace_position>=0), add column start_date date;
alter table public.tasks add constraint tasks_project_group_fk foreign key(group_id,linked_project_id)
 references public.project_groups(id,project_id) on delete no action deferrable initially deferred;
update public.tasks t set group_id=g.id from public.project_groups g where g.project_id=t.linked_project_id and g.is_default;
with ordered as (select id,row_number() over(partition by group_id order by created_at,id)-1 as n from public.tasks where group_id is not null)
 update public.tasks t set workspace_position=o.n from ordered o where o.id=t.id;
set constraints all immediate;
create index tasks_workspace_group_idx on public.tasks(group_id,workspace_position,id) where deleted_at is null;

create function public.phase3_guard_task_group() returns trigger language plpgsql set search_path='' as $$
begin
 if new.linked_project_id is null then new.group_id:=null;
 elsif new.group_id is null or (tg_op='UPDATE' and new.linked_project_id is distinct from old.linked_project_id) then
  select id into new.group_id from public.project_groups where project_id=new.linked_project_id and is_default;
 end if;
 if new.group_id is not null and not exists(select 1 from public.project_groups where id=new.group_id and project_id=new.linked_project_id) then
  raise exception 'Choose a group from this project' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function public.phase3_guard_task_group() from public,anon,authenticated;
create trigger phase3_task_group before insert or update of group_id,linked_project_id on public.tasks
 for each row execute function public.phase3_guard_task_group();

create function public.phase3_guard_group() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.project_id<>old.project_id or new.is_default<>old.is_default) then
  raise exception 'A group cannot change its project or default identity' using errcode='23514';
 end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.projects where id=old.project_id) then
   if old.is_default then raise exception 'Keep the default project group' using errcode='23514'; end if;
   if exists(select 1 from public.tasks where group_id=old.id) then raise exception 'Move the tasks before deleting this group' using errcode='23514'; end if;
  end if;
  return old;
 end if;
 new.updated_at:=now(); return new;
end; $$;
revoke all on function public.phase3_guard_group() from public,anon,authenticated;
create trigger phase3_group_guard before update or delete on public.project_groups for each row execute function public.phase3_guard_group();

create function public.phase3_create_task(p_project_id uuid,p_group_id uuid,p_title text) returns public.tasks
language plpgsql security invoker set search_path='' as $$
declare p public.projects; t public.tasks; n integer;
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or not public.can_create_scoped_work(p.org_id,auth.uid()) or not public.can_manage_project(p.id,auth.uid()) then
  raise exception 'Only the responsible Office Head can add project work' using errcode='42501'; end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023'; end if;
 if not exists(select 1 from public.project_groups where id=p_group_id and project_id=p.id) then raise exception 'Choose a group from this project' using errcode='22023'; end if;
 select coalesce(max(workspace_position)+1,0) into n from public.tasks where group_id=p_group_id;
 t:=public.create_task_with_details(jsonb_build_object('title',p_title,'description','','org_id',p.org_id,'linked_project_id',p.id,'project_id',p.id::text,'project_title',p.title,'priority','medium'));
 update public.tasks set group_id=p_group_id,workspace_position=n where id=t.id returning * into t;
 return t;
end; $$;
revoke all on function public.phase3_create_task(uuid,uuid,text) from public,anon;
grant execute on function public.phase3_create_task(uuid,uuid,text) to authenticated;

-- An explicit field allowlist prevents this workspace from changing lifecycle,
-- evidence, financial approvals, Office identity or protected source links.
create function public.phase3_patch_task(p_task_id uuid,p_patch jsonb) returns public.tasks
language plpgsql security invoker set search_path='' as $$
declare t public.tasks; p public.projects; k text; deps uuid[]; cycle_found boolean;
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid task changes' using errcode='22023'; end if;
 select * into t from public.tasks where id=p_task_id and deleted_at is null;
 if not found then raise exception 'Task not available' using errcode='42501'; end if;
 select * into p from public.projects where id=t.linked_project_id for update;
 if not found or not public.can_create_scoped_work(t.org_id,auth.uid()) or not public.can_manage_project(p.id,auth.uid()) or not public.can_manage_task(t.id,auth.uid()) then
  raise exception 'Only the responsible Office Head can edit project structure' using errcode='42501'; end if;
 -- Serialize dependency edits and re-read after the project lock.
 select * into t from public.tasks where id=p_task_id for update;
 if p.status in ('completed','archived') or t.archived_at is not null or t.status in ('completed','cancelled') then raise exception 'Completed or archived work is read-only' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('title','priority','deadline','start_date','estimated_hours','budget_impact','dependency_ids','group_id','workspace_position') then raise exception 'Protected task field: %',k using errcode='22023'; end if;
 end loop;
 if p_patch ? 'title' and (length(btrim(coalesce(p_patch->>'title',''))) not between 1 and 300) then raise exception 'Enter a task title (up to 300 characters)' using errcode='22023'; end if;
 if p_patch ? 'priority' and coalesce(p_patch->>'priority','') not in ('low','medium','high') then raise exception 'Invalid priority' using errcode='22023'; end if;
 if p_patch ? 'estimated_hours' and (coalesce((p_patch->>'estimated_hours')::numeric,0)<0 or coalesce((p_patch->>'estimated_hours')::numeric,0)>100000) then raise exception 'Effort must be between 0 and 100000 hours' using errcode='22023'; end if;
 if p_patch ? 'budget_impact' and (coalesce((p_patch->>'budget_impact')::numeric,0)<0 or coalesce((p_patch->>'budget_impact')::numeric,0)>1000000000000) then raise exception 'Invalid budget estimate' using errcode='22023'; end if;
 if p_patch ? 'dependency_ids' then
  if jsonb_typeof(p_patch->'dependency_ids')<>'array' or jsonb_array_length(p_patch->'dependency_ids')>100 then raise exception 'Invalid dependency list' using errcode='22023'; end if;
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into deps from jsonb_array_elements_text(p_patch->'dependency_ids');
  if exists(select 1 from unnest(deps) d where d=t.id or not exists(select 1 from public.tasks x where x.id=d and x.linked_project_id=p.id and x.deleted_at is null)) then raise exception 'Dependencies must be other available tasks in this project' using errcode='22023'; end if;
  with recursive edges(id,path) as (
   select d,array[d] from unnest(deps) d union all
   select d,e.path||d from edges e join public.tasks x on x.id=e.id cross join lateral unnest(x.dependency_ids) d where not d=any(e.path)
  ) select exists(select 1 from edges where id=t.id) into cycle_found;
  if cycle_found then raise exception 'Dependencies cannot form a cycle' using errcode='22023'; end if;
 end if;
 update public.tasks set
  title=case when p_patch ? 'title' then btrim(p_patch->>'title') else title end,
  priority=case when p_patch ? 'priority' then p_patch->>'priority' else priority end,
  deadline=case when p_patch ? 'deadline' then coalesce(p_patch->>'deadline','') else deadline end,
  due_date=case when p_patch ? 'deadline' then coalesce(p_patch->>'deadline','') else due_date end,
  start_date=case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else start_date end,
  estimated_hours=case when p_patch ? 'estimated_hours' then coalesce((p_patch->>'estimated_hours')::double precision,0) else estimated_hours end,
  budget_impact=case when p_patch ? 'budget_impact' then coalesce((p_patch->>'budget_impact')::double precision,0) else budget_impact end,
  dependency_ids=case when p_patch ? 'dependency_ids' then deps else dependency_ids end,
  group_id=case when p_patch ? 'group_id' then (p_patch->>'group_id')::uuid else group_id end,
  workspace_position=case when p_patch ? 'workspace_position' then (p_patch->>'workspace_position')::integer else workspace_position end
 where id=t.id returning * into t;
 if t.start_date is not null and nullif(t.deadline,'') is not null and t.start_date>t.deadline::timestamptz::date then raise exception 'Start date must precede the due date' using errcode='22023'; end if;
 return t;
end; $$;
revoke all on function public.phase3_patch_task(uuid,jsonb) from public,anon;
grant execute on function public.phase3_patch_task(uuid,jsonb) to authenticated;

-- Project/task mutations already have audit triggers. Add the equivalent for
create function public.phase3_reorder_tasks(p_project_id uuid,p_group_id uuid,p_ids uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare p public.projects; actual uuid[];
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or not public.can_create_scoped_work(p.org_id,auth.uid()) or not public.can_manage_project(p.id,auth.uid()) then raise exception 'Only the Office Head can order project work' using errcode='42501'; end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023'; end if;
 if not exists(select 1 from public.project_groups where id=p_group_id and project_id=p.id) then raise exception 'Choose a group from this project' using errcode='22023'; end if;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into actual from public.tasks where group_id=p_group_id and deleted_at is null and archived_at is null;
 if cardinality(p_ids)<>cardinality(actual) or (select array_agg(id order by id) from unnest(p_ids) id) is distinct from nullif(actual,'{}'::uuid[]) then raise exception 'Task order changed. Refresh the table and retry.' using errcode='22023'; end if;
 if exists(select 1 from public.tasks where id=any(p_ids) and (not public.can_manage_task(id,auth.uid()) or not public.can_create_scoped_work(org_id,auth.uid()))) then raise exception 'You cannot order another Office work' using errcode='42501'; end if;
 update public.tasks t set workspace_position=x.n-1 from unnest(p_ids) with ordinality x(id,n) where t.id=x.id;
end; $$;
revoke all on function public.phase3_reorder_tasks(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.phase3_reorder_tasks(uuid,uuid,uuid[]) to authenticated;

-- Project/task mutations already have audit triggers. Add the equivalent for
-- the new group records without changing existing audit tables or policies.
create function public.phase3_audit_group() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid; oid uuid; gid uuid;
begin
 if tg_op='DELETE' then pid:=old.project_id;gid:=old.id;else pid:=new.project_id;gid:=new.id;end if;
 select org_id into oid from public.projects where id=pid;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,before_data,after_data,org_id)
 values(auth.uid(),'project',pid::text,'project.group.'||lower(tg_op),case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end,oid);
 if tg_op='DELETE' then return old;else return new;end if;
end; $$;
revoke all on function public.phase3_audit_group() from public,anon,authenticated;
create trigger phase3_group_audit after insert or update or delete on public.project_groups for each row execute function public.phase3_audit_group();
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='project_groups') then
  alter publication supabase_realtime add table public.project_groups;
 end if;
end $$;
commit;
