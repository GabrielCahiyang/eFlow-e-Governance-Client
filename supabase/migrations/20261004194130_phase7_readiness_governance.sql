begin;
set local lock_timeout='10s';
create schema if not exists eflow_phase7;
revoke all on schema eflow_phase7 from public,anon,authenticated;
grant usage on schema eflow_phase7 to service_role;

create table public.project_readiness_reviews (
 project_id uuid not null references public.projects(id) on delete cascade,
 review_kind text not null check(review_kind in ('structure','dates','budget')),
 fingerprint text not null,
 reviewed_by uuid not null references public.profiles(id),
 reviewed_at timestamptz not null default now(),
 primary key(project_id,review_kind)
);
create index project_readiness_reviews_actor on public.project_readiness_reviews(reviewed_by);
alter table public.project_readiness_reviews enable row level security;
revoke all on public.project_readiness_reviews from public,anon,authenticated;
grant select on public.project_readiness_reviews to authenticated;
grant all on public.project_readiness_reviews to service_role;
create policy readiness_reviews_read on public.project_readiness_reviews for select to authenticated
 using(public.can_see_project(project_id,(select auth.uid())));

-- Changes to delivery progress, minor names, notes and manual order do not
-- invalidate a review. Scope, ownership, dates, dependencies and money do.
create function eflow_phase7.fingerprint(p_id uuid,p_kind text) returns text language sql stable security definer set search_path='' as $$
 select md5(jsonb_build_object(
 'project',case p_kind when 'structure' then jsonb_build_array(p.description,p.org_id)
  when 'dates' then jsonb_build_array(p.start_date,p.target_date) else '[]'::jsonb end,
 'tasks',(select coalesce(jsonb_agg(case p_kind
  when 'structure' then jsonb_build_array(t.id,t.description,t.org_id,t.acceptance_criteria,t.definition_of_done)
  when 'dates' then jsonb_build_array(t.id,t.start_date,t.deadline,t.dependency_ids)
  else jsonb_build_array(t.id,t.budget_impact) end order by t.id),'[]'::jsonb)
  from public.tasks t where t.linked_project_id=p.id and t.deleted_at is null and t.status<>'cancelled'),
 'offices',case when p_kind='structure' then (select coalesce(jsonb_agg(jsonb_build_array(o.office_id,o.relationship_type,o.invitation_status) order by o.office_id),'[]'::jsonb) from public.project_offices o where o.project_id=p.id and o.invitation_status<>'revoked') else '[]'::jsonb end
 )::text) from public.projects p where p.id=p_id;
$$;

create function eflow_phase7.readiness(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.projects; checks jsonb:='[]'; k text; label text; n int; good boolean; governed boolean;
begin
 select * into p from public.projects where id=p_id;
 if p.id is null then raise exception 'Project not found' using errcode='P0002';end if;
 governed:=p.source_collaboration_draft_id is not null;
 foreach k in array array['structure','dates','budget'] loop
  label:=case k when 'structure' then 'Project structure reviewed' when 'dates' then 'Project dates confirmed' else 'Budget information reviewed' end;
  good:=governed or exists(select 1 from public.project_readiness_reviews r where r.project_id=p.id and r.review_kind=k and r.fingerprint=eflow_phase7.fingerprint(p.id,k) and public.phase2_is_office_head(r.reviewed_by,p.org_id));
  checks:=checks||jsonb_build_array(jsonb_build_object('key',k,'label',label,'ok',good,'detail',case when governed then 'Use the existing proposal governance review.' when good then 'Current revision reviewed by the Lead Head.' else 'Lead Head review is needed for this revision.' end));
 end loop;
 select count(*) into n from public.tasks where linked_project_id=p.id and deleted_at is null and status<>'cancelled';
 checks:=checks||jsonb_build_array(jsonb_build_object('key','work','label','Delivery work exists','ok',n>0,'detail',n||' required tasks'));
 good:=p.start_date is not null and p.target_date is not null and p.target_date>=p.start_date;
 checks:=checks||jsonb_build_array(jsonb_build_object('key','schedule','label','Project schedule is valid','ok',good,'detail','Set both project dates in the Timeline view.'));
 select count(*) into n from public.project_offices where project_id=p.id and invitation_status in ('pending','awaiting_head');
 checks:=checks||jsonb_build_array(jsonb_build_object('key','invitations','label','Office invitations accepted','ok',n=0,'detail',n||' Offices awaiting acceptance or Head confirmation'));
 select count(*) into n from public.tasks t where t.linked_project_id=p.id and t.deleted_at is null and t.status<>'cancelled'
  and (t.org_id is null or not exists(select 1 from public.project_offices o where o.project_id=p.id and o.office_id=t.org_id and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating')));
 checks:=checks||jsonb_build_array(jsonb_build_object('key','responsibilities','label','Responsible Offices confirmed','ok',governed or n=0,'detail',n||' tasks need a joined responsible Office'));
 select count(*) into n from public.tasks t where t.linked_project_id=p.id and t.deleted_at is null and t.status not in ('completed','cancelled') and
  (t.assigned_to is null or not exists(select 1 from public.profiles u where u.id=t.assigned_to and u.is_active and u.org_id=t.org_id and u.role<>'admin') or
  (not governed and not exists(select 1 from public.project_offices o where o.project_id=p.id and o.office_id=t.org_id and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating') and
   (o.relationship_type='lead' or public.phase2_is_office_head(t.assigned_to,t.org_id) or exists(select 1 from public.project_office_members m where m.project_office_id=o.id and m.user_id=t.assigned_to)))));
 checks:=checks||jsonb_build_array(jsonb_build_object('key','staffing','label','Required task owners assigned','ok',n=0,'detail',n||' tasks need eligible owners selected by their own Office'));
 good:=not exists(select 1 from jsonb_array_elements(checks) c where not (c->>'ok')::boolean);
 return jsonb_build_object('projectId',p.id,'checks',checks,'ready',good,'canActivate',good and p.status in ('planning','on_hold'),
 'stage',case when p.status in ('completed','archived') then 'Closed' when good and p.status='active' then 'Active' when good then 'Ready' when p.status='on_hold' then 'Revision review' when exists(select 1 from public.project_offices o where o.project_id=p.id and o.invitation_status in ('pending','awaiting_head')) then 'Office coordination' else 'Planning' end,
 'governed',governed);
end $$;

create function public.phase7_project_readiness(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_see_project(p_project,auth.uid()) then raise exception 'Project access required' using errcode='42501';end if;
 return eflow_phase7.readiness(p_project);
end $$;
create function public.phase7_review_project(p_project uuid,p_kind text) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 select * into p from public.projects where id=p_project for update;
 if not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) then raise exception 'Only the appointed Lead Head can review readiness' using errcode='42501';end if;
 if p.status in ('completed','archived') or p.source_collaboration_draft_id is not null or p_kind not in ('structure','dates','budget') then raise exception 'Readiness review is unavailable' using errcode='22023';end if;
 insert into public.project_readiness_reviews(project_id,review_kind,fingerprint,reviewed_by) values(p.id,p_kind,eflow_phase7.fingerprint(p.id,p_kind),auth.uid())
 on conflict(project_id,review_kind) do update set fingerprint=excluded.fingerprint,reviewed_by=excluded.reviewed_by,reviewed_at=now();
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project',p.id::text,'project.readiness_review',p.org_id,jsonb_build_object('kind',p_kind));
end $$;

-- Reuse closeout blockers verbatim and add required approved work evidence.
do $$ declare d text;begin
 select pg_get_functiondef('public.project_completion_readiness_internal(uuid)'::regprocedure) into d;
 execute replace(d,'FUNCTION public.project_completion_readiness_internal(','FUNCTION eflow_phase7.baseline_completion(');
end $$;
create or replace function public.project_completion_readiness_internal(p_project_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; blockers jsonb; p public.projects;
begin
 result:=eflow_phase7.baseline_completion(p_project_id);blockers:=result->'blockers';
 select * into p from public.projects where id=p_project_id;
 if p.status not in ('completed','archived') and p.source_collaboration_draft_id is null then
  blockers:=blockers||coalesce((select jsonb_agg(jsonb_build_object('kind','governance','id',p.id,'title',c->>'label','status','review_required','detail',c->>'detail')) from jsonb_array_elements(eflow_phase7.readiness(p.id)->'checks') c where not (c->>'ok')::boolean),'[]'::jsonb);
  blockers:=blockers||coalesce((select jsonb_agg(jsonb_build_object('kind','task','id',t.id,'taskId',t.id,'title',t.title,'status','evidence_required','detail','An approved task submission with completion evidence is required.')) from public.tasks t where t.linked_project_id=p.id and t.deleted_at is null and t.status='completed' and not exists(select 1 from public.task_submissions s where s.task_id=t.id and s.status='approved')),'[]'::jsonb);
 end if;
 return result||jsonb_build_object('blockers',blockers,'canComplete',p.status in ('planning','active','on_hold') and jsonb_array_length(blockers)=0);
end $$;

create function public.phase7_closeout_summary(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.projects;summary jsonb;
begin
 if auth.uid() is null or not public.can_see_project(p_project,auth.uid()) then raise exception 'Project access required' using errcode='42501';end if;
 select * into p from public.projects where id=p_project;
 select jsonb_build_object('tasks',count(*),'completed',count(*) filter(where status='completed'),'cancelled',count(*) filter(where status='cancelled'),'budgetEstimate',coalesce(sum(budget_impact),0)) into summary from public.tasks where linked_project_id=p.id and deleted_at is null;
 return summary||jsonb_build_object('offices',(select count(*) from public.project_offices where project_id=p.id and invitation_status='joined'),
 'evidence',(select count(*) from public.task_submissions s join public.tasks t on t.id=s.task_id where t.linked_project_id=p.id and s.status='approved'),
 'contributors',(select count(distinct u) from public.tasks t cross join lateral unnest(array_append(coalesce(t.team_member_ids,'{}'::uuid[]),t.assigned_to)) u where t.linked_project_id=p.id and u is not null),
 'startDate',p.start_date,'targetDate',p.target_date,
 'financial',(select jsonb_build_object('requested',coalesce(sum(r.requested_amount),0),'approved',coalesce(sum(r.approved_amount),0),'settled',count(*) filter(where r.status='settled'),'open',count(*) filter(where r.status not in ('settled','rejected','cancelled'))) from public.petty_cash_requests r join public.tasks t on t.id=r.task_id where t.linked_project_id=p.id));
end $$;

create function public.phase7_activate_project(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects; r jsonb;
begin
 select * into p from public.projects where id=p_project for update;
 if not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) then raise exception 'Only the Lead Head can activate this project' using errcode='42501';end if;
 if p.source_collaboration_draft_id is not null then raise exception 'Use the existing proposal approval workflow' using errcode='22023';end if;
 if p.status='active' then return;end if;
 r:=eflow_phase7.readiness(p.id);
 if not (r->>'canActivate')::boolean then raise exception 'Project readiness is incomplete' using errcode='22023',detail=(r->'checks')::text;end if;
 update public.projects set status='active',updated_at=now() where id=p.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project',p.id::text,'project.activated',p.org_id,r);
end $$;

create function eflow_phase7.guard_project() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and auth.uid() is not null and new.source_collaboration_draft_id is distinct from old.source_collaboration_draft_id then raise exception 'Project governance identity is immutable' using errcode='42501';end if;
 if new.source_collaboration_draft_id is not null then return new;end if;
 if tg_op='INSERT' then
  if new.status='active' then raise exception 'Create the project in Planning, then review readiness' using errcode='22023';end if;
  return new;
 end if;
 if row(new.description,new.start_date,new.target_date) is distinct from row(old.description,old.start_date,old.target_date) and old.status='active' then new.status:='on_hold';end if;
 -- Preserve archive restoration. Legacy/stale plans return to Planning until
 -- reviewed, while current reviewed plans can resume their active workspace.
 if old.status='archived' and new.status='active' and new.archived_at is null then
  if not public.phase2_is_office_head(auth.uid(),new.org_id) or not public.can_manage_project(old.id,auth.uid()) then raise exception 'Only the Lead Head can restore this project' using errcode='42501';end if;
  if not (eflow_phase7.readiness(old.id)->>'ready')::boolean then new.status:='planning';end if;
 end if;
 if new.status='active' and old.status<>'active' then
  if old.status not in ('planning','on_hold') and not (old.status='archived' and new.archived_at is null) then raise exception 'Use the existing archive restore workflow to reopen a closed project' using errcode='22023';end if;
  if row(new.description,new.org_id,new.start_date,new.target_date,new.source_collaboration_draft_id) is distinct from row(old.description,old.org_id,old.start_date,old.target_date,old.source_collaboration_draft_id) then raise exception 'Save material changes and review them before activation' using errcode='22023';end if;
  if not public.phase2_is_office_head(auth.uid(),new.org_id) or not public.can_manage_project(old.id,auth.uid()) then raise exception 'Only the Lead Head can activate this project' using errcode='42501';end if;
  if not (eflow_phase7.readiness(old.id)->>'ready')::boolean then raise exception 'Project readiness is incomplete' using errcode='22023';end if;
 end if;
 return new;
end $$;
create trigger phase7_project_readiness before insert or update on public.projects for each row execute function eflow_phase7.guard_project();

create function eflow_phase7.material_change() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid;previous uuid;p public.projects; changed boolean:=true;
begin
 if tg_table_name='tasks' then
  if tg_op<>'DELETE' then pid:=new.linked_project_id;end if;
  if tg_op<>'INSERT' then previous:=old.linked_project_id;end if;
  if tg_op='UPDATE' then changed:=row(new.description,new.org_id,new.start_date,new.deadline,new.dependency_ids,new.budget_impact,new.deleted_at,new.linked_project_id,new.acceptance_criteria,new.definition_of_done,new.status='cancelled') is distinct from row(old.description,old.org_id,old.start_date,old.deadline,old.dependency_ids,old.budget_impact,old.deleted_at,old.linked_project_id,old.acceptance_criteria,old.definition_of_done,old.status='cancelled');end if;
 else
  if tg_op<>'DELETE' then pid:=new.project_id;end if;
  if tg_op<>'INSERT' then previous:=old.project_id;end if;
  if tg_op='UPDATE' then changed:=row(new.office_id,new.relationship_type,new.invitation_status) is distinct from row(old.office_id,old.relationship_type,old.invitation_status);end if;
 end if;
 if not changed then return null;end if;
 -- All relevant writes and activation serialize on the project row, preventing
 -- a stale readiness result from racing with an ownership/scope change.
 for p in select * from public.projects where id in (pid,previous) order by id for update loop
  if p.source_collaboration_draft_id is null and p.status='active' then
   update public.projects set status='on_hold',updated_at=now() where id=p.id;
   insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project',p.id::text,'project.material_change_review',p.org_id,jsonb_build_object('source',tg_table_name,'status','on_hold'));
  end if;
 end loop;
 return null;
end $$;
create trigger phase7_task_revision after insert or update or delete on public.tasks for each row execute function eflow_phase7.material_change();
create trigger phase7_office_revision after insert or update or delete on public.project_offices for each row execute function eflow_phase7.material_change();

revoke all on all functions in schema eflow_phase7 from public,anon,authenticated;
revoke all on function public.phase7_project_readiness(uuid),public.phase7_review_project(uuid,text),public.phase7_activate_project(uuid),public.phase7_closeout_summary(uuid) from public,anon;
grant execute on function public.phase7_project_readiness(uuid),public.phase7_review_project(uuid,text),public.phase7_activate_project(uuid),public.phase7_closeout_summary(uuid) to authenticated;
revoke all on function public.project_completion_readiness_internal(uuid) from public,anon,authenticated;
alter publication supabase_realtime add table public.project_readiness_reviews;
notify pgrst,'reload schema';
commit;
