from pathlib import Path
r=Path.cwd();base=r/'.codex-tmp/budget-release-baseline'
def source(name):
 s=(base/(name+'.sql')).read_text(encoding='utf-8');return '\n'.join(line for line in s.splitlines() if line.strip())
def replace(s,a,b):
 assert s.count(a)==1,(a,s.count(a));return s.replace(a,b)
parts=["alter table public.office_budget_sections add column release_schedule jsonb not null default '[]'::jsonb check(jsonb_typeof(release_schedule)='array');"]
# Schedule validation executes under the existing Head scope and annual-budget lock.
s=source('eflow_budget.save_sections')
s=replace(s,'  lines jsonb :=', "  entry jsonb; prior_entry jsonb; prior_schedule jsonb; schedule jsonb; old_account public.office_budget_sections; due date; held numeric; normalized jsonb:='[]'::jsonb;\n  lines jsonb :=")
marker='  for row in select value from jsonb_array_elements(p_sections) loop'
validation='''  if p_settings->>'threshold' is null or (p_settings->>'threshold')::numeric not between 0 and 100 or (p_settings->>'threshold')::numeric<>round((p_settings->>'threshold')::numeric,2) then
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
      if nullif(entry->>'id','') is null or coalesce(entry->>'date','')!~'^\\d{4}-\\d{2}-\\d{2}$' then raise exception 'Choose a date for every scheduled release.' using errcode='22023';end if;
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
'''
s=s.replace(marker,validation+marker,1)
s=replace(s,"if eflow_budget.normalized_accounts(before_rows)=eflow_budget.normalized_accounts(p_sections) then", "if eflow_budget.normalized_accounts(before_rows)=eflow_budget.normalized_accounts(p_sections) and b.underutilization_threshold=(p_settings->>'threshold')::numeric then")
s=replace(s,'amount,held_amount,position,created_by)','amount,held_amount,release_schedule,position,created_by)')
s=replace(s,"(row->>'amount')::numeric,(row->>'heldAmount')::numeric,coalesce", "(row->>'amount')::numeric,(row->>'heldAmount')::numeric,row->'releaseSchedule',coalesce")
s=replace(s,'amount=excluded.amount,held_amount=excluded.held_amount,position=', 'amount=excluded.amount,held_amount=excluded.held_amount,release_schedule=excluded.release_schedule,position=')
s=replace(s,'set sections_version=sections_version+1,updated_at=now()',"set sections_version=sections_version+1,underutilization_threshold=(p_settings->>'threshold')::numeric,updated_at=now()")
s=replace(s,"'beforeSections',before_rows,'afterSections',p_sections,", "'beforeSections',before_rows,'afterSections',p_sections,'beforeQ4Target',b.underutilization_threshold,'afterQ4Target',(p_settings->>'threshold')::numeric,")
parts.append(s+';')
s=source('eflow_budget.normalized_accounts');s=replace(s,"'amount',(r->>'amount')::numeric,", "'releaseSchedule',coalesce(r->'releaseSchedule',r->'release_schedule','[]'::jsonb),'amount',(r->>'amount')::numeric,");parts.append(s+';')
s=source('eflow_budget.budget_versions');s=replace(s,"'reason','Initial locked budget',", "'q4Target',coalesce((first_change.metadata->>'beforeQ4Target')::numeric,b.underutilization_threshold),'reason','Initial locked budget',");s=replace(s,"'actorName',coalesce(v.metadata", "'q4Target',coalesce((v.metadata->>'afterQ4Target')::numeric,b.underutilization_threshold),'actorName',coalesce(v.metadata");parts.append(s+';')
s=source('eflow_budget.get_sections');s=replace(s,"'journalAccountCode',s.journal_account_code,", "'releaseSchedule',s.release_schedule,'journalAccountCode',s.journal_account_code,");s=replace(s,"'itemizedCashAvailable',true,", "'releaseScheduleAvailable',true,'canConfirmReleases',exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=p_org_id and p.is_active and p.role='accounting_staff'),'itemizedCashAvailable',true,");parts.append(s+';')
parts.append('''
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
''')
name='20261101130241_office_budget_release_calendar.sql';(r/'supabase/migrations'/name).write_text('\n\n'.join(parts),encoding='utf-8');print('Prepared',name)
