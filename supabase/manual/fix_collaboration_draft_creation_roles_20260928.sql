-- Run this entire script once in the Supabase SQL editor.
-- It fixes first-save failures when an inter-department proposal includes an observer.

begin;

create or replace function public.create_collaboration_draft(
  p_title text,
  p_owner_org_id uuid,
  p_source_type text,
  p_source_file_name text,
  p_source_file_path text,
  p_source_file_hash text,
  p_snapshot jsonb
)
returns public.proposal_collaboration_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_name text := '';
  draft_row public.proposal_collaboration_drafts;
  revision_row public.proposal_collaboration_revisions;
  organization_item jsonb;
  additional_org_id uuid;
  additional_role text;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'Draft title is required' using errcode = '22023'; end if;
  if p_source_type not in ('ai_pdf', 'manual') then raise exception 'Invalid draft source' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception 'Draft snapshot must be an object' using errcode = '22023';
  end if;
  if not public.is_organization_approver(p_owner_org_id, caller) then
    raise exception 'Only the Head or Assistant Head may create a proposal for this organization'
      using errcode = '42501';
  end if;

  insert into public.proposal_collaboration_drafts (
    title, owner_org_id, owner_user_id, source_type,
    source_file_name, source_file_path, source_file_hash,
    working_snapshot, created_by
  ) values (
    btrim(p_title), p_owner_org_id, caller, p_source_type,
    nullif(btrim(p_source_file_name), ''), nullif(btrim(p_source_file_path), ''),
    nullif(btrim(p_source_file_hash), ''), p_snapshot, caller
  ) returning * into draft_row;

  insert into public.proposal_collaboration_revisions (
    draft_id, revision_number, snapshot, created_by, change_summary
  ) values (
    draft_row.id, 1, draft_row.working_snapshot, caller, 'Initial draft'
  ) returning * into revision_row;

  update public.proposal_collaboration_drafts
  set current_revision_id = revision_row.id
  where id = draft_row.id
  returning * into draft_row;

  insert into public.proposal_collaboration_orgs (
    draft_id, org_id, participation_role, staffing_enabled, requested_by
  ) values (draft_row.id, p_owner_org_id, 'owner', true, caller);

  select coalesce(full_name, 'User') into caller_name
  from public.profiles
  where id = caller;

  for organization_item in
    select value
    from jsonb_array_elements(coalesce(p_snapshot -> 'organizations', '[]'::jsonb))
  loop
    additional_org_id := nullif(organization_item ->> 'orgId', '')::uuid;
    additional_role := coalesce(nullif(organization_item ->> 'participationRole', ''), 'participant');
    if additional_org_id is null or additional_org_id = p_owner_org_id then continue; end if;
    if additional_role not in ('participant', 'governance', 'observer') then
      raise exception 'Additional organizations must be participants, governance, or observers'
        using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.organizations
      where id = additional_org_id and is_active
    ) then
      raise exception 'A selected collaboration organization is not configured or active'
        using errcode = '22023';
    end if;

    insert into public.proposal_collaboration_orgs (
      draft_id, org_id, participation_role, staffing_enabled, requested_by,
      approval_policy, quorum_count, approval_sequence, review_deadline_days
    ) values (
      draft_row.id,
      additional_org_id,
      additional_role,
      case
        when additional_role in ('governance', 'observer') then false
        else coalesce((organization_item ->> 'staffingEnabled')::boolean, true)
      end,
      caller,
      case
        when organization_item ->> 'approvalPolicy' in ('one_of', 'all', 'quorum')
          then organization_item ->> 'approvalPolicy'
        else 'one_of'
      end,
      greatest(1, coalesce(nullif(organization_item ->> 'quorumCount', '')::int, 1)),
      greatest(1, coalesce(nullif(organization_item ->> 'sequence', '')::int, 1)),
      greatest(1, least(90, coalesce(nullif(organization_item ->> 'reviewDeadlineDays', '')::int, 5)))
    )
    on conflict (draft_id, org_id) do update
      set participation_role = excluded.participation_role,
          staffing_enabled = excluded.staffing_enabled,
          requested_by = excluded.requested_by,
          approval_policy = excluded.approval_policy,
          quorum_count = excluded.quorum_count,
          approval_sequence = excluded.approval_sequence,
          review_deadline_days = excluded.review_deadline_days;

    insert into public.audit_events (
      actor_id, actor_name, entity_type, entity_id, action, after_data, org_id
    ) values (
      caller, caller_name, 'collaboration_draft', draft_row.id::text,
      'collaboration.organization_added',
      jsonb_build_object(
        'organizationId', additional_org_id,
        'participationRole', additional_role
      ),
      p_owner_org_id
    );
  end loop;

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, after_data, org_id
  ) values (
    caller, caller_name, 'collaboration_draft', draft_row.id::text,
    'collaboration.draft_created',
    jsonb_build_object('title', draft_row.title, 'sourceType', draft_row.source_type, 'revision', 1),
    draft_row.owner_org_id
  );

  return draft_row;
end;
$$;

create or replace function public.set_collaboration_organizations(
  p_draft_id uuid,
  p_organizations jsonb,
  p_snapshot jsonb,
  p_change_summary text default 'Collaboration organizations updated'
)
returns public.proposal_collaboration_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  draft_row public.proposal_collaboration_drafts;
  item jsonb;
  target_org uuid;
  target_role text;
begin
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may change collaboration scope'
      using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_organizations, '[]'::jsonb)) <> 'array' then
    raise exception 'Organizations must be an array' using errcode = '22023';
  end if;

  select * into draft_row
  from public.proposal_collaboration_drafts
  where id = p_draft_id
  for update;

  delete from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role <> 'owner';

  for item in select value from jsonb_array_elements(p_organizations)
  loop
    target_org := nullif(item ->> 'orgId', '')::uuid;
    target_role := coalesce(nullif(item ->> 'participationRole', ''), 'participant');
    if target_org is null or target_org = draft_row.owner_org_id then continue; end if;
    if target_role not in ('participant', 'governance', 'observer') then
      raise exception 'Invalid collaboration participation level' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.organizations
      where id = target_org and is_active
    ) then
      raise exception 'A selected organization is not configured or active'
        using errcode = '22023';
    end if;

    insert into public.proposal_collaboration_orgs (
      draft_id, org_id, participation_role, staffing_enabled, requested_by,
      approval_policy, quorum_count, approval_sequence, review_deadline_days
    ) values (
      p_draft_id,
      target_org,
      target_role,
      case
        when target_role in ('governance', 'observer') then false
        else coalesce((item ->> 'staffingEnabled')::boolean, true)
      end,
      caller,
      case
        when item ->> 'approvalPolicy' in ('one_of', 'all', 'quorum')
          then item ->> 'approvalPolicy'
        else 'one_of'
      end,
      greatest(1, coalesce(nullif(item ->> 'quorumCount', '')::int, 1)),
      greatest(1, coalesce(nullif(item ->> 'sequence', '')::int, 1)),
      greatest(1, least(90, coalesce(nullif(item ->> 'reviewDeadlineDays', '')::int, 5)))
    );
  end loop;

  return public.save_collaboration_revision(p_draft_id, p_snapshot, p_change_summary);
end;
$$;

revoke all on function public.create_collaboration_draft(text, uuid, text, text, text, text, jsonb) from public, anon;
revoke all on function public.set_collaboration_organizations(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.create_collaboration_draft(text, uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.set_collaboration_organizations(uuid, jsonb, jsonb, text) to authenticated;

notify pgrst, 'reload schema';

commit;
