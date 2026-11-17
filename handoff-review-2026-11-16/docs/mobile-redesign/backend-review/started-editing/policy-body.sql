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
