-- Allow deleting unstarted tasks (and their groups) that only contain
-- unstarted subtasks (e.g. from starter templates or PDF imports) without
-- any execution, submissions, petty cash, or budget allocations.

CREATE OR REPLACE FUNCTION eflow_publication.guard_task_removal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if old.linked_project_id is null or old.source_collaboration_draft_id is not null then return new; end if;
 if not ((old.deleted_at is null and new.deleted_at is not null) or
         (old.status<>'cancelled' and new.status='cancelled')) then return new; end if;
 if exists(select 1 from public.projects where id=old.linked_project_id and status in ('completed','archived'))
    or old.status in ('for_review','completed','cancelled') then
  raise exception 'Work under review or closed work must retain its history' using errcode='23514';
 end if;
 if exists(select 1 from public.tasks t where t.deleted_at is null and t.status<>'cancelled' and old.id=any(t.dependency_ids)) then
  raise exception 'Resolve dependent tasks before removing this task' using errcode='23514';
 end if;
 if exists(select 1 from public.work_budget_allocations a where a.task_id=old.id and a.status='approved')
    or exists(select 1 from public.petty_cash_requests r where r.task_id=old.id and r.status not in ('settled','rejected','cancelled')) then
  raise exception 'Reconcile task funding before removing this task' using errcode='23514';
 end if;
 if new.deleted_at is not null and (old.status not in ('pending_assignment','todo') or coalesce(old.percent_complete,0)<>0
    or exists(select 1 from public.task_submissions where task_id=old.id)
    or exists(
      select 1 from public.subtasks s
      where s.task_id=old.id
        and (
          s.status::text not in ('todo','pending_assignment')
          or s.started_at is not null
          or coalesce(s.percent_complete,0)<>0
          or exists(select 1 from public.subtask_submissions ss where ss.subtask_id=s.id)
          or exists(select 1 from public.petty_cash_requests pcr where pcr.subtask_id=s.id)
          or exists(select 1 from public.work_budget_allocations wba where wba.subtask_id=s.id)
        )
    )
    or exists(select 1 from public.petty_cash_requests where task_id=old.id)
    or exists(select 1 from public.work_budget_allocations where task_id=old.id)) then
  raise exception 'Use cancellation to retain this task’s history' using errcode='23514';
 end if;
 return new;
end $function$;
