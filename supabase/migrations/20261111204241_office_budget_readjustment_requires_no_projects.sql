create function eflow_budget.office_has_projects(p_org_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.projects where org_id = p_org_id);
$$;

create function eflow_budget.assert_readjustment_allowed(p_org_id uuid)
returns void language plpgsql set search_path = '' as $$
begin
  -- Adjustment callers already hold the fiscal budget lock. A concurrent
  -- project creation can also need that lock, so fail promptly if it owns
  -- the Office lock instead of waiting in the opposite order.
  if not pg_try_advisory_xact_lock(hashtextextended('office-budget-projects:' || p_org_id::text, 0)) then
    raise exception 'The Office project list is changing. Try again.' using errcode = '40001';
  end if;
  if eflow_budget.office_has_projects(p_org_id) then
    raise exception 'You can only readjust the Office Budget when the Office has no projects.' using errcode = '23514';
  end if;
end;
$$;

create function eflow_budget.serialize_office_project_addition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.org_id is not distinct from old.org_id then
    return new;
  end if;
  perform pg_advisory_xact_lock_shared(hashtextextended('office-budget-projects:' || new.org_id::text, 0));
  return new;
end;
$$;

create trigger office_budget_serialize_project_addition
  before insert or update of org_id on public.projects
  for each row execute function eflow_budget.serialize_office_project_addition();

revoke all on function eflow_budget.office_has_projects(uuid), eflow_budget.assert_readjustment_allowed(uuid),
  eflow_budget.serialize_office_project_addition() from public, anon, authenticated, service_role;

do $$
declare
  section_save text := pg_get_functiondef('eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb)'::regprocedure);
  amount_adjust text := pg_get_functiondef('public.adjust_department_fiscal_budget(uuid,numeric,text,text)'::regprocedure);
  section_read text := pg_get_functiondef('eflow_budget.get_sections(uuid,integer)'::regprocedure);
  save_anchor constant text := '  if b.status=''locked'' and nullif(btrim(p_reason),'''') is null then';
  adjust_anchor constant text := '  if p_adjusted_amount < 0 or nullif(btrim(p_reason), '''') is null then';
  read_anchor constant text := 'return result||jsonb_build_object(''sections'',rows,';
begin
  if strpos(section_save, save_anchor) = 0 or strpos(amount_adjust, adjust_anchor) = 0
    or strpos(section_read, read_anchor) = 0 then
    raise exception 'Unexpected Office Budget read or adjustment definition';
  end if;
  execute replace(section_save, save_anchor, '  if b.status = ''locked'' then perform eflow_budget.assert_readjustment_allowed(p_org_id); end if;' || chr(10) || save_anchor);
  execute replace(amount_adjust, adjust_anchor, '  perform eflow_budget.assert_readjustment_allowed(budget.org_id);' || chr(10) || adjust_anchor);
  execute replace(section_read, read_anchor, read_anchor || '''readjustmentBlockedByProjects'',eflow_budget.office_has_projects(p_org_id),');
end;
$$;
