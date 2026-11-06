begin;

create function eflow_finance_review.eligible_settlement_officers(
  r public.petty_cash_requests, receipt_reviewer uuid, independent_reviewer uuid
)
returns setof uuid
language sql stable set search_path = ''
as $$
  select p.id from public.profiles p
  where p.org_id = r.org_id and p.is_active and p.role = 'accounting_staff'
    and public.has_permission(p.id, 'accounting.settle_liquidation')
    and not eflow_finance_review.conflicted(r, p.id)
    and p.id is distinct from receipt_reviewer
    and p.id is distinct from independent_reviewer;
$$;

create or replace function public.get_liquidation_independent_review(p_liquidation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.petty_cash_liquidations;r public.petty_cash_requests;v public.liquidation_independent_reviews;
 candidates jsonb;settlers integer;
begin
 select * into l from public.petty_cash_liquidations where id=p_liquidation_id;
 select * into r from public.petty_cash_requests where id=l.request_id;
 if r.id is null or not eflow_finance_review.scope_allowed(r.org_id,auth.uid()) then
  raise exception 'Independent review access denied' using errcode='42501';end if;
 select * into v from public.liquidation_independent_reviews where liquidation_id=l.id and version=l.version;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'appointment',
  case when p.id=o.head_user_id then 'Head' else 'Assistant Head' end) order by p.full_name),'[]'::jsonb)
 into candidates from public.profiles p join public.organizations o on o.id=r.org_id
 where eflow_finance_review.eligible_reviewer(r,p.id);
 select count(*) into settlers from eflow_finance_review.eligible_settlement_officers(r,l.leader_decided_by,v.reviewer_id);
 return jsonb_build_object('liquidationId',l.id,'version',l.version,'required',eflow_finance_review.required(r) or v.id is not null,
  'review',case when v.id is null then null else to_jsonb(v) end,'candidates',candidates,'eligibleSettlers',settlers,
  'canReview',coalesce(v.reviewer_id=auth.uid() and eflow_finance_review.eligible_reviewer(r,auth.uid()),false),
  'canSettle',public.is_department_accounting_staff(r.org_id,auth.uid()) and public.has_permission(auth.uid(),'accounting.settle_liquidation')
   and not eflow_finance_review.conflicted(r,auth.uid()) and auth.uid() is distinct from l.leader_decided_by and auth.uid() is distinct from v.reviewer_id,
  'current',coalesce(v.fingerprint=eflow_finance_review.fingerprint(l,r),false),
  'escalationRequired',jsonb_array_length(candidates)=0 or settlers=0);
end $$;

-- Keep a durable delivery key even if the recipient clears their Inbox.
create table eflow_finance_review.settlement_blocker_alerts (
  liquidation_id uuid not null references public.petty_cash_liquidations(id) on delete cascade,
  version integer not null,
  head_id uuid not null references public.profiles(id) on delete cascade,
  primary key (liquidation_id, version, head_id)
);
alter table eflow_finance_review.settlement_blocker_alerts enable row level security;

create function eflow_finance_review.notify_blocked_settlements(p_request_id uuid default null)
returns void language sql set search_path = ''
as $$
  with blocked as materialized (
    select l.id, l.version, l.liquidation_number, h.id as head_id
    from public.petty_cash_liquidations l
    join public.petty_cash_requests r on r.id = l.request_id
    join public.organizations o on o.id = r.org_id and o.is_active
    join public.profiles h on h.id = o.head_user_id
      and h.org_id = o.id and h.is_active and h.role = 'head'
    left join public.liquidation_independent_reviews v
      on v.liquidation_id = l.id and v.version = l.version
    where l.status = 'pending_department_settlement'
      and r.status = 'pending_department_settlement'
      and (p_request_id is null or r.id = p_request_id)
      and not exists (
        select 1 from eflow_finance_review.settlement_blocker_alerts a
        where (a.liquidation_id, a.version, a.head_id) = (l.id, l.version, h.id)
      )
      and not exists (
        select 1 from eflow_finance_review.eligible_settlement_officers(r, l.leader_decided_by, v.reviewer_id)
      )
  ), delivered as (
    insert into eflow_finance_review.settlement_blocker_alerts (liquidation_id, version, head_id)
    select id, version, head_id from blocked order by id, version, head_id
    on conflict do nothing
    returning liquidation_id, version, head_id
  )
  insert into public.notifications (user_id, type, title, message, financial_record_id, financial_record_type)
  select d.head_id, 'petty_cash_settlement_blocked', 'Settlement needs an Accounting Officer',
    format('%s is waiting for settlement. No independent Accounting Officer in your office can settle it. Review Accounting access and arrange for another eligible officer.',
      coalesce(b.liquidation_number, 'A liquidation')),
    d.liquidation_id, 'settlement_staffing'
  from delivered d
  join blocked b on (b.id, b.version, b.head_id) = (d.liquidation_id, d.version, d.head_id);
$$;

create function eflow_finance_review.check_settlement_staffing()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'petty_cash_requests' then
    perform eflow_finance_review.notify_blocked_settlements(new.id);
  else
    perform eflow_finance_review.notify_blocked_settlements(new.request_id);
  end if;
  return new;
end;
$$;

revoke all on function eflow_finance_review.eligible_settlement_officers(public.petty_cash_requests, uuid, uuid),
  eflow_finance_review.notify_blocked_settlements(uuid), eflow_finance_review.check_settlement_staffing()
  from public, anon, authenticated;

-- Both records must be ready. Watch both because callers can write in either order.
create trigger check_request_settlement_staffing
after insert or update of status on public.petty_cash_requests
for each row when (new.status = 'pending_department_settlement')
execute function eflow_finance_review.check_settlement_staffing();

create trigger check_liquidation_settlement_staffing
after insert or update of status, version, leader_decided_by on public.petty_cash_liquidations
for each row when (new.status = 'pending_department_settlement')
execute function eflow_finance_review.check_settlement_staffing();

-- Pick up existing cases and recheck when personnel, permissions or reviewer assignments change.
select eflow_finance_review.notify_blocked_settlements();
select cron.schedule('eflow-settlement-staffing-alerts', '*/5 * * * *',
  'select eflow_finance_review.notify_blocked_settlements()');

commit;
