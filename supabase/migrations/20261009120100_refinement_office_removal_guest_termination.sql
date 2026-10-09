-- Merge compatibility: removing an Office ends its selected and sponsored access.
-- Rejoining the Office requires fresh approval; independent Lead-issued shares remain.
begin;
set local lock_timeout = '10s';

create function eflow_office_management.end_refinement_access(p_project uuid, p_office uuid, p_participation uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  members jsonb; guests jsonb; requests jsonb;
  member_count integer; guest_count integer; request_count integer; token_count integer;
begin
  select coalesce(jsonb_agg(to_jsonb(m) order by m.user_id), '[]') into members
    from public.project_office_members m where m.project_office_id = p_participation;
  select coalesce(jsonb_agg(to_jsonb(g) order by g.user_id), '[]') into guests
    from public.project_guest_members g where g.project_id = p_project and g.office_id = p_office;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]') into requests
    from public.project_invitation_requests r where r.project_id = p_project and r.office_id = p_office
      and r.kind = 'office' and r.state in ('pending', 'approved', 'accepted');
  update public.project_office_members set access_ended_at = now()
    where project_office_id = p_participation and access_ended_at is null;
  get diagnostics member_count = row_count;
  update public.project_guest_members set ended_at = now()
    where project_id = p_project and office_id = p_office and ended_at is null;
  get diagnostics guest_count = row_count;
  update public.project_invitation_requests set state = 'revoked', revision = revision + 1
    where project_id = p_project and office_id = p_office and kind = 'office'
      and state in ('pending', 'approved', 'accepted');
  get diagnostics request_count = row_count;
  delete from eflow_r8.tokens where request_id in (
    select id from public.project_invitation_requests where project_id = p_project and office_id = p_office and kind = 'office');
  get diagnostics token_count = row_count;
  return jsonb_build_object('members', members, 'guests', guests, 'requests', requests,
    'ended_members', member_count, 'ended_guests', guest_count, 'revoked_requests', request_count,
    'removed_tokens', token_count, 'changed', member_count + guest_count + request_count + token_count > 0);
end $$;
revoke all on function eflow_office_management.end_refinement_access(uuid,uuid,uuid) from public, anon, authenticated, service_role;

create or replace function eflow_office_management.remove_office(p_participation uuid, p_identity uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); project_id uuid; p public.projects; o public.project_offices;
  i public.project_office_identities; identities uuid[]; access_change jsonb; audit_summary jsonb; already_removed boolean;
begin
  if actor is null or (p_participation is null) = (p_identity is null) then
    raise exception 'Choose the Office to remove.' using errcode = '22023';
  end if;
  if p_identity is not null then
    select x.project_id into project_id from public.project_office_identities x where x.id = p_identity;
  else
    select x.project_id into project_id from public.project_offices x where x.id = p_participation;
  end if;
  if project_id is null then
    raise exception 'This Office is no longer available.' using errcode = '22023';
  end if;
  -- Match R9's lock order before taking the existing project/Office locks.
  perform pg_advisory_xact_lock(hashtextextended('r9:' || project_id::text, 0));
  p := eflow_phase65.require_lead(project_id, actor);
  if p_identity is not null then
    select * into i from public.project_office_identities where id = p_identity for update;
    if i.relationship_type = 'lead' or i.canonical_office_id = p.org_id then
      raise exception 'The Lead Office stays with this project.' using errcode = '22023';
    end if;
    p_participation := i.project_office_id;
  end if;
  if p_participation is not null then
    select * into o from public.project_offices where id = p_participation for update;
    if o.project_id is distinct from p.id or o.relationship_type = 'lead' or o.office_id = p.org_id then
      raise exception 'The Lead Office stays with this project.' using errcode = '22023';
    end if;
  end if;
  perform 1 from public.project_office_identities x
    where (p_participation is not null and x.project_office_id = p_participation) or x.id = p_identity
    order by x.id for update;
  select coalesce(array_agg(x.id), '{}'::uuid[]) into identities from public.project_office_identities x
    where (p_participation is not null and x.project_office_id = p_participation) or x.id = p_identity;
  if exists(select 1 from public.tasks t where t.deleted_at is null and (
    t.proposed_office_identity_id = any(identities) or
    (o.id is not null and t.linked_project_id = p.id and t.org_id = o.office_id))) then
    raise exception 'This Office has project work. Move or remove that work before removing the Office.' using errcode = '22023';
  end if;
  already_removed := cardinality(identities) > 0 and not exists(
    select 1 from public.project_office_identities x where x.id = any(identities) and x.provenance->>'removed' is distinct from 'true');
  if o.id is not null then
    access_change := eflow_office_management.end_refinement_access(p.id, o.office_id, o.id);
  else
    access_change := jsonb_build_object('changed', false);
  end if;
  if already_removed and not (access_change->>'changed')::boolean then return; end if;
  update public.user_invitations set status = 'revoked', revoked_at = now(), updated_at = now()
    where status = 'pending' and (project_office_id = p_participation or project_office_identity_id = any(identities));
  if o.id is not null then
    update public.project_offices set invitation_status = 'revoked', updated_at = now() where id = o.id;
  end if;
  update public.project_office_identities set contact_status = 'revoked',
    provenance = provenance || jsonb_build_object('removed', true, 'removedAt', now(), 'removedBy', actor), updated_at = now()
    where id = any(identities) and provenance->>'removed' is distinct from 'true';
  -- Public audit permissions are broader than sponsoring-Head request access.
  -- Keep invitation context, skills, email and full terms in private lifecycle events.
  audit_summary := jsonb_build_object(
    'ended_members', coalesce(access_change->'ended_members', '0'::jsonb),
    'ended_guests', coalesce(access_change->'ended_guests', '0'::jsonb),
    'revoked_requests', coalesce(access_change->'revoked_requests', '0'::jsonb),
    'removed_tokens', coalesce(access_change->'removed_tokens', '0'::jsonb),
    'member_ids', coalesce((select jsonb_agg(m->'user_id' order by m->>'user_id') from jsonb_array_elements(coalesce(access_change->'members','[]')) m), '[]'),
    'guest_ids', coalesce((select jsonb_agg(g->'user_id' order by g->>'user_id') from jsonb_array_elements(coalesce(access_change->'guests','[]')) g), '[]'),
    'request_ids', coalesce((select jsonb_agg(r->'id' order by r->>'id') from jsonb_array_elements(coalesce(access_change->'requests','[]')) r), '[]'));
  insert into public.audit_events(actor_id, entity_type, entity_id, action, org_id, before_data, after_data)
    values(actor, 'project_office', coalesce(p_participation, p_identity)::text, 'project.office_removed', p.org_id,
      audit_summary, jsonb_build_object('projectId', p.id, 'identityIds', identities, 'officeId', o.office_id));
  insert into eflow_r9.events(project_id, actor, action, details)
    values(p.id, actor, 'office_removed', jsonb_build_object('office', o.office_id, 'identities', identities, 'access', access_change));
end $$;
revoke all on function eflow_office_management.remove_office(uuid,uuid) from public, anon, service_role;
grant execute on function eflow_office_management.remove_office(uuid,uuid) to authenticated;

-- A previously removed Office must not revive guests when its canonical row is restored.
do $$ declare o record; changes jsonb; begin
  for o in select distinct po.id, po.project_id, po.office_id from public.project_offices po
    join public.project_office_identities i on i.project_office_id = po.id
    where i.provenance->>'removed' = 'true' and po.invitation_status = 'revoked'
    order by po.project_id, po.id
  loop
    perform pg_advisory_xact_lock(hashtextextended('r9:' || o.project_id::text, 0));
    changes := eflow_office_management.end_refinement_access(o.project_id, o.office_id, o.id);
    if (changes->>'changed')::boolean then
      insert into eflow_r9.events(project_id, actor, action, details)
        values(o.project_id, null, 'removed_office_access_ended', jsonb_build_object('office', o.office_id, 'access', changes));
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
