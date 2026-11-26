-- ============================================================================
-- Migration: 20261125094500_lock_approved_receipts_immutable.sql
-- Purpose:
--   1. Expose receiptReviewStatus, locked, accountingDecidedAt, and
--      accountingDecidedByName on public.get_request_assignment_receipts so
--      the Task liquidation dialog locks Accounting-approved receipts read-only.
--   2. Enforce server-side immutability: once a subtask/work receipt has been
--      approved by Accounting (receipt_review_status = 'approved'), it CANNOT
--      be edited, replaced, soft-deleted, or omitted/altered inside a Task
--      liquidation submission (submit_items / submit_petty_cash_liquidation).
-- ============================================================================

-- 1. Extend public.get_request_assignment_receipts with approval/lock metadata
CREATE OR REPLACE FUNCTION public.get_request_assignment_receipts(p_petty_cash_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.petty_cash_requests;
  caller uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF caller IS NULL OR p_petty_cash_request_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT * INTO r FROM public.petty_cash_requests WHERE id = p_petty_cash_request_id;
  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT (
    r.cash_recipient_id = caller
    OR r.requester_id = caller
    OR r.task_leader_id = caller
    OR public.can_see_task(r.task_id, caller)
    OR public.can_manage_department_accounting(r.org_id, caller)
  ) THEN
    RAISE EXCEPTION 'You cannot view receipts for this cash request.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ar.id,
    'assignmentId', a.id,
    'taskId', a.task_id,
    'subtaskId', a.subtask_id,
    'subtaskTitle', s.title,
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
    'uploadedByName', COALESCE(u.full_name, ''),
    'createdAt', ar.created_at,
    'receiptReviewStatus', a.receipt_review_status,
    'locked', (a.receipt_review_status = 'approved' OR a.status = 'settled'),
    'accountingDecidedAt', a.accounting_decided_at,
    'accountingDecidedByName', COALESCE(dec_p.full_name, '')
  ) ORDER BY ar.created_at ASC), '[]'::jsonb)
  INTO v_rows
  FROM public.work_cash_assignments a
  JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
  LEFT JOIN public.subtasks s ON s.id = a.subtask_id
  LEFT JOIN public.profiles u ON u.id = ar.uploaded_by
  LEFT JOIN public.profiles dec_p ON dec_p.id = a.accounting_decided_by
  WHERE a.source_kind = 'task_cash_release'
    AND a.petty_cash_request_id = r.id
    AND a.status IN ('active', 'settled')
    AND ar.deleted_at IS NULL;

  RETURN v_rows;
END;
$function$;

-- 2. Trigger: prevent modifying or soft-deleting any approved assignment receipt
CREATE OR REPLACE FUNCTION eflow_budget.guard_approved_assignment_receipt_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  a public.work_cash_assignments;
BEGIN
  SELECT * INTO a FROM public.work_cash_assignments WHERE id = OLD.assignment_id;
  IF FOUND AND (a.receipt_review_status = 'approved' OR a.status = 'settled') THEN
    RAISE EXCEPTION 'Receipts already approved by Accounting are locked and cannot be modified or removed.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER lock_approved_assignment_receipts
  BEFORE UPDATE ON public.work_cash_assignment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION eflow_budget.guard_approved_assignment_receipt_immutable();

-- 3. Helper: enforce that every Accounting-approved subtask/work receipt under
--    a cash request is included UNCHANGED in the submitted liquidation package.
CREATE OR REPLACE FUNCTION eflow_budget.assert_approved_assignment_receipts_unchanged(
  p_request_id uuid,
  p_receipts jsonb,
  p_check_items boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  rec record;
  matched jsonb;
  expected_items jsonb;
  submitted_items jsonb;
BEGIN
  FOR rec IN
    SELECT ar.*, a.receipt_review_status
    FROM public.work_cash_assignments a
    JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
    WHERE a.source_kind = 'task_cash_release'
      AND a.petty_cash_request_id = p_request_id
      AND a.status IN ('active', 'settled')
      AND a.receipt_review_status = 'approved'
      AND ar.deleted_at IS NULL
  LOOP
    SELECT value INTO matched
    FROM jsonb_array_elements(COALESCE(p_receipts, '[]'::jsonb))
    WHERE value->>'filePath' = rec.file_path
    LIMIT 1;

    IF matched IS NULL THEN
      RAISE EXCEPTION 'Approved receipt "%" (₱%) cannot be removed or have its file replaced.',
        rec.vendor, to_char(rec.amount, 'FM999,999,990.00')
        USING ERRCODE = '42501';
    END IF;

    IF btrim(COALESCE(matched->>'vendor', '')) IS DISTINCT FROM btrim(rec.vendor)
       OR COALESCE(NULLIF(btrim(matched->>'receiptNumber'), ''), '') IS DISTINCT FROM COALESCE(NULLIF(btrim(rec.receipt_number), ''), '')
       OR (matched->>'receiptDate')::date IS DISTINCT FROM rec.receipt_date
       OR round(COALESCE((matched->>'amount')::numeric, -1), 2) IS DISTINCT FROM round(rec.amount, 2)
       OR (btrim(COALESCE(rec.description, '')) <> '' AND btrim(COALESCE(matched->>'description', '')) IS DISTINCT FROM btrim(rec.description))
    THEN
      RAISE EXCEPTION 'Approved receipt "%" (₱%) has already been verified by Accounting and cannot be modified.',
        rec.vendor, to_char(rec.amount, 'FM999,999,990.00')
        USING ERRCODE = '42501';
    END IF;

    IF p_check_items AND jsonb_typeof(COALESCE(rec.items, '[]'::jsonb)) = 'array' AND jsonb_array_length(COALESCE(rec.items, '[]'::jsonb)) > 0 THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'allocationLineId', it->>'allocationLineId',
        'quantity', round((it->>'quantity')::numeric, 3),
        'unit', btrim(COALESCE(it->>'unit', '')),
        'particular', btrim(COALESCE(it->>'particular', '')),
        'purpose', btrim(COALESCE(it->>'purpose', '')),
        'amount', round((it->>'amount')::numeric, 2)
      ) ORDER BY ord), '[]'::jsonb)
      INTO expected_items
      FROM jsonb_array_elements(rec.items) WITH ORDINALITY AS t(it, ord);

      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'allocationLineId', it->>'allocationLineId',
        'quantity', round((it->>'quantity')::numeric, 3),
        'unit', btrim(COALESCE(it->>'unit', '')),
        'particular', btrim(COALESCE(it->>'particular', '')),
        'purpose', btrim(COALESCE(it->>'purpose', '')),
        'amount', round((it->>'amount')::numeric, 2)
      ) ORDER BY ord), '[]'::jsonb)
      INTO submitted_items
      FROM jsonb_array_elements(COALESCE(matched->'items', '[]'::jsonb)) WITH ORDINALITY AS t(it, ord);

      IF submitted_items IS DISTINCT FROM expected_items THEN
        RAISE EXCEPTION 'Purchased items on approved receipt "%" (₱%) cannot be edited or removed.',
          rec.vendor, to_char(rec.amount, 'FM999,999,990.00')
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- 4. Wire server-side immutability check into eflow_budget.submit_items
CREATE OR REPLACE FUNCTION eflow_budget.submit_items(
  p_request uuid,
  p_spent numeric,
  p_note text,
  p_receipts jsonb,
  p_key uuid,
  p_refund_number text,
  p_refund_date date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.petty_cash_requests;
  li public.petty_cash_liquidations;
  rc jsonb;
  item jsonb;
  receipt_id uuid;
  source public.work_budget_allocation_lines;
  s public.office_budget_sections;
  total numeric;
  receipt_total numeric := 0;
  item_total numeric;
  pos integer;
  amt numeric;
  quantity numeric;
  payload jsonb;
  paths text[] := '{}';
  authorized record;
BEGIN
  PERFORM eflow_r7.lock_impact((SELECT task_id FROM public.petty_cash_requests WHERE id = p_request));
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = p_request FOR UPDATE;
  IF r.id IS NULL OR auth.uid() IS NULL OR (r.requester_id <> auth.uid() AND r.cash_recipient_id <> auth.uid())
    OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active AND role NOT IN ('admin', 'super_admin', 'viewer')) THEN
    RAISE EXCEPTION 'Only the active cash recipient can submit purchased items' USING ERRCODE = '42501';
  END IF;
  IF p_key IS NULL THEN
    RAISE EXCEPTION 'A liquidation idempotency key is required' USING ERRCODE = '22023';
  END IF;
  payload := jsonb_build_object('spent', p_spent, 'note', p_note, 'receipts', p_receipts, 'refundNumber', p_refund_number, 'refundDate', p_refund_date);
  SELECT * INTO li FROM public.petty_cash_liquidations WHERE request_id = r.id AND idempotency_key = p_key;
  IF li.id IS NOT NULL THEN
    IF li.itemized_payload IS DISTINCT FROM payload THEN
      RAISE EXCEPTION 'Liquidation key belongs to different receipt items' USING ERRCODE = '22023';
    END IF;
    RETURN li.id;
  END IF;
  IF p_receipts IS NULL OR jsonb_typeof(p_receipts) <> 'array' OR jsonb_array_length(p_receipts) NOT BETWEEN 1 AND 100 OR NOT eflow_budget.valid_money(p_spent, true) THEN
    RAISE EXCEPTION 'Use a valid itemized receipt package' USING ERRCODE = '22023';
  END IF;

  -- Block tampering with or removing any receipt already approved by Accounting
  PERFORM eflow_budget.assert_approved_assignment_receipts_unchanged(r.id, p_receipts, true);

  FOR rc IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
    IF NOT eflow_budget.valid_money((rc->>'amount')::numeric, true) OR NULLIF(btrim(rc->>'filePath'), '') IS NULL OR (rc->>'filePath') = ANY(paths)
       OR rc->'items' IS NULL OR jsonb_typeof(rc->'items') <> 'array' OR jsonb_array_length(rc->'items') > 100 THEN
      RAISE EXCEPTION 'Each receipt needs one unique evidence path and valid purchased items' USING ERRCODE = '22023';
    END IF;
    IF left(rc->>'filePath', length(r.org_id::text || '/' || r.id::text || '/')) <> r.org_id::text || '/' || r.id::text || '/'
      OR NOT EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'budget-receipts'
          AND o.name = rc->>'filePath'
          AND (
            o.owner_id = auth.uid()::text
            OR EXISTS (
              SELECT 1
              FROM public.work_cash_assignment_receipts ar
              JOIN public.work_cash_assignments a ON a.id = ar.assignment_id
              WHERE a.source_kind = 'task_cash_release'
                AND a.petty_cash_request_id = r.id
                AND ar.deleted_at IS NULL
                AND ar.file_path = o.name
                AND o.owner_id = ar.uploaded_by::text
            )
          )
      ) THEN
      RAISE EXCEPTION 'Receipt evidence must be an uploaded file owned by this recipient in this cash request' USING ERRCODE = '42501';
    END IF;
    paths := array_append(paths, rc->>'filePath');
    total := 0;
    FOR item IN SELECT value FROM jsonb_array_elements(rc->'items') LOOP
      amt := (item->>'amount')::numeric;
      quantity := (item->>'quantity')::numeric;
      IF NOT eflow_budget.valid_money(amt) OR quantity IS NULL OR quantity::text IN ('NaN', 'Infinity', '-Infinity') OR quantity <= 0 OR quantity > 9007199254740 OR quantity <> round(quantity, 3)
        OR NULLIF(btrim(item->>'unit'), '') IS NULL OR NULLIF(btrim(item->>'particular'), '') IS NULL OR NULLIF(btrim(item->>'purpose'), '') IS NULL THEN
        RAISE EXCEPTION 'Each item needs quantity, unit, particulars, purpose and a positive line amount' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.petty_cash_request_lines WHERE request_id = r.id AND allocation_line_id = (item->>'allocationLineId')::uuid) THEN
        RAISE EXCEPTION 'Purchased item uses an unauthorized funding account' USING ERRCODE = '42501';
      END IF;
      total := total + amt;
    END LOOP;
    IF total IS DISTINCT FROM (rc->>'amount')::numeric THEN
      RAISE EXCEPTION 'Item totals must equal each receipt total' USING ERRCODE = '22023';
    END IF;
    receipt_total := receipt_total + total;
  END LOOP;
  IF receipt_total IS DISTINCT FROM p_spent THEN
    RAISE EXCEPTION 'Receipt totals must equal declared spending exactly' USING ERRCODE = '22023';
  END IF;
  FOR authorized IN SELECT * FROM eflow_budget.authorized_cash_lines(r.id) LOOP
    SELECT COALESCE(sum((it.value->>'amount')::numeric), 0) INTO item_total
    FROM jsonb_array_elements(p_receipts) rc,
      LATERAL jsonb_array_elements(rc.value->'items') it
    WHERE (it.value->>'allocationLineId')::uuid = authorized.allocation_line_id;
    IF item_total > authorized.amount THEN
      RAISE EXCEPTION 'Spending exceeds this account authorization; obtain reauthorization first' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  li.id := public.submit_accounting_cash_liquidation(p_request, p_spent, p_note, p_receipts, p_key, p_refund_number, p_refund_date);
  FOR rc IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
    SELECT id INTO STRICT receipt_id FROM public.petty_cash_receipts WHERE liquidation_id = li.id AND file_path = rc->>'filePath';
    pos := 0;
    FOR item IN SELECT value FROM jsonb_array_elements(rc->'items') LOOP
      SELECT * INTO source FROM public.work_budget_allocation_lines WHERE id = (item->>'allocationLineId')::uuid;
      SELECT * INTO s FROM public.office_budget_sections WHERE id = source.budget_partition_id;
      INSERT INTO public.petty_cash_receipt_items(receipt_id, allocation_line_id, quantity, unit, particular, purpose, amount, position, account_name, account_label)
      VALUES (receipt_id, source.id, (item->>'quantity')::numeric, btrim(item->>'unit'), btrim(item->>'particular'), btrim(item->>'purpose'), (item->>'amount')::numeric, pos, COALESCE(s.name, source.category), s.account_code);
      pos := pos + 1;
    END LOOP;
  END LOOP;
  UPDATE public.petty_cash_liquidations SET itemized_payload = payload WHERE id = li.id;
  RETURN li.id;
END;
$function$;

-- 5. Wire server-side immutability check into public.submit_petty_cash_liquidation (non-itemized path too!)
CREATE OR REPLACE FUNCTION public.submit_petty_cash_liquidation(
  p_request_id uuid,
  p_declared_spent numeric,
  p_note text,
  p_receipts jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  request public.petty_cash_requests;
  budget public.department_fiscal_budgets;
  item jsonb;
  receipt_total numeric := 0;
  liquidation_id uuid;
  next_version int;
  liquidation_status text;
BEGIN
  PERFORM eflow_r7.lock_impact((SELECT task_id FROM public.petty_cash_requests WHERE id = p_request_id));
  SELECT * INTO request FROM public.petty_cash_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Petty-cash request not found' USING ERRCODE = 'P0002'; END IF;
  IF request.requester_id <> caller AND request.cash_recipient_id <> caller THEN
    RAISE EXCEPTION 'Only the cash recipient can submit this liquidation' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE((public.receipt_submission_clearance(request.id)->>'canSubmit')::boolean, false) THEN
    RAISE EXCEPTION 'The work must be accepted before financial receipts can be submitted' USING ERRCODE = '42501';
  END IF;
  IF request.status NOT IN ('released', 'changes_requested', 'overdue_liquidation') THEN
    RAISE EXCEPTION 'All scheduled cash must be released before liquidation' USING ERRCODE = '22023';
  END IF;
  IF p_declared_spent < 0 OR p_declared_spent > request.released_amount THEN
    RAISE EXCEPTION 'Actual spending cannot exceed the amount released' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_note), '') IS NULL THEN
    RAISE EXCEPTION 'Add a liquidation note' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_receipts, '[]'::jsonb)) <> 'array' OR jsonb_array_length(COALESCE(p_receipts, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Attach at least one receipt' USING ERRCODE = '22023';
  END IF;

  -- Block tampering with or removing any receipt already approved by Accounting
  PERFORM eflow_budget.assert_approved_assignment_receipts_unchanged(request.id, p_receipts, false);

  SELECT * INTO budget FROM public.department_fiscal_budgets WHERE id = request.fiscal_budget_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
    IF NULLIF(btrim(item ->> 'vendor'), '') IS NULL OR NULLIF(btrim(item ->> 'description'), '') IS NULL
       OR NULLIF(btrim(item ->> 'filePath'), '') IS NULL OR NULLIF(item ->> 'receiptDate', '') IS NULL THEN
      RAISE EXCEPTION 'Every receipt needs vendor, date, description, amount, and attachment' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'budget-receipts'
        AND o.name = item ->> 'filePath'
        AND o.name LIKE request.org_id::text || '/' || request.id::text || '/%'
        AND split_part(o.name, '/', 3) <> 'requests'
        AND (
          o.owner_id = caller::text
          OR EXISTS (
            SELECT 1
            FROM public.work_cash_assignment_receipts ar
            JOIN public.work_cash_assignments a ON a.id = ar.assignment_id
            WHERE a.source_kind = 'task_cash_release'
              AND a.petty_cash_request_id = request.id
              AND ar.deleted_at IS NULL
              AND ar.file_path = o.name
              AND o.owner_id = ar.uploaded_by::text
          )
        )
    ) THEN
      RAISE EXCEPTION 'Attach an uploaded financial receipt owned by this cash recipient' USING ERRCODE = '42501';
    END IF;
    receipt_total := receipt_total + COALESCE((item ->> 'amount')::numeric, 0);
  END LOOP;
  IF abs(receipt_total - p_declared_spent) > 0.009 THEN
    RAISE EXCEPTION 'Receipt amounts must equal the declared amount spent' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO next_version FROM public.petty_cash_liquidations WHERE request_id = request.id;
  liquidation_status := CASE WHEN request.task_leader_id = caller THEN 'pending_department_settlement' ELSE 'pending_leader_review' END;
  INSERT INTO public.petty_cash_liquidations(request_id, version, declared_spent, returned_amount, note, status, submitted_by)
  VALUES (request.id, next_version, p_declared_spent, request.released_amount - p_declared_spent, btrim(p_note), liquidation_status, caller)
  RETURNING id INTO liquidation_id;
  FOR item IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
    INSERT INTO public.petty_cash_receipts(
      liquidation_id, vendor, receipt_number, receipt_date, description, amount,
      file_name, file_path, mime_type, file_size, override_reason, created_by
    ) VALUES (
      liquidation_id, btrim(item ->> 'vendor'), NULLIF(btrim(item ->> 'receiptNumber'), ''),
      (item ->> 'receiptDate')::date, btrim(item ->> 'description'), (item ->> 'amount')::numeric,
      item ->> 'fileName', item ->> 'filePath', COALESCE(NULLIF(item ->> 'mimeType', ''), 'application/octet-stream'),
      COALESCE((item ->> 'fileSize')::bigint, 0), NULLIF(btrim(item ->> 'overrideReason'), ''), caller
    );
  END LOOP;
  UPDATE public.petty_cash_requests
  SET status = CASE WHEN liquidation_status = 'pending_leader_review' THEN 'pending_leader_liquidation_review' ELSE 'pending_department_settlement' END,
      updated_at = now()
  WHERE id = request.id;
  IF liquidation_status = 'pending_leader_review' THEN
    INSERT INTO public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, financial_record_id, financial_record_type)
    SELECT request.task_leader_id, 'petty_cash_liquidation_leader_review', 'Expense liquidation needs your review',
      COALESCE(profile.full_name, 'A team member') || ' submitted receipts totaling ₱' || to_char(p_declared_spent, 'FM999G999G999G990D00') || '.',
      request.task_id, caller, COALESCE(profile.full_name, ''), liquidation_id, 'petty_cash_liquidation'
    FROM public.profiles profile WHERE profile.id = caller;
  ELSE
    INSERT INTO public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, financial_record_id, financial_record_type)
    SELECT approver_id, 'petty_cash_liquidation_department_review', 'Expense liquidation ready for settlement',
      COALESCE(profile.full_name, 'A Task Leader') || ' submitted receipts totaling ₱' || to_char(p_declared_spent, 'FM999G999G999G990D00') || '.',
      request.task_id, caller, COALESCE(profile.full_name, ''), liquidation_id, 'petty_cash_liquidation'
    FROM public.organization_approver_ids(request.org_id) approver_id
    LEFT JOIN public.profiles profile ON profile.id = caller
    WHERE approver_id <> caller;
  END IF;
  RETURN liquidation_id;
END;
$function$;
