-- Keep incomplete drafts editable. Final amounts (active leaves, not subtotal
-- headings) must be positive when locking or adjusting a locked Office budget.
-- Patch only the reviewed boundaries; preserve identities, permissions and the
-- deployed compatibility bodies, including earlier qualified-column fixes.
do $migration$
declare
  definition text;
  anchor text;
begin
  definition := replace(pg_get_functiondef('public.lock_department_fiscal_budget(uuid)'::regprocedure), chr(13), '');
  if position('-- positive_office_budget_amounts' in definition) = 0 then
    anchor := '  update public.department_fiscal_budgets set status = ''locked''';
    if position(anchor in definition) = 0 then
      raise exception 'Office budget lock definition changed; review before applying';
    end if;
    execute replace(definition, anchor, $guard$
  -- positive_office_budget_amounts
  if exists (
    select 1 from public.office_budget_sections s
    where s.fiscal_budget_id = budget.id and not s.retired and s.amount <= 0
      and not exists (
        select 1 from public.office_budget_sections child
        where child.fiscal_budget_id = budget.id and child.parent_id = s.id and not child.retired
      )
  ) or (
    not exists (select 1 from public.office_budget_sections s where s.fiscal_budget_id = budget.id and not s.retired)
    and exists (select 1 from public.department_budget_lines line where line.fiscal_budget_id = budget.id and line.approved_amount <= 0)
  ) then
    raise exception 'Every budget amount must be greater than zero. Fill in or remove zero-amount rows before locking.' using errcode = '22023';
  end if;
$guard$ || anchor);
  end if;

  definition := replace(pg_get_functiondef('eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb)'::regprocedure), chr(13), '');
  if position('-- positive_office_budget_amounts' in definition) = 0 then
    anchor := '      total := total+row_amount;';
    if position(anchor in definition) = 0 then
      raise exception 'Office budget section definition changed; review before applying';
    end if;
    execute replace(definition, anchor, $guard$
      -- positive_office_budget_amounts
      if b.status = 'locked' and row_amount <= 0 then
        raise exception 'Enter an amount greater than zero for "%".', btrim(row->>'name') using errcode = '22023';
      end if;
$guard$ || anchor);
  end if;
end;
$migration$;
