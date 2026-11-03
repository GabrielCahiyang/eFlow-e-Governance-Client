-- Start work from actual updates, never from legacy percentage thresholds.
-- Preserve current review, dependency, project, identity and financial guards.
CREATE OR REPLACE FUNCTION public.submit_task_progress(p_task_id uuid, p_percent_complete integer DEFAULT NULL::integer, p_blocker_category text DEFAULT NULL::text, p_blocker text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_attachment_path text DEFAULT NULL::text, p_attachment_name text DEFAULT NULL::text)
 RETURNS task_progress_updates
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text;
  t public.tasks;
  progress public.task_progress_updates;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_percent_complete is not null
     and (p_percent_complete < 0 or p_percent_complete > 99) then
    raise exception 'Progress must be a whole number from 0 to 99; completion requires approval'
      using errcode = '22023';
  end if;
  select full_name
    into caller_name
  from public.profiles
  where id = caller;
  select *
    into t
  from public.tasks
  where id = p_task_id
    and deleted_at is null
  for update;
  if not found then raise exception 'Task not found'; end if;
  if t.archived_at is not null then
    raise exception 'Archived tasks cannot receive progress'
      using errcode = '22023';
  end if;
  if not public.can_contribute_task(t.id, caller) then
    raise exception 'Only a task participant may post progress'
      using errcode = '42501';
  end if;
  if t.status not in ('todo', 'in_progress','changes_requested') then
    raise exception 'Resume or reopen this task before posting progress'
      using errcode = '22023';
  end if;
  if t.status='changes_requested' and coalesce(t.assigned_to,t.recommendation_lead_id) is distinct from caller then
    raise exception 'Only the task lead can resume returned work' using errcode='42501';
  end if;
  if t.status in ('todo','changes_requested') then
    perform public.transition_task_status(
      p_task_id,
      'in_progress',
      null,
      'Work started with a progress update'
    );
  end if;
  insert into public.task_progress_updates (
    task_id,
    author_id,
    author_name,
    percent_complete,
    blocker_category,
    blocker,
    next_step,
    note,
    attachment_path,
    attachment_name, created_at
  )
  values (
    p_task_id,
    caller,
    coalesce(caller_name, 'User'),
    p_percent_complete,
    nullif(btrim(p_blocker_category), ''),
    nullif(btrim(p_blocker), ''),
    nullif(btrim(p_next_step), ''),
    nullif(btrim(p_note), ''),
    p_attachment_path,
    p_attachment_name, clock_timestamp()
  )
  returning * into progress;
  update public.tasks
  set
    percent_complete = coalesce(p_percent_complete, percent_complete),
    last_activity_at = now()
  where id = p_task_id;
  insert into public.audit_events (
    actor_id,
    actor_name,
    entity_type,
    entity_id,
    action,
    after_data,
    metadata,
    org_id
  )
  values (
    caller,
    coalesce(caller_name, 'User'),
    'task',
    p_task_id::text,
    'progress.updated',
    jsonb_build_object(
      'percentComplete',
      p_percent_complete,
      'blocker',
      nullif(btrim(p_blocker), '')
    ),
    jsonb_build_object('progressId', progress.id),
    t.org_id
  );
  return progress;
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_task_subtask_rollup(target_task uuid, touch_activity boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare r jsonb:=eflow_r7.root(target_task);started boolean:=false;previous_flag text;actor_name text;
begin
 if r is null then perform eflow_r7.baseline_refresh_task_subtask_rollup(target_task,touch_activity);return;end if;
 if auth.uid() is not null and not public.can_see_task(target_task,auth.uid()) then raise exception 'Task unavailable' using errcode='42501';end if;
 -- Recorded execution starts the task. No percentage threshold, auto-submission
 -- or approval: those remain with the Task Lead and designated reviewer.
 perform 1 from public.tasks where id=target_task for update;
 r:=eflow_r7.root(target_task);
 started:=r->>'status'='todo' and coalesce((r->>'open')::boolean,false) and exists(
  select 1 from public.subtasks s where s.task_id=target_task and
   (s.status in ('in_progress','for_review','changes_requested','completed') or s.is_completed
    or exists(select 1 from public.subtask_progress_updates u where u.subtask_id=s.id)));
 previous_flag:=coalesce(current_setting('eflow.allow_status_write',true),'off');
 if started then perform set_config('eflow.allow_status_write','on',true);end if;
 update public.tasks set subtask_count=(select count(*) from public.subtasks where task_id=target_task),
 subtask_completed_count=(select count(*) from public.subtasks where task_id=target_task and is_completed),
 status=case when started and status='todo' then 'in_progress' else status end,
 last_activity_at=case when touch_activity then now() else last_activity_at end where id=target_task and deleted_at is null;
 if started then
  perform set_config('eflow.allow_status_write',previous_flag,true);
  select full_name into actor_name from public.profiles where id=auth.uid();
  insert into public.task_status_history(task_id,from_status,to_status,actor_id,actor_name,note)
   values(target_task,'todo','in_progress',auth.uid(),coalesce(actor_name,'System'),'Work started in a subtask.');
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,reason,before_data,after_data,org_id)
   values(auth.uid(),coalesce(actor_name,'System'),'task',target_task::text,'task.started_from_subtask','Recorded subtask work starts the parent task.',jsonb_build_object('status','todo'),jsonb_build_object('status','in_progress'),(r->>'office')::uuid);
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.save_subtask_work_update(p_subtask_id uuid, p_state text, p_blocker text DEFAULT NULL::text, p_note text DEFAULT NULL::text, p_next_step text DEFAULT NULL::text, p_attachment_path text DEFAULT NULL::text, p_attachment_name text DEFAULT NULL::text)
 RETURNS subtasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text;
  subtask_row public.subtasks;
  task_row public.tasks;
begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact((select task_id from public.subtasks where id=p_subtask_id)); /* NW4.2 completion serialization */ perform eflow_r7.lock_completion((select task_id from public.subtasks where id=p_subtask_id));
 if eflow_r7.root((select task_id from public.subtasks where id=p_subtask_id)) is not null then
 if not eflow_r3.eligible(auth.uid()) then raise exception 'Current verified operational identity required' using errcode='42501';end if;
 if not eflow_r7.read_root((select task_id from public.subtasks where id=p_subtask_id)) then raise exception 'Work access denied' using errcode='42501';end if;end if;
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_state is null or p_state not in ('in_progress','stuck') then raise exception 'Choose In progress or Stuck' using errcode='22023'; end if;
  if p_state='stuck' and nullif(btrim(p_blocker),'') is null then raise exception 'A blocker reason is required' using errcode='22023'; end if;
  if length(coalesce(p_note,''))>3000 or length(coalesce(p_blocker,''))>3000 or length(coalesce(p_next_step,''))>300 then raise exception 'Work update exceeds its text limit' using errcode='22023'; end if;
  select * into subtask_row from public.subtasks where id = p_subtask_id for update;
  if not found then raise exception 'Subtask not found' using errcode = 'P0002'; end if;
  if not eflow_r3.eligible(caller) or not (case when eflow_r7.root(subtask_row.task_id) is not null then
   coalesce((eflow_r7.operation_capabilities(subtask_row.task_id,p_subtask_id)->'execute'->>'allowed')::boolean,false)
   else public.can_manage_subtasks(subtask_row.task_id,caller) or caller=any(coalesce(subtask_row.assigned_to_ids,'{}'::uuid[])) or subtask_row.assigned_to=caller end)
  then raise exception 'Current task team access required' using errcode='42501';end if;
  if subtask_row.status='completed' then
    raise exception 'This subitem is already completed'
      using errcode = '22023';
  end if;
  select * into task_row from public.tasks
  where id = subtask_row.task_id and deleted_at is null;
  if not found or task_row.status in ('for_review', 'completed', 'cancelled') then
    raise exception 'The parent task is not open for subtask progress'
      using errcode = '22023';
  end if;
  select full_name into caller_name from public.profiles where id = caller;
  perform set_config('eflow.subtask_workflow_authorized', 'on', true);
  update public.subtasks
  set
    status = 'in_progress',
    is_completed = false,
    completed_by = null,
    completed_at = null
  where id = p_subtask_id
  returning * into subtask_row;
  perform set_config('eflow.subtask_workflow_authorized', 'off', true);
  insert into public.subtask_progress_updates (
    subtask_id, task_id, author_id, author_name, percent_complete,
    blocker_category, blocker, next_step, note, attachment_path, attachment_name, created_at
  ) values (
    p_subtask_id, subtask_row.task_id, caller, coalesce(caller_name, 'User'),
    subtask_row.percent_complete, case when p_state='stuck' then 'Other' else 'None' end,
    case when p_state='stuck' then nullif(btrim(p_blocker), '') else null end, nullif(btrim(p_next_step), ''),
    nullif(btrim(p_note), ''), nullif(p_attachment_path, ''),
    nullif(p_attachment_name, ''), clock_timestamp()
  );
  insert into public.task_activities (task_id, type, content, actor_id, actor_name)
  values (
    subtask_row.task_id, 'subtask_progress',
    case when p_state='stuck' then 'Reported a blocker on "' else 'Started or updated "' end || subtask_row.title || '"',
    caller, coalesce(caller_name, 'User')
  );
  return subtask_row;
end;
$function$;

NOTIFY pgrst, 'reload schema';
