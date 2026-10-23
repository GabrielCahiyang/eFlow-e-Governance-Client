-- Q12/Q13. Pending deployment: review against captured live definitions first.
begin;
create schema eflow_finance_review;
revoke all on schema eflow_finance_review from public,anon,authenticated;

-- Lock the authority rows until commit, after canonical project/task locks.
-- A revocation that committed during an earlier financial lock wait is visible
-- to the following volatile authorization checks and rolls the write back.
create function eflow_finance_review.lock_authority(org uuid,actors uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.organizations where id=org for share;
 perform 1 from public.profiles where id=any(actors) order by id for share;
end $$;
create function eflow_finance_review.conflicted(r public.petty_cash_requests, actor uuid)
returns boolean language sql stable set search_path='' as $$
 select actor is null or actor=any(array_remove(array[r.requester_id,r.cash_recipient_id,r.task_leader_id,
   (select coalesce(t.recommendation_lead_id,t.assigned_to) from public.tasks t where t.id=r.task_id)],null));
$$;
create function eflow_finance_review.scope_allowed(org uuid,actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.organizations o on o.id=org
  where p.id=actor and p.is_active and p.org_id=org and o.is_active
  and ((p.role='accounting_staff' and public.has_permission(actor,'accounting.settle_liquidation'))
    or (p.id=o.head_user_id and p.role='head') or (p.id=o.assistant_head_user_id and p.role in ('head','member','accounting_staff'))));
$$;
create function eflow_finance_review.eligible_reviewer(r public.petty_cash_requests,actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not eflow_finance_review.conflicted(r,actor) and exists(
  select 1 from public.profiles p join public.organizations o on o.id=r.org_id
   where p.id=actor and p.is_active and p.org_id=r.org_id and o.is_active
    and ((p.id=o.head_user_id and p.role='head') or (p.id=o.assistant_head_user_id and p.role in ('head','member','accounting_staff'))));
$$;
create function eflow_finance_review.required(r public.petty_cash_requests)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.is_active and p.role='accounting_staff'
  and p.org_id=r.org_id and p.id=any(array_remove(array[r.requester_id,r.cash_recipient_id,r.task_leader_id,
   (select coalesce(t.recommendation_lead_id,t.assigned_to) from public.tasks t where t.id=r.task_id)],null)));
$$;
create function eflow_finance_review.fingerprint(l public.petty_cash_liquidations,r public.petty_cash_requests)
returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object('liquidation',jsonb_build_object('id',l.id,'version',l.version,
  'spent',l.declared_spent,'returned',l.returned_amount,'refund',l.refund_receipt_number,'refundDate',l.refund_date,
  'submitted',l.submitted_at,'note',l.note,'payload',l.itemized_payload),
  'request',jsonb_build_object('id',r.id,'office',r.org_id,'requester',r.requester_id,'recipient',r.cash_recipient_id,
  'lead',r.task_leader_id,'task',r.task_id,'spent',r.released_amount,'currentLead',
   (select coalesce(t.recommendation_lead_id,t.assigned_to) from public.tasks t where t.id=r.task_id)),
  'receipts',(select jsonb_agg(to_jsonb(rc) order by rc.id) from public.petty_cash_receipts rc where rc.liquidation_id=l.id),
  'items',(select jsonb_agg(to_jsonb(i) order by i.id) from public.petty_cash_receipt_items i
    join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=l.id))::text);
$$;

create table public.liquidation_independent_reviews(
 id uuid primary key default gen_random_uuid(),liquidation_id uuid not null references public.petty_cash_liquidations(id),
 version integer not null,org_id uuid not null references public.organizations(id),
 reviewer_id uuid not null references public.profiles(id),routed_by uuid not null references public.profiles(id),
 fingerprint text not null,status text not null check(status in ('pending','approved','changes_requested','rejected')),
 route_reason text not null,decision_reason text,decided_at timestamptz,routed_at timestamptz not null default now(),
 unique(liquidation_id,version));
create table eflow_finance_review.events(
 id uuid primary key default gen_random_uuid(),review_id uuid not null references public.liquidation_independent_reviews(id),
 actor_id uuid not null references public.profiles(id),operation text not null,payload jsonb not null,
 created_at timestamptz not null default now());
create table eflow_finance_review.commands(
 actor_id uuid not null,command_id uuid not null,payload jsonb not null,review_id uuid not null,
 primary key(actor_id,command_id));
alter table public.liquidation_independent_reviews enable row level security;
alter table eflow_finance_review.events enable row level security;
alter table eflow_finance_review.commands enable row level security;
create function public.can_view_independent_liquidation_reviews(p_org_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select eflow_finance_review.scope_allowed(p_org_id,auth.uid());
$$;
revoke all on function public.can_view_independent_liquidation_reviews(uuid) from public,anon;
grant execute on function public.can_view_independent_liquidation_reviews(uuid) to authenticated;
create policy independent_review_read on public.liquidation_independent_reviews for select to authenticated
 using(public.can_view_independent_liquidation_reviews(org_id));
revoke all on public.liquidation_independent_reviews from public,anon,authenticated;
grant select on public.liquidation_independent_reviews to authenticated;

create function public.get_liquidation_independent_review(p_liquidation_id uuid)
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
 select count(*) into settlers from public.profiles p where p.org_id=r.org_id and p.is_active
  and p.role='accounting_staff' and public.has_permission(p.id,'accounting.settle_liquidation')
  and not eflow_finance_review.conflicted(r,p.id) and p.id is distinct from l.leader_decided_by
  and p.id is distinct from v.reviewer_id;
 return jsonb_build_object('liquidationId',l.id,'version',l.version,'required',eflow_finance_review.required(r) or v.id is not null,
  'review',case when v.id is null then null else to_jsonb(v) end,'candidates',candidates,'eligibleSettlers',settlers,
  'canReview',coalesce(v.reviewer_id=auth.uid() and eflow_finance_review.eligible_reviewer(r,auth.uid()),false),
  'canSettle',public.is_department_accounting_staff(r.org_id,auth.uid()) and public.has_permission(auth.uid(),'accounting.settle_liquidation')
   and not eflow_finance_review.conflicted(r,auth.uid()) and auth.uid() is distinct from l.leader_decided_by and auth.uid() is distinct from v.reviewer_id,
  'current',coalesce(v.fingerprint=eflow_finance_review.fingerprint(l,r),false),
  'escalationRequired',jsonb_array_length(candidates)=0 or settlers=0);
end $$;

create function public.route_liquidation_independent_review(p_liquidation_id uuid,p_version integer,p_reviewer_id uuid,p_reason text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.petty_cash_liquidations;r public.petty_cash_requests;v public.liquidation_independent_reviews;
 command eflow_finance_review.commands;payload jsonb;caller uuid:=auth.uid();
begin
 perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations x join public.petty_cash_requests c on c.id=x.request_id where x.id=p_liquidation_id));
 select * into l from public.petty_cash_liquidations where id=p_liquidation_id for update;
 select * into r from public.petty_cash_requests where id=l.request_id for update;
 if r.id is null or not eflow_finance_review.scope_allowed(r.org_id,caller) then raise exception 'Independent review routing denied' using errcode='42501';end if;
 perform eflow_finance_review.lock_authority(r.org_id,array[caller,p_reviewer_id]);
 if not eflow_finance_review.scope_allowed(r.org_id,caller) then raise exception 'Current review authority required' using errcode='42501';end if;
 if p_version is null or p_version<1 or p_idempotency_key is null or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then raise exception 'A routing reason, version and request identity are required' using errcode='22023';end if;
 payload:=jsonb_build_object('operation','route','liquidation',l.id,'version',p_version,'reviewer',p_reviewer_id,'reason',btrim(p_reason));
 select * into command from eflow_finance_review.commands where actor_id=caller and command_id=p_idempotency_key;
 if found then
  if command.payload<>payload then raise exception 'Request identity was used with different review details' using errcode='22023';end if;
  return command.review_id;
 end if;
 if l.version<>p_version or l.status<>'pending_department_settlement' or r.status<>'pending_department_settlement' then raise exception 'Refresh the current liquidation before routing' using errcode='22023';end if;
 if not eflow_finance_review.required(r) then raise exception 'This package does not require conflict review' using errcode='22023';end if;
 if not eflow_finance_review.eligible_reviewer(r,p_reviewer_id) then raise exception 'Choose an independent appointed Head or Assistant Head from this Office' using errcode='42501';end if;
 select * into v from public.liquidation_independent_reviews where liquidation_id=l.id and version=l.version for update;
 if found and v.status='approved' and v.fingerprint=eflow_finance_review.fingerprint(l,r) and eflow_finance_review.eligible_reviewer(r,v.reviewer_id) then
  raise exception 'Independent approval is already recorded; verify settlement readiness' using errcode='22023';end if;
 insert into public.liquidation_independent_reviews(liquidation_id,version,org_id,reviewer_id,routed_by,fingerprint,status,route_reason)
 values(l.id,l.version,r.org_id,p_reviewer_id,caller,eflow_finance_review.fingerprint(l,r),'pending',btrim(p_reason))
 on conflict(liquidation_id,version) do update set reviewer_id=excluded.reviewer_id,routed_by=excluded.routed_by,
  fingerprint=excluded.fingerprint,status='pending',route_reason=excluded.route_reason,decision_reason=null,decided_at=null,routed_at=now()
 returning * into v;
 insert into eflow_finance_review.events(review_id,actor_id,operation,payload) values(v.id,caller,'route',to_jsonb(v));
 insert into eflow_finance_review.commands values(caller,p_idempotency_key,payload,v.id);
 insert into public.notifications(user_id,type,title,message,financial_record_id,financial_record_type,task_id,actor_id)
 values(p_reviewer_id,'petty_cash_liquidation_decision','Independent liquidation review','An assigned independent financial review is waiting in your Inbox.',l.id,'independent_liquidation_review',null,caller);
 return v.id;
end $$;

create function public.decide_liquidation_independent_review(p_liquidation_id uuid,p_version integer,p_decision text,p_reason text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare l public.petty_cash_liquidations;r public.petty_cash_requests;v public.liquidation_independent_reviews;
 command eflow_finance_review.commands;payload jsonb;caller uuid:=auth.uid();
begin
 perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations x join public.petty_cash_requests c on c.id=x.request_id where x.id=p_liquidation_id));
 select * into l from public.petty_cash_liquidations where id=p_liquidation_id for update;
 select * into r from public.petty_cash_requests where id=l.request_id for update;
 select * into v from public.liquidation_independent_reviews where liquidation_id=l.id and version=l.version for update;
 if r.id is null or not eflow_finance_review.scope_allowed(r.org_id,caller) or v.reviewer_id is distinct from caller
  or not eflow_finance_review.eligible_reviewer(r,caller) then raise exception 'Only the assigned independent reviewer may decide this package' using errcode='42501';end if;
 perform eflow_finance_review.lock_authority(r.org_id,array[caller]);
 if not eflow_finance_review.eligible_reviewer(r,caller) then raise exception 'Current independent review authority required' using errcode='42501';end if;
 if p_version is null or p_version<1 or p_idempotency_key is null or p_decision is null or p_decision not in ('approved','changes_requested','rejected') or nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
  raise exception 'Choose a review decision and provide a reason' using errcode='22023';end if;
 payload:=jsonb_build_object('operation','decide','liquidation',l.id,'version',p_version,'decision',p_decision,'reason',btrim(p_reason));
 select * into command from eflow_finance_review.commands where actor_id=caller and command_id=p_idempotency_key;
 if found then
  if command.payload<>payload then raise exception 'Request identity was used with a different decision' using errcode='22023';end if;
  return command.review_id;
 end if;
 if l.version<>p_version or v.status<>'pending' or l.status<>'pending_department_settlement' or r.status<>'pending_department_settlement'
  or v.fingerprint<>eflow_finance_review.fingerprint(l,r) then raise exception 'Package changed; reroute the current version for review' using errcode='22023';end if;
 update public.liquidation_independent_reviews set status=p_decision,decision_reason=btrim(p_reason),decided_at=now() where id=v.id returning * into v;
 insert into eflow_finance_review.events(review_id,actor_id,operation,payload) values(v.id,caller,p_decision,to_jsonb(v));
 if p_decision<>'approved' then
  -- Released cash remains an obligation. Return declined packages for revision;
  -- a review rejection does not silently erase the outstanding advance.
  update public.petty_cash_liquidations set status='changes_requested',decision_reason=btrim(p_reason),decided_by=caller,decided_at=now() where id=l.id;
  update public.petty_cash_requests set status='changes_requested',updated_at=now() where id=r.id;
 end if;
 insert into eflow_finance_review.commands values(caller,p_idempotency_key,payload,v.id);
 insert into public.notifications(user_id,type,title,message,reason,financial_record_id,financial_record_type,task_id,actor_id)
 values(r.cash_recipient_id,'petty_cash_liquidation_decision','Independent liquidation review recorded',
  case when p_decision='approved' then 'Independent review approved. A separate eligible Accounting Officer must settle and post.' else 'Revise the receipt package before settlement.' end,
  btrim(p_reason),l.id,'petty_cash_liquidation',r.task_id,caller);
 return v.id;
end $$;

-- Preserve the captured, installed settlement body behind its unchanged API.
alter function public.settle_accounting_liquidation(uuid,boolean,text) set schema eflow_finance_review;
revoke all on function eflow_finance_review.settle_accounting_liquidation(uuid,boolean,text) from public,anon,authenticated;
create function public.settle_accounting_liquidation(p_liquidation_id uuid,p_approve boolean,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare l public.petty_cash_liquidations;r public.petty_cash_requests;v public.liquidation_independent_reviews;caller uuid:=auth.uid();
begin
 perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations x join public.petty_cash_requests c on c.id=x.request_id where x.id=p_liquidation_id));
 select * into l from public.petty_cash_liquidations where id=p_liquidation_id for update;
 select * into r from public.petty_cash_requests where id=l.request_id for update;
 if r.id is null or not public.is_department_accounting_staff(r.org_id,caller) or not public.has_permission(caller,'accounting.settle_liquidation')
  or eflow_finance_review.conflicted(r,caller) then raise exception 'A separate eligible Accounting Officer must settle this package' using errcode='42501';end if;
 if p_approve is null then raise exception 'Choose a settlement decision' using errcode='22023';end if;
 select * into v from public.liquidation_independent_reviews where liquidation_id=l.id and version=l.version for update;
 if v.id is not null or eflow_finance_review.required(r) then
  if v.id is null or v.status<>'approved' or v.fingerprint<>eflow_finance_review.fingerprint(l,r)
   or not eflow_finance_review.eligible_reviewer(r,v.reviewer_id) or v.reviewer_id=caller then
   raise exception 'Current independent Head or Assistant Head approval is required before settlement' using errcode='42501';end if;
 end if;
 if p_approve and r.liquidation_due_at is not null and l.submitted_at>r.liquidation_due_at and l.department_decided_at is null then
  raise exception 'Separate late-liquidation authorization is required before settlement' using errcode='42501';end if;
 perform eflow_finance_review.settle_accounting_liquidation(p_liquidation_id,p_approve,p_reason);
 perform eflow_finance_review.lock_authority(r.org_id,array[caller,v.reviewer_id]);
 if not public.is_department_accounting_staff(r.org_id,caller) or not public.has_permission(caller,'accounting.settle_liquidation')
  or (v.id is not null and not eflow_finance_review.eligible_reviewer(r,v.reviewer_id)) then
  raise exception 'Current independent Accounting and review authority required' using errcode='42501';end if;
end $$;

-- Same release API and installed posting body; final authority is held through
-- commit even if role removal committed during the annual-budget lock wait.
alter function public.record_accounting_petty_cash_release(uuid,text,text) set schema eflow_finance_review;
revoke all on function eflow_finance_review.record_accounting_petty_cash_release(uuid,text,text) from public,anon,authenticated;
create function public.record_accounting_petty_cash_release(p_release_id uuid,p_release_method text default 'cash',p_cheque_number text default null)
returns void language plpgsql security definer set search_path='' as $$
declare org uuid;caller uuid:=auth.uid();
begin
 if p_release_method is null then raise exception 'Choose cash or cheque release' using errcode='22023';end if;
 perform eflow_finance_review.record_accounting_petty_cash_release(p_release_id,p_release_method,p_cheque_number);
 select org_id into org from public.petty_cash_releases where id=p_release_id;
 perform eflow_finance_review.lock_authority(org,array[caller]);
 if not public.is_department_accounting_staff(org,caller) or not public.has_permission(caller,'accounting.release_cash') then
  raise exception 'Current Accounting release authority required' using errcode='42501';end if;
end $$;
revoke all on function public.record_accounting_petty_cash_release(uuid,text,text) from public,anon;
grant execute on function public.record_accounting_petty_cash_release(uuid,text,text) to authenticated;
alter function public.override_accounting_petty_cash_release_schedule(uuid,text,text,text) set schema eflow_finance_review;
revoke all on function eflow_finance_review.override_accounting_petty_cash_release_schedule(uuid,text,text,text) from public,anon,authenticated;
create function public.override_accounting_petty_cash_release_schedule(p_release_id uuid,p_reason text,p_release_method text default 'cash',p_cheque_number text default null)
returns void language plpgsql security definer set search_path='' as $$
declare org uuid;caller uuid:=auth.uid();
begin
 if p_release_method is null then raise exception 'Choose cash or cheque release' using errcode='22023';end if;
 perform eflow_finance_review.override_accounting_petty_cash_release_schedule(p_release_id,p_reason,p_release_method,p_cheque_number);
 select org_id into org from public.petty_cash_releases where id=p_release_id;
 perform eflow_finance_review.lock_authority(org,array[caller]);
 if not public.is_department_accounting_staff(org,caller) or not public.has_permission(caller,'accounting.release_cash') then
  raise exception 'Current Accounting release authority required' using errcode='42501';end if;
end $$;
revoke all on function public.override_accounting_petty_cash_release_schedule(uuid,text,text,text) from public,anon;
grant execute on function public.override_accounting_petty_cash_release_schedule(uuid,text,text,text) to authenticated;

revoke all on function public.get_liquidation_independent_review(uuid),public.route_liquidation_independent_review(uuid,integer,uuid,text,uuid),
 public.decide_liquidation_independent_review(uuid,integer,text,text,uuid),public.settle_accounting_liquidation(uuid,boolean,text) from public,anon;
grant execute on function public.get_liquidation_independent_review(uuid),public.route_liquidation_independent_review(uuid,integer,uuid,text,uuid),
 public.decide_liquidation_independent_review(uuid,integer,text,text,uuid),public.settle_accounting_liquidation(uuid,boolean,text) to authenticated;
revoke all on all functions in schema eflow_finance_review from public,anon,authenticated;

-- Assigned review access is independent of the permanent Head/Member label.
-- This does not grant Office finance browsing, task mutation or settlement.
create function public.list_my_independent_liquidation_reviews()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
  'context',public.get_liquidation_independent_review(l.id),
  'liquidation',to_jsonb(l),
  'request',to_jsonb(r)||jsonb_build_object('task',jsonb_build_object('title',t.title),
    'requester',jsonb_build_object('full_name',requester.full_name),'cash_recipient',jsonb_build_object('full_name',recipient.full_name)),
  'receipts',(select coalesce(jsonb_agg(to_jsonb(rc) order by rc.id),'[]') from public.petty_cash_receipts rc where rc.liquidation_id=l.id)
 ) order by v.routed_at),'[]')
 from public.liquidation_independent_reviews v join public.petty_cash_liquidations l on l.id=v.liquidation_id and l.version=v.version
 join public.petty_cash_requests r on r.id=l.request_id left join public.tasks t on t.id=r.task_id
 left join public.profiles requester on requester.id=r.requester_id left join public.profiles recipient on recipient.id=r.cash_recipient_id
 where v.reviewer_id=auth.uid() and v.status='pending' and l.status='pending_department_settlement'
 and eflow_finance_review.eligible_reviewer(r,auth.uid()) and eflow_finance_review.scope_allowed(r.org_id,auth.uid());
$$;
create function public.can_read_independent_review_receipt(p_object_name text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.petty_cash_receipts rc join public.petty_cash_liquidations l on l.id=rc.liquidation_id
  join public.petty_cash_requests r on r.id=l.request_id join public.liquidation_independent_reviews v on v.liquidation_id=l.id and v.version=l.version
  where rc.file_path=p_object_name and v.reviewer_id=auth.uid() and v.status='pending' and l.status='pending_department_settlement'
   and eflow_finance_review.eligible_reviewer(r,auth.uid()) and eflow_finance_review.scope_allowed(r.org_id,auth.uid()));
$$;
revoke all on function public.list_my_independent_liquidation_reviews(),public.can_read_independent_review_receipt(text) from public,anon;
grant execute on function public.list_my_independent_liquidation_reviews(),public.can_read_independent_review_receipt(text) to authenticated;
create policy independent_review_receipt_read on storage.objects for select to authenticated
 using(bucket_id='budget-receipts' and public.can_read_independent_review_receipt(name));
create index liquidation_independent_reviews_office_idx on public.liquidation_independent_reviews(org_id,reviewer_id,status);

-- Preserve the source that already backs pending/approved/settled cash. This
-- supplements annual partition caps; those alone did not protect a shrinking
-- root allocation line while a cash hold was being approved.
create function eflow_finance_review.guard_source_obligations()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.work_budget_allocations;caps numeric;used numeric;
begin
 select * into a from public.work_budget_allocations where id=old.allocation_id;
 if a.subtask_id is not null or a.status<>'approved' then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 perform eflow_r7.lock_impact(a.task_id);
 select coalesce(sum(amount),0) into caps from public.work_budget_allocations
  where task_id=a.task_id and commitment_id=a.commitment_id and subtask_id is not null
   and parent_allocation_line_id=old.id and status in ('pending','approved');
 select coalesce(sum(eflow_budget.request_line_obligation(r.id,old.id)),0) into used
  from public.petty_cash_requests r join public.work_budget_allocations ca on ca.id=r.allocation_id
  join public.petty_cash_request_lines rl on rl.request_id=r.id and rl.allocation_line_id=old.id
  where ca.subtask_id is null or ca.status not in ('pending','approved');
 if tg_op='DELETE' then
  if caps+used>0 then raise exception 'This source still backs cash or child funding; it cannot be deleted' using errcode='22023';end if;
  return old;
 end if;
 if new.amount<caps+used or (caps+used>0 and row(new.allocation_id,new.budget_partition_id) is distinct from row(old.allocation_id,old.budget_partition_id)) then
  raise exception 'This source still backs cash or child funding; retain its source and at least %',caps+used using errcode='22023';end if;
 return new;
end $$;
revoke all on function eflow_finance_review.guard_source_obligations() from public,anon,authenticated;
create trigger work_budget_00_source_obligations before update or delete on public.work_budget_allocation_lines
 for each row execute function eflow_finance_review.guard_source_obligations();

create function public.guard_approved_prerequisite_lifecycle()
returns trigger language plpgsql security definer set search_path='pg_catalog','public' as $$
begin
 if tg_op='UPDATE' and not ((old.status::text='completed' and new.status::text<>'completed') or (old.deleted_at is null and new.deleted_at is not null)) then return new;end if;
 -- Existing finalization locks each prerequisite FOR SHARE. The current row's
 -- UPDATE/DELETE lock serializes reopening against that check, without locking
 -- downstream rows in reverse order or adding a global task-write mutex.
 if exists(select 1 from public.tasks d where old.id=any(coalesce(d.dependency_ids,'{}'::uuid[]))
   and d.status::text in ('for_review','completed') and d.deleted_at is null) then
  raise exception 'Reopen the submitted or approved dependent tasks first. This prerequisite cannot be reopened, cancelled or deleted while their approvals remain current.' using errcode='22023';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.guard_approved_prerequisite_lifecycle() from public,anon,authenticated;
create trigger tasks_01_prerequisite_lifecycle before update of status,deleted_at or delete on public.tasks
 for each row execute function public.guard_approved_prerequisite_lifecycle();
-- Exclude deleted approvals, retaining the original same-project finalization check.
create or replace function public.guard_task_dependency_completion()
returns trigger language plpgsql security definer set search_path='pg_catalog','public' as $$
declare required_count integer;completed_count integer;
begin
 if new.status::text not in ('for_review','completed') or cardinality(coalesce(new.dependency_ids,'{}'::uuid[]))=0 then return new;end if;
 required_count:=cardinality(new.dependency_ids);
 perform 1 from public.tasks t where t.id=any(new.dependency_ids) order by t.id for share;
 select count(*) into completed_count from public.tasks t where t.id=any(new.dependency_ids)
  and t.linked_project_id is not distinct from new.linked_project_id and t.status::text='completed' and t.deleted_at is null;
 if completed_count<>required_count then raise exception 'Wait for prerequisite task approval before final submission.' using errcode='22023';end if;
 return new;
end $$;
revoke all on function public.guard_task_dependency_completion() from public,anon,authenticated;
commit;
