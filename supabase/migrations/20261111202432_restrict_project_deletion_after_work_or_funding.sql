create function eflow_project.project_deletion_blockers(p_project_id uuid)
returns text[] language sql stable security definer set search_path = '' as $$
  with project_tasks as (
    select id, status, deleted_at from public.tasks where linked_project_id = p_project_id
  ), task_cash as (
    select r.status, r.actual_spent
    from project_tasks t join public.petty_cash_requests r on r.task_id = t.id
  )
  select array_remove(array[
    case when exists (select 1 from project_tasks where deleted_at is null)
      then 'This project still has tasks, including any cancelled or archived tasks.' end,
    case when exists (select 1 from eflow_project.funding where project_id = p_project_id and amount > 0)
      or exists (
        select 1 from public.budget_commitments c
        where c.authorization_payload->>'projectId' = p_project_id::text
          and c.status = 'active' and c.amount > 0
      )
      or exists (
        select 1 from project_tasks t
        join public.work_budget_allocations a on a.task_id = t.id
        join public.budget_commitments c on c.id = a.commitment_id
        where a.status = 'approved' and a.amount > 0 and c.status = 'active'
      )
      then 'This project still has committed funds. Return unused funds in Project settings → Project budget.' end,
    case when exists (select 1 from eflow_project.funding_requests where project_id = p_project_id and status = 'pending')
      or exists (select 1 from project_tasks t join public.work_budget_allocations a on a.task_id = t.id where a.status = 'pending')
      or exists (select 1 from task_cash where status not in ('settled', 'rejected', 'cancelled'))
      then 'This project has open funding or cash requests. Resolve them before deleting it.' end,
    case when exists (
        select 1 from public.projects where id = p_project_id and (completed_at is not null or status = 'completed')
      )
      or exists (
        select 1 from public.audit_events
        where entity_type = 'project' and entity_id = p_project_id::text and action = 'project.completed'
      )
      or exists (select 1 from project_tasks where status = 'completed')
      or exists (
        select 1 from project_tasks t join public.task_status_history h on h.task_id = t.id
        where h.from_status = 'completed' or h.to_status = 'completed'
      )
      or exists (select 1 from project_tasks t join public.task_submissions s on s.task_id = t.id where s.status = 'approved')
      or exists (
        select 1 from project_tasks t join public.subtasks s on s.task_id = t.id
        where s.status = 'completed' or s.is_completed or s.completed_at is not null
      )
      or exists (select 1 from project_tasks t join public.subtask_submissions s on s.task_id = t.id where s.status = 'approved')
      then 'This project has completed work and must be kept for its history.' end,
    case when exists (select 1 from task_cash where actual_spent > 0)
      then 'This project has spending history and must be kept for its records.' end
  ], null);
$$;

create function public.get_project_deletion_blockers(p_project_id uuid)
returns text[] language plpgsql stable security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
begin
  if not exists (
    select 1 from public.profiles p
    join public.projects project on project.id = p_project_id
    where p.id = caller and p.is_active and p.role::text = 'head'
      and public.org_in_my_subtree(project.org_id, caller)
      and public.can_manage_project(project.id, caller)
  ) then
    raise exception 'Only an active Head for this project can check deletion.' using errcode = '42501';
  end if;

  return eflow_project.project_deletion_blockers(p_project_id);
end;
$$;

create function eflow_project.assert_project_deletable(p_project_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  blockers text[] := eflow_project.project_deletion_blockers(p_project_id);
begin
  if cardinality(blockers) > 0 then
    raise exception 'This project cannot be deleted.' using
      errcode = '23514', detail = array_to_string(blockers, ' ');
  end if;
end;
$$;

create function eflow_project.guard_project_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform eflow_project.assert_project_deletable(old.id);
  return old;
end;
$$;

create trigger zz_check_project_deletion_blockers
  before delete on public.projects
  for each row execute function eflow_project.guard_project_delete();

revoke all on function eflow_project.project_deletion_blockers(uuid),
  eflow_project.assert_project_deletable(uuid), eflow_project.guard_project_delete()
  from public, anon, authenticated;
revoke all on function public.get_project_deletion_blockers(uuid) from public, anon;
grant execute on function public.get_project_deletion_blockers(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.delete_project_permanently(p_project_id uuid, p_expected_title text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  project_row public.projects;
  retained_task_count int;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role::text, full_name
    into caller_role, caller_name
  from public.profiles
  where id = caller and is_active;

  if caller_role is distinct from 'head' then
    raise exception 'Only an active Head may permanently delete a project'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project_id::text,0));

  select * into project_row
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if not coalesce(public.org_in_my_subtree(project_row.org_id, caller),false)
     or not coalesce(public.can_manage_project(p_project_id,caller),false) then
    raise exception 'This project is outside your organization scope'
      using errcode = '42501';
  end if;

  if coalesce(p_expected_title, '') <> project_row.title then
    raise exception 'Type the exact project title to confirm deletion'
      using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A deletion reason of at least 5 characters is required'
      using errcode = '22023';
  end if;

  perform eflow_project.assert_project_deletable(p_project_id);

  select count(*)::int into retained_task_count
  from public.tasks
  where linked_project_id = p_project_id and deleted_at is null;

  -- Private transaction-scoped authority; clients cannot create this context.
  insert into eflow_phase6.project_deletions(tx,actor,project_id)
  values(txid_current(),caller,p_project_id);

  update public.tasks
  set linked_project_id = null,
      milestone_id = null,
      group_id = null
  where linked_project_id = p_project_id;

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'Administrator'), 'project', p_project_id::text,
    'project.deleted', btrim(p_reason),
    jsonb_build_object(
      'title', project_row.title,
      'status', project_row.status,
      'ownerId', project_row.owner_id,
      'retainedTaskCount', retained_task_count,
      'guestMemberships',(select coalesce(jsonb_agg(to_jsonb(gm)),'[]') from public.project_guest_members gm where gm.project_id=p_project_id)
    ),
    jsonb_build_object('deleted', true, 'taskLinksCleared', retained_task_count),
    project_row.org_id
  );

  delete from public.project_guest_members where project_id=p_project_id;
  delete from public.projects where id = p_project_id;
  delete from eflow_phase6.project_deletions
  where tx=txid_current() and actor=caller and project_id=p_project_id;
  return p_project_id;
end;
$function$;
notify pgrst, 'reload schema';
