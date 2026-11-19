-- System-wide input validation parity: add missing upper-bound CHECK constraints
-- aligned 1:1 with frontend INPUT_LIMITS and FastAPI Pydantic schemas.
-- Idempotent: drops & recreates each named upper-bound CHECK constraint safely.

DO $$
BEGIN
  -- 1. announcements
  ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS announcements_title_length_check,
    ADD CONSTRAINT announcements_title_length_check CHECK (char_length(title) <= 200);

  ALTER TABLE public.announcements
    DROP CONSTRAINT IF EXISTS announcements_body_length_check,
    ADD CONSTRAINT announcements_body_length_check CHECK (body IS NULL OR char_length(body) <= 10000);

  -- 2. task_comments
  ALTER TABLE public.task_comments
    DROP CONSTRAINT IF EXISTS task_comments_body_length_check,
    ADD CONSTRAINT task_comments_body_length_check CHECK (char_length(body) <= 4000);

  -- 3. user_org_scope_grants
  ALTER TABLE public.user_org_scope_grants
    DROP CONSTRAINT IF EXISTS user_org_scope_grants_reason_max_length_check,
    ADD CONSTRAINT user_org_scope_grants_reason_max_length_check CHECK (char_length(reason) <= 1000);

  -- 4. petty_cash_receipt_items
  ALTER TABLE public.petty_cash_receipt_items
    DROP CONSTRAINT IF EXISTS petty_cash_receipt_items_unit_max_length_check,
    ADD CONSTRAINT petty_cash_receipt_items_unit_max_length_check CHECK (char_length(unit) <= 50);

  ALTER TABLE public.petty_cash_receipt_items
    DROP CONSTRAINT IF EXISTS petty_cash_receipt_items_particular_max_length_check,
    ADD CONSTRAINT petty_cash_receipt_items_particular_max_length_check CHECK (char_length(particular) <= 200);

  ALTER TABLE public.petty_cash_receipt_items
    DROP CONSTRAINT IF EXISTS petty_cash_receipt_items_purpose_max_length_check,
    ADD CONSTRAINT petty_cash_receipt_items_purpose_max_length_check CHECK (char_length(purpose) <= 1000);

  ALTER TABLE public.petty_cash_receipt_items
    DROP CONSTRAINT IF EXISTS petty_cash_receipt_items_quantity_max_check,
    ADD CONSTRAINT petty_cash_receipt_items_quantity_max_check CHECK (quantity <= 9007199254740);

  ALTER TABLE public.petty_cash_receipt_items
    DROP CONSTRAINT IF EXISTS petty_cash_receipt_items_amount_max_check,
    ADD CONSTRAINT petty_cash_receipt_items_amount_max_check CHECK (amount <= 9999999999);

  -- 5. proposal_collaboration_orgs
  ALTER TABLE public.proposal_collaboration_orgs
    DROP CONSTRAINT IF EXISTS proposal_collaboration_orgs_quorum_max_check,
    ADD CONSTRAINT proposal_collaboration_orgs_quorum_max_check CHECK (quorum_count IS NULL OR (quorum_count >= 1 AND quorum_count <= 99));

  ALTER TABLE public.proposal_collaboration_orgs
    DROP CONSTRAINT IF EXISTS proposal_collaboration_orgs_sequence_bounds_check,
    ADD CONSTRAINT proposal_collaboration_orgs_sequence_bounds_check CHECK (approval_sequence IS NULL OR (approval_sequence >= 1 AND approval_sequence <= 99));
END $$;
