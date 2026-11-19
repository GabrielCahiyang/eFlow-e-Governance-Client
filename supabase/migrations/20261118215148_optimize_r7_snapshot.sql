SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION eflow_r7.snapshot(p_root uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_task record;
  v_proj record;
  v_actor record;
  v_root_lead uuid;
  v_proj_id uuid;
  v_office_id uuid;
  v_open boolean;
  v_eligible boolean := false;
  v_reader boolean := false;
  v_can_see_task boolean := false;
  v_head boolean := false;
  v_phase2_head boolean := false;
  v_plan_lead boolean := false;
  v_staffing_locked boolean := false;
  v_planning_locked boolean := false;
  v_node_planning_locked boolean := false;
  v_root_contrib_locked boolean := false;
  v_actor_member boolean := false;
  v_root_lead_member boolean := false;
  v_root_can_manage boolean := false;
  v_root_node_scope boolean := false;
  v_dep_scope boolean := false;
  v_proj_open boolean := false;
  v_office_joined boolean := false;
  v_live_task boolean := false;
  v_has_acceptances boolean := false;
  v_invalid_tree boolean := false;
  v_work_day date;
  v_revision integer;
  v_member_ids uuid[] := '{}'::uuid[];
  v_node_people uuid[] := '{}'::uuid[];
  v_all_node_ids uuid[] := '{}'::uuid[];
  v_dirty_ids uuid[] := '{}'::uuid[];
  v_root_history_untouched boolean := true;
  v_root_any_child_touched boolean := false;
  v_people jsonb := '[]'::jsonb;
  v_nodes jsonb := '[]'::jsonb;
  v_root_caps jsonb;
  v_leaf_total bigint := 0;
  v_leaf_completed bigint := 0;
  v_root_json jsonb;
begin
  -- Try office root first
  select t.id, t.linked_project_id, t.org_id, t.assigned_to, t.recommendation_lead_id,
         t.status, t.deleted_at, t.archived_at, t.proposed_office_identity_id,
         t.source_collaboration_draft_id, t.team_member_ids, t.due_date, t.deadline,
         t.start_date, t.updated_at, t.percent_complete
    into v_task
  from public.tasks t
  join public.projects p on p.id = t.linked_project_id
  where t.id = p_root
    and t.source_collaboration_draft_id is null
    and p.source_collaboration_draft_id is null;

  if not found then
    -- Personal root or missing: preserve existing pipeline
    return eflow_m7.with_visible_counts(
      eflow_publication.with_subtask_staffing(
        eflow_m7.with_schedule(
          eflow_r7.m7_baseline_snapshot(p_root)
        )
      )
    );
  end if;

  select p.id, p.status, p.org_id, p.project_lead_id, p.start_date, p.target_date,
         p.source_collaboration_draft_id
    into v_proj
  from public.projects p
  where p.id = v_task.linked_project_id;

  select pr.id, pr.role, pr.is_active, pr.org_id, u.email_confirmed_at
    into v_actor
  from public.profiles pr
  left join auth.users u on u.id = pr.id
  where pr.id = v_uid;

  v_eligible := (v_actor.id is not null and v_actor.is_active
                 and v_actor.role in ('head', 'member', 'accounting_staff')
                 and v_actor.email_confirmed_at is not null);
  v_reader := v_eligible or (v_actor.id is not null and v_actor.is_active
                             and v_actor.role = 'admin' and v_actor.email_confirmed_at is not null);
  v_can_see_task := v_reader and coalesce(public.can_see_task(p_root, v_uid), false);
  if not v_can_see_task then
    raise exception 'Nested work access denied' using errcode = '42501';
  end if;

  v_proj_id := v_task.linked_project_id;
  v_office_id := v_task.org_id;
  v_root_lead := coalesce(v_task.assigned_to, v_task.recommendation_lead_id);
  v_open := (v_task.deleted_at is null and v_task.archived_at is null
             and v_task.proposed_office_identity_id is null
             and v_task.status not in ('for_review', 'completed', 'cancelled')
             and v_proj.status not in ('completed', 'archived'));
  v_proj_open := (v_proj.status not in ('completed', 'archived') and v_proj.source_collaboration_draft_id is null);
  v_live_task := (v_proj.id is not null and v_proj.status not in ('completed', 'archived')
                  and v_task.archived_at is null and v_task.deleted_at is null
                  and v_task.status not in ('for_review', 'completed', 'cancelled')
                  and v_eligible);

  v_root_node_scope := (
    v_task.deleted_at is null and (
      v_root_lead = v_uid
      or v_task.status::text in ('in_progress', 'for_review', 'changes_requested', 'completed')
      or exists (select 1 from public.task_status_history h where h.task_id = p_root and h.to_status::text = 'in_progress')
    )
  );

  v_dep_scope := (v_task.proposed_office_identity_id is null
                  and (v_proj.status <> 'active' or v_task.assigned_to = v_uid));

  select exists (
    select 1 from public.project_offices po
    where po.project_id = v_proj_id and po.office_id = v_office_id
      and po.invitation_status = 'joined' and po.relationship_type in ('lead', 'collaborating')
  ) into v_office_joined;

  v_phase2_head := (
    v_actor.id is not null and v_actor.is_active and v_actor.role = 'head' and v_actor.org_id = v_office_id
    and exists (select 1 from public.organizations o where o.id = v_office_id and o.is_active and o.head_user_id = v_uid)
  );
  v_head := v_eligible and v_phase2_head and v_office_joined;
  v_plan_lead := (
    v_proj.org_id = v_office_id and v_proj.source_collaboration_draft_id is null
    and v_proj.status in ('planning', 'active', 'on_hold') and v_proj.project_lead_id = v_uid
    and v_actor.id is not null and v_actor.is_active and v_actor.org_id = v_proj.org_id
    and v_actor.role not in ('admin', 'super_admin', 'viewer')
  );
  v_staffing_locked := (v_proj.status = 'active' and v_proj.project_lead_id = v_uid);
  v_planning_locked := (
    v_proj.status <> 'planning' and v_root_lead is distinct from v_uid
    and (v_proj.project_lead_id = v_uid or v_phase2_head)
  );
  v_node_planning_locked := (
    coalesce(v_proj.status, '') <> 'planning' and v_root_lead is distinct from v_uid
    and (v_head or v_plan_lead)
  );
  v_root_contrib_locked := (
    v_proj.status = 'active' and v_root_lead is distinct from v_uid
    and not (v_phase2_head and v_office_joined)
    and not v_plan_lead
    and v_task.deleted_at is null and v_task.proposed_office_identity_id is null
  );

  v_work_day := coalesce(
    (select (statement_timestamp() at time zone w.timezone)::date
     from public.workspaces w where w.office_id = v_office_id and w.kind = 'office' order by w.id limit 1),
    (statement_timestamp() at time zone 'Asia/Manila')::date
  );

  select revision into v_revision from eflow_r7.tree_state where root_id = p_root;
  v_revision := coalesce(v_revision, 1);

  -- Gather participant people referenced by nodes when visible
  if v_root_node_scope then
    select coalesce(array_agg(distinct u), '{}'::uuid[]),
           coalesce(array_agg(distinct s.id), '{}'::uuid[])
      into v_node_people, v_all_node_ids
    from public.subtasks s
    left join lateral unnest(
      case when s.lead_id is not null then array[s.lead_id] else '{}'::uuid[] end
      || coalesce(s.assigned_to_ids, '{}'::uuid[])
    ) as u on true
    where s.task_id = p_root;
  else
    select coalesce(array_agg(s.id), '{}'::uuid[])
      into v_all_node_ids
    from public.subtasks s where s.task_id = p_root;
  end if;
  v_node_people := array_remove(v_node_people, null);

  -- Single set-based evaluation of all members + assignable people
  with pom_users as (
    select m.user_id,
           bool_or(m.access_ended_at is null
                   and (m.access_end is null or m.access_end > now())
                   and (m.engagement = 'Permanent' or v_proj.status not in ('completed', 'archived'))) as any_active,
           bool_or(m.access_ended_at is not null
                   or m.access_end <= now()
                   or ((m.engagement <> 'Permanent' or m.until_close) and not v_proj_open)) as any_blocked
    from public.project_office_members m
    join public.project_offices o on o.id = m.project_office_id
    where o.project_id = v_proj_id and o.office_id = v_office_id
    group by m.user_id
  ), guest_users as (
    select gm.user_id
    from public.project_guest_members gm
    where gm.project_id = v_proj_id and gm.office_id = v_office_id
      and gm.ended_at is null and (gm.access_end is null or gm.access_end > now())
      and (gm.engagement = 'Permanent' or v_proj.status not in ('completed', 'archived'))
    group by gm.user_id
  ), removed_users as (
    select rem.user_id
    from eflow_r9.removed rem
    where rem.project_id = v_proj_id
      and rem.scope = coalesce(v_office_id, '00000000-0000-0000-0000-000000000000'::uuid)
    group by rem.user_id
  ), grant_users as (
    select g.recipient as user_id
    from public.project_access_grants g
    where g.project_id = v_proj_id
      and g.office_id is not distinct from v_office_id
      and g.revoked_at is null and g.redeemed_at is not null
      and (g.access_end is null or g.access_end > now())
      and g.access = 'member' and v_proj_open
    group by g.recipient
  ), evaluated as (
    select p.id, p.full_name, p.org_id,
           (pm.user_id is not null) as has_pom_row,
           (
             (p.is_active and p.role in ('head', 'member', 'accounting_staff') and u.email_confirmed_at is not null)
             and (
               (
                 rem.user_id is null
                 and not coalesce(pm.any_blocked, false)
                 and v_office_joined
                 and ((coalesce(pm.any_active, false) and p.org_id = v_office_id) or gu.user_id is not null)
               )
               or (gr.user_id is not null and rem.user_id is null)
             )
           ) as is_member,
           (
             (p.is_active and p.role in ('head', 'member', 'accounting_staff') and u.email_confirmed_at is not null)
             and p.org_id = v_office_id
             and v_office_joined
             and rem.user_id is null
             and not coalesce(pm.any_blocked, false)
           ) as is_office_elig
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join pom_users pm on pm.user_id = p.id
    left join guest_users gu on gu.user_id = p.id
    left join removed_users rem on rem.user_id = p.id
    left join grant_users gr on gr.user_id = p.id
  )
  select
    coalesce(array_agg(id) filter (where is_member), '{}'::uuid[]),
    coalesce(jsonb_agg(
      jsonb_build_object('id', id, 'name', full_name, 'office', org_id, 'eligible', (is_member or is_office_elig))
      order by full_name, id
    ) filter (where (
        org_id = v_office_id
        or has_pom_row
        or id = v_root_lead
        or (v_task.team_member_ids is not null and id = any(v_task.team_member_ids))
        or id = any(v_node_people)
      ) and (
        (is_member or is_office_elig)
        or id = v_root_lead
        or (v_task.team_member_ids is not null and id = any(v_task.team_member_ids))
        or id = any(v_node_people)
      )), '[]'::jsonb)
  into v_member_ids, v_people
  from evaluated;

  v_actor_member := (v_uid = any(v_member_ids));
  v_root_lead_member := (v_root_lead is not null and v_root_lead = any(v_member_ids));
  v_root_can_manage := (v_eligible and v_open and (v_head or (v_actor_member and v_root_lead = v_uid))) or (v_open and v_plan_lead);

  if cardinality(v_all_node_ids) > 0 then
    v_has_acceptances := exists (select 1 from eflow_work_clearance.acceptances a where a.root_id = p_root);

    with recursive above as (
      select n.id origin, n.id, n.parent_subtask_id, array[n.id] path, 1 depth, false cycle
      from public.subtasks n where n.task_id = p_root
      union all
      select a.origin, n.id, n.parent_subtask_id, a.path || n.id, a.depth + 1, n.id = any(a.path)
      from above a join public.subtasks n on n.id = a.parent_subtask_id and n.task_id = p_root
      where not a.cycle and a.depth <= 8
    )
    select exists (
      select 1 from above a
      where a.cycle or a.depth > 8
         or (a.parent_subtask_id is not null and not exists (select 1 from public.subtasks n where n.id = a.parent_subtask_id and n.task_id = p_root))
    ) into v_invalid_tree;

    v_dirty_ids := eflow_r7.tree_structural_history(p_root, 'office');

    select exists (
      select 1 from public.subtasks c
      where c.task_id = p_root and c.parent_subtask_id is null and (c.status <> 'todo' or c.percent_complete <> 0)
    ) into v_root_any_child_touched;

    if not v_planning_locked and (v_plan_lead or (v_eligible and (v_head or (v_actor_member and v_root_lead = v_uid)))) then
      if v_open and v_eligible then
        v_root_history_untouched := coalesce((eflow_r7.history_facts(p_root, v_all_node_ids)->>'untouched')::boolean, true);
      end if;
    end if;
  end if;

  -- Root capabilities (matches operation_capabilities(p_root, null))
  declare
    v_rc_common text := case
      when not v_eligible then 'read_only'
      when not v_open then 'lifecycle_blocked'
      else null
    end;
    v_rc_manage boolean := coalesce(v_open and (v_plan_lead or (v_eligible and (v_head or (v_actor_member and v_root_lead = v_uid)))), false);
    v_rc_manage_plan boolean := v_rc_manage or v_plan_lead;
    v_r_mc text;
    v_r_al text;
    v_r_cc text;
    v_r_oc text;
  begin
    if v_rc_common is not null then
      v_r_mc := v_rc_common; v_r_al := v_rc_common; v_r_cc := v_rc_common; v_r_oc := v_rc_common;
    else
      v_r_mc := case
        when v_root_contrib_locked then 'active_staffing_locked'
        when not v_rc_manage_plan then 'branch_denied'
        when v_root_lead is null then 'lifecycle_blocked'
        else null
      end;
      v_r_al := case
        when not (v_head or v_plan_lead) then 'appointment_denied'
        else null
      end;
      v_r_cc := case
        when v_planning_locked then 'branch_denied'
        when not v_rc_manage_plan then 'branch_denied'
        else null
      end;
      if v_r_cc is null and v_invalid_tree then
        raise exception 'Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first' using errcode = '23514';
      end if;
      v_r_oc := case
        when v_planning_locked then 'branch_denied'
        when not v_rc_manage_plan then 'branch_denied'
        when v_root_any_child_touched then 'lifecycle_blocked'
        else null
      end;
      if v_r_oc is null and v_invalid_tree then
        raise exception 'Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first' using errcode = '23514';
      end if;
      if v_r_oc is null and not v_root_history_untouched then
        v_r_oc := 'history_blocked';
      end if;
    end if;

    v_root_caps := jsonb_build_object(
      'manage_contributors', jsonb_build_object('allowed', v_r_mc is null, 'reason_code', v_r_mc),
      'appoint_lead', jsonb_build_object('allowed', v_r_al is null, 'reason_code', v_r_al),
      'create_child', jsonb_build_object('allowed', v_r_cc is null, 'reason_code', v_r_cc),
      'order_children', jsonb_build_object('allowed', v_r_oc is null, 'reason_code', v_r_oc)
    );
  end;

  -- Single-pass computation of all subtask nodes when visible to actor
  if v_root_node_scope and cardinality(v_all_node_ids) > 0 then
    with recursive s_raw as materialized (
      select s.id, s.task_id, s.parent_subtask_id, s.lead_id, s.title, s.assigned_to_ids,
             s.sibling_order, s.due_date, s.is_standalone, s.status, s.percent_complete,
             s.created_at, 'office'::text as kind, s.start_date, s.started_at,
             s.priority, s.due_date_change_reason, s.dependency_ids, s.latest_submission_id
      from public.subtasks s
      where s.task_id = p_root
    ),
    prog_set as materialized (
      select distinct u.subtask_id from public.subtask_progress_updates u where u.subtask_id = any(v_all_node_ids)
    ),
    sub_set as materialized (
      select distinct sub.subtask_id from public.subtask_submissions sub where sub.subtask_id = any(v_all_node_ids)
    ),
    acc_set as materialized (
      select distinct a.node_id as id
      from eflow_work_clearance.acceptances a
      join s_raw sr on sr.id = a.node_id
      where v_has_acceptances and a.root_id = p_root and a.node_id is not null
        and eflow_work_clearance.accepted(p_root, a.node_id)
    ),
    tree as materialized (
      select n.*,
             1 as depth,
             array[n.sibling_order] as path,
             (v_root_lead_member and n.lead_id is not null and n.lead_id = any(v_member_ids)) as chain_ok,
             v_root_lead_member as parent_chain_ok,
             (n.lead_id = v_uid) as anc_uid_lead,
             false as parent_anc_uid_lead
      from s_raw n
      where n.parent_subtask_id is null
      union all
      select n.*,
             t.depth + 1,
             t.path || n.sibling_order,
             (t.chain_ok and n.lead_id is not null and n.lead_id = any(v_member_ids)) as chain_ok,
             t.chain_ok as parent_chain_ok,
             (t.anc_uid_lead or n.lead_id = v_uid) as anc_uid_lead,
             t.anc_uid_lead as parent_anc_uid_lead
      from s_raw n
      join tree t on n.parent_subtask_id = t.id
      where t.depth < 8
    ),
    closure as materialized (
      select n.id as anc_id, n.id as desc_id, 1 as c_depth, array[n.id] as c_path
      from s_raw n
      union all
      select c.anc_id, n.id as desc_id, c.c_depth + 1, c.c_path || n.id
      from closure c
      join s_raw n on n.parent_subtask_id = c.desc_id
      where c.c_depth < 8 and not (n.id = any(c.c_path))
    ),
    subtree_agg as materialized (
      select c.anc_id as id,
             array_agg(c.desc_id) as subtree_ids,
             coalesce(array_agg(c.desc_id) filter (where c.desc_id <> c.anc_id), '{}'::uuid[]) as child_subtree_ids,
             bool_and(d.status = 'todo' and d.percent_complete = 0) as untouched,
             coalesce(bool_and(d.status = 'completed') filter (where c.desc_id <> c.anc_id), true) as descendants_complete,
             bool_or(d.started_at is not null) as any_desc_started_at,
             bool_or(
               d.started_at is not null
               or d.status <> 'todo'
               or coalesce(d.percent_complete, 0) <> 0
               or ps.subtask_id is not null
               or ss.subtask_id is not null
             ) as node_started
      from closure c
      join s_raw d on d.id = c.desc_id
      left join prog_set ps on ps.subtask_id = d.id
      left join sub_set ss on ss.subtask_id = d.id
      group by c.anc_id
    ),
    sib_dirty as materialized (
      select t.parent_subtask_id,
             coalesce(bool_or(sa.subtree_ids && v_dirty_ids), false) as any_sib_dirty,
             coalesce(bool_or(t.status <> 'todo' or t.percent_complete <> 0), false) as any_sib_touched
      from s_raw t
      join subtree_agg sa on sa.id = t.id
      group by t.parent_subtask_id
    ),
    enriched as (
      select t.*,
             sa.untouched,
             sa.descendants_complete,
             sa.any_desc_started_at,
             sa.node_started,
             (sa.subtree_ids && v_dirty_ids) as dirty_subtree,
             (sa.child_subtree_ids && v_dirty_ids) as dirty_children,
             (coalesce(sd_self.any_sib_dirty, false) or (t.parent_subtask_id is not null and t.parent_subtask_id = any(v_dirty_ids))) as dirty_move,
             coalesce(sd_child.any_sib_touched, false) as any_direct_child_touched,
             (v_head or (v_actor_member and (v_root_lead = v_uid or (t.chain_ok and t.anc_uid_lead)))) as mgr_base,
             (v_head or (v_actor_member and (v_root_lead = v_uid or (t.parent_subtask_id is not null and t.parent_chain_ok and t.parent_anc_uid_lead)))) as rep_mgr_base,
             case when t.dependency_ids is not null then
               not exists (
                 select 1 from unnest(t.dependency_ids) as ref(id)
                 left join s_raw ds on ds.id = ref.id
                 where ds.status is distinct from 'completed'
               )
             else
               t.is_standalone or not exists (
                 select 1 from s_raw sib
                 where sib.parent_subtask_id is not distinct from t.parent_subtask_id
                   and sib.sibling_order < t.sibling_order
                   and not sib.is_standalone
                   and sib.status <> 'completed'
               )
             end as ordered_ready,
             (
               v_task.status not in ('todo', 'pending_assignment')
               and (t.started_at is not null or t.status in ('in_progress', 'stuck', 'changes_requested', 'for_review', 'completed'))
             ) as v_activated,
             (
               v_eligible and v_actor_member and t.parent_chain_ok and (
                 v_uid = any(coalesce(t.assigned_to_ids, '{}'::uuid[]))
                 or (t.lead_id = v_uid and t.chain_ok)
               )
             ) as v_node_work,
             (acc.id is not null) as is_accepted,
             case when t.status = 'for_review' then eflow_r7.pending_reviewer(t.id) else null end as pending_reviewer
      from tree t
      join subtree_agg sa on sa.id = t.id
      left join sib_dirty sd_self on sd_self.parent_subtask_id is not distinct from t.parent_subtask_id
      left join sib_dirty sd_child on sd_child.parent_subtask_id is not distinct from t.id
      left join acc_set acc on acc.id = t.id
    ),
    reasons as (
      select e.*,
             -- detail_edit calculation (matches eflow_work_edit.state)
             (e.mgr_base or v_plan_lead) as v_manage_plan,
             (e.rep_mgr_base or v_plan_lead) as v_replace_lead_plan,
             (v_live_task and v_open and e.status in ('todo', 'in_progress', 'changes_requested')) as v_node_live,
             case when not v_eligible then 'read_only' when not v_open then 'lifecycle_blocked' else null end as common_reason,
             (v_node_planning_locked or v_staffing_locked) as v_any_staff_lock
      from enriched e
    ),
    final_nodes as (
      select r.*,
             (r.v_node_live and r.v_manage_plan) as de_details,
             (r.v_node_live and r.v_manage_plan and r.v_replace_lead_plan) as de_due_mgr,
             case when r.common_reason is not null then r.common_reason
               when r.v_any_staff_lock and v_root_lead is distinct from v_uid and r.lead_id is distinct from v_uid then 'active_subtask_staffing_locked'
               when not r.v_manage_plan then 'branch_denied'
               when r.lead_id is null or r.status = 'completed' then 'lifecycle_blocked'
               else null end as r_mc,
             case when r.common_reason is not null then r.common_reason
               when r.v_any_staff_lock and v_root_lead is distinct from v_uid then 'active_subtask_staffing_locked'
               when not r.v_replace_lead_plan then 'appointment_denied'
               when r.status = 'completed' then 'lifecycle_blocked'
               else null end as r_al,
             case when r.common_reason is not null then r.common_reason
               when v_node_planning_locked or not r.v_manage_plan then 'branch_denied'
               when r.status <> 'todo' or r.percent_complete <> 0 or r.depth >= 8 then 'lifecycle_blocked'
               when v_invalid_tree then '__RAISE_INVALID_TREE__'
               when r.dirty_subtree then 'history_blocked'
               else null end as r_cc,
             case when r.common_reason is not null then r.common_reason
               when v_node_planning_locked or not r.v_manage_plan then 'branch_denied'
               when r.status not in ('todo', 'in_progress', 'changes_requested') then 'lifecycle_blocked'
               else null end as r_ed,
             case when r.common_reason is not null then r.common_reason
               when v_node_planning_locked or not r.v_manage_plan then 'branch_denied'
               when not r.untouched then 'lifecycle_blocked'
               when v_invalid_tree then '__RAISE_INVALID_TREE__'
               when r.dirty_move then 'history_blocked'
               else null end as r_mv,
             case when r.common_reason is not null then r.common_reason
               when v_node_planning_locked or not r.v_manage_plan then 'branch_denied'
               when r.any_direct_child_touched then 'lifecycle_blocked'
               when v_invalid_tree then '__RAISE_INVALID_TREE__'
               when r.dirty_children then 'history_blocked'
               else null end as r_oc,
             case when r.common_reason is not null then r.common_reason
               when v_node_planning_locked or v_root_lead is distinct from v_uid then 'branch_denied'
               when r.any_desc_started_at then 'lifecycle_blocked'
               when not r.v_manage_plan then 'branch_denied'
               when not r.untouched then 'lifecycle_blocked'
               when r.dirty_subtree then 'history_blocked'
               when v_invalid_tree then '__RAISE_INVALID_TREE__'
               else null end as r_dl,
             case when r.common_reason is not null then r.common_reason
               when v_proj.status in ('planning', 'on_hold') then case when v_proj.status = 'on_hold' then 'project_on_hold' else 'lifecycle_blocked' end
               when not r.mgr_base and not r.v_node_work then 'branch_denied'
               when r.status = 'completed' or v_task.status not in ('todo', 'in_progress', 'changes_requested') or not r.ordered_ready or not r.v_activated or r.is_accepted then 'lifecycle_blocked'
               else null end as r_ex,
             case when r.common_reason is not null then r.common_reason
               when v_proj.status in ('planning', 'on_hold') then case when v_proj.status = 'on_hold' then 'project_on_hold' else 'lifecycle_blocked' end
               when not r.mgr_base then 'branch_denied'
               when r.status = 'completed' or v_task.status not in ('todo', 'in_progress', 'changes_requested') or not r.ordered_ready or not r.descendants_complete or not r.v_activated or r.is_accepted then 'lifecycle_blocked'
               else null end as r_sb,
             case when r.common_reason is not null then r.common_reason else 'lifecycle_blocked' end as r_rv
      from reasons r
    )
    select
      coalesce(jsonb_agg(
        jsonb_build_object(
          'id', fn.id,
          'task_id', fn.task_id,
          'parent_subtask_id', fn.parent_subtask_id,
          'lead_id', fn.lead_id,
          'title', fn.title,
          'assigned_to_ids', fn.assigned_to_ids,
          'sibling_order', fn.sibling_order,
          'due_date', fn.due_date,
          'is_standalone', fn.is_standalone,
          'status', fn.status,
          'percent_complete', fn.percent_complete,
          'created_at', fn.created_at,
          'kind', fn.kind,
          'depth', fn.depth,
          'path', fn.path,
          'capabilities', jsonb_build_object(
            'manage_contributors', jsonb_build_object('allowed', fn.r_mc is null, 'reason_code', fn.r_mc),
            'appoint_lead', jsonb_build_object('allowed', fn.r_al is null, 'reason_code', fn.r_al),
            'create_child', jsonb_build_object('allowed', fn.r_cc is null, 'reason_code', fn.r_cc),
            'edit_details', jsonb_build_object('allowed', fn.r_ed is null, 'reason_code', fn.r_ed),
            'move', jsonb_build_object('allowed', fn.r_mv is null, 'reason_code', fn.r_mv),
            'order_children', jsonb_build_object('allowed', fn.r_oc is null, 'reason_code', fn.r_oc),
            'delete', jsonb_build_object('allowed', fn.r_dl is null, 'reason_code', fn.r_dl),
            'execute', jsonb_build_object('allowed', fn.r_ex is null, 'reason_code', fn.r_ex),
            'submit', jsonb_build_object('allowed', fn.r_sb is null, 'reason_code', fn.r_sb),
            'review', jsonb_build_object('allowed', fn.r_rv is null, 'reason_code', fn.r_rv)
          ),
          'can_manage', v_open and not v_planning_locked and (v_plan_lead or (v_eligible and fn.mgr_base)),
          'can_appoint', v_open and not v_planning_locked and (v_plan_lead or (v_eligible and fn.rep_mgr_base)),
          'can_order', v_open and not v_planning_locked and (v_plan_lead or (v_eligible and fn.rep_mgr_base)),
          'can_work', v_eligible and v_actor_member and v_open and fn.parent_chain_ok and (
            v_uid = any(coalesce(fn.assigned_to_ids, '{}'::uuid[]))
            or (fn.lead_id = v_uid and fn.chain_ok)
          ),
          'can_review', fn.status = 'for_review' and fn.pending_reviewer = v_uid,
          'current_reviewer', fn.pending_reviewer,
          'start_date', fn.start_date,
          'started_at', fn.started_at,
          'effective_status', case when fn.started_at is not null and fn.status = 'todo' then 'in_progress' else fn.status end,
          'priority', fn.priority,
          'due_date_change_reason', fn.due_date_change_reason,
          'detail_edit', jsonb_build_object(
            'version', 1,
            'task_id', p_root,
            'node_id', fn.id,
            'updated_at', v_task.updated_at,
            'started', fn.node_started,
            'details', fn.de_details,
            'due', fn.de_details and (not fn.node_started or fn.de_due_mgr),
            'planning', fn.de_details and not fn.node_started
          ),
          'can_edit_dependencies', coalesce(fn.de_details and not fn.node_started, false) and v_dep_scope,
          'dependency_ids', case when fn.dependency_ids is not null then to_jsonb(array(
            select ref.id from unnest(fn.dependency_ids) ref(id)
            where exists (select 1 from s_raw ds where ds.id = ref.id)
            order by ref.id
          )) end,
          'restricted_dependency_count', case when fn.dependency_ids is not null then (
            select count(*) from unnest(fn.dependency_ids) ref(id)
            where not exists (select 1 from s_raw ds where ds.id = ref.id)
          ) end,
          'pending_dependency_count', case when fn.dependency_ids is not null then (
            select count(*) from unnest(fn.dependency_ids) ref(id)
            left join s_raw ds on ds.id = ref.id
            where ds.status is distinct from 'completed'
          ) end
        )
        order by fn.path, fn.id
      ), '[]'::jsonb),
      count(*) filter (where not exists (select 1 from s_raw c where c.parent_subtask_id = fn.id)),
      count(*) filter (where fn.status = 'completed' and not exists (select 1 from s_raw c where c.parent_subtask_id = fn.id))
    into v_nodes, v_leaf_total, v_leaf_completed
    from final_nodes fn;

    if v_invalid_tree and position('__RAISE_INVALID_TREE__' in v_nodes::text) > 0 then
      raise exception 'Work hierarchy has a cycle, foreign parent or depth beyond 8; resolve it first' using errcode = '23514';
    end if;
  end if;

  v_root_json := jsonb_build_object(
    'id', v_task.id,
    'project', v_proj_id,
    'office', v_office_id,
    'lead', v_root_lead,
    'kind', 'office',
    'status', v_task.status,
    'open', v_open,
    'people', coalesce(v_task.team_member_ids, '{}'::uuid[]),
    'due', coalesce(nullif(left(v_task.due_date, 10), ''), nullif(left(v_task.deadline, 10), '')),
    'capabilities', v_root_caps,
    'scheduling', jsonb_build_object('version', 1, 'today', v_work_day),
    'subtask_staffing_locked', v_staffing_locked,
    'scheduleBounds', jsonb_build_object(
      'projectStart', v_proj.start_date,
      'projectDue', v_proj.target_date,
      'taskStart', v_task.start_date,
      'taskDue', least(eflow_schedule.calendar_day(v_task.deadline), eflow_schedule.calendar_day(v_task.due_date))
    )
  );

  return jsonb_build_object(
    'root', v_root_json,
    'revision', v_revision,
    'can_manage', v_root_can_manage,
    'can_transfer', v_head,
    'nodes', coalesce(v_nodes, '[]'::jsonb),
    'people', v_people,
    'leaf_total', coalesce(v_leaf_total, 0),
    'leaf_completed', coalesce(v_leaf_completed, 0),
    'supportsSubtaskDependencies', true
  );
end $function$;

RESET lock_timeout;
