-- Linked prerequisites permit preparation but gate final submission/approval.
create or replace function public.guard_task_dependency_completion()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare required_count integer; completed_count integer;
begin
  if new.status::text not in ('for_review','completed') or cardinality(coalesce(new.dependency_ids,'{}'::uuid[]))=0 then return new; end if;
  required_count := cardinality(new.dependency_ids);
  perform 1 from public.tasks t where t.id=any(new.dependency_ids) order by t.id for share;
  select count(*) into completed_count from public.tasks t
    where t.id=any(new.dependency_ids) and t.linked_project_id is not distinct from new.linked_project_id and t.status::text='completed';
  if completed_count<>required_count then
    raise exception 'Wait for prerequisite task approval before final submission.' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function public.guard_task_dependency_completion() from public, anon, authenticated;
create trigger tasks_00_dependency_completion before insert or update of status, dependency_ids on public.tasks
for each row execute function public.guard_task_dependency_completion();
