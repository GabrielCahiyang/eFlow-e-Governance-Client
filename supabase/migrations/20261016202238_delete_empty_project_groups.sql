-- Empty-group removal keeps soft-deleted task history and its project link.
-- Definer privileges are limited to this authenticated, explicitly authorized
-- command so deleted rows hidden by tasks_read can be moved to the default group.
create function public.delete_empty_project_group(p_group_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare g public.project_groups; p public.projects; default_id uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode='42501';end if;
 select * into g from public.project_groups where id=p_group_id;
 if not found then raise exception 'Group not available.' using errcode='42501';end if;
 select * into p from eflow_phase6.lock_project(g.project_id);
 if not found or not coalesce(public.can_create_scoped_work(p.org_id,auth.uid()),false)
  or not coalesce(public.can_manage_project(p.id,auth.uid()),false) then
  raise exception 'Only the project Head can delete groups.' using errcode='42501';
 end if;
 if p.status in ('completed','archived') then raise exception 'This project is read-only.' using errcode='22023';end if;
 select * into g from public.project_groups where id=p_group_id for update;
 if not found then raise exception 'Group not available.' using errcode='42501';end if;
 if g.is_default then raise exception 'Keep the default project group.' using errcode='22023';end if;
 if exists(select 1 from public.tasks where group_id=g.id and deleted_at is null) then
  raise exception 'This group still has tasks. Move or delete them first. Archived tasks must be moved too.' using errcode='22023';
 end if;
 select id into default_id from public.project_groups where project_id=g.project_id and is_default;
 if default_id is null then raise exception 'The project default group is unavailable.' using errcode='22023';end if;
 update public.tasks set group_id=default_id where group_id=g.id and deleted_at is not null;
 delete from public.project_groups where id=g.id;
end $function$;
revoke all on function public.delete_empty_project_group(uuid) from public,anon,authenticated;
grant execute on function public.delete_empty_project_group(uuid) to authenticated;

