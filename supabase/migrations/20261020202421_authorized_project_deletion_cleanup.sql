-- Permanent deletion detaches retained tasks without permitting ordinary work edits.
-- Context is private and exists only inside the validated deletion transaction.
create table eflow_phase6.project_deletions (
 tx bigint not null, actor uuid not null, project_id uuid not null,
 primary key(tx,actor,project_id)
);
alter table eflow_phase6.project_deletions enable row level security;
revoke all on eflow_phase6.project_deletions from public,anon,authenticated,service_role;

create function eflow_phase6.project_deletion_detach(a jsonb,b jsonb)
returns boolean language sql stable security definer set search_path=''
as $$
 select auth.uid() is not null
 and a->>'linked_project_id' is not null
 and b->>'linked_project_id' is null and b->>'milestone_id' is null and b->>'group_id' is null
 and (a-array['linked_project_id','milestone_id','group_id','updated_at'])=
     (b-array['linked_project_id','milestone_id','group_id','updated_at'])
 and exists(select 1 from eflow_phase6.project_deletions d
  where d.tx=txid_current() and d.actor=auth.uid()
   and d.project_id=(a->>'linked_project_id')::uuid)
$$;
revoke all on function eflow_phase6.project_deletion_detach(jsonb,jsonb) from public,anon,authenticated,service_role;

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
 if auth.uid() is not null and not coalesce(eflow_r7.read_root(root_id),false) then raise exception 'Current work access required' using errcode='42501';end if;
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
end $function$;

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
  elsif not eflow_phase6.work(t.id,actor) and not (tg_op='UPDATE' and public.phase2_is_office_head(actor,p.org_id) and (to_jsonb(new)-array['group_id','workspace_position','updated_at'])=(to_jsonb(old)-array['group_id','workspace_position','updated_at'])) then raise exception 'Your project access is read-only for this Office work' using errcode='42501';end if;
  if tg_op='UPDATE' and (new.assigned_to is distinct from old.assigned_to or new.recommendation_lead_id is distinct from old.recommendation_lead_id or new.team_member_ids is distinct from old.team_member_ids or new.team_id is distinct from old.team_id) and not eflow_phase6.head(p.id,new.org_id,actor) then raise exception 'Only the responsible Office Head can choose its employees' using errcode='42501';end if;
 end if;
 if tg_op<>'DELETE' then
  if not exists(select 1 from public.project_offices where project_id=p.id and office_id=new.org_id and relationship_type in ('lead','collaborating') and invitation_status='joined') then raise exception 'Responsible Office must be a joined collaborator' using errcode='23514';end if;
  foreach candidate in array array_remove(array[new.assigned_to,new.recommendation_lead_id]||coalesce(new.team_member_ids,'{}'::uuid[]),null) loop
   if not exists(select 1 from public.profiles q where q.id=candidate and q.org_id=new.org_id and q.is_active and q.role<>'admin' and (public.phase2_is_office_head(candidate,new.org_id) or new.org_id=p.org_id or exists(select 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p.id and o.office_id=new.org_id and m.user_id=candidate))) then raise exception 'Select active project members from the responsible Office' using errcode='42501';end if;
  end loop;
  return new;
 end if;return old;
end $function$;

CREATE OR REPLACE FUNCTION public.delete_project_permanently(p_project_id uuid, p_expected_title text, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  project_row public.projects;
  retained_task_count int;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select role::text, full_name
    into caller_role, caller_name
  from public.profiles
  where id = caller and is_active;

  if caller_role is distinct from 'head' then
    raise exception 'Only an active Head may permanently delete a project'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project_id::text,0));

  select * into project_row
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if not coalesce(public.org_in_my_subtree(project_row.org_id, caller),false)
     or not coalesce(public.can_manage_project(p_project_id,caller),false) then
    raise exception 'This project is outside your organization scope'
      using errcode = '42501';
  end if;

  if coalesce(p_expected_title, '') <> project_row.title then
    raise exception 'Type the exact project title to confirm deletion'
      using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'A deletion reason of at least 5 characters is required'
      using errcode = '22023';
  end if;

  select count(*)::int into retained_task_count
  from public.tasks
  where linked_project_id = p_project_id and deleted_at is null;

  -- Private transaction-scoped authority; clients cannot create this context.
  insert into eflow_phase6.project_deletions(tx,actor,project_id)
  values(txid_current(),caller,p_project_id);

  update public.tasks
  set linked_project_id = null,
      milestone_id = null,
      group_id = null
  where linked_project_id = p_project_id;

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id
  ) values (
    caller, coalesce(caller_name, 'Administrator'), 'project', p_project_id::text,
    'project.deleted', btrim(p_reason),
    jsonb_build_object(
      'title', project_row.title,
      'status', project_row.status,
      'ownerId', project_row.owner_id,
      'retainedTaskCount', retained_task_count
    ),
    jsonb_build_object('deleted', true, 'taskLinksCleared', retained_task_count),
    project_row.org_id
  );

  delete from public.projects where id = p_project_id;
  delete from eflow_phase6.project_deletions
  where tx=txid_current() and actor=caller and project_id=p_project_id;
  return p_project_id;
end;
$function$;
