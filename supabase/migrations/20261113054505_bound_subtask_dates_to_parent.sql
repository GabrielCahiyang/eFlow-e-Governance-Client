begin;

-- Keep lifecycle side effects in the existing trigger. Validate the final
-- schedule after that trigger has supplied defaults.
do $migration$
begin
 perform eflow_m7.replace_body_part(
  'eflow_m7.schedule_node()',
  'new.start_date := coalesce(new.start_date,today);',
  'null; -- The default is assigned after the ancestor range is read.');
 perform eflow_m7.replace_body_part(
  'eflow_m7.schedule_node()',
  'if new.start_date is null then return new; end if;',
  'if tg_op=''UPDATE'' and new.start_date is null then return new; end if;');
 perform eflow_m7.replace_body_part(
  'eflow_m7.schedule_node()',
  ' if new.start_date < parent_start or new.start_date > new.due_date then',
  $body$ if tg_op='INSERT' then new.start_date := coalesce(new.start_date,parent_start,today); end if;
 if new.start_date < parent_start or new.start_date > new.due_date then$body$);
end $migration$;

create function eflow_m7.validate_subtask_date_range()
returns trigger language plpgsql security definer set search_path='' as $$
declare earliest date; latest date; ancestor uuid := new.parent_subtask_id; parent record;
 visited uuid[] := array[new.id];
begin
 if tg_op='UPDATE' and row(new.start_date,new.due_date,new.parent_subtask_id)
  is not distinct from row(old.start_date,old.due_date,old.parent_subtask_id) then return new; end if;
 if tg_table_name='subtasks' then
  select t.start_date,coalesce(nullif(left(t.due_date::text,10),''),nullif(left(t.deadline::text,10),''))::date
  into earliest,latest from public.tasks t where t.id=new.task_id;
 end if;
 while ancestor is not null loop
  if ancestor=any(visited) then raise exception 'Parent is unavailable in this work tree' using errcode='23514'; end if;
  visited := array_append(visited,ancestor);
  if tg_table_name='subtasks' then
   select s.start_date,s.due_date,s.parent_subtask_id into parent from public.subtasks s where s.id=ancestor and s.task_id=new.task_id;
  else
   select s.start_date,s.due_date,s.parent_subtask_id into parent from public.personal_subtasks s where s.id=ancestor and s.task_id=new.task_id;
  end if;
  if not found then raise exception 'Parent is unavailable in this work tree' using errcode='23514'; end if;
  earliest := greatest(earliest,parent.start_date);
  latest := least(latest,parent.due_date);
  ancestor := parent.parent_subtask_id;
 end loop;
 if new.start_date < earliest or new.start_date > latest then
  raise exception 'Choose a start date within the parent schedule, or reschedule the parent first' using errcode='22023';
 end if;
 if new.due_date < earliest or new.due_date > latest or new.due_date < new.start_date then
  raise exception 'Choose a due date between the subtask start and the parent deadline' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function eflow_m7.validate_subtask_date_range() from public,anon,authenticated,service_role;
create trigger zzz_m7_subtask_date_range before insert or update of start_date,due_date,parent_subtask_id
 on public.subtasks for each row execute function eflow_m7.validate_subtask_date_range();
create trigger zzz_m7_subtask_date_range before insert or update of start_date,due_date,parent_subtask_id
 on public.personal_subtasks for each row execute function eflow_m7.validate_subtask_date_range();

commit;
