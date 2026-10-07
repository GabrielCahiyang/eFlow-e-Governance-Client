-- Office removal retains invitation/audit history and existing account records.
-- Only the appointed Lead Head may remove an Office with no remaining work.
set lock_timeout = '10s';

grant select(project_office_id) on public.user_invitations to authenticated;

create schema eflow_office_management;
revoke all on schema eflow_office_management from public, anon;
grant usage on schema eflow_office_management to authenticated, service_role;

create function eflow_office_management.remove_office(p_participation uuid, p_identity uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  project_id uuid;
  p public.projects;
  o public.project_offices;
  i public.project_office_identities;
  identities uuid[];
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
  -- Use the same project lock and authority checks as identity creation/linking.
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
  -- Pending links stop working; accepted receipts remain intact for audit.
  update public.user_invitations set status = 'revoked', revoked_at = now(), updated_at = now()
    where status = 'pending' and (project_office_id = p_participation or project_office_identity_id = any(identities));
  if o.id is not null then
    delete from public.project_office_members where project_office_id = o.id;
    update public.project_offices set invitation_status = 'revoked', updated_at = now() where id = o.id;
  end if;
  update public.project_office_identities set contact_status = 'revoked',
    provenance = provenance || jsonb_build_object('removed', true, 'removedAt', now(), 'removedBy', actor), updated_at = now()
    where id = any(identities) and provenance->>'removed' is distinct from 'true';
  insert into public.audit_events(actor_id, entity_type, entity_id, action, org_id, after_data)
    values(actor, 'project_office', coalesce(p_participation, p_identity)::text, 'project.office_removed', p.org_id,
      jsonb_build_object('projectId', p.id, 'identityIds', identities, 'officeId', o.office_id));
end $$;
revoke all on function eflow_office_management.remove_office(uuid, uuid) from public, anon;
grant execute on function eflow_office_management.remove_office(uuid, uuid) to authenticated;

create function public.phase65_remove_project_office(p_participation uuid default null, p_identity uuid default null)
returns void language sql security invoker set search_path = '' as $$
  select eflow_office_management.remove_office(p_participation, p_identity);
$$;
revoke all on function public.phase65_remove_project_office(uuid, uuid) from public, anon;
grant execute on function public.phase65_remove_project_office(uuid, uuid) to authenticated;

-- Stale dialogs cannot link/invite a removed identity. The normal save action
-- explicitly restores the same name, retaining its historical ID and receipts.
create function eflow_office_management.guard_removed_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.provenance->>'removed' = 'true' and new.provenance->>'removed' = 'true' and (
    new.canonical_office_id is distinct from old.canonical_office_id or
    new.project_office_id is distinct from old.project_office_id or
    new.contact_status is distinct from old.contact_status or
    new.contact_email is distinct from old.contact_email) then
    raise exception 'This Office was removed. Add it again before inviting or linking it.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function eflow_office_management.guard_removed_identity() from public, anon, authenticated;
create trigger office_removed_identity_guard before update on public.project_office_identities
  for each row execute function eflow_office_management.guard_removed_identity();

do $$ declare definition text; begin
  select pg_get_functiondef('public.phase65_save_office_identity(uuid,uuid,text,text)'::regprocedure) into definition;
  execute replace(definition, 'FUNCTION public.phase65_save_office_identity(', 'FUNCTION eflow_office_management.baseline_save_office_identity(');
end $$;
revoke all on function eflow_office_management.baseline_save_office_identity(uuid,uuid,text,text) from public, anon, authenticated;
create or replace function public.phase65_save_office_identity(p_project uuid, p_id uuid, p_name text, p_evidence text default '')
returns public.project_office_identities language plpgsql security definer set search_path = '' as $$
declare i public.project_office_identities;
begin
  i := eflow_office_management.baseline_save_office_identity(p_project, p_id, p_name, p_evidence);
  if i.provenance->>'removed' = 'true' then
    update public.project_office_identities set provenance = provenance - 'removed' - 'removedAt' - 'removedBy',
      contact_status = 'none', contact_user_id = null, contact_email = '', updated_at = now()
      where id = i.id returning * into i;
  end if;
  return i;
end $$;
revoke all on function public.phase65_save_office_identity(uuid,uuid,text,text) from public, anon;
grant execute on function public.phase65_save_office_identity(uuid,uuid,text,text) to authenticated;

-- A fresh canonical invitation restores the removed Office to the visible list.
create function eflow_office_management.restore_canonical_office()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.invitation_status = 'pending' and old.invitation_status = 'revoked' then
    update public.project_office_identities set provenance = provenance - 'removed' - 'removedAt' - 'removedBy',
      contact_status = 'invited', contact_user_id = null, contact_email = new.contact_email, updated_at = now()
      where project_office_id = new.id and provenance->>'removed' = 'true';
  end if;
  return new;
end $$;
revoke all on function eflow_office_management.restore_canonical_office() from public, anon, authenticated;
create trigger office_removed_canonical_restore after update of invitation_status on public.project_offices
  for each row execute function eflow_office_management.restore_canonical_office();

create function eflow_office_management.guard_removed_responsibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.proposed_office_identity_id is not null and exists(
    select 1 from public.project_office_identities i where i.id = new.proposed_office_identity_id and i.provenance->>'removed' = 'true') then
    raise exception 'Choose an Office that is still in this project.' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function eflow_office_management.guard_removed_responsibility() from public, anon, authenticated;
create trigger office_removed_responsibility_guard before insert or update of proposed_office_identity_id on public.tasks
  for each row execute function eflow_office_management.guard_removed_responsibility();

notify pgrst, 'reload schema';
