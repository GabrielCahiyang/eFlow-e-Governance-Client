-- Planning authority follows the appointed Project Lead even when the Task Lead differs.
create function eflow_m7.subtask_budget_actor(p_task uuid, p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r3.eligible(p_actor),false) and exists (
  select 1 from public.tasks t left join public.projects p on p.id=t.linked_project_id
  where t.id=p_task and t.deleted_at is null and t.proposed_office_identity_id is null
   and public.can_see_task(t.id,p_actor)
   and (t.assigned_to=p_actor or (p.status='planning' and eflow_project.lead(p.id,p_actor)))
 );
$$;
revoke all on function eflow_m7.subtask_budget_actor(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function eflow_m7.can_allocate_subtask(p_task uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select eflow_m7.subtask_budget_actor(p_task,auth.uid()) and exists (
  select 1 from public.tasks t join public.subtasks s on s.task_id=t.id and s.id=p_node
  left join public.projects p on p.id=t.linked_project_id
  where t.id=p_task and t.archived_at is null
   and t.status in ('todo','in_progress','changes_requested')
   and (t.linked_project_id is null or p.status in ('planning','active','on_hold'))
   and s.status not in ('completed','for_review')
 );
$$;

-- Keep the existing lock, receipt, balance, cash-history and return logic.
do $migration$
begin
 perform eflow_m7.replace_body_part('eflow_budget.change_subtask_budget(uuid,uuid,uuid,uuid,numeric,text,uuid)',
  'caller is distinct from task_row.assigned_to or not coalesce(eflow_r3.eligible(caller),false)',
  'not eflow_m7.subtask_budget_actor(p_task,caller)');
 perform eflow_m7.replace_body_part('eflow_budget.change_subtask_budget(uuid,uuid,uuid,uuid,numeric,text,uuid)',
  'Only the current Task Lead can manage this subtask budget.',
  'Only the assigned Task Lead or the appointed Project Lead during Planning can manage this subtask budget.');
 perform eflow_m7.replace_body_part('eflow_budget.write_subtask_budget_cap(uuid,uuid,uuid,numeric,text,uuid)',
  'caller is distinct from coalesce(task_row.assigned_to, task_row.recommendation_lead_id)',
  'not eflow_m7.subtask_budget_actor(p_task_id,caller)');
 perform eflow_m7.replace_body_part('eflow_budget.cancel_subtask_budget_cap(uuid,text,uuid)',
  'caller is distinct from coalesce(task_row.assigned_to, task_row.recommendation_lead_id)',
  'not eflow_m7.subtask_budget_actor(cap.task_id,caller)');
 perform eflow_m7.replace_body_part('eflow_m7.allocation_context(uuid,uuid)',
  $old$if t.linked_project_id is not null and (p.id is null or p.status not in ('active','on_hold')) then$old$,
  $new$if t.linked_project_id is not null and (p.id is null or
    (p.status not in ('active','on_hold') and not (p_node is not null and p.status='planning'))) then
   if p_node is not null then return jsonb_build_object('canAllocate',false,'reason','project_state_blocked'); end if;$new$);
 perform eflow_m7.replace_body_part('eflow_m7.allocation_context(uuid,uuid)',
  'if not eflow_m7.can_allocate_subtask(p_task,p_node) then return jsonb_build_object(''canAllocate'',false); end if;',
  $body$if not eflow_m7.can_allocate_subtask(p_task,p_node) then
   return jsonb_build_object('canAllocate',false,'reason',case
    when t.proposed_office_identity_id is not null then 'responsible_office_pending'
    when not eflow_m7.subtask_budget_actor(p_task,auth.uid()) then
     case when p.status='planning' then 'planning_lead_required' else 'task_lead_required' end
    when not exists(select 1 from public.subtasks s where s.task_id=p_task and s.id=p_node) then 'subtask_unavailable'
    else 'work_state_blocked'
   end);
  end if;$body$);
end
$migration$;
notify pgrst, 'reload schema';
