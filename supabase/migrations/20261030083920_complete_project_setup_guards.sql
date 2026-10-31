create or replace function eflow_project.guard_work() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid;t public.tasks;
begin
 if tg_table_name='tasks' then project:=new.linked_project_id;
 elsif tg_table_name='subtasks' then select * into t from public.tasks where id=new.task_id;project:=t.linked_project_id;
 elsif tg_table_name='project_office_members' then select project_id into project from public.project_offices where id=new.project_office_id;
 else project:=new.project_id;end if;
 if project is null then return new;end if;
 if tg_table_name='project_offices' and to_jsonb(new)->>'relationship_type'='lead' and exists(select 1 from public.projects p where p.id=project and p.org_id=(to_jsonb(new)->>'office_id')::uuid) then return new;end if;
 if tg_table_name in ('project_members','project_office_members','project_access_grants') and exists(select 1 from public.projects where id=project and coalesce(to_jsonb(new)->>'user_id',to_jsonb(new)->>'recipient')::uuid in (owner_id,created_by,project_lead_id)) then return new;end if;
 if not eflow_project.ready(project) then raise exception 'Complete project details, dates, project lead and funding setup before adding tasks, subtasks or people' using errcode='23514';end if;
 return new;
end $$;
create trigger project_definition_before_offices before insert on public.project_offices for each row execute function eflow_project.guard_work();
create trigger project_definition_before_sharing before insert on public.project_access_grants for each row execute function eflow_project.guard_work();
create trigger project_definition_before_guests before insert on public.project_guest_members for each row execute function eflow_project.guard_work();

-- Separate reconciled cash returns from unclosed advances.
create or replace function eflow_project.snapshot(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
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
 'taskFunding',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'taskId',t.id,'task',t.title,'source',s.name,'amount',l.amount,'available',public.task_budget_line_available(l.id,null))) from public.work_budget_allocation_lines l join public.work_budget_allocations a on a.id=l.allocation_id join public.tasks t on t.id=a.task_id join public.office_budget_sections s on s.id=l.budget_partition_id where t.linked_project_id=p.id and a.subtask_id is null and a.status='approved' and l.project_funding_id is not null and public.can_see_task(t.id,auth.uid())),'[]'),
 'liquidations',coalesce((select jsonb_agg(jsonb_build_object('id',liq.id,'purpose',r.purpose,'spent',liq.declared_spent,'canReview',r.status='pending_leader_liquidation_review' and liq.status='pending_leader_review' and eflow_project.reviewer(t.id,r.cash_recipient_id)=auth.uid())) from public.petty_cash_liquidations liq join public.petty_cash_requests r on r.id=liq.request_id join public.tasks t on t.id=r.task_id where t.linked_project_id=p.id and (eflow_project.lead(p.id,auth.uid()) or public.phase2_is_office_head(auth.uid(),p.org_id))),'[]'),
 'fundingRequests',coalesce((select jsonb_agg(to_jsonb(fr)) from eflow_project.funding_requests fr where fr.project_id=p.id and fr.status='pending' and (fr.actor_id=auth.uid() or public.phase2_is_office_head(auth.uid(),p.org_id))),'[]'));
end $$;
