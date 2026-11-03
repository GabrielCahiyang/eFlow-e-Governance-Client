alter table public.office_budget_sections add column release_schedule jsonb not null default '[]'::jsonb check(jsonb_typeof(release_schedule)='array');

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
  entry jsonb; prior_entry jsonb; prior_schedule jsonb; schedule jsonb; old_account public.office_budget_sections; due date; held numeric; normalized jsonb:='[]'::jsonb;
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
  if p_settings->>'threshold' is null or (p_settings->>'threshold')::numeric not between 0 and 100 or (p_settings->>'threshold')::numeric<>round((p_settings->>'threshold')::numeric,2) then
    raise exception 'Enter a Q4 target from 0 to 100 percent.' using errcode='22023';
  end if;
  for row in select value from jsonb_array_elements(p_sections) loop
    if coalesce((row->>'retired')::boolean,false) then continue;end if;
    schedule:=coalesce(row->'releaseSchedule','[]'::jsonb);
    if jsonb_typeof(schedule)<>'array' or jsonb_array_length(schedule)>100 then raise exception 'Use up to 100 scheduled releases per account.' using errcode='22023';end if;
    if (select count(*) from jsonb_array_elements(schedule))<>(select count(distinct x->>'id') from jsonb_array_elements(schedule) x) then raise exception 'Each scheduled release needs a unique ID.' using errcode='22023';end if;
    select * into old_account from public.office_budget_sections where id=(row->>'id')::uuid and fiscal_budget_id=b.id;
    prior_schedule:=coalesce(old_account.release_schedule,'[]'::jsonb);held:=0;
    for entry in select value from jsonb_array_elements(schedule) loop
      perform (entry->>'id')::uuid;
      if nullif(entry->>'id','') is null or coalesce(entry->>'date','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Choose a date for every scheduled release.' using errcode='22023';end if;
      due:=(entry->>'date')::date;
      if extract(year from due)<>p_fiscal_year then raise exception 'Release dates must be within fiscal year %.',p_fiscal_year using errcode='22023';end if;
      if (entry->>'amount') is null or (entry->>'amount')::numeric<=0 or (entry->>'amount')::numeric>90000000000 or (entry->>'amount')::numeric<>round((entry->>'amount')::numeric,2) then raise exception 'Enter a positive release amount in pesos and cents.' using errcode='22023';end if;
      if entry->>'status' not in ('pending','confirmed') or entry->>'status' is null then raise exception 'Invalid release status.' using errcode='22023';end if;
      select value into prior_entry from jsonb_array_elements(prior_schedule) where value->>'id'=entry->>'id';
      if entry->>'status'='confirmed' or prior_entry->>'status'='confirmed' then
        if prior_entry is null or prior_entry<>entry then raise exception 'Only Accounting can confirm a release. Confirmed releases cannot be edited.' using errcode='42501';end if;
      else
        if entry ?| array['confirmedAt','confirmedBy','confirmedByName'] then raise exception 'Only Accounting can record release confirmation.' using errcode='42501';end if;
        held:=held+(entry->>'amount')::numeric;
      end if;
    end loop;
    if exists(select 1 from jsonb_array_elements(prior_schedule) e where e->>'status'='confirmed' and not schedule @> jsonb_build_array(e)) then raise exception 'Confirmed releases must remain in the history.' using errcode='22023';end if;
    if (select coalesce(sum((e->>'amount')::numeric),0) from jsonb_array_elements(schedule) e)>(row->>'amount')::numeric then raise exception 'Scheduled releases exceed the budget for "%".',row->>'name' using errcode='23514';end if;
    if b.status='locked' and held<coalesce(old_account.held_amount,0) then raise exception 'Accounting must confirm availability before held money can be released. You can change release dates without reducing the pending total.' using errcode='42501';end if;
    row:=jsonb_set(jsonb_set(row,'{heldAmount}',to_jsonb(held)),'{releaseSchedule}',schedule);normalized:=normalized||jsonb_build_array(row);
  end loop;
  if b.status='locked' and exists(select 1 from public.office_budget_sections a where a.fiscal_budget_id=b.id and not a.retired and (a.held_amount>0 or jsonb_array_length(a.release_schedule)>0) and not exists(select 1 from jsonb_array_elements(normalized) x where x->>'id'=a.id::text)) then raise exception 'Keep accounts with pending or confirmed releases in the budget.' using errcode='22023';end if;
  p_sections:=normalized;
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
   if eflow_budget.normalized_accounts(before_rows)=eflow_budget.normalized_accounts(p_sections) and b.underutilization_threshold=(p_settings->>'threshold')::numeric then raise exception 'No account changes to save.' using errcode='22023';end if;
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
    insert into public.office_budget_sections(id,fiscal_budget_id,parent_id,name,account_code,amount,held_amount,release_schedule,position,created_by)
    values ((row->>'id')::uuid,b.id,nullif(row->>'parentId','')::uuid,btrim(row->>'name'),nullif(btrim(row->>'accountCode'),''),
      (row->>'amount')::numeric,(row->>'heldAmount')::numeric,row->'releaseSchedule',coalesce((row->>'position')::integer,0),caller)
    on conflict(id) do update set parent_id=excluded.parent_id,name=excluded.name,account_code=excluded.account_code,
      amount=excluded.amount,held_amount=excluded.held_amount,release_schedule=excluded.release_schedule,position=excluded.position,retired=false,updated_at=now();
  end loop;
  if b.status='locked' and total<>b.approved_amount then adjustment_id:=public.adjust_department_fiscal_budget(b.id,total,p_reason,null);end if;
  update public.department_fiscal_budgets set sections_version=sections_version+1,underutilization_threshold=(p_settings->>'threshold')::numeric,updated_at=now() where id=b.id;
  if b.status='locked' then
    insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,reason,metadata,created_at)
    values(b.id,p_org_id,'budget_adjusted',0,'Budget sections / holds adjusted: '||btrim(p_reason),caller,btrim(p_reason),
      jsonb_build_object('beforeSections',before_rows,'afterSections',p_sections,'beforeQ4Target',b.underutilization_threshold,'afterQ4Target',(p_settings->>'threshold')::numeric,'before',b.approved_amount,'after',total,'adjustmentId',adjustment_id,'actorName',(select full_name from public.profiles where id=caller)),clock_timestamp());
  end if;
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,reason,org_id)
  select caller,coalesce(full_name,'Head'),'department_budget',b.id::text,'department_budget.sections_saved',
    jsonb_build_object('sections',before_rows),jsonb_build_object('sections',p_sections,'total',total),nullif(btrim(p_reason),''),p_org_id
  from public.profiles where id=caller;
  return b.id;
end;
$function$;

CREATE OR REPLACE FUNCTION eflow_budget.normalized_accounts(rows jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select coalesce(jsonb_agg(jsonb_build_object('id',r->>'id','name',btrim(r->>'name'),
 'parentId',coalesce(r->>'parentId',r->>'parent_id'),'accountCode',nullif(btrim(coalesce(r->>'accountCode',r->>'account_code')),''),
 'releaseSchedule',coalesce(r->'releaseSchedule',r->'release_schedule','[]'::jsonb),'amount',(r->>'amount')::numeric,'heldAmount',coalesce(r->>'heldAmount',r->>'held_amount','0')::numeric,'position',coalesce(r->>'position','0')::int)
 order by coalesce(r->>'position','0')::int,r->>'id'),'[]'::jsonb)
 from jsonb_array_elements(coalesce(rows,'[]'::jsonb)) r where not coalesce((r->>'retired')::boolean,false)
$function$;

CREATE OR REPLACE FUNCTION eflow_budget.budget_versions(p_budget uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare b public.department_fiscal_budgets;first_change public.budget_ledger_entries;accounts jsonb;history jsonb;
begin
 select * into b from public.department_fiscal_budgets where id=p_budget;
 if b.id is null or b.status='draft' then return '[]'::jsonb;end if;
 select * into first_change from public.budget_ledger_entries e where e.fiscal_budget_id=b.id and e.metadata?'afterSections' order by e.created_at,e.id limit 1;
 if first_change.id is null then select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) into accounts from public.office_budget_sections s where s.fiscal_budget_id=b.id;
 else accounts:=first_change.metadata->'beforeSections';end if;
 select jsonb_build_array(jsonb_build_object('version',1,'total',coalesce((first_change.metadata->>'before')::numeric,b.approved_amount),
 'actorName',coalesce((select full_name from public.profiles where id=b.locked_by),'Head'),'createdAt',b.locked_at,
 'q4Target',coalesce((first_change.metadata->>'beforeQ4Target')::numeric,b.underutilization_threshold),'reason','Initial locked budget','accounts',eflow_budget.normalized_accounts(accounts))) into history;
 select history||coalesce(jsonb_agg(jsonb_build_object('version',v.number+1,'total',(v.metadata->>'after')::numeric,
 'q4Target',coalesce((v.metadata->>'afterQ4Target')::numeric,b.underutilization_threshold),'actorName',coalesce(v.metadata->>'actorName',p.full_name,'Head'),'createdAt',v.created_at,'reason',v.reason,
 'accounts',eflow_budget.normalized_accounts(v.metadata->'afterSections')) order by v.number),'[]'::jsonb) into history
 from (select e.*,row_number() over(order by e.created_at,e.id) number from public.budget_ledger_entries e where e.fiscal_budget_id=b.id and e.metadata?'afterSections') v
 left join public.profiles p on p.id=v.actor_id;
 return history;
end $function$;

CREATE OR REPLACE FUNCTION eflow_budget.get_sections(p_org_id uuid, p_fiscal_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;rows jsonb;
begin
  result:=eflow_budget.pre_financial_get_sections(p_org_id,p_fiscal_year);
  select coalesce(jsonb_agg(section||jsonb_build_object('releaseSchedule',s.release_schedule,'journalAccountCode',s.journal_account_code,'reservations',eflow_budget.account_reservations(s.id),'protectedAmount',(select coalesce(sum((r->>'amount')::numeric),0) from jsonb_array_elements(eflow_budget.account_reservations(s.id)) r)) order by sections.position), '[]'::jsonb) into rows
    from jsonb_array_elements(result->'sections') with ordinality sections(section,position)
    left join public.office_budget_sections s on s.id=(section->>'id')::uuid;
  return result||jsonb_build_object('sections',rows,'releaseScheduleAvailable',true,'canConfirmReleases',exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=p_org_id and p.is_active and p.role='accounting_staff'),'itemizedCashAvailable',true,'canAdjust',public.is_department_budget_head(p_org_id,auth.uid()),'versions',eflow_budget.budget_versions((select id from public.department_fiscal_budgets where org_id=p_org_id and fiscal_year=p_fiscal_year)));
end $function$;


create function eflow_budget.confirm_release(p_account uuid,p_release uuid,p_expected_version integer,p_reference text) returns uuid
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid();a public.office_budget_sections;b public.department_fiscal_budgets;e jsonb;confirmed jsonb;before_rows jsonb;after_rows jsonb;release_amount numeric;
begin
 select * into a from public.office_budget_sections where id=p_account;
 select * into b from public.department_fiscal_budgets where id=a.fiscal_budget_id;
 if caller is null or b.id is null or not exists(select 1 from public.profiles p where p.id=caller and p.org_id=b.org_id and p.is_active and p.role='accounting_staff') then raise exception 'Only the office Accounting Officer can confirm availability.' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(b.org_id::text||':'||b.fiscal_year::text,0));
 select * into b from public.department_fiscal_budgets where id=b.id for update;
 select * into a from public.office_budget_sections where id=p_account and not retired for update;
 if a.id is null or b.status<>'locked' or exists(select 1 from public.office_budget_sections where parent_id=a.id and not retired) then raise exception 'Confirm releases on an active account in a locked budget.' using errcode='22023';end if;
 select value into e from jsonb_array_elements(a.release_schedule) where value->>'id'=p_release::text;
 if e is null then raise exception 'This scheduled release was not found. Check the latest budget.' using errcode='22023';end if;
 if e->>'status'='confirmed' then return b.id;end if;
 if p_expected_version is null or b.sections_version<>p_expected_version then raise exception 'The budget changed. Check the latest schedule before confirming.' using errcode='40001';end if;
 if (e->>'date')::date>(now() at time zone 'Asia/Manila')::date then raise exception 'This release is not due yet.' using errcode='22023';end if;
 if nullif(btrim(p_reference),'') is null or length(p_reference)>1000 then raise exception 'Enter the release reference or note.' using errcode='22023';end if;
 release_amount:=(e->>'amount')::numeric;
 if release_amount<=0 or a.held_amount<release_amount then raise exception 'The held amount changed. Check the latest schedule.' using errcode='23514';end if;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.position,s.id),'[]'::jsonb) into before_rows from public.office_budget_sections s where s.fiscal_budget_id=b.id;
 confirmed:=e||jsonb_build_object('status','confirmed','confirmedAt',clock_timestamp(),'confirmedBy',caller,'confirmedByName',(select full_name from public.profiles where id=caller),'reference',btrim(p_reference));
 update public.office_budget_sections set release_schedule=(select jsonb_agg(case when value->>'id'=p_release::text then confirmed else value end order by n) from jsonb_array_elements(a.release_schedule) with ordinality x(value,n)),held_amount=held_amount-release_amount,updated_at=now() where id=a.id;
 update public.department_fiscal_budgets set sections_version=sections_version+1,updated_at=now() where id=b.id;
 select coalesce(jsonb_agg(to_jsonb(s) order by s.position,s.id),'[]'::jsonb) into after_rows from public.office_budget_sections s where s.fiscal_budget_id=b.id;
 insert into public.budget_ledger_entries(fiscal_budget_id,org_id,entry_type,amount,description,actor_id,reason,metadata,created_at)
 values(b.id,b.org_id,'budget_adjusted',0,'Scheduled budget release confirmed: '||a.name,caller,btrim(p_reference),jsonb_build_object('beforeSections',before_rows,'afterSections',after_rows,'before',b.approved_amount,'after',b.approved_amount,'beforeQ4Target',b.underutilization_threshold,'afterQ4Target',b.underutilization_threshold,'releaseId',p_release,'releasedAmount',release_amount,'actorName',(select full_name from public.profiles where id=caller)),clock_timestamp());
 insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,reason,org_id)
 values(caller,(select full_name from public.profiles where id=caller),'department_budget',b.id::text,'department_budget.release_confirmed',e,confirmed,btrim(p_reference),b.org_id);
 return b.id;
end $$;
create function public.confirm_office_budget_release(p_account uuid,p_release uuid,p_expected_version integer,p_reference text) returns uuid language sql set search_path='' as $$select eflow_budget.confirm_release(p_account,p_release,p_expected_version,p_reference);$$;
revoke all on function eflow_budget.confirm_release(uuid,uuid,integer,text),public.confirm_office_budget_release(uuid,uuid,integer,text) from public,anon;
grant execute on function eflow_budget.confirm_release(uuid,uuid,integer,text),public.confirm_office_budget_release(uuid,uuid,integer,text) to authenticated;
notify pgrst,'reload schema';
