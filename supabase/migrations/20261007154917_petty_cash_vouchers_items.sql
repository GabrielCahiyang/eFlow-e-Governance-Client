begin;
alter table public.office_budget_sections add column journal_account_code text references public.accounting_accounts(code) on delete restrict;
create index office_budget_sections_journal_account_idx on public.office_budget_sections(journal_account_code);
alter table public.petty_cash_requests add column pcv_number bigint, add column pcv_date date, add column funding_lines_payload jsonb;
create unique index petty_cash_pcv_number_idx on public.petty_cash_requests(fiscal_budget_id,pcv_number) where pcv_number is not null;
create table eflow_budget.pcv_counters(fiscal_budget_id uuid primary key references public.department_fiscal_budgets(id),last_number bigint not null);
revoke all on eflow_budget.pcv_counters from public,anon,authenticated;
create table public.petty_cash_request_lines(
  request_id uuid not null references public.petty_cash_requests(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  amount numeric(16,2) not null check(amount>0),primary key(request_id,allocation_line_id)
);
create index petty_cash_request_lines_source_idx on public.petty_cash_request_lines(allocation_line_id,request_id);
create table public.petty_cash_receipt_items(
  id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.petty_cash_receipts(id) on delete restrict,
  allocation_line_id uuid not null references public.work_budget_allocation_lines(id) on delete restrict,
  quantity numeric(16,3) not null check(quantity>0),unit text not null check(length(btrim(unit))>0),
  particular text not null check(length(btrim(particular))>0),purpose text not null check(length(btrim(purpose))>0),
  amount numeric(16,2) not null check(amount>0),position integer not null default 0,
  account_name text not null,account_label text,
  created_at timestamptz not null default now()
);
create index petty_cash_receipt_items_receipt_idx on public.petty_cash_receipt_items(receipt_id,position);
create index petty_cash_receipt_items_source_idx on public.petty_cash_receipt_items(allocation_line_id);
alter table public.petty_cash_request_lines enable row level security;
alter table public.petty_cash_receipt_items enable row level security;
revoke all on public.petty_cash_request_lines,public.petty_cash_receipt_items from public,anon,authenticated;
grant select on public.petty_cash_request_lines,public.petty_cash_receipt_items to authenticated;
grant all on public.petty_cash_request_lines,public.petty_cash_receipt_items to service_role;
create policy petty_cash_request_lines_read on public.petty_cash_request_lines for select to authenticated using(exists(select 1 from public.petty_cash_requests r where r.id=request_id));
create policy petty_cash_receipt_items_read on public.petty_cash_receipt_items for select to authenticated using(exists(select 1 from public.petty_cash_receipts r where r.id=receipt_id));
create trigger petty_cash_receipt_items_immutable before update or delete on public.petty_cash_receipt_items for each row execute function public.prevent_accounting_record_mutation();

insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount)
select id,allocation_line_id,requested_amount from public.petty_cash_requests where allocation_line_id is not null and requested_amount>0;
create function eflow_budget.assign_pcv() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.pcv_number is not null and (new.pcv_number is distinct from old.pcv_number or new.pcv_date is distinct from old.pcv_date) then
    raise exception 'A PCV reference is immutable' using errcode='22023'; end if;
  if new.pcv_number is null and new.status in ('approved','scheduled_for_release','partially_released','released') then
    insert into eflow_budget.pcv_counters(fiscal_budget_id,last_number) values(new.fiscal_budget_id,1)
      on conflict(fiscal_budget_id) do update set last_number=eflow_budget.pcv_counters.last_number+1 returning last_number into new.pcv_number;
    new.pcv_date:=(now() at time zone 'Asia/Manila')::date;
  end if;return new;
end;$$;
create trigger office_budget_pcv before insert or update on public.petty_cash_requests for each row execute function eflow_budget.assign_pcv();

create function eflow_budget.sync_single_cash_line() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.funding_lines_payload is null and new.allocation_line_id is not null then
    delete from public.petty_cash_request_lines where request_id=new.id;
    insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount) values(new.id,new.allocation_line_id,new.requested_amount);
  end if;return new;
end;$$;
create trigger petty_cash_single_line after insert or update of requested_amount,allocation_line_id on public.petty_cash_requests for each row execute function eflow_budget.sync_single_cash_line();

create function eflow_budget.request_line_obligation(p_request uuid,p_line uuid) returns numeric language sql stable set search_path='' as $$
  select case when public.cash_request_obligation(r)=0 then 0
    when r.status='settled' then coalesce((select sum(i.amount) from public.petty_cash_receipt_items i
      join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id
      where li.request_id=r.id and li.status='approved' and i.allocation_line_id=p_line),
      case when r.allocation_line_id=p_line and not exists(select 1 from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id join public.petty_cash_liquidations li on li.id=rc.liquidation_id where li.request_id=r.id and li.status='approved') then r.actual_spent else 0 end)
    else rl.amount*coalesce(r.approved_amount,r.requested_amount)/nullif(r.requested_amount,0) end
  from public.petty_cash_requests r join public.petty_cash_request_lines rl on rl.request_id=r.id where r.id=p_request and rl.allocation_line_id=p_line;
$$;
create or replace function public.task_budget_line_available(p_allocation_line_id uuid,p_exclude_request_id uuid default null)
returns numeric language plpgsql stable security definer set search_path='' as $$
declare l public.work_budget_allocation_lines;a public.work_budget_allocations;caps numeric;used numeric;
begin
  select * into l from public.work_budget_allocation_lines where id=p_allocation_line_id;
  select * into a from public.work_budget_allocations where id=l.allocation_id and subtask_id is null and status='approved';
  if a.id is null then return 0;end if;
  select coalesce(sum(amount),0) into caps from public.work_budget_allocations where task_id=a.task_id and commitment_id=a.commitment_id and subtask_id is not null and parent_allocation_line_id=l.id and status in ('pending','approved');
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) into used from public.petty_cash_requests r
  join public.work_budget_allocations ca on ca.id=r.allocation_id join public.petty_cash_request_lines rl on rl.request_id=r.id and rl.allocation_line_id=l.id
  where r.id is distinct from p_exclude_request_id and (ca.subtask_id is null or ca.status not in ('pending','approved'));
  return greatest(0,l.amount-caps-used);
end;$$;
create or replace function eflow_budget.partition_spent(p_section uuid) returns numeric language sql stable set search_path='' as $$
  select coalesce(sum(eflow_budget.request_line_obligation(r.id,l.id)),0) from public.petty_cash_requests r
    join public.petty_cash_request_lines rl on rl.request_id=r.id join public.work_budget_allocation_lines l on l.id=rl.allocation_line_id
    where r.status='settled' and l.budget_partition_id=p_section;
$$;

create function eflow_budget.cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests; a public.work_budget_allocations; b public.department_fiscal_budgets;
  row jsonb; total numeric:=0;amt numeric;source uuid;first_source uuid;first_amount numeric;seen uuid[]:='{}';created uuid;cap public.work_budget_allocations;payload jsonb;
begin
  if auth.uid() is null or p_key is null or p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Sign in and choose valid funding lines' using errcode='22023';end if;
  if p_needed_by < (now() at time zone 'Asia/Manila')::date then raise exception 'Needed-by date cannot be earlier than today' using errcode='22023';end if;
  payload:=jsonb_build_object('task',p_task,'subtask',p_subtask,'lines',p_lines,'purpose',btrim(p_purpose),'neededBy',p_needed_by);
  -- Follow legacy cash lock order: approved allocation, then fiscal authority.
  select * into a from public.work_budget_allocations where task_id=p_task and subtask_id is null and status='approved' for update;
  if a.id is null then raise exception 'Work has no approved funding' using errcode='22023';end if;
  select fb.* into b from public.department_fiscal_budgets fb join public.budget_commitments c on c.fiscal_budget_id=fb.id where c.id=a.commitment_id for update of fb;
  if p_existing is null then
    select * into r from public.petty_cash_requests where requester_id=auth.uid() and idempotency_key=p_key;
    if r.id is not null then
      if r.funding_lines_payload is distinct from payload then raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;return r.id;
    end if;
  else
    select * into r from public.petty_cash_requests where id=p_existing for update;
    if r.id is null or r.requester_id<>auth.uid() or r.task_id<>p_task or r.subtask_id is distinct from p_subtask then raise exception 'Only the requester can correct this request' using errcode='42501';end if;
  end if;
  if p_subtask is not null then select * into cap from public.work_budget_allocations where task_id=p_task and subtask_id=p_subtask and status='approved';end if;
  for row in select value from jsonb_array_elements(p_lines) loop
    source:=(row->>'allocationLineId')::uuid;amt:=(row->>'amount')::numeric;
    if source is null or source=any(seen) or amt is null or amt<=0 or amt<>round(amt,2) then raise exception 'Choose each source once and positive amounts in cents' using errcode='22023';end if;
    if not exists(select 1 from public.work_budget_allocation_lines where id=source and allocation_id=a.id) then raise exception 'Source belongs to different work' using errcode='42501';end if;
    if cap.id is not null then
      if source is distinct from cap.parent_allocation_line_id or amt>public.subtask_cap_available(cap.id,p_existing) then raise exception 'Request exceeds its protected subtask source cap' using errcode='22023';end if;
    elsif amt>public.task_budget_line_available(source,p_existing) then raise exception 'Funding line has insufficient requestable balance' using errcode='22023';end if;
    if first_source is null then first_source:=source;first_amount:=amt;end if;
    seen:=array_append(seen,source);total:=total+amt;
  end loop;
  if p_existing is null then
    created:=public.create_contextual_cash_request(p_task,p_subtask,first_source,first_amount,p_purpose,p_needed_by,p_key);
  else
    perform eflow_budget.legacy_resubmit_cash(p_existing,first_source,first_amount,p_purpose,p_needed_by);created:=p_existing;
  end if;
  update public.petty_cash_requests set requested_amount=total,funding_lines_payload=payload where id=created;
  delete from public.petty_cash_request_lines where request_id=created;
  insert into public.petty_cash_request_lines(request_id,allocation_line_id,amount) select created,(value->>'allocationLineId')::uuid,(value->>'amount')::numeric from jsonb_array_elements(p_lines);
  return created;
end;$$;
do $$declare definition text;begin
  definition:=pg_get_functiondef('public.resubmit_contextual_cash_request(uuid,uuid,numeric,text,date)'::regprocedure);
  execute replace(definition,'public.resubmit_contextual_cash_request(','eflow_budget.legacy_resubmit_cash(');
end;$$;
create or replace function public.resubmit_contextual_cash_request(p_request_id uuid,p_allocation_line_id uuid,p_amount numeric,p_purpose text,p_needed_by date)
returns void language plpgsql security definer set search_path='' as $$begin
  if exists(select 1 from public.petty_cash_request_lines where request_id=p_request_id group by request_id having count(*)>1) then raise exception 'Correct this multi-account request through its funding lines' using errcode='22023';end if;
  perform eflow_budget.legacy_resubmit_cash(p_request_id,p_allocation_line_id,p_amount,p_purpose,p_needed_by);
end;$$;
create function public.create_contextual_cash_request_v2(p_task uuid,p_subtask uuid,p_lines jsonb,p_purpose text,p_needed_by date,p_key uuid,p_existing uuid default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.cash_request_v2(p_task,p_subtask,p_lines,p_purpose,p_needed_by,p_key,p_existing);$$;

create function eflow_budget.map_account(p_section uuid,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare s public.office_budget_sections;b public.department_fiscal_budgets;previous text;
begin
  select * into s from public.office_budget_sections where id=p_section;
  select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id for update;
  if s.id is null or not public.can_manage_department_accounting(b.org_id,auth.uid()) then raise exception 'Accounting access denied' using errcode='42501';end if;
  if b.status='closed' then raise exception 'Fiscal year is closed' using errcode='22023';end if;
  if not exists(select 1 from public.accounting_accounts where code=p_code and is_active and classification='expense') then raise exception 'Choose an active expense account from the journal catalog' using errcode='22023';end if;
  previous:=s.journal_account_code;
  update public.office_budget_sections set journal_account_code=p_code where id=s.id;
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,before_data,after_data)
    values(auth.uid(),'budget_account',s.id::text,'budget.account_mapped',b.org_id,jsonb_build_object('journalCode',previous),jsonb_build_object('journalCode',p_code));
end;$$;
create function public.map_office_budget_account(p_section uuid,p_code text) returns void language sql security invoker set search_path='' as $$select eflow_budget.map_account(p_section,p_code);$$;

alter table public.petty_cash_liquidations add column itemized_payload jsonb;
create function eflow_budget.submit_items(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text,p_refund_date date)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;li public.petty_cash_liquidations;rc jsonb;item jsonb;receipt_id uuid;source public.work_budget_allocation_lines;
  s public.office_budget_sections;total numeric;item_total numeric;pos integer;amt numeric;payload jsonb;
begin
  select * into r from public.petty_cash_requests where id=p_request for update;
  if r.id is null or auth.uid() is null or (r.requester_id<>auth.uid() and r.cash_recipient_id<>auth.uid()) then raise exception 'Only the cash recipient can submit purchased items' using errcode='42501';end if;
  payload:=jsonb_build_object('spent',p_spent,'note',p_note,'receipts',p_receipts,'refundNumber',p_refund_number,'refundDate',p_refund_date);
  select * into li from public.petty_cash_liquidations where request_id=r.id and idempotency_key=p_key;
  if li.id is not null then
    if li.itemized_payload is distinct from payload then raise exception 'Liquidation key belongs to different receipt items' using errcode='22023';end if;return li.id;
  end if;
  if p_receipts is null or jsonb_typeof(p_receipts)<>'array' or jsonb_array_length(p_receipts)>100 or p_spent is null or p_spent<0 or p_spent<>round(p_spent,2) then raise exception 'Use a valid itemized receipt package' using errcode='22023';end if;
  for rc in select value from jsonb_array_elements(p_receipts) loop
    if rc->'items' is null or jsonb_typeof(rc->'items')<>'array' or jsonb_array_length(rc->'items')>100 or (jsonb_array_length(rc->'items')=0 and (rc->>'amount')::numeric<>0) then raise exception 'List purchased items for every expense receipt' using errcode='22023';end if;
    total:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      amt:=(item->>'amount')::numeric;
      if amt is null or amt<=0 or amt<>round(amt,2) or coalesce((item->>'quantity')::numeric,0)<=0 or nullif(btrim(item->>'unit'),'') is null or nullif(btrim(item->>'particular'),'') is null or nullif(btrim(item->>'purpose'),'') is null then raise exception 'Each item needs quantity, unit, particulars, purpose and a positive line amount' using errcode='22023';end if;
      if not exists(select 1 from public.petty_cash_request_lines where request_id=r.id and allocation_line_id=(item->>'allocationLineId')::uuid) then raise exception 'Purchased item uses an unauthorized funding account' using errcode='42501';end if;
      total:=total+amt;
    end loop;
    if total is distinct from (rc->>'amount')::numeric then raise exception 'Item totals must equal each receipt total' using errcode='22023';end if;
  end loop;
  for source in select l.* from public.work_budget_allocation_lines l join public.petty_cash_request_lines rl on rl.allocation_line_id=l.id where rl.request_id=r.id loop
    select coalesce(sum((it.value->>'amount')::numeric),0) into item_total from jsonb_array_elements(p_receipts) rc,
      lateral jsonb_array_elements(rc.value->'items') it where (it.value->>'allocationLineId')::uuid=source.id;
    if item_total>(select amount from public.petty_cash_request_lines where request_id=r.id and allocation_line_id=source.id) then raise exception 'Spending exceeds this account authorization; obtain reauthorization first' using errcode='22023';end if;
  end loop;
  li.id:=public.submit_accounting_cash_liquidation(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date);
  for rc in select value from jsonb_array_elements(p_receipts) loop
    select id into receipt_id from public.petty_cash_receipts where liquidation_id=li.id and file_path=rc->>'filePath';
    if receipt_id is null then raise exception 'Receipt evidence could not be linked' using errcode='22023';end if;
    pos:=0;
    for item in select value from jsonb_array_elements(rc->'items') loop
      select * into source from public.work_budget_allocation_lines where id=(item->>'allocationLineId')::uuid;
      select * into s from public.office_budget_sections where id=source.budget_partition_id;
      insert into public.petty_cash_receipt_items(receipt_id,allocation_line_id,quantity,unit,particular,purpose,amount,position,account_name,account_label)
      values(receipt_id,source.id,(item->>'quantity')::numeric,btrim(item->>'unit'),btrim(item->>'particular'),btrim(item->>'purpose'),(item->>'amount')::numeric,pos,coalesce(s.name,source.category),s.account_code);
      pos:=pos+1;
    end loop;
  end loop;
  update public.petty_cash_liquidations set itemized_payload=payload where id=li.id;
  return li.id;
end;$$;
create function public.submit_itemized_cash_liquidation(p_request uuid,p_spent numeric,p_note text,p_receipts jsonb,p_key uuid,p_refund_number text default null,p_refund_date date default null)
returns uuid language sql security invoker set search_path='' as $$select eflow_budget.submit_items(p_request,p_spent,p_note,p_receipts,p_key,p_refund_number,p_refund_date);$$;

-- Itemized settlements debit each explicitly mapped expense account, once. Keep legacy posting for old packages.
do $$declare definition text;begin
  definition:=pg_get_functiondef('public.post_liquidation_general_journal()'::regprocedure);
  -- A trigger function cannot be called as an ordinary function. Clone its body in the new trigger below.
end;$$;
create or replace function public.post_liquidation_general_journal() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.petty_cash_requests;settings public.department_accounting_settings;jid uuid;line_no integer:=1;expense record;code text;title text;items_total numeric;
begin
  if new.status<>'approved' or old.status='approved' then return new;end if;
  select * into r from public.petty_cash_requests where id=new.request_id;
  select * into settings from public.department_accounting_settings where fiscal_budget_id=r.fiscal_budget_id;
  if exists(select 1 from public.general_journal_entries where source_type='liquidation' and source_id=new.id) then return new;end if;
  select sum(i.amount) into items_total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=new.id;
  if new.itemized_payload is not null and coalesce(items_total,0) is distinct from new.declared_spent then raise exception 'Purchased item totals do not match declared spending' using errcode='22023';end if;
  insert into public.general_journal_entries(fiscal_budget_id,org_id,entry_date,reference_number,source_type,source_id,memo,posted_by)
    values(r.fiscal_budget_id,r.org_id,coalesce(new.decided_at::date,current_date),new.liquidation_number,'liquidation',new.id,'Settlement for '||r.purpose,coalesce(new.decided_by,auth.uid())) returning id into jid;
  if items_total is not null then
    for expense in select coalesce(s.journal_account_code,m.account_code) as account_code,sum(i.amount) as amount
      from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
      join public.work_budget_allocation_lines l on l.id=i.allocation_line_id
      left join public.office_budget_sections s on s.id=l.budget_partition_id left join public.department_budget_account_mappings m on m.allocation_line_id=l.id
      where rc.liquidation_id=new.id group by coalesce(s.journal_account_code,m.account_code) order by account_code loop
      select a.title into title from public.accounting_accounts a where a.code=expense.account_code and a.classification='expense' and a.is_active;
      if title is null then raise exception 'Map every purchased-item source to an active journal expense account before settlement' using errcode='22023';end if;
      insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,expense.account_code,title,expense.amount,0);line_no:=line_no+1;
    end loop;
  elsif new.declared_spent>0 then
    select coalesce(m.account_code,settings.default_expense_account_code) into code from (select 1) seed left join public.department_budget_account_mappings m on m.allocation_line_id=r.allocation_line_id;
    select a.title into title from public.accounting_accounts a where a.code=code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,code,title,new.declared_spent,0);line_no:=line_no+1;
  end if;
  if new.returned_amount>0 then
    select a.title into title from public.accounting_accounts a where a.code=settings.cash_account_code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.cash_account_code,title,new.returned_amount,0);line_no:=line_no+1;
  end if;
  select a.title into title from public.accounting_accounts a where a.code=settings.advance_account_code;
  insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.advance_account_code,title,0,new.declared_spent+new.returned_amount);
  return new;
end;$$;
revoke all on all functions in schema eflow_budget from public,anon,authenticated;
grant execute on function eflow_budget.get_sections(uuid,integer),eflow_budget.save_sections(uuid,integer,jsonb,integer,text,jsonb),eflow_budget.fund_work(uuid,integer,jsonb,text,uuid),eflow_budget.summary(uuid,integer),eflow_budget.task_context(uuid,uuid),
  eflow_budget.cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),eflow_budget.map_account(uuid,text),eflow_budget.submit_items(uuid,numeric,text,jsonb,uuid,text,date) to authenticated,service_role;
revoke all on function public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) from public,anon;
grant execute on function public.create_contextual_cash_request_v2(uuid,uuid,jsonb,text,date,uuid,uuid),public.map_office_budget_account(uuid,text),public.submit_itemized_cash_liquidation(uuid,numeric,text,jsonb,uuid,text,date) to authenticated,service_role;
alter publication supabase_realtime add table public.petty_cash_request_lines,public.petty_cash_receipt_items;
do $$declare definition text;begin
  definition:=pg_get_functiondef('eflow_budget.get_sections(uuid,integer)'::regprocedure);
  execute replace(definition,'''spentAmount'',eflow_budget.partition_spent(s.id)',
    '''spentAmount'',eflow_budget.partition_spent(s.id),''journalAccountCode'',s.journal_account_code');
  definition:=pg_get_functiondef('eflow_budget.task_context(uuid,uuid)'::regprocedure);
  execute replace(definition,'''fundingOrgId'',b.org_id','''fundingOrgId'',b.org_id,''supportsItemizedCash'',true');
end;$$;
commit;
