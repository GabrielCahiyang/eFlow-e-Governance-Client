-- Petty cash belongs to the budget-owning department while retaining the requester's home department.

begin;

alter table public.petty_cash_requests
  add column if not exists funding_org_id uuid references public.organizations(id) on delete restrict,
  add column if not exists requester_org_id uuid references public.organizations(id) on delete restrict;

update public.petty_cash_requests request
set funding_org_id = coalesce(request.funding_org_id, fiscal.org_id, request.org_id),
    requester_org_id = coalesce(request.requester_org_id, profile.org_id, request.org_id)
from public.department_fiscal_budgets fiscal,
     public.profiles profile
where fiscal.id = request.fiscal_budget_id
  and profile.id = request.requester_id
  and (request.funding_org_id is null or request.requester_org_id is null);

alter table public.petty_cash_requests
  alter column funding_org_id set not null,
  alter column requester_org_id set not null;

create index if not exists idx_petty_cash_requests_funding_org
  on public.petty_cash_requests(funding_org_id, status, created_at desc);
create index if not exists idx_petty_cash_requests_requester_org
  on public.petty_cash_requests(requester_org_id, requester_id, created_at desc);

create or replace function public.sync_petty_cash_request_organizations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_funding_org uuid;
  resolved_requester_org uuid;
begin
  select fiscal.org_id into resolved_funding_org
  from public.department_fiscal_budgets fiscal
  where fiscal.id = new.fiscal_budget_id;

  select profile.org_id into resolved_requester_org
  from public.profiles profile
  where profile.id = new.requester_id;

  new.funding_org_id := coalesce(resolved_funding_org, new.funding_org_id, new.org_id);
  new.requester_org_id := coalesce(resolved_requester_org, new.requester_org_id, new.org_id);
  if new.funding_org_id is null or new.requester_org_id is null then
    raise exception 'Cash requests require funding and requester departments' using errcode = '23502';
  end if;
  -- org_id remains the compatibility key used by accounting policies and ledgers.
  new.org_id := new.funding_org_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_petty_cash_request_organizations on public.petty_cash_requests;
create trigger trg_sync_petty_cash_request_organizations
before insert or update of fiscal_budget_id, requester_id, funding_org_id, requester_org_id, org_id
on public.petty_cash_requests
for each row execute function public.sync_petty_cash_request_organizations();
create or replace function public.create_contextual_cash_request(
  p_task_id uuid,
  p_subtask_id uuid,
  p_allocation_line_id uuid,
  p_amount numeric,
  p_purpose text,
  p_needed_by date,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  existing_id uuid;
  task_row public.tasks;
  task_leader uuid;
  task_allocation public.work_budget_allocations;
  source_line public.work_budget_allocation_lines;
  cap public.work_budget_allocations;
  target_allocation public.work_budget_allocations;
  commitment public.budget_commitments;
  fiscal public.department_fiscal_budgets;
  available numeric := 0;
  next_status text;
  request_id uuid;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'A request idempotency key is required' using errcode = '22023'; end if;
  select id into existing_id from public.petty_cash_requests
  where requester_id = caller and idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;
  if p_amount <= 0 then raise exception 'Requested amount must be greater than zero' using errcode = '22023'; end if;
  if nullif(btrim(p_purpose), '') is null then raise exception 'Describe what this cash will purchase' using errcode = '22023'; end if;
  if p_allocation_line_id is null then raise exception 'Select a proposal budget line and fund source' using errcode = '22023'; end if;

  select * into task_row from public.tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Funded task not found' using errcode = 'P0002'; end if;
  task_leader := coalesce(task_row.assigned_to, task_row.recommendation_lead_id);
  if task_leader is null then raise exception 'This task has no Task Leader for endorsement routing' using errcode = '22023'; end if;
  if p_subtask_id is null then
    if caller <> task_leader then raise exception 'Only the Task Leader can submit a task-level request' using errcode = '42501'; end if;
  else
    if not exists (select 1 from public.subtasks where id = p_subtask_id and task_id = p_task_id) then
      raise exception 'Subtask does not belong to this task' using errcode = '22023';
    end if;
    if caller <> task_leader and not exists (
      select 1 from public.subtasks subtask where subtask.id = p_subtask_id
        and coalesce(subtask.assigned_to_ids, '{}'::uuid[]) @> array[caller]
    ) then raise exception 'Only the Task Leader or an assigned contributor can request cash for this subtask' using errcode = '42501'; end if;
  end if;

  select * into task_allocation from public.work_budget_allocations
  where task_id = p_task_id and subtask_id is null and status = 'approved' for update;
  if not found then raise exception 'This task has no approved proposal budget' using errcode = '22023'; end if;
  select * into source_line from public.work_budget_allocation_lines
  where id = p_allocation_line_id and allocation_id = task_allocation.id for update;
  if not found then raise exception 'Select a valid proposal budget line for this task' using errcode = '22023'; end if;
  select * into commitment from public.budget_commitments
  where id = task_allocation.commitment_id and status = 'active';
  if not found then raise exception 'The proposal budget is no longer active' using errcode = '22023'; end if;
  select * into fiscal from public.department_fiscal_budgets
  where id = commitment.fiscal_budget_id and status = 'locked' for update;
  if not found then raise exception 'The annual department budget is no longer open' using errcode = '22023'; end if;

  if p_subtask_id is not null then
    select * into cap from public.work_budget_allocations
    where task_id = p_task_id and subtask_id = p_subtask_id and status = 'approved' for update;
  end if;
  if cap.id is not null then
    if cap.parent_allocation_line_id is distinct from source_line.id then
      raise exception 'This subtask cap is reserved for a different proposal budget line' using errcode = '22023';
    end if;
    target_allocation := cap;
    available := public.subtask_cap_available(cap.id);
  else
    target_allocation := task_allocation;
    available := public.task_budget_line_available(source_line.id);
  end if;
  if p_amount > available then
    raise exception 'Only % remains available on % · %',
      to_char(available, 'FM999G999G999G990D00'), source_line.category, source_line.particular using errcode = '22023';
  end if;

  next_status := case when caller = task_leader then 'pending_department_approval' else 'pending_leader_review' end;
  insert into public.petty_cash_requests(
    fiscal_budget_id, commitment_id, allocation_id, allocation_line_id, org_id,
    task_id, subtask_id, requester_id, task_leader_id, cash_recipient_id,
    purpose, requested_amount, needed_by, status, reservation_expires_at, idempotency_key
  ) values (
    fiscal.id, commitment.id, target_allocation.id, source_line.id, fiscal.org_id,
    task_row.id, p_subtask_id, caller, task_leader, caller,
    btrim(p_purpose), p_amount, p_needed_by, next_status, now() + interval '7 days', p_idempotency_key
  ) returning id into request_id;

  if next_status = 'pending_leader_review' then
    insert into public.notifications(user_id, type, title, message, task_id, task_title, actor_id, actor_name, financial_record_id, financial_record_type)
    select task_leader, 'petty_cash_leader_review', 'Cash request needs your endorsement',
      coalesce(profile.full_name, 'A contributor') || ' requested ' || to_char(p_amount, 'FM999G999G999G990D00') ||
      ' for ' || btrim(p_purpose) || ' in "' || task_row.title || '".',
      task_row.id, task_row.title, caller, coalesce(profile.full_name, ''), request_id, 'petty_cash_request'
    from public.profiles profile where profile.id = caller and task_leader <> caller;
  else
    insert into public.notifications(user_id, type, title, message, task_id, task_title, actor_id, actor_name, financial_record_id, financial_record_type)
    select approver_id, 'petty_cash_department_approval', 'Cash request needs fiscal authorization',
      coalesce(profile.full_name, 'A Task Leader') || ' requested ' || to_char(p_amount, 'FM999G999G999G990D00') ||
      ' for ' || btrim(p_purpose) || ' in "' || task_row.title || '".',
      task_row.id, task_row.title, caller, coalesce(profile.full_name, ''), request_id, 'petty_cash_request'
    from public.organization_approver_ids(fiscal.org_id) approver_id
    left join public.profiles profile on profile.id = caller
    where approver_id <> caller;
  end if;
  return request_id;
exception
  when unique_violation then
    select id into existing_id from public.petty_cash_requests
    where requester_id = caller and idempotency_key = p_idempotency_key;
    if existing_id is not null then return existing_id; end if;
    raise;
end;
$$;


comment on column public.petty_cash_requests.funding_org_id is 'Department whose locked fiscal budget funds and approves the request.';
comment on column public.petty_cash_requests.requester_org_id is 'Home department of the employee who submitted the request.';

notify pgrst, 'reload schema';

commit;
