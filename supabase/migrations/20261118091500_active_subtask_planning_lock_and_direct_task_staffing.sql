begin;
set local lock_timeout = '10s';

-- 1. Helper: when an office project leaves 'planning' (e.g. active / on_hold),
--    Project Leads and Office Heads who are NOT the appointed Task Lead lose
--    subtask planning/creation/editing/staffing authority (transferred to Task Lead).
create or replace function eflow_publication.subtask_planning_locked(p_root uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
 select exists(
  select 1
  from public.tasks t
  join public.projects p on p.id = t.linked_project_id
  where t.id = p_root
    and t.deleted_at is null
    and t.source_collaboration_draft_id is null
    and p.source_collaboration_draft_id is null
    and p.status <> 'planning'
    and coalesce(t.assigned_to, t.recommendation_lead_id) is distinct from auth.uid()
    and (
      p.project_lead_id = auth.uid()
      or public.phase2_is_office_head(auth.uid(), t.org_id)
      or eflow_phase6.head(p.id, t.org_id, auth.uid())
    )
 );
$$;
revoke all on function eflow_publication.subtask_planning_locked(uuid) from public, anon, authenticated, service_role;

-- Update guard_active_subtask_staffing so a Project Lead / Head who IS the Task Lead
-- retains subtask staffing authority, while non-Task-Lead Project Leads / Heads
-- cannot alter subtask assignments once the project is no longer in planning.
create or replace function eflow_publication.guard_active_subtask_staffing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 project_status text;
 project_lead uuid;
 task_lead uuid;
 task_org uuid;
 project_id uuid;
begin
 if auth.uid() is null then return new; end if;
 if tg_op = 'UPDATE' then
  if row(new.task_id, new.lead_id, new.assigned_to, new.assigned_to_ids)
     is not distinct from row(old.task_id, old.lead_id, old.assigned_to, old.assigned_to_ids) then
   return new;
  end if;
 else
  if new.lead_id is null and new.assigned_to is null and cardinality(coalesce(new.assigned_to_ids, '{}'::uuid[])) = 0 then
   return new;
  end if;
 end if;

 select p.id, p.status, p.project_lead_id, coalesce(t.assigned_to, t.recommendation_lead_id), t.org_id
   into project_id, project_status, project_lead, task_lead, task_org
   from public.tasks t
   join public.projects p on p.id = t.linked_project_id
  where t.id = new.task_id
    and t.source_collaboration_draft_id is null
    and p.source_collaboration_draft_id is null
  for share of p;

 if project_id is not null
    and project_status <> 'planning'
    and task_lead is distinct from auth.uid()
    and (
      project_lead = auth.uid()
      or public.phase2_is_office_head(auth.uid(), task_org)
      or eflow_phase6.head(project_id, task_org, auth.uid())
    )
    and (
      tg_op = 'INSERT'
      or new.lead_id is distinct from old.lead_id
      or old.lead_id is distinct from auth.uid()
    ) then
  raise exception 'Subtask assignments are read-only for the Project Lead and Office Head while the project is active'
   using errcode = '42501';
 end if;
 return new;
end $$;
revoke all on function eflow_publication.guard_active_subtask_staffing() from public, anon, authenticated, service_role;

-- 2. Direct Office Member task/subtask assignment helpers (removing Add People prerequisite).
create or replace function eflow_r7.office_assignable(p_project uuid, p_office uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
 select eflow_r7.member(p_project, p_office, p_user)
  or (
   p_project is not null
   and p_office is not null
   and p_user is not null
   and exists(select 1 from public.profiles pr where pr.id = p_user and pr.org_id = p_office)
   and eflow_r3.eligible(p_user)
   and eflow_r9.allowed(p_project, p_user, p_office)
   and exists(
    select 1 from public.project_offices po
    where po.project_id = p_project
      and po.office_id = p_office
      and po.invitation_status = 'joined'
      and po.relationship_type in ('lead', 'collaborating')
   )
  );
$$;
revoke all on function eflow_r7.office_assignable(uuid, uuid, uuid) from public, anon, authenticated, service_role;

create or replace function eflow_r7.ensure_office_members(p_project uuid, p_office uuid, p_users uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_po_id uuid;
 v_uid uuid;
begin
 if p_project is null or p_office is null or p_users is null or cardinality(p_users) = 0 then
  return;
 end if;
 select po.id into v_po_id
 from public.project_offices po
 where po.project_id = p_project
   and po.office_id = p_office
   and po.invitation_status = 'joined'
   and po.relationship_type in ('lead', 'collaborating')
 limit 1;
 if v_po_id is null then
  return;
 end if;
 foreach v_uid in array p_users loop
  if v_uid is null then continue; end if;
  if not eflow_r7.member(p_project, p_office, v_uid)
     and exists(select 1 from public.profiles pr where pr.id = v_uid and pr.org_id = p_office)
     and eflow_r3.eligible(v_uid)
     and eflow_r9.allowed(p_project, v_uid, p_office) then
   insert into public.project_office_members(project_office_id, user_id, selected_by)
   values (v_po_id, v_uid, coalesce(auth.uid(), v_uid))
   on conflict do nothing;
   insert into public.project_members(project_id, user_id, role)
   values (p_project, v_uid, 'member')
   on conflict do nothing;
  end if;
 end loop;
end $$;
revoke all on function eflow_r7.ensure_office_members(uuid, uuid, uuid[]) from public, anon, authenticated, service_role;

-- 3. Update eflow_r7.operation_capabilities
create or replace function eflow_r7.operation_capabilities(p_root uuid, p_node uuid default null::uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
 planning_locked boolean := false;
begin
 if r is null or auth.uid() is null or not coalesce(eflow_r7.read_root(p_root),false) then
  common_reason := 'access_unavailable';
 elsif not coalesce(eflow_r3.eligible(auth.uid()),false) then
  common_reason := 'read_only';
 elsif not coalesce((r->>'open')::boolean,false) then
  common_reason := 'lifecycle_blocked';
 end if;

 if p_node is not null then
  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;
  if not found then common_reason := 'access_unavailable'; end if;
 end if;

 if common_reason is null then
  manager := coalesce(eflow_r7.manage(p_root,p_node),false);
  planning_locked := (r->>'kind' = 'office') and coalesce(eflow_publication.subtask_planning_locked(p_root), false);
  if p_node is not null then
   with recursive below as (
    select * from eflow_r7.nodes where id=p_node and task_id=p_root
    union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root
   ) select not exists(select 1 from below where status<>'todo' or percent_complete<>0),
    not exists(select 1 from below where id<>p_node and status<>'completed')
    into untouched,descendants_complete;
   with recursive above as (
    select id,parent_subtask_id,1 depth from eflow_r7.nodes where id=p_node and task_id=p_root
    union all select c.id,c.parent_subtask_id,a.depth+1 from eflow_r7.nodes c join above a on c.id=a.parent_subtask_id where c.task_id=p_root and a.depth<8
   ) select max(depth) into node_depth from above;
   ordered_ready := n.is_standalone or not exists(select 1 from eflow_r7.nodes c
    where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id
    and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed');
   if r->>'kind'='office' and exists(
     select 1 from public.subtasks s where s.id=p_node and s.task_id=p_root and s.dependency_ids is not null
   ) then
    ordered_ready := eflow_r7.subtask_dependencies_ready(p_root,(select s.dependency_ids from public.subtasks s where s.id=p_node));
   end if;
  end if;
 end if;

 foreach action in array actions loop
  reason := common_reason;
  if reason is null then
   if p_node is not null and action in ('appoint_lead','manage_contributors')
     and (planning_locked or eflow_publication.subtask_staffing_locked(p_root))
     and (r->>'lead')::uuid is distinct from auth.uid()
     and (action='appoint_lead' or n.lead_id is distinct from auth.uid()) then
    reason := 'active_subtask_staffing_locked';
   elsif planning_locked and (
     (p_node is null and action in ('create_child','order_children'))
     or (p_node is not null and action in ('create_child','order_children','edit_details','move','delete'))
   ) then
    reason := 'branch_denied';
   elsif action='appoint_lead' then
    if not coalesce(case when p_node is null then (eflow_r7.head(p_root) or (r->>'kind'='office' and eflow_publication.planning_lead((r->>'project')::uuid,(r->>'office')::uuid)))
     else eflow_publication.manage_plan(p_root,p_node,true) end,false) then reason := 'appointment_denied';
    elsif p_node is not null and n.status='completed' then reason := 'lifecycle_blocked'; end if;
   elsif action in ('execute','submit') and r->>'kind'='office' and exists (
    select 1 from public.projects where id=(r->>'project')::uuid and status in ('planning','on_hold')
   ) then
    select case when status='on_hold' then 'project_on_hold' else 'lifecycle_blocked' end into reason
     from public.projects where id=(r->>'project')::uuid;
   elsif action in ('execute','submit') then
    if not coalesce(manager,false) and (action='submit' or not coalesce(eflow_r7.node_work(p_node,auth.uid()),false)) then reason:='branch_denied';
    elsif n.status='completed' or r->>'kind'='office' and r->>'status' not in ('todo','in_progress','changes_requested') then reason:='lifecycle_blocked';
    elsif not ordered_ready or action='submit' and not descendants_complete then reason:='lifecycle_blocked'; end if;
   elsif action='review' then
    reason := 'lifecycle_blocked';
   elsif action = 'manage_contributors' and p_node is null and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then
    reason := 'active_staffing_locked';
   elsif not eflow_publication.manage_plan(p_root,p_node) then
    reason := 'branch_denied';
   elsif action='manage_contributors' then
    if p_node is null and r->>'kind'<>'office' then reason := 'read_only';
    elsif p_node is null and r->>'lead' is null or p_node is not null and (n.lead_id is null or n.status='completed') then reason := 'lifecycle_blocked'; end if;
   elsif action='create_child' then
    if p_node is not null and (n.status<>'todo' or n.percent_complete<>0 or node_depth>=8) then reason := 'lifecycle_blocked'; end if;
   elsif action='order_children' then
    if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root
     and c.parent_subtask_id is not distinct from p_node and (c.status<>'todo' or c.percent_complete<>0)) then reason := 'lifecycle_blocked'; end if;
   elsif action='edit_details' and r->>'kind'='office' then
    if not coalesce((eflow_work_edit.state(p_root,p_node)->>'details')::boolean,false) then reason:='lifecycle_blocked'; end if;
   elsif action in ('edit_details','move','delete') then
    if not untouched then reason := 'lifecycle_blocked';
    elsif action='delete' and r->>'kind'='office' and exists(
     with recursive below as (select id from eflow_r7.nodes where id=p_node and task_id=p_root
      union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root)
     select 1 from below b where
      exists(select 1 from public.subtask_progress_updates where subtask_id=b.id) or
      exists(select 1 from public.subtask_submissions where subtask_id=b.id) or
      exists(select 1 from public.work_budget_allocations where subtask_id=b.id) or
      exists(select 1 from public.petty_cash_requests where subtask_id=b.id) or
      exists(select 1 from public.budget_ledger_entries where subtask_id=b.id)
    ) then reason := 'history_blocked'; end if;
   end if;
  end if;

  if reason is null and p_node is not null and action in ('execute','submit') and
   not (case when r->>'kind'='office' then eflow_m7.node_activated(p_root,p_node)
             else eflow_m7.personal_node_activated(p_root,p_node) end)
  then reason := 'lifecycle_blocked'; end if;

  if reason is null and action in ('create_child','order_children','move','delete') then
   if not (eflow_r7.operation_impact(p_root,case action when 'create_child' then 'create' when 'order_children' then 'order' else action end,
    case when action in ('create_child','order_children') then jsonb_build_object('parent',p_node) else jsonb_build_object('id',p_node,'parent',n.parent_subtask_id) end)->>'allowed')::boolean then reason:='history_blocked'; end if;
  end if;

  if reason is null and p_node is not null and action in ('execute','submit')
    and eflow_work_clearance.accepted(p_root,p_node) then reason:='lifecycle_blocked'; end if;
  result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));
 end loop;
 return result;
end $$;
revoke all on function eflow_r7.operation_capabilities(uuid, uuid) from public, anon, authenticated, service_role;

-- 4. Update eflow_r7.node_capabilities_fast
create or replace function eflow_r7.node_capabilities_fast(
  p_root uuid, p_node uuid, p_root_json jsonb, p_eligible boolean, p_head boolean, p_plan_lead boolean,
  p_staffing_locked boolean, p_actor_member boolean, p_root_lead_member boolean, p_dirty_ids uuid[],
  p_project_status text, p_invalid_tree boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  n eflow_r7.nodes;
  actions text[] := array['manage_contributors','appoint_lead','create_child','edit_details','move','order_children','delete','execute','submit','review'];
  action text;
  reason text;
  common_reason text;
  result jsonb := '{}';
  manager boolean := false;
  untouched boolean := true;
  descendants_complete boolean := true;
  ordered_ready boolean := true;
  node_depth integer := 1;
  v_subtree_ids uuid[] := '{}';
  v_child_subtree_ids uuid[] := '{}';
  v_move_ids uuid[] := '{}';
  v_kind text := p_root_json->>'kind';
  v_open boolean := coalesce((p_root_json->>'open')::boolean, false);
  v_root_lead uuid := (p_root_json->>'lead')::uuid;
  v_proj uuid := (p_root_json->>'project')::uuid;
  v_office uuid := (p_root_json->>'office')::uuid;
  v_chain_parent boolean := false;
  v_chain_self boolean := false;
  v_node_work boolean := false;
  v_manage_plan boolean := false;
  v_replace_lead_plan boolean := false;
  v_can_edit_details boolean := false;
  v_dep_ids uuid[];
  v_activated boolean := false;
  v_planning_locked boolean := false;
begin
  if p_root_json is null or v_uid is null then
    common_reason := 'access_unavailable';
  elsif not p_eligible then
    common_reason := 'read_only';
  elsif not v_open then
    common_reason := 'lifecycle_blocked';
  end if;

  select * into n from eflow_r7.nodes where id = p_node and task_id = p_root;
  if not found then
    common_reason := 'access_unavailable';
  end if;

  if common_reason is null then
    v_planning_locked := (v_kind = 'office' and coalesce(p_project_status, '') <> 'planning' and v_root_lead is distinct from v_uid and (p_head or p_plan_lead));
    with recursive below as (
      select * from eflow_r7.nodes where id = p_node and task_id = p_root
      union all
      select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id = b.id where c.task_id = p_root
    )
    select
      coalesce(array_agg(id), '{}'),
      not exists(select 1 from below where status <> 'todo' or percent_complete <> 0),
      not exists(select 1 from below where id <> p_node and status <> 'completed')
    into v_subtree_ids, untouched, descendants_complete
    from below;

    with recursive above as (
      select id, parent_subtask_id, lead_id, 1 depth from eflow_r7.nodes where id = p_node and task_id = p_root
      union all
      select c.id, c.parent_subtask_id, c.lead_id, a.depth + 1 from eflow_r7.nodes c join above a on c.id = a.parent_subtask_id where c.task_id = p_root and a.depth < 8
    )
    select max(depth) into node_depth from above;

    v_chain_parent := eflow_r7.chain(p_root, n.parent_subtask_id);
    if n.parent_subtask_id is not null then
      v_chain_self := eflow_r7.chain(p_root, p_node);
    else
      v_chain_self := p_root_lead_member and n.lead_id is not null and eflow_r7.member(v_proj, v_office, n.lead_id);
    end if;

    if p_head then
      manager := true;
    elsif p_actor_member then
      if v_root_lead = v_uid then
        manager := true;
      elsif v_chain_self then
        manager := exists(
          with recursive anc as (
            select id, parent_subtask_id, lead_id from eflow_r7.nodes where id = p_node and task_id = p_root
            union all
            select c.id, c.parent_subtask_id, c.lead_id from eflow_r7.nodes c join anc a on c.id = a.parent_subtask_id where c.task_id = p_root
          ) select 1 from anc where lead_id = v_uid
        );
      end if;
    end if;

    v_manage_plan := manager or p_plan_lead;
    if p_head then
      v_replace_lead_plan := true;
    elsif p_plan_lead then
      v_replace_lead_plan := true;
    elsif p_actor_member then
      if v_root_lead = v_uid then
        v_replace_lead_plan := true;
      elsif n.parent_subtask_id is not null and v_chain_parent then
        v_replace_lead_plan := exists(
          with recursive anc as (
            select id, parent_subtask_id, lead_id from eflow_r7.nodes where id = n.parent_subtask_id and task_id = p_root
            union all
            select c.id, c.parent_subtask_id, c.lead_id from eflow_r7.nodes c join anc a on c.id = a.parent_subtask_id where c.task_id = p_root
          ) select 1 from anc where lead_id = v_uid
        );
      end if;
    end if;

    v_node_work := p_eligible and p_actor_member and v_chain_parent and (
      v_uid = any(coalesce(n.assigned_to_ids, '{}'::uuid[]))
      or (n.kind = 'office' and v_kind = 'office' and n.lead_id = v_uid and v_chain_self)
    );

    ordered_ready := n.is_standalone or not exists(
      select 1 from eflow_r7.nodes c
      where c.task_id = p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id
        and c.sibling_order < n.sibling_order and not c.is_standalone and c.status <> 'completed'
    );
    if v_kind = 'office' then
      select s.dependency_ids,
        (p_root_json->>'status' not in ('todo', 'pending_assignment') and (s.started_at is not null or s.status in ('in_progress','stuck','changes_requested','for_review','completed')))
      into v_dep_ids, v_activated
      from public.subtasks s where s.id = p_node and s.task_id = p_root;
      if v_dep_ids is not null then
        ordered_ready := eflow_r7.subtask_dependencies_ready(p_root, v_dep_ids);
      end if;
      if n.status in ('todo', 'in_progress', 'changes_requested') then
        v_can_edit_details := v_manage_plan;
      end if;
    else
      v_activated := (p_root_json->>'status' <> 'todo') and exists(
        select 1 from public.personal_subtasks s where s.id = p_node and s.task_id = p_root
          and (s.started_at is not null or s.status in ('in_progress','changes_requested','for_review','completed'))
      );
    end if;

    with recursive child_sub as (
      select id from eflow_r7.nodes where task_id = p_root and parent_subtask_id is not distinct from p_node
      union all
      select c.id from eflow_r7.nodes c join child_sub cs on c.parent_subtask_id = cs.id where c.task_id = p_root
    ) select coalesce(array_agg(id), '{}') into v_child_subtree_ids from child_sub;

    with recursive sib_sub as (
      select id from eflow_r7.nodes where task_id = p_root and parent_subtask_id is not distinct from n.parent_subtask_id
      union all
      select c.id from eflow_r7.nodes c join sib_sub ss on c.parent_subtask_id = ss.id where c.task_id = p_root
    ) select coalesce(array_agg(id), '{}') || case when n.parent_subtask_id is not null then array[n.parent_subtask_id] else '{}'::uuid[] end into v_move_ids from sib_sub;
  end if;

  foreach action in array actions loop
    reason := common_reason;
    if reason is null then
      if action in ('appoint_lead', 'manage_contributors')
         and (v_planning_locked or p_staffing_locked)
         and v_root_lead is distinct from v_uid
         and (action = 'appoint_lead' or n.lead_id is distinct from v_uid) then
        reason := 'active_subtask_staffing_locked';
      elsif v_planning_locked and action in ('create_child', 'order_children', 'edit_details', 'move', 'delete') then
        reason := 'branch_denied';
      elsif action = 'appoint_lead' then
        if not v_replace_lead_plan then reason := 'appointment_denied';
        elsif n.status = 'completed' then reason := 'lifecycle_blocked';
        end if;
      elsif action in ('execute', 'submit') and v_kind = 'office' and p_project_status in ('planning', 'on_hold') then
        reason := case when p_project_status = 'on_hold' then 'project_on_hold' else 'lifecycle_blocked' end;
      elsif action in ('execute', 'submit') then
        if not manager and (action = 'submit' or not v_node_work) then reason := 'branch_denied';
        elsif n.status = 'completed' or (v_kind = 'office' and p_root_json->>'status' not in ('todo', 'in_progress', 'changes_requested')) then reason := 'lifecycle_blocked';
        elsif not ordered_ready or (action = 'submit' and not descendants_complete) then reason := 'lifecycle_blocked';
        end if;
      elsif action = 'review' then
        reason := 'lifecycle_blocked';
      elsif action = 'manage_contributors' and not v_manage_plan then
        reason := 'branch_denied';
      elsif not v_manage_plan then
        reason := 'branch_denied';
      elsif action = 'manage_contributors' then
        if n.lead_id is null or n.status = 'completed' then reason := 'lifecycle_blocked'; end if;
      elsif action = 'create_child' then
        if n.status <> 'todo' or n.percent_complete <> 0 or node_depth >= 8 then reason := 'lifecycle_blocked'; end if;
      elsif action = 'order_children' then
        if exists(select 1 from eflow_r7.nodes c where c.task_id = p_root and c.parent_subtask_id is not distinct from p_node and (c.status <> 'todo' or c.percent_complete <> 0)) then
          reason := 'lifecycle_blocked';
        end if;
      elsif action = 'edit_details' and v_kind = 'office' then
        if not v_can_edit_details then reason := 'lifecycle_blocked'; end if;
      elsif action in ('edit_details', 'move', 'delete') then
        if not untouched then
          reason := 'lifecycle_blocked';
        elsif action = 'delete' and v_kind = 'office' and (v_subtree_ids && p_dirty_ids) then
          reason := 'history_blocked';
        end if;
      end if;
    end if;

    if reason is null and action in ('execute', 'submit') and not v_activated then
      reason := 'lifecycle_blocked';
    end if;

    if reason is null and action in ('create_child', 'order_children', 'move', 'delete') then
      if p_invalid_tree then
        raise exception 'Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first' using errcode = '23514';
      end if;
      if action in ('create_child', 'delete') and (v_subtree_ids && p_dirty_ids) then
        reason := 'history_blocked';
      elsif action = 'order_children' and (v_child_subtree_ids && p_dirty_ids) then
        reason := 'history_blocked';
      elsif action = 'move' and (v_move_ids && p_dirty_ids) then
        reason := 'history_blocked';
      end if;
    end if;

    if reason is null and p_node is not null and action in ('execute','submit')
      and eflow_work_clearance.accepted(p_root,p_node) then reason := 'lifecycle_blocked'; end if;
    result := result || jsonb_build_object(action, jsonb_build_object('allowed', reason is null, 'reason_code', reason));
  end loop;

  return result;
end $$;
revoke all on function eflow_r7.node_capabilities_fast(uuid, uuid, jsonb, boolean, boolean, boolean, boolean, boolean, boolean, uuid[], text, boolean) from public, anon, authenticated, service_role;

-- 5. Update eflow_r7.m7_baseline_snapshot: include all active eligible Office members in v_people
--    and reflect subtask_planning_locked in node management flags.
create or replace function eflow_r7.m7_baseline_snapshot(p_root uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  r jsonb := eflow_r7.root(p_root);
  v_nodes jsonb;
  v_people jsonb;
  v_result jsonb;
  v_kind text := r->>'kind';
  v_proj uuid := (r->>'project')::uuid;
  v_office uuid := (r->>'office')::uuid;
  v_root_lead uuid := (r->>'lead')::uuid;
  v_open boolean := coalesce((r->>'open')::boolean, false);
  v_eligible boolean := coalesce(eflow_r3.eligible(v_uid), false);
  v_head boolean;
  v_plan_lead boolean;
  v_staffing_locked boolean;
  v_planning_locked boolean := false;
  v_actor_member boolean;
  v_root_lead_member boolean;
  v_root_can_manage boolean;
  v_dirty_ids uuid[];
  v_project_status text;
  v_invalid_tree boolean := false;
  v_root_node_scope boolean := true;
begin
  if not eflow_r7.read_root(p_root) then
    raise exception 'Nested work access denied' using errcode = '42501';
  end if;

  if v_kind = 'office' then
    v_root_node_scope := coalesce(public.can_see_task(p_root, v_uid), false) and exists(
      select 1 from public.tasks t
      where t.id = p_root and t.deleted_at is null and (
        coalesce(t.assigned_to, t.recommendation_lead_id) = v_uid
        or t.status::text in ('in_progress','for_review','changes_requested','completed')
        or exists(select 1 from public.task_status_history h where h.task_id = t.id and h.to_status::text = 'in_progress')
      )
    );
    select p.status into v_project_status from public.projects p where p.id = v_proj;
  end if;

  v_head := v_eligible and case when v_kind = 'office' then eflow_phase6.head(v_proj, v_office, v_uid) else (r->>'owner')::uuid = v_uid end;
  v_plan_lead := (v_kind = 'office') and coalesce(eflow_publication.planning_lead(v_proj, v_office), false);
  v_staffing_locked := (v_kind = 'office') and coalesce(eflow_publication.subtask_staffing_locked(p_root), false);
  v_planning_locked := (v_kind = 'office') and coalesce(eflow_publication.subtask_planning_locked(p_root), false);
  v_actor_member := eflow_r7.member(v_proj, v_office, v_uid);
  v_root_lead_member := v_root_lead is not null and eflow_r7.member(v_proj, v_office, v_root_lead);
  v_root_can_manage := (v_eligible and v_open and (v_head or (v_actor_member and v_root_lead = v_uid))) or (v_open and v_plan_lead);

  with recursive above as (
    select n.id origin, n.id, n.parent_subtask_id, array[n.id] path, 1 depth, false cycle
    from eflow_r7.nodes n where n.task_id = p_root
    union all
    select a.origin, n.id, n.parent_subtask_id, a.path || n.id, a.depth + 1, n.id = any(a.path)
    from above a join eflow_r7.nodes n on n.id = a.parent_subtask_id and n.task_id = p_root
    where not a.cycle and a.depth <= 8
  )
  select exists(
    select 1 from above a
    where a.cycle or a.depth > 8
       or (a.parent_subtask_id is not null and not exists(select 1 from eflow_r7.nodes n where n.id = a.parent_subtask_id and n.task_id = p_root))
  ) into v_invalid_tree;

  v_dirty_ids := eflow_r7.tree_structural_history(p_root, v_kind);

  with recursive tree as (
    select n.*, 1 depth, array[n.sibling_order] path
    from eflow_r7.nodes n
    where n.task_id = p_root and n.parent_subtask_id is null
    union all
    select n.*, t.depth + 1, t.path || n.sibling_order
    from eflow_r7.nodes n
    join tree t on n.parent_subtask_id = t.id
    where n.task_id = p_root and t.depth < 8
  )
  select coalesce(jsonb_agg(
    to_jsonb(t) || jsonb_build_object(
      'capabilities', eflow_r7.node_capabilities_fast(p_root, t.id, r, v_eligible, v_head, v_plan_lead, v_staffing_locked, v_actor_member, v_root_lead_member, v_dirty_ids, v_project_status, v_invalid_tree),
      'can_manage', v_open and not v_planning_locked and (v_plan_lead or (v_eligible and (v_head or (v_actor_member and (v_root_lead = v_uid or eflow_r7.manage(p_root, t.id)))))),
      'can_appoint', v_open and not v_planning_locked and (v_plan_lead or (v_eligible and (v_head or (v_actor_member and (v_root_lead = v_uid or eflow_r7.manage(p_root, t.id, true)))))),
      'can_order', v_open and not v_planning_locked and (v_plan_lead or (v_eligible and (v_head or (v_actor_member and (v_root_lead = v_uid or (t.parent_subtask_id is not null and eflow_r7.manage(p_root, t.parent_subtask_id))))))),
      'can_work', v_eligible and v_actor_member and v_open and eflow_r7.chain(p_root, t.parent_subtask_id) and (
        v_uid = any(coalesce(t.assigned_to_ids, '{}'::uuid[]))
        or (t.kind = 'office' and v_kind = 'office' and t.lead_id = v_uid and eflow_r7.chain(p_root, t.id))
      ),
      'can_review', t.status = 'for_review' and rev.pending_reviewer = v_uid,
      'current_reviewer', rev.pending_reviewer
    )
    order by t.path, t.id
  ), '[]'::jsonb)
  into v_nodes
  from tree t
  left join lateral (select eflow_r7.pending_reviewer(t.id) as pending_reviewer) rev on true
  where v_kind <> 'office' or v_root_node_scope;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', p.id, 'name', p.full_name, 'office', p.org_id, 'eligible', mem.is_member)
    order by p.full_name, p.id
  ), '[]'::jsonb)
  into v_people
  from public.profiles p
  cross join lateral (
    select case
      when v_kind = 'office' then eflow_r7.office_assignable(v_proj, v_office, p.id)
      else eflow_r7.member(v_proj, v_office, p.id)
    end as is_member
  ) mem
  where mem.is_member
     or p.id = v_root_lead
     or coalesce(r->'people', '[]') ? p.id::text
     or exists(
       select 1 from eflow_r7.nodes n
       where n.task_id = p_root
         and (v_kind <> 'office' or v_root_node_scope)
         and (n.lead_id = p.id or p.id = any(n.assigned_to_ids))
     );

  v_result := jsonb_build_object(
    'root', r || jsonb_build_object('capabilities', eflow_r7.operation_capabilities(p_root)),
    'revision', coalesce((select revision from eflow_r7.tree_state where root_id = p_root), 1),
    'can_manage', v_root_can_manage,
    'can_transfer', v_head,
    'nodes', v_nodes,
    'people', v_people,
    'leaf_total', (select count(*) from eflow_r7.nodes n where n.task_id = p_root and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id = n.id)),
    'leaf_completed', (select count(*) from eflow_r7.nodes n where n.task_id = p_root and n.status = 'completed' and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id = n.id))
  );

  return case when v_kind = 'office' then eflow_m7.with_visible_counts(v_result) else v_result end;
end $$;
revoke all on function eflow_r7.m7_baseline_snapshot(uuid) from public, anon, authenticated, service_role;

-- 6. Update eflow_r7.command: enforce subtask_planning_locked and auto-enroll assignable Office members.
create or replace function eflow_r7.command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r jsonb;n eflow_r7.nodes;parent eflow_r7.nodes;v_id uuid:=(p_payload->>'id')::uuid;v_parent uuid:=(p_payload->>'parent')::uuid;v_lead uuid:=(p_payload->>'lead')::uuid;
 v_people uuid[];v_order uuid[];v_subtree uuid[];v_uid uuid;v_receipt eflow_r7.receipts;v_before jsonb;v_result jsonb;v_terms jsonb;v_kind text;v_position int;v_due date;v_previous_status_write text;
begin
 perform eflow_r3.actor();
 if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if;
 perform eflow_r7.lock_impact(p_root);
 perform eflow_r3.actor();
 if p_request is null then raise exception 'Request identity required';end if;
 r:=eflow_r7.root(p_root);v_kind:=r->>'kind';
 if not eflow_r7.read_root(p_root) then raise exception 'Work access denied' using errcode='42501';end if;
 perform 1 from public.projects where id=(r->>'project')::uuid for update;
 perform 1 from public.personal_projects where id=(r->>'project')::uuid for update;
 perform eflow_r7.lock_completion(p_root); perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 r:=eflow_r7.root(p_root);
 v_terms:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into v_receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if v_receipt.root_id<>p_root or v_receipt.payload<>v_terms then raise exception 'Request terms conflict';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 if v_kind='office' and (
  (p_command<>'create' and v_id is not null and not eflow_m7.node_visible(p_root,v_id,auth.uid()))
  or (v_parent is not null and not eflow_m7.node_visible(p_root,v_parent,auth.uid()))
 ) then raise exception 'Current branch access required' using errcode='42501'; end if;
 if v_kind='personal' and p_command in ('progress','submit') and exists (
  select 1 from public.personal_subtasks s where s.id=v_id and s.task_id=p_root
   and s.start_date is not null and s.started_at is null
 ) then raise exception 'This subtask has not started' using errcode='42501'; end if;
 if p_command='contributors' and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then raise exception 'Only the Task Lead, Project Lead or responsible Office Head can change Task contributors' using errcode='42501';end if;
 if not coalesce((r->>'open')::boolean,false) then raise exception 'Closed or unresolved work is read-only' using errcode='42501';end if;
 if coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1) is distinct from p_revision then raise exception 'Work changed; reload and review the current tree' using errcode='40001';end if;
 if p_payload ? 'dependency_ids' and (v_kind<>'office' or p_command<>'edit'
   or jsonb_typeof(p_payload->'dependency_ids') is distinct from 'array') then
    raise exception 'Choose a list of Office subtask prerequisites.' using errcode='22023';
 end if;
 if p_payload ? 'priority' and (v_kind<>'office' or p_command not in ('create','edit')
      or coalesce(p_payload->>'priority','') not in ('low','medium','high')) then
     raise exception 'Choose Low, Medium or High priority.' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('id','parent','lead','people','title','due','start','priority','dependency_ids','standalone','order','note','progress','approve')) then raise exception 'Unsupported branch fields';end if;
 if v_id is not null then select * into n from eflow_r7.nodes where id=v_id and task_id=p_root;end if;
 if p_command<>'create' and p_command not in ('contributors','order','root_lead') and n.id is null then raise exception 'Choose a node in this root';end if;
 if p_command in ('progress','submit','review') then
  if v_kind<>'personal' then raise exception 'Use the existing Office evidence workflow';end if;
  if not eflow_m7.personal_node_activated(p_root,v_id) then raise exception 'This subtask has not started' using errcode='42501'; end if;
  if not exists(select 1 from eflow_m7.applying_work_proposal a join eflow_m7.work_proposals w on w.id=a.proposal_id
   where a.tx=txid_current() and w.root_id=p_root and w.node_id=v_id and w.reviewer_id=auth.uid()) then
   if p_command='progress' and n.lead_id is distinct from auth.uid() and (r->>'lead')::uuid is distinct from auth.uid()
      or p_command='submit' and (n.lead_id is distinct from auth.uid() or (r->>'lead')::uuid is distinct from auth.uid())
   then raise exception 'Submit this work for the appointed Lead to review' using errcode='42501'; end if;
  end if;
  if p_command='review' then raise exception 'Subitems complete directly; open the work action instead' using errcode='22023';
  elsif not coalesce((eflow_r7.operation_capabilities(p_root,v_id)->(case when p_command='progress' then 'execute' else 'submit' end)->>'allowed')::boolean,false) then raise exception 'Current subitem lead or task lead authority required' using errcode='42501';end if;
 elsif p_command='create' then
  if v_kind='office' and eflow_publication.subtask_planning_locked(p_root) then raise exception 'Only the Task Lead can add or modify subtasks once the project is active' using errcode='42501';end if;
  if not coalesce(eflow_publication.manage_plan(p_root,v_parent),false) then raise exception 'Only a current lead may add work below their branch' using errcode='42501';end if;
 elsif p_command='order' then
  if v_kind='office' and eflow_publication.subtask_planning_locked(p_root) then raise exception 'Only the Task Lead can add or modify subtasks once the project is active' using errcode='42501';end if;
  if not coalesce(eflow_publication.manage_plan(p_root,v_parent),false) then raise exception 'Sibling ordering denied' using errcode='42501';end if;
 elsif p_command='root_lead' then
  if not coalesce(eflow_r7.head(p_root),false) and not (v_kind='office' and eflow_publication.planning_lead((r->>'project')::uuid,(r->>'office')::uuid)) then raise exception 'Current Task Lead appointment authority required' using errcode='42501';end if;
 else
  if p_command in ('edit','move','delete') and v_kind='office' and eflow_publication.subtask_planning_locked(p_root) then
   raise exception 'Only the Task Lead can add or modify subtasks once the project is active' using errcode='42501';
  end if;
  if p_command='staff' and v_kind='office' and eflow_publication.subtask_planning_locked(p_root)
     and (v_lead is distinct from n.lead_id or n.lead_id is distinct from auth.uid()) then
   raise exception 'Subtask assignments are read-only for the Project Lead and Office Head once the project is active' using errcode='42501';
  end if;
  if not coalesce(eflow_publication.manage_plan(p_root,v_id,p_command='staff' and v_lead is distinct from n.lead_id),false) then raise exception 'Branch staffing denied; ancestors and siblings are protected' using errcode='42501';end if;
 end if;
 if p_command='edit' and v_kind='office' then perform eflow_work_edit.check_subtask_edit(p_root,v_id,p_payload);end if;
 if not (p_command='edit' and v_kind='office') and p_command not in ('progress','submit','review','contributors','staff') and n.id is not null and (n.status<>'todo' or n.percent_complete<>0) then raise exception 'Planning changes require untouched work';end if;
 if p_command not in ('progress','submit','review') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if;
 v_before:=eflow_r7.snapshot(p_root);
 insert into eflow_r7.mutations values(txid_current(),auth.uid(),p_root);
 if p_command='root_lead' then
  if v_kind='office' then
   select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove((select team_member_ids from public.tasks where id=p_root)||array[v_lead],null))));
   perform eflow_r7.ensure_office_members((r->>'project')::uuid,(r->>'office')::uuid,array_remove(array[v_lead]||v_people,null));
  end if;
  if v_id is not null or v_lead is null or not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_lead) then raise exception 'Choose an eligible selected root lead';end if;
  if v_kind='office' then
   if cardinality(v_people)>200 or not(v_people @> array[v_lead]) then raise exception 'Include the root lead in contributors';end if;
   foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose eligible project people';end if;end loop;
   v_previous_status_write:=current_setting('eflow.allow_status_write',true);
   perform set_config('eflow.allow_status_write','on',true);
   update public.tasks set status=case when status='pending_assignment' then 'todo' else status end,assigned_to=v_lead,assignee_name=(select full_name from public.profiles where id=v_lead),team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
   perform set_config('eflow.allow_status_write',coalesce(v_previous_status_write,'off'),true);
  else update public.personal_tasks set lead_id=v_lead,revision=revision+1 where id=p_root;end if;
 elsif p_command='contributors' then
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_kind<>'office' or v_id is not null or not coalesce(eflow_publication.manage_plan(p_root,null),false) then raise exception 'Root contributor operation denied' using errcode='42501';end if;
  if not (v_people @> array[(r->>'lead')::uuid]) then raise exception 'Root lead must remain; transfer uses its responsible Head';end if;
  perform eflow_r7.ensure_office_members((r->>'project')::uuid,(r->>'office')::uuid,v_people);
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose selected project people';end if;end loop;
  update public.tasks set team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
 elsif p_command='create' then
  if v_parent is not null and exists(select 1 from eflow_r7.nodes where id=v_parent and (status<>'todo' or percent_complete<>0)) then raise exception 'Add children before starting the parent';end if;
  if v_id is null or exists(select 1 from eflow_r7.nodes where id=v_id) or exists(select 1 from public.tasks where id=v_id) or exists(select 1 from public.personal_tasks where id=v_id) then raise exception 'New disjoint node identity required';end if;
  if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a subitem title';end if;
  select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove(array[v_lead],null))));
  if v_lead is not null and not(v_people @> array[v_lead]) or cardinality(v_people)>200 then raise exception 'Include the appointed lead in contributors';end if;
  if v_kind='office' then
   perform eflow_r7.ensure_office_members((r->>'project')::uuid,(r->>'office')::uuid,array_remove(array[v_lead]||v_people,null));
   insert into public.subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to,assigned_to_ids,sibling_order,position,created_by,due_date,start_date,priority,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_lead,v_people,v_position,(select coalesce(max(position),-1)+1 from public.subtasks where task_id=p_root),auth.uid(),(p_payload->>'due')::date,(p_payload->>'start')::date,coalesce(p_payload->>'priority','medium'),coalesce((p_payload->>'standalone')::boolean,false));
  else
   insert into public.personal_subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to_ids,sibling_order,due_date,start_date,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_people,v_position,(p_payload->>'due')::date,(p_payload->>'start')::date,coalesce((p_payload->>'standalone')::boolean,false));
  end if;
 elsif p_command='staff' then
  if n.status='completed' then raise exception 'Completed responsibility is historical';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_lead is null or not(v_people @> array[v_lead]) then raise exception 'Choose a lead and include them among contributors';end if;
  if v_kind='office' then
   perform eflow_r7.ensure_office_members((r->>'project')::uuid,(r->>'office')::uuid,array_remove(array[v_lead]||v_people,null));
  end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose eligible project people';end if;end loop;
  with recursive below as (select id from eflow_r7.nodes where parent_subtask_id=v_id union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select coalesce(array_agg(id),'{}') into v_subtree from below;
  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.status<>'completed' and not(c.assigned_to_ids <@ v_people)) then raise exception 'Reassign unfinished descendant workers before removing a branch contributor';end if;
  if v_kind='office' then
   update public.subtasks set lead_id=v_lead,assigned_to=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.subtasks set lead_id=null where id=any(v_subtree);end if;
  else
   update public.personal_subtasks set lead_id=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.personal_subtasks set lead_id=null where id=any(v_subtree);end if;
  end if;
 elsif p_command in ('edit','move','delete') then
  with recursive below as (select * from eflow_r7.nodes where id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select array_agg(id) into v_subtree from below;
  if not (p_command='edit' and v_kind='office') and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and (c.status<>'todo' or c.percent_complete<>0)) then raise exception 'The entire subtree must be untouched';end if;
  if p_command='move' then
   if not coalesce(eflow_publication.manage_plan(p_root,v_parent),false) or v_parent=any(v_subtree) then raise exception 'Destination branch denied or cycle';end if;
   select * into parent from eflow_r7.nodes where id=v_parent and task_id=p_root;
   if v_parent is not null and parent.id is null then raise exception 'Destination must share the root';end if;
   select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
   if v_kind='office' then update public.subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;else update public.personal_subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;end if;
   if v_kind='office' then update public.subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;else update public.personal_subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;end if;
  elsif p_command='edit' then
   v_due:=(p_payload->>'due')::date;
   if v_due is not null and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.id<>v_id and c.due_date>v_due) then raise exception 'Edit descendant dates before shortening this deadline';end if;
   if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a title';end if;
   perform set_config('eflow.subtask_deadline_authorized','on',true);
   if v_kind='office' then if (v_due is distinct from n.due_date or
      (p_payload ? 'start' and (p_payload->>'start')::date is distinct from
        (select s.start_date from public.subtasks s where s.id=v_id)))
      and nullif(btrim(p_payload->>'note'),'') is null then
      raise exception 'Enter a reason for the schedule change.' using errcode='22023';
    end if;
    update public.subtasks set dependency_ids=case when p_payload ? 'dependency_ids'
    then array(select value::uuid from jsonb_array_elements_text(p_payload->'dependency_ids')) else dependency_ids end,
    title=btrim(p_payload->>'title'),priority=coalesce(p_payload->>'priority',priority),due_date=v_due,start_date=case when p_payload ? 'start' then (p_payload->>'start')::date else start_date end,due_date_change_reason=case when v_due is distinct from due_date or (p_payload ? 'start' and (p_payload->>'start')::date is distinct from start_date) then btrim(p_payload->>'note') else due_date_change_reason end,
      due_date_changed_at=case when v_due is distinct from due_date or (p_payload ? 'start' and (p_payload->>'start')::date is distinct from start_date) then now() else due_date_changed_at end,
      due_date_changed_by=case when v_due is distinct from due_date or (p_payload ? 'start' and (p_payload->>'start')::date is distinct from start_date) then auth.uid() else due_date_changed_by end,is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;
   else update public.personal_subtasks set title=btrim(p_payload->>'title'),due_date=v_due,start_date=case when p_payload ? 'start' then (p_payload->>'start')::date else start_date end,is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;end if;
   perform set_config('eflow.subtask_deadline_authorized','off',true);
  else
   if v_kind='office' and (exists(select 1 from public.subtask_progress_updates where subtask_id=any(v_subtree)) or exists(select 1 from public.subtask_submissions where subtask_id=any(v_subtree))
    or exists(select 1 from public.work_budget_allocations where subtask_id=any(v_subtree)) or exists(select 1 from public.petty_cash_requests where subtask_id=any(v_subtree))
    or exists(select 1 from public.budget_ledger_entries where subtask_id=any(v_subtree))) then raise exception 'Evidence, budget and cash history prohibit subtree deletion';end if;
   loop
    select id into v_uid from eflow_r7.nodes c where c.id=any(v_subtree) and not exists(select 1 from eflow_r7.nodes d where d.parent_subtask_id=c.id) limit 1;
    exit when v_uid is null;
    if v_kind='office' then delete from public.subtasks where id=v_uid;else delete from public.personal_subtasks where id=v_uid;end if;
   end loop;
  end if;
 elsif p_command='order' then
  select coalesce(array_agg(value::uuid),'{}') into v_order from jsonb_array_elements_text(coalesce(p_payload->'order','[]'));
  if (select count(*) from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent)<>cardinality(v_order)
   or (select count(distinct u) from unnest(v_order) u)<>cardinality(v_order) or exists(select 1 from unnest(v_order) u where not exists(select 1 from eflow_r7.nodes c where c.id=u and c.task_id=p_root and c.parent_subtask_id is not distinct from v_parent and c.status='todo' and c.percent_complete=0)) then raise exception 'Order must contain every untouched sibling exactly once';end if;
  if v_kind='office' then update public.subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);else update public.personal_subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);end if;
 elsif p_command in ('progress','submit','review') then
  if p_command<>'review' and not n.is_standalone and exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed') then raise exception 'Complete earlier ordered siblings first';end if;
  if p_command in ('submit','review') and exists(with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select 1 from below where status<>'completed') then raise exception 'Complete every child step first';end if;
  if p_command='progress' then
   if (p_payload->>'progress')::int not between 0 and 99 then raise exception 'Progress must be 0–99; submit at completion';end if;
   update public.personal_subtasks set percent_complete=(p_payload->>'progress')::int,status='in_progress',note=coalesce(p_payload->>'note','') where id=v_id;
  elsif p_command='submit' then
   update public.personal_subtasks set status='completed',percent_complete=100,note=coalesce(p_payload->>'note',''),submitted_by=auth.uid(),reviewer_id=null where id=v_id;
  else
   raise exception 'Subitems complete directly; review the parent task instead' using errcode='22023';
  end if;
 else raise exception 'Unsupported work command';end if;
 if v_kind='office' and p_command not in ('contributors','progress','submit','review') then
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique deferred;end if;
  with recursive ordered as (
   select id,array[lpad(sibling_order::text,10,'0')||id::text] path from public.subtasks where task_id=p_root and parent_subtask_id is null
   union all select c.id,p.path||(lpad(c.sibling_order::text,10,'0')||c.id::text) from public.subtasks c join ordered p on c.parent_subtask_id=p.id where c.task_id=p_root
  ), ranked as (select id,row_number() over(order by path)-1 rank from ordered)
  update public.subtasks s set position=r.rank from ranked r where s.id=r.id and s.position<>r.rank;
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique immediate;end if;
 end if;
 delete from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=p_root;
 v_result:=eflow_r7.snapshot(p_root);
 insert into public.work_tree_events(root_id,project_id,actor_id,actor_name,command,node_id,before_data,after_data) values(p_root,(r->>'project')::uuid,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_command,v_id,v_before,v_result);
 if v_kind='office' and p_command in ('create','staff','contributors','root_lead') then
  foreach v_uid in array coalesce(v_people,'{}') loop
   if v_uid<>auth.uid() and not coalesce((case when p_command in ('contributors','root_lead') then v_before->'root'->'people' else (select to_jsonb(assigned_to_ids) from jsonb_to_recordset(v_before->'nodes') as old_node(id uuid,assigned_to_ids uuid[]) where id=v_id) end) ? v_uid::text,false) then
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,project_id,work_node_id)
    values(v_uid,'assignment',case when v_id is null then 'Task assignment' else 'Subtask assignment' end,'You were assigned to "'||coalesce(p_payload->>'title',n.title,(select title from public.tasks where id=p_root))||'".',p_root,(select title from public.tasks where id=p_root),auth.uid(),(select full_name from public.profiles where id=auth.uid()),(r->>'project')::uuid,v_id);
   end if;
  end loop;
 end if;
 insert into eflow_r7.receipts values(auth.uid(),p_request,p_root,v_terms,v_result);
 return v_result;
end $$;
revoke all on function eflow_r7.command(uuid, integer, uuid, text, jsonb) from public, anon, authenticated, service_role;

-- 7. Update eflow_r7.guard_node to block direct subtask planning/mutation by non-Task-Lead Head/Project Lead once active.
create or replace function eflow_r7.guard_node()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare n record;r jsonb;v_root uuid;v_parent uuid;v_depth int:=1;v_seen uuid[];v_due date;v_uid uuid;
begin
 if tg_op='UPDATE' and eflow_r9.internal(coalesce((select linked_project_id from public.tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)),(select project_id from public.personal_tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)))) then return new;end if;
 v_root:=case when tg_op='DELETE' then old.task_id else new.task_id end;r:=eflow_r7.root(v_root);
 if r is null or tg_table_name='subtasks' and exists(select 1 from public.tasks where id=v_root and proposed_office_identity_id is not null) then
  if tg_op<>'DELETE' and (new.parent_subtask_id is not null or new.lead_id is not null) then raise exception 'Nested delegation requires a project root';end if;
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if auth.uid() is not null and not eflow_r7.read_root(v_root) then raise exception 'Current work access required' using errcode='42501';end if;
 if auth.uid() is not null
    and not eflow_r7.internal(v_root)
    and r->>'kind'='office'
    and eflow_publication.subtask_planning_locked(v_root)
    and (
      tg_op in ('INSERT','DELETE')
      or (to_jsonb(new)-array['status','percent_complete','is_completed','completed_by','completed_at','started_at','reviewer_id','latest_submission_id','updated_at'])
         is distinct from
         (to_jsonb(old)-array['status','percent_complete','is_completed','completed_by','completed_at','started_at','reviewer_id','latest_submission_id','updated_at'])
    ) then
  raise exception 'Only the Task Lead can add or modify subtasks once the project is active' using errcode='42501';
 end if;
 if tg_op='DELETE' then
  if auth.uid() is not null and not eflow_r7.internal(v_root) and not eflow_r7.manage(v_root,null) then raise exception 'Work deletion denied' using errcode='42501';end if;
  if exists(select 1 from eflow_r7.nodes where parent_subtask_id=old.id) then raise exception 'Delete the reviewed subtree through the nested work action';end if;
  if old.status<>'todo' or old.percent_complete<>0 then raise exception 'Started work and history cannot be deleted';end if;
  if tg_table_name='subtasks' and (exists(select 1 from public.subtask_progress_updates where subtask_id=old.id) or exists(select 1 from public.subtask_submissions where subtask_id=old.id)
   or exists(select 1 from public.work_budget_allocations where subtask_id=old.id) or exists(select 1 from public.petty_cash_requests where subtask_id=old.id) or exists(select 1 from public.budget_ledger_entries where subtask_id=old.id)) then raise exception 'Evidence, progress, budget and cash history prevent deletion';end if;return old;
 end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.task_id is distinct from old.task_id) then raise exception 'Work identity is immutable' using errcode='42501';end if;
 if auth.uid() is not null and not eflow_r7.internal(v_root) and (
  tg_op='INSERT' and (new.parent_subtask_id is not null or new.lead_id is not null)
  or tg_op='UPDATE' and (new.parent_subtask_id is distinct from old.parent_subtask_id or new.lead_id is distinct from old.lead_id or new.sibling_order is distinct from old.sibling_order)
 ) then raise exception 'Use the versioned nested work operation' using errcode='42501';end if;
 if tg_op='INSERT' and new.parent_subtask_id is null and tg_table_name='subtasks' then new.sibling_order:=new.position;end if;
 v_parent:=new.parent_subtask_id;v_seen:=array[new.id];
 if r->>'due' ~ '^\d{4}-\d{2}-\d{2}$' then v_due:=(r->>'due')::date;end if;
 while v_parent is not null loop
  select * into n from eflow_r7.nodes where id=v_parent and task_id=v_root;
  if not found or v_parent=any(v_seen) then raise exception 'Same root required; self-parent and cycles are forbidden';end if;
  v_seen:=v_seen||v_parent;v_depth:=v_depth+1;
  if v_depth>8 then raise exception 'Maximum subitem depth is 8';end if;
  if n.due_date is not null then v_due:=least(v_due,n.due_date);end if;v_parent:=n.parent_subtask_id;
 end loop;
 if new.due_date is null and tg_op='INSERT' then new.due_date:=v_due;end if;
 if v_due is not null and new.due_date>v_due then raise exception 'Child deadline cannot exceed an ancestor deadline';end if;
 if tg_op='INSERT' or new.assigned_to_ids is distinct from old.assigned_to_ids or new.lead_id is not null and new.lead_id is distinct from old.lead_id then
  foreach v_uid in array array_remove(array[new.lead_id]||coalesce(new.assigned_to_ids,'{}'::uuid[]),null) loop
   if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose active selected people from this project and responsible Office' using errcode='42501';end if;
  end loop;
 end if;
 if tg_op='UPDATE' and not eflow_r7.internal(v_root) and new.parent_subtask_id is not null and (to_jsonb(new)-array['status','percent_complete','is_completed','completed_by','completed_at','started_at','reviewer_id','latest_submission_id','updated_at']) is distinct from (to_jsonb(old)-array['status','percent_complete','is_completed','completed_by','completed_at','started_at','reviewer_id','latest_submission_id','updated_at']) then raise exception 'Nested planning uses the versioned branch operation' using errcode='42501';end if;
 if auth.uid() is not null and not eflow_r7.internal(v_root) and (tg_op='INSERT' or (to_jsonb(new)-array['status','percent_complete','is_completed','completed_by','completed_at','started_at','reviewer_id','latest_submission_id','updated_at']) is distinct from (to_jsonb(old)-array['status','percent_complete','is_completed','completed_by','completed_at','started_at','reviewer_id','latest_submission_id','updated_at'])) and not eflow_r7.manage(v_root,null) then raise exception 'Current root lead or Head required for flat planning' using errcode='42501';end if;
 return new;
end $$;
revoke all on function eflow_r7.guard_node() from public, anon, authenticated, service_role;

-- 8. Auto-enroll Office members when assigned directly through assign_task_with_details or create_task_with_details.
create or replace function public.assign_task_with_details(
  p_task_id uuid, p_assignee uuid, p_assignee_name text default null::text,
  p_team_id text default null::text, p_team_name text default null::text,
  p_team_member_ids jsonb default null::jsonb, p_team_member_names jsonb default null::jsonb,
  p_reviewer uuid default null::uuid, p_backup_reviewer uuid default null::uuid,
  p_set_reviewers boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_name text;
  before_task public.tasks;
  assigned_task public.tasks;
  resolved_reviewer uuid;
  resolved_backup uuid;
  v_enroll_ids uuid[];
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_team_member_ids is not null
     and jsonb_typeof(p_team_member_ids) <> 'array' then
    raise exception 'Team member ids must be an array' using errcode = '22023';
  end if;
  if p_team_member_names is not null
     and jsonb_typeof(p_team_member_names) <> 'array' then
    raise exception 'Team member names must be an array' using errcode = '22023';
  end if;

  select full_name into caller_name from public.profiles where id = caller;
  select * into before_task
  from public.tasks
  where id = p_task_id and deleted_at is null
  for update;
  if not found then raise exception 'Task not found'; end if;
  if not public.can_manage_task(p_task_id, caller) then
    raise exception 'Not allowed to assign this task' using errcode = '42501';
  end if;

  if before_task.linked_project_id is not null and before_task.source_collaboration_draft_id is null then
    select array_remove(
      array[p_assignee] || case
        when p_team_member_ids is null then '{}'::uuid[]
        else array(
          select nullif(trim(member.value), '')::uuid
          from jsonb_array_elements_text(p_team_member_ids) as member(value)
          where nullif(trim(member.value), '') is not null
        )
      end,
      null
    ) into v_enroll_ids;
    perform eflow_r7.ensure_office_members(before_task.linked_project_id, before_task.org_id, v_enroll_ids);
  end if;

  resolved_reviewer := case
    when p_set_reviewers then p_reviewer
    else before_task.reviewer_id
  end;
  if resolved_reviewer = p_assignee then
    resolved_reviewer := case
      when before_task.created_by is distinct from p_assignee then before_task.created_by
      else null
    end;
  end if;
  if resolved_reviewer is null then
    select o.head_user_id into resolved_reviewer
    from public.organizations o
    where o.id = before_task.org_id
      and o.head_user_id is distinct from p_assignee;
  end if;

  resolved_backup := case
    when p_set_reviewers then p_backup_reviewer
    else before_task.backup_reviewer_id
  end;
  if resolved_backup = p_assignee or resolved_backup = resolved_reviewer then
    resolved_backup := null;
  end if;

  update public.tasks
  set
    team_id = coalesce(p_team_id, team_id),
    team_name = coalesce(p_team_name, team_name),
    team_member_ids = case
      when p_team_member_ids is null then team_member_ids
      else array(
        select nullif(trim(member.value), '')::uuid
        from jsonb_array_elements_text(p_team_member_ids) as member(value)
        where nullif(trim(member.value), '') is not null
      )
    end,
    team_member_names = case
      when p_team_member_names is null then team_member_names
      else array(
        select member.value
        from jsonb_array_elements_text(p_team_member_names) as member(value)
      )
    end,
    reviewer_id = resolved_reviewer,
    backup_reviewer_id = resolved_backup
  where id = p_task_id;

  if before_task.assigned_to is distinct from p_assignee
     or (before_task.status = 'pending_assignment' and p_assignee is not null) then
    select * into assigned_task from public.assign_task(
      p_task_id,
      p_assignee,
      p_assignee_name
    );
  else
    select * into assigned_task from public.tasks where id = p_task_id;
  end if;

  if before_task.assigned_to is not null
     and before_task.assigned_to is distinct from p_assignee
     and before_task.assigned_to <> caller then
    insert into public.notifications (
      user_id, type, title, message, task_id, task_title,
      actor_id, actor_name, status_from, status_to, reason
    ) values (
      before_task.assigned_to,
      'reassignment',
      'Task reassigned',
      '"' || before_task.title || '" was reassigned to another owner.',
      p_task_id,
      before_task.title,
      caller,
      coalesce(caller_name, 'Manager'),
      before_task.status,
      assigned_task.status,
      ''
    );
  end if;

  return assigned_task;
end;
$$;

create or replace function public.create_task_with_details(p_payload jsonb)
returns public.tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_profile public.profiles;
  target_org uuid;
  selected_assignee uuid := nullif(p_payload ->> 'assigned_to', '')::uuid;
  target_project uuid := nullif(p_payload ->> 'linked_project_id', '')::uuid;
  initial_status text;
  task_priority text := coalesce(nullif(trim(p_payload ->> 'priority'), ''), 'medium');
  created_task public.tasks;
  v_enroll_ids uuid[];
begin
  if caller is null then
    raise exception 'Authentication is required to create a task'
      using errcode = '42501';
  end if;

  select * into caller_profile
  from public.profiles
  where id = caller and is_active;
  if not found then
    raise exception 'An active eFlow profile is required to create a task'
      using errcode = '42501';
  end if;

  if nullif(trim(p_payload ->> 'title'), '') is null then
    raise exception 'Task title is required'
      using errcode = '22023';
  end if;
  if task_priority not in ('low', 'medium', 'high') then
    raise exception 'Invalid task priority'
      using errcode = '22023';
  end if;

  target_org := coalesce(
    nullif(p_payload ->> 'org_id', '')::uuid,
    caller_profile.org_id
  );
  if not public.can_create_scoped_work(target_org, caller) then
    raise exception 'You cannot create tasks in this organization'
      using errcode = '42501';
  end if;

  if selected_assignee is not null and not exists (
    select 1 from public.profiles
    where id = selected_assignee and is_active
  ) then
    raise exception 'Task assignee must be an active eFlow user'
      using errcode = '22023';
  end if;

  if target_project is not null and nullif(p_payload ->> 'source_collaboration_draft_id', '') is null then
    select array_remove(
      array[selected_assignee] || array(
        select value::uuid
        from jsonb_array_elements_text(coalesce(p_payload -> 'team_member_ids', '[]'::jsonb))
      ),
      null
    ) into v_enroll_ids;
    perform eflow_r7.ensure_office_members(target_project, target_org, v_enroll_ids);
  end if;

  initial_status := case
    when selected_assignee is null then 'pending_assignment'
    else 'todo'
  end;

  insert into public.tasks (
    title, description, status, priority, assigned_to, assignee_name,
    department, org_id, team_id, team_name, team_member_ids, team_member_names,
    deadline, due_date, tags, recommended_employee_ids, recommendation_reasoning,
    recommendation_source, recommendation_lead_id, reviewer_id, backup_reviewer_id,
    acceptance_criteria, definition_of_done, dependency_ids, burnout_warning,
    proposal_id, proposal_title, program_id, program_title, project_id, project_title,
    activity_id, activity_title, activity_schedule, hierarchy_path, import_batch_id,
    barangay, estimated_hours, budget_impact, linked_project_id, milestone_id,
    percent_complete, created_by
  ) values (
    trim(p_payload ->> 'title'),
    nullif(p_payload ->> 'description', ''),
    initial_status,
    task_priority,
    selected_assignee,
    coalesce(p_payload ->> 'assignee_name', ''),
    coalesce(p_payload ->> 'department', ''),
    target_org,
    coalesce(p_payload ->> 'team_id', ''),
    coalesce(p_payload ->> 'team_name', ''),
    array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload -> 'team_member_ids', '[]'::jsonb))),
    array(select value from jsonb_array_elements_text(coalesce(p_payload -> 'team_member_names', '[]'::jsonb))),
    coalesce(p_payload ->> 'deadline', ''),
    coalesce(p_payload ->> 'due_date', p_payload ->> 'deadline', ''),
    array(select value from jsonb_array_elements_text(coalesce(p_payload -> 'tags', '[]'::jsonb))),
    array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload -> 'recommended_employee_ids', '[]'::jsonb))),
    nullif(p_payload ->> 'recommendation_reasoning', ''),
    nullif(p_payload ->> 'recommendation_source', ''),
    nullif(p_payload ->> 'recommendation_lead_id', '')::uuid,
    nullif(p_payload ->> 'reviewer_id', '')::uuid,
    nullif(p_payload ->> 'backup_reviewer_id', '')::uuid,
    coalesce(p_payload -> 'acceptance_criteria', '[]'::jsonb),
    nullif(p_payload ->> 'definition_of_done', ''),
    coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload -> 'dependency_ids', '[]'::jsonb))), '{}'::uuid[]),
    coalesce((p_payload ->> 'burnout_warning')::boolean, false),
    nullif(p_payload ->> 'proposal_id', ''),
    nullif(p_payload ->> 'proposal_title', ''),
    nullif(p_payload ->> 'program_id', ''),
    nullif(p_payload ->> 'program_title', ''),
    nullif(p_payload ->> 'project_id', ''),
    nullif(p_payload ->> 'project_title', ''),
    nullif(p_payload ->> 'activity_id', ''),
    nullif(p_payload ->> 'activity_title', ''),
    nullif(p_payload ->> 'activity_schedule', ''),
    nullif(p_payload ->> 'hierarchy_path', ''),
    nullif(p_payload ->> 'import_batch_id', ''),
    nullif(p_payload ->> 'barangay', ''),
    coalesce((p_payload ->> 'estimated_hours')::numeric, 0),
    coalesce((p_payload ->> 'budget_impact')::numeric, 0),
    target_project,
    nullif(p_payload ->> 'milestone_id', '')::uuid,
    coalesce((p_payload ->> 'percent_complete')::int, 0),
    caller
  )
  returning * into created_task;

  return created_task;
end;
$$;

notify pgrst, 'reload schema';
commit;
