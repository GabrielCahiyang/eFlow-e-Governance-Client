begin;

create function public.m7_assigned_subtask_reviews()
returns table (
  id uuid, root_id uuid, node_id uuid, task_title text, subtask_title text,
  kind text, submitted_at timestamptz, cash_blocked boolean
)
language sql stable security definer set search_path = '' as $$
  select w.id, w.root_id, w.node_id, t.title, s.title, w.kind, w.submitted_at,
    w.kind = 'completion' and w.submitted_as_lead and exists (
      select 1 from public.petty_cash_requests r
      where r.task_id = t.id and r.subtask_id = s.id
        and r.status not in ('settled', 'rejected', 'cancelled')
    )
  from eflow_m7.work_proposals w
  join public.tasks t on t.id = w.root_id
  join public.subtasks s on s.id = w.node_id and s.task_id = t.id
  where w.state = 'pending'
    and auth.uid() is not null
    and w.author_id <> auth.uid()
    and eflow_m7.work_scope_open(w.root_id, w.node_id)
    and eflow_m7.work_reviewer(w.root_id, w.node_id, w.author_id, w.kind) = auth.uid()
    and w.submitted_as_lead = eflow_m7.is_subtask_lead(w.root_id, w.node_id, w.author_id)
  order by w.submitted_at, w.id;
$$;

revoke all on function public.m7_assigned_subtask_reviews() from public, anon, authenticated, service_role;
grant execute on function public.m7_assigned_subtask_reviews() to authenticated;
notify pgrst, 'reload schema';
commit;
