CREATE OR REPLACE FUNCTION public.phase3_patch_task(p_task_id uuid, p_patch jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare t public.tasks; p public.projects; k text; deps uuid[]; cycle_found boolean; v_today date; v_start date; v_due text; v_due_day date;
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid task changes' using errcode='22023'; end if;
 select * into t from public.tasks where id=p_task_id and deleted_at is null;
 if not found then raise exception 'Task not available' using errcode='42501'; end if;
 select * into p from eflow_phase6.lock_project(t.linked_project_id);
 if not found or not public.can_create_scoped_work(t.org_id,auth.uid()) or not (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid())) or not public.can_manage_task(t.id,auth.uid()) then
  raise exception 'Only the responsible Office Head can edit project structure' using errcode='42501'; end if;
 -- Serialize dependency edits and re-read after the project lock.
 select * into t from public.tasks where id=p_task_id for update;
 if p.status in ('completed','archived') or t.archived_at is not null or t.status in ('completed','cancelled') then raise exception 'Completed or archived work is read-only' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('title','priority','deadline','start_date','estimated_hours','budget_impact','dependency_ids','group_id','workspace_position') then raise exception 'Protected task field: %',k using errcode='22023'; end if;
 end loop;
 if p_patch ? 'title' and (length(btrim(coalesce(p_patch->>'title',''))) not between 1 and 300) then raise exception 'Enter a task title (up to 300 characters)' using errcode='22023'; end if;
 if p_patch ? 'priority' and coalesce(p_patch->>'priority','') not in ('low','medium','high') then raise exception 'Invalid priority' using errcode='22023'; end if;
 if p_patch ? 'estimated_hours' and (coalesce((p_patch->>'estimated_hours')::numeric,0)<0 or coalesce((p_patch->>'estimated_hours')::numeric,0)>100000) then raise exception 'Effort must be between 0 and 100000 hours' using errcode='22023'; end if;
 if p_patch ? 'budget_impact' and (coalesce((p_patch->>'budget_impact')::numeric,0)<0 or coalesce((p_patch->>'budget_impact')::numeric,0)>1000000000000) then raise exception 'Invalid budget estimate' using errcode='22023'; end if;
 if p_patch ? 'dependency_ids' then
  if jsonb_typeof(p_patch->'dependency_ids')<>'array' or jsonb_array_length(p_patch->'dependency_ids')>100 then raise exception 'Invalid dependency list' using errcode='22023'; end if;
  select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into deps from jsonb_array_elements_text(p_patch->'dependency_ids');
  if exists(select 1 from unnest(deps) d where d=t.id or not exists(select 1 from public.tasks x where x.id=d and x.linked_project_id=p.id and x.deleted_at is null)) then raise exception 'Dependencies must be other available tasks in this project' using errcode='22023'; end if;
  with recursive edges(id,path) as (
   select d,array[d] from unnest(deps) d union all
   select d,e.path||d from edges e join public.tasks x on x.id=e.id cross join lateral unnest(x.dependency_ids) d where not d=any(e.path)
  ) select exists(select 1 from edges where id=t.id) into cycle_found;
  if cycle_found then raise exception 'Dependencies cannot form a cycle' using errcode='22023'; end if;
 end if;
 if p_patch ? 'deadline' or p_patch ? 'start_date' then
  v_today := (clock_timestamp() at time zone 'Asia/Manila')::date;
  v_start := case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else t.start_date end;
  v_due := case when p_patch ? 'deadline' then nullif(p_patch->>'deadline','') else nullif(t.deadline,'') end;
  if p_patch ? 'deadline' and v_due is not null then
   if v_due !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$' then
    raise exception 'Enter a valid due date and time.' using errcode='22023';
   end if;
   v_due_day := left(v_due,10)::date;
   if v_due_day < v_today then raise exception 'Choose today or a future due date.' using errcode='22023';end if;
   if length(v_due)=10 then v_due:=v_due||'T23:59:00+08:00';
   elsif v_due !~ '(Z|[+-]\d{2}:\d{2})$' then v_due:=v_due||'+08:00';end if;
   if v_due::timestamptz < date_trunc('minute',clock_timestamp()) then
    raise exception 'Choose a due time that has not passed.' using errcode='22023';
   end if;
   p_patch:=jsonb_set(p_patch,'{deadline}',to_jsonb(v_due));
  end if;
  if v_start is not null and v_start is distinct from t.start_date and v_start < v_today then
   raise exception 'Choose today or a future start date.' using errcode='22023';
  end if;
  if v_start is not null and v_due is not null and v_start > left(v_due,10)::date then
   raise exception 'Due date cannot be before the start date.' using errcode='22023';
  end if;
 end if;
 update public.tasks set
  title=case when p_patch ? 'title' then btrim(p_patch->>'title') else title end,
  priority=case when p_patch ? 'priority' then p_patch->>'priority' else priority end,
  deadline=case when p_patch ? 'deadline' then coalesce(p_patch->>'deadline','') else deadline end,
  due_date=case when p_patch ? 'deadline' then coalesce(p_patch->>'deadline','') else due_date end,
  start_date=case when p_patch ? 'start_date' then nullif(p_patch->>'start_date','')::date else start_date end,
  estimated_hours=case when p_patch ? 'estimated_hours' then coalesce((p_patch->>'estimated_hours')::double precision,0) else estimated_hours end,
  budget_impact=case when p_patch ? 'budget_impact' then coalesce((p_patch->>'budget_impact')::double precision,0) else budget_impact end,
  dependency_ids=case when p_patch ? 'dependency_ids' then deps else dependency_ids end,
  group_id=case when p_patch ? 'group_id' then (p_patch->>'group_id')::uuid else group_id end,
  workspace_position=case when p_patch ? 'workspace_position' then (p_patch->>'workspace_position')::integer else workspace_position end
 where id=t.id returning * into t;
 if t.start_date is not null and nullif(t.deadline,'') is not null and t.start_date>left(t.deadline,10)::date then raise exception 'Start date must precede the due date' using errcode='22023'; end if;
 return t;
end; $function$

