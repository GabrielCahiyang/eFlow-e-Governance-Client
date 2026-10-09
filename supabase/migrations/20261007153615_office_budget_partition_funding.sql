begin;
alter table public.budget_commitments alter column proposal_draft_id drop not null;
alter table public.budget_commitments add column funding_kind text not null default 'proposal' check(funding_kind in ('proposal','direct_work')),
  add column authorization_key uuid, add column authorization_payload jsonb;
create unique index budget_commitments_authorization_idx on public.budget_commitments(created_by,authorization_key) where authorization_key is not null;
alter table public.work_budget_allocation_lines add column budget_partition_id uuid references public.office_budget_sections(id) on delete restrict;
create index allocation_lines_partition_idx on public.work_budget_allocation_lines(budget_partition_id,allocation_id);

-- Existing funded records stay classified as opening authority, not inferred photo accounts.
update public.work_budget_allocation_lines l set budget_partition_id=s.id
from public.work_budget_allocations a,public.budget_commitments c,public.office_budget_sections s
where l.allocation_id=a.id and a.commitment_id=c.id and s.fiscal_budget_id=c.fiscal_budget_id
and s.name='Unclassified opening appropriation' and s.parent_id is null;

create function eflow_budget.partition_committed(p_section uuid) returns numeric language sql stable set search_path='' as $$
  select coalesce(sum(l.amount),0) from public.work_budget_allocation_lines l
  join public.work_budget_allocations a on a.id=l.allocation_id join public.budget_commitments c on c.id=a.commitment_id
  where l.budget_partition_id=p_section and a.subtask_id is null and a.status='approved' and c.status='active';
$$;
create function eflow_budget.partition_spent(p_section uuid) returns numeric language sql stable set search_path='' as $$
  select coalesce(sum(r.actual_spent),0) from public.petty_cash_requests r
  join public.work_budget_allocation_lines l on l.id=r.allocation_line_id where l.budget_partition_id=p_section and r.status='settled';
$$;

create function eflow_budget.guard_partition_funding() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.work_budget_allocations; b public.department_fiscal_budgets; source public.office_budget_sections;
  desired uuid; matched integer; draft_line jsonb;
begin
  select * into a from public.work_budget_allocations where id=new.allocation_id;
  select fb.* into b from public.department_fiscal_budgets fb join public.budget_commitments c on c.fiscal_budget_id=fb.id where c.id=a.commitment_id for update of fb;
  if b.status<>'locked' then raise exception 'Funding requires a locked annual budget' using errcode='22023'; end if;
  if a.subtask_id is not null then
    select budget_partition_id into new.budget_partition_id from public.work_budget_allocation_lines where id=a.parent_allocation_line_id;
    return new; -- A subtask cap is inside the parent charge, never another annual obligation.
  end if;
  desired := new.budget_partition_id;
  if desired is null and new.draft_task_key is not null then
    select ln.value into draft_line from public.budget_commitments c
    join public.proposal_collaboration_revisions rev on rev.id=c.proposal_revision_id,
    lateral jsonb_array_elements(rev.snapshot->'budget'->'taskBudgets') tb,
    lateral jsonb_array_elements(tb.value->'lines') ln
    where c.id=a.commitment_id and tb.value->>'taskKey'=new.draft_task_key
      and coalesce((ln.value->>'position')::integer,0)=new.position limit 1;
    desired := nullif(draft_line->>'budgetPartitionId','')::uuid;
  end if;
  if desired is null then
    select count(*),(array_agg(s.id))[1] into matched,desired from public.office_budget_sections s
    where s.fiscal_budget_id=b.id and not s.retired and not exists(select 1 from public.office_budget_sections ch where ch.parent_id=s.id and not ch.retired)
    and (s.name=new.category or s.name='Unclassified opening appropriation');
    if matched<>1 then raise exception 'Choose an annual budget account for every funded line' using errcode='22023'; end if;
  end if;
  select * into source from public.office_budget_sections where id=desired and fiscal_budget_id=b.id and not retired;
  if source.id is null or exists(select 1 from public.office_budget_sections where parent_id=source.id and not retired) then
    raise exception 'Choose an active lowest-level account from the funding Office and fiscal year' using errcode='22023';
  end if;
  if a.status='approved' and eflow_budget.partition_committed(source.id)
    - coalesce((select l.amount from public.work_budget_allocation_lines l where l.id=new.id and l.budget_partition_id=source.id),0)
    + new.amount > source.amount-source.held_amount then
    raise exception 'Account % has insufficient released budget; held funds cannot be committed',source.name using errcode='22023';
  end if;
  new.budget_partition_id:=source.id;
  return new;
end;
$$;
create trigger office_budget_allocation_partition before insert or update on public.work_budget_allocation_lines for each row execute function eflow_budget.guard_partition_funding();

create function eflow_budget.check_partition_balances() returns trigger language plpgsql security definer set search_path='' as $$
declare section_row public.office_budget_sections;
begin
  -- The fiscal-row lock in every authorizer serializes account checks and concurrent adjustments.
  if tg_table_name='office_budget_sections' then
    select * into section_row from public.office_budget_sections where id=coalesce(new.id,old.id);
    if section_row.id is not null and eflow_budget.partition_committed(section_row.id)>0 and
      (section_row.retired or eflow_budget.partition_committed(section_row.id)>section_row.amount-section_row.held_amount
      or exists(select 1 from public.office_budget_sections where parent_id=section_row.id and not retired)) then
      raise exception 'A funded account cannot be deleted, held below its commitments or converted into a parent' using errcode='22023';
    end if;
  end if;
  return null;
end;
$$;
create constraint trigger office_budget_sections_funding_check after insert or update on public.office_budget_sections
deferrable initially deferred for each row execute function eflow_budget.check_partition_balances();

create or replace function eflow_budget.get_sections(p_org_id uuid,p_fiscal_year integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.department_fiscal_budgets; rows jsonb;
begin
  if auth.uid() is null or not public.can_view_department_budget(p_org_id,auth.uid()) then raise exception 'Budget access denied' using errcode='42501'; end if;
  select * into b from public.department_fiscal_budgets where org_id=p_org_id and fiscal_year=p_fiscal_year;
  if not found then return jsonb_build_object('version',0,'sections','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'parentId',s.parent_id,'name',s.name,'accountCode',s.account_code,
    'amount',s.amount,'heldAmount',s.held_amount,'position',s.position,'retired',s.retired,
    'committedAmount',eflow_budget.partition_committed(s.id),'spentAmount',eflow_budget.partition_spent(s.id)) order by s.position,s.id),'[]'::jsonb)
  into rows from public.office_budget_sections s where s.fiscal_budget_id=b.id;
  return jsonb_build_object('version',b.sections_version,'sections',rows);
end;
$$;

create function eflow_budget.fund_work(p_task_id uuid,p_fiscal_year integer,p_lines jsonb,p_reason text,p_authorization_key uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); t public.tasks; b public.department_fiscal_budgets; existing public.budget_commitments;
  payload jsonb; c_id uuid; a_id uuid; total numeric:=0; line jsonb; source public.office_budget_sections; seen uuid[]:='{}'; amt numeric;
begin
  if caller is null then raise exception 'Sign in to authorize funding' using errcode='42501'; end if;
  select * into t from public.tasks where id=p_task_id and deleted_at is null;
  if t.id is null or not public.is_department_budget_head(t.org_id,caller) or not public.can_see_task(t.id,caller) then
    raise exception 'Only the responsible Office Head can fund this work' using errcode='42501';
  end if;
  if p_authorization_key is null or nullif(btrim(p_reason),'') is null or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then
    raise exception 'Choose accounts, positive amounts, an authority reference and a command key' using errcode='22023';
  end if;
  payload:=jsonb_build_object('taskId',p_task_id,'fiscalYear',p_fiscal_year,'lines',p_lines,'reason',btrim(p_reason));
  select * into b from public.department_fiscal_budgets where org_id=t.org_id and fiscal_year=p_fiscal_year and status='locked' for update;
  if not found then raise exception 'Lock this fiscal year budget first' using errcode='22023'; end if;
  select * into existing from public.budget_commitments where created_by=caller and authorization_key=p_authorization_key;
  if existing.id is not null then
    if existing.authorization_payload is distinct from payload then raise exception 'Command key already belongs to different funding' using errcode='22023'; end if;
    return existing.id;
  end if;
  select * into t from public.tasks where id=p_task_id and deleted_at is null for update;
  if t.id is null or t.org_id is distinct from b.org_id or not public.is_department_budget_head(t.org_id,caller) or not public.can_see_task(t.id,caller) then
    raise exception 'Task responsibility changed; refresh before authorizing funding' using errcode='42501';
  end if;
  if t.archived_at is not null or t.status in ('completed','cancelled') or exists(select 1 from public.tasks where id=t.id and proposed_office_identity_id is not null) then
    raise exception 'Resolve proposed Office responsibility and choose open work before funding' using errcode='42501';
  end if;
  if exists(select 1 from public.work_budget_allocations where task_id=t.id and subtask_id is null and status='approved') then
    raise exception 'This task already has approved funding; it cannot be charged twice' using errcode='22023';
  end if;
  for line in select value from jsonb_array_elements(p_lines) loop
    amt:=(line->>'amount')::numeric;
    if amt is null or amt<=0 or amt<>round(amt,2) or amt>90000000000 then raise exception 'Enter positive amounts in cents' using errcode='22023'; end if;
    select * into source from public.office_budget_sections where id=(line->>'partitionId')::uuid and fiscal_budget_id=b.id and not retired;
    if source.id is null or source.id=any(seen) or exists(select 1 from public.office_budget_sections where parent_id=source.id and not retired) then
      raise exception 'Choose each active account once from this Office and fiscal year' using errcode='22023';
    end if;
    if amt>source.amount-source.held_amount-eflow_budget.partition_committed(source.id) then
      raise exception 'Account % has insufficient released budget',source.name using errcode='22023'; end if;
    seen:=array_append(seen,source.id); total:=total+amt;
  end loop;
  if total>b.approved_amount-eflow_budget.section_total(b.id,true)-(select coalesce(sum(amount),0) from public.budget_commitments where fiscal_budget_id=b.id and status='active') then
    raise exception 'Insufficient released Office budget' using errcode='22023'; end if;
  insert into public.budget_commitments(fiscal_budget_id,title,amount,created_by,funding_kind,authorization_key,authorization_payload)
    values(b.id,t.title,total,caller,'direct_work',p_authorization_key,payload) returning id into c_id;
  insert into public.work_budget_allocations(commitment_id,task_id,amount,status,reason,requested_by,decided_by,decision_reason,decided_at)
    values(c_id,t.id,total,'approved',btrim(p_reason),caller,caller,'Authorized direct work funding',now()) returning id into a_id;
  for line in select value from jsonb_array_elements(p_lines) loop
    select * into source from public.office_budget_sections where id=(line->>'partitionId')::uuid;
    insert into public.work_budget_allocation_lines(allocation_id,budget_partition_id,expense_class,category,particular,quantity,unit,unit_cost,amount,fund_source,position)
    values(a_id,source.id,'Office appropriation',source.name,coalesce(nullif(btrim(line->>'particular'),''),t.title),1,'allocation',
      (line->>'amount')::numeric,(line->>'amount')::numeric,'Office Budget',array_position(seen,source.id)-1);
  end loop;
  insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,allocation_id,task_id,entry_type,amount,description,actor_id,reason,metadata)
    values(b.id,b.org_id,c_id,a_id,t.id,'proposal_committed',total,'Direct work funding authorized: '||t.title,caller,btrim(p_reason),jsonb_build_object('fundingKind','direct_work','partitionLines',p_lines,'taskId',t.id));
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason)
    values(caller,'task',t.id::text,'budget.direct_work_authorized',b.org_id,payload,btrim(p_reason));
  return c_id;
end;
$$;
create function public.fund_office_work(p_task_id uuid,p_fiscal_year integer,p_lines jsonb,p_reason text,p_authorization_key uuid)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.fund_work(p_task_id,p_fiscal_year,p_lines,p_reason,p_authorization_key);$$;

-- Compatibility wrappers retain existing JSON keys, permissions and underlying operations.
do $$declare definition text;begin
  definition:=pg_get_functiondef('public.department_budget_summary(uuid,integer)'::regprocedure);
  execute replace(definition,'public.department_budget_summary(','eflow_budget.legacy_summary(');
  definition:=pg_get_functiondef('public.get_task_funding_context(uuid,uuid)'::regprocedure);
  execute replace(definition,'public.get_task_funding_context(','eflow_budget.legacy_task_context(');
end;$$;
create function eflow_budget.summary(p_org_id uuid,p_fiscal_year integer) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare original jsonb; held numeric;begin
  original:=eflow_budget.legacy_summary(p_org_id,p_fiscal_year);
  if original is null then return null;end if;
  held:=eflow_budget.section_total((original->>'id')::uuid,true);
  return original||jsonb_build_object('heldAmount',held,'budgetReleasedAmount',(original->>'approvedAmount')::numeric-held,
    'availableAmount',(original->>'approvedAmount')::numeric-held-(original->>'committedAmount')::numeric);
end;$$;
create or replace function public.department_budget_summary(p_org_id uuid,p_fiscal_year integer) returns jsonb language sql stable security invoker set search_path='' as $$select eflow_budget.summary(p_org_id,p_fiscal_year);$$;
create function eflow_budget.task_context(p_task_id uuid,p_subtask_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare original jsonb; b public.department_fiscal_budgets;begin
  original:=eflow_budget.legacy_task_context(p_task_id,p_subtask_id);
  if not coalesce((original->>'funded')::boolean,false) then return original;end if;
  select fb.* into b from public.department_fiscal_budgets fb join public.budget_commitments c on c.fiscal_budget_id=fb.id
  join public.work_budget_allocations a on a.commitment_id=c.id where a.id=(original->>'taskAllocationId')::uuid;
  return original||jsonb_build_object('fiscalYear',b.fiscal_year,'fundingOrgId',b.org_id);
end;$$;
create or replace function public.get_task_funding_context(p_task_id uuid,p_subtask_id uuid default null) returns jsonb language sql stable security invoker set search_path='' as $$select eflow_budget.task_context(p_task_id,p_subtask_id);$$;

revoke all on all functions in schema eflow_budget from public,anon,authenticated;
grant execute on function eflow_budget.get_sections(uuid,integer),eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb),
 eflow_budget.fund_work(uuid,integer,jsonb,text,uuid),eflow_budget.summary(uuid,integer),eflow_budget.task_context(uuid,uuid) to authenticated,service_role;
revoke all on function public.fund_office_work(uuid,integer,jsonb,text,uuid) from public,anon;
grant execute on function public.fund_office_work(uuid,integer,jsonb,text,uuid) to authenticated,service_role;
commit;
