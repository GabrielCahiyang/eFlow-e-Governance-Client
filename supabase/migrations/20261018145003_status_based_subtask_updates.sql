-- Status updates retain historical progress values. Existing authorization, locks,
-- dependencies, evidence submission and approval gates remain authoritative.
CREATE OR REPLACE FUNCTION public.save_subtask_work_update(p_subtask_id uuid, p_state text, p_blocker text DEFAULT NULL, p_note text DEFAULT NULL, p_next_step text DEFAULT NULL, p_attachment_path text DEFAULT NULL, p_attachment_name text DEFAULT NULL)
 RETURNS public.subtasks
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

  if not (eflow_r7.root(subtask_row.task_id) is null or coalesce(eflow_r7.node_work(p_subtask_id,caller),false)) or not (
    case when eflow_r7.root(subtask_row.task_id)->>'kind'='office' then
    coalesce(eflow_r7.node_work(p_subtask_id,caller),false)
   else subtask_row.assigned_to = caller
    or caller = any(coalesce(subtask_row.assigned_to_ids, '{}'::uuid[])) end
  ) then
    raise exception 'This subtask is not assigned to you' using errcode = '42501';
  end if;

  if subtask_row.status in ('for_review', 'completed') then
    raise exception 'This subtask is locked while under review or completed'
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
    blocker_category, blocker, next_step, note, attachment_path, attachment_name
  ) values (
    p_subtask_id, subtask_row.task_id, caller, coalesce(caller_name, 'User'),
    subtask_row.percent_complete, case when p_state='stuck' then 'Other' else 'None' end,
    case when p_state='stuck' then nullif(btrim(p_blocker), '') else null end, nullif(btrim(p_next_step), ''),
    nullif(btrim(p_note), ''), nullif(p_attachment_path, ''),
    nullif(p_attachment_name, '')
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

REVOKE ALL ON FUNCTION public.save_subtask_work_update(uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_subtask_work_update(uuid,text,text,text,text,text,text) TO authenticated;

