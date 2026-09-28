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
