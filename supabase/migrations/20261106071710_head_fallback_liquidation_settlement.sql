-- An appointed Office Head may post an escalated package only when the
-- office has no eligible Accounting Officer and the Head has no financial conflict.
create function eflow_finance_review.head_can_post_settlement(
  l public.petty_cash_liquidations, r public.petty_cash_requests, actor uuid
)
returns boolean language sql stable set search_path='' as $$
  select l.status='pending_department_settlement' and r.status='pending_department_settlement'
    and actor is distinct from l.submitted_by
    and actor is distinct from r.requester_id and actor is distinct from r.cash_recipient_id
    and (r.liquidation_due_at is null or l.submitted_at<=r.liquidation_due_at or l.department_decided_at is not null)
    and not exists (select 1 from public.petty_cash_liquidations newer
      where newer.request_id=r.id and newer.version>l.version)
    and exists (
      select 1 from public.organizations o
      join public.profiles p on p.id=o.head_user_id and p.org_id=o.id
      join eflow_finance_review.settlement_blocker_alerts a on a.head_id=p.id
      where o.id=r.org_id and o.is_active and p.id=actor and p.is_active and p.role='head'
        and a.liquidation_id=l.id and a.version=l.version
    )
    and not exists (
      select 1 from eflow_finance_review.eligible_settlement_officers(r,l.leader_decided_by,(
        select v.reviewer_id from public.liquidation_independent_reviews v
        where v.liquidation_id=l.id and v.version=l.version
      ))
    );
$$;
revoke all on function eflow_finance_review.head_can_post_settlement(public.petty_cash_liquidations,public.petty_cash_requests,uuid)
  from public,anon,authenticated;

CREATE OR REPLACE FUNCTION eflow_finance_review.settle_accounting_liquidation(p_liquidation_id uuid, p_approve boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare caller uuid := auth.uid(); liquidation public.petty_cash_liquidations; request public.petty_cash_requests; head_fallback boolean;
begin
  perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l
    join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));
  select * into liquidation from public.petty_cash_liquidations where id = p_liquidation_id for update;
  if not found then raise exception 'Liquidation not found' using errcode = 'P0002'; end if;
  select * into request from public.petty_cash_requests where id = liquidation.request_id for update;
  head_fallback := p_approve is true
    and eflow_finance_review.head_can_post_settlement(liquidation,request,caller)
    and exists (select 1 from eflow_finance_review.staffing_escalation_approvals a
      where a.liquidation_id=liquidation.id and a.version=liquidation.version and a.head_id=caller
        and a.fingerprint=eflow_finance_review.fingerprint(liquidation,request));
  if not head_fallback and not (public.is_department_accounting_staff(request.org_id,caller) and public.has_permission(caller,'accounting.settle_liquidation')) then
    raise exception 'Only authorized Accounting Staff can settle this liquidation' using errcode = '42501';
  end if;
  if caller in (request.cash_recipient_id, request.requester_id) then raise exception 'You cannot settle your own liquidation' using errcode = '42501'; end if;
  if not head_fallback and caller = liquidation.leader_decided_by then raise exception 'Leader review and settlement must be performed by different people' using errcode = '42501'; end if;
  if liquidation.status <> 'pending_department_settlement' or request.status <> 'pending_department_settlement' then
    raise exception 'This liquidation is not awaiting accounting settlement' using errcode = '22023';
  end if;
  if not p_approve and nullif(btrim(p_reason), '') is null then raise exception 'Explain what must be corrected' using errcode = '22023'; end if;
  update public.petty_cash_liquidations set status = case when p_approve then 'approved' else 'changes_requested' end,
    decided_by = caller, decision_reason = nullif(btrim(p_reason), ''), decided_at = now()
  where id = liquidation.id;
  if p_approve then
    update public.petty_cash_requests set status = 'settled', actual_spent = liquidation.declared_spent,
      returned_amount = liquidation.returned_amount, settled_by = caller, settled_at = now(), updated_at = now()
    where id = request.id;
    insert into public.budget_ledger_entries(fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id, entry_type, amount, description, actor_id)
    values (request.fiscal_budget_id, request.org_id, request.commitment_id, request.allocation_id, request.id,
      'expense_posted', liquidation.declared_spent, 'Verified receipts posted as actual task spending', caller);
    if liquidation.returned_amount > 0 then
      insert into public.budget_ledger_entries(fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id, entry_type, amount, description, actor_id)
      values (request.fiscal_budget_id, request.org_id, request.commitment_id, request.allocation_id, request.id,
        'cash_returned', liquidation.returned_amount, 'Unused released cash returned to the department', caller);
    end if;
  else
    update public.petty_cash_requests set status = 'changes_requested', updated_at = now() where id = request.id;
  end if;
  insert into public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)
  select request.cash_recipient_id, 'petty_cash_liquidation_decision',
    case when p_approve then 'Expense liquidation settled' else 'Liquidation changes requested' end,
    case when p_approve then 'The receipts were verified and the balanced settlement journal was posted.' else 'Your liquidation needs corrections before settlement.' end,
    request.task_id, caller, coalesce(full_name, ''), coalesce(p_reason, ''), liquidation.id, 'petty_cash_liquidation'
  from public.profiles where id = caller;
end;
$function$;

create or replace function public.approve_liquidation_staffing_escalation(
  p_liquidation_id uuid, p_version integer, p_fingerprint text, p_reason text, p_idempotency_key uuid
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  l public.petty_cash_liquidations; r public.petty_cash_requests;
  prior eflow_finance_review.staffing_escalation_approvals;
  caller uuid:=auth.uid();
  head_fallback boolean;
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
  -- Serialize the no-officer check with changes to Office staffing.
  perform 1 from public.organizations where id=r.org_id for update;
  perform 1 from public.profiles where org_id=r.org_id order by id for share;
  head_fallback:=coalesce(eflow_finance_review.head_can_post_settlement(l,r,caller),false);
  select * into prior from eflow_finance_review.staffing_escalation_approvals where command_id=p_idempotency_key;
  if found then
    if (prior.liquidation_id,prior.version,prior.head_id,prior.fingerprint,prior.reason)
      is distinct from (l.id,p_version,caller,p_fingerprint,btrim(p_reason)) then
      raise exception 'This approval identity was already used' using errcode='22023';
    end if;
    if head_fallback then
      perform eflow_finance_review.settle_accounting_liquidation(l.id,true,prior.reason);
    end if;
    return prior.command_id;
  end if;
  if not head_fallback and not coalesce(eflow_finance_review.staffing_escalation_head(l,r,caller),false) then
    raise exception 'Only the authorized Office Head may approve this escalation' using errcode='42501';
  end if;
  if l.version<>p_version or l.status<>'pending_department_settlement' or r.status<>'pending_department_settlement'
    or p_fingerprint<>eflow_finance_review.fingerprint(l,r) then
    raise exception 'The receipt package changed. Review the current version.' using errcode='22023';
  end if;
  if not head_fallback and exists(select 1 from public.profiles p where p.org_id=r.org_id
     and eflow_finance_review.eligible_reviewer(r,p.id)) then
    raise exception 'Send this package to the available independent reviewer' using errcode='42501';
  end if;
  select * into prior from eflow_finance_review.staffing_escalation_approvals
  where liquidation_id=l.id and version=l.version and fingerprint=p_fingerprint and head_id=caller;
  if found then
    if not head_fallback then raise exception 'The Head already approved this escalation' using errcode='22023'; end if;
    perform eflow_finance_review.settle_accounting_liquidation(l.id,true,btrim(p_reason));
    return prior.command_id;
  end if;
  insert into eflow_finance_review.staffing_escalation_approvals
    (command_id,liquidation_id,version,head_id,fingerprint,reason)
  values (p_idempotency_key,l.id,l.version,caller,p_fingerprint,btrim(p_reason));
  if head_fallback then
    perform eflow_finance_review.settle_accounting_liquidation(l.id,true,btrim(p_reason));
    return p_idempotency_key;
  end if;
  insert into public.notifications (user_id,type,title,message,reason,financial_record_id,financial_record_type,task_id,actor_id)
  values (r.cash_recipient_id,'petty_cash_liquidation_decision','Head approved settlement review',
    'A separate eligible Accounting Officer must settle and post.',btrim(p_reason),l.id,'petty_cash_liquidation',r.task_id,caller);
  return p_idempotency_key;
end $$;

create or replace function public.get_liquidation_independent_review(p_liquidation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare l public.petty_cash_liquidations;r public.petty_cash_requests;v public.liquidation_independent_reviews;
 candidates jsonb;settlers integer; escalation_approver uuid; can_approve_escalation boolean; head_fallback boolean;
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
 head_fallback:=coalesce(eflow_finance_review.head_can_post_settlement(l,r,auth.uid()),false);
 can_approve_escalation:=head_fallback or (l.status='pending_department_settlement' and r.status='pending_department_settlement'
   and escalation_approver is null and jsonb_array_length(candidates)=0
   and coalesce(eflow_finance_review.staffing_escalation_head(l,r,auth.uid()),false));
 return jsonb_build_object('liquidationId',l.id,'version',l.version,'required',eflow_finance_review.required(r) or v.id is not null,
  'review',case when v.id is null then null else to_jsonb(v) end,'candidates',candidates,'eligibleSettlers',settlers,
  'canReview',coalesce(v.reviewer_id=auth.uid() and eflow_finance_review.eligible_reviewer(r,auth.uid()),false),
  'canSettle',public.is_department_accounting_staff(r.org_id,auth.uid()) and public.has_permission(auth.uid(),'accounting.settle_liquidation')
   and not eflow_finance_review.conflicted(r,auth.uid()) and auth.uid() is distinct from l.leader_decided_by and auth.uid() is distinct from v.reviewer_id,
  'current',coalesce(v.fingerprint=eflow_finance_review.fingerprint(l,r),false),
  'headEscalationApproved',escalation_approver is not null,
  'headCanPostSettlement',head_fallback,
  'headSettlementPosted',r.status='settled' and l.status='approved' and exists (
    select 1 from eflow_finance_review.staffing_escalation_approvals a
    where a.liquidation_id=l.id and a.version=l.version and a.head_id=r.settled_by
  ),
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
