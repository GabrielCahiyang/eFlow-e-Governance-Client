-- A current Head staffing approval clears the task review gate only.
-- Cash stays open for Accounting and the project closeout checks.
create or replace function public.guard_task_financial_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
 request public.petty_cash_requests;
 liquidation public.petty_cash_liquidations;
 approver uuid;
begin
 if new.status is distinct from 'completed' or old.status = 'completed' then return new; end if;
 for request in
  select r.* from public.petty_cash_requests r where r.task_id=new.id
    and r.status not in ('settled','rejected','cancelled') order by r.id
 loop
  if request.status='pending_department_settlement' then
   select * into liquidation from public.petty_cash_liquidations l
    where l.request_id=request.id order by l.version desc,l.id desc limit 1;
   if liquidation.status='pending_department_settlement' and
      (request.liquidation_due_at is null or liquidation.submitted_at<=request.liquidation_due_at
       or liquidation.department_decided_at is not null) then
    approver:=eflow_finance_review.staffing_escalation_approver(liquidation,request);
    if approver is not null then
     perform eflow_finance_review.lock_authority(request.org_id,array[approver]);
     if eflow_finance_review.staffing_escalation_approver(liquidation,request)=approver then
      continue;
     end if;
    end if;
   end if;
  end if;
  raise exception 'Settle all task and subtask cash before approving this task' using errcode='22023';
 end loop;
 return new;
end;
$$;
