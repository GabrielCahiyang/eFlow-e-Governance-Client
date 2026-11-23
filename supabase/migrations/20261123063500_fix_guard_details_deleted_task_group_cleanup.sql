-- Allow authorized empty-group cleanup to rehome soft-deleted tasks' group_id
-- in eflow_work_edit.guard_details(), matching eflow_r7.guard_operation_write().

CREATE OR REPLACE FUNCTION eflow_work_edit.guard_details()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  'acceptance_criteria','definition_of_done','budget_impact','group_id','workspace_position','linked_project_id','org_id']
  else array['title','priority','due_date','start_date','dependency_ids','is_standalone','parent_subtask_id','sibling_order','task_id'] end;
 if not exists(select 1 from unnest(relevant) f where a->f is distinct from b->f) then return new;end if;
 -- Preserve private project-deletion detachment, with its existing exact predicate.
 if is_task and eflow_phase6.project_deletion_detach(a,b) then return new;end if;
 -- Preserve deleted-task group_id rehoming during authorized empty-group cleanup.
 if is_task and a->>'deleted_at' is not null and b->>'deleted_at' is not null
  and a->>'group_id' is distinct from b->>'group_id'
  and (a - array['group_id','updated_at']) = (b - array['group_id','updated_at'])
  and auth.uid() is not null and exists(
   select 1 from public.project_groups g join public.projects p on p.id = g.project_id
   where (g.id = (b->>'group_id')::uuid or b->>'group_id' is null)
     and g.project_id = (a->>'linked_project_id')::uuid
     and p.status not in ('completed','archived')
     and public.can_create_scoped_work(p.org_id, auth.uid())
     and public.can_manage_project(p.id, auth.uid())
  ) then return new; end if;
 -- Legacy non-project work retains its existing contracts and guards.
 if eflow_r7.root(root_id) is null then return new;end if;
 if b->>'status' in ('for_review','completed','cancelled') then
  raise exception 'Work details are read-only during review or after completion.' using errcode='22023';end if;
 policy:=eflow_work_edit.state(root_id,case when is_task then null else old.id end);
 if not coalesce((policy->>'details')::boolean,false) then
  raise exception 'Work details are read-only. Refresh the work or use its existing review or reopen action.' using errcode='42501';end if;
 locked:=case when is_task then array['description','start_date','dependency_ids','budget_impact',
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
end $function$;
