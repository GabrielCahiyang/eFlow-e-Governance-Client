-- Read-only checks after running the installation package on
-- ixnfphgjyelhckjwjkdv. No accounts, financial records or permissions change.
begin read only;
select version,name,cardinality(statements) as stored_source_blocks
from supabase_migrations.schema_migrations where version='20261015125031';
select signature,to_regprocedure(signature) is not null as installed,
  has_function_privilege('anon',signature,'execute') as anonymous_execute
from unnest(array[
  'eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)',
  'eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date)',
  'eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date)',
  'public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid)',
  'public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)',
  'public.map_office_budget_account(uuid,text)'
]) signatures(signature);
select relation,to_regclass(relation) is not null as installed
from unnest(array['public.petty_cash_request_lines','public.petty_cash_receipt_items','eflow_budget.pcv_counters','eflow_budget.cash_commands']) relations(relation);
select fiscal_budget_id,count(*) filter(where pcv_number is not null) as numbered_documents,
  count(*) filter(where pcv_legacy and pcv_number is null) as legacy_unnumbered,
  max(pcv_number) as highest_pcv,
  (select last_number from eflow_budget.pcv_counters c where c.fiscal_budget_id=r.fiscal_budget_id) as counter
from public.petty_cash_requests r group by fiscal_budget_id;
select count(*) as mismatched_funding_totals
from public.petty_cash_requests r where r.allocation_line_id is not null and r.requested_amount is distinct from
  (select sum(amount) from public.petty_cash_request_lines l where l.request_id=r.id);
-- Historical discrepancies, if any, must be reviewed and corrected with NEW
-- audit evidence. This query never rewrites the original creation event.
-- Candidates can also include legitimate older corrections; inspect the full
-- event chain before classifying any historical discrepancy as an error.
select count(*) as historical_creation_amounts_requiring_review
from public.petty_cash_requests r join public.budget_ledger_entries e on e.petty_cash_request_id=r.id and e.entry_type='cash_request_created'
where r.pcv_legacy and e.amount<>r.requested_amount
  and not exists(select 1 from public.budget_ledger_entries correction where correction.petty_cash_request_id=r.id and correction.metadata->>'operation'='cash_request_corrected');
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in ('petty_cash_request_lines','petty_cash_receipt_items');
commit;
