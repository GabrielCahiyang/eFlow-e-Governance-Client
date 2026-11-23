-- Unified Project Status & Non-Head Approval + Explicit Activation Scheduling:
-- 1. Adds `project_approval_status` (and audit columns) on `public.projects` so non-Head created
--    projects with `funding_not_required = true` also go through Office Head approval
--    (`Pending approval` -> `Waiting for activation`).
-- 2. Adds `activation_scheduled_at` / `activation_scheduled_by` on `public.projects` so approval
--    NEVER silently auto-activates a project (even if `start_date <= today` in PHT).
--    Automatic 12:00 AM PHT activation via `pg_cron` ONLY runs when an authorized manager
--    explicitly schedules activation for a future `start_date`.
-- 3. Allows Office Head, Project Lead, or Project Creator to activate or schedule activation
--    once all approvals and readiness checks pass.

-- ─── 1. Non-destructive columns & partial indexes on public.projects ──────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_approval_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS project_approval_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_approval_feedback text,
  ADD COLUMN IF NOT EXISTS activation_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_scheduled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_project_approval_status_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_project_approval_status_check
      CHECK (project_approval_status IN ('not_required', 'pending_head', 'approved', 'rejected'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_projects_explicit_scheduled_activation
  ON public.projects (start_date)
  WHERE status IN ('planning', 'on_hold')
    AND start_date IS NOT NULL
    AND activation_scheduled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_pending_head_approval
  ON public.projects (org_id, project_approval_requested_at DESC)
  WHERE project_approval_status = 'pending_head'
    AND status = 'planning';

-- ─── 2. Guard new approval & activation schedule columns in guard_definition ──

CREATE OR REPLACE FUNCTION eflow_project.guard_definition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF new.funding_approval_status IS DISTINCT FROM old.funding_approval_status
     AND pg_catalog.current_setting('eflow.syncing_funding_approval_status', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Funding approval status is managed automatically by funding workflows' USING ERRCODE = '42501';
  END IF;

  IF ROW(
       new.project_approval_status,
       new.project_approval_requested_by,
       new.project_approval_requested_at,
       new.project_approved_by,
       new.project_approved_at,
       new.project_approval_feedback
     ) IS DISTINCT FROM ROW(
       old.project_approval_status,
       old.project_approval_requested_by,
       old.project_approval_requested_at,
       old.project_approved_by,
       old.project_approved_at,
       old.project_approval_feedback
     )
     AND pg_catalog.current_setting('eflow.updating_project_approval', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Use the project approval workflow to update project approval status' USING ERRCODE = '42501';
  END IF;

  IF ROW(new.activation_scheduled_at, new.activation_scheduled_by)
     IS DISTINCT FROM ROW(old.activation_scheduled_at, old.activation_scheduled_by)
     AND pg_catalog.current_setting('eflow.updating_activation_schedule', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Use the project activation workflow to schedule or cancel activation' USING ERRCODE = '42501';
  END IF;

  IF ROW(
       new.completion_review_status,
       new.completion_requested_by,
       new.completion_requested_at,
       new.completion_request_note,
       new.completion_review_feedback,
       new.completion_reviewed_by,
       new.completion_reviewed_at
     ) IS DISTINCT FROM ROW(
       old.completion_review_status,
       old.completion_requested_by,
       old.completion_requested_at,
       old.completion_request_note,
       old.completion_review_feedback,
       old.completion_reviewed_by,
       old.completion_reviewed_at
     )
     AND pg_catalog.current_setting('eflow.updating_completion_review', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Use the project completion review workflow to update completion approval status' USING ERRCODE = '42501';
  END IF;

  IF new.status = 'completed' AND old.status IS DISTINCT FROM new.status
     AND NOT public.phase2_is_office_head(auth.uid(), new.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Head can approve project completion' USING ERRCODE = '42501';
  END IF;

  IF ROW(new.scope, new.project_lead_id, new.funding_not_required, new.setup_completed_at)
     IS DISTINCT FROM ROW(old.scope, old.project_lead_id, old.funding_not_required, old.setup_completed_at) THEN
    IF NOT (
      pg_catalog.current_setting('eflow.certifying_project_funding', true) = '1'
      AND ROW(new.scope, new.project_lead_id, new.setup_completed_at)
          IS NOT DISTINCT FROM ROW(old.scope, old.project_lead_id, old.setup_completed_at)
      AND new.funding_not_required = false
    ) THEN
      IF auth.uid() IS NULL OR NOT public.can_configure_project(old.id, auth.uid()) THEN
        RAISE EXCEPTION 'Only the Office Head or owning project creator may authorize project setup' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF old.status IN ('completed', 'archived') THEN
      RAISE EXCEPTION 'Closed project setup is read-only' USING ERRCODE = '23514';
    END IF;
    IF new.project_lead_id IS DISTINCT FROM old.project_lead_id
       AND EXISTS (SELECT 1 FROM public.tasks WHERE linked_project_id = old.id AND status = 'for_review' AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Resolve pending task reviews before changing the project lead' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF new.funding_not_required AND EXISTS (
    SELECT 1 FROM eflow_project.funding WHERE project_id = new.id AND amount > 0
  ) THEN
    RAISE EXCEPTION 'Release existing project funding before declaring no funding required' USING ERRCODE = '23514';
  END IF;

  IF new.funding_not_required AND EXISTS (
    SELECT 1 FROM eflow_project.funding_requests WHERE project_id = new.id AND status IN ('pending', 'pending_accounting')
  ) THEN
    RAISE EXCEPTION 'Cancel or resolve open funding requests before declaring no funding required' USING ERRCODE = '23514';
  END IF;

  RETURN new;
END;
$function$;

-- ─── 3. Non-Head Approval Enforcement in finish_setup, save_details, decide_funding, certify_funding ─

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

  -- Non-Head created projects with "No funding required" must still go through Office Head approval
  -- (`Pending approval` -> `Waiting for activation`). Never auto-activate.
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
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        v_head_id,
        'project_approval_request',
        'Project approval required',
        v_actor_name || ' submitted "' || p.title || '" (no funding required) for Office Head approval.',
        p.id,
        p.org_id,
        auth.uid(),
        v_actor_name
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

  -- Clear any previously scheduled activation if material dates, scope, or funding mode changed.
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

  -- Switching a non-Head project to No funding required after setup still requires Head approval.
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
      SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;
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
    END IF;
  END IF;

  RETURN p;
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

    -- Head endorsement satisfies Head-level approval for non-Head created projects too.
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

    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    SELECT acc.id,
           'project_funding_certification',
           'Project funding certification needed',
           v_head_name || ' endorsed ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
           p.id, p.org_id, auth.uid(), v_head_name
    FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id NOT IN (r.actor_id, auth.uid())
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id;

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

    IF r.actor_id <> auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        r.actor_id, 'project_funding_decided', 'Project funding request declined',
        v_head_name || ' declined the funding request for "' || p.title || '": ' || btrim(p_reason),
        p.id, p.org_id, auth.uid(), v_head_name
      );
    END IF;

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

    -- Explicitly keep activation manual (`Waiting for activation`) after funding certification.
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
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding certified',
        v_actor_name || ' certified ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". The project is now Waiting for activation.',
        p.id, p.org_id, v_actor, v_actor_name
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
      INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
      VALUES (
        v_notify_id, 'project_funding_decided', 'Project funding certification declined',
        v_actor_name || ' declined funding certification for "' || p.title || '": ' || btrim(p_reason),
        p.id, p.org_id, v_actor, v_actor_name
      );
    END LOOP;

    RETURN jsonb_build_object('status', 'rejected', 'authorized', 0);
  END IF;
END;
$function$;

-- ─── 4. Non-Head Project Approval RPCs ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.decide_non_head_project_approval(
  p_project uuid,
  p_approve boolean,
  p_feedback text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_uid uuid := auth.uid();
  v_head_name text;
  v_notify_id uuid;
  v_clean_feedback text := btrim(COALESCE(p_feedback, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.phase2_is_office_head(v_uid, p.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Office Head can approve or decline this project' USING ERRCODE = '42501';
  END IF;
  IF p.status <> 'planning' THEN
    RAISE EXCEPTION 'Only planning projects can undergo initial approval' USING ERRCODE = '23514';
  END IF;
  IF p.project_approval_status <> 'pending_head' THEN
    RAISE EXCEPTION 'This project is not awaiting Office Head approval' USING ERRCODE = '23514';
  END IF;
  IF NOT p_approve AND v_clean_feedback = '' THEN
    RAISE EXCEPTION 'Enter feedback explaining why this project was returned or declined' USING ERRCODE = '23514';
  END IF;
  IF char_length(v_clean_feedback) > 2000 THEN
    RAISE EXCEPTION 'Approval feedback may contain up to 2,000 characters' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_head_name FROM public.profiles WHERE id = v_uid;

  PERFORM pg_catalog.set_config('eflow.updating_project_approval', '1', true);
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
  UPDATE public.projects
  SET project_approval_status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      project_approved_by = v_uid,
      project_approved_at = now(),
      project_approval_feedback = NULLIF(v_clean_feedback, ''),
      activation_scheduled_at = NULL,
      activation_scheduled_by = NULL,
      updated_at = now()
  WHERE id = p.id
  RETURNING * INTO p;
  PERFORM pg_catalog.set_config('eflow.updating_project_approval', '', true);
  PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (
    v_uid,
    'project',
    p.id::text,
    CASE WHEN p_approve THEN 'project.head_approved' ELSE 'project.head_approval_declined' END,
    p.org_id,
    jsonb_build_object('projectApprovalStatus', p.project_approval_status, 'status', p.status),
    NULLIF(v_clean_feedback, '')
  );

  FOR v_notify_id IN
    SELECT DISTINCT uid FROM unnest(ARRAY[p.created_by, p.owner_id, p.project_lead_id, p.project_approval_requested_by]) uid
    WHERE uid IS NOT NULL AND uid <> v_uid
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_notify_id,
      'status_change',
      CASE WHEN p_approve THEN 'Project approved — waiting for activation' ELSE 'Project approval returned' END,
      CASE
        WHEN p_approve THEN v_head_name || ' approved "' || p.title || '". Status is now Waiting for activation.'
        ELSE v_head_name || ' returned "' || p.title || '" for revisions: ' || v_clean_feedback
      END,
      p.id,
      p.org_id,
      v_uid,
      v_head_name
    );
  END LOOP;

  RETURN jsonb_build_object(
    'projectId', p.id,
    'status', p.status,
    'projectApprovalStatus', p.project_approval_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.decide_non_head_project_approval(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_non_head_project_approval(uuid, boolean, text) TO authenticated;

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
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_head_id,
      'project_approval_request',
      'Project resubmitted for approval',
      v_actor_name || ' resubmitted "' || p.title || '" for Office Head approval.',
      p.id,
      p.org_id,
      v_uid,
      v_actor_name
    );
  END IF;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id)
  VALUES (v_uid, 'project', p.id::text, 'project.head_approval_resubmitted', p.org_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.resubmit_project_for_head_approval(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resubmit_project_for_head_approval(uuid) TO authenticated;

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
        'description', p.description,
        'scope', p.scope,
        'orgId', p.org_id,
        'startDate', p.start_date,
        'targetDate', p.target_date,
        'fundingNotRequired', p.funding_not_required,
        'requestedBy', p.project_approval_requested_by,
        'requestedByName', COALESCE(req_p.full_name, creator_p.full_name, 'Staff'),
        'requestedAt', p.project_approval_requested_at,
        'projectLeadId', p.project_lead_id,
        'projectLeadName', COALESCE(lead_p.full_name, 'Assigned project lead')
      )
      ORDER BY p.project_approval_requested_at DESC NULLS LAST, p.created_at DESC
    )
    FROM public.projects p
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

-- ─── 5. Updated Readiness, Activation, Explicit Scheduling & Guards ───────────

CREATE OR REPLACE FUNCTION eflow_phase65.baseline_readiness(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  checks jsonb := '[]';
  k text;
  label text;
  n int;
  good boolean;
  governed boolean;
  v_has_funding boolean;
  v_pending_head boolean;
  v_pending_accounting boolean;
  v_needs_head_project_approval boolean;
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_start_reached boolean;
  v_ready_except_start boolean;
  v_is_scheduled boolean;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;
  governed := p.source_collaboration_draft_id IS NOT NULL;

  FOREACH k IN ARRAY ARRAY['structure', 'dates', 'budget'] LOOP
    label := CASE k
      WHEN 'structure' THEN 'Project structure reviewed'
      WHEN 'dates' THEN 'Project dates confirmed'
      ELSE 'Budget information reviewed'
    END;
    good := governed OR EXISTS (
      SELECT 1 FROM public.project_readiness_reviews r
      WHERE r.project_id = p.id
        AND r.review_kind = k
        AND r.fingerprint = eflow_phase7.fingerprint(p.id, k)
        AND (public.can_configure_project(p.id, r.reviewed_by) OR eflow_project.lead(p.id, r.reviewed_by))
    );
    checks := checks || jsonb_build_array(jsonb_build_object(
      'key', k,
      'label', label,
      'ok', good,
      'detail', CASE
        WHEN governed THEN 'Use the existing proposal governance review.'
        WHEN good THEN 'Current revision reviewed.'
        ELSE 'Project review is needed for this revision.'
      END
    ));
  END LOOP;

  -- Non-Head Office Head approval check (for non-Head no-funding projects).
  v_needs_head_project_approval := (NOT governed AND p.project_approval_status IN ('pending_head', 'rejected'));
  IF NOT governed AND p.project_approval_status <> 'not_required' THEN
    checks := checks || jsonb_build_array(jsonb_build_object(
      'key', 'head_project_approval',
      'label', 'Office Head project approval',
      'ok', p.project_approval_status = 'approved',
      'detail', CASE
        WHEN p.project_approval_status = 'approved' THEN 'Approved by the Office Head. Ready for activation once start date and checks are complete.'
        WHEN p.project_approval_status = 'rejected' THEN COALESCE('Returned by Office Head: ' || NULLIF(p.project_approval_feedback, ''), 'Returned by Office Head for revisions before activation.')
        ELSE 'Pending Office Head approval before this project can move to Waiting for activation.'
      END
    ));
  END IF;

  -- Dual approval funding certification check (Office Head endorsement + independent Accounting Staff certification).
  v_has_funding := EXISTS (
    SELECT 1 FROM eflow_project.funding f
    JOIN public.budget_commitments c ON c.id = f.commitment_id
    WHERE f.project_id = p.id AND f.amount > 0 AND c.status = 'active'
  );
  v_pending_head := EXISTS (
    SELECT 1 FROM eflow_project.funding_requests fr
    WHERE fr.project_id = p.id AND fr.status = 'pending'
  );
  v_pending_accounting := EXISTS (
    SELECT 1 FROM eflow_project.funding_requests fr
    WHERE fr.project_id = p.id AND fr.status = 'pending_accounting'
  );
  good := governed OR p.funding_not_required OR (v_has_funding AND NOT v_pending_head AND NOT v_pending_accounting);
  checks := checks || jsonb_build_array(jsonb_build_object(
    'key', 'funding_certification',
    'label', 'Project funding certified',
    'ok', good,
    'detail', CASE
      WHEN governed THEN 'Use the existing proposal governance review.'
      WHEN p.funding_not_required THEN 'No funding required for this project.'
      WHEN v_pending_head THEN 'Pending Office Head endorsement and independent Accounting Staff certification before activation.'
      WHEN v_pending_accounting THEN 'Endorsed by Office Head; awaiting independent Accounting Staff certification before activation.'
      WHEN v_has_funding THEN 'Project funding approved by Office Head and certified by Accounting Staff.'
      ELSE 'Submit project funding for Office Head and Accounting Staff approval, or choose No funding required.'
    END
  ));

  SELECT count(*) INTO n FROM public.tasks WHERE linked_project_id = p.id AND deleted_at IS NULL AND status <> 'cancelled';
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'work', 'label', 'Delivery work exists', 'ok', n > 0, 'detail', n || ' required tasks'));

  good := p.start_date IS NOT NULL AND p.target_date IS NOT NULL AND p.target_date >= p.start_date;
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'schedule', 'label', 'Project schedule is valid', 'ok', good, 'detail', 'Set both project dates in the Timeline view.'));

  v_start_reached := p.start_date IS NOT NULL AND p.start_date <= v_today_manila;
  checks := checks || jsonb_build_array(jsonb_build_object(
    'key', 'start_date_reached',
    'label', 'Project start date reached',
    'ok', v_start_reached,
    'detail', CASE
      WHEN p.start_date IS NULL THEN 'Set a project start date before activating.'
      WHEN p.start_date > v_today_manila AND p.activation_scheduled_at IS NOT NULL THEN 'Scheduled to activate automatically on ' || to_char(p.start_date, 'MM/DD/YYYY') || ' at 12:00 AM (Philippine Time).'
      WHEN p.start_date > v_today_manila THEN 'Start date is ' || to_char(p.start_date, 'MM/DD/YYYY') || ' (Philippine Time). Activate on that date or schedule automatic start-date activation.'
      ELSE 'Project start date (' || to_char(p.start_date, 'MM/DD/YYYY') || ') has been reached.'
    END
  ));

  SELECT count(*) INTO n FROM public.project_offices WHERE project_id = p.id AND invitation_status IN ('pending', 'awaiting_head');
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'invitations', 'label', 'Office invitations accepted', 'ok', n = 0, 'detail', n || ' Offices awaiting acceptance or Head confirmation'));

  SELECT count(*) INTO n FROM public.tasks t
  WHERE t.linked_project_id = p.id AND t.deleted_at IS NULL AND t.status <> 'cancelled'
    AND (t.org_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.project_offices o
      WHERE o.project_id = p.id AND o.office_id = t.org_id AND o.invitation_status = 'joined' AND o.relationship_type IN ('lead', 'collaborating')
    ));
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'responsibilities', 'label', 'Responsible Offices confirmed', 'ok', governed OR n = 0, 'detail', n || ' tasks need a joined responsible Office'));

  SELECT count(*) INTO n FROM public.tasks t
  WHERE t.linked_project_id = p.id AND t.deleted_at IS NULL AND t.status NOT IN ('completed', 'cancelled')
    AND (
      t.assigned_to IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.profiles u WHERE u.id = t.assigned_to AND u.is_active AND u.org_id = t.org_id AND u.role::text <> 'admin')
      OR (
        NOT governed AND NOT EXISTS (
          SELECT 1 FROM public.project_offices o
          WHERE o.project_id = p.id AND o.office_id = t.org_id AND o.invitation_status = 'joined' AND o.relationship_type IN ('lead', 'collaborating')
            AND (o.relationship_type = 'lead' OR public.phase2_is_office_head(t.assigned_to, t.org_id) OR EXISTS (
              SELECT 1 FROM public.project_office_members m WHERE m.project_office_id = o.id AND m.user_id = t.assigned_to
            ))
        )
      )
    );
  checks := checks || jsonb_build_array(jsonb_build_object('key', 'staffing', 'label', 'Required task owners assigned', 'ok', n = 0, 'detail', n || ' tasks need eligible owners selected by their own Office'));

  good := NOT EXISTS (SELECT 1 FROM jsonb_array_elements(checks) c WHERE NOT (c->>'ok')::boolean);
  v_ready_except_start := NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(checks) c
    WHERE c->>'key' <> 'start_date_reached' AND NOT (c->>'ok')::boolean
  );
  v_is_scheduled := (
    p.activation_scheduled_at IS NOT NULL
    AND v_ready_except_start
    AND NOT v_start_reached
    AND p.start_date IS NOT NULL
    AND p.status IN ('planning', 'on_hold')
  );

  RETURN jsonb_build_object(
    'projectId', p.id,
    'checks', checks,
    'ready', good,
    'canActivate', good AND p.status IN ('planning', 'on_hold'),
    'canEarlyActivate', (v_ready_except_start AND NOT v_start_reached AND p.start_date IS NOT NULL AND p.status IN ('planning', 'on_hold')),
    'daysUntilStart', CASE WHEN p.start_date IS NOT NULL AND p.start_date > v_today_manila THEN (p.start_date - v_today_manila) ELSE 0 END,
    'canScheduleActivation', (v_ready_except_start AND NOT v_start_reached AND p.start_date IS NOT NULL AND p.status IN ('planning', 'on_hold') AND p.activation_scheduled_at IS NULL),
    'autoActivationScheduled', v_is_scheduled,
    'activationScheduledAt', p.activation_scheduled_at,
    'startDate', p.start_date,
    'stage', CASE
      WHEN p.status IN ('completed', 'archived') THEN 'Closed'
      WHEN good AND p.status = 'active' THEN 'Active'
      WHEN v_pending_head THEN 'Pending Head & Accounting approval'
      WHEN v_pending_accounting THEN 'Pending Accounting certification'
      WHEN v_needs_head_project_approval THEN 'Pending Office Head approval'
      WHEN v_is_scheduled THEN 'Scheduled for start date'
      WHEN good OR (v_ready_except_start AND NOT v_start_reached AND p.start_date IS NOT NULL) THEN 'Waiting for activation'
      WHEN p.status = 'on_hold' THEN 'Revision review'
      WHEN EXISTS (SELECT 1 FROM public.project_offices o WHERE o.project_id = p.id AND o.invitation_status IN ('pending', 'awaiting_head')) THEN 'Office coordination'
      ELSE 'Planning'
    END,
    'governed', governed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_phase7.readiness(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r jsonb;
  checks jsonb;
  n integer;
  good boolean;
  v_ready_except_start boolean;
  p record;
  issue text;
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_is_scheduled boolean;
BEGIN
  r := eflow_phase65.baseline_readiness(p_id);
  SELECT count(*) INTO n FROM public.tasks WHERE linked_project_id = p_id
    AND proposed_office_identity_id IS NOT NULL AND deleted_at IS NULL AND status <> 'cancelled';
  checks := (r->'checks') || jsonb_build_array(jsonb_build_object('key', 'office_identity',
    'label', 'Proposed Office responsibilities resolved', 'ok', n = 0,
    'detail', n || ' tasks need directory linking, Office Head confirmation and explicit handover in Project Offices.'));
  SELECT start_date, target_date, status, activation_scheduled_at INTO p FROM public.projects WHERE id = p_id;
  issue := eflow_schedule.project_conflict(p_id, p.start_date, p.target_date);
  IF issue IS NOT NULL THEN
    SELECT jsonb_agg(CASE WHEN c->>'key' = 'schedule'
      THEN c || jsonb_build_object('ok', false, 'detail', issue) ELSE c END ORDER BY ordinal)
      INTO checks FROM jsonb_array_elements(checks) WITH ORDINALITY entries(c, ordinal);
  END IF;
  good := NOT EXISTS(SELECT 1 FROM jsonb_array_elements(checks) c WHERE NOT (c->>'ok')::boolean);
  v_ready_except_start := NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(checks) c
    WHERE c->>'key' <> 'start_date_reached' AND NOT (c->>'ok')::boolean
  );
  v_is_scheduled := (
    p.activation_scheduled_at IS NOT NULL
    AND v_ready_except_start
    AND p.start_date IS NOT NULL
    AND p.start_date > v_today_manila
    AND p.status IN ('planning', 'on_hold')
  );
  RETURN r || jsonb_build_object(
    'checks', checks,
    'ready', good,
    'canActivate', good AND (r->>'canActivate')::boolean,
    'canEarlyActivate', (
      v_ready_except_start
      AND p.start_date IS NOT NULL
      AND p.start_date > v_today_manila
      AND p.status IN ('planning', 'on_hold')
    ),
    'daysUntilStart', CASE WHEN p.start_date IS NOT NULL AND p.start_date > v_today_manila THEN (p.start_date - v_today_manila) ELSE 0 END,
    'canScheduleActivation', (
      v_ready_except_start
      AND p.start_date IS NOT NULL
      AND p.start_date > v_today_manila
      AND p.status IN ('planning', 'on_hold')
      AND p.activation_scheduled_at IS NULL
    ),
    'autoActivationScheduled', v_is_scheduled,
    'activationScheduledAt', p.activation_scheduled_at,
    'stage', CASE
      WHEN n > 0 THEN 'Office identity resolution'
      WHEN issue IS NOT NULL THEN 'Schedule review'
      ELSE r->>'stage'
    END
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.phase7_activate_project(p_project uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  r jsonb;
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  IF NOT eflow_project.ready(p_project) THEN
    RAISE EXCEPTION 'Finish project details and certified funding setup before activation' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL
     OR NOT (public.can_configure_project(p.id, auth.uid()) OR eflow_project.lead(p.id, auth.uid())) THEN
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
  VALUES (auth.uid(), 'project', p.id::text, 'project.activated', p.org_id, r);
END;
$function$;

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
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_scheduled_project_activation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_scheduled_project_activation(uuid) TO authenticated;

-- Allow Office Head, Project Lead, or Creator in guard triggers AND block silent activation.
CREATE OR REPLACE FUNCTION eflow_phase7.guard_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  syncing boolean := pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1';
  v_auto boolean := auth.uid() IS NULL AND pg_catalog.current_setting('eflow.auto_activating_project', true) = '1';
  v_early boolean := pg_catalog.current_setting('eflow.early_activating_project', true) = '1';
  v_actor uuid := COALESCE(auth.uid(), NULLIF(pg_catalog.current_setting('eflow.auto_activating_actor', true), '')::uuid);
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
  IF tg_op = 'UPDATE' AND auth.uid() IS NOT NULL AND new.source_collaboration_draft_id IS DISTINCT FROM old.source_collaboration_draft_id THEN
    RAISE EXCEPTION 'Project governance identity is immutable' USING ERRCODE = '42501';
  END IF;

  IF new.source_collaboration_draft_id IS NOT NULL THEN
    IF new.status = 'active' AND (tg_op = 'INSERT' OR old.status IS DISTINCT FROM 'active') THEN
      IF new.start_date IS NOT NULL AND new.start_date > v_today_manila THEN
        IF tg_op = 'INSERT' THEN
          new.status := 'planning';
        ELSE
          RAISE EXCEPTION 'Project cannot be activated before its start date (% at 12:00 AM Philippine Time).', to_char(new.start_date, 'MM/DD/YYYY') USING ERRCODE = '22023';
        END IF;
      END IF;
    END IF;
    RETURN new;
  END IF;

  IF tg_op = 'INSERT' THEN
    IF new.status = 'active' THEN
      RAISE EXCEPTION 'Create the project in Planning, then review readiness' USING ERRCODE = '22023';
    END IF;
    RETURN new;
  END IF;

  IF (NOT syncing OR new.description IS DISTINCT FROM old.description)
     AND ROW(new.description, new.start_date, new.target_date) IS DISTINCT FROM ROW(old.description, old.start_date, old.target_date)
     AND old.status = 'active' THEN
    new.status := 'on_hold';
  END IF;

  IF old.status = 'archived' AND new.status = 'active' AND new.archived_at IS NULL THEN
    IF NOT (
      (public.phase2_is_office_head(auth.uid(), new.org_id) AND public.can_manage_project(old.id, auth.uid()))
      OR (public.can_configure_project(old.id, auth.uid()) AND public.has_permission(auth.uid(), 'projects.archive'))
    ) THEN
      RAISE EXCEPTION 'Only the Office Head or an authorized project manager can restore this project' USING ERRCODE = '42501';
    END IF;
    IF new.start_date IS NULL OR new.start_date > v_today_manila OR NOT (eflow_phase7.readiness(old.id)->>'ready')::boolean THEN
      new.status := 'planning';
    END IF;
  END IF;

  IF new.status = 'active' AND old.status <> 'active' THEN
    IF old.status NOT IN ('planning', 'on_hold') AND NOT (old.status = 'archived' AND new.archived_at IS NULL) THEN
      RAISE EXCEPTION 'Use the existing archive restore workflow to reopen a closed project' USING ERRCODE = '22023';
    END IF;
    IF ROW(new.description, new.org_id, new.start_date, new.target_date, new.source_collaboration_draft_id)
       IS DISTINCT FROM ROW(old.description, old.org_id, old.start_date, old.target_date, old.source_collaboration_draft_id) THEN
      RAISE EXCEPTION 'Save material changes and review them before activation' USING ERRCODE = '22023';
    END IF;
    IF NOT v_auto AND NOT (public.can_configure_project(old.id, v_actor) OR eflow_project.lead(old.id, v_actor)) THEN
      RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can activate this project' USING ERRCODE = '42501';
    END IF;
    IF v_auto AND (v_actor IS NULL OR NOT (public.can_configure_project(old.id, v_actor) OR eflow_project.lead(old.id, v_actor))) THEN
      RAISE EXCEPTION 'Automatic activation requires a valid project manager actor' USING ERRCODE = '42501';
    END IF;
    IF new.project_approval_status IN ('pending_head', 'rejected') THEN
      RAISE EXCEPTION 'Office Head project approval is required before activation' USING ERRCODE = '23514';
    END IF;
    IF new.start_date IS NULL OR (NOT v_early AND new.start_date > v_today_manila) THEN
      RAISE EXCEPTION 'Project cannot be activated before its start date (% at 12:00 AM Philippine Time).', COALESCE(to_char(new.start_date, 'MM/DD/YYYY'), 'not set') USING ERRCODE = '22023';
    END IF;
    IF v_early THEN
      IF NOT (
        COALESCE((eflow_phase7.readiness(old.id)->>'ready')::boolean, false)
        OR COALESCE((eflow_phase7.readiness(old.id)->>'canEarlyActivate')::boolean, false)
      ) THEN
        RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023';
      END IF;
    ELSIF NOT (eflow_phase7.readiness(old.id)->>'ready')::boolean THEN
      RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_publication.guard_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  readiness jsonb;
  v_auto boolean := auth.uid() IS NULL AND pg_catalog.current_setting('eflow.auto_activating_project', true) = '1';
  v_early boolean := pg_catalog.current_setting('eflow.early_activating_project', true) = '1';
  v_actor uuid := COALESCE(auth.uid(), NULLIF(pg_catalog.current_setting('eflow.auto_activating_actor', true), '')::uuid);
BEGIN
  IF tg_op = 'INSERT' THEN
    IF new.source_collaboration_draft_id IS NOT NULL THEN
      IF NOT COALESCE(public.phase2_is_office_head(auth.uid(), new.org_id), false) THEN
        RAISE EXCEPTION 'Only the owning Office Head can publish' USING ERRCODE = '42501';
      END IF;
      new.publication_state := 'published';
      new.published_at := now();
      new.published_by := auth.uid();
    ELSE
      IF new.status IS DISTINCT FROM 'planning' OR NOT COALESCE(public.can_create_project_in_office(new.org_id, auth.uid()), false) THEN
        RAISE EXCEPTION 'You need the Create Projects permission in your active office to create a Planning project' USING ERRCODE = '42501';
      END IF;
      new.publication_state := 'draft';
      new.published_at := NULL;
      new.published_by := NULL;
    END IF;
    RETURN new;
  END IF;

  IF ROW(new.published_at, new.published_by) IS DISTINCT FROM ROW(old.published_at, old.published_by) THEN
    RAISE EXCEPTION 'Publication history cannot be edited' USING ERRCODE = '42501';
  END IF;

  IF old.publication_state = 'published' THEN
    IF new.publication_state IS DISTINCT FROM 'published' THEN
      RAISE EXCEPTION 'Published projects cannot return to a private draft' USING ERRCODE = '23514';
    END IF;
    IF old.status = 'on_hold' AND new.status = 'completed' THEN
      RAISE EXCEPTION 'Reactivate this project before completing it' USING ERRCODE = '23514';
    END IF;
    RETURN new;
  END IF;

  IF new.status = 'active' THEN
    IF v_actor IS NULL OR NOT (COALESCE(public.can_configure_project(old.id, v_actor), false) OR eflow_project.lead(old.id, v_actor)) THEN
      RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can activate this project' USING ERRCODE = '42501';
    END IF;
    IF ROW(new.title, new.description, new.scope, new.org_id, new.project_lead_id, new.start_date, new.target_date, new.funding_not_required)
       IS DISTINCT FROM ROW(old.title, old.description, old.scope, old.org_id, old.project_lead_id, old.start_date, old.target_date, old.funding_not_required) THEN
      RAISE EXCEPTION 'Save and review project changes before activation' USING ERRCODE = '23514';
    END IF;
    readiness := eflow_phase7.readiness(old.id);
    IF NOT eflow_project.ready(old.id)
       OR NOT (
         COALESCE((readiness->>'canActivate')::boolean, false)
         OR (v_early AND COALESCE((readiness->>'canEarlyActivate')::boolean, false))
       ) THEN
      RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '23514';
    END IF;
    new.publication_state := 'published';
    new.published_at := now();
    new.published_by := v_actor;
  ELSIF new.status IS DISTINCT FROM 'planning' OR new.publication_state IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Private projects must remain in Planning until activation' USING ERRCODE = '23514';
  END IF;

  RETURN new;
END;
$function$;

-- Explicit-schedule-only automatic activation runner:
-- NEVER auto-activates projects just because they were approved!
CREATE OR REPLACE FUNCTION eflow_phase7.activate_due_scheduled_projects(p_org_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  r jsonb;
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_org_head uuid;
  v_actor uuid;
  v_activated integer := 0;
  v_notify_id uuid;
BEGIN
  FOR p IN
    SELECT *
    FROM public.projects
    WHERE status IN ('planning', 'on_hold')
      AND start_date IS NOT NULL
      AND start_date <= v_today_manila
      AND activation_scheduled_at IS NOT NULL
      AND (p_org_id IS NULL OR org_id = p_org_id)
    ORDER BY start_date ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;

      IF p.source_collaboration_draft_id IS NOT NULL THEN
        IF p.publication_state = 'published' THEN
          v_actor := COALESCE(p.activation_scheduled_by, v_org_head, p.owner_id, p.created_by);
          PERFORM pg_catalog.set_config('eflow.auto_activating_project', '1', true);
          PERFORM pg_catalog.set_config('eflow.auto_activating_actor', COALESCE(v_actor::text, ''), true);
          PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
          UPDATE public.projects
          SET status = 'active',
              activation_scheduled_at = NULL,
              activation_scheduled_by = NULL,
              updated_at = now()
          WHERE id = p.id;
          PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);
          PERFORM pg_catalog.set_config('eflow.auto_activating_project', '', true);
          PERFORM pg_catalog.set_config('eflow.auto_activating_actor', '', true);

          INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
          VALUES (
            v_actor, 'project', p.id::text, 'project.auto_activated', p.org_id,
            jsonb_build_object('startDate', p.start_date, 'activatedDatePht', v_today_manila)
          );
          v_activated := v_activated + 1;
        END IF;
        CONTINUE;
      END IF;

      IF p.project_approval_status IN ('pending_head', 'rejected') THEN
        CONTINUE;
      END IF;

      IF NOT eflow_project.ready(p.id) THEN
        CONTINUE;
      END IF;

      r := eflow_phase7.readiness(p.id);
      IF NOT COALESCE((r->>'canActivate')::boolean, false) THEN
        CONTINUE;
      END IF;

      v_actor := NULL;
      IF p.activation_scheduled_by IS NOT NULL
         AND (public.can_configure_project(p.id, p.activation_scheduled_by) OR eflow_project.lead(p.id, p.activation_scheduled_by)) THEN
        v_actor := p.activation_scheduled_by;
      ELSIF v_org_head IS NOT NULL AND public.can_configure_project(p.id, v_org_head) THEN
        v_actor := v_org_head;
      ELSIF p.project_lead_id IS NOT NULL AND eflow_project.lead(p.id, p.project_lead_id) THEN
        v_actor := p.project_lead_id;
      ELSIF p.created_by IS NOT NULL AND public.can_configure_project(p.id, p.created_by) THEN
        v_actor := p.created_by;
      END IF;

      IF v_actor IS NULL THEN
        CONTINUE;
      END IF;

      PERFORM pg_catalog.set_config('eflow.auto_activating_project', '1', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_actor', v_actor::text, true);
      PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '1', true);
      UPDATE public.projects
      SET status = 'active',
          activation_scheduled_at = NULL,
          activation_scheduled_by = NULL,
          updated_at = now()
      WHERE id = p.id;
      PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_project', '', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_actor', '', true);

      INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
      VALUES (
        v_actor, 'project', p.id::text, 'project.auto_activated', p.org_id,
        r || jsonb_build_object('startDate', p.start_date, 'activatedDatePht', v_today_manila)
      );

      FOR v_notify_id IN
        SELECT DISTINCT uid FROM unnest(ARRAY[v_org_head, p.project_lead_id, p.created_by]) uid
        WHERE uid IS NOT NULL
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
        VALUES (
          v_notify_id,
          'status_change',
          'Scheduled project activated',
          '"' || p.title || '" reached its scheduled start date (' || to_char(p.start_date, 'MM/DD/YYYY') || ') and is now Active.',
          p.id,
          p.org_id,
          v_actor,
          'eFlow Schedule'
        );
      END LOOP;

      v_activated := v_activated + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('eflow.updating_activation_schedule', '', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_project', '', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_actor', '', true);
      CONTINUE;
    END;
  END LOOP;

  RETURN v_activated;
END;
$function$;

-- Allow Project Lead to also record plan reviews when they have activation authority (A3).
CREATE OR REPLACE FUNCTION public.phase7_review_project(p_project uuid, p_kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL
     OR NOT (public.can_configure_project(p.id, v_uid) OR eflow_project.lead(p.id, v_uid)) THEN
    RAISE EXCEPTION 'Only the Office Head, Project Lead, or owning project creator can review project readiness' USING ERRCODE = '42501';
  END IF;
  IF p.status IN ('completed', 'archived') OR p.source_collaboration_draft_id IS NOT NULL OR p_kind NOT IN ('structure', 'dates', 'budget') THEN
    RAISE EXCEPTION 'Readiness review is unavailable' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.project_readiness_reviews (project_id, review_kind, fingerprint, reviewed_by)
  VALUES (p.id, p_kind, eflow_phase7.fingerprint(p.id, p_kind), v_uid)
  ON CONFLICT (project_id, review_kind)
  DO UPDATE SET fingerprint = EXCLUDED.fingerprint, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = now();
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (v_uid, 'project', p.id::text, 'project.readiness_review', p.org_id, jsonb_build_object('kind', p_kind));
END;
$function$;

REVOKE ALL ON FUNCTION public.phase7_review_project(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase7_review_project(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
