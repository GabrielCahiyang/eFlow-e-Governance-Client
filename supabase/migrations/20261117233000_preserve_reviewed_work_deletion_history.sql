begin;
set local lock_timeout = '10s';

-- Both planning-deletion fixes remain in history. Preserve the reviewed-work
-- restriction from the earlier checklist fix after the later branch fix runs.
-- Keep recorded migrations unchanged and retain the installed function's ACL.
do $migration$
declare
 definition text := pg_get_functiondef('eflow_publication.guard_task_removal()'::regprocedure);
 anchor constant text := 'or exists(select 1 from public.task_progress_updates where task_id = old.id)';
begin
 if strpos(definition, 'from eflow_m7.work_proposals where root_id = old.id') = 0 then
  if length(definition) - length(replace(definition, anchor, '')) <> length(anchor) then
   raise exception 'Review the installed task-removal guard before preserving reviewed-work history';
  end if;
  execute replace(definition, anchor,
   anchor || chr(10) || '     or exists(select 1 from eflow_m7.work_proposals where root_id = old.id)');
 end if;
end $migration$;

notify pgrst, 'reload schema';
commit;
