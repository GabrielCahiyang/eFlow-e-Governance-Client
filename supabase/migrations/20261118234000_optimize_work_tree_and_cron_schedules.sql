-- Stagger background pg_cron schedules and optimize r7_work_tree / m7_baseline_snapshot
-- to eliminate full profiles scans and per-subtask invoker RLS re-evaluation.

DO $$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    -- 1. Unschedule the no-op M7 subtask start job (activate_scheduled_subtasks returns 0 since 20261113061239)
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eflow-m7-subtask-starts') THEN
      PERFORM cron.unschedule('eflow-m7-subtask-starts');
    END IF;

    -- 2. Change daily calendar-date budget release check from every 1 minute to every 30 minutes
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eflow-office-budget-scheduled-releases') THEN
      PERFORM cron.schedule('eflow-office-budget-scheduled-releases', '7,37 * * * *', 'select eflow_budget.run_scheduled_releases()');
    END IF;

    -- 3. Stagger settlement staffing sweeps (which already have instant AFTER INSERT/UPDATE triggers) from every 5m to every 30m
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eflow-settlement-staffing-alerts') THEN
      PERFORM cron.schedule('eflow-settlement-staffing-alerts', '12,42 * * * *', 'select eflow_finance_review.notify_blocked_settlements()');
    END IF;

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'eflow-office-cash-settlement-staffing') THEN
      PERFORM cron.schedule('eflow-office-cash-settlement-staffing', '22,52 * * * *', 'select eflow_office_cash.notify_blocked_settlements()');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'server_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.server_logs;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION eflow_r7.m7_baseline_snapshot(p_root uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
  v_node_people uuid[] := '{}'::uuid[];
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
  left join lateral (
    select case when t.status = 'for_review' then eflow_r7.pending_reviewer(t.id) else null end as pending_reviewer
  ) rev on true
  where v_kind <> 'office' or v_root_node_scope;

  select coalesce(array_agg(distinct u), '{}'::uuid[])
  into v_node_people
  from eflow_r7.nodes n,
  lateral unnest(
    case when n.lead_id is not null then array[n.lead_id] else '{}'::uuid[] end
    || coalesce(n.assigned_to_ids, '{}'::uuid[])
  ) as u
  where n.task_id = p_root and (v_kind <> 'office' or v_root_node_scope);

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
  where (
    v_kind <> 'office'
    or p.org_id = v_office
    or exists(
      select 1 from public.project_office_members m
      join public.project_offices po on po.id = m.project_office_id
      where po.project_id = v_proj and po.office_id = v_office and m.user_id = p.id
    )
    or p.id = v_root_lead
    or coalesce(r->'people', '[]') ? p.id::text
    or p.id = any(v_node_people)
  )
  and (
    mem.is_member
    or p.id = v_root_lead
    or coalesce(r->'people', '[]') ? p.id::text
    or p.id = any(v_node_people)
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

  return v_result;
end $$;
REVOKE ALL ON FUNCTION eflow_r7.m7_baseline_snapshot(uuid) FROM public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.r7_work_tree(p_root uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '15s'
AS $$
declare v jsonb;
begin
  v := eflow_r7.snapshot(p_root);
  if v->'root'->>'kind' <> 'office' then return v; end if;
  v := jsonb_set(v,'{root,blocker}',coalesce((
    select to_jsonb(u.blocker) from public.task_progress_updates u
    where u.task_id=p_root order by u.created_at desc,u.id desc limit 1
  ),'null'::jsonb));
  return jsonb_set(v,'{nodes}',coalesce((select jsonb_agg(n.value || jsonb_build_object(
    'blocker',(select u.blocker from public.subtask_progress_updates u
      where u.task_id=p_root and u.subtask_id=s.id order by u.created_at desc,u.id desc limit 1),
    'custom_status_id',s.custom_status_id
  ) order by n.ordinality) from jsonb_array_elements(v->'nodes') with ordinality n
    left join public.subtasks s on s.task_id=p_root and s.id=(n.value->>'id')::uuid),'[]'::jsonb));
end;
$$;
REVOKE ALL ON FUNCTION public.r7_work_tree(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.r7_work_tree(uuid) TO authenticated;
