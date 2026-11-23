-- Project Lifecycle Guardrails:
-- 1. Enforce Asia/Manila start_date gate on activation + automatic 12:00 AM PHT activation via pg_cron.
-- 2. Track DB-synced funding_approval_status ('none' | 'pending_head' | 'pending_accounting' | 'approved')
--    so funded projects display as Pending until BOTH Office Head endorsement and independent Accounting Staff certification pass.
-- 3. Support Project Lead selection, automatic task-reviewer re-routing on lead change, and Project Lead -> Office Head
--    completion review handover when project_lead_id <> organizations.head_user_id (while letting Head-as-Lead complete directly).

-- ─── 1. Non-destructive schema additions on public.projects ───────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS funding_approval_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS completion_review_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS completion_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_request_note text,
  ADD COLUMN IF NOT EXISTS completion_review_feedback text,
  ADD COLUMN IF NOT EXISTS completion_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_reviewed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_funding_approval_status_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_funding_approval_status_check
      CHECK (funding_approval_status IN ('none', 'pending_head', 'pending_accounting', 'approved'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'projects_completion_review_status_check'
      AND conrelid = 'public.projects'::regclass
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT projects_completion_review_status_check
      CHECK (completion_review_status IN ('none', 'requested', 'changes_requested', 'approved'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_projects_scheduled_auto_activation
  ON public.projects (start_date)
  WHERE status IN ('planning', 'on_hold') AND start_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_completion_review_requested
  ON public.projects (org_id, completion_requested_at DESC)
  WHERE completion_review_status = 'requested' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_projects_funding_approval_pending
  ON public.projects (org_id)
  WHERE funding_approval_status IN ('pending_head', 'pending_accounting');

-- ─── 2. DB-synced funding_approval_status helper + trigger ───────────────────

CREATE OR REPLACE FUNCTION eflow_project.sync_funding_approval_status(p_project uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status text;
BEGIN
  IF p_project IS NULL THEN
    RETURN 'none';
  END IF;

  IF EXISTS (
    SELECT 1 FROM eflow_project.funding_requests fr
    WHERE fr.project_id = p_project AND fr.status = 'pending'
  ) THEN
    v_status := 'pending_head';
  ELSIF EXISTS (
    SELECT 1 FROM eflow_project.funding_requests fr
    WHERE fr.project_id = p_project AND fr.status = 'pending_accounting'
  ) THEN
    v_status := 'pending_accounting';
  ELSIF EXISTS (
    SELECT 1
    FROM eflow_project.funding f
    JOIN public.budget_commitments c ON c.id = f.commitment_id
    WHERE f.project_id = p_project AND f.amount > 0 AND c.status = 'active'
  ) THEN
    v_status := 'approved';
  ELSE
    v_status := 'none';
  END IF;

  PERFORM pg_catalog.set_config('eflow.syncing_funding_approval_status', '1', true);
  UPDATE public.projects
  SET funding_approval_status = v_status
  WHERE id = p_project
    AND funding_approval_status IS DISTINCT FROM v_status;
  PERFORM pg_catalog.set_config('eflow.syncing_funding_approval_status', '', true);

  RETURN v_status;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.trg_sync_funding_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_project uuid;
BEGIN
  v_project := COALESCE(NEW.project_id, OLD.project_id);
  IF v_project IS NOT NULL THEN
    PERFORM eflow_project.sync_funding_approval_status(v_project);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'zzz_sync_project_funding_approval_status'
      AND tgrelid = 'eflow_project.funding_requests'::regclass
  ) THEN
    CREATE TRIGGER zzz_sync_project_funding_approval_status
      AFTER INSERT OR UPDATE OR DELETE ON eflow_project.funding_requests
      FOR EACH ROW EXECUTE FUNCTION eflow_project.trg_sync_funding_approval_status();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'zzz_sync_project_funding_commit_status'
      AND tgrelid = 'eflow_project.funding'::regclass
  ) THEN
    CREATE TRIGGER zzz_sync_project_funding_commit_status
      AFTER INSERT OR UPDATE OR DELETE ON eflow_project.funding
      FOR EACH ROW EXECUTE FUNCTION eflow_project.trg_sync_funding_approval_status();
  END IF;
END;
$$;

-- ─── 3. Guard funding_approval_status & completion_review_* on public.projects ─

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

-- ─── 4. Dual-approval funding hardening + Office Head queue visibility ───────

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

  INSERT INTO eflow_project.funding_requests (id, project_id, actor_id, lines, reason, status)
  VALUES (p_key, p_project, auth.uid(), p_lines, btrim(p_reason), 'pending')
  ON CONFLICT DO NOTHING;

  IF p.funding_not_required THEN
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
    UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
    PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);
  END IF;

  PERFORM eflow_project.sync_funding_approval_status(p.id);

  SELECT COALESCE(full_name, 'Project Lead') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  IF v_head_id IS NOT NULL AND v_head_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      v_head_id, 'project_funding_request', 'Project funding request',
      v_actor_name || ' requested ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Endorse it to forward to Accounting Staff for certification.',
      p.id, p.org_id, auth.uid(), v_actor_name
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

CREATE OR REPLACE FUNCTION public.list_pending_project_funding_certifications(p_org_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_is_certifier boolean;
  v_is_head boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(p_org_id, pr.org_id) INTO v_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;

  IF v_org IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  v_is_certifier := public.can_certify_project_funding(v_org, v_uid);
  v_is_head := public.phase2_is_office_head(v_uid, v_org);

  IF NOT (v_is_certifier OR v_is_head) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'projectId', p.id,
        'projectTitle', p.title,
        'projectScope', p.scope,
        'projectStatus', p.status,
        'publicationState', p.publication_state,
        'orgId', p.org_id,
        'requestedBy', fr.actor_id,
        'requestedByName', COALESCE(req_p.full_name, 'Staff'),
        'headApprovedBy', fr.head_approved_by,
        'headApprovedByName', COALESCE(head_p.full_name, ''),
        'headApprovedAt', fr.head_approved_at,
        'reason', fr.reason,
        'status', fr.status,
        'createdAt', fr.created_at,
        'totalAmount', COALESCE((
          SELECT sum((l->>'amount')::numeric) FROM jsonb_array_elements(fr.lines) l
        ), 0),
        'lines', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'partitionId', (l->>'partitionId')::uuid,
              'sourceName', COALESCE(s.name, 'Budget source'),
              'fiscalYear', b.fiscal_year,
              'amount', (l->>'amount')::numeric,
              'available', CASE WHEN s.id IS NOT NULL THEN s.amount - s.held_amount - eflow_budget.partition_committed(s.id) ELSE 0 END
            )
          )
          FROM jsonb_array_elements(fr.lines) l
          LEFT JOIN public.office_budget_sections s ON s.id = NULLIF(l->>'partitionId', '')::uuid
          LEFT JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
        ), '[]'::jsonb),
        'canEndorse', (
          v_is_head
          AND fr.status = 'pending'
        ),
        'canCertify', (
          v_is_certifier
          AND fr.status = 'pending_accounting'
          AND v_uid IS DISTINCT FROM fr.actor_id
          AND v_uid IS DISTINCT FROM fr.head_approved_by
          AND v_uid IS DISTINCT FROM p.created_by
          AND v_uid IS DISTINCT FROM p.project_lead_id
        )
      )
      ORDER BY CASE WHEN fr.status = 'pending' THEN 0 ELSE 1 END, fr.created_at DESC
    )
    FROM eflow_project.funding_requests fr
    JOIN public.projects p ON p.id = fr.project_id
    LEFT JOIN public.profiles req_p ON req_p.id = fr.actor_id
    LEFT JOIN public.profiles head_p ON head_p.id = fr.head_approved_by
    WHERE p.org_id = v_org
      AND p.status NOT IN ('completed', 'archived')
      AND (
        fr.status = 'pending_accounting'
        OR (v_is_head AND fr.status = 'pending')
      )
  ), '[]'::jsonb);
END;
$function$;

-- ─── 5. Project Lead save_details with automatic task reviewer re-sync ───────

CREATE OR REPLACE FUNCTION eflow_project.save_details(p_project uuid, p_details jsonb)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_old_lead uuid;
  leader uuid;
  v_org_head uuid;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'You need project management access on this project to save project setup' USING ERRCODE = '42501';
  END IF;
  IF p.updated_at IS DISTINCT FROM (p_details->>'version')::timestamptz THEN
    RAISE EXCEPTION 'Project changed elsewhere. Reopen setup and review current details before saving' USING ERRCODE = '40001';
  END IF;

  v_old_lead := p.project_lead_id;
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

  IF p.project_lead_id IS NOT NULL THEN
    INSERT INTO public.project_office_members (project_office_id, user_id, selected_by)
      SELECT id, p.project_lead_id, auth.uid()
      FROM public.project_offices
      WHERE project_id = p.id AND office_id = p.org_id AND relationship_type = 'lead'
      ON CONFLICT DO NOTHING;
    INSERT INTO public.project_members (project_id, user_id, role)
      VALUES (p.id, p.project_lead_id, 'member')
      ON CONFLICT DO NOTHING;

    -- Keep existing open tasks routed to the newly appointed Project Lead
    -- (and route tasks assigned to the Project Lead themselves to the Office Head).
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

-- ─── 6. Start-Date Activation Gate (Asia/Manila) + Readiness Updates ─────────

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
  v_today_manila date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_start_reached boolean;
  v_ready_except_start boolean;
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
        AND public.can_configure_project(p.id, r.reviewed_by)
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

  -- Start date gate in Philippine Time (Asia/Manila).
  v_start_reached := p.start_date IS NOT NULL AND p.start_date <= v_today_manila;
  checks := checks || jsonb_build_array(jsonb_build_object(
    'key', 'start_date_reached',
    'label', 'Project start date reached',
    'ok', v_start_reached,
    'detail', CASE
      WHEN p.start_date IS NULL THEN 'Set a project start date before activating.'
      WHEN p.start_date > v_today_manila THEN 'Scheduled to start on ' || to_char(p.start_date, 'MM/DD/YYYY') || ' at 12:00 AM (Philippine Time). Activates automatically once all other checks are complete.'
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

  RETURN jsonb_build_object(
    'projectId', p.id,
    'checks', checks,
    'ready', good,
    'canActivate', good AND p.status IN ('planning', 'on_hold'),
    'autoActivationScheduled', (NOT v_start_reached AND v_ready_except_start AND p.start_date IS NOT NULL AND p.status IN ('planning', 'on_hold')),
    'startDate', p.start_date,
    'stage', CASE
      WHEN p.status IN ('completed', 'archived') THEN 'Closed'
      WHEN good AND p.status = 'active' THEN 'Active'
      WHEN good THEN 'Ready'
      WHEN v_pending_head THEN 'Pending Head & Accounting approval'
      WHEN v_pending_accounting THEN 'Pending Accounting certification'
      WHEN v_ready_except_start AND NOT v_start_reached AND p.start_date IS NOT NULL THEN 'Scheduled for start date'
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
BEGIN
  r := eflow_phase65.baseline_readiness(p_id);
  SELECT count(*) INTO n FROM public.tasks WHERE linked_project_id = p_id
    AND proposed_office_identity_id IS NOT NULL AND deleted_at IS NULL AND status <> 'cancelled';
  checks := (r->'checks') || jsonb_build_array(jsonb_build_object('key', 'office_identity',
    'label', 'Proposed Office responsibilities resolved', 'ok', n = 0,
    'detail', n || ' tasks need directory linking, Office Head confirmation and explicit handover in Project Offices.'));
  SELECT start_date, target_date, status INTO p FROM public.projects WHERE id = p_id;
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
  RETURN r || jsonb_build_object(
    'checks', checks,
    'ready', good,
    'canActivate', good AND (r->>'canActivate')::boolean,
    'autoActivationScheduled', (
      v_ready_except_start
      AND p.start_date IS NOT NULL
      AND p.start_date > v_today_manila
      AND p.status IN ('planning', 'on_hold')
    ),
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
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the Office Head or owning project creator can activate this project' USING ERRCODE = '42501';
  END IF;
  IF p.source_collaboration_draft_id IS NOT NULL THEN
    RAISE EXCEPTION 'Use the existing proposal approval workflow' USING ERRCODE = '22023';
  END IF;
  IF p.status = 'active' THEN
    RETURN;
  END IF;
  IF p.start_date IS NULL THEN
    RAISE EXCEPTION 'Set a project start date before activating' USING ERRCODE = '22023';
  END IF;
  IF p.start_date > v_today_manila THEN
    RAISE EXCEPTION 'Project cannot be activated before its start date (% at 12:00 AM Philippine Time). Once all checks are complete, it activates automatically on that date.', to_char(p.start_date, 'MM/DD/YYYY') USING ERRCODE = '22023';
  END IF;
  r := eflow_phase7.readiness(p.id);
  IF NOT (r->>'canActivate')::boolean THEN
    RAISE EXCEPTION 'Project readiness is incomplete' USING ERRCODE = '22023', DETAIL = (r->'checks')::text;
  END IF;
  UPDATE public.projects SET status = 'active', updated_at = now() WHERE id = p.id;
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES (auth.uid(), 'project', p.id::text, 'project.activated', p.org_id, r);
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_phase7.guard_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  syncing boolean := pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1';
  v_auto boolean := auth.uid() IS NULL AND pg_catalog.current_setting('eflow.auto_activating_project', true) = '1';
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
    IF NOT v_auto AND NOT public.can_configure_project(old.id, v_actor) THEN
      RAISE EXCEPTION 'Only the Office Head or owning project creator can activate this project' USING ERRCODE = '42501';
    END IF;
    IF v_auto AND (v_actor IS NULL OR NOT public.can_configure_project(old.id, v_actor)) THEN
      RAISE EXCEPTION 'Automatic activation requires a valid project manager actor' USING ERRCODE = '42501';
    END IF;
    IF new.start_date IS NULL OR new.start_date > v_today_manila THEN
      RAISE EXCEPTION 'Project cannot be activated before its start date (% at 12:00 AM Philippine Time).', COALESCE(to_char(new.start_date, 'MM/DD/YYYY'), 'not set') USING ERRCODE = '22023';
    END IF;
    IF NOT (eflow_phase7.readiness(old.id)->>'ready')::boolean THEN
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
    IF v_actor IS NULL OR NOT COALESCE(public.can_configure_project(old.id, v_actor), false) THEN
      RAISE EXCEPTION 'Only the Office Head or owning project creator can activate this project' USING ERRCODE = '42501';
    END IF;
    IF ROW(new.title, new.description, new.scope, new.org_id, new.project_lead_id, new.start_date, new.target_date, new.funding_not_required)
       IS DISTINCT FROM ROW(old.title, old.description, old.scope, old.org_id, old.project_lead_id, old.start_date, old.target_date, old.funding_not_required) THEN
      RAISE EXCEPTION 'Save and review project changes before activation' USING ERRCODE = '23514';
    END IF;
    readiness := eflow_phase7.readiness(old.id);
    IF NOT eflow_project.ready(old.id) OR NOT COALESCE((readiness->>'canActivate')::boolean, false) THEN
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

CREATE OR REPLACE FUNCTION eflow_publication.distribute_project_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  task_row public.tasks;
  v_actor uuid := COALESCE(auth.uid(), NULLIF(pg_catalog.current_setting('eflow.auto_activating_actor', true), '')::uuid, new.published_by);
BEGIN
  IF new.status <> 'active' OR new.publication_state <> 'published' THEN
    RAISE EXCEPTION 'Activation was interrupted' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.audit_events(actor_id, entity_type, entity_id, action, org_id, after_data)
  VALUES(new.published_by, 'project', new.id::text, 'project.published', new.org_id,
    jsonb_build_object('publishedAt', new.published_at, 'status', new.status));
  FOR task_row IN SELECT * FROM public.tasks WHERE linked_project_id = new.id AND deleted_at IS NULL AND status <> 'cancelled'
  LOOP
    PERFORM eflow_chat.sync_task_channel(task_row);
  END LOOP;
  INSERT INTO public.notifications(user_id, type, title, message, task_id, task_title, project_id, org_id, actor_id, work_node_id)
  SELECT DISTINCT a.worker, 'assignment',
    CASE WHEN a.node_id IS NULL THEN 'Task assignment' ELSE 'Subtask assignment' END,
    'You were assigned to "' || a.title || '".', a.task_id, a.task_title, new.id, a.org_id, v_actor, a.node_id
  FROM (
    SELECT t.id task_id, t.title task_title, t.title, t.org_id, NULL::uuid node_id,
      unnest(ARRAY[t.assigned_to, t.recommendation_lead_id] || COALESCE(t.team_member_ids, '{}'::uuid[])) worker
    FROM public.tasks t WHERE t.linked_project_id = new.id AND t.deleted_at IS NULL AND t.status <> 'cancelled'
    UNION ALL
    SELECT t.id, t.title, s.title, t.org_id, s.id,
      unnest(ARRAY[s.lead_id, s.assigned_to] || COALESCE(s.assigned_to_ids, '{}'::uuid[]))
    FROM public.tasks t JOIN public.subtasks s ON s.task_id = t.id
    WHERE t.linked_project_id = new.id AND t.deleted_at IS NULL AND t.status <> 'cancelled' AND s.status <> 'cancelled'
  ) a JOIN public.profiles u ON u.id = a.worker AND u.is_active
  WHERE public.can_see_task(a.task_id, a.worker) AND eflow_r7.member(new.id, a.org_id, a.worker);
  RETURN new;
END;
$function$;

-- ─── 7. Automatic 12:00 AM PHT Start-Date Activation Runner + pg_cron ────────

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
      AND (p_org_id IS NULL OR org_id = p_org_id)
    ORDER BY start_date ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      SELECT head_user_id INTO v_org_head FROM public.organizations WHERE id = p.org_id;

      IF p.source_collaboration_draft_id IS NOT NULL THEN
        IF p.publication_state = 'published' THEN
          v_actor := COALESCE(v_org_head, p.owner_id, p.created_by);
          PERFORM pg_catalog.set_config('eflow.auto_activating_project', '1', true);
          PERFORM pg_catalog.set_config('eflow.auto_activating_actor', COALESCE(v_actor::text, ''), true);
          UPDATE public.projects SET status = 'active', updated_at = now() WHERE id = p.id;
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

      IF NOT eflow_project.ready(p.id) THEN
        CONTINUE;
      END IF;

      r := eflow_phase7.readiness(p.id);
      IF NOT COALESCE((r->>'canActivate')::boolean, false) THEN
        CONTINUE;
      END IF;

      -- Pick a valid configuring actor for audit/publication metadata.
      v_actor := NULL;
      IF p.owner_id IS NOT NULL AND public.can_configure_project(p.id, p.owner_id) THEN
        v_actor := p.owner_id;
      ELSIF p.created_by IS NOT NULL AND public.can_configure_project(p.id, p.created_by) THEN
        v_actor := p.created_by;
      ELSIF v_org_head IS NOT NULL AND public.can_configure_project(p.id, v_org_head) THEN
        v_actor := v_org_head;
      ELSIF p.project_lead_id IS NOT NULL AND public.can_configure_project(p.id, p.project_lead_id) THEN
        v_actor := p.project_lead_id;
      END IF;

      IF v_actor IS NULL THEN
        CONTINUE;
      END IF;

      PERFORM pg_catalog.set_config('eflow.auto_activating_project', '1', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_actor', v_actor::text, true);
      UPDATE public.projects SET status = 'active', updated_at = now() WHERE id = p.id;
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
          'Project automatically activated',
          '"' || p.title || '" reached its start date (' || to_char(p.start_date, 'MM/DD/YYYY') || ') and is now Active.',
          p.id,
          p.org_id,
          v_actor,
          'eFlow Schedule'
        );
      END LOOP;

      v_activated := v_activated + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('eflow.auto_activating_project', '', true);
      PERFORM pg_catalog.set_config('eflow.auto_activating_actor', '', true);
      -- Never halt other due projects if one project fails a concurrent check.
      CONTINUE;
    END;
  END LOOP;

  RETURN v_activated;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_due_project_activations(p_org_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;
  SELECT COALESCE(p_org_id, pr.org_id) INTO v_org
  FROM public.profiles pr
  WHERE pr.id = v_uid AND pr.is_active = true;
  IF v_org IS NULL THEN
    RETURN 0;
  END IF;
  RETURN eflow_phase7.activate_due_scheduled_projects(v_org);
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_due_project_activations(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_due_project_activations(uuid) TO authenticated;

-- Schedule pg_cron job every minute so projects activate right at 12:00 AM PHT on their start_date.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'eflow_auto_activate_due_projects'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
  PERFORM cron.schedule(
    'eflow_auto_activate_due_projects',
    '* * * * *',
    'select eflow_phase7.activate_due_scheduled_projects()'
  );
END;
$$;

-- ─── 8. Project Lead -> Office Head Completion Review Handover ───────────────

CREATE OR REPLACE FUNCTION eflow_budget.pre_subtask_budget_closeout(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result jsonb;
  blockers jsonb;
  p public.projects;
  unallocated numeric;
  returnable numeric;
  task_lines jsonb;
  v_head_id uuid;
  v_lead_name text;
  v_req_name text;
  v_rev_name text;
  v_lead_active_non_head boolean := false;
  v_requires_handover boolean := false;
  v_work_blockers_count integer := 0;
  v_uid uuid := auth.uid();
  v_is_head boolean := false;
BEGIN
  result := eflow_phase7.baseline_completion(p_project_id);
  blockers := result->'blockers';
  SELECT * INTO p FROM public.projects WHERE id = p_project_id;

  IF p.status NOT IN ('completed', 'archived') AND p.source_collaboration_draft_id IS NULL THEN
    blockers := blockers || COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind', 'governance',
        'id', p.id,
        'title', c->>'label',
        'status', 'review_required',
        'detail', c->>'detail'
      ))
      FROM jsonb_array_elements(eflow_phase7.readiness(p.id)->'checks') c
      WHERE NOT (c->>'ok')::boolean
    ), '[]'::jsonb);

    blockers := blockers || COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'kind', 'task',
        'id', t.id,
        'taskId', t.id,
        'title', t.title,
        'status', 'evidence_required',
        'detail', 'An approved task submission with completion evidence is required.'
      ))
      FROM public.tasks t
      WHERE t.linked_project_id = p.id
        AND t.deleted_at IS NULL
        AND t.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM public.task_submissions s
          WHERE s.task_id = t.id AND s.status = 'approved'
        )
    ), '[]'::jsonb);
  END IF;

  IF p.status IN ('planning', 'active', 'on_hold') THEN
    WITH active_funds AS MATERIALIZED (
      SELECT f.id, f.amount, f.fiscal_year, f.partition_id
      FROM eflow_project.funding f
      JOIN public.budget_commitments c ON c.id = f.commitment_id AND c.status = 'active'
      WHERE f.project_id = p.id AND f.amount > 0
    ), task_allocations AS MATERIALIZED (
      SELECT f.id AS funding_id, l.id, l.amount, t.title, s.name, f.fiscal_year,
        CASE WHEN t.linked_project_id = p.id THEN public.task_budget_line_available(l.id, NULL) ELSE 0 END AS available
      FROM active_funds f
      JOIN public.work_budget_allocation_lines l ON l.project_funding_id = f.id
      JOIN public.work_budget_allocations a ON a.id = l.allocation_id AND a.subtask_id IS NULL AND a.status = 'approved'
      LEFT JOIN public.tasks t ON t.id = a.task_id
      JOIN public.office_budget_sections s ON s.id = f.partition_id
    )
    SELECT
      COALESCE((SELECT sum(greatest(0, f.amount - COALESCE(allocated.amount, 0)))
        FROM active_funds f LEFT JOIN
          (SELECT funding_id, sum(amount) AS amount FROM task_allocations GROUP BY funding_id) allocated
          ON allocated.funding_id = f.id), 0),
      COALESCE(sum(available), 0),
      COALESCE(jsonb_agg(jsonb_build_object('id', id, 'task', title, 'source', name, 'fiscalYear', fiscal_year, 'available', available)
        ORDER BY title, name, id) FILTER (WHERE available > 0), '[]'::jsonb)
    INTO unallocated, returnable, task_lines
    FROM task_allocations;
  END IF;

  v_work_blockers_count := jsonb_array_length(blockers);

  SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;
  SELECT full_name INTO v_lead_name FROM public.profiles WHERE id = p.project_lead_id;
  SELECT full_name INTO v_req_name FROM public.profiles WHERE id = p.completion_requested_by;
  SELECT full_name INTO v_rev_name FROM public.profiles WHERE id = p.completion_reviewed_by;

  v_lead_active_non_head := (
    p.project_lead_id IS NOT NULL
    AND v_head_id IS NOT NULL
    AND p.project_lead_id IS DISTINCT FROM v_head_id
    AND EXISTS (
      SELECT 1 FROM public.profiles lp
      WHERE lp.id = p.project_lead_id
        AND lp.is_active = true
        AND lp.org_id = p.org_id
    )
  );
  v_requires_handover := (p.source_collaboration_draft_id IS NULL AND v_lead_active_non_head);

  IF v_requires_handover
     AND p.status IN ('planning', 'active', 'on_hold')
     AND p.completion_review_status <> 'requested' THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'kind', 'lead_review',
      'id', p.id,
      'title', 'Project Lead completion review required',
      'status', p.completion_review_status,
      'detail', CASE
        WHEN p.completion_review_status = 'changes_requested' THEN
          'The Office Head requested changes before marking this project complete. ' || COALESCE(v_lead_name, 'The Project Lead') || ' must resubmit for final completion review.'
        ELSE
          COALESCE(v_lead_name, 'The Project Lead') || ' must submit this project for final completion review before the Office Head can mark it complete.'
      END
    ));
  END IF;

  v_is_head := (v_uid IS NOT NULL AND public.phase2_is_office_head(v_uid, p.org_id));

  RETURN result || jsonb_build_object(
    'blockers', blockers,
    'canComplete', p.status IN ('planning', 'active', 'on_hold') AND jsonb_array_length(blockers) = 0,
    'workBlockersCount', v_work_blockers_count,
    'projectLeadId', p.project_lead_id,
    'projectLeadName', COALESCE(v_lead_name, ''),
    'requiresHeadCompletionReview', v_requires_handover,
    'completionReviewStatus', p.completion_review_status,
    'completionRequestedBy', p.completion_requested_by,
    'completionRequestedByName', COALESCE(v_req_name, ''),
    'completionRequestedAt', p.completion_requested_at,
    'completionRequestNote', COALESCE(p.completion_request_note, ''),
    'completionReviewFeedback', COALESCE(p.completion_review_feedback, ''),
    'completionReviewedByName', COALESCE(v_rev_name, ''),
    'completionReviewedAt', p.completion_reviewed_at,
    'canRequestCompletionReview', (
      v_requires_handover
      AND p.status = 'active'
      AND v_uid IS NOT NULL
      AND p.project_lead_id = v_uid
      AND NOT v_is_head
      AND p.completion_review_status IN ('none', 'changes_requested')
      AND v_work_blockers_count = 0
    ),
    'canApproveCompletion', (
      v_is_head
      AND p.status IN ('planning', 'active', 'on_hold')
      AND jsonb_array_length(blockers) = 0
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_project_completion_readiness(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       COALESCE(public.can_manage_project(p_project_id, auth.uid()), false)
       OR eflow_project.lead(p_project_id, auth.uid())
     )
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active) THEN
    RAISE EXCEPTION 'Only the Office Head or assigned Project Lead can view completion requirements for this project' USING ERRCODE = '42501';
  END IF;
  RETURN public.project_completion_readiness_internal(p_project_id);
END;
$function$;

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

  INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
  VALUES (
    v_head_id,
    'approval_needed',
    'Project completion review requested',
    v_lead_name || ' submitted "' || p.title || '" for your final completion review before marking complete, archiving, and sealing.',
    p.id,
    p.org_id,
    v_uid,
    v_lead_name
  );

  RETURN public.project_completion_readiness_internal(p.id);
END;
$function$;

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

  IF p.project_lead_id IS NOT NULL AND p.project_lead_id <> v_uid THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name, reason)
    VALUES (
      p.project_lead_id,
      'status_change',
      'Project completion changes requested',
      v_head_name || ' requested changes before marking "' || p.title || '" complete: ' || btrim(p_feedback),
      p.id,
      p.org_id,
      v_uid,
      v_head_name,
      btrim(p_feedback)
    );
  END IF;

  RETURN public.project_completion_readiness_internal(p.id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_project(
  p_project_id uuid,
  p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  project_row public.projects;
  v_actor_name text;
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
  -- The trigger rechecks readiness at the actual update, never trusting the UI.
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

  IF project_row.project_lead_id IS NOT NULL AND project_row.project_lead_id <> auth.uid() THEN
    INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
    VALUES (
      project_row.project_lead_id,
      'completed',
      'Project marked complete',
      v_actor_name || ' approved completion for "' || project_row.title || '".',
      project_row.id,
      project_row.org_id,
      auth.uid(),
      v_actor_name
    );
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_pending_project_completion_reviews(p_org_id uuid DEFAULT NULL::uuid)
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
        'projectTitle', p.title,
        'orgId', p.org_id,
        'projectLeadId', p.project_lead_id,
        'projectLeadName', COALESCE(lead_p.full_name, 'Project Lead'),
        'requestedBy', p.completion_requested_by,
        'requestedByName', COALESCE(req_p.full_name, lead_p.full_name, 'Project Lead'),
        'requestedAt', p.completion_requested_at,
        'note', COALESCE(p.completion_request_note, ''),
        'startDate', p.start_date,
        'targetDate', p.target_date
      )
      ORDER BY p.completion_requested_at ASC NULLS LAST
    )
    FROM public.projects p
    LEFT JOIN public.profiles lead_p ON lead_p.id = p.project_lead_id
    LEFT JOIN public.profiles req_p ON req_p.id = p.completion_requested_by
    WHERE p.org_id = v_org
      AND p.status = 'active'
      AND p.completion_review_status = 'requested'
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_project_completion_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_project_completion_review(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.return_project_completion_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_project_completion_review(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_project_completion_reviews(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_project_completion_reviews(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.list_pending_project_funding_certifications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_project_funding_certifications(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_project_completion_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_completion_readiness(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.complete_project(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_project(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.phase7_activate_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase7_activate_project(uuid) TO authenticated;

-- ─── 9. Backfill funding_approval_status on existing projects ────────────────

DO $$
DECLARE
  v_pid uuid;
BEGIN
  FOR v_pid IN SELECT id FROM public.projects LOOP
    PERFORM eflow_project.sync_funding_approval_status(v_pid);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
