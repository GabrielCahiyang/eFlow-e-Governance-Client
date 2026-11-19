-- Option A: Align Office Petty Cash (eflow_office_cash) return governance with
-- Project/Task Fund Cash while preserving the standalone PHP 30,000 imprest fund.
-- Adds:
--   1. Released timestamp + 15-day liquidation due date
--   2. Mandatory refund OR # + return date when spent < amount (returned_amount > 0)
--   3. Version-locked 2-step Cash Return Clearance (acknowledge_return -> approve_return)
--   4. Table-level settlement guard trigger enforcing return clearance
--   5. Audited Head fallback when zero independent Accounting Officers exist

begin;

alter table eflow_office_cash.requests
  add column if not exists released_at timestamptz,
  add column if not exists liquidation_due_at timestamptz,
  add column if not exists returned_amount numeric(16,2) not null default 0,
  add column if not exists refund_receipt_number text,
  add column if not exists refund_date date,
  add column if not exists liquidation_note text,
  add column if not exists receipt_version integer not null default 0,
  add column if not exists cash_return_version integer,
  add column if not exists cash_return_received_by uuid references public.profiles(id),
  add column if not exists cash_return_received_at timestamptz,
  add column if not exists cash_return_receive_reference text,
  add column if not exists cash_return_approved_by uuid references public.profiles(id),
  add column if not exists cash_return_approved_at timestamptz,
  add column if not exists cash_return_approval_note text;

-- Backfill existing historical rows safely before attaching constraints.
update eflow_office_cash.requests r
set released_at = coalesce(
      r.released_at,
      (select max(e.created_at) from eflow_office_cash.events e where e.request = r.id and e.action = 'release'),
      r.updated_at,
      r.created_at
    )
where r.status in ('released', 'receipt_review', 'receipt_approved', 'settled')
  and r.released_at is null;

update eflow_office_cash.requests r
set liquidation_due_at = r.released_at + interval '15 days'
where r.released_at is not null
  and r.liquidation_due_at is null;

update eflow_office_cash.requests r
set returned_amount = greatest(0, round(r.amount - r.spent, 2)),
    receipt_version = greatest(coalesce(r.receipt_version, 0), 1)
where r.status in ('receipt_review', 'receipt_approved', 'settled');

alter table eflow_office_cash.requests
  drop constraint if exists office_cash_requests_returned_amount_bounds,
  add constraint office_cash_requests_returned_amount_bounds
    check (returned_amount >= 0 and returned_amount <= amount);

alter table eflow_office_cash.requests
  drop constraint if exists office_cash_requests_receipt_version_nonneg,
  add constraint office_cash_requests_receipt_version_nonneg
    check (receipt_version >= 0);

create index if not exists idx_office_cash_requests_return_received_by
  on eflow_office_cash.requests (cash_return_received_by)
  where cash_return_received_by is not null;

create index if not exists idx_office_cash_requests_return_approved_by
  on eflow_office_cash.requests (cash_return_approved_by)
  where cash_return_approved_by is not null;

-- Helper: active Accounting Staff in the same office who is not the requester.
create or replace function eflow_office_cash.is_independent_return_receiver(
  r eflow_office_cash.requests,
  actor uuid
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select actor is distinct from r.requester
    and exists (
      select 1 from public.profiles p
      where p.id = actor
        and p.org_id = r.office
        and p.is_active
        and p.role = 'accounting_staff'
    );
$$;

create or replace function eflow_office_cash.has_independent_return_receiver(
  r eflow_office_cash.requests
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles candidate
    where candidate.org_id = r.office
      and eflow_office_cash.is_independent_return_receiver(r, candidate.id)
  );
$$;

-- Helper: true when returned_amount = 0 OR the current receipt package has both
-- physical receipt acknowledgment and independent Head return approval.
create or replace function eflow_office_cash.cash_return_cleared(
  r eflow_office_cash.requests
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select coalesce(r.returned_amount, 0) <= 0
    or (
      r.cash_return_version is not distinct from r.receipt_version
      and r.cash_return_received_at is not null
      and r.cash_return_received_by is not null
      and r.cash_return_approved_at is not null
      and r.cash_return_approved_by is not null
      and r.cash_return_received_by is distinct from r.requester
      and r.cash_return_approved_by is distinct from r.requester
      and exists (
        select 1
        from public.organizations o
        join public.profiles h on h.id = o.head_user_id
        where o.id = r.office
          and o.is_active
          and h.is_active
          and h.org_id = o.id
          and h.role = 'head'
          and h.id = r.cash_return_approved_by
      )
      and (
        (
          eflow_office_cash.has_independent_return_receiver(r)
          and r.cash_return_approved_by is distinct from r.cash_return_received_by
          and eflow_office_cash.is_independent_return_receiver(r, r.cash_return_received_by)
        )
        or (
          not eflow_office_cash.has_independent_return_receiver(r)
          and (
            r.cash_return_received_by = r.cash_return_approved_by
            or eflow_office_cash.is_independent_return_receiver(r, r.cash_return_received_by)
          )
        )
      )
    );
$$;

-- Helper: appointed active Office Head may post settlement ONLY when the office
-- has no eligible independent Accounting Officer and an escalation alert exists.
create or replace function eflow_office_cash.head_can_fallback_settle(
  r eflow_office_cash.requests,
  actor uuid
)
returns boolean
language sql
stable
set search_path to ''
as $$
  select r.status = 'receipt_approved'
    and actor is distinct from r.requester
    and public.phase2_is_office_head(actor, r.office)
    and not exists (
      select 1 from public.profiles candidate
      where candidate.org_id = r.office
        and eflow_office_cash.is_independent_settler(r, candidate.id)
    )
    and exists (
      select 1 from eflow_office_cash.settlement_alerts a
      where a.request_id = r.id
        and a.head_id = actor
    );
$$;

-- Table-level guard mirroring eflow_work_clearance.guard_settlement().
create or replace function eflow_office_cash.guard_settlement()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'settled'
    and old.status is distinct from 'settled'
    and coalesce(new.returned_amount, 0) > 0
  then
    if not eflow_office_cash.cash_return_cleared(new) then
      raise exception 'Accounting must acknowledge the exact cash return and an independent Office Head must approve it before settlement'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists office_cash_return_settlement_guard on eflow_office_cash.requests;
create trigger office_cash_return_settlement_guard
  before update of status on eflow_office_cash.requests
  for each row
  execute function eflow_office_cash.guard_settlement();

revoke all on function
  eflow_office_cash.is_independent_return_receiver(eflow_office_cash.requests, uuid),
  eflow_office_cash.has_independent_return_receiver(eflow_office_cash.requests),
  eflow_office_cash.cash_return_cleared(eflow_office_cash.requests),
  eflow_office_cash.head_can_fallback_settle(eflow_office_cash.requests, uuid),
  eflow_office_cash.guard_settlement()
from public, anon, authenticated;

create or replace function eflow_office_cash.snapshot(p_office uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  p public.profiles;
  balance numeric;
  reserved numeric;
  outstanding numeric;
  manager boolean;
begin
  p := eflow_office_cash.actor(p_office);
  manager := p.role = 'accounting_staff' or public.phase2_is_office_head(p.id, p_office);
  perform eflow_office_cash.ensure_fund(p_office);
  select cash into balance from eflow_office_cash.funds where office = p_office;
  select
    coalesce(sum(amount) filter (where status in ('pending', 'approved')), 0),
    coalesce(sum(amount) filter (where status in ('released', 'receipt_review', 'receipt_approved')), 0)
  into reserved, outstanding
  from eflow_office_cash.requests
  where office = p_office;

  return jsonb_build_object(
    'ceiling', 30000,
    'receiptLimit', 5000,
    'cash', coalesce(balance, 0),
    'reserved', reserved,
    'available', coalesce(balance, 0) - reserved,
    'outstanding', outstanding,
    'replenishable', 30000 - coalesce(balance, 0) - outstanding,
    'requests', coalesce((
      select jsonb_agg(
        to_jsonb(r) || jsonb_build_object(
          'requesterName', pr.full_name,
          'cashReturnReceivedByName', rec.full_name,
          'cashReturnApprovedByName', app.full_name,
          'returnClearanceRequired',
            r.status in ('receipt_review', 'receipt_approved', 'settled')
            and coalesce(r.returned_amount, 0) > 0,
          'returnReceived',
            coalesce(r.returned_amount, 0) > 0
            and r.cash_return_version is not distinct from r.receipt_version
            and r.cash_return_received_at is not null,
          'returnApproved', eflow_office_cash.cash_return_cleared(r),
          'returnHeadFallback',
            r.status in ('receipt_review', 'receipt_approved')
            and coalesce(r.returned_amount, 0) > 0
            and not eflow_office_cash.has_independent_return_receiver(r),
          'canAcknowledgeReturn',
            r.status in ('receipt_review', 'receipt_approved')
            and coalesce(r.returned_amount, 0) > 0
            and not (
              r.cash_return_version is not distinct from r.receipt_version
              and r.cash_return_received_at is not null
            )
            and eflow_office_cash.is_independent_return_receiver(r, p.id),
          'canApproveReturn',
            r.status in ('receipt_review', 'receipt_approved')
            and coalesce(r.returned_amount, 0) > 0
            and not (
              r.cash_return_version is not distinct from r.receipt_version
              and r.cash_return_approved_at is not null
            )
            and public.phase2_is_office_head(p.id, r.office)
            and p.id is distinct from r.requester
            and (
              (
                r.cash_return_version is not distinct from r.receipt_version
                and r.cash_return_received_at is not null
                and p.id is distinct from r.cash_return_received_by
              )
              or not eflow_office_cash.has_independent_return_receiver(r)
            ),
          'canSettle',
            r.status = 'receipt_approved'
            and eflow_office_cash.is_independent_settler(r, p.id),
          'headCanSettle', eflow_office_cash.head_can_fallback_settle(r, p.id),
          'settlementBlocked',
            r.status = 'receipt_approved'
            and not exists (
              select 1 from public.profiles candidate
              where candidate.org_id = r.office
                and eflow_office_cash.is_independent_settler(r, candidate.id)
            ),
          'headNotified', exists (
            select 1
            from eflow_office_cash.settlement_alerts a
            join public.organizations o on o.id = r.office and o.head_user_id = a.head_id
            where a.request_id = r.id
          )
        )
        order by r.created_at desc
      )
      from eflow_office_cash.requests r
      join public.profiles pr on pr.id = r.requester
      left join public.profiles rec on rec.id = r.cash_return_received_by
      left join public.profiles app on app.id = r.cash_return_approved_by
      where r.office = p_office
        and (manager or r.requester = p.id)
    ), '[]'),
    'events', coalesce((
      select jsonb_agg(
        to_jsonb(e) || jsonb_build_object('actorName', pr.full_name)
        order by e.id desc
      )
      from eflow_office_cash.events e
      join public.profiles pr on pr.id = e.actor
      where e.office = p_office
        and manager
    ), '[]')
  );
end $function$;

create or replace function eflow_office_cash.command(
  p_office uuid,
  p_key uuid,
  p_action text,
  p_data jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
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
begin
  p := eflow_office_cash.actor(p_office);
  if p_key is null or p_data is null then
    raise exception 'Command key and details required' using errcode = '22023';
  end if;

  -- Serialize retries by actor/key, then serialize all changes to an office balance.
  perform pg_advisory_xact_lock(hashtextextended(p.id::text || p_key::text, 0));
  select * into old from eflow_office_cash.commands where actor = p.id and key = p_key;
  if found then
    if old.payload <> payload then
      raise exception 'Retry must use the same details' using errcode = '22023';
    end if;
    return old.result;
  end if;

  perform eflow_office_cash.ensure_fund(p_office);
  select * into f from eflow_office_cash.funds where office = p_office for update;

  reference := btrim(coalesce(p_data->>'reference', ''));
  if length(reference) not between 1 and 1000 then
    raise exception 'Enter a purpose, decision reason or transaction reference' using errcode = '22023';
  end if;

  day := coalesce(nullif(p_data->>'date', '')::date, (now() at time zone 'Asia/Manila')::date);
  if day > (now() at time zone 'Asia/Manila')::date then
    raise exception 'Transaction date cannot be in the future' using errcode = '22023';
  end if;

  select
    coalesce(sum(amount) filter (where status in ('pending', 'approved')), 0),
    coalesce(sum(amount) filter (where status in ('released', 'receipt_review', 'receipt_approved')), 0)
  into reserved, outstanding
  from eflow_office_cash.requests
  where office = p_office;

  if p_action = 'replenish' then
    if p.role <> 'accounting_staff' then
      raise exception 'Only the Accounting Officer can replenish petty cash' using errcode = '42501';
    end if;
    amt := (p_data->>'amount')::numeric;
    if amt is null or amt <= 0 or amt <> round(amt, 2) or amt > 30000 - f.cash - outstanding then
      raise exception 'Replenishment exceeds the available imprest capacity (outstanding advances cannot be replenished)' using errcode = '22023';
    end if;
    if exists (
      select 1 from eflow_office_cash.events e
      where e.office = p_office and e.action = 'replenish' and e.reference = reference
    ) then
      raise exception 'This replenishment reference has already been recorded' using errcode = '22023';
    end if;
    update eflow_office_cash.funds set cash = cash + amt where office = p_office;

  elsif p_action = 'request' then
    if not exists (
      select 1 from public.profiles reviewer
      where reviewer.org_id = p_office
        and reviewer.is_active
        and reviewer.id <> p.id
        and public.phase2_is_office_head(reviewer.id, p_office)
    ) then
      raise exception 'An independent appointed Head is required to review your petty cash request' using errcode = '42501';
    end if;
    amt := (p_data->>'amount')::numeric;
    if amt is null or amt <= 0 or amt <> round(amt, 2) or amt > f.cash - reserved then
      raise exception 'Insufficient office petty cash. Available: %', f.cash - reserved using errcode = '22023';
    end if;
    insert into eflow_office_cash.requests(id, office, requester, purpose, amount)
    values (p_key, p_office, p.id, reference, amt)
    returning * into r;

  else
    select * into r
    from eflow_office_cash.requests
    where id = (p_data->>'request')::uuid and office = p_office
    for update;
    if not found then
      raise exception 'Petty cash request not found' using errcode = 'P0002';
    end if;
    amt := r.amount;

    if p_action in ('approve', 'reject', 'endorse', 'return_receipts') then
      if not public.phase2_is_office_head(p.id, p_office) or p.id = r.requester then
        raise exception 'Independent appointed Head review required' using errcode = '42501';
      end if;
      if p_action in ('approve', 'reject') and r.status <> 'pending' then
        raise exception 'Request is no longer pending' using errcode = '22023';
      end if;
      if p_action in ('endorse', 'return_receipts') and r.status <> 'receipt_review' then
        raise exception 'Receipts are not awaiting review' using errcode = '22023';
      end if;
      if p_action = 'return_receipts' then
        update eflow_office_cash.requests
        set status = 'released',
            cash_return_version = null,
            cash_return_received_by = null,
            cash_return_received_at = null,
            cash_return_receive_reference = null,
            cash_return_approved_by = null,
            cash_return_approved_at = null,
            cash_return_approval_note = null
        where id = r.id;
      else
        update eflow_office_cash.requests
        set status = case p_action
          when 'approve' then 'approved'
          when 'reject' then 'rejected'
          else 'receipt_approved'
        end
        where id = r.id;
      end if;

    elsif p_action = 'cancel' then
      if p.id <> r.requester or r.status not in ('pending', 'approved') then
        raise exception 'Only the requester can cancel unreleased cash' using errcode = '42501';
      end if;
      update eflow_office_cash.requests set status = 'cancelled' where id = r.id;

    elsif p_action = 'release' then
      if p.role <> 'accounting_staff' then
        raise exception 'Accounting Officer release required' using errcode = '42501';
      end if;
      if r.status <> 'approved' or f.cash < r.amount then
        raise exception 'Only approved, funded requests can be released' using errcode = '22023';
      end if;
      update eflow_office_cash.funds set cash = cash - r.amount where office = p_office;
      update eflow_office_cash.requests
      set status = 'released',
          released_at = now(),
          liquidation_due_at = now() + interval '15 days'
      where id = r.id;

    elsif p_action = 'receipts' then
      if p.id <> r.requester or r.status <> 'released' then
        raise exception 'Only the recipient can submit receipts for released cash' using errcode = '42501';
      end if;
      if jsonb_typeof(p_data->'receipts') is distinct from 'array'
        or jsonb_array_length(p_data->'receipts') not between 0 and 30
      then
        raise exception 'Add up to 30 receipts, or return the entire unspent advance' using errcode = '22023';
      end if;

      for receipt in select * from jsonb_array_elements(p_data->'receipts') loop
        amt := (receipt->>'amount')::numeric;
        path := receipt->>'path';
        if amt is null or amt <= 0 or amt > 5000 or amt <> round(amt, 2) then
          raise exception 'Each receipt must be greater than zero and at most PHP 5,000' using errcode = '22023';
        end if;
        if length(btrim(coalesce(receipt->>'number', ''))) not between 1 and 100
          or length(btrim(coalesce(receipt->>'vendor', ''))) not between 1 and 200
          or nullif(receipt->>'date', '')::date is null
          or (receipt->>'date')::date > day
        then
          raise exception 'Enter receipt vendor, number and valid date' using errcode = '22023';
        end if;
        if length(btrim(coalesce(receipt->>'description', ''))) > 300 then
          raise exception 'Receipt description must be 300 characters or less' using errcode = '22023';
        end if;
        if path is null
          or split_part(path, '/', 1) <> r.id::text
          or not exists (
            select 1 from storage.objects
            where bucket_id = 'office-petty-receipts'
              and name = path
              and owner_id = p.id::text
          )
        then
          raise exception 'Upload a receipt file for this request' using errcode = '22023';
        end if;
        if exists (
          select 1
          from eflow_office_cash.requests other
          cross join lateral jsonb_array_elements(other.receipts) item
          where other.office = p_office
            and other.id <> r.id
            and item->>'vendor' = receipt->>'vendor'
            and item->>'number' = receipt->>'number'
            and item->>'date' = receipt->>'date'
        ) then
          raise exception 'This receipt is already recorded against another petty cash request' using errcode = '22023';
        end if;
        total_spent := total_spent + amt;
      end loop;

      if (select count(distinct value->>'path') from jsonb_array_elements(p_data->'receipts')) <> jsonb_array_length(p_data->'receipts')
        or (select count(distinct (value->>'vendor', value->>'number', value->>'date')) from jsonb_array_elements(p_data->'receipts')) <> jsonb_array_length(p_data->'receipts')
      then
        raise exception 'Duplicate receipt' using errcode = '22023';
      end if;

      if total_spent > r.amount then
        raise exception 'Receipt total exceeds released petty cash' using errcode = '22023';
      end if;

      v_returned := round(r.amount - total_spent, 2);
      if v_returned > 0 then
        v_refund_no := btrim(coalesce(p_data->>'refundReceiptNumber', ''));
        if length(v_refund_no) not between 1 and 100 then
          raise exception 'Enter the official refund receipt number for the unspent cash being returned' using errcode = '22023';
        end if;
        v_refund_date := nullif(btrim(coalesce(p_data->>'refundDate', '')), '')::date;
        if v_refund_date is null or v_refund_date > day then
          raise exception 'Enter a valid cash return date on or before the transaction date' using errcode = '22023';
        end if;
      else
        v_refund_no := null;
        v_refund_date := null;
      end if;

      update eflow_office_cash.requests
      set receipts = p_data->'receipts',
          spent = total_spent,
          returned_amount = v_returned,
          refund_receipt_number = v_refund_no,
          refund_date = v_refund_date,
          liquidation_note = reference,
          receipt_version = coalesce(receipt_version, 0) + 1,
          cash_return_version = null,
          cash_return_received_by = null,
          cash_return_received_at = null,
          cash_return_receive_reference = null,
          cash_return_approved_by = null,
          cash_return_approved_at = null,
          cash_return_approval_note = null,
          status = 'receipt_review'
      where id = r.id;

      event_details := p_data || jsonb_build_object(
        'spent', total_spent,
        'returnedAmount', v_returned,
        'refundReceiptNumber', v_refund_no,
        'refundDate', v_refund_date
      );
      amt := total_spent;

    elsif p_action = 'acknowledge_return' then
      perform 1 from public.organizations where id = p_office for share;
      perform 1 from public.profiles where org_id = p_office order by id for share;

      if r.status not in ('receipt_review', 'receipt_approved') then
        raise exception 'Cash return can only be acknowledged after receipts are submitted' using errcode = '22023';
      end if;
      if coalesce(r.returned_amount, 0) <= 0 then
        raise exception 'This request has no unspent cash to return' using errcode = '22023';
      end if;
      if p_data ? 'receiptVersion' and nullif(p_data->>'receiptVersion', '') is not null then
        v_req_version := (p_data->>'receiptVersion')::integer;
        if v_req_version is distinct from r.receipt_version then
          raise exception 'The receipt package changed. Refresh and verify the current return amount.' using errcode = '22023';
        end if;
      end if;
      if not eflow_office_cash.is_independent_return_receiver(r, p.id) then
        raise exception 'An independent Accounting Officer must acknowledge physical receipt of returned cash' using errcode = '42501';
      end if;
      if r.cash_return_version is not distinct from r.receipt_version and r.cash_return_received_at is not null then
        raise exception 'This cash return was already acknowledged by Accounting' using errcode = '22023';
      end if;

      update eflow_office_cash.requests
      set cash_return_version = r.receipt_version,
          cash_return_received_by = p.id,
          cash_return_received_at = now(),
          cash_return_receive_reference = reference,
          cash_return_approved_by = null,
          cash_return_approved_at = null,
          cash_return_approval_note = null
      where id = r.id;

      insert into public.notifications(
        user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type
      )
      select
        o.head_user_id,
        'petty_cash_return_received',
        'Office petty cash return received — Head approval required',
        format(
          '%s acknowledged physical receipt of PHP %s for "%s". Approve the cash return before settlement.',
          coalesce(p.full_name, 'Accounting'),
          to_char(r.returned_amount, 'FM999,999,990.00'),
          r.purpose
        ),
        p_office,
        p.id,
        coalesce(p.full_name, ''),
        r.id,
        'office_petty_cash'
      from public.organizations o
      join public.profiles h on h.id = o.head_user_id
      where o.id = p_office
        and o.is_active
        and h.is_active
        and h.org_id = o.id
        and h.role = 'head'
        and h.id is distinct from p.id
        and h.id is distinct from r.requester;

      event_details := p_data || jsonb_build_object(
        'returnedAmount', r.returned_amount,
        'receiptVersion', r.receipt_version
      );
      amt := r.returned_amount;

    elsif p_action = 'approve_return' then
      perform 1 from public.organizations where id = p_office for share;
      perform 1 from public.profiles where org_id = p_office order by id for share;

      if r.status not in ('receipt_review', 'receipt_approved') then
        raise exception 'Cash return can only be approved after receipts are submitted' using errcode = '22023';
      end if;
      if coalesce(r.returned_amount, 0) <= 0 then
        raise exception 'This request has no unspent cash to return' using errcode = '22023';
      end if;
      if p_data ? 'receiptVersion' and nullif(p_data->>'receiptVersion', '') is not null then
        v_req_version := (p_data->>'receiptVersion')::integer;
        if v_req_version is distinct from r.receipt_version then
          raise exception 'The receipt package changed. Refresh and verify the current return amount.' using errcode = '22023';
        end if;
      end if;
      if not public.phase2_is_office_head(p.id, p_office) or p.id = r.requester then
        raise exception 'Independent appointed Office Head approval is required for returned cash' using errcode = '42501';
      end if;
      if r.cash_return_version is not distinct from r.receipt_version and r.cash_return_approved_at is not null then
        raise exception 'This cash return was already approved by the Office Head' using errcode = '22023';
      end if;

      v_has_indep_return := eflow_office_cash.has_independent_return_receiver(r);
      if v_has_indep_return then
        if r.cash_return_version is distinct from r.receipt_version
          or r.cash_return_received_at is null
          or r.cash_return_received_by is null
        then
          raise exception 'Accounting must acknowledge physical receipt of the returned cash before Head approval' using errcode = '22023';
        end if;
        if p.id = r.cash_return_received_by then
          raise exception 'A separate Office Head must approve the cash return' using errcode = '42501';
        end if;

        update eflow_office_cash.requests
        set cash_return_approved_by = p.id,
            cash_return_approved_at = now(),
            cash_return_approval_note = reference
        where id = r.id;
      else
        -- No independent Accounting Officer exists in the office (e.g. sole Accountant requested cash).
        v_head_fallback := true;
        update eflow_office_cash.requests
        set cash_return_version = r.receipt_version,
            cash_return_received_by = coalesce(
              case when cash_return_version is not distinct from r.receipt_version then cash_return_received_by end,
              p.id
            ),
            cash_return_received_at = coalesce(
              case when cash_return_version is not distinct from r.receipt_version then cash_return_received_at end,
              now()
            ),
            cash_return_receive_reference = coalesce(
              case when cash_return_version is not distinct from r.receipt_version then cash_return_receive_reference end,
              'Head fallback receipt: ' || reference
            ),
            cash_return_approved_by = p.id,
            cash_return_approved_at = now(),
            cash_return_approval_note = reference
        where id = r.id;
      end if;

      if r.status = 'receipt_approved' then
        perform eflow_office_cash.notify_blocked_settlements(r.id);
      end if;

      insert into public.notifications(
        user_id, type, title, message, org_id, actor_id, actor_name, financial_record_id, financial_record_type
      )
      select
        acc.id,
        'petty_cash_return_approved',
        'Office petty cash return approved — ready to settle',
        format(
          '%s approved the PHP %s cash return for "%s". Settlement can now proceed.',
          coalesce(p.full_name, 'Office Head'),
          to_char(r.returned_amount, 'FM999,999,990.00'),
          r.purpose
        ),
        p_office,
        p.id,
        coalesce(p.full_name, ''),
        r.id,
        'office_petty_cash'
      from public.profiles acc
      where acc.org_id = p_office
        and acc.is_active
        and acc.role = 'accounting_staff'
        and acc.id is distinct from r.requester
        and acc.id is distinct from p.id;

      event_details := p_data || jsonb_build_object(
        'returnedAmount', r.returned_amount,
        'receiptVersion', r.receipt_version,
        'headFallback', v_head_fallback
      );
      amt := r.returned_amount;

    elsif p_action = 'settle' then
      perform 1 from public.organizations where id = p_office for share;
      perform 1 from public.profiles where org_id = p_office order by id for share;

      if r.status <> 'receipt_approved' then
        raise exception 'Independent receipt endorsement required before settlement' using errcode = '22023';
      end if;
      if not eflow_office_cash.is_independent_settler(r, p.id) then
        if eflow_office_cash.head_can_fallback_settle(r, p.id) then
          v_head_fallback := true;
        else
          raise exception 'A separate Accounting Officer must settle this request' using errcode = '42501';
        end if;
      end if;
      if coalesce(r.returned_amount, 0) > 0 and not eflow_office_cash.cash_return_cleared(r) then
        raise exception 'Accounting must acknowledge the exact cash return and an independent Office Head must approve it before settlement' using errcode = '42501';
      end if;

      update eflow_office_cash.funds set cash = cash + (r.amount - r.spent) where office = p_office;
      update eflow_office_cash.requests set status = 'settled' where id = r.id;

      event_details := p_data || jsonb_build_object(
        'spent', r.spent,
        'returnedAmount', r.returned_amount,
        'refundReceiptNumber', r.refund_receipt_number,
        'headFallback', v_head_fallback
      );
      amt := r.spent;

    else
      raise exception 'Unknown petty cash action' using errcode = '22023';
    end if;

    update eflow_office_cash.requests set updated_at = clock_timestamp() where id = r.id;
  end if;

  insert into eflow_office_cash.events(office, request, actor, action, amount, reference, occurred_on, details)
  values (p_office, r.id, p.id, p_action, amt, reference, day, event_details);

  result := jsonb_build_object('request', r.id, 'saved', true);
  insert into eflow_office_cash.commands values (p.id, p_key, payload, result);
  return result;
end $function$;

commit;
