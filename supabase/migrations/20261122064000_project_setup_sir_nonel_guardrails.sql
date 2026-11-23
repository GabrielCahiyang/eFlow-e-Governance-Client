-- Sir Nonel QA guardrails for Create a project wizard & project funding certification:
-- 1. Tighten project description/scope ceiling in eflow_project.save_details to 8,000 chars (aligned with INPUT_LIMITS.PROJECT_DESCRIPTION).
-- 2. Account for open pending/pending_accounting funding requests in section & cumulative multi-line fiscal budget checks.
-- 3. Require at least one active, independent Accounting Staff in the office before routing funding to pending_accounting.
-- 4. Support Option A workflow: allow finishing setup and drafting tasks/subtasks once funding is submitted for certification
--    (eflow_project.can_draft_work), while keeping eflow_project.ready strict so project activation stays blocked until certified.
-- 5. Add read-only public.office_funding_sources_preview() so Step 04 can preview FY Office Budget sources without creating ghost projects.

CREATE OR REPLACE FUNCTION eflow_project.pending_partition_reserved(
  p_partition uuid,
  p_exclude_request uuid DEFAULT NULL
)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(sum((item->>'amount')::numeric), 0)
  FROM eflow_project.funding_requests fr
  JOIN public.projects p ON p.id = fr.project_id
  CROSS JOIN LATERAL jsonb_array_elements(fr.lines) item
  WHERE fr.status IN ('pending', 'pending_accounting')
    AND p.status NOT IN ('completed', 'archived')
    AND (p_exclude_request IS NULL OR fr.id <> p_exclude_request)
    AND NULLIF(item->>'partitionId', '')::uuid = p_partition
$function$;

CREATE OR REPLACE FUNCTION eflow_project.pending_fiscal_reserved(
  p_fiscal_budget uuid,
  p_exclude_request uuid DEFAULT NULL
)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE(sum((item->>'amount')::numeric), 0)
  FROM eflow_project.funding_requests fr
  JOIN public.projects p ON p.id = fr.project_id
  CROSS JOIN LATERAL jsonb_array_elements(fr.lines) item
  JOIN public.office_budget_sections s ON s.id = NULLIF(item->>'partitionId', '')::uuid
  WHERE fr.status IN ('pending', 'pending_accounting')
    AND p.status NOT IN ('completed', 'archived')
    AND (p_exclude_request IS NULL OR fr.id <> p_exclude_request)
    AND s.fiscal_budget_id = p_fiscal_budget
$function$;

CREATE OR REPLACE FUNCTION eflow_project._validate_funding_lines(
  p_org_id uuid,
  p_lines jsonb,
  p_exclude_request uuid
)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  line jsonb;
  s public.office_budget_sections;
  b public.department_fiscal_budgets;
  amount numeric;
  section_available numeric;
  total numeric := 0;
  fb_check record;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Select funding sources, amounts and a reason' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_lines) item
    WHERE NULLIF(item->>'partitionId', '') IS NOT NULL
    GROUP BY item->>'partitionId'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Use each budget source only once.' USING ERRCODE = '23514';
  END IF;

  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    amount := (line->>'amount')::numeric;
    IF amount IS NULL OR amount <= 0 OR amount <> round(amount, 2) OR amount > 90000000000 THEN
      RAISE EXCEPTION 'Enter a positive amount in cents' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO s FROM public.office_budget_sections WHERE id = (line->>'partitionId')::uuid AND NOT retired;
    SELECT * INTO b FROM public.department_fiscal_budgets WHERE id = s.fiscal_budget_id AND org_id = p_org_id AND status = 'locked';
    IF b.id IS NULL OR EXISTS (SELECT 1 FROM public.office_budget_sections WHERE parent_id = s.id AND NOT retired) THEN
      RAISE EXCEPTION 'Choose a released leaf funding account from this office and a locked fiscal year' USING ERRCODE = '23514';
    END IF;

    section_available := GREATEST(
      0,
      s.amount
      - s.held_amount
      - eflow_budget.partition_committed(s.id)
      - eflow_project.pending_partition_reserved(s.id, p_exclude_request)
    );
    IF amount > section_available THEN
      RAISE EXCEPTION 'Funding source %: requested %, available %', s.name, amount, section_available USING ERRCODE = '23514';
    END IF;

    total := total + amount;
  END LOOP;

  -- Cumulative fiscal-budget ceiling check across all lines in this submission
  -- plus active commitments and other open pending funding requests.
  FOR fb_check IN
    SELECT b.id,
           sum((item->>'amount')::numeric) AS requested_total,
           GREATEST(
             0,
             b.approved_amount
             - eflow_budget.section_total(b.id, true)
             - COALESCE((
                 SELECT sum(bc.amount)
                 FROM public.budget_commitments bc
                 WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'
               ), 0)
             - eflow_project.pending_fiscal_reserved(b.id, p_exclude_request)
           ) AS available_total
    FROM jsonb_array_elements(p_lines) item
    JOIN public.office_budget_sections s ON s.id = (item->>'partitionId')::uuid
    JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
    GROUP BY b.id, b.approved_amount
  LOOP
    IF fb_check.requested_total > fb_check.available_total THEN
      RAISE EXCEPTION 'Office Budget has insufficient available funding' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN total;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project._validate_funding_lines(
  p_org_id uuid,
  p_lines jsonb
)
 RETURNS numeric
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT eflow_project._validate_funding_lines(p_org_id, p_lines, NULL)
$function$;

CREATE OR REPLACE FUNCTION eflow_project.save_details(p_project uuid, p_details jsonb)
 RETURNS public.projects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  leader uuid;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'You need project management access on this project to save project setup' USING ERRCODE = '42501';
  END IF;
  IF p.updated_at IS DISTINCT FROM (p_details->>'version')::timestamptz THEN
    RAISE EXCEPTION 'Project changed elsewhere. Reopen setup and review current details before saving' USING ERRCODE = '40001';
  END IF;
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
  END IF;

  RETURN p;
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

  INSERT INTO public.notifications (user_id, type, title, message, project_id, org_id, actor_id, actor_name)
  SELECT acc.id,
         'project_funding_certification',
         'Project funding certification needed',
         v_actor_name || ' submitted ₱' || to_char(total, 'FM999,999,999,990.00') || ' for "' || p.title || '". Accounting certification is required before funds are committed.',
         p.id,
         p.org_id,
         auth.uid(),
         v_actor_name
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

CREATE OR REPLACE FUNCTION eflow_project.request_funding(p_project uuid, p_lines jsonb, p_reason text, p_key uuid)
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

  SELECT COALESCE(full_name, 'Project Lead') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();
  SELECT head_user_id INTO v_head_id FROM public.organizations WHERE id = p.org_id;

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

CREATE OR REPLACE FUNCTION eflow_project._commit_authorized_funding(
  p_project uuid,
  p_lines jsonb,
  p_reason text,
  p_key uuid,
  p_certifier uuid,
  p_head_approver uuid
)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  line jsonb;
  s public.office_budget_sections;
  b public.department_fiscal_budgets;
  c uuid;
  amount numeric;
  total numeric := 0;
  payload jsonb;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR p.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Project is unavailable for funding commitment' USING ERRCODE = '23514';
  END IF;

  IF p.project_lead_id IS NULL OR btrim(p.description) = '' OR btrim(p.scope) = '' THEN
    RAISE EXCEPTION 'Save complete project details and scope before certifying funding' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.department_fiscal_budgets fb WHERE fb.org_id = p.org_id ORDER BY fb.id FOR UPDATE;
  -- Exclude p_key (the funding request currently being certified) so it is not double-counted against available balance.
  total := eflow_project._validate_funding_lines(p.org_id, p_lines, p_key);

  FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    amount := (line->>'amount')::numeric;
    SELECT * INTO s FROM public.office_budget_sections WHERE id = (line->>'partitionId')::uuid AND NOT retired;
    SELECT * INTO b FROM public.department_fiscal_budgets WHERE id = s.fiscal_budget_id AND org_id = p.org_id AND status = 'locked';

    SELECT bc.id INTO c
    FROM public.budget_commitments bc
    JOIN eflow_project.funding pf ON pf.commitment_id = bc.id
    WHERE pf.project_id = p.id AND bc.fiscal_budget_id = b.id AND bc.status = 'active'
    LIMIT 1;

    IF c IS NULL THEN
      INSERT INTO public.budget_commitments (
        fiscal_budget_id, title, amount, created_by, funding_kind, authorization_key, authorization_payload
      ) VALUES (
        b.id, 'Project: ' || p.title, 0, p_certifier, 'direct_work', gen_random_uuid(),
        jsonb_build_object('projectId', p.id, 'headApprovedBy', p_head_approver, 'certifiedBy', p_certifier)
      ) RETURNING id INTO c;
    END IF;

    INSERT INTO eflow_project.funding (project_id, commitment_id, partition_id, fiscal_year, quarter, amount)
    VALUES (p.id, c, s.id, b.fiscal_year, NULL, amount)
    ON CONFLICT (project_id, partition_id) WHERE quarter IS NULL
    DO UPDATE SET amount = eflow_project.funding.amount + EXCLUDED.amount;

    UPDATE public.budget_commitments
    SET amount = (SELECT sum(pf.amount) FROM eflow_project.funding pf WHERE pf.commitment_id = c)
    WHERE id = c;

    INSERT INTO public.budget_ledger_entries (
      fiscal_budget_id, org_id, commitment_id, entry_type, amount, description, actor_id, reason, metadata
    ) VALUES (
      b.id, p.org_id, c, 'proposal_committed', amount,
      'Project funding certified: ' || p.title, p_certifier, p_reason,
      jsonb_build_object('projectId', p.id, 'partitionId', s.id, 'headApprovedBy', p_head_approver, 'certifiedBy', p_certifier)
    );
  END LOOP;

  PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '1', true);
  UPDATE public.projects SET funding_not_required = false, updated_at = clock_timestamp() WHERE id = p.id;
  PERFORM pg_catalog.set_config('eflow.certifying_project_funding', '', true);

  payload := jsonb_build_object(
    'project', p_project,
    'lines', p_lines,
    'reason', p_reason,
    'headApprovedBy', p_head_approver,
    'certifiedBy', p_certifier,
    'authorized', total
  );
  INSERT INTO eflow_project.commands (actor_id, request_id, payload, result)
  VALUES (p_certifier, p_key, payload, jsonb_build_object('authorized', total))
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, org_id, after_data, reason)
  VALUES (p_certifier, 'project', p.id::text, 'project.funding_certified_by_accounting', p.org_id, payload, p_reason);

  RETURN total;
END;
$function$;

-- Option A: Allow drafting work plan once funding is submitted for certification (pending / pending_accounting)
-- while keeping eflow_project.ready() strict for project activation (requires certified active funding or no funding required).
CREATE OR REPLACE FUNCTION eflow_project.can_draft_work(p_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT COALESCE((
    SELECT p.setup_completed_at IS NOT NULL
       AND btrim(p.title) <> ''
       AND btrim(p.description) <> ''
       AND btrim(p.scope) <> ''
       AND (p.start_date IS NULL OR p.target_date IS NULL OR p.target_date >= p.start_date)
       AND eflow_project.lead(p.id, p.project_lead_id)
       AND (
         p.funding_not_required
         OR EXISTS (
           SELECT 1 FROM eflow_project.funding f
           JOIN public.budget_commitments c ON c.id = f.commitment_id
           WHERE f.project_id = p.id AND f.amount > 0 AND c.status = 'active'
         )
         OR EXISTS (
           SELECT 1 FROM eflow_project.funding_requests fr
           WHERE fr.project_id = p.id AND fr.status IN ('pending', 'pending_accounting')
         )
       )
    FROM public.projects p WHERE p.id = p_project
  ), false)
$function$;

CREATE OR REPLACE FUNCTION eflow_project.finish_setup(p_project uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.can_configure_project(p.id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the Office Head or project creator may finish setup' USING ERRCODE = '42501';
  END IF;
  UPDATE public.projects SET setup_completed_at = now(), updated_at = clock_timestamp() WHERE id = p.id;
  IF NOT eflow_project.can_draft_work(p.id) THEN
    RAISE EXCEPTION 'Provide title, description, scope, project lead, and submitted or certified funding (or select No funding required)' USING ERRCODE = '23514';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.guard_work()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare project uuid; t public.tasks;
begin
 if tg_table_name='tasks' then project:=new.linked_project_id;
 elsif tg_table_name='subtasks' then select * into t from public.tasks where id=new.task_id; project:=t.linked_project_id;
 elsif tg_table_name='project_office_members' then select project_id into project from public.project_offices where id=new.project_office_id;
 else project:=new.project_id; end if;
 if project is null then return new; end if;
 if tg_table_name='project_offices' and to_jsonb(new)->>'relationship_type'='lead' and exists(select 1 from public.projects p where p.id=project and p.org_id=(to_jsonb(new)->>'office_id')::uuid) then return new; end if;
 if tg_table_name in ('project_members','project_office_members','project_access_grants') and exists(select 1 from public.projects where id=project and coalesce(to_jsonb(new)->>'user_id',to_jsonb(new)->>'recipient')::uuid in (owner_id,created_by,project_lead_id)) then return new; end if;
 if not eflow_project.can_draft_work(project) then
  raise exception 'Complete project details, scope, project lead and funding setup before adding tasks, subtasks or people' using errcode='23514';
 end if;
 return new;
end
$function$;

CREATE OR REPLACE FUNCTION eflow_project.snapshot(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_uid uuid := auth.uid();
  v_is_head boolean := false;
  v_is_lead boolean := false;
  v_can_configure boolean := false;
  v_can_certify boolean := false;
  v_eligible boolean := false;
  v_has_eligible_accounting boolean := false;
  funds jsonb;
  sources jsonb;
  requests jsonb;
  total numeric;
  allocated numeric;
  released numeric;
  spent numeric;
  returned numeric;
  outstanding numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project;
  IF p.id IS NULL OR v_uid IS NULL OR NOT public.can_see_project(p.id, v_uid) THEN
    RAISE EXCEPTION 'Current project access required' USING ERRCODE = '42501';
  END IF;

  v_is_head := public.phase2_is_office_head(v_uid, p.org_id);
  v_is_lead := eflow_project.lead(p.id, v_uid);
  v_can_configure := public.can_configure_project(p.id, v_uid);
  v_can_certify := public.can_certify_project_funding(p.org_id, v_uid);
  v_eligible := eflow_r3.eligible(v_uid);

  SELECT EXISTS (
    SELECT 1 FROM public.profiles acc
    WHERE acc.org_id = p.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> v_uid
      AND acc.id IS DISTINCT FROM p.created_by
      AND acc.id IS DISTINCT FROM p.project_lead_id
  ) INTO v_has_eligible_accounting;

  SELECT COALESCE(jsonb_agg(to_jsonb(f) || jsonb_build_object(
    'name', s.name,
    'available', f.amount - COALESCE((
      SELECT sum(l.amount)
      FROM public.work_budget_allocation_lines l
      JOIN public.work_budget_allocations a ON a.id = l.allocation_id
      WHERE l.project_funding_id = f.id AND a.subtask_id IS NULL AND a.status = 'approved'
    ), 0)
  ) ORDER BY f.fiscal_year, f.quarter, s.name), '[]')
    INTO funds
  FROM eflow_project.funding f
  JOIN public.office_budget_sections s ON s.id = f.partition_id
  JOIN public.budget_commitments c ON c.id = f.commitment_id
  WHERE f.project_id = p.id AND f.amount > 0 AND c.status = 'active';

  SELECT COALESCE(sum((x->>'amount')::numeric), 0),
         COALESCE(sum((x->>'amount')::numeric - (x->>'available')::numeric), 0)
    INTO total, allocated
  FROM jsonb_array_elements(funds) x;

  SELECT COALESCE(sum(r.released_amount), 0),
         COALESCE(sum(r.actual_spent), 0),
         COALESCE(sum(r.returned_amount) FILTER (WHERE r.status = 'settled'), 0),
         COALESCE(sum(r.released_amount) FILTER (WHERE r.status <> 'settled'), 0)
    INTO released, spent, returned, outstanding
  FROM public.petty_cash_requests r
  JOIN public.tasks t ON t.id = r.task_id
  WHERE t.linked_project_id = p.id;

  IF v_is_head OR v_is_lead OR v_can_configure THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'year', b.fiscal_year,
      'fiscalBudgetId', b.id,
      'fiscalAvailable', GREATEST(
        0,
        b.approved_amount
        - eflow_budget.section_total(b.id, true)
        - COALESCE((SELECT sum(bc.amount) FROM public.budget_commitments bc WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'), 0)
        - eflow_project.pending_fiscal_reserved(b.id, NULL)
      ),
      'available', LEAST(
        GREATEST(
          0,
          s.amount
          - s.held_amount
          - eflow_budget.partition_committed(s.id)
          - eflow_project.pending_partition_reserved(s.id, NULL)
        ),
        GREATEST(
          0,
          b.approved_amount
          - eflow_budget.section_total(b.id, true)
          - COALESCE((SELECT sum(bc.amount) FROM public.budget_commitments bc WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'), 0)
          - eflow_project.pending_fiscal_reserved(b.id, NULL)
        )
      )
    ) ORDER BY b.fiscal_year, lower(s.name), s.name), '[]')
      INTO sources
    FROM public.office_budget_sections s
    JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
    WHERE b.org_id = p.org_id AND b.status = 'locked' AND NOT s.retired
      AND NOT EXISTS (SELECT 1 FROM public.office_budget_sections child WHERE child.parent_id = s.id AND NOT child.retired);

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'purpose', r.purpose, 'amount', r.requested_amount, 'status', r.status,
      'requester', pr.full_name,
      'canReview', r.status = 'pending_department_approval' AND eflow_project.reviewer(t.id, r.requester_id) = v_uid
    ) ORDER BY r.created_at DESC), '[]')
      INTO requests
    FROM public.petty_cash_requests r
    JOIN public.tasks t ON t.id = r.task_id
    LEFT JOIN public.profiles pr ON pr.id = r.requester_id
    WHERE t.linked_project_id = p.id;
  END IF;

  RETURN jsonb_build_object(
    'project', to_jsonb(p),
    'ready', eflow_project.ready(p.id),
    'canDraftWork', eflow_project.can_draft_work(p.id),
    'hasEligibleAccountingStaff', v_has_eligible_accounting,
    'canConfigure', v_can_configure,
    'canAuthorize', v_is_head,
    'canCertify', v_can_certify,
    'canAllocateTask', v_is_lead AND v_eligible,
    'canAllocate', v_is_lead OR v_is_head OR v_can_configure,
    'funds', funds,
    'sources', COALESCE(sources, '[]'),
    'requests', COALESCE(requests, '[]'),
    'total', total,
    'allocated', allocated,
    'unallocated', total - allocated,
    'released', released,
    'spent', spent,
    'returned', returned,
    'outstanding', outstanding,
    'canExtendTaskFunding', true,
    'taskFunding', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'sourceId', l.project_funding_id,
        'fiscalYear', (SELECT f.fiscal_year FROM eflow_project.funding f WHERE f.id = l.project_funding_id),
        'id', l.id, 'taskId', t.id, 'task', t.title, 'source', s.name, 'amount', l.amount,
        'available', public.task_budget_line_available(l.id, NULL)
      ))
      FROM public.work_budget_allocation_lines l
      JOIN public.work_budget_allocations a ON a.id = l.allocation_id
      JOIN public.tasks t ON t.id = a.task_id
      JOIN public.office_budget_sections s ON s.id = l.budget_partition_id
      WHERE t.linked_project_id = p.id AND a.subtask_id IS NULL AND a.status = 'approved'
        AND l.project_funding_id IS NOT NULL AND l.amount > 0
        AND public.can_see_task(t.id, v_uid)
    ), '[]'),
    'liquidations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', liq.id, 'purpose', r.purpose, 'spent', liq.declared_spent,
        'canReview', r.status = 'pending_leader_liquidation_review'
                     AND liq.status = 'pending_leader_review'
                     AND eflow_project.reviewer(t.id, r.cash_recipient_id) = v_uid
      ))
      FROM public.petty_cash_liquidations liq
      JOIN public.petty_cash_requests r ON r.id = liq.request_id
      JOIN public.tasks t ON t.id = r.task_id
      WHERE t.linked_project_id = p.id AND (v_is_lead OR v_is_head)
    ), '[]'),
    'fundingRequests', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(fr) || jsonb_build_object(
          'actorName', COALESCE(req_p.full_name, 'Staff'),
          'headApprovedByName', COALESCE(head_p.full_name, ''),
          'totalAmount', COALESCE((SELECT sum((l->>'amount')::numeric) FROM jsonb_array_elements(fr.lines) l), 0),
          'canEndorse', (v_is_head AND fr.status = 'pending'),
          'canCancel', (fr.status IN ('pending', 'pending_accounting') AND (fr.actor_id = v_uid OR v_is_head)),
          'canCertify', (
            v_can_certify
            AND fr.status = 'pending_accounting'
            AND v_uid IS DISTINCT FROM fr.actor_id
            AND v_uid IS DISTINCT FROM fr.head_approved_by
            AND v_uid IS DISTINCT FROM p.created_by
            AND v_uid IS DISTINCT FROM p.project_lead_id
          )
        )
        ORDER BY fr.created_at DESC
      )
      FROM eflow_project.funding_requests fr
      LEFT JOIN public.profiles req_p ON req_p.id = fr.actor_id
      LEFT JOIN public.profiles head_p ON head_p.id = fr.head_approved_by
      WHERE fr.project_id = p.id
        AND fr.status IN ('pending', 'pending_accounting')
        AND (fr.actor_id = v_uid OR v_is_head OR v_can_configure OR v_can_certify)
    ), '[]')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_project.office_funding_sources_preview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_is_head boolean := false;
  v_has_eligible_accounting boolean := false;
  sources jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT org_id INTO v_org_id
  FROM public.profiles
  WHERE id = v_uid AND is_active = true;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Active office profile required' USING ERRCODE = '42501';
  END IF;

  v_is_head := public.phase2_is_office_head(v_uid, v_org_id);
  IF NOT v_is_head AND NOT COALESCE(public.can_create_project_in_office(v_org_id, v_uid), false) THEN
    RAISE EXCEPTION 'Project creation access required to view office funding sources' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles acc
    WHERE acc.org_id = v_org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id <> v_uid
  ) INTO v_has_eligible_accounting;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'year', b.fiscal_year,
    'fiscalBudgetId', b.id,
    'fiscalAvailable', GREATEST(
      0,
      b.approved_amount
      - eflow_budget.section_total(b.id, true)
      - COALESCE((SELECT sum(bc.amount) FROM public.budget_commitments bc WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'), 0)
      - eflow_project.pending_fiscal_reserved(b.id, NULL)
    ),
    'available', LEAST(
      GREATEST(
        0,
        s.amount
        - s.held_amount
        - eflow_budget.partition_committed(s.id)
        - eflow_project.pending_partition_reserved(s.id, NULL)
      ),
      GREATEST(
        0,
        b.approved_amount
        - eflow_budget.section_total(b.id, true)
        - COALESCE((SELECT sum(bc.amount) FROM public.budget_commitments bc WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'), 0)
        - eflow_project.pending_fiscal_reserved(b.id, NULL)
      )
    )
  ) ORDER BY b.fiscal_year, lower(s.name), s.name), '[]')
    INTO sources
  FROM public.office_budget_sections s
  JOIN public.department_fiscal_budgets b ON b.id = s.fiscal_budget_id
  WHERE b.org_id = v_org_id AND b.status = 'locked' AND NOT s.retired
    AND NOT EXISTS (SELECT 1 FROM public.office_budget_sections child WHERE child.parent_id = s.id AND NOT child.retired);

  RETURN jsonb_build_object(
    'orgId', v_org_id,
    'canAuthorize', v_is_head,
    'hasEligibleAccountingStaff', v_has_eligible_accounting,
    'sources', COALESCE(sources, '[]')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.office_funding_sources_preview()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT eflow_project.office_funding_sources_preview()
$function$;

REVOKE ALL ON FUNCTION eflow_project.pending_partition_reserved(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION eflow_project.pending_fiscal_reserved(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION eflow_project._validate_funding_lines(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION eflow_project._validate_funding_lines(uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION eflow_project.can_draft_work(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION eflow_project.office_funding_sources_preview() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.office_funding_sources_preview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.office_funding_sources_preview() TO authenticated, service_role;
