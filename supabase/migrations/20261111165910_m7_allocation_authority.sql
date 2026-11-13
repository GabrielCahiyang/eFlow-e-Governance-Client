-- Allocation remains separate from Office authorization, disbursement, and settlement.
begin;
create function eflow_m7.can_allocate_subtask(p_task uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from public.tasks t join public.subtasks s on s.task_id=t.id and s.id=p_node
  left join public.projects p on p.id=t.linked_project_id
  where t.id=p_task and t.assigned_to=auth.uid() and eflow_r3.eligible(auth.uid())
   and t.proposed_office_identity_id is null
   and public.can_see_task(t.id,auth.uid()) and t.deleted_at is null and t.archived_at is null
   and t.status in ('todo','in_progress','changes_requested')
   and (t.linked_project_id is null or p.status in ('active','on_hold'))
   and s.status not in ('completed','for_review')
 );
$$;
revoke all on function eflow_m7.can_allocate_subtask(uuid,uuid) from public,anon,authenticated,service_role;

do $migration$
begin
 perform eflow_m7.replace_body_part('eflow_project.allocate_task(uuid,jsonb,text,uuid)',
  $old$if not eflow_project.lead(p.id,auth.uid()) and not public.phase2_is_office_head(auth.uid(),p.org_id) then raise exception 'Only the project lead or appointed Head may allocate project funding'$old$,
  $new$if not eflow_project.lead(p.id,auth.uid()) or not eflow_r3.eligible(auth.uid()) or not public.can_see_task(t.id,auth.uid()) then raise exception 'Only the appointed Project Lead may allocate project funding'$new$);
 perform eflow_m7.replace_body_part('eflow_budget.fund_work(uuid,integer,jsonb,text,uuid)',
  't.linked_project_id is not null and exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null)',
  't.linked_project_id is not null and t.source_collaboration_draft_id is null');
 perform eflow_m7.replace_body_part('eflow_project.snapshot(uuid)',
  $old$'canAllocate',eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id),$old$,
  $new$'canAllocateTask',eflow_project.lead(p.id,auth.uid()) and eflow_r3.eligible(auth.uid()),'canAllocate',eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id),$new$);

 -- The later distribution migration routes set, legacy create and return
 -- through one command. Keep its receipt table and cash/closeout safeguards.
 if to_regprocedure('eflow_budget.change_subtask_budget(uuid,uuid,uuid,uuid,numeric,text,uuid)') is not null then
  if not exists (
   select 1 from pg_catalog.pg_proc
   where oid = 'public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)'::regprocedure
    and strpos(prosrc,'eflow_budget.change_subtask_budget(') > 0
  ) then
   raise exception 'Review the installed Subtask budget distribution routes before applying M7';
  end if;
  perform eflow_m7.replace_body_part('eflow_budget.change_subtask_budget(uuid,uuid,uuid,uuid,numeric,text,uuid)',
   'caller is distinct from coalesce(task_row.assigned_to,task_row.recommendation_lead_id)',
   'caller is distinct from task_row.assigned_to or not coalesce(eflow_r3.eligible(caller),false)');
  perform eflow_m7.replace_body_part('eflow_budget.write_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
   'public.task_budget_line_available(parent_line.id)', 'public.task_budget_line_available(parent_line.id,null)');
  perform eflow_m7.replace_body_part('public.get_task_funding_context(uuid,uuid)',
   'auth.uid()::text=result->>''taskLeaderId''',
   'exists(select 1 from public.tasks t where t.id=p_task_id and t.assigned_to=auth.uid())');
 else
create table eflow_m7.cap_receipts (
 actor_id uuid not null, request_id uuid not null, terms jsonb not null, allocation_id uuid not null,
 primary key(actor_id, request_id)
);
alter table eflow_m7.cap_receipts enable row level security;
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  '  old_amount numeric;', '  old_amount numeric; v_receipt eflow_m7.cap_receipts; v_terms jsonb;');
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  'if p_amount <= 0 then', 'if p_amount is null or p_amount <= 0 or p_amount > 90000000000 or p_amount <> round(p_amount,2) or p_idempotency_key is null then');
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  'where id = p_task_id and deleted_at is null;', 'where id = p_task_id and deleted_at is null for update;');
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  'if caller is distinct from coalesce(task_row.assigned_to, task_row.recommendation_lead_id) then',
  'if not eflow_m7.can_allocate_subtask(p_task_id,p_subtask_id) then');
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  '  select * into parent_allocation from public.work_budget_allocations',
  $body$  v_terms := jsonb_build_object('task',p_task_id,'subtask',p_subtask_id,'line',p_parent_allocation_line_id,'amount',p_amount,'reason',btrim(p_reason));
  perform pg_advisory_xact_lock(hashtextextended(caller::text || ':' || p_idempotency_key::text,7));
  select * into v_receipt from eflow_m7.cap_receipts where actor_id=caller and request_id=p_idempotency_key;
  if found then
    if v_receipt.terms is distinct from v_terms then raise exception 'Allocation request terms changed' using errcode='23514'; end if;
    return v_receipt.allocation_id;
  end if;
  select * into parent_allocation from public.work_budget_allocations$body$);
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  'public.task_budget_line_available(parent_line.id)', 'public.task_budget_line_available(parent_line.id,null)');
 perform eflow_m7.replace_body_part('public.set_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  '  return cap_id;', '  insert into eflow_m7.cap_receipts values(caller,p_idempotency_key,v_terms,cap_id); return cap_id;');
-- Route the older create-only entry through the same balance and appointment
-- checks. The UI must use the keyed API for safe retry and cap adjustment.
 execute $legacy$create or replace function public.create_subtask_budget_allocation(
 p_task_id uuid,p_subtask_id uuid,p_parent_allocation_line_id uuid,p_amount numeric,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not eflow_m7.can_allocate_subtask(p_task_id,p_subtask_id) then
  raise exception 'Only the appointed Task Lead may allocate approved funding to this subtask' using errcode='42501';
 end if;
 perform eflow_r7.lock_impact(p_task_id);
 if exists(select 1 from public.work_budget_allocations where task_id=p_task_id and subtask_id=p_subtask_id and status in ('pending','approved')) then
  raise exception 'This subtask already has a cap. Use the existing cap adjustment.' using errcode='23514';
 end if;
 return public.set_subtask_budget_cap(p_task_id,p_subtask_id,p_parent_allocation_line_id,p_amount,p_reason,gen_random_uuid());
end $$$legacy$;
 end if;
end $migration$;

-- This projection reports current scoped authority without returning another
-- branch's allocations. The existing cash context remains compatible.
create function eflow_m7.allocation_context(p_task uuid,p_node uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.tasks; p public.projects; result jsonb;
begin
 select * into t from public.tasks where id=p_task and deleted_at is null and archived_at is null;
 if t.id is null or auth.uid() is null or not public.can_see_task(t.id,auth.uid()) then
  raise exception 'Task allocation is unavailable' using errcode='42501';
 end if;
 select * into p from public.projects where id=t.linked_project_id;
 if t.linked_project_id is not null and (p.id is null or p.status not in ('active','on_hold')) then
  raise exception 'Task allocation is unavailable' using errcode='42501';
 end if;
 if p_node is null then
  if not coalesce(eflow_project.lead(p.id,auth.uid()) and eflow_r3.eligible(auth.uid()),false)
     or t.status in ('completed','cancelled') then
   return jsonb_build_object('canAllocate',false);
  end if;
  result:=eflow_project.snapshot(p.id);
  return jsonb_build_object('canAllocate',true,'ready',result->'ready','funds',result->'funds',
   'lines',coalesce((select jsonb_agg(x) from jsonb_array_elements(result->'taskFunding') x where x->>'taskId'=t.id::text),'[]'::jsonb));
 end if;
 if not eflow_m7.can_allocate_subtask(p_task,p_node) then return jsonb_build_object('canAllocate',false); end if;
 return jsonb_build_object('canAllocate',true,'lines',coalesce((
  select jsonb_agg(jsonb_build_object('id',l.id,'name',coalesce(l.particular,l.category),
   'available',public.task_budget_line_available(l.id,null) + coalesce((
    select cap.amount from public.work_budget_allocations cap
    where cap.task_id=p_task and cap.subtask_id=p_node and cap.parent_allocation_line_id=l.id and cap.status='approved'
    order by cap.requested_at desc,cap.id limit 1),0)) order by l.position,l.id)
  from public.work_budget_allocations a join public.work_budget_allocation_lines l on l.allocation_id=a.id
  where a.task_id=p_task and a.subtask_id is null and a.status='approved'
 ),'[]'::jsonb));
end $$;

create function public.m7_work_allocation_context(p_task uuid,p_node uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select eflow_m7.allocation_context(p_task,p_node);
$$;
revoke all on function eflow_m7.allocation_context(uuid,uuid),public.m7_work_allocation_context(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function eflow_m7.allocation_context(uuid,uuid),public.m7_work_allocation_context(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
