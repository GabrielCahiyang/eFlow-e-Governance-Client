-- The existing completion trigger rechecks this function while holding the
-- project row lock also used by the project funding writers.
create or replace function public.project_completion_readiness_internal(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 result jsonb;
 blockers jsonb;
 p public.projects;
 unallocated numeric;
 returnable numeric;
 task_lines jsonb;
begin
 result:=eflow_phase7.baseline_completion(p_project_id);
 blockers:=result->'blockers';
 select * into p from public.projects where id=p_project_id;
 if p.status not in ('completed','archived') and p.source_collaboration_draft_id is null then
  blockers:=blockers||coalesce((select jsonb_agg(jsonb_build_object('kind','governance','id',p.id,'title',c->>'label','status','review_required','detail',c->>'detail')) from jsonb_array_elements(eflow_phase7.readiness(p.id)->'checks') c where not (c->>'ok')::boolean),'[]'::jsonb);
  blockers:=blockers||coalesce((select jsonb_agg(jsonb_build_object('kind','task','id',t.id,'taskId',t.id,'title',t.title,'status','evidence_required','detail','An approved task submission with completion evidence is required.')) from public.tasks t where t.linked_project_id=p.id and t.deleted_at is null and t.status='completed' and not exists(select 1 from public.task_submissions s where s.task_id=t.id and s.status='approved')),'[]'::jsonb);
 end if;

 -- Previously completed projects retain their existing archive policy.
 if p.status in ('planning','active','on_hold') then
  with active_funds as materialized (
   select f.id, f.amount, f.fiscal_year, f.partition_id
   from eflow_project.funding f
   join public.budget_commitments c on c.id=f.commitment_id and c.status='active'
   where f.project_id=p.id and f.amount>0
  ), task_allocations as materialized (
   select f.id as funding_id, l.id, l.amount, t.title, s.name, f.fiscal_year,
     case when t.linked_project_id=p.id then public.task_budget_line_available(l.id,null) else 0 end as available
   from active_funds f
   join public.work_budget_allocation_lines l on l.project_funding_id=f.id
   join public.work_budget_allocations a on a.id=l.allocation_id and a.subtask_id is null and a.status='approved'
   left join public.tasks t on t.id=a.task_id
   join public.office_budget_sections s on s.id=f.partition_id
  )
  select
   coalesce((select sum(greatest(0,f.amount-coalesce(allocated.amount,0)))
     from active_funds f left join
       (select funding_id,sum(amount) as amount from task_allocations group by funding_id) allocated
       on allocated.funding_id=f.id),0),
   coalesce(sum(available),0),
   coalesce(jsonb_agg(jsonb_build_object('id',id,'task',title,'source',name,'fiscalYear',fiscal_year,'available',available)
     order by title,name,id) filter (where available>0),'[]'::jsonb)
  into unallocated,returnable,task_lines
  from task_allocations;

  if unallocated+returnable>0 then
   blockers:=blockers||jsonb_build_array(jsonb_build_object(
    'kind','funding','id',p.id,'title','Return unused funding to Office Budget','status','release_required',
    'detail','Return unused task allocations to the project first, then have the Head release the remaining project funds to Office Budget before completing.',
    'amount',unallocated+returnable,
    'unusedFunding',jsonb_build_object('unallocated',unallocated,'taskAllocations',task_lines)
   ));
  end if;
 end if;
 return result||jsonb_build_object('blockers',blockers,'canComplete',p.status in ('planning','active','on_hold') and jsonb_array_length(blockers)=0);
end $$;
