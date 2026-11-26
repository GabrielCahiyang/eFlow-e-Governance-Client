-- ============================================================================
-- Migration: 20261125093000_subtask_and_settlement_notifications.sql
-- Purpose:
--   1. Guarantee real-time notifications to Accounting Staff whenever any
--      work_cash_assignment enters 'pending_accounting' (via trigger, matching
--      petty_cash_liquidations).
--   2. Include project_id, task_title, org_id, work_node_id, and peso/cash-return
--      details across subtask receipt, task liquidation, and auto-complete alerts.
--   3. Backfill notifications for any already-pending subtask receipt packages
--      (such as POTCHI) that were transitioned before this trigger existed.
-- ============================================================================

-- 1. Trigger function: notify eligible Accounting Staff whenever a subtask/work
--    cash assignment enters receipt_review_status = 'pending_accounting'.
CREATE OR REPLACE FUNCTION public.notify_assignment_receipt_accounting_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  t public.tasks;
  s public.subtasks;
  v_actor uuid;
  v_actor_name text;
  v_target_title text;
  v_return_suffix text := '';
BEGIN
  IF NEW.status <> 'active' OR NEW.receipt_review_status <> 'pending_accounting' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.receipt_review_status = 'pending_accounting' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.subtask_id IS NOT NULL THEN
    SELECT * INTO s FROM public.subtasks WHERE id = NEW.subtask_id;
    v_target_title := COALESCE(s.title, 'Subtask');
  ELSE
    v_target_title := COALESCE(t.title, 'Task');
  END IF;

  v_actor := COALESCE(NEW.receipt_submitted_by, NEW.assigned_by, t.assigned_to);
  SELECT COALESCE(full_name, 'Team member') INTO v_actor_name
  FROM public.profiles
  WHERE id = v_actor;

  IF COALESCE(NEW.returned_to_pool_amount, 0) > 0 THEN
    v_return_suffix := format(' (₱%s unused returned to task pool)', to_char(NEW.returned_to_pool_amount, 'FM999,999,990.00'));
  END IF;

  INSERT INTO public.notifications(
    user_id, type, title, message, task_id, task_title, project_id,
    actor_id, actor_name, org_id, work_node_id,
    financial_record_id, financial_record_type
  )
  SELECT
    p.id,
    'petty_cash_liquidation_accounting_review',
    CASE WHEN NEW.subtask_id IS NOT NULL
      THEN 'Subtask receipts ready for Accounting review'
      ELSE 'Work receipts ready for Accounting review'
    END,
    format('%s submitted ₱%s in receipts for "%s" (%s)%s. Open Accounting Settlements to verify and approve.',
      COALESCE(v_actor_name, 'Team member'),
      to_char(NEW.amount, 'FM999,999,990.00'),
      v_target_title,
      t.title,
      v_return_suffix
    ),
    NEW.task_id,
    t.title,
    t.linked_project_id,
    v_actor,
    COALESCE(v_actor_name, 'Team member'),
    NEW.org_id,
    NEW.subtask_id,
    NEW.id,
    'work_cash_assignment'
  FROM public.profiles p
  WHERE p.org_id = NEW.org_id
    AND p.is_active = true
    AND p.role::text = 'accounting_staff'
    AND p.id IS DISTINCT FROM v_actor
    AND p.id IS DISTINCT FROM NEW.assigned_by
    AND NOT EXISTS (
      SELECT 1
      FROM public.work_cash_assignment_receipts ar
      WHERE ar.assignment_id = NEW.id
        AND ar.deleted_at IS NULL
        AND ar.uploaded_by = p.id
    );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS work_cash_assignment_accounting_notification ON public.work_cash_assignments;
CREATE TRIGGER work_cash_assignment_accounting_notification
  AFTER INSERT OR UPDATE OF receipt_review_status, status
  ON public.work_cash_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_assignment_receipt_accounting_review();

-- 2. Update submit_subtask_cash_clearance so Accounting Staff notifications are
--    handled solely by the trigger above (no duplicate alerts) and Task Lead
--    notifications include project_id.
CREATE OR REPLACE FUNCTION public.submit_subtask_cash_clearance(
  p_task_id uuid,
  p_subtask_id uuid DEFAULT NULL::uuid,
  p_note text DEFAULT ''::text,
  p_key uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := eflow_r3.actor();
  caller_name text;
  task_row public.tasks;
  subtask_row public.subtasks;
  a public.work_cash_assignments;
  v_spent numeric(14,2);
  v_unused numeric(14,2);
  v_submitted_count integer := 0;
  v_total_spent numeric(14,2) := 0;
  v_total_returned numeric(14,2) := 0;
  v_clean_note text := btrim(COALESCE(p_note, ''));
  v_target_title text;
  v_lead_id uuid;
  v_auto_completed boolean := false;
BEGIN
  IF p_task_id IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'Task and idempotency key are required.' USING ERRCODE = '22023';
  END IF;
  IF char_length(v_clean_note) > 1000 THEN
    RAISE EXCEPTION 'Submission note must be 1,000 characters or less.' USING ERRCODE = '22023';
  END IF;

  PERFORM eflow_r7.lock_impact(p_task_id);

  SELECT * INTO task_row FROM public.tasks WHERE id = p_task_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND OR task_row.archived_at IS NOT NULL OR task_row.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'This task is no longer open.' USING ERRCODE = '22023';
  END IF;

  IF p_subtask_id IS NOT NULL THEN
    SELECT * INTO subtask_row FROM public.subtasks WHERE id = p_subtask_id AND task_id = p_task_id FOR UPDATE;
    IF NOT FOUND OR subtask_row.status = 'completed' THEN
      RAISE EXCEPTION 'Subtask is missing or already completed.' USING ERRCODE = '22023';
    END IF;
    v_target_title := subtask_row.title;
  ELSE
    v_target_title := task_row.title;
  END IF;

  IF NOT eflow_work_clearance.completion_submitted(p_task_id, p_subtask_id) THEN
    RAISE EXCEPTION 'Send this work out as Mark as complete first before submitting receipts.' USING ERRCODE = '42501';
  END IF;

  v_lead_id := COALESCE(task_row.assigned_to, task_row.recommendation_lead_id);
  IF caller IS DISTINCT FROM v_lead_id
     AND (p_subtask_id IS NULL OR (
       caller IS DISTINCT FROM subtask_row.lead_id
       AND caller IS DISTINCT FROM subtask_row.assigned_to
       AND NOT (caller = ANY(COALESCE(subtask_row.assigned_to_ids, '{}'::uuid[])))
     )) THEN
    RAISE EXCEPTION 'Only an assigned member or Lead on this work can submit its receipts.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(full_name, 'Team member') INTO caller_name FROM public.profiles WHERE id = caller;

  FOR a IN
    SELECT *
    FROM public.work_cash_assignments
    WHERE task_id = p_task_id
      AND subtask_id IS NOT DISTINCT FROM p_subtask_id
      AND status = 'active'
      AND (p_subtask_id IS NOT NULL OR source_kind = 'office_petty_cash')
      AND receipt_review_status IN ('open', 'changes_requested')
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(ar.amount), 0)::numeric(14,2)
    INTO v_spent
    FROM public.work_cash_assignment_receipts ar
    WHERE ar.assignment_id = a.id AND ar.deleted_at IS NULL;

    v_unused := GREATEST(0::numeric(14,2), round(a.amount - v_spent, 2));

    IF v_unused > 0 THEN
      v_total_returned := v_total_returned + v_unused;

      IF v_spent <= 0 THEN
        UPDATE public.work_cash_assignments
        SET status = 'recalled',
            receipt_review_status = 'approved',
            returned_to_pool_amount = COALESCE(returned_to_pool_amount, 0) + v_unused,
            receipt_submitted_at = now(),
            receipt_submitted_by = caller,
            receipt_submission_note = NULLIF(v_clean_note, ''),
            updated_at = now()
        WHERE id = a.id;
      ELSE
        UPDATE public.work_cash_assignments
        SET amount = v_spent,
            returned_to_pool_amount = COALESCE(returned_to_pool_amount, 0) + v_unused,
            updated_at = now()
        WHERE id = a.id;
      END IF;

      INSERT INTO public.audit_events(
        actor_id, actor_name, entity_type, entity_id, action, reason,
        before_data, after_data, org_id, target_label, change_summary
      ) VALUES (
        caller,
        caller_name,
        'work_cash_assignment',
        a.id::text,
        'work_cash_assignment.unused_returned_to_pool',
        NULLIF(v_clean_note, ''),
        jsonb_build_object('amount', a.amount, 'status', a.status),
        jsonb_build_object(
          'kept_spent_amount', v_spent,
          'returned_to_pool', v_unused,
          'status', CASE WHEN v_spent <= 0 THEN 'recalled' ELSE 'active' END,
          'task_id', p_task_id,
          'subtask_id', p_subtask_id
        ),
        a.org_id,
        v_target_title,
        format('Automatically returned ₱%s unused assigned cash from "%s" back to task cash pool', to_char(v_unused, 'FM999,999,990.00'), v_target_title)
      );

      INSERT INTO public.task_activities(task_id, type, content, actor_id, actor_name, metadata)
      VALUES (
        p_task_id,
        'budget_unused_returned',
        format('₱%s of unused cash assigned to "%s" was automatically returned to the task cash-on-hand pool (spent: ₱%s).',
          to_char(v_unused, 'FM999,999,990.00'),
          v_target_title,
          to_char(v_spent, 'FM999,999,990.00')
        ),
        caller,
        caller_name,
        jsonb_build_object(
          'version', 1,
          'scope', CASE WHEN p_subtask_id IS NULL THEN 'task_pool' ELSE 'subtask_pool' END,
          'subtaskId', p_subtask_id,
          'assignmentId', a.id,
          'returned', v_unused,
          'actualSpent', v_spent
        )
      );
    END IF;

    IF v_spent > 0 THEN
      v_submitted_count := v_submitted_count + 1;
      v_total_spent := v_total_spent + v_spent;

      -- Trigger work_cash_assignment_accounting_notification automatically notifies Accounting Staff!
      UPDATE public.work_cash_assignments
      SET receipt_review_status = 'pending_accounting',
          receipt_submitted_at = now(),
          receipt_submitted_by = caller,
          receipt_submission_note = NULLIF(v_clean_note, ''),
          accounting_decision_reason = NULL,
          updated_at = now()
      WHERE id = a.id;

      INSERT INTO public.audit_events(
        actor_id, actor_name, entity_type, entity_id, action, reason,
        after_data, org_id, target_label, change_summary
      ) VALUES (
        caller,
        caller_name,
        'work_cash_assignment',
        a.id::text,
        'work_cash_assignment.receipts_submitted_for_accounting',
        NULLIF(v_clean_note, ''),
        jsonb_build_object(
          'task_id', p_task_id,
          'subtask_id', p_subtask_id,
          'spent_amount', v_spent,
          'returned_to_pool', v_unused
        ),
        a.org_id,
        v_target_title,
        format('Submitted ₱%s in receipts for "%s" to Accounting for review', to_char(v_spent, 'FM999,999,990.00'), v_target_title)
      );

      INSERT INTO public.task_activities(task_id, type, content, actor_id, actor_name)
      VALUES (
        p_task_id,
        'status_change',
        format('%s submitted ₱%s in receipts for "%s" for Accounting review.', caller_name, to_char(v_spent, 'FM999,999,990.00'), v_target_title),
        caller,
        caller_name
      );

      -- Notify Task Lead if submitted by a different member
      IF v_lead_id IS NOT NULL AND v_lead_id <> caller THEN
        INSERT INTO public.notifications(
          user_id, type, title, message, task_id, task_title, project_id,
          actor_id, actor_name, org_id, work_node_id
        ) VALUES (
          v_lead_id,
          'approval_needed',
          'Subtask receipts & completion submitted',
          format('%s submitted ₱%s in receipts for "%s" (returned ₱%s unused to task pool).',
            caller_name,
            to_char(v_spent, 'FM999,999,990.00'),
            v_target_title,
            to_char(v_unused, 'FM999,999,990.00')
          ),
          p_task_id,
          task_row.title,
          task_row.linked_project_id,
          caller,
          caller_name,
          a.org_id,
          p_subtask_id
        );
      END IF;
    END IF;
  END LOOP;

  v_auto_completed := eflow_work_clearance.try_auto_complete(p_task_id, p_subtask_id);

  RETURN jsonb_build_object(
    'submittedCount', v_submitted_count,
    'totalSpent', v_total_spent,
    'totalReturnedToPool', v_total_returned,
    'autoCompleted', v_auto_completed
  );
END;
$function$;

-- 3. Polish decide_assignment_receipt_review notifications with project_id and distinct changes type
CREATE OR REPLACE FUNCTION public.decide_assignment_receipt_review(
  p_assignment_id uuid,
  p_approve boolean,
  p_reason text DEFAULT NULL::text,
  p_key uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := eflow_r3.actor();
  caller_name text;
  a public.work_cash_assignments;
  t public.tasks;
  s public.subtasks;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_target_title text;
  v_auto_completed boolean := false;
  v_recipient uuid;
BEGIN
  IF p_assignment_id IS NULL OR p_approve IS NULL THEN
    RAISE EXCEPTION 'Assignment and decision are required.' USING ERRCODE = '22023';
  END IF;
  IF NOT p_approve AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Explain what must be corrected on the receipts.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash assignment not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM eflow_r7.lock_impact(a.task_id);
  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id FOR UPDATE;

  IF a.status <> 'active' OR a.receipt_review_status <> 'pending_accounting' THEN
    RAISE EXCEPTION 'This receipt package is no longer awaiting Accounting review.' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.is_department_accounting_staff(a.org_id, caller)
    AND public.has_permission(caller, 'accounting.settle_liquidation')
  ) THEN
    RAISE EXCEPTION 'Only authorized Accounting Staff can review these receipts.' USING ERRCODE = '42501';
  END IF;

  IF caller = a.receipt_submitted_by
     OR caller = a.assigned_by
     OR EXISTS (
       SELECT 1 FROM public.work_cash_assignment_receipts ar
       WHERE ar.assignment_id = a.id AND ar.deleted_at IS NULL AND ar.uploaded_by = caller
     ) THEN
    RAISE EXCEPTION 'You cannot approve receipts you uploaded, assigned, or submitted.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = a.task_id;
  IF a.subtask_id IS NOT NULL THEN
    SELECT * INTO s FROM public.subtasks WHERE id = a.subtask_id;
    v_target_title := COALESCE(s.title, 'Subtask');
  ELSE
    v_target_title := COALESCE(t.title, 'Task');
  END IF;

  SELECT COALESCE(full_name, 'Accounting Officer') INTO caller_name FROM public.profiles WHERE id = caller;

  UPDATE public.work_cash_assignments
  SET receipt_review_status = CASE WHEN p_approve THEN 'approved' ELSE 'changes_requested' END,
      accounting_decided_by = caller,
      accounting_decided_at = now(),
      accounting_decision_reason = v_reason,
      updated_at = now()
  WHERE id = a.id;

  INSERT INTO public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action, reason,
    after_data, org_id, target_label, change_summary
  ) VALUES (
    caller,
    caller_name,
    'work_cash_assignment',
    a.id::text,
    CASE WHEN p_approve THEN 'work_cash_assignment.receipts_approved' ELSE 'work_cash_assignment.receipts_changes_requested' END,
    v_reason,
    jsonb_build_object(
      'task_id', a.task_id,
      'subtask_id', a.subtask_id,
      'amount', a.amount,
      'approved', p_approve
    ),
    a.org_id,
    v_target_title,
    CASE
      WHEN p_approve THEN format('Accounting approved ₱%s in receipts for "%s"', to_char(a.amount, 'FM999,999,990.00'), v_target_title)
      ELSE format('Accounting requested corrections on receipts for "%s"', v_target_title)
    END
  );

  INSERT INTO public.task_activities(task_id, type, content, actor_id, actor_name)
  VALUES (
    a.task_id,
    'status_change',
    CASE
      WHEN p_approve THEN format('Accounting (%s) approved ₱%s in receipts for "%s".', caller_name, to_char(a.amount, 'FM999,999,990.00'), v_target_title)
      ELSE format('Accounting (%s) requested receipt corrections for "%s": %s', caller_name, v_target_title, COALESCE(v_reason, ''))
    END,
    caller,
    caller_name
  );

  FOR v_recipient IN
    SELECT DISTINCT u_id
    FROM unnest(ARRAY[a.receipt_submitted_by, s.lead_id, t.assigned_to]) AS u_id
    WHERE u_id IS NOT NULL AND u_id <> caller
  LOOP
    INSERT INTO public.notifications(
      user_id, type, title, message, reason, task_id, task_title, project_id,
      actor_id, actor_name, org_id, work_node_id, financial_record_id, financial_record_type
    ) VALUES (
      v_recipient,
      CASE WHEN p_approve THEN 'petty_cash_liquidation_decision' ELSE 'petty_cash_liquidation_changes' END,
      CASE WHEN p_approve THEN 'Subtask receipts approved by Accounting' ELSE 'Subtask receipt corrections requested' END,
      CASE
        WHEN p_approve THEN format('Accounting verified ₱%s in receipts for "%s".', to_char(a.amount, 'FM999,999,990.00'), v_target_title)
        ELSE format('Accounting requested corrections on the receipts for "%s".', v_target_title)
      END,
      COALESCE(v_reason, ''),
      a.task_id,
      t.title,
      t.linked_project_id,
      caller,
      caller_name,
      a.org_id,
      a.subtask_id,
      a.id,
      'work_cash_assignment'
    );
  END LOOP;

  IF p_approve THEN
    v_auto_completed := eflow_work_clearance.try_auto_complete(a.task_id, a.subtask_id);
  END IF;

  RETURN jsonb_build_object(
    'assignmentId', a.id,
    'approved', p_approve,
    'autoCompleted', v_auto_completed
  );
END;
$function$;

-- 4. Polish notify_department_accounting_settlement (for Task liquidations) with
--    peso formatting, returned cash mention, org_id, project_id, and task_title.
CREATE OR REPLACE FUNCTION public.notify_department_accounting_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  request public.petty_cash_requests;
  task_row public.tasks;
  v_return_part text := '';
BEGIN
  IF NEW.status <> 'pending_department_settlement'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'pending_department_settlement') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO request FROM public.petty_cash_requests WHERE id = NEW.request_id;
  IF request.task_id IS NOT NULL THEN
    SELECT * INTO task_row FROM public.tasks WHERE id = request.task_id;
  END IF;

  IF COALESCE(NEW.returned_amount, 0) > 0 THEN
    v_return_part := ' and ₱' || to_char(NEW.returned_amount, 'FM999G999G999G990D00') || ' unused cash return';
  END IF;

  INSERT INTO public.notifications(
    user_id, type, title, message, task_id, task_title, project_id, org_id,
    actor_id, actor_name, financial_record_id, financial_record_type
  )
  SELECT
    profile.id,
    'petty_cash_liquidation_accounting_review',
    'Liquidation ready for accounting settlement',
    COALESCE(submitter.full_name, 'A cash recipient') || ' submitted ' || COALESCE(NEW.liquidation_number, 'a liquidation') ||
      ' with ₱' || to_char(NEW.declared_spent, 'FM999G999G999G990D00') || ' in receipts' || v_return_part ||
      '. Open Accounting Settlements to verify and settle.',
    request.task_id,
    task_row.title,
    task_row.linked_project_id,
    request.org_id,
    NEW.submitted_by,
    COALESCE(submitter.full_name, ''),
    NEW.id,
    'petty_cash_liquidation'
  FROM public.profiles profile
  LEFT JOIN public.profiles submitter ON submitter.id = NEW.submitted_by
  WHERE profile.org_id = request.org_id
    AND profile.role = 'accounting_staff'
    AND profile.is_active
    AND profile.id <> NEW.submitted_by;

  RETURN NEW;
END;
$function$;

-- 5. Backfill Accounting Staff notifications for any already-pending subtask receipt
--    assignments (such as POTCHI) that do not yet have a notification row.
INSERT INTO public.notifications(
  user_id, type, title, message, task_id, task_title, project_id,
  actor_id, actor_name, org_id, work_node_id,
  financial_record_id, financial_record_type
)
SELECT
  p.id,
  'petty_cash_liquidation_accounting_review',
  CASE WHEN a.subtask_id IS NOT NULL
    THEN 'Subtask receipts ready for Accounting review'
    ELSE 'Work receipts ready for Accounting review'
  END,
  format('%s submitted ₱%s in receipts for "%s" (%s)%s. Open Accounting Settlements to verify and approve.',
    COALESCE(sub_p.full_name, ab_p.full_name, 'Team member'),
    to_char(a.amount, 'FM999,999,990.00'),
    COALESCE(s.title, t.title),
    t.title,
    CASE WHEN COALESCE(a.returned_to_pool_amount, 0) > 0
      THEN format(' (₱%s unused returned to task pool)', to_char(a.returned_to_pool_amount, 'FM999,999,990.00'))
      ELSE ''
    END
  ),
  a.task_id,
  t.title,
  t.linked_project_id,
  COALESCE(a.receipt_submitted_by, a.assigned_by, t.assigned_to),
  COALESCE(sub_p.full_name, ab_p.full_name, 'Team member'),
  a.org_id,
  a.subtask_id,
  a.id,
  'work_cash_assignment'
FROM public.work_cash_assignments a
JOIN public.tasks t ON t.id = a.task_id AND t.deleted_at IS NULL
LEFT JOIN public.subtasks s ON s.id = a.subtask_id
LEFT JOIN public.profiles sub_p ON sub_p.id = a.receipt_submitted_by
LEFT JOIN public.profiles ab_p ON ab_p.id = a.assigned_by
JOIN public.profiles p
  ON p.org_id = a.org_id
 AND p.is_active = true
 AND p.role::text = 'accounting_staff'
WHERE a.status = 'active'
  AND a.receipt_review_status = 'pending_accounting'
  AND p.id IS DISTINCT FROM a.receipt_submitted_by
  AND p.id IS DISTINCT FROM a.assigned_by
  AND NOT EXISTS (
    SELECT 1
    FROM public.work_cash_assignment_receipts ar
    WHERE ar.assignment_id = a.id
      AND ar.deleted_at IS NULL
      AND ar.uploaded_by = p.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications existing
    WHERE existing.user_id = p.id
      AND existing.financial_record_id = a.id
      AND existing.financial_record_type = 'work_cash_assignment'
      AND existing.type IN ('petty_cash_liquidation_accounting_review', 'petty_cash_liquidation_department_review')
  );
