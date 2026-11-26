-- Project Budget Closeout Gate & Immutable Archive Financial History
-- 1. Hard-blocks project completion and archiving while any unallocated project budget,
--    unused task/subtask allocation, pending funding request, pending allocation proposal,
--    or unsettled cash assignment remains.
-- 2. Auto-restores unused allocations on cancelled tasks/subtasks (with zero open cash)
--    back to the project's Unallocated pool so funds are never trapped.
-- 3. Records permanent audit_events & project_field_history entries when funds are returned
--    to Office Budget via eflow_project.release_funding.
-- 4. Computes canonical pre-activation budget, supplemental budget added, actual spent,
--    and returned-to-Office-Budget figures per source and freezes an immutable
--    financial_closeout_snapshot on completion and archive.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS financial_closeout_snapshot jsonb;

-- ---------------------------------------------------------------------------
-- 1. Canonical project financial closeout summary (live ledger + source rows)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eflow_project.financial_closeout_summary(p_project uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_cutoff timestamptz;
  v_sources jsonb := '[]'::jsonb;
  v_budget_before_activation numeric := 0;
  v_supplemental_added numeric := 0;
  v_total_certified numeric := 0;
  v_actual_spent numeric := 0;
  v_returned_to_office numeric := 0;
  v_current_allocated numeric := 0;
  v_unreturned_balance numeric := 0;
  v_unused_task_allocations numeric := 0;
  v_cash_released numeric := 0;
  v_cash_returned numeric := 0;
  v_outstanding_advances numeric := 0;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  -- Activation cutoff: published_at marks activation; if not yet activated, all certified
  -- funding counts as pre-activation budget.
  v_cutoff := p.published_at;

  WITH source_rows AS (
    SELECT
      f.id AS source_id,
      f.partition_id,
      f.commitment_id,
      f.fiscal_year,
      f.quarter,
      s.name AS source_name,
      ROUND(COALESCE(f.amount, 0), 2) AS current_amount,
      ROUND(COALESCE((
        SELECT SUM(ble.amount)
        FROM public.budget_ledger_entries ble
        WHERE ble.entry_type = 'proposal_committed'
          AND (ble.metadata->>'projectId' = p.id::text OR ble.commitment_id = f.commitment_id)
          AND (
            ble.metadata->>'partitionId' = f.partition_id::text
            OR ble.metadata->>'sourceId' = f.id::text
          )
          AND (v_cutoff IS NULL OR ble.created_at <= v_cutoff)
      ), 0), 2) AS ledger_before_activation,
      ROUND(COALESCE((
        SELECT SUM(ble.amount)
        FROM public.budget_ledger_entries ble
        WHERE ble.entry_type = 'proposal_committed'
          AND (ble.metadata->>'projectId' = p.id::text OR ble.commitment_id = f.commitment_id)
          AND (
            ble.metadata->>'partitionId' = f.partition_id::text
            OR ble.metadata->>'sourceId' = f.id::text
          )
          AND v_cutoff IS NOT NULL
          AND ble.created_at > v_cutoff
      ), 0), 2) AS ledger_supplemental,
      ROUND(COALESCE((
        SELECT SUM(ble.amount)
        FROM public.budget_ledger_entries ble
        WHERE ble.entry_type = 'proposal_released'
          AND (ble.metadata->>'projectId' = p.id::text OR ble.commitment_id = f.commitment_id)
          AND (
            ble.metadata->>'sourceId' = f.id::text
            OR (ble.metadata->>'sourceId' IS NULL AND ble.metadata->>'partitionId' = f.partition_id::text)
          )
      ), 0), 2) AS returned_to_office,
      (
        SELECT MAX(ble.created_at)
        FROM public.budget_ledger_entries ble
        WHERE ble.entry_type = 'proposal_released'
          AND (ble.metadata->>'projectId' = p.id::text OR ble.commitment_id = f.commitment_id)
          AND (
            ble.metadata->>'sourceId' = f.id::text
            OR (ble.metadata->>'sourceId' IS NULL AND ble.metadata->>'partitionId' = f.partition_id::text)
          )
      ) AS last_returned_at,
      (
        SELECT COALESCE(pr.full_name, 'Office Head')
        FROM public.budget_ledger_entries ble
        LEFT JOIN public.profiles pr ON pr.id = ble.actor_id
        WHERE ble.entry_type = 'proposal_released'
          AND (ble.metadata->>'projectId' = p.id::text OR ble.commitment_id = f.commitment_id)
          AND (
            ble.metadata->>'sourceId' = f.id::text
            OR (ble.metadata->>'sourceId' IS NULL AND ble.metadata->>'partitionId' = f.partition_id::text)
          )
        ORDER BY ble.created_at DESC, ble.id DESC
        LIMIT 1
      ) AS last_returned_by_name,
      ROUND(COALESCE((
        SELECT SUM(l.amount)
        FROM public.work_budget_allocation_lines l
        JOIN public.work_budget_allocations a ON a.id = l.allocation_id
        WHERE l.project_funding_id = f.id
          AND a.subtask_id IS NULL
          AND a.status = 'approved'
      ), 0), 2) AS allocated_to_tasks,
      ROUND(COALESCE((
        SELECT SUM(public.task_budget_line_available(l.id, NULL))
        FROM public.work_budget_allocation_lines l
        JOIN public.work_budget_allocations a ON a.id = l.allocation_id
        JOIN public.tasks t ON t.id = a.task_id
        WHERE l.project_funding_id = f.id
          AND a.subtask_id IS NULL
          AND a.status = 'approved'
          AND t.linked_project_id = p.id
      ), 0), 2) AS unused_task_alloc,
      ROUND(COALESCE((
        SELECT SUM(spent_item.amount)
        FROM (
          SELECT eflow_budget.request_line_obligation(r.id, rl.allocation_line_id) AS amount
          FROM public.petty_cash_requests r
          JOIN public.tasks t ON t.id = r.task_id
          JOIN public.petty_cash_request_lines rl ON rl.request_id = r.id
          JOIN public.work_budget_allocation_lines l ON l.id = rl.allocation_line_id
          JOIN public.work_budget_allocations a ON a.id = l.allocation_id
          LEFT JOIN public.work_budget_allocation_lines parent_l ON parent_l.id = a.parent_allocation_line_id
          WHERE t.linked_project_id = p.id
            AND r.status = 'settled'
            AND COALESCE(l.project_funding_id, parent_l.project_funding_id) = f.id
          UNION ALL
          SELECT COALESCE(r.actual_spent, 0) AS amount
          FROM public.petty_cash_requests r
          JOIN public.tasks t ON t.id = r.task_id
          JOIN public.work_budget_allocation_lines l ON l.id = r.allocation_line_id
          JOIN public.work_budget_allocations a ON a.id = l.allocation_id
          LEFT JOIN public.work_budget_allocation_lines parent_l ON parent_l.id = a.parent_allocation_line_id
          WHERE t.linked_project_id = p.id
            AND r.status = 'settled'
            AND NOT EXISTS (
              SELECT 1 FROM public.petty_cash_request_lines rl WHERE rl.request_id = r.id
            )
            AND COALESCE(l.project_funding_id, parent_l.project_funding_id) = f.id
        ) spent_item
      ), 0), 2) AS source_actual_spent
    FROM eflow_project.funding f
    JOIN public.office_budget_sections s ON s.id = f.partition_id
    JOIN public.budget_commitments c ON c.id = f.commitment_id AND c.status = 'active'
    WHERE f.project_id = p.id
  ),
  normalized AS (
    SELECT
      sr.*,
      CASE
        WHEN ROUND(sr.ledger_before_activation + sr.ledger_supplemental, 2) > 0
          THEN sr.ledger_before_activation
        ELSE ROUND(sr.current_amount + sr.returned_to_office, 2)
      END AS budget_before_activation,
      CASE
        WHEN ROUND(sr.ledger_before_activation + sr.ledger_supplemental, 2) > 0
          THEN sr.ledger_supplemental
        ELSE 0::numeric
      END AS supplemental_added,
      CASE
        WHEN ROUND(sr.ledger_before_activation + sr.ledger_supplemental, 2) > 0
          THEN ROUND(sr.ledger_before_activation + sr.ledger_supplemental, 2)
        ELSE ROUND(sr.current_amount + sr.returned_to_office, 2)
      END AS total_certified,
      GREATEST(0, ROUND(sr.current_amount - sr.allocated_to_tasks, 2)) AS unreturned_unallocated
    FROM source_rows sr
    WHERE sr.current_amount > 0
       OR sr.returned_to_office > 0
       OR sr.ledger_before_activation > 0
       OR sr.ledger_supplemental > 0
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'sourceId', n.source_id,
      'partitionId', n.partition_id,
      'name', n.source_name,
      'fiscalYear', n.fiscal_year,
      'quarter', n.quarter,
      'budgetBeforeActivation', n.budget_before_activation,
      'supplementalAdded', n.supplemental_added,
      'totalCertified', n.total_certified,
      'currentCertified', n.current_amount,
      'allocatedToTasks', n.allocated_to_tasks,
      'actualSpent', n.source_actual_spent,
      'returnedToOfficeBudget', n.returned_to_office,
      'unreturnedBalance', n.unreturned_unallocated,
      'unusedTaskAllocations', n.unused_task_alloc,
      'lastReturnedAt', n.last_returned_at,
      'lastReturnedByName', COALESCE(n.last_returned_by_name, '')
    ) ORDER BY n.fiscal_year, n.quarter NULLS FIRST, lower(n.source_name), n.source_name), '[]'::jsonb),
    ROUND(COALESCE(SUM(n.budget_before_activation), 0), 2),
    ROUND(COALESCE(SUM(n.supplemental_added), 0), 2),
    ROUND(COALESCE(SUM(n.total_certified), 0), 2),
    ROUND(COALESCE(SUM(n.returned_to_office), 0), 2),
    ROUND(COALESCE(SUM(n.allocated_to_tasks), 0), 2),
    ROUND(COALESCE(SUM(n.unreturned_unallocated), 0), 2),
    ROUND(COALESCE(SUM(n.unused_task_alloc), 0), 2)
  INTO
    v_sources,
    v_budget_before_activation,
    v_supplemental_added,
    v_total_certified,
    v_returned_to_office,
    v_current_allocated,
    v_unreturned_balance,
    v_unused_task_allocations
  FROM normalized n;

  SELECT
    ROUND(COALESCE(SUM(r.released_amount), 0), 2),
    ROUND(COALESCE(SUM(r.actual_spent) FILTER (WHERE r.status = 'settled'), 0), 2),
    ROUND(COALESCE(SUM(r.returned_amount) FILTER (WHERE r.status = 'settled'), 0), 2),
    ROUND(COALESCE(SUM(r.released_amount) FILTER (WHERE r.status NOT IN ('settled', 'rejected', 'cancelled')), 0), 2)
  INTO v_cash_released, v_actual_spent, v_cash_returned, v_outstanding_advances
  FROM public.petty_cash_requests r
  JOIN public.tasks t ON t.id = r.task_id
  WHERE t.linked_project_id = p.id;

  RETURN jsonb_build_object(
    'projectId', p.id,
    'projectTitle', p.title,
    'status', p.status,
    'fundingNotRequired', COALESCE(p.funding_not_required, false),
    'activatedAt', p.published_at,
    'completedAt', p.completed_at,
    'archivedAt', p.archived_at,
    'budgetBeforeActivation', v_budget_before_activation,
    'supplementalBudgetAdded', v_supplemental_added,
    'totalCertifiedBudget', v_total_certified,
    'actualSpent', v_actual_spent,
    'returnedToOfficeBudget', v_returned_to_office,
    'allocatedToTasks', v_current_allocated,
    'unreturnedBalance', v_unreturned_balance,
    'unusedTaskAllocations', v_unused_task_allocations,
    'taskCashReleased', v_cash_released,
    'taskCashReturned', v_cash_returned,
    'outstandingAdvances', v_outstanding_advances,
    'isFullyReconciled', (
      ROUND(v_unreturned_balance * 100) = 0
      AND ROUND(v_unused_task_allocations * 100) = 0
      AND ROUND(v_outstanding_advances * 100) = 0
      AND ROUND(v_total_certified * 100) = ROUND((v_actual_spent + v_returned_to_office) * 100)
    ),
    'sources', v_sources
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_project_financial_closeout_summary(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  v_live jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_see_project(p_project_id, auth.uid()) THEN
    RAISE EXCEPTION 'Current project access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.projects WHERE id = p_project_id;
  IF p.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;

  IF p.status IN ('completed', 'archived') AND p.financial_closeout_snapshot IS NOT NULL THEN
    RETURN p.financial_closeout_snapshot || jsonb_build_object(
      'status', p.status,
      'completedAt', COALESCE(p.completed_at, (p.financial_closeout_snapshot->>'completedAt')::timestamptz),
      'archivedAt', COALESCE(p.archived_at, (p.financial_closeout_snapshot->>'archivedAt')::timestamptz)
    );
  END IF;

  v_live := eflow_project.financial_closeout_summary(p.id);
  RETURN v_live;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_project_financial_closeout_summary(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Auto-restore unused task/subtask allocations on cancellation too
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eflow_work_clearance.restore(p_root uuid, p_node uuid, p_request uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  cap public.work_budget_allocations;
  line public.work_budget_allocation_lines;
  t public.tasks;
  unused numeric;
  remaining numeric;
  allowance numeric;
  total numeric;
  allowances jsonb := '{}';
  funding_line record;
BEGIN
  PERFORM eflow_r7.lock_impact(p_root);
  SELECT * INTO t FROM public.tasks WHERE id = p_root;
  PERFORM 1 FROM public.projects WHERE id = t.linked_project_id FOR UPDATE;
  IF t.id IS NULL OR eflow_work_clearance.cash_open(p_root, p_node) THEN
    RETURN;
  END IF;
  IF NOT eflow_work_clearance.accepted(p_root, p_node) AND NOT (
    CASE
      WHEN p_node IS NULL THEN t.status IN ('completed', 'cancelled')
      ELSE EXISTS (
        SELECT 1 FROM public.subtasks s
        WHERE s.id = p_node AND s.task_id = p_root AND s.status IN ('completed', 'cancelled')
      )
    END
  ) THEN
    RETURN;
  END IF;

  FOR cap IN
    SELECT * FROM public.work_budget_allocations a
    WHERE a.task_id = p_root
      AND a.subtask_id IS NOT NULL
      AND (p_node IS NULL OR a.subtask_id = p_node)
      AND a.status IN ('pending', 'approved')
    ORDER BY a.id
    FOR UPDATE
  LOOP
    unused := public.subtask_cap_available(cap.id);
    IF unused > 0 THEN
      IF cap.parent_allocation_line_id IS NULL THEN
        RAISE EXCEPTION 'Unused subtask funding cannot be restored: its original parent funding source is missing' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (
        SELECT 1
        FROM public.work_budget_allocation_lines parent_line
        JOIN eflow_project.funding f ON f.id = parent_line.project_funding_id
        WHERE parent_line.id = cap.parent_allocation_line_id
          AND f.project_id = t.linked_project_id
      ) THEN
        RAISE EXCEPTION 'Unused subtask funding cannot be restored: its original parent funding source is missing'
          USING ERRCODE = '22023',
            DETAIL = jsonb_build_object('dependency', 'project_funding_binding', 'taskId', p_root, 'allocationId', cap.id, 'lineId', cap.parent_allocation_line_id)::text;
      END IF;
      remaining := ROUND(cap.amount - unused, 2);
      UPDATE public.work_budget_allocations
      SET amount = CASE WHEN remaining > 0 THEN remaining ELSE amount END,
          status = CASE WHEN remaining = 0 THEN 'cancelled' ELSE status END,
          decision_reason = 'Unused funding automatically restored after financial clearance',
          updated_at = now()
      WHERE id = cap.id;
      UPDATE public.work_budget_allocation_lines
      SET amount = remaining, unit_cost = remaining
      WHERE allocation_id = cap.id;
      allowances := jsonb_set(
        allowances,
        ARRAY[cap.parent_allocation_line_id::text],
        to_jsonb(COALESCE((allowances->>cap.parent_allocation_line_id::text)::numeric, 0) + unused)
      );
      INSERT INTO public.audit_events(actor_id, entity_type, entity_id, action, org_id, before_data, after_data)
      VALUES (
        auth.uid(), 'subtask', cap.subtask_id::text, 'project.subtask_unused_funding_restored', t.org_id,
        jsonb_build_object('allocationId', cap.id, 'amount', cap.amount),
        jsonb_build_object('amount', remaining, 'projectId', t.linked_project_id)
      );
    END IF;
  END LOOP;

  IF p_node IS NOT NULL AND p_request IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.petty_cash_requests r
    JOIN public.work_budget_allocations a ON a.id = r.allocation_id
    WHERE r.id = p_request AND a.subtask_id IS NULL
  ) THEN
    FOR funding_line IN
      SELECT rl.allocation_line_id,
             GREATEST(0, rl.amount - eflow_budget.request_line_obligation(p_request, rl.allocation_line_id)) AS unused
      FROM public.petty_cash_request_lines rl
      WHERE rl.request_id = p_request
    LOOP
      allowances := jsonb_set(
        allowances,
        ARRAY[funding_line.allocation_line_id::text],
        to_jsonb(COALESCE((allowances->>funding_line.allocation_line_id::text)::numeric, 0) + funding_line.unused)
      );
    END LOOP;
  END IF;

  IF p_node IS NULL AND EXISTS (
    SELECT 1
    FROM public.work_budget_allocation_lines l
    JOIN public.work_budget_allocations a ON a.id = l.allocation_id
    WHERE a.task_id = p_root
      AND a.subtask_id IS NULL
      AND a.status = 'approved'
      AND public.task_budget_line_available(l.id, NULL) > 0
      AND NOT EXISTS (
        SELECT 1 FROM eflow_project.funding f
        WHERE f.id = l.project_funding_id AND f.project_id = t.linked_project_id
      )
  ) THEN
    RAISE EXCEPTION 'Unused subtask funding cannot be restored: its original parent funding source is missing'
      USING ERRCODE = '22023',
        DETAIL = jsonb_build_object('dependency', 'project_funding_binding', 'taskId', p_root)::text;
  END IF;

  FOR line IN
    SELECT l.*
    FROM public.work_budget_allocation_lines l
    JOIN public.work_budget_allocations a ON a.id = l.allocation_id
    WHERE a.task_id = p_root
      AND a.subtask_id IS NULL
      AND a.status = 'approved'
      AND l.project_funding_id IS NOT NULL
    ORDER BY l.id
    FOR UPDATE OF l
  LOOP
    unused := public.task_budget_line_available(line.id, NULL);
    allowance := COALESCE((allowances->>line.id::text)::numeric, 0);
    IF p_node IS NOT NULL THEN
      unused := LEAST(unused, allowance);
    END IF;
    IF unused > 0 THEN
      UPDATE public.work_budget_allocation_lines
      SET amount = ROUND(amount - unused, 2),
          unit_cost = GREATEST(0, ROUND(unit_cost - unused, 2))
      WHERE id = line.id;
      SELECT COALESCE(SUM(amount), 0) INTO total
      FROM public.work_budget_allocation_lines
      WHERE allocation_id = line.allocation_id;
      UPDATE public.work_budget_allocations
      SET amount = CASE WHEN total > 0 THEN total ELSE amount END,
          status = CASE WHEN total = 0 THEN 'cancelled' ELSE status END,
          decision_reason = 'Unused funding automatically restored to the same project',
          updated_at = now()
      WHERE id = line.allocation_id;
      INSERT INTO public.audit_events(actor_id, entity_type, entity_id, action, org_id, before_data, after_data)
      VALUES (
        auth.uid(), 'task', p_root::text, 'project.unused_funding_restored_automatically', t.org_id,
        jsonb_build_object('lineId', line.id, 'amount', line.amount),
        jsonb_build_object('amount', ROUND(line.amount - unused, 2), 'returned', unused, 'projectId', t.linked_project_id)
      );
    END IF;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_work_clearance.after_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF new.status IN ('completed', 'cancelled') AND old.status IS DISTINCT FROM new.status THEN
    IF tg_table_name = 'tasks' THEN
      PERFORM eflow_work_clearance.restore(new.id, NULL);
    ELSE
      PERFORM eflow_work_clearance.restore(new.task_id, new.id);
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_work_clearance.before_project_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  task record;
BEGIN
  IF new.status = 'completed' AND old.status IS DISTINCT FROM 'completed' THEN
    FOR task IN
      SELECT id FROM public.tasks
      WHERE linked_project_id = new.id
        AND deleted_at IS NULL
        AND status IN ('completed', 'cancelled')
      ORDER BY id
    LOOP
      PERFORM eflow_work_clearance.restore(task.id, NULL);
    END LOOP;
  END IF;
  RETURN new;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Permanent audit trail & history on Return to Office Budget
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eflow_project.release_funding(
  p_project uuid,
  p_source uuid,
  p_amount numeric,
  p_reason text,
  p_key uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.projects;
  f eflow_project.funding;
  s public.office_budget_sections;
  used numeric;
  b uuid;
  receipt eflow_project.commands;
  payload jsonb;
  v_actor_name text;
  v_unallocated_before numeric;
  v_amount_after numeric;
  v_unallocated_after numeric;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = p_project FOR UPDATE;
  IF p.id IS NULL OR auth.uid() IS NULL OR NOT public.phase2_is_office_head(auth.uid(), p.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Head may release unused project funding' USING ERRCODE = '42501';
  END IF;
  IF p.status = 'archived' THEN
    RAISE EXCEPTION 'Archived project funding is read-only' USING ERRCODE = '23514';
  END IF;

  payload := jsonb_build_object(
    'project', p_project,
    'source', p_source,
    'amount', p_amount,
    'reason', p_reason
  );
  SELECT * INTO receipt FROM eflow_project.commands WHERE actor_id = auth.uid() AND request_id = p_key;
  IF FOUND THEN
    IF receipt.payload <> payload THEN
      RAISE EXCEPTION 'Release request terms changed' USING ERRCODE = '23514';
    END IF;
    RETURN;
  END IF;

  SELECT * INTO f FROM eflow_project.funding WHERE id = p_source AND project_id = p.id FOR UPDATE;
  IF f.id IS NULL
     OR p_amount IS NULL
     OR p_amount <= 0
     OR ROUND(p_amount, 2) <> p_amount
     OR btrim(COALESCE(p_reason, '')) = ''
     OR p_key IS NULL THEN
    RAISE EXCEPTION 'Choose a project funding source, positive amount and release reason' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO s FROM public.office_budget_sections WHERE id = f.partition_id;

  SELECT COALESCE(SUM(l.amount), 0) INTO used
  FROM public.work_budget_allocation_lines l
  JOIN public.work_budget_allocations a ON a.id = l.allocation_id
  WHERE l.project_funding_id = f.id
    AND a.status = 'approved'
    AND a.subtask_id IS NULL;

  v_unallocated_before := ROUND(f.amount - used, 2);
  IF p_amount > v_unallocated_before THEN
    RAISE EXCEPTION 'Only % remains unallocated; release the unused task allocations first', v_unallocated_before
      USING ERRCODE = '23514';
  END IF;

  SELECT fiscal_budget_id INTO b FROM public.budget_commitments WHERE id = f.commitment_id FOR UPDATE;

  v_amount_after := ROUND(f.amount - p_amount, 2);
  v_unallocated_after := ROUND(v_unallocated_before - p_amount, 2);

  UPDATE eflow_project.funding SET amount = v_amount_after WHERE id = f.id;
  UPDATE public.budget_commitments SET amount = ROUND(amount - p_amount, 2), updated_at = now() WHERE id = f.commitment_id;

  SELECT COALESCE(full_name, 'Office Head') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.budget_ledger_entries(
    fiscal_budget_id, org_id, commitment_id, entry_type, amount, description, actor_id, actor_role, reason, metadata
  ) VALUES (
    b,
    p.org_id,
    f.commitment_id,
    'proposal_released',
    p_amount,
    'Unused project funding returned to Office Budget: ' || COALESCE(s.name, 'Funding source') || ' (FY ' || f.fiscal_year || ')',
    auth.uid(),
    'head',
    btrim(p_reason),
    jsonb_build_object(
      'projectId', p.id,
      'projectTitle', p.title,
      'sourceId', p_source,
      'partitionId', f.partition_id,
      'sourceName', COALESCE(s.name, 'Funding source'),
      'fiscalYear', f.fiscal_year,
      'amountBefore', f.amount,
      'amountAfter', v_amount_after
    )
  );

  INSERT INTO public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id
  ) VALUES (
    auth.uid(),
    v_actor_name,
    'project',
    p.id::text,
    'project.funding_returned_to_office_budget',
    btrim(p_reason),
    jsonb_build_object(
      'sourceId', f.id,
      'partitionId', f.partition_id,
      'sourceName', COALESCE(s.name, 'Funding source'),
      'fiscalYear', f.fiscal_year,
      'certifiedBefore', f.amount,
      'unallocatedBefore', v_unallocated_before
    ),
    jsonb_build_object(
      'sourceId', f.id,
      'partitionId', f.partition_id,
      'sourceName', COALESCE(s.name, 'Funding source'),
      'fiscalYear', f.fiscal_year,
      'returnedAmount', p_amount,
      'certifiedAfter', v_amount_after,
      'unallocatedAfter', v_unallocated_after
    ),
    p.org_id
  );

  INSERT INTO public.project_field_history(project_id, task_id, title, detail, actor_name)
  VALUES (
    p.id,
    NULL,
    'Unused project funding returned to Office Budget',
    COALESCE(s.name, 'Funding source') || ' (FY ' || f.fiscal_year || '): Returned ₱'
      || to_char(p_amount, 'FM999,999,999,990.00')
      || ' to Office Budget. Reason: ' || btrim(p_reason),
    v_actor_name
  );

  INSERT INTO eflow_project.commands VALUES (auth.uid(), p_key, payload, jsonb_build_object('returnedAmount', p_amount));
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Guard financial_closeout_snapshot & reset on archive restore
-- ---------------------------------------------------------------------------
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

  IF new.financial_closeout_snapshot IS DISTINCT FROM old.financial_closeout_snapshot
     AND pg_catalog.current_setting('eflow.updating_closeout_snapshot', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Financial closeout records are sealed automatically by completion and archive workflows' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION eflow_seal.completion_clock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF new.status = 'completed' AND old.status IS DISTINCT FROM 'completed' THEN
    new.completed_at := now();
    new.archive_reminded_at := NULL;
    new.archive_blocked_at := NULL;
  ELSIF new.status NOT IN ('completed', 'archived') THEN
    new.completed_at := NULL;
    new.archive_reminded_at := NULL;
    new.archive_blocked_at := NULL;
    new.financial_closeout_snapshot := NULL;
  ELSE
    new.completed_at := old.completed_at;
    IF auth.uid() IS NOT NULL THEN
      new.archive_reminded_at := old.archive_reminded_at;
      new.archive_blocked_at := old.archive_blocked_at;
    END IF;
  END IF;
  RETURN new;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Hard closeout validation gate in pre_subtask_budget_closeout
-- ---------------------------------------------------------------------------
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
  unallocated numeric := 0;
  returnable numeric := 0;
  task_lines jsonb := '[]'::jsonb;
  unallocated_sources jsonb := '[]'::jsonb;
  v_head_id uuid;
  v_lead_name text;
  v_req_name text;
  v_rev_name text;
  v_lead_active_non_head boolean := false;
  v_requires_handover boolean := false;
  v_work_blockers_count integer := 0;
  v_uid uuid := auth.uid();
  v_is_head boolean := false;
  v_closeout_summary jsonb;
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

  -- Unsettled separate Office Petty Cash assignments on any task/subtask of this project
  blockers := blockers || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'kind', 'cash',
      'id', wca.id,
      'taskId', t.id,
      'title', 'Office Petty Cash · ' || t.title || COALESCE(' → ' || s.title, ''),
      'status', COALESCE(wca.receipt_review_status, 'pending'),
      'amount', wca.amount,
      'detail', 'Obtain Accounting settlement for this Office Petty Cash assignment before completing or archiving the project.'
    ) ORDER BY wca.created_at, wca.id)
    FROM public.work_cash_assignments wca
    JOIN public.tasks t ON t.id = wca.task_id
    LEFT JOIN public.subtasks s ON s.id = wca.subtask_id
    WHERE t.linked_project_id = p.id
      AND wca.status = 'active'
      AND wca.source_kind = 'office_petty_cash'
      AND wca.receipt_review_status <> 'approved'
  ), '[]'::jsonb);

  -- Pending project funding certification requests
  blockers := blockers || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'kind', 'funding',
      'id', fr.id,
      'title', 'Pending project funding certification request',
      'status', fr.status,
      'amount', ROUND(COALESCE((SELECT SUM((ln->>'amount')::numeric) FROM jsonb_array_elements(fr.lines) ln), 0), 2),
      'detail', 'Withdraw or resolve this open project funding request in the Budget tab before completing or archiving the project.'
    ) ORDER BY fr.created_at, fr.id)
    FROM eflow_project.funding_requests fr
    WHERE fr.project_id = p.id
      AND fr.status IN ('pending', 'pending_accounting')
  ), '[]'::jsonb);

  -- Pending task/subtask allocation proposals
  blockers := blockers || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'kind', 'funding',
      'id', a.id,
      'taskId', t.id,
      'title', 'Pending budget allocation · ' || t.title || COALESCE(' → ' || s.title, ''),
      'status', a.status,
      'amount', a.amount,
      'detail', 'Approve or cancel this pending budget allocation proposal before completing or archiving the project.'
    ) ORDER BY a.requested_at, a.id)
    FROM public.work_budget_allocations a
    JOIN public.tasks t ON t.id = a.task_id
    LEFT JOIN public.subtasks s ON s.id = a.subtask_id
    WHERE t.linked_project_id = p.id
      AND a.status = 'pending'
  ), '[]'::jsonb);

  -- Unused task allocations & unreturned project funding (checked for open AND completed projects so archive is also guarded)
  IF p.status IN ('planning', 'active', 'on_hold', 'completed') THEN
    WITH active_funds AS MATERIALIZED (
      SELECT f.id, f.amount, f.fiscal_year, f.partition_id, s.name AS source_name
      FROM eflow_project.funding f
      JOIN public.budget_commitments c ON c.id = f.commitment_id AND c.status = 'active'
      JOIN public.office_budget_sections s ON s.id = f.partition_id
      WHERE f.project_id = p.id AND f.amount > 0
    ),
    task_allocations AS MATERIALIZED (
      SELECT
        f.id AS funding_id,
        l.id,
        l.amount,
        t.id AS task_id,
        t.title,
        f.source_name AS name,
        f.fiscal_year,
        CASE
          WHEN t.linked_project_id = p.id THEN ROUND(public.task_budget_line_available(l.id, NULL), 2)
          ELSE 0::numeric
        END AS available
      FROM active_funds f
      JOIN public.work_budget_allocation_lines l ON l.project_funding_id = f.id
      JOIN public.work_budget_allocations a ON a.id = l.allocation_id AND a.subtask_id IS NULL AND a.status = 'approved'
      LEFT JOIN public.tasks t ON t.id = a.task_id
    ),
    source_unallocated AS (
      SELECT
        f.id AS source_id,
        f.source_name AS name,
        f.fiscal_year,
        GREATEST(0, ROUND(f.amount - COALESCE(allocated.amount, 0), 2)) AS available
      FROM active_funds f
      LEFT JOIN (
        SELECT funding_id, SUM(amount) AS amount
        FROM task_allocations
        GROUP BY funding_id
      ) allocated ON allocated.funding_id = f.id
    )
    SELECT
      ROUND(COALESCE((SELECT SUM(su.available) FROM source_unallocated su), 0), 2),
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', su.source_id,
          'source', su.name,
          'fiscalYear', su.fiscal_year,
          'available', su.available
        ) ORDER BY su.fiscal_year, lower(su.name), su.name)
        FROM source_unallocated su
        WHERE su.available > 0
      ), '[]'::jsonb),
      ROUND(COALESCE((SELECT SUM(ta.available) FROM task_allocations ta), 0), 2),
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', ta.id,
          'taskId', ta.task_id,
          'task', COALESCE(ta.title, 'Task allocation'),
          'source', ta.name,
          'fiscalYear', ta.fiscal_year,
          'available', ta.available
        ) ORDER BY ta.title, ta.name, ta.id)
        FROM task_allocations ta
        WHERE ta.available > 0
      ), '[]'::jsonb)
    INTO unallocated, unallocated_sources, returnable, task_lines;

    IF ROUND(COALESCE(returnable, 0) * 100) > 0 THEN
      blockers := blockers || jsonb_build_array(jsonb_build_object(
        'kind', 'funding',
        'id', p.id,
        'title', 'Unused task funding must be returned to the project budget',
        'status', 'unused_task_funding',
        'amount', returnable,
        'detail', 'Return all remaining unused task budget allocations (₱' || to_char(returnable, 'FM999,999,999,990.00') || ') to the project budget in the Budget tab, then return unused project funding to the Office Budget.',
        'unusedFunding', jsonb_build_object(
          'unallocated', 0,
          'taskAllocations', task_lines,
          'unallocatedSources', '[]'::jsonb
        )
      ));
    END IF;
  END IF;

  -- Delivery/task/cash blockers that a non-Head Project Lead must clear before requesting Head review
  v_work_blockers_count := jsonb_array_length(blockers);

  -- HARD BLOCKER: All unallocated project funding MUST be manually returned to Office Budget before completion or archiving
  IF p.status IN ('planning', 'active', 'on_hold', 'completed') AND ROUND(COALESCE(unallocated, 0) * 100) > 0 THEN
    blockers := blockers || jsonb_build_array(jsonb_build_object(
      'kind', 'funding',
      'id', p.id,
      'title', 'Unused project budget must be returned to Office Budget',
      'status', 'unreturned_project_funding',
      'amount', unallocated,
      'detail', 'The Office Head must manually return all remaining unallocated project funds (₱' || to_char(unallocated, 'FM999,999,999,990.00') || ') to the Office Budget via the Budget tab before marking this project complete.',
      'unusedFunding', jsonb_build_object(
        'unallocated', unallocated,
        'taskAllocations', '[]'::jsonb,
        'unallocatedSources', unallocated_sources
      )
    ));
  END IF;

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
  v_closeout_summary := CASE
    WHEN p.status IN ('completed', 'archived') AND p.financial_closeout_snapshot IS NOT NULL THEN p.financial_closeout_snapshot
    ELSE eflow_project.financial_closeout_summary(p.id)
  END;

  RETURN result || jsonb_build_object(
    'blockers', blockers,
    'canComplete', p.status IN ('planning', 'active', 'on_hold') AND jsonb_array_length(blockers) = 0,
    'workBlockersCount', v_work_blockers_count,
    'unreturnedProjectFunding', unallocated,
    'financialCloseoutSummary', v_closeout_summary,
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

-- ---------------------------------------------------------------------------
-- 6. Hard completion & archive enforcement + immutable snapshot sealing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_project(p_project_id uuid, p_note text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  project_row public.projects;
  v_readiness jsonb;
  v_closeout jsonb;
  v_actor_name text;
  v_notify_id uuid;
BEGIN
  SELECT * INTO project_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF project_row.id IS NULL THEN
    RAISE EXCEPTION 'Project not found' USING ERRCODE = 'P0002';
  END IF;
  IF project_row.status = 'completed' THEN
    RETURN;
  END IF;
  IF project_row.status = 'archived' THEN
    RAISE EXCEPTION 'This project is already archived' USING ERRCODE = '22023';
  END IF;
  IF NOT public.phase2_is_office_head(auth.uid(), project_row.org_id) THEN
    RAISE EXCEPTION 'Only the appointed Head can approve project completion' USING ERRCODE = '42501';
  END IF;

  v_readiness := public.get_project_completion_readiness(p_project_id);
  IF NOT COALESCE((v_readiness->>'canComplete')::boolean, false)
     OR jsonb_array_length(COALESCE(v_readiness->'blockers', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Project closeout is blocked: %',
      COALESCE(v_readiness->'blockers'->0->>'title', 'Resolve all completion requirements first')
      USING ERRCODE = '22023',
        DETAIL = COALESCE(v_readiness->'blockers', '[]'::jsonb)::text;
  END IF;

  v_closeout := eflow_project.financial_closeout_summary(p_project_id);
  IF ROUND(COALESCE((v_closeout->>'unreturnedBalance')::numeric, 0) * 100) <> 0
     OR ROUND(COALESCE((v_closeout->>'unusedTaskAllocations')::numeric, 0) * 100) <> 0
     OR ROUND(COALESCE((v_closeout->>'outstandingAdvances')::numeric, 0) * 100) <> 0
     OR ROUND(COALESCE((v_closeout->>'totalCertifiedBudget')::numeric, 0) * 100)
        <> ROUND((COALESCE((v_closeout->>'actualSpent')::numeric, 0)
                + COALESCE((v_closeout->>'returnedToOfficeBudget')::numeric, 0)) * 100) THEN
    RAISE EXCEPTION 'Cannot complete project until all unused project funding is manually returned to the Office Budget (₱% unreturned).',
      to_char(COALESCE((v_closeout->>'unreturnedBalance')::numeric, 0), 'FM999,999,999,990.00')
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(full_name, 'Office Head') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  v_closeout := v_closeout || jsonb_build_object(
    'status', 'completed',
    'completedAt', now(),
    'capturedAt', now(),
    'capturedStage', 'completed',
    'capturedBy', auth.uid(),
    'capturedByName', v_actor_name
  );

  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '1', true);
  PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '1', true);
  UPDATE public.projects
  SET status = 'completed',
      financial_closeout_snapshot = v_closeout,
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
  PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '', true);
  PERFORM pg_catalog.set_config('eflow.updating_completion_review', '', true);

  INSERT INTO public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id)
  VALUES (
    auth.uid(),
    v_actor_name,
    'project',
    p_project_id::text,
    'project.completed',
    NULLIF(btrim(p_note), ''),
    jsonb_build_object('status', project_row.status, 'completionReviewStatus', project_row.completion_review_status),
    jsonb_build_object(
      'status', 'completed',
      'completionReviewStatus', CASE WHEN project_row.completion_review_status = 'requested' THEN 'approved' ELSE project_row.completion_review_status END,
      'financialCloseout', v_closeout
    ),
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

CREATE OR REPLACE FUNCTION public.archive_completed_project(p_project_id uuid, p_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  project_row public.projects;
  v_readiness jsonb;
  v_closeout jsonb;
  v_actor_name text;
BEGIN
  v_readiness := public.get_project_completion_readiness(p_project_id);
  SELECT * INTO project_row FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF project_row.status = 'archived' THEN
    RETURN;
  END IF;
  IF project_row.status <> 'completed' THEN
    RAISE EXCEPTION 'Complete the project before archiving it' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(COALESCE(v_readiness->'blockers', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Project archiving is blocked: %',
      COALESCE(v_readiness->'blockers'->0->>'title', 'Resolve remaining closeout requirements first')
      USING ERRCODE = '22023',
        DETAIL = COALESCE(v_readiness->'blockers', '[]'::jsonb)::text;
  END IF;

  v_closeout := COALESCE(project_row.financial_closeout_snapshot, eflow_project.financial_closeout_summary(p_project_id));
  IF ROUND(COALESCE((v_closeout->>'unreturnedBalance')::numeric, 0) * 100) <> 0 THEN
    RAISE EXCEPTION 'Return all unused project funding (₱%) to the Office Budget before archiving this project.',
      to_char(COALESCE((v_closeout->>'unreturnedBalance')::numeric, 0), 'FM999,999,999,990.00')
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(full_name, 'Project manager') INTO v_actor_name FROM public.profiles WHERE id = auth.uid();

  v_closeout := v_closeout || jsonb_build_object(
    'status', 'archived',
    'completedAt', COALESCE(project_row.completed_at, (v_closeout->>'completedAt')::timestamptz),
    'archivedAt', now(),
    'archivedBy', auth.uid(),
    'archivedByName', v_actor_name
  );

  PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '1', true);
  UPDATE public.projects
  SET status = 'archived',
      archived_at = now(),
      financial_closeout_snapshot = v_closeout,
      updated_at = now()
  WHERE id = p_project_id;
  PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '', true);

  INSERT INTO public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id)
  VALUES (
    auth.uid(),
    v_actor_name,
    'project',
    p_project_id::text,
    'project.archived',
    NULLIF(btrim(p_reason), ''),
    jsonb_build_object('status', project_row.status),
    jsonb_build_object('status', 'archived', 'financialCloseout', v_closeout),
    project_row.org_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_seal.archive_due_projects()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p record;
  head_id uuid;
  blockers jsonb;
  v_closeout jsonb;
  archived_count integer := 0;
  reminded_count integer := 0;
  v_archive_days integer := COALESCE((eflow_retention.policy()->>'project_auto_archive_days')::integer, 30);
  v_remind_days integer := GREATEST(0, v_archive_days - LEAST(7, GREATEST(1, v_archive_days - 1)));
BEGIN
  FOR p IN
    SELECT * FROM public.projects
    WHERE status = 'completed'
      AND completed_at IS NOT NULL
      AND completed_at <= now() - make_interval(days => v_remind_days)
    ORDER BY id
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT o.head_user_id INTO head_id
    FROM public.organizations o
    JOIN public.profiles u ON u.id = o.head_user_id
    WHERE o.id = p.org_id AND o.is_active AND u.is_active AND u.role::text = 'head';

    IF p.archive_reminded_at IS NULL AND head_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, message, project_id, org_id)
      VALUES (
        head_id,
        'project_archive_reminder',
        'Project ready to archive',
        p.title || ' will be archived on '
          || to_char((p.completed_at + make_interval(days => v_archive_days)) AT TIME ZONE 'Asia/Manila', 'MM/DD/YYYY, HH12:MI AM')
          || ' PHT if it stays completed. Blockchain publication stays manual.',
        p.id,
        p.org_id
      );
      UPDATE public.projects SET archive_reminded_at = now() WHERE id = p.id;
      reminded_count := reminded_count + 1;
    END IF;

    IF p.completed_at > now() - make_interval(days => v_archive_days) THEN
      CONTINUE;
    END IF;

    blockers := public.project_completion_readiness_internal(p.id)->'blockers';
    IF jsonb_array_length(blockers) > 0 THEN
      IF p.archive_blocked_at IS NULL AND head_id IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, type, title, message, project_id, org_id)
        VALUES (head_id, 'project_archive_blocked', 'Auto-archive needs attention', p.title || ': ' || (blockers->0->>'title'), p.id, p.org_id);
        UPDATE public.projects SET archive_blocked_at = now() WHERE id = p.id;
      END IF;
      CONTINUE;
    END IF;

    BEGIN
      v_closeout := COALESCE(p.financial_closeout_snapshot, eflow_project.financial_closeout_summary(p.id));
      IF ROUND(COALESCE((v_closeout->>'unreturnedBalance')::numeric, 0) * 100) <> 0 THEN
        RAISE EXCEPTION 'Unreturned project funding (₱%) must be returned before archiving.',
          to_char(COALESCE((v_closeout->>'unreturnedBalance')::numeric, 0), 'FM999,999,999,990.00');
      END IF;
      v_closeout := v_closeout || jsonb_build_object(
        'status', 'archived',
        'completedAt', p.completed_at,
        'archivedAt', now(),
        'archivedByName', 'eFlow archive scheduler'
      );

      PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '1', true);
      UPDATE public.projects
      SET status = 'archived',
          archived_at = now(),
          financial_closeout_snapshot = v_closeout,
          updated_at = now()
      WHERE id = p.id;
      PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '', true);

      INSERT INTO public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id)
      VALUES (
        NULL,
        'eFlow archive scheduler',
        'project',
        p.id::text,
        'project.auto_archived',
        format('Completed for %s days; closeout checks passed.', v_archive_days),
        jsonb_build_object('status', 'completed'),
        jsonb_build_object('status', 'archived', 'completed_at', p.completed_at, 'financialCloseout', v_closeout),
        p.org_id
      );
      archived_count := archived_count + 1;
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_catalog.set_config('eflow.updating_closeout_snapshot', '', true);
      IF p.archive_blocked_at IS NULL AND head_id IS NOT NULL THEN
        INSERT INTO public.notifications(user_id, type, title, message, project_id, org_id)
        VALUES (head_id, 'project_archive_blocked', 'Auto-archive needs attention', p.title || ' could not be archived: ' || left(sqlerrm, 250), p.id, p.org_id);
        UPDATE public.projects SET archive_blocked_at = now() WHERE id = p.id;
      END IF;
    END;
  END LOOP;
  RETURN jsonb_build_object('archived', archived_count, 'reminded', reminded_count);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. Keep fully returned funding sources & include closeoutSummary in snapshot
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION eflow_project.snapshot(p_project uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
  v_closeout jsonb;
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

  v_closeout := CASE
    WHEN p.status IN ('completed', 'archived') AND p.financial_closeout_snapshot IS NOT NULL THEN p.financial_closeout_snapshot
    ELSE eflow_project.financial_closeout_summary(p.id)
  END;

  -- Keep sources visible even after their remaining amount reaches 0 via Return to Office Budget
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cs->>'sourceId',
    'project_id', p.id,
    'partition_id', cs->>'partitionId',
    'fiscal_year', (cs->>'fiscalYear')::integer,
    'quarter', CASE WHEN cs->>'quarter' IS NULL THEN NULL ELSE (cs->>'quarter')::integer END,
    'name', cs->>'name',
    'amount', (cs->>'currentCertified')::numeric,
    'available', (cs->>'unreturnedBalance')::numeric,
    'budget_before_activation', (cs->>'budgetBeforeActivation')::numeric,
    'supplemental_added', (cs->>'supplementalAdded')::numeric,
    'total_certified', (cs->>'totalCertified')::numeric,
    'actual_spent', (cs->>'actualSpent')::numeric,
    'returned_to_office', (cs->>'returnedToOfficeBudget')::numeric,
    'last_returned_at', cs->>'lastReturnedAt',
    'last_returned_by_name', cs->>'lastReturnedByName'
  )), '[]'::jsonb)
  INTO funds
  FROM jsonb_array_elements(COALESCE(v_closeout->'sources', '[]'::jsonb)) cs;

  SELECT COALESCE(SUM((x->>'amount')::numeric), 0),
         COALESCE(SUM((x->>'amount')::numeric - (x->>'available')::numeric), 0)
  INTO total, allocated
  FROM jsonb_array_elements(funds) x;

  SELECT COALESCE(SUM(r.released_amount), 0),
         COALESCE(SUM(r.actual_spent) FILTER (WHERE r.status = 'settled'), 0),
         COALESCE(SUM(r.returned_amount) FILTER (WHERE r.status = 'settled'), 0),
         COALESCE(SUM(r.released_amount) FILTER (WHERE r.status NOT IN ('settled', 'rejected', 'cancelled')), 0)
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
        - COALESCE((SELECT SUM(bc.amount) FROM public.budget_commitments bc WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'), 0)
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
          - COALESCE((SELECT SUM(bc.amount) FROM public.budget_commitments bc WHERE bc.fiscal_budget_id = b.id AND bc.status = 'active'), 0)
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
    'unallocated', ROUND(total - allocated, 2),
    'released', released,
    'spent', spent,
    'returned', returned,
    'outstanding', outstanding,
    'closeoutSummary', v_closeout,
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
          'totalAmount', COALESCE((SELECT SUM((l->>'amount')::numeric) FROM jsonb_array_elements(fr.lines) l), 0),
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
