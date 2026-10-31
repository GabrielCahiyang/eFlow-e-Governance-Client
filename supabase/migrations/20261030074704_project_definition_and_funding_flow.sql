-- Explicit project definition, funding envelopes and project-lead review routing.
create schema if not exists eflow_project;
revoke all on schema eflow_project from public,anon;
grant usage on schema eflow_project to authenticated;
alter table public.projects add column scope text not null default '';
alter table public.projects add column project_lead_id uuid references public.profiles(id);
alter table public.projects add column funding_not_required boolean not null default false;
alter table public.projects add column setup_completed_at timestamptz;
create table eflow_project.funding (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),
 commitment_id uuid not null references public.budget_commitments(id),partition_id uuid not null references public.office_budget_sections(id),
 fiscal_year integer not null,quarter integer not null check(quarter between 1 and 4),amount numeric(18,2) not null check(amount>=0),
 unique(project_id,partition_id,quarter)
);
alter table eflow_project.funding enable row level security;
create table eflow_project.commands(actor_id uuid not null,request_id uuid not null,payload jsonb not null,result jsonb not null,primary key(actor_id,request_id));
alter table eflow_project.commands enable row level security;
create table eflow_project.funding_requests(id uuid primary key,project_id uuid not null references public.projects(id),actor_id uuid not null,lines jsonb not null,reason text not null,status text not null default 'pending',created_at timestamptz not null default now());
alter table eflow_project.funding_requests enable row level security;
create function eflow_project.lead(p_project uuid,p_actor uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p join public.profiles u on u.id=p_actor where p.id=p_project and p.project_lead_id=p_actor and u.is_active and u.role not in ('admin','viewer','super_admin')) $$;
create function eflow_project.reviewer(p_task uuid,p_conflicted uuid default null) returns uuid language plpgsql stable security definer set search_path='' as $$
declare t public.tasks;p public.projects;candidate uuid;
begin
 select * into t from public.tasks where id=p_task and deleted_at is null;
 select * into p from public.projects where id=t.linked_project_id;
 if p.project_lead_id is null then return null;end if;
 candidate:=p.project_lead_id;
 if candidate=coalesce(t.assigned_to,t.recommendation_lead_id) or candidate=p_conflicted then
 select head_user_id into candidate from public.organizations where id=p.org_id;
 end if;
 if candidate=coalesce(p_conflicted,'00000000-0000-0000-0000-000000000000'::uuid) or not exists(select 1 from public.profiles where id=candidate and is_active and role not in ('admin','viewer','super_admin')) then return null;end if;
 return candidate;
end $$;
create function eflow_project.ready(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.setup_completed_at is not null and btrim(p.title)<>'' and btrim(p.description)<>'' and btrim(p.scope)<>'' and p.start_date is not null and p.target_date>=p.start_date and eflow_project.lead(p.id,p.project_lead_id)
 and (p.funding_not_required or exists(select 1 from eflow_project.funding f join public.budget_commitments c on c.id=f.commitment_id where f.project_id=p.id and f.amount>0 and c.status='active')) from public.projects p where p.id=p_project),false) $$;
create function eflow_project.guard_work() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid;t public.tasks;
begin
 if tg_table_name='tasks' then project:=new.linked_project_id;
 elsif tg_table_name='subtasks' then select * into t from public.tasks where id=new.task_id;project:=t.linked_project_id;
 elsif tg_table_name='project_office_members' then select project_id into project from public.project_offices where id=new.project_office_id;
 else project:=new.project_id;end if;
 if project is null then return new;end if;
 if tg_table_name in ('project_members','project_office_members') and exists(select 1 from public.projects where id=project and (to_jsonb(new)->>'user_id')::uuid in (owner_id,created_by,project_lead_id)) then return new;end if;
 if not eflow_project.ready(project) then raise exception 'Complete project details, dates, project lead and funding setup before adding tasks, subtasks or people' using errcode='23514';end if;
 return new;
end $$;
create trigger project_definition_before_tasks before insert on public.tasks for each row execute function eflow_project.guard_work();
create trigger project_definition_before_subtasks before insert on public.subtasks for each row execute function eflow_project.guard_work();
create trigger project_definition_before_members before insert on public.project_members for each row execute function eflow_project.guard_work();
create trigger project_definition_before_office_members before insert on public.project_office_members for each row execute function eflow_project.guard_work();
create trigger project_definition_before_office_people before insert on public.project_office_people for each row execute function eflow_project.guard_work();
create trigger project_definition_before_invitations before insert on public.project_invitation_requests for each row execute function eflow_project.guard_work();
create function eflow_project.route_task() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects;r uuid;
begin
 select * into p from public.projects where id=new.linked_project_id;
 if p.project_lead_id is null then return new;end if;
 if new.assigned_to=p.project_lead_id then select head_user_id into r from public.organizations where id=p.org_id;else r:=p.project_lead_id;end if;
 if r=new.assigned_to then r:=null;end if;
 new.reviewer_id:=r;new.backup_reviewer_id:=null;new.review_route_mode:='explicit';
 if new.status='for_review' and (r is null or not exists(select 1 from public.profiles where id=r and is_active and role not in ('admin','viewer','super_admin'))) then raise exception 'No independent reviewer is available. Appoint a project lead or an independent Head before submitting' using errcode='23514';end if;
 return new;
end $$;
create trigger aa_project_task_review_route before insert or update on public.tasks for each row execute function eflow_project.route_task();
create function eflow_project.guard_definition() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' and old.status is distinct from new.status and not public.phase2_is_office_head(auth.uid(),new.org_id) then raise exception 'Only the appointed Head can approve project completion' using errcode='42501';end if;
 if row(new.scope,new.project_lead_id,new.funding_not_required,new.setup_completed_at) is distinct from row(old.scope,old.project_lead_id,old.funding_not_required,old.setup_completed_at) then
 if auth.uid() is null or not public.phase2_is_office_head(auth.uid(),old.org_id) then raise exception 'Only the appointed Head may authorize project setup' using errcode='42501';end if;
 if old.status in ('completed','archived') then raise exception 'Closed project setup is read-only' using errcode='23514';end if;
 if new.project_lead_id is distinct from old.project_lead_id and exists(select 1 from public.tasks where linked_project_id=old.id and status='for_review' and deleted_at is null) then raise exception 'Resolve pending task reviews before changing the project lead' using errcode='23514';end if;
 end if;
 if new.funding_not_required and exists(select 1 from eflow_project.funding where project_id=new.id and amount>0) then raise exception 'Release existing project funding before declaring no funding required' using errcode='23514';end if;
 return new;
end $$;
create trigger project_definition_guard before update on public.projects for each row execute function eflow_project.guard_definition();
create function eflow_project.save_details(p_project uuid,p_details jsonb) returns public.projects language plpgsql security definer set search_path='' as $$
declare p public.projects;leader uuid;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) then raise exception 'Only the appointed Head can save project setup' using errcode='42501';end if;
 if p.updated_at is distinct from (p_details->>'version')::timestamptz then raise exception 'Project changed elsewhere. Reopen setup and review current details before saving' using errcode='40001';end if;
 leader:=nullif(p_details->>'lead','')::uuid;
 if leader is not null and not exists(select 1 from public.profiles where id=leader and is_active and org_id=p.org_id and role not in ('admin','viewer','super_admin')) then raise exception 'Choose an active project lead from the implementing office' using errcode='23514';end if;
 if length(btrim(p_details->>'title')) not between 1 and 200 or length(coalesce(p_details->>'description',''))>12000 or length(coalesce(p_details->>'scope',''))>12000 then raise exception 'Enter a project title up to 200 characters; description and scope may each contain up to 12000 characters' using errcode='23514';end if;
 update public.projects set title=btrim(p_details->>'title'),description=coalesce(p_details->>'description',''),scope=coalesce(p_details->>'scope',''),project_lead_id=leader,
 start_date=nullif(p_details->>'start','')::date,target_date=nullif(p_details->>'end','')::date,funding_not_required=coalesce((p_details->>'noFunding')::boolean,false),setup_completed_at=null,updated_at=clock_timestamp() where id=p.id returning * into p;
 if p.start_date>p.target_date then raise exception 'Project target date must be on or after its start date' using errcode='23514';end if;
 if p.project_lead_id is not null then insert into public.project_office_members(project_office_id,user_id,selected_by) select id,p.project_lead_id,auth.uid() from public.project_offices where project_id=p.id and office_id=p.org_id and relationship_type='lead' on conflict do nothing;insert into public.project_members(project_id,user_id,role) values(p.id,p.project_lead_id,'member') on conflict do nothing;end if;
 return p;
end $$;
create function eflow_project.finish_setup(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) then raise exception 'Only the appointed Head may finish setup' using errcode='42501';end if;
 update public.projects set setup_completed_at=now(),updated_at=clock_timestamp() where id=p.id;
 if not eflow_project.ready(p.id) then raise exception 'Provide title, description, scope, project lead, start and target dates, and authorize funding or select No funding required' using errcode='23514';end if;
end $$;

create function eflow_project.authorize_funding(p_project uuid,p_lines jsonb,p_reason text,p_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 amount:=(line->>'amount')::numeric;q:=(line->>'quarter')::int;
 if amount is null or amount<=0 or amount<>round(amount,2) or amount>90000000000 or q not between 1 and 4 then raise exception 'Enter a positive amount in cents and a quarter from Q1 to Q4' using errcode='23514';end if;
 select * into s from public.office_budget_sections where id=(line->>'partitionId')::uuid and not retired;
 select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id and org_id=p.org_id and status='locked';
 if b.id is null or exists(select 1 from public.office_budget_sections where parent_id=s.id and not retired) then raise exception 'Choose a released leaf funding account from this office and a locked fiscal year' using errcode='23514';end if;
 source_start:=make_date(b.fiscal_year,(q-1)*3+1,1);source_end:=(source_start+interval '3 months'-interval '1 day')::date;
 if source_start>p.target_date or source_end<p.start_date then raise exception 'FY % Q% does not overlap the project timeline',b.fiscal_year,q using errcode='23514';end if;
 if amount>s.amount-s.held_amount-eflow_budget.partition_committed(s.id) then raise exception 'Funding source %: requested %, available %',s.name,amount,s.amount-s.held_amount-eflow_budget.partition_committed(s.id) using errcode='23514';end if;
 if amount>b.approved_amount-eflow_budget.section_total(b.id,true)-(select coalesce(sum(bc.amount),0) from public.budget_commitments bc where fiscal_budget_id=b.id and status='active') then raise exception 'Office Budget has insufficient available funding' using errcode='23514';end if;
 select bc.id into c from public.budget_commitments bc join eflow_project.funding pf on pf.commitment_id=bc.id where pf.project_id=p.id and bc.fiscal_budget_id=b.id and bc.status='active' limit 1;
 if c is null then insert into public.budget_commitments(fiscal_budget_id,title,amount,created_by,funding_kind,authorization_key,authorization_payload) values(b.id,'Project: '||p.title,0,auth.uid(),'direct_work',gen_random_uuid(),jsonb_build_object('projectId',p.id)) returning id into c;end if;
 insert into eflow_project.funding(project_id,commitment_id,partition_id,fiscal_year,quarter,amount) values(p.id,c,s.id,b.fiscal_year,q,amount) on conflict(project_id,partition_id,quarter) do update set amount=eflow_project.funding.amount+excluded.amount;
 update public.budget_commitments set amount=(select sum(pf.amount) from eflow_project.funding pf where pf.commitment_id=c) where id=c;
 insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,entry_type,amount,description,actor_id,reason,metadata) values(b.id,p.org_id,c,'proposal_committed',amount,'Project funding reserved: '||p.title,auth.uid(),p_reason,jsonb_build_object('projectId',p.id,'quarter',q,'partitionId',s.id));
 total:=total+amount;
 end loop;
 update public.projects set funding_not_required=false,updated_at=clock_timestamp() where id=p.id;
 insert into eflow_project.commands values(auth.uid(),p_key,payload,jsonb_build_object('authorized',total));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason) values(auth.uid(),'project',p.id::text,'project.funding_authorized',p.org_id,payload,p_reason);
 return jsonb_build_object('authorized',total);
end $$;
create function eflow_project.allocate_task(p_task uuid,p_lines jsonb,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
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
 if t.start_date is null or t.due_date is null then raise exception 'Set the task start and due dates before allocating quarterly funding' using errcode='23514';end if;
 if t.start_date::date> (make_date(source.fiscal_year,(source.quarter-1)*3+1,1)+interval '3 months'-interval '1 day')::date or t.due_date::date<make_date(source.fiscal_year,(source.quarter-1)*3+1,1) then raise exception 'Selected FY % Q% funding does not overlap this task timeline',source.fiscal_year,source.quarter using errcode='23514';end if;
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
end $$;
alter table public.work_budget_allocation_lines add column project_funding_id uuid references eflow_project.funding(id);
create or replace function eflow_budget.partition_committed(p_section uuid) returns numeric language sql stable set search_path='' as $$
 select (select coalesce(sum(f.amount),0) from eflow_project.funding f join public.budget_commitments c on c.id=f.commitment_id where f.partition_id=p_section and c.status='active')+
 (select coalesce(sum(l.amount),0) from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id join public.budget_commitments c on c.id=a.commitment_id where l.budget_partition_id=p_section and a.subtask_id is null and a.status='approved' and c.status='active' and l.project_funding_id is null) $$;

create function eflow_project.snapshot(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.projects;funds jsonb;sources jsonb;requests jsonb;total numeric;allocated numeric;released numeric;spent numeric;
begin
 select * into p from public.projects where id=p_project;
 if p.id is null or auth.uid() is null or not public.can_see_project(p.id,auth.uid()) then raise exception 'Current project access required' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('name',s.name,'available',f.amount-coalesce((select sum(l.amount) from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id where l.project_funding_id=f.id and a.subtask_id is null and a.status='approved'),0)) order by f.fiscal_year,f.quarter,s.name),'[]') into funds from eflow_project.funding f join public.office_budget_sections s on s.id=f.partition_id join public.budget_commitments c on c.id=f.commitment_id where f.project_id=p.id and f.amount>0 and c.status='active';
 select coalesce(sum((x->>'amount')::numeric),0),coalesce(sum((x->>'amount')::numeric-(x->>'available')::numeric),0) into total,allocated from jsonb_array_elements(funds) x;
 select coalesce(sum(r.released_amount),0),coalesce(sum(r.actual_spent),0) into released,spent from public.petty_cash_requests r join public.tasks t on t.id=r.task_id where t.linked_project_id=p.id;
 if public.phase2_is_office_head(auth.uid(),p.org_id) or eflow_project.lead(p.id,auth.uid()) then
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'year',b.fiscal_year,'available',s.amount-s.held_amount-eflow_budget.partition_committed(s.id)) order by b.fiscal_year,s.position),'[]') into sources from public.office_budget_sections s join public.department_fiscal_budgets b on b.id=s.fiscal_budget_id where b.org_id=p.org_id and b.status='locked' and not s.retired and not exists(select 1 from public.office_budget_sections child where child.parent_id=s.id and not child.retired);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'purpose',r.purpose,'amount',r.requested_amount,'status',r.status,'requester',pr.full_name,'canReview',r.status='pending_department_approval' and eflow_project.reviewer(t.id,r.requester_id)=auth.uid()) order by r.created_at desc),'[]') into requests from public.petty_cash_requests r join public.tasks t on t.id=r.task_id left join public.profiles pr on pr.id=r.requester_id where t.linked_project_id=p.id;
 end if;
 return jsonb_build_object('project',to_jsonb(p),'ready',eflow_project.ready(p.id),'canAuthorize',public.phase2_is_office_head(auth.uid(),p.org_id),'canAllocate',eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id),'funds',funds,'sources',coalesce(sources,'[]'),'requests',coalesce(requests,'[]'),'total',total,'allocated',allocated,'unallocated',total-allocated,'released',released,'spent',spent,
 'taskFunding',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'taskId',t.id,'task',t.title,'source',s.name,'amount',l.amount,'available',public.task_budget_line_available(l.id,null))) from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id join public.tasks t on t.id=a.task_id join public.office_budget_sections s on s.id=l.budget_partition_id where t.linked_project_id=p.id and a.subtask_id is null and a.status='approved' and l.project_funding_id is not null and public.can_see_task(t.id,auth.uid())),'[]'),
 'liquidations',coalesce((select jsonb_agg(jsonb_build_object('id',liq.id,'purpose',r.purpose,'spent',liq.declared_spent,'canReview',r.status='pending_leader_liquidation_review' and liq.status='pending_leader_review' and eflow_project.reviewer(t.id,r.cash_recipient_id)=auth.uid())) from public.petty_cash_liquidations liq join public.petty_cash_requests r on r.id=liq.request_id join public.tasks t on t.id=r.task_id where t.linked_project_id=p.id and (eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id))),'[]'),
 'fundingRequests',coalesce((select jsonb_agg(to_jsonb(fr)) from eflow_project.funding_requests fr where fr.project_id=p.id and fr.status='pending' and (fr.actor_id=auth.uid() or public.phase2_is_office_head(auth.uid(),p.org_id))),'[]'));
end $$;
create function eflow_project.request_funding(p_project uuid,p_lines jsonb,p_reason text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not eflow_project.lead(p_project,auth.uid()) then raise exception 'Current project lead required' using errcode='42501';end if;
 if jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines)=0 or btrim(coalesce(p_reason,''))='' then raise exception 'Choose funding sources, amounts and a reason' using errcode='23514';end if;
 if exists(select 1 from eflow_project.funding_requests where id=p_key and (actor_id<>auth.uid() or project_id<>p_project or lines<>p_lines or reason<>p_reason)) then raise exception 'Funding request terms changed' using errcode='23514';end if;
 insert into eflow_project.funding_requests(id,project_id,actor_id,lines,reason) values(p_key,p_project,auth.uid(),p_lines,p_reason) on conflict do nothing;return p_key;
end $$;
create function eflow_project.decide_funding(p_request uuid,p_approve boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r eflow_project.funding_requests;p public.projects;
begin
 select * into r from eflow_project.funding_requests where id=p_request for update;select * into p from public.projects where id=r.project_id;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or r.status<>'pending' then raise exception 'Pending funding request and appointed Head required' using errcode='42501';end if;
 if not p_approve and btrim(coalesce(p_reason,''))='' then raise exception 'Give a reason for declining funding' using errcode='23514';end if;
 if p_approve then perform eflow_project.authorize_funding(p.id,r.lines,r.reason,p_request);end if;
 update eflow_project.funding_requests set status=case when p_approve then 'approved' else 'rejected' end where id=r.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,reason) values(auth.uid(),'project',p.id::text,'project.funding_request_decided',p.org_id,p_reason);
end $$;
create function eflow_project.release_funding(p_project uuid,p_source uuid,p_amount numeric,p_reason text,p_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;f eflow_project.funding;used numeric;b uuid;receipt eflow_project.commands;payload jsonb;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) then raise exception 'Only the appointed Head may release unused project funding' using errcode='42501';end if;
 payload:=jsonb_build_object('project',p_project,'source',p_source,'amount',p_amount,'reason',p_reason);
 select * into receipt from eflow_project.commands where actor_id=auth.uid() and request_id=p_key;
 if found then if receipt.payload<>payload then raise exception 'Release request terms changed' using errcode='23514';end if;return;end if;
 select * into f from eflow_project.funding where id=p_source and project_id=p.id for update;
 if f.id is null or p_amount is null or p_amount<=0 or round(p_amount,2)<>p_amount or btrim(coalesce(p_reason,''))='' or p_key is null then raise exception 'Choose a project funding source, positive amount and release reason' using errcode='23514';end if;
 select coalesce(sum(l.amount),0) into used from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id where l.project_funding_id=f.id and a.status='approved' and a.subtask_id is null;
 if p_amount>f.amount-used then raise exception 'Only % remains unallocated; release the unused task allocations first',f.amount-used using errcode='23514';end if;
 select fiscal_budget_id into b from public.budget_commitments where id=f.commitment_id for update;
 update eflow_project.funding set amount=amount-p_amount where id=f.id;
 update public.budget_commitments set amount=amount-p_amount where id=f.commitment_id;
 insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,entry_type,amount,description,actor_id,reason,metadata) values(b,p.org_id,f.commitment_id,'proposal_released',p_amount,'Unused project funding released',auth.uid(),p_reason,jsonb_build_object('projectId',p.id,'sourceId',p_source));
 insert into eflow_project.commands values(auth.uid(),p_key,payload,'{}');
end $$;

CREATE OR REPLACE FUNCTION eflow_budget.guard_partition_funding()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if new.project_funding_id is not null then
   if not exists(select 1 from eflow_project.funding f join public.tasks t on t.linked_project_id=f.project_id where f.id=new.project_funding_id and t.id=a.task_id and f.commitment_id=a.commitment_id and f.partition_id=new.budget_partition_id) then raise exception 'Task funding must belong to its project and selected source' using errcode='23514';end if;
   if coalesce((select sum(l.amount) from public.work_budget_allocation_lines l join public.work_budget_allocations wa on wa.id=l.allocation_id where l.project_funding_id=new.project_funding_id and wa.subtask_id is null and wa.status='approved' and l.id<>new.id),0)+new.amount>(select amount from eflow_project.funding where id=new.project_funding_id) then raise exception 'Task allocation exceeds remaining project source funding' using errcode='23514';end if;
   return new;
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
$function$
;
CREATE OR REPLACE FUNCTION eflow_budget.fund_work(p_task_id uuid, p_fiscal_year integer, p_lines jsonb, p_reason text, p_authorization_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=auth.uid(); t public.tasks; b public.department_fiscal_budgets; existing public.budget_commitments;
  payload jsonb; c_id uuid; a_id uuid; total numeric:=0; line jsonb; source public.office_budget_sections; seen uuid[]:='{}'; amt numeric;
begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact(p_task_id);
  if caller is null then raise exception 'Sign in to authorize funding' using errcode='42501'; end if;
  select * into t from public.tasks where id=p_task_id and deleted_at is null;
  if t.id is null or not public.is_department_budget_head(t.org_id,caller) or not public.can_see_task(t.id,caller) then
    raise exception 'Only the responsible Office Head can fund this work' using errcode='42501';
  end if;
  if t.linked_project_id is not null and exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null) then raise exception 'Allocate this task from its project budget; Office Budget must not be charged again' using errcode='23514';end if;
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
$function$
;
CREATE OR REPLACE FUNCTION public.submit_task_for_review(p_task_id uuid, p_submission jsonb)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  caller uuid := auth.uid();

  caller_name text;

  completion_note text;

  submission_id uuid;

  submission_version int;

  attachment jsonb;

  normalized_submission jsonb;

  t public.tasks;

  resolved_reviewer uuid;

begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact(p_task_id); /* NW4.2 completion serialization */ perform eflow_r7.lock_completion(p_task_id);

  if caller is null then

    raise exception 'Not authenticated' using errcode = '42501';

  end if;



  completion_note := nullif(btrim(p_submission ->> 'note'), '');

  if completion_note is null then

    raise exception 'Completion note is required' using errcode = '22023';

  end if;

  if p_submission ? 'attachments'

     and jsonb_typeof(p_submission -> 'attachments') <> 'array' then

    raise exception 'Submission attachments must be an array' using errcode = '22023';

  end if;



  select full_name into caller_name

  from public.profiles where id = caller;



  select * into t

  from public.tasks

  where id = p_task_id and deleted_at is null

  for update;

  if not found then raise exception 'Task not found'; end if;

  if t.archived_at is not null or t.status <> 'in_progress' then

    raise exception 'Only in-progress work can be submitted' using errcode = '22023';

  end if;

  if not (t.assigned_to = caller or t.recommendation_lead_id = caller) then

    raise exception 'Only the assignee or task lead may submit this work'

      using errcode = '42501';

  end if;



  if public.auth_role(caller) is null or public.auth_role(caller)='admin' then

    raise exception 'Operational account required' using errcode='42501';

  end if;

  if exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null) then
    resolved_reviewer:=eflow_project.reviewer(t.id,caller);
  else
  if t.review_route_mode='organization_default' then

    select o.head_user_id into resolved_reviewer from public.organizations o

      where o.id=t.org_id and public.is_office_output_reviewer(o.id,o.head_user_id);

  else

    select p.id into resolved_reviewer from public.profiles p

      where p.id in (t.reviewer_id,t.backup_reviewer_id) and p.is_active and p.role<>'admin'

        and p.id<>caller and p.id is distinct from t.assigned_to

      order by (p.id=t.reviewer_id) desc limit 1;

  end if;

  end if;
  if resolved_reviewer is null then raise exception 'Assign an eligible reviewer before submitting' using errcode='22023'; end if;



  submission_id := case

    when coalesce(p_submission ->> 'id', '') ~

      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'

      then (p_submission ->> 'id')::uuid

    else gen_random_uuid()

  end;

  select coalesce(max(version), 0) + 1 into submission_version

  from public.task_submissions where task_id = p_task_id;



  insert into public.task_submissions (

    id, task_id, version, submitter_id, submitter_name, note

  ) values (

    submission_id,

    p_task_id,

    submission_version,

    caller,

    coalesce(caller_name, 'User'),

    completion_note

  );



  for attachment in

    select value from jsonb_array_elements(

      coalesce(p_submission -> 'attachments', '[]'::jsonb)

    )

  loop

    insert into public.task_attachments (

      task_id,

      submission_id,

      uploaded_by,

      uploader_name,

      file_name,

      file_path,

      file_size,

      mime_type

    ) values (

      p_task_id,

      submission_id,

      caller,

      coalesce(caller_name, 'User'),

      coalesce(attachment ->> 'fileName', 'Attachment'),

      attachment ->> 'filePath',

      case

        when coalesce(attachment ->> 'fileSize', '') ~ '^\d+$'

          then (attachment ->> 'fileSize')::bigint

        else 0

      end,

      coalesce(attachment ->> 'mimeType', '')

    );

  end loop;



  normalized_submission := jsonb_build_object(

    'id', submission_id::text,

    'version', submission_version,

    'note', completion_note,

    'submitterId', caller::text,

    'submitterName', coalesce(caller_name, 'User'),

    'submittedAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint,

    'attachments', coalesce(p_submission -> 'attachments', '[]'::jsonb)

  );



  perform set_config('eflow.allow_status_write', 'on', true);

  update public.tasks

  set

    reviewer_id = resolved_reviewer,

    latest_submission = normalized_submission,

    feedback = null,

    percent_complete = 100,

    status = 'for_review',

    last_activity_at = now()

  where id = p_task_id

  returning * into t;

  perform set_config('eflow.allow_status_write', 'off', true);



  insert into public.task_status_history (

    task_id, from_status, to_status, actor_id, actor_name, note

  ) values (

    p_task_id, 'in_progress', 'for_review', caller,

    coalesce(caller_name, 'User'), completion_note

  );



  insert into public.task_activities (

    task_id, type, content, actor_id, actor_name

  ) values (

    p_task_id, 'for_review', completion_note, caller,

    coalesce(caller_name, 'User')

  );



  insert into public.audit_events (

    actor_id, actor_name, entity_type, entity_id, action,

    reason, before_data, after_data, org_id

  ) values (

    caller, coalesce(caller_name, 'User'), 'task', p_task_id::text,

    'task.transition.for_review', completion_note,

    jsonb_build_object('status', 'in_progress'),

    jsonb_build_object(

      'status', 'for_review',

      'submissionId', submission_id,

      'submissionVersion', submission_version,

      'reviewerId', resolved_reviewer

    ),

    t.org_id

  );



  if resolved_reviewer <> caller then

    insert into public.notifications (

      user_id, type, title, message, task_id, task_title,

      actor_id, actor_name, status_from, status_to, reason

    ) values (

      resolved_reviewer, 'approval_needed', 'Task ready for review',

      coalesce(caller_name, 'Someone') || ' submitted "' || t.title || '" for review.',

      p_task_id, t.title, caller, coalesce(caller_name, 'User'),

      'in_progress', 'for_review', completion_note

    );

  end if;



  return t;

end;

$function$
;
CREATE OR REPLACE FUNCTION public.decide_task_review(p_task_id uuid, p_approve boolean, p_feedback text DEFAULT NULL::text, p_audit_hash text DEFAULT NULL::text)
 RETURNS tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  caller uuid := auth.uid();

  caller_role text;

  caller_name text;

  task_row public.tasks;

  submission public.task_submissions;

  next_status text;

  decision_hash text;

  recipient_id uuid;

  office_finalization boolean;

begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact(p_task_id); /* NW4.2 completion serialization */ perform eflow_r7.lock_completion(p_task_id);

  if caller is null then

    raise exception 'Not authenticated' using errcode = '42501';

  end if;



  if not p_approve and coalesce(btrim(p_feedback), '') = '' then

    raise exception 'Feedback is required when requesting changes'

      using errcode = '22023';

  end if;



  select role::text, full_name

    into caller_role, caller_name

  from public.profiles

  where id = caller and is_active;



  select *

    into task_row

  from public.tasks

  where id = p_task_id

    and deleted_at is null

  for update;



  if not found then

    raise exception 'Task not found' using errcode = 'P0002';

  end if;



  if task_row.status <> 'for_review' then

    raise exception 'Task is not awaiting review' using errcode = '22023';

  end if;



  select *

    into submission

  from public.task_submissions

  where task_id = p_task_id

  order by version desc

  limit 1

  for update;



  if not found then

    raise exception 'No review submission exists' using errcode = '22023';

  end if;



  if exists(select 1 from public.projects where id=task_row.linked_project_id and project_lead_id is not null) and (caller is distinct from eflow_project.reviewer(task_row.id,submission.submitter_id) or caller=submission.submitter_id) then raise exception 'Only the current independent project reviewer may decide this task' using errcode='42501';end if;
  office_finalization := task_row.review_route_mode='organization_default'

    and task_row.reviewer_id=caller and public.is_office_output_reviewer(task_row.org_id,caller);

  if caller_role is null or caller_role='admin' then raise exception 'Operational account required' using errcode='42501'; end if;

  if submission.submitter_id = caller and not coalesce(office_finalization,false) then

    raise exception 'You cannot review your own submission' using errcode = '42501';

  end if;



  if not (

    task_row.reviewer_id = caller

    or task_row.backup_reviewer_id = caller

  ) then

    raise exception 'Only the assigned reviewer may decide this submission'

      using errcode = '42501';

  end if;



  next_status := case when p_approve then 'completed' else 'changes_requested' end;

  decision_hash := case when p_approve then encode(

    extensions.digest(

      p_task_id::text || ':' || submission.id::text || ':' || caller::text || ':' ||

      clock_timestamp()::text,

      'sha256'

    ),

    'hex'

  ) else null end;



  perform set_config('eflow.allow_status_write', 'on', true);

  perform set_config('eflow.review_decision_authorized', 'on', true);



  update public.tasks

  set

    status = next_status,

    percent_complete = case when p_approve then 100 else 99 end,

    feedback = nullif(btrim(p_feedback), ''),

    rejection_note = case

      when p_approve then rejection_note

      else nullif(btrim(p_feedback), '')

    end,

    rejected_at = case when p_approve then rejected_at else now() end,

    audit_hash = coalesce(decision_hash, audit_hash),

    last_activity_at = now()

  where id = p_task_id

  returning * into task_row;



  perform set_config('eflow.review_decision_authorized', 'off', true);

  perform set_config('eflow.allow_status_write', 'off', true);



  update public.task_submissions

  set

    status = case when p_approve then 'approved' else 'changes_requested' end,

    decided_by = caller,

    decided_by_name = coalesce(caller_name, 'Reviewer'),

    decision_feedback = nullif(btrim(p_feedback), ''),

    decided_at = now()

  where id = submission.id;



  insert into public.task_status_history (

    task_id, from_status, to_status, actor_id, actor_name, note

  ) values (

    p_task_id, 'for_review', next_status, caller,

    coalesce(caller_name, 'Reviewer'), nullif(btrim(p_feedback), '')

  );



  insert into public.task_activities (

    task_id, type, content, actor_id, actor_name

  ) values (

    p_task_id, next_status,

    coalesce(

      nullif(btrim(p_feedback), ''),

      case when p_approve then 'Review approved' else 'Changes requested' end

    ),

    caller, coalesce(caller_name, 'Reviewer')

  );



  insert into public.audit_events (

    actor_id, actor_name, entity_type, entity_id, action,

    reason, before_data, after_data, org_id

  ) values (

    caller, coalesce(caller_name, 'Reviewer'), 'task', p_task_id::text,

    'task.transition.' || next_status, nullif(btrim(p_feedback), ''),

    jsonb_build_object('status', 'for_review', 'submissionId', submission.id),

    jsonb_build_object('status', next_status, 'auditHash', decision_hash,

      'performedBy',submission.submitter_id,'finalizedBy',caller,'officeId',task_row.org_id,

      'authority',case when office_finalization then 'Office Head' else 'Assigned reviewer' end,

      'selfFinalization',submission.submitter_id=caller),

    task_row.org_id

  );



  for recipient_id in

    select distinct recipient.user_id

    from unnest(array[

      task_row.assigned_to,

      submission.submitter_id,

      task_row.recommendation_lead_id

    ]) as recipient(user_id)

    where recipient.user_id is not null

      and recipient.user_id <> caller

  loop

    insert into public.notifications (

      user_id, type, title, message, task_id, task_title,

      actor_id, actor_name, status_from, status_to, reason

    ) values (

      recipient_id,

      case when p_approve then 'completed' else 'status_change' end,

      case when p_approve then 'Task approved' else 'Changes requested' end,

      case

        when p_approve then 'Your work on "' || task_row.title || '" was approved.'

        else 'Changes were requested for "' || task_row.title || '".'

      end,

      p_task_id, task_row.title, caller, coalesce(caller_name, 'Reviewer'),

      'for_review', next_status, coalesce(nullif(btrim(p_feedback), ''), '')

    );

  end loop;



  return task_row;

end;

$function$
;
CREATE OR REPLACE FUNCTION public.decide_petty_cash_request(p_request_id uuid, p_approve boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare

  caller uuid := auth.uid();

  request public.petty_cash_requests;

  budget public.department_fiscal_budgets;

  allocation public.work_budget_allocations;

  allocation_used numeric;

begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact((select task_id from public.petty_cash_requests where id=p_request_id));

  select * into request from public.petty_cash_requests where id = p_request_id for update;

  if not found then raise exception 'Petty-cash request not found' using errcode = 'P0002'; end if;

  if request.status <> 'pending_department_approval' then raise exception 'This request is not awaiting department approval' using errcode = '22023'; end if;

  if not (case when exists(select 1 from public.tasks t join public.projects p on p.id=t.linked_project_id where t.id=request.task_id and p.project_lead_id is not null) then caller=eflow_project.reviewer(request.task_id,request.requester_id) else public.is_department_budget_approver(request.org_id,caller) end) then raise exception 'Only the Head or Assistant Head can decide this request' using errcode = '42501'; end if;

  if caller = request.requester_id or caller=request.cash_recipient_id then raise exception 'You cannot approve your own request' using errcode = '42501'; end if;

  if caller = request.leader_decided_by then raise exception 'The Team Leader endorsement and department approval must be made by different people' using errcode = '42501'; end if;

  if not p_approve and nullif(btrim(p_reason), '') is null then raise exception 'A reason is required when declining' using errcode = '22023'; end if;

  if p_approve then

    select * into budget from public.department_fiscal_budgets where id = request.fiscal_budget_id and status = 'locked' for update;

    if not found then raise exception 'The annual department budget is no longer open' using errcode = '22023'; end if;

    select * into allocation from public.work_budget_allocations where id = request.allocation_id and status = 'approved' for update;

    if not found then raise exception 'The work allocation is no longer available' using errcode = '22023'; end if;

    select coalesce(sum(case when status = 'settled' then actual_spent else approved_amount end), 0) into allocation_used

    from public.petty_cash_requests where allocation_id = allocation.id and id <> request.id

      and status in ('approved','scheduled_for_release','partially_released','released','liquidation_submitted','pending_leader_liquidation_review','pending_department_settlement','changes_requested','overdue_liquidation','settled');

    if allocation_used + request.requested_amount > allocation.amount then raise exception 'The work allocation is no longer sufficient' using errcode = '22023'; end if;

  end if;

  update public.petty_cash_requests set

    status = case when p_approve then 'approved' else 'rejected' end,

    approved_amount = case when p_approve then requested_amount end,

    approved_by = caller, approval_reason = nullif(btrim(p_reason), ''),

    department_decision_reason = nullif(btrim(p_reason), ''), decided_at = now(), updated_at = now()

  where id = request.id;

  if p_approve then

    perform public.schedule_petty_cash_releases(request.id, caller);

    insert into public.budget_ledger_entries(fiscal_budget_id, org_id, commitment_id, allocation_id, petty_cash_request_id, entry_type, amount, description, actor_id)

    values (request.fiscal_budget_id, request.org_id, request.commitment_id, request.allocation_id, request.id,

      'petty_cash_reserved', request.requested_amount, 'Petty cash approved and scheduled under the daily release cap', caller);

  end if;

  insert into public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)

  select request.requester_id, 'petty_cash_decision', case when p_approve then 'Petty cash approved and scheduled' else 'Petty cash declined' end,

    case when p_approve then 'Your request was approved. Cash releases were scheduled under the department daily cap.' else 'Your petty-cash request was declined.' end,

    request.task_id, caller, coalesce(full_name, ''), coalesce(p_reason, ''), request.id, 'petty_cash_request' from public.profiles where id = caller;

end;

$function$
;
CREATE OR REPLACE FUNCTION eflow_budget.cash_request_v2(p_task uuid, p_subtask uuid, p_lines jsonb, p_purpose text, p_needed_by date, p_key uuid, p_existing uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$

declare caller uuid:=auth.uid();t public.tasks;a public.work_budget_allocations;b public.department_fiscal_budgets;c public.budget_commitments;

  cap public.work_budget_allocations;r public.petty_cash_requests;command eflow_budget.cash_commands;

  lines jsonb;line jsonb;payload jsonb;total numeric;source uuid;first_source uuid;created uuid;leader uuid;next_status text;

begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact(p_task);

  if caller is null or not exists(select 1 from public.profiles where id=caller and is_active and role not in ('admin','super_admin','viewer')) then raise exception 'Active operational account required' using errcode='42501';end if;

  if p_key is null or nullif(btrim(p_purpose),'') is null then raise exception 'Enter a purchase purpose and request key' using errcode='22023';end if;

  lines:=eflow_budget.canonical_cash_lines(p_lines);

  select sum((value->>'amount')::numeric) into total from jsonb_array_elements(lines);

  if not eflow_budget.valid_money(total) then raise exception 'Invalid final request total' using errcode='22023';end if;

  select * into t from public.tasks where id=p_task and deleted_at is null;

  leader:=coalesce(t.assigned_to,t.recommendation_lead_id);

  if t.id is null or leader is null then raise exception 'Funded task and Task Leader required' using errcode='22023';end if;

  if p_subtask is null then

    if caller<>leader then raise exception 'Only the Task Leader can submit a task-level request' using errcode='42501';end if;

  elsif not exists(select 1 from public.subtasks where id=p_subtask and task_id=p_task and (caller=leader or caller=any(coalesce(assigned_to_ids,'{}'::uuid[])))) then

    raise exception 'Only the Task Leader or an assigned contributor can request cash for this subtask' using errcode='42501';

  end if;

  payload:=jsonb_build_object('task',p_task,'subtask',p_subtask,'lines',lines,'purpose',btrim(p_purpose),'neededBy',p_needed_by,'existing',p_existing);

  -- Same-key calls serialize before checking the persisted command receipt.

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eflow:cash-command:'||caller::text||':'||p_key::text,0));

  select * into command from eflow_budget.cash_commands where actor_id=caller and idempotency_key=p_key;

  if command.request_id is not null then

    if command.payload is distinct from payload then raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;

    return command.request_id;

  end if;

  if p_existing is null then

    select * into r from public.petty_cash_requests where requester_id=caller and idempotency_key=p_key;

    if r.id is not null then

      if r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.requested_amount<>total or r.purpose<>btrim(p_purpose) or r.needed_by is distinct from p_needed_by

        or (r.funding_lines_payload is not null and eflow_budget.canonical_cash_lines(r.funding_lines_payload->'lines') is distinct from lines)

        or (r.funding_lines_payload is null and (jsonb_array_length(lines)<>1 or r.allocation_line_id is distinct from (lines->0->>'allocationLineId')::uuid)) then

        raise exception 'Request key belongs to a different purchase' using errcode='22023';end if;

      return r.id;

    end if;

  end if;

  if p_needed_by<(now() at time zone 'Asia/Manila')::date then raise exception 'Needed-by date cannot be earlier than today' using errcode='22023';end if;

  -- Shared lock order with the installed single-source writer: allocation,

  -- then fiscal authority, then request. NW adds its root lock at entry.

  select * into a from public.work_budget_allocations where task_id=p_task and subtask_id is null and status='approved' for update;

  if a.id is null then raise exception 'Work has no approved funding' using errcode='22023';end if;

  select * into c from public.budget_commitments where id=a.commitment_id and status='active';

  select * into b from public.department_fiscal_budgets where id=c.fiscal_budget_id and status='locked' for update;

  if b.id is null then raise exception 'The annual department budget is no longer open' using errcode='22023';end if;

  if p_existing is not null then

    select * into r from public.petty_cash_requests where id=p_existing for update;

    if r.id is null or r.requester_id<>caller or r.task_id is distinct from p_task or r.subtask_id is distinct from p_subtask or r.commitment_id is distinct from c.id then raise exception 'Only the requester can correct this request' using errcode='42501';end if;

    if r.status not in ('leader_changes_requested','department_changes_requested') then raise exception 'This request is not awaiting corrections' using errcode='22023';end if;

  end if;

  if p_subtask is not null then select * into cap from public.work_budget_allocations where task_id=p_task and subtask_id=p_subtask and status='approved' for update;end if;

  for line in select value from jsonb_array_elements(lines) loop

    source:=(line->>'allocationLineId')::uuid;

    if not exists(select 1 from public.work_budget_allocation_lines where id=source and allocation_id=a.id) then raise exception 'Source belongs to different work' using errcode='42501';end if;

    if cap.id is not null then

      if source is distinct from cap.parent_allocation_line_id or (line->>'amount')::numeric>public.subtask_cap_available(cap.id,p_existing) then raise exception 'Request exceeds its protected subtask source cap' using errcode='22023';end if;

    elsif (line->>'amount')::numeric>public.task_budget_line_available(source,p_existing) then raise exception 'Funding line has insufficient requestable balance' using errcode='22023';end if;

  end loop;

  first_source:=(lines->0->>'allocationLineId')::uuid;

  next_status:=case when caller=leader then 'pending_department_approval' else 'pending_leader_review' end;
  if exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null) then leader:=eflow_project.reviewer(t.id,caller);if leader is null then raise exception 'Appoint an independent project reviewer before requesting cash' using errcode='23514';end if;next_status:='pending_department_approval';end if;

  if p_existing is null then

    insert into public.petty_cash_requests(fiscal_budget_id,commitment_id,allocation_id,allocation_line_id,org_id,task_id,subtask_id,requester_id,task_leader_id,cash_recipient_id,purpose,requested_amount,needed_by,status,reservation_expires_at,idempotency_key,funding_lines_payload)

    values(b.id,c.id,coalesce(cap.id,a.id),first_source,b.org_id,t.id,p_subtask,caller,leader,caller,btrim(p_purpose),total,p_needed_by,next_status,now()+interval '7 days',p_key,payload) returning id into created;

    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,financial_record_id,financial_record_type)

      select recipient,case when next_status='pending_leader_review' then 'petty_cash_leader_review' else 'petty_cash_department_approval' end,

        case when next_status='pending_leader_review' then 'Cash request needs your endorsement' else 'Cash request needs fiscal authorization' end,

        coalesce(profile.full_name,'A contributor')||' requested '||to_char(total,'FM999G999G999G990D00')||' for '||btrim(p_purpose)||' in "'||t.title||'".',

        t.id,t.title,caller,coalesce(profile.full_name,''),created,'petty_cash_request'

      from (select leader as recipient where next_status='pending_leader_review' or exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null) union all select public.organization_approver_ids(b.org_id) where next_status='pending_department_approval' and not exists(select 1 from public.projects where id=t.linked_project_id and project_lead_id is not null)) recipients

      left join public.profiles profile on profile.id=caller where recipient<>caller;

  else

    created:=r.id;

    update public.petty_cash_requests set allocation_line_id=first_source,allocation_id=coalesce(cap.id,a.id),requested_amount=total,funding_lines_payload=payload,purpose=btrim(p_purpose),needed_by=p_needed_by,

      status=next_status,approved_amount=null,approved_by=null,approval_reason=null,decided_at=null,leader_decided_by=null,leader_decision_reason=null,leader_decided_at=null,

      department_decision_reason=null,reservation_expires_at=now()+interval '7 days',updated_at=now() where id=created;

  end if;

  insert into eflow_budget.cash_commands(actor_id,idempotency_key,request_id,payload) values(caller,p_key,created,payload);

  return created;

end $function$
;
CREATE OR REPLACE FUNCTION public.decide_petty_cash_liquidation_leader_review(p_liquidation_id uuid, p_approve boolean, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare caller uuid := auth.uid(); liquidation public.petty_cash_liquidations; request public.petty_cash_requests;

begin /* NW5.2 shared writer lock */ perform eflow_r7.lock_impact((select c.task_id from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id where l.id=p_liquidation_id));

  select * into liquidation from public.petty_cash_liquidations where id = p_liquidation_id for update;

  if not found then raise exception 'Liquidation not found' using errcode = 'P0002'; end if;

  select * into request from public.petty_cash_requests where id = liquidation.request_id for update;

  if liquidation.status <> 'pending_leader_review' or request.status <> 'pending_leader_liquidation_review' then raise exception 'This liquidation is not awaiting Team Leader review' using errcode = '22023'; end if;

  if (case when exists(select 1 from public.tasks t join public.projects p on p.id=t.linked_project_id where t.id=request.task_id and p.project_lead_id is not null) then caller is distinct from eflow_project.reviewer(request.task_id,request.cash_recipient_id) else request.task_leader_id<>caller end) then raise exception 'Only the assigned Team Leader can review this liquidation' using errcode = '42501'; end if;

  if request.cash_recipient_id = caller then raise exception 'You cannot review your own liquidation' using errcode = '42501'; end if;

  if not p_approve and nullif(btrim(p_reason), '') is null then raise exception 'Explain what must be corrected' using errcode = '22023'; end if;

  update public.petty_cash_liquidations set status = case when p_approve then 'pending_department_settlement' else 'changes_requested' end,

    leader_decided_by = caller, leader_decision_reason = nullif(btrim(p_reason), ''), leader_decided_at = now()

  where id = liquidation.id;

  update public.petty_cash_requests set status = case when p_approve then 'pending_department_settlement' else 'changes_requested' end, updated_at = now() where id = request.id;

  if p_approve then

    insert into public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, financial_record_id, financial_record_type)

    select approver_id, 'petty_cash_liquidation_department_review', 'Endorsed liquidation ready for settlement',

      'The Team Leader endorsed receipts totaling ' || to_char(liquidation.declared_spent, 'FM999G999G999G990D00') || '.',

      request.task_id, caller, coalesce(profile.full_name, ''), liquidation.id, 'petty_cash_liquidation'

    from public.organization_approver_ids(request.org_id) approver_id left join public.profiles profile on profile.id = caller

    where approver_id <> caller;

  else

    insert into public.notifications(user_id, type, title, message, task_id, actor_id, actor_name, reason, financial_record_id, financial_record_type)

    select request.cash_recipient_id, 'petty_cash_liquidation_changes', 'Expense liquidation needs changes',

      'Your Team Leader returned the liquidation for correction.', request.task_id, caller, coalesce(full_name, ''), p_reason, liquidation.id, 'petty_cash_liquidation'

    from public.profiles where id = caller;

  end if;

end;

$function$
;
CREATE OR REPLACE FUNCTION public.phase7_activate_project(p_project uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects; r jsonb;
begin
 if not eflow_project.ready(p_project) then raise exception 'Finish project details and funding setup before activation' using errcode='23514';end if;
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) then raise exception 'Only the Lead Head can activate this project' using errcode='42501';end if;
 if p.source_collaboration_draft_id is not null then raise exception 'Use the existing proposal approval workflow' using errcode='22023';end if;
 if p.status='active' then return;end if;
 r:=eflow_phase7.readiness(p.id);
 if not (r->>'canActivate')::boolean then raise exception 'Project readiness is incomplete' using errcode='22023',detail=(r->'checks')::text;end if;
 update public.projects set status='active',updated_at=now() where id=p.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project',p.id::text,'project.activated',p.org_id,r);
end $function$
;

create function eflow_project.guard_cash_route() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid;r uuid;
begin
 select linked_project_id into project from public.tasks where id=new.task_id;
 if exists(select 1 from public.projects where id=project and project_lead_id is not null) and new.status in ('pending_leader_review','pending_department_approval') then
 r:=eflow_project.reviewer(new.task_id,new.requester_id);
 if r is null or r=new.cash_recipient_id then raise exception 'No independent project reviewer is available for this cash request' using errcode='23514';end if;
 new.task_leader_id:=r;new.status:='pending_department_approval';
 end if;
 return new;
end $$;
create trigger aa_project_cash_review_route before insert or update on public.petty_cash_requests for each row execute function eflow_project.guard_cash_route();
create function eflow_project.read_cash(p_task uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.tasks t where t.id=p_task and eflow_project.lead(t.linked_project_id,auth.uid())) $$;
create policy project_lead_cash_read on public.petty_cash_requests for select to authenticated using(eflow_project.read_cash(task_id));
create policy project_lead_liquidation_read on public.petty_cash_liquidations for select to authenticated using(exists(select 1 from public.petty_cash_requests r where r.id=request_id and eflow_project.read_cash(r.task_id)));
create function eflow_project.release_task_line(p_line uuid,p_amount numeric,p_reason text,p_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.work_budget_allocation_lines;a public.work_budget_allocations;t public.tasks;p public.projects;available numeric;remaining numeric;payload jsonb;receipt eflow_project.commands;
begin
 select wa.* into a from public.work_budget_allocations wa join public.work_budget_allocation_lines line on line.allocation_id=wa.id where line.id=p_line;
 perform eflow_r7.lock_impact(a.task_id);
 select * into t from public.tasks where id=a.task_id;select * into p from public.projects where id=t.linked_project_id for update;
 if p.id is null or auth.uid() is null or not (eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id)) then raise exception 'Current project lead or Head required' using errcode='42501';end if;
 payload:=jsonb_build_object('line',p_line,'amount',p_amount,'reason',p_reason);
 select * into receipt from eflow_project.commands where actor_id=auth.uid() and request_id=p_key;
 if found then if receipt.payload<>payload then raise exception 'Release request terms changed' using errcode='23514';end if;return;end if;
 select * into a from public.work_budget_allocations where id=a.id for update;
 select * into l from public.work_budget_allocation_lines where id=p_line for update;
 if l.project_funding_id is null or a.subtask_id is not null or a.status<>'approved' or p_amount is null or p_amount<=0 or p_amount<>round(p_amount,2) or p_key is null or btrim(coalesce(p_reason,''))='' then raise exception 'Choose an approved task source, positive amount and release reason' using errcode='23514';end if;
 available:=public.task_budget_line_available(l.id,null);
 if p_amount>available then raise exception 'Only % is unused; cash obligations and subtask allocations remain protected',available using errcode='23514';end if;
 update public.work_budget_allocation_lines set amount=amount-p_amount,unit_cost=greatest(unit_cost-p_amount,0) where id=l.id;
 select sum(amount) into remaining from public.work_budget_allocation_lines where allocation_id=a.id;
 if remaining=0 then update public.work_budget_allocations set status='cancelled',decision_reason=p_reason,updated_at=now() where id=a.id;else update public.work_budget_allocations set amount=remaining,decision_reason=p_reason,updated_at=now() where id=a.id;end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,reason,before_data,after_data) values(auth.uid(),'task',t.id::text,'project.task_unused_funding_released',p.org_id,p_reason,jsonb_build_object('line',l.id,'amount',l.amount),jsonb_build_object('amount',l.amount-p_amount));
 insert into eflow_project.commands values(auth.uid(),p_key,payload,'{}');
end $$;
create function public.release_project_task_funding(p_line uuid,p_amount numeric,p_reason text,p_key uuid) returns void language sql security invoker set search_path='' as $$select eflow_project.release_task_line(p_line,p_amount,p_reason,p_key)$$;
revoke all on function public.release_project_task_funding(uuid,numeric,text,uuid) from public,anon;grant execute on function public.release_project_task_funding(uuid,numeric,text,uuid) to authenticated;
create function eflow_project.guard_dependencies() returns trigger language plpgsql security definer set search_path='' as $$
declare pending_titles text;candidate uuid;
begin
 if tg_op='DELETE' then
 if exists(select 1 from public.tasks where old.id=any(dependency_ids) and deleted_at is null and status<>'cancelled') then raise exception 'Remove this task from dependent tasks before deleting it' using errcode='23514';end if;return old;
 end if;
 if cardinality(coalesce(new.dependency_ids,'{}'::uuid[]))>0 then
 perform pg_advisory_xact_lock(hashtextextended('eflow:project-dependencies:'||coalesce(new.linked_project_id,new.id)::text,0));
 if new.id=any(new.dependency_ids) or cardinality(new.dependency_ids)<>(select count(distinct id) from unnest(new.dependency_ids) id) then raise exception 'A task cannot depend on itself or select a prerequisite twice' using errcode='23514';end if;
 if exists(select 1 from unnest(new.dependency_ids) id where not exists(select 1 from public.tasks t where t.id=id and t.linked_project_id is not distinct from new.linked_project_id and t.deleted_at is null and t.archived_at is null and t.status<>'cancelled')) then raise exception 'Choose existing, available prerequisites from this project' using errcode='23514';end if;
 if exists(with recursive chain as(select t.id,t.dependency_ids,array[t.id] path from public.tasks t where t.id=any(new.dependency_ids) union all select t.id,t.dependency_ids,c.path||t.id from public.tasks t join chain c on t.id=any(c.dependency_ids) where not t.id=any(c.path)) select 1 from chain where new.id=any(dependency_ids)) then raise exception 'Dependencies cannot form a circular chain' using errcode='23514';end if;
 if new.status in ('in_progress','for_review','completed') then
 select string_agg(t.title,', ') into pending_titles from public.tasks t where t.id=any(new.dependency_ids) and t.status<>'completed';
 if pending_titles is not null then raise exception 'This task is blocked until every prerequisite is completed and approved: %',pending_titles using errcode='23514';end if;
 end if;
 if new.start_date is not null and exists(select 1 from public.tasks t where t.id=any(new.dependency_ids) and t.status<>'completed' and coalesce(t.due_date::date,(nullif(t.deadline,'')::timestamptz at time zone 'Asia/Manila')::date)>new.start_date::date) then raise exception 'Task start date is earlier than a prerequisite due date. Adjust the schedule first' using errcode='23514';end if;
 end if;
 if tg_op='UPDATE' and (old.status='completed' and new.status<>'completed' or old.deleted_at is null and new.deleted_at is not null) and exists(select 1 from public.tasks t where old.id=any(t.dependency_ids) and t.deleted_at is null and t.status in ('in_progress','for_review','completed')) then raise exception 'Resolve started or approved dependent tasks before reopening or deleting this prerequisite' using errcode='23514';end if;
 return new;
end $$;
create trigger project_dependency_validation before insert or update or delete on public.tasks for each row execute function eflow_project.guard_dependencies();
create function public.project_flow_snapshot(p_project uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_project.snapshot(p_project)$$;
revoke all on function public.project_flow_snapshot(uuid) from public,anon;grant execute on function public.project_flow_snapshot(uuid) to authenticated;
create function public.save_project_definition(p_project uuid,p_details jsonb) returns public.projects language sql security invoker set search_path='' as $$select eflow_project.save_details(p_project,p_details)$$;
revoke all on function public.save_project_definition(uuid,jsonb) from public,anon;grant execute on function public.save_project_definition(uuid,jsonb) to authenticated;
create function public.finish_project_setup(p_project uuid) returns void language sql security invoker set search_path='' as $$select eflow_project.finish_setup(p_project)$$;
revoke all on function public.finish_project_setup(uuid) from public,anon;grant execute on function public.finish_project_setup(uuid) to authenticated;
create function public.authorize_project_funding(p_project uuid,p_lines jsonb,p_reason text,p_key uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_project.authorize_funding(p_project,p_lines,p_reason,p_key)$$;
revoke all on function public.authorize_project_funding(uuid,jsonb,text,uuid) from public,anon;grant execute on function public.authorize_project_funding(uuid,jsonb,text,uuid) to authenticated;
create function public.allocate_project_task_funding(p_task uuid,p_lines jsonb,p_reason text,p_key uuid) returns uuid language sql security invoker set search_path='' as $$select eflow_project.allocate_task(p_task,p_lines,p_reason,p_key)$$;
revoke all on function public.allocate_project_task_funding(uuid,jsonb,text,uuid) from public,anon;grant execute on function public.allocate_project_task_funding(uuid,jsonb,text,uuid) to authenticated;
create function public.request_project_funding(p_project uuid,p_lines jsonb,p_reason text,p_key uuid) returns uuid language sql security invoker set search_path='' as $$select eflow_project.request_funding(p_project,p_lines,p_reason,p_key)$$;
revoke all on function public.request_project_funding(uuid,jsonb,text,uuid) from public,anon;grant execute on function public.request_project_funding(uuid,jsonb,text,uuid) to authenticated;
create function public.decide_project_funding(p_request uuid,p_approve boolean,p_reason text) returns void language sql security invoker set search_path='' as $$select eflow_project.decide_funding(p_request,p_approve,p_reason)$$;
revoke all on function public.decide_project_funding(uuid,boolean,text) from public,anon;grant execute on function public.decide_project_funding(uuid,boolean,text) to authenticated;
create function public.release_project_funding(p_project uuid,p_source uuid,p_amount numeric,p_reason text,p_key uuid) returns void language sql security invoker set search_path='' as $$select eflow_project.release_funding(p_project,p_source,p_amount,p_reason,p_key)$$;
revoke all on function public.release_project_funding(uuid,uuid,numeric,text,uuid) from public,anon;grant execute on function public.release_project_funding(uuid,uuid,numeric,text,uuid) to authenticated;
revoke all on all tables in schema eflow_project from public,anon,authenticated;revoke all on all functions in schema eflow_project from public,anon;grant execute on all functions in schema eflow_project to authenticated;
notify pgrst,'reload schema';

create index project_funding_commitment_idx on eflow_project.funding(commitment_id);
create index project_funding_partition_idx on eflow_project.funding(partition_id);
create index project_funding_request_project_idx on eflow_project.funding_requests(project_id,status);
create index task_allocation_project_source_idx on public.work_budget_allocation_lines(project_funding_id) where project_funding_id is not null;
