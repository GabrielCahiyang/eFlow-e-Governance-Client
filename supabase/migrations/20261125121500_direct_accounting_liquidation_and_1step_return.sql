-- ============================================================================
-- Migration: 20261125121500_direct_accounting_liquidation_and_1step_return.sql
-- Purpose:
--   1. Route submitted task/subtask cash liquidations directly to Accounting
--      ('pending_department_settlement') without the redundant Head/Leader
--      "Submit to Accounting" middleman step, and notify active accounting_staff
--      immediately (notifying Office Head only when a liquidation is late).
--   2. Align public.cash_return_clearance with 1-step Accounting return
--      verification (no separate Office Head cash-return approval step).
--   3. Move any currently stuck 'pending_leader_review' liquidations directly
--      into 'pending_department_settlement' with audit logs + Accounting alert.
-- ============================================================================

-- 1. Update public.submit_petty_cash_liquidation to go straight to Accounting
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
  v_returned numeric := 0;
  v_actor_name text;
  v_task_title text;
  v_project_id uuid;
  v_is_late boolean := false;
BEGIN
  PERFORM eflow_r7.lock_impact((SELECT task_id FROM public.petty_cash_requests WHERE id = p_request_id));
  SELECT * INTO request FROM public.petty_cash_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Petty-cash request not found' USING ERRCODE = 'P0002';
  END IF;
  IF request.requester_id <> caller AND request.cash_recipient_id <> caller THEN
    RAISE EXCEPTION 'Only the cash recipient can submit this liquidation' USING ERRCODE = '42501';
  END IF;
  IF NOT COALESCE((public.receipt_submission_clearance(request.id)->>'canSubmit')::boolean, false) THEN
    RAISE EXCEPTION 'The work must be submitted or accepted before financial receipts can be submitted' USING ERRCODE = '42501';
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

  SELECT COALESCE(max(version), 0) + 1 INTO next_version
  FROM public.petty_cash_liquidations
  WHERE request_id = request.id;

  v_returned := round(request.released_amount - p_declared_spent, 2);
  v_is_late := request.liquidation_due_at IS NOT NULL AND now() > request.liquidation_due_at;

  INSERT INTO public.petty_cash_liquidations(
    request_id, version, declared_spent, returned_amount, note, status, submitted_by
  ) VALUES (
    request.id, next_version, p_declared_spent, v_returned, btrim(p_note), 'pending_department_settlement', caller
  )
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
  SET status = 'pending_department_settlement',
      updated_at = now()
  WHERE id = request.id;

  SELECT COALESCE(full_name, 'Staff') INTO v_actor_name FROM public.profiles WHERE id = caller;
  SELECT t.title, t.linked_project_id INTO v_task_title, v_project_id
  FROM public.tasks t
  WHERE t.id = request.task_id;

  -- Notify active Accounting Staff directly so they can verify receipts + unused cash return & settle in 1 step
  INSERT INTO public.notifications(
    user_id, type, title, message, task_id, task_title, project_id, org_id,
    actor_id, actor_name, work_node_id, financial_record_id, financial_record_type
  )
  SELECT acc.id,
         'petty_cash_liquidation_department_review',
         'Expense liquidation ready for settlement',
         format('%s submitted ₱%s in receipts%s for "%s". Open Settlements to verify and settle.',
           v_actor_name,
           to_char(p_declared_spent, 'FM999,999,990.00'),
           CASE WHEN v_returned > 0
             THEN format(' and ₱%s unused cash return', to_char(v_returned, 'FM999,999,990.00'))
             ELSE ''
           END,
           COALESCE(v_task_title, request.purpose, 'Funded work')
         ),
         request.task_id,
         v_task_title,
         v_project_id,
         request.org_id,
         caller,
         v_actor_name,
         request.subtask_id,
         liquidation_id,
         'petty_cash_liquidation'
  FROM public.profiles acc
  WHERE acc.org_id = request.org_id
    AND acc.is_active = true
    AND acc.role::text = 'accounting_staff'
    AND acc.id IS DISTINCT FROM caller
    AND acc.id IS DISTINCT FROM request.requester_id
    AND acc.id IS DISTINCT FROM request.cash_recipient_id
    AND acc.id IS DISTINCT FROM request.task_leader_id;

  -- Only notify Office Head when the liquidation was submitted after the deadline (requires late authorization)
  IF v_is_late THEN
    INSERT INTO public.notifications(
      user_id, type, title, message, task_id, task_title, project_id, org_id,
      actor_id, actor_name, work_node_id, financial_record_id, financial_record_type
    )
    SELECT approver_id,
           'petty_cash_liquidation_department_review',
           'Late expense liquidation needs Head authorization',
           format('%s submitted a late liquidation (₱%s spent%s) for "%s". Authorize before Accounting settles.',
             v_actor_name,
             to_char(p_declared_spent, 'FM999,999,990.00'),
             CASE WHEN v_returned > 0
               THEN format(', ₱%s return', to_char(v_returned, 'FM999,999,990.00'))
               ELSE ''
             END,
             COALESCE(v_task_title, request.purpose, 'Funded work')
           ),
           request.task_id,
           v_task_title,
           v_project_id,
           request.org_id,
           caller,
           v_actor_name,
           request.subtask_id,
           liquidation_id,
           'petty_cash_liquidation'
    FROM public.organization_approver_ids(request.org_id) approver_id
    WHERE approver_id IS DISTINCT FROM caller;
  END IF;

  RETURN liquidation_id;
END;
$function$;

-- 2. Align public.cash_return_clearance with 1-step Accounting return verification
--    (no separate Office Head return approval step).
CREATE OR REPLACE FUNCTION public.cash_return_clearance(p_liquidation uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  l public.petty_cash_liquidations;
  r public.petty_cash_requests;
  d eflow_work_clearance.return_decisions;
  stamp text;
  received boolean;
  pending boolean;
BEGIN
  SELECT * INTO l FROM public.petty_cash_liquidations WHERE id = p_liquidation;
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = l.request_id;
  IF auth.uid() IS NULL OR r.id IS NULL OR NOT COALESCE(eflow_r3.eligible(auth.uid()), false)
     OR NOT (
       COALESCE(eflow_finance_review.scope_allowed(r.org_id, auth.uid()), false)
       OR (
         COALESCE(public.can_see_task(r.task_id, auth.uid()), false)
         AND (
           auth.uid() IN (r.requester_id, r.cash_recipient_id, r.task_leader_id)
           OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = r.task_id AND t.assigned_to = auth.uid())
         )
       )
     )
  THEN
    RAISE EXCEPTION 'Current financial record access required' USING ERRCODE = '42501';
  END IF;

  stamp := eflow_finance_review.fingerprint(l, r);
  SELECT * INTO d FROM eflow_work_clearance.return_decisions WHERE liquidation_id = l.id;

  received := COALESCE(
    d.version = l.version
    AND d.fingerprint = stamp
    AND d.amount = l.returned_amount
    AND NULLIF(btrim(COALESCE(d.receive_reference, '')), '') IS NOT NULL
    AND d.received_by IS NOT NULL
    AND d.received_by IS DISTINCT FROM l.submitted_by
    AND d.received_by IS DISTINCT FROM r.requester_id
    AND d.received_by IS DISTINCT FROM r.cash_recipient_id
    AND public.is_department_accounting_staff(r.org_id, d.received_by)
    AND public.has_permission(d.received_by, 'accounting.settle_liquidation'),
    false
  );

  pending := l.status IN ('pending_leader_review', 'pending_department_settlement')
    AND r.status <> 'settled'
    AND NOT EXISTS (
      SELECT 1 FROM public.petty_cash_liquidations newer
      WHERE newer.request_id = r.id AND newer.version > l.version
    );

  RETURN jsonb_build_object(
    'version', 1,
    'liquidationId', l.id,
    'packageVersion', l.version,
    'amount', l.returned_amount,
    'received', received,
    'approved', received,
    'receivedBy', CASE WHEN received THEN d.received_by END,
    'approvedBy', CASE WHEN received THEN COALESCE(d.approved_by, d.received_by) END,
    'reference', CASE WHEN received THEN d.receive_reference END,
    'canAcknowledge', l.returned_amount > 0 AND pending AND NOT received
      AND public.is_department_accounting_staff(r.org_id, auth.uid())
      AND public.has_permission(auth.uid(), 'accounting.settle_liquidation')
      AND auth.uid() IS DISTINCT FROM l.submitted_by
      AND auth.uid() IS DISTINCT FROM r.requester_id
      AND auth.uid() IS DISTINCT FROM r.cash_recipient_id,
    'canApprove', false
  );
END;
$function$;

-- 3. Migrate any pending_leader_review liquidations (such as FR-00001) straight
--    to Accounting ('pending_department_settlement') with audit logs + notification.
DO $$
DECLARE
  rec record;
  v_actor_name text;
BEGIN
  FOR rec IN
    SELECT
      l.id AS liquidation_id,
      l.request_id,
      l.declared_spent,
      l.returned_amount,
      l.submitted_by,
      r.org_id,
      r.task_id,
      r.subtask_id,
      r.requester_id,
      r.cash_recipient_id,
      r.task_leader_id,
      r.request_number,
      r.purpose,
      t.title AS task_title,
      t.linked_project_id AS project_id
    FROM public.petty_cash_liquidations l
    JOIN public.petty_cash_requests r ON r.id = l.request_id
    LEFT JOIN public.tasks t ON t.id = r.task_id
    WHERE l.status = 'pending_leader_review'
  LOOP
    UPDATE public.petty_cash_liquidations
    SET status = 'pending_department_settlement'
    WHERE id = rec.liquidation_id;

    UPDATE public.petty_cash_requests
    SET status = 'pending_department_settlement',
        updated_at = now()
    WHERE id = rec.request_id
      AND status = 'pending_leader_liquidation_review';

    UPDATE public.notifications
    SET read = true
    WHERE financial_record_id = rec.liquidation_id
      AND type = 'petty_cash_liquidation_leader_review';

    SELECT COALESCE(full_name, 'Staff') INTO v_actor_name
    FROM public.profiles
    WHERE id = rec.submitted_by;

    INSERT INTO public.audit_events(
      actor_id, actor_name, entity_type, entity_id, action, org_id, target_label, change_summary, after_data
    ) VALUES (
      rec.submitted_by,
      COALESCE(v_actor_name, 'Staff'),
      'petty_cash_liquidation',
      rec.liquidation_id::text,
      'petty_cash_liquidation.routed_direct_to_accounting',
      rec.org_id,
      COALESCE(rec.task_title, rec.purpose, format('FR-%s', lpad(rec.request_number::text, 5, '0'))),
      format('Routed FR-%s liquidation (₱%s spent, ₱%s return) directly to Accounting settlement',
        lpad(rec.request_number::text, 5, '0'),
        to_char(rec.declared_spent, 'FM999,999,990.00'),
        to_char(rec.returned_amount, 'FM999,999,990.00')
      ),
      jsonb_build_object(
        'requestId', rec.request_id,
        'liquidationId', rec.liquidation_id,
        'declaredSpent', rec.declared_spent,
        'returnedAmount', rec.returned_amount
      )
    );

    INSERT INTO public.notifications(
      user_id, type, title, message, task_id, task_title, project_id, org_id,
      actor_id, actor_name, work_node_id, financial_record_id, financial_record_type
    )
    SELECT acc.id,
           'petty_cash_liquidation_department_review',
           'Expense liquidation ready for settlement',
           format('%s submitted ₱%s in receipts%s for "%s". Open Settlements to verify and settle.',
             COALESCE(v_actor_name, 'Staff'),
             to_char(rec.declared_spent, 'FM999,999,990.00'),
             CASE WHEN rec.returned_amount > 0
               THEN format(' and ₱%s unused cash return', to_char(rec.returned_amount, 'FM999,999,990.00'))
               ELSE ''
             END,
             COALESCE(rec.task_title, rec.purpose, 'Funded work')
           ),
           rec.task_id,
           rec.task_title,
           rec.project_id,
           rec.org_id,
           rec.submitted_by,
           COALESCE(v_actor_name, 'Staff'),
           rec.subtask_id,
           rec.liquidation_id,
           'petty_cash_liquidation'
    FROM public.profiles acc
    WHERE acc.org_id = rec.org_id
      AND acc.is_active = true
      AND acc.role::text = 'accounting_staff'
      AND acc.id IS DISTINCT FROM rec.submitted_by
      AND acc.id IS DISTINCT FROM rec.requester_id
      AND acc.id IS DISTINCT FROM rec.cash_recipient_id
      AND acc.id IS DISTINCT FROM rec.task_leader_id
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications existing
        WHERE existing.user_id = acc.id
          AND existing.financial_record_id = rec.liquidation_id
          AND existing.type = 'petty_cash_liquidation_department_review'
      );
  END LOOP;
END $$;
