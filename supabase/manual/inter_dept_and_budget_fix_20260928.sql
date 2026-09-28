-- eFlow inter-department collaboration and budget fixes
-- Generated for one-time execution in the Supabase SQL Editor.
-- Run the complete script while signed in as the project database owner.

-- ============================================================================
-- SOURCE: supabase/migrations/20260928000001_allow_zero_cost_proposals.sql
-- ============================================================================

-- Allow fully validated no-cost proposals to publish without creating a fiscal commitment.

begin;

create or replace function public.commit_single_department_proposal_budget()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  budget_json jsonb;
  task_budget jsonb;
  task_json jsonb;
  line jsonb;
  task_total numeric;
  proposal_total numeric := 0;
  declared_total numeric := 0;
  quantity_value numeric;
  unit_cost_value numeric;
  amount_value numeric;
  year int;
  fiscal public.department_fiscal_budgets;
  already_committed numeric := 0;
  commitment_id uuid;
  allocation_id uuid;
  operational_task public.tasks;
  actor uuid;
begin
  if new.status <> 'committed' or old.status = 'committed' then return new; end if;
  actor := coalesce(auth.uid(), new.created_by);

  select revision.snapshot into snapshot
  from public.proposal_collaboration_revisions revision
  where revision.id = new.current_revision_id and revision.draft_id = new.id;
  budget_json := snapshot -> 'budget';
  if budget_json is null or jsonb_typeof(budget_json) <> 'object' then
    raise exception 'Complete the task funding schedule before publishing this proposal' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(budget_json -> 'taskBudgets', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(budget_json -> 'taskBudgets', '[]'::jsonb)) = 0 then
    raise exception 'Every selected task must be marked funded or no cost before publishing' using errcode = '22023';
  end if;

  for task_json in
    select value from jsonb_array_elements(snapshot -> 'tasks')
    where coalesce((value ->> 'enabled')::boolean, true)
  loop
    select value into task_budget
    from jsonb_array_elements(budget_json -> 'taskBudgets')
    where value ->> 'taskKey' = task_json ->> 'key';
    if task_budget is null then
      raise exception 'Task "%" has no funding decision', task_json ->> 'title' using errcode = '22023';
    end if;
    if task_budget ->> 'decision' not in ('funded', 'no_cost') then
      raise exception 'Task "%" must be marked funded or no cost', task_json ->> 'title' using errcode = '22023';
    end if;
    if task_budget ->> 'decision' = 'no_cost' then
      continue;
    end if;
    if jsonb_typeof(coalesce(task_budget -> 'lines', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(task_budget -> 'lines', '[]'::jsonb)) = 0 then
      raise exception 'Task "%" needs at least one funded particular', task_json ->> 'title' using errcode = '22023';
    end if;
    task_total := 0;
    for line in select value from jsonb_array_elements(task_budget -> 'lines') loop
      if nullif(btrim(line ->> 'expenseClass'), '') is null or nullif(btrim(line ->> 'category'), '') is null
         or nullif(btrim(line ->> 'particular'), '') is null then
        raise exception 'Every task budget line needs an expense class, category, and particular' using errcode = '22023';
      end if;
      quantity_value := greatest(coalesce((line ->> 'quantity')::numeric, 1), 0);
      unit_cost_value := greatest(coalesce((line ->> 'unitCost')::numeric, (line ->> 'amount')::numeric, 0), 0);
      amount_value := case when quantity_value > 0 and unit_cost_value > 0 then quantity_value * unit_cost_value else greatest(coalesce((line ->> 'amount')::numeric, 0), 0) end;
      if amount_value <= 0 then raise exception 'Every funded particular must have an amount greater than zero' using errcode = '22023'; end if;
      task_total := task_total + amount_value;
    end loop;
    proposal_total := proposal_total + task_total;
  end loop;

  declared_total := coalesce((budget_json ->> 'totalAmount')::numeric, 0);
  if abs(declared_total - proposal_total) > 0.009 then
    raise exception 'Proposal funding total does not match its task budgets' using errcode = '22023';
  end if;

  -- Administrative plans whose enabled tasks are all explicitly no-cost do not
  -- reserve an appropriation and do not require a locked fiscal budget.
  if proposal_total = 0 then
    return new;
  end if;
  year := coalesce((budget_json ->> 'fiscalYear')::int, extract(year from now())::int);
  select * into fiscal from public.department_fiscal_budgets
  where org_id = new.owner_org_id and fiscal_year = year and status = 'locked' for update;
  if not found then raise exception 'No locked % owner-department budget exists', year using errcode = '22023'; end if;
  select coalesce(sum(amount), 0) into already_committed
  from public.budget_commitments where fiscal_budget_id = fiscal.id and status = 'active';
  if already_committed + proposal_total > fiscal.approved_amount then
    raise exception 'Insufficient department budget. Shortfall: %',
      to_char((already_committed + proposal_total) - fiscal.approved_amount, 'FM999G999G999G990D00') using errcode = '22023';
  end if;

  insert into public.budget_commitments(
    fiscal_budget_id, proposal_draft_id, proposal_revision_id, title, amount, created_by
  ) values (fiscal.id, new.id, new.current_revision_id, new.title, proposal_total, actor)
  on conflict (proposal_draft_id) do update set
    proposal_revision_id = excluded.proposal_revision_id,
    title = excluded.title,
    amount = excluded.amount,
    updated_at = now()
  returning id into commitment_id;

  if proposal_total > 0 then
    insert into public.budget_ledger_entries(
      fiscal_budget_id, org_id, commitment_id, entry_type, amount, description, actor_id, metadata
    ) values (
      fiscal.id, fiscal.org_id, commitment_id, 'proposal_committed', proposal_total,
      'Budget reserved for published proposal: ' || new.title, actor,
      jsonb_build_object('proposalDraftId', new.id, 'revisionId', new.current_revision_id)
    );
  end if;

  for task_budget in
    select value from jsonb_array_elements(budget_json -> 'taskBudgets')
    where value ->> 'decision' = 'funded'
  loop
    select value into task_json from jsonb_array_elements(snapshot -> 'tasks')
    where value ->> 'key' = task_budget ->> 'taskKey'
      and coalesce((value ->> 'enabled')::boolean, true)
    limit 1;
    select * into operational_task
    from public.tasks task
    where task.source_collaboration_draft_id = new.id
      and task.source_collaboration_revision_id = new.current_revision_id
      -- Operational tasks are normalized with btrim() at publication time,
      -- while draft snapshots intentionally preserve what the author typed.
      -- Match normalized titles so a harmless trailing space cannot orphan a
      -- funded task budget during the same publication transaction.
      and btrim(task.title) = btrim(task_json ->> 'title')
      and coalesce(task.project_id, '') = coalesce(task_json ->> 'projectId', '')
      and coalesce(task.activity_id, '') = coalesce(task_json ->> 'activityId', '')
      and task.recommendation_lead_id = nullif(task_json ->> 'leadMemberId', '')::uuid
    order by task.created_at desc
    limit 1;
    if not found then
      raise exception 'Could not connect task budget for "%" to its operational task', coalesce(task_budget ->> 'taskTitle', task_json ->> 'title') using errcode = '22023';
    end if;
    select coalesce(sum(
      case
        when greatest(coalesce((value ->> 'quantity')::numeric, 1), 0) > 0
         and greatest(coalesce((value ->> 'unitCost')::numeric, (value ->> 'amount')::numeric, 0), 0) > 0
        then greatest(coalesce((value ->> 'quantity')::numeric, 1), 0) * greatest(coalesce((value ->> 'unitCost')::numeric, (value ->> 'amount')::numeric, 0), 0)
        else greatest(coalesce((value ->> 'amount')::numeric, 0), 0)
      end
    ), 0) into task_total from jsonb_array_elements(task_budget -> 'lines');
    insert into public.work_budget_allocations(
      commitment_id, task_id, amount, status, reason, requested_by, decided_by, decision_reason, requested_at, decided_at
    ) values (
      commitment_id, operational_task.id, task_total, 'approved',
      'Automatically allocated from the approved proposal task budget', actor, actor,
      'Approved with proposal publication', now(), now()
    ) returning id into allocation_id;
    for line in select value from jsonb_array_elements(task_budget -> 'lines') loop
      quantity_value := greatest(coalesce((line ->> 'quantity')::numeric, 1), 0);
      unit_cost_value := greatest(coalesce((line ->> 'unitCost')::numeric, (line ->> 'amount')::numeric, 0), 0);
      amount_value := case when quantity_value > 0 and unit_cost_value > 0 then quantity_value * unit_cost_value else greatest(coalesce((line ->> 'amount')::numeric, 0), 0) end;
      insert into public.work_budget_allocation_lines(
        allocation_id, draft_task_key, expense_class, category, particular, quantity, unit, unit_cost,
        amount, fund_source, position
      ) values (
        allocation_id, task_budget ->> 'taskKey', btrim(line ->> 'expenseClass'), btrim(line ->> 'category'),
        btrim(line ->> 'particular'), quantity_value, coalesce(nullif(btrim(line ->> 'unit'), ''), 'item'), unit_cost_value,
        amount_value, coalesce(nullif(btrim(line ->> 'fundSource'), ''), 'Department Budget'), coalesce((line ->> 'position')::int, 0)
      );
    end loop;
    insert into public.budget_ledger_entries(
      fiscal_budget_id, org_id, commitment_id, allocation_id, entry_type, amount, description, actor_id, metadata
    ) values (
      fiscal.id, operational_task.org_id, commitment_id, allocation_id, 'allocation_approved', task_total,
      'Task allocation created from published proposal funding', actor,
      jsonb_build_object('taskId', operational_task.id, 'draftTaskKey', task_budget ->> 'taskKey')
    );
  end loop;
  return new;
end;
$$;

notify pgrst, 'reload schema';

commit;


-- ============================================================================
-- SOURCE: supabase/migrations/20260928000002_collaboration_role_and_approval_stability.sql
-- ============================================================================

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


-- ============================================================================
-- SOURCE: supabase/migrations/20260928000003_petty_cash_funding_requester_orgs.sql
-- ============================================================================

-- Petty cash belongs to the budget-owning department while retaining the requester's home department.

begin;

alter table public.petty_cash_requests
  add column if not exists funding_org_id uuid references public.organizations(id) on delete restrict,
  add column if not exists requester_org_id uuid references public.organizations(id) on delete restrict;

update public.petty_cash_requests request
set funding_org_id = coalesce(request.funding_org_id, fiscal.org_id, request.org_id),
    requester_org_id = coalesce(request.requester_org_id, profile.org_id, request.org_id)
from public.department_fiscal_budgets fiscal,
     public.profiles profile
where fiscal.id = request.fiscal_budget_id
  and profile.id = request.requester_id
  and (request.funding_org_id is null or request.requester_org_id is null);

alter table public.petty_cash_requests
  alter column funding_org_id set not null,
  alter column requester_org_id set not null;

create index if not exists idx_petty_cash_requests_funding_org
  on public.petty_cash_requests(funding_org_id, status, created_at desc);
create index if not exists idx_petty_cash_requests_requester_org
  on public.petty_cash_requests(requester_org_id, requester_id, created_at desc);

create or replace function public.sync_petty_cash_request_organizations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_funding_org uuid;
  resolved_requester_org uuid;
begin
  select fiscal.org_id into resolved_funding_org
  from public.department_fiscal_budgets fiscal
  where fiscal.id = new.fiscal_budget_id;

  select profile.org_id into resolved_requester_org
  from public.profiles profile
  where profile.id = new.requester_id;

  new.funding_org_id := coalesce(resolved_funding_org, new.funding_org_id, new.org_id);
  new.requester_org_id := coalesce(resolved_requester_org, new.requester_org_id, new.org_id);
  if new.funding_org_id is null or new.requester_org_id is null then
    raise exception 'Cash requests require funding and requester departments' using errcode = '23502';
  end if;
  -- org_id remains the compatibility key used by accounting policies and ledgers.
  new.org_id := new.funding_org_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_petty_cash_request_organizations on public.petty_cash_requests;
create trigger trg_sync_petty_cash_request_organizations
before insert or update of fiscal_budget_id, requester_id, funding_org_id, requester_org_id, org_id
on public.petty_cash_requests
for each row execute function public.sync_petty_cash_request_organizations();
create or replace function public.create_contextual_cash_request(
  p_task_id uuid,
  p_subtask_id uuid,
  p_allocation_line_id uuid,
  p_amount numeric,
  p_purpose text,
  p_needed_by date,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  existing_id uuid;
  task_row public.tasks;
  task_leader uuid;
  task_allocation public.work_budget_allocations;
  source_line public.work_budget_allocation_lines;
  cap public.work_budget_allocations;
  target_allocation public.work_budget_allocations;
  commitment public.budget_commitments;
  fiscal public.department_fiscal_budgets;
  available numeric := 0;
  next_status text;
  request_id uuid;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_idempotency_key is null then raise exception 'A request idempotency key is required' using errcode = '22023'; end if;
  select id into existing_id from public.petty_cash_requests
  where requester_id = caller and idempotency_key = p_idempotency_key;
  if existing_id is not null then return existing_id; end if;
  if p_amount <= 0 then raise exception 'Requested amount must be greater than zero' using errcode = '22023'; end if;
  if nullif(btrim(p_purpose), '') is null then raise exception 'Describe what this cash will purchase' using errcode = '22023'; end if;
  if p_allocation_line_id is null then raise exception 'Select a proposal budget line and fund source' using errcode = '22023'; end if;

  select * into task_row from public.tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Funded task not found' using errcode = 'P0002'; end if;
  task_leader := coalesce(task_row.assigned_to, task_row.recommendation_lead_id);
  if task_leader is null then raise exception 'This task has no Task Leader for endorsement routing' using errcode = '22023'; end if;
  if p_subtask_id is null then
    if caller <> task_leader then raise exception 'Only the Task Leader can submit a task-level request' using errcode = '42501'; end if;
  else
    if not exists (select 1 from public.subtasks where id = p_subtask_id and task_id = p_task_id) then
      raise exception 'Subtask does not belong to this task' using errcode = '22023';
    end if;
    if caller <> task_leader and not exists (
      select 1 from public.subtasks subtask where subtask.id = p_subtask_id
        and coalesce(subtask.assigned_to_ids, '{}'::uuid[]) @> array[caller]
    ) then raise exception 'Only the Task Leader or an assigned contributor can request cash for this subtask' using errcode = '42501'; end if;
  end if;

  select * into task_allocation from public.work_budget_allocations
  where task_id = p_task_id and subtask_id is null and status = 'approved' for update;
  if not found then raise exception 'This task has no approved proposal budget' using errcode = '22023'; end if;
  select * into source_line from public.work_budget_allocation_lines
  where id = p_allocation_line_id and allocation_id = task_allocation.id for update;
  if not found then raise exception 'Select a valid proposal budget line for this task' using errcode = '22023'; end if;
  select * into commitment from public.budget_commitments
  where id = task_allocation.commitment_id and status = 'active';
  if not found then raise exception 'The proposal budget is no longer active' using errcode = '22023'; end if;
  select * into fiscal from public.department_fiscal_budgets
  where id = commitment.fiscal_budget_id and status = 'locked' for update;
  if not found then raise exception 'The annual department budget is no longer open' using errcode = '22023'; end if;

  if p_subtask_id is not null then
    select * into cap from public.work_budget_allocations
    where task_id = p_task_id and subtask_id = p_subtask_id and status = 'approved' for update;
  end if;
  if cap.id is not null then
    if cap.parent_allocation_line_id is distinct from source_line.id then
      raise exception 'This subtask cap is reserved for a different proposal budget line' using errcode = '22023';
    end if;
    target_allocation := cap;
    available := public.subtask_cap_available(cap.id);
  else
    target_allocation := task_allocation;
    available := public.task_budget_line_available(source_line.id);
  end if;
  if p_amount > available then
    raise exception 'Only % remains available on % · %',
      to_char(available, 'FM999G999G999G990D00'), source_line.category, source_line.particular using errcode = '22023';
  end if;

  next_status := case when caller = task_leader then 'pending_department_approval' else 'pending_leader_review' end;
  insert into public.petty_cash_requests(
    fiscal_budget_id, commitment_id, allocation_id, allocation_line_id, org_id,
    task_id, subtask_id, requester_id, task_leader_id, cash_recipient_id,
    purpose, requested_amount, needed_by, status, reservation_expires_at, idempotency_key
  ) values (
    fiscal.id, commitment.id, target_allocation.id, source_line.id, fiscal.org_id,
    task_row.id, p_subtask_id, caller, task_leader, caller,
    btrim(p_purpose), p_amount, p_needed_by, next_status, now() + interval '7 days', p_idempotency_key
  ) returning id into request_id;

  if next_status = 'pending_leader_review' then
    insert into public.notifications(user_id, type, title, message, task_id, task_title, actor_id, actor_name, financial_record_id, financial_record_type)
    select task_leader, 'petty_cash_leader_review', 'Cash request needs your endorsement',
      coalesce(profile.full_name, 'A contributor') || ' requested ' || to_char(p_amount, 'FM999G999G999G990D00') ||
      ' for ' || btrim(p_purpose) || ' in "' || task_row.title || '".',
      task_row.id, task_row.title, caller, coalesce(profile.full_name, ''), request_id, 'petty_cash_request'
    from public.profiles profile where profile.id = caller and task_leader <> caller;
  else
    insert into public.notifications(user_id, type, title, message, task_id, task_title, actor_id, actor_name, financial_record_id, financial_record_type)
    select approver_id, 'petty_cash_department_approval', 'Cash request needs fiscal authorization',
      coalesce(profile.full_name, 'A Task Leader') || ' requested ' || to_char(p_amount, 'FM999G999G999G990D00') ||
      ' for ' || btrim(p_purpose) || ' in "' || task_row.title || '".',
      task_row.id, task_row.title, caller, coalesce(profile.full_name, ''), request_id, 'petty_cash_request'
    from public.organization_approver_ids(fiscal.org_id) approver_id
    left join public.profiles profile on profile.id = caller
    where approver_id <> caller;
  end if;
  return request_id;
exception
  when unique_violation then
    select id into existing_id from public.petty_cash_requests
    where requester_id = caller and idempotency_key = p_idempotency_key;
    if existing_id is not null then return existing_id; end if;
    raise;
end;
$$;


comment on column public.petty_cash_requests.funding_org_id is 'Department whose locked fiscal budget funds and approves the request.';
comment on column public.petty_cash_requests.requester_org_id is 'Home department of the employee who submitted the request.';

notify pgrst, 'reload schema';

commit;

