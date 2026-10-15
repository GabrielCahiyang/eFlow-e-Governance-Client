-- eFlow financial compatibility; target ixnfphgjyelhckjwjkdv.
-- Prepared for the user to run in Supabase SQL Editor. No deployment performed.
-- Migration SHA-256: e786df31a639771f86d81e180fa269fa9ea30f0c8e5455e2c9d561a7c3415e4e
-- Run this WHOLE file once, BEFORE the nine NW correction migrations.
-- Financial compatibility package. Install AFTER the reviewed hosted baseline
-- and BEFORE all nine Nested Work corrections. Never run the old petty-cash
-- migration as well. Existing financial events/documents are not rewritten.
begin;
-- SQL Editor installation: exact NEW history entry, in the same transaction.
do $preflight$
declare required_version text;
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Supabase migration history is required';end if;
  if exists(select 1 from supabase_migrations.schema_migrations h where h.version='20261015125031') then raise exception 'Financial package already installed; run verification instead';end if;
  foreach required_version in array array['20261003000004','20261004123126','20261004132527','20261004133412','20261004140128','20261004164937','20261004181549','20261004182806','20261004194130','20261005170822','20261007120000','20261007152648','20261007153615','20261007175525','20261007191654','20261007195837','20261007201249','20261007203525','20261008004900','20261008030659','20261008035748','20261008060756','20261008081855','20261008123723','20261008134347','20261009120000','20261009120100'] loop
    if not exists(select 1 from supabase_migrations.schema_migrations h where h.version=required_version) then raise exception 'Reviewed hosted baseline version missing: %',required_version;end if;
  end loop;
end $preflight$;

set local lock_timeout='10s';

do $$declare signature text;begin
  foreach signature in array array[
    'eflow_budget.get_sections(uuid,integer)','eflow_budget.task_context(uuid,uuid)',
    'public.create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)',
    'public.resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)',
    'public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)',
    'public.audit_cash_request_change()','public.post_liquidation_general_journal()'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Financial prerequisite missing: %',signature;end if;
  end loop;
  if to_regprocedure('eflow_r7.lock_impact(uuid)') is not null then
    raise exception 'Install the financial package before NW corrections; do not replace already patched NW writers';
  end if;
end $$;

alter table public.office_budget_sections add column if not exists journal_account_code text references public.accounting_accounts(code) on delete restrict;
create index if not exists office_budget_sections_journal_account_idx on public.office_budget_sections(journal_account_code);
alter table public.petty_cash_requests add column if not exists pcv_number bigint,
  add column if not exists pcv_date date, add column if not exists funding_lines_payload jsonb;
-- Every pre-install record is historical, including pending requests. Its date
-- and PCV cannot be inferred from a later approval or an unrelated update.
alter table public.petty_cash_requests add column if not exists pcv_legacy boolean not null default true;
alter table public.petty_cash_requests alter column pcv_legacy set default false;
create unique index if not exists petty_cash_pcv_number_idx on public.petty_cash_requests(fiscal_budget_id,pcv_number) where pcv_number is not null;
create table if not exists eflow_budget.pcv_counters(
  fiscal_budget_id uuid primary key references public.department_fiscal_budgets(id),last_number bigint not null check(last_number>=0));
revoke all on table eflow_budget.pcv_counters from public,anon,authenticated;
do $$begin
  if exists(select 1 from public.petty_cash_requests where pcv_number<=0 or pcv_number is not null and pcv_date is null)
     or exists(select 1 from eflow_budget.pcv_counters where last_number<0) then
    raise exception 'Review invalid historical PCV numbers/dates/counters before installation';
  end if;
end $$;
insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,metadata)
select b.id,b.org_id,'financial_override',0,'PCV counter aligned to existing recorded document numbers',auth.uid(),
  jsonb_build_object('operation','pcv_counter_reconciled','previous',c.last_number,'recordedHighWater',recorded.last_number)
from (select fiscal_budget_id,max(pcv_number) as last_number from public.petty_cash_requests where pcv_number is not null group by fiscal_budget_id) recorded
join public.department_fiscal_budgets b on b.id=recorded.fiscal_budget_id left join eflow_budget.pcv_counters c on c.fiscal_budget_id=b.id
where c.last_number is null or c.last_number<recorded.last_number;
insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number)
select fiscal_budget_id,max(pcv_number) from public.petty_cash_requests where pcv_number is not null group by fiscal_budget_id
on conflict(fiscal_budget_id) do update set last_number=greatest(eflow_budget.pcv_counters.last_number,excluded.last_number);

create table if not exists public.petty_cash_request_lines(
  request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  amount numeric(16,2) not null check(amount>0),primary key(request_id,allocation_line_id));
create index if not exists petty_cash_request_lines_source_idx on public.petty_cash_request_lines(allocation_line_id,request_id);
create table if not exists public.petty_cash_receipt_items(
  id uuid primary key default gen_random_uuid(),receipt_id uuid not null references public.petty_cash_receipts(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  quantity numeric(16,3) not null check(quantity>0),unit text not null check(length(btrim(unit))>0),
  particular text not null check(length(btrim(particular))>0),purpose text not null check(length(btrim(purpose))>0),
  amount numeric(16,2) not null check(amount>0),position integer not null default 0,
  account_name text not null,account_label text,created_at timestamptz not null default now());
create index if not exists petty_cash_receipt_items_receipt_idx on public.petty_cash_receipt_items(receipt_id,position);
create index if not exists petty_cash_receipt_items_source_idx on public.petty_cash_receipt_items(allocation_line_id);
alter table public.petty_cash_liquidations add column if not exists itemized_payload jsonb;
create table eflow_budget.cash_commands(
  actor_id uuid not null,idempotency_key uuid not null,request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  payload jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,idempotency_key));
revoke all on table eflow_budget.cash_commands from public,anon,authenticated;
create trigger cash_commands_immutable before update or delete on eflow_budget.cash_commands for each row execute function public.prevent_accounting_record_mutation();

alter table public.petty_cash_request_lines enable row level security;
alter table public.petty_cash_receipt_items enable row level security;
revoke all on table public.petty_cash_request_lines,public.petty_cash_receipt_items from public,anon,authenticated;
grant select on table public.petty_cash_request_lines,public.petty_cash_receipt_items to authenticated;
grant all on table public.petty_cash_request_lines,public.petty_cash_receipt_items to service_role;
drop policy if exists petty_cash_request_lines_read on public.petty_cash_request_lines;
create policy petty_cash_request_lines_read on public.petty_cash_request_lines for select to authenticated using(exists(select 1 from public.petty_cash_requests r where r.id=request_id));
drop policy if exists petty_cash_receipt_items_read on public.petty_cash_receipt_items;
create policy petty_cash_receipt_items_read on public.petty_cash_receipt_items for select to authenticated using(exists(select 1 from public.petty_cash_receipts r where r.id=receipt_id));
drop trigger if exists petty_cash_receipt_items_immutable on public.petty_cash_receipt_items;
create trigger petty_cash_receipt_items_immutable before update or delete on public.petty_cash_receipt_items for each row execute function public.prevent_accounting_record_mutation();
-- Mechanical source reconstruction only. Do not infer PCVs, dates, items,
-- accounts, expenses or replacement audit events for historical requests.
insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select r.id,r.allocation_line_id,r.requested_amount from public.petty_cash_requests r
where r.allocation_line_id is not null and r.requested_amount>0
  and r.funding_lines_payload is null
  and not exists(select 1 from public.petty_cash_request_lines l where l.request_id=r.id);
insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select r.id,(line->>'allocationLineId')::uuid,(line->>'amount')::numeric from public.petty_cash_requests r,
  lateral jsonb_array_elements(r.funding_lines_payload->'lines') line
where r.funding_lines_payload is not null and not exists(select 1 from public.petty_cash_request_lines l where l.request_id=r.id);
do $$begin
  if exists(select 1 from public.petty_cash_requests r where (r.allocation_line_id is not null or r.funding_lines_payload is not null)
    and r.requested_amount is distinct from (select sum(amount) from public.petty_cash_request_lines l where l.request_id=r.id)) then
    raise exception 'Review inconsistent stored funding totals before financial installation; no historical amounts were changed';
  end if;
end $$;

create or replace function eflow_budget.assign_pcv() returns trigger language plpgsql security definer set search_path='' as $$
declare high_water bigint;
begin
  if tg_op='INSERT' then
    if new.pcv_number is not null or new.pcv_date is not null then raise exception 'PCVs are assigned at authorization' using errcode='22023';end if;
    new.pcv_legacy:=false;
  else
    if row(new.pcv_number,new.pcv_date,new.pcv_legacy) is distinct from row(old.pcv_number,old.pcv_date,old.pcv_legacy) then
      raise exception 'A PCV reference and historical classification are immutable' using errcode='22023';
    end if;
    if old.pcv_number is not null and new.fiscal_budget_id is distinct from old.fiscal_budget_id then
      raise exception 'A PCV cannot change fiscal budget' using errcode='22023';
    end if;
    if new.pcv_number is null and not old.pcv_legacy
       and old.status not in ('approved','scheduled_for_release','partially_released','released')
       and new.status in ('approved','scheduled_for_release','partially_released','released') then
      perform 1 from public.department_fiscal_budgets where id=new.fiscal_budget_id for update;
      select coalesce(max(pcv_number),0) into high_water from public.petty_cash_requests where fiscal_budget_id=new.fiscal_budget_id;
      insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number) values(new.fiscal_budget_id,high_water+1)
      on conflict(fiscal_budget_id) do update set last_number=greatest(eflow_budget.pcv_counters.last_number,high_water)+1 returning last_number into new.pcv_number;
      new.pcv_date:=(now() at time zone 'Asia/Manila')::date;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists office_budget_pcv on public.petty_cash_requests;
create trigger office_budget_pcv before insert or update on public.petty_cash_requests for each row execute function eflow_budget.assign_pcv();

create function eflow_budget.valid_money(value numeric,allow_zero boolean default false) returns boolean language sql immutable set search_path='' as $$
  select coalesce(value::text not in ('NaN','Infinity','-Infinity') and value=round(value,2) and value<=99999999999999.99 and (value>0 or allow_zero and value=0),false)
$$;
create function eflow_budget.canonical_cash_lines(value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare line jsonb;source uuid;amount numeric;seen uuid[]:='{}';result jsonb:='[]';
begin
  if value is null or jsonb_typeof(value)<>'array' or jsonb_array_length(value) not between 1 and 100 then
    raise exception 'Choose 1 to 100 valid funding lines' using errcode='22023';end if;
  for line in select * from jsonb_array_elements(value) loop
    source:=(line->>'allocationLineId')::uuid;amount:=(line->>'amount')::numeric;
    if source is null or source=any(seen) or not eflow_budget.valid_money(amount) then
      raise exception 'Choose each source once and positive amounts in cents' using errcode='22023';end if;
    seen:=array_append(seen,source);
    result:=result||jsonb_build_array(jsonb_build_object('allocationLineId',source,'amount',amount));
  end loop;
  return (select jsonb_agg(entry.value order by entry.value->>'allocationLineId') from jsonb_array_elements(result) entry);
end $$;

-- Deterministic largest-remainder apportionment: partial approvals reserve
-- exact cents and the per-source amounts always sum to the approved total.
create function eflow_budget.authorized_cash_lines(p_request uuid) returns table(allocation_line_id uuid,amount numeric)
language sql stable security definer set search_path='' as $$
  with amounts as (
    select l.allocation_line_id,l.amount*coalesce(r.approved_amount,r.requested_amount)/nullif(r.requested_amount,0)*100 as cents,
      coalesce(r.approved_amount,r.requested_amount)*100 as total_cents
    from public.petty_cash_request_lines l join public.petty_cash_requests r on r.id=l.request_id where r.id=p_request
  ),ranked as (
    select *,row_number() over(order by cents-floor(cents) desc,allocation_line_id) as remainder_rank,
      total_cents-sum(floor(cents)) over() as remaining from amounts
  ) select allocation_line_id,(floor(cents)+case when remainder_rank<=remaining then 1 else 0 end)/100 from ranked
$$;
create or replace function eflow_budget.request_line_obligation(p_request uuid,p_line uuid) returns numeric language sql stable set search_path='' as $$
  select case when public.cash_request_obligation(r)=0 then 0
    when r.status='settled' then coalesce((select sum(i.amount) from public.petty_cash_receipt_items i
      join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id
      where li.request_id=r.id and li.status='approved' and i.allocation_line_id=p_line),
      case when r.allocation_line_id=p_line and not exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id where li.request_id=r.id and li.status='approved') then r.actual_spent else 0 end)
    else (select amount from eflow_budget.authorized_cash_lines(r.id) where allocation_line_id=p_line) end
  from public.petty_cash_requests r where r.id=p_request
$$;
create or replace function public.task_budget_line_available(p_allocation_line_id uuid,p_exclude_request_id uuid default null)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare l public.work_budget_allocation_lines;a public.work_budget_allocations;caps numeric;used numeric;
begin
  select * into l from public.work_budget_allocation_lines where id=p_allocation_line_id;
  select * into a from public.work_budget_allocations where id=l.allocation_id and subtask_id is null and status='approved';
  if a.id is null then return 0;end if;
  select coalesce(sum(amount),0) into caps from public.work_budget_allocations where task_id=a.task_id and commitment_id=a.commitment_id and subtask_id is not null and parent_allocation_line_id=l.id and status in ('pending','approved');
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) into used from public.petty_cash_requests r
    join public.work_budget_allocations ca on ca.id=r.allocation_id join public.petty_cash_request_lines rl on rl.request_id=r.id and rl.allocation_line_id=l.id
    where r.id is distinct from p_exclude_request_id and (ca.subtask_id is null or ca.status not in ('pending','approved'));
  return greatest(0,l.amount-caps-used);
end $$;
create or replace function eflow_budget.partition_spent(p_section uuid) returns numeric language sql stable set search_path='' as $$
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) from public.petty_cash_requests r
  join public.petty_cash_request_lines rl on rl.request_id=r.id join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
  where r.status='settled' and l.budget_partition_id=p_section
$$;

create or replace function eflow_budget.sync_single_cash_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.petty_cash_request_lines where request_id=new.id;
  if new.funding_lines_payload is not null then
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
      select new.id,(line->>'allocationLineId')::uuid,(line->>'amount')::numeric from jsonb_array_elements(new.funding_lines_payload->'lines') line;
  elsif new.allocation_line_id is not null and new.requested_amount>0 then
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount) values(new.id,new.allocation_line_id,new.requested_amount);
  end if;
  return new;
end $$;
drop trigger if exists petty_cash_single_line on public.petty_cash_requests;
create trigger petty_cash_single_line after insert or update of requested_amount,allocation_line_id,funding_lines_payload on public.petty_cash_requests for each row execute function eflow_budget.sync_single_cash_line();
create function eflow_budget.guard_cash_line_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if row(new.request_id,new.allocation_line_id) is distinct from row(old.request_id,old.allocation_line_id) then
    raise exception 'Funding line identities are immutable; correct the request through its funding lines' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_line_identity before update on public.petty_cash_request_lines for each row execute function eflow_budget.guard_cash_line_identity();
create function eflow_budget.check_cash_line_total() returns trigger language plpgsql security definer set search_path='' as $$
declare request uuid;r public.petty_cash_requests;total numeric;
begin
  if tg_table_name='petty_cash_requests' then request:=new.id;
  elsif tg_op='DELETE' then request:=old.request_id;else request:=new.request_id;end if;
  select * into r from public.petty_cash_requests where id=request;
  if r.id is null then return null;end if;
  if r.allocation_line_id is null and r.funding_lines_payload is null then return null;end if;
  select sum(amount) into total from public.petty_cash_request_lines where request_id=request;
  if total is distinct from r.requested_amount then raise exception 'Funding lines must equal the final cash request amount' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_request_lines rl join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
    join public.work_budget_allocations a on a.id=l.allocation_id where rl.request_id=r.id and (a.task_id is distinct from r.task_id or a.subtask_id is not null or a.commitment_id is distinct from r.commitment_id)) then
    raise exception 'Request funding lines must belong to its authorized task funding' using errcode='22023';end if;
  if r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from
    (select jsonb_agg(jsonb_build_object('allocationLineId',allocation_line_id,'amount',amount) order by allocation_line_id) from public.petty_cash_request_lines where request_id=r.id) then
    raise exception 'Funding breakdown does not match the request payload' using errcode='22023';end if;
  return null;
end $$;
create constraint trigger financial_request_total after insert or update on public.petty_cash_requests deferrable initially deferred for each row execute function eflow_budget.check_cash_line_total();
create constraint trigger financial_line_total after insert or update or delete on public.petty_cash_request_lines deferrable initially deferred for each row execute function eflow_budget.check_cash_line_total();

create or replace function public.audit_cash_request_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();actor_role_value text;
begin
  select role::text into actor_role_value from public.profiles where id=actor;
  if tg_op='INSERT' then
    insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,new_state,reason,correlation_key,metadata)
    values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'cash_request_created',new.requested_amount,'Cash requested and temporarily reserved',actor,actor_role_value,new.status,new.purpose,new.idempotency_key,
      jsonb_build_object('neededBy',new.needed_by,'reservationExpiresAt',new.reservation_expires_at,'fundingLines',new.funding_lines_payload->'lines'));
  else
    if new.status is distinct from old.status then
      insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,previous_state,new_state,reason,metadata)
      values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'cash_request_state_changed',case when new.status='settled' then coalesce(new.actual_spent,0) else coalesce(new.approved_amount,new.requested_amount) end,
        'Cash request state changed',actor,actor_role_value,old.status,new.status,coalesce(new.department_decision_reason,new.leader_decision_reason,new.approval_reason),
        jsonb_build_object('returnedAmount',new.returned_amount,'releasedAmount',new.released_amount,'fundingLines',new.funding_lines_payload->'lines'));
    end if;
    if row(new.requested_amount,new.allocation_line_id,new.funding_lines_payload,new.purpose,new.needed_by) is distinct from row(old.requested_amount,old.allocation_line_id,old.funding_lines_payload,old.purpose,old.needed_by) then
      insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,previous_state,new_state,reason,metadata)
      values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'financial_override',new.requested_amount,'Cash request corrected and resubmitted',actor,actor_role_value,old.status,new.status,new.purpose,
        jsonb_build_object('operation','cash_request_corrected','before',jsonb_build_object('amount',old.requested_amount,'purpose',old.purpose,'neededBy',old.needed_by,'funding',old.funding_lines_payload,'allocationLineId',old.allocation_line_id),'after',jsonb_build_object('amount',new.requested_amount,'purpose',new.purpose,'neededBy',new.needed_by,'funding',new.funding_lines_payload,'allocationLineId',new.allocation_line_id)));
    end if;
  end if;
  return new;
end $$;

create or replace function eflow_budget.cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();t public.tasks;a public.work_budget_allocations;b public.department_fiscal_budgets;c public.budget_commitments;
  cap public.work_budget_allocations;r public.petty_cash_requests;command eflow_budget.cash_commands;
  lines jsonb;line jsonb;payload jsonb;total numeric;source uuid;first_source uuid;created uuid;leader uuid;next_status text;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;
  if p_key is null or nullif(btrim(p_purpose),'') is null then raise exception 'Enter a purchase purpose and request key' using errcode='22023';end if;
  lines:=eflow_budget.canonical_cash_lines(p_lines);
  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(lines);
  if not eflow_budget.valid_money(total) then raise exception 'Invalid final request total' using errcode='22023';end if;
  select * into t from public.tasks where id=p_task and deleted_at is null;
  leader:=coalesce(t.assigned_to,t.recommendation_lead_id);
  if t.id is null or leader is null then raise exception 'Funded task and Task Leader required' using errcode='22023';end if;
  if p_subtask is null then
    if caller<>leader then raise exception 'Only the Task Leader can submit a task-level request' using errcode='42501';end if;
  elsif not exists(select 1 from public.subtasks where id=p_subtask and task_id=p_task and (caller=leader or caller=any(coalesce(assigned_to_ids,'{}'::uuid[])))) then
    raise exception 'Only the Task Leader or an assigned contributor can request cash for this subtask' using errcode='42501';
  end if;
  payload:=jsonb_build_object('task',p_task,'subtask',p_subtask,'lines',lines,'purpose',btrim(p_purpose),'neededBy',p_needed_by,'existing',p_existing);
  -- Same-key calls serialize before checking the persisted command receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eflow:cash-command:'||caller::text||':'||p_key::text,0));
  select * into command from eflow_budget.cash_commands where actor_id=caller and idempotency_key=p_key;
  if command.request_id is not null then
    if command.payload is distinct from payload then raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;
    return command.request_id;
  end if;
  if p_existing is null then
    select * into r from public.petty_cash_requests where requester_id=caller and idempotency_key=p_key;
    if r.id is not null then
      if r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.requested_amount<>total or r.purpose<>btrim(p_purpose) or r.needed_by is distinct from p_needed_by
        or (r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from lines)
        or (r.funding_lines_payload is null and (jsonb_array_length(lines)<>1 or r.allocation_line_id is distinct from (lines->0->>'allocationLineId')::uuid)) then
        raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;
      return r.id;
    end if;
  end if;
  if p_needed_by<(now() at time zone 'Asia/Manila')::date then raise exception 'Needed-by date cannot be earlier than today' using errcode='22023';end if;
  -- Shared lock order with the installed single-source writer: allocation,
  -- then fiscal authority, then request. NW adds its root lock at entry.
  select * into a from public.work_budget_allocations where task_id=p_task and subtask_id is null and status='approved' for update;
  if a.id is null then raise exception 'Work has no approved funding' using errcode='22023';end if;
  select * into c from public.budget_commitments where id=a.commitment_id and status='active';
  select * into b from public.department_fiscal_budgets where id=c.fiscal_budget_id and status='locked' for update;
  if b.id is null then raise exception 'The annual department budget is no longer open' using errcode='22023';end if;
  if p_existing is not null then
    select * into r from public.petty_cash_requests where id=p_existing for update;
    if r.id is null or r.requester_id<>caller or r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.commitment_id is distinct from c.id then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
    if r.status not in ('leader_changes_requested','department_changes_requested') then raise exception 'This request is not awaiting corrections' using errcode='22023';end if;
  end if;
  if p_subtask is not null then select * into cap from public.work_budget_allocations where task_id=p_task and subtask_id=p_subtask and status='approved' for update;end if;
  for line in select value from jsonb_array_elements(lines) loop
    source:=(line->>'allocationLineId')::uuid;
    if not exists(select 1 from public.work_budget_allocation_lines where id=source and allocation_id=a.id) then raise exception 'Source belongs to different work' using errcode='42501';end if;
    if cap.id is not null then
      if source is distinct from cap.parent_allocation_line_id or (line->>'amount')::numeric>public.subtask_cap_available(cap.id,p_existing) then raise exception 'Request exceeds its protected subtask source cap' using errcode='22023';end if;
    elsif (line->>'amount')::numeric>public.task_budget_line_available(source,p_existing) then raise exception 'Funding line has insufficient requestable balance' using errcode='22023';end if;
  end loop;
  first_source:=(lines->0->>'allocationLineId')::uuid;
  next_status:=case when caller=leader then 'pending_department_approval' else 'pending_leader_review' end;
  if p_existing is null then
    insert into public.petty_cash_requests(fiscal_budget_id,commitment_id,allocation_id,allocation_line_id,org_id,task_id,subtask_id,requester_id,task_leader_id,cash_recipient_id,purpose,requested_amount,needed_by,status,reservation_expires_at,idempotency_key,funding_lines_payload)
    values(b.id,c.id,coalesce(cap.id,a.id),first_source,b.org_id,t.id,p_subtask,caller,leader,caller,btrim(p_purpose),total,p_needed_by,next_status,now()+interval '7 days',p_key,payload) returning id into created;
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,financial_record_id,financial_record_type)
      select recipient,case when next_status='pending_leader_review' then 'petty_cash_leader_review' else 'petty_cash_department_approval' end,
        case when next_status='pending_leader_review' then 'Cash request needs your endorsement' else 'Cash request needs fiscal authorization' end,
        coalesce(profile.full_name,'A contributor')||' requested '||to_char(total,'FM999G999G999G990D00')||' for '||btrim(p_purpose)||' in "'||t.title||'".',
        t.id,t.title,caller,coalesce(profile.full_name,''),created,'petty_cash_request'
      from (select leader as recipient where next_status='pending_leader_review' union all select public.organization_approver_ids(b.org_id) where next_status='pending_department_approval') recipients
      left join public.profiles profile on profile.id=caller where recipient<>caller;
  else
    created:=r.id;
    update public.petty_cash_requests set allocation_line_id=first_source,allocation_id=coalesce(cap.id,a.id),requested_amount=total,funding_lines_payload=payload,purpose=btrim(p_purpose),needed_by=p_needed_by,
      status=next_status,approved_amount=null,approved_by=null,approval_reason=null,decided_at=null,leader_decided_by=null,leader_decision_reason=null,leader_decided_at=null,
      department_decision_reason=null,reservation_expires_at=now()+interval '7 days',updated_at=now() where id=created;
  end if;
  insert into eflow_budget.cash_commands(actor_id,idempotency_key,request_id,payload) values(caller,p_key,created,payload);
  return created;
end $$;
create or replace function public.create_contextual_cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.cash_request_v2(p_task,p_subtask,p_lines,p_purpose,p_needed_by,p_key,p_existing)$$;
create or replace function public.create_contextual_cash_request(p_task_id uuid,p_subtask_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  return eflow_budget.cash_request_v2(p_task_id,p_subtask_id,jsonb_build_array(jsonb_build_object('allocationLineId',p_allocation_line_id,'amount',p_amount)),p_purpose,p_needed_by,p_idempotency_key,null);
end
$$;
create or replace function eflow_budget.legacy_resubmit_cash(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;key uuid;
begin
  select * into r from public.petty_cash_requests where id=p_request_id;
  if auth.uid() is null or r.id is null or r.requester_id<>auth.uid() then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;
  if (select count(*) from public.petty_cash_request_lines where request_id=r.id)>1 then raise exception 'Correct this multi-account request through its funding lines' using errcode='22023';end if;
  if r.status in ('pending_leader_review','pending_department_approval') and row(r.allocation_line_id,r.requested_amount,r.purpose,r.needed_by) is not distinct from row(p_allocation_line_id,p_amount,btrim(p_purpose),p_needed_by) then return;end if;
  key:=md5('legacy-correction:'||r.id::text||':'||coalesce(r.updated_at::text,'initial')||':'||jsonb_build_array(p_allocation_line_id,p_amount,p_purpose,p_needed_by)::text)::uuid;
  perform eflow_budget.cash_request_v2(r.task_id,r.subtask_id,jsonb_build_array(jsonb_build_object('allocationLineId',p_allocation_line_id,'amount',p_amount)),p_purpose,p_needed_by,key,r.id);
end $$;
create or replace function public.resubmit_contextual_cash_request(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$begin
  perform eflow_budget.legacy_resubmit_cash(p_request_id,p_allocation_line_id,p_amount,p_purpose,p_needed_by);
end $$;

create function eflow_budget.guard_cash_correction() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if row(new.requested_amount,new.allocation_line_id,new.funding_lines_payload,new.purpose,new.needed_by) is distinct from row(old.requested_amount,old.allocation_line_id,old.funding_lines_payload,old.purpose,old.needed_by)
    and (auth.uid() is null or auth.uid() is distinct from old.requester_id or old.status not in ('leader_changes_requested','department_changes_requested') or new.status not in ('pending_leader_review','pending_department_approval')) then
    raise exception 'Only an authorized requester correction can change cash request details' using errcode='42501';
  end if;
  return new;
end $$;
create trigger financial_cash_correction before update on public.petty_cash_requests for each row execute function eflow_budget.guard_cash_correction();

create or replace function eflow_budget.map_account(p_section uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare s public.office_budget_sections;b public.department_fiscal_budgets;previous text;
begin
  select * into s from public.office_budget_sections where id=p_section;
  select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id for update;
  if s.id is null or not public.can_manage_department_accounting(b.org_id,auth.uid()) then raise exception 'Accounting access denied' using errcode='42501';end if;
  if b.status='closed' then raise exception 'Fiscal year is closed' using errcode='22023';end if;
  if not exists(select 1 from public.accounting_accounts where code=p_code and is_active and classification='expense') then raise exception 'Choose an active expense account from the journal catalog' using errcode='22023';end if;
  previous:=s.journal_account_code;
  if previous is not distinct from p_code then return;end if;
  update public.office_budget_sections set journal_account_code=p_code where id=s.id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,before_data,after_data)
  values(auth.uid(),'budget_account',s.id::text,'budget.account_mapped',b.org_id,jsonb_build_object('journalCode',previous),jsonb_build_object('journalCode',p_code));
end $$;
create or replace function public.map_office_budget_account(p_section uuid,p_code text) returns void language sql security invoker set search_path='' as $$select eflow_budget.map_account(p_section,p_code)$$;

create or replace function eflow_budget.submit_items(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text,p_refund_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;li public.petty_cash_liquidations;rc jsonb;item jsonb;receipt_id uuid;source public.work_budget_allocation_lines;
  s public.office_budget_sections;total numeric;receipt_total numeric:=0;item_total numeric;pos integer;amt numeric;quantity numeric;payload jsonb;paths text[]:='{}';authorized record;
begin
  select * into r from public.petty_cash_requests where id=p_request for update;
  if r.id is null or auth.uid() is null or (r.requester_id<>auth.uid() and r.cash_recipient_id<>auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Only the active cash recipient can submit purchased items' using errcode='42501';end if;
  if p_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  payload:=jsonb_build_object('spent',p_spent,'note',p_note,'receipts',p_receipts,'refundNumber',p_refund_number,'refundDate',p_refund_date);
  select * into li from public.petty_cash_liquidations where request_id=r.id and idempotency_key=p_key;
  if li.id is not null then
    if li.itemized_payload is distinct from payload then raise exception 'Liquidation key belongs to different receipt items' using errcode='22023';end if;return li.id;
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts) not between 1 and 100 or not eflow_budget.valid_money(p_spent,true) then raise exception 'Use a valid itemized receipt package' using errcode='22023';end if;
  for rc in select value from jsonb_array_elements(p_receipts) loop
    if not eflow_budget.valid_money((rc->>'amount')::numeric,true) or nullif(btrim(rc->>'filePath'),'') is null or (rc->>'filePath')=any(paths)
       or rc->'items' is null or jsonb_typeof(rc->'items')<>'array' or jsonb_array_length(rc->'items')>100 then raise exception 'Each receipt needs one unique evidence path and valid purchased items' using errcode='22023';end if;
    if left(rc->>'filePath',length(r.org_id::text||'/'||r.id::text||'/'))<>r.org_id::text||'/'||r.id::text||'/'
      or not exists(select 1 from storage.objects o where o.bucket_id='budget-receipts' and o.name=rc->>'filePath' and o.owner_id=auth.uid()::text) then
      raise exception 'Receipt evidence must be an uploaded file owned by this recipient in this cash request' using errcode='42501';end if;
    paths:=array_append(paths,rc->>'filePath');total:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      amt:=(item->>'amount')::numeric;quantity:=(item->>'quantity')::numeric;
      if not eflow_budget.valid_money(amt) or quantity is null or quantity::text in ('NaN','Infinity','-Infinity') or quantity<=0 or quantity<>round(quantity,3)
        or nullif(btrim(item->>'unit'),'') is null or nullif(btrim(item->>'particular'),'') is null or nullif(btrim(item->>'purpose'),'') is null then raise exception 'Each item needs quantity, unit, particulars, purpose and a positive line amount' using errcode='22023';end if;
      if not exists(select 1 from public.petty_cash_request_lines where request_id=r.id and allocation_line_id=(item->>'allocationLineId')::uuid) then raise exception 'Purchased item uses an unauthorized funding account' using errcode='42501';end if;
      total:=total+amt;
    end loop;
    if total is distinct from (rc->>'amount')::numeric then raise exception 'Item totals must equal each receipt total' using errcode='22023';end if;
    receipt_total:=receipt_total+total;
  end loop;
  if receipt_total is distinct from p_spent then raise exception 'Receipt totals must equal declared spending exactly' using errcode='22023';end if;
  for authorized in select * from eflow_budget.authorized_cash_lines(r.id) loop
    select coalesce(sum((it.value->>'amount')::numeric),0) into item_total from jsonb_array_elements(p_receipts) rc,
      lateral jsonb_array_elements(rc.value->'items') it where (it.value->>'allocationLineId')::uuid=authorized.allocation_line_id;
    if item_total>authorized.amount then raise exception 'Spending exceeds this account authorization; obtain reauthorization first' using errcode='22023';end if;
  end loop;
  -- The established command preserves release acknowledgment, receipt limits,
  -- refund, evidence guards, reviewer routing and immutable receipt history.
  li.id:=public.submit_accounting_cash_liquidation(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date);
  for rc in select value from jsonb_array_elements(p_receipts) loop
    select id into strict receipt_id from public.petty_cash_receipts where liquidation_id=li.id and file_path=rc->>'filePath';
    pos:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      select * into source from public.work_budget_allocation_lines where id=(item->>'allocationLineId')::uuid;
      select * into s from public.office_budget_sections where id=source.budget_partition_id;
      insert into public.petty_cash_receipt_items(receipt_id,allocation_line_id,quantity,unit,particular,purpose,amount,position,account_name,account_label)
      values(receipt_id,source.id,(item->>'quantity')::numeric,btrim(item->>'unit'),btrim(item->>'particular'),btrim(item->>'purpose'),(item->>'amount')::numeric,pos,coalesce(s.name,source.category),s.account_code);
      pos:=pos+1;
    end loop;
  end loop;
  update public.petty_cash_liquidations set itemized_payload=payload where id=li.id;
  return li.id;
end $$;
create or replace function public.submit_itemized_cash_liquidation(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text default null,p_refund_date date default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.submit_items(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date)$$;

create function eflow_budget.guard_itemized_liquidation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (old.itemized_payload is not null or old.status='approved') and
    row(new.request_id,new.version,new.declared_spent,new.returned_amount,new.note,new.submitted_by,new.idempotency_key,new.itemized_payload,new.refund_receipt_number,new.refund_date)
      is distinct from row(old.request_id,old.version,old.declared_spent,old.returned_amount,old.note,old.submitted_by,old.idempotency_key,old.itemized_payload,old.refund_receipt_number,old.refund_date) then
    raise exception 'Submitted liquidation amounts, item evidence and refund references are immutable; submit a correction version' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_liquidation_immutable before update on public.petty_cash_liquidations for each row execute function eflow_budget.guard_itemized_liquidation();
create function eflow_budget.guard_receipt_item_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare li public.petty_cash_liquidations;
begin
  select l.* into li from public.petty_cash_liquidations l join public.petty_cash_receipts r on r.liquidation_id=l.id where r.id=new.receipt_id;
  if li.id is null or li.itemized_payload is not null or li.status='approved' then
    raise exception 'Submitted receipt items are immutable; submit a correction version' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_item_insert before insert on public.petty_cash_receipt_items for each row execute function eflow_budget.guard_receipt_item_insert();

-- A multi-account request cannot escape the per-account settlement checks by
-- calling the older, non-itemized API. Deferred validation permits the existing
-- receipt command and item rows to be persisted in the same transaction.
create function eflow_budget.check_itemized_liquidation() returns trigger language plpgsql security definer set search_path='' as $$
declare li public.petty_cash_liquidations;rid uuid;total numeric;
begin
  if tg_table_name='petty_cash_liquidations' then rid:=new.id;
  else select liquidation_id into rid from public.petty_cash_receipts where id=new.receipt_id;end if;
  select * into li from public.petty_cash_liquidations where id=rid;
  if li.id is null then return null;end if;
  if li.itemized_payload is null then
    if li.declared_spent>0 and (select count(*) from public.petty_cash_request_lines where request_id=li.request_id)>1 then raise exception 'Use itemized liquidation for multi-account cash requests' using errcode='22023';end if;
    return null;
  end if;
  select coalesce(sum(i.amount),0) into total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=li.id;
  if total is distinct from li.declared_spent then raise exception 'Purchased item totals must equal declared spending exactly' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_receipts rc left join public.petty_cash_receipt_items i on i.receipt_id=rc.id where rc.liquidation_id=li.id group by rc.id,rc.amount having coalesce(sum(i.amount),0)<>rc.amount) then
    raise exception 'Purchased item totals must equal every receipt' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
    left join eflow_budget.authorized_cash_lines(li.request_id) a on a.allocation_line_id=i.allocation_line_id
    where rc.liquidation_id=li.id group by i.allocation_line_id,a.amount having a.amount is null or sum(i.amount)>a.amount) then
    raise exception 'Purchased items exceed their authorized funding source' using errcode='22023';end if;
  return null;
end $$;
create constraint trigger financial_itemized_total after insert or update on public.petty_cash_liquidations deferrable initially deferred for each row execute function eflow_budget.check_itemized_liquidation();
create constraint trigger financial_item_row_total after insert on public.petty_cash_receipt_items deferrable initially deferred for each row execute function eflow_budget.check_itemized_liquidation();

create or replace function public.post_liquidation_general_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;settings public.department_accounting_settings;jid uuid;line_no integer:=1;expense record;code text;title text;items_total numeric;
begin
  if new.status<>'approved' or old.status='approved' then return new;end if;
  select * into r from public.petty_cash_requests where id=new.request_id;
  select * into settings from public.department_accounting_settings where fiscal_budget_id=r.fiscal_budget_id;
  if exists(select 1 from public.general_journal_entries where source_type='liquidation' and source_id=new.id) then return new;end if;
  select sum(i.amount) into items_total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=new.id;
  if new.itemized_payload is not null and coalesce(items_total,0) is distinct from new.declared_spent then raise exception 'Purchased item totals do not match declared spending' using errcode='22023';end if;
  insert into public.general_journal_entries(fiscal_budget_id,org_id,entry_date,reference_number,source_type,source_id,memo,posted_by)
  values(r.fiscal_budget_id,r.org_id,coalesce(new.decided_at::date,current_date),new.liquidation_number,'liquidation',new.id,'Settlement for '||r.purpose,coalesce(new.decided_by,auth.uid())) returning id into jid;
  if items_total is not null then
    for expense in select coalesce(s.journal_account_code,m.account_code) as account_code,sum(i.amount) as amount
      from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
      join public.work_budget_allocation_lines l on l.id=i.allocation_line_id
      left join public.office_budget_sections s on s.id=l.budget_partition_id left join public.department_budget_account_mappings m on m.allocation_line_id=l.id
      where rc.liquidation_id=new.id group by coalesce(s.journal_account_code,m.account_code) order by account_code loop
      title:=null;
      select a.title into title from public.accounting_accounts a where a.code=expense.account_code and a.classification='expense' and a.is_active;
      if title is null then raise exception 'Map every purchased-item source to an active journal expense account before settlement' using errcode='22023';end if;
      insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,expense.account_code,title,expense.amount,0);line_no:=line_no+1;
    end loop;
  elsif new.declared_spent>0 then
    select coalesce(m.account_code,settings.default_expense_account_code) into code from (select 1) seed left join public.department_budget_account_mappings m on m.allocation_line_id=r.allocation_line_id;
    select a.title into title from public.accounting_accounts a where a.code=code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,code,title,new.declared_spent,0);line_no:=line_no+1;
  end if;
  if new.returned_amount>0 then
    select a.title into title from public.accounting_accounts a where a.code=settings.cash_account_code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.cash_account_code,title,new.returned_amount,0);line_no:=line_no+1;
  end if;
  select a.title into title from public.accounting_accounts a where a.code=settings.advance_account_code;
  insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.advance_account_code,title,0,new.declared_spent+new.returned_amount);
  return new;
end $$;

-- Preserve installed source queries rather than replacing their access logic.
do $$declare definition text;begin
  if to_regprocedure('eflow_budget.pre_financial_get_sections(uuid,integer)') is null then
    definition:=pg_get_functiondef('eflow_budget.get_sections(uuid,integer)'::regprocedure);
    execute replace(definition,'FUNCTION eflow_budget.get_sections(','FUNCTION eflow_budget.pre_financial_get_sections(');
    definition:=pg_get_functiondef('eflow_budget.task_context(uuid,uuid)'::regprocedure);
    execute replace(definition,'FUNCTION eflow_budget.task_context(','FUNCTION eflow_budget.pre_financial_task_context(');
  end if;
end $$;
create or replace function eflow_budget.get_sections(p_org_id uuid,p_fiscal_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;
begin
  result:=eflow_budget.pre_financial_get_sections(p_org_id,p_fiscal_year);
  select coalesce(jsonb_agg(section||jsonb_build_object('journalAccountCode',s.journal_account_code) order by position), '[]'::jsonb) into rows
    from jsonb_array_elements(result->'sections') with ordinality sections(section,position)
    left join public.office_budget_sections s on s.id=(section->>'id')::uuid;
  return result||jsonb_build_object('sections',rows,'itemizedCashAvailable',true);
end $$;
create or replace function eflow_budget.task_context(p_task_id uuid,p_subtask_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select eflow_budget.pre_financial_task_context(p_task_id,p_subtask_id)||jsonb_build_object('supportsItemizedCash',true)
$$;

-- Deliberately narrow privileges: no schema-wide function revocations.
revoke all on function eflow_budget.assign_pcv(),eflow_budget.valid_money(numeric,boolean),eflow_budget.canonical_cash_lines(jsonb),
  eflow_budget.authorized_cash_lines(uuid),eflow_budget.request_line_obligation(uuid,uuid),eflow_budget.sync_single_cash_line(),
  eflow_budget.check_cash_line_total(),eflow_budget.guard_cash_correction(),eflow_budget.check_itemized_liquidation(),eflow_budget.guard_itemized_liquidation(),eflow_budget.guard_cash_line_identity(),eflow_budget.guard_receipt_item_insert(),
  eflow_budget.pre_financial_get_sections(uuid,integer),eflow_budget.pre_financial_task_context(uuid,uuid),
  eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date) from public,anon,authenticated;
revoke all on function eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date),
  public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) from public,anon;
grant execute on function eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date),
  public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) to authenticated,service_role;
-- CREATE OR REPLACE preserves grants of every pre-existing public function.
-- Trigger functions are never public APIs, including their replaced bodies.
revoke all on function public.audit_cash_request_change(),public.post_liquidation_general_journal() from public,anon,authenticated;
do $$declare rel text;begin
  foreach rel in array array['petty_cash_request_lines','petty_cash_receipt_items'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=rel) then
      execute format('alter publication supabase_realtime add table public.%I',rel);
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';

-- Record only this new version. Do not claim the old financial file ran.
insert into supabase_migrations.schema_migrations(version,name,statements)
values('20261015125031','financial_cash_compatibility',array[$eflow_financial_source$-- Financial compatibility package. Install AFTER the reviewed hosted baseline
-- and BEFORE all nine Nested Work corrections. Never run the old petty-cash
-- migration as well. Existing financial events/documents are not rewritten.
begin;
set local lock_timeout='10s';

do $$declare signature text;begin
  foreach signature in array array[
    'eflow_budget.get_sections(uuid,integer)','eflow_budget.task_context(uuid,uuid)',
    'public.create_contextual_cash_request(uuid,uuid,uuid,numeric,text,date,uuid)',
    'public.resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)',
    'public.submit_accounting_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date)',
    'public.audit_cash_request_change()','public.post_liquidation_general_journal()'
  ] loop
    if to_regprocedure(signature) is null then raise exception 'Financial prerequisite missing: %',signature;end if;
  end loop;
  if to_regprocedure('eflow_r7.lock_impact(uuid)') is not null then
    raise exception 'Install the financial package before NW corrections; do not replace already patched NW writers';
  end if;
end $$;

alter table public.office_budget_sections add column if not exists journal_account_code text references public.accounting_accounts(code) on delete restrict;
create index if not exists office_budget_sections_journal_account_idx on public.office_budget_sections(journal_account_code);
alter table public.petty_cash_requests add column if not exists pcv_number bigint,
  add column if not exists pcv_date date, add column if not exists funding_lines_payload jsonb;
-- Every pre-install record is historical, including pending requests. Its date
-- and PCV cannot be inferred from a later approval or an unrelated update.
alter table public.petty_cash_requests add column if not exists pcv_legacy boolean not null default true;
alter table public.petty_cash_requests alter column pcv_legacy set default false;
create unique index if not exists petty_cash_pcv_number_idx on public.petty_cash_requests(fiscal_budget_id,pcv_number) where pcv_number is not null;
create table if not exists eflow_budget.pcv_counters(
  fiscal_budget_id uuid primary key references public.department_fiscal_budgets(id),last_number bigint not null check(last_number>=0));
revoke all on table eflow_budget.pcv_counters from public,anon,authenticated;
do $$begin
  if exists(select 1 from public.petty_cash_requests where pcv_number<=0 or pcv_number is not null and pcv_date is null)
     or exists(select 1 from eflow_budget.pcv_counters where last_number<0) then
    raise exception 'Review invalid historical PCV numbers/dates/counters before installation';
  end if;
end $$;
insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,metadata)
select b.id,b.org_id,'financial_override',0,'PCV counter aligned to existing recorded document numbers',auth.uid(),
  jsonb_build_object('operation','pcv_counter_reconciled','previous',c.last_number,'recordedHighWater',recorded.last_number)
from (select fiscal_budget_id,max(pcv_number) as last_number from public.petty_cash_requests where pcv_number is not null group by fiscal_budget_id) recorded
join public.department_fiscal_budgets b on b.id=recorded.fiscal_budget_id left join eflow_budget.pcv_counters c on c.fiscal_budget_id=b.id
where c.last_number is null or c.last_number<recorded.last_number;
insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number)
select fiscal_budget_id,max(pcv_number) from public.petty_cash_requests where pcv_number is not null group by fiscal_budget_id
on conflict(fiscal_budget_id) do update set last_number=greatest(eflow_budget.pcv_counters.last_number,excluded.last_number);

create table if not exists public.petty_cash_request_lines(
  request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  amount numeric(16,2) not null check(amount>0),primary key(request_id,allocation_line_id));
create index if not exists petty_cash_request_lines_source_idx on public.petty_cash_request_lines(allocation_line_id,request_id);
create table if not exists public.petty_cash_receipt_items(
  id uuid primary key default gen_random_uuid(),receipt_id uuid not null references public.petty_cash_receipts(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  quantity numeric(16,3) not null check(quantity>0),unit text not null check(length(btrim(unit))>0),
  particular text not null check(length(btrim(particular))>0),purpose text not null check(length(btrim(purpose))>0),
  amount numeric(16,2) not null check(amount>0),position integer not null default 0,
  account_name text not null,account_label text,created_at timestamptz not null default now());
create index if not exists petty_cash_receipt_items_receipt_idx on public.petty_cash_receipt_items(receipt_id,position);
create index if not exists petty_cash_receipt_items_source_idx on public.petty_cash_receipt_items(allocation_line_id);
alter table public.petty_cash_liquidations add column if not exists itemized_payload jsonb;
create table eflow_budget.cash_commands(
  actor_id uuid not null,idempotency_key uuid not null,request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  payload jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,idempotency_key));
revoke all on table eflow_budget.cash_commands from public,anon,authenticated;
create trigger cash_commands_immutable before update or delete on eflow_budget.cash_commands for each row execute function public.prevent_accounting_record_mutation();

alter table public.petty_cash_request_lines enable row level security;
alter table public.petty_cash_receipt_items enable row level security;
revoke all on table public.petty_cash_request_lines,public.petty_cash_receipt_items from public,anon,authenticated;
grant select on table public.petty_cash_request_lines,public.petty_cash_receipt_items to authenticated;
grant all on table public.petty_cash_request_lines,public.petty_cash_receipt_items to service_role;
drop policy if exists petty_cash_request_lines_read on public.petty_cash_request_lines;
create policy petty_cash_request_lines_read on public.petty_cash_request_lines for select to authenticated using(exists(select 1 from public.petty_cash_requests r where r.id=request_id));
drop policy if exists petty_cash_receipt_items_read on public.petty_cash_receipt_items;
create policy petty_cash_receipt_items_read on public.petty_cash_receipt_items for select to authenticated using(exists(select 1 from public.petty_cash_receipts r where r.id=receipt_id));
drop trigger if exists petty_cash_receipt_items_immutable on public.petty_cash_receipt_items;
create trigger petty_cash_receipt_items_immutable before update or delete on public.petty_cash_receipt_items for each row execute function public.prevent_accounting_record_mutation();
-- Mechanical source reconstruction only. Do not infer PCVs, dates, items,
-- accounts, expenses or replacement audit events for historical requests.
insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select r.id,r.allocation_line_id,r.requested_amount from public.petty_cash_requests r
where r.allocation_line_id is not null and r.requested_amount>0
  and r.funding_lines_payload is null
  and not exists(select 1 from public.petty_cash_request_lines l where l.request_id=r.id);
insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select r.id,(line->>'allocationLineId')::uuid,(line->>'amount')::numeric from public.petty_cash_requests r,
  lateral jsonb_array_elements(r.funding_lines_payload->'lines') line
where r.funding_lines_payload is not null and not exists(select 1 from public.petty_cash_request_lines l where l.request_id=r.id);
do $$begin
  if exists(select 1 from public.petty_cash_requests r where (r.allocation_line_id is not null or r.funding_lines_payload is not null)
    and r.requested_amount is distinct from (select sum(amount) from public.petty_cash_request_lines l where l.request_id=r.id)) then
    raise exception 'Review inconsistent stored funding totals before financial installation; no historical amounts were changed';
  end if;
end $$;

create or replace function eflow_budget.assign_pcv() returns trigger language plpgsql security definer set search_path='' as $$
declare high_water bigint;
begin
  if tg_op='INSERT' then
    if new.pcv_number is not null or new.pcv_date is not null then raise exception 'PCVs are assigned at authorization' using errcode='22023';end if;
    new.pcv_legacy:=false;
  else
    if row(new.pcv_number,new.pcv_date,new.pcv_legacy) is distinct from row(old.pcv_number,old.pcv_date,old.pcv_legacy) then
      raise exception 'A PCV reference and historical classification are immutable' using errcode='22023';
    end if;
    if old.pcv_number is not null and new.fiscal_budget_id is distinct from old.fiscal_budget_id then
      raise exception 'A PCV cannot change fiscal budget' using errcode='22023';
    end if;
    if new.pcv_number is null and not old.pcv_legacy
       and old.status not in ('approved','scheduled_for_release','partially_released','released')
       and new.status in ('approved','scheduled_for_release','partially_released','released') then
      perform 1 from public.department_fiscal_budgets where id=new.fiscal_budget_id for update;
      select coalesce(max(pcv_number),0) into high_water from public.petty_cash_requests where fiscal_budget_id=new.fiscal_budget_id;
      insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number) values(new.fiscal_budget_id,high_water+1)
      on conflict(fiscal_budget_id) do update set last_number=greatest(eflow_budget.pcv_counters.last_number,high_water)+1 returning last_number into new.pcv_number;
      new.pcv_date:=(now() at time zone 'Asia/Manila')::date;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists office_budget_pcv on public.petty_cash_requests;
create trigger office_budget_pcv before insert or update on public.petty_cash_requests for each row execute function eflow_budget.assign_pcv();

create function eflow_budget.valid_money(value numeric,allow_zero boolean default false) returns boolean language sql immutable set search_path='' as $$
  select coalesce(value::text not in ('NaN','Infinity','-Infinity') and value=round(value,2) and value<=99999999999999.99 and (value>0 or allow_zero and value=0),false)
$$;
create function eflow_budget.canonical_cash_lines(value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare line jsonb;source uuid;amount numeric;seen uuid[]:='{}';result jsonb:='[]';
begin
  if value is null or jsonb_typeof(value)<>'array' or jsonb_array_length(value) not between 1 and 100 then
    raise exception 'Choose 1 to 100 valid funding lines' using errcode='22023';end if;
  for line in select * from jsonb_array_elements(value) loop
    source:=(line->>'allocationLineId')::uuid;amount:=(line->>'amount')::numeric;
    if source is null or source=any(seen) or not eflow_budget.valid_money(amount) then
      raise exception 'Choose each source once and positive amounts in cents' using errcode='22023';end if;
    seen:=array_append(seen,source);
    result:=result||jsonb_build_array(jsonb_build_object('allocationLineId',source,'amount',amount));
  end loop;
  return (select jsonb_agg(entry.value order by entry.value->>'allocationLineId') from jsonb_array_elements(result) entry);
end $$;

-- Deterministic largest-remainder apportionment: partial approvals reserve
-- exact cents and the per-source amounts always sum to the approved total.
create function eflow_budget.authorized_cash_lines(p_request uuid) returns table(allocation_line_id uuid,amount numeric)
language sql stable security definer set search_path='' as $$
  with amounts as (
    select l.allocation_line_id,l.amount*coalesce(r.approved_amount,r.requested_amount)/nullif(r.requested_amount,0)*100 as cents,
      coalesce(r.approved_amount,r.requested_amount)*100 as total_cents
    from public.petty_cash_request_lines l join public.petty_cash_requests r on r.id=l.request_id where r.id=p_request
  ),ranked as (
    select *,row_number() over(order by cents-floor(cents) desc,allocation_line_id) as remainder_rank,
      total_cents-sum(floor(cents)) over() as remaining from amounts
  ) select allocation_line_id,(floor(cents)+case when remainder_rank<=remaining then 1 else 0 end)/100 from ranked
$$;
create or replace function eflow_budget.request_line_obligation(p_request uuid,p_line uuid) returns numeric language sql stable set search_path='' as $$
  select case when public.cash_request_obligation(r)=0 then 0
    when r.status='settled' then coalesce((select sum(i.amount) from public.petty_cash_receipt_items i
      join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id
      where li.request_id=r.id and li.status='approved' and i.allocation_line_id=p_line),
      case when r.allocation_line_id=p_line and not exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id where li.request_id=r.id and li.status='approved') then r.actual_spent else 0 end)
    else (select amount from eflow_budget.authorized_cash_lines(r.id) where allocation_line_id=p_line) end
  from public.petty_cash_requests r where r.id=p_request
$$;
create or replace function public.task_budget_line_available(p_allocation_line_id uuid,p_exclude_request_id uuid default null)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare l public.work_budget_allocation_lines;a public.work_budget_allocations;caps numeric;used numeric;
begin
  select * into l from public.work_budget_allocation_lines where id=p_allocation_line_id;
  select * into a from public.work_budget_allocations where id=l.allocation_id and subtask_id is null and status='approved';
  if a.id is null then return 0;end if;
  select coalesce(sum(amount),0) into caps from public.work_budget_allocations where task_id=a.task_id and commitment_id=a.commitment_id and subtask_id is not null and parent_allocation_line_id=l.id and status in ('pending','approved');
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) into used from public.petty_cash_requests r
    join public.work_budget_allocations ca on ca.id=r.allocation_id join public.petty_cash_request_lines rl on rl.request_id=r.id and rl.allocation_line_id=l.id
    where r.id is distinct from p_exclude_request_id and (ca.subtask_id is null or ca.status not in ('pending','approved'));
  return greatest(0,l.amount-caps-used);
end $$;
create or replace function eflow_budget.partition_spent(p_section uuid) returns numeric language sql stable set search_path='' as $$
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) from public.petty_cash_requests r
  join public.petty_cash_request_lines rl on rl.request_id=r.id join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
  where r.status='settled' and l.budget_partition_id=p_section
$$;

create or replace function eflow_budget.sync_single_cash_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.petty_cash_request_lines where request_id=new.id;
  if new.funding_lines_payload is not null then
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
      select new.id,(line->>'allocationLineId')::uuid,(line->>'amount')::numeric from jsonb_array_elements(new.funding_lines_payload->'lines') line;
  elsif new.allocation_line_id is not null and new.requested_amount>0 then
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount) values(new.id,new.allocation_line_id,new.requested_amount);
  end if;
  return new;
end $$;
drop trigger if exists petty_cash_single_line on public.petty_cash_requests;
create trigger petty_cash_single_line after insert or update of requested_amount,allocation_line_id,funding_lines_payload on public.petty_cash_requests for each row execute function eflow_budget.sync_single_cash_line();
create function eflow_budget.guard_cash_line_identity() returns trigger language plpgsql set search_path='' as $$
begin
  if row(new.request_id,new.allocation_line_id) is distinct from row(old.request_id,old.allocation_line_id) then
    raise exception 'Funding line identities are immutable; correct the request through its funding lines' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_line_identity before update on public.petty_cash_request_lines for each row execute function eflow_budget.guard_cash_line_identity();
create function eflow_budget.check_cash_line_total() returns trigger language plpgsql security definer set search_path='' as $$
declare request uuid;r public.petty_cash_requests;total numeric;
begin
  if tg_table_name='petty_cash_requests' then request:=new.id;
  elsif tg_op='DELETE' then request:=old.request_id;else request:=new.request_id;end if;
  select * into r from public.petty_cash_requests where id=request;
  if r.id is null then return null;end if;
  if r.allocation_line_id is null and r.funding_lines_payload is null then return null;end if;
  select sum(amount) into total from public.petty_cash_request_lines where request_id=request;
  if total is distinct from r.requested_amount then raise exception 'Funding lines must equal the final cash request amount' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_request_lines rl join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
    join public.work_budget_allocations a on a.id=l.allocation_id where rl.request_id=r.id and (a.task_id is distinct from r.task_id or a.subtask_id is not null or a.commitment_id is distinct from r.commitment_id)) then
    raise exception 'Request funding lines must belong to its authorized task funding' using errcode='22023';end if;
  if r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from
    (select jsonb_agg(jsonb_build_object('allocationLineId',allocation_line_id,'amount',amount) order by allocation_line_id) from public.petty_cash_request_lines where request_id=r.id) then
    raise exception 'Funding breakdown does not match the request payload' using errcode='22023';end if;
  return null;
end $$;
create constraint trigger financial_request_total after insert or update on public.petty_cash_requests deferrable initially deferred for each row execute function eflow_budget.check_cash_line_total();
create constraint trigger financial_line_total after insert or update or delete on public.petty_cash_request_lines deferrable initially deferred for each row execute function eflow_budget.check_cash_line_total();

create or replace function public.audit_cash_request_change() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();actor_role_value text;
begin
  select role::text into actor_role_value from public.profiles where id=actor;
  if tg_op='INSERT' then
    insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,new_state,reason,correlation_key,metadata)
    values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'cash_request_created',new.requested_amount,'Cash requested and temporarily reserved',actor,actor_role_value,new.status,new.purpose,new.idempotency_key,
      jsonb_build_object('neededBy',new.needed_by,'reservationExpiresAt',new.reservation_expires_at,'fundingLines',new.funding_lines_payload->'lines'));
  else
    if new.status is distinct from old.status then
      insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,previous_state,new_state,reason,metadata)
      values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'cash_request_state_changed',case when new.status='settled' then coalesce(new.actual_spent,0) else coalesce(new.approved_amount,new.requested_amount) end,
        'Cash request state changed',actor,actor_role_value,old.status,new.status,coalesce(new.department_decision_reason,new.leader_decision_reason,new.approval_reason),
        jsonb_build_object('returnedAmount',new.returned_amount,'releasedAmount',new.released_amount,'fundingLines',new.funding_lines_payload->'lines'));
    end if;
    if row(new.requested_amount,new.allocation_line_id,new.funding_lines_payload,new.purpose,new.needed_by) is distinct from row(old.requested_amount,old.allocation_line_id,old.funding_lines_payload,old.purpose,old.needed_by) then
      insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,petty_cash_request_id,task_id,subtask_id,allocation_line_id,entry_type,amount,description,actor_id,actor_role,previous_state,new_state,reason,metadata)
      values(new.fiscal_budget_id,new.org_id,new.commitment_id,new.allocation_id,new.id,new.task_id,new.subtask_id,new.allocation_line_id,'financial_override',new.requested_amount,'Cash request corrected and resubmitted',actor,actor_role_value,old.status,new.status,new.purpose,
        jsonb_build_object('operation','cash_request_corrected','before',jsonb_build_object('amount',old.requested_amount,'purpose',old.purpose,'neededBy',old.needed_by,'funding',old.funding_lines_payload,'allocationLineId',old.allocation_line_id),'after',jsonb_build_object('amount',new.requested_amount,'purpose',new.purpose,'neededBy',new.needed_by,'funding',new.funding_lines_payload,'allocationLineId',new.allocation_line_id)));
    end if;
  end if;
  return new;
end $$;

create or replace function eflow_budget.cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();t public.tasks;a public.work_budget_allocations;b public.department_fiscal_budgets;c public.budget_commitments;
  cap public.work_budget_allocations;r public.petty_cash_requests;command eflow_budget.cash_commands;
  lines jsonb;line jsonb;payload jsonb;total numeric;source uuid;first_source uuid;created uuid;leader uuid;next_status text;
begin
  if caller is null or not exists(select 1 from public.profiles where id=caller and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;
  if p_key is null or nullif(btrim(p_purpose),'') is null then raise exception 'Enter a purchase purpose and request key' using errcode='22023';end if;
  lines:=eflow_budget.canonical_cash_lines(p_lines);
  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(lines);
  if not eflow_budget.valid_money(total) then raise exception 'Invalid final request total' using errcode='22023';end if;
  select * into t from public.tasks where id=p_task and deleted_at is null;
  leader:=coalesce(t.assigned_to,t.recommendation_lead_id);
  if t.id is null or leader is null then raise exception 'Funded task and Task Leader required' using errcode='22023';end if;
  if p_subtask is null then
    if caller<>leader then raise exception 'Only the Task Leader can submit a task-level request' using errcode='42501';end if;
  elsif not exists(select 1 from public.subtasks where id=p_subtask and task_id=p_task and (caller=leader or caller=any(coalesce(assigned_to_ids,'{}'::uuid[])))) then
    raise exception 'Only the Task Leader or an assigned contributor can request cash for this subtask' using errcode='42501';
  end if;
  payload:=jsonb_build_object('task',p_task,'subtask',p_subtask,'lines',lines,'purpose',btrim(p_purpose),'neededBy',p_needed_by,'existing',p_existing);
  -- Same-key calls serialize before checking the persisted command receipt.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eflow:cash-command:'||caller::text||':'||p_key::text,0));
  select * into command from eflow_budget.cash_commands where actor_id=caller and idempotency_key=p_key;
  if command.request_id is not null then
    if command.payload is distinct from payload then raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;
    return command.request_id;
  end if;
  if p_existing is null then
    select * into r from public.petty_cash_requests where requester_id=caller and idempotency_key=p_key;
    if r.id is not null then
      if r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.requested_amount<>total or r.purpose<>btrim(p_purpose) or r.needed_by is distinct from p_needed_by
        or (r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from lines)
        or (r.funding_lines_payload is null and (jsonb_array_length(lines)<>1 or r.allocation_line_id is distinct from (lines->0->>'allocationLineId')::uuid)) then
        raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;
      return r.id;
    end if;
  end if;
  if p_needed_by<(now() at time zone 'Asia/Manila')::date then raise exception 'Needed-by date cannot be earlier than today' using errcode='22023';end if;
  -- Shared lock order with the installed single-source writer: allocation,
  -- then fiscal authority, then request. NW adds its root lock at entry.
  select * into a from public.work_budget_allocations where task_id=p_task and subtask_id is null and status='approved' for update;
  if a.id is null then raise exception 'Work has no approved funding' using errcode='22023';end if;
  select * into c from public.budget_commitments where id=a.commitment_id and status='active';
  select * into b from public.department_fiscal_budgets where id=c.fiscal_budget_id and status='locked' for update;
  if b.id is null then raise exception 'The annual department budget is no longer open' using errcode='22023';end if;
  if p_existing is not null then
    select * into r from public.petty_cash_requests where id=p_existing for update;
    if r.id is null or r.requester_id<>caller or r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.commitment_id is distinct from c.id then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
    if r.status not in ('leader_changes_requested','department_changes_requested') then raise exception 'This request is not awaiting corrections' using errcode='22023';end if;
  end if;
  if p_subtask is not null then select * into cap from public.work_budget_allocations where task_id=p_task and subtask_id=p_subtask and status='approved' for update;end if;
  for line in select value from jsonb_array_elements(lines) loop
    source:=(line->>'allocationLineId')::uuid;
    if not exists(select 1 from public.work_budget_allocation_lines where id=source and allocation_id=a.id) then raise exception 'Source belongs to different work' using errcode='42501';end if;
    if cap.id is not null then
      if source is distinct from cap.parent_allocation_line_id or (line->>'amount')::numeric>public.subtask_cap_available(cap.id,p_existing) then raise exception 'Request exceeds its protected subtask source cap' using errcode='22023';end if;
    elsif (line->>'amount')::numeric>public.task_budget_line_available(source,p_existing) then raise exception 'Funding line has insufficient requestable balance' using errcode='22023';end if;
  end loop;
  first_source:=(lines->0->>'allocationLineId')::uuid;
  next_status:=case when caller=leader then 'pending_department_approval' else 'pending_leader_review' end;
  if p_existing is null then
    insert into public.petty_cash_requests(fiscal_budget_id,commitment_id,allocation_id,allocation_line_id,org_id,task_id,subtask_id,requester_id,task_leader_id,cash_recipient_id,purpose,requested_amount,needed_by,status,reservation_expires_at,idempotency_key,funding_lines_payload)
    values(b.id,c.id,coalesce(cap.id,a.id),first_source,b.org_id,t.id,p_subtask,caller,leader,caller,btrim(p_purpose),total,p_needed_by,next_status,now()+interval '7 days',p_key,payload) returning id into created;
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,financial_record_id,financial_record_type)
      select recipient,case when next_status='pending_leader_review' then 'petty_cash_leader_review' else 'petty_cash_department_approval' end,
        case when next_status='pending_leader_review' then 'Cash request needs your endorsement' else 'Cash request needs fiscal authorization' end,
        coalesce(profile.full_name,'A contributor')||' requested '||to_char(total,'FM999G999G999G990D00')||' for '||btrim(p_purpose)||' in "'||t.title||'".',
        t.id,t.title,caller,coalesce(profile.full_name,''),created,'petty_cash_request'
      from (select leader as recipient where next_status='pending_leader_review' union all select public.organization_approver_ids(b.org_id) where next_status='pending_department_approval') recipients
      left join public.profiles profile on profile.id=caller where recipient<>caller;
  else
    created:=r.id;
    update public.petty_cash_requests set allocation_line_id=first_source,allocation_id=coalesce(cap.id,a.id),requested_amount=total,funding_lines_payload=payload,purpose=btrim(p_purpose),needed_by=p_needed_by,
      status=next_status,approved_amount=null,approved_by=null,approval_reason=null,decided_at=null,leader_decided_by=null,leader_decision_reason=null,leader_decided_at=null,
      department_decision_reason=null,reservation_expires_at=now()+interval '7 days',updated_at=now() where id=created;
  end if;
  insert into eflow_budget.cash_commands(actor_id,idempotency_key,request_id,payload) values(caller,p_key,created,payload);
  return created;
end $$;
create or replace function public.create_contextual_cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.cash_request_v2(p_task,p_subtask,p_lines,p_purpose,p_needed_by,p_key,p_existing)$$;
create or replace function public.create_contextual_cash_request(p_task_id uuid,p_subtask_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  return eflow_budget.cash_request_v2(p_task_id,p_subtask_id,jsonb_build_array(jsonb_build_object('allocationLineId',p_allocation_line_id,'amount',p_amount)),p_purpose,p_needed_by,p_idempotency_key,null);
end
$$;
create or replace function eflow_budget.legacy_resubmit_cash(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;key uuid;
begin
  select * into r from public.petty_cash_requests where id=p_request_id;
  if auth.uid() is null or r.id is null or r.requester_id<>auth.uid() then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;
  if (select count(*) from public.petty_cash_request_lines where request_id=r.id)>1 then raise exception 'Correct this multi-account request through its funding lines' using errcode='22023';end if;
  if r.status in ('pending_leader_review','pending_department_approval') and row(r.allocation_line_id,r.requested_amount,r.purpose,r.needed_by) is not distinct from row(p_allocation_line_id,p_amount,btrim(p_purpose),p_needed_by) then return;end if;
  key:=md5('legacy-correction:'||r.id::text||':'||coalesce(r.updated_at::text,'initial')||':'||jsonb_build_array(p_allocation_line_id,p_amount,p_purpose,p_needed_by)::text)::uuid;
  perform eflow_budget.cash_request_v2(r.task_id,r.subtask_id,jsonb_build_array(jsonb_build_object('allocationLineId',p_allocation_line_id,'amount',p_amount)),p_purpose,p_needed_by,key,r.id);
end $$;
create or replace function public.resubmit_contextual_cash_request(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$begin
  perform eflow_budget.legacy_resubmit_cash(p_request_id,p_allocation_line_id,p_amount,p_purpose,p_needed_by);
end $$;

create function eflow_budget.guard_cash_correction() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if row(new.requested_amount,new.allocation_line_id,new.funding_lines_payload,new.purpose,new.needed_by) is distinct from row(old.requested_amount,old.allocation_line_id,old.funding_lines_payload,old.purpose,old.needed_by)
    and (auth.uid() is null or auth.uid() is distinct from old.requester_id or old.status not in ('leader_changes_requested','department_changes_requested') or new.status not in ('pending_leader_review','pending_department_approval')) then
    raise exception 'Only an authorized requester correction can change cash request details' using errcode='42501';
  end if;
  return new;
end $$;
create trigger financial_cash_correction before update on public.petty_cash_requests for each row execute function eflow_budget.guard_cash_correction();

create or replace function eflow_budget.map_account(p_section uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare s public.office_budget_sections;b public.department_fiscal_budgets;previous text;
begin
  select * into s from public.office_budget_sections where id=p_section;
  select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id for update;
  if s.id is null or not public.can_manage_department_accounting(b.org_id,auth.uid()) then raise exception 'Accounting access denied' using errcode='42501';end if;
  if b.status='closed' then raise exception 'Fiscal year is closed' using errcode='22023';end if;
  if not exists(select 1 from public.accounting_accounts where code=p_code and is_active and classification='expense') then raise exception 'Choose an active expense account from the journal catalog' using errcode='22023';end if;
  previous:=s.journal_account_code;
  if previous is not distinct from p_code then return;end if;
  update public.office_budget_sections set journal_account_code=p_code where id=s.id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,before_data,after_data)
  values(auth.uid(),'budget_account',s.id::text,'budget.account_mapped',b.org_id,jsonb_build_object('journalCode',previous),jsonb_build_object('journalCode',p_code));
end $$;
create or replace function public.map_office_budget_account(p_section uuid,p_code text) returns void language sql security invoker set search_path='' as $$select eflow_budget.map_account(p_section,p_code)$$;

create or replace function eflow_budget.submit_items(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text,p_refund_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;li public.petty_cash_liquidations;rc jsonb;item jsonb;receipt_id uuid;source public.work_budget_allocation_lines;
  s public.office_budget_sections;total numeric;receipt_total numeric:=0;item_total numeric;pos integer;amt numeric;quantity numeric;payload jsonb;paths text[]:='{}';authorized record;
begin
  select * into r from public.petty_cash_requests where id=p_request for update;
  if r.id is null or auth.uid() is null or (r.requester_id<>auth.uid() and r.cash_recipient_id<>auth.uid())
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Only the active cash recipient can submit purchased items' using errcode='42501';end if;
  if p_key is null then raise exception 'A liquidation idempotency key is required' using errcode='22023';end if;
  payload:=jsonb_build_object('spent',p_spent,'note',p_note,'receipts',p_receipts,'refundNumber',p_refund_number,'refundDate',p_refund_date);
  select * into li from public.petty_cash_liquidations where request_id=r.id and idempotency_key=p_key;
  if li.id is not null then
    if li.itemized_payload is distinct from payload then raise exception 'Liquidation key belongs to different receipt items' using errcode='22023';end if;return li.id;
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts) not between 1 and 100 or not eflow_budget.valid_money(p_spent,true) then raise exception 'Use a valid itemized receipt package' using errcode='22023';end if;
  for rc in select value from jsonb_array_elements(p_receipts) loop
    if not eflow_budget.valid_money((rc->>'amount')::numeric,true) or nullif(btrim(rc->>'filePath'),'') is null or (rc->>'filePath')=any(paths)
       or rc->'items' is null or jsonb_typeof(rc->'items')<>'array' or jsonb_array_length(rc->'items')>100 then raise exception 'Each receipt needs one unique evidence path and valid purchased items' using errcode='22023';end if;
    if left(rc->>'filePath',length(r.org_id::text||'/'||r.id::text||'/'))<>r.org_id::text||'/'||r.id::text||'/'
      or not exists(select 1 from storage.objects o where o.bucket_id='budget-receipts' and o.name=rc->>'filePath' and o.owner_id=auth.uid()::text) then
      raise exception 'Receipt evidence must be an uploaded file owned by this recipient in this cash request' using errcode='42501';end if;
    paths:=array_append(paths,rc->>'filePath');total:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      amt:=(item->>'amount')::numeric;quantity:=(item->>'quantity')::numeric;
      if not eflow_budget.valid_money(amt) or quantity is null or quantity::text in ('NaN','Infinity','-Infinity') or quantity<=0 or quantity<>round(quantity,3)
        or nullif(btrim(item->>'unit'),'') is null or nullif(btrim(item->>'particular'),'') is null or nullif(btrim(item->>'purpose'),'') is null then raise exception 'Each item needs quantity, unit, particulars, purpose and a positive line amount' using errcode='22023';end if;
      if not exists(select 1 from public.petty_cash_request_lines where request_id=r.id and allocation_line_id=(item->>'allocationLineId')::uuid) then raise exception 'Purchased item uses an unauthorized funding account' using errcode='42501';end if;
      total:=total+amt;
    end loop;
    if total is distinct from (rc->>'amount')::numeric then raise exception 'Item totals must equal each receipt total' using errcode='22023';end if;
    receipt_total:=receipt_total+total;
  end loop;
  if receipt_total is distinct from p_spent then raise exception 'Receipt totals must equal declared spending exactly' using errcode='22023';end if;
  for authorized in select * from eflow_budget.authorized_cash_lines(r.id) loop
    select coalesce(sum((it.value->>'amount')::numeric),0) into item_total from jsonb_array_elements(p_receipts) rc,
      lateral jsonb_array_elements(rc.value->'items') it where (it.value->>'allocationLineId')::uuid=authorized.allocation_line_id;
    if item_total>authorized.amount then raise exception 'Spending exceeds this account authorization; obtain reauthorization first' using errcode='22023';end if;
  end loop;
  -- The established command preserves release acknowledgment, receipt limits,
  -- refund, evidence guards, reviewer routing and immutable receipt history.
  li.id:=public.submit_accounting_cash_liquidation(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date);
  for rc in select value from jsonb_array_elements(p_receipts) loop
    select id into strict receipt_id from public.petty_cash_receipts where liquidation_id=li.id and file_path=rc->>'filePath';
    pos:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      select * into source from public.work_budget_allocation_lines where id=(item->>'allocationLineId')::uuid;
      select * into s from public.office_budget_sections where id=source.budget_partition_id;
      insert into public.petty_cash_receipt_items(receipt_id,allocation_line_id,quantity,unit,particular,purpose,amount,position,account_name,account_label)
      values(receipt_id,source.id,(item->>'quantity')::numeric,btrim(item->>'unit'),btrim(item->>'particular'),btrim(item->>'purpose'),(item->>'amount')::numeric,pos,coalesce(s.name,source.category),s.account_code);
      pos:=pos+1;
    end loop;
  end loop;
  update public.petty_cash_liquidations set itemized_payload=payload where id=li.id;
  return li.id;
end $$;
create or replace function public.submit_itemized_cash_liquidation(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text default null,p_refund_date date default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.submit_items(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date)$$;

create function eflow_budget.guard_itemized_liquidation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (old.itemized_payload is not null or old.status='approved') and
    row(new.request_id,new.version,new.declared_spent,new.returned_amount,new.note,new.submitted_by,new.idempotency_key,new.itemized_payload,new.refund_receipt_number,new.refund_date)
      is distinct from row(old.request_id,old.version,old.declared_spent,old.returned_amount,old.note,old.submitted_by,old.idempotency_key,old.itemized_payload,old.refund_receipt_number,old.refund_date) then
    raise exception 'Submitted liquidation amounts, item evidence and refund references are immutable; submit a correction version' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_liquidation_immutable before update on public.petty_cash_liquidations for each row execute function eflow_budget.guard_itemized_liquidation();
create function eflow_budget.guard_receipt_item_insert() returns trigger language plpgsql security definer set search_path='' as $$
declare li public.petty_cash_liquidations;
begin
  select l.* into li from public.petty_cash_liquidations l join public.petty_cash_receipts r on r.liquidation_id=l.id where r.id=new.receipt_id;
  if li.id is null or li.itemized_payload is not null or li.status='approved' then
    raise exception 'Submitted receipt items are immutable; submit a correction version' using errcode='22023';
  end if;
  return new;
end $$;
create trigger financial_item_insert before insert on public.petty_cash_receipt_items for each row execute function eflow_budget.guard_receipt_item_insert();

-- A multi-account request cannot escape the per-account settlement checks by
-- calling the older, non-itemized API. Deferred validation permits the existing
-- receipt command and item rows to be persisted in the same transaction.
create function eflow_budget.check_itemized_liquidation() returns trigger language plpgsql security definer set search_path='' as $$
declare li public.petty_cash_liquidations;rid uuid;total numeric;
begin
  if tg_table_name='petty_cash_liquidations' then rid:=new.id;
  else select liquidation_id into rid from public.petty_cash_receipts where id=new.receipt_id;end if;
  select * into li from public.petty_cash_liquidations where id=rid;
  if li.id is null then return null;end if;
  if li.itemized_payload is null then
    if li.declared_spent>0 and (select count(*) from public.petty_cash_request_lines where request_id=li.request_id)>1 then raise exception 'Use itemized liquidation for multi-account cash requests' using errcode='22023';end if;
    return null;
  end if;
  select coalesce(sum(i.amount),0) into total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=li.id;
  if total is distinct from li.declared_spent then raise exception 'Purchased item totals must equal declared spending exactly' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_receipts rc left join public.petty_cash_receipt_items i on i.receipt_id=rc.id where rc.liquidation_id=li.id group by rc.id,rc.amount having coalesce(sum(i.amount),0)<>rc.amount) then
    raise exception 'Purchased item totals must equal every receipt' using errcode='22023';end if;
  if exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
    left join eflow_budget.authorized_cash_lines(li.request_id) a on a.allocation_line_id=i.allocation_line_id
    where rc.liquidation_id=li.id group by i.allocation_line_id,a.amount having a.amount is null or sum(i.amount)>a.amount) then
    raise exception 'Purchased items exceed their authorized funding source' using errcode='22023';end if;
  return null;
end $$;
create constraint trigger financial_itemized_total after insert or update on public.petty_cash_liquidations deferrable initially deferred for each row execute function eflow_budget.check_itemized_liquidation();
create constraint trigger financial_item_row_total after insert on public.petty_cash_receipt_items deferrable initially deferred for each row execute function eflow_budget.check_itemized_liquidation();

create or replace function public.post_liquidation_general_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;settings public.department_accounting_settings;jid uuid;line_no integer:=1;expense record;code text;title text;items_total numeric;
begin
  if new.status<>'approved' or old.status='approved' then return new;end if;
  select * into r from public.petty_cash_requests where id=new.request_id;
  select * into settings from public.department_accounting_settings where fiscal_budget_id=r.fiscal_budget_id;
  if exists(select 1 from public.general_journal_entries where source_type='liquidation' and source_id=new.id) then return new;end if;
  select sum(i.amount) into items_total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=new.id;
  if new.itemized_payload is not null and coalesce(items_total,0) is distinct from new.declared_spent then raise exception 'Purchased item totals do not match declared spending' using errcode='22023';end if;
  insert into public.general_journal_entries(fiscal_budget_id,org_id,entry_date,reference_number,source_type,source_id,memo,posted_by)
  values(r.fiscal_budget_id,r.org_id,coalesce(new.decided_at::date,current_date),new.liquidation_number,'liquidation',new.id,'Settlement for '||r.purpose,coalesce(new.decided_by,auth.uid())) returning id into jid;
  if items_total is not null then
    for expense in select coalesce(s.journal_account_code,m.account_code) as account_code,sum(i.amount) as amount
      from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
      join public.work_budget_allocation_lines l on l.id=i.allocation_line_id
      left join public.office_budget_sections s on s.id=l.budget_partition_id left join public.department_budget_account_mappings m on m.allocation_line_id=l.id
      where rc.liquidation_id=new.id group by coalesce(s.journal_account_code,m.account_code) order by account_code loop
      title:=null;
      select a.title into title from public.accounting_accounts a where a.code=expense.account_code and a.classification='expense' and a.is_active;
      if title is null then raise exception 'Map every purchased-item source to an active journal expense account before settlement' using errcode='22023';end if;
      insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,expense.account_code,title,expense.amount,0);line_no:=line_no+1;
    end loop;
  elsif new.declared_spent>0 then
    select coalesce(m.account_code,settings.default_expense_account_code) into code from (select 1) seed left join public.department_budget_account_mappings m on m.allocation_line_id=r.allocation_line_id;
    select a.title into title from public.accounting_accounts a where a.code=code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,code,title,new.declared_spent,0);line_no:=line_no+1;
  end if;
  if new.returned_amount>0 then
    select a.title into title from public.accounting_accounts a where a.code=settings.cash_account_code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.cash_account_code,title,new.returned_amount,0);line_no:=line_no+1;
  end if;
  select a.title into title from public.accounting_accounts a where a.code=settings.advance_account_code;
  insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.advance_account_code,title,0,new.declared_spent+new.returned_amount);
  return new;
end $$;

-- Preserve installed source queries rather than replacing their access logic.
do $$declare definition text;begin
  if to_regprocedure('eflow_budget.pre_financial_get_sections(uuid,integer)') is null then
    definition:=pg_get_functiondef('eflow_budget.get_sections(uuid,integer)'::regprocedure);
    execute replace(definition,'FUNCTION eflow_budget.get_sections(','FUNCTION eflow_budget.pre_financial_get_sections(');
    definition:=pg_get_functiondef('eflow_budget.task_context(uuid,uuid)'::regprocedure);
    execute replace(definition,'FUNCTION eflow_budget.task_context(','FUNCTION eflow_budget.pre_financial_task_context(');
  end if;
end $$;
create or replace function eflow_budget.get_sections(p_org_id uuid,p_fiscal_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;rows jsonb;
begin
  result:=eflow_budget.pre_financial_get_sections(p_org_id,p_fiscal_year);
  select coalesce(jsonb_agg(section||jsonb_build_object('journalAccountCode',s.journal_account_code) order by position), '[]'::jsonb) into rows
    from jsonb_array_elements(result->'sections') with ordinality sections(section,position)
    left join public.office_budget_sections s on s.id=(section->>'id')::uuid;
  return result||jsonb_build_object('sections',rows,'itemizedCashAvailable',true);
end $$;
create or replace function eflow_budget.task_context(p_task_id uuid,p_subtask_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select eflow_budget.pre_financial_task_context(p_task_id,p_subtask_id)||jsonb_build_object('supportsItemizedCash',true)
$$;

-- Deliberately narrow privileges: no schema-wide function revocations.
revoke all on function eflow_budget.assign_pcv(),eflow_budget.valid_money(numeric,boolean),eflow_budget.canonical_cash_lines(jsonb),
  eflow_budget.authorized_cash_lines(uuid),eflow_budget.request_line_obligation(uuid,uuid),eflow_budget.sync_single_cash_line(),
  eflow_budget.check_cash_line_total(),eflow_budget.guard_cash_correction(),eflow_budget.check_itemized_liquidation(),eflow_budget.guard_itemized_liquidation(),eflow_budget.guard_cash_line_identity(),eflow_budget.guard_receipt_item_insert(),
  eflow_budget.pre_financial_get_sections(uuid,integer),eflow_budget.pre_financial_task_context(uuid,uuid),
  eflow_budget.legacy_resubmit_cash(uuid,uuid,numeric,text,date) from public,anon,authenticated;
revoke all on function eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date),
  public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) from public,anon;
grant execute on function eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date),
  public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) to authenticated,service_role;
-- CREATE OR REPLACE preserves grants of every pre-existing public function.
-- Trigger functions are never public APIs, including their replaced bodies.
revoke all on function public.audit_cash_request_change(),public.post_liquidation_general_journal() from public,anon,authenticated;
do $$declare rel text;begin
  foreach rel in array array['petty_cash_request_lines','petty_cash_receipt_items'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=rel) then
      execute format('alter publication supabase_realtime add table public.%I',rel);
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
$eflow_financial_source$]);
commit;
select version,name,'Financial compatibility installed' as result from supabase_migrations.schema_migrations where version='20261015125031';
