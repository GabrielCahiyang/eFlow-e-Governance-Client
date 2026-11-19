SET lock_timeout = '5s';

CREATE OR REPLACE FUNCTION eflow_r7.m7_baseline_snapshot(p_root uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_actor_member boolean := false;
  v_root_lead_member boolean := false;
  v_root_can_manage boolean;
  v_dirty_ids uuid[];
  v_node_people uuid[] := '{}'::uuid[];
  v_member_ids uuid[] := '{}'::uuid[];
  v_assignable_ids uuid[] := '{}'::uuid[];
  v_pom_user_ids uuid[] := '{}'::uuid[];
  v_project_status text;
  v_proj_open boolean := false;
  v_office_joined boolean := false;
  v_invalid_tree boolean := false;
  v_root_node_scope boolean := true;
begin
  if not eflow_r7.read_root(p_root) then
    raise exception 'Nested work access denied' using errcode = '42501';
  end if;

  if v_kind = 'office' then
    v_root_node_scope := coalesce(public.can_see_task(p_root, v_uid), false) and exists (
      select 1 from public.tasks t
      where t.id = p_root and t.deleted_at is null and (
        coalesce(t.assigned_to, t.recommendation_lead_id) = v_uid
        or t.status::text in ('in_progress', 'for_review', 'changes_requested', 'completed')
        or exists (select 1 from public.task_status_history h where h.task_id = t.id and h.to_status::text = 'in_progress')
      )
    );
    select p.status,
           (p.status not in ('completed', 'archived') and p.source_collaboration_draft_id is null)
      into v_project_status, v_proj_open
    from public.projects p where p.id = v_proj;

    select exists (
      select 1 from public.project_offices po
      where po.project_id = v_proj and po.office_id = v_office
        and po.invitation_status = 'joined' and po.relationship_type in ('lead', 'collaborating')
    ) into v_office_joined;
  end if;

  v_head := v_eligible and case when v_kind = 'office' then eflow_phase6.head(v_proj, v_office, v_uid) else (r->>'owner')::uuid = v_uid end;
  v_plan_lead := (v_kind = 'office') and coalesce(eflow_publication.planning_lead(v_proj, v_office), false);
  v_staffing_locked := (v_kind = 'office') and coalesce(eflow_publication.subtask_staffing_locked(p_root), false);
  v_planning_locked := (v_kind = 'office') and coalesce(eflow_publication.subtask_planning_locked(p_root), false);

  select coalesce(array_agg(distinct u), '{}'::uuid[])
    into v_node_people
  from eflow_r7.nodes n,
  lateral unnest(
    case when n.lead_id is not null then array[n.lead_id] else '{}'::uuid[] end
    || coalesce(n.assigned_to_ids, '{}'::uuid[])
  ) as u
  where n.task_id = p_root and (v_kind <> 'office' or v_root_node_scope);

  if v_kind = 'office' then
    -- Single set-based pass over profiles & office membership instead of per-profile LATERAL RPCs
    with pom_users as (
      select m.user_id,
             bool_or(m.access_ended_at is null
                     and (m.access_end is null or m.access_end > now())
                     and (m.engagement = 'Permanent' or v_project_status not in ('completed', 'archived'))) as any_active,
             bool_or(m.access_ended_at is not null
                     or m.access_end <= now()
                     or ((m.engagement <> 'Permanent' or m.until_close) and not v_proj_open)) as any_blocked
      from public.project_office_members m
      join public.project_offices o on o.id = m.project_office_id
      where o.project_id = v_proj and o.office_id = v_office
      group by m.user_id
    ), guest_users as (
      select gm.user_id
      from public.project_guest_members gm
      where gm.project_id = v_proj and gm.office_id = v_office
        and gm.ended_at is null and (gm.access_end is null or gm.access_end > now())
        and (gm.engagement = 'Permanent' or v_project_status not in ('completed', 'archived'))
      group by gm.user_id
    ), removed_users as (
      select rem.user_id
      from eflow_r9.removed rem
      where rem.project_id = v_proj
        and rem.scope = coalesce(v_office, '00000000-0000-0000-0000-000000000000'::uuid)
      group by rem.user_id
    ), grant_users as (
      select g.recipient as user_id
      from public.project_access_grants g
      where g.project_id = v_proj
        and g.office_id is not distinct from v_office
        and g.revoked_at is null and g.redeemed_at is not null
        and (g.access_end is null or g.access_end > now())
        and g.access = 'member' and v_proj_open
      group by g.recipient
    ), evaluated as (
      select p.id, p.full_name, p.org_id,
             (p.is_active and p.role in ('head', 'member', 'accounting_staff') and u.email_confirmed_at is not null) as is_elig,
             (pm.user_id is not null) as has_pom_row,
             (
               (p.is_active and p.role in ('head', 'member', 'accounting_staff') and u.email_confirmed_at is not null)
               and (
                 (
                   rem.user_id is null
                   and not coalesce(pm.any_blocked, false)
                   and v_office_joined
                   and ((coalesce(pm.any_active, false) and p.org_id = v_office) or gu.user_id is not null)
                 )
                 or (gr.user_id is not null and rem.user_id is null)
               )
             ) as is_member,
             (
               (p.is_active and p.role in ('head', 'member', 'accounting_staff') and u.email_confirmed_at is not null)
               and p.org_id = v_office
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
      coalesce(array_agg(id) filter (where is_member or is_office_elig), '{}'::uuid[]),
      coalesce(array_agg(id) filter (where has_pom_row), '{}'::uuid[]),
      coalesce(jsonb_agg(
        jsonb_build_object('id', id, 'name', full_name, 'office', org_id, 'eligible', (is_member or is_office_elig))
        order by full_name, id
      ) filter (where (
          org_id = v_office
          or has_pom_row
          or id = v_root_lead
          or coalesce(r->'people', '[]') ? id::text
          or id = any(v_node_people)
        ) and (
          (is_member or is_office_elig)
          or id = v_root_lead
          or coalesce(r->'people', '[]') ? id::text
          or id = any(v_node_people)
        )), '[]'::jsonb)
    into v_member_ids, v_assignable_ids, v_pom_user_ids, v_people
    from evaluated;

    v_actor_member := (v_uid = any(v_member_ids));
    v_root_lead_member := (v_root_lead is not null and v_root_lead = any(v_member_ids));
  else
    select coalesce(jsonb_agg(
      jsonb_build_object('id', p.id, 'name', p.full_name, 'office', p.org_id, 'eligible', mem.is_member)
      order by p.full_name, p.id
    ), '[]'::jsonb)
      into v_people
    from public.profiles p
    cross join lateral (select eflow_r7.member(v_proj, v_office, p.id) as is_member) mem
    where mem.is_member or p.id = v_root_lead or coalesce(r->'people', '[]') ? p.id::text or p.id = any(v_node_people);

    v_actor_member := eflow_r7.member(v_proj, v_office, v_uid);
    v_root_lead_member := v_root_lead is not null and eflow_r7.member(v_proj, v_office, v_root_lead);
  end if;

  v_root_can_manage := (v_eligible and v_open and (v_head or (v_actor_member and v_root_lead = v_uid))) or (v_open and v_plan_lead);

  with recursive above as (
    select n.id origin, n.id, n.parent_subtask_id, array[n.id] path, 1 depth, false cycle
    from eflow_r7.nodes n where n.task_id = p_root
    union all
    select a.origin, n.id, n.parent_subtask_id, a.path || n.id, a.depth + 1, n.id = any(a.path)
    from above a join eflow_r7.nodes n on n.id = a.parent_subtask_id and n.task_id = p_root
    where not a.cycle and a.depth <= 8
  )
  select exists (
    select 1 from above a
    where a.cycle or a.depth > 8
       or (a.parent_subtask_id is not null and not exists (select 1 from eflow_r7.nodes n where n.id = a.parent_subtask_id and n.task_id = p_root))
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
  left join lateral (
    select case when t.status = 'for_review' then eflow_r7.pending_reviewer(t.id) else null end as pending_reviewer
  ) rev on true
  where v_kind <> 'office' or v_root_node_scope;

  v_result := jsonb_build_object(
    'root', r || jsonb_build_object('capabilities', eflow_r7.operation_capabilities(p_root)),
    'revision', coalesce((select revision from eflow_r7.tree_state where root_id = p_root), 1),
    'can_manage', v_root_can_manage,
    'can_transfer', v_head,
    'nodes', v_nodes,
    'people', v_people,
    'leaf_total', (select count(*) from eflow_r7.nodes n where n.task_id = p_root and not exists (select 1 from eflow_r7.nodes c where c.parent_subtask_id = n.id)),
    'leaf_completed', (select count(*) from eflow_r7.nodes n where n.task_id = p_root and n.status = 'completed' and not exists (select 1 from eflow_r7.nodes c where c.parent_subtask_id = n.id))
  );

  return v_result;
end $function$;

RESET lock_timeout;
