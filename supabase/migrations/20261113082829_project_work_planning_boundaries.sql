begin;
set local lock_timeout = '10s';

create or replace function eflow_phase7.material_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  project_id uuid;
  previous_project_id uuid;
  project_row public.projects;
begin
  if tg_table_name = 'tasks' then
    if tg_op <> 'DELETE' then project_id := new.linked_project_id; end if;
    if tg_op <> 'INSERT' then previous_project_id := old.linked_project_id; end if;
    if tg_op = 'UPDATE' and
      row(new.description, new.org_id, new.start_date, new.deadline, new.dependency_ids,
          new.budget_impact, new.deleted_at, new.linked_project_id, new.acceptance_criteria,
          new.definition_of_done, new.status = 'cancelled') is not distinct from
      row(old.description, old.org_id, old.start_date, old.deadline, old.dependency_ids,
          old.budget_impact, old.deleted_at, old.linked_project_id, old.acceptance_criteria,
          old.definition_of_done, old.status = 'cancelled')
    then return null; end if;

    -- Preserve serialization with readiness review and activation.
    perform 1 from public.projects p
      where p.id in (project_id, previous_project_id) order by p.id for update;
    return null;
  end if;

  if tg_op <> 'DELETE' then project_id := new.project_id; end if;
  if tg_op <> 'INSERT' then previous_project_id := old.project_id; end if;
  if tg_op = 'UPDATE' and
    row(new.office_id, new.relationship_type, new.invitation_status) is not distinct from
    row(old.office_id, old.relationship_type, old.invitation_status)
  then return null; end if;

  for project_row in select p.* from public.projects p
    where p.id in (project_id, previous_project_id) order by p.id for update
  loop
    if project_row.source_collaboration_draft_id is null and project_row.status = 'active' then
      update public.projects set status = 'on_hold', updated_at = now() where id = project_row.id;
      insert into public.audit_events(actor_id, entity_type, entity_id, action, org_id, after_data)
        values (auth.uid(), 'project', project_row.id::text, 'project.material_change_review',
          project_row.org_id, jsonb_build_object('source', tg_table_name, 'status', 'on_hold'));
    end if;
  end loop;
  return null;
end $$;

create function eflow_phase7.guard_direct_project_subtask()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.parent_subtask_id is null then return new; end if;
  if tg_op = 'UPDATE' and row(new.task_id, new.parent_subtask_id)
    is not distinct from row(old.task_id, old.parent_subtask_id)
  then return new; end if;

  if exists (select 1 from public.tasks t
    where t.id = new.task_id and t.linked_project_id is not null)
  then
    raise exception 'Add subtasks directly to a project task.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function eflow_phase7.guard_direct_project_subtask() from public, anon, authenticated;

create trigger phase7_direct_project_subtask
  before insert or update of task_id, parent_subtask_id on public.subtasks
  for each row execute function eflow_phase7.guard_direct_project_subtask();

-- Ordinary settings saves retain the original setup receipt. Readiness still
-- evaluates the current definition, funding and lead on every check.
do $migration$
declare
  definition text := pg_get_functiondef('eflow_project.save_details(uuid,jsonb)'::regprocedure);
  old_assignment constant text := ',setup_completed_at=null,updated_at=';
begin
  if strpos(definition, old_assignment) = 0 then
    raise exception 'Expected project definition save contract is missing';
  end if;
  execute replace(definition, old_assignment, ',updated_at=');
end $migration$;

create function eflow_phase7.guard_project_lead_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  bound_project_id uuid;
begin
  if tg_table_name = 'project_members' then
    if tg_op = 'UPDATE' and row(new.project_id, new.user_id)
      is not distinct from row(old.project_id, old.user_id) then return new; end if;
    bound_project_id := old.project_id;
  else
    if tg_op = 'UPDATE' and row(new.project_office_id, new.user_id, new.access_end, new.access_ended_at)
      is not distinct from row(old.project_office_id, old.user_id, old.access_end, old.access_ended_at)
    then return new; end if;
    if tg_op = 'UPDATE' and new.project_office_id = old.project_office_id and new.user_id = old.user_id
      and new.access_ended_at is null and new.access_end is null then return new; end if;
    select project_id into bound_project_id from public.project_offices
      where id = old.project_office_id and relationship_type = 'lead';
  end if;

  if exists (select 1 from public.projects p where p.id = bound_project_id
    and p.project_lead_id = old.user_id) then
    raise exception 'Appoint a different Project Lead before removing this person from the project team.'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function eflow_phase7.guard_project_lead_membership() from public, anon, authenticated;

create trigger phase7_project_lead_membership
  before delete or update of project_id, user_id on public.project_members
  for each row execute function eflow_phase7.guard_project_lead_membership();
create trigger phase7_project_lead_membership
  before delete or update of project_office_id, user_id, access_end, access_ended_at on public.project_office_members
  for each row execute function eflow_phase7.guard_project_lead_membership();

create function eflow_project.create_draft_once(p_payload jsonb, p_key uuid)
returns public.projects language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  receipt eflow_project.commands;
  project_row public.projects;
  payload jsonb := jsonb_build_object('operation', 'create_draft', 'details', p_payload);
begin
  if p_key is null or actor is null
    or not coalesce(public.phase2_is_office_head(actor, (p_payload->>'org_id')::uuid),false)
  then raise exception 'Only the appointed Office Head can create a project draft' using errcode = '42501'; end if;
  if p_payload->>'status' is distinct from 'planning'
    or (p_payload->>'owner_id')::uuid is distinct from actor
    or coalesce(p_payload->'member_ids','[]'::jsonb) <> '[]'::jsonb
  then raise exception 'Invalid project draft creation request' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended('project-draft:' || actor::text || ':' || p_key::text, 0));
  select * into receipt from eflow_project.commands where actor_id = actor and request_id = p_key;
  if found then
    if receipt.payload is distinct from payload then
      raise exception 'Project draft request ID was reused with different details' using errcode = '22023';
    end if;
    select * into project_row from public.projects p where p.id = (receipt.result->>'projectId')::uuid
      and p.org_id = (p_payload->>'org_id')::uuid and p.created_by = actor;
    if not found then raise exception 'The saved project draft is no longer available' using errcode = 'P0002'; end if;
    return project_row;
  end if;

  select * into project_row from public.create_project_with_details(p_payload);
  insert into eflow_project.commands(actor_id, request_id, payload, result)
    values (actor, p_key, payload, jsonb_build_object('projectId',project_row.id));
  insert into public.audit_events(actor_id, entity_type, entity_id, action, org_id, after_data)
    values (actor, 'project', project_row.id::text, 'project.created', project_row.org_id,
      jsonb_build_object('title', project_row.title, 'status', project_row.status, 'priority', project_row.priority));
  return project_row;
end $$;

create function public.create_project_draft_once(p_payload jsonb, p_key uuid)
returns public.projects language sql security invoker set search_path = '' as $$
  select * from eflow_project.create_draft_once(p_payload, p_key)
$$;

revoke all on function eflow_project.create_draft_once(jsonb, uuid), public.create_project_draft_once(jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function eflow_project.create_draft_once(jsonb, uuid), public.create_project_draft_once(jsonb, uuid)
  to authenticated;
notify pgrst, 'reload schema';

commit;
