"""Prepare the reviewed adjustment/version delta from captured hosted functions."""
from pathlib import Path
root=Path(__file__).resolve().parent.parent;base=root/'.codex-tmp/budget-version-baseline'
parts=[r'''
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
''']
def replace(s,old,new):
 assert s.count(old)==1,old
 return s.replace(old,new)
s=(base/'eflow_budget.save_sections.sql').read_text(encoding='utf-8')
s=replace(s,'lines jsonb :=', 'existing_account public.office_budget_sections; proposed jsonb; sources jsonb; minimum_amount numeric;\n  lines jsonb :=')
guard=r'''
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
'''
s=replace(s,"  if b.id is null or b.status='draft' then",guard+"\n  if b.id is null or b.status='draft' then")
# Keep appropriation/account checks atomic, and let all guards see the final rows.
s=replace(s,"    if total<>b.approved_amount then\n      adjustment_id := public.adjust_department_fiscal_budget(b.id,total,p_reason,null);\n    end if;\n",'')
s=replace(s,'  update public.department_fiscal_budgets set sections_version=',"  if b.status='locked' and total<>b.approved_amount then adjustment_id:=public.adjust_department_fiscal_budget(b.id,total,p_reason,null);end if;\n  update public.department_fiscal_budgets set sections_version=")
s=replace(s,"amount,description,actor_id,reason,metadata)\n    values", "amount,description,actor_id,reason,metadata,created_at)\n    values")
s=replace(s,"'adjustmentId',adjustment_id));", "'adjustmentId',adjustment_id,'actorName',(select full_name from public.profiles where id=caller)),clock_timestamp());")
for old,new in [('Only the assigned Head can prepare or adjust budget sections','Only the office Head can prepare or readjust this budget'),('Section IDs must be unique','Account IDs must be unique'),('Give every section a valid ID and name','Give every account a valid ID and name'),('Choose an existing active parent section','Choose an existing active parent account')]:s=s.replace(old,new)
parts.append(s+';')
s=(base/'eflow_budget.get_sections.sql').read_text(encoding='utf-8')
s=replace(s,"jsonb_build_object('journalAccountCode',s.journal_account_code)","jsonb_build_object('journalAccountCode',s.journal_account_code,'reservations',eflow_budget.account_reservations(s.id),'protectedAmount',(select coalesce(sum((r->>'amount')::numeric),0) from jsonb_array_elements(eflow_budget.account_reservations(s.id)) r))")
s=replace(s,"'itemizedCashAvailable',true)","'itemizedCashAvailable',true,'canAdjust',public.is_department_budget_head(p_org_id,auth.uid()),'versions',eflow_budget.budget_versions((select id from public.department_fiscal_budgets where org_id=p_org_id and fiscal_year=p_fiscal_year)))")
parts.append(s+';')
path=root/'supabase/migrations/20261101015139_head_budget_versions_and_adjustment_guards.sql';path.write_text('\n\n'.join(parts),encoding='utf-8');print('Prepared protected adjustments and history from exact live functions.')
