-- Allow observer organizations in draft autosave
-- Observer organizations are advisory and must never contribute staff.

begin;

create or replace function public.autosave_collaboration_draft(
  p_draft_id uuid,
  p_title text,
  p_snapshot jsonb
)
returns public.proposal_collaboration_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  draft_row public.proposal_collaboration_drafts;
  organization_item jsonb;
  target_org uuid;
  target_role text;
  previous_org_ids uuid[] := '{}'::uuid[];
  previous_org_id uuid;
  caller_name text := '';
begin
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may autosave this draft' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null or jsonb_typeof(coalesce(p_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception 'Draft title and snapshot are required' using errcode = '22023';
  end if;
  select * into draft_row from public.proposal_collaboration_drafts where id = p_draft_id for update;
  if draft_row.status <> 'draft' then
    raise exception 'Autosave is available only before collaboration review starts' using errcode = '22023';
  end if;
  select coalesce(array_agg(org_id), '{}'::uuid[]) into previous_org_ids
  from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role <> 'owner';
  select coalesce(full_name, 'Owner') into caller_name from public.profiles where id = caller;

  delete from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role <> 'owner';
  for organization_item in
    select value from jsonb_array_elements(coalesce(p_snapshot -> 'organizations', '[]'::jsonb))
  loop
    target_org := nullif(organization_item ->> 'orgId', '')::uuid;
    target_role := coalesce(nullif(organization_item ->> 'participationRole', ''), 'participant');
    if target_org is null or target_org = draft_row.owner_org_id then continue; end if;
    if target_role not in ('participant', 'governance', 'observer')
       or not exists (select 1 from public.organizations where id = target_org and is_active) then
      raise exception 'Autosave contains an invalid collaboration organization' using errcode = '22023';
    end if;
    insert into public.proposal_collaboration_orgs (
      draft_id, org_id, participation_role, staffing_enabled, requested_by
    ) values (
      p_draft_id, target_org, target_role,
      case
        when target_role in ('governance', 'observer') then false
        else coalesce((organization_item ->> 'staffingEnabled')::boolean, true)
      end,
      caller
    );
    if not (previous_org_ids @> array[target_org]) then
      insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, after_data, org_id)
      values (caller, caller_name, 'collaboration_draft', p_draft_id::text,
        'collaboration.organization_added',
        jsonb_build_object('organizationId', target_org, 'participationRole', target_role), draft_row.owner_org_id);
    end if;
  end loop;

  foreach previous_org_id in array previous_org_ids loop
    if not exists (
      select 1 from jsonb_array_elements(coalesce(p_snapshot -> 'organizations', '[]'::jsonb)) selected
      where nullif(selected ->> 'orgId', '')::uuid = previous_org_id
    ) then
      insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, after_data, org_id)
      values (caller, caller_name, 'collaboration_draft', p_draft_id::text,
        'collaboration.organization_removed',
        jsonb_build_object('organizationId', previous_org_id), draft_row.owner_org_id);
    end if;
  end loop;

  update public.proposal_collaboration_drafts
  set title = btrim(p_title), working_snapshot = p_snapshot
  where id = p_draft_id
  returning * into draft_row;
  return draft_row;
end;
$$;

revoke all on function public.autosave_collaboration_draft(uuid, text, jsonb) from public, anon;
grant execute on function public.autosave_collaboration_draft(uuid, text, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
