-- eFlow financial integrity follow-up; target ixnfphgjyelhckjwjkdv.
-- Run this WHOLE file once. Requires installed version 20261015125031.
-- Does NOT rerun or change that installed migration or any NW file.
-- Canonical migration SHA-256: fde5e5db2f88b489f37e09f1e89eb9f3446d1659e053110e53b182610ab7b467
-- Additive follow-up to 20261015125031. Never rewrite installed history.
-- Preserve existing writer authority, evidence, accounting and NW guards.
begin;
do $history_check$
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Supabase migration history is required';end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261015125031') then
    raise exception 'Install financial compatibility 20261015125031 first';
  end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version='20261015142837') then
    raise exception 'Financial integrity follow-up already installed; run verification instead';
  end if;
end $history_check$;


do $preflight$
begin
  if to_regprocedure('eflow_budget.valid_money(numeric,boolean)') is null
     or to_regclass('public.petty_cash_receipt_items') is null then
    raise exception 'Install financial compatibility 20261015125031 before this correction';
  end if;
  if to_regprocedure('eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)') is not null then
    raise exception 'Financial integrity correction already installed; run verification instead';
  end if;
end $preflight$;

-- Snapshot the effective writers, not a historical source body. This also
-- retains NW guards if NW has already been installed. Only the header changes.
do $snapshots$
declare entry record; definition text;
begin
  for entry in select * from (values
    ('public.post_general_journal_adjustment(uuid,date,text,text,jsonb)', 'post_general_journal_adjustment', 'pre_integrity_journal'),
    ('public.submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)', 'submit_contextual_cash_liquidation', 'pre_integrity_contextual_liquidation'),
    ('public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)', 'submit_accounting_cash_liquidation', 'pre_integrity_accounting_liquidation')
  ) as writers(signature,original_name,snapshot_name) loop
    if to_regprocedure(entry.signature) is null then raise exception 'Required financial writer missing: %',entry.signature;end if;
    definition:=pg_get_functiondef(entry.signature::regprocedure);
    definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||entry.original_name||'(',
      'CREATE OR REPLACE FUNCTION eflow_budget.'||entry.snapshot_name||'(');
    if definition=pg_get_functiondef(entry.signature::regprocedure) then raise exception 'Unexpected financial writer header: %',entry.signature;end if;
    execute definition;
  end loop;
end $snapshots$;

revoke all on function eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb),
  eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid),
  eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)
  from public,anon,authenticated;

create or replace function public.post_general_journal_adjustment(
  p_fiscal_budget_id uuid,p_entry_date date,p_reference_number text,p_memo text,p_lines jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare item jsonb; debit_value numeric; credit_value numeric; debit_total numeric:=0; credit_total numeric:=0; journal_id uuid;
begin
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then
    raise exception 'A journal entry needs at least two lines' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_lines) loop
    debit_value:=coalesce((item->>'debit')::numeric,0);
    credit_value:=coalesce((item->>'credit')::numeric,0);
    if not eflow_budget.valid_money(debit_value,true) or not eflow_budget.valid_money(credit_value,true) then
      raise exception 'Journal amounts must be finite nonnegative amounts with at most two decimal places' using errcode='22023';
    end if;
    if (debit_value>0)=(credit_value>0) then
      raise exception 'Each journal line must contain either a debit or a credit' using errcode='22023';
    end if;
    debit_total:=debit_total+debit_value;credit_total:=credit_total+credit_value;
  end loop;
  if debit_total<=0 or debit_total<>credit_total then
    raise exception 'Journal debits and credits must balance exactly' using errcode='22023';
  end if;
  -- The effective original writer still checks Accounting role/capability,
  -- active accounts and required references, then posts its immutable audit.
  journal_id:=eflow_budget.pre_integrity_journal(p_fiscal_budget_id,p_entry_date,p_reference_number,p_memo,p_lines);
  if (select coalesce(sum(debit-credit),0) from public.general_journal_lines where journal_entry_id=journal_id)<>0 then
    raise exception 'Stored journal debits and credits must balance exactly' using errcode='22023';
  end if;
  return journal_id;
end $$;

-- Compare the fields the legacy writer actually persists. Normalize exactly
-- like that writer; receipt order and unused itemized-only fields are irrelevant
-- here. The itemized API retains its own stricter complete-payload check.
create function eflow_budget.integrity_receipts(p_receipts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb; normalized jsonb:='[]';amount_value numeric;
begin
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' then raise exception 'Receipts must be an array' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_receipts) loop
    amount_value:=(item->>'amount')::numeric;
    if not eflow_budget.valid_money(amount_value,true) then raise exception 'Receipt amounts must use finite nonnegative cents' using errcode='22023';end if;
    normalized:=normalized||jsonb_build_array(jsonb_build_object(
      'vendor',btrim(item->>'vendor'),'receiptNumber',nullif(btrim(item->>'receiptNumber'),''),
      'receiptDate',(item->>'receiptDate')::date,'description',btrim(item->>'description'),
      'amount',amount_value,'fileName',item->>'fileName','filePath',item->>'filePath',
      'mimeType',coalesce(nullif(item->>'mimeType',''),'application/octet-stream'),
      'fileSize',coalesce((item->>'fileSize')::bigint,0),'overrideReason',nullif(btrim(item->>'overrideReason'),'')));
  end loop;
  return (select coalesce(jsonb_agg(value order by value),'[]'::jsonb) from jsonb_array_elements(normalized));
end $$;

create function eflow_budget.integrity_liquidation_retry(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare request public.petty_cash_requests;li public.petty_cash_liquidations;stored_receipts jsonb;
begin
  -- Follow the NW root -> cash request lock order when that integration exists.
  if to_regprocedure('eflow_r7.lock_impact(uuid)') is not null then
    execute 'select eflow_r7.lock_impact($1)' using (select task_id from public.petty_cash_requests where id=p_request_id);
  end if;
  select * into request from public.petty_cash_requests where id=p_request_id for update;
  if request.id is null or auth.uid() is null or (request.requester_id is distinct from auth.uid() and request.cash_recipient_id is distinct from auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('member','head','accounting_staff')) then
    raise exception 'Only the active cash recipient can submit this liquidation' using errcode='42501';
  end if;
  if p_idempotency_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  if not eflow_budget.valid_money(p_declared_spent,true) then raise exception 'Actual spending must use finite nonnegative cents' using errcode='22023';end if;
  select * into li from public.petty_cash_liquidations where request_id=p_request_id and idempotency_key=p_idempotency_key;
  if li.id is null then
    perform eflow_budget.integrity_receipts(p_receipts);
    return null;
  end if;
  if li.submitted_by is distinct from auth.uid() then raise exception 'Only the original submitter can retry this liquidation' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'vendor',r.vendor,'receiptNumber',r.receipt_number,'receiptDate',r.receipt_date,'description',r.description,
    'amount',r.amount,'fileName',r.file_name,'filePath',r.file_path,'mimeType',r.mime_type,'fileSize',r.file_size,'overrideReason',r.override_reason)
    order by jsonb_build_object(
    'vendor',r.vendor,'receiptNumber',r.receipt_number,'receiptDate',r.receipt_date,'description',r.description,
    'amount',r.amount,'fileName',r.file_name,'filePath',r.file_path,'mimeType',r.mime_type,'fileSize',r.file_size,'overrideReason',r.override_reason)),'[]'::jsonb)
    into stored_receipts from public.petty_cash_receipts r where r.liquidation_id=li.id;
  if li.declared_spent is distinct from p_declared_spent or li.note is distinct from btrim(p_note)
    or stored_receipts is distinct from eflow_budget.integrity_receipts(p_receipts) then
    raise exception 'Liquidation key belongs to different submitted amounts, notes or receipts; submit a correction version' using errcode='22023';
  end if;
  return li.id;
end $$;
revoke all on function eflow_budget.integrity_receipts(jsonb),
  eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid) from public,anon,authenticated;

create or replace function public.submit_contextual_cash_liquidation(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid;
begin
  existing_id:=eflow_budget.integrity_liquidation_retry(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
  if existing_id is not null then return existing_id;end if;
  return eflow_budget.pre_integrity_contextual_liquidation(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
end $$;

create or replace function public.submit_accounting_cash_liquidation(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid,
  p_refund_receipt_number text default null,p_refund_date date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid;li public.petty_cash_liquidations;expected_refund text;expected_date date;
begin
  existing_id:=eflow_budget.integrity_liquidation_retry(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
  if existing_id is not null then
    select * into li from public.petty_cash_liquidations where id=existing_id;
    expected_refund:=case when li.returned_amount>0 then nullif(btrim(p_refund_receipt_number),'') end;
    expected_date:=case when li.returned_amount>0 then p_refund_date end;
    if li.refund_receipt_number is distinct from expected_refund or li.refund_date is distinct from expected_date then
      raise exception 'Liquidation key belongs to a different refund reference; submit a correction version' using errcode='22023';
    end if;
    -- Identical historical/itemized/settled retries are reads, never UPDATEs.
    return existing_id;
  end if;
  return eflow_budget.pre_integrity_accounting_liquidation(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key,p_refund_receipt_number,p_refund_date);
end $$;

-- CREATE OR REPLACE keeps each existing public function's OID and ACL. No
-- existing table, historical event, receipt, PCV or policy is rewritten.
-- The legacy non-itemized settlement branch also used `a.code=code`, which
-- PostgreSQL rejects as an ambiguous column/variable reference. Rename only
-- that local variable in the effective trigger body; do not replace its logic.
do $legacy_settlement$
declare definition text;entry record;
begin
  definition:=pg_get_functiondef('public.post_liquidation_general_journal()'::regprocedure);
  for entry in select * from (values
    (';code text;', ';legacy_expense_code text;'),
    (' into code from ', ' into legacy_expense_code from '),
    ('a.code=code;', 'a.code=legacy_expense_code;'),
    ('values(jid,line_no,code,title,', 'values(jid,line_no,legacy_expense_code,title,')
  ) as replacements(before_text,after_text) loop
    if strpos(definition,entry.before_text)=0 then raise exception 'Legacy settlement writer changed; inspect effective definition before installation';end if;
    definition:=replace(definition,entry.before_text,entry.after_text);
  end loop;
  execute definition;
end $legacy_settlement$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)
values('20261015142837','financial_journal_and_refund_integrity',array[$eflow_integrity_source$-- Additive follow-up to 20261015125031. Never rewrite installed history.
-- Preserve existing writer authority, evidence, accounting and NW guards.
begin;

do $preflight$
begin
  if to_regprocedure('eflow_budget.valid_money(numeric,boolean)') is null
     or to_regclass('public.petty_cash_receipt_items') is null then
    raise exception 'Install financial compatibility 20261015125031 before this correction';
  end if;
  if to_regprocedure('eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb)') is not null then
    raise exception 'Financial integrity correction already installed; run verification instead';
  end if;
end $preflight$;

-- Snapshot the effective writers, not a historical source body. This also
-- retains NW guards if NW has already been installed. Only the header changes.
do $snapshots$
declare entry record; definition text;
begin
  for entry in select * from (values
    ('public.post_general_journal_adjustment(uuid,date,text,text,jsonb)', 'post_general_journal_adjustment', 'pre_integrity_journal'),
    ('public.submit_contextual_cash_liquidation(uuid,numeric,text,jsonb,uuid)', 'submit_contextual_cash_liquidation', 'pre_integrity_contextual_liquidation'),
    ('public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)', 'submit_accounting_cash_liquidation', 'pre_integrity_accounting_liquidation')
  ) as writers(signature,original_name,snapshot_name) loop
    if to_regprocedure(entry.signature) is null then raise exception 'Required financial writer missing: %',entry.signature;end if;
    definition:=pg_get_functiondef(entry.signature::regprocedure);
    definition:=replace(definition,'CREATE OR REPLACE FUNCTION public.'||entry.original_name||'(',
      'CREATE OR REPLACE FUNCTION eflow_budget.'||entry.snapshot_name||'(');
    if definition=pg_get_functiondef(entry.signature::regprocedure) then raise exception 'Unexpected financial writer header: %',entry.signature;end if;
    execute definition;
  end loop;
end $snapshots$;

revoke all on function eflow_budget.pre_integrity_journal(uuid,date,text,text,jsonb),
  eflow_budget.pre_integrity_contextual_liquidation(uuid,numeric,text,jsonb,uuid),
  eflow_budget.pre_integrity_accounting_liquidation(uuid,numeric,text,jsonb,uuid,text,date)
  from public,anon,authenticated;

create or replace function public.post_general_journal_adjustment(
  p_fiscal_budget_id uuid,p_entry_date date,p_reference_number text,p_memo text,p_lines jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare item jsonb; debit_value numeric; credit_value numeric; debit_total numeric:=0; credit_total numeric:=0; journal_id uuid;
begin
  if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)<2 then
    raise exception 'A journal entry needs at least two lines' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_lines) loop
    debit_value:=coalesce((item->>'debit')::numeric,0);
    credit_value:=coalesce((item->>'credit')::numeric,0);
    if not eflow_budget.valid_money(debit_value,true) or not eflow_budget.valid_money(credit_value,true) then
      raise exception 'Journal amounts must be finite nonnegative amounts with at most two decimal places' using errcode='22023';
    end if;
    if (debit_value>0)=(credit_value>0) then
      raise exception 'Each journal line must contain either a debit or a credit' using errcode='22023';
    end if;
    debit_total:=debit_total+debit_value;credit_total:=credit_total+credit_value;
  end loop;
  if debit_total<=0 or debit_total<>credit_total then
    raise exception 'Journal debits and credits must balance exactly' using errcode='22023';
  end if;
  -- The effective original writer still checks Accounting role/capability,
  -- active accounts and required references, then posts its immutable audit.
  journal_id:=eflow_budget.pre_integrity_journal(p_fiscal_budget_id,p_entry_date,p_reference_number,p_memo,p_lines);
  if (select coalesce(sum(debit-credit),0) from public.general_journal_lines where journal_entry_id=journal_id)<>0 then
    raise exception 'Stored journal debits and credits must balance exactly' using errcode='22023';
  end if;
  return journal_id;
end $$;

-- Compare the fields the legacy writer actually persists. Normalize exactly
-- like that writer; receipt order and unused itemized-only fields are irrelevant
-- here. The itemized API retains its own stricter complete-payload check.
create function eflow_budget.integrity_receipts(p_receipts jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb; normalized jsonb:='[]';amount_value numeric;
begin
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' then raise exception 'Receipts must be an array' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_receipts) loop
    amount_value:=(item->>'amount')::numeric;
    if not eflow_budget.valid_money(amount_value,true) then raise exception 'Receipt amounts must use finite nonnegative cents' using errcode='22023';end if;
    normalized:=normalized||jsonb_build_array(jsonb_build_object(
      'vendor',btrim(item->>'vendor'),'receiptNumber',nullif(btrim(item->>'receiptNumber'),''),
      'receiptDate',(item->>'receiptDate')::date,'description',btrim(item->>'description'),
      'amount',amount_value,'fileName',item->>'fileName','filePath',item->>'filePath',
      'mimeType',coalesce(nullif(item->>'mimeType',''),'application/octet-stream'),
      'fileSize',coalesce((item->>'fileSize')::bigint,0),'overrideReason',nullif(btrim(item->>'overrideReason'),'')));
  end loop;
  return (select coalesce(jsonb_agg(value order by value),'[]'::jsonb) from jsonb_array_elements(normalized));
end $$;

create function eflow_budget.integrity_liquidation_retry(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare request public.petty_cash_requests;li public.petty_cash_liquidations;stored_receipts jsonb;
begin
  -- Follow the NW root -> cash request lock order when that integration exists.
  if to_regprocedure('eflow_r7.lock_impact(uuid)') is not null then
    execute 'select eflow_r7.lock_impact($1)' using (select task_id from public.petty_cash_requests where id=p_request_id);
  end if;
  select * into request from public.petty_cash_requests where id=p_request_id for update;
  if request.id is null or auth.uid() is null or (request.requester_id is distinct from auth.uid() and request.cash_recipient_id is distinct from auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('member','head','accounting_staff')) then
    raise exception 'Only the active cash recipient can submit this liquidation' using errcode='42501';
  end if;
  if p_idempotency_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  if not eflow_budget.valid_money(p_declared_spent,true) then raise exception 'Actual spending must use finite nonnegative cents' using errcode='22023';end if;
  select * into li from public.petty_cash_liquidations where request_id=p_request_id and idempotency_key=p_idempotency_key;
  if li.id is null then
    perform eflow_budget.integrity_receipts(p_receipts);
    return null;
  end if;
  if li.submitted_by is distinct from auth.uid() then raise exception 'Only the original submitter can retry this liquidation' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'vendor',r.vendor,'receiptNumber',r.receipt_number,'receiptDate',r.receipt_date,'description',r.description,
    'amount',r.amount,'fileName',r.file_name,'filePath',r.file_path,'mimeType',r.mime_type,'fileSize',r.file_size,'overrideReason',r.override_reason)
    order by jsonb_build_object(
    'vendor',r.vendor,'receiptNumber',r.receipt_number,'receiptDate',r.receipt_date,'description',r.description,
    'amount',r.amount,'fileName',r.file_name,'filePath',r.file_path,'mimeType',r.mime_type,'fileSize',r.file_size,'overrideReason',r.override_reason)),'[]'::jsonb)
    into stored_receipts from public.petty_cash_receipts r where r.liquidation_id=li.id;
  if li.declared_spent is distinct from p_declared_spent or li.note is distinct from btrim(p_note)
    or stored_receipts is distinct from eflow_budget.integrity_receipts(p_receipts) then
    raise exception 'Liquidation key belongs to different submitted amounts, notes or receipts; submit a correction version' using errcode='22023';
  end if;
  return li.id;
end $$;
revoke all on function eflow_budget.integrity_receipts(jsonb),
  eflow_budget.integrity_liquidation_retry(uuid,numeric,text,jsonb,uuid) from public,anon,authenticated;

create or replace function public.submit_contextual_cash_liquidation(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid;
begin
  existing_id:=eflow_budget.integrity_liquidation_retry(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
  if existing_id is not null then return existing_id;end if;
  return eflow_budget.pre_integrity_contextual_liquidation(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
end $$;

create or replace function public.submit_accounting_cash_liquidation(
  p_request_id uuid,p_declared_spent numeric,p_note text,p_receipts jsonb,p_idempotency_key uuid,
  p_refund_receipt_number text default null,p_refund_date date default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing_id uuid;li public.petty_cash_liquidations;expected_refund text;expected_date date;
begin
  existing_id:=eflow_budget.integrity_liquidation_retry(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key);
  if existing_id is not null then
    select * into li from public.petty_cash_liquidations where id=existing_id;
    expected_refund:=case when li.returned_amount>0 then nullif(btrim(p_refund_receipt_number),'') end;
    expected_date:=case when li.returned_amount>0 then p_refund_date end;
    if li.refund_receipt_number is distinct from expected_refund or li.refund_date is distinct from expected_date then
      raise exception 'Liquidation key belongs to a different refund reference; submit a correction version' using errcode='22023';
    end if;
    -- Identical historical/itemized/settled retries are reads, never UPDATEs.
    return existing_id;
  end if;
  return eflow_budget.pre_integrity_accounting_liquidation(p_request_id,p_declared_spent,p_note,p_receipts,p_idempotency_key,p_refund_receipt_number,p_refund_date);
end $$;

-- CREATE OR REPLACE keeps each existing public function's OID and ACL. No
-- existing table, historical event, receipt, PCV or policy is rewritten.
-- The legacy non-itemized settlement branch also used `a.code=code`, which
-- PostgreSQL rejects as an ambiguous column/variable reference. Rename only
-- that local variable in the effective trigger body; do not replace its logic.
do $legacy_settlement$
declare definition text;entry record;
begin
  definition:=pg_get_functiondef('public.post_liquidation_general_journal()'::regprocedure);
  for entry in select * from (values
    (';code text;', ';legacy_expense_code text;'),
    (' into code from ', ' into legacy_expense_code from '),
    ('a.code=code;', 'a.code=legacy_expense_code;'),
    ('values(jid,line_no,code,title,', 'values(jid,line_no,legacy_expense_code,title,')
  ) as replacements(before_text,after_text) loop
    if strpos(definition,entry.before_text)=0 then raise exception 'Legacy settlement writer changed; inspect effective definition before installation';end if;
    definition:=replace(definition,entry.before_text,entry.after_text);
  end loop;
  execute definition;
end $legacy_settlement$;
notify pgrst,'reload schema';
commit;
$eflow_integrity_source$]);
commit;
select version,name,'Financial integrity follow-up installed' as result
from supabase_migrations.schema_migrations where version='20261015142837';
