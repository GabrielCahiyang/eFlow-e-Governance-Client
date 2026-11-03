CREATE OR REPLACE FUNCTION eflow_project.allocate_task(p_task uuid, p_lines jsonb, p_reason text, p_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t public.tasks;p public.projects;line jsonb;source eflow_project.funding;s public.office_budget_sections;commitment uuid;a uuid;amount numeric;total numeric:=0;used numeric;payload jsonb;receipt eflow_project.commands;
begin
 perform eflow_r7.lock_impact(p_task);
 select * into t from public.tasks where id=p_task and deleted_at is null;
 select * into p from public.projects where id=t.linked_project_id for update;
 if not eflow_project.ready(p.id) or p.status in ('completed','archived') or t.archived_at is not null or t.status in ('completed','cancelled') then raise exception 'Complete project setup and choose open work before allocating funding' using errcode='23514';end if;
 if not eflow_project.lead(p.id,auth.uid()) and not public.phase2_is_office_head(auth.uid(),p.org_id) then raise exception 'Only the project lead or appointed Head may allocate project funding' using errcode='42501';end if;
 payload:=jsonb_build_object('task',p_task,'lines',p_lines,'reason',p_reason);
 select * into receipt from eflow_project.commands where actor_id=auth.uid() and request_id=p_key;
 if found then if receipt.payload<>payload then raise exception 'Allocation request terms changed' using errcode='23514';end if;return (receipt.result->>'id')::uuid;end if;
 if p_lines is null or p_key is null or btrim(coalesce(p_reason,''))='' or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Choose project funding sources, amounts and a reason' using errcode='23514';end if;
 if exists(select 1 from public.work_budget_allocations where task_id=t.id and subtask_id is null and status='pending') then raise exception 'Finish the pending allocation review before adding accounts.' using errcode='23514';end if;
 select wa.id,wa.commitment_id into a,commitment from public.work_budget_allocations wa where wa.task_id=t.id and wa.subtask_id is null and wa.status='approved' for update;
 if a is not null and exists(select 1 from public.work_budget_allocation_lines where allocation_id=a and project_funding_id is null) then raise exception 'This task uses legacy funding. Keep its existing funding separate.' using errcode='23514';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 select * into source from eflow_project.funding where id=(line->>'sourceId')::uuid and project_id=p.id for update;
 amount:=(line->>'amount')::numeric;
 if source.id is null or amount is null or amount>90000000000 or amount<=0 or amount<>round(amount,2) then raise exception 'Choose a project funding source and a positive amount in cents' using errcode='23514';end if;
 if a is not null and exists(select 1 from public.work_budget_allocation_lines existing_line where existing_line.allocation_id=a and existing_line.project_funding_id=source.id and existing_line.amount>0) then raise exception 'This task already uses that account. Use another account.' using errcode='23514';end if;
 if commitment is not null and commitment<>source.commitment_id then raise exception 'Use sources from the same fiscal year for one task allocation' using errcode='23514';end if;commitment:=source.commitment_id;
 if not exists(select 1 from public.budget_commitments where id=commitment and status='active') then raise exception 'Project funding is no longer available' using errcode='23514';end if;
 if t.start_date is null or t.due_date is null then raise exception 'Set the task start and due dates before allocating funding' using errcode='23514';end if;
 if t.start_date::date>make_date(source.fiscal_year,12,31) or t.due_date::date<make_date(source.fiscal_year,1,1) then raise exception 'Selected FY % funding does not overlap this task timeline',source.fiscal_year using errcode='23514';end if;
 select coalesce(sum(l.amount),0) into used from public.work_budget_allocation_lines l join public.work_budget_allocations wa on wa.id=l.allocation_id where wa.status='approved' and wa.subtask_id is null and l.project_funding_id=source.id;
 if used+amount>source.amount then raise exception 'Project source has % available; allocation requests %',source.amount-used,amount using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'sourceId' having count(*)>1) then raise exception 'Choose each project source once' using errcode='23514';end if;
 total:=total+amount;
 end loop;
 if a is null then
 insert into public.work_budget_allocations(commitment_id,task_id,amount,status,reason,requested_by,decided_by,decision_reason,decided_at) values(commitment,t.id,total,'approved',p_reason,auth.uid(),auth.uid(),'Allocated from authorized project funding',now()) returning id into a;
 else
 update public.work_budget_allocations wa set amount=wa.amount+total where wa.id=a;
 end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 select * into source from eflow_project.funding where id=(line->>'sourceId')::uuid;
 select * into s from public.office_budget_sections where id=source.partition_id;
 insert into public.work_budget_allocation_lines(allocation_id,budget_partition_id,project_funding_id,expense_class,category,particular,quantity,unit,unit_cost,amount,fund_source,position) values(a,s.id,source.id,'Project allocation',s.name,t.title,1,'allocation',(line->>'amount')::numeric,(line->>'amount')::numeric,'Project budget',(select coalesce(max(l.position),-1)+1 from public.work_budget_allocation_lines l where l.allocation_id=a));
 end loop;
 insert into eflow_project.commands values(auth.uid(),p_key,payload,jsonb_build_object('id',a));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason) values(auth.uid(),'task',t.id::text,'project.task_funding_allocated',p.org_id,payload,p_reason);
 return a;
end $function$;

CREATE OR REPLACE FUNCTION eflow_project.snapshot(p_project uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects;funds jsonb;sources jsonb;requests jsonb;total numeric;allocated numeric;released numeric;spent numeric;returned numeric;outstanding numeric;
begin
 select * into p from public.projects where id=p_project;
 if p.id is null or auth.uid() is null or not public.can_see_project(p.id,auth.uid()) then raise exception 'Current project access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('name',s.name,'available',f.amount-coalesce((select sum(l.amount) from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id where l.project_funding_id=f.id and a.subtask_id is null and a.status='approved'),0)) order by f.fiscal_year,f.quarter,s.name),'[]') into funds from eflow_project.funding f join public.office_budget_sections s on s.id=f.partition_id join public.budget_commitments c on c.id=f.commitment_id where f.project_id=p.id and f.amount>0 and c.status='active';
 select coalesce(sum((x->>'amount')::numeric),0),coalesce(sum((x->>'amount')::numeric-(x->>'available')::numeric),0) into total,allocated from jsonb_array_elements(funds) x;
 select coalesce(sum(r.released_amount),0),coalesce(sum(r.actual_spent),0),coalesce(sum(r.returned_amount) filter(where r.status='settled'),0),coalesce(sum(r.released_amount) filter(where r.status<>'settled'),0) into released,spent,returned,outstanding from public.petty_cash_requests r join public.tasks t on t.id=r.task_id where t.linked_project_id=p.id;
 if public.phase2_is_office_head(auth.uid(),p.org_id) or eflow_project.lead(p.id,auth.uid()) then
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'year',b.fiscal_year,'available',s.amount-s.held_amount-eflow_budget.partition_committed(s.id)) order by b.fiscal_year,s.position),'[]') into sources from public.office_budget_sections s join public.department_fiscal_budgets b on b.id=s.fiscal_budget_id where b.org_id=p.org_id and b.status='locked' and not s.retired and not exists(select 1 from public.office_budget_sections child where child.parent_id=s.id and not child.retired);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'purpose',r.purpose,'amount',r.requested_amount,'status',r.status,'requester',pr.full_name,'canReview',r.status='pending_department_approval' and eflow_project.reviewer(t.id,r.requester_id)=auth.uid()) order by r.created_at desc),'[]') into requests from public.petty_cash_requests r join public.tasks t on t.id=r.task_id left join public.profiles pr on pr.id=r.requester_id where t.linked_project_id=p.id;
 end if;
 return jsonb_build_object('project',to_jsonb(p),'ready',eflow_project.ready(p.id),'canAuthorize',public.phase2_is_office_head(auth.uid(),p.org_id),'canAllocate',eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id),'funds',funds,'sources',coalesce(sources,'[]'),'requests',coalesce(requests,'[]'),'total',total,'allocated',allocated,'unallocated',total-allocated,'released',released,'spent',spent,'returned',returned,'outstanding',outstanding,
 'canExtendTaskFunding',true,
 'taskFunding',coalesce((select jsonb_agg(jsonb_build_object('sourceId',l.project_funding_id,'fiscalYear',(select f.fiscal_year from eflow_project.funding f where f.id=l.project_funding_id),'id',l.id,'taskId',t.id,'task',t.title,'source',s.name,'amount',l.amount,'available',public.task_budget_line_available(l.id,null))) from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id join public.tasks t on t.id=a.task_id join public.office_budget_sections s on s.id=l.budget_partition_id where t.linked_project_id=p.id and a.subtask_id is null and a.status='approved' and l.project_funding_id is not null and l.amount>0 and public.can_see_task(t.id,auth.uid())),'[]'),
 'liquidations',coalesce((select jsonb_agg(jsonb_build_object('id',liq.id,'purpose',r.purpose,'spent',liq.declared_spent,'canReview',r.status='pending_leader_liquidation_review' and liq.status='pending_leader_review' and eflow_project.reviewer(t.id,r.cash_recipient_id)=auth.uid())) from public.petty_cash_liquidations liq join public.petty_cash_requests r on r.id=liq.request_id join public.tasks t on t.id=r.task_id where t.linked_project_id=p.id and (eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id))),'[]'),
 'fundingRequests',coalesce((select jsonb_agg(to_jsonb(fr)) from eflow_project.funding_requests fr where fr.project_id=p.id and fr.status='pending' and (fr.actor_id=auth.uid() or public.phase2_is_office_head(auth.uid(),p.org_id))),'[]'));
end $function$;
notify pgrst,'reload schema';
