-- Additive leadership-only routing repair. Captured read-only from ixnfphgjyelhckjwjkdv on 2026-10-24.
-- No historical migration is modified; installation aborts on definition drift.
begin;
do $preflight$
begin
 if md5(replace(pg_get_functiondef('public.set_organization_leadership(uuid,uuid,uuid)'::regprocedure),chr(13),'')) <> 'e5df8a6ef2d74ee316f44bec0323a801' then raise exception 'Leadership repair preflight: definition drift in public.set_organization_leadership(uuid,uuid,uuid)';end if;
 if md5(replace(pg_get_functiondef('public.guard_super_admin_task_mutation()'::regprocedure),chr(13),'')) <> '3d6f89f8d7ab3f79778fddb5343eb768' then raise exception 'Leadership repair preflight: definition drift in public.guard_super_admin_task_mutation()';end if;
 if md5(replace(pg_get_functiondef('eflow_r7.guard_operation_write()'::regprocedure),chr(13),'')) <> 'b05c8d9f02cb30fa5d86d26bb70db629' then raise exception 'Leadership repair preflight: definition drift in eflow_r7.guard_operation_write()';end if;
 if md5(replace(pg_get_functiondef('public.phase6_guard_task()'::regprocedure),chr(13),'')) <> '12e1a6633a8e8350262fad8a89635248' then raise exception 'Leadership repair preflight: definition drift in public.phase6_guard_task()';end if;
end $preflight$;

create schema eflow_leadership;
revoke all on schema eflow_leadership from public,anon,authenticated;
-- Only the leadership RPC's owner can create these transaction-bound capabilities.
create table eflow_leadership.reroutes (
 tx bigint not null, actor uuid not null, task_id uuid not null,
 previous_reviewer uuid, previous_backup uuid, reviewer uuid,
 primary key(tx,actor,task_id)
);
alter table eflow_leadership.reroutes enable row level security;
revoke all on eflow_leadership.reroutes from public,anon,authenticated;
create function eflow_leadership.canonical_reroute(before_task public.tasks,after_task public.tasks)
returns boolean language sql stable security definer set search_path='' as $predicate$
 select auth.uid() is not null and public.is_admin(auth.uid())
 and before_task.review_route_mode='organization_default'
 and after_task.review_route_mode='organization_default'
 and before_task.deleted_at is null and before_task.status not in ('completed','cancelled')
 and (to_jsonb(before_task)-array['reviewer_id','backup_reviewer_id'])=
     (to_jsonb(after_task)-array['reviewer_id','backup_reviewer_id'])
 and exists(select 1 from eflow_leadership.reroutes c join public.organizations o on o.id=after_task.org_id
   where c.tx=txid_current() and c.actor=auth.uid() and c.task_id=after_task.id and o.is_active
   and c.previous_reviewer is not distinct from before_task.reviewer_id
   and c.previous_backup is not distinct from before_task.backup_reviewer_id
   and c.reviewer is not distinct from after_task.reviewer_id
   and o.head_user_id is not distinct from after_task.reviewer_id and after_task.backup_reviewer_id is null)
$predicate$;
revoke all on function eflow_leadership.canonical_reroute(public.tasks,public.tasks) from public,anon,authenticated;
-- Invoker trigger guard_super_admin_task_mutation needs only this boolean read.
-- The schema is not a Data API schema; no authenticated table-write capability is granted.
grant usage on schema eflow_leadership to authenticated;
grant execute on function eflow_leadership.canonical_reroute(public.tasks,public.tasks) to authenticated;
CREATE OR REPLACE FUNCTION public.set_organization_leadership(p_org_id uuid, p_head_user_id uuid DEFAULT NULL::uuid, p_assistant_head_user_id uuid DEFAULT NULL::uuid)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare caller uuid:=auth.uid(); previous_head uuid; selected_profile public.profiles; updated_org public.organizations;
begin
  if caller is null or not public.is_admin(caller) then raise exception 'Admin access is required' using errcode='42501'; end if;
  if p_assistant_head_user_id is not null then raise exception 'Only one Head may be assigned to an office' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eflow.office_leadership',0));
  select head_user_id into previous_head from public.organizations where id=p_org_id and is_active for update;
  if not found then raise exception 'Office not found or inactive' using errcode='22023'; end if;
  if p_head_user_id is not null then
    select * into selected_profile from public.profiles where id=p_head_user_id for update;
    if not found or not selected_profile.is_active or selected_profile.org_id is distinct from p_org_id or selected_profile.role='admin' then
      raise exception 'Head must already be an active member of this office' using errcode='22023';
    end if;
    if exists(select 1 from public.organizations where id<>p_org_id and head_user_id=p_head_user_id) then
      raise exception 'The selected Head already leads another office' using errcode='22023';
    end if;
  end if;
  update public.organizations set head_user_id=p_head_user_id,updated_at=now() where id=p_org_id returning * into updated_org;
  if p_head_user_id is not null then update public.profiles set role='head',updated_at=now() where id=p_head_user_id; end if;
  if previous_head is not null and previous_head is distinct from p_head_user_id then
    update public.profiles set role='member',updated_at=now() where id=previous_head and role='head'
      and not exists(select 1 from public.organizations where head_user_id=previous_head);
  end if;
  -- Lock/capture exact rows and original reviewers before granting a routing-only write.
  insert into eflow_leadership.reroutes(tx,actor,task_id,previous_reviewer,previous_backup,reviewer)
  select txid_current(),caller,t.id,t.reviewer_id,t.backup_reviewer_id,p_head_user_id
  from public.tasks t where t.org_id=p_org_id and t.deleted_at is null
    and t.status not in ('completed','cancelled') and t.review_route_mode='organization_default'
    and (t.reviewer_id is distinct from p_head_user_id or t.backup_reviewer_id is not null)
    -- Closed project history stays read-only, including unfinished archived work.
    and not exists(select 1 from public.projects p where p.id=t.linked_project_id and p.status in ('completed','archived'))
  for update of t;
  update public.tasks t set reviewer_id=c.reviewer,backup_reviewer_id=null
  from eflow_leadership.reroutes c where c.tx=txid_current() and c.actor=caller and c.task_id=t.id;
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,org_id)
    select caller,coalesce(full_name,'Admin'),'organization',p_org_id::text,'organization.leadership_changed',
      jsonb_build_object('headUserId',previous_head),jsonb_build_object('headUserId',p_head_user_id,'reroutedTaskIds',(select coalesce(jsonb_agg(task_id order by task_id),'[]'::jsonb) from eflow_leadership.reroutes where tx=txid_current() and actor=caller)),p_org_id
    from public.profiles where id=caller;
  delete from eflow_leadership.reroutes where tx=txid_current() and actor=caller;
  return updated_org;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_super_admin_task_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and public.is_super_admin(auth.uid()) then
    if tg_op='UPDATE' and eflow_leadership.canonical_reroute(old,new) then return new;end if;
    raise exception 'Admin task access is read-only. Ask the responsible organization to make this change.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$
;

CREATE OR REPLACE FUNCTION eflow_r7.guard_operation_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb:=case when tg_op<>'INSERT' then to_jsonb(old) else '{}' end;
 b jsonb:=case when tg_op<>'DELETE' then to_jsonb(new) else '{}' end;
 root_id uuid; r jsonb; node_id uuid; cmd text;payload jsonb;
begin
 root_id:=case when tg_table_name in ('tasks','personal_tasks') then (b->>'id')::uuid else coalesce((a->>'task_id')::uuid,(b->>'task_id')::uuid) end;
 if tg_table_name='tasks' and tg_op='UPDATE' and eflow_phase6.project_deletion_detach(a,b) then return new;end if;
 r:=eflow_r7.root(root_id);if r is null then if tg_op='DELETE' then return old;else return new;end if;end if;
 -- Preserve the private R9 UPDATE-only staffing removal, never a client marker
 -- or a structural bypass. Existing R9 authority/preview/serialization is kept.
 if tg_op='UPDATE' and eflow_r9.internal((r->>'project')::uuid) and
  (a-array['lead_id','assigned_to','recommendation_lead_id','assigned_to_ids','team_member_ids','team_member_names','assignee_name','reviewer_id','backup_reviewer_id','revision','updated_at'])=
  (b-array['lead_id','assigned_to','recommendation_lead_id','assigned_to_ids','team_member_ids','team_member_names','assignee_name','reviewer_id','backup_reviewer_id','revision','updated_at']) then return new;end if;
 -- Deleted task records may only move to this project's default group during
 -- authorized empty-group cleanup. No work fields or staffing may change.
 if tg_table_name='tasks' and tg_op='UPDATE' and a->>'deleted_at' is not null and
  b->>'deleted_at' is not null and a->>'group_id' is distinct from b->>'group_id' and
  (a-array['group_id','updated_at'])=(b-array['group_id','updated_at']) and
  auth.uid() is not null and exists(
   select 1 from public.project_groups g join public.projects p on p.id=g.project_id
   where (g.id=(b->>'group_id')::uuid or b->>'group_id' is null) and g.project_id=(a->>'linked_project_id')::uuid
    and p.status not in ('completed','archived')
    and public.can_create_scoped_work(p.org_id,auth.uid()) and public.can_manage_project(p.id,auth.uid())
  ) then return new;end if;
 if auth.uid() is not null and not coalesce(eflow_r7.read_root(root_id),false)
 and not (tg_table_name='tasks' and tg_op='UPDATE' and eflow_leadership.canonical_reroute(old,new)) then raise exception 'Current work access required' using errcode='42501';end if;
 if tg_table_name in ('tasks','personal_tasks') then
  if tg_op='UPDATE' and coalesce(b->>'lead_id',b->>'assigned_to',b->>'recommendation_lead_id') is distinct from coalesce(a->>'lead_id',a->>'assigned_to',a->>'recommendation_lead_id') then
   cmd:='root_lead';payload:=jsonb_build_object('lead',coalesce(b->>'lead_id',b->>'assigned_to',b->>'recommendation_lead_id'),'people',b->'team_member_ids');
   if tg_table_name='personal_tasks' then payload:=payload-'people';end if;
  elsif tg_op='UPDATE' and b->'team_member_ids' is distinct from a->'team_member_ids' then cmd:='contributors';payload:=jsonb_build_object('people',b->'team_member_ids');end if;
 else
  node_id:=coalesce((a->>'id')::uuid,(b->>'id')::uuid);
  if tg_op='DELETE' then cmd:='delete';payload:=jsonb_build_object('id',node_id);
  elsif tg_op='INSERT' then cmd:='create';payload:=jsonb_build_object('id',node_id,'parent',b->'parent_subtask_id');
  elsif b->'parent_subtask_id' is distinct from a->'parent_subtask_id' then cmd:='move';payload:=jsonb_build_object('id',node_id,'parent',b->'parent_subtask_id');
  elsif b->'sibling_order' is distinct from a->'sibling_order' or b->'position' is distinct from a->'position' and not eflow_r7.internal(root_id) then cmd:='order';payload:=jsonb_build_object('parent',a->'parent_subtask_id');
  elsif b->'is_standalone' is distinct from a->'is_standalone' then cmd:='edit';payload:=jsonb_build_object('id',node_id,'standalone',b->'is_standalone');
  elsif b->'lead_id' is distinct from a->'lead_id' or b->'assigned_to_ids' is distinct from a->'assigned_to_ids' then
   -- Canonical transfer/move clears descendants after checking the full scope.
   if b->>'lead_id' is null and eflow_r7.internal(root_id) and b->'assigned_to_ids'=a->'assigned_to_ids' then return new;end if;
   cmd:='staff';payload:=jsonb_build_object('id',node_id,'lead',b->'lead_id','people',b->'assigned_to_ids');
  elsif b->'title' is distinct from a->'title' or b->'due_date' is distinct from a->'due_date' then
   cmd:='edit';payload:=jsonb_build_object('id',node_id,'title',b->'title','due',b->'due_date','standalone',b->'is_standalone');
  end if;
 end if;
 if cmd is not null then perform eflow_r7.require_operation(root_id,cmd,payload);end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.phase6_guard_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects; t public.tasks; candidate uuid; actor uuid:=auth.uid();
begin if tg_op='UPDATE' and eflow_phase6.project_deletion_detach(to_jsonb(old),to_jsonb(new)) then return new;end if;
 if tg_op='UPDATE' and eflow_r9.internal(coalesce((select linked_project_id from public.tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)),(select project_id from public.personal_tasks where id=coalesce((to_jsonb(new)->>'task_id')::uuid,(to_jsonb(new)->>'id')::uuid)))) then return new;end if;
 if tg_op='UPDATE' and (to_jsonb(new)-array['team_member_ids','team_member_names','updated_at'])=(to_jsonb(old)-array['team_member_ids','team_member_names','updated_at']) and eflow_r7.internal(old.id) then return new;end if;
 if tg_op='UPDATE' and pg_trigger_depth()>1 and (to_jsonb(new)-array['subtask_count','subtask_completed_count','last_activity_at','updated_at'])=(to_jsonb(old)-array['subtask_count','subtask_completed_count','last_activity_at','updated_at']) then return new;end if;
 if tg_op in ('DELETE','UPDATE') then t:=old;else t:=new;end if;
 select * into p from public.projects where id=t.linked_project_id;
 if p.id is null or p.source_collaboration_draft_id is not null or not eflow_phase6.shared(p.id) then if tg_op='DELETE' then return old;else return new;end if;end if;
 -- Maintenance via service_role remains available; JWT users cannot bypass it
 -- through definer RPCs because auth.uid() remains their original identity.
 if actor is not null then
  if p.status in ('completed','archived') then raise exception 'Closed project work is read-only' using errcode='42501';end if;
  if tg_op='UPDATE' and (new.linked_project_id is distinct from old.linked_project_id or new.source_collaboration_draft_id is distinct from old.source_collaboration_draft_id) then raise exception 'Project identity is protected' using errcode='42501';end if;
  if tg_op='UPDATE' and new.org_id is distinct from old.org_id then
   if not public.phase2_is_office_head(actor,p.org_id) or old.status<>'pending_assignment' or old.assigned_to is not null or old.recommendation_lead_id is not null or cardinality(coalesce(old.team_member_ids,'{}'::uuid[]))>0 or exists(select 1 from public.subtasks where task_id=old.id and (status<>'todo' or assigned_to is not null or cardinality(coalesce(assigned_to_ids,'{}'::uuid[]))>0)) or new.assigned_to is not null or new.recommendation_lead_id is not null or cardinality(coalesce(new.team_member_ids,'{}'::uuid[]))>0 then raise exception 'Office handover requires unstarted, unassigned work' using errcode='42501';end if;
  elsif tg_op='INSERT' then
   if not eflow_phase6.head(p.id,t.org_id,actor) then raise exception 'Only the responsible Office Head can create work' using errcode='42501';end if;
  elsif not eflow_phase6.work(t.id,actor) and not (tg_op='UPDATE' and eflow_leadership.canonical_reroute(old,new)) and not (tg_op='UPDATE' and public.phase2_is_office_head(actor,p.org_id) and (to_jsonb(new)-array['group_id','workspace_position','updated_at'])=(to_jsonb(old)-array['group_id','workspace_position','updated_at'])) then raise exception 'Your project access is read-only for this Office work' using errcode='42501';end if;
  if tg_op='UPDATE' and (new.assigned_to is distinct from old.assigned_to or new.recommendation_lead_id is distinct from old.recommendation_lead_id or new.team_member_ids is distinct from old.team_member_ids or new.team_id is distinct from old.team_id) and not eflow_phase6.head(p.id,new.org_id,actor) then raise exception 'Only the responsible Office Head can choose its employees' using errcode='42501';end if;
 end if;
 if tg_op<>'DELETE' then
  if not exists(select 1 from public.project_offices where project_id=p.id and office_id=new.org_id and relationship_type in ('lead','collaborating') and invitation_status='joined') then raise exception 'Responsible Office must be a joined collaborator' using errcode='23514';end if;
  foreach candidate in array array_remove(array[new.assigned_to,new.recommendation_lead_id]||coalesce(new.team_member_ids,'{}'::uuid[]),null) loop
   if not exists(select 1 from public.profiles q where q.id=candidate and q.org_id=new.org_id and q.is_active and q.role<>'admin' and (public.phase2_is_office_head(candidate,new.org_id) or new.org_id=p.org_id or exists(select 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p.id and o.office_id=new.org_id and m.user_id=candidate))) then raise exception 'Select active project members from the responsible Office' using errcode='42501';end if;
  end loop;
  return new;
 end if;return old;
end $function$
;

commit;
