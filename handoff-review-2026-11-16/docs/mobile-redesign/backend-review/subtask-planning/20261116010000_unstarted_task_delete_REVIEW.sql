-- REVIEW ONLY. NOT APPLIED. Adds an atomic pre-start check to the existing delete RPC.
-- Current row lock, permissions, audit, finance/history triggers and soft-delete semantics remain.
begin;
set local lock_timeout='10s';
do $review$
declare definition text; anchor text:='  update public.tasks set deleted_at = now(), last_activity_at = now()';
begin
 definition:=pg_get_functiondef('public.soft_delete_task(uuid)'::regprocedure);
 if md5(definition)<>'1f528da6ee9af9874ae0934de37fde04' then raise exception 'Task delete baseline differs. Stop for review.';end if;
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'Task delete anchor differs. Stop for review.';end if;
 execute replace(definition,anchor,'  if t.status::text not in (''todo'',''pending_assignment'') or coalesce(t.percent_complete,0)>0
   or exists(select 1 from public.task_status_history h where h.task_id=t.id
      and h.to_status::text in (''in_progress'',''for_review'',''changes_requested'',''completed''))
   or exists(select 1 from public.subtasks s where s.task_id=t.id and
      (s.started_at is not null or coalesce(s.percent_complete,0)>0
       or s.status::text in (''in_progress'',''for_review'',''changes_requested'',''completed''))) then
    raise exception ''Only an unstarted task can be deleted. Started work must be retained.'' using errcode=''23514'';
  end if;

  update public.tasks set deleted_at = now(), last_activity_at = now()');
end $review$;
commit;
