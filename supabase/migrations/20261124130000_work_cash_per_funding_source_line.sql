-- Track task_cash_release assignments per funding source line (allocation_line_id)
-- so each budget category (e.g. Maintainance ₱500 vs MOAE ₱300) has its own strict
-- released ceiling, unassigned balance, and itemized receipt binding.

ALTER TABLE public.work_cash_assignments
  ADD COLUMN IF NOT EXISTS allocation_line_id uuid NULL
    REFERENCES public.work_budget_allocation_lines(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_pcr_line_active
  ON public.work_cash_assignments (petty_cash_request_id, allocation_line_id)
  WHERE status = 'active' AND petty_cash_request_id IS NOT NULL;

DROP INDEX IF EXISTS public.idx_work_cash_assignments_active_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_cash_assignments_active_line_unique
  ON public.work_cash_assignments (
    source_kind,
    COALESCE(petty_cash_request_id, office_cash_request_id),
    COALESCE(allocation_line_id, '00000000-0000-0000-0000-000000000000'::uuid),
    task_id,
    COALESCE(subtask_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION eflow_budget.released_cash_lines(p_request uuid)
RETURNS TABLE(
  allocation_line_id uuid,
  amount numeric(14,2),
  source_name text,
  allocated_amount numeric(14,2),
  unrequested_amount numeric(14,2),
  line_position integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH req AS (
    SELECT
      r.id,
      r.allocation_line_id,
      COALESCE(r.requested_amount, 0)::numeric AS requested_amount,
      COALESCE(r.released_amount, 0)::numeric AS released_amount
    FROM public.petty_cash_requests r
    WHERE r.id = p_request
  ),
  raw_lines AS (
    SELECT
      rl.allocation_line_id,
      rl.amount::numeric AS raw_amount,
      COALESCE(req.released_amount, 0)::numeric AS released_amount,
      COALESCE(NULLIF(SUM(rl.amount) OVER (), 0), req.requested_amount, 1)::numeric AS basis_total
    FROM public.petty_cash_request_lines rl
    JOIN req ON req.id = rl.request_id
    WHERE rl.amount > 0
  ),
  fallback_line AS (
    SELECT
      req.allocation_line_id,
      req.released_amount AS raw_amount,
      req.released_amount AS released_amount,
      GREATEST(req.released_amount, 1) AS basis_total
    FROM req
    WHERE req.allocation_line_id IS NOT NULL
      AND req.released_amount > 0
      AND NOT EXISTS (SELECT 1 FROM raw_lines)
  ),
  combined AS (
    SELECT * FROM raw_lines
    UNION ALL
    SELECT * FROM fallback_line
  ),
  cents_calc AS (
    SELECT
      c.allocation_line_id,
      (c.raw_amount * c.released_amount / NULLIF(c.basis_total, 0)) * 100 AS exact_cents,
      ROUND(c.released_amount * 100) AS total_cents
    FROM combined c
  ),
  ranked AS (
    SELECT
      cc.allocation_line_id,
      cc.exact_cents,
      ROW_NUMBER() OVER (ORDER BY (cc.exact_cents - FLOOR(cc.exact_cents)) DESC, cc.allocation_line_id) AS remainder_rank,
      cc.total_cents - SUM(FLOOR(cc.exact_cents)) OVER () AS remainder_cents
    FROM cents_calc cc
  )
  SELECT
    rk.allocation_line_id,
    ((FLOOR(rk.exact_cents) + CASE WHEN rk.remainder_rank <= rk.remainder_cents THEN 1 ELSE 0 END) / 100.0)::numeric(14,2) AS amount,
    COALESCE(NULLIF(btrim(l.category), ''), 'Approved source') AS source_name,
    COALESCE(l.amount, 0)::numeric(14,2) AS allocated_amount,
    COALESCE(public.task_budget_line_available(l.id, NULL), 0)::numeric(14,2) AS unrequested_amount,
    COALESCE(l.position, 0) AS line_position
  FROM ranked rk
  LEFT JOIN public.work_budget_allocation_lines l ON l.id = rk.allocation_line_id
  WHERE (FLOOR(rk.exact_cents) + CASE WHEN rk.remainder_rank <= rk.remainder_cents THEN 1 ELSE 0 END) > 0
  ORDER BY COALESCE(l.position, 0), rk.allocation_line_id;
$function$;

DROP FUNCTION IF EXISTS public.assign_work_cash(uuid, uuid, text, uuid, numeric, text, uuid);

CREATE OR REPLACE FUNCTION public.assign_work_cash(
  p_task_id uuid,
  p_subtask_id uuid DEFAULT NULL,
  p_source_kind text DEFAULT 'task_cash_release',
  p_source_request_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_note text DEFAULT '',
  p_key uuid DEFAULT gen_random_uuid(),
  p_allocation_line_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := eflow_r3.actor();
  caller_name text;
  task_row public.tasks;
  subtask_row public.subtasks;
  pcr public.petty_cash_requests;
  ocr eflow_office_cash.requests;
  existing_assign public.work_cash_assignments;
  prev_cmd eflow_budget.cash_assignment_commands;
  payload jsonb;
  v_pool_limit numeric(14,2);
  v_other_assigned numeric(14,2) := 0;
  v_existing_spent numeric(14,2) := 0;
  v_result_id uuid;
  v_clean_note text := btrim(COALESCE(p_note, ''));
  v_source_label text;
  v_alloc_line_id uuid := NULL;
  v_line_name text := NULL;
  v_line_count integer := 0;
BEGIN
  IF p_task_id IS NULL OR p_source_request_id IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'Choose a funding source and target work item.' USING ERRCODE = '22023';
  END IF;
  IF p_source_kind NOT IN ('task_cash_release', 'office_petty_cash') THEN
    RAISE EXCEPTION 'Unsupported cash source type.' USING ERRCODE = '22023';
  END IF;
  IF NOT eflow_budget.valid_money(p_amount, false) THEN
    RAISE EXCEPTION 'Enter an amount greater than ₱0.00 with up to two decimal places.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_clean_note) > 1000 THEN
    RAISE EXCEPTION 'Note must be 1,000 characters or less.' USING ERRCODE = '22023';
  END IF;

  payload := jsonb_build_object(
    'op', 'assign',
    'taskId', p_task_id,
    'subtaskId', p_subtask_id,
    'sourceKind', p_source_kind,
    'sourceRequestId', p_source_request_id,
    'allocationLineId', p_allocation_line_id,
    'amount', p_amount,
    'note', v_clean_note
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-cash:' || caller || ':' || p_key, 0));
  SELECT * INTO prev_cmd FROM eflow_budget.cash_assignment_commands WHERE actor_id = caller AND command_id = p_key;
  IF FOUND THEN
    IF prev_cmd.payload <> payload THEN
      RAISE EXCEPTION 'This cash assignment key was already used with different details.' USING ERRCODE = '22023';
    END IF;
    RETURN prev_cmd.result_id;
  END IF;

  PERFORM eflow_r7.lock_impact(p_task_id);

  SELECT * INTO task_row FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR task_row.proposed_office_identity_id IS NOT NULL THEN
    RAISE EXCEPTION 'Task not found.' USING ERRCODE = 'P0002';
  END IF;
  IF task_row.archived_at IS NOT NULL OR task_row.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot assign cash to a finished or archived task.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.projects WHERE id = task_row.linked_project_id AND status IN ('completed', 'archived')) THEN
    RAISE EXCEPTION 'This project is closed.' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(public.can_see_task(p_task_id, caller), false)
    OR caller IS DISTINCT FROM COALESCE(task_row.assigned_to, task_row.recommendation_lead_id)
  THEN
    RAISE EXCEPTION 'Only the assigned Task Lead can distribute released cash for this task.' USING ERRCODE = '42501';
  END IF;

  IF p_subtask_id IS NOT NULL THEN
    SELECT * INTO subtask_row FROM public.subtasks WHERE id = p_subtask_id AND task_id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subtask does not belong to this task.' USING ERRCODE = '22023';
    END IF;
    IF subtask_row.status = 'completed' THEN
      RAISE EXCEPTION 'Cannot assign cash to a completed subtask.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF p_source_kind = 'task_cash_release' THEN
    SELECT * INTO pcr FROM public.petty_cash_requests WHERE id = p_source_request_id FOR UPDATE;
    IF NOT FOUND OR pcr.task_id <> p_task_id OR pcr.subtask_id IS NOT NULL THEN
      RAISE EXCEPTION 'Task cash release not found for this task.' USING ERRCODE = 'P0002';
    END IF;
    IF pcr.cash_recipient_id IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Only the cash holder who received this release can assign it.' USING ERRCODE = '42501';
    END IF;
    IF pcr.status NOT IN ('released', 'changes_requested', 'overdue_liquidation') OR COALESCE(pcr.released_amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Cash must be released before you can assign it.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.petty_cash_releases rel
      WHERE rel.request_id = pcr.id AND rel.status = 'released' AND rel.acknowledged_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Acknowledge receipt of the released cash before assigning it.' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_line_count FROM eflow_budget.released_cash_lines(pcr.id);

    IF v_line_count > 0 THEN
      IF p_allocation_line_id IS NOT NULL THEN
        SELECT rl.allocation_line_id, rl.amount, rl.source_name
        INTO v_alloc_line_id, v_pool_limit, v_line_name
        FROM eflow_budget.released_cash_lines(pcr.id) rl
        WHERE rl.allocation_line_id = p_allocation_line_id;

        IF v_alloc_line_id IS NULL THEN
          RAISE EXCEPTION 'Choose a funding source included in this cash release.' USING ERRCODE = '22023';
        END IF;
      ELSIF v_line_count = 1 THEN
        SELECT rl.allocation_line_id, rl.amount, rl.source_name
        INTO v_alloc_line_id, v_pool_limit, v_line_name
        FROM eflow_budget.released_cash_lines(pcr.id) rl
        LIMIT 1;
      ELSE
        RAISE EXCEPTION 'Choose which funding source to assign cash from.' USING ERRCODE = '22023';
      END IF;
      v_source_label := v_line_name || ' · FR-' || lpad(pcr.request_number::text, 5, '0');
    ELSE
      v_alloc_line_id := NULL;
      v_pool_limit := pcr.released_amount;
      v_source_label := 'FR-' || lpad(pcr.request_number::text, 5, '0');
    END IF;

    SELECT * INTO existing_assign
    FROM public.work_cash_assignments
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = pcr.id
      AND allocation_line_id IS NOT DISTINCT FROM v_alloc_line_id
      AND task_id = p_task_id
      AND subtask_id IS NOT DISTINCT FROM p_subtask_id
      AND status = 'active'
    FOR UPDATE;

    SELECT COALESCE(SUM(amount), 0)::numeric(14,2) INTO v_other_assigned
    FROM public.work_cash_assignments
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = pcr.id
      AND allocation_line_id IS NOT DISTINCT FROM v_alloc_line_id
      AND status = 'active'
      AND (existing_assign.id IS NULL OR id <> existing_assign.id);
  ELSE
    SELECT * INTO ocr FROM eflow_office_cash.requests WHERE id = p_source_request_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Office petty cash release not found.' USING ERRCODE = 'P0002';
    END IF;
    IF ocr.requester IS DISTINCT FROM caller THEN
      RAISE EXCEPTION 'Only the holder of this released office petty cash can assign it.' USING ERRCODE = '42501';
    END IF;
    IF ocr.office IS DISTINCT FROM task_row.org_id THEN
      RAISE EXCEPTION 'Office petty cash can only be assigned to tasks in the same office.' USING ERRCODE = '42501';
    END IF;
    IF ocr.status <> 'released' OR COALESCE(ocr.amount, 0) <= 0 THEN
      RAISE EXCEPTION 'Office petty cash must be released and open before assigning it.' USING ERRCODE = '22023';
    END IF;
    v_alloc_line_id := NULL;
    v_pool_limit := ocr.amount;
    v_source_label := 'Office Petty Cash · ' || ocr.purpose;

    SELECT * INTO existing_assign
    FROM public.work_cash_assignments
    WHERE source_kind = 'office_petty_cash'
      AND office_cash_request_id = ocr.id
      AND task_id = p_task_id
      AND subtask_id IS NOT DISTINCT FROM p_subtask_id
      AND status = 'active'
    FOR UPDATE;

    SELECT COALESCE(SUM(amount), 0)::numeric(14,2) INTO v_other_assigned
    FROM public.work_cash_assignments
    WHERE source_kind = 'office_petty_cash'
      AND office_cash_request_id = ocr.id
      AND status = 'active'
      AND (existing_assign.id IS NULL OR id <> existing_assign.id);
  END IF;

  IF existing_assign.id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0)::numeric(14,2) INTO v_existing_spent
    FROM public.work_cash_assignment_receipts
    WHERE assignment_id = existing_assign.id
      AND deleted_at IS NULL;

    IF p_amount < v_existing_spent THEN
      RAISE EXCEPTION 'Assigned cash cannot be below ₱% already logged in receipts.',
        to_char(v_existing_spent, 'FM999,999,990.00')
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_other_assigned + p_amount > v_pool_limit THEN
    RAISE EXCEPTION 'Amount exceeds the remaining unassigned cash (₱%) in %.',
      to_char(GREATEST(0, v_pool_limit - v_other_assigned), 'FM999,999,990.00'),
      v_source_label
      USING ERRCODE = '22023';
  END IF;

  IF existing_assign.id IS NOT NULL THEN
    UPDATE public.work_cash_assignments
    SET amount = p_amount,
        note = v_clean_note,
        updated_at = now()
    WHERE id = existing_assign.id
    RETURNING id INTO v_result_id;
  ELSE
    INSERT INTO public.work_cash_assignments(
      org_id, task_id, subtask_id, source_kind,
      petty_cash_request_id, office_cash_request_id, allocation_line_id,
      amount, status, note, assigned_by
    ) VALUES (
      task_row.org_id,
      p_task_id,
      p_subtask_id,
      p_source_kind,
      CASE WHEN p_source_kind = 'task_cash_release' THEN p_source_request_id ELSE NULL END,
      CASE WHEN p_source_kind = 'office_petty_cash' THEN p_source_request_id ELSE NULL END,
      v_alloc_line_id,
      p_amount,
      'active',
      v_clean_note,
      caller
    )
    RETURNING id INTO v_result_id;
  END IF;

  SELECT COALESCE(full_name, '') INTO caller_name FROM public.profiles WHERE id = caller;

  INSERT INTO public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id, target_label, change_summary
  ) VALUES (
    caller,
    caller_name,
    'work_cash_assignment',
    v_result_id::text,
    CASE WHEN existing_assign.id IS NOT NULL THEN 'update_work_cash_assignment' ELSE 'create_work_cash_assignment' END,
    NULLIF(v_clean_note, ''),
    CASE WHEN existing_assign.id IS NOT NULL THEN jsonb_build_object('amount', existing_assign.amount) ELSE NULL END,
    jsonb_build_object(
      'task_id', p_task_id,
      'subtask_id', p_subtask_id,
      'source_kind', p_source_kind,
      'source_request_id', p_source_request_id,
      'allocation_line_id', v_alloc_line_id,
      'amount', p_amount
    ),
    task_row.org_id,
    COALESCE(subtask_row.title, task_row.title),
    format('Assigned ₱%s from %s to %s', to_char(p_amount, 'FM999,999,990.00'), v_source_label, COALESCE(subtask_row.title, task_row.title))
  );

  IF p_subtask_id IS NOT NULL AND subtask_row.assigned_to IS NOT NULL AND subtask_row.assigned_to <> caller THEN
    INSERT INTO public.notifications(
      user_id, type, title, message, task_id, task_title, actor_id, actor_name, org_id, work_node_id
    ) VALUES (
      subtask_row.assigned_to,
      'budget_allocation_decision',
      'Cash assigned to your subtask',
      format('%s assigned ₱%s (%s) to "%s".', COALESCE(NULLIF(caller_name, ''), 'Task Lead'), to_char(p_amount, 'FM999,999,990.00'), v_source_label, subtask_row.title),
      p_task_id,
      task_row.title,
      caller,
      caller_name,
      task_row.org_id,
      p_subtask_id
    );
  END IF;

  INSERT INTO eflow_budget.cash_assignment_commands(actor_id, command_id, payload, result_id)
  VALUES (caller, p_key, payload, v_result_id);

  RETURN v_result_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_work_cash(uuid, uuid, text, uuid, numeric, text, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_assignment_receipt(
  p_assignment_id uuid,
  p_vendor text,
  p_receipt_number text DEFAULT NULL,
  p_receipt_date date DEFAULT NULL,
  p_description text DEFAULT '',
  p_amount numeric DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_file_name text DEFAULT NULL,
  p_file_path text DEFAULT NULL,
  p_mime_type text DEFAULT 'application/octet-stream',
  p_file_size bigint DEFAULT 0,
  p_key uuid DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := eflow_r3.actor();
  caller_name text;
  a public.work_cash_assignments;
  task_row public.tasks;
  subtask_row public.subtasks;
  pcr public.petty_cash_requests;
  ocr eflow_office_cash.requests;
  prev_cmd eflow_budget.cash_assignment_commands;
  payload jsonb;
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_existing numeric(14,2) := 0;
  v_receipt_id uuid;
  v_vendor text := btrim(COALESCE(p_vendor, ''));
  v_receipt_no text := NULLIF(btrim(COALESCE(p_receipt_number, '')), '');
  v_desc text := btrim(COALESCE(p_description, ''));
  v_file_name text := btrim(COALESCE(p_file_name, ''));
  v_file_path text := btrim(COALESCE(p_file_path, ''));
  v_has_lines boolean := false;
  v_item jsonb;
  v_item_total numeric := 0;
  v_item_amt numeric;
  v_item_qty numeric;
  v_item_line_id uuid;
BEGIN
  IF p_assignment_id IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'Assignment and idempotency key are required.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_vendor) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Enter the vendor or payee name.' USING ERRCODE = '22023';
  END IF;
  IF p_receipt_date IS NULL OR p_receipt_date > v_today THEN
    RAISE EXCEPTION 'Enter a valid receipt date on or before today (Philippine time).' USING ERRCODE = '22023';
  END IF;
  IF NOT eflow_budget.valid_money(p_amount, false) THEN
    RAISE EXCEPTION 'Enter a receipt amount greater than ₱0.00 with up to two decimal places.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_desc) > 300 THEN
    RAISE EXCEPTION 'Description must be 300 characters or less.' USING ERRCODE = '22023';
  END IF;
  IF v_file_name = '' OR v_file_path = '' THEN
    RAISE EXCEPTION 'Attach a receipt image or PDF file.' USING ERRCODE = '22023';
  END IF;

  payload := jsonb_build_object(
    'op', 'receipt',
    'assignmentId', p_assignment_id,
    'vendor', v_vendor,
    'receiptNumber', v_receipt_no,
    'receiptDate', p_receipt_date,
    'description', v_desc,
    'amount', p_amount,
    'items', COALESCE(p_items, '[]'::jsonb),
    'filePath', v_file_path
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-cash-rcpt:' || caller || ':' || p_key, 0));
  SELECT * INTO prev_cmd FROM eflow_budget.cash_assignment_commands WHERE actor_id = caller AND command_id = p_key;
  IF FOUND THEN
    IF prev_cmd.payload <> payload THEN
      RAISE EXCEPTION 'This receipt key was already used with different details.' USING ERRCODE = '22023';
    END IF;
    RETURN prev_cmd.result_id;
  END IF;

  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash assignment not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM eflow_r7.lock_impact(a.task_id);
  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF NOT public.can_log_assignment_receipt(a.id, caller) THEN
    RAISE EXCEPTION 'You cannot record receipts on this cash assignment right now.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO task_row FROM public.tasks WHERE id = a.task_id;
  IF a.subtask_id IS NOT NULL THEN
    SELECT * INTO subtask_row FROM public.subtasks WHERE id = a.subtask_id;
  END IF;

  SELECT COALESCE(SUM(amount), 0)::numeric(14,2) INTO v_existing
  FROM public.work_cash_assignment_receipts
  WHERE assignment_id = a.id AND deleted_at IS NULL;

  IF v_existing + p_amount > a.amount THEN
    RAISE EXCEPTION 'Receipt exceeds the remaining assigned cash (₱% left of ₱%).',
      to_char(GREATEST(0, a.amount - v_existing), 'FM999,999,990.00'),
      to_char(a.amount, 'FM999,999,990.00')
      USING ERRCODE = '22023';
  END IF;

  IF a.source_kind = 'office_petty_cash' THEN
    SELECT * INTO ocr FROM eflow_office_cash.requests WHERE id = a.office_cash_request_id FOR UPDATE;
    IF p_amount > 5000 THEN
      RAISE EXCEPTION 'Office petty cash receipts must be ₱5,000.00 or less per receipt.' USING ERRCODE = '22023';
    END IF;
    IF v_receipt_no IS NULL THEN
      RAISE EXCEPTION 'Enter the receipt / OR number for office petty cash.' USING ERRCODE = '22023';
    END IF;
    IF left(v_file_path, length(ocr.id::text || '/assignments/' || a.id::text || '/')) <> ocr.id::text || '/assignments/' || a.id::text || '/'
      OR NOT EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'office-petty-receipts'
          AND o.name = v_file_path
          AND o.owner_id = caller::text
      )
    THEN
      RAISE EXCEPTION 'Upload a valid receipt file for this office petty cash assignment.' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.work_cash_assignment_receipts ar
      JOIN public.work_cash_assignments other_a ON other_a.id = ar.assignment_id
      WHERE other_a.source_kind = 'office_petty_cash'
        AND other_a.org_id = a.org_id
        AND ar.deleted_at IS NULL
        AND ar.vendor = v_vendor
        AND ar.receipt_number = v_receipt_no
        AND ar.receipt_date = p_receipt_date
    ) OR EXISTS (
      SELECT 1
      FROM eflow_office_cash.requests other_r
      CROSS JOIN LATERAL jsonb_array_elements(other_r.receipts) item
      WHERE other_r.office = a.org_id
        AND other_r.id <> ocr.id
        AND item->>'vendor' = v_vendor
        AND item->>'number' = v_receipt_no
        AND item->>'date' = p_receipt_date::text
    ) THEN
      RAISE EXCEPTION 'This receipt is already recorded against office petty cash.' USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT * INTO pcr FROM public.petty_cash_requests WHERE id = a.petty_cash_request_id FOR UPDATE;
    IF left(v_file_path, length(pcr.org_id::text || '/' || pcr.id::text || '/assignments/' || a.id::text || '/'))
       <> pcr.org_id::text || '/' || pcr.id::text || '/assignments/' || a.id::text || '/'
      OR NOT EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'budget-receipts'
          AND o.name = v_file_path
          AND o.owner_id = caller::text
      )
    THEN
      RAISE EXCEPTION 'Upload a valid receipt file for this cash assignment.' USING ERRCODE = '42501';
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.petty_cash_request_lines WHERE request_id = pcr.id) INTO v_has_lines;
    IF v_has_lines AND p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_item_amt := (v_item->>'amount')::numeric;
        v_item_qty := (v_item->>'quantity')::numeric;
        v_item_line_id := (v_item->>'allocationLineId')::uuid;
        IF NOT eflow_budget.valid_money(v_item_amt, false)
          OR v_item_qty IS NULL OR v_item_qty <= 0 OR v_item_qty <> round(v_item_qty, 3)
          OR NULLIF(btrim(v_item->>'unit'), '') IS NULL
          OR NULLIF(btrim(v_item->>'particular'), '') IS NULL
          OR NULLIF(btrim(v_item->>'purpose'), '') IS NULL
          OR (a.allocation_line_id IS NOT NULL AND v_item_line_id IS DISTINCT FROM a.allocation_line_id)
          OR NOT EXISTS (
            SELECT 1 FROM public.petty_cash_request_lines
            WHERE request_id = pcr.id AND allocation_line_id = v_item_line_id
          )
        THEN
          RAISE EXCEPTION 'Each receipt item must match this assignment''s funding source and include valid quantity, unit, particulars, purpose, and amount.' USING ERRCODE = '22023';
        END IF;
        v_item_total := v_item_total + v_item_amt;
      END LOOP;
      IF v_item_total IS DISTINCT FROM p_amount THEN
        RAISE EXCEPTION 'Purchased item amounts must equal the receipt total.' USING ERRCODE = '22023';
      END IF;
    ELSIF v_desc = '' THEN
      RAISE EXCEPTION 'Describe what was purchased on this receipt.' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.work_cash_assignment_receipts(
    assignment_id, vendor, receipt_number, receipt_date, description,
    amount, items, file_name, file_path, mime_type, file_size, uploaded_by
  ) VALUES (
    a.id, v_vendor, v_receipt_no, p_receipt_date, v_desc,
    p_amount, COALESCE(p_items, '[]'::jsonb), v_file_name, v_file_path,
    COALESCE(NULLIF(btrim(p_mime_type), ''), 'application/octet-stream'),
    GREATEST(0, COALESCE(p_file_size, 0)),
    caller
  )
  RETURNING id INTO v_receipt_id;

  SELECT COALESCE(full_name, '') INTO caller_name FROM public.profiles WHERE id = caller;

  INSERT INTO public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action,
    after_data, org_id, target_label, change_summary
  ) VALUES (
    caller,
    caller_name,
    'work_cash_assignment_receipt',
    v_receipt_id::text,
    'record_assignment_receipt',
    jsonb_build_object('assignment_id', a.id, 'vendor', v_vendor, 'amount', p_amount, 'receipt_date', p_receipt_date),
    a.org_id,
    COALESCE(subtask_row.title, task_row.title),
    format('Recorded ₱%s receipt (%s) on %s', to_char(p_amount, 'FM999,999,990.00'), v_vendor, COALESCE(subtask_row.title, task_row.title))
  );

  IF a.assigned_by IS DISTINCT FROM caller THEN
    INSERT INTO public.notifications(
      user_id, type, title, message, task_id, task_title, actor_id, actor_name, org_id, work_node_id
    ) VALUES (
      a.assigned_by,
      'petty_cash_liquidation_leader_review',
      'Subtask receipt recorded',
      format('%s logged a ₱%s receipt (%s) under "%s". It will roll up into your liquidation.',
        COALESCE(NULLIF(caller_name, ''), 'Team member'),
        to_char(p_amount, 'FM999,999,990.00'),
        v_vendor,
        COALESCE(subtask_row.title, task_row.title)
      ),
      a.task_id,
      task_row.title,
      caller,
      caller_name,
      a.org_id,
      a.subtask_id
    );
  END IF;

  INSERT INTO eflow_budget.cash_assignment_commands(actor_id, command_id, payload, result_id)
  VALUES (caller, p_key, payload, v_receipt_id);

  RETURN v_receipt_id;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_budget.task_cash_pools(p_task_id uuid, p_subtask_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  t public.tasks;
  v_can_assign boolean := false;
  v_task_releases jsonb := '[]'::jsonb;
  v_office_releases jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_cash_on_hand numeric(14,2) := 0;
  v_cash_assigned numeric(14,2) := 0;
  v_office_on_hand numeric(14,2) := 0;
  v_office_assigned numeric(14,2) := 0;
  v_subtask_cash_assigned numeric(14,2) := 0;
  v_subtask_petty_assigned numeric(14,2) := 0;
  v_unrequested numeric(14,2) := 0;
BEGIN
  IF caller IS NULL OR p_task_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_can_assign := COALESCE(eflow_r3.eligible(caller), false)
    AND caller = COALESCE(t.assigned_to, t.recommendation_lead_id)
    AND t.proposed_office_identity_id IS NULL
    AND t.archived_at IS NULL
    AND t.status NOT IN ('completed', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = t.linked_project_id AND p.status IN ('completed', 'archived')
    );

  WITH pcr_base AS (
    SELECT
      r.id,
      r.request_number,
      r.purpose,
      r.status,
      COALESCE(r.released_amount, 0)::numeric(14,2) AS released_amount,
      r.liquidation_due_at,
      r.cash_recipient_id,
      COALESCE(pr.full_name, '') AS holder_name,
      NOT EXISTS (
        SELECT 1 FROM public.petty_cash_releases rel
        WHERE rel.request_id = r.id AND rel.status = 'released' AND rel.acknowledged_at IS NULL
      ) AS acknowledged,
      COALESCE((
        SELECT jsonb_agg(rl.source_name ORDER BY rl.line_position, rl.allocation_line_id)
        FROM eflow_budget.released_cash_lines(r.id) rl
      ), '[]'::jsonb) AS source_labels,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'allocationLineId', rl.allocation_line_id,
          'amount', rl.amount,
          'sourceName', rl.source_name,
          'allocatedAmount', rl.allocated_amount,
          'unrequestedAmount', rl.unrequested_amount,
          'assignedToTask', COALESCE((
            SELECT SUM(a.amount)::numeric(14,2)
            FROM public.work_cash_assignments a
            WHERE a.source_kind = 'task_cash_release'
              AND a.petty_cash_request_id = r.id
              AND a.allocation_line_id = rl.allocation_line_id
              AND a.status = 'active'
              AND a.subtask_id IS NULL
          ), 0::numeric(14,2)),
          'assignedToSubtasks', COALESCE((
            SELECT SUM(a.amount)::numeric(14,2)
            FROM public.work_cash_assignments a
            WHERE a.source_kind = 'task_cash_release'
              AND a.petty_cash_request_id = r.id
              AND a.allocation_line_id = rl.allocation_line_id
              AND a.status = 'active'
              AND a.subtask_id IS NOT NULL
          ), 0::numeric(14,2)),
          'unassignedAmount', GREATEST(0::numeric(14,2), rl.amount - COALESCE((
            SELECT SUM(a.amount)::numeric(14,2)
            FROM public.work_cash_assignments a
            WHERE a.source_kind = 'task_cash_release'
              AND a.petty_cash_request_id = r.id
              AND a.allocation_line_id = rl.allocation_line_id
              AND a.status = 'active'
          ), 0::numeric(14,2))),
          'recordedReceiptsTotal', COALESCE((
            SELECT SUM(ar.amount)::numeric(14,2)
            FROM public.work_cash_assignments a
            JOIN public.work_cash_assignment_receipts ar
              ON ar.assignment_id = a.id AND ar.deleted_at IS NULL
            WHERE a.source_kind = 'task_cash_release'
              AND a.petty_cash_request_id = r.id
              AND a.allocation_line_id = rl.allocation_line_id
              AND a.status = 'active'
          ), 0::numeric(14,2))
        ) ORDER BY rl.line_position, rl.allocation_line_id)
        FROM eflow_budget.released_cash_lines(r.id) rl
      ), '[]'::jsonb) AS funding_lines,
      COALESCE((
        SELECT SUM(a.amount)::numeric(14,2)
        FROM public.work_cash_assignments a
        WHERE a.source_kind = 'task_cash_release'
          AND a.petty_cash_request_id = r.id
          AND a.status = 'active'
          AND a.subtask_id IS NULL
      ), 0::numeric(14,2)) AS assigned_to_task,
      COALESCE((
        SELECT SUM(a.amount)::numeric(14,2)
        FROM public.work_cash_assignments a
        WHERE a.source_kind = 'task_cash_release'
          AND a.petty_cash_request_id = r.id
          AND a.status = 'active'
          AND a.subtask_id IS NOT NULL
      ), 0::numeric(14,2)) AS assigned_to_subtasks,
      COALESCE((
        SELECT SUM(ar.amount)::numeric(14,2)
        FROM public.work_cash_assignments a
        JOIN public.work_cash_assignment_receipts ar
          ON ar.assignment_id = a.id AND ar.deleted_at IS NULL
        WHERE a.source_kind = 'task_cash_release'
          AND a.petty_cash_request_id = r.id
          AND a.status = 'active'
      ), 0::numeric(14,2)) AS recorded_receipts
    FROM public.petty_cash_requests r
    LEFT JOIN public.profiles pr ON pr.id = r.cash_recipient_id
    WHERE r.task_id = p_task_id
      AND r.subtask_id IS NULL
      AND r.status IN ('released', 'changes_requested', 'overdue_liquidation')
      AND COALESCE(r.released_amount, 0) > 0
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'requestId', id,
      'requestNumber', request_number,
      'purpose', purpose,
      'status', status,
      'sourceLabels', source_labels,
      'fundingLines', funding_lines,
      'releasedAmount', released_amount,
      'assignedToTask', assigned_to_task,
      'assignedToSubtasks', assigned_to_subtasks,
      'unassignedAmount', GREATEST(0, released_amount - assigned_to_task - assigned_to_subtasks),
      'recordedReceiptsTotal', recorded_receipts,
      'liquidationDueAt', liquidation_due_at,
      'holderId', cash_recipient_id,
      'holderName', holder_name,
      'isCurrentHolder', cash_recipient_id = caller,
      'acknowledged', acknowledged
    ) ORDER BY request_number ASC), '[]'::jsonb),
    COALESCE(SUM(released_amount) FILTER (WHERE acknowledged), 0)::numeric(14,2),
    COALESCE(SUM(assigned_to_task + assigned_to_subtasks) FILTER (WHERE acknowledged), 0)::numeric(14,2)
  INTO v_task_releases, v_cash_on_hand, v_cash_assigned
  FROM pcr_base;

  WITH opc_base AS (
    SELECT
      r.id,
      r.purpose,
      r.amount::numeric(14,2) AS released_amount,
      r.liquidation_due_at,
      r.requester AS holder_id,
      COALESCE(pr.full_name, '') AS holder_name,
      COALESCE((
        SELECT SUM(a.amount)::numeric(14,2)
        FROM public.work_cash_assignments a
        WHERE a.source_kind = 'office_petty_cash'
          AND a.office_cash_request_id = r.id
          AND a.status = 'active'
          AND a.task_id = p_task_id
      ), 0::numeric(14,2)) AS assigned_here,
      COALESCE((
        SELECT SUM(a.amount)::numeric(14,2)
        FROM public.work_cash_assignments a
        WHERE a.source_kind = 'office_petty_cash'
          AND a.office_cash_request_id = r.id
          AND a.status = 'active'
          AND a.task_id <> p_task_id
      ), 0::numeric(14,2)) AS assigned_elsewhere,
      COALESCE((
        SELECT SUM(ar.amount)::numeric(14,2)
        FROM public.work_cash_assignments a
        JOIN public.work_cash_assignment_receipts ar
          ON ar.assignment_id = a.id AND ar.deleted_at IS NULL
        WHERE a.source_kind = 'office_petty_cash'
          AND a.office_cash_request_id = r.id
          AND a.status = 'active'
      ), 0::numeric(14,2)) AS recorded_receipts
    FROM eflow_office_cash.requests r
    LEFT JOIN public.profiles pr ON pr.id = r.requester
    WHERE r.office = t.org_id
      AND r.status = 'released'
      AND r.requester = caller
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'officeCashRequestId', id,
      'purpose', purpose,
      'releasedAmount', released_amount,
      'assignedHere', assigned_here,
      'assignedElsewhere', assigned_elsewhere,
      'unassignedAmount', GREATEST(0, released_amount - assigned_here - assigned_elsewhere),
      'recordedReceiptsTotal', recorded_receipts,
      'liquidationDueAt', liquidation_due_at,
      'holderId', holder_id,
      'holderName', holder_name,
      'isCurrentHolder', holder_id = caller
    ) ORDER BY purpose ASC, id ASC), '[]'::jsonb),
    COALESCE(SUM(released_amount), 0)::numeric(14,2)
  INTO v_office_releases, v_office_on_hand
  FROM opc_base;

  WITH assign_rows AS (
    SELECT
      a.id,
      a.source_kind,
      COALESCE(a.petty_cash_request_id, a.office_cash_request_id) AS source_request_id,
      a.allocation_line_id,
      CASE
        WHEN a.source_kind = 'task_cash_release' AND al.id IS NOT NULL THEN
          COALESCE(NULLIF(btrim(al.category), ''), 'Approved source') || ' · FR-' || lpad(pcr.request_number::text, 5, '0')
        WHEN a.source_kind = 'task_cash_release' THEN
          'FR-' || lpad(pcr.request_number::text, 5, '0') || ' · ' || pcr.purpose
        ELSE
          'Office Petty Cash · ' || ocr.purpose
      END AS source_label,
      a.task_id,
      a.subtask_id,
      s.title AS subtask_title,
      a.amount,
      a.status,
      a.note,
      a.assigned_by,
      COALESCE(ab.full_name, '') AS assigned_by_name,
      a.created_at,
      a.updated_at,
      CASE
        WHEN a.source_kind = 'task_cash_release' THEN pcr.org_id
        ELSE ocr.office
      END AS source_org_id,
      CASE
        WHEN a.source_kind = 'task_cash_release' AND a.allocation_line_id IS NOT NULL THEN
          jsonb_build_array(jsonb_build_object(
            'allocationLineId', a.allocation_line_id,
            'amount', a.amount,
            'sourceName', COALESCE(NULLIF(btrim(al.category), ''), 'Approved source')
          ))
        WHEN a.source_kind = 'task_cash_release' THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'allocationLineId', rl.allocation_line_id,
            'amount', rl.amount,
            'sourceName', rl.source_name
          ) ORDER BY rl.line_position, rl.allocation_line_id)
          FROM eflow_budget.released_cash_lines(pcr.id) rl
        ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS funding_lines,
      COALESCE((
        SELECT SUM(ar.amount)::numeric(14,2)
        FROM public.work_cash_assignment_receipts ar
        WHERE ar.assignment_id = a.id AND ar.deleted_at IS NULL
      ), 0::numeric(14,2)) AS recorded_spent,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', ar.id,
          'assignmentId', ar.assignment_id,
          'vendor', ar.vendor,
          'receiptNumber', COALESCE(ar.receipt_number, ''),
          'receiptDate', ar.receipt_date::text,
          'description', ar.description,
          'amount', ar.amount,
          'items', ar.items,
          'fileName', ar.file_name,
          'filePath', ar.file_path,
          'mimeType', ar.mime_type,
          'fileSize', ar.file_size,
          'uploadedBy', ar.uploaded_by,
          'uploadedByName', COALESCE(up.full_name, ''),
          'createdAt', ar.created_at,
          'canDelete', (
            public.can_log_assignment_receipt(a.id, caller)
            AND (ar.uploaded_by = caller OR a.assigned_by = caller OR caller = COALESCE(t.assigned_to, t.recommendation_lead_id))
          )
        ) ORDER BY ar.created_at ASC)
        FROM public.work_cash_assignment_receipts ar
        LEFT JOIN public.profiles up ON up.id = ar.uploaded_by
        WHERE ar.assignment_id = a.id AND ar.deleted_at IS NULL
      ), '[]'::jsonb) AS receipts,
      public.can_log_assignment_receipt(a.id, caller) AS can_log_receipt,
      (
        v_can_assign
        AND (
          (a.source_kind = 'task_cash_release' AND pcr.cash_recipient_id = caller AND pcr.status IN ('released', 'changes_requested', 'overdue_liquidation'))
          OR (a.source_kind = 'office_petty_cash' AND ocr.requester = caller AND ocr.status = 'released')
        )
      ) AS can_recall_base
    FROM public.work_cash_assignments a
    LEFT JOIN public.subtasks s ON s.id = a.subtask_id
    LEFT JOIN public.petty_cash_requests pcr ON pcr.id = a.petty_cash_request_id
    LEFT JOIN public.work_budget_allocation_lines al ON al.id = a.allocation_line_id
    LEFT JOIN eflow_office_cash.requests ocr ON ocr.id = a.office_cash_request_id
    LEFT JOIN public.profiles ab ON ab.id = a.assigned_by
    WHERE a.task_id = p_task_id
      AND a.status = 'active'
      AND (p_subtask_id IS NULL OR a.subtask_id = p_subtask_id)
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', id,
      'sourceKind', source_kind,
      'sourceRequestId', source_request_id,
      'allocationLineId', allocation_line_id,
      'sourceLabel', source_label,
      'sourceOrgId', source_org_id,
      'fundingLines', funding_lines,
      'taskId', task_id,
      'subtaskId', subtask_id,
      'subtaskTitle', subtask_title,
      'amount', amount,
      'recordedSpent', recorded_spent,
      'unspentAmount', GREATEST(0, amount - recorded_spent),
      'status', status,
      'note', note,
      'assignedBy', assigned_by,
      'assignedByName', assigned_by_name,
      'canLogReceipt', can_log_receipt,
      'canRecall', can_recall_base AND (amount - recorded_spent) > 0,
      'receipts', receipts
    ) ORDER BY (subtask_id IS NOT NULL), subtask_title NULLS FIRST, created_at ASC), '[]'::jsonb),
    COALESCE(SUM(amount) FILTER (WHERE source_kind = 'office_petty_cash'), 0)::numeric(14,2),
    COALESCE(SUM(amount) FILTER (WHERE source_kind = 'task_cash_release' AND subtask_id IS NOT DISTINCT FROM p_subtask_id), 0)::numeric(14,2),
    COALESCE(SUM(amount) FILTER (WHERE source_kind = 'office_petty_cash' AND subtask_id IS NOT DISTINCT FROM p_subtask_id), 0)::numeric(14,2)
  INTO v_assignments, v_office_assigned, v_subtask_cash_assigned, v_subtask_petty_assigned
  FROM assign_rows;

  SELECT COALESCE(SUM(public.task_budget_line_available(l.id, NULL)), 0)::numeric(14,2)
  INTO v_unrequested
  FROM public.work_budget_allocations a
  JOIN public.work_budget_allocation_lines l ON l.allocation_id = a.id
  WHERE a.task_id = p_task_id AND a.subtask_id IS NULL AND a.status = 'approved';

  RETURN jsonb_build_object(
    'canAssignCash', v_can_assign,
    'taskCashReleases', v_task_releases,
    'officePettyCashReleases', v_office_releases,
    'assignments', v_assignments,
    'totals', jsonb_build_object(
      'cashOnHandTask', v_cash_on_hand,
      'cashOnHandAssigned', v_cash_assigned,
      'cashOnHandUnassigned', GREATEST(0, v_cash_on_hand - v_cash_assigned),
      'officePettyCashOnHand', v_office_on_hand,
      'officePettyCashAssigned', v_office_assigned,
      'subtaskTaskCashAssigned', v_subtask_cash_assigned,
      'subtaskOfficePettyCashAssigned', v_subtask_petty_assigned,
      'unrequestedBudget', v_unrequested
    )
  );
END;
$function$;
