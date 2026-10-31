-- The policy's direct subquery required SELECT on a deliberately private table.
-- Return only whether the current eligible recipient owns this one invitation.
-- Do not grant direct access to project_invitation_requests.
create function eflow_r8.is_office_invitation_recipient(p_request uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and eflow_r3.eligible(auth.uid()) and exists(
  select 1 from public.project_invitation_requests r
  where r.id=p_request and r.accepted_by=auth.uid()
 )
$$;
revoke all on function eflow_r8.is_office_invitation_recipient(uuid) from public, anon;
grant execute on function eflow_r8.is_office_invitation_recipient(uuid) to authenticated;

alter policy project_office_people_read on public.project_office_people
using (
 public.can_manage_project(project_id,(select auth.uid()))
 or eflow_r8.is_office_invitation_recipient(request_id)
);

-- Read guest status through a scoped API rather than granting a private table.
create function eflow_r8.office_people(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare manager boolean;
begin
 perform eflow_r3.actor();
 manager:=public.can_manage_project(p_project,auth.uid());
 if not manager and not exists(
  select 1 from public.project_office_people o join public.project_invitation_requests r on r.id=o.request_id
  where o.project_id=p_project and r.accepted_by=auth.uid()
 ) then raise exception 'Project office people access denied' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'request_id',o.request_id,'identity_id',o.identity_id,'participation_role',o.participation_role,
  'invitation',eflow_r8.safe(r),'active',exists(
   select 1 from public.project_guest_members m where m.request_id=r.id and m.project_id=p_project
   and m.ended_at is null and (m.access_end is null or m.access_end>now())
  )
 ) order by r.created_at,r.id)
 from public.project_office_people o join public.project_invitation_requests r on r.id=o.request_id
 where o.project_id=p_project and (manager or r.accepted_by=auth.uid())),'[]'::jsonb);
end $$;
revoke all on function eflow_r8.office_people(uuid) from public,anon;
grant execute on function eflow_r8.office_people(uuid) to authenticated;

create function public.r8_office_people(p_project uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select eflow_r8.office_people(p_project)
$$;
revoke all on function public.r8_office_people(uuid) from public,anon;
grant execute on function public.r8_office_people(uuid) to authenticated;
