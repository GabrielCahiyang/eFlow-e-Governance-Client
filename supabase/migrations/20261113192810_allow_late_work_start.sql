begin;

-- A scheduled start is the first eligible day. The deadline remains a
-- reporting date, so a lead can start an overdue task or subtask.
do $migration$
begin
  perform eflow_m7.replace_body_part(
    'eflow_m7.guard_root_start()',
    $old$and (to_jsonb(old)->>'start_date')::date is distinct from eflow_m7.work_day(new.id) then$old$,
    $new$and coalesce((to_jsonb(old)->>'start_date')::date > eflow_m7.work_day(new.id), true) then$new$
  );
  perform eflow_m7.replace_body_part(
    'eflow_m7.guard_root_start()',
    $old$raise exception 'Start work is available on the planned start date' using errcode='22023';$old$,
    $new$if to_jsonb(old)->>'start_date' is null then
     raise exception 'Set a planned start date before starting this task.' using errcode='22023';
   end if;
   raise exception 'You can start this task on or after %.', to_jsonb(old)->>'start_date' using errcode='22023';$new$
  );
  perform eflow_m7.replace_body_part(
    'public.m7_start_subtask(uuid,uuid)',
    $old$if n.status<>'todo' or planned is distinct from eflow_m7.work_day(p_root) then$old$,
    $new$if n.status <> 'todo' then
  raise exception 'Only a subtask in To do can be started.' using errcode='22023';
 end if;
 if planned is null then
  raise exception 'Set a planned start date before starting this subtask.' using errcode='22023';
 end if;
 if planned > eflow_m7.work_day(p_root) then$new$
  );
  perform eflow_m7.replace_body_part(
    'public.m7_start_subtask(uuid,uuid)',
    $old$raise exception 'Start work is available on the planned start date' using errcode='22023';$old$,
    $new$raise exception 'You can start this subtask on or after %.', to_char(planned, 'YYYY-MM-DD') using errcode='22023';$new$
  );
end
$migration$;

notify pgrst, 'reload schema';
commit;
