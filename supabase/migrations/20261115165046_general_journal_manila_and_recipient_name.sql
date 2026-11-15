CREATE OR REPLACE FUNCTION public.post_cash_release_general_journal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'Asia/Manila'
AS $function$
declare
  request public.petty_cash_requests;
  settings public.department_accounting_settings;
  journal_id uuid;
  cash_title text;
  advance_title text;
  recipient_name text;
begin
  if new.status <> 'released' or old.status = 'released' then return new; end if;
  select * into request from public.petty_cash_requests where id = new.request_id;
  select * into settings from public.department_accounting_settings where fiscal_budget_id = request.fiscal_budget_id;
  select title into cash_title from public.accounting_accounts where code = settings.cash_account_code;
  select title into advance_title from public.accounting_accounts where code = settings.advance_account_code;
  select nullif(trim(full_name), '') into recipient_name from public.profiles where id = coalesce(request.cash_recipient_id, request.requester_id);
  insert into public.general_journal_entries(
    fiscal_budget_id, org_id, entry_date, reference_number, source_type, source_id, memo, posted_by
  ) values (
    request.fiscal_budget_id, request.org_id,
    coalesce((new.released_at at time zone 'Asia/Manila')::date, (now() at time zone 'Asia/Manila')::date),
    new.voucher_number, 'cash_release', new.id,
    format('Release to %s for %s', coalesce(recipient_name, 'assigned recipient'), request.purpose),
    new.released_by
  ) returning id into journal_id;
  insert into public.general_journal_lines(journal_entry_id, line_number, account_code, account_title, debit, credit) values
    (journal_id, 1, settings.advance_account_code, advance_title, new.amount, 0),
    (journal_id, 2, settings.cash_account_code, cash_title, 0, new.amount);
  return new;
exception when unique_violation then return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.post_liquidation_general_journal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET "TimeZone" TO 'Asia/Manila'
AS $function$
declare r public.petty_cash_requests;settings public.department_accounting_settings;jid uuid;line_no integer:=1;expense record;legacy_expense_code text;title text;items_total numeric;
begin
  if new.status<>'approved' or old.status='approved' then return new;end if;
  select * into r from public.petty_cash_requests where id=new.request_id;
  select * into settings from public.department_accounting_settings where fiscal_budget_id=r.fiscal_budget_id;
  if exists(select 1 from public.general_journal_entries where source_type='liquidation' and source_id=new.id) then return new;end if;
  select sum(i.amount) into items_total from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id where rc.liquidation_id=new.id;
  if new.itemized_payload is not null and coalesce(items_total,0) is distinct from new.declared_spent then raise exception 'Purchased item totals do not match declared spending' using errcode='22023';end if;
  insert into public.general_journal_entries(fiscal_budget_id,org_id,entry_date,reference_number,source_type,source_id,memo,posted_by)
  values(r.fiscal_budget_id,r.org_id,coalesce((new.decided_at at time zone 'Asia/Manila')::date,(now() at time zone 'Asia/Manila')::date),new.liquidation_number,'liquidation',new.id,'Settlement for '||r.purpose,coalesce(new.decided_by,auth.uid())) returning id into jid;
  if items_total is not null then
    for expense in select coalesce(s.journal_account_code,m.account_code,settings.default_expense_account_code,'50299990') as account_code,sum(i.amount) as amount
      from public.petty_cash_receipt_items i join public.petty_cash_receipts rc on rc.id=i.receipt_id
      join public.work_budget_allocation_lines l on l.id=i.allocation_line_id
      left join public.office_budget_sections s on s.id=l.budget_partition_id left join public.department_budget_account_mappings m on m.allocation_line_id=l.id
      where rc.liquidation_id=new.id group by coalesce(s.journal_account_code,m.account_code,settings.default_expense_account_code,'50299990') order by account_code loop
      title:=null;
      select a.title into title from public.accounting_accounts a where a.code=expense.account_code and a.classification='expense' and a.is_active;
      if title is null then
        select a.code, a.title into expense.account_code, title from public.accounting_accounts a where a.code=coalesce(settings.default_expense_account_code,'50299990');
      end if;
      if title is null then raise exception 'Map every purchased-item source to an active journal expense account before settlement' using errcode='22023';end if;
      insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,expense.account_code,title,expense.amount,0);line_no:=line_no+1;
    end loop;
  elsif new.declared_spent>0 then
    select coalesce(m.account_code,settings.default_expense_account_code,'50299990') into legacy_expense_code from (select 1) seed left join public.department_budget_account_mappings m on m.allocation_line_id=r.allocation_line_id;
    select a.title into title from public.accounting_accounts a where a.code=legacy_expense_code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,legacy_expense_code,title,new.declared_spent,0);line_no:=line_no+1;
  end if;
  if new.returned_amount>0 then
    select a.title into title from public.accounting_accounts a where a.code=settings.cash_account_code;
    insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.cash_account_code,title,new.returned_amount,0);line_no:=line_no+1;
  end if;
  select a.title into title from public.accounting_accounts a where a.code=settings.advance_account_code;
  insert into public.general_journal_lines(journal_entry_id,line_number,account_code,account_title,debit,credit) values(jid,line_no,settings.advance_account_code,title,0,new.declared_spent+new.returned_amount);
  return new;
end;
$function$;
