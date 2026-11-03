
-- Private read helpers: no new client table privileges or direct helper execution.
create function eflow_budget.account_reservations(p_account uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with amounts as (
  select p.id::text id,p.title name,sum(f.amount) amount
  from eflow_project.funding f join public.projects p on p.id=f.project_id
  join public.budget_commitments c on c.id=f.commitment_id
  where f.partition_id=p_account and c.status='active' group by p.id,p.title
  union all
  select t.id::text,t.title,sum(l.amount) from public.work_budget_allocation_lines l
  join public.work_budget_allocations a on a.id=l.allocation_id join public.tasks t on t.id=a.task_id
  join public.budget_commitments c on c.id=a.commitment_id
  where l.budget_partition_id=p_account and l.project_funding_id is null and a.subtask_id is null and a.status='approved' and c.status='active' group by t.id,t.title
  union all
  -- Settled expenses outside active commitments still need protection; never add
  -- settled spending already contained in an active reservation a second time.
  select coalesce(p.id::text,t.id::text),coalesce(p.title,t.title)||' (settled spending)',sum(eflow_budget.request_line_obligation(r.id,l.id))
  from public.petty_cash_requests r join public.petty_cash_request_lines rl on rl.request_id=r.id
  join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
  join public.work_budget_allocations a on a.id=l.allocation_id
  join public.budget_commitments c on c.id=a.commitment_id join public.tasks t on t.id=r.task_id
  left join public.projects p on p.id=t.linked_project_id
  where l.budget_partition_id=p_account and r.status='settled' and c.status<>'active' group by p.id,p.title,t.id,t.title
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'amount',amount) order by name,id) filter(where amount>0),'[]'::jsonb) from amounts
$$;
create function eflow_budget.normalized_accounts(rows jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',r->>'id','name',btrim(r->>'name'),
 'parentId',coalesce(r->>'parentId',r->>'parent_id'),'accountCode',nullif(btrim(coalesce(r->>'accountCode',r->>'account_code')),''),
 'amount',(r->>'amount')::numeric,'heldAmount',coalesce(r->>'heldAmount',r->>'held_amount','0')::numeric,'position',coalesce(r->>'position','0')::int)
 order by coalesce(r->>'position','0')::int,r->>'id'),'[]'::jsonb)
 from jsonb_array_elements(coalesce(rows,'[]'::jsonb)) r where not coalesce((r->>'retired')::boolean,false)
$$;
create function eflow_budget.budget_versions(p_budget uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.department_fiscal_budgets;first_change public.budget_ledger_entries;accounts jsonb;history jsonb;
begin
 select * into b from public.department_fiscal_budgets where id=p_budget;
 if b.id is null or b.status='draft' then return '[]'::jsonb;end if;
 select * into first_change from public.budget_ledger_entries e where e.fiscal_budget_id=b.id and e.metadata?'afterSections' order by e.created_at,e.id limit 1;
 if first_change.id is null then select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into accounts from public.office_budget_sections s where s.fiscal_budget_id=b.id;
 else accounts:=first_change.metadata->'beforeSections';end if;
 select jsonb_build_array(jsonb_build_object('version',1,'total',coalesce((first_change.metadata->>'before')::numeric,b.approved_amount),
 'actorName',coalesce((select full_name from public.profiles where id=b.locked_by),'Head'),'createdAt',b.locked_at,
 'reason','Initial locked budget','accounts',eflow_budget.normalized_accounts(accounts))) into history;
 select history||coalesce(jsonb_agg(jsonb_build_object('version',v.number+1,'total',(v.metadata->>'after')::numeric,
 'actorName',coalesce(v.metadata->>'actorName',p.full_name,'Head'),'createdAt',v.created_at,'reason',v.reason,
 'accounts',eflow_budget.normalized_accounts(v.metadata->'afterSections')) order by v.number),'[]'::jsonb) into history
 from (select e.*,row_number() over(order by e.created_at,e.id) number from public.budget_ledger_entries e where e.fiscal_budget_id=b.id and e.metadata?'afterSections') v
 left join public.profiles p on p.id=v.actor_id;
 return history;
end $$;
revoke all on function eflow_budget.account_reservations(uuid),eflow_budget.normalized_accounts(jsonb),eflow_budget.budget_versions(uuid) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION eflow_budget.save_sections(p_org_id uuid, p_fiscal_year integer, p_sections jsonb, p_expected_version integer, p_reason text, p_settings jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid(); b public.department_fiscal_budgets; row jsonb;
  parent jsonb; parent_key text; seen text[]; total numeric := 0; before_rows jsonb;
  existing_account public.office_budget_sections; proposed jsonb; sources jsonb; minimum_amount numeric;
  lines jsonb := '[]'::jsonb; adjustment_id uuid; row_amount numeric; row_hold numeric;
begin
  if caller is null or not public.is_department_budget_head(p_org_id,caller) then
    raise exception 'Only the office Head can prepare or readjust this budget' using errcode='42501';
  end if;
  if p_fiscal_year is null or p_fiscal_year not between 2000 and 2200 or p_expected_version is null then
    raise exception 'Invalid fiscal year or section version' using errcode='22023';
  end if;
  if p_sections is null or jsonb_typeof(p_sections)<>'array' or jsonb_array_length(p_sections)>250 then
    raise exception 'Use a valid list of at most 250 budget sections' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_sections))<>(select count(distinct value->>'id') from jsonb_array_elements(p_sections)) then
    raise exception 'Account IDs must be unique' using errcode='22023';
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
      raise exception 'Give every account a valid ID and name' using errcode='22023';
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

      -- positive_office_budget_amounts
      if b.status = 'locked' and row_amount <= 0 then
        raise exception 'Enter an amount greater than zero for "%".', btrim(row->>'name') using errcode = '22023';
      end if;
      total := total+row_amount;
      lines := lines||jsonb_build_array(jsonb_build_object('expenseClass',btrim(row->>'name'),'category',btrim(row->>'name'),
        'particular',btrim(row->>'name'),'quantity',1,'unit','authority','unitCost',row_amount,'amount',row_amount,
        'fundSource','Office appropriation','position',coalesce((row->>'position')::integer,0)));
    end if;
    seen := array[row->>'id']; parent_key := nullif(row->>'parentId','');
    while parent_key is not null loop
      if parent_key=any(seen) or cardinality(seen)>=6 then raise exception 'Sections must form a tree of at most six levels' using errcode='22023'; end if;
      select value into parent from jsonb_array_elements(p_sections) where value->>'id'=parent_key and not coalesce((value->>'retired')::boolean,false);
      if parent is null then raise exception 'Choose an existing active parent account' using errcode='22023'; end if;
      seen := array_append(seen,parent_key); parent_key := nullif(parent->>'parentId','');
    end loop;
  end loop;
  if b.id is not null then
    select coalesce(jsonb_agg(to_jsonb(s) order by s.position,s.id),'[]'::jsonb) into before_rows from public.office_budget_sections s where s.fiscal_budget_id=b.id;
  else before_rows := '[]'::jsonb; end if;

  if b.status='locked' then
   -- Run before any account, appropriation, ledger or version is written.
   for existing_account in select * from public.office_budget_sections where fiscal_budget_id=b.id and not retired loop
    sources:=eflow_budget.account_reservations(existing_account.id);
    select coalesce(sum((x->>'amount')::numeric),0) into minimum_amount from jsonb_array_elements(sources) x;
    if minimum_amount>0 then
     select value into proposed from jsonb_array_elements(p_sections) where value->>'id'=existing_account.id::text and not coalesce((value->>'retired')::boolean,false);
     if proposed is null or exists(select 1 from jsonb_array_elements(p_sections) x where x->>'parentId'=existing_account.id::text and not coalesce((x->>'retired')::boolean,false)) then row_amount:=0;row_hold:=0;
     else row_amount:=(proposed->>'amount')::numeric;row_hold:=(proposed->>'heldAmount')::numeric;end if;
     if row_amount-row_hold<minimum_amount then
      raise exception 'Cannot reduce "%" to PHP %. The minimum allowed is PHP %.',existing_account.name,to_char(row_amount,'FM999G999G999G990D00'),to_char(minimum_amount+row_hold,'FM999G999G999G990D00')
       using errcode='23514',detail=jsonb_build_object('kind','budget_account_protected','account',existing_account.name,'entered',row_amount,'minimum',minimum_amount+row_hold,'sources',sources)::text;
     end if;
    end if;
   end loop;
   if eflow_budget.normalized_accounts(before_rows)=eflow_budget.normalized_accounts(p_sections) then raise exception 'No account changes to save.' using errcode='22023';end if;
  end if;

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
  if b.status='locked' and total<>b.approved_amount then adjustment_id:=public.adjust_department_fiscal_budget(b.id,total,p_reason,null);end if;
  update public.department_fiscal_budgets set sections_version=sections_version+1,updated_at=now() where id=b.id;
  if b.status='locked' then
    insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,reason,metadata,created_at)
    values(b.id,p_org_id,'budget_adjusted',0,'Budget sections / holds adjusted: '||btrim(p_reason),caller,btrim(p_reason),
      jsonb_build_object('beforeSections',before_rows,'afterSections',p_sections,'before',b.approved_amount,'after',total,'adjustmentId',adjustment_id,'actorName',(select full_name from public.profiles where id=caller)),clock_timestamp());
  end if;
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,reason,org_id)
  select caller,coalesce(full_name,'Head'),'department_budget',b.id::text,'department_budget.sections_saved',
    jsonb_build_object('sections',before_rows),jsonb_build_object('sections',p_sections,'total',total),nullif(btrim(p_reason),''),p_org_id
  from public.profiles where id=caller;
  return b.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION eflow_budget.get_sections(p_org_id uuid, p_fiscal_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare result jsonb;rows jsonb;

begin

  result:=eflow_budget.pre_financial_get_sections(p_org_id,p_fiscal_year);

  select coalesce(jsonb_agg(section||jsonb_build_object('journalAccountCode',s.journal_account_code,'reservations',eflow_budget.account_reservations(s.id),'protectedAmount',(select coalesce(sum((r->>'amount')::numeric),0) from jsonb_array_elements(eflow_budget.account_reservations(s.id)) r)) order by sections.position), '[]'::jsonb) into rows

    from jsonb_array_elements(result->'sections') with ordinality sections(section,position)

    left join public.office_budget_sections s on s.id=(section->>'id')::uuid;

  return result||jsonb_build_object('sections',rows,'itemizedCashAvailable',true,'canAdjust',public.is_department_budget_head(p_org_id,auth.uid()),'versions',eflow_budget.budget_versions((select id from public.department_fiscal_budgets where org_id=p_org_id and fiscal_year=p_fiscal_year)));

end $function$
;