-- REVIEW ONLY. NOT APPLIED. Stage and obtain explicit production approval first.
-- Generated from read-only production definitions, 2026-11-16. No data backfill.
-- Existing contributor, approval, financial, schedule and operation-impact checks remain in place.
begin;
do $preflight$
declare dependency record;
begin
 if to_regnamespace('eflow_work_edit') is not null then raise exception 'Editing review schema already exists. Stop for review.';end if;
 for dependency in select * from (values
    ('eflow_r7.snapshot(uuid)','8473a0ab76721d978090fc872e5fe7b1'),
    ('eflow_r7.require_operation(uuid,text,jsonb)','bcec4130833268f35b9093f6193f474d'),
    ('public.phase3_patch_task(uuid,jsonb)','200f58122e6d7d68663aaf3f47843f0c'),
    ('eflow_r7.operation_capabilities(uuid,uuid)','00eba07c731ce6a20bb6428d71656891'),
    ('eflow_r7.command(uuid,integer,uuid,text,jsonb)','0c7216db9315c0bcfa59dce145a00bb3'),
    ('eflow_r9.edit_selected_project_task(uuid,jsonb)','6b6dafd50733a793b260f110bd6cb161'),
    ('public.edit_selected_project_task(uuid,jsonb)','e70ae6fb2b9b3cdbed35d6f557e659bb'),
    ('eflow_phase7.material_change()','eee6cc7f45ab70f69cc9a22609f41756'),
    ('eflow_r7.operation_impact(uuid,text,jsonb)','c23ebb3feeacdab33427c81ef8fa1ce4'),
    ('eflow_r7.lock_impact(uuid)','59fde7c2998f32b10aa53b121f65f9a6'),
    ('eflow_m7.with_schedule(jsonb)','3211ede24cd504aee8fa6ae516191200'),
    ('eflow_m7.node_visible(uuid,uuid,uuid)','b8c00cf1a53cc50577d56f040d302d38'),
    ('eflow_r9.record_project_field_history()','d42a933955e3281d03e77c69b6eeb7dd'),
    ('public.guard_subtask_mutation()','d59366c3485b00244f19e77d6f7046dc'),
    ('public.guard_subtask_due_date_update()','b303f29693ab91638e1c0210be021669'),
    ('eflow_r7.guard_operation_write()','c959c69b53ff80df45a954f4cb45f071'),
    ('eflow_schedule.guard_task()','ee25d67a0e463a7f31340636d5d055b3'),
    ('eflow_r7.guard_node()','bc5f455443e04f096d8211a42aa31c9b'),
    ('eflow_publication.manage_plan(uuid,uuid,boolean)','f5ecbcfe9b309ab7c26734d2baec21a4'),
    ('eflow_schedule.guard_web_subtask_plan()','ea56e294ed73a6a5e83252b06c4fd742')
 ) as reviewed(signature,hash) loop
  if to_regprocedure(dependency.signature) is null or md5(pg_get_functiondef(to_regprocedure(dependency.signature)))<>dependency.hash then
   raise exception 'Editing prerequisite differs: %. Stop for review.',dependency.signature;
  end if;
 end loop;
end $preflight$;

-- Included by the REVIEW generator. Do not execute this fragment independently.
create schema eflow_work_edit;
revoke all on schema eflow_work_edit from public,anon,authenticated;

create function eflow_work_edit.dependency_value(p_value jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p_value)='array' then
  (select coalesce(jsonb_agg(v order by v),'[]'::jsonb) from (select distinct value v from jsonb_array_elements(p_value)) ids)
  else p_value end;
$$;

create function eflow_work_edit.task_started(p_task uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=p_task and
   (t.status not in ('todo','pending_assignment') or coalesce(t.percent_complete,0)<>0))
 or exists(select 1 from public.task_status_history h where h.task_id=p_task
   and h.to_status in ('in_progress','for_review','changes_requested','completed'))
 or exists(select 1 from public.subtasks s where s.task_id=p_task and
   (s.started_at is not null or s.status<>'todo' or coalesce(s.percent_complete,0)<>0));
$$;

create function eflow_work_edit.node_started(p_task uuid,p_node uuid) returns boolean
language sql stable security definer set search_path='' as $$
 with recursive branch as (
  select s.* from public.subtasks s where s.task_id=p_task and s.id=p_node
  union all select s.* from public.subtasks s join branch b on s.parent_subtask_id=b.id where s.task_id=p_task
 ) select exists(select 1 from branch b where b.started_at is not null or b.status<>'todo' or coalesce(b.percent_complete,0)<>0
  or exists(select 1 from public.subtask_progress_updates u where u.subtask_id=b.id)
  or exists(select 1 from public.subtask_submissions u where u.subtask_id=b.id));
$$;

create function eflow_work_edit.state(p_task uuid,p_node uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare t public.tasks; n public.subtasks; p public.projects; can_details boolean:=false;
 can_due boolean:=false; started boolean; live boolean; r jsonb;
begin
 if auth.uid() is null or not coalesce(eflow_r7.read_root(p_task),false) then
  raise exception 'Current work access required' using errcode='42501';end if;
 select * into t from public.tasks where id=p_task and deleted_at is null;
 if not found then raise exception 'Task not available' using errcode='42501';end if;
 select * into p from public.projects where id=t.linked_project_id;
 live:=coalesce(p.id is not null and p.status not in ('completed','archived') and t.archived_at is null
   and t.status not in ('for_review','completed','cancelled') and eflow_r3.eligible(auth.uid()),false);
 if p_node is null then
  started:=eflow_work_edit.task_started(p_task);
  can_due:=live and coalesce(eflow_publication.planning_lead(p.id,t.org_id) or
   (public.can_create_scoped_work(t.org_id,auth.uid()) and
    (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid()))
    and public.can_manage_task(t.id,auth.uid())),false);
  can_details:=can_due or (live and t.proposed_office_identity_id is null
    and coalesce(eflow_r9.can_edit_selected_project(p.id,t.org_id,auth.uid()),false));
 else
  if not coalesce(eflow_m7.node_visible(p_task,p_node,auth.uid()),false) then
   raise exception 'Subtask not available' using errcode='42501';end if;
  select * into n from public.subtasks where id=p_node and task_id=p_task;
  if not found then raise exception 'Subtask not available' using errcode='42501';end if;
  r:=eflow_r7.root(p_task);
  live:=live and coalesce((r->>'open')::boolean,false) and n.status in ('todo','in_progress','changes_requested');
  started:=eflow_work_edit.node_started(p_task,p_node);
  can_details:=live and coalesce(eflow_publication.manage_plan(p_task,p_node),false);
  -- Replacement authority denotes the supervising branch, not the worker's contributor permission.
  can_due:=can_details and coalesce(eflow_publication.manage_plan(p_task,p_node,true),false);
 end if;
 return jsonb_build_object('version',1,'task_id',p_task,'node_id',p_node,'updated_at',t.updated_at,
   'started',started,'details',can_details,'due',can_details and (not started or can_due),
   'planning',can_details and not started);
end $$;

create function public.work_detail_edit_state(p_task_id uuid,p_node_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select eflow_work_edit.state(p_task_id,p_node_id);
$$;

create function eflow_work_edit.check_subtask_edit(p_task uuid,p_node uuid,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare n public.subtasks; policy jsonb; planning_changed boolean; due_changed boolean;
begin
 select * into n from public.subtasks where id=p_node and task_id=p_task;
 if not found then raise exception 'Subtask not available' using errcode='42501';end if;
 policy:=eflow_work_edit.state(p_task,p_node);
 if not coalesce((policy->>'details')::boolean,false) then
  raise exception 'Work details are read-only. Refresh the work or use its existing review or reopen action.' using errcode='42501';end if;
 planning_changed:=(p_payload ? 'start' and (p_payload->>'start')::date is distinct from n.start_date)
  or (p_payload ? 'standalone' and (p_payload->>'standalone')::boolean is distinct from n.is_standalone)
  or (p_payload ? 'dependency_ids' and
   array(select value::uuid from jsonb_array_elements_text(p_payload->'dependency_ids') order by value)
   is distinct from case when n.dependency_ids is null then null else array(select x from unnest(n.dependency_ids) x order by x) end);
 if planning_changed and not (policy->>'planning')::boolean then
  raise exception 'Start date, prerequisites and structure cannot change after work has started.' using errcode='22023';end if;
 due_changed:=(p_payload->>'due')::date is distinct from n.due_date;
 if due_changed and not (policy->>'due')::boolean then
  raise exception 'Only the supervising Lead or authorized Office Head can reschedule this work.' using errcode='42501';end if;
 if due_changed and (policy->>'started')::boolean and nullif(btrim(p_payload->>'note'),'') is null then
  raise exception 'Enter a reason for changing the due date.' using errcode='22023';end if;
 if length(coalesce(p_payload->>'note',''))>1000 then
  raise exception 'Keep the schedule change reason within 1,000 characters.' using errcode='22023';end if;
end $$;

-- All UPDATE routes, including old Web forms and direct table writes, receive the same guard.
-- This only concerns definition fields. Staffing, execution, evidence and approval retain their own guards.
create function eflow_work_edit.guard_details() returns trigger
language plpgsql security definer set search_path='' as $$
declare a jsonb; b jsonb; relevant text[]; locked text[]; policy jsonb; key text;
 is_task boolean:=tg_table_name='tasks'; reason text; due_changed boolean; root_id uuid;
begin
 if tg_op='DELETE' then
  if eflow_work_edit.node_started(old.task_id,old.id) then
   raise exception 'Started work and its history cannot be deleted.' using errcode='22023';end if;
  return old;
 end if;
 a:=to_jsonb(old);b:=to_jsonb(new);root_id:=case when is_task then old.id else (a->>'task_id')::uuid end;
 if a ? 'dependency_ids' then a:=jsonb_set(a,'{dependency_ids}',eflow_work_edit.dependency_value(a->'dependency_ids'));end if;
 if b ? 'dependency_ids' then b:=jsonb_set(b,'{dependency_ids}',eflow_work_edit.dependency_value(b->'dependency_ids'));end if;
 if is_task and a->>'deleted_at' is null and b->>'deleted_at' is not null
  and eflow_work_edit.task_started(root_id) then
  raise exception 'Started work and its history cannot be deleted.' using errcode='22023';end if;
 relevant:=case when is_task then array['title','description','priority','deadline','due_date','start_date','dependency_ids',
  'acceptance_criteria','definition_of_done','estimated_hours','budget_impact','group_id','workspace_position','linked_project_id','org_id']
  else array['title','priority','due_date','start_date','dependency_ids','is_standalone','parent_subtask_id','sibling_order','task_id'] end;
 if not exists(select 1 from unnest(relevant) f where a->f is distinct from b->f) then return new;end if;
 -- Preserve private project-deletion detachment, with its existing exact predicate.
 if is_task and eflow_phase6.project_deletion_detach(a,b) then return new;end if;
 -- Legacy non-project work retains its existing contracts and guards.
 if eflow_r7.root(root_id) is null then return new;end if;
 if b->>'status' in ('for_review','completed','cancelled') then
  raise exception 'Work details are read-only during review or after completion.' using errcode='22023';end if;
 policy:=eflow_work_edit.state(root_id,case when is_task then null else old.id end);
 if not coalesce((policy->>'details')::boolean,false) then
  raise exception 'Work details are read-only. Refresh the work or use its existing review or reopen action.' using errcode='42501';end if;
 locked:=case when is_task then array['description','start_date','dependency_ids','estimated_hours','budget_impact',
  'acceptance_criteria','definition_of_done','group_id','workspace_position','linked_project_id','org_id']
  else array['start_date','dependency_ids','is_standalone','parent_subtask_id','sibling_order','task_id'] end;
 if not (policy->>'planning')::boolean and exists(select 1 from unnest(locked) f where a->f is distinct from b->f) then
  raise exception 'Start date, prerequisites and structure cannot change after work has started.' using errcode='22023';end if;
 due_changed:=a->'due_date' is distinct from b->'due_date' or (is_task and a->'deadline' is distinct from b->'deadline');
 if due_changed and not (policy->>'due')::boolean then
  raise exception 'Only the supervising Lead or authorized Office Head can reschedule this work.' using errcode='42501';end if;
 reason:=case when is_task then current_setting('eflow.work_detail_change_reason',true) else b->>'due_date_change_reason' end;
 if due_changed and (policy->>'started')::boolean and nullif(btrim(reason),'') is null then
  raise exception 'Enter a reason for changing the due date.' using errcode='22023';end if;
 if due_changed and length(coalesce(reason,''))>1000 then
  raise exception 'Keep the schedule change reason within 1,000 characters.' using errcode='22023';end if;
 return new;
end $$;
create trigger zz_work_detail_policy before update on public.tasks for each row execute function eflow_work_edit.guard_details();
create trigger zz_work_detail_policy before update or delete on public.subtasks for each row execute function eflow_work_edit.guard_details();

create function eflow_work_edit.display(p_key text,p_value jsonb) returns text
language plpgsql stable security definer set search_path='' as $$
declare result text;
begin
 if p_value is null or p_value='null'::jsonb or p_value='""'::jsonb then return 'None';end if;
 if p_key in ('dependency_ids','team_member_ids') and jsonb_typeof(p_value)='array' then
  select string_agg(case when p_key='dependency_ids' then
    coalesce((select title from public.tasks where id=x.value::uuid),'Historical prerequisite unavailable')
   else coalesce((select full_name from public.profiles where id=x.value::uuid),'Historical name unavailable') end,', ' order by x.ordinality)
   into result from jsonb_array_elements_text(p_value) with ordinality x(value,ordinality);
  return coalesce(result,'None');
 elsif p_key in ('assigned_to','reviewer_id') then
  return coalesce((select full_name from public.profiles where id=(p_value#>>'{}')::uuid),'Historical name unavailable');
 elsif p_key='group_id' then
  return coalesce((select title from public.project_groups where id=(p_value#>>'{}')::uuid),'Historical group unavailable');
 end if;
 return coalesce(p_value#>>'{}','None');
end $$;

create function eflow_work_edit.record_task_details() returns trigger
language plpgsql security definer set search_path='' as $$
declare a jsonb:=to_jsonb(old);b jsonb:=to_jsonb(new);fields jsonb;reason text;
begin
 if a ? 'dependency_ids' then a:=jsonb_set(a,'{dependency_ids}',eflow_work_edit.dependency_value(a->'dependency_ids'));end if;
 if b ? 'dependency_ids' then b:=jsonb_set(b,'{dependency_ids}',eflow_work_edit.dependency_value(b->'dependency_ids'));end if;
 -- Canonical worker arrays may retain the Lead for compatibility; Activity shows contributors only.
 if jsonb_typeof(a->'team_member_ids')='array' then
  a:=jsonb_set(a,'{team_member_ids}',coalesce((select jsonb_agg(v order by v) from jsonb_array_elements(a->'team_member_ids') x(v) where v is distinct from a->'assigned_to'),'[]'::jsonb));end if;
 if jsonb_typeof(b->'team_member_ids')='array' then
  b:=jsonb_set(b,'{team_member_ids}',coalesce((select jsonb_agg(v order by v) from jsonb_array_elements(b->'team_member_ids') x(v) where v is distinct from b->'assigned_to'),'[]'::jsonb));end if;
 select jsonb_agg(jsonb_build_object('key',f.key,'label',f.label,
  'before',eflow_work_edit.display(f.key,a->f.key),'after',eflow_work_edit.display(f.key,b->f.key)) order by f.position)
 into fields from (values ('title','Title',1),('description','Description',2),('priority','Priority',3),
  ('start_date','Start date',4),('deadline','Due date',5),('dependency_ids','Prerequisites',6),
  ('estimated_hours','Estimated hours',7),('budget_impact','Budget estimate',8),('group_id','Group',9),
  ('workspace_position','Position',10),('assigned_to','Lead',11),('team_member_ids','Contributors',12),
  ('reviewer_id','Reviewer',13),('acceptance_criteria','Acceptance criteria',14),
  ('definition_of_done','Definition of done',15),('due_date','Due date (stored compatibility value)',16)) f(key,label,position)
 where a->f.key is distinct from b->f.key
  and (f.key<>'due_date' or a->'deadline' is not distinct from b->'deadline'
    or a->'deadline' is distinct from a->'due_date' or b->'deadline' is distinct from b->'due_date')
  and not (f.key in ('assigned_to','team_member_ids') and coalesce(eflow_r7.internal(new.id),false));
 if fields is null then return new;end if;
 if a->'deadline' is distinct from b->'deadline' or a->'due_date' is distinct from b->'due_date' then
  reason:=nullif(btrim(current_setting('eflow.work_detail_change_reason',true)),'');end if;
 insert into public.task_activities(task_id,actor_id,actor_name,type,content,metadata)
 values(new.id,auth.uid(),coalesce((select full_name from public.profiles where id=auth.uid()),'System'),
  'work_details_edited',(select string_agg(x->>'label'||': '||(x->>'before')||' → '||(x->>'after'),E'\n') from jsonb_array_elements(fields) x),
  jsonb_build_object('version',1,'fields',fields,'reason',reason));
 return new;
end $$;
create trigger work_detail_activity after update on public.tasks for each row execute function eflow_work_edit.record_task_details();

do $patch$
begin
 -- Exact hash preflight above; the complete reviewed replacement preserves the rest of the function.
 execute $definition$CREATE OR REPLACE FUNCTION public.phase3_patch_task(p_task_id uuid, p_patch jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tasks; p public.projects; k text; deps uuid[]; cycle_found boolean; v_today date; v_start date; v_due text; v_due_day date;
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid task changes' using errcode='22023'; end if;
 select * into t from public.tasks where id=p_task_id and deleted_at is null;
 if not found then raise exception 'Task not available' using errcode='42501'; end if;
 if eflow_publication.planning_lead(t.linked_project_id,t.org_id) then
   select * into p from public.projects where id=t.linked_project_id for update;
   else select * into p from eflow_phase6.lock_project(t.linked_project_id); end if;
 if p.id is null or not coalesce(eflow_publication.planning_lead(p.id,t.org_id) or (public.can_create_scoped_work(t.org_id,auth.uid()) and (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid())) and public.can_manage_task(t.id,auth.uid())),false) then
  raise exception 'Only the responsible Office Head can edit project structure' using errcode='42501'; end if;
 -- Serialize dependency edits and re-read after the project lock.
 select * into t from public.tasks where id=p_task_id for update;
 if p.status in ('completed','archived') or t.archived_at is not null or t.status in ('completed','cancelled') then raise exception 'Completed or archived work is read-only' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('title','priority','deadline','start_date','estimated_hours','budget_impact','dependency_ids','group_id','workspace_position','change_reason') then raise exception 'Protected task field: %',k using errcode='22023'; end if;
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
   if v_due !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Enter a valid due date.' using errcode='22023';
   end if;
   v_due_day := v_due::date;
   if v_due_day < v_today then raise exception 'Choose today or a future due date.' using errcode='22023'; end if;
   p_patch:=jsonb_set(p_patch,'{deadline}',to_jsonb(v_due));
  end if;
  if v_start is not null and v_start is distinct from t.start_date and v_start < v_today then
   raise exception 'Choose today or a future start date.' using errcode='22023';
  end if;
  if v_start is not null and v_due is not null and v_start > left(v_due,10)::date then
   raise exception 'Due date cannot be before the start date.' using errcode='22023';
  end if;
 end if;
 perform set_config('eflow.work_detail_change_reason',coalesce(p_patch->>'change_reason',''),true);
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
 perform set_config('eflow.work_detail_change_reason','',true);
 if t.start_date is not null and nullif(t.deadline,'') is not null and t.start_date>left(t.deadline,10)::date then raise exception 'Start date must precede the due date' using errcode='22023'; end if;
 return t;
end; $function$
$definition$;
end $patch$;

do $patch$
begin
 -- Exact hash preflight above; the complete reviewed replacement preserves the rest of the function.
 execute $definition$CREATE OR REPLACE FUNCTION eflow_r9.edit_selected_project_task(p_task_id uuid, p_patch jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tasks; p public.projects; k text; deps uuid[]; cycle_found boolean; v_today date; v_start date; v_due text; v_due_day date;
begin
 if jsonb_typeof(p_patch)<>'object' then raise exception 'Invalid task changes' using errcode='22023'; end if;
 select * into t from public.tasks where id=p_task_id and deleted_at is null;
 if not found then raise exception 'Task not available' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||t.linked_project_id::text,0));
     select * into p from public.projects where id=t.linked_project_id for update;
 if not found or t.proposed_office_identity_id is not null or not coalesce(eflow_r9.can_edit_selected_project(p.id,t.org_id,auth.uid()),false) then
  raise exception 'Editing access for this project task is required.' using errcode='42501'; end if;
 -- Serialize dependency edits and re-read after the project lock.
 select * into t from public.tasks x where x.id=p_task_id and x.linked_project_id=p.id
      and x.org_id=t.org_id and x.proposed_office_identity_id is null and x.deleted_at is null for update;
     if not found then raise exception 'Task access changed. Reopen the project.' using errcode='42501'; end if;
 if p.status in ('completed','archived') or t.archived_at is not null or t.status in ('for_review','completed','cancelled') then raise exception 'Completed or archived work is read-only' using errcode='22023'; end if;
 for k in select jsonb_object_keys(p_patch) loop
  if k not in ('title','priority','deadline','start_date','estimated_hours','change_reason') then raise exception 'Protected task field: %',k using errcode='22023'; end if;
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
   if v_due !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Enter a valid due date.' using errcode='22023';
   end if;
   v_due_day := v_due::date;
   if v_due_day < v_today then raise exception 'Choose today or a future due date.' using errcode='22023'; end if;
   p_patch:=jsonb_set(p_patch,'{deadline}',to_jsonb(v_due));
  end if;
  if v_start is not null and v_start is distinct from t.start_date and v_start < v_today then
   raise exception 'Choose today or a future start date.' using errcode='22023';
  end if;
  if v_start is not null and v_due is not null and v_start > left(v_due,10)::date then
   raise exception 'Due date cannot be before the start date.' using errcode='22023';
  end if;
 end if;
 perform set_config('eflow.work_detail_change_reason',coalesce(p_patch->>'change_reason',''),true);
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
 perform set_config('eflow.work_detail_change_reason','',true);
 if t.start_date is not null and nullif(t.deadline,'') is not null and t.start_date>left(t.deadline,10)::date then raise exception 'Start date must precede the due date' using errcode='22023'; end if;
 return t;
end; $function$
$definition$;
end $patch$;

do $patch$
begin
 -- Exact hash preflight above; the complete reviewed replacement preserves the rest of the function.
 execute $definition$CREATE OR REPLACE FUNCTION eflow_r7.operation_capabilities(p_root uuid, p_node uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare

 r jsonb := eflow_r7.root(p_root);

 n eflow_r7.nodes;

 actions text[] := case when p_node is null then

  array['manage_contributors','appoint_lead','create_child','order_children'] else

  array['manage_contributors','appoint_lead','create_child','edit_details','move','order_children','delete','execute','submit','review'] end;

 action text;

 reason text;

 common_reason text;

 result jsonb := '{}';

 manager boolean;

 untouched boolean;

 descendants_complete boolean;

 ordered_ready boolean;

 node_depth integer;

begin

 -- Do not disclose row state through the private projector to an unavailable

 -- actor/scope. Snapshot retains its existing read exception.

 if r is null or auth.uid() is null or not coalesce(eflow_r7.read_root(p_root),false) then

  common_reason := 'access_unavailable';

 elsif not coalesce(eflow_r3.eligible(auth.uid()),false) then

  common_reason := 'read_only';

 elsif not coalesce((r->>'open')::boolean,false) then

  common_reason := 'lifecycle_blocked';

 end if;

 if p_node is not null then

  select * into n from eflow_r7.nodes where id=p_node and task_id=p_root;

  if not found then common_reason := 'access_unavailable'; end if;

 end if;

 if common_reason is null then

  manager := coalesce(eflow_r7.manage(p_root,p_node),false);

  if p_node is not null then

   with recursive below as (

    select * from eflow_r7.nodes where id=p_node and task_id=p_root

    union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root

   ) select not exists(select 1 from below where status<>'todo' or percent_complete<>0),

    not exists(select 1 from below where id<>p_node and status<>'completed')

    into untouched,descendants_complete;

   with recursive above as (

    select id,parent_subtask_id,1 depth from eflow_r7.nodes where id=p_node and task_id=p_root

    union all select c.id,c.parent_subtask_id,a.depth+1 from eflow_r7.nodes c join above a on c.id=a.parent_subtask_id where c.task_id=p_root and a.depth<8

   ) select max(depth) into node_depth from above;

   ordered_ready := n.is_standalone or not exists(select 1 from eflow_r7.nodes c

    where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id

    and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed');
   if r->>'kind'='office' and exists(
     select 1 from public.subtasks s where s.id=p_node and s.task_id=p_root and s.dependency_ids is not null
   ) then
    ordered_ready := eflow_r7.subtask_dependencies_ready(p_root,(select s.dependency_ids from public.subtasks s where s.id=p_node));
   end if;

  end if;

 end if;

 foreach action in array actions loop

  reason := common_reason;

  if reason is null then

   if p_node is not null and action in ('appoint_lead','manage_contributors')
     and eflow_publication.subtask_staffing_locked(p_root)
     and (r->>'lead')::uuid is distinct from auth.uid()
     and (action='appoint_lead' or n.lead_id is distinct from auth.uid()) then reason:='active_subtask_staffing_locked';
   elsif action='appoint_lead' then

    if not coalesce(case when p_node is null then (eflow_r7.head(p_root) or (r->>'kind'='office' and eflow_publication.planning_lead((r->>'project')::uuid,(r->>'office')::uuid)))

     else eflow_publication.manage_plan(p_root,p_node,true) end,false) then reason := 'appointment_denied';

    elsif p_node is not null and n.status='completed' then reason := 'lifecycle_blocked'; end if;

   elsif action in ('execute','submit') and r->>'kind'='office' and exists (
    select 1 from public.projects where id=(r->>'project')::uuid and status in ('planning','on_hold')
   ) then
    select case when status='on_hold' then 'project_on_hold' else 'lifecycle_blocked' end into reason
     from public.projects where id=(r->>'project')::uuid;
   elsif action in ('execute','submit') then
    if not coalesce(manager,false) and (action='submit' or not coalesce(eflow_r7.node_work(p_node,auth.uid()),false)) then reason:='branch_denied';
    elsif n.status='completed' or r->>'kind'='office' and r->>'status' not in ('todo','in_progress','changes_requested') then reason:='lifecycle_blocked';
    elsif not ordered_ready or action='submit' and not descendants_complete then reason:='lifecycle_blocked';end if;
   elsif action='review' then
    reason:='lifecycle_blocked'; -- Subitems complete directly; final task retains its review.
   elsif action = 'manage_contributors' and p_node is null and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then reason := 'active_staffing_locked'; elsif not eflow_publication.manage_plan(p_root,p_node) then reason := 'branch_denied';

   elsif action='manage_contributors' then

    if p_node is null and r->>'kind'<>'office' then reason := 'read_only';

    elsif p_node is null and r->>'lead' is null or p_node is not null and (n.lead_id is null or n.status='completed') then reason := 'lifecycle_blocked'; end if;

   elsif action='create_child' then

    if p_node is not null and (n.status<>'todo' or n.percent_complete<>0 or node_depth>=8) then reason := 'lifecycle_blocked'; end if;

   elsif action='order_children' then

    -- This is parent:p_node, including parent:null for root direct children.

    if exists(select 1 from eflow_r7.nodes c where c.task_id=p_root

     and c.parent_subtask_id is not distinct from p_node and (c.status<>'todo' or c.percent_complete<>0)) then reason := 'lifecycle_blocked'; end if;

   elsif action='edit_details' and r->>'kind'='office' then
    if not coalesce((eflow_work_edit.state(p_root,p_node)->>'details')::boolean,false) then reason:='lifecycle_blocked';end if;
   elsif action in ('edit_details','move','delete') then

    if not untouched then reason := 'lifecycle_blocked';

    elsif action='delete' and r->>'kind'='office' and exists(

     with recursive below as (select id from eflow_r7.nodes where id=p_node and task_id=p_root

      union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id where c.task_id=p_root)

     select 1 from below b where

      exists(select 1 from public.subtask_progress_updates where subtask_id=b.id) or

      exists(select 1 from public.subtask_submissions where subtask_id=b.id) or

      exists(select 1 from public.work_budget_allocations where subtask_id=b.id) or

      exists(select 1 from public.petty_cash_requests where subtask_id=b.id) or

      exists(select 1 from public.budget_ledger_entries where subtask_id=b.id)

    ) then reason := 'history_blocked'; end if;

   end if;

  end if;

  if reason is null and p_node is not null and action in ('execute','submit') and
   not (case when r->>'kind'='office' then eflow_m7.node_activated(p_root,p_node)
             else eflow_m7.personal_node_activated(p_root,p_node) end)
  then reason := 'lifecycle_blocked'; end if;

  /* NW5.1 history capability */

  if reason is null and action in ('create_child','order_children','move','delete') then

   if not (eflow_r7.operation_impact(p_root,case action when 'create_child' then 'create' when 'order_children' then 'order' else action end,

    case when action in ('create_child','order_children') then jsonb_build_object('parent',p_node) else jsonb_build_object('id',p_node,'parent',n.parent_subtask_id) end)->>'allowed')::boolean then reason:='history_blocked';end if;

  end if;

 result := result || jsonb_build_object(action,jsonb_build_object('allowed',reason is null,'reason_code',reason));

 end loop;

 return result;

end $function$
$definition$;
end $patch$;

do $patch$
begin
 -- Exact hash preflight above; the complete reviewed replacement preserves the rest of the function.
 execute $definition$CREATE OR REPLACE FUNCTION eflow_r7.command(p_root uuid, p_revision integer, p_request uuid, p_command text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;n eflow_r7.nodes;parent eflow_r7.nodes;v_id uuid:=(p_payload->>'id')::uuid;v_parent uuid:=(p_payload->>'parent')::uuid;v_lead uuid:=(p_payload->>'lead')::uuid;
 v_people uuid[];v_order uuid[];v_subtree uuid[];v_uid uuid;v_receipt eflow_r7.receipts;v_before jsonb;v_result jsonb;v_terms jsonb;v_kind text;v_position int;v_due date;v_previous_status_write text;begin /* NW5.2 shared writer lock */ perform eflow_r3.actor(); if not coalesce(eflow_r7.read_root(p_root),false) then raise exception 'Work access denied' using errcode='42501';end if; perform eflow_r7.lock_impact(p_root);
 perform eflow_r3.actor();
 if p_request is null then raise exception 'Request identity required';end if;
 r:=eflow_r7.root(p_root);v_kind:=r->>'kind';
 if not eflow_r7.read_root(p_root) then raise exception 'Work access denied' using errcode='42501';end if;
 perform 1 from public.projects where id=(r->>'project')::uuid for update;
 perform 1 from public.personal_projects where id=(r->>'project')::uuid for update;
 /* NW4.2 completion serialization */ perform eflow_r7.lock_completion(p_root); perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 r:=eflow_r7.root(p_root);
 v_terms:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into v_receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if v_receipt.root_id<>p_root or v_receipt.payload<>v_terms then raise exception 'Request terms conflict';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 if v_kind='office' and (
  (p_command<>'create' and v_id is not null and not eflow_m7.node_visible(p_root,v_id,auth.uid()))
  or (v_parent is not null and not eflow_m7.node_visible(p_root,v_parent,auth.uid()))
 ) then raise exception 'Current branch access required' using errcode='42501'; end if;
 if v_kind='personal' and p_command in ('progress','submit') and exists (
  select 1 from public.personal_subtasks s where s.id=v_id and s.task_id=p_root
   and s.start_date is not null and s.started_at is null
 ) then raise exception 'This subtask has not started' using errcode='42501'; end if;
 if p_command='contributors' and coalesce(eflow_publication.root_contributor_change_locked(p_root),false) then raise exception 'Only the Task Lead, Project Lead or responsible Office Head can change Task contributors' using errcode='42501';end if; if not coalesce((r->>'open')::boolean,false) then raise exception 'Closed or unresolved work is read-only' using errcode='42501';end if;
 if coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1) is distinct from p_revision then raise exception 'Work changed; reload and review the current tree' using errcode='40001';end if;
 if p_payload ? 'dependency_ids' and (v_kind<>'office' or p_command<>'edit'
   or jsonb_typeof(p_payload->'dependency_ids') is distinct from 'array') then
    raise exception 'Choose a list of Office subtask prerequisites.' using errcode='22023';
  end if;
  if p_payload ? 'priority' and (v_kind<>'office' or p_command not in ('create','edit')
       or coalesce(p_payload->>'priority','') not in ('low','medium','high')) then
      raise exception 'Choose Low, Medium or High priority.' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('id','parent','lead','people','title','due','start','priority','dependency_ids','standalone','order','note','progress','approve')) then raise exception 'Unsupported branch fields';end if;
 if v_id is not null then select * into n from eflow_r7.nodes where id=v_id and task_id=p_root;end if;
 if p_command<>'create' and p_command not in ('contributors','order','root_lead') and n.id is null then raise exception 'Choose a node in this root';end if;
 if p_command in ('progress','submit','review') then
  if v_kind<>'personal' then raise exception 'Use the existing Office evidence workflow';end if;
  if not eflow_m7.personal_node_activated(p_root,v_id) then raise exception 'This subtask has not started' using errcode='42501'; end if;
  if not exists(select 1 from eflow_m7.applying_work_proposal a join eflow_m7.work_proposals w on w.id=a.proposal_id
   where a.tx=txid_current() and w.root_id=p_root and w.node_id=v_id and w.reviewer_id=auth.uid()) then
   if p_command='progress' and n.lead_id is distinct from auth.uid() and (r->>'lead')::uuid is distinct from auth.uid()
      or p_command='submit' and (n.lead_id is distinct from auth.uid() or (r->>'lead')::uuid is distinct from auth.uid())
   then raise exception 'Submit this work for the appointed Lead to review' using errcode='42501'; end if;
  end if;
  if p_command='review' then raise exception 'Subitems complete directly; open the work action instead' using errcode='22023';
  elsif not coalesce((eflow_r7.operation_capabilities(p_root,v_id)->(case when p_command='progress' then 'execute' else 'submit' end)->>'allowed')::boolean,false) then raise exception 'Current subitem lead or task lead authority required' using errcode='42501';end if;
 elsif p_command='create' then
  if not coalesce(eflow_publication.manage_plan(p_root,v_parent),false) then raise exception 'Only a current lead may add work below their branch' using errcode='42501';end if;
 elsif p_command='order' then
  if not coalesce(eflow_publication.manage_plan(p_root,v_parent),false) then raise exception 'Sibling ordering denied' using errcode='42501';end if;
 elsif p_command='root_lead' then
  if not coalesce(eflow_r7.head(p_root),false) and not (v_kind='office' and eflow_publication.planning_lead((r->>'project')::uuid,(r->>'office')::uuid)) then raise exception 'Current Task Lead appointment authority required' using errcode='42501';end if;
 else
  if not coalesce(eflow_publication.manage_plan(p_root,v_id,p_command='staff' and v_lead is distinct from n.lead_id),false) then raise exception 'Branch staffing denied; ancestors and siblings are protected' using errcode='42501';end if;
 end if;
 if p_command='edit' and v_kind='office' then perform eflow_work_edit.check_subtask_edit(p_root,v_id,p_payload);end if;
 if not (p_command='edit' and v_kind='office') and p_command not in ('progress','submit','review','contributors','staff') and n.id is not null and (n.status<>'todo' or n.percent_complete<>0) then raise exception 'Planning changes require untouched work';end if;
 /* NW5.1 operation safety */ if p_command not in ('progress','submit','review') then perform eflow_r7.require_operation(p_root,p_command,p_payload);end if; v_before:=eflow_r7.snapshot(p_root);
 insert into eflow_r7.mutations values(txid_current(),auth.uid(),p_root);
 if p_command='root_lead' then
  if v_id is not null or v_lead is null or not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_lead) then raise exception 'Choose an eligible selected root lead';end if;
  if v_kind='office' then
   select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove((select team_member_ids from public.tasks where id=p_root)||array[v_lead],null))));
   if cardinality(v_people)>200 or not(v_people @> array[v_lead]) then raise exception 'Include the root lead in contributors';end if;
   v_previous_status_write:=current_setting('eflow.allow_status_write',true);
   perform set_config('eflow.allow_status_write','on',true);
   update public.tasks set status=case when status='pending_assignment' then 'todo' else status end,assigned_to=v_lead,assignee_name=(select full_name from public.profiles where id=v_lead),team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
   perform set_config('eflow.allow_status_write',coalesce(v_previous_status_write,'off'),true);
  else update public.personal_tasks set lead_id=v_lead,revision=revision+1 where id=p_root;end if;
 elsif p_command='contributors' then
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_kind<>'office' or v_id is not null or not coalesce(eflow_publication.manage_plan(p_root,null),false) then raise exception 'Root contributor operation denied' using errcode='42501';end if;
  if not (v_people @> array[(r->>'lead')::uuid]) then raise exception 'Root lead must remain; transfer uses its responsible Head';end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose selected project people';end if;end loop;
  update public.tasks set team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
 elsif p_command='create' then
  if v_parent is not null and exists(select 1 from eflow_r7.nodes where id=v_parent and (status<>'todo' or percent_complete<>0)) then raise exception 'Add children before starting the parent';end if;
  if v_id is null or exists(select 1 from eflow_r7.nodes where id=v_id) or exists(select 1 from public.tasks where id=v_id) or exists(select 1 from public.personal_tasks where id=v_id) then raise exception 'New disjoint node identity required';end if;
  if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a subitem title';end if;
  select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove(array[v_lead],null))));
  if v_lead is not null and not(v_people @> array[v_lead]) or cardinality(v_people)>200 then raise exception 'Include the appointed lead in contributors';end if;
  if v_kind='office' then
   insert into public.subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to,assigned_to_ids,sibling_order,position,created_by,due_date,start_date,priority,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_lead,v_people,v_position,(select coalesce(max(position),-1)+1 from public.subtasks where task_id=p_root),auth.uid(),(p_payload->>'due')::date,(p_payload->>'start')::date,coalesce(p_payload->>'priority','medium'),coalesce((p_payload->>'standalone')::boolean,false));
  else
   insert into public.personal_subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to_ids,sibling_order,due_date,start_date,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_people,v_position,(p_payload->>'due')::date,(p_payload->>'start')::date,coalesce((p_payload->>'standalone')::boolean,false));
  end if;
 elsif p_command='staff' then
  if n.status='completed' then raise exception 'Completed responsibility is historical';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_lead is null or not(v_people @> array[v_lead]) then raise exception 'Choose a lead and include them among contributors';end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose eligible project people';end if;end loop;
  with recursive below as (select id from eflow_r7.nodes where parent_subtask_id=v_id union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select coalesce(array_agg(id),'{}') into v_subtree from below;
  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.status<>'completed' and not(c.assigned_to_ids <@ v_people)) then raise exception 'Reassign unfinished descendant workers before removing a branch contributor';end if;
  if v_kind='office' then
   update public.subtasks set lead_id=v_lead,assigned_to=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.subtasks set lead_id=null where id=any(v_subtree);end if;
  else
   update public.personal_subtasks set lead_id=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.personal_subtasks set lead_id=null where id=any(v_subtree);end if;
  end if;
 elsif p_command in ('edit','move','delete') then
  with recursive below as (select * from eflow_r7.nodes where id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select array_agg(id) into v_subtree from below;
  if not (p_command='edit' and v_kind='office') and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and (c.status<>'todo' or c.percent_complete<>0)) then raise exception 'The entire subtree must be untouched';end if;
  if p_command='move' then
   if not coalesce(eflow_publication.manage_plan(p_root,v_parent),false) or v_parent=any(v_subtree) then raise exception 'Destination branch denied or cycle';end if;
   select * into parent from eflow_r7.nodes where id=v_parent and task_id=p_root;
   if v_parent is not null and parent.id is null then raise exception 'Destination must share the root';end if;
   select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
   if v_kind='office' then update public.subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;else update public.personal_subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;end if;
   -- Revalidate every descendant after the parent move, including depth overflow.
   if v_kind='office' then update public.subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;else update public.personal_subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;end if;
  elsif p_command='edit' then
   v_due:=(p_payload->>'due')::date;
   if v_due is not null and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.id<>v_id and c.due_date>v_due) then raise exception 'Edit descendant dates before shortening this deadline';end if;
   if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a title';end if;
   perform set_config('eflow.subtask_deadline_authorized','on',true);
   if v_kind='office' then if (v_due is distinct from n.due_date or
      (p_payload ? 'start' and (p_payload->>'start')::date is distinct from
        (select s.start_date from public.subtasks s where s.id=v_id)))
      and nullif(btrim(p_payload->>'note'),'') is null then
      raise exception 'Enter a reason for the schedule change.' using errcode='22023';
    end if;
    update public.subtasks set dependency_ids=case when p_payload ? 'dependency_ids'
    then array(select value::uuid from jsonb_array_elements_text(p_payload->'dependency_ids')) else dependency_ids end,
    title=btrim(p_payload->>'title'),priority=coalesce(p_payload->>'priority',priority),due_date=v_due,start_date=case when p_payload ? 'start' then (p_payload->>'start')::date else start_date end,due_date_change_reason=case when v_due is distinct from due_date or (p_payload ? 'start' and (p_payload->>'start')::date is distinct from start_date) then btrim(p_payload->>'note') else due_date_change_reason end,
      due_date_changed_at=case when v_due is distinct from due_date or (p_payload ? 'start' and (p_payload->>'start')::date is distinct from start_date) then now() else due_date_changed_at end,
      due_date_changed_by=case when v_due is distinct from due_date or (p_payload ? 'start' and (p_payload->>'start')::date is distinct from start_date) then auth.uid() else due_date_changed_by end,is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;
   else update public.personal_subtasks set title=btrim(p_payload->>'title'),due_date=v_due,start_date=case when p_payload ? 'start' then (p_payload->>'start')::date else start_date end,is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;end if;
   perform set_config('eflow.subtask_deadline_authorized','off',true);
  else
   if v_kind='office' and (exists(select 1 from public.subtask_progress_updates where subtask_id=any(v_subtree)) or exists(select 1 from public.subtask_submissions where subtask_id=any(v_subtree))
    or exists(select 1 from public.work_budget_allocations where subtask_id=any(v_subtree)) or exists(select 1 from public.petty_cash_requests where subtask_id=any(v_subtree))
    or exists(select 1 from public.budget_ledger_entries where subtask_id=any(v_subtree))) then raise exception 'Evidence, budget and cash history prohibit subtree deletion';end if;
   -- Children first: no CASCADE can erase evidence or financial identities.
   loop
    select id into v_uid from eflow_r7.nodes c where c.id=any(v_subtree) and not exists(select 1 from eflow_r7.nodes d where d.parent_subtask_id=c.id) limit 1;
    exit when v_uid is null;
    if v_kind='office' then delete from public.subtasks where id=v_uid;else delete from public.personal_subtasks where id=v_uid;end if;
   end loop;
  end if;
 elsif p_command='order' then
  select coalesce(array_agg(value::uuid),'{}') into v_order from jsonb_array_elements_text(coalesce(p_payload->'order','[]'));
  if (select count(*) from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent)<>cardinality(v_order)
   or (select count(distinct u) from unnest(v_order) u)<>cardinality(v_order) or exists(select 1 from unnest(v_order) u where not exists(select 1 from eflow_r7.nodes c where c.id=u and c.task_id=p_root and c.parent_subtask_id is not distinct from v_parent and c.status='todo' and c.percent_complete=0)) then raise exception 'Order must contain every untouched sibling exactly once';end if;
  if v_kind='office' then update public.subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);else update public.personal_subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);end if;
 elsif p_command in ('progress','submit','review') then
  if p_command<>'review' and not n.is_standalone and exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed') then raise exception 'Complete earlier ordered siblings first';end if;
  if p_command in ('submit','review') and exists(with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select 1 from below where status<>'completed') then raise exception 'Complete every child step first';end if;
  if p_command='progress' then
   if (p_payload->>'progress')::int not between 0 and 99 then raise exception 'Progress must be 0–99; submit at completion';end if;
   update public.personal_subtasks set percent_complete=(p_payload->>'progress')::int,status='in_progress',note=coalesce(p_payload->>'note','') where id=v_id;
  elsif p_command='submit' then
   update public.personal_subtasks set status='completed',percent_complete=100,note=coalesce(p_payload->>'note',''),submitted_by=auth.uid(),reviewer_id=null where id=v_id;
  else
   raise exception 'Subitems complete directly; review the parent task instead' using errcode='22023';
  end if;
 else raise exception 'Unsupported work command';end if;
 if v_kind='office' and p_command not in ('contributors','progress','submit','review') then
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique deferred;end if;
  with recursive ordered as (
   select id,array[lpad(sibling_order::text,10,'0')||id::text] path from public.subtasks where task_id=p_root and parent_subtask_id is null
   union all select c.id,p.path||(lpad(c.sibling_order::text,10,'0')||c.id::text) from public.subtasks c join ordered p on c.parent_subtask_id=p.id where c.task_id=p_root
  ), ranked as (select id,row_number() over(order by path)-1 rank from ordered)
  update public.subtasks s set position=r.rank from ranked r where s.id=r.id and s.position<>r.rank;
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique immediate;end if;
 end if;
 delete from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=p_root;
 v_result:=eflow_r7.snapshot(p_root);
 insert into public.work_tree_events(root_id,project_id,actor_id,actor_name,command,node_id,before_data,after_data) values(p_root,(r->>'project')::uuid,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_command,v_id,v_before,v_result);
 if v_kind='office' and p_command in ('create','staff','contributors','root_lead') then
  foreach v_uid in array coalesce(v_people,'{}') loop
   if v_uid<>auth.uid() and not coalesce((case when p_command in ('contributors','root_lead') then v_before->'root'->'people' else (select to_jsonb(assigned_to_ids) from jsonb_to_recordset(v_before->'nodes') as old_node(id uuid,assigned_to_ids uuid[]) where id=v_id) end) ? v_uid::text,false) then
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,project_id,work_node_id)
    values(v_uid,'assignment',case when v_id is null then 'Task assignment' else 'Subtask assignment' end,'You were assigned to "'||coalesce(p_payload->>'title',n.title,(select title from public.tasks where id=p_root))||'".',p_root,(select title from public.tasks where id=p_root),auth.uid(),(select full_name from public.profiles where id=auth.uid()),(r->>'project')::uuid,v_id);
   end if;
  end loop;
 end if;
 insert into eflow_r7.receipts values(auth.uid(),p_request,p_root,v_terms,v_result);
 return v_result;
end $function$
$definition$;
end $patch$;

do $patch$
begin
 -- Exact hash preflight above; the complete reviewed replacement preserves the rest of the function.
 execute $definition$CREATE OR REPLACE FUNCTION eflow_r7.snapshot(p_root uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
  result:=eflow_m7.with_visible_counts(eflow_publication.with_subtask_staffing(eflow_m7.with_schedule(eflow_r7.m7_baseline_snapshot(p_root))));
  if result->'root'->>'kind' is distinct from 'office' then return result; end if;
  result:=jsonb_set(result,'{root,scheduleBounds}',(
    select jsonb_build_object('projectStart',p.start_date,'projectDue',p.target_date,
      'taskStart',t.start_date,'taskDue',least(eflow_schedule.calendar_day(t.deadline),eflow_schedule.calendar_day(t.due_date)))
    from public.tasks t left join public.projects p on p.id=t.linked_project_id where t.id=p_root
  ));
  result:=result||jsonb_build_object('supportsSubtaskDependencies',true);
  return jsonb_set(result,'{nodes}',coalesce((
    select jsonb_agg(n.value||jsonb_build_object('priority',s.priority,'due_date_change_reason',s.due_date_change_reason,
    'detail_edit',eflow_work_edit.state(p_root,s.id),
    'can_edit_dependencies',coalesce((eflow_work_edit.state(p_root,s.id)->>'planning')::boolean,false) and eflow_r7.subtask_dependency_scope(p_root),
    'dependency_ids',case when s.dependency_ids is not null then to_jsonb(array(
      select ref.id from unnest(s.dependency_ids) ref(id) where eflow_m7.node_visible(p_root,ref.id,auth.uid()) order by ref.id
    )) end,
    'restricted_dependency_count',case when s.dependency_ids is not null then (
      select count(*) from unnest(s.dependency_ids) ref(id) where not coalesce(eflow_m7.node_visible(p_root,ref.id,auth.uid()),false)
    ) end,
    'pending_dependency_count',case when s.dependency_ids is not null then (
      select count(*) from unnest(s.dependency_ids) ref(id) left join public.subtasks p on p.id=ref.id and p.task_id=p_root
      where p.status is distinct from 'completed'
    ) end) order by n.ordinality)
    from jsonb_array_elements(result->'nodes') with ordinality n(value,ordinality)
    join public.subtasks s on s.id=(n.value->>'id')::uuid and s.task_id=p_root
  ),'[]'::jsonb));
end $function$
$definition$;
end $patch$;
revoke all on all functions in schema eflow_work_edit from public,anon,authenticated;
revoke all on function public.work_detail_edit_state(uuid,uuid) from public,anon;
grant execute on function public.work_detail_edit_state(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
select to_regprocedure('public.work_detail_edit_state(uuid,uuid)') is not null as editing_policy_installed;
