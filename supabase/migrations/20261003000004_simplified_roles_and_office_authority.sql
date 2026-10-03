-- Phase 1: canonical account roles and office authority. Apply after a verified full backup.
-- No project/task IDs, financial records, evidence, historical decisions, or API payloads are rewritten.
begin;
set local lock_timeout='10s';
lock table public.profiles,public.organizations,public.tasks,public.role_permissions,
  public.user_permission_overrides,public.organization_memberships in share row exclusive mode;

do $$ declare counts jsonb; begin
 select jsonb_object_agg(role,n) into counts from (select role,count(*) n from public.profiles group by role) r;
 raise notice 'Phase 1 preflight role counts: %',counts;
 if exists(select 1 from public.profiles where role not in ('admin','super_admin','head','dept_head','department_head','assistant_head','member','employee','accounting_staff')) then
   raise exception 'Unsupported prototype roles require deliberate account correction. Counts: %',counts;
 end if;
 if exists(select 1 from public.profiles p where p.is_active and p.role in ('head','dept_head','department_head')
   and not exists(select 1 from public.organizations o where o.id=p.org_id and o.head_user_id=p.id and o.is_active)) then
   raise exception 'Resolve active Head profiles without matching office appointments first';
 end if;
 if exists(select 1 from public.organizations o left join public.profiles p on p.id=o.head_user_id
   where o.head_user_id is not null and (p.id is null or not p.is_active or p.org_id is distinct from o.id or p.role not in ('head','dept_head','department_head'))) then
   raise exception 'Resolve invalid office Head appointments first';
 end if;
 if exists(select head_user_id from public.organizations where head_user_id is not null group by head_user_id having count(*)>1) then
   raise exception 'A Head cannot hold multiple office appointments';
 end if;
 if exists(select 1 from public.tasks t where t.deleted_at is null and t.status='for_review' and t.review_route_mode='organization_default'
   and not exists(select 1 from public.organizations o join public.profiles p on p.id=o.head_user_id
     where o.id=t.org_id and o.is_active and p.is_active and p.org_id=o.id and p.role in ('head','dept_head','department_head'))) then
   raise exception 'Assign a valid Head for every normal task currently awaiting review';
 end if;
end $$;

create table public.phase1_authority_row_backup (
 table_name text not null, row_key text not null, snapshot jsonb not null, archived_at timestamptz not null default now(), primary key(table_name,row_key)
);
create table public.phase1_authority_definition_backup (
 kind text not null, identity text not null, definition text not null, archived_at timestamptz not null default now(), primary key(kind,identity)
);
alter table public.phase1_authority_row_backup enable row level security;
alter table public.phase1_authority_definition_backup enable row level security;
revoke all on public.phase1_authority_row_backup,public.phase1_authority_definition_backup from anon,authenticated;
grant select on public.phase1_authority_row_backup,public.phase1_authority_definition_backup to authenticated;
create policy phase1_backup_admin_read on public.phase1_authority_row_backup for select to authenticated using(public.is_admin(auth.uid()));
create policy phase1_definitions_admin_read on public.phase1_authority_definition_backup for select to authenticated using(public.is_admin(auth.uid()));
insert into public.phase1_authority_row_backup(table_name,row_key,snapshot)
 select 'profiles',id::text,to_jsonb(p) from public.profiles p union all
 select 'organizations',id::text,to_jsonb(o) from public.organizations o union all
 select 'role_permissions',role||':'||permission,to_jsonb(r) from public.role_permissions r union all
 select 'user_permission_overrides',user_id::text||':'||permission,to_jsonb(u) from public.user_permission_overrides u union all
 select 'organization_memberships',organization_id::text||':'||user_id::text,to_jsonb(m) from public.organization_memberships m union all
 select 'tasks',id::text,to_jsonb(t) from public.tasks t where deleted_at is null and status not in ('completed','cancelled') and review_route_mode='organization_default';
insert into public.phase1_authority_definition_backup(kind,identity,definition)
 select 'function',p.oid::regprocedure::text,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prolang<>(select oid from pg_language where lanname='c') union all
 select 'policy',tablename||'.'||policyname,to_jsonb(pol)::text from pg_policies pol where schemaname='public' union all
 select 'trigger',t.oid::text,pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal union all
 select 'constraint',c.conrelid::regclass::text||'.'||c.conname,pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid in ('public.profiles'::regclass,'public.organizations'::regclass);

-- Preserve named governance reviewers in the existing membership model before retiring office assistants.
insert into public.organization_memberships(organization_id,user_id,membership_role)
 select o.id,o.assistant_head_user_id,'backup_approver' from public.organizations o join public.profiles p on p.id=o.assistant_head_user_id
 where o.org_type in ('board','committee') and p.is_active and p.role not in ('admin','super_admin')
 on conflict(organization_id,user_id) do update set membership_role=case when organization_memberships.membership_role='primary_approver' then 'primary_approver' else 'backup_approver' end;

-- The old profile trigger enforces assistant appointments. Replace it before translating identities.
alter table public.profiles drop constraint profiles_role_check;
drop trigger if exists guard_profile_leadership_integrity on public.profiles;
drop trigger if exists guard_admin_role_permissions on public.role_permissions;

-- Normal office output is the only route eligible for Head self-finalization.
create or replace function public.is_office_output_reviewer(target_org uuid, caller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organizations o join public.profiles p on p.id=o.head_user_id
    where o.id=target_org and o.is_active and p.id=caller_id and p.is_active
      and p.role='head' and p.org_id=o.id);
$$;

create or replace function public.route_organization_leadership_review()
returns trigger language plpgsql set search_path = public as $$
declare office_head uuid;
begin
  if coalesce(new.review_route_mode,'organization_default') <> 'organization_default' then return new; end if;
  if new.assigned_to is null then return new; end if;
  select o.head_user_id into office_head from public.organizations o
    where o.id=new.org_id and public.is_office_output_reviewer(o.id,o.head_user_id);
  new.reviewer_id := office_head;
  new.backup_reviewer_id := null;
  if new.status='for_review' and office_head is null then
    raise exception 'Assign an active Head for the responsible office before submitting' using errcode='22023';
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_leadership_integrity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_active and new.role='head' and not exists (
    select 1 from public.organizations o where o.id=new.org_id and o.head_user_id=new.id and o.is_active
  ) then raise exception 'Assign Head through the office leadership slot' using errcode='23514'; end if;
  if tg_op='UPDATE' and exists(select 1 from public.organizations o where o.head_user_id=old.id
    and (not new.is_active or new.role <> 'head' or new.org_id is distinct from o.id)) then
    raise exception 'Clear or replace this user in the office Head slot first' using errcode='23514';
  end if;
  return new;
end;
$$;

create or replace function public.guard_organization_leadership_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.head_user_id is not null and not exists(select 1 from public.profiles
    where id=new.head_user_id and is_active and org_id=new.id and role <> 'admin') then
    raise exception 'Head must already be an active member of this office before being assigned' using errcode='22023';
  end if;
  return new;
end;
$$;

create or replace function public.guard_administrative_leadership_assignment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.head_user_id is not null and public.is_admin(new.head_user_id) then
    raise exception 'Administrative accounts cannot be assigned as office Head' using errcode='22023';
  end if;
  return new;
end;
$$;

-- Keep the public RPC signature during the client rollout, but retire the third appointment.
create or replace function public.set_organization_leadership(p_org_id uuid, p_head_user_id uuid default null, p_assistant_head_user_id uuid default null)
returns public.organizations language plpgsql security definer set search_path = public as $$
declare caller uuid:=auth.uid(); previous_head uuid; selected_profile public.profiles; updated_org public.organizations;
begin
  if caller is null or not public.is_admin(caller) then raise exception 'Admin access is required' using errcode='42501'; end if;
  if p_assistant_head_user_id is not null then raise exception 'Only one Head may be assigned to an office' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eflow.office_leadership',0));
  select head_user_id into previous_head from public.organizations where id=p_org_id and is_active for update;
  if not found then raise exception 'Office not found or inactive' using errcode='22023'; end if;
  if p_head_user_id is not null then
    select * into selected_profile from public.profiles where id=p_head_user_id for update;
    if not found or not selected_profile.is_active or selected_profile.org_id is distinct from p_org_id or selected_profile.role='admin' then
      raise exception 'Head must already be an active member of this office' using errcode='22023';
    end if;
    if exists(select 1 from public.organizations where id<>p_org_id and head_user_id=p_head_user_id) then
      raise exception 'The selected Head already leads another office' using errcode='22023';
    end if;
  end if;
  update public.organizations set head_user_id=p_head_user_id,updated_at=now() where id=p_org_id returning * into updated_org;
  if p_head_user_id is not null then update public.profiles set role='head',updated_at=now() where id=p_head_user_id; end if;
  if previous_head is not null and previous_head is distinct from p_head_user_id then
    update public.profiles set role='member',updated_at=now() where id=previous_head and role='head'
      and not exists(select 1 from public.organizations where head_user_id=previous_head);
  end if;
  update public.tasks set reviewer_id=reviewer_id where org_id=p_org_id and deleted_at is null
    and status not in ('completed','cancelled') and review_route_mode='organization_default';
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,org_id)
    select caller,coalesce(full_name,'Admin'),'organization',p_org_id::text,'organization.leadership_changed',
      jsonb_build_object('headUserId',previous_head),jsonb_build_object('headUserId',p_head_user_id),p_org_id
    from public.profiles where id=caller;
  return updated_org;
end;
$$;

create or replace function public.organization_approver_ids(target_organization uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.head_user_id from public.organizations o where o.id=target_organization
    and public.is_office_output_reviewer(o.id,o.head_user_id)
  union
  select m.user_id from public.organization_memberships m join public.profiles p on p.id=m.user_id and p.is_active
    where m.organization_id=target_organization and p.role<>'admin' and m.membership_role in ('primary_approver','backup_approver');
$$;

create or replace function public.is_organization_approver(target_organization uuid, caller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_approver_ids(target_organization) approver where approver=caller_id);
$$;

create or replace function public.is_department_budget_approver(target_org uuid, caller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_office_output_reviewer(target_org,caller_id);
$$;

create or replace function public.guard_admin_role_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_role text; required boolean;
begin
  if tg_op='DELETE' then target_role:=old.role; else target_role:=new.role; end if;
  if auth.uid() is not null and not public.is_admin(auth.uid()) then raise exception 'Only Admin can manage role permissions' using errcode='42501'; end if;
  if target_role not in ('admin','head','member','accounting_staff') then raise exception 'Choose a canonical account role' using errcode='22023'; end if;
  if tg_op in ('UPDATE','DELETE') and old.role='admin' and (tg_op='DELETE' or new.role<>'admin' or new.permission<>old.permission) then
    raise exception 'Admin defaults are fixed administrative access' using errcode='42501';
  end if;
  if target_role='admin' then
    required:=(new.permission in ('navigation.user_management','users.manage','navigation.organization','navigation.audit','audit.read','navigation.system_settings','settings.manage','navigation.data_tools','database.backup'));
    if new.allowed is distinct from required then raise exception 'Admin defaults are fixed administrative access' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

-- A Head authorizes a late receipt package; Accounting executes settlement separately.
create or replace function public.decide_petty_cash_liquidation(p_liquidation_id uuid,p_approve boolean,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare caller uuid:=auth.uid(); liquidation public.petty_cash_liquidations; request public.petty_cash_requests;
begin
 select * into liquidation from public.petty_cash_liquidations where id=p_liquidation_id for update;
 if not found then raise exception 'Liquidation not found' using errcode='P0002'; end if;
 select * into request from public.petty_cash_requests where id=liquidation.request_id for update;
 if not public.is_department_budget_head(request.org_id,caller) then raise exception 'Only the office Head may authorize late liquidation' using errcode='42501'; end if;
 if caller in (request.cash_recipient_id,request.requester_id) or caller=liquidation.leader_decided_by then raise exception 'Independent financial approval required' using errcode='42501'; end if;
 if liquidation.status<>'pending_department_settlement' or request.status<>'pending_department_settlement' or request.liquidation_due_at is null or liquidation.submitted_at<=request.liquidation_due_at then
   raise exception 'This package is not awaiting late liquidation authorization' using errcode='22023';
 end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'Record a decision reason' using errcode='22023'; end if;
 update public.petty_cash_liquidations set department_decided_by=caller,department_decision_reason=btrim(p_reason),department_decided_at=now(),
   status=case when p_approve then status else 'changes_requested' end where id=liquidation.id;
 if not p_approve then update public.petty_cash_requests set status='changes_requested',updated_at=now() where id=request.id; end if;
 insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,reason,after_data,org_id)
 select caller,full_name,'petty_cash_liquidation',liquidation.id::text,'liquidation.late_authorization',btrim(p_reason),jsonb_build_object('approved',p_approve,'authority','Office Head'),request.org_id from public.profiles where id=caller;
 insert into public.notifications(user_id,type,title,message,task_id,actor_id,actor_name,financial_record_id,financial_record_type)
 select p.id,'petty_cash_liquidation_accounting_review','Late liquidation decision',
   case when p_approve then 'Head authorized the late package. Accounting may now settle it.' else 'Head requested receipt corrections.' end,
   request.task_id,caller,(select full_name from public.profiles where id=caller),liquidation.id,'petty_cash_liquidation'
 from public.profiles p where p.is_active and p.org_id=request.org_id and p.role='accounting_staff';
end;
$$;

create or replace function public.guard_late_liquidation_head_approval()
returns trigger language plpgsql security definer set search_path=public as $$
declare request public.petty_cash_requests;
begin
 if new.status='approved' and old.status is distinct from 'approved' then
   select * into request from public.petty_cash_requests where id=new.request_id;
   if request.liquidation_due_at is not null and new.submitted_at>request.liquidation_due_at and not (
     new.department_decided_by is not null and new.department_decided_at is not null
     and public.is_department_budget_head(request.org_id,new.department_decided_by)
     and new.department_decided_by is distinct from request.cash_recipient_id
     and new.department_decided_by is distinct from request.requester_id
     and new.department_decided_by is distinct from new.leader_decided_by
   ) then raise exception 'Late liquidation requires independent office Head authorization before accounting settlement' using errcode='42501'; end if;
 end if;
 return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.record_accounting_petty_cash_release(p_release_id uuid, p_release_method text DEFAULT 'cash'::text, p_cheque_number text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  release public.petty_cash_releases;
  cash_request public.petty_cash_requests;
  budget public.department_fiscal_budgets;
  released_total numeric;
  used_today numeric;
begin
  if caller is null then
    raise exception 'Sign in before recording a release' using errcode = '42501';
  end if;
  if p_release_method not in ('cash', 'cheque') then
    raise exception 'Choose cash or cheque release' using errcode = '22023';
  end if;
  if p_release_method = 'cheque' and nullif(btrim(p_cheque_number), '') is null then
    raise exception 'Enter the cheque number before release' using errcode = '22023';
  end if;

  select request_row.* into cash_request
  from public.petty_cash_releases release_row
  join public.petty_cash_requests request_row on request_row.id = release_row.request_id
  where release_row.id = p_release_id
  for update of request_row;
  if not found then
    raise exception 'Scheduled release not found' using errcode = 'P0002';
  end if;
  if not (public.is_department_accounting_staff(cash_request.org_id,caller) and public.has_permission(caller,'accounting.release_cash')) then
    raise exception 'Only authorized Accounting Staff can record a release' using errcode = '42501';
  end if;

  select * into budget
  from public.department_fiscal_budgets
  where id = cash_request.fiscal_budget_id and status = 'locked'
  for update;
  if not found then
    raise exception 'The annual department budget is no longer open' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('eflow:cash-release:' || cash_request.org_id::text, 0));
  select * into release from public.petty_cash_releases where id = p_release_id for update;
  if release.status <> 'scheduled' then
    raise exception 'This release has already been processed' using errcode = '22023';
  end if;
  if release.scheduled_date > current_date then
    raise exception 'This release is scheduled for %. A Head must use the audited schedule override.', release.scheduled_date using errcode = '22023';
  end if;
  if cash_request.status not in ('approved', 'scheduled_for_release', 'partially_released') or cash_request.approved_amount is null then
    raise exception 'The request must be fiscally approved before release' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into released_total
  from public.petty_cash_releases
  where request_id = cash_request.id and status = 'released';
  if released_total + release.amount > cash_request.approved_amount then
    raise exception 'This release would exceed the approved request amount' using errcode = '22023';
  end if;
  select coalesce(sum(amount), 0) into used_today
  from public.petty_cash_releases
  where org_id = cash_request.org_id and id <> release.id and (
    (status = 'released' and coalesce(released_at::date, scheduled_date) = current_date)
    or (status = 'scheduled' and scheduled_date = current_date)
  );
  if used_today + release.amount > budget.daily_petty_cash_release_limit then
    raise exception 'Daily release ceiling exceeded' using errcode = '22023';
  end if;

  update public.petty_cash_releases
  set status = 'released', released_by = caller, released_at = now(),
      release_method = p_release_method,
      cheque_number = case when p_release_method = 'cheque' then btrim(p_cheque_number) else null end
  where id = release.id;

  released_total := released_total + release.amount;
  update public.petty_cash_requests
  set released_amount = released_total,
      status = case when released_total >= approved_amount then 'released' else 'partially_released' end,
      liquidation_due_at = case when released_total >= approved_amount then now() + budget.liquidation_due_days * interval '1 day' else liquidation_due_at end,
      updated_at = now()
  where id = cash_request.id;

  insert into public.budget_ledger_entries(
    fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id,
    task_id, subtask_id, allocation_line_id, entry_type, amount, description,
    actor_id, actor_role, previous_state, new_state, metadata
  )
  select cash_request.fiscal_budget_id, cash_request.org_id, cash_request.commitment_id,
    cash_request.allocation_id, cash_request.id, cash_request.task_id,
    cash_request.subtask_id, cash_request.allocation_line_id, 'petty_cash_released',
    release.amount,
    case when p_release_method = 'cheque' then 'Cheque issued and recorded as released' else 'Cash released to recipient' end,
    caller, profile.role::text, 'scheduled', 'released',
    jsonb_build_object('releaseId', release.id, 'voucherNumber', release.voucher_number,
      'releaseMethod', p_release_method, 'chequeNumber', p_cheque_number)
  from public.profiles profile
  where profile.id = caller;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_department_accounting_staff(p_user_id uuid, p_assigned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_profile public.profiles;
  target_profile public.profiles;
  organization public.organizations;
begin
  if caller is null then raise exception 'Sign in before managing department access' using errcode = '42501'; end if;
  select * into caller_profile from public.profiles where id = caller and is_active for update;
  if not found or caller_profile.role not in ('head') then
    raise exception 'Only the Head can manage department accounting access' using errcode = '42501';
  end if;
  select * into organization from public.organizations where id = caller_profile.org_id and is_active for update;
  if not found or organization.head_user_id is distinct from caller then
    raise exception 'You can manage accounting access only for the department you currently head' using errcode = '42501';
  end if;
  select * into target_profile from public.profiles where id = p_user_id for update;
  if not found or not target_profile.is_active or target_profile.org_id is distinct from organization.id then
    raise exception 'Choose an active person in your own department' using errcode = '22023';
  end if;
  if target_profile.role not in ('member', 'accounting_staff') then
    raise exception 'Head, Member, and administrator roles cannot be changed from this office control' using errcode = '42501';
  end if;
  update public.profiles
  set role = case when p_assigned then 'accounting_staff' else 'member' end,
      updated_at = now()
  where id = target_profile.id;
  insert into public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action, before_data, after_data, org_id
  ) values (
    caller, caller_profile.full_name, 'profile', target_profile.id::text,
    case when p_assigned then 'accounting_access_assigned' else 'accounting_access_removed' end,
    jsonb_build_object('role', target_profile.role),
    jsonb_build_object('role', case when p_assigned then 'accounting_staff' else 'member' end),
    organization.id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_contribute_task(target_task uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  row_task public.tasks;
  caller_role text;
begin
  if caller_id is null then return false; end if;
  caller_role := public.auth_role(caller_id);
  if caller_role is null or caller_role = 'admin' then return false; end if;

  select *
    into row_task
  from public.tasks
  where id = target_task
    and deleted_at is null;
  if not found then return false; end if;

  return coalesce(((
    row_task.assigned_to = caller_id
    or row_task.recommendation_lead_id = caller_id
    or coalesce(to_jsonb(row_task.team_member_ids), '[]'::jsonb)
      ? caller_id::text
    or (
      caller_role in ('head')
      and public.org_in_my_subtree(row_task.org_id, caller_id)
    )
  )),false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.override_accounting_petty_cash_release_schedule(p_release_id uuid, p_reason text, p_release_method text DEFAULT 'cash'::text, p_cheque_number text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  release public.petty_cash_releases;
  cash_request public.petty_cash_requests;
  budget public.department_fiscal_budgets;
  released_total numeric;
  used_today numeric;
  override_reason text := nullif(btrim(p_reason), '');
  actor_role_value text;
begin
  if caller is null then raise exception 'Sign in before recording a release' using errcode = '42501'; end if;
  if p_release_method not in ('cash', 'cheque') then raise exception 'Choose cash or cheque release' using errcode = '22023'; end if;
  if p_release_method = 'cheque' and nullif(btrim(p_cheque_number), '') is null then raise exception 'Enter the cheque number before release' using errcode = '22023'; end if;
  if override_reason is null or length(override_reason) < 10 or length(override_reason) > 1000 then
    raise exception 'Explain the schedule override in 10 to 1000 characters' using errcode = '22023';
  end if;

  select request_row.* into cash_request
  from public.petty_cash_releases release_row
  join public.petty_cash_requests request_row on request_row.id = release_row.request_id
  where release_row.id = p_release_id
  for update of request_row;
  if not found then raise exception 'Scheduled release not found' using errcode = 'P0002'; end if;
  if not (public.is_department_accounting_staff(cash_request.org_id,caller) and public.has_permission(caller,'accounting.release_cash')) then
    raise exception 'Only authorized Accounting Staff can record a release' using errcode = '42501';
  end if;
  select * into budget from public.department_fiscal_budgets where id = cash_request.fiscal_budget_id and status = 'locked' for update;
  if not found then raise exception 'The annual department budget is no longer open' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eflow:cash-release:' || cash_request.org_id::text, 0));
  select * into release from public.petty_cash_releases where id = p_release_id for update;
  if release.status <> 'scheduled' then raise exception 'This release has already been processed' using errcode = '22023'; end if;
  if release.scheduled_date <= current_date then raise exception 'This release is already due; use the normal release confirmation' using errcode = '22023'; end if;
  if cash_request.status not in ('approved', 'scheduled_for_release', 'partially_released') or cash_request.approved_amount is null then
    raise exception 'The request must be fiscally approved before release' using errcode = '22023';
  end if;
  select coalesce(sum(amount), 0) into released_total from public.petty_cash_releases where request_id = cash_request.id and status = 'released';
  if released_total + release.amount > cash_request.approved_amount then raise exception 'This release would exceed the approved request amount' using errcode = '22023'; end if;
  select coalesce(sum(amount), 0) into used_today from public.petty_cash_releases
  where org_id = cash_request.org_id and id <> release.id and (
    (status = 'released' and coalesce(released_at::date, scheduled_date) = current_date)
    or (status = 'scheduled' and scheduled_date = current_date)
  );
  if used_today + release.amount > budget.daily_petty_cash_release_limit then
    raise exception 'Daily release ceiling exceeded' using errcode = '22023';
  end if;

  update public.petty_cash_releases
  set status = 'released', released_by = caller, released_at = now(), release_method = p_release_method,
      cheque_number = case when p_release_method = 'cheque' then btrim(p_cheque_number) else null end
  where id = release.id;
  released_total := released_total + release.amount;
  update public.petty_cash_requests
  set released_amount = released_total,
      status = case when released_total >= approved_amount then 'released' else 'partially_released' end,
      liquidation_due_at = case when released_total >= approved_amount then now() + budget.liquidation_due_days * interval '1 day' else liquidation_due_at end,
      updated_at = now()
  where id = cash_request.id;
  select role::text into actor_role_value from public.profiles where id = caller;
  insert into public.budget_ledger_entries(
    fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id, task_id, subtask_id, allocation_line_id,
    entry_type, amount, description, actor_id, actor_role, previous_state, new_state, reason, metadata
  ) values (
    cash_request.fiscal_budget_id, cash_request.org_id, cash_request.commitment_id, cash_request.allocation_id,
    cash_request.id, cash_request.task_id, cash_request.subtask_id, cash_request.allocation_line_id,
    'financial_override', 0, 'Early cash release recorded with schedule override', caller, actor_role_value,
    'scheduled', 'released', override_reason,
    jsonb_build_object('overrideType', 'cash_release_schedule', 'releaseId', release.id,
      'voucherNumber', release.voucher_number, 'originalScheduledDate', release.scheduled_date,
      'actualReleaseDate', current_date, 'releaseAmount', release.amount,
      'releaseMethod', p_release_method, 'chequeNumber', p_cheque_number)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.assign_task(p_task_id uuid, p_assignee uuid, p_assignee_name text DEFAULT NULL::text)
 RETURNS SETOF tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  t public.tasks;
  prev_status text;
  is_manager boolean;
  previous_assignee uuid;
  resolved_assignee_name text;
  assignee_org uuid;
  assignee_active boolean;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role::text, full_name
    into caller_role, caller_name
  from public.profiles
  where id = caller;

  select *
    into t
  from public.tasks
  where id = p_task_id
    and deleted_at is null
  for update;
  if not found then raise exception 'Task not found'; end if;
  prev_status := t.status;
  previous_assignee := t.assigned_to;

  if t.archived_at is not null then
    raise exception 'Archived tasks cannot be reassigned'
      using errcode = '22023';
  end if;
  if t.status in ('for_review', 'completed') then
    raise exception 'Reviewed work must be reopened before reassignment'
      using errcode = '22023';
  end if;

  is_manager := public.can_manage_task(t.id, caller);
  if not is_manager then
    raise exception 'Not allowed to assign this task' using errcode = '42501';
  end if;

  if p_assignee is null then
    if t.status not in ('pending_assignment', 'todo') then
      raise exception 'Active work must be reopened or reassigned, not cleared'
        using errcode = '22023';
    end if;
    resolved_assignee_name := '';
  else
    select full_name, org_id, is_active
      into resolved_assignee_name, assignee_org, assignee_active
    from public.profiles
    where id = p_assignee;
    if not found or not coalesce(assignee_active, false) then
      raise exception 'Assignee is not an active profile'
        using errcode = '22023';
    end if;

    if true then
      if caller_role in ('head') then
        if not public.org_in_my_subtree(assignee_org, caller) then
          raise exception 'Assignee is outside your organization scope'
            using errcode = '42501';
        end if;
      elsif assignee_org is distinct from t.org_id then
        raise exception 'Task leads may assign only within the task organization'
          using errcode = '42501';
      end if;
    end if;
  end if;

  perform set_config('eflow.allow_status_write', 'on', true);
  update public.tasks
  set
    assigned_to = p_assignee,
    assignee_name = resolved_assignee_name,
    status = case
      when p_assignee is not null and status = 'pending_assignment' then 'todo'
      when p_assignee is null then 'pending_assignment'
      else status
    end,
    last_activity_at = now()
  where id = p_task_id
  returning * into t;
  perform set_config('eflow.allow_status_write', 'off', true);

  if t.status is distinct from prev_status then
    insert into public.task_status_history (
      task_id,
      from_status,
      to_status,
      actor_id,
      actor_name,
      note
    )
    values (
      p_task_id,
      prev_status,
      t.status,
      caller,
      coalesce(caller_name, 'User'),
      'Assignment'
    );
  end if;

  insert into public.task_activities (
    task_id,
    type,
    content,
    actor_id,
    actor_name
  )
  values (
    p_task_id,
    'assigned',
    case
      when p_assignee is null then 'Assignment cleared'
      else 'Assigned to ' || resolved_assignee_name
    end,
    caller,
    coalesce(caller_name, 'User')
  );

  insert into public.audit_events (
    actor_id,
    actor_name,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    org_id
  )
  values (
    caller,
    coalesce(caller_name, 'User'),
    'task',
    p_task_id::text,
    'task.assigned',
    jsonb_build_object('assigned_to', previous_assignee, 'status', prev_status),
    jsonb_build_object('assigned_to', p_assignee, 'status', t.status),
    t.org_id
  );

  if p_assignee is not null and p_assignee <> caller then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      task_id,
      task_title,
      actor_id,
      actor_name,
      status_to
    )
    values (
      p_assignee,
      'assignment',
      'New Task Assigned',
      'You have been assigned to "' || t.title || '".',
      p_task_id,
      t.title,
      caller,
      coalesce(caller_name, 'User'),
      t.status
    );
  end if;

  return query select * from public.tasks where id = p_task_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_task_reviewers()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  reviewer_active boolean;
begin
  if new.reviewer_id is not null then
    if new.reviewer_id = new.assigned_to and not (new.review_route_mode='organization_default' and public.is_office_output_reviewer(new.org_id,new.reviewer_id)) then
      raise exception 'The assignee cannot review their own task'
        using errcode = '22023';
    end if;
    select is_active and role <> 'admin' into reviewer_active
    from public.profiles where id = new.reviewer_id;
    if not coalesce(reviewer_active, false) then
      raise exception 'Primary reviewer must be an active profile'
        using errcode = '22023';
    end if;
  end if;

  if new.backup_reviewer_id is not null then
    if new.backup_reviewer_id = new.assigned_to
       or new.backup_reviewer_id = new.reviewer_id then
      raise exception 'Backup reviewer must differ from assignee and primary reviewer'
        using errcode = '22023';
    end if;
    select is_active and role <> 'admin' into reviewer_active
    from public.profiles where id = new.backup_reviewer_id;
    if not coalesce(reviewer_active, false) then
      raise exception 'Backup reviewer must be an active profile'
        using errcode = '22023';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_task_for_review(p_task_id uuid, p_submission jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text;
  completion_note text;
  submission_id uuid;
  submission_version int;
  attachment jsonb;
  normalized_submission jsonb;
  t public.tasks;
  resolved_reviewer uuid;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  completion_note := nullif(btrim(p_submission ->> 'note'), '');
  if completion_note is null then
    raise exception 'Completion note is required' using errcode = '22023';
  end if;
  if p_submission ? 'attachments'
     and jsonb_typeof(p_submission -> 'attachments') <> 'array' then
    raise exception 'Submission attachments must be an array' using errcode = '22023';
  end if;

  select full_name into caller_name
  from public.profiles where id = caller;

  select * into t
  from public.tasks
  where id = p_task_id and deleted_at is null
  for update;
  if not found then raise exception 'Task not found'; end if;
  if t.archived_at is not null or t.status <> 'in_progress' then
    raise exception 'Only in-progress work can be submitted' using errcode = '22023';
  end if;
  if not (t.assigned_to = caller or t.recommendation_lead_id = caller) then
    raise exception 'Only the assignee or task lead may submit this work'
      using errcode = '42501';
  end if;

  if public.auth_role(caller) is null or public.auth_role(caller)='admin' then
    raise exception 'Operational account required' using errcode='42501';
  end if;
  if t.review_route_mode='organization_default' then
    select o.head_user_id into resolved_reviewer from public.organizations o
      where o.id=t.org_id and public.is_office_output_reviewer(o.id,o.head_user_id);
  else
    select p.id into resolved_reviewer from public.profiles p
      where p.id in (t.reviewer_id,t.backup_reviewer_id) and p.is_active and p.role<>'admin'
        and p.id<>caller and p.id is distinct from t.assigned_to
      order by (p.id=t.reviewer_id) desc limit 1;
  end if;
  if resolved_reviewer is null then raise exception 'Assign an eligible reviewer before submitting' using errcode='22023'; end if;

  submission_id := case
    when coalesce(p_submission ->> 'id', '') ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then (p_submission ->> 'id')::uuid
    else gen_random_uuid()
  end;
  select coalesce(max(version), 0) + 1 into submission_version
  from public.task_submissions where task_id = p_task_id;

  insert into public.task_submissions (
    id, task_id, version, submitter_id, submitter_name, note
  ) values (
    submission_id,
    p_task_id,
    submission_version,
    caller,
    coalesce(caller_name, 'User'),
    completion_note
  );

  for attachment in
    select value from jsonb_array_elements(
      coalesce(p_submission -> 'attachments', '[]'::jsonb)
    )
  loop
    insert into public.task_attachments (
      task_id,
      submission_id,
      uploaded_by,
      uploader_name,
      file_name,
      file_path,
      file_size,
      mime_type
    ) values (
      p_task_id,
      submission_id,
      caller,
      coalesce(caller_name, 'User'),
      coalesce(attachment ->> 'fileName', 'Attachment'),
      attachment ->> 'filePath',
      case
        when coalesce(attachment ->> 'fileSize', '') ~ '^\d+$'
          then (attachment ->> 'fileSize')::bigint
        else 0
      end,
      coalesce(attachment ->> 'mimeType', '')
    );
  end loop;

  normalized_submission := jsonb_build_object(
    'id', submission_id::text,
    'version', submission_version,
    'note', completion_note,
    'submitterId', caller::text,
    'submitterName', coalesce(caller_name, 'User'),
    'submittedAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,
    'attachments', coalesce(p_submission -> 'attachments', '[]'::jsonb)
  );

  perform set_config('eflow.allow_status_write', 'on', true);
  update public.tasks
  set
    reviewer_id = resolved_reviewer,
    latest_submission = normalized_submission,
    feedback = null,
    percent_complete = 100,
    status = 'for_review',
    last_activity_at = now()
  where id = p_task_id
  returning * into t;
  perform set_config('eflow.allow_status_write', 'off', true);

  insert into public.task_status_history (
    task_id, from_status, to_status, actor_id, actor_name, note
  ) values (
    p_task_id, 'in_progress', 'for_review', caller,
    coalesce(caller_name, 'User'), completion_note
  );

  insert into public.task_activities (
    task_id, type, content, actor_id, actor_name
  ) values (
    p_task_id, 'for_review', completion_note, caller,
    coalesce(caller_name, 'User')
  );

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action,
    reason, before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'User'), 'task', p_task_id::text,
    'task.transition.for_review', completion_note,
    jsonb_build_object('status', 'in_progress'),
    jsonb_build_object(
      'status', 'for_review',
      'submissionId', submission_id,
      'submissionVersion', submission_version,
      'reviewerId', resolved_reviewer
    ),
    t.org_id
  );

  if resolved_reviewer <> caller then
    insert into public.notifications (
      user_id, type, title, message, task_id, task_title,
      actor_id, actor_name, status_from, status_to, reason
    ) values (
      resolved_reviewer, 'approval_needed', 'Task ready for review',
      coalesce(caller_name, 'Someone') || ' submitted "' || t.title || '" for review.',
      p_task_id, t.title, caller, coalesce(caller_name, 'User'),
      'in_progress', 'for_review', completion_note
    );
  end if;

  return t;
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_see_collaboration_project(target_project uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select caller_id is not null and public.auth_role(caller_id) is not null and public.auth_role(caller_id) <> 'admin' and (
    false
    or public.is_project_member(target_project, caller_id)
    or exists (
      select 1
      from public.project_organizations participating
      where participating.project_id = target_project
        and (
          public.is_organization_approver(participating.organization_id, caller_id)
          or public.is_organization_member(participating.organization_id, caller_id)
        )
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.decide_task_review(p_task_id uuid, p_approve boolean, p_feedback text DEFAULT NULL::text, p_audit_hash text DEFAULT NULL::text)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  task_row public.tasks;
  submission public.task_submissions;
  next_status text;
  decision_hash text;
  recipient_id uuid;
  office_finalization boolean;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not p_approve and coalesce(btrim(p_feedback), '') = '' then
    raise exception 'Feedback is required when requesting changes'
      using errcode = '22023';
  end if;

  select role::text, full_name
    into caller_role, caller_name
  from public.profiles
  where id = caller and is_active;

  select *
    into task_row
  from public.tasks
  where id = p_task_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  if task_row.status <> 'for_review' then
    raise exception 'Task is not awaiting review' using errcode = '22023';
  end if;

  select *
    into submission
  from public.task_submissions
  where task_id = p_task_id
  order by version desc
  limit 1
  for update;

  if not found then
    raise exception 'No review submission exists' using errcode = '22023';
  end if;

  office_finalization := task_row.review_route_mode='organization_default'
    and task_row.reviewer_id=caller and public.is_office_output_reviewer(task_row.org_id,caller);
  if caller_role is null or caller_role='admin' then raise exception 'Operational account required' using errcode='42501'; end if;
  if submission.submitter_id = caller and not coalesce(office_finalization,false) then
    raise exception 'You cannot review your own submission' using errcode = '42501';
  end if;

  if not (
    task_row.reviewer_id = caller
    or task_row.backup_reviewer_id = caller
  ) then
    raise exception 'Only the assigned reviewer may decide this submission'
      using errcode = '42501';
  end if;

  next_status := case when p_approve then 'completed' else 'changes_requested' end;
  decision_hash := case when p_approve then encode(
    extensions.digest(
      p_task_id::text || ':' || submission.id::text || ':' || caller::text || ':' ||
      clock_timestamp()::text,
      'sha256'
    ),
    'hex'
  ) else null end;

  perform set_config('eflow.allow_status_write', 'on', true);
  perform set_config('eflow.review_decision_authorized', 'on', true);

  update public.tasks
  set
    status = next_status,
    percent_complete = case when p_approve then 100 else 99 end,
    feedback = nullif(btrim(p_feedback), ''),
    rejection_note = case
      when p_approve then rejection_note
      else nullif(btrim(p_feedback), '')
    end,
    rejected_at = case when p_approve then rejected_at else now() end,
    audit_hash = coalesce(decision_hash, audit_hash),
    last_activity_at = now()
  where id = p_task_id
  returning * into task_row;

  perform set_config('eflow.review_decision_authorized', 'off', true);
  perform set_config('eflow.allow_status_write', 'off', true);

  update public.task_submissions
  set
    status = case when p_approve then 'approved' else 'changes_requested' end,
    decided_by = caller,
    decided_by_name = coalesce(caller_name, 'Reviewer'),
    decision_feedback = nullif(btrim(p_feedback), ''),
    decided_at = now()
  where id = submission.id;

  insert into public.task_status_history (
    task_id, from_status, to_status, actor_id, actor_name, note
  ) values (
    p_task_id, 'for_review', next_status, caller,
    coalesce(caller_name, 'Reviewer'), nullif(btrim(p_feedback), '')
  );

  insert into public.task_activities (
    task_id, type, content, actor_id, actor_name
  ) values (
    p_task_id, next_status,
    coalesce(
      nullif(btrim(p_feedback), ''),
      case when p_approve then 'Review approved' else 'Changes requested' end
    ),
    caller, coalesce(caller_name, 'Reviewer')
  );

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action,
    reason, before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'Reviewer'), 'task', p_task_id::text,
    'task.transition.' || next_status, nullif(btrim(p_feedback), ''),
    jsonb_build_object('status', 'for_review', 'submissionId', submission.id),
    jsonb_build_object('status', next_status, 'auditHash', decision_hash,
      'performedBy',submission.submitter_id,'finalizedBy',caller,'officeId',task_row.org_id,
      'authority',case when office_finalization then 'Office Head' else 'Assigned reviewer' end,
      'selfFinalization',submission.submitter_id=caller),
    task_row.org_id
  );

  for recipient_id in
    select distinct recipient.user_id
    from unnest(array[
      task_row.assigned_to,
      submission.submitter_id,
      task_row.recommendation_lead_id
    ]) as recipient(user_id)
    where recipient.user_id is not null
      and recipient.user_id <> caller
  loop
    insert into public.notifications (
      user_id, type, title, message, task_id, task_title,
      actor_id, actor_name, status_from, status_to, reason
    ) values (
      recipient_id,
      case when p_approve then 'completed' else 'status_change' end,
      case when p_approve then 'Task approved' else 'Changes requested' end,
      case
        when p_approve then 'Your work on "' || task_row.title || '" was approved.'
        else 'Changes were requested for "' || task_row.title || '".'
      end,
      p_task_id, task_row.title, caller, coalesce(caller_name, 'Reviewer'),
      'for_review', next_status, coalesce(nullif(btrim(p_feedback), ''), '')
    );
  end loop;

  return task_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.decide_subtask_review(p_subtask_id uuid, p_approve boolean, p_feedback text DEFAULT NULL::text)
 RETURNS subtasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text;
  caller_role text;
  subtask_row public.subtasks;
  task_row public.tasks;
  submission_row public.subtask_submissions;
  next_status text;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if not p_approve and btrim(coalesce(p_feedback, '')) = '' then
    raise exception 'Feedback is required when requesting changes'
      using errcode = '22023';
  end if;

  select role::text, full_name into caller_role, caller_name
  from public.profiles where id = caller;
  select * into subtask_row from public.subtasks where id = p_subtask_id for update;
  if not found then raise exception 'Subtask not found' using errcode = 'P0002'; end if;
  if subtask_row.status <> 'for_review' then
    raise exception 'Subtask is not awaiting review' using errcode = '22023';
  end if;

  select * into submission_row from public.subtask_submissions
  where id = subtask_row.latest_submission_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending subtask submission not found' using errcode = '22023'; end if;
  if submission_row.submitter_id = caller then
    raise exception 'You cannot review your own subtask submission' using errcode = '42501';
  end if;
  if public.auth_role(caller) is null or caller_role='admin' or submission_row.reviewer_id is distinct from caller then
    raise exception 'Only the assigned Team Leader may review this subtask'
      using errcode = '42501';
  end if;

  select * into task_row from public.tasks where id = subtask_row.task_id;
  next_status := case when p_approve then 'completed' else 'changes_requested' end;

  perform set_config('eflow.subtask_workflow_authorized', 'on', true);
  update public.subtasks
  set
    status = next_status,
    percent_complete = case when p_approve then 100 else 99 end,
    is_completed = p_approve,
    completed_by = case when p_approve then submission_row.submitter_id else null end,
    completed_at = case when p_approve then now() else null end
  where id = p_subtask_id
  returning * into subtask_row;
  perform set_config('eflow.subtask_workflow_authorized', 'off', true);

  update public.subtask_submissions
  set
    status = case when p_approve then 'approved' else 'changes_requested' end,
    decided_by = caller,
    decided_by_name = coalesce(caller_name, 'Team Leader'),
    decision_feedback = nullif(btrim(p_feedback), ''),
    decided_at = now()
  where id = submission_row.id;

  insert into public.task_activities (task_id, type, content, actor_id, actor_name)
  values (
    subtask_row.task_id, 'subtask_' || next_status,
    'Subtask "' || subtask_row.title || '" ' ||
      case when p_approve then 'was approved' else 'needs changes' end,
    caller, coalesce(caller_name, 'Team Leader')
  );

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'Team Leader'), 'subtask', p_subtask_id::text,
    'subtask.' || next_status, nullif(btrim(p_feedback), ''),
    jsonb_build_object('status', 'for_review', 'submissionId', submission_row.id),
    jsonb_build_object('status', next_status, 'completed', p_approve),
    task_row.org_id
  );

  insert into public.notifications (
    user_id, type, title, message, task_id, task_title,
    actor_id, actor_name, status_from, status_to, reason
  ) values (
    submission_row.submitter_id,
    case when p_approve then 'completed' else 'status_change' end,
    case when p_approve then 'Subtask approved' else 'Subtask changes requested' end,
    case
      when p_approve then 'Your evidence for "' || subtask_row.title || '" was approved.'
      else 'Changes were requested for "' || subtask_row.title || '".'
    end,
    task_row.id, task_row.title, caller, coalesce(caller_name, 'Team Leader'),
    'for_review', next_status, coalesce(nullif(btrim(p_feedback), ''), '')
  );

  return subtask_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_use_work_templates(target_org uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = caller_id
      and p.is_active
      and (
        false
        or (
          p.org_id = target_org
          and (
            p.role::text in ('head')
            or exists (
              select 1
              from public.tasks t
              where t.org_id = target_org
                and t.deleted_at is null
                and (
                  t.recommendation_lead_id = caller_id
                  or (t.recommendation_lead_id is null and t.assigned_to = caller_id)
                )
            )
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_approve_work_templates(target_org uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = caller_id
      and p.is_active
      and (
        false
        or (
          p.org_id = target_org
          and p.role::text in ('head')
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_access_org(p_user_id uuid, p_org_id uuid, p_access_level text DEFAULT 'read'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  requested_rank integer;
  caller_role text;
begin
  if p_user_id is null or p_org_id is null then return false; end if;
  requested_rank := case p_access_level
    when 'read' then 1
    when 'review' then 2
    when 'manage' then 3
    else 99
  end;
  if requested_rank = 99 then return false; end if;

  caller_role := public.auth_role(p_user_id);
  if caller_role is null or caller_role = 'admin' then return false; end if;

  -- Preserve the existing Head/Member organization subtree scope.
  if caller_role in ('head')
     and public.org_in_my_subtree(p_org_id, p_user_id) then
    return true;
  end if;

  -- An explicit grant covers the selected organization and its descendants.
  return exists (
    select 1
    from public.user_org_scope_grants grant_row
    join public.organizations grant_org on grant_org.id = grant_row.org_id
    join public.organizations target_org on target_org.id = p_org_id
    where grant_row.user_id = p_user_id
      and (grant_row.expires_at is null or grant_row.expires_at > now())
      and (
        target_org.path::text = grant_org.path::text
        or target_org.path::text like grant_org.path::text || '.%'
      )
      and case grant_row.access_level
        when 'read' then 1
        when 'review' then 2
        when 'manage' then 3
        else 0
      end >= requested_rank
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.dispatch_hierarchy_deadline_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inserted_count int := 0;
begin
  with task_dates as (
    select task.*,
      case
        when task.due_date ~ '^\d{4}-\d{2}-\d{2}' then left(task.due_date, 10)::date
        when task.deadline ~ '^\d{4}-\d{2}-\d{2}' then left(task.deadline, 10)::date
        else null
      end as due_on
    from public.tasks task
    where task.deleted_at is null and task.archived_at is null
  ), proposal_dates as (
    select project.org_id, project.proposal_id,
      max(project.proposal_title) as title,
      max(project.target_date) as due_on,
      bool_or(project.status not in ('completed', 'archived')) as incomplete
    from public.projects project
    where project.proposal_id is not null and project.status <> 'archived'
    group by project.org_id, project.proposal_id
  ), deadline_candidates as (
    select 'subtask'::text as entity_type, subtask.id::text as entity_key,
      subtask.title as entity_title, subtask.due_date as due_on,
      recipient.recipient_id, case when subtask.due_date < current_date then 'overdue' else 'due_soon' end as reminder_kind,
      task.id as task_id, task.title as task_title, task.linked_project_id as project_id,
      task.proposal_id, task.org_id
    from public.subtasks subtask
    join task_dates task on task.id = subtask.task_id
    cross join lateral (
      select distinct recipient_id from unnest(
        coalesce(subtask.assigned_to_ids, '{}'::uuid[])
        || array_remove(array[subtask.assigned_to, task.recommendation_lead_id], null)
      ) recipient_id
    ) recipient
    where subtask.is_completed = false
      and subtask.status not in ('completed', 'for_review')
      and subtask.due_date is not null
      and subtask.due_date <= current_date + 3

    union all

    select 'task', task.id::text, task.title, task.due_on,
      recipient.recipient_id, case when task.due_on < current_date then 'overdue' else 'due_soon' end,
      task.id, task.title, task.linked_project_id, task.proposal_id, task.org_id
    from task_dates task
    left join public.organizations org on org.id = task.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        coalesce(task.team_member_ids, '{}'::uuid[])
        || array_remove(array[task.assigned_to, task.recommendation_lead_id, org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where task.status not in ('completed', 'cancelled')
      and task.due_on is not null and task.due_on <= current_date + 3

    union all

    select 'project', project.id::text, project.title, project.target_date,
      recipient.recipient_id, case when project.target_date < current_date then 'overdue' else 'due_soon' end,
      null::uuid, null::text, project.id, project.proposal_id, project.org_id
    from public.projects project
    left join public.organizations org on org.id = project.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[project.owner_id, org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where project.status not in ('completed', 'archived')
      and project.target_date is not null and project.target_date <= current_date + 3

    union all

    select 'proposal', proposal.org_id::text || ':' || proposal.proposal_id,
      coalesce(proposal.title, 'Proposal'), proposal.due_on,
      recipient.recipient_id, case when proposal.due_on < current_date then 'overdue' else 'due_soon' end,
      null::uuid, null::text, null::uuid, proposal.proposal_id, proposal.org_id
    from proposal_dates proposal
    join public.organizations org on org.id = proposal.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where proposal.incomplete and proposal.due_on is not null and proposal.due_on <= current_date + 3
  ), completion_candidates as (
    select 'project'::text as entity_type, project.id::text as entity_key,
      project.title as entity_title, coalesce(project.target_date, project.created_at::date) as due_on,
      recipient.recipient_id, 'completion_recommended'::text as reminder_kind,
      null::uuid as task_id, null::text as task_title, project.id as project_id,
      project.proposal_id, project.org_id
    from public.projects project
    left join public.organizations org on org.id = project.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[project.owner_id, org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where project.status not in ('completed', 'archived')
      and exists (
        select 1 from public.tasks task
        where task.linked_project_id = project.id and task.deleted_at is null
          and task.archived_at is null and task.status <> 'cancelled'
      )
      and not exists (
        select 1 from public.tasks task
        where task.linked_project_id = project.id and task.deleted_at is null
          and task.archived_at is null and task.status not in ('completed', 'cancelled')
      )

    union all

    select 'proposal', project.org_id::text || ':' || project.proposal_id,
      max(project.proposal_title), coalesce(max(project.target_date), min(project.created_at)::date),
      recipient.recipient_id, 'completion_recommended',
      null::uuid, null::text, null::uuid, project.proposal_id, project.org_id
    from public.projects project
    join public.organizations org on org.id = project.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where project.proposal_id is not null and project.status <> 'archived'
      and exists (select 1 from public.projects incomplete where incomplete.org_id = project.org_id and incomplete.proposal_id = project.proposal_id and incomplete.status <> 'completed')
      and not exists (
        select 1
        from public.projects child
        where child.org_id = project.org_id and child.proposal_id = project.proposal_id and child.status <> 'archived'
          and (
            not exists (select 1 from public.tasks task where task.linked_project_id = child.id and task.deleted_at is null and task.archived_at is null and task.status <> 'cancelled')
            or exists (select 1 from public.tasks task where task.linked_project_id = child.id and task.deleted_at is null and task.archived_at is null and task.status not in ('completed', 'cancelled'))
          )
      )
    group by project.org_id, project.proposal_id, recipient.recipient_id
  ), candidates as (
    select distinct * from deadline_candidates
    union
    select distinct * from completion_candidates
  ), inserted as (
    insert into public.hierarchy_deadline_reminders (
      entity_type, entity_key, recipient_id, reminder_kind, due_on
    )
    select entity_type, entity_key, recipient_id, reminder_kind, due_on
    from candidates
    on conflict do nothing
    returning entity_type, entity_key, recipient_id, reminder_kind, due_on
  ), notifications_inserted as (
    insert into public.notifications (
      user_id, type, title, message, task_id, task_title,
      status_to, reason, project_id, proposal_id, org_id, entity_type
    )
    select inserted.recipient_id,
      case when inserted.reminder_kind = 'completion_recommended' then 'status_change' else 'overdue' end,
      case
        when inserted.reminder_kind = 'completion_recommended' then initcap(inserted.entity_type) || ' ready to complete'
        when inserted.reminder_kind = 'overdue' then initcap(inserted.entity_type) || ' overdue'
        else initcap(inserted.entity_type) || ' due soon'
      end,
      case
        when inserted.reminder_kind = 'completion_recommended' then 'All delivery work for "' || candidate.entity_title || '" is approved. Review and mark it completed.'
        when inserted.reminder_kind = 'overdue' then '"' || candidate.entity_title || '" passed its target date on ' || to_char(inserted.due_on, 'Mon DD, YYYY') || ' and is not completed.'
        else '"' || candidate.entity_title || '" is due on ' || to_char(inserted.due_on, 'Mon DD, YYYY') || '.'
      end,
      candidate.task_id, candidate.task_title,
      case when inserted.reminder_kind = 'completion_recommended' then 'completion_recommended' else null end,
      'Target date: ' || to_char(inserted.due_on, 'Mon DD, YYYY'),
      candidate.project_id, candidate.proposal_id, candidate.org_id, inserted.entity_type
    from inserted
    join candidates candidate
      on candidate.entity_type = inserted.entity_type
      and candidate.entity_key = inserted.entity_key
      and candidate.recipient_id = inserted.recipient_id
      and candidate.reminder_kind = inserted.reminder_kind
      and candidate.due_on = inserted.due_on
    returning 1
  )
  select count(*) into inserted_count from notifications_inserted;

  return inserted_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_monthly_productivity(p_month_start date, p_reason text)
 RETURNS SETOF monthly_productivity_snapshots
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  normalized_month date := date_trunc('month', p_month_start)::date;
  month_begin timestamptz;
  month_end timestamptz;
  caller_name text := '';
begin
  if caller is not null then
    raise exception 'Monthly recalculation is a scheduled system operation' using errcode = '42501';
  end if;
  if caller is null and p_reason <> 'Scheduled month close' then
    raise exception 'A signed-in Admin is required for manual recalculation' using errcode = '42501';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A recalculation reason is required' using errcode = '22023';
  end if;
  if normalized_month >= date_trunc('month', now() at time zone 'Asia/Manila')::date then
    raise exception 'Only a closed Manila calendar month can be snapshotted' using errcode = '22023';
  end if;
  month_begin := normalized_month::timestamp at time zone 'Asia/Manila';
  month_end := (normalized_month + interval '1 month')::timestamp at time zone 'Asia/Manila';
  select coalesce(full_name, '') into caller_name from public.profiles where id = caller;

  delete from public.monthly_productivity_snapshots where month_start = normalized_month;

  insert into public.monthly_productivity_snapshots (
    month_start, user_id, org_id, approved_tasks, approved_subtasks,
    on_time_rate, median_cycle_hours, first_pass_rate,
    delivery_score, quality_score, speed_score, collaboration_score,
    contribution_score, source_summary, generated_by
  )
  with approved_work as (
    select distinct on (submission.task_id)
      submission.task_id as work_id,
      'task'::text as kind,
      submission.submitter_id as user_id,
      task.org_id,
      submission.version,
      submission.submitted_at,
      submission.decided_at,
      task.created_at,
      task.priority,
      task.estimated_hours,
      case
        when task.due_date ~ '^\d{4}-\d{2}-\d{2}' then left(task.due_date, 10)::date
        when task.deadline ~ '^\d{4}-\d{2}-\d{2}' then left(task.deadline, 10)::date
      end as due_date
    from public.task_submissions submission
    join public.tasks task on task.id = submission.task_id
    where submission.status = 'approved'
      and submission.decided_at >= month_begin and submission.decided_at < month_end
      and (submission.decided_by is distinct from submission.submitter_id or exists (
        select 1 from public.audit_events a where a.entity_id=task.id::text and a.action='task.transition.completed'
          and a.after_data->>'authority'='Office Head' and (a.before_data->>'submissionId')=submission.id::text))
      and task.deleted_at is null and task.status <> 'cancelled'
      and not (task.reopened_at is not null and task.reopened_at > submission.decided_at)
    order by submission.task_id, submission.decided_at desc
  ), approved_subtask_work as (
    select distinct on (submission.subtask_id)
      submission.subtask_id as work_id,
      'subtask'::text as kind,
      submission.submitter_id as user_id,
      task.org_id,
      submission.version,
      submission.submitted_at,
      submission.decided_at,
      subtask.created_at,
      task.priority,
      null::numeric as estimated_hours,
      case
        when task.due_date ~ '^\d{4}-\d{2}-\d{2}' then left(task.due_date, 10)::date
        when task.deadline ~ '^\d{4}-\d{2}-\d{2}' then left(task.deadline, 10)::date
      end as due_date
    from public.subtask_submissions submission
    join public.subtasks subtask on subtask.id = submission.subtask_id
    join public.tasks task on task.id = submission.task_id
    where submission.status = 'approved'
      and submission.decided_at >= month_begin and submission.decided_at < month_end
      and submission.decided_by is distinct from submission.submitter_id
      and task.deleted_at is null and task.status <> 'cancelled'
    order by submission.subtask_id, submission.decided_at desc
  ), work as (
    select * from approved_work union all select * from approved_subtask_work
  ), scored as (
    select *,
      extract(epoch from (decided_at - created_at)) / 3600.0 as cycle_hours,
      (due_date is not null and (decided_at at time zone 'Asia/Manila')::date <= due_date) as on_time,
      case priority when 'high' then 2.0 when 'medium' then 1.5 else 1.0 end
        * case when kind = 'task' then least(3.0, greatest(0.75, coalesce(estimated_hours, 8) / 8.0)) else 1.0 end as effort_weight
    from work
  ), aggregate_rows as (
    select user_id, org_id,
      count(*) filter (where kind = 'task')::integer as approved_tasks,
      count(*) filter (where kind = 'subtask')::integer as approved_subtasks,
      round(100 * avg(case when on_time then 1 else 0 end), 2) as on_time_rate,
      round((percentile_cont(0.5) within group (order by cycle_hours))::numeric, 2) as median_cycle_hours,
      round(100 * avg(case when version = 1 then 1 else 0 end), 2) as first_pass_rate,
      round(sum(case when kind = 'task' then effort_weight * 10 else 0 end), 2) as delivery_score,
      round((avg(case when on_time then 1 else 0 end) * 10 + avg(case when version = 1 then 1 else 0 end) * 10)::numeric, 2) as quality_score,
      round(least(10, coalesce(
        avg(case when cycle_hours <= estimated_hours * 2 then 10 else 0 end)
          filter (where kind = 'task' and estimated_hours is not null),
        0
      ))::numeric, 2) as speed_score,
      least(30, count(*) filter (where kind = 'subtask') * 3)::numeric as collaboration_score
    from scored group by user_id, org_id
  )
  select normalized_month, user_id, org_id, approved_tasks, approved_subtasks,
    on_time_rate, median_cycle_hours, first_pass_rate,
    delivery_score, quality_score, speed_score, collaboration_score,
    round(delivery_score + quality_score + speed_score + collaboration_score, 2),
    jsonb_build_object('timezone', 'Asia/Manila', 'calculation_version', 'v1', 'reason', p_reason), caller
  from aggregate_rows;

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason, after_data
  ) values (
    caller, caller_name, 'monthly_productivity_snapshot', normalized_month::text,
    'productivity.snapshot_recalculated', btrim(p_reason),
    jsonb_build_object('month_start', normalized_month, 'timezone', 'Asia/Manila', 'calculation_version', 'v1')
  );

  return query select * from public.monthly_productivity_snapshots
  where month_start = normalized_month order by contribution_score desc, user_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_collaboration_participant(target_draft uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare draft_row public.proposal_collaboration_drafts;
begin
  if target_draft is null or caller_id is null then return false; end if;
  select * into draft_row from public.proposal_collaboration_drafts
  where id = target_draft and deleted_at is null;
  if not found then return false; end if;
  if public.auth_role(caller_id) is null or public.auth_role(caller_id) = 'admin' then return false; end if;
  if draft_row.owner_user_id = caller_id
     or public.is_organization_approver(draft_row.owner_org_id, caller_id)
     or public.is_organization_member(draft_row.owner_org_id, caller_id) then
    return true;
  end if;
  if exists (
    select 1 from public.proposal_collaboration_orgs participant
    where participant.draft_id = target_draft
      and (
        public.is_organization_approver(participant.org_id, caller_id)
        or public.is_organization_member(participant.org_id, caller_id)
      )
  ) then return true; end if;
  if exists (
    select 1
    from public.projects project
    left join public.project_members member
      on member.project_id = project.id and member.user_id = caller_id
    where project.source_collaboration_draft_id = target_draft
      and (project.owner_id = caller_id or project.created_by = caller_id or member.user_id is not null)
  ) then return true; end if;
  return exists (
    select 1
    from public.tasks task
    where task.source_collaboration_draft_id = target_draft
      and task.deleted_at is null
      and (
        task.assigned_to = caller_id
        or task.recommendation_lead_id = caller_id
        or task.reviewer_id = caller_id
        or task.backup_reviewer_id = caller_id
        or coalesce(to_jsonb(task.team_member_ids), '[]'::jsonb) ? caller_id::text
        or exists (
          select 1 from public.subtasks subtask
          where subtask.task_id = task.id
            and coalesce(subtask.assigned_to_ids, '{}'::uuid[]) @> array[caller_id]
        )
      )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.commit_collaboration_draft(p_draft_id uuid, p_revision_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text := '';
  draft_row public.proposal_collaboration_drafts;
  revision_row public.proposal_collaboration_revisions;
  readiness jsonb;
  snapshot jsonb;
  task_item jsonb;
  project_item record;
  activity_item record;
  project_row public.projects;
  milestone_row public.milestones;
  task_row public.tasks;
  owner_org public.proposal_collaboration_orgs;
  governance_org public.proposal_collaboration_orgs;
  primary_reviewer uuid;
  backup_reviewer uuid;
  task_lead uuid;
  primary_org uuid;
  activity_primary_org uuid;
  member_ids uuid[];
  member_names text[];
  supporting_value text;
  selected_reviewer uuid;
  selected_backup uuid;
  route_mode text;
  project_ids uuid[] := '{}'::uuid[];
  project_target date;
  project_start date;
  milestone_due date;
  import_batch text;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may commit this proposal' using errcode = '42501';
  end if;
  select * into draft_row from public.proposal_collaboration_drafts where id = p_draft_id for update;
  if not found then raise exception 'Collaboration draft not found' using errcode = 'P0002'; end if;
  if draft_row.status = 'committed' or draft_row.committed_at is not null then raise exception 'This proposal has already been committed' using errcode = '22023'; end if;
  if draft_row.current_revision_id is distinct from p_revision_id then raise exception 'Only the current revision can be committed' using errcode = '22023'; end if;
  select * into revision_row from public.proposal_collaboration_revisions where id = p_revision_id and draft_id = p_draft_id;
  if not found then raise exception 'Revision does not belong to this draft' using errcode = '22023'; end if;
  readiness := public.collaboration_readiness(p_draft_id);
  if not coalesce((readiness ->> 'ready')::boolean, false) then
    raise exception 'Approval requirements not complete: %', coalesce(readiness -> 'blockers', '[]'::jsonb)::text using errcode = '22023';
  end if;

  snapshot := revision_row.snapshot;
  if jsonb_typeof(snapshot -> 'tasks') <> 'array' or jsonb_array_length(snapshot -> 'tasks') = 0 then
    raise exception 'The approved revision contains no tasks' using errcode = '22023';
  end if;
  select * into owner_org from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role = 'owner';
  if not found or owner_org.org_id <> draft_row.owner_org_id then raise exception 'Owner organization configuration is invalid' using errcode = '22023'; end if;

  select * into governance_org from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role = 'governance'
  order by created_at limit 1;
  if found then
    select coalesce(
      (select membership.user_id from public.organization_memberships membership join public.profiles profile on profile.id = membership.user_id and profile.is_active where membership.organization_id = governance_org.org_id and membership.membership_role = 'primary_approver'),
      (select organization.head_user_id from public.organizations organization join public.profiles profile on profile.id = organization.head_user_id and profile.is_active where organization.id = governance_org.org_id)
    ) into primary_reviewer;
    select coalesce(
      (select membership.user_id from public.organization_memberships membership join public.profiles profile on profile.id = membership.user_id and profile.is_active where membership.organization_id = governance_org.org_id and membership.membership_role = 'backup_approver'),
      null::uuid
    ) into backup_reviewer;
    if primary_reviewer is null and backup_reviewer is null then raise exception 'Governance organization requires an active named primary or backup governance reviewer' using errcode = '22023'; end if;
  end if;

  import_batch := 'collaboration-' || p_draft_id::text || '-r' || revision_row.revision_number::text;

  -- Validate every staffing and responsibility record before the first insert.
  for task_item in
    select value from jsonb_array_elements(snapshot -> 'tasks')
    where coalesce((value ->> 'enabled')::boolean, true)
  loop
    task_lead := nullif(task_item ->> 'leadMemberId', '')::uuid;
    primary_org := coalesce(nullif(task_item ->> 'primaryOrgId', '')::uuid, draft_row.owner_org_id);
    member_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(task_item -> 'assignedMemberIds', '[]'::jsonb)));
    if nullif(btrim(task_item ->> 'title'), '') is null then raise exception 'Every selected task needs a title' using errcode = '22023'; end if;
    if task_lead is null or not member_ids @> array[task_lead] then raise exception 'Every Task Leader must belong to their proposed team' using errcode = '22023'; end if;
    if not exists (select 1 from public.proposal_collaboration_orgs eligible where eligible.draft_id = p_draft_id and eligible.org_id = primary_org and eligible.staffing_enabled) then
      raise exception 'Task primary organization is not staffing-enabled for this proposal' using errcode = '22023';
    end if;
    if not exists (select 1 from public.profiles profile where profile.id = task_lead and profile.is_active) then raise exception 'Every Task Leader must be active' using errcode = '22023'; end if;
    if exists (
      select 1 from unnest(member_ids) member_id
      left join public.profiles profile on profile.id = member_id and profile.is_active
      where profile.id is null or not exists (
        select 1 from public.proposal_collaboration_orgs eligible
        where eligible.draft_id = p_draft_id and eligible.org_id = profile.org_id and eligible.staffing_enabled
      )
    ) then raise exception 'Every proposed employee must be active and belong to a staffing-enabled participating organization' using errcode = '22023'; end if;
    for supporting_value in select value from jsonb_array_elements_text(coalesce(task_item -> 'supportingOrgIds', '[]'::jsonb)) loop
      if supporting_value::uuid = primary_org or not exists (select 1 from public.proposal_collaboration_orgs where draft_id = p_draft_id and org_id = supporting_value::uuid) then
        raise exception 'Task supporting organization configuration is invalid' using errcode = '22023';
      end if;
    end loop;
    if governance_org.org_id is not null and task_lead = primary_reviewer and backup_reviewer is null then
      raise exception 'Approval requirements not complete: primary governance reviewer is Task Lead and no backup reviewer is configured' using errcode = '22023';
    end if;
    if governance_org.org_id is not null and task_lead = backup_reviewer and primary_reviewer is null then
      raise exception 'Approval requirements not complete: backup governance reviewer is Task Lead and no primary reviewer is configured' using errcode = '22023';
    end if;
  end loop;

  for project_item in
    select task ->> 'projectId' as project_key,
      max(task ->> 'projectTitle') as project_title,
      max(task ->> 'programId') as program_id,
      max(task ->> 'programTitle') as program_title,
      min(case when task ->> 'deadline' ~ '^\d{4}-\d{2}-\d{2}' then left(task ->> 'deadline', 10)::date end) as start_date,
      max(case when task ->> 'deadline' ~ '^\d{4}-\d{2}-\d{2}' then left(task ->> 'deadline', 10)::date end) as target_date
    from jsonb_array_elements(snapshot -> 'tasks') task
    where coalesce((task ->> 'enabled')::boolean, true)
    group by task ->> 'projectId'
  loop
    if nullif(btrim(project_item.project_key), '') is null or nullif(btrim(project_item.project_title), '') is null then raise exception 'Every task must belong to a valid project' using errcode = '22023'; end if;
    project_start := project_item.start_date;
    project_target := project_item.target_date;
    insert into public.projects (
      org_id, title, description, owner_id, status, priority, start_date, target_date,
      created_by, proposal_id, proposal_title, program_id, program_title,
      source_type, source_file_name, source_collaboration_draft_id, source_collaboration_revision_id
    ) values (
      draft_row.owner_org_id, project_item.project_title,
      case when draft_row.source_type = 'ai_pdf' then 'Imported through approved collaboration: ' else 'Approved collaborative plan: ' end || draft_row.title,
      draft_row.owner_user_id, 'active', 'medium', project_start, project_target,
      caller, coalesce(snapshot ->> 'proposalId', p_draft_id::text), draft_row.title,
      project_item.program_id, project_item.program_title, draft_row.source_type,
      draft_row.source_file_name, p_draft_id, p_revision_id
    ) returning * into project_row;
    project_ids := array_append(project_ids, project_row.id);
    insert into public.proposal_collaboration_commit_projects (draft_id, revision_id, project_key, project_id)
    values (p_draft_id, p_revision_id, project_item.project_key, project_row.id);

    insert into public.project_organizations (
      project_id, organization_id, participation_role, staffing_enabled, source_draft_id, source_revision_id
    ) select project_row.id, participating.org_id, participating.participation_role,
      participating.staffing_enabled, p_draft_id, p_revision_id
    from public.proposal_collaboration_orgs participating where participating.draft_id = p_draft_id;

    insert into public.project_members (project_id, user_id, role)
    values (project_row.id, draft_row.owner_user_id, 'owner')
    on conflict (project_id, user_id) do update set role = excluded.role;
    insert into public.project_members (project_id, user_id, role)
    select distinct project_row.id, member_id, 'member'
    from jsonb_array_elements(snapshot -> 'tasks') task
    cross join lateral jsonb_array_elements_text(coalesce(task -> 'assignedMemberIds', '[]'::jsonb)) member_text(value)
    cross join lateral (select member_text.value::uuid as member_id) member
    where task ->> 'projectId' = project_item.project_key
      and coalesce((task ->> 'enabled')::boolean, true)
    on conflict (project_id, user_id) do nothing;

    for activity_item in
      select task ->> 'activityId' as activity_key,
        max(task ->> 'activityTitle') as activity_title,
        max(task ->> 'activitySchedule') as activity_schedule,
        max(task ->> 'activityPrimaryOrgId') as primary_org_id,
        (jsonb_agg(coalesce(task -> 'activitySupportingOrgIds', '[]'::jsonb)) -> 0) as supporting_org_ids,
        max(case when task ->> 'deadline' ~ '^\d{4}-\d{2}-\d{2}' then left(task ->> 'deadline', 10)::date end) as due_date
      from jsonb_array_elements(snapshot -> 'tasks') task
      where task ->> 'projectId' = project_item.project_key and coalesce((task ->> 'enabled')::boolean, true)
      group by task ->> 'activityId'
    loop
      milestone_due := activity_item.due_date;
      insert into public.milestones (project_id, title, description, due_date, sort_order)
      values (project_row.id, activity_item.activity_title,
        case when nullif(activity_item.activity_schedule, '') is null then '' else 'Original schedule: ' || activity_item.activity_schedule end,
        milestone_due, (select count(*) from public.milestones where project_id = project_row.id))
      returning * into milestone_row;
      activity_primary_org := coalesce(nullif(activity_item.primary_org_id, '')::uuid, draft_row.owner_org_id);
      if not exists (
        select 1 from public.proposal_collaboration_orgs
        where draft_id = p_draft_id and org_id = activity_primary_org and staffing_enabled
      ) then raise exception 'Activity primary organization must be a staffing-enabled participant' using errcode = '22023'; end if;
      insert into public.milestone_organizations (milestone_id, organization_id, responsibility_role)
      values (milestone_row.id, activity_primary_org, 'primary');
      for supporting_value in select value from jsonb_array_elements_text(coalesce(activity_item.supporting_org_ids, '[]'::jsonb)) loop
        if supporting_value::uuid <> activity_primary_org then
          if not exists (
            select 1 from public.proposal_collaboration_orgs
            where draft_id = p_draft_id and org_id = supporting_value::uuid
          ) then raise exception 'Activity supporting organization is not participating' using errcode = '22023'; end if;
          insert into public.milestone_organizations (milestone_id, organization_id, responsibility_role)
          values (milestone_row.id, supporting_value::uuid, 'supporting') on conflict do nothing;
        end if;
      end loop;

      for task_item in
        select value from jsonb_array_elements(snapshot -> 'tasks')
        where value ->> 'projectId' = project_item.project_key
          and value ->> 'activityId' = activity_item.activity_key
          and coalesce((value ->> 'enabled')::boolean, true)
      loop
        task_lead := nullif(task_item ->> 'leadMemberId', '')::uuid;
        primary_org := coalesce(nullif(task_item ->> 'primaryOrgId', '')::uuid, activity_primary_org);
        member_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(task_item -> 'assignedMemberIds', '[]'::jsonb)));
        select array_agg(profile.full_name order by member_position.ordinality)
        into member_names
        from unnest(member_ids) with ordinality member_position(member_id, ordinality)
        join public.profiles profile on profile.id = member_position.member_id;

        if governance_org.org_id is not null then
          route_mode := 'governance';
          selected_reviewer := case when task_lead = primary_reviewer then backup_reviewer else primary_reviewer end;
          selected_backup := case
            when task_lead = backup_reviewer or backup_reviewer = selected_reviewer then null
            else backup_reviewer
          end;
          if selected_reviewer is null or selected_reviewer = task_lead then raise exception 'No valid governance reviewer exists for task "%"', task_item ->> 'title' using errcode = '22023'; end if;
        else
          route_mode := 'organization_default';
          selected_reviewer := null;
          selected_backup := null;
        end if;

        insert into public.tasks (
          title, description, status, priority, assigned_to, assignee_name,
          department, org_id, team_id, team_name, team_member_ids, team_member_names,
          deadline, due_date, tags, recommended_employee_ids,
          recommendation_reasoning, recommendation_source, recommendation_lead_id,
          reviewer_id, backup_reviewer_id, proposal_id, proposal_title,
          program_id, program_title, project_id, project_title,
          activity_id, activity_title, activity_schedule, hierarchy_path,
          import_batch_id, linked_project_id, milestone_id, percent_complete, estimated_hours,
          review_route_mode, source_collaboration_draft_id,
          source_collaboration_revision_id, created_by
        ) values (
          btrim(task_item ->> 'title'), nullif(task_item ->> 'description', ''), 'todo',
          coalesce(nullif(task_item ->> 'priority', ''), 'medium'), task_lead,
          (select full_name from public.profiles where id = task_lead),
          primary_org::text, primary_org, primary_org::text,
          (select name from public.organizations where id = primary_org),
          member_ids, coalesce(member_names, '{}'::text[]),
          coalesce(task_item ->> 'deadline', ''), coalesce(task_item ->> 'deadline', ''),
          array(select value from jsonb_array_elements_text(coalesce(task_item -> 'requiredSkills', '[]'::jsonb))),
          member_ids, nullif(task_item ->> 'reasoning', ''),
          case when draft_row.source_type = 'ai_pdf' then 'import' else null end,
          task_lead, selected_reviewer, selected_backup,
          coalesce(snapshot ->> 'proposalId', p_draft_id::text), draft_row.title,
          project_item.program_id, project_item.program_title,
          project_item.project_key, project_item.project_title,
          activity_item.activity_key, activity_item.activity_title,
          activity_item.activity_schedule,
          concat_ws(' > ', draft_row.title, project_item.program_title, project_item.project_title, activity_item.activity_title),
          import_batch, project_row.id, milestone_row.id, 0,
          greatest(coalesce((task_item ->> 'estimatedHours')::numeric, 0), 0),
          route_mode, p_draft_id, p_revision_id, caller
        ) returning * into task_row;
        insert into public.task_organizations (task_id, organization_id, responsibility_role)
        values (task_row.id, primary_org, 'primary');
        for supporting_value in select value from jsonb_array_elements_text(coalesce(task_item -> 'supportingOrgIds', '[]'::jsonb)) loop
          if supporting_value::uuid <> primary_org then
            insert into public.task_organizations (task_id, organization_id, responsibility_role)
            values (task_row.id, supporting_value::uuid, 'supporting') on conflict do nothing;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  update public.proposal_collaboration_drafts
  set status = 'committed', committed_at = now(), working_snapshot = revision_row.snapshot
  where id = p_draft_id;
  select coalesce(full_name, 'Owner') into caller_name from public.profiles where id = caller;
  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, after_data, org_id
  ) values (
    caller, caller_name, 'collaboration_draft', p_draft_id::text,
    'collaboration.committed',
    jsonb_build_object('revisionId', p_revision_id, 'revision', revision_row.revision_number, 'projectIds', to_jsonb(project_ids)),
    draft_row.owner_org_id
  );
  insert into public.notifications (user_id, type, title, message, actor_id, actor_name, proposal_id, org_id, entity_type)
  select distinct approver_id, 'collaboration_approved', 'Work plan published',
    '"' || draft_row.title || '" is now operational in eFlow.', caller, caller_name,
    p_draft_id::text, participating.org_id, 'collaboration_draft'
  from public.proposal_collaboration_orgs participating
  cross join lateral public.organization_approver_ids(participating.org_id) approver_id
  where participating.draft_id = p_draft_id and approver_id <> caller;
  return jsonb_build_object(
    'draftId', p_draft_id,
    'revisionId', p_revision_id,
    'revisionNumber', revision_row.revision_number,
    'projectIds', to_jsonb(project_ids),
    'projectCount', cardinality(project_ids)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_department_budget_head(target_org uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    join public.organizations o on o.id = target_org
    where p.id = caller_id and p.is_active
      and p.org_id = target_org
      and p.role::text in ('head')
      and o.head_user_id = p.id
  );
$function$;

CREATE OR REPLACE FUNCTION public.guard_administrative_role_management()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
begin
  if caller is null then
    return new;
  end if;

  caller_role := public.auth_role(caller);
  if caller_role = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role in ('admin', 'admin') then
      raise exception 'Only the Admin can create an administrative account'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if caller = old.id then
    return new;
  end if;

  if old.role in ('admin', 'admin')
     or new.role in ('admin', 'admin') then
    raise exception 'Only the Admin can manage administrative accounts'
      using errcode = '42501';
  end if;

  if old.role in ('head')
     or new.role in ('head') then
    if new.role is distinct from old.role
       or new.org_id is distinct from old.org_id
       or new.is_active is distinct from old.is_active then
      raise exception 'Only the Admin can change leadership assignment or account status'
        using errcode = '42501';
    end if;
  elsif old.role not in ('member', 'accounting_staff')
        or new.role not in ('member', 'accounting_staff') then
    raise exception 'Only the Admin can change this account role'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_project_permanently(p_project_id uuid, p_expected_title text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  project_row public.projects;
  retained_task_count int;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role::text, full_name
    into caller_role, caller_name
  from public.profiles
  where id = caller and is_active;

  if caller_role not in ('head') then
    raise exception 'Only a Head, Member, or Admin may permanently delete a project'
      using errcode = '42501';
  end if;

  select * into project_row
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if true
     and not public.org_in_my_subtree(project_row.org_id, caller) then
    raise exception 'This project is outside your organization scope'
      using errcode = '42501';
  end if;

  if coalesce(p_expected_title, '') <> project_row.title then
    raise exception 'Type the exact project title to confirm deletion'
      using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A deletion reason of at least 5 characters is required'
      using errcode = '22023';
  end if;

  select count(*)::int into retained_task_count
  from public.tasks
  where linked_project_id = p_project_id and deleted_at is null;

  update public.tasks
  set linked_project_id = null,
      milestone_id = null
  where linked_project_id = p_project_id;

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'Administrator'), 'project', p_project_id::text,
    'project.deleted', btrim(p_reason),
    jsonb_build_object(
      'title', project_row.title,
      'status', project_row.status,
      'ownerId', project_row.owner_id,
      'retainedTaskCount', retained_task_count
    ),
    jsonb_build_object('deleted', true, 'taskLinksCleared', retained_task_count),
    project_row.org_id
  );

  delete from public.projects where id = p_project_id;
  return p_project_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_petty_cash_release_internal(p_release_id uuid, p_override_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  release public.petty_cash_releases;
  request public.petty_cash_requests;
  budget public.department_fiscal_budgets;
  request_id_value uuid;
  released_total numeric;
  used_today numeric;
  override_reason text := nullif(btrim(p_override_reason), '');
  actor_role_value text;
begin
  if caller is null then raise exception 'Sign in before recording a cash release' using errcode = '42501'; end if;
  select request_id into request_id_value from public.petty_cash_releases where id = p_release_id;
  if not found then raise exception 'Scheduled release not found' using errcode = 'P0002'; end if;
  -- Match the request -> budget -> release order used by scheduling/cancellation.
  select * into request from public.petty_cash_requests where id = request_id_value for update;
  if not found then raise exception 'Cash request not found' using errcode = 'P0002'; end if;
  if not (public.is_department_accounting_staff(request.org_id,caller) and public.has_permission(caller,'accounting.release_cash')) then
    raise exception 'Only authorized Accounting Staff can record a cash release' using errcode = '42501';
  end if;
  select * into budget from public.department_fiscal_budgets where id = request.fiscal_budget_id and status = 'locked' for update;
  if not found then raise exception 'The annual department budget is no longer open' using errcode = '22023'; end if;
  -- Serializes normal releases and overrides, including across fiscal budgets
  -- for the same department. Scheduling below uses this same lock.
  perform pg_advisory_xact_lock(hashtextextended('eflow:cash-release:' || request.org_id::text, 0));
  select * into release from public.petty_cash_releases where id = p_release_id and request_id = request.id for update;
  if not found then raise exception 'Scheduled release not found' using errcode = 'P0002'; end if;
  if release.status <> 'scheduled' then raise exception 'This cash tranche has already been processed' using errcode = '22023'; end if;
  if request.status not in ('approved', 'scheduled_for_release', 'partially_released') or request.approved_amount is null then
    raise exception 'Cash must be fiscally approved before release; a schedule override cannot approve funding' using errcode = '22023';
  end if;
  if release.scheduled_date > current_date and override_reason is null then
    raise exception 'This tranche is scheduled for %. Use Override schedule and provide a reason to release it early.', release.scheduled_date using errcode = '22023';
  end if;
  if p_override_reason is not null and (override_reason is null or length(override_reason) < 10 or length(override_reason) > 1000) then
    raise exception 'Explain the schedule override in 10 to 1000 characters' using errcode = '22023';
  end if;
  select coalesce(sum(amount), 0) into released_total from public.petty_cash_releases
    where request_id = request.id and status = 'released';
  if released_total + release.amount > request.approved_amount then
    raise exception 'This tranche would exceed the approved cash request amount' using errcode = '22023';
  end if;
  -- Preserve room already promised to today's scheduled tranches. An early or
  -- late release consumes its actual release day, not its original schedule.
  select coalesce(sum(amount), 0) into used_today from public.petty_cash_releases
    where org_id = request.org_id and id <> release.id and (
      (status = 'released' and coalesce(released_at::date, scheduled_date) = current_date)
      or (status = 'scheduled' and scheduled_date = current_date)
    );
  if used_today + release.amount > budget.daily_petty_cash_release_limit then
    raise exception 'Daily release ceiling exceeded. Only % remains on server date % after released cash and today''s scheduled tranches; this tranche needs %. The schedule override cannot bypass this limit.',
      greatest(0, budget.daily_petty_cash_release_limit - used_today), current_date, release.amount using errcode = '22023';
  end if;
  update public.petty_cash_releases set status = 'released', released_by = caller, released_at = now() where id = release.id;
  released_total := released_total + release.amount;
  update public.petty_cash_requests set released_amount = released_total,
    status = case when released_total >= approved_amount then 'released' else 'partially_released' end,
    liquidation_due_at = case when released_total >= approved_amount then now() + budget.liquidation_due_days * interval '1 day' else liquidation_due_at end,
    updated_at = now() where id = request.id;
  insert into public.budget_ledger_entries(fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id, entry_type, amount, description, actor_id)
  values (request.fiscal_budget_id, request.org_id, request.commitment_id, request.allocation_id, request.id,
    'petty_cash_released', release.amount, 'Scheduled petty-cash tranche released to recipient', caller);
  if override_reason is not null then
    select role::text into actor_role_value from public.profiles where id = caller;
    insert into public.budget_ledger_entries(
      fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id,
      task_id, subtask_id, allocation_line_id, entry_type, amount, description,
      actor_id, actor_role, previous_state, new_state, reason, metadata
    ) values (
      request.fiscal_budget_id, request.org_id, request.commitment_id, request.allocation_id, request.id,
      request.task_id, request.subtask_id, request.allocation_line_id, 'financial_override', 0,
      format('Cash release schedule override: %s -> %s. Reason: %s', release.scheduled_date, current_date, override_reason),
      caller, actor_role_value, 'scheduled', 'released', override_reason,
      jsonb_build_object('overrideType', 'cash_release_schedule', 'releaseId', release.id,
        'originalScheduledDate', release.scheduled_date, 'actualReleaseDate', current_date,
        'releasedAt', now(), 'releaseAmount', release.amount, 'recipientId', release.recipient_id,
        'dailyLimit', budget.daily_petty_cash_release_limit, 'previousDailyUsage', used_today)
    );
  end if;
  insert into public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, financial_record_id, financial_record_type)
  select request.cash_recipient_id, 'petty_cash_released', 'Petty cash released',
    to_char(release.amount, 'FM999G999G999G990D00') || ' was recorded as released for your work request.',
    request.task_id, caller, coalesce(full_name, ''), release.id, 'petty_cash_release' from public.profiles where id = caller;
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_see_task(target_task uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  task_row public.tasks;
begin
  if caller_id is null then return false; end if;
  if public.auth_role(caller_id) is null or public.auth_role(caller_id) = 'admin' then return false; end if;
  select * into task_row from public.tasks where id = target_task and deleted_at is null;
  if not found then return false; end if;
  return coalesce((task_row.assigned_to = caller_id
    or task_row.created_by = caller_id
    or task_row.recommendation_lead_id = caller_id
    or task_row.reviewer_id = caller_id
    or task_row.backup_reviewer_id = caller_id
    or coalesce(to_jsonb(task_row.team_member_ids), '[]'::jsonb) ? caller_id::text
    or (task_row.linked_project_id is not null and public.can_see_project(task_row.linked_project_id, caller_id))
    or (
      task_row.source_collaboration_draft_id is null
      and public.can_access_org(caller_id, task_row.org_id, 'read')
    )),false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_see_project(target_project uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  project_row public.projects;
begin
  if caller_id is null then return false; end if;
  if public.auth_role(caller_id) is null or public.auth_role(caller_id) = 'admin' then return false; end if;
  select * into project_row from public.projects where id = target_project;
  if not found then return false; end if;
  if project_row.source_collaboration_draft_id is not null then
    return public.can_see_collaboration_project(target_project, caller_id)
      or public.is_collaboration_participant(project_row.source_collaboration_draft_id, caller_id);
  end if;
  return coalesce((project_row.owner_id = caller_id
    or public.is_project_member(target_project, caller_id)
    or exists (
      select 1 from public.tasks task
      where task.linked_project_id = target_project and task.deleted_at is null
        and (
          task.assigned_to = caller_id
          or task.recommendation_lead_id = caller_id
          or coalesce(to_jsonb(task.team_member_ids), '[]'::jsonb) ? caller_id::text
        )
    )
    or public.can_access_org(caller_id, project_row.org_id, 'read')),false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_create_scoped_work(target_org uuid, caller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_profile public.profiles;
begin
  if caller_id is null then return false; end if;
  select * into caller_profile
  from public.profiles
  where id = caller_id and is_active;
  if not found then return false; end if;
  if caller_profile.role is null or caller_profile.role = 'admin' then return false; end if;
  return caller_profile.role in ('head')
    and target_org is not null
    and target_org = caller_profile.org_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.settle_accounting_liquidation(p_liquidation_id uuid, p_approve boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare caller uuid := auth.uid(); liquidation public.petty_cash_liquidations; request public.petty_cash_requests;
begin
  select * into liquidation from public.petty_cash_liquidations where id = p_liquidation_id for update;
  if not found then raise exception 'Liquidation not found' using errcode = 'P0002'; end if;
  select * into request from public.petty_cash_requests where id = liquidation.request_id for update;
  if not (public.is_department_accounting_staff(request.org_id,caller) and public.has_permission(caller,'accounting.settle_liquidation')) then
    raise exception 'Only authorized Accounting Staff can settle this liquidation' using errcode = '42501';
  end if;
  if caller in (request.cash_recipient_id, request.requester_id) then raise exception 'You cannot settle your own liquidation' using errcode = '42501'; end if;
  if caller = liquidation.leader_decided_by then raise exception 'Leader review and settlement must be performed by different people' using errcode = '42501'; end if;
  if liquidation.status <> 'pending_department_settlement' or request.status <> 'pending_department_settlement' then
    raise exception 'This liquidation is not awaiting accounting settlement' using errcode = '22023';
  end if;
  if not p_approve and nullif(btrim(p_reason), '') is null then raise exception 'Explain what must be corrected' using errcode = '22023'; end if;
  update public.petty_cash_liquidations set status = case when p_approve then 'approved' else 'changes_requested' end,
    decided_by = caller, decision_reason = nullif(btrim(p_reason), ''), decided_at = now(),
    department_decided_by = department_decided_by, department_decision_reason = department_decision_reason, department_decided_at = department_decided_at
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
    case when p_approve then 'Accounting verified the receipts and posted the balanced journal entry.' else 'Your liquidation needs corrections before settlement.' end,
    request.task_id, caller, coalesce(full_name, ''), coalesce(p_reason, ''), liquidation.id, 'petty_cash_liquidation'
  from public.profiles where id = caller;
end;
$function$;

CREATE OR REPLACE FUNCTION public.post_general_journal_adjustment(p_fiscal_budget_id uuid, p_entry_date date, p_reference_number text, p_memo text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  budget public.department_fiscal_budgets;
  item jsonb;
  debit_total numeric := 0;
  credit_total numeric := 0;
  journal_id uuid;
  account_title_value text;
  line_value int := 0;
begin
  select * into budget from public.department_fiscal_budgets where id = p_fiscal_budget_id;
  if not found then raise exception 'Fiscal budget not found' using errcode = 'P0002'; end if;
  if not (public.is_department_accounting_staff(budget.org_id,caller) and public.has_permission(caller,'accounting.post_journal')) then raise exception 'Accounting access denied' using errcode = '42501'; end if;
  if nullif(btrim(p_reference_number), '') is null or nullif(btrim(p_memo), '') is null then
    raise exception 'Reference and memo are required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'A journal entry needs at least two lines' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_lines) loop
    debit_total := debit_total + coalesce((item ->> 'debit')::numeric, 0);
    credit_total := credit_total + coalesce((item ->> 'credit')::numeric, 0);
    if (coalesce((item ->> 'debit')::numeric, 0) > 0) = (coalesce((item ->> 'credit')::numeric, 0) > 0) then
      raise exception 'Each journal line must contain either a debit or a credit' using errcode = '22023';
    end if;
    if not exists (select 1 from public.accounting_accounts where code = item ->> 'accountCode' and is_active) then
      raise exception 'Choose an active account for every journal line' using errcode = '22023';
    end if;
  end loop;
  if debit_total <= 0 or abs(debit_total - credit_total) > 0.009 then
    raise exception 'Journal debits and credits must balance' using errcode = '22023';
  end if;
  insert into public.general_journal_entries(
    fiscal_budget_id, org_id, entry_date, reference_number, source_type, memo, posted_by
  ) values (
    budget.id, budget.org_id, coalesce(p_entry_date, current_date), btrim(p_reference_number),
    'manual_adjustment', btrim(p_memo), caller
  ) returning id into journal_id;
  for item in select value from jsonb_array_elements(p_lines) loop
    line_value := line_value + 1;
    select title into account_title_value from public.accounting_accounts where code = item ->> 'accountCode';
    insert into public.general_journal_lines(journal_entry_id, line_number, account_code, account_title, debit, credit)
    values (journal_id, line_value, item ->> 'accountCode', account_title_value,
      coalesce((item ->> 'debit')::numeric, 0), coalesce((item ->> 'credit')::numeric, 0));
  end loop;
  insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id)
  select caller, profile.full_name, 'general_journal_entry', journal_id::text, 'manual_adjustment_posted',
    btrim(p_memo), jsonb_build_object('referenceNumber', btrim(p_reference_number), 'debit', debit_total, 'credit', credit_total), budget.org_id
  from public.profiles profile where profile.id = caller;
  return journal_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when public.auth_role(p_user_id) is null or nullif(btrim(p_permission), '') is null then false
    when exists (
      select 1 from public.profiles p
      where p.id = p_user_id and p.is_active and p.role = 'admin'
    ) then p_permission in ('navigation.user_management','users.manage','navigation.organization','navigation.audit','audit.read','navigation.system_settings','settings.manage','navigation.data_tools','database.backup')
    else coalesce(
      (
        select o.allowed
        from public.user_permission_overrides o
        where o.user_id = p_user_id and o.permission = p_permission
      ),
      (
        select rp.allowed
        from public.profiles p
        join public.role_permissions rp on rp.role = p.role
        where p.id = p_user_id
          and p.is_active
          and rp.permission = p_permission
      ),
      false
    )
  end;
$function$;
update public.profiles set role=case role when 'super_admin' then 'admin' when 'dept_head' then 'head' when 'department_head' then 'head' when 'assistant_head' then 'member' when 'employee' then 'member' else role end,updated_at=now()
 where role in ('super_admin','dept_head','department_head','assistant_head','employee');
alter table public.profiles add constraint profiles_role_check check(role in ('admin','head','accounting_staff','member'));
alter table public.profiles alter column role set default 'member';
create trigger guard_profile_leadership_integrity before insert or update on public.profiles for each row execute function public.guard_profile_leadership_integrity();
delete from public.user_permission_overrides where user_id in (select id from public.profiles where role='admin');
delete from public.role_permissions;
insert into public.role_permissions(role,permission,allowed) values
('admin','navigation.user_management',true),
('admin','users.manage',true),
('admin','navigation.organization',true),
('admin','navigation.audit',true),
('admin','audit.read',true),
('admin','navigation.system_settings',true),
('admin','settings.manage',true),
('admin','navigation.data_tools',true),
('admin','database.backup',true),
('admin','navigation.projects',false),
('admin','navigation.tasks',false),
('admin','navigation.reports',false),
('admin','navigation.announcements',false),
('admin','reports.export',false),
('admin','navigation.reviews',false),
('admin','navigation.team_supervision',false),
('admin','navigation.team_intelligence',false),
('admin','navigation.department_budgets',false),
('admin','projects.create',false),
('admin','projects.archive',false),
('admin','projects.delete',false),
('admin','tasks.assign',false),
('admin','tasks.verify',false),
('admin','navigation.accounting_overview',false),
('admin','navigation.accounting_releases',false),
('admin','navigation.accounting_journal',false),
('admin','navigation.accounting_audit',false),
('admin','accounting.release_cash',false),
('admin','accounting.settle_liquidation',false),
('admin','accounting.post_journal',false),
('admin','announcements.publish',false),
('head','navigation.user_management',false),
('head','users.manage',false),
('head','navigation.organization',false),
('head','navigation.audit',false),
('head','audit.read',false),
('head','navigation.system_settings',false),
('head','settings.manage',false),
('head','navigation.data_tools',false),
('head','database.backup',false),
('head','navigation.projects',true),
('head','navigation.tasks',true),
('head','navigation.reports',true),
('head','navigation.announcements',true),
('head','reports.export',true),
('head','navigation.reviews',true),
('head','navigation.team_supervision',true),
('head','navigation.team_intelligence',true),
('head','navigation.department_budgets',true),
('head','projects.create',true),
('head','projects.archive',true),
('head','projects.delete',true),
('head','tasks.assign',true),
('head','tasks.verify',true),
('head','navigation.accounting_overview',false),
('head','navigation.accounting_releases',false),
('head','navigation.accounting_journal',false),
('head','navigation.accounting_audit',false),
('head','accounting.release_cash',false),
('head','accounting.settle_liquidation',false),
('head','accounting.post_journal',false),
('head','announcements.publish',false),
('member','navigation.user_management',false),
('member','users.manage',false),
('member','navigation.organization',false),
('member','navigation.audit',false),
('member','audit.read',false),
('member','navigation.system_settings',false),
('member','settings.manage',false),
('member','navigation.data_tools',false),
('member','database.backup',false),
('member','navigation.projects',true),
('member','navigation.tasks',true),
('member','navigation.reports',true),
('member','navigation.announcements',true),
('member','reports.export',true),
('member','navigation.reviews',false),
('member','navigation.team_supervision',false),
('member','navigation.team_intelligence',false),
('member','navigation.department_budgets',false),
('member','projects.create',false),
('member','projects.archive',false),
('member','projects.delete',false),
('member','tasks.assign',false),
('member','tasks.verify',false),
('member','navigation.accounting_overview',false),
('member','navigation.accounting_releases',false),
('member','navigation.accounting_journal',false),
('member','navigation.accounting_audit',false),
('member','accounting.release_cash',false),
('member','accounting.settle_liquidation',false),
('member','accounting.post_journal',false),
('member','announcements.publish',false),
('accounting_staff','navigation.user_management',false),
('accounting_staff','users.manage',false),
('accounting_staff','navigation.organization',false),
('accounting_staff','navigation.audit',false),
('accounting_staff','audit.read',false),
('accounting_staff','navigation.system_settings',false),
('accounting_staff','settings.manage',false),
('accounting_staff','navigation.data_tools',false),
('accounting_staff','database.backup',false),
('accounting_staff','navigation.projects',true),
('accounting_staff','navigation.tasks',true),
('accounting_staff','navigation.reports',true),
('accounting_staff','navigation.announcements',true),
('accounting_staff','reports.export',true),
('accounting_staff','navigation.reviews',false),
('accounting_staff','navigation.team_supervision',false),
('accounting_staff','navigation.team_intelligence',false),
('accounting_staff','navigation.department_budgets',true),
('accounting_staff','projects.create',false),
('accounting_staff','projects.archive',false),
('accounting_staff','projects.delete',false),
('accounting_staff','tasks.assign',false),
('accounting_staff','tasks.verify',false),
('accounting_staff','navigation.accounting_overview',true),
('accounting_staff','navigation.accounting_releases',true),
('accounting_staff','navigation.accounting_journal',true),
('accounting_staff','navigation.accounting_audit',true),
('accounting_staff','accounting.release_cash',true),
('accounting_staff','accounting.settle_liquidation',true),
('accounting_staff','accounting.post_journal',true),
('accounting_staff','announcements.publish',false);
create trigger guard_admin_role_permissions before insert or update or delete on public.role_permissions for each row execute function public.guard_admin_role_permissions();

update public.organizations set assistant_head_user_id=null where assistant_head_user_id is not null;
-- Keep the obsolete physical column for this rollout; no runtime function body reads or writes it.
-- Drop it in a later, separately reviewed migration after every deployed client has been upgraded.
drop trigger if exists organizations_guard_leadership_membership on public.organizations;
create trigger organizations_guard_leadership_membership before insert or update of head_user_id on public.organizations for each row execute function public.guard_organization_leadership_membership();
drop trigger if exists guard_administrative_leadership_assignment on public.organizations;
create trigger guard_administrative_leadership_assignment before insert or update of head_user_id on public.organizations for each row execute function public.guard_administrative_leadership_assignment();
update public.tasks set reviewer_id=reviewer_id where deleted_at is null and status not in ('completed','cancelled') and review_route_mode='organization_default';

alter policy "announcements readable" on public.announcements using (((created_by=auth.uid() and auth_role(auth.uid())<>'admin') or (status='published' and exists(select 1 from announcement_recipients r where r.announcement_id=announcements.id and r.user_id=auth.uid()))));

alter policy "announcements writable by publishers" on public.announcements using (auth_role(auth.uid())<>'admin' and has_permission(auth.uid(),'announcements.publish') and created_by=auth.uid() and can_access_org(auth.uid(),org_id,'manage')) with check (auth_role(auth.uid())<>'admin' and has_permission(auth.uid(),'announcements.publish') and created_by=auth.uid() and can_access_org(auth.uid(),org_id,'manage'));

alter policy "recipients insert by admin" on public.announcement_recipients with check (exists(select 1 from announcements a where a.id=announcement_id and a.created_by=auth.uid() and auth_role(auth.uid())<>'admin' and has_permission(auth.uid(),'announcements.publish')));

alter policy "recipients read own" on public.announcement_recipients using (user_id=auth.uid() or exists(select 1 from announcements a where a.id=announcement_id and a.created_by=auth.uid() and auth_role(auth.uid())<>'admin'));

alter policy "audit_read_permission" on public.audit_events using (auth_role(auth.uid())<>'admin' and has_permission(auth.uid(),'audit.read'));

alter policy "audit_read_scoped" on public.audit_events using ((auth_role(auth.uid())='admin' and entity_type in ('profile','profiles','user','organization','organizations','permission','role_permission','role_permissions','user_permission_override','user_permission_overrides','system_config','account','org_scope_grant','user_org_scope_grants')) or (auth_role(auth.uid())<>'admin' and (actor_id=auth.uid() or (auth_role(auth.uid())='head' and org_in_my_subtree(org_id,auth.uid())))));

alter policy "notes_privileged" on public.employee_notes using (auth_role(auth.uid())='head' and exists(select 1 from profiles p where p.id=profile_id and org_in_my_subtree(p.org_id,auth.uid())));

alter policy "monthly_productivity_read" on public.monthly_productivity_snapshots using (auth_role(auth.uid())<>'admin' and (user_id=auth.uid() or can_access_org(auth.uid(),org_id,'read')));

alter policy "comments update author or moderator" on public.task_comments using (auth_role(auth.uid())<>'admin' and (author_id=auth.uid() or (auth_role(auth.uid())='head' and can_see_task(task_id,auth.uid())))) with check (auth_role(auth.uid())<>'admin' and (author_id=auth.uid() or (auth_role(auth.uid())='head' and can_see_task(task_id,auth.uid()))));

alter policy "task_template_runs_read" on public.task_template_runs using (auth_role(auth.uid())<>'admin' and exists(select 1 from task_templates t where t.id=template_id and (t.created_by=auth.uid() or can_access_org(auth.uid(),t.org_id,'read'))));

insert into public.audit_events(actor_name,entity_type,entity_id,action,after_data)
 values('System','account','phase1','account.phase1_authority_migrated',jsonb_build_object('canonicalRoles',array['admin','head','accounting_staff','member'],'backupTable','phase1_authority_row_backup'));
do $$ begin
 if exists(select 1 from public.profiles where role not in ('admin','head','accounting_staff','member')) or exists(select 1 from public.organizations where assistant_head_user_id is not null) then raise exception 'Phase 1 postflight failed'; end if;
 if public.has_permission((select id from public.profiles where role='admin' and is_active limit 1),'projects.create') then raise exception 'Admin operational permission regression'; end if;
end $$;
commit;
