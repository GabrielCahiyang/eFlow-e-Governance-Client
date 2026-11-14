-- Remove due times from tasks while keeping calendar due dates intact.
-- Updates task schedule validation RPCs, normalizes future task writes via trigger,
-- and strips any existing time suffixes from tasks and proposal draft snapshots.

begin;

create schema if not exists eflow_schedule;

create or replace function eflow_schedule.strip_task_due_time(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  trimmed text := btrim(p_value);
begin
  if p_value is null or trimmed = '' then
    return p_value;
  end if;
  if trimmed ~ '^\d{4}-\d{2}-\d{2}$' then
    return trimmed;
  end if;
  if trimmed ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}' then
    if trimmed ~ '(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' then
      return (trimmed::timestamptz at time zone 'Asia/Manila')::date::text;
    end if;
    return trimmed::timestamp::date::text;
  end if;
  return p_value;
exception when others then
  if trimmed ~ '^\d{4}-\d{2}-\d{2}[T ]' then
    return left(trimmed, 10);
  end if;
  return p_value;
end;
$$;

create or replace function eflow_schedule.normalize_task_due_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deadline is not null and new.deadline ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}' then
    new.deadline := eflow_schedule.strip_task_due_time(new.deadline);
  end if;
  if new.due_date is not null and new.due_date ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}' then
    new.due_date := eflow_schedule.strip_task_due_time(new.due_date);
  end if;
  return new;
end;
$$;

revoke all on function eflow_schedule.strip_task_due_time(text),
  eflow_schedule.normalize_task_due_date() from public, anon, authenticated;

drop trigger if exists aa_tasks_strip_due_time on public.tasks;
create trigger aa_tasks_strip_due_time
  before insert or update of deadline, due_date on public.tasks
  for each row
  execute function eflow_schedule.normalize_task_due_date();

-- Update phase3_patch_task and edit_selected_project_task to accept calendar dates only
-- (no T23:59:00+08:00 normalization and no past due-time check).
do $migration$
declare
  fn_name text;
  definition text;
  pos_anchor integer;
  pos_due_time integer;
  set_rel integer;
  pos_after_set integer;
  end_rel integer;
  pos_end integer;
  old_block text;
  new_block text := $sql$if p_patch ? 'deadline' and v_due is not null then
   if v_due !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Enter a valid due date.' using errcode='22023';
   end if;
   v_due_day := v_due::date;
   if v_due_day < v_today then raise exception 'Choose today or a future due date.' using errcode='22023'; end if;
   p_patch:=jsonb_set(p_patch,'{deadline}',to_jsonb(v_due));
  end if;$sql$;
begin
  foreach fn_name in array array[
    'public.phase3_patch_task(uuid,jsonb)',
    'eflow_r9.edit_selected_project_task(uuid,jsonb)'
  ]
  loop
    if to_regprocedure(fn_name) is null then
      continue;
    end if;
    select pg_get_functiondef(to_regprocedure(fn_name)) into definition;
    if strpos(definition, 'Choose a due time that has not passed.') = 0
       and strpos(definition, $chk$if v_due !~ '^\d{4}-\d{2}-\d{2}$' then$chk$) > 0 then
      continue;
    end if;

    pos_anchor := strpos(definition, $m$if p_patch ? 'deadline' and v_due is not null then$m$);
    pos_due_time := strpos(definition, 'Choose a due time that has not passed.');
    if pos_anchor = 0 or pos_due_time <= pos_anchor then
      raise exception 'Unexpected deadline validation block in %; review before applying.', fn_name;
    end if;
    set_rel := strpos(substr(definition, pos_due_time), 'to_jsonb(v_due));');
    if set_rel = 0 then
      raise exception 'Missing deadline jsonb_set marker in %; review before applying.', fn_name;
    end if;
    pos_after_set := pos_due_time + set_rel - 1;
    end_rel := strpos(substr(definition, pos_after_set), 'end if;');
    if end_rel = 0 then
      raise exception 'Missing end if marker in %; review before applying.', fn_name;
    end if;
    pos_end := pos_after_set + end_rel - 1 + length('end if;') - 1;
    old_block := substr(definition, pos_anchor, pos_end - pos_anchor + 1);
    execute replace(definition, old_block, new_block);
  end loop;
end
$migration$;

-- Strip due times from all existing tasks (including completed/cancelled/archived/deleted).
-- Schedule-bounds triggers compare calendar dates, which are unchanged; pause them briefly
-- only if present so legacy pre-bounds rows cannot abort the cleanup.
do $cleanup$
declare
  has_project_bounds boolean := exists (
    select 1 from pg_trigger
    where tgrelid = 'public.tasks'::regclass
      and tgname = 'zz_task_project_schedule_bounds'
  );
  has_subtask_bounds boolean := exists (
    select 1 from pg_trigger
    where tgrelid = 'public.tasks'::regclass
      and tgname = 'zz_task_subtask_schedule_bounds'
  );
begin
  if has_project_bounds then
    execute 'alter table public.tasks disable trigger zz_task_project_schedule_bounds';
  end if;
  if has_subtask_bounds then
    execute 'alter table public.tasks disable trigger zz_task_subtask_schedule_bounds';
  end if;

  update public.tasks
  set
    deadline = case
      when deadline ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
        then eflow_schedule.strip_task_due_time(deadline)
      else deadline
    end,
    due_date = case
      when due_date ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
        then eflow_schedule.strip_task_due_time(due_date)
      else due_date
    end
  where deadline ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
     or due_date ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}';

  -- The task update queues deferred constraint triggers. Run their checks
  -- before changing trigger state on public.tasks.
  set constraints all immediate;

  if has_subtask_bounds then
    execute 'alter table public.tasks enable trigger zz_task_subtask_schedule_bounds';
  end if;
  if has_project_bounds then
    execute 'alter table public.tasks enable trigger zz_task_project_schedule_bounds';
  end if;
end
$cleanup$;

-- Strip due times from stored proposal collaboration draft & revision snapshots
-- so revision material-change comparisons stay consistent with date-only tasks.
update public.proposal_collaboration_drafts
set working_snapshot = jsonb_set(
  working_snapshot,
  '{tasks}',
  coalesce((
    select jsonb_agg(
      case
        when elem ? 'deadline' and (elem->>'deadline') ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
          then jsonb_set(elem, '{deadline}', to_jsonb(eflow_schedule.strip_task_due_time(elem->>'deadline')))
        else elem
      end
      order by ord
    )
    from jsonb_array_elements(working_snapshot->'tasks') with ordinality as entries(elem, ord)
  ), '[]'::jsonb)
)
where jsonb_typeof(working_snapshot->'tasks') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(working_snapshot->'tasks') as entries(elem)
    where (elem->>'deadline') ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
  );

update public.proposal_collaboration_revisions
set snapshot = jsonb_set(
  snapshot,
  '{tasks}',
  coalesce((
    select jsonb_agg(
      case
        when elem ? 'deadline' and (elem->>'deadline') ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
          then jsonb_set(elem, '{deadline}', to_jsonb(eflow_schedule.strip_task_due_time(elem->>'deadline')))
        else elem
      end
      order by ord
    )
    from jsonb_array_elements(snapshot->'tasks') with ordinality as entries(elem, ord)
  ), '[]'::jsonb)
)
where jsonb_typeof(snapshot->'tasks') = 'array'
  and exists (
    select 1
    from jsonb_array_elements(snapshot->'tasks') as entries(elem)
    where (elem->>'deadline') ~ '^\d{4}-\d{2}-\d{2}[T ][0-9]{2}:[0-9]{2}'
  );

notify pgrst, 'reload schema';

commit;
