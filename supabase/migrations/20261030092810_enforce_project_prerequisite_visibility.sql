-- Limit new guards to project work and verify prerequisite visibility before exposing titles.
create or replace function eflow_project.guard_dependencies() returns trigger language plpgsql security definer set search_path='' as $$
declare pending_titles text;candidate uuid;
begin
 if tg_op='DELETE' then
 if old.linked_project_id is null then return old;end if;
 if exists(select 1 from public.tasks where old.id=any(dependency_ids) and deleted_at is null and status<>'cancelled') then raise exception 'Remove this task from dependent tasks before deleting it' using errcode='23514';end if;return old;
 end if;
 if new.linked_project_id is null then return new;end if;
 if cardinality(coalesce(new.dependency_ids,'{}'::uuid[]))>0 then
 perform pg_advisory_xact_lock(hashtextextended('eflow:project-dependencies:'||coalesce(new.linked_project_id,new.id)::text,0));
 if new.id=any(new.dependency_ids) or cardinality(new.dependency_ids)<>(select count(distinct id) from unnest(new.dependency_ids) id) then raise exception 'A task cannot depend on itself or select a prerequisite twice' using errcode='23514';end if;
 if exists(select 1 from unnest(new.dependency_ids) prerequisite(id) where not exists(select 1 from public.tasks t where t.id=prerequisite.id and t.linked_project_id is not distinct from new.linked_project_id and t.deleted_at is null and t.archived_at is null and t.status<>'cancelled' and (auth.uid() is null or public.can_see_task(t.id,auth.uid())))) then raise exception 'Choose existing, available prerequisites from this project' using errcode='23514';end if;
 if exists(with recursive chain as(select t.id,t.dependency_ids,array[t.id] path from public.tasks t where t.id=any(new.dependency_ids) union all select t.id,t.dependency_ids,c.path||t.id from public.tasks t join chain c on t.id=any(c.dependency_ids) where not t.id=any(c.path)) select 1 from chain where new.id=any(dependency_ids)) then raise exception 'Dependencies cannot form a circular chain' using errcode='23514';end if;
 if new.status in ('in_progress','for_review','completed') then
 select string_agg(t.title,', ') into pending_titles from public.tasks t where t.id=any(new.dependency_ids) and t.status<>'completed';
 if pending_titles is not null then raise exception 'This task is blocked until every prerequisite is completed and approved: %',pending_titles using errcode='23514';end if;
 end if;
 if new.start_date is not null and exists(select 1 from public.tasks t where t.id=any(new.dependency_ids) and t.status<>'completed' and coalesce(t.due_date::date,(nullif(t.deadline,'')::timestamptz at time zone 'Asia/Manila')::date)>new.start_date::date) then raise exception 'Task start date is earlier than a prerequisite due date. Adjust the schedule first' using errcode='23514';end if;
 end if;
 if tg_op='UPDATE' and (old.status='completed' and new.status<>'completed' or old.deleted_at is null and new.deleted_at is not null) and exists(select 1 from public.tasks t where old.id=any(t.dependency_ids) and t.deleted_at is null and t.status in ('in_progress','for_review','completed')) then raise exception 'Resolve started or approved dependent tasks before reopening or deleting this prerequisite' using errcode='23514';end if;
 return new;
end $$;
