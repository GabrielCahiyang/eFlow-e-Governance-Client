-- Stop silently auto-returning assigned subtask cash on completion and require
-- receipts (or explicit Return unused) before a cash-funded subtask can be marked completed.

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_clearance
  ON public.work_cash_assignments (task_id, subtask_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_work_cash_assignment_receipts_active
  ON public.work_cash_assignment_receipts (assignment_id)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION eflow_budget.release_unspent_subtask_cash_on_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_work_clearance.cash_open(p_root uuid, p_node uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.petty_cash_requests r
      WHERE r.task_id = p_root
        AND (p_node IS NULL OR r.subtask_id = p_node)
        AND r.status NOT IN ('settled', 'rejected', 'cancelled')
    )
    OR EXISTS (
      SELECT 1
      FROM public.work_cash_assignments a
      WHERE a.task_id = p_root
        AND (p_node IS NULL OR a.subtask_id = p_node)
        AND a.status = 'active'
        AND a.amount > COALESCE((
          SELECT SUM(rc.amount)
          FROM public.work_cash_assignment_receipts rc
          WHERE rc.assignment_id = a.id
            AND rc.deleted_at IS NULL
        ), 0)
    );
$function$;

CREATE OR REPLACE FUNCTION public.guard_financial_work_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND (
    EXISTS (
      SELECT 1
      FROM public.petty_cash_requests request
      WHERE request.task_id = NEW.task_id
        AND request.subtask_id = NEW.id
        AND request.status NOT IN ('settled', 'rejected', 'cancelled')
    )
    OR EXISTS (
      SELECT 1
      FROM public.work_cash_assignments a
      WHERE a.task_id = NEW.task_id
        AND a.subtask_id = NEW.id
        AND a.status = 'active'
        AND a.amount > COALESCE((
          SELECT SUM(rc.amount)
          FROM public.work_cash_assignment_receipts rc
          WHERE rc.assignment_id = a.id
            AND rc.deleted_at IS NULL
        ), 0)
    )
  ) THEN
    RAISE EXCEPTION 'Upload receipts or return unused assigned cash before marking this subtask completed'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_log_assignment_receipt(p_assignment_id uuid, p_caller uuid)
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

  SELECT * INTO t FROM public.tasks WHERE id = a.task_id AND deleted_at IS NULL;
  IF NOT FOUND OR t.archived_at IS NOT NULL OR t.status = 'cancelled' THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(public.can_see_task(a.task_id, p_caller), false) THEN
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

CREATE OR REPLACE FUNCTION eflow_work_clearance.record_acceptance(
  p_root uuid,
  p_node uuid,
  p_source uuid,
  p_note text,
  p_files jsonb
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO eflow_work_clearance.acceptances(
    entity_id, root_id, node_id, source_id, accepted_by, fingerprint, note, attachments
  )
  VALUES (
    COALESCE(p_node, p_root),
    p_root,
    p_node,
    p_source,
    auth.uid(),
    eflow_work_clearance.stamp(p_root, p_node),
    COALESCE(p_note, ''),
    COALESCE(p_files, '[]'::jsonb)
  )
  ON CONFLICT (entity_id) DO UPDATE SET
    source_id = EXCLUDED.source_id,
    accepted_by = EXCLUDED.accepted_by,
    accepted_at = now(),
    fingerprint = EXCLUDED.fingerprint,
    note = EXCLUDED.note,
    attachments = EXCLUDED.attachments;

  INSERT INTO public.audit_events(actor_id, entity_type, entity_id, action, org_id, after_data)
  SELECT
    auth.uid(),
    CASE WHEN p_node IS NULL THEN 'task' ELSE 'subtask' END,
    COALESCE(p_node, p_root)::text,
    'work.accepted_awaiting_financial_clearance',
    t.org_id,
    jsonb_build_object('rootId', p_root, 'sourceId', p_source)
  FROM public.tasks t
  WHERE t.id = p_root;

  UPDATE public.tasks SET last_activity_at = now() WHERE id = p_root;

  INSERT INTO public.notifications(user_id, type, title, message, task_id, actor_id)
  SELECT DISTINCT
    r.cash_recipient_id,
    'status_change',
    'Work accepted — receipts required',
    'Submit the required receipts and any unused cash return before marking this work complete.',
    p_root,
    auth.uid()
  FROM public.petty_cash_requests r
  WHERE r.task_id = p_root
    AND r.subtask_id IS NOT DISTINCT FROM p_node
    AND r.status NOT IN ('settled', 'rejected', 'cancelled')
    AND r.cash_recipient_id IS DISTINCT FROM auth.uid();

  IF p_node IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, message, task_id, actor_id, work_node_id)
    SELECT DISTINCT
      s.lead_id,
      'status_change',
      'Work accepted — waiting for receipts',
      'Your subtask completion was accepted. Upload receipts for the assigned cash (or return unused cash) to finish.',
      p_root,
      auth.uid(),
      p_node
    FROM public.subtasks s
    WHERE s.id = p_node
      AND s.task_id = p_root
      AND s.lead_id IS NOT NULL
      AND s.lead_id IS DISTINCT FROM auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.work_cash_assignments a
        WHERE a.task_id = p_root
          AND a.subtask_id = p_node
          AND a.status = 'active'
          AND a.amount > COALESCE((
            SELECT SUM(rc.amount)
            FROM public.work_cash_assignment_receipts rc
            WHERE rc.assignment_id = a.id
              AND rc.deleted_at IS NULL
          ), 0)
      );
  END IF;
END;
$function$;
