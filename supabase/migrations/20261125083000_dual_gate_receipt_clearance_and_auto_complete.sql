-- ============================================================================
-- Migration: 20261125083000_dual_gate_receipt_clearance_and_auto_complete.sql
-- Purpose:
--   1. Gate receipt logging/submission strictly behind sending "Mark as complete"
--      on both Subtasks and Tasks (parallel Work Approval + Accounting Approval).
--   2. Add Accounting review lifecycle + automatic unused-cash pool return (with
--      full audit_events & task_activities) to work_cash_assignments.
--   3. Fix eflow_work_clearance.cash_open so subtasks/tasks with uploaded receipts
--      are NOT marked financially cleared until Accounting approves/settles them.
--   4. Simplify Task unused-cash return into one-step Accounting verification &
--      settlement (recording physical return reference + audit trail).
--   5. Automatically mark Subtasks and Tasks completed (100%) as soon as BOTH
--      Work Approval and Accounting Financial Clearance are complete.
-- ============================================================================

-- 1. Extend public.work_cash_assignments with Accounting receipt review metadata
ALTER TABLE public.work_cash_assignments
  ADD COLUMN IF NOT EXISTS receipt_review_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS receipt_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_submitted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS receipt_submission_note text,
  ADD COLUMN IF NOT EXISTS returned_to_pool_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS accounting_decided_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS accounting_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS accounting_decision_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'work_cash_assignments_receipt_review_status_check'
  ) THEN
    ALTER TABLE public.work_cash_assignments
      ADD CONSTRAINT work_cash_assignments_receipt_review_status_check
      CHECK (receipt_review_status IN ('open', 'pending_accounting', 'approved', 'changes_requested'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_org_review_status
  ON public.work_cash_assignments (org_id, receipt_review_status)
  WHERE status = 'active';

-- 2. Helper: Has this Task or Subtask been sent out as "Mark as complete"?
CREATE OR REPLACE FUNCTION eflow_work_clearance.completion_submitted(
  p_root uuid,
  p_node uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_node IS NULL THEN
      eflow_work_clearance.accepted(p_root, NULL)
      OR EXISTS (
        SELECT 1
        FROM public.tasks t
        WHERE t.id = p_root
          AND t.deleted_at IS NULL
          AND t.status IN ('for_review', 'completed')
      )
    ELSE
      eflow_work_clearance.accepted(p_root, p_node)
      OR EXISTS (
        SELECT 1
        FROM public.subtasks s
        WHERE s.id = p_node
          AND s.task_id = p_root
          AND s.status IN ('for_review', 'completed')
      )
      OR EXISTS (
        SELECT 1
        FROM eflow_m7.work_proposals wp
        WHERE wp.root_id = p_root
          AND wp.node_id = p_node
          AND wp.kind = 'completion'
          AND wp.state IN ('pending', 'approved')
      )
  END;
$function$;

-- 3. Fix eflow_work_clearance.cash_open:
--    Subtask/Task cash remains open until Accounting approves/settles it!
CREATE OR REPLACE FUNCTION eflow_work_clearance.cash_open(
  p_root uuid,
  p_node uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_node IS NOT NULL THEN
      EXISTS (
        SELECT 1
        FROM public.petty_cash_requests r
        WHERE r.task_id = p_root
          AND r.subtask_id = p_node
          AND r.status NOT IN ('settled', 'rejected', 'cancelled')
      )
      OR EXISTS (
        SELECT 1
        FROM public.work_cash_assignments a
        WHERE a.task_id = p_root
          AND a.subtask_id = p_node
          AND a.status = 'active'
          AND a.receipt_review_status <> 'approved'
      )
    ELSE
      EXISTS (
        SELECT 1
        FROM public.petty_cash_requests r
        WHERE r.task_id = p_root
          AND r.status NOT IN ('settled', 'rejected', 'cancelled')
      )
      OR EXISTS (
        SELECT 1
        FROM public.work_cash_assignments a
        WHERE a.task_id = p_root
          AND a.status = 'active'
          AND (
            a.source_kind = 'office_petty_cash'
            OR a.subtask_id IS NOT NULL
          )
          AND a.receipt_review_status <> 'approved'
      )
  END;
$function$;

-- 4. Internal Auto-Completion Engine:
--    Automatically marks a Subtask or Task completed (100%) as soon as BOTH
--    Work Approval AND Accounting Financial Clearance are satisfied.
CREATE OR REPLACE FUNCTION eflow_work_clearance.try_auto_complete(
  p_root uuid,
  p_node uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  t public.tasks;
  s public.subtasks;
  v_actor uuid;
  v_actor_name text;
  v_flag text;
  v_review_flag text;
  v_status_flag text;
  v_recipient uuid;
BEGIN
  IF p_root IS NULL THEN
    RETURN false;
  END IF;

  PERFORM eflow_r7.lock_impact(p_root);
  PERFORM eflow_r7.lock_completion(p_root);

  SELECT * INTO t
  FROM public.tasks
  WHERE id = p_root AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND OR t.archived_at IS NOT NULL THEN
    RETURN false;
  END IF;

  IF t.linked_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = t.linked_project_id AND p.status = 'active'
  ) THEN
    RETURN false;
  END IF;

  IF NOT eflow_work_clearance.accepted(p_root, p_node) THEN
    RETURN false;
  END IF;

  IF eflow_work_clearance.cash_open(p_root, p_node) THEN
    RETURN false;
  END IF;

  BEGIN
    PERFORM eflow_r7.require_completed_descendants(p_root, COALESCE(p_node, p_root));
  EXCEPTION WHEN check_violation THEN
    RETURN false;
  END;

  IF p_node IS NOT NULL THEN
    SELECT * INTO s
    FROM public.subtasks
    WHERE id = p_node AND task_id = p_root
    FOR UPDATE;

    IF NOT FOUND OR s.status = 'completed' THEN
      RETURN false;
    END IF;

    IF NOT eflow_r7.subtask_dependencies_ready(p_root, s.dependency_ids) THEN
      RETURN false;
    END IF;

    IF s.dependency_ids IS NULL AND NOT s.is_standalone AND EXISTS (
      SELECT 1
      FROM public.subtasks earlier
      WHERE earlier.task_id = p_root
        AND earlier.parent_subtask_id IS NOT DISTINCT FROM s.parent_subtask_id
        AND earlier.sibling_order < s.sibling_order
        AND NOT earlier.is_standalone
        AND earlier.status <> 'completed'
    ) THEN
      RETURN false;
    END IF;

    v_actor := COALESCE(auth.uid(), s.lead_id, t.assigned_to);
    SELECT COALESCE(full_name, 'System') INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    IF auth.uid() IS NOT NULL THEN
      INSERT INTO eflow_r7.mutations VALUES (txid_current(), auth.uid(), p_root)
      ON CONFLICT DO NOTHING;
    END IF;

    v_flag := COALESCE(current_setting('eflow.subtask_workflow_authorized', true), 'off');
    PERFORM set_config('eflow.subtask_workflow_authorized', 'on', true);

    UPDATE public.subtasks
    SET status = 'completed',
        is_completed = true,
        percent_complete = 100,
        completed_by = COALESCE(s.lead_id, t.assigned_to, v_actor),
        completed_at = now(),
        reviewer_id = NULL,
        latest_submission_id = NULL
    WHERE id = p_node;

    PERFORM set_config('eflow.subtask_workflow_authorized', v_flag, true);

    INSERT INTO public.audit_events(
      actor_id, actor_name, entity_type, entity_id, action, org_id, target_label, change_summary, after_data
    ) VALUES (
      v_actor,
      COALESCE(v_actor_name, 'System'),
      'subtask',
      p_node::text,
      'work.auto_completed_after_dual_clearance',
      t.org_id,
      s.title,
      format('Subtask "%s" automatically marked completed after work approval and Accounting clearance', s.title),
      jsonb_build_object('rootId', p_root, 'subtaskId', p_node, 'status', 'completed')
    );

    INSERT INTO public.task_activities(task_id, type, content, actor_id, actor_name)
    VALUES (
      p_root,
      'subtask_completed',
      format('Subtask "%s" automatically marked as completed after Task Lead approval and Accounting financial clearance.', s.title),
      v_actor,
      COALESCE(v_actor_name, 'System')
    );

    FOR v_recipient IN
      SELECT DISTINCT u_id
      FROM unnest(ARRAY[s.lead_id, t.assigned_to]) AS u_id
      WHERE u_id IS NOT NULL AND u_id IS DISTINCT FROM auth.uid()
    LOOP
      INSERT INTO public.notifications(
        user_id, type, title, message, task_id, task_title, actor_id, actor_name, org_id, work_node_id
      ) VALUES (
        v_recipient,
        'completed',
        'Subtask completed',
        format('"%s" is now completed following work approval and Accounting financial clearance.', s.title),
        p_root,
        t.title,
        v_actor,
        COALESCE(v_actor_name, 'System'),
        t.org_id,
        p_node
      );
    END LOOP;

    -- Check if completing this subtask also unblocks auto-completing the parent task
    PERFORM eflow_work_clearance.try_auto_complete(p_root, NULL);
    RETURN true;
  ELSE
    IF t.status = 'completed' THEN
      RETURN false;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.subtasks sub WHERE sub.task_id = p_root AND sub.status <> 'completed'
    ) THEN
      RETURN false;
    END IF;

    IF COALESCE(cardinality(t.dependency_ids), 0) <> (
      SELECT count(*)
      FROM public.tasks dep
      WHERE dep.id = ANY(t.dependency_ids)
        AND dep.status = 'completed'
        AND dep.deleted_at IS NULL
        AND dep.linked_project_id IS NOT DISTINCT FROM t.linked_project_id
    ) THEN
      RETURN false;
    END IF;

    v_actor := COALESCE(auth.uid(), t.assigned_to);
    SELECT COALESCE(full_name, 'System') INTO v_actor_name FROM public.profiles WHERE id = v_actor;

    v_status_flag := COALESCE(current_setting('eflow.allow_status_write', true), 'off');
    v_review_flag := COALESCE(current_setting('eflow.review_decision_authorized', true), 'off');
    PERFORM set_config('eflow.allow_status_write', 'on', true);
    PERFORM set_config('eflow.review_decision_authorized', 'on', true);

    UPDATE public.tasks
    SET status = 'completed',
        percent_complete = 100,
        last_activity_at = now()
    WHERE id = p_root;

    PERFORM set_config('eflow.review_decision_authorized', v_review_flag, true);
    PERFORM set_config('eflow.allow_status_write', v_status_flag, true);

    INSERT INTO public.task_status_history(task_id, from_status, to_status, actor_id, actor_name, note)
    VALUES (
      p_root,
      t.status,
      'completed',
      v_actor,
      COALESCE(v_actor_name, 'System'),
      'Automatically marked completed after work approval and Accounting settlement.'
    );

    INSERT INTO public.audit_events(
      actor_id, actor_name, entity_type, entity_id, action, org_id, target_label, change_summary, after_data
    ) VALUES (
      v_actor,
      COALESCE(v_actor_name, 'System'),
      'task',
      p_root::text,
      'work.auto_completed_after_dual_clearance',
      t.org_id,
      t.title,
      format('Task "%s" automatically marked completed after work approval and Accounting settlement', t.title),
      jsonb_build_object('rootId', p_root, 'status', 'completed')
    );

    INSERT INTO public.task_activities(task_id, type, content, actor_id, actor_name)
    VALUES (
      p_root,
      'status_change',
      'Task automatically marked as completed after work approval and Accounting financial settlement.',
      v_actor,
      COALESCE(v_actor_name, 'System')
    );

    FOR v_recipient IN
      SELECT DISTINCT u_id
      FROM unnest(ARRAY[t.assigned_to, t.recommendation_lead_id, t.reviewer_id]) AS u_id
      WHERE u_id IS NOT NULL AND u_id IS DISTINCT FROM auth.uid()
    LOOP
      INSERT INTO public.notifications(
        user_id, type, title, message, task_id, task_title, actor_id, actor_name, org_id, status_from, status_to
      ) VALUES (
        v_recipient,
        'completed',
        'Task completed',
        format('"%s" is now completed following work approval and Accounting settlement.', t.title),
        p_root,
        t.title,
        v_actor,
        COALESCE(v_actor_name, 'System'),
        t.org_id,
        t.status,
        'completed'
      );
    END LOOP;

    RETURN true;
  END IF;
END;
$function$;

-- 5. Gate can_log_assignment_receipt strictly behind completion_submitted
--    and editable review states ('open' or 'changes_requested').
CREATE OR REPLACE FUNCTION public.can_log_assignment_receipt(
  p_assignment_id uuid,
  p_caller uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  a public.work_cash_assignments;
  t public.tasks;
  s public.subtasks;
  pcr public.petty_cash_requests;
  ocr eflow_office_cash.requests;
  v_holder uuid;
  v_open boolean := false;
BEGIN
  IF p_assignment_id IS NULL OR p_caller IS NULL OR NOT COALESCE(eflow_r3.eligible(p_caller), false) THEN
    RETURN false;
  END IF;

  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id;
  IF NOT FOUND OR a.status <> 'active' THEN
    RETURN false;
  END IF;

  IF a.receipt_review_status NOT IN ('open', 'changes_requested') THEN
    RETURN false;
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = a.task_id AND deleted_at IS NULL;
  IF NOT FOUND OR t.archived_at IS NOT NULL OR t.status IN ('completed', 'cancelled') THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.can_see_task(a.task_id, p_caller), false) THEN
    RETURN false;
  END IF;

  -- Receipts unlock ONLY once the subtask/task has been sent out as Mark as complete
  IF NOT eflow_work_clearance.completion_submitted(a.task_id, a.subtask_id) THEN
    RETURN false;
  END IF;

  IF a.source_kind = 'task_cash_release' THEN
    SELECT * INTO pcr FROM public.petty_cash_requests WHERE id = a.petty_cash_request_id;
    IF NOT FOUND THEN RETURN false; END IF;
    v_holder := pcr.cash_recipient_id;
    v_open := pcr.status IN ('released', 'changes_requested', 'overdue_liquidation')
      AND NOT EXISTS (
        SELECT 1 FROM public.petty_cash_releases rel
        WHERE rel.request_id = pcr.id AND rel.status = 'released' AND rel.acknowledged_at IS NULL
      );
  ELSE
    SELECT * INTO ocr FROM eflow_office_cash.requests WHERE id = a.office_cash_request_id;
    IF NOT FOUND THEN RETURN false; END IF;
    v_holder := ocr.requester;
    v_open := ocr.status = 'released';
  END IF;

  IF NOT v_open THEN
    RETURN false;
  END IF;

  IF p_caller = v_holder OR p_caller = COALESCE(t.assigned_to, t.recommendation_lead_id) THEN
    RETURN true;
  END IF;

  IF a.subtask_id IS NOT NULL THEN
    SELECT * INTO s FROM public.subtasks WHERE id = a.subtask_id AND task_id = a.task_id;
    IF FOUND AND (
      s.lead_id = p_caller
      OR s.assigned_to = p_caller
      OR p_caller = ANY(COALESCE(s.assigned_to_ids, '{}'::uuid[]))
    ) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

-- 6. Unlock public.receipt_submission_clearance on Tasks/Subtasks as soon as
--    completion is submitted (parallel Project Reviewer + Accounting review!)
CREATE OR REPLACE FUNCTION public.receipt_submission_clearance(p_request uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.petty_cash_requests;
  submitted boolean;
BEGIN
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = p_request;
  IF auth.uid() IS NULL OR r.id IS NULL OR NOT COALESCE(eflow_r3.eligible(auth.uid()), false)
     OR NOT COALESCE(public.can_see_task(r.task_id, auth.uid()), false)
     OR auth.uid() IS DISTINCT FROM r.cash_recipient_id THEN
    RAISE EXCEPTION 'Current cash recipient access required' USING ERRCODE = '42501';
  END IF;

  submitted := eflow_work_clearance.completion_submitted(r.task_id, r.subtask_id);

  RETURN jsonb_build_object(
    'version', 1,
    'requestId', r.id,
    'workAccepted', submitted,
    'canSubmit', submitted
      AND r.status IN ('released', 'changes_requested', 'overdue_liquidation')
      AND EXISTS (
        SELECT 1
        FROM public.tasks t
        LEFT JOIN public.projects p ON p.id = t.linked_project_id
        WHERE t.id = r.task_id
          AND t.deleted_at IS NULL
          AND t.archived_at IS NULL
          AND (t.linked_project_id IS NULL OR p.status = 'active')
      )
  );
END;
$function$;

-- 7. Enrich public.work_financial_clearance with dual-gate status fields
CREATE OR REPLACE FUNCTION public.work_financial_clearance(
  p_root uuid,
  p_node uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  t public.tasks;
  n public.subtasks;
  a boolean;
  submitted boolean;
  pending boolean;
  done boolean;
  can_finish boolean;
  v_work_state text;
  v_finance_state text;
  v_finance_msg text;
  v_has_pending_acct boolean := false;
  v_has_changes_acct boolean := false;
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(eflow_r3.eligible(auth.uid()), false)
     OR NOT COALESCE(public.can_see_task(p_root, auth.uid()), false) THEN
    RAISE EXCEPTION 'Current work access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO t FROM public.tasks WHERE id = p_root AND deleted_at IS NULL;
  IF p_node IS NOT NULL THEN
    IF NOT COALESCE(eflow_r7.read_root(p_root), false) THEN
      RAISE EXCEPTION 'Current branch access required' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO n FROM public.subtasks WHERE id = p_node AND task_id = p_root;
    IF n.id IS NULL OR NOT eflow_r7.chain(p_root, p_node) THEN
      RAISE EXCEPTION 'Current branch access required' USING ERRCODE = '42501';
    END IF;
  END IF;

  a := eflow_work_clearance.accepted(p_root, p_node);
  submitted := eflow_work_clearance.completion_submitted(p_root, p_node);
  pending := eflow_work_clearance.cash_open(p_root, p_node);
  done := CASE WHEN p_node IS NULL THEN t.status = 'completed' ELSE n.status = 'completed' END;

  IF done OR a THEN
    v_work_state := 'approved';
  ELSIF submitted THEN
    v_work_state := 'pending_review';
  ELSIF (p_node IS NULL AND t.status = 'changes_requested')
     OR (p_node IS NOT NULL AND n.status = 'changes_requested') THEN
    v_work_state := 'changes_requested';
  ELSE
    v_work_state := 'not_submitted';
  END IF;

  IF NOT pending THEN
    v_finance_state := 'cleared';
    v_finance_msg := 'All cash and receipts cleared.';
  ELSE
    IF p_node IS NOT NULL THEN
      SELECT
        BOOL_OR(
          wca.receipt_review_status = 'pending_accounting'
        ) OR EXISTS (
          SELECT 1 FROM public.petty_cash_requests r
          WHERE r.task_id = p_root AND r.subtask_id = p_node
            AND r.status IN ('liquidation_submitted', 'pending_leader_liquidation_review', 'pending_department_settlement')
        ),
        BOOL_OR(
          wca.receipt_review_status = 'changes_requested'
        ) OR EXISTS (
          SELECT 1 FROM public.petty_cash_requests r
          WHERE r.task_id = p_root AND r.subtask_id = p_node
            AND r.status = 'changes_requested'
        )
      INTO v_has_pending_acct, v_has_changes_acct
      FROM public.work_cash_assignments wca
      WHERE wca.task_id = p_root AND wca.subtask_id = p_node AND wca.status = 'active';
    ELSE
      SELECT
        EXISTS (
          SELECT 1 FROM public.petty_cash_requests r
          WHERE r.task_id = p_root
            AND r.status IN ('liquidation_submitted', 'pending_leader_liquidation_review', 'pending_department_settlement')
        ) OR EXISTS (
          SELECT 1 FROM public.work_cash_assignments wca
          WHERE wca.task_id = p_root AND wca.status = 'active'
            AND wca.receipt_review_status = 'pending_accounting'
        ),
        EXISTS (
          SELECT 1 FROM public.petty_cash_requests r
          WHERE r.task_id = p_root AND r.status = 'changes_requested'
        ) OR EXISTS (
          SELECT 1 FROM public.work_cash_assignments wca
          WHERE wca.task_id = p_root AND wca.status = 'active'
            AND wca.receipt_review_status = 'changes_requested'
        )
      INTO v_has_pending_acct, v_has_changes_acct;
    END IF;

    IF COALESCE(v_has_changes_acct, false) THEN
      v_finance_state := 'changes_requested';
      v_finance_msg := 'Accounting requested corrections on the submitted receipts. Review feedback in Funding details and resubmit.';
    ELSIF COALESCE(v_has_pending_acct, false) THEN
      v_finance_state := 'pending_accounting';
      v_finance_msg := 'Receipts submitted — awaiting Accounting Officer review and settlement.';
    ELSE
      v_finance_state := 'awaiting_receipts';
      v_finance_msg := CASE
        WHEN p_node IS NOT NULL THEN 'Submit receipts for the assigned cash in Funding details (any unspent cash automatically returns to the task pool).'
        ELSE 'Submit receipts and any unused cash return in Task funding so Accounting can settle the released cash.'
      END;
    END IF;
  END IF;

  can_finish := a AND NOT pending AND NOT done AND t.archived_at IS NULL
    AND (t.linked_project_id IS NULL OR EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = t.linked_project_id AND p.status = 'active'
    ))
    AND (auth.uid() = t.assigned_to OR (p_node IS NOT NULL AND auth.uid() = n.lead_id));

  IF can_finish THEN
    BEGIN
      PERFORM eflow_r7.require_completed_descendants(p_root, COALESCE(p_node, p_root));
    EXCEPTION WHEN check_violation THEN
      can_finish := false;
    END;
    IF p_node IS NULL THEN
      can_finish := can_finish AND COALESCE(cardinality(t.dependency_ids), 0) = (
        SELECT count(*)
        FROM public.tasks dependency
        WHERE dependency.id = ANY(t.dependency_ids)
          AND dependency.status = 'completed'
          AND dependency.deleted_at IS NULL
          AND dependency.linked_project_id IS NOT DISTINCT FROM t.linked_project_id
      );
    ELSE
      can_finish := can_finish
        AND eflow_r7.subtask_dependencies_ready(p_root, n.dependency_ids)
        AND NOT (
          n.dependency_ids IS NULL
          AND NOT n.is_standalone
          AND EXISTS (
            SELECT 1
            FROM public.subtasks earlier
            WHERE earlier.task_id = p_root
              AND earlier.parent_subtask_id IS NOT DISTINCT FROM n.parent_subtask_id
              AND earlier.sibling_order < n.sibling_order
              AND NOT earlier.is_standalone
              AND earlier.status <> 'completed'
          )
        );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'version', 1,
    'rootId', p_root,
    'nodeId', p_node,
    'workAccepted', a,
    'completionSubmitted', submitted,
    'cashOutstanding', pending,
    'completed', done,
    'canFinalize', COALESCE(can_finish, false),
    'workReviewState', v_work_state,
    'financeState', v_finance_state,
    'financeMessage', v_finance_msg
  );
END;
$function$;

-- 8. Update eflow_budget.task_cash_pools to expose receiptReviewStatus,
--    returnedToPoolAmount, accountingDecisionReason, and canSubmitReceipts.
CREATE OR REPLACE FUNCTION eflow_budget.task_cash_pools(
  p_task_id uuid,
  p_subtask_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  t public.tasks;
  v_can_assign boolean := false;
  v_completion_submitted boolean := false;
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

  v_completion_submitted := eflow_work_clearance.completion_submitted(p_task_id, p_subtask_id);

  v_can_assign := COALESCE(eflow_r3.eligible(caller), false)
    AND caller = COALESCE(t.assigned_to, t.recommendation_lead_id)
    AND t.proposed_office_identity_id IS NULL
    AND t.archived_at IS NULL
    AND t.status NOT IN ('completed', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = t.linked_project_id AND p.status IN ('completed', 'archived')
    );

  -- 1. Released task-level cash advances on this task
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

  -- 2. Released Office Petty Cash held by caller
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

  -- 3. Active assignments on this task/subtask
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
      a.receipt_review_status,
      a.returned_to_pool_amount,
      a.accounting_decision_reason,
      a.receipt_submitted_at,
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
        AND a.receipt_review_status IN ('open', 'changes_requested')
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
      'receiptReviewStatus', receipt_review_status,
      'returnedToPoolAmount', returned_to_pool_amount,
      'accountingDecisionReason', accounting_decision_reason,
      'receiptSubmittedAt', receipt_submitted_at,
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
    'completionSubmitted', v_completion_submitted,
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

-- 9. Submit Subtask/Assignment Cash Clearance:
--    Automatically returns any unspent assigned cash back to the parent Task's
--    unassigned cash pool (with full audit trail + task activity), and submits
--    all logged receipts to Accounting Officer (+ notifies Task Lead).
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
  v_acc_id uuid;
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

    -- Automatically return any leftover unspent cash back to the parent cash pool
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

      -- Notify eligible Accounting Staff in the office
      FOR v_acc_id IN
        SELECT p.id
        FROM public.profiles p
        WHERE p.org_id = a.org_id
          AND p.is_active = true
          AND p.role::text = 'accounting_staff'
          AND p.id <> caller
      LOOP
        INSERT INTO public.notifications(
          user_id, type, title, message, task_id, task_title, actor_id, actor_name, org_id, work_node_id, financial_record_id, financial_record_type
        ) VALUES (
          v_acc_id,
          'petty_cash_liquidation_department_review',
          'Subtask receipts ready for Accounting review',
          format('%s submitted ₱%s in receipts for "%s" (%s).', caller_name, to_char(v_spent, 'FM999,999,990.00'), v_target_title, task_row.title),
          p_task_id,
          task_row.title,
          caller,
          caller_name,
          a.org_id,
          p_subtask_id,
          a.id,
          'work_cash_assignment'
        );
      END LOOP;

      -- Also notify Task Lead if submitted by a different member
      IF v_lead_id IS NOT NULL AND v_lead_id <> caller THEN
        INSERT INTO public.notifications(
          user_id, type, title, message, task_id, task_title, actor_id, actor_name, org_id, work_node_id
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
          caller,
          caller_name,
          a.org_id,
          p_subtask_id
        );
      END IF;
    END IF;
  END LOOP;

  -- If ₱0 was spent (all cash returned to pool) and work was already accepted, auto-complete immediately!
  v_auto_completed := eflow_work_clearance.try_auto_complete(p_task_id, p_subtask_id);

  RETURN jsonb_build_object(
    'submittedCount', v_submitted_count,
    'totalSpent', v_total_spent,
    'totalReturnedToPool', v_total_returned,
    'autoCompleted', v_auto_completed
  );
END;
$function$;

-- 10. Fetch Pending Subtask/Assignment Receipt Reviews for Accounting Settlement Queue
CREATE OR REPLACE FUNCTION public.get_pending_assignment_receipt_reviews(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF caller IS NULL OR p_org_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT (
    public.can_manage_department_accounting(p_org_id, caller)
    OR eflow_finance_review.scope_allowed(p_org_id, caller)
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'assignmentId', a.id,
    'orgId', a.org_id,
    'taskId', a.task_id,
    'taskTitle', t.title,
    'subtaskId', a.subtask_id,
    'subtaskTitle', s.title,
    'sourceKind', a.source_kind,
    'sourceLabel', CASE
      WHEN a.source_kind = 'task_cash_release' AND al.id IS NOT NULL THEN
        COALESCE(NULLIF(btrim(al.category), ''), 'Approved source') || ' · FR-' || lpad(pcr.request_number::text, 5, '0')
      WHEN a.source_kind = 'task_cash_release' THEN
        'FR-' || lpad(pcr.request_number::text, 5, '0') || ' · ' || COALESCE(pcr.purpose, '')
      ELSE
        'Office Petty Cash · ' || COALESCE(ocr.purpose, '')
    END,
    'amount', a.amount,
    'returnedToPoolAmount', a.returned_to_pool_amount,
    'submittedAt', a.receipt_submitted_at,
    'submittedBy', a.receipt_submitted_by,
    'submittedByName', COALESCE(sub_p.full_name, ab_p.full_name, 'Team member'),
    'submissionNote', COALESCE(a.receipt_submission_note, ''),
    'workAccepted', eflow_work_clearance.accepted(a.task_id, a.subtask_id),
    'canDecide', (
      public.is_department_accounting_staff(a.org_id, caller)
      AND public.has_permission(caller, 'accounting.settle_liquidation')
      AND caller IS DISTINCT FROM a.receipt_submitted_by
      AND caller IS DISTINCT FROM a.assigned_by
      AND NOT EXISTS (
        SELECT 1 FROM public.work_cash_assignment_receipts ar2
        WHERE ar2.assignment_id = a.id AND ar2.deleted_at IS NULL AND ar2.uploaded_by = caller
      )
    ),
    'receipts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ar.id,
        'vendor', ar.vendor,
        'receiptNumber', COALESCE(ar.receipt_number, ''),
        'receiptDate', ar.receipt_date::text,
        'description', ar.description,
        'amount', ar.amount,
        'fileName', ar.file_name,
        'filePath', ar.file_path,
        'mimeType', ar.mime_type,
        'uploadedByName', COALESCE(up.full_name, '')
      ) ORDER BY ar.created_at ASC)
      FROM public.work_cash_assignment_receipts ar
      LEFT JOIN public.profiles up ON up.id = ar.uploaded_by
      WHERE ar.assignment_id = a.id AND ar.deleted_at IS NULL
    ), '[]'::jsonb)
  ) ORDER BY a.receipt_submitted_at ASC NULLS LAST, a.created_at ASC), '[]'::jsonb)
  INTO v_rows
  FROM public.work_cash_assignments a
  JOIN public.tasks t ON t.id = a.task_id AND t.deleted_at IS NULL
  LEFT JOIN public.subtasks s ON s.id = a.subtask_id
  LEFT JOIN public.petty_cash_requests pcr ON pcr.id = a.petty_cash_request_id
  LEFT JOIN public.work_budget_allocation_lines al ON al.id = a.allocation_line_id
  LEFT JOIN eflow_office_cash.requests ocr ON ocr.id = a.office_cash_request_id
  LEFT JOIN public.profiles sub_p ON sub_p.id = a.receipt_submitted_by
  LEFT JOIN public.profiles ab_p ON ab_p.id = a.assigned_by
  WHERE a.org_id = p_org_id
    AND a.status = 'active'
    AND a.receipt_review_status = 'pending_accounting';

  RETURN v_rows;
END;
$function$;

-- 11. Accounting Officer Approval / Correction Request for Subtask/Assignment Receipts
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
      user_id, type, title, message, reason, task_id, task_title, actor_id, actor_name, org_id, work_node_id, financial_record_id, financial_record_type
    ) VALUES (
      v_recipient,
      'petty_cash_liquidation_decision',
      CASE WHEN p_approve THEN 'Subtask receipts approved by Accounting' ELSE 'Subtask receipt corrections requested' END,
      CASE
        WHEN p_approve THEN format('Accounting verified ₱%s in receipts for "%s".', to_char(a.amount, 'FM999,999,990.00'), v_target_title)
        ELSE format('Accounting requested corrections on the receipts for "%s".', v_target_title)
      END,
      COALESCE(v_reason, ''),
      a.task_id,
      t.title,
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

-- 12. Simplify Task Unused-Cash Return Guard:
--     Accounting verifies physical receipt of returned cash + reference during
--     one-step settlement (no separate Office Head ping-pong required!).
CREATE OR REPLACE FUNCTION eflow_work_clearance.guard_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.petty_cash_requests;
  d eflow_work_clearance.return_decisions;
BEGIN
  IF new.status = 'approved' AND old.status IS DISTINCT FROM 'approved' AND EXISTS (
    SELECT 1 FROM public.petty_cash_liquidations newer
    WHERE newer.request_id = new.request_id AND newer.version > new.version
  ) THEN
    RAISE EXCEPTION 'The receipt package changed. Review the current version.' USING ERRCODE = '22023';
  END IF;

  IF new.status = 'approved' AND old.status IS DISTINCT FROM 'approved' AND new.returned_amount > 0 THEN
    SELECT * INTO r FROM public.petty_cash_requests WHERE id = new.request_id;
    SELECT * INTO d FROM eflow_work_clearance.return_decisions WHERE liquidation_id = new.id;
    IF d.liquidation_id IS NULL
       OR d.version <> new.version
       OR d.amount <> new.returned_amount
       OR d.received_by IS NULL
       OR NULLIF(btrim(COALESCE(d.receive_reference, '')), '') IS NULL
       OR d.received_by IN (r.requester_id, r.cash_recipient_id, new.submitted_by)
    THEN
      RAISE EXCEPTION 'Enter the cash return receiving reference before settling this liquidation.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN new;
END;
$function$;

-- 13. One-Step Accounting Liquidation + Cash-Return Settlement RPC (with full audit trail)
CREATE OR REPLACE FUNCTION public.settle_accounting_liquidation_with_return(
  p_liquidation_id uuid,
  p_approve boolean,
  p_reason text,
  p_return_reference text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  l public.petty_cash_liquidations;
  r public.petty_cash_requests;
  v public.liquidation_independent_reviews;
  caller uuid := auth.uid();
  caller_name text;
  reviewer uuid;
  used_escalation boolean := false;
  v_return_ref text;
  v_stamp text;
BEGIN
  PERFORM eflow_r7.lock_impact((
    SELECT c.task_id
    FROM public.petty_cash_liquidations x
    JOIN public.petty_cash_requests c ON c.id = x.request_id
    WHERE x.id = p_liquidation_id
  ));

  SELECT * INTO l FROM public.petty_cash_liquidations WHERE id = p_liquidation_id FOR UPDATE;
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = l.request_id FOR UPDATE;

  IF r.id IS NULL
     OR NOT public.is_department_accounting_staff(r.org_id, caller)
     OR NOT public.has_permission(caller, 'accounting.settle_liquidation')
     OR eflow_finance_review.conflicted(r, caller)
     OR caller = l.leader_decided_by THEN
    RAISE EXCEPTION 'A separate eligible Accounting Officer must settle this package' USING ERRCODE = '42501';
  END IF;

  IF p_approve IS NULL THEN
    RAISE EXCEPTION 'Choose a settlement decision' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v FROM public.liquidation_independent_reviews WHERE liquidation_id = l.id AND version = l.version FOR UPDATE;
  IF v.id IS NOT NULL OR eflow_finance_review.required(r) THEN
    IF v.status = 'approved'
       AND v.fingerprint = eflow_finance_review.fingerprint(l, r)
       AND eflow_finance_review.eligible_reviewer(r, v.reviewer_id) THEN
      reviewer := v.reviewer_id;
    ELSE
      reviewer := eflow_finance_review.staffing_escalation_approver(l, r);
      used_escalation := true;
    END IF;
    IF reviewer IS NULL OR reviewer = caller THEN
      RAISE EXCEPTION 'Current Head or independent leadership approval is required before settlement' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_approve AND r.liquidation_due_at IS NOT NULL AND l.submitted_at > r.liquidation_due_at AND l.department_decided_at IS NULL THEN
    RAISE EXCEPTION 'Separate late-liquidation authorization is required before settlement' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(full_name, 'Accounting Officer') INTO caller_name FROM public.profiles WHERE id = caller;

  -- One-step unused cash return verification & audit trail when settling
  IF p_approve AND COALESCE(l.returned_amount, 0) > 0 THEN
    v_return_ref := COALESCE(
      NULLIF(btrim(p_return_reference), ''),
      NULLIF(btrim(l.refund_receipt_number), ''),
      (SELECT NULLIF(btrim(rd.receive_reference), '') FROM eflow_work_clearance.return_decisions rd WHERE rd.liquidation_id = l.id AND rd.version = l.version)
    );
    IF v_return_ref IS NULL THEN
      RAISE EXCEPTION 'Enter the cash return receiving reference (OR / acknowledgment #) before settling.' USING ERRCODE = '22023';
    END IF;
    IF char_length(v_return_ref) > 2000 THEN
      RAISE EXCEPTION 'Cash return reference must be 2,000 characters or less.' USING ERRCODE = '22023';
    END IF;

    v_stamp := eflow_finance_review.fingerprint(l, r);

    INSERT INTO eflow_work_clearance.return_decisions(
      liquidation_id, version, fingerprint, amount,
      received_by, received_at, receive_reference, receive_command,
      approved_by, approved_at, approval_note, approve_command
    ) VALUES (
      l.id, l.version, v_stamp, l.returned_amount,
      caller, now(), v_return_ref, gen_random_uuid(),
      caller, now(), 'Verified during one-step Accounting settlement', gen_random_uuid()
    )
    ON CONFLICT (liquidation_id) DO UPDATE SET
      version = EXCLUDED.version,
      fingerprint = EXCLUDED.fingerprint,
      amount = EXCLUDED.amount,
      received_by = EXCLUDED.received_by,
      received_at = now(),
      receive_reference = EXCLUDED.receive_reference,
      approved_by = EXCLUDED.approved_by,
      approved_at = now(),
      approval_note = EXCLUDED.approval_note;

    INSERT INTO public.audit_events(
      actor_id, actor_name, entity_type, entity_id, action, reason, org_id, after_data
    ) VALUES (
      caller,
      caller_name,
      'petty_cash_liquidation',
      l.id::text,
      'cash_return.verified_and_settled',
      v_return_ref,
      r.org_id,
      jsonb_build_object(
        'requestId', r.id,
        'liquidationId', l.id,
        'version', l.version,
        'declaredSpent', l.declared_spent,
        'returnedAmount', l.returned_amount,
        'receivingReference', v_return_ref
      )
    );

    IF r.task_id IS NOT NULL THEN
      INSERT INTO public.task_activities(task_id, type, content, actor_id, actor_name)
      VALUES (
        r.task_id,
        'status_change',
        format('Accounting (%s) verified ₱%s in returned cash (Ref: %s) and ₱%s in spent receipts for FR-%s.',
          caller_name,
          to_char(l.returned_amount, 'FM999,999,990.00'),
          v_return_ref,
          to_char(l.declared_spent, 'FM999,999,990.00'),
          lpad(r.request_number::text, 5, '0')
        ),
        caller,
        caller_name
      );
    END IF;
  END IF;

  -- Mark all active assignments under this cash release approved on settlement
  IF p_approve THEN
    UPDATE public.work_cash_assignments
    SET receipt_review_status = 'approved',
        accounting_decided_by = COALESCE(accounting_decided_by, caller),
        accounting_decided_at = COALESCE(accounting_decided_at, now()),
        updated_at = now()
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = r.id
      AND status = 'active';
  END IF;

  PERFORM eflow_finance_review.settle_accounting_liquidation(p_liquidation_id, p_approve, p_reason);
  PERFORM eflow_finance_review.lock_authority(r.org_id, ARRAY[caller, reviewer]);

  IF NOT public.is_department_accounting_staff(r.org_id, caller)
     OR NOT public.has_permission(caller, 'accounting.settle_liquidation')
     OR (used_escalation AND NOT COALESCE(eflow_finance_review.staffing_escalation_head(l, r, reviewer), false))
     OR (reviewer IS NOT NULL AND NOT used_escalation AND NOT eflow_finance_review.eligible_reviewer(r, reviewer)) THEN
    RAISE EXCEPTION 'Current Accounting and review authority required' USING ERRCODE = '42501';
  END IF;

  IF p_approve AND r.task_id IS NOT NULL THEN
    PERFORM eflow_work_clearance.try_auto_complete(r.task_id, r.subtask_id);
  END IF;
END;
$function$;

-- Keep 3-parameter settle_accounting_liquidation delegating to the 4-parameter implementation
CREATE OR REPLACE FUNCTION public.settle_accounting_liquidation(
  p_liquidation_id uuid,
  p_approve boolean,
  p_reason text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.settle_accounting_liquidation_with_return(p_liquidation_id, p_approve, p_reason, NULL);
$function$;

-- 14. Ensure after_settlement trigger also attempts auto-completion (covers Head escalation fallback path too!)
CREATE OR REPLACE FUNCTION eflow_work_clearance.after_settlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF new.status = 'settled' AND old.status IS DISTINCT FROM 'settled' THEN
    PERFORM eflow_work_clearance.restore(new.task_id, new.subtask_id, new.id);
    IF new.task_id IS NOT NULL THEN
      PERFORM eflow_work_clearance.try_auto_complete(new.task_id, new.subtask_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- 15. Backfill any existing active subtask assignment where completion was already
--     accepted and receipts were already uploaded so Accounting can immediately review it.
UPDATE public.work_cash_assignments a
SET receipt_review_status = 'pending_accounting',
    receipt_submitted_at = COALESCE(a.receipt_submitted_at, now()),
    receipt_submitted_by = COALESCE(
      a.receipt_submitted_by,
      (SELECT ar.uploaded_by FROM public.work_cash_assignment_receipts ar WHERE ar.assignment_id = a.id AND ar.deleted_at IS NULL ORDER BY ar.created_at DESC LIMIT 1),
      a.assigned_by
    )
WHERE a.status = 'active'
  AND a.subtask_id IS NOT NULL
  AND a.receipt_review_status = 'open'
  AND eflow_work_clearance.completion_submitted(a.task_id, a.subtask_id)
  AND EXISTS (
    SELECT 1
    FROM public.work_cash_assignment_receipts ar
    WHERE ar.assignment_id = a.id
      AND ar.deleted_at IS NULL
  );

GRANT EXECUTE ON FUNCTION public.submit_subtask_cash_clearance(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_assignment_receipt_reviews(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_assignment_receipt_review(uuid, boolean, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.settle_accounting_liquidation_with_return(uuid, boolean, text, text) TO authenticated;
