-- Additive section foundation. No photographed amounts or financial transactions are seeded.
begin;
create schema if not exists eflow_budget;
revoke all on schema eflow_budget from public, anon;
grant usage on schema eflow_budget to authenticated, service_role;

alter table public.department_fiscal_budgets add column sections_version integer not null default 0;
create table public.office_budget_sections (
  id uuid primary key default gen_random_uuid(),
  fiscal_budget_id uuid not null references public.department_fiscal_budgets(id) on delete restrict,
  parent_id uuid,
  name text not null check (length(btrim(name)) between 1 and 200),
  account_code text,
  amount numeric(16,2) not null check (amount >= 0),
  held_amount numeric(16,2) not null default 0 check (held_amount between 0 and amount),
  position integer not null default 0,
  retired boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, fiscal_budget_id),
  foreign key (parent_id, fiscal_budget_id) references public.office_budget_sections(id, fiscal_budget_id) deferrable initially deferred,
  check (parent_id is distinct from id)
);
create index office_budget_sections_budget_idx on public.office_budget_sections(fiscal_budget_id, position);
create index office_budget_sections_parent_idx on public.office_budget_sections(parent_id, fiscal_budget_id);
create index office_budget_sections_creator_idx on public.office_budget_sections(created_by);
alter table public.office_budget_sections enable row level security;
revoke all on public.office_budget_sections from public, anon, authenticated;
grant select on public.office_budget_sections to authenticated;
grant all on public.office_budget_sections to service_role;
create policy office_budget_sections_read on public.office_budget_sections for select to authenticated using (
  exists (select 1 from public.department_fiscal_budgets b where b.id = fiscal_budget_id and public.can_view_department_budget(b.org_id, (select auth.uid())))
);

-- Preserve the currently locked total as unclassified; leave old annual lines unchanged.
insert into public.office_budget_sections(fiscal_budget_id, name, amount, created_by)
select id, 'Unclassified opening appropriation', approved_amount, created_by from public.department_fiscal_budgets;

create function eflow_budget.section_total(p_budget_id uuid, p_held boolean default false)
returns numeric language sql stable set search_path = '' as $$
  select coalesce(sum(case when p_held then s.held_amount else s.amount end), 0)
  from public.office_budget_sections s where s.fiscal_budget_id=p_budget_id and not s.retired
  and not exists (select 1 from public.office_budget_sections child where child.parent_id=s.id and not child.retired);
$$;

create function eflow_budget.get_sections(p_org_id uuid, p_fiscal_year integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b public.department_fiscal_budgets; rows jsonb;
begin
  if auth.uid() is null or not public.can_view_department_budget(p_org_id, auth.uid()) then
    raise exception 'Budget access denied' using errcode='42501';
  end if;
  select * into b from public.department_fiscal_budgets where org_id=p_org_id and fiscal_year=p_fiscal_year;
  if not found then return jsonb_build_object('version',0,'sections','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'parentId',s.parent_id,'name',s.name,'accountCode',s.account_code,
    'amount',s.amount,'heldAmount',s.held_amount,'position',s.position,'retired',s.retired) order by s.position,s.id),'[]'::jsonb)
  into rows from public.office_budget_sections s where s.fiscal_budget_id=b.id;
  return jsonb_build_object('version',b.sections_version,'sections',rows);
end;
$$;
create function public.get_office_budget_sections(p_org_id uuid, p_fiscal_year integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select eflow_budget.get_sections(p_org_id,p_fiscal_year);
$$;

create function eflow_budget.save_sections(p_org_id uuid, p_fiscal_year integer, p_sections jsonb, p_expected_version integer, p_reason text, p_settings jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid(); b public.department_fiscal_budgets; row jsonb;
  parent jsonb; parent_key text; seen text[]; total numeric := 0; before_rows jsonb;
  lines jsonb := '[]'::jsonb; adjustment_id uuid; row_amount numeric; row_hold numeric;
begin
  if caller is null or not public.is_department_budget_head(p_org_id,caller) then
    raise exception 'Only the assigned Head can prepare or adjust budget sections' using errcode='42501';
  end if;
  if p_fiscal_year is null or p_fiscal_year not between 2000 and 2200 or p_expected_version is null then
    raise exception 'Invalid fiscal year or section version' using errcode='22023';
  end if;
  if p_sections is null or jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections)>250 then
    raise exception 'Use a valid list of at most 250 budget sections' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_sections))<>(select count(distinct value->>'id') from jsonb_array_elements(p_sections)) then
    raise exception 'Section IDs must be unique' using errcode='22023';
  end if;
  -- Serialize first-create races as well as edits; all section writers use this order.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org_id::text||':'||p_fiscal_year::text,0));
  select * into b from public.department_fiscal_budgets where org_id=p_org_id and fiscal_year=p_fiscal_year for update;
  if b.id is not null and b.sections_version<>p_expected_version then
    raise exception 'The budget changed. Refresh and review the latest sections before saving' using errcode='40001';
  end if;
  if b.id is null and p_expected_version<>0 then raise exception 'Refresh the budget before saving' using errcode='40001'; end if;
  if b.status='closed' then raise exception 'This fiscal year is closed' using errcode='22023'; end if;
  if b.status='locked' and nullif(btrim(p_reason),'') is null then
    raise exception 'A reason and authority reference are required for a locked budget adjustment' using errcode='22023';
  end if;
  for row in select value from jsonb_array_elements(p_sections) loop
    -- Retired rows are history, not editable input. Omitting a row retires it below.
    if coalesce((row->>'retired')::boolean,false) then continue; end if;
    if nullif(row->>'id','') is null or nullif(btrim(row->>'name'),'') is null or length(btrim(row->>'name'))>200 then
      raise exception 'Give every section a valid ID and name' using errcode='22023';
    end if;
    perform (row->>'id')::uuid;
    if exists(select 1 from public.office_budget_sections s where s.id=(row->>'id')::uuid and s.fiscal_budget_id is distinct from b.id) then
      raise exception 'Section belongs to another budget' using errcode='42501';
    end if;
    row_amount := (row->>'amount')::numeric;
    row_hold := (row->>'heldAmount')::numeric;
    if row_amount is null or row_hold is null or row_amount<0 or row_hold<0 or row_hold>row_amount
      or row_amount<>round(row_amount,2) or row_hold<>round(row_hold,2) or row_amount>90000000000 then
      raise exception 'Use valid non-negative amounts in cents; held money cannot exceed the amount' using errcode='22023';
    end if;
    if exists(select 1 from jsonb_array_elements(p_sections) c where c->>'parentId'=row->>'id' and not coalesce((c->>'retired')::boolean,false)) then
      if row_amount<>0 or row_hold<>0 then raise exception 'Detailed sections get their subtotal from their children' using errcode='22023'; end if;
    else
      total := total+row_amount;
      lines := lines||jsonb_build_array(jsonb_build_object('expenseClass',btrim(row->>'name'),'category',btrim(row->>'name'),
        'particular',btrim(row->>'name'),'quantity',1,'unit','authority','unitCost',row_amount,'amount',row_amount,
        'fundSource','Office appropriation','position',coalesce((row->>'position')::integer,0)));
    end if;
    seen := array[row->>'id']; parent_key := nullif(row->>'parentId','');
    while parent_key is not null loop
      if parent_key=any(seen) or cardinality(seen)>=6 then raise exception 'Sections must form a tree of at most six levels' using errcode='22023'; end if;
      select value into parent from jsonb_array_elements(p_sections) where value->>'id'=parent_key and not coalesce((value->>'retired')::boolean,false);
      if parent is null then raise exception 'Choose an existing active parent section' using errcode='22023'; end if;
      seen := array_append(seen,parent_key); parent_key := nullif(parent->>'parentId','');
    end loop;
  end loop;
  if b.id is not null then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.position,s.id),'[]'::jsonb) into before_rows from public.office_budget_sections s where s.fiscal_budget_id=b.id;
  else before_rows := '[]'::jsonb; end if;
  if b.id is null or b.status='draft' then
    -- The original save contract remains available; new empty drafts are valid zero-authority plans.
    if jsonb_array_length(lines)=0 then lines := jsonb_build_array(jsonb_build_object('expenseClass','Draft','category','Unallocated','particular','Empty draft','amount',0,'quantity',1,'unitCost',0,'fundSource','Office appropriation')); end if;
    b.id := public.save_department_fiscal_budget_v2(p_org_id,p_fiscal_year,
      (p_settings->>'dailyReleaseLimit')::numeric,(p_settings->>'perReceiptLimit')::numeric,
      (p_settings->>'liquidationDueDays')::integer,(p_settings->>'allowReceiptOverride')::boolean,
      (p_settings->>'threshold')::numeric,p_settings->>'notes',lines);
    -- No actual transactions reference an unlocked draft.
    delete from public.office_budget_sections where fiscal_budget_id=b.id;
  else
    if total<>b.approved_amount then
      adjustment_id := public.adjust_department_fiscal_budget(b.id,total,p_reason,null);
    end if;
    update public.office_budget_sections set retired=true, updated_at=now() where fiscal_budget_id=b.id;
  end if;
  for row in select value from jsonb_array_elements(p_sections) loop
    if coalesce((row->>'retired')::boolean,false) then continue; end if;
    insert into public.office_budget_sections(id,fiscal_budget_id,parent_id,name,account_code,amount,held_amount,position,created_by)
    values ((row->>'id')::uuid,b.id,nullif(row->>'parentId','')::uuid,btrim(row->>'name'),nullif(btrim(row->>'accountCode'),''),
      (row->>'amount')::numeric,(row->>'heldAmount')::numeric,coalesce((row->>'position')::integer,0),caller)
    on conflict(id) do update set parent_id=excluded.parent_id,name=excluded.name,account_code=excluded.account_code,
      amount=excluded.amount,held_amount=excluded.held_amount,position=excluded.position,retired=false,updated_at=now();
  end loop;
  update public.department_fiscal_budgets set sections_version=sections_version+1,updated_at=now() where id=b.id;
  if b.status='locked' then
    insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,reason,metadata)
    values(b.id,p_org_id,'budget_adjusted',0,'Budget sections / holds adjusted: '||btrim(p_reason),caller,btrim(p_reason),
      jsonb_build_object('beforeSections',before_rows,'afterSections',p_sections,'before',b.approved_amount,'after',total,'adjustmentId',adjustment_id));
  end if;
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,reason,org_id)
  select caller,coalesce(full_name,'Head'),'department_budget',b.id::text,'department_budget.sections_saved',
    jsonb_build_object('sections',before_rows),jsonb_build_object('sections',p_sections,'total',total),nullif(btrim(p_reason),''),p_org_id
  from public.profiles where id=caller;
  return b.id;
end;
$$;
create function public.save_office_budget_sections(p_org_id uuid,p_fiscal_year integer,p_sections jsonb,p_expected_version integer,p_reason text,p_settings jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select eflow_budget.save_sections(p_org_id,p_fiscal_year,p_sections,p_expected_version,p_reason,p_settings);
$$;

revoke all on function eflow_budget.section_total(uuid,boolean) from public,anon,authenticated;
revoke all on function eflow_budget.get_sections(uuid,integer),eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb),
  public.get_office_budget_sections(uuid,integer),public.save_office_budget_sections(uuid,integer,jsonb,integer,text,jsonb) from public,anon;
grant execute on function eflow_budget.get_sections(uuid,integer),eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb),
  public.get_office_budget_sections(uuid,integer),public.save_office_budget_sections(uuid,integer,jsonb,integer,text,jsonb) to authenticated,service_role;
alter publication supabase_realtime add table public.office_budget_sections;

-- Deferred checks allow an atomic reclassification without exposing an inconsistent total.
create function eflow_budget.check_section_total() returns trigger language plpgsql security definer set search_path='' as $$
declare budget_id uuid; b public.department_fiscal_budgets;
begin
  if tg_table_name='department_fiscal_budgets' then budget_id := new.id;
  elsif tg_op='DELETE' then budget_id := old.fiscal_budget_id;
  else budget_id := new.fiscal_budget_id; end if;
  select * into b from public.department_fiscal_budgets where id=budget_id;
  if b.sections_version>0 and eflow_budget.section_total(b.id,false)<>b.approved_amount then
    raise exception 'Budget sections must equal the annual appropriation. Use the section adjustment action' using errcode='22023';
  end if;
  return null;
end;
$$;
revoke all on function eflow_budget.check_section_total() from public,anon,authenticated;
create constraint trigger office_budget_sections_total after insert or update or delete on public.office_budget_sections
  deferrable initially deferred for each row execute function eflow_budget.check_section_total();
create constraint trigger office_budget_fiscal_total after insert or update on public.department_fiscal_budgets
  deferrable initially deferred for each row execute function eflow_budget.check_section_total();
commit;
