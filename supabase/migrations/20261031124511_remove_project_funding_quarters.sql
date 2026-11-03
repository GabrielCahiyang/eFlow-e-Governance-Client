-- Preserve historical quarterly rows and their allocation references. New funding is annual.
alter table eflow_project.funding alter column quarter drop not null;
create unique index project_annual_funding_source on eflow_project.funding(project_id,partition_id) where quarter is null;

CREATE OR REPLACE FUNCTION eflow_project.authorize_funding(p_project uuid, p_lines jsonb, p_reason text, p_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects;line jsonb;s public.office_budget_sections;b public.department_fiscal_budgets;c uuid;amount numeric;q integer;payload jsonb;receipt eflow_project.commands;total numeric:=0;source_start date;source_end date;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or p.status in ('completed','archived') then raise exception 'Only the appointed Head may authorize funding for an open project' using errcode='42501';end if;
 if p_key is null or btrim(coalesce(p_reason,''))='' or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Select funding sources, amounts and an authorization reason' using errcode='23514';end if;
 payload:=jsonb_build_object('project',p_project,'lines',p_lines,'reason',p_reason);
 select * into receipt from eflow_project.commands where actor_id=auth.uid() and request_id=p_key;
 if found then if receipt.payload<>payload then raise exception 'This request key belongs to different funding details' using errcode='23514';end if;return receipt.result;end if;
 if p.start_date is null or p.target_date is null or p.project_lead_id is null or btrim(p.description)='' or btrim(p.scope)='' then raise exception 'Save complete project details and dates before authorizing funding' using errcode='23514';end if;
 -- Serialize all appropriation checks in deterministic order, including separate projects.
 perform 1 from public.department_fiscal_budgets fb where fb.org_id=p.org_id order by fb.id for update;
 for line in select value from jsonb_array_elements(p_lines) loop
 amount:=(line->>'amount')::numeric;q:=null; -- Quarter on old client payloads is ignored; raw payload retained for idempotency.
 if amount is null or amount<=0 or amount<>round(amount,2) or amount>90000000000 then raise exception 'Enter a positive amount in cents' using errcode='23514';end if;
 select * into s from public.office_budget_sections where id=(line->>'partitionId')::uuid and not retired;
 select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id and org_id=p.org_id and status='locked';
 if b.id is null or exists(select 1 from public.office_budget_sections where parent_id=s.id and not retired) then raise exception 'Choose a released leaf funding account from this office and a locked fiscal year' using errcode='23514';end if;
 source_start:=make_date(b.fiscal_year,1,1);source_end:=make_date(b.fiscal_year,12,31);
 if source_start>p.target_date or source_end<p.start_date then raise exception 'FY % does not overlap the project timeline',b.fiscal_year using errcode='23514';end if;
 if amount>s.amount-s.held_amount-eflow_budget.partition_committed(s.id) then raise exception 'Funding source %: requested %, available %',s.name,amount,s.amount-s.held_amount-eflow_budget.partition_committed(s.id) using errcode='23514';end if;
 if amount>b.approved_amount-eflow_budget.section_total(b.id,true)-(select coalesce(sum(bc.amount),0) from public.budget_commitments bc where fiscal_budget_id=b.id and status='active') then raise exception 'Office Budget has insufficient available funding' using errcode='23514';end if;
 select bc.id into c from public.budget_commitments bc join eflow_project.funding pf on pf.commitment_id=bc.id where pf.project_id=p.id and bc.fiscal_budget_id=b.id and bc.status='active' limit 1;
 if c is null then insert into public.budget_commitments(fiscal_budget_id,title,amount,created_by,funding_kind,authorization_key,authorization_payload) values(b.id,'Project: '||p.title,0,auth.uid(),'direct_work',gen_random_uuid(),jsonb_build_object('projectId',p.id)) returning id into c;end if;
 insert into eflow_project.funding(project_id,commitment_id,partition_id,fiscal_year,quarter,amount) values(p.id,c,s.id,b.fiscal_year,q,amount) on conflict(project_id,partition_id) where quarter is null do update set amount=eflow_project.funding.amount+excluded.amount;
 update public.budget_commitments set amount=(select sum(pf.amount) from eflow_project.funding pf where pf.commitment_id=c) where id=c;
 insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,entry_type,amount,description,actor_id,reason,metadata) values(b.id,p.org_id,c,'proposal_committed',amount,'Project funding reserved: '||p.title,auth.uid(),p_reason,jsonb_build_object('projectId',p.id,'partitionId',s.id));
 total:=total+amount;
 end loop;
 update public.projects set funding_not_required=false,updated_at=clock_timestamp() where id=p.id;
 insert into eflow_project.commands values(auth.uid(),p_key,payload,jsonb_build_object('authorized',total));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason) values(auth.uid(),'project',p.id::text,'project.funding_authorized',p.org_id,payload,p_reason);
 return jsonb_build_object('authorized',total);
end $function$
;

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
 if p_key is null or btrim(coalesce(p_reason,''))='' or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Choose project funding sources, amounts and a reason' using errcode='23514';end if;
 if exists(select 1 from public.work_budget_allocations where task_id=t.id and subtask_id is null and status in ('pending','approved')) then raise exception 'This task already has funding. Release its unused allocation before reallocating; existing spending and advances cannot be erased' using errcode='23514';end if;
 for line in select value from jsonb_array_elements(p_lines) loop
 select * into source from eflow_project.funding where id=(line->>'sourceId')::uuid and project_id=p.id for update;
 amount:=(line->>'amount')::numeric;
 if source.id is null or amount is null or amount<=0 or amount<>round(amount,2) then raise exception 'Choose a project funding source and a positive amount in cents' using errcode='23514';end if;
 if commitment is not null and commitment<>source.commitment_id then raise exception 'Use sources from the same fiscal year for one task allocation' using errcode='23514';end if;commitment:=source.commitment_id;
 if not exists(select 1 from public.budget_commitments where id=commitment and status='active') then raise exception 'Project funding is no longer available' using errcode='23514';end if;
 if t.start_date is null or t.due_date is null then raise exception 'Set the task start and due dates before allocating funding' using errcode='23514';end if;
 if t.start_date::date>make_date(source.fiscal_year,12,31) or t.due_date::date<make_date(source.fiscal_year,1,1) then raise exception 'Selected FY % funding does not overlap this task timeline',source.fiscal_year using errcode='23514';end if;
 select coalesce(sum(l.amount),0) into used from public.work_budget_allocation_lines l join public.work_budget_allocations wa on wa.id=l.allocation_id where wa.status='approved' and wa.subtask_id is null and l.project_funding_id=source.id;
 if used+amount>source.amount then raise exception 'Project source has % available; allocation requests %',source.amount-used,amount using errcode='23514';end if;
 if exists(select 1 from jsonb_array_elements(p_lines) x group by x->>'sourceId' having count(*)>1) then raise exception 'Choose each project source once' using errcode='23514';end if;
 total:=total+amount;
 end loop;
 insert into public.work_budget_allocations(commitment_id,task_id,amount,status,reason,requested_by,decided_by,decision_reason,decided_at) values(commitment,t.id,total,'approved',p_reason,auth.uid(),auth.uid(),'Allocated from authorized project funding',now()) returning id into a;
 for line in select value from jsonb_array_elements(p_lines) loop
 select * into source from eflow_project.funding where id=(line->>'sourceId')::uuid;
 select * into s from public.office_budget_sections where id=source.partition_id;
 insert into public.work_budget_allocation_lines(allocation_id,budget_partition_id,project_funding_id,expense_class,category,particular,quantity,unit,unit_cost,amount,fund_source,position) values(a,s.id,source.id,'Project allocation',s.name,t.title,1,'allocation',(line->>'amount')::numeric,(line->>'amount')::numeric,'Project budget',0);
 end loop;
 insert into eflow_project.commands values(auth.uid(),p_key,payload,jsonb_build_object('id',a));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason) values(auth.uid(),'task',t.id::text,'project.task_funding_allocated',p.org_id,payload,p_reason);
 return a;
end $function$
;