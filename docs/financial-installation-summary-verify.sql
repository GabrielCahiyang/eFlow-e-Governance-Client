-- Read-only: one result row keeps every check visible in SQL Editor.
-- Target: ixnfphgjyelhckjwjkdv. This does not install or change anything.
begin read only;
with expected_versions(version) as (
  values ('20261015125031'),('20261015142837')
), migration_checks as (
  select e.version,h.name,h.version is not null as installed
  from expected_versions e left join supabase_migrations.schema_migrations h
    on h.version=e.version
), expected_helpers(signature) as (
  values
    ('eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)'),
    ('eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid)'),
    ('eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)'),
    ('eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid)'),
    ('eflow_budget.integrity_receipts(jsonb)')
), helper_checks as (
  select signature,p.oid is not null as installed,
    case when p.oid is not null then has_function_privilege('anon',p.oid,'execute') end as anon_execute,
    case when p.oid is not null then has_function_privilege('authenticated',p.oid,'execute') end as authenticated_execute
  from expected_helpers e left join pg_proc p on p.oid=to_regprocedure(e.signature)::oid
), expected_tables(tablename) as (
  values ('petty_cash_request_lines'),('petty_cash_receipt_items')
), rls_checks as (
  select e.tablename,t.tablename is not null as installed,t.rowsecurity
  from expected_tables e left join pg_tables t
    on t.schemaname='public' and t.tablename=e.tablename
), journal_review as (
  select count(*) as count from (
    select journal_entry_id from public.general_journal_lines
    group by journal_entry_id having sum(debit)<>sum(credit)
  ) entries
), refund_review as (
  select count(*) as count from public.petty_cash_liquidations
  where returned_amount>0
    and (nullif(btrim(refund_receipt_number),'') is null or refund_date is null)
)
select
  (select bool_and(installed) from migration_checks) as both_migrations_installed,
  (select jsonb_agg(to_jsonb(m) order by version) from migration_checks m) as migrations,
  (select bool_and(installed) from helper_checks) as all_helpers_installed,
  (select bool_and(installed and anon_execute is false and authenticated_execute is false)
    from helper_checks) as private_helper_permissions_correct,
  (select jsonb_agg(to_jsonb(h) order by signature) from helper_checks h) as helpers,
  (select bool_and(installed and rowsecurity is true) from rls_checks) as both_tables_rls_enabled,
  (select jsonb_agg(to_jsonb(r) order by tablename) from rls_checks r) as tables,
  (select count from journal_review) as existing_unbalanced_entries_requiring_review,
  (select count from refund_review) as existing_missing_refund_references_requiring_review;
commit;
