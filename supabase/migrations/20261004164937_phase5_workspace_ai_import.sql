-- Reviewed AI work uses the same project_groups/tasks/subtasks as manual work.
-- This receipt also preserves proposed Office responsibilities without granting
-- access, assigning personnel, or changing the global Office directory.
create table public.project_import_batches (
 id uuid primary key,
 project_id uuid not null references public.projects(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 review jsonb not null check(jsonb_typeof(review)='object'),
 result jsonb not null check(jsonb_typeof(result)='object'),
 created_at timestamptz not null default now()
);
create index project_import_batches_project_idx on public.project_import_batches(project_id,created_at desc);
create index project_import_batches_actor_idx on public.project_import_batches(created_by);
alter table public.project_import_batches enable row level security;
revoke all on public.project_import_batches from anon,authenticated;
grant select,insert on public.project_import_batches to authenticated;
create policy project_import_batches_read on public.project_import_batches for select to authenticated
 using(public.can_see_project(project_id,(select auth.uid())));
create policy project_import_batches_insert on public.project_import_batches for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(select 1 from public.projects p where p.id=project_id
 and p.status not in ('completed','archived') and public.can_create_scoped_work(p.org_id,(select auth.uid()))
 and public.can_manage_project(p.id,(select auth.uid()))));

create function public.phase5_import_project_work(p_project_id uuid,p_request_id uuid,p_review jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 p public.projects; receipt public.project_import_batches; g jsonb; t jsonb; s jsonb; o jsonb; k text;
 group_id uuid; task_row public.tasks; task_id uuid; mappings jsonb:='{}'; group_ids jsonb:='[]';
 task_count integer:=0; sub_count integer:=0; group_count integer:=0; n integer; sub_n integer;
 keys text[]:='{}'; office_keys text[]:='{}'; result jsonb; patch jsonb;
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or auth.uid() is null or not public.can_create_scoped_work(p.org_id,auth.uid()) or not public.can_manage_project(p.id,auth.uid()) then
  raise exception 'Only the responsible Office Head can import project work' using errcode='42501'; end if;
 -- The project lock serializes imports and checks retries before any inserts.
 select * into receipt from public.project_import_batches where id=p_request_id;
 if found then
  if receipt.project_id<>p.id or receipt.created_by<>auth.uid() or receipt.review<>p_review then
   raise exception 'This import reference was already used for another review' using errcode='22023'; end if;
  return receipt.result;
 end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023'; end if;
 if jsonb_typeof(p_review) is distinct from 'object' or p_review->>'schemaVersion' is distinct from '1'
 or jsonb_typeof(p_review->'groups') is distinct from 'array' or jsonb_array_length(p_review->'groups') not between 1 and 30
 or jsonb_typeof(p_review->'offices') is distinct from 'array' or jsonb_array_length(p_review->'offices')>100
 or octet_length(p_review::text)>2000000 then raise exception 'Invalid reviewed project import' using errcode='22023'; end if;
 for o in select value from jsonb_array_elements(p_review->'offices') loop
  if length(btrim(coalesce(o->>'name',''))) not between 1 and 200 or length(coalesce(o->>'evidence','')) not between 1 and 2000
   or o->>'confirmed' is distinct from 'true' or length(coalesce(o->>'key','')) not between 1 and 80 or o->>'key'=any(office_keys) then
   raise exception 'Confirm each source-named Office responsibility before importing' using errcode='22023'; end if;
  if nullif(o->>'officeId','') is not null and not exists(select 1 from public.organizations where id=(o->>'officeId')::uuid) then
   raise exception 'Choose an existing Office or keep the proposed name unmatched' using errcode='22023'; end if;
  office_keys:=array_append(office_keys,o->>'key');
 end loop;
 -- Preflight the complete hierarchy; malformed fields cannot become authority.
 for g in select value from jsonb_array_elements(p_review->'groups') loop
  if length(btrim(coalesce(g->>'title',''))) not between 1 and 120 or jsonb_typeof(g->'tasks') is distinct from 'array'
   or jsonb_array_length(g->'tasks') not between 1 and 100 then raise exception 'Each group needs a title and tasks' using errcode='22023'; end if;
  for t in select value from jsonb_array_elements(g->'tasks') loop
   for k in select jsonb_object_keys(t) loop
    if k not in ('key','title','description','priority','startDate','dueDate','estimatedHours','officeKey','dependencies','subitems','sourceQuote','advisory') then
     raise exception 'Unsupported import task field: %',k using errcode='22023'; end if;
   end loop;
   if length(coalesce(t->>'key','')) not between 1 and 80 or t->>'key'=any(keys)
    or length(btrim(coalesce(t->>'title',''))) not between 1 and 300 or length(coalesce(t->>'description',''))>10000
    or coalesce(t->>'priority','') not in ('low','medium','high') or jsonb_typeof(t->'dependencies') is distinct from 'array'
    or jsonb_array_length(t->'dependencies')>100 or jsonb_typeof(t->'subitems') is distinct from 'array' or jsonb_array_length(t->'subitems')>30
    or coalesce((t->>'estimatedHours')::numeric,-1) not between 0 and 100000
    or (nullif(t->>'officeKey','') is not null and not t->>'officeKey'=any(office_keys)) then
    raise exception 'Invalid reviewed task, effort, or Office responsibility' using errcode='22023'; end if;
   keys:=array_append(keys,t->>'key'); task_count:=task_count+1;
   for s in select value from jsonb_array_elements(t->'subitems') loop
    if length(btrim(coalesce(s->>'title',''))) not between 1 and 300 then raise exception 'Enter a subitem title' using errcode='22023'; end if;
   end loop;
  end loop;
 end loop;
 if task_count>100 then raise exception 'Import up to 100 tasks at once' using errcode='22023'; end if;
 if coalesce((p_review->>'applyProjectDetails')::boolean,false) then
  if length(btrim(coalesce(p_review->'project'->>'title',''))) not between 1 and 300 or length(coalesce(p_review->'project'->>'description',''))>10000 then
   raise exception 'Invalid reviewed project details' using errcode='22023'; end if;
  update public.projects set title=btrim(p_review->'project'->>'title'),
   description=coalesce(p_review->'project'->>'description','')||case when nullif(p_review->'project'->>'objectives','') is not null then E'\n\nObjectives\n'||(p_review->'project'->>'objectives') else '' end,
   start_date=nullif(p_review->'project'->>'startDate','')::date,target_date=nullif(p_review->'project'->>'targetDate','')::date
   where id=p.id returning * into p;
  if p.start_date>p.target_date then raise exception 'Project start must precede target date' using errcode='22023'; end if;
 end if;
 task_count:=0;
 for g in select value from jsonb_array_elements(p_review->'groups') loop
  group_id:=nullif(g->>'existingGroupId','')::uuid;
  if group_id is not null then
   if not exists(select 1 from public.project_groups where id=group_id and project_id=p.id) then raise exception 'Choose a group in this project' using errcode='22023'; end if;
  else
   select coalesce(max(position)+1,0) into n from public.project_groups where project_id=p.id;
   insert into public.project_groups(project_id,title,color,position) values(p.id,btrim(g->>'title'),coalesce(nullif(g->>'color',''),'#579bfc'),n) returning id into group_id;
   group_count:=group_count+1;
  end if;
  group_ids:=group_ids||to_jsonb(group_id::text);
  for t in select value from jsonb_array_elements(g->'tasks') loop
   task_row:=public.phase3_create_task(p.id,group_id,t->>'title'); task_id:=task_row.id;
   update public.tasks set description=coalesce(t->>'description',''),import_batch_id=p_request_id::text,
    recommendation_source='ai_workspace_reviewed',recommendation_reasoning='Human-reviewed project import; people and Office access remain unassigned.' where id=task_id;
   patch:=jsonb_build_object('priority',t->>'priority','start_date',nullif(t->>'startDate',''),'deadline',coalesce(t->>'dueDate',''),'estimated_hours',(t->>'estimatedHours')::numeric);
   perform public.phase3_patch_task(task_id,patch);
   mappings:=mappings||jsonb_build_object(t->>'key',task_id); task_count:=task_count+1; sub_n:=0;
   for s in select value from jsonb_array_elements(t->'subitems') loop
    insert into public.subtasks(task_id,title,source,position,created_by,due_date)
     values(task_id,btrim(s->>'title'),'ai_extracted',sub_n,auth.uid(),nullif(s->>'dueDate','')::date);
    sub_n:=sub_n+1;sub_count:=sub_count+1;
   end loop;
  end loop;
 end loop;
 -- Translate draft keys only after all canonical IDs exist. The Phase 3 guard
 -- verifies project scope and rejects self-dependencies/cycles transactionally.
 for g in select value from jsonb_array_elements(p_review->'groups') loop
  for t in select value from jsonb_array_elements(g->'tasks') loop
   if exists(select 1 from jsonb_array_elements_text(t->'dependencies') d where not mappings ? d.value) then
    raise exception 'A dependency points to an omitted task. Restore it or remove the dependency' using errcode='22023'; end if;
   perform public.phase3_patch_task((mappings->> (t->>'key'))::uuid,jsonb_build_object('dependency_ids',
    coalesce((select jsonb_agg(mappings->>d.value) from jsonb_array_elements_text(t->'dependencies') d),'[]'::jsonb)));
  end loop;
 end loop;
 result:=jsonb_build_object('taskCount',task_count,'subitemCount',sub_count,'groupCount',group_count,'taskIds',mappings,'groupIds',group_ids);
 insert into public.project_import_batches(id,project_id,created_by,review,result) values(p_request_id,p.id,auth.uid(),p_review,result);
 return result;
end; $$;
revoke all on function public.phase5_import_project_work(uuid,uuid,jsonb) from public,anon;
grant execute on function public.phase5_import_project_work(uuid,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
