begin;

-- The finance reviewer stored on a cash request can differ from the appointed
-- Task Lead. Give that Lead totals without opening the underlying cash records.
create function public.task_lead_expense_totals(p_task_ids uuid[])
returns table (task_id uuid, subtask_id uuid, settled numeric, pending numeric, pending_count bigint, expense_count bigint, subtask_budget numeric)
language sql stable security definer set search_path = '' as $$
  with authorized as materialized (
    select t.id
    from public.tasks t
    where t.id = any(p_task_ids)
      and cardinality(p_task_ids) <= 100
      and t.deleted_at is null
      and t.proposed_office_identity_id is null
      and coalesce(t.assigned_to,t.recommendation_lead_id) = auth.uid()
      and eflow_r3.eligible(auth.uid())
      and eflow_m7.project_visible(t.linked_project_id,auth.uid())
      and public.can_see_task(t.id,auth.uid())
  ), amounts as (
    select r.task_id, r.subtask_id,
      case when r.status = 'settled' then r.actual_spent end as settled,
      case when l.status in ('pending','pending_leader_review','pending_department_settlement') then l.declared_spent end as pending
    from authorized a join public.petty_cash_requests r on r.task_id = a.id
    left join lateral (
      select l.status,l.declared_spent
      from public.petty_cash_liquidations l
      where l.request_id = r.id
      order by l.version desc,l.id desc
      limit 1
    ) l on r.status <> 'settled'
    where r.status in ('settled','liquidation_submitted','pending_leader_liquidation_review','pending_department_settlement')
  ), totals as (
    select a.task_id, a.subtask_id, grouping(a.subtask_id) as root_total,
      sum(a.settled) as settled, sum(a.pending) as pending, count(a.pending) as pending_count,
      count(*) filter (where a.settled is not null or a.pending is not null) as expense_count
    from amounts a
    group by grouping sets ((a.task_id),(a.task_id,a.subtask_id))
  ), caps as (
    select c.task_id,c.subtask_id,sum(c.amount) as amount
    from authorized a join public.work_budget_allocations c on c.task_id = a.id
    where c.subtask_id is not null and c.status = 'approved'
    group by c.task_id,c.subtask_id
  )
  select a.id,null::uuid,coalesce(t.settled,0),coalesce(t.pending,0),coalesce(t.pending_count,0),coalesce(t.expense_count,0),null::numeric
  from authorized a left join totals t on t.task_id = a.id and t.root_total = 1
  union all
  select coalesce(t.task_id,c.task_id),coalesce(t.subtask_id,c.subtask_id),coalesce(t.settled,0),coalesce(t.pending,0),
    coalesce(t.pending_count,0),coalesce(t.expense_count,0),c.amount
  from (select * from totals where root_total = 0 and subtask_id is not null) t
  full join caps c using (task_id,subtask_id);
$$;

revoke all on function public.task_lead_expense_totals(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.task_lead_expense_totals(uuid[]) to authenticated;
notify pgrst, 'reload schema';
commit;
