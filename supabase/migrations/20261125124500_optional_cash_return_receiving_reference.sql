-- ============================================================================
-- Migration: 20261125124500_optional_cash_return_receiving_reference.sql
-- Purpose:
--   Accounting no longer has to type a receiving reference to settle a task
--   cash liquidation that includes unused cash returned. The reference falls
--   back to (1) typed reference, (2) the requester's Refund OR #, (3) any
--   earlier acknowledgment reference, then (4) an auto-generated attestation
--   line naming the confirming amount and Asia/Manila date. The settle click is
--   the attestation and is still fully recorded in audit_events + return_decisions.
-- ============================================================================
DO $migration$
DECLARE
  v_def text;
  v_old text := $old$RAISE EXCEPTION 'Enter the cash return receiving reference (OR / acknowledgment #) before settling.' USING ERRCODE = '22023';$old$;
  v_new text := $new$v_return_ref := format('Accounting confirmed physical receipt of ₱%s unused cash on %s', to_char(l.returned_amount, 'FM999,999,990.00'), to_char((now() AT TIME ZONE 'Asia/Manila')::date, 'MM/DD/YYYY'));$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'settle_accounting_liquidation_with_return';

  IF v_def IS NULL OR position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'settle_accounting_liquidation_with_return does not contain the expected mandatory-reference check';
  END IF;

  EXECUTE replace(v_def, v_old, v_new);
END
$migration$;
