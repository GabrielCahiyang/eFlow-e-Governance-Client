begin;

create table eflow_finance_review.staffing_escalation_approvals (
  command_id uuid primary key,
  liquidation_id uuid not null references public.petty_cash_liquidations(id) on delete cascade,
  version integer not null,
  head_id uuid not null references public.profiles(id),
  fingerprint text not null,
  reason text not null,
  approved_at timestamptz not null default now(),
  unique (liquidation_id, version, fingerprint, head_id)
);
alter table eflow_finance_review.staffing_escalation_approvals enable row level security;

-- This approval covers an escalated staffing gap. It does not make the
-- original receipt reviewer independent or grant Accounting authority.
create function eflow_finance_review.staffing_escalation_head(
  l public.petty_cash_liquidations, r public.petty_cash_requests, actor uuid
)
returns boolean language sql stable set search_path='' as $$
  select actor is not null and actor=l.leader_decided_by
    and actor is distinct from r.requester_id and actor is distinct from r.cash_recipient_id
    and exists (
      select 1 from public.organizations o
      join public.profiles p on p.id=o.head_user_id and p.org_id=o.id
      join eflow_finance_review.settlement_blocker_alerts a on a.head_id=p.id
      where o.id=r.org_id and o.is_active and p.id=actor and p.is_active and p.role='head'
        and a.liquidation_id=l.id and a.version=l.version
    );
$$;

create function eflow_finance_review.staffing_escalation_approver(
  l public.petty_cash_liquidations, r public.petty_cash_requests
)
returns uuid language sql stable set search_path='' as $$
  select a.head_id from eflow_finance_review.staffing_escalation_approvals a
  where a.liquidation_id=l.id and a.version=l.version
    and a.fingerprint=eflow_finance_review.fingerprint(l,r)
    and eflow_finance_review.staffing_escalation_head(l,r,a.head_id)
  limit 1;
$$;

create function public.approve_liquidation_staffing_escalation(
  p_liquidation_id uuid, p_version integer, p_fingerprint text, p_reason text, p_idempotency_key uuid
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  l public.petty_cash_liquidations; r public.petty_cash_requests;
  prior eflow_finance_review.staffing_escalation_approvals;
  caller uuid:=auth.uid();
begin
  if caller is null then raise exception 'Current Office Head access required' using errcode='42501'; end if;
  if p_version is null or p_idempotency_key is null or p_fingerprint is null
     or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'Enter a reason and verify the current package' using errcode='22023';
  end if;
  perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations x
    join public.petty_cash_requests c on c.id=x.request_id where x.id=p_liquidation_id));
  select * into l from public.petty_cash_liquidations where id=p_liquidation_id for update;
  select * into r from public.petty_cash_requests where id=l.request_id for update;
  if r.id is null then raise exception 'Liquidation unavailable' using errcode='42501'; end if;
  perform eflow_finance_review.lock_authority(r.org_id,array[caller]);
  if not coalesce(eflow_finance_review.staffing_escalation_head(l,r,caller),false) then
    raise exception 'Only the notified Office Head who reviewed the receipts may approve this escalation' using errcode='42501';
  end if;
  select * into prior from eflow_finance_review.staffing_escalation_approvals where command_id=p_idempotency_key;
  if found then
    if (prior.liquidation_id,prior.version,prior.head_id,prior.fingerprint,prior.reason)
      is distinct from (l.id,p_version,caller,p_fingerprint,btrim(p_reason)) then
      raise exception 'This approval identity was already used' using errcode='22023';
    end if;
    return prior.command_id;
  end if;
  if l.version<>p_version or l.status<>'pending_department_settlement' or r.status<>'pending_department_settlement'
    or p_fingerprint<>eflow_finance_review.fingerprint(l,r) then
    raise exception 'The receipt package changed. Review the current version.' using errcode='22023';
  end if;
  if exists(select 1 from public.profiles p where p.org_id=r.org_id
     and eflow_finance_review.eligible_reviewer(r,p.id)) then
    raise exception 'Send this package to the available independent reviewer' using errcode='42501';
  end if;
  if eflow_finance_review.staffing_escalation_approver(l,r) is not null then
    raise exception 'The Head already approved this escalation' using errcode='22023';
  end if;
  insert into eflow_finance_review.staffing_escalation_approvals
    (command_id,liquidation_id,version,head_id,fingerprint,reason)
  values (p_idempotency_key,l.id,l.version,caller,p_fingerprint,btrim(p_reason));
  insert into public.notifications (user_id,type,title,message,reason,financial_record_id,financial_record_type,task_id,actor_id)
  values (r.cash_recipient_id,'petty_cash_liquidation_decision','Head approved settlement review',
    'A separate eligible Accounting Officer must settle and post.',btrim(p_reason),l.id,'petty_cash_liquidation',r.task_id,caller);
  return p_idempotency_key;
end $$;
revoke all on function eflow_finance_review.staffing_escalation_head(public.petty_cash_liquidations,public.petty_cash_requests,uuid),
  eflow_finance_review.staffing_escalation_approver(public.petty_cash_liquidations,public.petty_cash_requests)
  from public,anon,authenticated;
revoke all on function public.approve_liquidation_staffing_escalation(uuid,integer,text,text,uuid) from public,anon;
grant execute on function public.approve_liquidation_staffing_escalation(uuid,integer,text,text,uuid) to authenticated;

-- Report the recorded alert for the current Office Head and liquidation version.
create or replace function public.get_liquidation_independent_review(p_liquidation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.petty_cash_liquidations;r public.petty_cash_requests;v public.liquidation_independent_reviews;
 candidates jsonb;settlers integer; escalation_approver uuid; can_approve_escalation boolean;
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
 escalation_approver:=eflow_finance_review.staffing_escalation_approver(l,r);
 can_approve_escalation:=l.status='pending_department_settlement' and r.status='pending_department_settlement'
   and escalation_approver is null and jsonb_array_length(candidates)=0
   and coalesce(eflow_finance_review.staffing_escalation_head(l,r,auth.uid()),false);
 return jsonb_build_object('liquidationId',l.id,'version',l.version,'required',eflow_finance_review.required(r) or v.id is not null,
  'review',case when v.id is null then null else to_jsonb(v) end,'candidates',candidates,'eligibleSettlers',settlers,
  'canReview',coalesce(v.reviewer_id=auth.uid() and eflow_finance_review.eligible_reviewer(r,auth.uid()),false),
  'canSettle',public.is_department_accounting_staff(r.org_id,auth.uid()) and public.has_permission(auth.uid(),'accounting.settle_liquidation')
   and not eflow_finance_review.conflicted(r,auth.uid()) and auth.uid() is distinct from l.leader_decided_by and auth.uid() is distinct from v.reviewer_id,
  'current',coalesce(v.fingerprint=eflow_finance_review.fingerprint(l,r),false),
  'headEscalationApproved',escalation_approver is not null,
  'headEscalationCommandId',case when escalation_approver=auth.uid() then (
    select a.command_id from eflow_finance_review.staffing_escalation_approvals a
    where a.liquidation_id=l.id and a.version=l.version and a.head_id=escalation_approver
      and a.fingerprint=eflow_finance_review.fingerprint(l,r)
  ) end,
  'headEscalationFingerprint',case when can_approve_escalation then eflow_finance_review.fingerprint(l,r) end,
  'headAlertStatus', case when settlers=0
    and l.status='pending_department_settlement' and r.status='pending_department_settlement' then (
      select case when h.id is null then 'no_head'
        when a.liquidation_id is not null then 'notified'
        else 'pending' end
      from public.organizations o
      left join public.profiles h on h.id=o.head_user_id
        and h.org_id=o.id and h.is_active and h.role='head' and o.is_active
      left join eflow_finance_review.settlement_blocker_alerts a
        on a.liquidation_id=l.id and a.version=l.version and a.head_id=h.id
      where o.id=r.org_id
    ) end,
  'escalationRequired',jsonb_array_length(candidates)=0 or settlers=0);
end $$;

create or replace function public.settle_accounting_liquidation(p_liquidation_id uuid,p_approve boolean,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare
  l public.petty_cash_liquidations; r public.petty_cash_requests; v public.liquidation_independent_reviews;
  caller uuid:=auth.uid(); reviewer uuid; used_escalation boolean:=false;
begin
  perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations x
    join public.petty_cash_requests c on c.id=x.request_id where x.id=p_liquidation_id));
  select * into l from public.petty_cash_liquidations where id=p_liquidation_id for update;
  select * into r from public.petty_cash_requests where id=l.request_id for update;
  if r.id is null or not public.is_department_accounting_staff(r.org_id,caller)
    or not public.has_permission(caller,'accounting.settle_liquidation')
    or eflow_finance_review.conflicted(r,caller) or caller=l.leader_decided_by then
    raise exception 'A separate eligible Accounting Officer must settle this package' using errcode='42501';
  end if;
  if p_approve is null then raise exception 'Choose a settlement decision' using errcode='22023'; end if;
  select * into v from public.liquidation_independent_reviews where liquidation_id=l.id and version=l.version for update;
  if v.id is not null or eflow_finance_review.required(r) then
    if v.status='approved' and v.fingerprint=eflow_finance_review.fingerprint(l,r)
      and eflow_finance_review.eligible_reviewer(r,v.reviewer_id) then
      reviewer:=v.reviewer_id;
    else
      reviewer:=eflow_finance_review.staffing_escalation_approver(l,r);
      used_escalation:=true;
    end if;
    if reviewer is null or reviewer=caller then
      raise exception 'Current Head or independent leadership approval is required before settlement' using errcode='42501';
    end if;
  end if;
  if p_approve and r.liquidation_due_at is not null and l.submitted_at>r.liquidation_due_at and l.department_decided_at is null then
    raise exception 'Separate late-liquidation authorization is required before settlement' using errcode='42501';
  end if;
  perform eflow_finance_review.settle_accounting_liquidation(p_liquidation_id,p_approve,p_reason);
  perform eflow_finance_review.lock_authority(r.org_id,array[caller,reviewer]);
  if not public.is_department_accounting_staff(r.org_id,caller) or not public.has_permission(caller,'accounting.settle_liquidation')
    or (used_escalation and not coalesce(eflow_finance_review.staffing_escalation_head(l,r,reviewer),false))
    or (reviewer is not null and not used_escalation and not eflow_finance_review.eligible_reviewer(r,reviewer)) then
    raise exception 'Current Accounting and review authority required' using errcode='42501';
  end if;
end $$;

commit;
