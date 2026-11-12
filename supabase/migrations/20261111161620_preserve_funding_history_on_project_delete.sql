alter table eflow_project.funding
  alter column project_id drop not null,
  add column deleted_project_id uuid,
  add constraint funding_project_reference check (num_nonnulls(project_id, deleted_project_id) = 1);

alter table eflow_project.funding_requests
  alter column project_id drop not null,
  add column deleted_project_id uuid,
  add constraint funding_request_project_reference check (num_nonnulls(project_id, deleted_project_id) = 1);

create function eflow_project.detach_funding_before_project_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from eflow_project.funding f
    where f.project_id = old.id and f.amount > 0
  ) then
    raise exception 'This project still has funding. Return unused funds in Project settings → Project budget before deleting it. Archive the project to keep any spending history together.'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from eflow_project.funding_requests r
    where r.project_id = old.id and r.status = 'pending'
  ) then
    raise exception 'Resolve pending funding requests in Project settings → Project budget before deleting this project.'
      using errcode = '23514';
  end if;

  -- Keep financial records and allocation links. Only clear the live project link.
  update eflow_project.funding
  set project_id = null, deleted_project_id = old.id
  where project_id = old.id;

  update eflow_project.funding_requests
  set project_id = null, deleted_project_id = old.id
  where project_id = old.id;

  return old;
end;
$$;

revoke all on function eflow_project.detach_funding_before_project_delete()
  from public, anon, authenticated;

create trigger zz_detach_funding_before_project_delete
  before delete on public.projects
  for each row execute function eflow_project.detach_funding_before_project_delete();
