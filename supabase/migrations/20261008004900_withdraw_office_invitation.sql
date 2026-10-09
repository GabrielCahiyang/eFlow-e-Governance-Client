-- Lead Office Head may withdraw a pending or awaiting_head project-Office invitation before the
-- invited Office joins. Revokes the project_office row and all still-pending user invitations
-- linked to it. Joined offices, revoked rows, lead-office rows, and governed projects are protected.
create function public.phase6_withdraw_office_invitation(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  o public.project_offices;
  p public.projects;
begin
  select * into o from public.project_offices where id = p_id for update;
  if o.id is null then
    raise exception 'Project Office not found' using errcode = '22023';
  end if;
  select * into p from public.projects where id = o.project_id;
  -- Only the Lead Office Head can withdraw invitations.
  if not public.phase2_is_office_head(auth.uid(), p.org_id) or not public.can_manage_project(p.id, auth.uid()) then
    raise exception 'Only the Lead Office Head can withdraw an Office invitation' using errcode = '42501';
  end if;
  -- Governed projects are managed through proposal governance, not here.
  if p.source_collaboration_draft_id is not null then
    raise exception 'This project uses proposal governance; manage participation there' using errcode = '22023';
  end if;
  -- Cannot withdraw a closed project.
  if p.status in ('completed', 'archived') then
    raise exception 'This project is closed' using errcode = '22023';
  end if;
  -- Cannot withdraw the lead office.
  if o.relationship_type = 'lead' then
    raise exception 'The lead Office cannot be withdrawn' using errcode = '22023';
  end if;
  -- Only pending and awaiting_head rows can be withdrawn; joined means work may have started.
  if o.invitation_status not in ('pending', 'awaiting_head') then
    raise exception 'Only a pending or awaiting-head Office invitation can be withdrawn' using errcode = '22023';
  end if;
  -- Revoke all still-pending user invitations for this project office.
  update public.user_invitations
    set status = 'revoked', updated_at = now()
    where project_office_id = o.id and status = 'pending';
  -- Mark the project office row as revoked.
  update public.project_offices
    set invitation_status = 'revoked', updated_at = now()
    where id = o.id;
  perform public.phase2_audit(auth.uid(), p.org_id, o.id, 'project_office_invitation_withdrawn');
end $$;
revoke all on function public.phase6_withdraw_office_invitation(uuid) from public, anon;
grant execute on function public.phase6_withdraw_office_invitation(uuid) to authenticated;
