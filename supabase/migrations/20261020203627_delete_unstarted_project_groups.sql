-- Explicit group deletion removes only unstarted work through the audited task command.
-- The empty-only RPC remains unchanged for PDF cleanup and existing callers.
create or replace function public.delete_project_group(p_group_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare g public.project_groups;p public.projects;tid uuid;ids uuid[];caller uuid:=auth.uid();caller_name text;
begin
 if caller is null then raise exception 'Sign in before deleting a group.' using errcode='42501';end if;
 select * into g from public.project_groups where id=p_group_id;
 if not found then raise exception 'Group not available.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||g.project_id::text,0));
 select * into p from eflow_phase6.lock_project(g.project_id);
 if p.id is null or not coalesce(public.can_create_scoped_work(p.org_id,caller),false)
  or not coalesce(public.can_manage_project(p.id,caller),false) then
  raise exception 'Only the project Head can delete groups.' using errcode='42501';end if;
 if p.status in ('completed','archived') then raise exception 'This project is read-only.' using errcode='22023';end if;
 select * into g from public.project_groups where id=p_group_id for update;
 if not found then raise exception 'Group not available.' using errcode='42501';end if;
 -- All task, subitem and canonical progress writers share these locks.
 for tid in select id from public.tasks where linked_project_id=p.id
  and (group_id=g.id or (g.is_default and group_id is null)) order by id loop
  perform eflow_r7.lock_impact(tid);
 end loop;
 select coalesce(array_agg(id order by id),'{}'::uuid[]) into ids from public.tasks
 where linked_project_id=p.id and deleted_at is null and (group_id=g.id or (g.is_default and group_id is null));
 if exists(select 1 from public.tasks where id=any(ids) and archived_at is not null) then
  raise exception 'Move archived tasks out of this group before deleting it.' using errcode='22023';end if;
 if exists(select 1 from public.tasks where id=any(ids) and
  (status not in ('todo','pending_assignment') or coalesce(percent_complete,0)>0
   or latest_submission is not null and latest_submission<>'null'::jsonb and latest_submission<>'{}'::jsonb
   or coalesce(subtask_completed_count,0)>0)) then
  raise exception 'Some work has already started. Move those tasks before deleting this group.' using errcode='22023';end if;
 if exists(select 1 from public.subtasks where task_id=any(ids) and
  (status<>'todo' or coalesce(percent_complete,0)>0 or is_completed or completed_at is not null or latest_submission_id is not null)) then
  raise exception 'A subitem has already started. Move its task before deleting this group.' using errcode='22023';end if;
 if exists(select 1 from public.task_progress_updates where task_id=any(ids))
  or exists(select 1 from public.task_submissions where task_id=any(ids))
  or exists(select 1 from public.subtask_progress_updates where task_id=any(ids))
  or exists(select 1 from public.subtask_submissions where task_id=any(ids)) then
  raise exception 'This group has saved work or submitted evidence. Move those tasks before deleting it.' using errcode='22023';end if;
 -- Estimates remain deletable; actual funding and cash requests must be resolved.
 if exists(select 1 from public.work_budget_allocations where task_id=any(ids) and status not in ('cancelled','rejected'))
  or exists(select 1 from public.petty_cash_requests where task_id=any(ids) and status not in ('cancelled','rejected')) then
  raise exception 'This group has funded work or cash requests. Move those tasks before deleting it.' using errcode='22023';end if;
 foreach tid in array ids loop
  perform public.soft_delete_task(tid);
 end loop;
 -- Retain soft-deleted task/subitem records; safely rehome their group links.
 perform public.delete_empty_project_group(g.id);
 select full_name into caller_name from public.profiles where id=caller;
 insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,org_id,before_data,after_data)
 values(caller,coalesce(caller_name,'Head'),'project_group',g.id::text,'project_group.deleted',p.org_id,
  to_jsonb(g),jsonb_build_object('deleted',true,'removedTaskIds',ids,'removedTaskCount',cardinality(ids)));
end;
$$;
revoke all on function public.delete_project_group(uuid) from public,anon;
grant execute on function public.delete_project_group(uuid) to authenticated;
