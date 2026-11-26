-- ============================================================================
-- Migration: 20261125110000_office_petty_cash_strict_assign_and_1step_return.sql
-- Purpose:
--   1. Strictly block submitting receipts on Office Petty Cash unless the cash
--      was explicitly assigned to a Task/Subtask via work_cash_assignments
--      (assignedAmount > 0), and cap total receipts at assignedAmount while
--      keeping Accounting-approved assignment receipts immutable.
--   2. Simplify Office Petty Cash unused-cash return into 1-step Accounting
--      confirmation & settlement:
--      - Full unused return (₱0 spent) skips Head "Endorse receipts" and goes
--        directly to Accounting ('receipt_approved') with immediate notification.
--      - Accounting confirms physical receipt of returned cash + mandatory
--        receiving OR / acknowledgment reference and settles in ONE atomic step,
--        crediting funds back to the ₱30,000 revolving fund and writing full
--        eflow_office_cash.events + public.audit_events records.
-- ============================================================================

-- 1. Simplify cash_return_cleared to require verified independent Accounting receipt
--    (or audited Head fallback when no independent Accounting Officer exists),
--    eliminating the multi-step Head return-approval ping-pong.
CREATE OR REPLACE FUNCTION eflow_office_cash.cash_return_cleared(r eflow_office_cash.requests)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT COALESCE(r.returned_amount, 0) <= 0
    OR (
      r.cash_return_version IS NOT DISTINCT FROM r.receipt_version
      AND r.cash_return_received_at IS NOT NULL
      AND r.cash_return_received_by IS NOT NULL
      AND NULLIF(btrim(COALESCE(r.cash_return_receive_reference, '')), '') IS NOT NULL
      AND r.cash_return_received_by IS DISTINCT FROM r.requester
      AND (
        eflow_office_cash.is_independent_return_receiver(r, r.cash_return_received_by)
        OR (
          NOT eflow_office_cash.has_independent_return_receiver(r)
          AND public.phase2_is_office_head(r.cash_return_received_by, r.office)
        )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION eflow_office_cash.guard_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'settled'
    AND OLD.status IS DISTINCT FROM 'settled'
    AND COALESCE(NEW.returned_amount, 0) > 0
  THEN
    IF NOT eflow_office_cash.cash_return_cleared(NEW) THEN
      RAISE EXCEPTION 'Enter the cash return receiving reference (OR / acknowledgment #) to confirm physical receipt before settling.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Update eflow_office_cash.snapshot to expose assignment receipt lock status
--    and reflect one-step Accounting return confirmation & settlement.
CREATE OR REPLACE FUNCTION eflow_office_cash.snapshot(p_office uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p public.profiles;
  balance numeric;
  reserved numeric;
  outstanding numeric;
  manager boolean;
BEGIN
  p := eflow_office_cash.actor(p_office);
  manager := p.role = 'accounting_staff' OR public.phase2_is_office_head(p.id, p_office);
  PERFORM eflow_office_cash.ensure_fund(p_office);
  SELECT cash INTO balance FROM eflow_office_cash.funds WHERE office = p_office;
  SELECT
    COALESCE(sum(amount) FILTER (WHERE status IN ('pending', 'approved')), 0),
    COALESCE(sum(amount) FILTER (WHERE status IN ('released', 'receipt_review', 'receipt_approved')), 0)
  INTO reserved, outstanding
  FROM eflow_office_cash.requests
  WHERE office = p_office;

  RETURN jsonb_build_object(
    'ceiling', 30000,
    'receiptLimit', 5000,
    'cash', COALESCE(balance, 0),
    'reserved', reserved,
    'available', COALESCE(balance, 0) - reserved,
    'outstanding', outstanding,
    'replenishable', 30000 - COALESCE(balance, 0) - outstanding,
    'requests', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(r) || jsonb_build_object(
          'requesterName', pr.full_name,
          'cashReturnReceivedByName', rec.full_name,
          'cashReturnApprovedByName', app.full_name,
          'assignedAmount', COALESCE((
            SELECT SUM(a.amount)::numeric(14,2)
            FROM public.work_cash_assignments a
            WHERE a.source_kind = 'office_petty_cash'
              AND a.office_cash_request_id = r.id
              AND a.status = 'active'
          ), 0::numeric(14,2)),
          'assignmentReceipts', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'id', ar.id,
              'assignmentId', a.id,
              'taskTitle', t.title,
              'subtaskTitle', s.title,
              'vendor', ar.vendor,
              'number', COALESCE(ar.receipt_number, ''),
              'date', ar.receipt_date::text,
              'amount', ar.amount,
              'path', ar.file_path,
              'description', ar.description,
              'uploadedByName', COALESCE(up.full_name, ''),
              'receiptReviewStatus', a.receipt_review_status,
              'locked', (a.receipt_review_status = 'approved' OR a.status = 'settled'),
              'accountingDecidedByName', COALESCE(dec_p.full_name, '')
            ) ORDER BY ar.created_at ASC)
            FROM public.work_cash_assignments a
            JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
            JOIN public.tasks t ON t.id = a.task_id
            LEFT JOIN public.subtasks s ON s.id = a.subtask_id
            LEFT JOIN public.profiles up ON up.id = ar.uploaded_by
            LEFT JOIN public.profiles dec_p ON dec_p.id = a.accounting_decided_by
            WHERE a.source_kind = 'office_petty_cash'
              AND a.office_cash_request_id = r.id
              AND a.status IN ('active', 'settled')
              AND ar.deleted_at IS NULL
          ), '[]'::jsonb),
          'returnClearanceRequired',
            r.status IN ('receipt_review', 'receipt_approved', 'settled')
            AND COALESCE(r.returned_amount, 0) > 0,
          'returnReceived',
            COALESCE(r.returned_amount, 0) > 0
            AND r.cash_return_version IS NOT DISTINCT FROM r.receipt_version
            AND r.cash_return_received_at IS NOT NULL,
          'returnApproved', eflow_office_cash.cash_return_cleared(r),
          'returnHeadFallback',
            r.status IN ('receipt_review', 'receipt_approved')
            AND COALESCE(r.returned_amount, 0) > 0
            AND NOT eflow_office_cash.has_independent_return_receiver(r),
          'canAcknowledgeReturn', false,
          'canApproveReturn', false,
          'canSettle',
            r.status = 'receipt_approved'
            AND eflow_office_cash.is_independent_settler(r, p.id),
          'headCanSettle', eflow_office_cash.head_can_fallback_settle(r, p.id),
          'settlementBlocked',
            r.status = 'receipt_approved'
            AND NOT EXISTS (
              SELECT 1 FROM public.profiles candidate
              WHERE candidate.org_id = r.office
                AND eflow_office_cash.is_independent_settler(r, candidate.id)
            ),
          'headNotified', EXISTS (
            SELECT 1
            FROM eflow_office_cash.settlement_alerts a
            JOIN public.organizations o ON o.id = r.office AND o.head_user_id = a.head_id
            WHERE a.request_id = r.id
          )
        )
        ORDER BY r.created_at DESC
      )
      FROM eflow_office_cash.requests r
      JOIN public.profiles pr ON pr.id = r.requester
      LEFT JOIN public.profiles rec ON rec.id = r.cash_return_received_by
      LEFT JOIN public.profiles app ON app.id = r.cash_return_approved_by
      WHERE r.office = p_office
        AND (manager OR r.requester = p.id)
    ), '[]'),
    'events', COALESCE((
      SELECT jsonb_agg(
        to_jsonb(e) || jsonb_build_object('actorName', pr.full_name)
        ORDER BY e.id DESC
      )
      FROM eflow_office_cash.events e
      JOIN public.profiles pr ON pr.id = e.actor
      WHERE e.office = p_office
        AND manager
    ), '[]')
  );
END;
$function$;

-- 3. Update eflow_office_cash.command with:
--    - Strict assignment gating (no receipts allowed unless assignedAmount > 0,
--      and total_spent <= assignedAmount, with approved assignment receipts locked).
--    - Full unused return (₱0 spent) skips Head "Endorse receipts" and routes
--      straight to Accounting ('receipt_approved') with immediate notification.
--    - One-step Accounting 'settle' verifies physical cash return + mandatory
--      receiving OR/acknowledgment reference, credits the ₱30,000 fund, and writes
--      immutable audit_events + eflow_office_cash.events records.
CREATE OR REPLACE FUNCTION eflow_office_cash.command(
  p_office uuid,
  p_key uuid,
  p_action text,
  p_data jsonb
)
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
  v_assigned_total numeric := 0;
  v_refund_no text;
  v_refund_date date;
  v_return_ref text;
  v_head_fallback boolean := false;
  v_next_status text;
  receipt jsonb;
  approved_rec record;
  matched_rcpt jsonb;
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
                 format('%s endorsed receipts for "%s"%s. Open Office Petty Cash to verify and settle.',
                   COALESCE(p.full_name, 'Office Head'),
                   r.purpose,
                   CASE WHEN COALESCE(r.returned_amount, 0) > 0
                     THEN format(' (includes ₱%s unused cash return)', to_char(r.returned_amount, 'FM999,999,990.00'))
                     ELSE ''
                   END
                 ),
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
          format('%s released ₱%s for "%s". Assign to work or return unused cash within 15 days.', COALESCE(p.full_name, 'Accounting'), to_char(r.amount, 'FM999,999,990.00'), r.purpose),
          p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        );
      END IF;

    ELSIF p_action = 'receipts' THEN
      IF p.id <> r.requester OR r.status <> 'released' THEN
        RAISE EXCEPTION 'Only the recipient can submit receipts or return unused cash for released petty cash' USING ERRCODE = '42501';
      END IF;
      IF jsonb_typeof(p_data->'receipts') IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_data->'receipts') NOT BETWEEN 0 AND 30
      THEN
        RAISE EXCEPTION 'Add up to 30 receipts, or return the entire unspent advance' USING ERRCODE = '22023';
      END IF;

      -- Check how much of this office petty cash was explicitly assigned to Tasks/Subtasks
      SELECT COALESCE(SUM(a.amount), 0)::numeric(14,2)
      INTO v_assigned_total
      FROM public.work_cash_assignments a
      WHERE a.source_kind = 'office_petty_cash'
        AND a.office_cash_request_id = r.id
        AND a.status = 'active';

      IF jsonb_array_length(p_data->'receipts') > 0 AND v_assigned_total <= 0 THEN
        RAISE EXCEPTION 'This office petty cash was not assigned to any task or subtask. Return the unused cash instead.'
          USING ERRCODE = '42501';
      END IF;

      -- Ensure Accounting-approved assignment receipts cannot be omitted or altered
      FOR approved_rec IN
        SELECT ar.*
        FROM public.work_cash_assignments a
        JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
        WHERE a.source_kind = 'office_petty_cash'
          AND a.office_cash_request_id = r.id
          AND a.status IN ('active', 'settled')
          AND a.receipt_review_status = 'approved'
          AND ar.deleted_at IS NULL
      LOOP
        SELECT value INTO matched_rcpt
        FROM jsonb_array_elements(p_data->'receipts')
        WHERE value->>'path' = approved_rec.file_path
        LIMIT 1;

        IF matched_rcpt IS NULL THEN
          RAISE EXCEPTION 'Approved receipt "%" (₱%) cannot be removed or replaced.',
            approved_rec.vendor, to_char(approved_rec.amount, 'FM999,999,990.00')
            USING ERRCODE = '42501';
        END IF;

        IF btrim(COALESCE(matched_rcpt->>'vendor', '')) IS DISTINCT FROM btrim(approved_rec.vendor)
           OR COALESCE(NULLIF(btrim(matched_rcpt->>'number'), ''), '') IS DISTINCT FROM COALESCE(NULLIF(btrim(approved_rec.receipt_number), ''), '')
           OR (matched_rcpt->>'date')::date IS DISTINCT FROM approved_rec.receipt_date
           OR round(COALESCE((matched_rcpt->>'amount')::numeric, -1), 2) IS DISTINCT FROM round(approved_rec.amount, 2)
        THEN
          RAISE EXCEPTION 'Approved receipt "%" (₱%) has already been verified by Accounting and cannot be modified.',
            approved_rec.vendor, to_char(approved_rec.amount, 'FM999,999,990.00')
            USING ERRCODE = '42501';
        END IF;
      END LOOP;

      FOR receipt IN SELECT * FROM jsonb_array_elements(p_data->'receipts') LOOP
        amt := (receipt->>'amount')::numeric;
        path := receipt->>'path';
        IF amt IS NULL OR amt <= 0 OR amt > 5000 OR amt <> round(amt, 2) THEN
          RAISE EXCEPTION 'Each receipt must be greater than zero and at most ₱5,000.00' USING ERRCODE = '22023';
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
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = 'office-petty-receipts'
              AND o.name = path
              AND (
                o.owner_id = p.id::text
                OR EXISTS (
                  SELECT 1
                  FROM public.work_cash_assignment_receipts ar
                  JOIN public.work_cash_assignments a ON a.id = ar.assignment_id
                  WHERE a.source_kind = 'office_petty_cash'
                    AND a.office_cash_request_id = r.id
                    AND ar.deleted_at IS NULL
                    AND ar.file_path = o.name
                    AND o.owner_id = ar.uploaded_by::text
                )
              )
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

      IF total_spent > v_assigned_total THEN
        RAISE EXCEPTION 'Total receipts (₱%) cannot exceed the ₱% explicitly assigned to tasks/subtasks. Return the unassigned balance as unused cash.',
          to_char(total_spent, 'FM999,999,990.00'),
          to_char(v_assigned_total, 'FM999,999,990.00')
          USING ERRCODE = '22023';
      END IF;

      v_returned := round(r.amount - total_spent, 2);
      IF v_returned > 0 THEN
        v_refund_no := NULLIF(btrim(COALESCE(p_data->>'refundReceiptNumber', '')), '');
        IF v_refund_no IS NOT NULL AND length(v_refund_no) > 100 THEN
          RAISE EXCEPTION 'Refund receipt number must be 100 characters or less' USING ERRCODE = '22023';
        END IF;
        v_refund_date := COALESCE(NULLIF(btrim(COALESCE(p_data->>'refundDate', '')), '')::date, day);
        IF v_refund_date > day THEN
          RAISE EXCEPTION 'Enter a valid cash return date on or before the transaction date' USING ERRCODE = '22023';
        END IF;
      ELSE
        v_refund_no := NULL;
        v_refund_date := NULL;
      END IF;

      -- Zero-receipt full unused return skips Head "Endorse receipts" and goes
      -- directly to Accounting ('receipt_approved') for 1-step return confirmation!
      v_next_status := CASE WHEN total_spent <= 0 THEN 'receipt_approved' ELSE 'receipt_review' END;

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
          status = v_next_status
      WHERE id = r.id;

      IF total_spent <= 0 THEN
        INSERT INTO public.audit_events(
          actor_id, actor_name, entity_type, entity_id, action, reason, org_id, target_label, change_summary, after_data
        ) VALUES (
          p.id,
          COALESCE(p.full_name, 'Staff'),
          'office_petty_cash',
          r.id::text,
          'office_petty_cash.unused_return_submitted',
          reference,
          p_office,
          r.purpose,
          format('Submitted full unused Office Petty Cash return of ₱%s for "%s"', to_char(v_returned, 'FM999,999,990.00'), r.purpose),
          jsonb_build_object('requestId', r.id, 'returnedAmount', v_returned, 'refundReceiptNumber', v_refund_no, 'refundDate', v_refund_date)
        );

        INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
        SELECT acc.id,
               'petty_cash_liquidation_accounting_review',
               'Unused office petty cash return ready to confirm',
               format('%s is returning ₱%s unused Office Petty Cash for "%s". Open Office Petty Cash to confirm receipt & settle.',
                 COALESCE(p.full_name, 'Staff'),
                 to_char(v_returned, 'FM999,999,990.00'),
                 r.purpose
               ),
               p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        FROM public.profiles acc
        WHERE acc.org_id = p_office
          AND acc.is_active
          AND acc.role::text = 'accounting_staff'
          AND acc.id IS DISTINCT FROM p.id;
      ELSE
        INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
        SELECT o.head_user_id,
               'petty_cash_liquidation_department_review',
               'Office petty cash receipts ready for endorsement',
               format('%s submitted ₱%s in receipts for "%s"%s.',
                 COALESCE(p.full_name, 'Staff'),
                 to_char(total_spent, 'FM999,999,990.00'),
                 r.purpose,
                 CASE WHEN v_returned > 0
                   THEN format(' (returning ₱%s unused)', to_char(v_returned, 'FM999,999,990.00'))
                   ELSE ''
                 END
               ),
               p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        FROM public.organizations o
        JOIN public.profiles h ON h.id = o.head_user_id
        WHERE o.id = p_office AND o.is_active AND h.is_active AND h.id IS DISTINCT FROM p.id;
      END IF;

      event_details := p_data || jsonb_build_object(
        'spent', total_spent,
        'returnedAmount', v_returned,
        'refundReceiptNumber', v_refund_no,
        'refundDate', v_refund_date
      );
      amt := CASE WHEN total_spent <= 0 THEN v_returned ELSE total_spent END;

    ELSIF p_action = 'settle' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status <> 'receipt_approved' THEN
        RAISE EXCEPTION 'Independent receipt endorsement or unused return submission is required before settlement' USING ERRCODE = '22023';
      END IF;
      IF NOT eflow_office_cash.is_independent_settler(r, p.id) THEN
        IF eflow_office_cash.head_can_fallback_settle(r, p.id) THEN
          v_head_fallback := true;
        ELSE
          RAISE EXCEPTION 'A separate Accounting Officer must settle this request' USING ERRCODE = '42501';
        END IF;
      END IF;

      -- One-step physical cash return verification during settlement
      IF COALESCE(r.returned_amount, 0) > 0 THEN
        v_return_ref := COALESCE(
          NULLIF(btrim(p_data->>'returnReference'), ''),
          NULLIF(btrim(r.cash_return_receive_reference), ''),
          NULLIF(btrim(reference), '')
        );
        IF v_return_ref IS NULL THEN
          RAISE EXCEPTION 'Enter the cash return receiving reference (OR / acknowledgment #) before settling.' USING ERRCODE = '22023';
        END IF;
        IF length(v_return_ref) > 1000 THEN
          RAISE EXCEPTION 'Cash return receiving reference must be 1,000 characters or less.' USING ERRCODE = '22023';
        END IF;

        UPDATE eflow_office_cash.requests
        SET cash_return_version = r.receipt_version,
            cash_return_received_by = COALESCE(cash_return_received_by, p.id),
            cash_return_received_at = COALESCE(cash_return_received_at, now()),
            cash_return_receive_reference = v_return_ref,
            cash_return_approved_by = COALESCE(cash_return_approved_by, p.id),
            cash_return_approved_at = COALESCE(cash_return_approved_at, now()),
            cash_return_approval_note = COALESCE(cash_return_approval_note, 'Verified during one-step Accounting settlement'),
            refund_receipt_number = COALESCE(NULLIF(btrim(refund_receipt_number), ''), v_return_ref)
        WHERE id = r.id
        RETURNING * INTO r;
      END IF;

      UPDATE eflow_office_cash.funds SET cash = cash + (r.amount - r.spent) WHERE office = p_office;
      UPDATE eflow_office_cash.requests SET status = 'settled' WHERE id = r.id;

      UPDATE public.work_cash_assignments
      SET receipt_review_status = 'approved',
          accounting_decided_by = COALESCE(accounting_decided_by, p.id),
          accounting_decided_at = COALESCE(accounting_decided_at, now()),
          updated_at = now()
      WHERE source_kind = 'office_petty_cash'
        AND office_cash_request_id = r.id
        AND status = 'active';

      INSERT INTO public.audit_events(
        actor_id, actor_name, entity_type, entity_id, action, reason, org_id, target_label, change_summary, after_data
      ) VALUES (
        p.id,
        COALESCE(p.full_name, 'Accounting Officer'),
        'office_petty_cash',
        r.id::text,
        CASE WHEN COALESCE(r.returned_amount, 0) > 0 THEN 'office_petty_cash.return_verified_and_settled' ELSE 'office_petty_cash.settled' END,
        COALESCE(v_return_ref, reference),
        p_office,
        r.purpose,
        CASE
          WHEN COALESCE(r.returned_amount, 0) > 0 AND COALESCE(r.spent, 0) <= 0 THEN
            format('Confirmed physical return of ₱%s unused Office Petty Cash for "%s" (Ref: %s) and credited fund', to_char(r.returned_amount, 'FM999,999,990.00'), r.purpose, COALESCE(v_return_ref, reference))
          WHEN COALESCE(r.returned_amount, 0) > 0 THEN
            format('Verified ₱%s receipts and ₱%s returned Office Petty Cash for "%s" (Ref: %s)', to_char(r.spent, 'FM999,999,990.00'), to_char(r.returned_amount, 'FM999,999,990.00'), r.purpose, COALESCE(v_return_ref, reference))
          ELSE
            format('Verified and settled ₱%s Office Petty Cash receipts for "%s"', to_char(r.spent, 'FM999,999,990.00'), r.purpose)
        END,
        jsonb_build_object(
          'requestId', r.id,
          'spent', r.spent,
          'returnedAmount', r.returned_amount,
          'receivingReference', v_return_ref,
          'headFallback', v_head_fallback
        )
      );

      IF r.requester IS DISTINCT FROM p.id THEN
        INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
        VALUES (
          r.requester,
          'petty_cash_liquidation_decision',
          CASE WHEN COALESCE(r.spent, 0) <= 0 THEN 'Office petty cash return confirmed' ELSE 'Office petty cash settled' END,
          CASE
            WHEN COALESCE(r.spent, 0) <= 0 THEN
              format('%s confirmed receipt of ₱%s unused Office Petty Cash for "%s" (Ref: %s).', COALESCE(p.full_name, 'Accounting'), to_char(r.returned_amount, 'FM999,999,990.00'), r.purpose, COALESCE(v_return_ref, reference))
            WHEN COALESCE(r.returned_amount, 0) > 0 THEN
              format('%s verified ₱%s in receipts and ₱%s returned cash for "%s" (Ref: %s).', COALESCE(p.full_name, 'Accounting'), to_char(r.spent, 'FM999,999,990.00'), to_char(r.returned_amount, 'FM999,999,990.00'), r.purpose, COALESCE(v_return_ref, reference))
            ELSE
              format('%s verified and settled your Office Petty Cash receipts for "%s".', COALESCE(p.full_name, 'Accounting'), r.purpose)
          END,
          p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        );
      END IF;

      event_details := p_data || jsonb_build_object(
        'spent', r.spent,
        'returnedAmount', r.returned_amount,
        'refundReceiptNumber', r.refund_receipt_number,
        'receivingReference', v_return_ref,
        'headFallback', v_head_fallback
      );
      amt := CASE WHEN COALESCE(r.spent, 0) <= 0 THEN r.returned_amount ELSE r.spent END;

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
