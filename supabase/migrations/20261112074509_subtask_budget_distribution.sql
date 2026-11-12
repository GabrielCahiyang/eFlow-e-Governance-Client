-- Reuse the existing allocation, ledger and cash-request records.
create table eflow_budget.subtask_budget_commands (
  actor_id uuid not null,
  request_id uuid not null,
  payload jsonb not null,
  result_id uuid,
  primary key (actor_id, request_id)
);
revoke all on eflow_budget.subtask_budget_commands from public, anon, authenticated;

do $$
begin
  execute replace(pg_get_functiondef('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)'::regprocedure),
    'FUNCTION public.set_subtask_budget_cap(', 'FUNCTION eflow_budget.write_subtask_budget_cap(');
  execute replace(pg_get_functiondef('public.remove_subtask_budget_cap(uuid,text,uuid)'::regprocedure),
    'FUNCTION public.remove_subtask_budget_cap(', 'FUNCTION eflow_budget.cancel_subtask_budget_cap(');
  execute replace(pg_get_functiondef('public.project_completion_readiness_internal(uuid)'::regprocedure),
    'FUNCTION public.project_completion_readiness_internal(', 'FUNCTION eflow_budget.pre_subtask_budget_closeout(');
end $$;
revoke all on function eflow_budget.write_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid),
  eflow_budget.cancel_subtask_budget_cap(uuid,text,uuid),
  eflow_budget.pre_subtask_budget_closeout(uuid) from public,anon,authenticated;

create function eflow_budget.change_subtask_budget(
  p_task uuid, p_subtask uuid, p_line uuid, p_cap uuid, p_amount numeric, p_reason text, p_key uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  caller uuid:=eflow_r3.actor(); task_row public.tasks; cap public.work_budget_allocations;
  previous eflow_budget.subtask_budget_commands; payload jsonb; result_id uuid; floor_amount numeric;
begin
  if p_key is null or char_length(btrim(coalesce(p_reason,''))) not between 1 and 3000 then
    raise exception 'Enter a reason for this budget change.' using errcode='22023';
  end if;
  if p_cap is null and (p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
      or p_amount<=0 or p_amount>=100000000000000 or p_amount<>round(p_amount,2) or p_line is null) then
    raise exception 'Choose a funding account and enter an amount greater than zero, with up to two decimal places.' using errcode='22023';
  end if;
  payload:=jsonb_build_array(p_task,p_subtask,p_line,p_cap,p_amount,btrim(p_reason));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('subtask-budget:'||caller||':'||p_key,0));
  if p_cap is not null then
    select task_id,subtask_id into p_task,p_subtask from public.work_budget_allocations where id=p_cap;
  end if;
  perform eflow_r7.lock_impact(p_task);
  select * into task_row from public.tasks where id=p_task and deleted_at is null;
  if not found or task_row.proposed_office_identity_id is not null or not coalesce(public.can_see_task(p_task,caller),false)
      or caller is distinct from coalesce(task_row.assigned_to,task_row.recommendation_lead_id)
      or not exists(select 1 from public.subtasks where id=p_subtask and task_id=p_task) then
    raise exception 'Only the current Task Lead can manage this subtask budget.' using errcode='42501';
  end if;
  select * into previous from eflow_budget.subtask_budget_commands where actor_id=caller and request_id=p_key;
  if found then
    if previous.payload<>payload then raise exception 'This budget change was already submitted with different details.' using errcode='22023'; end if;
    return previous.result_id;
  end if;
  if exists(select 1 from public.projects where id=task_row.linked_project_id and status in ('completed','archived')) then
    raise exception 'This project is closed.' using errcode='22023';
  end if;
  select * into cap from public.work_budget_allocations
    where task_id=p_task and subtask_id=p_subtask and status in ('pending','approved');
  if exists(select 1 from public.petty_cash_requests where task_id=p_task and subtask_id=p_subtask
    and status not in ('draft','rejected','cancelled','expired','settled')) then
    raise exception 'Resolve the open cash request before changing this subtask budget.' using errcode='22023';
  end if;
  if p_cap is not null then
    if cap.id is distinct from p_cap then raise exception 'This allocation has already changed.' using errcode='22023'; end if;
    floor_amount:=cap.amount-public.subtask_cap_available(cap.id);
    if floor_amount>=cap.amount then raise exception 'This subtask has no unused funding to return.' using errcode='22023'; end if;
    if floor_amount>0 then
      result_id:=eflow_budget.write_subtask_budget_cap(p_task,p_subtask,cap.parent_allocation_line_id,floor_amount,p_reason,p_key);
    else
      perform eflow_budget.cancel_subtask_budget_cap(cap.id,p_reason,p_key);
      result_id:=cap.id;
    end if;
  else
    if task_row.archived_at is not null or task_row.status in ('completed','cancelled') or exists(select 1 from public.subtasks where id=p_subtask and status='completed') then
      if cap.id is null or p_amount>cap.amount or cap.parent_allocation_line_id is distinct from p_line then
        raise exception 'Finished work can only return unused funding.' using errcode='22023';
      end if;
    end if;
    if cap.id is not null and cap.parent_allocation_line_id is distinct from p_line
       and exists(select 1 from public.petty_cash_requests where allocation_id=cap.id) then
      raise exception 'This subtask has cash history on its original funding account.' using errcode='22023';
    end if;
    result_id:=eflow_budget.write_subtask_budget_cap(p_task,p_subtask,p_line,p_amount,p_reason,p_key);
  end if;
  insert into eflow_budget.subtask_budget_commands values (caller,p_key,payload,result_id);
  return result_id;
end $$;
revoke all on function eflow_budget.change_subtask_budget(uuid,uuid,uuid,uuid,numeric,text,uuid) from public,anon,authenticated;

create or replace function public.set_subtask_budget_cap(
  p_task_id uuid,p_subtask_id uuid,p_parent_allocation_line_id uuid,p_amount numeric,p_reason text,p_idempotency_key uuid
) returns uuid language sql security definer set search_path='' as $$
  select eflow_budget.change_subtask_budget(p_task_id,p_subtask_id,p_parent_allocation_line_id,null,p_amount,p_reason,p_idempotency_key)
$$;
create or replace function public.remove_subtask_budget_cap(p_cap_allocation_id uuid,p_reason text,p_idempotency_key uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform eflow_budget.change_subtask_budget(null,null,null,p_cap_allocation_id,null,p_reason,p_idempotency_key);
end $$;
create or replace function public.create_subtask_budget_allocation(
  p_task_id uuid,p_subtask_id uuid,p_parent_allocation_line_id uuid,p_amount numeric,p_reason text
) returns uuid language sql security definer set search_path='' as $$
  select eflow_budget.change_subtask_budget(p_task_id,p_subtask_id,p_parent_allocation_line_id,null,p_amount,p_reason,
    md5(jsonb_build_array('legacy subtask allocation',p_task_id,p_subtask_id,p_parent_allocation_line_id,p_amount,p_reason)::text)::uuid)
$$;

create or replace function public.get_task_funding_context(p_task_id uuid,p_subtask_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; allocation uuid; can_manage boolean; summary jsonb; children jsonb; sources jsonb;
begin
  result:=eflow_budget.task_context(p_task_id,p_subtask_id);
  allocation:=(result->>'taskAllocationId')::uuid;
  if allocation is null then return result; end if;
  can_manage:=eflow_r3.eligible(auth.uid()) and auth.uid()::text=result->>'taskLeaderId'
    and exists(select 1 from public.tasks t left join public.projects p on p.id=t.linked_project_id
      where t.id=p_task_id and t.proposed_office_identity_id is null and coalesce(p.status,'') not in ('completed','archived'));
  with totals as (
    select coalesce(sum(c.amount),0) as assigned
    from public.work_budget_allocations c join public.work_budget_allocation_lines l on l.id=c.parent_allocation_line_id
    where l.allocation_id=allocation and c.subtask_id is not null and c.status in ('pending','approved')
  ), cash as (
    select coalesce(sum(r.released_amount),0) as released,
      coalesce(sum(r.actual_spent) filter (where r.status='settled'),0) as spent
    from public.petty_cash_requests r where r.task_id=p_task_id
      and (p_subtask_id is null or r.subtask_id=p_subtask_id)
  )
  select jsonb_build_object('allocated',assigned,'unallocated',greatest(0,(result->>'taskBudget')::numeric-assigned),
    'available',coalesce((select sum(public.task_budget_line_available(id,null)) from public.work_budget_allocation_lines where allocation_id=allocation),0),
    'released',released,'spent',spent) into summary from totals cross join cash;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.category||coalesce(' · FY '||f.fiscal_year::text,''),'available',public.task_budget_line_available(l.id,null))
    order by l.position,l.id),'[]') into sources
  from public.work_budget_allocation_lines l left join eflow_project.funding f on f.id=l.project_funding_id
  where l.allocation_id=allocation and l.amount>0;
  if can_manage or p_subtask_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'finished',s.status='completed',
      'capId',c.id,'sourceId',c.parent_allocation_line_id,'amount',coalesce(c.amount,0),
      'returnable',coalesce(public.subtask_cap_available(c.id),0),'reason',c.reason,
      'hasHistory',exists(select 1 from public.petty_cash_requests r where r.allocation_id=c.id),
      'blocked',exists(select 1 from public.petty_cash_requests r where r.task_id=s.task_id and r.subtask_id=s.id
        and r.status not in ('draft','rejected','cancelled','expired','settled'))) order by s.title,s.id),'[]') into children
    from public.subtasks s
    left join public.work_budget_allocations c on c.subtask_id=s.id and c.task_id=s.task_id and c.status in ('approved','pending')
      and exists(select 1 from public.work_budget_allocation_lines l where l.id=c.parent_allocation_line_id and l.allocation_id=allocation)
    where s.task_id=p_task_id and (p_subtask_id is null or s.id=p_subtask_id);
  end if;
  return result||jsonb_build_object('distribution',summary,'subtaskBudgets',coalesce(children,'[]'),'parentSources',sources,'canManageDistribution',can_manage);
end $$;

create or replace function public.project_completion_readiness_internal(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; extra jsonb;
begin
  result:=eflow_budget.pre_subtask_budget_closeout(p_project_id);
  select coalesce(jsonb_agg(jsonb_build_object('kind','funding','id',c.id,'taskId',t.id,
    'title',s.title,'status','unused_subtask_funding','amount',public.subtask_cap_available(c.id),
    'detail','The Task Lead must return unused subtask funding to the parent task.')), '[]') into extra
  from public.work_budget_allocations c
  join public.subtasks s on s.id=c.subtask_id and s.task_id=c.task_id
  join public.tasks t on t.id=c.task_id and t.linked_project_id=p_project_id
  join public.projects p on p.id=t.linked_project_id and p.status in ('planning','active','on_hold')
  where c.status in ('pending','approved') and public.subtask_cap_available(c.id)>0;
  if jsonb_array_length(extra)=0 then return result; end if;
  return result||jsonb_build_object('blockers',result->'blockers'||extra,'canComplete',false);
end $$;
