begin;

do $migration$
begin
 perform eflow_m7.replace_body_part(
  'public.submit_task_progress(uuid,integer,text,text,text,text,text,text)',
  '  if t.status not in (''todo'', ''in_progress'',''changes_requested'') then',
  $body$  if t.status in ('todo','pending_assignment','changes_requested') then
    raise exception 'Start or resume the task before posting progress' using errcode='22023';
  end if;
  if t.status not in ('todo', 'in_progress','changes_requested') then$body$);
 perform eflow_m7.replace_body_part(
  'public.submit_task_for_review(uuid,jsonb)',
  '  if t.archived_at is not null or t.status not in (''todo'',''in_progress'',''changes_requested'') then',
  $body$  if t.status in ('todo','pending_assignment','changes_requested') then
    raise exception 'Start or resume the task before submitting completion' using errcode='22023';
  end if;
  if t.archived_at is not null or t.status not in ('todo','in_progress','changes_requested') then$body$);
 perform eflow_m7.replace_body_part(
  'public.transition_task_status(uuid,text,text,text)',
  '  if not public.is_allowed_task_transition(t.status, p_to_status) then',
  $body$  if prev_status in ('todo','pending_assignment','changes_requested') and p_to_status in ('for_review','completed') then
    raise exception 'Start or resume the task before submitting completion' using errcode='22023';
  end if;
  if not public.is_allowed_task_transition(t.status, p_to_status) then$body$);

 -- The Personal command uses its existing row lock and idempotent receipt.
 perform eflow_m7.replace_body_part(
  'public.r3_personal_project_command(uuid,text,jsonb,uuid)',
  $old$p_command in ('progress_task','submit_task','review_task','staff_task')$old$,
  $new$p_command in ('start_task','progress_task','submit_task','review_task','staff_task')$new$);
 perform eflow_m7.replace_body_part(
  'public.r3_personal_project_command(uuid,text,jsonb,uuid)',
  $old$ if p_command='submit_task' and t.reviewer_id is not null$old$,
  $new$ if p_command='start_task' and t.status<>'todo' then
  raise exception 'Only a task in To do can be started' using errcode='22023';
 elsif p_command<>'start_task' and t.status='todo' then
  raise exception 'Start the task before posting progress or submitting completion' using errcode='22023';
 end if;
 if p_command='submit_task' and t.reviewer_id is not null$new$);
 perform eflow_m7.replace_body_part(
  'public.r3_personal_project_command(uuid,text,jsonb,uuid)',
  $old$case when p_command='progress_task' then 'in_progress'$old$,
  $new$case when p_command in ('start_task','progress_task') then 'in_progress'$new$);
 perform eflow_m7.replace_body_part(
  'public.r3_personal_project_command(uuid,text,jsonb,uuid)',
  $old$progress=case when p_command='progress_task' then (p_payload->>'progress')::integer else 100 end,
 note=coalesce(p_payload->>'note','')$old$,
  $new$progress=case when p_command='start_task' then t.progress when p_command='progress_task' then (p_payload->>'progress')::integer else 100 end,
 note=case when p_command='start_task' then t.note else coalesce(p_payload->>'note','') end$new$);
end $migration$;

notify pgrst, 'reload schema';
commit;
