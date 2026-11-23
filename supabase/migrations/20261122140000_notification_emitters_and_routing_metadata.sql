-- Complete Notification Emitters, Routing Metadata & Rich Project Approval Details
-- 1. Enriches `list_pending_project_approvals` with full project context (office name, description,
--    scope, schedule, task count, team count, planned task preview) for the Office Head's For Review queue.
-- 2. Closes all missing / misdirected workflow notification emitters:
--    - Non-Head `save_details` switch to "No funding required" -> notify Head (`project_approval_request`)
--    - Project Lead assignment/change in `save_details` -> notify newly appointed Project Lead
--    - `decide_funding` Head endorsement -> also notify requester / creator / Project Lead
--    - `request_funding` Head self-submit guard -> auto-route to `pending_accounting` & notify Accounting Staff
--    - `phase7_activate_project`, `activate_project_early`, `schedule_project_activation`,
--      `cancel_scheduled_project_activation` -> notify Head / Project Lead / Creator (with PHT dates & reason)
--    - `request_project_completion_review` -> tag `entity_type = 'project_completion_review'`;
--      `complete_project` & `return_project_completion_review` -> notify Lead, Creator & Requester
--    - `decide_petty_cash_request` (approved) -> notify active Accounting Staff (`petty_cash_release_ready`)
--    - `record_cash_return` -> notify Head (`petty_cash_return_received`) on acknowledge, and notify active
--      independent Accounting Staff (`petty_cash_return_approved`) + inform recipient on approve
--    - `decide_petty_cash_liquidation` (declined) -> notify cash recipient (`petty_cash_liquidation_changes`)
--    - `eflow_office_cash.command` -> emit notifications for all 8 Office Petty Cash lifecycle actions
--    - `eflow_phase65.accept_local` & `public.phase6_accept_invitation` -> populate `project_id` & `org_id`
-- 3. Tags `entity_type` / `financial_record_id` / `financial_record_type` consistently for exact tab routing.

-- ─── 1. Enriched Pending Non-Head Project Approvals RPC ───────────────────────

CREATE OR REPLACE FUNCTION public.list_pending_project_approvals(p_org_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(p_org_id, pr.org_id) INTO v_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;

  IF v_org IS NULL OR NOT public.phase2_is_office_head(v_uid, v_org) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'projectId', p.id,
        'title', p.title,
        'description', COALESCE(p.description, ''),
        'scope', COALESCE(p.scope, ''),
        'orgId', p.org_id,
        'officeName', COALESCE(org.name, ''),
        'startDate', p.start_date,
        'targetDate', p.target_date,
        'fundingNotRequired', p.funding_not_required,
        'requestedBy', p.project_approval_requested_by,
        'requestedByName', COALESCE(req_p.full_name, creator_p.full_name, 'Staff'),
        'requestedAt', p.project_approval_requested_at,
        'createdAt', p.created_at,
        'projectLeadId', p.project_lead_id,
        'projectLeadName', COALESCE(lead_p.full_name, 'Assigned project lead'),
        'taskCount', (
          SELECT count(*)
          FROM public.tasks t
          WHERE t.linked_project_id = p.id
            AND t.deleted_at IS NULL
            AND t.status <> 'cancelled'
        ),
        'memberCount', (
          SELECT count(DISTINCT uid)
          FROM (
            SELECT pm.user_id AS uid
            FROM public.project_members pm
            WHERE pm.project_id = p.id
            UNION
            SELECT pom.user_id AS uid
            FROM public.project_offices po
            JOIN public.project_office_members pom ON pom.project_office_id = po.id
            WHERE po.project_id = p.id
            UNION
            SELECT p.project_lead_id AS uid WHERE p.project_lead_id IS NOT NULL
          ) members
        ),
        'tasksPreview', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', pt.id,
              'title', pt.title,
              'dueDate', pt.due_date,
              'assigneeName', pt.assignee_name
            )
          )
          FROM (
            SELECT
              t.id,
              t.title,
              t.due_date,
              COALESCE(ap.full_name, t.assignee_name, 'Unassigned') AS assignee_name
            FROM public.tasks t
            LEFT JOIN public.profiles ap ON ap.id = t.assigned_to
            WHERE t.linked_project_id = p.id
              AND t.deleted_at IS NULL
              AND t.status <> 'cancelled'
            ORDER BY t.due_date NULLS LAST, t.created_at ASC
            LIMIT 5
          ) pt
        ), '[]'::jsonb)
      )
      ORDER BY p.project_approval_requested_at DESC NULLS LAST, p.created_at DESC
    )
    FROM public.projects p
    LEFT JOIN public.organizations org ON org.id = p.org_id
    LEFT JOIN public.profiles req_p ON req_p.id = p.project_approval_requested_by
    LEFT JOIN public.profiles creator_p ON creator_p.id = p.created_by
    LEFT JOIN public.profiles lead_p ON lead_p.id = p.project_lead_id
    WHERE p.org_id = v_org
      AND p.status = 'planning'
      AND p.project_approval_status = 'pending_head'
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.list_pending_project_approvals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_project_approvals(uuid) TO authenticated;

-- ─── 2. Non-Head Project Approval & Lead Assignment Notifications ─────────────

CREATE OR REPLACE FUNCTION eflow_project.finish_setup(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_creator uuid;
  v_head_id uuid;
  v_actor_name text;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the Office Head or project creator may finish setup' USING ERRCODE = '42501';
  END IF;

  UPDATE public.projects
  SET setup_completed_at = now(), updated_at = clock_timestamp()
  WHERE id = p.id
  RETURNING * INTO p;

  IF NOT eflow_project.can_draft_work(p.id) THEN
    RAISE EXCEPTION 'Provide title, description, scope, project lead, and submitted or certified funding (or select No funding required)' USING ERRCODE = '23514';
  END IF;

  v_creator := COALESCE(p.created_by, auth.uid());
  IF p.source_collaboration_draft_id IS NULL
     AND p.funding_not_required = true
     AND NOT public.phase2_is_office_head(v_creator, p.org_id)
     AND NOT public.phase2_is_office_head(auth.uid(), p.org_id)
     AND p.project_approval_status NOT IN ('approved', 'pending_head') THEN
    SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;
    SELECT COALESCE(full_name, 'Staff') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

    PERFORM pg_catalog.set_config('eflow.updating_project_approval', '1', true);
    UPDATE public.projects
    SET project_approval_status = 'pending_head',
        project_approval_requested_by = auth.uid(),
        project_approval_requested_at = now(),
        project_approval_feedback = NULL
    WHERE id = p.id;
    PERFORM pg_catalog.set_config('eflow.updating_project_approval', '', true);

    IF v_head_id IS NOT NULL AND v_head_id <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, entity_type)
      VALUES (
        v_head_id,
        'project_approval_request',
        'Project approval required',
        v_actor_name || ' submitted "' || p.title || '" (no funding required) for Office Head approval.',
        p.id,
        p.org_id,
        auth.uid(),
        v_actor_name,
        'project_approval'
      );
    END IF;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
    VALUES (
      auth.uid(), 'project', p.id::text, 'project.head_approval_requested', p.org_id,
      jsonb_build_object('fundingNotRequired', true)
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resubmit_project_for_head_approval(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_uid uuid := auth.uid();
  v_head_id uuid;
  v_actor_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (public.can_configure_project(p.id, v_uid) OR eflow_project.lead(p.id, v_uid)) THEN
    RAISE EXCEPTION 'Project management access required to resubmit for approval' USING ERRCODE = '42501';
  END IF;
  IF p.status <> 'planning' OR p.project_approval_status <> 'rejected' THEN
    RAISE EXCEPTION 'Only declined planning projects can be resubmitted for Office Head approval' USING ERRCODE = '23514';
  END IF;

  SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;
  SELECT COALESCE(full_name, 'Staff') INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  PERFORM pg_catalog.set_config('eflow.updating_project_approval', '1', true);
  UPDATE public.projects
  SET project_approval_status = 'pending_head',
      project_approval_requested_by = v_uid,
      project_approval_requested_at = now(),
      project_approval_feedback = NULL,
      updated_at = now()
  WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.updating_project_approval', '', true);

  IF v_head_id IS NOT NULL AND v_head_id <> v_uid THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, entity_type)
    VALUES (
      v_head_id,
      'project_approval_request',
      'Project resubmitted for approval',
      v_actor_name || ' resubmitted "' || p.title || '" for Office Head approval.',
      p.id,
      p.org_id,
      v_uid,
      v_actor_name,
      'project_approval'
    );
  END IF;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id)
  VALUES (v_uid, 'project', p.id::text, 'project.head_approval_resubmitted', p.org_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.resubmit_project_for_head_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_project_for_head_approval(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION eflow_project.save_details(p_project uuid, p_details jsonb)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_old_lead uuid;
  v_old_start date;
  v_old_end date;
  v_old_scope text;
  v_old_no_funding boolean;
  leader uuid;
  v_org_head uuid;
  v_creator uuid;
  v_actor_name text;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'You need project management access on this project to save project setup' USING ERRCODE = '42501';
  END IF;
  IF p.updated_at IS DISTINCT FROM (p_details->>'version')::timestamptz THEN
    RAISE EXCEPTION 'Project changed elsewhere. Reopen setup and review current details before saving' USING ERRCODE = '40001';
  END IF;

  v_old_lead := p.project_lead_id;
  v_old_start := p.start_date;
  v_old_end := p.target_date;
  v_old_scope := p.scope;
  v_old_no_funding := p.funding_not_required;

  leader := NULLIF(p_details->>'lead', '')::uuid;
  IF leader IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = leader AND is_active AND org_id = p.org_id AND role::text NOT IN ('admin', 'viewer', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Choose an active project lead from the implementing office' USING ERRCODE = '23514';
  END IF;

  IF length(btrim(p_details->>'title')) NOT BETWEEN 1 AND 200
     OR length(COALESCE(p_details->>'description', '')) > 8000
     OR length(COALESCE(p_details->>'scope', '')) > 8000 THEN
    RAISE EXCEPTION 'Enter a project title up to 200 characters; description and scope may each contain up to 8,000 characters' USING ERRCODE = '23514';
  END IF;

  UPDATE public.projects
  SET title = btrim(p_details->>'title'),
      description = COALESCE(p_details->>'description', ''),
      scope = COALESCE(p_details->>'scope', ''),
      project_lead_id = leader,
      start_date = COALESCE(NULLIF(p_details->>'start', '')::date, start_date),
      target_date = COALESCE(NULLIF(p_details->>'end', '')::date, target_date),
      funding_not_required = COALESCE((p_details->>'noFunding')::boolean, false),
      updated_at = clock_timestamp()
  WHERE id = p.id
  RETURNING * INTO p;

  IF p.start_date IS NOT NULL AND p.target_date IS NOT NULL AND p.start_date > p.target_date THEN
    RAISE EXCEPTION 'Project target date must be on or after its start date' USING ERRCODE = '23514';
  END IF;

  IF p.activation_scheduled_at IS NOT NULL
     AND ROW(p.start_date, p.target_date, p.scope, p.funding_not_required)
         IS DISTINCT FROM ROW(v_old_start, v_old_end, v_old_scope, v_old_no_funding) THEN
    PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
    UPDATE public.projects
    SET activation_scheduled_at = NULL,
        activation_scheduled_by = NULL
    WHERE id = p.id
    RETURNING * INTO p;
    PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);
  END IF;

  SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;
  SELECT COALESCE(full_name, 'Staff') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  -- Switching a non-Head project to No funding required after setup requires Head approval AND notifies Head.
  v_creator := COALESCE(p.created_by, auth.uid());
  IF p.setup_completed_at IS NOT NULL
     AND p.source_collaboration_draft_id IS NULL
     AND p.funding_not_required = true
     AND NOT public.phase2_is_office_head(v_creator, p.org_id)
     AND NOT public.phase2_is_office_head(auth.uid(), p.org_id)
     AND p.project_approval_status = 'not_required' THEN
    PERFORM pg_catalog.set_config('eflow.updating_project_approval', '1', true);
    UPDATE public.projects
    SET project_approval_status = 'pending_head',
        project_approval_requested_by = auth.uid(),
        project_approval_requested_at = now(),
        project_approval_feedback = NULL
    WHERE id = p.id
    RETURNING * INTO p;
    PERFORM pg_catalog.set_config('eflow.updating_project_approval', '', true);

    IF v_org_head IS NOT NULL AND v_org_head <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, entity_type)
      VALUES (
        v_org_head,
        'project_approval_request',
        'Project approval required',
        v_actor_name || ' updated "' || p.title || '" (no funding required) and submitted it for Office Head approval.',
        p.id,
        p.org_id,
        auth.uid(),
        v_actor_name,
        'project_approval'
      );
    END IF;
  END IF;

  IF p.project_lead_id IS NOT NULL THEN
    INSERT INTO public.project_office_members (project_office_id, user_id, selected_by)
      SELECT id, p.project_lead_id, auth.uid()
      FROM public.project_offices
      WHERE project_id = p.id AND office_id = p.org_id AND relationship_type = 'lead'
      ON CONFLICT DO NOTHING;
    INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (p.id, p.project_lead_id, 'member')
      ON CONFLICT DO NOTHING;

    IF p.project_lead_id IS DISTINCT FROM v_old_lead THEN
      UPDATE public.tasks t
      SET reviewer_id = CASE
            WHEN t.assigned_to = p.project_lead_id THEN CASE WHEN v_org_head IS DISTINCT FROM t.assigned_to THEN v_org_head ELSE NULL END
            ELSE p.project_lead_id
          END,
          backup_reviewer_id = NULL,
          review_route_mode = 'explicit'
      WHERE t.linked_project_id = p.id
        AND t.deleted_at IS NULL
        AND t.status NOT IN ('completed', 'cancelled');

      IF p.project_lead_id <> auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
        VALUES (
          p.project_lead_id,
          'assignment',
          'Appointed as Project Lead',
          v_actor_name || ' assigned you as Project Lead for "' || p.title || '".',
          p.id,
          p.org_id,
          auth.uid(),
          v_actor_name
        );
      END IF;
    END IF;
  END IF;

  RETURN p;
END;
$function$;

-- ─── 3. Project Funding Request, Endorsement & Certification Notifications ────

CREATE OR REPLACE FUNCTION eflow_project.request_funding(
  p_project uuid,
  p_lines jsonb,
  p_reason text,
  p_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  total numeric := 0;
  v_actor_name text;
  v_head_id uuid;
  v_is_head boolean := false;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL
     OR NOT (eflow_project.lead(p_project, auth.uid()) OR public.can_configure_project(p_project, auth.uid())) THEN
    RAISE EXCEPTION 'Current project lead or creator access required' USING ERRCODE = '42501';
  END IF;
  IF p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Closed projects cannot request funding' USING ERRCODE = '23514';
  END IF;
  IF p_key IS NULL OR btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Choose funding sources, amounts and a reason' USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(p_reason)) > 3000 THEN
    RAISE EXCEPTION 'Funding reason may contain up to 3,000 characters' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM eflow_project.funding_requests
    WHERE id = p_key
      AND (actor_id <> auth.uid() OR project_id <> p_project OR lines <> p_lines OR reason <> btrim(p_reason))
  ) THEN
    RAISE EXCEPTION 'Funding request terms changed' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM eflow_project.funding_requests WHERE id = p_key) THEN
    RETURN p_key;
  END IF;

  SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;
  v_is_head := public.phase2_is_office_head(auth.uid(), p.org_id);
  IF v_head_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles hp
    WHERE hp.id = v_head_id AND hp.is_active = true
  ) THEN
    RAISE EXCEPTION 'An active Office Head is required to endorse project funding before Accounting Staff certification.' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> auth.uid()
      AND acc.id IS DISTINCT FROM v_head_id
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id
  ) THEN
    RAISE EXCEPTION 'No active independent Accounting Staff is available in this office to certify funding. Assign an active Accounting Staff account or select No funding required.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.department_fiscal_budgets fb WHERE fb.org_id = p.org_id ORDER BY fb.id FOR UPDATE;
  total := eflow_project._validate_funding_lines(p.org_id, p_lines, NULL);

  IF v_is_head THEN
    INSERT INTO eflow_project.funding_requests (
      id, project_id, actor_id, lines, reason, status,
      head_approved_by, head_approved_at, head_decision_reason
    )
    VALUES (
      p_key, p_project, auth.uid(), p_lines, btrim(p_reason), 'pending_accounting',
      auth.uid(), now(), 'Endorsed by Office Head for Accounting Staff certification'
    )
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO eflow_project.funding_requests (id, project_id, actor_id, lines, reason, status)
    VALUES (p_key, p_project, auth.uid(), p_lines, btrim(p_reason), 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  IF p.funding_not_required THEN
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
    UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);
  END IF;

  PERFORM eflow_project.sync_funding_approval_status(p.id);

  SELECT COALESCE(full_name, CASE WHEN v_is_head THEN 'Office Head' ELSE 'Project Lead' END)
  INTO v_actor_name
  FROM public.profiles WHERE id = auth.uid();

  IF v_is_head THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, project_id, org_id, actor_id, actor_name,
      entity_type, financial_record_id, financial_record_type
    )
    SELECT acc.id,
           'project_funding_certification',
           'Project funding certification needed',
           v_actor_name || ' submitted ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
           p.id, p.org_id, auth.uid(), v_actor_name,
           'project_funding', p_key, 'project_funding'
    FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> auth.uid()
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id;
  ELSIF v_head_id IS NOT NULL AND v_head_id <> auth.uid() THEN
    INSERT INTO public.notifications (
      user_id, type, title, message, project_id, org_id, actor_id, actor_name,
      entity_type, financial_record_id, financial_record_type
    )
    VALUES (
      v_head_id, 'project_funding_request', 'Project funding request',
      v_actor_name || ' requested ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Endorse it to forward to Accounting Staff for certification.',
      p.id, p.org_id, auth.uid(), v_actor_name,
      'project_funding', p_key, 'project_funding'
    );
  END IF;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    auth.uid(), 'project', p.id::text, 'project.funding_requested', p.org_id,
    jsonb_build_object('requestId', p_key, 'requested', total, 'lines', p_lines), btrim(p_reason)
  );

  RETURN p_key;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.authorize_funding(p_project uuid, p_lines jsonb, p_reason text, p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  existing_req eflow_project.funding_requests;
  total numeric := 0;
  v_actor_name text;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.phase2_is_office_head(auth.uid(), p.org_id) OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Only the appointed Head may endorse funding for an open project' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL OR btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Select funding sources, amounts and an authorization reason' USING ERRCODE = '23514';
  END IF;
  IF char_length(btrim(p_reason)) > 3000 THEN
    RAISE EXCEPTION 'Funding reason may contain up to 3,000 characters' USING ERRCODE = '23514';
  END IF;
  IF p.project_lead_id IS NULL OR btrim(p.description) = '' OR btrim(p.scope) = '' THEN
    RAISE EXCEPTION 'Save complete project details and scope before requesting funding certification' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO existing_req FROM eflow_project.funding_requests WHERE id = p_key;
  IF FOUND THEN
    IF existing_req.actor_id <> auth.uid() OR existing_req.project_id <> p_project
       OR existing_req.lines <> p_lines OR existing_req.reason <> btrim(p_reason) THEN
      RAISE EXCEPTION 'This request key belongs to different funding details' USING ERRCODE = '23514';
    END IF;
    SELECT COALESCE(sum((item->>'amount')::numeric), 0) INTO total FROM jsonb_array_elements(existing_req.lines) item;
    RETURN jsonb_build_object(
      'authorized', CASE WHEN existing_req.status = 'approved' THEN total ELSE 0 END,
      'requested', total,
      'status', existing_req.status,
      'requestId', existing_req.id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> auth.uid()
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id
  ) THEN
    RAISE EXCEPTION 'No active independent Accounting Staff is available in this office to certify funding. Assign an active Accounting Staff account or select No funding required.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.department_fiscal_budgets fb WHERE fb.org_id = p.org_id ORDER BY fb.id FOR UPDATE;
  total := eflow_project._validate_funding_lines(p.org_id, p_lines, NULL);

  INSERT INTO eflow_project.funding_requests (
    id, project_id, actor_id, lines, reason, status,
    head_approved_by, head_approved_at, head_decision_reason
  ) VALUES (
    p_key, p.id, auth.uid(), p_lines, btrim(p_reason), 'pending_accounting',
    auth.uid(), now(), 'Endorsed by Office Head for Accounting Staff certification'
  );

  IF p.funding_not_required THEN
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
    UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.notifications (
    user_id, type, title, message, project_id, org_id, actor_id, actor_name,
    entity_type, financial_record_id, financial_record_type
  )
  SELECT acc.id,
         'project_funding_certification',
         'Project funding certification needed',
         v_actor_name || ' submitted ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
         p.id,
         p.org_id,
         auth.uid(),
         v_actor_name,
         'project_funding',
         p_key,
         'project_funding'
  FROM public.profiles acc
  WHERE acc.org_id = p.org_id
    AND acc.is_active = true
    AND acc.role::text = 'accounting_staff'
    AND acc.id <> auth.uid()
    AND acc.id IS DISTINCT FROM p.created_by
    AND acc.id IS DISTINCT FROM p.project_lead_id;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    auth.uid(), 'project', p.id::text, 'project.funding_submitted_for_certification', p.org_id,
    jsonb_build_object('requestId', p_key, 'requested', total, 'lines', p_lines), btrim(p_reason)
  );

  RETURN jsonb_build_object(
    'authorized', 0,
    'requested', total,
    'status', 'pending_accounting',
    'requestId', p_key
  );
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.decide_funding(p_request uuid, p_approve boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r eflow_project.funding_requests;
  p public.projects;
  total numeric := 0;
  v_head_name text;
  v_notify_id uuid;
BEGIN
  SELECT * INTO r FROM eflow_project.funding_requests WHERE id = p_request FOR UPDATE;
  SELECT * INTO p FROM public.projects WHERE id = r.project_id FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.phase2_is_office_head(auth.uid(), p.org_id) OR r.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending funding request and appointed Head required' USING ERRCODE = '42501';
  END IF;
  IF NOT p_approve AND btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Give a reason for declining funding' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_head_name FROM public.profiles WHERE id = auth.uid();

  IF p_approve THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles acc
      WHERE acc.org_id = p.org_id
        AND acc.is_active = true
        AND acc.role::text = 'accounting_staff'
        AND acc.id NOT IN (r.actor_id, auth.uid())
        AND acc.id IS DISTINCT FROM p.created_by
        AND acc.id IS DISTINCT FROM p.project_lead_id
    ) THEN
      RAISE EXCEPTION 'No active independent Accounting Staff is available in this office to certify funding. Assign an active Accounting Staff account first.' USING ERRCODE = '23514';
    END IF;

    PERFORM 1 FROM public.department_fiscal_budgets fb WHERE fb.org_id = p.org_id ORDER BY fb.id FOR UPDATE;
    total := eflow_project._validate_funding_lines(p.org_id, r.lines, r.id);

    UPDATE eflow_project.funding_requests
    SET status = 'pending_accounting',
        head_approved_by = auth.uid(),
        head_approved_at = now(),
        head_decision_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Endorsed by Office Head')
    WHERE id = r.id;

    IF p.project_approval_status IN ('pending_head', 'rejected') THEN
      PERFORM pg_catalog.set_config('eflow.updating_project_approval', '1', true);
      UPDATE public.projects
      SET project_approval_status = 'approved',
          project_approved_by = auth.uid(),
          project_approved_at = now(),
          project_approval_feedback = NULLIF(btrim(p_reason), '')
      WHERE id = p.id;
      PERFORM pg_catalog.set_config('eflow.updating_project_approval', '', true);
    END IF;

    -- Notify independent Accounting Staff for Step 2/2 certification.
    INSERT INTO public.notifications (
      user_id, type, title, message, project_id, org_id, actor_id, actor_name,
      entity_type, financial_record_id, financial_record_type
    )
    SELECT acc.id,
           'project_funding_certification',
           'Project funding certification needed',
           v_head_name || ' endorsed ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
           p.id, p.org_id, auth.uid(), v_head_name,
           'project_funding', r.id, 'project_funding'
    FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id NOT IN (r.actor_id, auth.uid())
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id;

    -- Notify requester, creator & Project Lead that Step 1/2 passed and moved to Accounting.
    FOR v_notify_id IN
      SELECT DISTINCT uid FROM unnest(ARRAY[r.actor_id, p.created_by, p.project_lead_id]) uid
      WHERE uid IS NOT NULL AND uid <> auth.uid()
    LOOP
      INSERT INTO public.notifications (
        user_id, type, title, message, project_id, org_id, actor_id, actor_name,
        entity_type, financial_record_id, financial_record_type
      )
      VALUES (
        v_notify_id,
        'project_funding_decided',
        'Project funding endorsed — awaiting Accounting certification',
        v_head_name || ' endorsed ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '" and forwarded it to Accounting Staff for certification.',
        p.id, p.org_id, auth.uid(), v_head_name,
        'project_funding', r.id, 'project_funding'
      );
    END LOOP;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
    VALUES (
      auth.uid(), 'project', p.id::text, 'project.funding_endorsed_by_head', p.org_id,
      jsonb_build_object('requestId', r.id, 'requested', total), COALESCE(NULLIF(btrim(p_reason), ''), 'Endorsed by Office Head')
    );
  ELSE
    UPDATE eflow_project.funding_requests
    SET status = 'rejected',
        head_approved_by = auth.uid(),
        head_approved_at = now(),
        head_decision_reason = btrim(p_reason)
    WHERE id = r.id;

    FOR v_notify_id IN
      SELECT DISTINCT uid FROM unnest(ARRAY[r.actor_id, p.created_by, p.project_lead_id]) uid
      WHERE uid IS NOT NULL AND uid <> auth.uid()
    LOOP
      INSERT INTO public.notifications (
        user_id, type, title, message, project_id, org_id, actor_id, actor_name,
        reason, entity_type, financial_record_id, financial_record_type
      )
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding request declined',
        v_head_name || ' declined the funding request for "' || p.title || '": ' || btrim(p_reason),
        p.id, p.org_id, auth.uid(), v_head_name,
        btrim(p_reason), 'project_funding', r.id, 'project_funding'
      );
    END LOOP;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, reason)
    VALUES (auth.uid(), 'project', p.id::text, 'project.funding_request_decided', p.org_id, btrim(p_reason));
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.certify_funding(p_request uuid, p_approve boolean, p_reason text DEFAULT ''::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r eflow_project.funding_requests;
  p public.projects;
  total numeric := 0;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM eflow_project.funding_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Funding request not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = r.project_id FOR UPDATE;
  IF p.id IS NULL OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Project is closed or unavailable' USING ERRCODE = '23514';
  END IF;

  IF r.status <> 'pending_accounting' THEN
    RAISE EXCEPTION 'Only Head-endorsed requests awaiting Accounting certification can be certified' USING ERRCODE = '23514';
  END IF;

  IF NOT public.can_certify_project_funding(p.org_id, v_actor) THEN
    RAISE EXCEPTION 'Only active Accounting Staff in this office may certify project funding' USING ERRCODE = '42501';
  END IF;

  IF v_actor = r.actor_id
     OR v_actor = r.head_approved_by
     OR v_actor = p.created_by
     OR v_actor = p.project_lead_id THEN
    RAISE EXCEPTION 'Independent Accounting Staff must certify project funding; creators, project leads, and endorsing Heads cannot self-certify.' USING ERRCODE = '42501';
  END IF;

  IF NOT p_approve AND btrim(COALESCE(p_reason, '')) = '' THEN
    RAISE EXCEPTION 'Enter a reason when declining funding certification' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(full_name, 'Accounting Staff') INTO v_actor_name FROM public.profiles WHERE id = v_actor;

  IF p_approve THEN
    total := eflow_project._commit_authorized_funding(
      p.id, r.lines, r.reason, r.id, v_actor, COALESCE(r.head_approved_by, r.actor_id)
    );

    UPDATE eflow_project.funding_requests
    SET status = 'approved',
        accounting_decided_by = v_actor,
        accounting_decided_at = now(),
        accounting_decision_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Certified by Accounting Staff')
    WHERE id = r.id;

    IF p.activation_scheduled_at IS NOT NULL THEN
      PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
      UPDATE public.projects
      SET activation_scheduled_at = NULL, activation_scheduled_by = NULL
      WHERE id = p.id;
      PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);
    END IF;

    FOR v_notify_id IN
      SELECT DISTINCT uid FROM unnest(ARRAY[r.actor_id, r.head_approved_by, p.project_lead_id, p.created_by]) uid
      WHERE uid IS NOT NULL AND uid <> v_actor
    LOOP
      INSERT INTO public.notifications (
        user_id, type, title, message, project_id, org_id, actor_id, actor_name,
        entity_type, financial_record_id, financial_record_type
      )
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding certified',
        v_actor_name || ' certified ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". The project is now Waiting for activation.',
        p.id, p.org_id, v_actor, v_actor_name,
        'project_funding', r.id, 'project_funding'
      );
    END LOOP;

    RETURN jsonb_build_object('status', 'approved', 'authorized', total);
  ELSE
    UPDATE eflow_project.funding_requests
    SET status = 'rejected',
        accounting_decided_by = v_actor,
        accounting_decided_at = now(),
        accounting_decision_reason = btrim(p_reason)
    WHERE id = r.id;

    INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
    VALUES (
      v_actor, 'project', p.id::text, 'project.funding_certification_declined', p.org_id,
      jsonb_build_object('requestId', r.id), btrim(p_reason)
    );

    FOR v_notify_id IN
      SELECT DISTINCT uid FROM unnest(ARRAY[r.actor_id, r.head_approved_by, p.project_lead_id, p.created_by]) uid
      WHERE uid IS NOT NULL AND uid <> v_actor
    LOOP
      INSERT INTO public.notifications (
        user_id, type, title, message, project_id, org_id, actor_id, actor_name,
        reason, entity_type, financial_record_id, financial_record_type
      )
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding certification declined',
        v_actor_name || ' declined funding certification for "' || p.title || '": ' || btrim(p_reason),
        p.id, p.org_id, v_actor, v_actor_name,
        btrim(p_reason), 'project_funding', r.id, 'project_funding'
      );
    END LOOP;

    RETURN jsonb_build_object('status', 'rejected', 'authorized', 0);
  END IF;
END;
$function$;

-- ─── 4. Project Manual Activation, Early Start & Schedule Notifications ───────

CREATE OR REPLACE FUNCTION public.phase7_activate_project(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  r jsonb;
  v_uid uuid := auth.uid();
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_org_head uuid;
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  IF NOT eflow_project.ready(p_project) THEN
    RAISE EXCEPTION 'Finish project details and certified funding setup before activation' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR v_uid IS NULL
     OR NOT (public.can_configure_project(p.id, v_uid) OR eflow_project.lead(p.id, v_uid)) THEN
    RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can activate this project' USING ERRCODE = '42501';
  END IF;
  IF p.source_collaboration_draft_id IS NOT NULL THEN
    RAISE EXCEPTION 'Use the existing proposal approval workflow' USING ERRCODE = '22023';
  END IF;
  IF p.project_approval_status IN ('pending_head', 'rejected') THEN
    RAISE EXCEPTION 'Office Head project approval is required before activating this project' USING ERRCODE = '23514';
  END IF;
  IF p.status = 'active' THEN
    RETURN;
  END IF;
  IF p.start_date IS NULL THEN
    RAISE EXCEPTION 'Set a project start date before activating' USING ERRCODE = '22023';
  END IF;
  IF p.start_date > v_today_manila THEN
    RAISE EXCEPTION 'Project cannot be activated before its start date (% at 12:00 AM Philippine Time). Use Schedule for start date to queue automatic activation.', to_char(p.start_date, 'MM/DD/YYYY') USING ERRCODE = '22023';
  END IF;
  r := eflow_phase7.readiness(p.id);
  IF NOT (r->>'canActivate')::boolean THEN
    RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023', DETAIL = (r->'checks')::text;
  END IF;

  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
  UPDATE public.projects
  SET status = 'active',
      activation_scheduled_at = NULL,
      activation_scheduled_by = NULL,
      updated_at = now()
  WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (v_uid, 'project', p.id::text, 'project.activated', p.org_id, r);

  SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;
  SELECT COALESCE(full_name, 'Project Manager') INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[v_org_head, p.project_lead_id, p.created_by, p.owner_id]) uid
    WHERE uid IS NOT NULL AND uid <> v_uid
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_notify_id,
      'status_change',
      'Project activated',
      v_actor_name || ' activated "' || p.title || '". The project is now Active.',
      p.id,
      p.org_id,
      v_uid,
      v_actor_name
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.phase7_activate_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase7_activate_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_project_early(
  p_project uuid,
  p_reason text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  r jsonb;
  v_uid uuid := auth.uid();
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_days_early integer := 0;
  v_clean_reason text := btrim(COALESCE(p_reason, ''));
  v_org_head uuid;
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT eflow_project.ready(p_project) THEN
    RAISE EXCEPTION 'Finish project details and certified funding setup before activation' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL
     OR NOT (public.can_configure_project(p.id, v_uid) OR eflow_project.lead(p.id, v_uid)) THEN
    RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can activate this project' USING ERRCODE = '42501';
  END IF;
  IF p.source_collaboration_draft_id IS NOT NULL THEN
    RAISE EXCEPTION 'Use the existing proposal approval workflow' USING ERRCODE = '22023';
  END IF;
  IF p.project_approval_status IN ('pending_head', 'rejected') THEN
    RAISE EXCEPTION 'Office Head project approval is required before activating this project' USING ERRCODE = '23514';
  END IF;
  IF p.status = 'active' THEN
    RETURN jsonb_build_object('projectId', p.id, 'status', 'active', 'daysEarly', 0);
  END IF;
  IF p.start_date IS NULL THEN
    RAISE EXCEPTION 'Set a project start date before activating' USING ERRCODE = '22023';
  END IF;

  v_days_early := GREATEST(0, p.start_date - v_today_manila);
  IF v_days_early >= 7 AND char_length(v_clean_reason) < 10 THEN
    RAISE EXCEPTION 'Enter at least 10 characters explaining why this project is starting % days ahead of schedule.', v_days_early USING ERRCODE = '23514';
  END IF;
  IF char_length(v_clean_reason) > 500 THEN
    RAISE EXCEPTION 'Early start justification may contain up to 500 characters' USING ERRCODE = '23514';
  END IF;

  r := eflow_phase7.readiness(p.id);
  IF v_days_early = 0 THEN
    IF NOT COALESCE((r->>'canActivate')::boolean, false) THEN
      RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023', DETAIL = (r->'checks')::text;
    END IF;
  ELSE
    IF NOT COALESCE((r->>'canEarlyActivate')::boolean, false) THEN
      RAISE EXCEPTION 'Complete all other readiness checks before starting this project early' USING ERRCODE = '22023', DETAIL = (r->'checks')::text;
    END IF;
  END IF;

  PERFORM pg_catalog.set_config('eflow.early_activating_project', '1', true);
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
  UPDATE public.projects
  SET status = 'active',
      activation_scheduled_at = NULL,
      activation_scheduled_by = NULL,
      updated_at = now()
  WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);
  PERFORM pg_catalog.set_config('eflow.early_activating_project', '', true);

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    v_uid,
    'project',
    p.id::text,
    CASE WHEN v_days_early > 0 THEN 'project.activated_early' ELSE 'project.activated' END,
    p.org_id,
    r || jsonb_build_object(
      'scheduledStartDate', p.start_date,
      'activatedDatePht', v_today_manila,
      'daysEarly', v_days_early
    ),
    NULLIF(v_clean_reason, '')
  );

  SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;
  SELECT COALESCE(full_name, 'Project Manager') INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[v_org_head, p.project_lead_id, p.created_by, p.owner_id]) uid
    WHERE uid IS NOT NULL AND uid <> v_uid
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, reason)
    VALUES (
      v_notify_id,
      'status_change',
      CASE WHEN v_days_early > 0 THEN 'Project started early' ELSE 'Project activated' END,
      CASE
        WHEN v_days_early > 0 THEN
          v_actor_name || ' started "' || p.title || '" ' || v_days_early ||
          CASE WHEN v_days_early = 1 THEN ' day' ELSE ' days' END ||
          ' ahead of its scheduled ' || to_char(p.start_date, 'MM/DD/YYYY') || ' start date.'
        ELSE
          v_actor_name || ' activated "' || p.title || '". The project is now Active.'
      END,
      p.id,
      p.org_id,
      v_uid,
      v_actor_name,
      NULLIF(v_clean_reason, '')
    );
  END LOOP;

  RETURN jsonb_build_object(
    'projectId', p.id,
    'status', 'active',
    'daysEarly', v_days_early,
    'scheduledStartDate', p.start_date
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_project_early(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_project_early(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.schedule_project_activation(p_project uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  r jsonb;
  v_uid uuid := auth.uid();
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_org_head uuid;
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT eflow_project.ready(p_project) THEN
    RAISE EXCEPTION 'Finish project setup and approvals before scheduling activation' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL
     OR NOT (public.can_configure_project(p.id, v_uid) OR eflow_project.lead(p.id, v_uid)) THEN
    RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can schedule activation' USING ERRCODE = '42501';
  END IF;
  IF p.source_collaboration_draft_id IS NOT NULL THEN
    RAISE EXCEPTION 'Use the existing proposal approval workflow' USING ERRCODE = '22023';
  END IF;
  IF p.status NOT IN ('planning', 'on_hold') THEN
    RAISE EXCEPTION 'Only planning or on-hold projects can be scheduled for activation' USING ERRCODE = '23514';
  END IF;
  IF p.project_approval_status IN ('pending_head', 'rejected') THEN
    RAISE EXCEPTION 'Office Head project approval is required before scheduling activation' USING ERRCODE = '23514';
  END IF;
  IF p.start_date IS NULL THEN
    RAISE EXCEPTION 'Set a project start date before scheduling activation' USING ERRCODE = '22023';
  END IF;
  IF p.start_date <= v_today_manila THEN
    RAISE EXCEPTION 'The project start date has already arrived. Click Activate project to activate now.' USING ERRCODE = '22023';
  END IF;

  r := eflow_phase7.readiness(p.id);
  IF NOT COALESCE((r->>'canScheduleActivation')::boolean, false) AND p.activation_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'Complete all other readiness checks before scheduling automatic activation' USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
  UPDATE public.projects
  SET activation_scheduled_at = now(),
      activation_scheduled_by = v_uid,
      updated_at = now()
  WHERE id = p.id
  RETURNING * INTO p;
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (
    v_uid, 'project', p.id::text, 'project.activation_scheduled', p.org_id,
    jsonb_build_object('startDate', p.start_date, 'scheduledAt', p.activation_scheduled_at)
  );

  SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;
  SELECT COALESCE(full_name, 'Project Manager') INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[v_org_head, p.project_lead_id, p.created_by, p.owner_id]) uid
    WHERE uid IS NOT NULL AND uid <> v_uid
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_notify_id,
      'status_change',
      'Project activation scheduled',
      v_actor_name || ' scheduled "' || p.title || '" to activate automatically on ' || to_char(p.start_date, 'MM/DD/YYYY') || ' at 12:00 AM (PHT).',
      p.id,
      p.org_id,
      v_uid,
      v_actor_name
    );
  END LOOP;

  RETURN jsonb_build_object(
    'projectId', p.id,
    'startDate', p.start_date,
    'activationScheduledAt', p.activation_scheduled_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.schedule_project_activation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.schedule_project_activation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_scheduled_project_activation(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_uid uuid := auth.uid();
  v_org_head uuid;
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL
     OR NOT (public.can_configure_project(p.id, v_uid) OR eflow_project.lead(p.id, v_uid)) THEN
    RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can cancel scheduled activation' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
  UPDATE public.projects
  SET activation_scheduled_at = NULL,
      activation_scheduled_by = NULL,
      updated_at = now()
  WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id)
  VALUES (v_uid, 'project', p.id::text, 'project.activation_schedule_cancelled', p.org_id);

  SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;
  SELECT COALESCE(full_name, 'Project Manager') INTO v_actor_name FROM public.profiles WHERE id = v_uid;

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[v_org_head, p.project_lead_id, p.created_by, p.owner_id]) uid
    WHERE uid IS NOT NULL AND uid <> v_uid
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_notify_id,
      'status_change',
      'Scheduled project activation cancelled',
      v_actor_name || ' cancelled scheduled automatic activation for "' || p.title || '". Status remains Waiting for activation.',
      p.id,
      p.org_id,
      v_uid,
      v_actor_name
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_project_activation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_project_activation(uuid) TO authenticated;

-- ─── 5. Project Completion Review Routing Tag & Full Recipients ───────────────

CREATE OR REPLACE FUNCTION public.request_project_completion_review(
  p_project_id uuid,
  p_note text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_lead_name text;
  v_head_id uuid;
  p public.projects;
  v_readiness jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT eflow_project.lead(p.id, v_uid) THEN
    RAISE EXCEPTION 'Only the appointed Project Lead can submit this project for completion review' USING ERRCODE = '42501';
  END IF;

  IF public.phase2_is_office_head(v_uid, p.org_id) THEN
    RAISE EXCEPTION 'As Office Head and Project Lead, you can mark this project complete directly without submitting a review request.' USING ERRCODE = '22023';
  END IF;

  IF p.status <> 'active' THEN
    RAISE EXCEPTION 'Only active projects can be submitted for completion review' USING ERRCODE = '22023';
  END IF;

  IF p.completion_review_status = 'requested' THEN
    RETURN public.project_completion_readiness_internal(p.id);
  END IF;

  IF char_length(COALESCE(btrim(p_note), '')) > 2000 THEN
    RAISE EXCEPTION 'Completion review note may contain up to 2,000 characters' USING ERRCODE = '22023';
  END IF;

  v_readiness := public.project_completion_readiness_internal(p.id);
  IF COALESCE((v_readiness->>'workBlockersCount')::integer, 0) > 0 THEN
    RAISE EXCEPTION 'Resolve all open tasks, subtasks, and financial settlement items before requesting Head completion review'
      USING ERRCODE = '22023', DETAIL = (v_readiness->'blockers')::text;
  END IF;

  SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;
  IF v_head_id IS NULL THEN
    RAISE EXCEPTION 'No active Office Head is assigned to review this project' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(full_name, 'Project Lead') INTO v_lead_name FROM public.profiles WHERE id = v_uid;

  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '1', true);
  UPDATE public.projects
  SET completion_review_status = 'requested',
      completion_requested_by = v_uid,
      completion_requested_at = now(),
      completion_request_note = NULLIF(btrim(COALESCE(p_note, '')), ''),
      completion_review_feedback = NULL,
      updated_at = now()
  WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '', true);

  INSERT INTO public.audit_events (actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id)
  VALUES (
    v_uid, v_lead_name, 'project', p.id::text, 'project.completion_review_requested',
    NULLIF(btrim(COALESCE(p_note, '')), ''),
    jsonb_build_object('completionReviewStatus', 'requested'),
    p.org_id
  );

  INSERT INTO public.notifications (
    user_id, type, title, message, project_id, org_id, actor_id, actor_name, entity_type, reason
  )
  VALUES (
    v_head_id,
    'approval_needed',
    'Project completion review requested',
    v_lead_name || ' submitted "' || p.title || '" for your final completion review before marking complete, archiving, and sealing.',
    p.id,
    p.org_id,
    v_uid,
    v_lead_name,
    'project_completion_review',
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );

  RETURN public.project_completion_readiness_internal(p.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_project_completion_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_project_completion_review(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.return_project_completion_review(
  p_project_id uuid,
  p_feedback text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_head_name text;
  p public.projects;
  v_notify_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.phase2_is_office_head(v_uid, p.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Office Head can review project completion requests' USING ERRCODE = '42501';
  END IF;

  IF p.status <> 'active' OR p.completion_review_status <> 'requested' THEN
    RAISE EXCEPTION 'This project does not have an open completion review request' USING ERRCODE = '22023';
  END IF;

  IF btrim(COALESCE(p_feedback, '')) = '' THEN
    RAISE EXCEPTION 'Enter feedback explaining what needs to be addressed before completion' USING ERRCODE = '22023';
  END IF;

  IF char_length(btrim(p_feedback)) > 2000 THEN
    RAISE EXCEPTION 'Feedback may contain up to 2,000 characters' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_head_name FROM public.profiles WHERE id = v_uid;

  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '1', true);
  UPDATE public.projects
  SET completion_review_status = 'changes_requested',
      completion_review_feedback = btrim(p_feedback),
      completion_reviewed_by = v_uid,
      completion_reviewed_at = now(),
      updated_at = now()
  WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '', true);

  INSERT INTO public.audit_events (actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id)
  VALUES (
    v_uid, v_head_name, 'project', p.id::text, 'project.completion_review_changes_requested',
    btrim(p_feedback),
    jsonb_build_object('completionReviewStatus', 'changes_requested'),
    p.org_id
  );

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[p.project_lead_id, p.created_by, p.completion_requested_by]) uid
    WHERE uid IS NOT NULL AND uid <> v_uid
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, reason)
    VALUES (
      v_notify_id,
      'status_change',
      'Project completion changes requested',
      v_head_name || ' requested changes before marking "' || p.title || '" complete: ' || btrim(p_feedback),
      p.id,
      p.org_id,
      v_uid,
      v_head_name,
      btrim(p_feedback)
    );
  END LOOP;

  RETURN public.project_completion_readiness_internal(p.id);
END;
$function$;

REVOKE ALL ON FUNCTION public.return_project_completion_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_project_completion_review(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_project(
  p_project_id uuid,
  p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  project_row public.projects;
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  PERFORM public.get_project_completion_readiness(p_project_id);
  SELECT * INTO project_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF project_row.status = 'completed' THEN
    RETURN;
  END IF;
  IF project_row.status = 'archived' THEN
    RAISE EXCEPTION 'This project is already archived' USING ERRCODE = '22023';
  END IF;
  IF NOT public.phase2_is_office_head(auth.uid(), project_row.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Head can approve project completion' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '1', true);
  UPDATE public.projects
  SET status = 'completed',
      completion_review_status = CASE
        WHEN completion_review_status = 'requested' THEN 'approved'
        ELSE completion_review_status
      END,
      completion_reviewed_by = CASE
        WHEN completion_review_status = 'requested' THEN auth.uid()
        ELSE completion_reviewed_by
      END,
      completion_reviewed_at = CASE
        WHEN completion_review_status = 'requested' THEN now()
        ELSE completion_reviewed_at
      END,
      updated_at = now()
  WHERE id = p_project_id;
  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '', true);

  INSERT INTO public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id)
  VALUES (
    auth.uid(), v_actor_name,
    'project', p_project_id::text, 'project.completed', NULLIF(btrim(p_note), ''),
    jsonb_build_object('status', project_row.status, 'completionReviewStatus', project_row.completion_review_status),
    jsonb_build_object('status', 'completed', 'completionReviewStatus', CASE WHEN project_row.completion_review_status = 'requested' THEN 'approved' ELSE project_row.completion_review_status END),
    project_row.org_id
  );

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[project_row.project_lead_id, project_row.created_by, project_row.completion_requested_by]) uid
    WHERE uid IS NOT NULL AND uid <> auth.uid()
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_notify_id,
      'completed',
      'Project marked complete',
      v_actor_name || ' approved completion for "' || project_row.title || '".',
      project_row.id,
      project_row.org_id,
      auth.uid(),
      v_actor_name
    );
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_project(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_project(uuid, text) TO authenticated;

-- ─── 6. Financial Workflow Notification Fixes (Cash Release, Return & Late Liquidation) ─

CREATE OR REPLACE FUNCTION public.decide_petty_cash_request(p_request_id uuid, p_approve boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  request public.petty_cash_requests;
  budget public.department_fiscal_budgets;
  allocation public.work_budget_allocations;
  allocation_used numeric;
  v_actor_name text;
  v_task_title text;
BEGIN
  /* NW5.2 shared writer lock */
  PERFORM eflow_r7.lock_impact((SELECT task_id FROM public.petty_cash_requests WHERE id = p_request_id));

  SELECT * INTO request FROM public.petty_cash_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Petty-cash request not found' USING ERRCODE = 'P0002'; END IF;
  IF request.status <> 'pending_department_approval' THEN RAISE EXCEPTION 'This request is not awaiting department approval' USING ERRCODE = '22023'; END IF;

  IF NOT (
    CASE
      WHEN EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id = t.linked_project_id WHERE t.id = request.task_id AND p.project_lead_id IS NOT NULL)
      THEN caller = eflow_project.reviewer(request.task_id, request.requester_id)
      ELSE public.is_department_budget_approver(request.org_id, caller)
    END
  ) THEN
    RAISE EXCEPTION 'Only the Head or Assistant Head can decide this request' USING ERRCODE = '42501';
  END IF;

  IF caller = request.requester_id OR caller = request.cash_recipient_id THEN
    RAISE EXCEPTION 'You cannot approve your own request' USING ERRCODE = '42501';
  END IF;
  IF caller = request.leader_decided_by THEN
    RAISE EXCEPTION 'The Team Leader endorsement and department approval must be made by different people' USING ERRCODE = '42501';
  END IF;
  IF NOT p_approve AND NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required when declining' USING ERRCODE = '22023';
  END IF;

  IF p_approve THEN
    SELECT * INTO budget FROM public.department_fiscal_budgets WHERE id = request.fiscal_budget_id AND status = 'locked' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The annual department budget is no longer open' USING ERRCODE = '22023'; END IF;

    SELECT * INTO allocation FROM public.work_budget_allocations WHERE id = request.allocation_id AND status = 'approved' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The work allocation is no longer available' USING ERRCODE = '22023'; END IF;

    SELECT COALESCE(sum(CASE WHEN status = 'settled' THEN actual_spent ELSE approved_amount END), 0)
    INTO allocation_used
    FROM public.petty_cash_requests
    WHERE allocation_id = allocation.id AND id <> request.id
      AND status IN ('approved','scheduled_for_release','partially_released','released','liquidation_submitted','pending_leader_liquidation_review','pending_department_settlement','changes_requested','overdue_liquidation','settled');

    IF allocation_used + request.requested_amount > allocation.amount THEN
      RAISE EXCEPTION 'The work allocation is no longer sufficient' USING ERRCODE = '22023';
    END IF;
  END IF;

  UPDATE public.petty_cash_requests SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    approved_amount = CASE WHEN p_approve THEN requested_amount END,
    approved_by = caller,
    approval_reason = NULLIF(btrim(p_reason), ''),
    department_decision_reason = NULLIF(btrim(p_reason), ''),
    decided_at = now(),
    updated_at = now()
  WHERE id = request.id;

  IF p_approve THEN
    PERFORM public.schedule_petty_cash_releases(request.id, caller);
    INSERT INTO public.budget_ledger_entries(fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id, entry_type, amount, description, actor_id)
    VALUES (
      request.fiscal_budget_id, request.org_id, request.commitment_id, request.allocation_id, request.id,
      'petty_cash_reserved', request.requested_amount, 'Petty cash approved and scheduled under the daily release cap', caller
    );
  END IF;

  SELECT COALESCE(full_name, '') INTO v_actor_name FROM public.profiles WHERE id = caller;
  SELECT COALESCE(title, '') INTO v_task_title FROM public.tasks WHERE id = request.task_id;

  INSERT INTO public.notifications(user_id, type, title, message, task_id, task_title, org_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)
  VALUES (
    request.requester_id,
    'petty_cash_decision',
    CASE WHEN p_approve THEN 'Petty cash approved and scheduled' ELSE 'Petty cash declined' END,
    CASE WHEN p_approve THEN 'Your request was approved. Cash releases were scheduled under the department daily cap.' ELSE 'Your petty-cash request was declined.' END,
    request.task_id, v_task_title, request.org_id, caller, v_actor_name, COALESCE(p_reason, ''), request.id, 'petty_cash_request'
  );

  -- Notify active Accounting Staff to process scheduled cash releases in Voucher & Cash Releases.
  IF p_approve THEN
    INSERT INTO public.notifications(user_id, type, title, message, task_id, task_title, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
    SELECT acc.id,
           'petty_cash_release_ready',
           'Cash release scheduled — Accounting action required',
           COALESCE(NULLIF(v_actor_name, ''), 'Approver') || ' approved ₱' || to_char(request.requested_amount, 'FM999,999,999,990.00') ||
             CASE WHEN v_task_title <> '' THEN ' for "' || v_task_title || '"' ELSE '' END ||
             '. Open Voucher & Cash Releases to process disbursement.',
           request.task_id, v_task_title, request.org_id, caller, v_actor_name, request.id, 'petty_cash_request'
    FROM public.profiles acc
    WHERE acc.org_id = request.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> caller
      AND acc.id IS DISTINCT FROM request.requester_id
      AND acc.id IS DISTINCT FROM request.cash_recipient_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_cash_return(p_liquidation uuid, p_version integer, p_action text, p_amount numeric, p_reference text, p_key uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  l public.petty_cash_liquidations;
  r public.petty_cash_requests;
  d eflow_work_clearance.return_decisions;
  context jsonb;
  stamp text;
  command eflow_work_clearance.return_commands;
  terms jsonb;
  v_actor_name text;
BEGIN
  SELECT * INTO l FROM public.petty_cash_liquidations WHERE id = p_liquidation;
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = l.request_id;
  PERFORM eflow_r7.lock_impact(r.task_id);
  PERFORM 1 FROM public.organizations WHERE id = r.org_id FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE org_id = r.org_id ORDER BY id FOR SHARE;
  SELECT * INTO l FROM public.petty_cash_liquidations WHERE id = p_liquidation FOR UPDATE;
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = l.request_id FOR UPDATE;

  context := public.cash_return_clearance(l.id);
  IF p_key IS NULL OR p_version IS DISTINCT FROM l.version OR p_amount IS DISTINCT FROM l.returned_amount
     OR p_amount <= 0 OR NULLIF(btrim(p_reference), '') IS NULL OR length(p_reference) > 2000 THEN
    RAISE EXCEPTION 'Verify the exact return amount, package version and reference' USING ERRCODE = '22023';
  END IF;

  stamp := eflow_finance_review.fingerprint(l, r);
  terms := jsonb_build_object('liquidation', l.id, 'version', p_version, 'action', p_action, 'amount', p_amount, 'reference', btrim(p_reference), 'fingerprint', stamp);
  SELECT * INTO command FROM eflow_work_clearance.return_commands WHERE command_id = p_key;
  IF FOUND THEN
    IF command.actor_id IS DISTINCT FROM auth.uid() OR command.terms IS DISTINCT FROM terms THEN
      RAISE EXCEPTION 'Return command terms changed' USING ERRCODE = '22023';
    END IF;
    RETURN context;
  END IF;

  SELECT * INTO d FROM eflow_work_clearance.return_decisions WHERE liquidation_id = l.id FOR UPDATE;
  IF p_action = 'acknowledge' AND d.receive_command = p_key THEN
    IF d.received_by <> auth.uid() OR d.fingerprint <> stamp OR d.receive_reference <> btrim(p_reference) THEN
      RAISE EXCEPTION 'Return command terms changed' USING ERRCODE = '22023';
    END IF;
    RETURN context;
  ELSIF p_action = 'approve' AND d.approve_command = p_key THEN
    IF d.approved_by <> auth.uid() OR d.fingerprint <> stamp OR d.approval_note <> btrim(p_reference) THEN
      RAISE EXCEPTION 'Return command terms changed' USING ERRCODE = '22023';
    END IF;
    RETURN context;
  END IF;

  IF p_action = 'acknowledge' AND COALESCE((context->>'canAcknowledge')::boolean, false) THEN
    INSERT INTO eflow_work_clearance.return_decisions(liquidation_id, version, fingerprint, amount, received_by, receive_reference, receive_command)
    VALUES (l.id, l.version, stamp, p_amount, auth.uid(), btrim(p_reference), p_key)
    ON CONFLICT(liquidation_id) DO UPDATE SET
      version = excluded.version,
      fingerprint = excluded.fingerprint,
      amount = excluded.amount,
      received_by = excluded.received_by,
      received_at = now(),
      receive_reference = excluded.receive_reference,
      receive_command = excluded.receive_command,
      approved_by = NULL,
      approved_at = NULL,
      approval_note = NULL,
      approve_command = NULL;
  ELSIF p_action = 'approve' AND COALESCE((context->>'canApprove')::boolean, false) THEN
    UPDATE eflow_work_clearance.return_decisions
    SET approved_by = auth.uid(), approved_at = now(), approval_note = btrim(p_reference), approve_command = p_key
    WHERE liquidation_id = l.id;
  ELSE
    RAISE EXCEPTION 'Current independent return authority required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO eflow_work_clearance.return_commands(command_id, actor_id, liquidation_id, terms)
  VALUES (p_key, auth.uid(), l.id, terms);
  UPDATE public.petty_cash_requests SET updated_at = now() WHERE id = r.id;
  INSERT INTO public.audit_events(actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (
    auth.uid(), 'petty_cash_liquidation', l.id::text, 'cash_return.' || p_action, r.org_id,
    jsonb_build_object('version', l.version, 'amount', p_amount, 'reference', btrim(p_reference), 'commandId', p_key)
  );

  SELECT COALESCE(full_name, '') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  IF p_action = 'acknowledge' THEN
    INSERT INTO public.notifications(user_id, type, title, message, financial_record_id, financial_record_type, task_id, org_id, actor_id, actor_name)
    SELECT o.head_user_id,
           'petty_cash_return_received',
           'Cash return received — Head approval required',
           COALESCE(NULLIF(v_actor_name, ''), 'Accounting') || ' acknowledged physical receipt of ₱' || to_char(p_amount, 'FM999,999,990.00') || '. Approve the cash return before settlement.',
           l.id, 'petty_cash_liquidation', r.task_id, r.org_id, auth.uid(), v_actor_name
    FROM public.organizations o
    WHERE o.id = r.org_id AND o.head_user_id IS NOT NULL AND o.head_user_id <> auth.uid();
  ELSE
    -- Notify eligible Accounting Staff to complete settlement (fixes old bug that sent "settlement required" only to employee).
    INSERT INTO public.notifications(user_id, type, title, message, financial_record_id, financial_record_type, task_id, org_id, actor_id, actor_name)
    SELECT acc.id,
           'petty_cash_return_approved',
           'Cash return approved — ready to settle',
           COALESCE(NULLIF(v_actor_name, ''), 'Office Head') || ' approved the ₱' || to_char(p_amount, 'FM999,999,990.00') || ' cash return. Open Settlements to post final settlement.',
           l.id, 'petty_cash_liquidation', r.task_id, r.org_id, auth.uid(), v_actor_name
    FROM public.profiles acc
    WHERE acc.org_id = r.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> auth.uid()
      AND acc.id IS DISTINCT FROM r.cash_recipient_id
      AND acc.id IS DISTINCT FROM r.requester_id
      AND acc.id IS DISTINCT FROM r.task_leader_id;

    -- Also inform the cash recipient that their cash return was approved.
    IF r.cash_recipient_id IS NOT NULL AND r.cash_recipient_id <> auth.uid() THEN
      INSERT INTO public.notifications(user_id, type, title, message, financial_record_id, financial_record_type, task_id, org_id, actor_id, actor_name)
      VALUES (
        r.cash_recipient_id,
        'petty_cash_liquidation_decision',
        'Cash return approved by Head',
        COALESCE(NULLIF(v_actor_name, ''), 'Office Head') || ' approved your ₱' || to_char(p_amount, 'FM999,999,990.00') || ' cash return. Accounting can now complete final settlement.',
        l.id, 'petty_cash_liquidation', r.task_id, r.org_id, auth.uid(), v_actor_name
      );
    END IF;
  END IF;

  RETURN public.cash_return_clearance(l.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decide_petty_cash_liquidation(p_liquidation_id uuid, p_approve boolean, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  liquidation public.petty_cash_liquidations;
  request public.petty_cash_requests;
  v_actor_name text;
BEGIN
  /* NW5.2 shared writer lock */
  PERFORM eflow_r7.lock_impact((SELECT c.task_id FROM public.petty_cash_liquidations l JOIN public.petty_cash_requests c ON c.id = l.request_id WHERE l.id = p_liquidation_id));
  SELECT * INTO liquidation FROM public.petty_cash_liquidations WHERE id = p_liquidation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Liquidation not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO request FROM public.petty_cash_requests WHERE id = liquidation.request_id FOR UPDATE;
  IF NOT public.is_department_budget_head(request.org_id, caller) THEN RAISE EXCEPTION 'Only the office Head may authorize late liquidation' USING ERRCODE = '42501'; END IF;
  IF caller IN (request.cash_recipient_id, request.requester_id) OR caller = liquidation.leader_decided_by THEN RAISE EXCEPTION 'Independent financial approval required' USING ERRCODE = '42501'; END IF;
  IF liquidation.status <> 'pending_department_settlement' OR request.status <> 'pending_department_settlement' OR request.liquidation_due_at IS NULL OR liquidation.submitted_at <= request.liquidation_due_at THEN
    RAISE EXCEPTION 'This package is not awaiting late liquidation authorization' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Record a decision reason' USING ERRCODE = '22023'; END IF;

  UPDATE public.petty_cash_liquidations
  SET department_decided_by = caller,
      department_decision_reason = btrim(p_reason),
      department_decided_at = now(),
      status = CASE WHEN p_approve THEN status ELSE 'changes_requested' END
  WHERE id = liquidation.id;

  IF NOT p_approve THEN
    UPDATE public.petty_cash_requests SET status = 'changes_requested', updated_at = now() WHERE id = request.id;
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_actor_name FROM public.profiles WHERE id = caller;

  INSERT INTO public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id)
  VALUES (caller, v_actor_name, 'petty_cash_liquidation', liquidation.id::text, 'liquidation.late_authorization', btrim(p_reason), jsonb_build_object('approved', p_approve, 'authority', 'Office Head'), request.org_id);

  IF p_approve THEN
    INSERT INTO public.notifications(user_id, type, title, message, task_id, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
    SELECT p.id, 'petty_cash_liquidation_accounting_review', 'Late liquidation authorized — ready to settle',
           v_actor_name || ' authorized the late receipt package. Accounting may now settle it.',
           request.task_id, request.org_id, caller, v_actor_name, liquidation.id, 'petty_cash_liquidation'
    FROM public.profiles p
    WHERE p.is_active AND p.org_id = request.org_id AND p.role::text = 'accounting_staff' AND p.id <> caller;
  ELSE
    -- Notify the cash recipient who actually needs to revise and resubmit receipts!
    IF request.cash_recipient_id IS NOT NULL AND request.cash_recipient_id <> caller THEN
      INSERT INTO public.notifications(user_id, type, title, message, task_id, org_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)
      VALUES (
        request.cash_recipient_id,
        'petty_cash_liquidation_changes',
        'Expense liquidation needs changes',
        v_actor_name || ' returned your late receipt package for revisions: ' || btrim(p_reason),
        request.task_id, request.org_id, caller, v_actor_name, btrim(p_reason), liquidation.id, 'petty_cash_liquidation'
      );
    END IF;
  END IF;
END;
$function$;

-- ─── 7. Office Petty Cash Full Lifecycle Notifications ────────────────────────

CREATE OR REPLACE FUNCTION eflow_office_cash.command(p_office uuid, p_key uuid, p_action text, p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.profiles;
  f eflow_office_cash.funds;
  r eflow_office_cash.requests;
  old eflow_office_cash.commands;
  payload jsonb := jsonb_build_object('office', p_office, 'action', p_action, 'data', p_data);
  event_details jsonb := p_data;
  result jsonb;
  amt numeric;
  reserved numeric;
  outstanding numeric;
  total_spent numeric := 0;
  v_returned numeric := 0;
  v_refund_no text;
  v_refund_date date;
  v_has_indep_return boolean;
  v_head_fallback boolean := false;
  v_req_version integer;
  receipt jsonb;
  reference text;
  day date;
  path text;
BEGIN
  p := eflow_office_cash.actor(p_office);
  IF p_key IS NULL OR p_data IS NULL THEN
    RAISE EXCEPTION 'Command key and details required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p.id::text || p_key::text, 0));
  SELECT * INTO old FROM eflow_office_cash.commands WHERE actor = p.id AND key = p_key;
  IF FOUND THEN
    IF old.payload <> payload THEN
      RAISE EXCEPTION 'Retry must use the same details' USING ERRCODE = '22023';
    END IF;
    RETURN old.result;
  END IF;

  PERFORM eflow_office_cash.ensure_fund(p_office);
  SELECT * INTO f FROM eflow_office_cash.funds WHERE office = p_office FOR UPDATE;

  reference := btrim(COALESCE(p_data->>'reference', ''));
  IF length(reference) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Enter a purpose, decision reason or transaction reference' USING ERRCODE = '22023';
  END IF;

  day := COALESCE(NULLIF(p_data->>'date', '')::date, (now() AT TIME ZONE 'Asia/Manila')::date);
  IF day > (now() AT TIME ZONE 'Asia/Manila')::date THEN
    RAISE EXCEPTION 'Transaction date cannot be in the future' USING ERRCODE = '22023';
  END IF;

  SELECT
    COALESCE(sum(amount) FILTER (WHERE status IN ('pending', 'approved')), 0),
    COALESCE(sum(amount) FILTER (WHERE status IN ('released', 'receipt_review', 'receipt_approved')), 0)
  INTO reserved, outstanding
  FROM eflow_office_cash.requests
  WHERE office = p_office;

  IF p_action = 'replenish' THEN
    IF p.role <> 'accounting_staff' THEN
      RAISE EXCEPTION 'Only the Accounting Officer can replenish petty cash' USING ERRCODE = '42501';
    END IF;
    amt := (p_data->>'amount')::numeric;
    IF amt IS NULL OR amt <= 0 OR amt <> round(amt, 2) OR amt > 30000 - f.cash - outstanding THEN
      RAISE EXCEPTION 'Replenishment exceeds the available imprest capacity (outstanding advances cannot be replenished)' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM eflow_office_cash.events e
      WHERE e.office = p_office AND e.action = 'replenish' AND e.reference = reference
    ) THEN
      RAISE EXCEPTION 'This replenishment reference has already been recorded' USING ERRCODE = '22023';
    END IF;
    UPDATE eflow_office_cash.funds SET cash = cash + amt WHERE office = p_office;

  ELSIF p_action = 'request' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles reviewer
      WHERE reviewer.org_id = p_office
        AND reviewer.is_active
        AND reviewer.id <> p.id
        AND public.phase2_is_office_head(reviewer.id, p_office)
    ) THEN
      RAISE EXCEPTION 'An independent appointed Head is required to review your petty cash request' USING ERRCODE = '42501';
    END IF;
    amt := (p_data->>'amount')::numeric;
    IF amt IS NULL OR amt <= 0 OR amt <> round(amt, 2) OR amt > f.cash - reserved THEN
      RAISE EXCEPTION 'Insufficient office petty cash. Available: %', f.cash - reserved USING ERRCODE = '22023';
    END IF;
    INSERT INTO eflow_office_cash.requests(id, office, requester, purpose, amount)
    VALUES (p_key, p_office, p.id, reference, amt)
    RETURNING * INTO r;

    -- Notify Office Head of new Office Petty Cash request.
    INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
    SELECT o.head_user_id,
           'petty_cash_department_approval',
           'Office petty cash request needs approval',
           format('%s requested ₱%s from Office Petty Cash for "%s".', COALESCE(p.full_name, 'Staff'), to_char(amt, 'FM999,999,990.00'), r.purpose),
           p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
    FROM public.organizations o
    JOIN public.profiles h ON h.id = o.head_user_id
    WHERE o.id = p_office AND o.is_active AND h.is_active AND h.id IS DISTINCT FROM p.id;

  ELSE
    SELECT * INTO r
    FROM eflow_office_cash.requests
    WHERE id = (p_data->>'request')::uuid AND office = p_office
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Petty cash request not found' USING ERRCODE = 'P0002';
    END IF;
    amt := r.amount;

    IF p_action IN ('approve', 'reject', 'endorse', 'return_receipts') THEN
      IF NOT public.phase2_is_office_head(p.id, p_office) OR p.id = r.requester THEN
        RAISE EXCEPTION 'Independent appointed Head review required' USING ERRCODE = '42501';
      END IF;
      IF p_action IN ('approve', 'reject') AND r.status <> 'pending' THEN
        RAISE EXCEPTION 'Request is no longer pending' USING ERRCODE = '22023';
      END IF;
      IF p_action IN ('endorse', 'return_receipts') AND r.status <> 'receipt_review' THEN
        RAISE EXCEPTION 'Receipts are not awaiting review' USING ERRCODE = '22023';
      END IF;
      IF p_action = 'return_receipts' THEN
        UPDATE eflow_office_cash.requests
        SET status = 'released',
            cash_return_version = NULL,
            cash_return_received_by = NULL,
            cash_return_received_at = NULL,
            cash_return_receive_reference = NULL,
            cash_return_approved_by = NULL,
            cash_return_approved_at = NULL,
            cash_return_approval_note = NULL
        WHERE id = r.id;

        IF r.requester IS DISTINCT FROM p.id THEN
          INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)
          VALUES (
            r.requester,
            'petty_cash_liquidation_changes',
            'Office petty cash receipts need changes',
            format('%s returned receipts for "%s": %s', COALESCE(p.full_name, 'Office Head'), r.purpose, reference),
            p_office, p.id, COALESCE(p.full_name, ''), reference, r.id, 'office_petty_cash'
          );
        END IF;
      ELSE
        UPDATE eflow_office_cash.requests
        SET status = CASE p_action
          WHEN 'approve' THEN 'approved'
          WHEN 'reject' THEN 'rejected'
          ELSE 'receipt_approved'
        END
        WHERE id = r.id;

        IF p_action = 'approve' THEN
          IF r.requester IS DISTINCT FROM p.id THEN
            INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
            VALUES (
              r.requester,
              'petty_cash_decision',
              'Office petty cash approved',
              format('%s approved your ₱%s Office Petty Cash request for "%s". Waiting for Accounting release.', COALESCE(p.full_name, 'Office Head'), to_char(r.amount, 'FM999,999,990.00'), r.purpose),
              p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
            );
          END IF;

          INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
          SELECT acc.id,
                 'petty_cash_release_ready',
                 'Office petty cash approved — ready to release',
                 format('%s approved ₱%s for "%s". Open Office Petty Cash to release cash.', COALESCE(p.full_name, 'Office Head'), to_char(r.amount, 'FM999,999,990.00'), r.purpose),
                 p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
          FROM public.profiles acc
          WHERE acc.org_id = p_office AND acc.is_active AND acc.role::text = 'accounting_staff' AND acc.id IS DISTINCT FROM p.id;

        ELSIF p_action = 'reject' THEN
          IF r.requester IS DISTINCT FROM p.id THEN
            INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)
            VALUES (
              r.requester,
              'petty_cash_decision',
              'Office petty cash declined',
              format('%s declined your ₱%s Office Petty Cash request for "%s": %s', COALESCE(p.full_name, 'Office Head'), to_char(r.amount, 'FM999,999,990.00'), r.purpose, reference),
              p_office, p.id, COALESCE(p.full_name, ''), reference, r.id, 'office_petty_cash'
            );
          END IF;

        ELSIF p_action = 'endorse' THEN
          INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
          SELECT acc.id,
                 'petty_cash_liquidation_accounting_review',
                 'Office petty cash receipts endorsed — ready to settle',
                 format('%s endorsed receipts for "%s". Open Office Petty Cash to verify and settle.', COALESCE(p.full_name, 'Office Head'), r.purpose),
                 p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
          FROM public.profiles acc
          WHERE acc.org_id = p_office
            AND acc.is_active
            AND acc.role::text = 'accounting_staff'
            AND acc.id IS DISTINCT FROM r.requester
            AND acc.id IS DISTINCT FROM p.id;
        END IF;
      END IF;

    ELSIF p_action = 'cancel' THEN
      IF p.id <> r.requester OR r.status NOT IN ('pending', 'approved') THEN
        RAISE EXCEPTION 'Only the requester can cancel unreleased cash' USING ERRCODE = '42501';
      END IF;
      UPDATE eflow_office_cash.requests SET status = 'cancelled' WHERE id = r.id;

    ELSIF p_action = 'release' THEN
      IF p.role <> 'accounting_staff' THEN
        RAISE EXCEPTION 'Accounting Officer release required' USING ERRCODE = '42501';
      END IF;
      IF r.status <> 'approved' OR f.cash < r.amount THEN
        RAISE EXCEPTION 'Only approved, funded requests can be released' USING ERRCODE = '22023';
      END IF;
      UPDATE eflow_office_cash.funds SET cash = cash - r.amount WHERE office = p_office;
      UPDATE eflow_office_cash.requests
      SET status = 'released',
          released_at = now(),
          liquidation_due_at = now() + interval '15 days'
      WHERE id = r.id;

      IF r.requester IS DISTINCT FROM p.id THEN
        INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
        VALUES (
          r.requester,
          'petty_cash_released',
          'Office petty cash released',
          format('%s released ₱%s for "%s". Submit receipts within 15 days.', COALESCE(p.full_name, 'Accounting'), to_char(r.amount, 'FM999,999,990.00'), r.purpose),
          p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        );
      END IF;

    ELSIF p_action = 'receipts' THEN
      IF p.id <> r.requester OR r.status <> 'released' THEN
        RAISE EXCEPTION 'Only the recipient can submit receipts for released cash' USING ERRCODE = '42501';
      END IF;
      IF jsonb_typeof(p_data->'receipts') IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_data->'receipts') NOT BETWEEN 0 AND 30
      THEN
        RAISE EXCEPTION 'Add up to 30 receipts, or return the entire unspent advance' USING ERRCODE = '22023';
      END IF;

      FOR receipt IN SELECT * FROM jsonb_array_elements(p_data->'receipts') LOOP
        amt := (receipt->>'amount')::numeric;
        path := receipt->>'path';
        IF amt IS NULL OR amt <= 0 OR amt > 5000 OR amt <> round(amt, 2) THEN
          RAISE EXCEPTION 'Each receipt must be greater than zero and at most PHP 5,000' USING ERRCODE = '22023';
        END IF;
        IF length(btrim(COALESCE(receipt->>'number', ''))) NOT BETWEEN 1 AND 100
          OR length(btrim(COALESCE(receipt->>'vendor', ''))) NOT BETWEEN 1 AND 200
          OR NULLIF(receipt->>'date', '')::date IS NULL
          OR (receipt->>'date')::date > day
        THEN
          RAISE EXCEPTION 'Enter receipt vendor, number and valid date' USING ERRCODE = '22023';
        END IF;
        IF length(btrim(COALESCE(receipt->>'description', ''))) > 300 THEN
          RAISE EXCEPTION 'Receipt description must be 300 characters or less' USING ERRCODE = '22023';
        END IF;
        IF path IS NULL
          OR split_part(path, '/', 1) <> r.id::text
          OR NOT EXISTS (
            SELECT 1 FROM storage.objects
            WHERE bucket_id = 'office-petty-receipts'
              AND name = path
              AND owner_id = p.id::text
          )
        THEN
          RAISE EXCEPTION 'Upload a receipt file for this request' USING ERRCODE = '22023';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM eflow_office_cash.requests other
          CROSS JOIN LATERAL jsonb_array_elements(other.receipts) item
          WHERE other.office = p_office
            AND other.id <> r.id
            AND item->>'vendor' = receipt->>'vendor'
            AND item->>'number' = receipt->>'number'
            AND item->>'date' = receipt->>'date'
        ) THEN
          RAISE EXCEPTION 'This receipt is already recorded against another petty cash request' USING ERRCODE = '22023';
        END IF;
        total_spent := total_spent + amt;
      END LOOP;

      IF (SELECT count(DISTINCT value->>'path') FROM jsonb_array_elements(p_data->'receipts')) <> jsonb_array_length(p_data->'receipts')
        OR (SELECT count(DISTINCT (value->>'vendor', value->>'number', value->>'date')) FROM jsonb_array_elements(p_data->'receipts')) <> jsonb_array_length(p_data->'receipts')
      THEN
        RAISE EXCEPTION 'Duplicate receipt' USING ERRCODE = '22023';
      END IF;

      IF total_spent > r.amount THEN
        RAISE EXCEPTION 'Receipt total exceeds released petty cash' USING ERRCODE = '22023';
      END IF;

      v_returned := round(r.amount - total_spent, 2);
      IF v_returned > 0 THEN
        v_refund_no := btrim(COALESCE(p_data->>'refundReceiptNumber', ''));
        IF length(v_refund_no) NOT BETWEEN 1 AND 100 THEN
          RAISE EXCEPTION 'Enter the official refund receipt number for the unspent cash being returned' USING ERRCODE = '22023';
        END IF;
        v_refund_date := NULLIF(btrim(COALESCE(p_data->>'refundDate', '')), '')::date;
        IF v_refund_date IS NULL OR v_refund_date > day THEN
          RAISE EXCEPTION 'Enter a valid cash return date on or before the transaction date' USING ERRCODE = '22023';
        END IF;
      ELSE
        v_refund_no := NULL;
        v_refund_date := NULL;
      END IF;

      UPDATE eflow_office_cash.requests
      SET receipts = p_data->'receipts',
          spent = total_spent,
          returned_amount = v_returned,
          refund_receipt_number = v_refund_no,
          refund_date = v_refund_date,
          liquidation_note = reference,
          receipt_version = COALESCE(receipt_version, 0) + 1,
          cash_return_version = NULL,
          cash_return_received_by = NULL,
          cash_return_received_at = NULL,
          cash_return_receive_reference = NULL,
          cash_return_approved_by = NULL,
          cash_return_approved_at = NULL,
          cash_return_approval_note = NULL,
          status = 'receipt_review'
      WHERE id = r.id;

      -- Notify Office Head to endorse submitted Office Petty Cash receipts.
      INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
      SELECT o.head_user_id,
             'petty_cash_liquidation_department_review',
             'Office petty cash receipts ready for endorsement',
             format('%s submitted receipts totaling ₱%s for "%s".', COALESCE(p.full_name, 'Staff'), to_char(total_spent, 'FM999,999,990.00'), r.purpose),
             p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
      FROM public.organizations o
      JOIN public.profiles h ON h.id = o.head_user_id
      WHERE o.id = p_office AND o.is_active AND h.is_active AND h.id IS DISTINCT FROM p.id;

      event_details := p_data || jsonb_build_object(
        'spent', total_spent,
        'returnedAmount', v_returned,
        'refundReceiptNumber', v_refund_no,
        'refundDate', v_refund_date
      );
      amt := total_spent;

    ELSIF p_action = 'acknowledge_return' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status NOT IN ('receipt_review', 'receipt_approved') THEN
        RAISE EXCEPTION 'Cash return can only be acknowledged after receipts are submitted' USING ERRCODE = '22023';
      END IF;
      IF COALESCE(r.returned_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'This request has no unspent cash to return' USING ERRCODE = '22023';
      END IF;
      IF p_data ? 'receiptVersion' AND NULLIF(p_data->>'receiptVersion', '') IS NOT NULL THEN
        v_req_version := (p_data->>'receiptVersion')::integer;
        IF v_req_version IS DISTINCT FROM r.receipt_version THEN
          RAISE EXCEPTION 'The receipt package changed. Refresh and verify the current return amount.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NOT eflow_office_cash.is_independent_return_receiver(r, p.id) THEN
        RAISE EXCEPTION 'An independent Accounting Officer must acknowledge physical receipt of returned cash' USING ERRCODE = '42501';
      END IF;
      IF r.cash_return_version IS NOT DISTINCT FROM r.receipt_version AND r.cash_return_received_at IS NOT NULL THEN
        RAISE EXCEPTION 'This cash return was already acknowledged by Accounting' USING ERRCODE = '22023';
      END IF;

      UPDATE eflow_office_cash.requests
      SET cash_return_version = r.receipt_version,
          cash_return_received_by = p.id,
          cash_return_received_at = now(),
          cash_return_receive_reference = reference,
          cash_return_approved_by = NULL,
          cash_return_approved_at = NULL,
          cash_return_approval_note = NULL
      WHERE id = r.id;

      INSERT INTO public.notifications(
        user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type
      )
      SELECT
        o.head_user_id,
        'petty_cash_return_received',
        'Office petty cash return received — Head approval required',
        format(
          '%s acknowledged physical receipt of PHP %s for "%s". Approve the cash return before settlement.',
          COALESCE(p.full_name, 'Accounting'),
          to_char(r.returned_amount, 'FM999,999,990.00'),
          r.purpose
        ),
        p_office,
        p.id,
        COALESCE(p.full_name, ''),
        r.id,
        'office_petty_cash'
      FROM public.organizations o
      JOIN public.profiles h ON h.id = o.head_user_id
      WHERE o.id = p_office
        AND o.is_active
        AND h.is_active
        AND h.org_id = o.id
        AND h.role = 'head'
        AND h.id IS DISTINCT FROM p.id
        AND h.id IS DISTINCT FROM r.requester;

      event_details := p_data || jsonb_build_object(
        'returnedAmount', r.returned_amount,
        'receiptVersion', r.receipt_version
      );
      amt := r.returned_amount;

    ELSIF p_action = 'approve_return' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status NOT IN ('receipt_review', 'receipt_approved') THEN
        RAISE EXCEPTION 'Cash return can only be approved after receipts are submitted' USING ERRCODE = '22023';
      END IF;
      IF COALESCE(r.returned_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'This request has no unspent cash to return' USING ERRCODE = '22023';
      END IF;
      IF p_data ? 'receiptVersion' AND NULLIF(p_data->>'receiptVersion', '') IS NOT NULL THEN
        v_req_version := (p_data->>'receiptVersion')::integer;
        IF v_req_version IS DISTINCT FROM r.receipt_version THEN
          RAISE EXCEPTION 'The receipt package changed. Refresh and verify the current return amount.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NOT public.phase2_is_office_head(p.id, p_office) OR p.id = r.requester THEN
        RAISE EXCEPTION 'Independent appointed Office Head approval is required for returned cash' USING ERRCODE = '42501';
      END IF;
      IF r.cash_return_version IS NOT DISTINCT FROM r.receipt_version AND r.cash_return_approved_at IS NOT NULL THEN
        RAISE EXCEPTION 'This cash return was already approved by the Office Head' USING ERRCODE = '22023';
      END IF;

      v_has_indep_return := eflow_office_cash.has_independent_return_receiver(r);
      IF v_has_indep_return THEN
        IF r.cash_return_version IS DISTINCT FROM r.receipt_version
          OR r.cash_return_received_at IS NULL
          OR r.cash_return_received_by IS NULL
        THEN
          RAISE EXCEPTION 'Accounting must acknowledge physical receipt of the returned cash before Head approval' USING ERRCODE = '22023';
        END IF;
        IF p.id = r.cash_return_received_by THEN
          RAISE EXCEPTION 'A separate Office Head must approve the cash return' USING ERRCODE = '42501';
        END IF;

        UPDATE eflow_office_cash.requests
        SET cash_return_approved_by = p.id,
            cash_return_approved_at = now(),
            cash_return_approval_note = reference
        WHERE id = r.id;
      ELSE
        v_head_fallback := true;
        UPDATE eflow_office_cash.requests
        SET cash_return_version = r.receipt_version,
            cash_return_received_by = COALESCE(
              CASE WHEN cash_return_version IS NOT DISTINCT FROM r.receipt_version THEN cash_return_received_by END,
              p.id
            ),
            cash_return_received_at = COALESCE(
              CASE WHEN cash_return_version IS NOT DISTINCT FROM r.receipt_version THEN cash_return_received_at END,
              now()
            ),
            cash_return_receive_reference = COALESCE(
              CASE WHEN cash_return_version IS NOT DISTINCT FROM r.receipt_version THEN cash_return_receive_reference END,
              'Head fallback receipt: ' || reference
            ),
            cash_return_approved_by = p.id,
            cash_return_approved_at = now(),
            cash_return_approval_note = reference
        WHERE id = r.id;
      END IF;

      IF r.status = 'receipt_approved' THEN
        PERFORM eflow_office_cash.notify_blocked_settlements(r.id);
      END IF;

      INSERT INTO public.notifications(
        user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type
      )
      SELECT
        acc.id,
        'petty_cash_return_approved',
        'Office petty cash return approved — ready to settle',
        format(
          '%s approved the PHP %s cash return for "%s". Settlement can now proceed.',
          COALESCE(p.full_name, 'Office Head'),
          to_char(r.returned_amount, 'FM999,999,990.00'),
          r.purpose
        ),
        p_office,
        p.id,
        COALESCE(p.full_name, ''),
        r.id,
        'office_petty_cash'
      FROM public.profiles acc
      WHERE acc.org_id = p_office
        AND acc.is_active
        AND acc.role = 'accounting_staff'
        AND acc.id IS DISTINCT FROM r.requester
        AND acc.id IS DISTINCT FROM p.id;

      event_details := p_data || jsonb_build_object(
        'returnedAmount', r.returned_amount,
        'receiptVersion', r.receipt_version,
        'headFallback', v_head_fallback
      );
      amt := r.returned_amount;

    ELSIF p_action = 'settle' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status <> 'receipt_approved' THEN
        RAISE EXCEPTION 'Independent receipt endorsement required before settlement' USING ERRCODE = '22023';
      END IF;
      IF NOT eflow_office_cash.is_independent_settler(r, p.id) THEN
        IF eflow_office_cash.head_can_fallback_settle(r, p.id) THEN
          v_head_fallback := true;
        ELSE
          RAISE EXCEPTION 'A separate Accounting Officer must settle this request' USING ERRCODE = '42501';
        END IF;
      END IF;
      IF COALESCE(r.returned_amount, 0) > 0 AND NOT eflow_office_cash.cash_return_cleared(r) THEN
        RAISE EXCEPTION 'Accounting must acknowledge the exact cash return and an independent Office Head must approve it before settlement' USING ERRCODE = '42501';
      END IF;

      UPDATE eflow_office_cash.funds SET cash = cash + (r.amount - r.spent) WHERE office = p_office;
      UPDATE eflow_office_cash.requests SET status = 'settled' WHERE id = r.id;

      IF r.requester IS DISTINCT FROM p.id THEN
        INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
        VALUES (
          r.requester,
          'petty_cash_liquidation_decision',
          'Office petty cash settled',
          format('%s verified and settled your Office Petty Cash receipts for "%s".', COALESCE(p.full_name, 'Accounting'), r.purpose),
          p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        );
      END IF;

      event_details := p_data || jsonb_build_object(
        'spent', r.spent,
        'returnedAmount', r.returned_amount,
        'refundReceiptNumber', r.refund_receipt_number,
        'headFallback', v_head_fallback
      );
      amt := r.spent;

    ELSE
      RAISE EXCEPTION 'Unknown petty cash action' USING ERRCODE = '22023';
    END IF;

    UPDATE eflow_office_cash.requests SET updated_at = clock_timestamp() WHERE id = r.id;
  END IF;

  INSERT INTO eflow_office_cash.events(office, request, actor, action, amount, reference, occurred_on, details)
  VALUES (p_office, r.id, p.id, p_action, amt, reference, day, event_details);

  result := jsonb_build_object('request', r.id, 'saved', true);
  INSERT INTO eflow_office_cash.commands VALUES (p.id, p_key, payload, result);
  RETURN result;
END;
$function$;

-- ─── 8. Populate project_id & org_id on Project Office Invitation Notices ────

CREATE OR REPLACE FUNCTION eflow_phase65.accept_local(p_hash text, p_user uuid, p_name text, p_claim uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  inv public.user_invitations;
  i public.project_office_identities;
  p public.projects;
  u public.profiles;
  email text;
BEGIN
  SELECT * INTO inv FROM public.user_invitations WHERE token_hash = p_hash FOR UPDATE;
  SELECT lower(btrim(a.email)) INTO email FROM auth.users a WHERE id = p_user AND email_confirmed_at IS NOT NULL;
  IF email IS NULL OR email IS DISTINCT FROM inv.email_normalized THEN RAISE EXCEPTION 'Sign in with the invited verified email' USING ERRCODE = '42501'; END IF;
  IF inv.status = 'accepted' AND inv.accepted_by = p_user THEN SELECT * INTO u FROM public.profiles WHERE id = p_user; RETURN u; END IF;
  SELECT * INTO i FROM public.project_office_identities WHERE id = inv.project_office_identity_id FOR UPDATE;
  p := eflow_phase65.require_lead(i.project_id, inv.invited_by);
  IF inv.invitation_type <> 'project_office_identity' OR inv.office_id <> p.org_id OR inv.status <> 'pending' OR inv.expires_at <= now() OR i.canonical_office_id IS NOT NULL OR i.contact_status <> 'invited' THEN
    RAISE EXCEPTION 'Invitation expired, revoked, or invalid' USING ERRCODE = '22023';
  END IF;
  IF inv.acceptance_claim IS NOT NULL AND inv.acceptance_claim IS DISTINCT FROM p_claim AND inv.acceptance_claimed_at > now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'Acceptance is already in progress' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('phase2-user:' || p_user::text, 0));
  SELECT * INTO u FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF FOUND THEN
    IF u.is_active IS DISTINCT FROM true OR u.role = 'admin' THEN RAISE EXCEPTION 'This identity requires Admin resolution' USING ERRCODE = '42501'; END IF;
  ELSE
    IF length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Enter your full name' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.profiles(id, full_name, email, employee_id, role, is_active)
    VALUES (p_user, btrim(p_name), email, 'INV-' || p_user::text, 'member', true)
    RETURNING * INTO u;
  END IF;
  UPDATE public.project_office_identities SET contact_user_id = p_user, contact_status = 'accepted', updated_at = now() WHERE id = i.id;
  UPDATE public.user_invitations SET status = 'accepted', accepted_by = p_user, accepted_at = now(), acceptance_claim = NULL, acceptance_claimed_at = NULL, updated_at = now() WHERE id = inv.id;
  PERFORM public.phase2_audit(p_user, inv.office_id, inv.id, 'project_local_office_invitation_accepted');
  INSERT INTO public.notifications(user_id, type, title, message, project_id, org_id, actor_id, actor_name)
  VALUES (inv.invited_by, 'project_office_invitation', 'Office contact accepted', u.full_name || ' accepted. Directory linking and Office Head confirmation remain required.', p.id, p.org_id, p_user, u.full_name);
  RETURN u;
END;
$function$;

CREATE OR REPLACE FUNCTION public.phase6_accept_invitation(p_hash text, p_user uuid, p_name text, p_claim uuid DEFAULT NULL::uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  i public.user_invitations;
  o public.project_offices;
  p public.projects;
  profile public.profiles;
  email text;
  joined boolean;
BEGIN
  SELECT * INTO i FROM public.user_invitations WHERE token_hash = p_hash FOR UPDATE;
  IF i.id IS NULL OR i.invitation_type <> 'project_office' THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE = '22023'; END IF;
  SELECT lower(btrim(u.email)) INTO email FROM auth.users u WHERE id = p_user AND email_confirmed_at IS NOT NULL;
  IF email IS NULL OR email <> i.email_normalized THEN RAISE EXCEPTION 'Sign in with the invited verified email' USING ERRCODE = '42501'; END IF;
  IF i.status = 'accepted' AND i.accepted_by = p_user THEN SELECT * INTO profile FROM public.profiles WHERE id = p_user; RETURN profile; END IF;
  SELECT * INTO o FROM public.project_offices WHERE id = i.project_office_id FOR UPDATE;
  SELECT * INTO p FROM public.projects WHERE id = o.project_id;
  IF i.status <> 'pending' OR i.expires_at <= now() OR p.status IN ('completed', 'archived') OR o.invitation_status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation expired, revoked, or invalid' USING ERRCODE = '22023';
  END IF;
  IF NOT public.phase2_is_office_head(i.invited_by, p.org_id) OR i.office_id <> p.org_id THEN
    RAISE EXCEPTION 'Inviter no longer leads this Office' USING ERRCODE = '42501';
  END IF;
  IF i.acceptance_claim IS NOT NULL AND i.acceptance_claim IS DISTINCT FROM p_claim AND i.acceptance_claimed_at > now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'Acceptance is already in progress' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('phase2-user:' || p_user::text, 0));
  SELECT * INTO profile FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF FOUND THEN
    IF NOT profile.is_active OR profile.role = 'admin' OR profile.org_id IS NOT NULL AND profile.org_id <> o.office_id THEN
      RAISE EXCEPTION 'This identity requires Admin resolution: another Office' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF length(btrim(p_name)) NOT BETWEEN 2 AND 160 THEN RAISE EXCEPTION 'Enter your full name' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.profiles(id, full_name, email, employee_id, role, is_active)
    VALUES (p_user, btrim(p_name), email, 'INV-' || p_user::text, 'member', true)
    RETURNING * INTO profile;
  END IF;
  joined := o.relationship_type = 'observer' OR public.phase2_is_office_head(p_user, o.office_id);
  UPDATE public.project_offices
  SET contact_user_id = p_user,
      invitation_status = CASE WHEN joined THEN 'joined' ELSE 'awaiting_head' END,
      joined_at = CASE WHEN joined THEN now() END,
      updated_at = now()
  WHERE id = o.id;
  UPDATE public.user_invitations
  SET status = 'accepted', accepted_by = p_user, accepted_at = now(), acceptance_claim = NULL, acceptance_claimed_at = NULL, updated_at = now()
  WHERE id = i.id;
  PERFORM public.phase2_audit(p_user, i.office_id, i.id, 'project_office_invitation_accepted');
  INSERT INTO public.notifications(user_id, type, title, message, project_id, org_id, actor_id, actor_name)
  VALUES (i.invited_by, 'project_office_invitation', 'Office invitation accepted', profile.full_name || ' accepted the project invitation.', p.id, p.org_id, p_user, profile.full_name);
  RETURN profile;
END;
$function$;
