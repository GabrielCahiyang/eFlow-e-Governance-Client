-- Workload & Overload Mitigation System
-- 1. Admin-maintained global & per-office threshold/weight settings (`public.workload_threshold_settings`).
-- 2. Live, RLS-safe server workload calculation across Projects Led, Task Leads, Task Contributors,
--    Subtask Leads, Subtask Contributors, Pending Reviews, and Asia/Manila deadline crunch/overdue risk.
-- 3. Immutable overload-override audit logging (`public.record_workload_overload_override`).

-- ─── 1. Threshold Settings Table & Partial Indexes ───────────────────────────

CREATE TABLE IF NOT EXISTS public.workload_threshold_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  heavy_points numeric(5,1) NOT NULL DEFAULT 8.0
    CHECK (heavy_points >= 1.0 AND heavy_points <= 100.0),
  overload_points numeric(5,1) NOT NULL DEFAULT 12.0
    CHECK (overload_points > heavy_points AND overload_points <= 200.0),
  max_active_project_leads integer NOT NULL DEFAULT 3
    CHECK (max_active_project_leads BETWEEN 1 AND 50),
  max_active_task_leads integer NOT NULL DEFAULT 5
    CHECK (max_active_task_leads BETWEEN 1 AND 50),
  max_overdue_items integer NOT NULL DEFAULT 3
    CHECK (max_overdue_items BETWEEN 1 AND 50),
  due_soon_business_days integer NOT NULL DEFAULT 3
    CHECK (due_soon_business_days BETWEEN 1 AND 14),
  weight_active_project_lead numeric(4,1) NOT NULL DEFAULT 3.0
    CHECK (weight_active_project_lead >= 0.5 AND weight_active_project_lead <= 20.0),
  weight_planning_project_lead numeric(4,1) NOT NULL DEFAULT 1.5
    CHECK (weight_planning_project_lead >= 0.0 AND weight_planning_project_lead <= 20.0),
  weight_task_lead numeric(4,1) NOT NULL DEFAULT 2.0
    CHECK (weight_task_lead >= 0.5 AND weight_task_lead <= 20.0),
  weight_task_contributor numeric(4,1) NOT NULL DEFAULT 1.0
    CHECK (weight_task_contributor >= 0.0 AND weight_task_contributor <= 20.0),
  weight_subtask_lead numeric(4,1) NOT NULL DEFAULT 1.0
    CHECK (weight_subtask_lead >= 0.0 AND weight_subtask_lead <= 20.0),
  weight_subtask_contributor numeric(4,1) NOT NULL DEFAULT 0.5
    CHECK (weight_subtask_contributor >= 0.0 AND weight_subtask_contributor <= 20.0),
  weight_pending_review numeric(4,1) NOT NULL DEFAULT 0.5
    CHECK (weight_pending_review >= 0.0 AND weight_pending_review <= 10.0),
  weight_overdue_penalty numeric(4,1) NOT NULL DEFAULT 1.5
    CHECK (weight_overdue_penalty >= 0.0 AND weight_overdue_penalty <= 10.0),
  weight_due_soon_penalty numeric(4,1) NOT NULL DEFAULT 0.5
    CHECK (weight_due_soon_penalty >= 0.0 AND weight_due_soon_penalty <= 10.0),
  require_override_reason boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workload_threshold_settings_global
  ON public.workload_threshold_settings ((org_id IS NULL))
  WHERE org_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workload_threshold_settings_org
  ON public.workload_threshold_settings (org_id)
  WHERE org_id IS NOT NULL;

ALTER TABLE public.workload_threshold_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workload_threshold_settings'
      AND policyname = 'workload_threshold_settings_read_authenticated'
  ) THEN
    CREATE POLICY workload_threshold_settings_read_authenticated
      ON public.workload_threshold_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workload_threshold_settings'
      AND policyname = 'workload_threshold_settings_admin_write'
  ) THEN
    CREATE POLICY workload_threshold_settings_admin_write
      ON public.workload_threshold_settings
      FOR ALL
      TO authenticated
      USING (public.is_admin((SELECT auth.uid())))
      WITH CHECK (public.is_admin((SELECT auth.uid())));
  END IF;
END;
$$;

INSERT INTO public.workload_threshold_settings (org_id)
SELECT NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.workload_threshold_settings WHERE org_id IS NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_open_lead
  ON public.projects (project_lead_id, org_id)
  WHERE status IN ('planning', 'active', 'on_hold') AND project_lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_open_assignee
  ON public.tasks (assigned_to, org_id)
  WHERE deleted_at IS NULL
    AND archived_at IS NULL
    AND status IN ('pending_assignment', 'todo', 'in_progress', 'changes_requested', 'for_review');

CREATE INDEX IF NOT EXISTS idx_tasks_open_reviewer
  ON public.tasks (reviewer_id)
  WHERE deleted_at IS NULL
    AND archived_at IS NULL
    AND status = 'for_review'
    AND reviewer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subtasks_open_lead
  ON public.subtasks (lead_id)
  WHERE status NOT IN ('completed', 'cancelled') AND lead_id IS NOT NULL;

-- ─── 2. Helpers: Effective Thresholds + Manila Business-Day Cutoff ───────────

CREATE OR REPLACE FUNCTION eflow_project.resolve_workload_settings(p_org_id uuid DEFAULT NULL::uuid)
RETURNS public.workload_threshold_settings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_row public.workload_threshold_settings;
BEGIN
  IF p_org_id IS NOT NULL THEN
    SELECT * INTO v_row
    FROM public.workload_threshold_settings
    WHERE org_id = p_org_id
    LIMIT 1;
    IF FOUND THEN
      RETURN v_row;
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.workload_threshold_settings
  WHERE org_id IS NULL
  LIMIT 1;
  IF FOUND THEN
    RETURN v_row;
  END IF;

  v_row.heavy_points := 8.0;
  v_row.overload_points := 12.0;
  v_row.max_active_project_leads := 3;
  v_row.max_active_task_leads := 5;
  v_row.max_overdue_items := 3;
  v_row.due_soon_business_days := 3;
  v_row.weight_active_project_lead := 3.0;
  v_row.weight_planning_project_lead := 1.5;
  v_row.weight_task_lead := 2.0;
  v_row.weight_task_contributor := 1.0;
  v_row.weight_subtask_lead := 1.0;
  v_row.weight_subtask_contributor := 0.5;
  v_row.weight_pending_review := 0.5;
  v_row.weight_overdue_penalty := 1.5;
  v_row.weight_due_soon_penalty := 0.5;
  v_row.require_override_reason := true;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.add_business_days(p_start date, p_days integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_curr date := p_start;
  v_added integer := 0;
BEGIN
  WHILE v_added < GREATEST(0, COALESCE(p_days, 0)) LOOP
    v_curr := v_curr + 1;
    IF EXTRACT(ISODOW FROM v_curr) < 6 THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_curr;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.workload_settings_json(s public.workload_threshold_settings)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object(
    'id', s.id,
    'orgId', s.org_id,
    'heavyPoints', s.heavy_points,
    'overloadPoints', s.overload_points,
    'maxActiveProjectLeads', s.max_active_project_leads,
    'maxActiveTaskLeads', s.max_active_task_leads,
    'maxOverdueItems', s.max_overdue_items,
    'dueSoonBusinessDays', s.due_soon_business_days,
    'weightActiveProjectLead', s.weight_active_project_lead,
    'weightPlanningProjectLead', s.weight_planning_project_lead,
    'weightTaskLead', s.weight_task_lead,
    'weightTaskContributor', s.weight_task_contributor,
    'weightSubtaskLead', s.weight_subtask_lead,
    'weightSubtaskContributor', s.weight_subtask_contributor,
    'weightPendingReview', s.weight_pending_review,
    'weightOverduePenalty', s.weight_overdue_penalty,
    'weightDueSoonPenalty', s.weight_due_soon_penalty,
    'requireOverrideReason', s.require_override_reason,
    'updatedAt', s.updated_at
  );
$function$;

-- ─── 3. Admin Maintenance RPCs for Workload Thresholds ───────────────────────

CREATE OR REPLACE FUNCTION public.get_workload_threshold_settings(p_org_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_is_admin boolean := false;
  v_effective public.workload_threshold_settings;
  v_global public.workload_threshold_settings;
  v_overrides jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_admin(v_uid);
  SELECT COALESCE(p_org_id, pr.org_id) INTO v_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;

  v_effective := eflow_project.resolve_workload_settings(v_org);
  v_global := eflow_project.resolve_workload_settings(NULL);

  IF v_is_admin THEN
    SELECT COALESCE(jsonb_agg(
      eflow_project.workload_settings_json(s) || jsonb_build_object('orgName', COALESCE(o.name, 'Office'))
      ORDER BY lower(COALESCE(o.name, '')), o.name
    ), '[]'::jsonb)
    INTO v_overrides
    FROM public.workload_threshold_settings s
    JOIN public.organizations o ON o.id = s.org_id
    WHERE s.org_id IS NOT NULL;
  END IF;

  RETURN jsonb_build_object(
    'effective', eflow_project.workload_settings_json(v_effective),
    'globalDefault', eflow_project.workload_settings_json(v_global),
    'officeOverrides', v_overrides,
    'canManage', v_is_admin
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_workload_threshold_settings(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_name text;
  v_org_id uuid := NULLIF(COALESCE(p_payload->>'orgId', ''), '')::uuid;
  v_heavy numeric(5,1) := COALESCE((p_payload->>'heavyPoints')::numeric, 8.0);
  v_overload numeric(5,1) := COALESCE((p_payload->>'overloadPoints')::numeric, 12.0);
  v_max_proj integer := COALESCE((p_payload->>'maxActiveProjectLeads')::integer, 3);
  v_max_task integer := COALESCE((p_payload->>'maxActiveTaskLeads')::integer, 5);
  v_max_overdue integer := COALESCE((p_payload->>'maxOverdueItems')::integer, 3);
  v_due_days integer := COALESCE((p_payload->>'dueSoonBusinessDays')::integer, 3);
  v_w_act_proj numeric(4,1) := COALESCE((p_payload->>'weightActiveProjectLead')::numeric, 3.0);
  v_w_plan_proj numeric(4,1) := COALESCE((p_payload->>'weightPlanningProjectLead')::numeric, 1.5);
  v_w_task_lead numeric(4,1) := COALESCE((p_payload->>'weightTaskLead')::numeric, 2.0);
  v_w_task_contrib numeric(4,1) := COALESCE((p_payload->>'weightTaskContributor')::numeric, 1.0);
  v_w_sub_lead numeric(4,1) := COALESCE((p_payload->>'weightSubtaskLead')::numeric, 1.0);
  v_w_sub_contrib numeric(4,1) := COALESCE((p_payload->>'weightSubtaskContributor')::numeric, 0.5);
  v_w_review numeric(4,1) := COALESCE((p_payload->>'weightPendingReview')::numeric, 0.5);
  v_w_overdue numeric(4,1) := COALESCE((p_payload->>'weightOverduePenalty')::numeric, 1.5);
  v_w_due_soon numeric(4,1) := COALESCE((p_payload->>'weightDueSoonPenalty')::numeric, 0.5);
  v_req_reason boolean := COALESCE((p_payload->>'requireOverrideReason')::boolean, true);
  v_saved public.workload_threshold_settings;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Only system administrators can update workload thresholds' USING ERRCODE = '42501';
  END IF;

  IF v_heavy < 1.0 OR v_heavy > 100.0 THEN
    RAISE EXCEPTION 'Heavy workload threshold must be between 1.0 and 100.0 points' USING ERRCODE = '22023';
  END IF;
  IF v_overload <= v_heavy OR v_overload > 200.0 THEN
    RAISE EXCEPTION 'Overloaded threshold must be strictly greater than the Heavy threshold (up to 200.0 points)' USING ERRCODE = '22023';
  END IF;
  IF v_max_proj NOT BETWEEN 1 AND 50 OR v_max_task NOT BETWEEN 1 AND 50 OR v_max_overdue NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Role and overdue caps must each be whole numbers between 1 and 50' USING ERRCODE = '22023';
  END IF;
  IF v_due_days NOT BETWEEN 1 AND 14 THEN
    RAISE EXCEPTION 'Due-soon crunch window must be between 1 and 14 business days' USING ERRCODE = '22023';
  END IF;

  IF v_org_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org_id) THEN
    RAISE EXCEPTION 'Selected office was not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_org_id IS NULL THEN
    UPDATE public.workload_threshold_settings
    SET heavy_points = v_heavy,
        overload_points = v_overload,
        max_active_project_leads = v_max_proj,
        max_active_task_leads = v_max_task,
        max_overdue_items = v_max_overdue,
        due_soon_business_days = v_due_days,
        weight_active_project_lead = v_w_act_proj,
        weight_planning_project_lead = v_w_plan_proj,
        weight_task_lead = v_w_task_lead,
        weight_task_contributor = v_w_task_contrib,
        weight_subtask_lead = v_w_sub_lead,
        weight_subtask_contributor = v_w_sub_contrib,
        weight_pending_review = v_w_review,
        weight_overdue_penalty = v_w_overdue,
        weight_due_soon_penalty = v_w_due_soon,
        require_override_reason = v_req_reason,
        updated_by = v_uid,
        updated_at = now()
    WHERE org_id IS NULL
    RETURNING * INTO v_saved;

    IF NOT FOUND THEN
      INSERT INTO public.workload_threshold_settings (
        org_id, heavy_points, overload_points, max_active_project_leads, max_active_task_leads,
        max_overdue_items, due_soon_business_days, weight_active_project_lead, weight_planning_project_lead,
        weight_task_lead, weight_task_contributor, weight_subtask_lead, weight_subtask_contributor,
        weight_pending_review, weight_overdue_penalty, weight_due_soon_penalty, require_override_reason,
        updated_by, updated_at
      ) VALUES (
        NULL, v_heavy, v_overload, v_max_proj, v_max_task,
        v_max_overdue, v_due_days, v_w_act_proj, v_w_plan_proj,
        v_w_task_lead, v_w_task_contrib, v_w_sub_lead, v_w_sub_contrib,
        v_w_review, v_w_overdue, v_w_due_soon, v_req_reason,
        v_uid, now()
      ) RETURNING * INTO v_saved;
    END IF;
  ELSE
    INSERT INTO public.workload_threshold_settings (
      org_id, heavy_points, overload_points, max_active_project_leads, max_active_task_leads,
      max_overdue_items, due_soon_business_days, weight_active_project_lead, weight_planning_project_lead,
      weight_task_lead, weight_task_contributor, weight_subtask_lead, weight_subtask_contributor,
      weight_pending_review, weight_overdue_penalty, weight_due_soon_penalty, require_override_reason,
      updated_by, updated_at
    ) VALUES (
      v_org_id, v_heavy, v_overload, v_max_proj, v_max_task,
      v_max_overdue, v_due_days, v_w_act_proj, v_w_plan_proj,
      v_w_task_lead, v_w_task_contrib, v_w_sub_lead, v_w_sub_contrib,
      v_w_review, v_w_overdue, v_w_due_soon, v_req_reason,
      v_uid, now()
    )
    ON CONFLICT (org_id) WHERE org_id IS NOT NULL
    DO UPDATE SET
      heavy_points = EXCLUDED.heavy_points,
      overload_points = EXCLUDED.overload_points,
      max_active_project_leads = EXCLUDED.max_active_project_leads,
      max_active_task_leads = EXCLUDED.max_active_task_leads,
      max_overdue_items = EXCLUDED.max_overdue_items,
      due_soon_business_days = EXCLUDED.due_soon_business_days,
      weight_active_project_lead = EXCLUDED.weight_active_project_lead,
      weight_planning_project_lead = EXCLUDED.weight_planning_project_lead,
      weight_task_lead = EXCLUDED.weight_task_lead,
      weight_task_contributor = EXCLUDED.weight_task_contributor,
      weight_subtask_lead = EXCLUDED.weight_subtask_lead,
      weight_subtask_contributor = EXCLUDED.weight_subtask_contributor,
      weight_pending_review = EXCLUDED.weight_pending_review,
      weight_overdue_penalty = EXCLUDED.weight_overdue_penalty,
      weight_due_soon_penalty = EXCLUDED.weight_due_soon_penalty,
      require_override_reason = EXCLUDED.require_override_reason,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
    RETURNING * INTO v_saved;
  END IF;

  SELECT COALESCE(full_name, 'System Admin') INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.audit_events (actor_id, actor_name, entity_type, entity_id, action, after_data, org_id)
  VALUES (
    v_uid, v_actor_name, 'workload_settings', COALESCE(v_org_id::text, 'global'),
    'workload.thresholds_updated', eflow_project.workload_settings_json(v_saved), v_org_id
  );

  RETURN public.get_workload_threshold_settings(v_org_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_workload_threshold_settings(p_org_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_actor_name text;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Only system administrators can reset workload thresholds' USING ERRCODE = '42501';
  END IF;

  IF p_org_id IS NOT NULL THEN
    DELETE FROM public.workload_threshold_settings WHERE org_id = p_org_id;
  ELSE
    UPDATE public.workload_threshold_settings
    SET heavy_points = 8.0,
        overload_points = 12.0,
        max_active_project_leads = 3,
        max_active_task_leads = 5,
        max_overdue_items = 3,
        due_soon_business_days = 3,
        weight_active_project_lead = 3.0,
        weight_planning_project_lead = 1.5,
        weight_task_lead = 2.0,
        weight_task_contributor = 1.0,
        weight_subtask_lead = 1.0,
        weight_subtask_contributor = 0.5,
        weight_pending_review = 0.5,
        weight_overdue_penalty = 1.5,
        weight_due_soon_penalty = 0.5,
        require_override_reason = true,
        updated_by = v_uid,
        updated_at = now()
    WHERE org_id IS NULL;
  END IF;

  SELECT COALESCE(full_name, 'System Admin') INTO v_actor_name FROM public.profiles WHERE id = v_uid;
  INSERT INTO public.audit_events (actor_id, actor_name, entity_type, entity_id, action, org_id)
  VALUES (
    v_uid, v_actor_name, 'workload_settings', COALESCE(p_org_id::text, 'global'),
    'workload.thresholds_reset', p_org_id
  );

  RETURN public.get_workload_threshold_settings(p_org_id);
END;
$function$;

-- ─── 4. Live Office Workload Summary RPC (Single Round-Trip) ─────────────────

CREATE OR REPLACE FUNCTION public.get_office_workload_summary(p_org_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_caller_org uuid;
  v_org uuid;
  v_cfg public.workload_threshold_settings;
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_due_soon date;
  v_members jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT pr.org_id INTO v_caller_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active profile required' USING ERRCODE = '42501';
  END IF;

  v_org := COALESCE(p_org_id, v_caller_org);
  IF v_org IS NULL THEN
    RETURN jsonb_build_object(
      'orgId', NULL,
      'thresholds', eflow_project.workload_settings_json(eflow_project.resolve_workload_settings(NULL)),
      'members', '[]'::jsonb,
      'calculatedAt', now()
    );
  END IF;

  IF v_org IS DISTINCT FROM v_caller_org
     AND NOT public.is_admin(v_uid)
     AND NOT public.can_access_org(v_uid, v_org, 'read') THEN
    RAISE EXCEPTION 'Office access required' USING ERRCODE = '42501';
  END IF;

  v_cfg := eflow_project.resolve_workload_settings(v_org);
  v_due_soon := eflow_project.add_business_days(v_today, v_cfg.due_soon_business_days);

  WITH office_people AS (
    SELECT p.id, p.full_name, p.email, p.role::text AS role, p.org_id,
           (o.head_user_id = p.id) AS is_office_head
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.id = p.org_id
    WHERE p.org_id = v_org
      AND p.is_active = true
      AND p.role::text NOT IN ('admin', 'super_admin', 'viewer')
  ),
  proj_counts AS (
    SELECT pr.project_lead_id AS user_id,
           count(*) FILTER (WHERE pr.status = 'active')::int AS active_projects_led,
           count(*) FILTER (WHERE pr.status IN ('planning', 'on_hold'))::int AS planning_projects_led
    FROM public.projects pr
    WHERE pr.project_lead_id IN (SELECT id FROM office_people)
      AND pr.status IN ('planning', 'active', 'on_hold')
    GROUP BY pr.project_lead_id
  ),
  open_tasks AS (
    SELECT t.id, t.assigned_to, t.team_member_ids, t.reviewer_id, t.status,
           COALESCE(
             eflow_schedule.calendar_day(NULLIF(t.deadline, '')),
             eflow_schedule.calendar_day(t.due_date)
           ) AS due_day
    FROM public.tasks t
    LEFT JOIN public.projects pr ON pr.id = t.linked_project_id
    WHERE t.deleted_at IS NULL
      AND t.archived_at IS NULL
      AND t.status IN ('pending_assignment', 'todo', 'in_progress', 'changes_requested', 'for_review')
      AND (pr.id IS NULL OR pr.status NOT IN ('completed', 'archived'))
  ),
  task_lead_counts AS (
    SELECT t.assigned_to AS user_id,
           count(*)::int AS task_leads,
           count(*) FILTER (WHERE t.status <> 'for_review' AND t.due_day IS NOT NULL AND t.due_day < v_today)::int AS overdue_tasks,
           count(*) FILTER (WHERE t.status <> 'for_review' AND t.due_day IS NOT NULL AND t.due_day >= v_today AND t.due_day <= v_due_soon)::int AS due_soon_tasks
    FROM open_tasks t
    WHERE t.assigned_to IN (SELECT id FROM office_people)
    GROUP BY t.assigned_to
  ),
  task_contrib_counts AS (
    SELECT uid AS user_id,
           count(DISTINCT t.id)::int AS task_contributions,
           count(DISTINCT t.id) FILTER (WHERE t.status <> 'for_review' AND t.due_day IS NOT NULL AND t.due_day < v_today)::int AS overdue_contrib,
           count(DISTINCT t.id) FILTER (WHERE t.status <> 'for_review' AND t.due_day IS NOT NULL AND t.due_day >= v_today AND t.due_day <= v_due_soon)::int AS due_soon_contrib
    FROM open_tasks t
    CROSS JOIN LATERAL unnest(COALESCE(t.team_member_ids, '{}'::uuid[])) AS uid
    WHERE uid IN (SELECT id FROM office_people)
      AND uid IS DISTINCT FROM t.assigned_to
    GROUP BY uid
  ),
  open_subtasks AS (
    SELECT s.id, s.task_id, s.lead_id, s.assigned_to_ids, s.status,
           eflow_schedule.calendar_day(s.due_date) AS due_day,
           t.assigned_to AS parent_task_lead
    FROM public.subtasks s
    JOIN open_tasks t ON t.id = s.task_id
    WHERE s.status NOT IN ('completed', 'cancelled')
  ),
  subtask_lead_counts AS (
    SELECT s.lead_id AS user_id,
           count(*)::int AS subtask_leads,
           count(*) FILTER (WHERE s.parent_task_lead IS DISTINCT FROM s.lead_id)::int AS subtask_leads_external,
           count(*) FILTER (WHERE s.parent_task_lead = s.lead_id)::int AS subtask_leads_own_task,
           count(*) FILTER (WHERE s.status <> 'for_review' AND s.due_day IS NOT NULL AND s.due_day < v_today)::int AS overdue_subtasks,
           count(*) FILTER (WHERE s.status <> 'for_review' AND s.due_day IS NOT NULL AND s.due_day >= v_today AND s.due_day <= v_due_soon)::int AS due_soon_subtasks
    FROM open_subtasks s
    WHERE s.lead_id IN (SELECT id FROM office_people)
    GROUP BY s.lead_id
  ),
  subtask_contrib_counts AS (
    SELECT uid AS user_id,
           count(DISTINCT s.id)::int AS subtask_contributions,
           count(DISTINCT s.id) FILTER (WHERE s.status <> 'for_review' AND s.due_day IS NOT NULL AND s.due_day < v_today)::int AS overdue_sub_contrib,
           count(DISTINCT s.id) FILTER (WHERE s.status <> 'for_review' AND s.due_day IS NOT NULL AND s.due_day >= v_today AND s.due_day <= v_due_soon)::int AS due_soon_sub_contrib
    FROM open_subtasks s
    CROSS JOIN LATERAL unnest(COALESCE(s.assigned_to_ids, '{}'::uuid[])) AS uid
    WHERE uid IN (SELECT id FROM office_people)
      AND uid IS DISTINCT FROM s.lead_id
    GROUP BY uid
  ),
  review_counts AS (
    SELECT reviewer_id AS user_id, count(*)::int AS pending_task_reviews
    FROM open_tasks
    WHERE status = 'for_review'
      AND reviewer_id IN (SELECT id FROM office_people)
    GROUP BY reviewer_id
  ),
  comp_review_counts AS (
    SELECT o.head_user_id AS user_id, count(*)::int AS pending_completion_reviews
    FROM public.projects pr
    JOIN public.organizations o ON o.id = pr.org_id
    WHERE pr.status = 'active'
      AND pr.completion_review_status = 'requested'
      AND o.head_user_id IN (SELECT id FROM office_people)
    GROUP BY o.head_user_id
  ),
  scored AS (
    SELECT
      op.id,
      op.full_name,
      op.email,
      op.role,
      op.is_office_head,
      COALESCE(pc.active_projects_led, 0) AS active_projects_led,
      COALESCE(pc.planning_projects_led, 0) AS planning_projects_led,
      COALESCE(tl.task_leads, 0) AS task_leads,
      COALESCE(tc.task_contributions, 0) AS task_contributions,
      COALESCE(sl.subtask_leads, 0) AS subtask_leads,
      COALESCE(sc.subtask_contributions, 0) AS subtask_contributions,
      (COALESCE(rc.pending_task_reviews, 0) + COALESCE(crc.pending_completion_reviews, 0)) AS pending_reviews,
      (COALESCE(tl.overdue_tasks, 0) + COALESCE(tc.overdue_contrib, 0) + COALESCE(sl.overdue_subtasks, 0) + COALESCE(sc.overdue_sub_contrib, 0)) AS overdue_count,
      (COALESCE(tl.due_soon_tasks, 0) + COALESCE(tc.due_soon_contrib, 0) + COALESCE(sl.due_soon_subtasks, 0) + COALESCE(sc.due_soon_sub_contrib, 0)) AS due_soon_count,
      ROUND((
        COALESCE(pc.active_projects_led, 0) * v_cfg.weight_active_project_lead
        + COALESCE(pc.planning_projects_led, 0) * v_cfg.weight_planning_project_lead
        + COALESCE(tl.task_leads, 0) * v_cfg.weight_task_lead
        + COALESCE(tc.task_contributions, 0) * v_cfg.weight_task_contributor
        + COALESCE(sl.subtask_leads_external, 0) * v_cfg.weight_subtask_lead
        + COALESCE(sl.subtask_leads_own_task, 0) * (v_cfg.weight_subtask_lead * 0.5)
        + COALESCE(sc.subtask_contributions, 0) * v_cfg.weight_subtask_contributor
        + (COALESCE(rc.pending_task_reviews, 0) + COALESCE(crc.pending_completion_reviews, 0)) * v_cfg.weight_pending_review
        + (COALESCE(tl.overdue_tasks, 0) + COALESCE(tc.overdue_contrib, 0) + COALESCE(sl.overdue_subtasks, 0) + COALESCE(sc.overdue_sub_contrib, 0)) * v_cfg.weight_overdue_penalty
        + (COALESCE(tl.due_soon_tasks, 0) + COALESCE(tc.due_soon_contrib, 0) + COALESCE(sl.due_soon_subtasks, 0) + COALESCE(sc.due_soon_sub_contrib, 0)) * v_cfg.weight_due_soon_penalty
      )::numeric, 1) AS load_points
    FROM office_people op
    LEFT JOIN proj_counts pc ON pc.user_id = op.id
    LEFT JOIN task_lead_counts tl ON tl.user_id = op.id
    LEFT JOIN task_contrib_counts tc ON tc.user_id = op.id
    LEFT JOIN subtask_lead_counts sl ON sl.user_id = op.id
    LEFT JOIN subtask_contrib_counts sc ON sc.user_id = op.id
    LEFT JOIN review_counts rc ON rc.user_id = op.id
    LEFT JOIN comp_review_counts crc ON crc.user_id = op.id
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'userId', s.id,
      'fullName', s.full_name,
      'email', s.email,
      'role', s.role,
      'isOfficeHead', s.is_office_head,
      'activeProjectsLed', s.active_projects_led,
      'planningProjectsLed', s.planning_projects_led,
      'taskLeads', s.task_leads,
      'taskContributions', s.task_contributions,
      'subtaskLeads', s.subtask_leads,
      'subtaskContributions', s.subtask_contributions,
      'pendingReviews', s.pending_reviews,
      'overdueCount', s.overdue_count,
      'dueSoonCount', s.due_soon_count,
      'loadPoints', s.load_points,
      'utilizationPercent', LEAST(200, ROUND((s.load_points / GREATEST(1.0, v_cfg.overload_points)) * 100)::int),
      'tier', CASE
        WHEN s.load_points >= v_cfg.overload_points
          OR s.active_projects_led >= v_cfg.max_active_project_leads
          OR s.task_leads >= v_cfg.max_active_task_leads
          OR s.overdue_count >= v_cfg.max_overdue_items
        THEN 'overloaded'
        WHEN s.load_points >= v_cfg.heavy_points
          OR s.active_projects_led >= GREATEST(1, v_cfg.max_active_project_leads - 1)
          OR s.task_leads >= GREATEST(1, v_cfg.max_active_task_leads - 1)
          OR s.overdue_count >= 1
        THEN 'heavy'
        ELSE 'balanced'
      END,
      'reasons', (
        SELECT COALESCE(jsonb_agg(reason), '[]'::jsonb)
        FROM (
          SELECT ('Load score ' || to_char(s.load_points, 'FM990.0') || ' pts reached the ' || to_char(v_cfg.overload_points, 'FM990.0') || ' pt overload threshold') AS reason
          WHERE s.load_points >= v_cfg.overload_points
          UNION ALL
          SELECT ('Leading ' || s.active_projects_led || ' active projects (limit: ' || v_cfg.max_active_project_leads || ')')
          WHERE s.active_projects_led >= v_cfg.max_active_project_leads
          UNION ALL
          SELECT ('Leading ' || s.task_leads || ' active tasks (limit: ' || v_cfg.max_active_task_leads || ')')
          WHERE s.task_leads >= v_cfg.max_active_task_leads
          UNION ALL
          SELECT (s.overdue_count || ' overdue open work items (limit: ' || v_cfg.max_overdue_items || ')')
          WHERE s.overdue_count >= v_cfg.max_overdue_items
        ) r
      )
    )
    ORDER BY s.load_points DESC, s.overdue_count DESC, lower(s.full_name)
  ), '[]'::jsonb)
  INTO v_members
  FROM scored s;

  RETURN jsonb_build_object(
    'orgId', v_org,
    'thresholds', eflow_project.workload_settings_json(v_cfg),
    'members', v_members,
    'calculatedAt', now()
  );
END;
$function$;

-- ─── 5. Member Workload Detail RPC (Same-Modal Breakdown + Alternatives) ──────

CREATE OR REPLACE FUNCTION public.get_member_workload_detail(
  p_user_id uuid,
  p_org_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_caller_org uuid;
  v_target record;
  v_org uuid;
  v_cfg public.workload_threshold_settings;
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_due_soon date;
  v_office_summary jsonb;
  v_member_summary jsonb;
  v_alternatives jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_hidden_projects int := 0;
  v_hidden_tasks int := 0;
  v_hidden_subtasks int := 0;
  v_hidden_reviews int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT pr.org_id INTO v_caller_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active profile required' USING ERRCODE = '42501';
  END IF;

  SELECT p.id, p.full_name, p.email, p.role::text AS role, p.org_id,
         o.name AS org_name, (o.head_user_id = p.id) AS is_office_head
  INTO v_target
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.id = p.org_id
  WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002';
  END IF;

  v_org := COALESCE(p_org_id, v_target.org_id, v_caller_org);
  IF v_org IS DISTINCT FROM v_caller_org
     AND NOT public.is_admin(v_uid)
     AND NOT public.can_access_org(v_uid, v_org, 'read') THEN
    RAISE EXCEPTION 'Office access required' USING ERRCODE = '42501';
  END IF;

  v_cfg := eflow_project.resolve_workload_settings(v_org);
  v_due_soon := eflow_project.add_business_days(v_today, v_cfg.due_soon_business_days);
  v_office_summary := public.get_office_workload_summary(v_org);

  SELECT item INTO v_member_summary
  FROM jsonb_array_elements(v_office_summary->'members') item
  WHERE (item->>'userId')::uuid = p_user_id
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(alt ORDER BY (alt->>'loadPoints')::numeric ASC, (alt->>'overdueCount')::int ASC, lower(alt->>'fullName')), '[]'::jsonb)
  INTO v_alternatives
  FROM (
    SELECT item AS alt
    FROM jsonb_array_elements(v_office_summary->'members') item
    WHERE (item->>'userId')::uuid <> p_user_id
      AND (item->>'tier') <> 'overloaded'
    ORDER BY (item->>'loadPoints')::numeric ASC, (item->>'overdueCount')::int ASC, lower(item->>'fullName')
    LIMIT 3
  ) top3;

  -- 1. Projects Led
  SELECT
    v_items || COALESCE(jsonb_agg(
      jsonb_build_object(
        'kind', 'project_lead',
        'id', pr.id,
        'projectId', pr.id,
        'projectTitle', pr.title,
        'title', pr.title,
        'status', pr.status,
        'priority', pr.priority,
        'startDate', pr.start_date,
        'dueDate', pr.target_date,
        'isOverdue', (pr.status = 'active' AND pr.target_date IS NOT NULL AND pr.target_date < v_today),
        'isDueSoon', (pr.status = 'active' AND pr.target_date IS NOT NULL AND pr.target_date >= v_today AND pr.target_date <= v_due_soon),
        'points', CASE WHEN pr.status = 'active' THEN v_cfg.weight_active_project_lead ELSE v_cfg.weight_planning_project_lead END
      ) ORDER BY (pr.status = 'active') DESC, pr.target_date ASC NULLS LAST, pr.title
    ) FILTER (WHERE public.is_admin(v_uid) OR public.can_see_project(pr.id, v_uid)), '[]'::jsonb),
    count(*) FILTER (WHERE NOT (public.is_admin(v_uid) OR public.can_see_project(pr.id, v_uid)))::int
  INTO v_items, v_hidden_projects
  FROM public.projects pr
  WHERE pr.project_lead_id = p_user_id
    AND pr.status IN ('planning', 'active', 'on_hold');

  -- 2. Open Tasks (Task Lead + Task Contributor deduplicated)
  WITH open_tasks AS (
    SELECT t.id, t.title, t.status, t.priority, t.assigned_to, t.team_member_ids,
           t.linked_project_id, COALESCE(pr.title, t.project_title, 'Standalone task') AS project_title,
           t.start_date,
           COALESCE(
             eflow_schedule.calendar_day(NULLIF(t.deadline, '')),
             eflow_schedule.calendar_day(t.due_date)
           ) AS due_day,
           (public.is_admin(v_uid) OR public.can_see_task(t.id, v_uid)) AS visible
    FROM public.tasks t
    LEFT JOIN public.projects pr ON pr.id = t.linked_project_id
    WHERE t.deleted_at IS NULL
      AND t.archived_at IS NULL
      AND t.status IN ('pending_assignment', 'todo', 'in_progress', 'changes_requested', 'for_review')
      AND (pr.id IS NULL OR pr.status NOT IN ('completed', 'archived'))
      AND (t.assigned_to = p_user_id OR p_user_id = ANY(COALESCE(t.team_member_ids, '{}'::uuid[])))
  )
  SELECT
    v_items || COALESCE(jsonb_agg(
      jsonb_build_object(
        'kind', CASE WHEN ot.assigned_to = p_user_id THEN 'task_lead' ELSE 'task_contributor' END,
        'id', ot.id,
        'taskId', ot.id,
        'projectId', ot.linked_project_id,
        'projectTitle', ot.project_title,
        'title', ot.title,
        'status', ot.status,
        'priority', ot.priority,
        'startDate', ot.start_date,
        'dueDate', ot.due_day,
        'isOverdue', (ot.status <> 'for_review' AND ot.due_day IS NOT NULL AND ot.due_day < v_today),
        'isDueSoon', (ot.status <> 'for_review' AND ot.due_day IS NOT NULL AND ot.due_day >= v_today AND ot.due_day <= v_due_soon),
        'points', CASE WHEN ot.assigned_to = p_user_id THEN v_cfg.weight_task_lead ELSE v_cfg.weight_task_contributor END
      ) ORDER BY (ot.due_day IS NOT NULL AND ot.due_day < v_today) DESC, ot.due_day ASC NULLS LAST, ot.title
    ) FILTER (WHERE ot.visible), '[]'::jsonb),
    count(*) FILTER (WHERE NOT ot.visible)::int
  INTO v_items, v_hidden_tasks
  FROM open_tasks ot;

  -- 3. Open Subtasks (Subtask Lead + Subtask Contributor deduplicated)
  WITH open_subs AS (
    SELECT s.id, s.task_id, s.title, s.status, s.lead_id, s.assigned_to_ids,
           eflow_schedule.calendar_day(s.due_date) AS due_day,
           t.title AS task_title, t.linked_project_id, t.assigned_to AS parent_task_lead,
           COALESCE(pr.title, t.project_title, 'Standalone task') AS project_title,
           (public.is_admin(v_uid) OR public.can_see_task(t.id, v_uid)) AS visible
    FROM public.subtasks s
    JOIN public.tasks t ON t.id = s.task_id
    LEFT JOIN public.projects pr ON pr.id = t.linked_project_id
    WHERE s.status NOT IN ('completed', 'cancelled')
      AND t.deleted_at IS NULL
      AND t.archived_at IS NULL
      AND t.status IN ('pending_assignment', 'todo', 'in_progress', 'changes_requested', 'for_review')
      AND (pr.id IS NULL OR pr.status NOT IN ('completed', 'archived'))
      AND (s.lead_id = p_user_id OR p_user_id = ANY(COALESCE(s.assigned_to_ids, '{}'::uuid[])))
  )
  SELECT
    v_items || COALESCE(jsonb_agg(
      jsonb_build_object(
        'kind', CASE WHEN os.lead_id = p_user_id THEN 'subtask_lead' ELSE 'subtask_contributor' END,
        'id', os.id,
        'taskId', os.task_id,
        'projectId', os.linked_project_id,
        'projectTitle', os.project_title || ' · ' || os.task_title,
        'title', os.title,
        'status', os.status,
        'dueDate', os.due_day,
        'isOverdue', (os.status <> 'for_review' AND os.due_day IS NOT NULL AND os.due_day < v_today),
        'isDueSoon', (os.status <> 'for_review' AND os.due_day IS NOT NULL AND os.due_day >= v_today AND os.due_day <= v_due_soon),
        'points', CASE
          WHEN os.lead_id = p_user_id AND os.parent_task_lead = p_user_id THEN ROUND((v_cfg.weight_subtask_lead * 0.5)::numeric, 1)
          WHEN os.lead_id = p_user_id THEN v_cfg.weight_subtask_lead
          ELSE v_cfg.weight_subtask_contributor
        END
      ) ORDER BY (os.due_day IS NOT NULL AND os.due_day < v_today) DESC, os.due_day ASC NULLS LAST, os.title
    ) FILTER (WHERE os.visible), '[]'::jsonb),
    count(*) FILTER (WHERE NOT os.visible)::int
  INTO v_items, v_hidden_subtasks
  FROM open_subs os;

  -- 4. Pending Reviews waiting on this person (task reviews + Head completion reviews)
  WITH open_reviews AS (
    SELECT t.id, t.id AS task_id, t.linked_project_id AS project_id,
           COALESCE(pr.title, t.project_title, 'Standalone task') AS project_title,
           t.title, 'for_review'::text AS status,
           COALESCE(
             eflow_schedule.calendar_day(NULLIF(t.deadline, '')),
             eflow_schedule.calendar_day(t.due_date)
           ) AS due_day,
           (public.is_admin(v_uid) OR public.can_see_task(t.id, v_uid)) AS visible
    FROM public.tasks t
    LEFT JOIN public.projects pr ON pr.id = t.linked_project_id
    WHERE t.deleted_at IS NULL
      AND t.archived_at IS NULL
      AND t.status = 'for_review'
      AND t.reviewer_id = p_user_id
      AND (pr.id IS NULL OR pr.status NOT IN ('completed', 'archived'))
    UNION ALL
    SELECT pr.id, NULL::uuid AS task_id, pr.id AS project_id,
           pr.title AS project_title,
           'Project completion review: ' || pr.title AS title,
           'completion_review'::text AS status,
           pr.target_date AS due_day,
           (public.is_admin(v_uid) OR public.can_see_project(pr.id, v_uid)) AS visible
    FROM public.projects pr
    JOIN public.organizations o ON o.id = pr.org_id
    WHERE pr.status = 'active'
      AND pr.completion_review_status = 'requested'
      AND o.head_user_id = p_user_id
  )
  SELECT
    v_items || COALESCE(jsonb_agg(
      jsonb_build_object(
        'kind', 'pending_review',
        'id', r.id,
        'taskId', r.task_id,
        'projectId', r.project_id,
        'projectTitle', r.project_title,
        'title', r.title,
        'status', r.status,
        'dueDate', r.due_day,
        'isOverdue', false,
        'isDueSoon', false,
        'points', v_cfg.weight_pending_review
      ) ORDER BY r.due_day ASC NULLS LAST, r.title
    ) FILTER (WHERE r.visible), '[]'::jsonb),
    count(*) FILTER (WHERE NOT r.visible)::int
  INTO v_items, v_hidden_reviews
  FROM open_reviews r;

  RETURN jsonb_build_object(
    'member', jsonb_build_object(
      'userId', v_target.id,
      'fullName', v_target.full_name,
      'email', v_target.email,
      'role', v_target.role,
      'orgId', v_target.org_id,
      'orgName', COALESCE(v_target.org_name, ''),
      'isOfficeHead', COALESCE(v_target.is_office_head, false)
    ),
    'summary', v_member_summary,
    'thresholds', eflow_project.workload_settings_json(v_cfg),
    'items', v_items,
    'hiddenCounts', jsonb_build_object(
      'projects', v_hidden_projects,
      'tasks', v_hidden_tasks,
      'subtasks', v_hidden_subtasks,
      'reviews', v_hidden_reviews
    ),
    'alternatives', v_alternatives,
    'calculatedAt', now()
  );
END;
$function$;

-- ─── 6. Immutable Overload Override Audit RPC ────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_workload_overload_override(
  p_target_user_id uuid,
  p_context_type text,
  p_entity_id uuid DEFAULT NULL::uuid,
  p_proposed_role text DEFAULT 'task_lead'::text,
  p_reason text DEFAULT ''::text,
  p_snapshot jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_actor record;
  v_target record;
  v_head_id uuid;
  v_clean_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id, full_name, org_id, role::text AS role, is_active INTO v_actor
  FROM public.profiles WHERE id = v_uid;
  IF NOT FOUND OR NOT v_actor.is_active THEN
    RAISE EXCEPTION 'Active profile required' USING ERRCODE = '42501';
  END IF;

  SELECT id, full_name, org_id INTO v_target
  FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target member not found' USING ERRCODE = 'P0002';
  END IF;

  IF char_length(v_clean_reason) < 10 OR char_length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Enter an overload override justification between 10 and 500 characters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id
  ) VALUES (
    v_uid,
    COALESCE(v_actor.full_name, 'User'),
    COALESCE(NULLIF(btrim(p_context_type), ''), 'workload'),
    COALESCE(p_entity_id::text, p_target_user_id::text),
    'workload.overload_override',
    v_clean_reason,
    jsonb_build_object(
      'targetUserId', p_target_user_id,
      'targetUserName', v_target.full_name,
      'proposedRole', p_proposed_role,
      'snapshot', COALESCE(p_snapshot, '{}'::jsonb)
    ),
    COALESCE(v_target.org_id, v_actor.org_id)
  );

  SELECT head_user_id INTO v_head_id
  FROM public.organizations
  WHERE id = COALESCE(v_target.org_id, v_actor.org_id);

  IF v_head_id IS NOT NULL AND v_head_id <> v_uid THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, reason)
    VALUES (
      v_head_id,
      'status_change',
      'Overloaded member assigned with override',
      COALESCE(v_actor.full_name, 'A project manager') || ' assigned ' || v_target.full_name || ' (' || replace(COALESCE(p_proposed_role, 'work'), '_', ' ') || ') despite overload warning: ' || v_clean_reason,
      CASE WHEN p_context_type = 'project' THEN p_entity_id ELSE NULL END,
      COALESCE(v_target.org_id, v_actor.org_id),
      v_uid,
      COALESCE(v_actor.full_name, 'User'),
      v_clean_reason
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_workload_threshold_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workload_threshold_settings(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.save_workload_threshold_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workload_threshold_settings(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_workload_threshold_settings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_workload_threshold_settings(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_office_workload_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_office_workload_summary(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_member_workload_detail(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_workload_detail(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.record_workload_overload_override(uuid, text, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_workload_overload_override(uuid, text, uuid, text, text, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
