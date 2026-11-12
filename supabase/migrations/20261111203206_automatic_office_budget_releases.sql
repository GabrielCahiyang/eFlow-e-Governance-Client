-- Both the scheduler and the existing due-only Accounting RPC use the same
-- lock order and ledger transaction. An automatic release has no user actor.
create function eflow_budget.release_due_amount(
  p_account uuid, p_release uuid, p_expected_version integer, p_reference text, p_automatic boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid;
  actor_name text := 'eFlow';
  reason text := 'Scheduled release date reached';
  account public.office_budget_sections;
  budget public.department_fiscal_budgets;
  entry jsonb;
  confirmed jsonb;
  before_rows jsonb;
  after_rows jsonb;
  release_amount numeric;
begin
  select * into account from public.office_budget_sections where id = p_account;
  select * into budget from public.department_fiscal_budgets where id = account.fiscal_budget_id;
  if not p_automatic then
    caller := auth.uid();
    select p.full_name into actor_name from public.profiles p
    where p.id = caller and p.org_id = budget.org_id and p.is_active and p.role = 'accounting_staff';
    if not found then
      raise exception 'Only the office Accounting Officer can confirm availability.' using errcode = '42501';
    end if;
  elsif budget.id is null then
    return null;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(budget.org_id::text || ':' || budget.fiscal_year::text, 0));
  select * into budget from public.department_fiscal_budgets where id = budget.id for update;
  select * into account from public.office_budget_sections
  where id = p_account and fiscal_budget_id = budget.id and not retired for update;
  if account.id is null or budget.status <> 'locked' or exists (
    select 1 from public.office_budget_sections where parent_id = account.id and not retired
  ) then
    if p_automatic then return null; end if;
    raise exception 'Confirm releases on an active account in a locked budget.' using errcode = '22023';
  end if;

  select value into entry from jsonb_array_elements(account.release_schedule) where value->>'id' = p_release::text;
  if entry is null then
    if p_automatic then return null; end if;
    raise exception 'This scheduled release was not found. Check the latest budget.' using errcode = '22023';
  end if;
  if entry->>'status' = 'confirmed' then
    if p_automatic then return null; end if;
    return budget.id;
  end if;
  if not p_automatic and (p_expected_version is null or budget.sections_version <> p_expected_version) then
    raise exception 'The budget changed. Check the latest schedule before confirming.' using errcode = '40001';
  end if;
  if (entry->>'date')::date > (now() at time zone 'Asia/Manila')::date then
    if p_automatic then return null; end if;
    raise exception 'This release is not due yet.' using errcode = '22023';
  end if;
  if not p_automatic then
    if nullif(btrim(p_reference), '') is null or length(p_reference) > 1000 then
      raise exception 'Enter the release reference or note.' using errcode = '22023';
    end if;
    reason := btrim(p_reference);
  end if;
  release_amount := (entry->>'amount')::numeric;
  if release_amount <= 0 or account.held_amount < release_amount then
    raise exception 'The held amount changed. Check the latest schedule.' using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.position, s.id), '[]'::jsonb)
  into before_rows from public.office_budget_sections s where s.fiscal_budget_id = budget.id;
  confirmed := entry || jsonb_build_object(
    'status', 'confirmed', 'confirmedAt', clock_timestamp(), 'confirmedBy', caller,
    'confirmedByName', actor_name, 'reference', reason, 'automatic', p_automatic
  );
  update public.office_budget_sections
  set release_schedule = (
    select jsonb_agg(case when value->>'id' = p_release::text then confirmed else value end order by position)
    from jsonb_array_elements(account.release_schedule) with ordinality as entries(value, position)
  ), held_amount = held_amount - release_amount, updated_at = now()
  where id = account.id;
  update public.department_fiscal_budgets set sections_version = sections_version + 1, updated_at = now()
  where id = budget.id;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.position, s.id), '[]'::jsonb)
  into after_rows from public.office_budget_sections s where s.fiscal_budget_id = budget.id;

  insert into public.budget_ledger_entries(fiscal_budget_id, org_id, entry_type, amount, description, actor_id, reason, metadata, created_at)
  values (budget.id, budget.org_id, 'budget_adjusted', 0,
    (case when p_automatic then 'Automatic budget release: ' else 'Scheduled budget release confirmed: ' end) || account.name,
    caller, reason, jsonb_build_object(
      'beforeSections', before_rows, 'afterSections', after_rows, 'before', budget.approved_amount, 'after', budget.approved_amount,
      'beforeQ4Target', budget.underutilization_threshold, 'afterQ4Target', budget.underutilization_threshold,
      'releaseId', p_release, 'releasedAmount', release_amount, 'actorName', actor_name, 'automatic', p_automatic
    ), clock_timestamp());
  insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, before_data, after_data, reason, org_id)
  values (caller, actor_name, 'department_budget', budget.id::text,
    case when p_automatic then 'department_budget.release_automatic' else 'department_budget.release_confirmed' end,
    entry, confirmed, reason, budget.org_id);
  return budget.id;
end;
$$;

create or replace function eflow_budget.confirm_release(
  p_account uuid, p_release uuid, p_expected_version integer, p_reference text
) returns uuid language sql security definer set search_path = '' as $$
  select eflow_budget.release_due_amount(p_account, p_release, p_expected_version, p_reference, false);
$$;

create function eflow_budget.run_scheduled_releases()
returns integer language plpgsql set search_path = '' as $$
declare
  due record;
  released integer := 0;
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  for due in
    select a.id as account_id, (entry->>'id')::uuid as release_id
    from public.office_budget_sections a
    join public.department_fiscal_budgets b on b.id = a.fiscal_budget_id
    cross join lateral jsonb_array_elements(a.release_schedule) as entries(entry)
    where b.status = 'locked' and not a.retired and a.held_amount > 0
      and entry->>'status' = 'pending' and (entry->>'date')::date <= today
    order by b.org_id, b.fiscal_year, entry->>'date', a.id, entry->>'id'
  loop
    begin
      if eflow_budget.release_due_amount(due.account_id, due.release_id, null, null, true) is not null then
        released := released + 1;
      end if;
    exception when check_violation then
      raise warning 'Office Budget release % skipped: %', due.release_id, sqlerrm;
    end;
  end loop;
  return released;
end;
$$;

revoke all on function eflow_budget.release_due_amount(uuid, uuid, integer, text, boolean),
  eflow_budget.run_scheduled_releases() from public, anon, authenticated, service_role;

-- Existing saves still protect the pending total and keep released rows immutable.
do $$
declare
  definition text := pg_get_functiondef('eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb)'::regprocedure);
  previous_message constant text := 'Accounting must confirm availability before held money can be released. You can change release dates without reducing the pending total.';
begin
  if strpos(definition, previous_message) = 0 then
    raise exception 'Unexpected Office Budget schedule guard';
  end if;
  execute replace(definition, previous_message, 'Scheduled money becomes available on its release date. You can change release dates without reducing the pending total.');
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('eflow-office-budget-scheduled-releases', '* * * * *', 'select eflow_budget.run_scheduled_releases()');
