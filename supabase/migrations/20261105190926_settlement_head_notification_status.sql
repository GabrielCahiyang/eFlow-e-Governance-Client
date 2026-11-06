-- Report the recorded alert for the current Office Head and liquidation version.
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
