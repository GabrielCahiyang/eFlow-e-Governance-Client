-- Enforce Project On-Hold Work Restrictions and Subtask Execution Authorization
-- When parent project is on_hold, tasks and subtasks are readable but execution-locked.
-- Subtask execution requires appointed Subtask Lead or assigned Contributor (no manager bypass).

begin;

-- 1. eflow_r7.root: include project_status in root facts
create or replace function eflow_r7.root(p_root uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((
   select jsonb_build_object(
     'id', t.id,
     'project', t.linked_project_id,
     'office', t.org_id,
     'lead', coalesce(t.assigned_to, t.recommendation_lead_id),
     'kind', 'office',
     'status', t.status,
     'open', t.deleted_at is null and t.archived_at is null and t.proposed_office_identity_id is null and t.status not in ('for_review','completed','cancelled') and p.status not in ('completed','archived'),
     'people', coalesce(t.team_member_ids, '{}'::uuid[]),
     'due', coalesce(nullif(left(t.due_date, 10), ''), nullif(left(t.deadline, 10), '')),
     'project_status', p.status
   )
   from public.tasks t
   join public.projects p on p.id = t.linked_project_id
   where t.id = p_root and t.source_collaboration_draft_id is null and p.source_collaboration_draft_id is null
 ), (
   select jsonb_build_object(
     'id', t.id,
     'project', t.project_id,
     'office', null,
     'lead', t.lead_id,
     'kind', 'personal',
     'status', t.status,
     'open', p.status = 'active' and t.status not in ('submitted', 'done'),
     'owner', w.owner_id,
     'people', array[t.lead_id],
     'due', null,
     'project_status', p.status
   )
   from public.personal_tasks t
   join public.personal_projects p on p.id = t.project_id
   join public.workspaces w on w.id = p.workspace_id
   where t.id = p_root
 ))
$$;

-- 2. eflow_r7.operation_capabilities: enforce project_on_hold and remove manager bypass on subtasks
create or replace function eflow_r7.operation_capabilities(p_root uuid, p_node uuid default null::uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 r jsonb := eflow_r7.root(p_root);
 n eflow_r7.nodes;
 actions text[] := case when p_node is null then
  array['manage_contributors','appoint_lead','create_child','order_children'] else
  array['manage_contributors','appoint_lead','create_child','edit_details','move','order_children','delete','execute','submit','review'] end;
 action text;
 reason text;
 common_reason text;
 result jsonb := '{}';
 manager boolean;
 untouched boolean;
 descendants_complete boolean;
 ordered_ready boolean;
 node_depth integer;
begin
 if r is null or auth.uid() is null or not coalesce(eflow_r7.read_root(p_root), false) then
  common_reason := 'access_unavailable';
 elsif not coalesce(eflow_r3.eligible(auth.uid()), false) then
  common_reason := 'read_only';
 elsif not coalesce((r->>'open')::boolean, false) then
  common_reason := 'lifecycle_blocked';
 end if;

 if p_node is not null then
  select * into n from eflow_r7.nodes where id = p_node and task_id = p_root;
  if not found then common_reason := 'access_unavailable'; end if;
 end if;

 if common_reason is null then
  manager := coalesce(eflow_r7.manage(p_root, p_node), false);
  if p_node is not null then
   with recursive below as (
    select * from eflow_r7.nodes where id = p_node and task_id = p_root
    union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id = b.id where c.task_id = p_root
   ) select not exists(select 1 from below where status <> 'todo' or percent_complete <> 0),
    not exists(select 1 from below where id <> p_node and status <> 'completed')
    into untouched, descendants_complete;
   with recursive above as (
    select id, parent_subtask_id, 1 depth from eflow_r7.nodes where id = p_node and task_id = p_root
    union all select c.id, c.parent_subtask_id, a.depth + 1 from eflow_r7.nodes c join above a on c.id = a.parent_subtask_id where c.task_id = p_root and a.depth < 8
   ) select max(depth) into node_depth from above;
   ordered_ready := n.is_standalone or not exists(select 1 from eflow_r7.nodes c
    where c.task_id = p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id
    and c.sibling_order < n.sibling_order and not c.is_standalone and c.status <> 'completed');
  end if;
 end if;

 foreach action in array actions loop
  reason := common_reason;
  if reason is null then
   if action = 'appoint_lead' then
    if not coalesce(case when p_node is null then eflow_r7.head(p_root)
     else eflow_r7.manage(p_root, p_node, true) end, false) then reason := 'appointment_denied';
    elsif p_node is not null and n.status = 'completed' then reason := 'lifecycle_blocked'; end if;
   elsif action in ('execute', 'submit') then
    if r->>'project_status' = 'on_hold' then
     reason := 'project_on_hold';
    elsif p_node is not null then
     -- Subtask execution authorization: ONLY appointed Subtask Lead or assigned Contributor!
     -- Project Lead, Office Head, and Task Lead roles do NOT automatically grant execution permissions.
     if not coalesce(eflow_r7.node_work(p_node, auth.uid()), false) then
      reason := 'branch_denied';
     elsif n.status = 'completed' or r->>'kind' = 'office' and r->>'status' not in ('todo', 'in_progress', 'changes_requested') then
      reason := 'lifecycle_blocked';
     elsif not ordered_ready or action = 'submit' and not descendants_complete then
      reason := 'lifecycle_blocked';
     end if;
    else
     -- Root Task execution
     if not coalesce(manager, false) and (action = 'submit' or not coalesce(eflow_r7.node_work(p_node, auth.uid()), false)) then
      reason := 'branch_denied';
     elsif r->>'kind' = 'office' and r->>'status' not in ('todo', 'in_progress', 'changes_requested') then
      reason := 'lifecycle_blocked';
     end if;
    end if;
   elsif action = 'review' then
    reason := 'lifecycle_blocked'; -- Subitems complete directly; final task retains its review.
   elsif not manager then reason := 'branch_denied';
   elsif action = 'manage_contributors' then
    if p_node is null and r->>'kind' <> 'office' then reason := 'read_only';
    elsif p_node is null and r->>'lead' is null or p_node is not null and (n.lead_id is null or n.status = 'completed') then reason := 'lifecycle_blocked'; end if;
   elsif action = 'create_child' then
    if p_node is not null and (n.status <> 'todo' or n.percent_complete <> 0 or node_depth >= 8) then reason := 'lifecycle_blocked'; end if;
   elsif action = 'order_children' then
    if exists(select 1 from eflow_r7.nodes c where c.task_id = p_root
     and c.parent_subtask_id is not distinct from p_node and (c.status <> 'todo' or c.percent_complete <> 0)) then reason := 'lifecycle_blocked'; end if;
   elsif action in ('edit_details', 'move', 'delete') then
    if not untouched then reason := 'lifecycle_blocked';
    elsif action = 'delete' and r->>'kind' = 'office' and exists(
     with recursive below as (select id from eflow_r7.nodes where id = p_node and task_id = p_root
      union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id = b.id where c.task_id = p_root)
     select 1 from below b where
      exists(select 1 from public.subtask_progress_updates where subtask_id = b.id) or
      exists(select 1 from public.subtask_submissions where subtask_id = b.id) or
      exists(select 1 from public.work_budget_allocations where subtask_id = b.id) or
      exists(select 1 from public.petty_cash_requests where subtask_id = b.id) or
      exists(select 1 from public.budget_ledger_entries where subtask_id = b.id)
    ) then reason := 'history_blocked'; end if;
   end if;
  end if;

  /* NW5.1 history capability */
  if reason is null and action in ('create_child', 'order_children', 'move', 'delete') then
   if not (eflow_r7.operation_impact(p_root, case action when 'create_child' then 'create' when 'order_children' then 'order' else action end,
    case when action in ('create_child', 'order_children') then jsonb_build_object('parent', p_node) else jsonb_build_object('id', p_node, 'parent', n.parent_subtask_id) end)->>'allowed')::boolean then reason := 'history_blocked'; end if;
  end if;
  result := result || jsonb_build_object(action, jsonb_build_object('allowed', reason is null, 'reason_code', reason));
 end loop;
 return result;
end $$;

revoke all on function eflow_r7.operation_capabilities(uuid,uuid) from public,anon,authenticated,service_role;

-- 3. eflow_m7.work_scope_open: disallow proposing work when project is on_hold
create or replace function eflow_m7.work_scope_open(p_root uuid, p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r7.read_root(p_root), false) and coalesce(eflow_r3.eligible(auth.uid()), false)
 and (exists (
  select 1 from public.tasks t join public.projects p on p.id = t.linked_project_id
  where t.id = p_root and t.deleted_at is null and t.archived_at is null
    and t.status in ('in_progress', 'changes_requested') and p.status = 'active'
    and (p_node is null or eflow_m7.node_activated(t.id, p_node) and exists(
      select 1 from public.subtasks s where s.id = p_node and s.task_id = t.id and s.status not in ('for_review', 'completed')
    ))
 ) or exists(
  select 1 from public.personal_tasks t join public.personal_projects p on p.id = t.project_id
  join public.personal_subtasks s on s.task_id = t.id and s.id = p_node
  where t.id = p_root and p.status = 'active' and t.status = 'in_progress'
   and eflow_m7.personal_node_activated(t.id, s.id) and s.status not in ('for_review', 'completed')
 ));
$$;

-- 4. public.transition_task_status: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'public.transition_task_status(uuid,text,text,text)'::regprocedure,
    '  prev_status := t.status;',
    $anchor$  prev_status := t.status;
  if p_to_status in ('in_progress', 'for_review', 'completed', 'changes_requested') and exists (
    select 1 from public.projects p where p.id = t.linked_project_id and p.status = 'on_hold'
  ) then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;$anchor$
  );
end $$;

-- 5. public.submit_task_progress: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'public.submit_task_progress(uuid,integer,text,text,text,text,text,text)'::regprocedure,
    '  if t.archived_at is not null then',
    $anchor$  if exists (select 1 from public.projects p where p.id = t.linked_project_id and p.status = 'on_hold') then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;
  if t.archived_at is not null then$anchor$
  );
end $$;

-- 6. public.submit_task_for_review: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'public.submit_task_for_review(uuid,jsonb)'::regprocedure,
    '  if t.archived_at is not null or t.status not in (''todo'',''in_progress'',''changes_requested'') then',
    $anchor$  if exists (select 1 from public.projects p where p.id = t.linked_project_id and p.status = 'on_hold') then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;
  if t.archived_at is not null or t.status not in ('todo','in_progress','changes_requested') then$anchor$
  );
end $$;

-- 7. public.decide_task_review: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'public.decide_task_review(uuid,boolean,text,text)'::regprocedure,
    '  if task_row.status <> ''for_review'' then',
    $anchor$  if exists (select 1 from public.projects p where p.id = task_row.linked_project_id and p.status = 'on_hold') then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;
  if task_row.status <> 'for_review' then$anchor$
  );
end $$;

-- 8. eflow_r7.complete_subitem: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'eflow_r7.complete_subitem(uuid,jsonb)'::regprocedure,
    ' perform 1 from public.projects where id=(r->>''project'')::uuid for update;',
    $anchor$ perform 1 from public.projects where id=(r->>'project')::uuid for update;
 if r->>'kind' = 'office' and exists(select 1 from public.projects where id=(r->>'project')::uuid and status='on_hold')
    or r->>'kind' = 'personal' and exists(select 1 from public.personal_projects where id=(r->>'project')::uuid and status='on_hold') then
   raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
 end if;$anchor$
  );
end $$;

-- 9. public.save_subtask_work_update: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'public.save_subtask_work_update(uuid,text,text,text,text,text,text)'::regprocedure,
    '  select * into subtask_row from public.subtasks where id = p_subtask_id for update;',
    $anchor$  select * into subtask_row from public.subtasks where id = p_subtask_id for update;
  if exists (
    select 1 from public.tasks t join public.projects p on p.id = t.linked_project_id
    where t.id = subtask_row.task_id and p.status = 'on_hold'
  ) or exists (
    select 1 from public.personal_tasks pt join public.personal_projects pp on pp.id = pt.project_id
    where pt.id = subtask_row.task_id and pp.status = 'on_hold'
  ) then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;$anchor$
  );
end $$;

-- 10. public.save_subtask_progress: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)'::regprocedure,
    '  select * into subtask_row from public.subtasks where id = p_subtask_id for update;',
    $anchor$  select * into subtask_row from public.subtasks where id = p_subtask_id for update;
  if exists (
    select 1 from public.tasks t join public.projects p on p.id = t.linked_project_id
    where t.id = subtask_row.task_id and p.status = 'on_hold'
  ) or exists (
    select 1 from public.personal_tasks pt join public.personal_projects pp on pp.id = pt.project_id
    where pt.id = subtask_row.task_id and pp.status = 'on_hold'
  ) then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;$anchor$
  );
end $$;

-- 11. eflow_evidence.guard_progress: remove manager bypass and reject when project is on_hold
do $$
begin
  perform eflow_m7.replace_body_part(
    'eflow_evidence.guard_progress()'::regprocedure,
    '    coalesce(eflow_r7.manage(s.task_id,s.id),false) or',
    $anchor$    /* manager bypass removed */
    (exists (select 1 from public.projects p where p.id = t.linked_project_id and p.status = 'on_hold') and false) or$anchor$
  );
  perform eflow_m7.replace_body_part(
    'eflow_evidence.guard_progress()'::regprocedure,
    '  if s.id is null or t.id is null or s.task_id is distinct from t.id or not (',
    $anchor$  if exists (select 1 from public.projects p where p.id = t.linked_project_id and p.status = 'on_hold') then
    raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
  end if;
  if s.id is null or t.id is null or s.task_id is distinct from t.id or not ($anchor$
  );
end $$;

-- 12. eflow_m7.decide_work: inject on_hold check via eflow_m7.replace_body_part
do $$
begin
  perform eflow_m7.replace_body_part(
    'eflow_m7.decide_work(uuid,uuid,boolean,text)'::regprocedure,
    ' perform eflow_r7.lock_impact(work.root_id);',
    $anchor$ if exists (
  select 1 from public.tasks t join public.projects p on p.id = t.linked_project_id
  where t.id = work.root_id and p.status = 'on_hold'
 ) or exists (
  select 1 from public.personal_tasks pt join public.personal_projects pp on pp.id = pt.project_id
  where pt.id = work.root_id and pp.status = 'on_hold'
 ) then
  raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
 end if;
 perform eflow_r7.lock_impact(work.root_id);$anchor$
  );
end $$;

-- 13. Direct Table Update Guard Trigger: prevent bypassing via direct UPDATE statements
create or replace function eflow_r7.guard_on_hold_work_execution()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_project_status text;
begin
  if tg_table_name = 'tasks' then
    if (new.status is distinct from old.status and new.status in ('in_progress','for_review','completed','changes_requested'))
       or (new.percent_complete is distinct from old.percent_complete) then
      select status into v_project_status from public.projects where id = new.linked_project_id;
      if v_project_status = 'on_hold' then
        raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
      end if;
    end if;
  elsif tg_table_name = 'personal_tasks' then
    if (new.status is distinct from old.status and new.status in ('in_progress','done','submitted'))
       or (new.percent_complete is distinct from old.percent_complete) then
      select status into v_project_status from public.personal_projects where id = new.project_id;
      if v_project_status = 'on_hold' then
        raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
      end if;
    end if;
  elsif tg_table_name = 'subtasks' then
    if (new.status is distinct from old.status and new.status in ('in_progress','for_review','completed','stuck'))
       or (new.percent_complete is distinct from old.percent_complete)
       or (new.is_completed is distinct from old.is_completed and new.is_completed = true)
       or (new.started_at is distinct from old.started_at and new.started_at is not null) then
      select p.status into v_project_status
      from public.tasks t join public.projects p on p.id = t.linked_project_id
      where t.id = new.task_id;
      if v_project_status = 'on_hold' then
        raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
      end if;
    end if;
  elsif tg_table_name = 'personal_subtasks' then
    if (new.status is distinct from old.status and new.status in ('in_progress','for_review','completed','stuck'))
       or (new.percent_complete is distinct from old.percent_complete)
       or (new.is_completed is distinct from old.is_completed and new.is_completed = true)
       or (new.started_at is distinct from old.started_at and new.started_at is not null) then
      select p.status into v_project_status
      from public.personal_tasks t join public.personal_projects p on p.id = t.project_id
      where t.id = new.task_id;
      if v_project_status = 'on_hold' then
        raise exception 'Project is on hold' using errcode = '22023', hint = 'project_on_hold';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists guard_on_hold_tasks on public.tasks;
create trigger guard_on_hold_tasks before update on public.tasks
 for each row execute function eflow_r7.guard_on_hold_work_execution();

drop trigger if exists guard_on_hold_personal_tasks on public.personal_tasks;
create trigger guard_on_hold_personal_tasks before update on public.personal_tasks
 for each row execute function eflow_r7.guard_on_hold_work_execution();

drop trigger if exists guard_on_hold_subtasks on public.subtasks;
create trigger guard_on_hold_subtasks before update on public.subtasks
 for each row execute function eflow_r7.guard_on_hold_work_execution();

drop trigger if exists guard_on_hold_personal_subtasks on public.personal_subtasks;
create trigger guard_on_hold_personal_subtasks before update on public.personal_subtasks
 for each row execute function eflow_r7.guard_on_hold_work_execution();

commit;
