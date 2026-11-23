-- Fix PL/pgSQL variable vs. SQL table alias collision ("s" and "b") in
-- eflow_project._validate_funding_lines(uuid, jsonb, uuid) that caused
-- `column reference "s.id" is ambiguous` when submitting project funding.

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
  v_section public.office_budget_sections;
  v_budget public.department_fiscal_budgets;
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

    SELECT * INTO v_section FROM public.office_budget_sections WHERE id = (line->>'partitionId')::uuid AND NOT retired;
    SELECT * INTO v_budget FROM public.department_fiscal_budgets WHERE id = v_section.fiscal_budget_id AND org_id = p_org_id AND status = 'locked';
    IF v_budget.id IS NULL OR EXISTS (SELECT 1 FROM public.office_budget_sections WHERE parent_id = v_section.id AND NOT retired) THEN
      RAISE EXCEPTION 'Choose a released leaf funding account from this office and a locked fiscal year' USING ERRCODE = '23514';
    END IF;

    section_available := GREATEST(
      0,
      v_section.amount
      - v_section.held_amount
      - eflow_budget.partition_committed(v_section.id)
      - eflow_project.pending_partition_reserved(v_section.id, p_exclude_request)
    );
    IF amount > section_available THEN
      RAISE EXCEPTION 'Funding source %: requested %, available %', v_section.name, amount, section_available USING ERRCODE = '23514';
    END IF;

    total := total + amount;
  END LOOP;

  -- Cumulative fiscal-budget ceiling check across all lines in this submission
  -- plus active commitments and other open pending funding requests.
  FOR fb_check IN
    SELECT dfb.id,
           sum((item->>'amount')::numeric) AS requested_total,
           GREATEST(
             0,
             dfb.approved_amount
             - eflow_budget.section_total(dfb.id, true)
             - COALESCE((
                 SELECT sum(bc.amount)
                 FROM public.budget_commitments bc
                 WHERE bc.fiscal_budget_id = dfb.id AND bc.status = 'active'
               ), 0)
             - eflow_project.pending_fiscal_reserved(dfb.id, p_exclude_request)
           ) AS available_total
    FROM jsonb_array_elements(p_lines) item
    JOIN public.office_budget_sections sec ON sec.id = (item->>'partitionId')::uuid
    JOIN public.department_fiscal_budgets dfb ON dfb.id = sec.fiscal_budget_id
    GROUP BY dfb.id, dfb.approved_amount
  LOOP
    IF fb_check.requested_total > fb_check.available_total THEN
      RAISE EXCEPTION 'Office Budget has insufficient available funding' USING ERRCODE = '23514';
    END IF;
  END LOOP;

  RETURN total;
END;
$function$;
