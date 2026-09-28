-- Consolidate advisory participation and preserve approvals for editorial-only revisions.

begin;

create or replace function public.normalize_collaboration_snapshot_roles(p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case
    when jsonb_typeof(coalesce(p_snapshot -> 'organizations', '[]'::jsonb)) <> 'array' then p_snapshot
    else jsonb_set(
      p_snapshot,
      '{organizations}',
      coalesce((
        select jsonb_agg(
          case when item ->> 'participationRole' = 'consulted'
            then jsonb_set(jsonb_set(item, '{participationRole}', '"observer"'::jsonb), '{staffingEnabled}', 'false'::jsonb)
            else item
          end
          order by ordinal
        )
        from jsonb_array_elements(p_snapshot -> 'organizations') with ordinality entry(item, ordinal)
      ), '[]'::jsonb),
      true
    )
  end;
$$;

update public.proposal_collaboration_orgs
set participation_role = 'observer', staffing_enabled = false
where participation_role = 'consulted';

update public.project_organizations
set participation_role = 'observer', staffing_enabled = false
where participation_role = 'consulted';

update public.proposal_collaboration_drafts
set working_snapshot = public.normalize_collaboration_snapshot_roles(working_snapshot)
where working_snapshot @? '$.organizations[*] ? (@.participationRole == "consulted")';

update public.proposal_collaboration_revisions
set snapshot = public.normalize_collaboration_snapshot_roles(snapshot)
where snapshot @? '$.organizations[*] ? (@.participationRole == "consulted")';

alter table public.proposal_collaboration_orgs
  drop constraint if exists proposal_collaboration_orgs_participation_role_check;
alter table public.proposal_collaboration_orgs
  add constraint proposal_collaboration_orgs_participation_role_check
  check (participation_role in ('owner', 'participant', 'governance', 'observer'));

alter table public.project_organizations
  drop constraint if exists project_organizations_participation_role_check;
alter table public.project_organizations
  add constraint project_organizations_participation_role_check
  check (participation_role in ('owner', 'participant', 'governance', 'observer'));

create or replace function public.collaboration_revision_is_material(p_previous jsonb, p_next jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  previous_organizations jsonb;
  next_organizations jsonb;
  previous_tasks jsonb;
  next_tasks jsonb;
  previous_budget jsonb;
  next_budget jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'orgId', item ->> 'orgId',
    'participationRole', case when item ->> 'participationRole' = 'consulted' then 'observer' else item ->> 'participationRole' end,
    'staffingEnabled', coalesce((item ->> 'staffingEnabled')::boolean, false),
    'approvalPolicy', coalesce(item ->> 'approvalPolicy', 'one_of'),
    'quorumCount', coalesce((item ->> 'quorumCount')::int, 1),
    'sequence', coalesce((item ->> 'sequence')::int, 1)
  ) order by item ->> 'orgId'), '[]'::jsonb) into previous_organizations
  from jsonb_array_elements(coalesce(p_previous -> 'organizations', '[]'::jsonb)) item;
  select coalesce(jsonb_agg(jsonb_build_object(
    'orgId', item ->> 'orgId',
    'participationRole', case when item ->> 'participationRole' = 'consulted' then 'observer' else item ->> 'participationRole' end,
    'staffingEnabled', coalesce((item ->> 'staffingEnabled')::boolean, false),
    'approvalPolicy', coalesce(item ->> 'approvalPolicy', 'one_of'),
    'quorumCount', coalesce((item ->> 'quorumCount')::int, 1),
    'sequence', coalesce((item ->> 'sequence')::int, 1)
  ) order by item ->> 'orgId'), '[]'::jsonb) into next_organizations
  from jsonb_array_elements(coalesce(p_next -> 'organizations', '[]'::jsonb)) item;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', task ->> 'key',
    'enabled', coalesce((task ->> 'enabled')::boolean, true),
    'assignedMemberIds', (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from jsonb_array_elements_text(coalesce(task -> 'assignedMemberIds', '[]'::jsonb)) value),
    'leadMemberId', task ->> 'leadMemberId',
    'activityPrimaryOrgId', task ->> 'activityPrimaryOrgId',
    'activitySupportingOrgIds', (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from jsonb_array_elements_text(coalesce(task -> 'activitySupportingOrgIds', '[]'::jsonb)) value),
    'primaryOrgId', task ->> 'primaryOrgId',
    'supportingOrgIds', (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from jsonb_array_elements_text(coalesce(task -> 'supportingOrgIds', '[]'::jsonb)) value),
    'budgetDecision', coalesce(task ->> 'budgetDecision', 'missing'),
    'budgetLines', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', line ->> 'id',
      'amount', case
        when greatest(coalesce((line ->> 'quantity')::numeric, 0), 0) > 0
         and greatest(coalesce((line ->> 'unitCost')::numeric, 0), 0) > 0
        then greatest((line ->> 'quantity')::numeric, 0) * greatest((line ->> 'unitCost')::numeric, 0)
        else greatest(coalesce((line ->> 'amount')::numeric, 0), 0)
      end
    ) order by line ->> 'id'), '[]'::jsonb) from jsonb_array_elements(coalesce(task -> 'budgetLines', '[]'::jsonb)) line)
  ) order by task ->> 'key'), '[]'::jsonb) into previous_tasks
  from jsonb_array_elements(coalesce(p_previous -> 'tasks', '[]'::jsonb)) task;
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', task ->> 'key',
    'enabled', coalesce((task ->> 'enabled')::boolean, true),
    'assignedMemberIds', (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from jsonb_array_elements_text(coalesce(task -> 'assignedMemberIds', '[]'::jsonb)) value),
    'leadMemberId', task ->> 'leadMemberId',
    'activityPrimaryOrgId', task ->> 'activityPrimaryOrgId',
    'activitySupportingOrgIds', (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from jsonb_array_elements_text(coalesce(task -> 'activitySupportingOrgIds', '[]'::jsonb)) value),
    'primaryOrgId', task ->> 'primaryOrgId',
    'supportingOrgIds', (select coalesce(jsonb_agg(value order by value), '[]'::jsonb) from jsonb_array_elements_text(coalesce(task -> 'supportingOrgIds', '[]'::jsonb)) value),
    'budgetDecision', coalesce(task ->> 'budgetDecision', 'missing'),
    'budgetLines', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', line ->> 'id',
      'amount', case
        when greatest(coalesce((line ->> 'quantity')::numeric, 0), 0) > 0
         and greatest(coalesce((line ->> 'unitCost')::numeric, 0), 0) > 0
        then greatest((line ->> 'quantity')::numeric, 0) * greatest((line ->> 'unitCost')::numeric, 0)
        else greatest(coalesce((line ->> 'amount')::numeric, 0), 0)
      end
    ) order by line ->> 'id'), '[]'::jsonb) from jsonb_array_elements(coalesce(task -> 'budgetLines', '[]'::jsonb)) line)
  ) order by task ->> 'key'), '[]'::jsonb) into next_tasks
  from jsonb_array_elements(coalesce(p_next -> 'tasks', '[]'::jsonb)) task;

  previous_budget := jsonb_build_object('totalAmount', coalesce((p_previous -> 'budget' ->> 'totalAmount')::numeric, 0));
  next_budget := jsonb_build_object('totalAmount', coalesce((p_next -> 'budget' ->> 'totalAmount')::numeric, 0));
  return previous_organizations is distinct from next_organizations
    or previous_tasks is distinct from next_tasks
    or previous_budget is distinct from next_budget;
end;
$$;

create or replace function public.save_collaboration_revision(
  p_draft_id uuid,
  p_snapshot jsonb,
  p_change_summary text default 'Draft updated'
)
returns public.proposal_collaboration_revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  draft_row public.proposal_collaboration_drafts;
  current_row public.proposal_collaboration_revisions;
  revision_row public.proposal_collaboration_revisions;
  normalized_snapshot jsonb := public.normalize_collaboration_snapshot_roles(p_snapshot);
  material_change boolean := true;
  next_number int;
  caller_name text := '';
  carried_count int := 0;
begin
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may revise this draft' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(normalized_snapshot, '{}'::jsonb)) <> 'object' then
    raise exception 'Draft snapshot must be an object' using errcode = '22023';
  end if;
  select * into draft_row from public.proposal_collaboration_drafts where id = p_draft_id for update;
  select * into current_row from public.proposal_collaboration_revisions where id = draft_row.current_revision_id;
  if found and current_row.snapshot = normalized_snapshot then return current_row; end if;
  if found then material_change := public.collaboration_revision_is_material(current_row.snapshot, normalized_snapshot); end if;

  select coalesce(max(revision_number), 0) + 1 into next_number
  from public.proposal_collaboration_revisions where draft_id = p_draft_id;
  insert into public.proposal_collaboration_revisions (
    draft_id, revision_number, snapshot, created_by, change_summary
  ) values (
    p_draft_id, next_number, normalized_snapshot, caller,
    coalesce(nullif(btrim(p_change_summary), ''), 'Draft updated')
  ) returning * into revision_row;

  if current_row.id is not null and not material_change then
    insert into public.proposal_collaboration_approvals (
      draft_id, revision_id, organization_id, decision, approved_by, reason, created_at
    )
    select approval.draft_id, revision_row.id, approval.organization_id, approval.decision,
      approval.approved_by, approval.reason, approval.created_at
    from public.proposal_collaboration_approvals approval
    join public.proposal_collaboration_orgs participant
      on participant.draft_id = approval.draft_id and participant.org_id = approval.organization_id
    where approval.revision_id = current_row.id
      and approval.decision = 'approved'
      and participant.participation_role in ('participant', 'governance')
    on conflict (revision_id, organization_id) do nothing;
    get diagnostics carried_count = row_count;
  end if;

  update public.proposal_collaboration_drafts
  set working_snapshot = normalized_snapshot,
      current_revision_id = revision_row.id,
      status = case
        when material_change and status in ('in_review', 'ready_to_commit') then 'changes_requested'
        else status
      end
  where id = p_draft_id;

  select coalesce(full_name, 'User') into caller_name from public.profiles where id = caller;
  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id
  ) values (
    caller, caller_name, 'collaboration_revision', revision_row.id::text,
    'collaboration.revision_created', revision_row.change_summary,
    jsonb_build_object(
      'draftId', p_draft_id,
      'revision', next_number,
      'materialChange', material_change,
      'approvalsCarriedForward', carried_count
    ), draft_row.owner_org_id
  );
  perform public.refresh_collaboration_readiness(p_draft_id);
  return revision_row;
end;
$$;

revoke all on function public.normalize_collaboration_snapshot_roles(jsonb) from public, anon;
revoke all on function public.collaboration_revision_is_material(jsonb, jsonb) from public, anon;
grant execute on function public.normalize_collaboration_snapshot_roles(jsonb) to authenticated;
grant execute on function public.collaboration_revision_is_material(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';

commit;
