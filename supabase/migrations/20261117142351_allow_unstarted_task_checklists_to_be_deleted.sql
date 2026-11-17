begin;
set local lock_timeout = '10s';

-- Soft deletion keeps the Task, its checklist, and the audit event. Only
-- execution, review, dependency and financial records prevent removal.
create or replace function eflow_publication.guard_task_removal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.linked_project_id is null or old.source_collaboration_draft_id is not null then return new; end if;
 if not ((old.deleted_at is null and new.deleted_at is not null) or
         (old.status <> 'cancelled' and new.status = 'cancelled')) then return new; end if;

 if exists(select 1 from public.projects where id = old.linked_project_id and status in ('completed','archived'))
    or old.status in ('for_review','completed','cancelled') then
  raise exception 'Work under review or closed work must retain its history' using errcode = '23514';
 end if;
 if exists(select 1 from public.tasks t where t.deleted_at is null and t.status <> 'cancelled' and old.id = any(t.dependency_ids)) then
  raise exception 'Resolve dependent tasks before removing this task' using errcode = '23514';
 end if;
 if exists(select 1 from public.work_budget_allocations a where a.task_id = old.id and a.status = 'approved')
    or exists(select 1 from public.petty_cash_requests r where r.task_id = old.id and r.status not in ('settled','rejected','cancelled')) then
  raise exception 'Reconcile task funding before removing this task' using errcode = '23514';
 end if;

 if new.deleted_at is not null then
  if old.status not in ('pending_assignment','todo') or coalesce(old.percent_complete,0) <> 0
     or old.latest_submission is not null and old.latest_submission not in ('null'::jsonb,'{}'::jsonb)
     or exists(select 1 from public.task_submissions where task_id = old.id)
     or exists(select 1 from public.task_progress_updates where task_id = old.id)
     or exists(select 1 from public.task_status_history where task_id = old.id and
       (from_status in ('in_progress','for_review','changes_requested','completed','cancelled')
        or to_status in ('in_progress','for_review','changes_requested','completed','cancelled')))
     or exists(select 1 from eflow_m7.work_proposals where root_id = old.id) then
   raise exception 'This task has execution or submission history. Cancel it to retain that history.' using errcode = '23514';
  end if;

  -- Scan the complete branch, including descendants hidden from the caller.
  if exists(select 1 from public.subtasks s where s.task_id = old.id and
       (s.status <> 'todo' or coalesce(s.percent_complete,0) <> 0 or s.is_completed
        or s.started_at is not null or s.completed_at is not null or s.latest_submission_id is not null))
     or exists(select 1 from public.subtask_submissions where task_id = old.id)
     or exists(select 1 from public.subtask_progress_updates where task_id = old.id) then
   raise exception 'A subtask has started or has saved work. Cancel the task to retain its history.' using errcode = '23514';
  end if;

  if exists(select 1 from public.petty_cash_requests where task_id = old.id)
     or exists(select 1 from public.work_budget_allocations where task_id = old.id) then
   raise exception 'This task has financial records. Cancel it to retain those records.' using errcode = '23514';
  end if;
 end if;
 return new;
end $$;

-- Acquire the shared project and task locks before the RPC locks the task
-- row. Retain the installed RPC's permissions, validation and audit logic.
do $migration$
declare
 definition text := pg_get_functiondef('public.soft_delete_task(uuid)'::regprocedure);
 anchor constant text := '  select full_name into caller_name from public.profiles where id = caller;';
begin
 if strpos(definition, 'perform eflow_r7.lock_impact(p_task_id);') = 0 then
  if length(definition) - length(replace(definition, anchor, '')) <> length(anchor) then
   raise exception 'Review the installed task deletion command before applying the planning deletion correction';
  end if;
  execute replace(definition, anchor, '  perform eflow_r7.lock_impact(p_task_id);' || chr(10) || anchor);
 end if;
end $migration$;

notify pgrst, 'reload schema';
commit;
