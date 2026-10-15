-- Read-only acceptance checks for the ADDITIONAL financial integrity patch.
-- Target: ixnfphgjyelhckjwjkdv. No financial history or permissions change.
begin read only;
select version,name,cardinality(statements) as stored_source_blocks
from supabase_migrations.schema_migrations
where version in ('20261015125031','20261015142837') order by version;
select signature,to_regprocedure(signature) is not null as installed
from unnest(array[
 'eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)',
 'eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid)',
 'eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)',
 'eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid)',
 'eflow_budget.integrity_receipts(jsonb)'
]) signatures(signature);
select p.proname,has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='eflow_budget' and p.proname in (
 'pre_integrity_journal','pre_integrity_contextual_liquidation',
 'pre_integrity_accounting_liquidation','integrity_liquidation_retry','integrity_receipts');
-- Existing discrepancies are review candidates, not authorization to rewrite
-- immutable journals or infer missing refund evidence. Append approved fixes.
select count(*) as existing_unbalanced_entries_requiring_review from (
 select journal_entry_id from public.general_journal_lines
 group by journal_entry_id having sum(debit)<>sum(credit)
) entries;
select count(*) as existing_missing_refund_references_requiring_review
from public.petty_cash_liquidations
where returned_amount>0 and (nullif(btrim(refund_receipt_number),'') is null or refund_date is null);
commit;
