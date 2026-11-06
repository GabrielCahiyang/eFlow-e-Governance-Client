begin;

create function eflow_office_cash.is_independent_settler(r eflow_office_cash.requests, actor uuid)
returns boolean language sql stable set search_path='' as $$
  select actor is distinct from r.requester
    and actor is distinct from (
      select e.actor from eflow_office_cash.events e
      where e.request=r.id and e.action='endorse' order by e.id desc limit 1
    )
    and exists (
      select 1 from public.profiles p
      where p.id=actor and p.org_id=r.office and p.is_active and p.role='accounting_staff'
    );
$$;

create table eflow_office_cash.settlement_alerts (
  request_id uuid not null references eflow_office_cash.requests(id) on delete cascade,
  head_id uuid not null references public.profiles(id) on delete cascade,
  primary key (request_id,head_id)
);
alter table eflow_office_cash.settlement_alerts enable row level security;

create function eflow_office_cash.notify_blocked_settlements(p_request uuid default null)
returns void language sql set search_path='' as $$
  with blocked as materialized (
    select r.id,r.office,o.head_user_id as head_id from eflow_office_cash.requests r
    join public.organizations o on o.id=r.office and o.is_active
    where r.status='receipt_approved' and (p_request is null or p_request=r.id)
      and public.phase2_is_office_head(o.head_user_id,o.id)
      and not exists (select 1 from eflow_office_cash.settlement_alerts a
        where a.request_id=r.id and a.head_id=o.head_user_id)
      and not exists (select 1 from public.profiles p where p.org_id=r.office
        and eflow_office_cash.is_independent_settler(r,p.id))
  ), delivered as (
    insert into eflow_office_cash.settlement_alerts (request_id,head_id)
    select id,head_id from blocked order by id,head_id
    on conflict do nothing returning request_id,head_id
  )
  insert into public.notifications(user_id,type,title,message,org_id,financial_record_id,financial_record_type)
  select d.head_id,'petty_cash_settlement_blocked','Office petty cash needs an Accounting Officer',
    'No eligible Accounting Officer can settle this request. Open Office Petty Cash to review it.',
    b.office,d.request_id,'office_petty_cash_staffing'
  from delivered d join blocked b on b.id=d.request_id and b.head_id=d.head_id;
$$;

create function eflow_office_cash.notify_after_endorsement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform eflow_office_cash.notify_blocked_settlements(new.request);
  return new;
end $$;

revoke all on function eflow_office_cash.is_independent_settler(eflow_office_cash.requests,uuid),
  eflow_office_cash.notify_blocked_settlements(uuid),eflow_office_cash.notify_after_endorsement()
  from public,anon,authenticated;

create trigger notify_office_cash_settlement_blocker after insert on eflow_office_cash.events
for each row when (new.action='endorse') execute function eflow_office_cash.notify_after_endorsement();

CREATE OR REPLACE FUNCTION eflow_office_cash.snapshot(p_office uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.profiles;balance numeric;reserved numeric;outstanding numeric;manager boolean;
begin
 p:=eflow_office_cash.actor(p_office);manager:=p.role='accounting_staff' or public.phase2_is_office_head(p.id,p_office);
 perform eflow_office_cash.ensure_fund(p_office);
 select cash into balance from eflow_office_cash.funds where office=p_office;
 select coalesce(sum(amount) filter(where status in ('pending','approved')),0),coalesce(sum(amount) filter(where status in ('released','receipt_review','receipt_approved')),0) into reserved,outstanding from eflow_office_cash.requests where office=p_office;
 return jsonb_build_object('ceiling',30000,'receiptLimit',5000,'cash',coalesce(balance,0),'reserved',reserved,'available',coalesce(balance,0)-reserved,'outstanding',outstanding,'replenishable',30000-coalesce(balance,0)-outstanding,
 'requests',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('requesterName',pr.full_name,
   'canSettle',r.status='receipt_approved' and eflow_office_cash.is_independent_settler(r,p.id),
   'settlementBlocked',r.status='receipt_approved' and not exists (
     select 1 from public.profiles candidate where candidate.org_id=r.office
       and eflow_office_cash.is_independent_settler(r,candidate.id)),
   'headNotified',exists (select 1 from eflow_office_cash.settlement_alerts a
     join public.organizations o on o.id=r.office and o.head_user_id=a.head_id where a.request_id=r.id)) order by r.created_at desc) from eflow_office_cash.requests r join public.profiles pr on pr.id=r.requester where r.office=p_office and (manager or r.requester=p.id)),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('actorName',pr.full_name) order by e.id desc) from eflow_office_cash.events e join public.profiles pr on pr.id=e.actor where e.office=p_office and manager),'[]'));
end $function$
;
CREATE OR REPLACE FUNCTION eflow_office_cash.command(p_office uuid, p_key uuid, p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.profiles;f eflow_office_cash.funds;r eflow_office_cash.requests;old eflow_office_cash.commands;
 payload jsonb:=jsonb_build_object('office',p_office,'action',p_action,'data',p_data);result jsonb;
 amt numeric;reserved numeric;outstanding numeric;total_spent numeric:=0;receipt jsonb;reference text;day date;path text;
begin
 p:=eflow_office_cash.actor(p_office);
 if p_key is null or p_data is null then raise exception 'Command key and details required';end if;
 -- Serialize retries by actor/key, then serialize all changes to an office balance.
 perform pg_advisory_xact_lock(hashtextextended(p.id::text||p_key::text,0));
 select * into old from eflow_office_cash.commands where actor=p.id and key=p_key;
 if found then if old.payload<>payload then raise exception 'Retry must use the same details';end if;return old.result;end if;
 perform eflow_office_cash.ensure_fund(p_office);
 select * into f from eflow_office_cash.funds where office=p_office for update;
 reference:=btrim(coalesce(p_data->>'reference',''));
 if length(reference) not between 1 and 1000 then raise exception 'Enter a purpose, decision reason or transaction reference';end if;
 day:=coalesce(nullif(p_data->>'date','')::date,(now() at time zone 'Asia/Manila')::date);
 if day>(now() at time zone 'Asia/Manila')::date then raise exception 'Transaction date cannot be in the future';end if;
 select coalesce(sum(amount) filter(where status in ('pending','approved')),0),coalesce(sum(amount) filter(where status in ('released','receipt_review','receipt_approved')),0) into reserved,outstanding from eflow_office_cash.requests where office=p_office;
 if p_action='replenish' then
  if p.role<>'accounting_staff' then raise exception 'Only the Accounting Officer can replenish petty cash' using errcode='42501';end if;
  amt:=(p_data->>'amount')::numeric;
  if amt is null or amt<=0 or amt<>round(amt,2) or amt>30000-f.cash-outstanding then raise exception 'Replenishment exceeds the available imprest capacity (outstanding advances cannot be replenished)';end if;
  if exists(select 1 from eflow_office_cash.events e where e.office=p_office and e.action='replenish' and e.reference=btrim(p_data->>'reference')) then raise exception 'This replenishment reference has already been recorded';end if;
  update eflow_office_cash.funds set cash=cash+amt where office=p_office;
 elsif p_action='request' then
  if not exists(select 1 from public.profiles reviewer where reviewer.org_id=p_office and reviewer.is_active and reviewer.id<>p.id and public.phase2_is_office_head(reviewer.id,p_office)) then raise exception 'An independent appointed Head is required to review your petty cash request';end if;
  amt:=(p_data->>'amount')::numeric;
  if amt is null or amt<=0 or amt<>round(amt,2) or amt>f.cash-reserved then raise exception 'Insufficient office petty cash. Available: %',f.cash-reserved;end if;
  insert into eflow_office_cash.requests(id,office,requester,purpose,amount) values(p_key,p_office,p.id,reference,amt) returning * into r;
 else
  select * into r from eflow_office_cash.requests where id=(p_data->>'request')::uuid and office=p_office for update;
  if not found then raise exception 'Petty cash request not found';end if;
  amt:=r.amount;
  if p_action in ('approve','reject','endorse','return_receipts') then
   if not public.phase2_is_office_head(p.id,p_office) or p.id=r.requester then raise exception 'Independent appointed Head review required' using errcode='42501';end if;
   if p_action in ('approve','reject') and r.status<>'pending' then raise exception 'Request is no longer pending';end if;
   if p_action in ('endorse','return_receipts') and r.status<>'receipt_review' then raise exception 'Receipts are not awaiting review';end if;
   update eflow_office_cash.requests set status=case p_action when 'approve' then 'approved' when 'reject' then 'rejected' when 'endorse' then 'receipt_approved' else 'released' end where id=r.id;
  elsif p_action='cancel' then
   if p.id<>r.requester or r.status not in ('pending','approved') then raise exception 'Only the requester can cancel unreleased cash' using errcode='42501';end if;
   update eflow_office_cash.requests set status='cancelled' where id=r.id;
  elsif p_action='release' then
   if p.role<>'accounting_staff' then raise exception 'Accounting Officer release required' using errcode='42501';end if;
   if r.status<>'approved' or f.cash<r.amount then raise exception 'Only approved, funded requests can be released';end if;
   update eflow_office_cash.funds set cash=cash-r.amount where office=p_office;
   update eflow_office_cash.requests set status='released' where id=r.id;
  elsif p_action='receipts' then
   if p.id<>r.requester or r.status<>'released' then raise exception 'Only the recipient can submit receipts for released cash' using errcode='42501';end if;
   if jsonb_typeof(p_data->'receipts') is distinct from 'array' or jsonb_array_length(p_data->'receipts') not between 0 and 30 then raise exception 'Add up to 30 receipts, or return the entire unspent advance';end if;
   for receipt in select * from jsonb_array_elements(p_data->'receipts') loop
    amt:=(receipt->>'amount')::numeric;path:=receipt->>'path';
    if amt is null or amt<=0 or amt>5000 or amt<>round(amt,2) then raise exception 'Each receipt must be greater than zero and at most PHP 5,000';end if;
    if length(btrim(coalesce(receipt->>'number',''))) not between 1 and 100 or length(btrim(coalesce(receipt->>'vendor',''))) not between 1 and 200 or nullif(receipt->>'date','')::date is null or (receipt->>'date')::date>day then raise exception 'Enter receipt vendor, number and valid date';end if;
    if path is null or split_part(path,'/',1)<>r.id::text or not exists(select 1 from storage.objects where bucket_id='office-petty-receipts' and name=path and owner_id=p.id::text) then raise exception 'Upload a receipt file for this request';end if;
    if exists(select 1 from eflow_office_cash.requests other cross join lateral jsonb_array_elements(other.receipts) item where other.office=p_office and other.id<>r.id and item->>'vendor'=receipt->>'vendor' and item->>'number'=receipt->>'number' and item->>'date'=receipt->>'date') then raise exception 'This receipt is already recorded against another petty cash request';end if;
    total_spent:=total_spent+amt;
   end loop;
   if (select count(distinct value->>'path') from jsonb_array_elements(p_data->'receipts'))<>jsonb_array_length(p_data->'receipts') or (select count(distinct (value->>'vendor',value->>'number',value->>'date')) from jsonb_array_elements(p_data->'receipts'))<>jsonb_array_length(p_data->'receipts') then raise exception 'Duplicate receipt';end if;
   if total_spent>r.amount then raise exception 'Receipt total exceeds released petty cash';end if;
   update eflow_office_cash.requests set receipts=p_data->'receipts',spent=total_spent,status='receipt_review' where id=r.id;
   amt:=total_spent;
  elsif p_action='settle' then
   perform 1 from public.profiles where id=p.id for share;
   if not eflow_office_cash.is_independent_settler(r,p.id) then
    raise exception 'A separate Accounting Officer must settle this request' using errcode='42501';
   end if;
   if r.status<>'receipt_approved' then raise exception 'Independent receipt endorsement required before settlement';end if;
   -- Reference confirms any unspent physical cash has actually been returned.
   update eflow_office_cash.funds set cash=cash+r.amount-r.spent where office=p_office;
   update eflow_office_cash.requests set status='settled' where id=r.id;
   amt:=r.spent;
  else raise exception 'Unknown petty cash action';end if;
  update eflow_office_cash.requests set updated_at=clock_timestamp() where id=r.id;
 end if;
 insert into eflow_office_cash.events(office,request,actor,action,amount,reference,occurred_on,details) values(p_office,r.id,p.id,p_action,amt,reference,day,p_data);
 result:=jsonb_build_object('request',r.id,'saved',true);
 insert into eflow_office_cash.commands values(p.id,p_key,payload,result);
 return result;
end $function$
;

select eflow_office_cash.notify_blocked_settlements();
select cron.schedule('eflow-office-cash-settlement-staffing','*/5 * * * *',
  'select eflow_office_cash.notify_blocked_settlements()');

commit;
