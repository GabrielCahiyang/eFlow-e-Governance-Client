-- Keep the original Budget visible on finished work.
--
-- Completing a task or subtask already returns its unused allocation to the
-- project budget (eflow_work_clearance.restore). That reduces the live
-- allocation line, so a finished task would otherwise lose the figure the Head
-- originally authorised. Record each automatic return in the task's own
-- activity log so the Budget column can keep showing "budget 400, actual 0"
-- and the history says that the unused amount went back to the project.
--
-- Purely additive: no existing function, table, policy or row is changed.

create or replace function eflow_work_clearance.log_returned_budget(p_event public.audit_events)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_task uuid;
  v_subtask uuid;
  v_before numeric;
  v_after numeric;
  v_returned numeric;
  v_spent numeric;
begin
  if p_event.entity_id is null or p_event.entity_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return;
  end if;
  if p_event.action = 'project.unused_funding_restored_automatically' then
    v_task := p_event.entity_id::uuid;
    v_before := (p_event.before_data ->> 'amount')::numeric;
    v_after := (p_event.after_data ->> 'amount')::numeric;
    v_returned := coalesce((p_event.after_data ->> 'returned')::numeric, v_before - v_after);
  elsif p_event.action = 'project.subtask_unused_funding_restored' then
    v_subtask := p_event.entity_id::uuid;
    select s.task_id into v_task from public.subtasks s where s.id = v_subtask;
    v_before := (p_event.before_data ->> 'amount')::numeric;
    v_after := (p_event.after_data ->> 'amount')::numeric;
    v_returned := v_before - v_after;
  else
    return;
  end if;
  if v_task is null or v_returned is null or v_returned <= 0 then
    return;
  end if;
  if exists (
    select 1 from public.task_activities a
    where a.task_id = v_task and a.type = 'budget_unused_returned'
      and a.metadata ->> 'auditEventId' = p_event.id::text
  ) then
    return;
  end if;
  select coalesce(sum(r.actual_spent), 0) into v_spent
  from public.petty_cash_requests r
  where r.task_id = v_task and r.status = 'settled'
    and (v_subtask is null or r.subtask_id = v_subtask);
  insert into public.task_activities (task_id, actor_id, actor_name, type, content, metadata, created_at)
  values (
    v_task,
    p_event.actor_id,
    coalesce(nullif(btrim(p_event.actor_name), ''), 'System'),
    'budget_unused_returned',
    case when v_subtask is null then 'Task' else 'Subtask' end
      || ' budget of ₱' || to_char(v_before, 'FM999,999,999,990.00')
      || ' was not fully used. ₱' || to_char(v_returned, 'FM999,999,999,990.00')
      || ' was returned to the project budget. Actual spent: ₱' || to_char(v_spent, 'FM999,999,999,990.00') || '.',
    jsonb_build_object(
      'version', 1,
      'scope', case when v_subtask is null then 'task' else 'subtask' end,
      'subtaskId', v_subtask,
      'budget', v_before,
      'returned', v_returned,
      'kept', v_after,
      'actualSpent', v_spent,
      'auditEventId', p_event.id
    ),
    coalesce(p_event.created_at, now())
  );
end
$function$;

create or replace function eflow_work_clearance.log_returned_budget_trigger()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Logging must never block completing work.
  begin
    perform eflow_work_clearance.log_returned_budget(new);
  exception when others then
    null;
  end;
  return null;
end
$function$;

revoke all on function eflow_work_clearance.log_returned_budget(public.audit_events) from public, anon, authenticated;
revoke all on function eflow_work_clearance.log_returned_budget_trigger() from public, anon, authenticated;

drop trigger if exists zz_log_returned_budget on public.audit_events;
create trigger zz_log_returned_budget
  after insert on public.audit_events
  for each row
  when (new.action in ('project.unused_funding_restored_automatically', 'project.subtask_unused_funding_restored'))
  execute function eflow_work_clearance.log_returned_budget_trigger();

-- Record returns that happened before this migration.
do $backfill$
declare event public.audit_events;
begin
  for event in
    select * from public.audit_events
    where action in ('project.unused_funding_restored_automatically', 'project.subtask_unused_funding_restored')
    order by created_at
  loop
    perform eflow_work_clearance.log_returned_budget(event);
  end loop;
end
$backfill$;
