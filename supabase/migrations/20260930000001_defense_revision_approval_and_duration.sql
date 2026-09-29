-- Defense revisions: schedule edits require approval, resubmission remains usable, and publication retains task effort.
-- Existing tables, policies, permissions, function arguments, and return types are preserved.

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
    'deadline', coalesce(task ->> 'deadline', ''),
    'estimatedHours', coalesce((task ->> 'estimatedHours')::numeric, 0),
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
    'deadline', coalesce(task ->> 'deadline', ''),
    'estimatedHours', coalesce((task ->> 'estimatedHours')::numeric, 0),
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
  if draft_row.status in ('committed','archived','deleted') or draft_row.deleted_at is not null then
    raise exception 'This work plan is no longer editable' using errcode = '22023';
  end if;
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

create or replace function public.request_collaboration_review(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  draft_row public.proposal_collaboration_drafts;
  current_revision public.proposal_collaboration_revisions;
  finalized_revision public.proposal_collaboration_revisions;
  caller_name text := '';
begin
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may request collaboration review' using errcode = '42501';
  end if;
  select * into draft_row from public.proposal_collaboration_drafts where id = p_draft_id for update;
  if not found then raise exception 'Work plan not found' using errcode = 'P0002'; end if;
  if draft_row.status in ('committed','archived','deleted') or draft_row.deleted_at is not null then
    raise exception 'This work plan can no longer request approval' using errcode = '22023';
  end if;
  if draft_row.current_revision_id is null then raise exception 'Publish a revision before requesting review' using errcode = '22023'; end if;
  select * into current_revision from public.proposal_collaboration_revisions where id = draft_row.current_revision_id;
  if current_revision.snapshot is distinct from draft_row.working_snapshot then
    select * into finalized_revision from public.save_collaboration_revision(
      p_draft_id, draft_row.working_snapshot, 'Work plan updated for department approval'
    );
    draft_row.current_revision_id := finalized_revision.id;
  end if;

  -- Serialize on the draft row and suppress rapid repeat clicks on the same plan.
  -- A deliberate reminder remains possible after ten seconds.
  if draft_row.status = 'in_review' and exists (
    select 1 from public.audit_events event
    where event.entity_id = p_draft_id::text
      and event.action = 'collaboration.review_requested'
      and event.after_data ->> 'revisionId' = draft_row.current_revision_id::text
      and event.created_at > now() - interval '10 seconds'
  ) then return; end if;

  update public.proposal_collaboration_drafts set status = 'in_review' where id = p_draft_id;
  update public.proposal_collaboration_orgs set requested_by = caller, requested_at = now() where draft_id = p_draft_id and participation_role in ('participant','governance');
  select coalesce(full_name, 'Owner') into caller_name from public.profiles where id = caller;

  insert into public.notifications (
    user_id, type, title, message, actor_id, actor_name, proposal_id, org_id, entity_type
  )
  select approver_id, 'collaboration_request', 'Department approval requested',
    caller_name || ' requested review of "' || draft_row.title || '".',
    caller, caller_name, p_draft_id::text, participating.org_id, 'collaboration_draft'
  from public.proposal_collaboration_orgs participating
  cross join lateral public.organization_approver_ids(participating.org_id) approver_id
  where participating.draft_id = p_draft_id
    and participating.participation_role in ('participant','governance')
    and approver_id <> caller;

  insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, after_data, org_id)
  values (caller, caller_name, 'collaboration_draft', p_draft_id::text, 'collaboration.review_requested',
    jsonb_build_object('revisionId', draft_row.current_revision_id, 'ownerOrganizationAutoAccepted', true), draft_row.owner_org_id);
  perform public.refresh_collaboration_readiness(p_draft_id);
end;
$$;

create or replace function public.commit_collaboration_draft(
  p_draft_id uuid,
  p_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_name text := '';
  draft_row public.proposal_collaboration_drafts;
  revision_row public.proposal_collaboration_revisions;
  readiness jsonb;
  snapshot jsonb;
  task_item jsonb;
  project_item record;
  activity_item record;
  project_row public.projects;
  milestone_row public.milestones;
  task_row public.tasks;
  owner_org public.proposal_collaboration_orgs;
  governance_org public.proposal_collaboration_orgs;
  primary_reviewer uuid;
  backup_reviewer uuid;
  task_lead uuid;
  primary_org uuid;
  activity_primary_org uuid;
  member_ids uuid[];
  member_names text[];
  supporting_value text;
  selected_reviewer uuid;
  selected_backup uuid;
  route_mode text;
  project_ids uuid[] := '{}'::uuid[];
  project_target date;
  project_start date;
  milestone_due date;
  import_batch text;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if not public.can_manage_collaboration_draft(p_draft_id, caller) then
    raise exception 'Only the owning organization may commit this proposal' using errcode = '42501';
  end if;
  select * into draft_row from public.proposal_collaboration_drafts where id = p_draft_id for update;
  if not found then raise exception 'Collaboration draft not found' using errcode = 'P0002'; end if;
  if draft_row.status = 'committed' or draft_row.committed_at is not null then raise exception 'This proposal has already been committed' using errcode = '22023'; end if;
  if draft_row.current_revision_id is distinct from p_revision_id then raise exception 'Only the current revision can be committed' using errcode = '22023'; end if;
  select * into revision_row from public.proposal_collaboration_revisions where id = p_revision_id and draft_id = p_draft_id;
  if not found then raise exception 'Revision does not belong to this draft' using errcode = '22023'; end if;
  readiness := public.collaboration_readiness(p_draft_id);
  if not coalesce((readiness ->> 'ready')::boolean, false) then
    raise exception 'Approval requirements not complete: %', coalesce(readiness -> 'blockers', '[]'::jsonb)::text using errcode = '22023';
  end if;

  snapshot := revision_row.snapshot;
  if jsonb_typeof(snapshot -> 'tasks') <> 'array' or jsonb_array_length(snapshot -> 'tasks') = 0 then
    raise exception 'The approved revision contains no tasks' using errcode = '22023';
  end if;
  select * into owner_org from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role = 'owner';
  if not found or owner_org.org_id <> draft_row.owner_org_id then raise exception 'Owner organization configuration is invalid' using errcode = '22023'; end if;

  select * into governance_org from public.proposal_collaboration_orgs
  where draft_id = p_draft_id and participation_role = 'governance'
  order by created_at limit 1;
  if found then
    select coalesce(
      (select membership.user_id from public.organization_memberships membership join public.profiles profile on profile.id = membership.user_id and profile.is_active where membership.organization_id = governance_org.org_id and membership.membership_role = 'primary_approver'),
      (select organization.head_user_id from public.organizations organization join public.profiles profile on profile.id = organization.head_user_id and profile.is_active where organization.id = governance_org.org_id)
    ) into primary_reviewer;
    select coalesce(
      (select membership.user_id from public.organization_memberships membership join public.profiles profile on profile.id = membership.user_id and profile.is_active where membership.organization_id = governance_org.org_id and membership.membership_role = 'backup_approver'),
      (select organization.assistant_head_user_id from public.organizations organization join public.profiles profile on profile.id = organization.assistant_head_user_id and profile.is_active where organization.id = governance_org.org_id)
    ) into backup_reviewer;
    if primary_reviewer is null and backup_reviewer is null then raise exception 'Governance organization requires an active Board Head or Board Assistant Head' using errcode = '22023'; end if;
  end if;

  import_batch := 'collaboration-' || p_draft_id::text || '-r' || revision_row.revision_number::text;

  -- Validate every staffing and responsibility record before the first insert.
  for task_item in
    select value from jsonb_array_elements(snapshot -> 'tasks')
    where coalesce((value ->> 'enabled')::boolean, true)
  loop
    task_lead := nullif(task_item ->> 'leadMemberId', '')::uuid;
    primary_org := coalesce(nullif(task_item ->> 'primaryOrgId', '')::uuid, draft_row.owner_org_id);
    member_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(task_item -> 'assignedMemberIds', '[]'::jsonb)));
    if nullif(btrim(task_item ->> 'title'), '') is null then raise exception 'Every selected task needs a title' using errcode = '22023'; end if;
    if task_lead is null or not member_ids @> array[task_lead] then raise exception 'Every Task Leader must belong to their proposed team' using errcode = '22023'; end if;
    if not exists (select 1 from public.proposal_collaboration_orgs eligible where eligible.draft_id = p_draft_id and eligible.org_id = primary_org and eligible.staffing_enabled) then
      raise exception 'Task primary organization is not staffing-enabled for this proposal' using errcode = '22023';
    end if;
    if not exists (select 1 from public.profiles profile where profile.id = task_lead and profile.is_active) then raise exception 'Every Task Leader must be active' using errcode = '22023'; end if;
    if exists (
      select 1 from unnest(member_ids) member_id
      left join public.profiles profile on profile.id = member_id and profile.is_active
      where profile.id is null or not exists (
        select 1 from public.proposal_collaboration_orgs eligible
        where eligible.draft_id = p_draft_id and eligible.org_id = profile.org_id and eligible.staffing_enabled
      )
    ) then raise exception 'Every proposed employee must be active and belong to a staffing-enabled participating organization' using errcode = '22023'; end if;
    for supporting_value in select value from jsonb_array_elements_text(coalesce(task_item -> 'supportingOrgIds', '[]'::jsonb)) loop
      if supporting_value::uuid = primary_org or not exists (select 1 from public.proposal_collaboration_orgs where draft_id = p_draft_id and org_id = supporting_value::uuid) then
        raise exception 'Task supporting organization configuration is invalid' using errcode = '22023';
      end if;
    end loop;
    if governance_org.org_id is not null and task_lead = primary_reviewer and backup_reviewer is null then
      raise exception 'Approval requirements not complete: Board Head is Task Leader and no Board Assistant Head is configured' using errcode = '22023';
    end if;
    if governance_org.org_id is not null and task_lead = backup_reviewer and primary_reviewer is null then
      raise exception 'Approval requirements not complete: Board Assistant Head is Task Leader and no Board Head is configured' using errcode = '22023';
    end if;
  end loop;

  for project_item in
    select task ->> 'projectId' as project_key,
      max(task ->> 'projectTitle') as project_title,
      max(task ->> 'programId') as program_id,
      max(task ->> 'programTitle') as program_title,
      min(case when task ->> 'deadline' ~ '^\d{4}-\d{2}-\d{2}' then left(task ->> 'deadline', 10)::date end) as start_date,
      max(case when task ->> 'deadline' ~ '^\d{4}-\d{2}-\d{2}' then left(task ->> 'deadline', 10)::date end) as target_date
    from jsonb_array_elements(snapshot -> 'tasks') task
    where coalesce((task ->> 'enabled')::boolean, true)
    group by task ->> 'projectId'
  loop
    if nullif(btrim(project_item.project_key), '') is null or nullif(btrim(project_item.project_title), '') is null then raise exception 'Every task must belong to a valid project' using errcode = '22023'; end if;
    project_start := project_item.start_date;
    project_target := project_item.target_date;
    insert into public.projects (
      org_id, title, description, owner_id, status, priority, start_date, target_date,
      created_by, proposal_id, proposal_title, program_id, program_title,
      source_type, source_file_name, source_collaboration_draft_id, source_collaboration_revision_id
    ) values (
      draft_row.owner_org_id, project_item.project_title,
      case when draft_row.source_type = 'ai_pdf' then 'Imported through approved collaboration: ' else 'Approved collaborative plan: ' end || draft_row.title,
      draft_row.owner_user_id, 'active', 'medium', project_start, project_target,
      caller, coalesce(snapshot ->> 'proposalId', p_draft_id::text), draft_row.title,
      project_item.program_id, project_item.program_title, draft_row.source_type,
      draft_row.source_file_name, p_draft_id, p_revision_id
    ) returning * into project_row;
    project_ids := array_append(project_ids, project_row.id);
    insert into public.proposal_collaboration_commit_projects (draft_id, revision_id, project_key, project_id)
    values (p_draft_id, p_revision_id, project_item.project_key, project_row.id);

    insert into public.project_organizations (
      project_id, organization_id, participation_role, staffing_enabled, source_draft_id, source_revision_id
    ) select project_row.id, participating.org_id, participating.participation_role,
      participating.staffing_enabled, p_draft_id, p_revision_id
    from public.proposal_collaboration_orgs participating where participating.draft_id = p_draft_id;

    insert into public.project_members (project_id, user_id, role)
    values (project_row.id, draft_row.owner_user_id, 'owner')
    on conflict (project_id, user_id) do update set role = excluded.role;
    insert into public.project_members (project_id, user_id, role)
    select distinct project_row.id, member_id, 'member'
    from jsonb_array_elements(snapshot -> 'tasks') task
    cross join lateral jsonb_array_elements_text(coalesce(task -> 'assignedMemberIds', '[]'::jsonb)) member_text(value)
    cross join lateral (select member_text.value::uuid as member_id) member
    where task ->> 'projectId' = project_item.project_key
      and coalesce((task ->> 'enabled')::boolean, true)
    on conflict (project_id, user_id) do nothing;

    for activity_item in
      select task ->> 'activityId' as activity_key,
        max(task ->> 'activityTitle') as activity_title,
        max(task ->> 'activitySchedule') as activity_schedule,
        max(task ->> 'activityPrimaryOrgId') as primary_org_id,
        (jsonb_agg(coalesce(task -> 'activitySupportingOrgIds', '[]'::jsonb)) -> 0) as supporting_org_ids,
        max(case when task ->> 'deadline' ~ '^\d{4}-\d{2}-\d{2}' then left(task ->> 'deadline', 10)::date end) as due_date
      from jsonb_array_elements(snapshot -> 'tasks') task
      where task ->> 'projectId' = project_item.project_key and coalesce((task ->> 'enabled')::boolean, true)
      group by task ->> 'activityId'
    loop
      milestone_due := activity_item.due_date;
      insert into public.milestones (project_id, title, description, due_date, sort_order)
      values (project_row.id, activity_item.activity_title,
        case when nullif(activity_item.activity_schedule, '') is null then '' else 'Original schedule: ' || activity_item.activity_schedule end,
        milestone_due, (select count(*) from public.milestones where project_id = project_row.id))
      returning * into milestone_row;
      activity_primary_org := coalesce(nullif(activity_item.primary_org_id, '')::uuid, draft_row.owner_org_id);
      if not exists (
        select 1 from public.proposal_collaboration_orgs
        where draft_id = p_draft_id and org_id = activity_primary_org and staffing_enabled
      ) then raise exception 'Activity primary organization must be a staffing-enabled participant' using errcode = '22023'; end if;
      insert into public.milestone_organizations (milestone_id, organization_id, responsibility_role)
      values (milestone_row.id, activity_primary_org, 'primary');
      for supporting_value in select value from jsonb_array_elements_text(coalesce(activity_item.supporting_org_ids, '[]'::jsonb)) loop
        if supporting_value::uuid <> activity_primary_org then
          if not exists (
            select 1 from public.proposal_collaboration_orgs
            where draft_id = p_draft_id and org_id = supporting_value::uuid
          ) then raise exception 'Activity supporting organization is not participating' using errcode = '22023'; end if;
          insert into public.milestone_organizations (milestone_id, organization_id, responsibility_role)
          values (milestone_row.id, supporting_value::uuid, 'supporting') on conflict do nothing;
        end if;
      end loop;

      for task_item in
        select value from jsonb_array_elements(snapshot -> 'tasks')
        where value ->> 'projectId' = project_item.project_key
          and value ->> 'activityId' = activity_item.activity_key
          and coalesce((value ->> 'enabled')::boolean, true)
      loop
        task_lead := nullif(task_item ->> 'leadMemberId', '')::uuid;
        primary_org := coalesce(nullif(task_item ->> 'primaryOrgId', '')::uuid, activity_primary_org);
        member_ids := array(select value::uuid from jsonb_array_elements_text(coalesce(task_item -> 'assignedMemberIds', '[]'::jsonb)));
        select array_agg(profile.full_name order by member_position.ordinality)
        into member_names
        from unnest(member_ids) with ordinality member_position(member_id, ordinality)
        join public.profiles profile on profile.id = member_position.member_id;

        if governance_org.org_id is not null then
          route_mode := 'governance';
          selected_reviewer := case when task_lead = primary_reviewer then backup_reviewer else primary_reviewer end;
          selected_backup := case
            when task_lead = backup_reviewer or backup_reviewer = selected_reviewer then null
            else backup_reviewer
          end;
          if selected_reviewer is null or selected_reviewer = task_lead then raise exception 'No valid governance reviewer exists for task "%"', task_item ->> 'title' using errcode = '22023'; end if;
        else
          route_mode := 'organization_default';
          selected_reviewer := null;
          selected_backup := null;
        end if;

        insert into public.tasks (
          title, description, status, priority, assigned_to, assignee_name,
          department, org_id, team_id, team_name, team_member_ids, team_member_names,
          deadline, due_date, tags, recommended_employee_ids,
          recommendation_reasoning, recommendation_source, recommendation_lead_id,
          reviewer_id, backup_reviewer_id, proposal_id, proposal_title,
          program_id, program_title, project_id, project_title,
          activity_id, activity_title, activity_schedule, hierarchy_path,
          import_batch_id, linked_project_id, milestone_id, percent_complete, estimated_hours,
          review_route_mode, source_collaboration_draft_id,
          source_collaboration_revision_id, created_by
        ) values (
          btrim(task_item ->> 'title'), nullif(task_item ->> 'description', ''), 'todo',
          coalesce(nullif(task_item ->> 'priority', ''), 'medium'), task_lead,
          (select full_name from public.profiles where id = task_lead),
          primary_org::text, primary_org, primary_org::text,
          (select name from public.organizations where id = primary_org),
          member_ids, coalesce(member_names, '{}'::text[]),
          coalesce(task_item ->> 'deadline', ''), coalesce(task_item ->> 'deadline', ''),
          array(select value from jsonb_array_elements_text(coalesce(task_item -> 'requiredSkills', '[]'::jsonb))),
          member_ids, nullif(task_item ->> 'reasoning', ''),
          case when draft_row.source_type = 'ai_pdf' then 'import' else null end,
          task_lead, selected_reviewer, selected_backup,
          coalesce(snapshot ->> 'proposalId', p_draft_id::text), draft_row.title,
          project_item.program_id, project_item.program_title,
          project_item.project_key, project_item.project_title,
          activity_item.activity_key, activity_item.activity_title,
          activity_item.activity_schedule,
          concat_ws(' > ', draft_row.title, project_item.program_title, project_item.project_title, activity_item.activity_title),
          import_batch, project_row.id, milestone_row.id, 0,
          greatest(coalesce((task_item ->> 'estimatedHours')::numeric, 0), 0),
          route_mode, p_draft_id, p_revision_id, caller
        ) returning * into task_row;
        insert into public.task_organizations (task_id, organization_id, responsibility_role)
        values (task_row.id, primary_org, 'primary');
        for supporting_value in select value from jsonb_array_elements_text(coalesce(task_item -> 'supportingOrgIds', '[]'::jsonb)) loop
          if supporting_value::uuid <> primary_org then
            insert into public.task_organizations (task_id, organization_id, responsibility_role)
            values (task_row.id, supporting_value::uuid, 'supporting') on conflict do nothing;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;

  update public.proposal_collaboration_drafts
  set status = 'committed', committed_at = now(), working_snapshot = revision_row.snapshot
  where id = p_draft_id;
  select coalesce(full_name, 'Owner') into caller_name from public.profiles where id = caller;
  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, after_data, org_id
  ) values (
    caller, caller_name, 'collaboration_draft', p_draft_id::text,
    'collaboration.committed',
    jsonb_build_object('revisionId', p_revision_id, 'revision', revision_row.revision_number, 'projectIds', to_jsonb(project_ids)),
    draft_row.owner_org_id
  );
  insert into public.notifications (user_id, type, title, message, actor_id, actor_name, proposal_id, org_id, entity_type)
  select distinct approver_id, 'collaboration_approved', 'Work plan published',
    '"' || draft_row.title || '" is now operational in eFlow.', caller, caller_name,
    p_draft_id::text, participating.org_id, 'collaboration_draft'
  from public.proposal_collaboration_orgs participating
  cross join lateral public.organization_approver_ids(participating.org_id) approver_id
  where participating.draft_id = p_draft_id and approver_id <> caller;
  return jsonb_build_object(
    'draftId', p_draft_id,
    'revisionId', p_revision_id,
    'revisionNumber', revision_row.revision_number,
    'projectIds', to_jsonb(project_ids),
    'projectCount', cardinality(project_ids)
  );
end;
$$;

notify pgrst, 'reload schema';
