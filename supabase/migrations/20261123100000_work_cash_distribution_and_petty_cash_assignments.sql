-- Task Cash-On-Hand, Office Petty Cash & Subtask Cash Distribution
-- Enables Task Leads to distribute already-released task cash (e.g. FR-00001)
-- and released Office Petty Cash (separate ₱30k revolving fund) directly to
-- the task itself or to new/existing subtasks, with A1 subtask receipt roll-up
-- and automatic return of unspent subtask cash back to the Task Lead's cash pool.

-- ============================================================================
-- 1. Core tables & idempotency log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.work_cash_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  subtask_id uuid NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind IN ('task_cash_release', 'office_petty_cash')),
  petty_cash_request_id uuid NULL REFERENCES public.petty_cash_requests(id) ON DELETE RESTRICT,
  office_cash_request_id uuid NULL REFERENCES eflow_office_cash.requests(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount = round(amount, 2)),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recalled', 'settled')),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 1000),
  assigned_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_cash_assignments_source_fk_chk CHECK (
    (source_kind = 'task_cash_release' AND petty_cash_request_id IS NOT NULL AND office_cash_request_id IS NULL)
    OR (source_kind = 'office_petty_cash' AND office_cash_request_id IS NOT NULL AND petty_cash_request_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_work_cash_assignments_active_unique
  ON public.work_cash_assignments (
    source_kind,
    COALESCE(petty_cash_request_id, office_cash_request_id),
    task_id,
    COALESCE(subtask_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_task_status
  ON public.work_cash_assignments (task_id, status);

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_subtask_status
  ON public.work_cash_assignments (subtask_id, status)
  WHERE subtask_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_pcr_active
  ON public.work_cash_assignments (petty_cash_request_id)
  WHERE status = 'active' AND petty_cash_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_cash_assignments_ocr_active
  ON public.work_cash_assignments (office_cash_request_id)
  WHERE status = 'active' AND office_cash_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.work_cash_assignment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.work_cash_assignments(id) ON DELETE CASCADE,
  vendor text NOT NULL CHECK (char_length(btrim(vendor)) BETWEEN 1 AND 200),
  receipt_number text NULL CHECK (receipt_number IS NULL OR char_length(btrim(receipt_number)) <= 100),
  receipt_date date NOT NULL,
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  amount numeric(14,2) NOT NULL CHECK (amount > 0 AND amount = round(amount, 2)),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  file_name text NOT NULL CHECK (char_length(btrim(file_name)) BETWEEN 1 AND 255),
  file_path text NOT NULL CHECK (char_length(btrim(file_path)) BETWEEN 1 AND 500),
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0 CHECK (file_size >= 0),
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  deleted_at timestamptz NULL,
  deleted_by uuid NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wcar_assignment_file_path
  ON public.work_cash_assignment_receipts (assignment_id, file_path);

CREATE INDEX IF NOT EXISTS idx_wcar_assignment_created
  ON public.work_cash_assignment_receipts (assignment_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wcar_file_path
  ON public.work_cash_assignment_receipts (file_path);

CREATE TABLE IF NOT EXISTS eflow_budget.cash_assignment_commands (
  actor_id uuid NOT NULL,
  command_id uuid NOT NULL,
  payload jsonb NOT NULL,
  result_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, command_id)
);

-- ============================================================================
-- 2. RLS on new tables (read-only directly; writes strictly via SECURITY DEFINER RPCs)
-- ============================================================================

ALTER TABLE public.work_cash_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_cash_assignment_receipts ENABLE ROW LEVEL SECURITY;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_cash_assignments'
      AND policyname = 'work_cash_assignments_read'
  ) THEN
    CREATE POLICY work_cash_assignments_read ON public.work_cash_assignments
      FOR SELECT
      USING (
        public.can_see_task(task_id, (SELECT auth.uid()))
        OR public.can_manage_department_accounting(org_id, (SELECT auth.uid()))
        OR assigned_by = (SELECT auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_cash_assignment_receipts'
      AND policyname = 'work_cash_assignment_receipts_read'
  ) THEN
    CREATE POLICY work_cash_assignment_receipts_read ON public.work_cash_assignment_receipts
      FOR SELECT
      USING (
        uploaded_by = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.work_cash_assignments a
          WHERE a.id = work_cash_assignment_receipts.assignment_id
            AND (
              public.can_see_task(a.task_id, (SELECT auth.uid()))
              OR public.can_manage_department_accounting(a.org_id, (SELECT auth.uid()))
              OR a.assigned_by = (SELECT auth.uid())
            )
        )
      );
  END IF;
END
$policy$;

GRANT SELECT ON public.work_cash_assignments TO authenticated;
GRANT SELECT ON public.work_cash_assignment_receipts TO authenticated;

-- ============================================================================
-- 3. Authorization & Storage Helpers
-- ============================================================================

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
    IF FOUND AND (s.assigned_to = p_caller OR p_caller = ANY(COALESCE(s.assigned_to_ids, '{}'::uuid[]))) THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_assignment_receipt_file(p_name text, p_upload boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  pieces text[];
  v_org uuid;
  v_req uuid;
  v_assign uuid;
  a public.work_cash_assignments;
  r public.petty_cash_requests;
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL OR p_name IS NULL THEN RETURN false; END IF;
  pieces := string_to_array(p_name, '/');
  IF array_length(pieces, 1) < 5 OR pieces[3] <> 'assignments' THEN
    RETURN false;
  END IF;

  v_org := pieces[1]::uuid;
  v_req := pieces[2]::uuid;
  v_assign := pieces[4]::uuid;

  SELECT * INTO a FROM public.work_cash_assignments WHERE id = v_assign;
  IF NOT FOUND OR a.source_kind <> 'task_cash_release' OR a.petty_cash_request_id <> v_req THEN
    RETURN false;
  END IF;

  SELECT * INTO r FROM public.petty_cash_requests WHERE id = v_req AND org_id = v_org;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_upload THEN
    RETURN public.can_log_assignment_receipt(a.id, caller);
  END IF;

  RETURN public.can_see_task(a.task_id, caller)
    OR public.can_manage_department_accounting(r.org_id, caller)
    OR r.cash_recipient_id = caller
    OR r.requester_id = caller
    OR EXISTS (
      SELECT 1 FROM public.work_cash_assignment_receipts ar
      WHERE ar.assignment_id = a.id AND ar.file_path = p_name AND ar.uploaded_by = caller
    );
EXCEPTION WHEN invalid_text_representation OR insufficient_privilege THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_upload_work_receipt(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r public.petty_cash_requests;
  pieces text[];
BEGIN
  pieces := string_to_array(p_name, '/');
  IF auth.uid() IS NULL OR array_length(pieces, 1) < 3 THEN
    RETURN false;
  END IF;
  IF array_length(pieces, 1) >= 5 AND pieces[3] = 'assignments' THEN
    RETURN public.can_access_assignment_receipt_file(p_name, true);
  END IF;
  SELECT * INTO r FROM public.petty_cash_requests WHERE id = pieces[2]::uuid AND org_id = pieces[1]::uuid;
  IF r.id IS NULL THEN RETURN false; END IF;
  RETURN COALESCE((public.receipt_submission_clearance(r.id)->>'canSubmit')::boolean, false);
EXCEPTION WHEN invalid_text_representation OR insufficient_privilege THEN
  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION eflow_office_cash.file_access(p_path text, p_upload boolean)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  r eflow_office_cash.requests;
  p public.profiles;
  pieces text[];
  v_assign uuid;
  a public.work_cash_assignments;
BEGIN
  pieces := string_to_array(p_path, '/');
  IF auth.uid() IS NULL OR array_length(pieces, 1) < 2 THEN
    RETURN false;
  END IF;

  SELECT * INTO r FROM eflow_office_cash.requests WHERE id::text = pieces[1];
  IF NOT FOUND THEN RETURN false; END IF;

  IF array_length(pieces, 1) >= 4 AND pieces[2] = 'assignments' THEN
    BEGIN
      v_assign := pieces[3]::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN false;
    END;
    SELECT * INTO a FROM public.work_cash_assignments
    WHERE id = v_assign AND source_kind = 'office_petty_cash' AND office_cash_request_id = r.id;
    IF NOT FOUND THEN RETURN false; END IF;

    IF p_upload THEN
      RETURN public.can_log_assignment_receipt(a.id, auth.uid());
    END IF;

    SELECT * INTO p FROM public.profiles WHERE id = auth.uid() AND is_active;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN p.id = r.requester
      OR (p.org_id = r.office AND (p.role = 'accounting_staff' OR public.phase2_is_office_head(p.id, r.office)))
      OR public.can_see_task(a.task_id, p.id);
  END IF;

  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() AND is_active AND org_id = r.office;
  RETURN COALESCE(
    p.id IS NOT NULL AND CASE
      WHEN p_upload THEN p.id = r.requester AND r.status = 'released'
      ELSE p.id = r.requester OR p.role = 'accounting_staff' OR public.phase2_is_office_head(p.id, r.office)
    END,
    false
  );
END;
$function$;

-- Storage policies for budget-receipts assignment files + delete protection
DO $storage_policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'work_cash_assignment_receipts_insert'
  ) THEN
    CREATE POLICY work_cash_assignment_receipts_insert ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'budget-receipts'
        AND split_part(name, '/', 3) = 'assignments'
        AND public.can_access_assignment_receipt_file(name, true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'work_cash_assignment_receipts_read'
  ) THEN
    CREATE POLICY work_cash_assignment_receipts_read ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'budget-receipts'
        AND split_part(name, '/', 3) = 'assignments'
        AND public.can_access_assignment_receipt_file(name, false)
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'budget_receipts_delete'
  ) THEN
    ALTER POLICY budget_receipts_delete ON storage.objects
      USING (
        bucket_id = 'budget-receipts'
        AND owner_id = (auth.uid())::text
        AND NOT EXISTS (
          SELECT 1 FROM public.petty_cash_receipts receipt
          WHERE receipt.file_path = objects.name
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.petty_cash_request_attachments attachment
          WHERE attachment.file_path = objects.name
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.work_cash_assignment_receipts ar
          WHERE ar.file_path = objects.name
        )
      );
  END IF;
END
$storage_policy$;

-- ============================================================================
-- 4. Lifecycle triggers: auto-return unspent subtask cash & settle on parent close
-- ============================================================================

CREATE OR REPLACE FUNCTION eflow_budget.guard_subtask_delete_with_receipts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.work_cash_assignments a
    JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
    WHERE a.subtask_id = OLD.id
      AND a.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Remove or liquidate recorded subtask cash receipts before deleting this subtask.'
      USING ERRCODE = '22023';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE TRIGGER work_cash_subtask_delete_guard
  BEFORE DELETE ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION eflow_budget.guard_subtask_delete_with_receipts();

CREATE OR REPLACE FUNCTION eflow_budget.release_unspent_subtask_cash_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  a record;
  v_spent numeric(14,2);
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    FOR a IN
      SELECT * FROM public.work_cash_assignments
      WHERE subtask_id = NEW.id AND status = 'active'
      FOR UPDATE
    LOOP
      SELECT COALESCE(SUM(amount), 0)::numeric(14,2)
        INTO v_spent
      FROM public.work_cash_assignment_receipts
      WHERE assignment_id = a.id;

      IF v_spent <= 0 THEN
        UPDATE public.work_cash_assignments
        SET status = 'recalled', updated_at = now()
        WHERE id = a.id;
      ELSIF v_spent < a.amount THEN
        UPDATE public.work_cash_assignments
        SET amount = v_spent, updated_at = now()
        WHERE id = a.id;
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE TRIGGER work_cash_release_on_subtask_complete
  AFTER UPDATE OF status ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION eflow_budget.release_unspent_subtask_cash_on_complete();

CREATE OR REPLACE FUNCTION eflow_budget.sync_assignments_on_cash_request_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'settled' AND OLD.status IS DISTINCT FROM 'settled' THEN
    UPDATE public.work_cash_assignments
    SET status = 'settled', updated_at = now()
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = NEW.id
      AND status = 'active';
  ELSIF NEW.status IN ('cancelled', 'rejected', 'expired') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.work_cash_assignments
    SET status = 'recalled', updated_at = now()
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE TRIGGER work_cash_sync_on_request_close
  AFTER UPDATE OF status ON public.petty_cash_requests
  FOR EACH ROW
  EXECUTE FUNCTION eflow_budget.sync_assignments_on_cash_request_close();

CREATE OR REPLACE FUNCTION eflow_budget.sync_assignments_on_office_cash_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'settled' AND OLD.status IS DISTINCT FROM 'settled' THEN
    UPDATE public.work_cash_assignments
    SET status = 'settled', updated_at = now()
    WHERE source_kind = 'office_petty_cash'
      AND office_cash_request_id = NEW.id
      AND status = 'active';
  ELSIF NEW.status IN ('cancelled', 'rejected') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.work_cash_assignments
    SET status = 'recalled', updated_at = now()
    WHERE source_kind = 'office_petty_cash'
      AND office_cash_request_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE TRIGGER work_cash_sync_on_office_cash_close
  AFTER UPDATE OF status ON eflow_office_cash.requests
  FOR EACH ROW
  EXECUTE FUNCTION eflow_budget.sync_assignments_on_office_cash_close();

-- ============================================================================
-- 5. Update liquidation functions to accept rolled-up assignment receipts (A1)
-- ============================================================================

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
  /* NW5.2 shared writer lock */
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
      COALESCE(profile.full_name, 'A team member') || ' submitted receipts totaling ' || to_char(p_declared_spent, 'FM999G999G999G990D00') || '.',
      request.task_id, caller, COALESCE(profile.full_name, ''), liquidation_id, 'petty_cash_liquidation'
    FROM public.profiles profile WHERE profile.id = caller;
  ELSE
    INSERT INTO public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, financial_record_id, financial_record_type)
    SELECT approver_id, 'petty_cash_liquidation_department_review', 'Expense liquidation ready for settlement',
      COALESCE(profile.full_name, 'A Task Leader') || ' submitted receipts totaling ' || to_char(p_declared_spent, 'FM999G999G999G990D00') || '.',
      request.task_id, caller, COALESCE(profile.full_name, ''), liquidation_id, 'petty_cash_liquidation'
    FROM public.organization_approver_ids(request.org_id) approver_id
    LEFT JOIN public.profiles profile ON profile.id = caller
    WHERE approver_id <> caller;
  END IF;
  RETURN liquidation_id;
END;
$function$;

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
  /* NW5.2 shared writer lock */
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

-- Update eflow_office_cash.command ONLY to allow verified assignment-uploaded receipt paths during p_action = 'receipts'
CREATE OR REPLACE FUNCTION eflow_office_cash.command(p_office uuid, p_key uuid, p_action text, p_data jsonb)
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
  v_refund_no text;
  v_refund_date date;
  v_has_indep_return boolean;
  v_head_fallback boolean := false;
  v_req_version integer;
  receipt jsonb;
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
                 format('%s endorsed receipts for "%s". Open Office Petty Cash to verify and settle.', COALESCE(p.full_name, 'Office Head'), r.purpose),
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
          format('%s released ₱%s for "%s". Submit receipts within 15 days.', COALESCE(p.full_name, 'Accounting'), to_char(r.amount, 'FM999,999,990.00'), r.purpose),
          p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        );
      END IF;

    ELSIF p_action = 'receipts' THEN
      IF p.id <> r.requester OR r.status <> 'released' THEN
        RAISE EXCEPTION 'Only the recipient can submit receipts for released cash' USING ERRCODE = '42501';
      END IF;
      IF jsonb_typeof(p_data->'receipts') IS DISTINCT FROM 'array'
        OR jsonb_array_length(p_data->'receipts') NOT BETWEEN 0 AND 30
      THEN
        RAISE EXCEPTION 'Add up to 30 receipts, or return the entire unspent advance' USING ERRCODE = '22023';
      END IF;

      FOR receipt IN SELECT * FROM jsonb_array_elements(p_data->'receipts') LOOP
        amt := (receipt->>'amount')::numeric;
        path := receipt->>'path';
        IF amt IS NULL OR amt <= 0 OR amt > 5000 OR amt <> round(amt, 2) THEN
          RAISE EXCEPTION 'Each receipt must be greater than zero and at most PHP 5,000' USING ERRCODE = '22023';
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

      v_returned := round(r.amount - total_spent, 2);
      IF v_returned > 0 THEN
        v_refund_no := btrim(COALESCE(p_data->>'refundReceiptNumber', ''));
        IF length(v_refund_no) NOT BETWEEN 1 AND 100 THEN
          RAISE EXCEPTION 'Enter the official refund receipt number for the unspent cash being returned' USING ERRCODE = '22023';
        END IF;
        v_refund_date := NULLIF(btrim(COALESCE(p_data->>'refundDate', '')), '')::date;
        IF v_refund_date IS NULL OR v_refund_date > day THEN
          RAISE EXCEPTION 'Enter a valid cash return date on or before the transaction date' USING ERRCODE = '22023';
        END IF;
      ELSE
        v_refund_no := NULL;
        v_refund_date := NULL;
      END IF;

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
          status = 'receipt_review'
      WHERE id = r.id;

      INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
      SELECT o.head_user_id,
             'petty_cash_liquidation_department_review',
             'Office petty cash receipts ready for endorsement',
             format('%s submitted receipts totaling ₱%s for "%s".', COALESCE(p.full_name, 'Staff'), to_char(total_spent, 'FM999,999,990.00'), r.purpose),
             p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
      FROM public.organizations o
      JOIN public.profiles h ON h.id = o.head_user_id
      WHERE o.id = p_office AND o.is_active AND h.is_active AND h.id IS DISTINCT FROM p.id;

      event_details := p_data || jsonb_build_object(
        'spent', total_spent,
        'returnedAmount', v_returned,
        'refundReceiptNumber', v_refund_no,
        'refundDate', v_refund_date
      );
      amt := total_spent;

    ELSIF p_action = 'acknowledge_return' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status NOT IN ('receipt_review', 'receipt_approved') THEN
        RAISE EXCEPTION 'Cash return can only be acknowledged after receipts are submitted' USING ERRCODE = '22023';
      END IF;
      IF COALESCE(r.returned_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'This request has no unspent cash to return' USING ERRCODE = '22023';
      END IF;
      IF p_data ? 'receiptVersion' AND NULLIF(p_data->>'receiptVersion', '') IS NOT NULL THEN
        v_req_version := (p_data->>'receiptVersion')::integer;
        IF v_req_version IS DISTINCT FROM r.receipt_version THEN
          RAISE EXCEPTION 'The receipt package changed. Refresh and verify the current return amount.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NOT eflow_office_cash.is_independent_return_receiver(r, p.id) THEN
        RAISE EXCEPTION 'An independent Accounting Officer must acknowledge physical receipt of returned cash' USING ERRCODE = '42501';
      END IF;
      IF r.cash_return_version IS NOT DISTINCT FROM r.receipt_version AND r.cash_return_received_at IS NOT NULL THEN
        RAISE EXCEPTION 'This cash return was already acknowledged by Accounting' USING ERRCODE = '22023';
      END IF;

      UPDATE eflow_office_cash.requests
      SET cash_return_version = r.receipt_version,
          cash_return_received_by = p.id,
          cash_return_received_at = now(),
          cash_return_receive_reference = reference,
          cash_return_approved_by = NULL,
          cash_return_approved_at = NULL,
          cash_return_approval_note = NULL
      WHERE id = r.id;

      INSERT INTO public.notifications(
        user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type
      )
      SELECT
        o.head_user_id,
        'petty_cash_return_received',
        'Office petty cash return received — Head approval required',
        format(
          '%s acknowledged physical receipt of PHP %s for "%s". Approve the cash return before settlement.',
          COALESCE(p.full_name, 'Accounting'),
          to_char(r.returned_amount, 'FM999,999,990.00'),
          r.purpose
        ),
        p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
      FROM public.organizations o
      JOIN public.profiles h ON h.id = o.head_user_id
      WHERE o.id = p_office
        AND o.is_active
        AND h.is_active
        AND h.org_id = o.id
        AND h.role = 'head'
        AND h.id IS DISTINCT FROM p.id
        AND h.id IS DISTINCT FROM r.requester;

      event_details := p_data || jsonb_build_object(
        'returnedAmount', r.returned_amount,
        'receiptVersion', r.receipt_version
      );
      amt := r.returned_amount;

    ELSIF p_action = 'approve_return' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status NOT IN ('receipt_review', 'receipt_approved') THEN
        RAISE EXCEPTION 'Cash return can only be approved after receipts are submitted' USING ERRCODE = '22023';
      END IF;
      IF COALESCE(r.returned_amount, 0) <= 0 THEN
        RAISE EXCEPTION 'This request has no unspent cash to return' USING ERRCODE = '22023';
      END IF;
      IF p_data ? 'receiptVersion' AND NULLIF(p_data->>'receiptVersion', '') IS NOT NULL THEN
        v_req_version := (p_data->>'receiptVersion')::integer;
        IF v_req_version IS DISTINCT FROM r.receipt_version THEN
          RAISE EXCEPTION 'The receipt package changed. Refresh and verify the current return amount.' USING ERRCODE = '22023';
        END IF;
      END IF;
      IF NOT public.phase2_is_office_head(p.id, p_office) OR p.id = r.requester THEN
        RAISE EXCEPTION 'Independent appointed Office Head approval is required for returned cash' USING ERRCODE = '42501';
      END IF;
      IF r.cash_return_version IS NOT DISTINCT FROM r.receipt_version AND r.cash_return_approved_at IS NOT NULL THEN
        RAISE EXCEPTION 'This cash return was already approved by the Office Head' USING ERRCODE = '22023';
      END IF;

      v_has_indep_return := eflow_office_cash.has_independent_return_receiver(r);
      IF v_has_indep_return THEN
        IF r.cash_return_version IS DISTINCT FROM r.receipt_version
          OR r.cash_return_received_at IS NULL
          OR r.cash_return_received_by IS NULL
        THEN
          RAISE EXCEPTION 'Accounting must acknowledge physical receipt of the returned cash before Head approval' USING ERRCODE = '22023';
        END IF;
        IF p.id = r.cash_return_received_by THEN
          RAISE EXCEPTION 'A separate Office Head must approve the cash return' USING ERRCODE = '42501';
        END IF;

        UPDATE eflow_office_cash.requests
        SET cash_return_approved_by = p.id,
            cash_return_approved_at = now(),
            cash_return_approval_note = reference
        WHERE id = r.id;
      ELSE
        v_head_fallback := true;
        UPDATE eflow_office_cash.requests
        SET cash_return_version = r.receipt_version,
            cash_return_received_by = COALESCE(
              CASE WHEN cash_return_version IS NOT DISTINCT FROM r.receipt_version THEN cash_return_received_by END,
              p.id
            ),
            cash_return_received_at = COALESCE(
              CASE WHEN cash_return_version IS NOT DISTINCT FROM r.receipt_version THEN cash_return_received_at END,
              now()
            ),
            cash_return_receive_reference = COALESCE(
              CASE WHEN cash_return_version IS NOT DISTINCT FROM r.receipt_version THEN cash_return_receive_reference END,
              'Head fallback receipt: ' || reference
            ),
            cash_return_approved_by = p.id,
            cash_return_approved_at = now(),
            cash_return_approval_note = reference
        WHERE id = r.id;
      END IF;

      IF r.status = 'receipt_approved' THEN
        PERFORM eflow_office_cash.notify_blocked_settlements(r.id);
      END IF;

      INSERT INTO public.notifications(
        user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type
      )
      SELECT
        acc.id,
        'petty_cash_return_approved',
        'Office petty cash return approved — ready to settle',
        format(
          '%s approved the PHP %s cash return for "%s". Settlement can now proceed.',
          COALESCE(p.full_name, 'Office Head'),
          to_char(r.returned_amount, 'FM999,999,990.00'),
          r.purpose
        ),
        p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
      FROM public.profiles acc
      WHERE acc.org_id = p_office
        AND acc.is_active
        AND acc.role = 'accounting_staff'
        AND acc.id IS DISTINCT FROM r.requester
        AND acc.id IS DISTINCT FROM p.id;

      event_details := p_data || jsonb_build_object(
        'returnedAmount', r.returned_amount,
        'receiptVersion', r.receipt_version,
        'headFallback', v_head_fallback
      );
      amt := r.returned_amount;

    ELSIF p_action = 'settle' THEN
      PERFORM 1 FROM public.organizations WHERE id = p_office FOR SHARE;
      PERFORM 1 FROM public.profiles WHERE org_id = p_office ORDER BY id FOR SHARE;

      IF r.status <> 'receipt_approved' THEN
        RAISE EXCEPTION 'Independent receipt endorsement required before settlement' USING ERRCODE = '22023';
      END IF;
      IF NOT eflow_office_cash.is_independent_settler(r, p.id) THEN
        IF eflow_office_cash.head_can_fallback_settle(r, p.id) THEN
          v_head_fallback := true;
        ELSE
          RAISE EXCEPTION 'A separate Accounting Officer must settle this request' USING ERRCODE = '42501';
        END IF;
      END IF;
      IF COALESCE(r.returned_amount, 0) > 0 AND NOT eflow_office_cash.cash_return_cleared(r) THEN
        RAISE EXCEPTION 'Accounting must acknowledge the exact cash return and an independent Office Head must approve it before settlement' USING ERRCODE = '42501';
      END IF;

      UPDATE eflow_office_cash.funds SET cash = cash + (r.amount - r.spent) WHERE office = p_office;
      UPDATE eflow_office_cash.requests SET status = 'settled' WHERE id = r.id;

      IF r.requester IS DISTINCT FROM p.id THEN
        INSERT INTO public.notifications(user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type)
        VALUES (
          r.requester,
          'petty_cash_liquidation_decision',
          'Office petty cash settled',
          format('%s verified and settled your Office Petty Cash receipts for "%s".', COALESCE(p.full_name, 'Accounting'), r.purpose),
          p_office, p.id, COALESCE(p.full_name, ''), r.id, 'office_petty_cash'
        );
      END IF;

      event_details := p_data || jsonb_build_object(
        'spent', r.spent,
        'returnedAmount', r.returned_amount,
        'refundReceiptNumber', r.refund_receipt_number,
        'headFallback', v_head_fallback
      );
      amt := r.spent;

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

-- ============================================================================
-- 6. Public RPCs: assign_work_cash, recall_work_cash, record/delete receipts,
--    get_request_assignment_receipts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.assign_work_cash(
  p_task_id uuid,
  p_subtask_id uuid DEFAULT NULL,
  p_source_kind text DEFAULT 'task_cash_release',
  p_source_request_id uuid DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_note text DEFAULT '',
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
    v_pool_limit := pcr.released_amount;
    v_source_label := 'FR-' || lpad(pcr.request_number::text, 5, '0');

    SELECT * INTO existing_assign
    FROM public.work_cash_assignments
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = pcr.id
      AND task_id = p_task_id
      AND subtask_id IS NOT DISTINCT FROM p_subtask_id
      AND status = 'active'
    FOR UPDATE;

    SELECT COALESCE(SUM(amount), 0)::numeric(14,2) INTO v_other_assigned
    FROM public.work_cash_assignments
    WHERE source_kind = 'task_cash_release'
      AND petty_cash_request_id = pcr.id
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
    WHERE assignment_id = existing_assign.id;

    IF p_amount < v_existing_spent THEN
      RAISE EXCEPTION 'Assigned cash cannot be below ₱% already logged in receipts.',
        to_char(v_existing_spent, 'FM999,999,990.00')
        USING ERRCODE = '22023';
    END IF;
  END IF;

  IF v_other_assigned + p_amount > v_pool_limit THEN
    RAISE EXCEPTION 'Amount exceeds the remaining unassigned cash (₱%).',
      to_char(GREATEST(0, v_pool_limit - v_other_assigned), 'FM999,999,990.00')
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
      petty_cash_request_id, office_cash_request_id,
      amount, status, note, assigned_by
    ) VALUES (
      task_row.org_id,
      p_task_id,
      p_subtask_id,
      p_source_kind,
      CASE WHEN p_source_kind = 'task_cash_release' THEN p_source_request_id ELSE NULL END,
      CASE WHEN p_source_kind = 'office_petty_cash' THEN p_source_request_id ELSE NULL END,
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

CREATE OR REPLACE FUNCTION public.recall_work_cash(
  p_assignment_id uuid,
  p_reason text DEFAULT '',
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
  pcr public.petty_cash_requests;
  ocr eflow_office_cash.requests;
  prev_cmd eflow_budget.cash_assignment_commands;
  payload jsonb;
  v_spent numeric(14,2) := 0;
  v_returned numeric(14,2) := 0;
  v_reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  IF p_assignment_id IS NULL OR p_key IS NULL THEN
    RAISE EXCEPTION 'Assignment reference is required.' USING ERRCODE = '22023';
  END IF;

  payload := jsonb_build_object('op', 'recall', 'assignmentId', p_assignment_id, 'reason', v_reason);
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('work-cash:' || caller || ':' || p_key, 0));
  SELECT * INTO prev_cmd FROM eflow_budget.cash_assignment_commands WHERE actor_id = caller AND command_id = p_key;
  IF FOUND THEN
    IF prev_cmd.payload <> payload THEN
      RAISE EXCEPTION 'This recall key was already used with different details.' USING ERRCODE = '22023';
    END IF;
    RETURN prev_cmd.result_id;
  END IF;

  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash assignment not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM eflow_r7.lock_impact(a.task_id);
  SELECT * INTO a FROM public.work_cash_assignments WHERE id = p_assignment_id FOR UPDATE;
  IF a.status <> 'active' THEN
    RAISE EXCEPTION 'This cash assignment is already closed or recalled.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO task_row FROM public.tasks WHERE id = a.task_id AND deleted_at IS NULL;
  IF NOT FOUND OR caller IS DISTINCT FROM COALESCE(task_row.assigned_to, task_row.recommendation_lead_id) THEN
    RAISE EXCEPTION 'Only the assigned Task Lead can return unassigned cash to the pool.' USING ERRCODE = '42501';
  END IF;

  IF a.source_kind = 'task_cash_release' THEN
    SELECT * INTO pcr FROM public.petty_cash_requests WHERE id = a.petty_cash_request_id FOR UPDATE;
    IF NOT FOUND OR pcr.cash_recipient_id IS DISTINCT FROM caller OR pcr.status NOT IN ('released', 'changes_requested', 'overdue_liquidation') THEN
      RAISE EXCEPTION 'The parent cash release is no longer open for reassignment.' USING ERRCODE = '22023';
    END IF;
  ELSE
    SELECT * INTO ocr FROM eflow_office_cash.requests WHERE id = a.office_cash_request_id FOR UPDATE;
    IF NOT FOUND OR ocr.requester IS DISTINCT FROM caller OR ocr.status <> 'released' THEN
      RAISE EXCEPTION 'The parent office petty cash release is no longer open for reassignment.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount), 0)::numeric(14,2) INTO v_spent
  FROM public.work_cash_assignment_receipts
  WHERE assignment_id = a.id;

  v_returned := round(a.amount - v_spent, 2);
  IF v_returned <= 0 THEN
    RAISE EXCEPTION 'This assignment has no unspent cash to return to the cash pool.' USING ERRCODE = '22023';
  END IF;

  IF v_spent <= 0 THEN
    UPDATE public.work_cash_assignments
    SET status = 'recalled', updated_at = now()
    WHERE id = a.id;
  ELSE
    UPDATE public.work_cash_assignments
    SET amount = v_spent, updated_at = now()
    WHERE id = a.id;
  END IF;

  SELECT COALESCE(full_name, '') INTO caller_name FROM public.profiles WHERE id = caller;

  INSERT INTO public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id, target_label, change_summary
  ) VALUES (
    caller,
    caller_name,
    'work_cash_assignment',
    a.id::text,
    'recall_work_cash_assignment',
    NULLIF(v_reason, ''),
    jsonb_build_object('amount', a.amount, 'status', a.status),
    jsonb_build_object('amount', CASE WHEN v_spent <= 0 THEN 0 ELSE v_spent END, 'status', CASE WHEN v_spent <= 0 THEN 'recalled' ELSE 'active' END, 'returned_to_pool', v_returned),
    a.org_id,
    task_row.title,
    format('Returned ₱%s unused cash back to unassigned cash pool', to_char(v_returned, 'FM999,999,990.00'))
  );

  INSERT INTO eflow_budget.cash_assignment_commands(actor_id, command_id, payload, result_id)
  VALUES (caller, p_key, payload, a.id);

  RETURN a.id;
END;
$function$;

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
  WHERE assignment_id = a.id;

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
        IF NOT eflow_budget.valid_money(v_item_amt, false)
          OR v_item_qty IS NULL OR v_item_qty <= 0 OR v_item_qty <> round(v_item_qty, 3)
          OR NULLIF(btrim(v_item->>'unit'), '') IS NULL
          OR NULLIF(btrim(v_item->>'particular'), '') IS NULL
          OR NULLIF(btrim(v_item->>'purpose'), '') IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.petty_cash_request_lines
            WHERE request_id = pcr.id AND allocation_line_id = (v_item->>'allocationLineId')::uuid
          )
        THEN
          RAISE EXCEPTION 'Each receipt item needs valid quantity, unit, particulars, purpose, amount, and authorized account.' USING ERRCODE = '22023';
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

CREATE OR REPLACE FUNCTION public.delete_assignment_receipt(p_receipt_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller uuid := eflow_r3.actor();
  caller_name text;
  ar public.work_cash_assignment_receipts;
  a public.work_cash_assignments;
  task_row public.tasks;
BEGIN
  IF p_receipt_id IS NULL THEN
    RAISE EXCEPTION 'Receipt reference is required.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO ar FROM public.work_cash_assignment_receipts WHERE id = p_receipt_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found.' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO a FROM public.work_cash_assignments WHERE id = ar.assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cash assignment not found.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM eflow_r7.lock_impact(a.task_id);
  SELECT * INTO a FROM public.work_cash_assignments WHERE id = ar.assignment_id FOR UPDATE;

  IF NOT public.can_log_assignment_receipt(a.id, caller) THEN
    RAISE EXCEPTION 'Receipts can no longer be edited on this cash assignment.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO task_row FROM public.tasks WHERE id = a.task_id;
  IF caller <> ar.uploaded_by
    AND caller <> a.assigned_by
    AND caller IS DISTINCT FROM COALESCE(task_row.assigned_to, task_row.recommendation_lead_id)
  THEN
    RAISE EXCEPTION 'Only the uploader or Task Lead can remove this receipt.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.work_cash_assignment_receipts
  SET deleted_at = now(), deleted_by = caller
  WHERE id = ar.id AND deleted_at IS NULL;

  SELECT COALESCE(full_name, '') INTO caller_name FROM public.profiles WHERE id = caller;
  INSERT INTO public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action,
    before_data, org_id, target_label, change_summary
  ) VALUES (
    caller,
    caller_name,
    'work_cash_assignment_receipt',
    ar.id::text,
    'delete_assignment_receipt',
    jsonb_build_object('assignment_id', a.id, 'vendor', ar.vendor, 'amount', ar.amount),
    a.org_id,
    task_row.title,
    format('Removed ₱%s receipt (%s)', to_char(ar.amount, 'FM999,999,990.00'), ar.vendor)
  );
END;
$function$;

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
    'createdAt', ar.created_at
  ) ORDER BY ar.created_at ASC), '[]'::jsonb)
  INTO v_rows
  FROM public.work_cash_assignments a
  JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
  LEFT JOIN public.subtasks s ON s.id = a.subtask_id
  LEFT JOIN public.profiles u ON u.id = ar.uploaded_by
  WHERE a.source_kind = 'task_cash_release'
    AND a.petty_cash_request_id = r.id
    AND a.status IN ('active', 'settled');

  RETURN v_rows;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_work_cash(uuid, uuid, text, uuid, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recall_work_cash(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_assignment_receipt(uuid, text, text, date, text, numeric, jsonb, text, text, text, bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_assignment_receipt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_request_assignment_receipts(uuid) TO authenticated;

-- ============================================================================
-- 7. Extend get_task_funding_context with cashPools & office petty cash pools
-- ============================================================================

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
        SELECT jsonb_agg(
          l.category || COALESCE(' · FY ' || f.fiscal_year::text, '')
          ORDER BY l.position, l.id
        )
        FROM (
          SELECT DISTINCT rl.allocation_line_id
          FROM public.petty_cash_request_lines rl
          WHERE rl.request_id = r.id
          UNION
          SELECT r.allocation_line_id WHERE r.allocation_line_id IS NOT NULL
        ) line_ids
        JOIN public.work_budget_allocation_lines l ON l.id = line_ids.allocation_line_id
        LEFT JOIN eflow_project.funding f ON f.id = l.project_funding_id
      ), '[]'::jsonb) AS source_labels,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'allocationLineId', rl.allocation_line_id,
          'amount', rl.amount,
          'sourceName', COALESCE(l.category, 'Approved source')
        ) ORDER BY l.position, rl.allocation_line_id)
        FROM public.petty_cash_request_lines rl
        LEFT JOIN public.work_budget_allocation_lines l ON l.id = rl.allocation_line_id
        WHERE rl.request_id = r.id
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
        JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
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

  -- 2. Released Office Petty Cash held by the current caller in this task's office
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
        JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
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

  -- 3. Active assignments on this task (or filtered to p_subtask_id)
  WITH assign_rows AS (
    SELECT
      a.id,
      a.source_kind,
      COALESCE(a.petty_cash_request_id, a.office_cash_request_id) AS source_request_id,
      CASE
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
        WHEN a.source_kind = 'task_cash_release' THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'allocationLineId', rl.allocation_line_id,
            'amount', rl.amount,
            'sourceName', COALESCE(l.category, 'Approved source')
          ) ORDER BY l.position, rl.allocation_line_id)
          FROM public.petty_cash_request_lines rl
          LEFT JOIN public.work_budget_allocation_lines l ON l.id = rl.allocation_line_id
          WHERE rl.request_id = pcr.id
        ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS funding_lines,
      COALESCE((
        SELECT SUM(ar.amount)::numeric(14,2)
        FROM public.work_cash_assignment_receipts ar
        WHERE ar.assignment_id = a.id
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
        WHERE ar.assignment_id = a.id
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

CREATE OR REPLACE FUNCTION public.get_task_funding_context(p_task_id uuid, p_subtask_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  result jsonb;
  allocation uuid;
  can_manage boolean;
  summary jsonb;
  children jsonb;
  sources jsonb;
  pools jsonb;
BEGIN
  result := eflow_budget.task_context(p_task_id, p_subtask_id);
  allocation := (result->>'taskAllocationId')::uuid;
  pools := eflow_budget.task_cash_pools(p_task_id, p_subtask_id);
  result := result || jsonb_build_object(
    'subtaskUtilization', eflow_budget.subtask_utilization(p_task_id, p_subtask_id),
    'cashPools', pools
  );
  IF allocation IS NULL THEN
    -- Still expose subtasks so Task Lead can assign Office Petty Cash even without a project task budget
    IF COALESCE((pools->>'canAssignCash')::boolean, false) OR p_subtask_id IS NOT NULL THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'finished', s.status = 'completed',
        'capId', NULL,
        'sourceId', NULL,
        'amount', 0,
        'returnable', 0,
        'reason', NULL,
        'hasHistory', false,
        'blocked', false
      ) ORDER BY s.title, s.id), '[]'::jsonb)
      INTO children
      FROM public.subtasks s
      WHERE s.task_id = p_task_id AND (p_subtask_id IS NULL OR s.id = p_subtask_id);
      result := result || jsonb_build_object('subtaskBudgets', COALESCE(children, '[]'::jsonb));
    END IF;
    RETURN result;
  END IF;

  can_manage := eflow_r3.eligible(auth.uid())
    AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = p_task_id AND t.assigned_to = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      LEFT JOIN public.projects p ON p.id = t.linked_project_id
      WHERE t.id = p_task_id
        AND t.proposed_office_identity_id IS NULL
        AND COALESCE(p.status, '') NOT IN ('completed', 'archived')
    );

  WITH totals AS (
    SELECT COALESCE(sum(c.amount), 0) AS assigned
    FROM public.work_budget_allocations c
    JOIN public.work_budget_allocation_lines l ON l.id = c.parent_allocation_line_id
    WHERE l.allocation_id = allocation AND c.subtask_id IS NOT NULL AND c.status IN ('pending', 'approved')
  ), cash AS (
    SELECT
      COALESCE(sum(r.released_amount), 0) AS released,
      COALESCE(sum(r.actual_spent) FILTER (WHERE r.status = 'settled'), 0) AS spent
    FROM public.petty_cash_requests r
    WHERE r.task_id = p_task_id
      AND (p_subtask_id IS NULL OR r.subtask_id = p_subtask_id)
  )
  SELECT jsonb_build_object(
    'allocated', assigned,
    'unallocated', GREATEST(0, (result->>'taskBudget')::numeric - assigned),
    'available', COALESCE((SELECT sum(public.task_budget_line_available(id, NULL)) FROM public.work_budget_allocation_lines WHERE allocation_id = allocation), 0),
    'released', released,
    'spent', spent
  ) INTO summary
  FROM totals CROSS JOIN cash;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'name', l.category || COALESCE(' · FY ' || f.fiscal_year::text, ''),
    'available', public.task_budget_line_available(l.id, NULL)
  ) ORDER BY l.position, l.id), '[]') INTO sources
  FROM public.work_budget_allocation_lines l
  LEFT JOIN eflow_project.funding f ON f.id = l.project_funding_id
  WHERE l.allocation_id = allocation AND l.amount > 0;

  IF can_manage OR p_subtask_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'finished', s.status = 'completed',
      'capId', c.id,
      'sourceId', c.parent_allocation_line_id,
      'amount', COALESCE(c.amount, 0),
      'returnable', COALESCE(public.subtask_cap_available(c.id), 0),
      'reason', c.reason,
      'hasHistory', EXISTS (SELECT 1 FROM public.petty_cash_requests r WHERE r.allocation_id = c.id),
      'blocked', EXISTS (
        SELECT 1 FROM public.petty_cash_requests r
        WHERE r.task_id = s.task_id AND r.subtask_id = s.id
          AND r.status NOT IN ('draft', 'rejected', 'cancelled', 'expired', 'settled')
      )
    ) ORDER BY s.title, s.id), '[]') INTO children
    FROM public.subtasks s
    LEFT JOIN public.work_budget_allocations c ON c.subtask_id = s.id AND c.task_id = s.task_id AND c.status IN ('approved', 'pending')
      AND EXISTS (SELECT 1 FROM public.work_budget_allocation_lines l WHERE l.id = c.parent_allocation_line_id AND l.allocation_id = allocation)
    WHERE s.task_id = p_task_id AND (p_subtask_id IS NULL OR s.id = p_subtask_id);
  END IF;

  RETURN result || jsonb_build_object(
    'distribution', summary,
    'subtaskBudgets', COALESCE(children, '[]'),
    'parentSources', sources,
    'canManageDistribution', can_manage
  );
END;
$function$;

-- ============================================================================
-- 8. Extend eflow_office_cash.snapshot to include rolled-up assignment receipts
-- ============================================================================

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
              'uploadedByName', COALESCE(up.full_name, '')
            ) ORDER BY ar.created_at ASC)
            FROM public.work_cash_assignments a
            JOIN public.work_cash_assignment_receipts ar ON ar.assignment_id = a.id
            JOIN public.tasks t ON t.id = a.task_id
            LEFT JOIN public.subtasks s ON s.id = a.subtask_id
            LEFT JOIN public.profiles up ON up.id = ar.uploaded_by
            WHERE a.source_kind = 'office_petty_cash'
              AND a.office_cash_request_id = r.id
              AND a.status IN ('active', 'settled')
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
          'canAcknowledgeReturn',
            r.status IN ('receipt_review', 'receipt_approved')
            AND COALESCE(r.returned_amount, 0) > 0
            AND NOT (
              r.cash_return_version IS NOT DISTINCT FROM r.receipt_version
              AND r.cash_return_received_at IS NOT NULL
            )
            AND eflow_office_cash.is_independent_return_receiver(r, p.id),
          'canApproveReturn',
            r.status IN ('receipt_review', 'receipt_approved')
            AND COALESCE(r.returned_amount, 0) > 0
            AND NOT (
              r.cash_return_version IS NOT DISTINCT FROM r.receipt_version
              AND r.cash_return_approved_at IS NOT NULL
            )
            AND public.phase2_is_office_head(p.id, r.office)
            AND p.id IS DISTINCT FROM r.requester
            AND (
              (
                r.cash_return_version IS NOT DISTINCT FROM r.receipt_version
                AND r.cash_return_received_at IS NOT NULL
                AND p.id IS DISTINCT FROM r.cash_return_received_by
              )
              OR NOT eflow_office_cash.has_independent_return_receiver(r)
            ),
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
