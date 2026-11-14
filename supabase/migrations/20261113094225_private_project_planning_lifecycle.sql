begin;
set local lock_timeout = '10s';

-- Assert that each change affects exactly one fragment of the installed body.
create function eflow_publication.replace_once(p_definition text,p_anchor text,p_replacement text,p_context text)
returns text language plpgsql immutable set search_path='' as $$
begin
 if p_definition is null or coalesce(p_anchor,'')='' or
  length(p_definition)-length(replace(p_definition,p_anchor,''))<>length(p_anchor) then
  raise exception 'Unexpected function definition while patching %',p_context;
 end if;
 return replace(p_definition,p_anchor,p_replacement);
end $$;

-- Use the existing publication marker. Previously published projects keep
-- their visibility, including historical projects with Planning status.
create function eflow_publication.draft_manager(p_project uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_actor=auth.uid() and exists(
  select 1 from public.projects p join public.profiles u on u.id=p_actor and u.is_active
   where p.id=p_project and p.publication_state='draft' and p.status='planning'
     and (public.phase2_is_office_head(p_actor,p.org_id)
       or (p.project_lead_id=p_actor and p.org_id=u.org_id and u.role not in ('admin','super_admin','viewer')))
 );
$$;

-- The M7 operational policies can use the same visibility contract without
-- requiring Web or Mobile to enter a transaction-local draft scope to read.
create or replace function eflow_m7.project_visible(p_project uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_project is null or exists(select 1 from public.projects p
  where p.id=p_project and (p.publication_state='published' or eflow_publication.draft_manager(p.id,p_actor)));
$$;

do $migration$
declare signature text; definition text; function_name text;
begin
 foreach signature in array array['public.can_see_project(uuid,uuid)','public.can_see_task(uuid,uuid)',
   'public.is_channel_member(uuid,uuid)','eflow_r3.project_access(uuid,boolean)','eflow_r6.access(uuid,boolean)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  function_name:=split_part(signature,'(',1);
  execute eflow_publication.replace_once(definition,'FUNCTION '||function_name||'(',
   'FUNCTION eflow_publication.previous_'||split_part(function_name,'.',2)||'(',signature);
 end loop;
end $migration$;

create or replace function public.can_see_project(target_project uuid,caller_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_publication.draft_manager(target_project,caller_id),false)
   or (eflow_m7.project_visible(target_project,caller_id) and eflow_publication.previous_can_see_project(target_project,caller_id));
$$;

create or replace function public.can_see_task(target_task uuid,caller_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=target_task and t.deleted_at is null and (
  eflow_publication.draft_manager(t.linked_project_id,caller_id)
  or (eflow_m7.project_visible(t.linked_project_id,caller_id)
    and eflow_publication.previous_can_see_task(target_task,caller_id))));
$$;

-- Audit has independent read policies, so project and task entity IDs need
-- the same draft boundary even for administrative report readers.
create function eflow_publication.audit_visible(p_type text,p_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.projects p where p.publication_state='draft'
  and (p_type='project' and p.id::text=p_id or p_type='task' and exists(
   select 1 from public.tasks t where t.linked_project_id=p.id and t.id::text=p_id))
  and not eflow_publication.draft_manager(p.id,auth.uid()))
 and not exists(select 1 from public.audit_events a where p_type='project' and a.entity_type='project'
  and a.entity_id=p_id and a.action='project.draft_discarded'
  and not public.phase2_is_office_head(auth.uid(),a.org_id));
$$;
create function public.can_read_project_audit_entity(p_type text,p_id text)
returns boolean language sql stable security definer set search_path='' as $$
 select eflow_publication.audit_visible(p_type,p_id);
$$;
revoke all on function public.can_read_project_audit_entity(text,text) from public,anon,authenticated,service_role;
grant execute on function public.can_read_project_audit_entity(text,text) to authenticated;
create policy private_project_audit_visibility on public.audit_events as restrictive for select to authenticated
 using(public.can_read_project_audit_entity(entity_type,entity_id));

create or replace function public.is_channel_member(p_channel uuid,caller uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(
  select 1 from public.chat_channels c
  left join public.tasks t on t.id=c.task_id
  join public.projects p on p.id=coalesce(c.project_id,t.linked_project_id)
  where c.id=p_channel and p.publication_state='draft'
 ) and eflow_publication.previous_is_channel_member(p_channel,caller);
$$;

create or replace function eflow_r3.project_access(p_project uuid,p_edit boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select (not exists(select 1 from public.projects p where p.id=p_project and p.publication_state='draft')
    or eflow_publication.draft_manager(p_project,auth.uid()))
   and eflow_publication.previous_project_access(p_project,p_edit);
$$;

create or replace function eflow_r6.access(p_project uuid,p_write boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select (not exists(select 1 from public.projects p where p.id=p_project and p.publication_state='draft')
    or eflow_publication.draft_manager(p_project,auth.uid()))
   and eflow_publication.previous_access(p_project,p_write);
$$;

create or replace function eflow_publication.guard_project()
returns trigger language plpgsql security definer set search_path='' as $$
declare readiness jsonb;
begin
 if tg_op='INSERT' then
  if new.source_collaboration_draft_id is not null then
   if not coalesce(public.phase2_is_office_head(auth.uid(),new.org_id),false) then
    raise exception 'Only the owning Office Head can publish' using errcode='42501';
   end if;
   new.publication_state:='published'; new.published_at:=now(); new.published_by:=auth.uid();
  else
   if new.status is distinct from 'planning' or not coalesce(public.phase2_is_office_head(auth.uid(),new.org_id),false) then
    raise exception 'Only the appointed Office Head can create a Planning project' using errcode='42501';
   end if;
   new.publication_state:='draft'; new.published_at:=null; new.published_by:=null;
  end if;
  return new;
 end if;
 if row(new.published_at,new.published_by) is distinct from row(old.published_at,old.published_by) then
  raise exception 'Publication history cannot be edited' using errcode='42501';
 end if;
 if old.publication_state='published' then
  if new.publication_state is distinct from 'published' then
   raise exception 'Published projects cannot return to a private draft' using errcode='23514';
  end if;
  if old.status='on_hold' and new.status='completed' then
   raise exception 'Reactivate this project before completing it' using errcode='23514';
  end if;
  return new;
 end if;
 if new.status='active' then
  if not coalesce(public.phase2_is_office_head(auth.uid(),old.org_id),false)
    or not coalesce(public.can_manage_project(old.id,auth.uid()),false) then
   raise exception 'Only the owning Office Head can activate this project' using errcode='42501';
  end if;
  if row(new.title,new.description,new.scope,new.org_id,new.project_lead_id,new.start_date,new.target_date,new.funding_not_required)
   is distinct from row(old.title,old.description,old.scope,old.org_id,old.project_lead_id,old.start_date,old.target_date,old.funding_not_required)
  then raise exception 'Save and review project changes before activation' using errcode='23514'; end if;
  readiness:=eflow_phase7.readiness(old.id);
  if not eflow_project.ready(old.id) or not coalesce((readiness->>'canActivate')::boolean,false) then
   raise exception 'Project readiness is incomplete' using errcode='23514';
  end if;
  new.publication_state:='published'; new.published_at:=now(); new.published_by:=auth.uid();
 elsif new.status is distinct from 'planning' or new.publication_state is distinct from 'draft' then
  raise exception 'Private projects must remain in Planning until activation' using errcode='23514';
 end if;
 return new;
end $$;

-- Both existing client entry points share the same activation transaction.
create or replace function public.publish_project(p_project uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or not coalesce(public.phase2_is_office_head(auth.uid(),p.org_id),false)
  or not coalesce(public.can_manage_project(p.id,auth.uid()),false) then
  raise exception 'Only the owning Office Head can publish' using errcode='42501';
 end if;
 if p.publication_state='draft' then perform public.phase7_activate_project(p_project); end if;
end
$$;

-- A Lead can use planning RPCs in their own implementing Office. This
-- capability is separate from project governance and task execution.
create function eflow_publication.planning_lead(p_project uuid,p_office uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects p join public.profiles u on u.id=auth.uid()
  where p.id=p_project and p.org_id=p_office and p.source_collaboration_draft_id is null
  and p.status in ('planning','active','on_hold') and p.project_lead_id=u.id
  and u.org_id=p.org_id and u.is_active and u.role not in ('admin','super_admin','viewer'));
$$;

-- Planning authority must not flow through execution callers of r7.manage.
create function eflow_publication.manage_plan(p_root uuid,p_node uuid,p_replace_lead boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r7.manage(p_root,p_node,p_replace_lead),false) or (
  coalesce(eflow_r7.read_root(p_root),false) and exists (
   select 1 from (select eflow_r7.root(p_root) r) x where r->>'kind'='office'
    and coalesce((r->>'open')::boolean,false)
    and eflow_publication.planning_lead((r->>'project')::uuid,(r->>'office')::uuid)
  ));
$$;

do $migration$
declare definition text; anchor text; action_clause text;
begin
 select pg_get_functiondef('public.phase3_patch_task(uuid,jsonb)'::regprocedure) into definition;
 anchor:='if not found or not public.can_create_scoped_work(t.org_id,auth.uid()) or not (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid())) or not public.can_manage_task(t.id,auth.uid()) then';
 definition:=eflow_publication.replace_once(definition,anchor,
  'if p.id is null or not coalesce(eflow_publication.planning_lead(p.id,t.org_id) or (public.can_create_scoped_work(t.org_id,auth.uid()) and (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid())) and public.can_manage_task(t.id,auth.uid())),false) then','task planning authority');
 definition:=eflow_publication.replace_once(definition,'select * into p from eflow_phase6.lock_project(t.linked_project_id);',
  'if eflow_publication.planning_lead(t.linked_project_id,t.org_id) then
   select * into p from public.projects where id=t.linked_project_id for update;
   else select * into p from eflow_phase6.lock_project(t.linked_project_id); end if;','task planning lock');
 execute definition;
 alter function public.phase3_patch_task(uuid,jsonb) security definer;
 select pg_get_functiondef('eflow_r7.guard_root()'::regprocedure) into definition;
 anchor:='and not eflow_phase6.head(new.linked_project_id,new.org_id,auth.uid()) then';
 execute eflow_publication.replace_once(definition,anchor,
  'and not eflow_phase6.head(new.linked_project_id,new.org_id,auth.uid())
   and not (tg_op=''INSERT'' and new.assigned_to is null and new.recommendation_lead_id is null
     and cardinality(coalesce(new.team_member_ids,''{}''::uuid[]))=0 and eflow_publication.planning_lead(new.linked_project_id,new.org_id))
   and not (tg_op=''UPDATE'' and eflow_r7.internal(new.id)
     and eflow_publication.planning_lead(new.linked_project_id,new.org_id)) then','Task Lead guard');
 select pg_get_functiondef('eflow_r7.operation_capabilities(uuid,uuid)'::regprocedure) into definition;
 -- The hosted root JSON has no project_status. Apply the gate only to
 -- execution actions and retain the existing actor/activation predicates.
 action_clause:=substring(definition from $rx$elsif action in \('execute',[[:space:]]*'submit'\) then$rx$);
 if action_clause is null then raise exception 'Review the current work capability adapter before applying'; end if;
 definition:=eflow_publication.replace_once(definition,action_clause,
  $body$elsif action in ('execute','submit') and r->>'kind'='office' and exists (
    select 1 from public.projects where id=(r->>'project')::uuid and status in ('planning','on_hold')
   ) then
    select case when status='on_hold' then 'project_on_hold' else 'lifecycle_blocked' end into reason
     from public.projects where id=(r->>'project')::uuid;
   $body$||action_clause,'work execution capabilities');
 definition:=eflow_publication.replace_once(definition,'when p_node is null then eflow_r7.head(p_root)',
  'when p_node is null then (eflow_r7.head(p_root) or (r->>''kind''=''office'' and eflow_publication.planning_lead((r->>''project'')::uuid,(r->>''office'')::uuid)))','Task Lead capability');
 definition:=eflow_publication.replace_once(definition,
  substring(definition from $rx$else eflow_r7.manage\(p_root,[[:space:]]*p_node,[[:space:]]*true\)$rx$),
  'else eflow_publication.manage_plan(p_root,p_node,true)','Subtask Lead capability');
 anchor:=substring(definition from $rx$elsif not manager then reason[[:space:]]*:=[[:space:]]*'branch_denied';$rx$);
 execute eflow_publication.replace_once(definition,anchor,
  'elsif not eflow_publication.manage_plan(p_root,p_node) then reason := ''branch_denied'';','work planning capabilities');
 select pg_get_functiondef('eflow_r7.command(uuid,integer,uuid,text,jsonb)'::regprocedure) into definition;
 anchor:='if not coalesce(eflow_r7.head(p_root),false) then raise exception ''Only its responsible Head or personal owner transfers the root''';
 definition:=eflow_publication.replace_once(definition,anchor,
  'if not coalesce(eflow_r7.head(p_root),false) and not (v_kind=''office'' and eflow_publication.planning_lead((r->>''project'')::uuid,(r->>''office'')::uuid)) then raise exception ''Current Task Lead appointment authority required''','Task Lead appointment command');
 -- These are the command's create, order, staff, contributor and move checks.
 if length(definition)-length(replace(definition,'eflow_r7.manage(',''))<>5*length('eflow_r7.manage(') then
  raise exception 'Review the current work planning commands before applying';
 end if;
 execute replace(definition,'eflow_r7.manage(','eflow_publication.manage_plan(');

 -- The current hosted M7 evidence/review scope still includes On hold.
 select pg_get_functiondef('eflow_m7.work_scope_open(uuid,uuid)'::regprocedure) into definition;
 anchor:='p.status in (''active'',''on_hold'')';
 if strpos(definition,anchor)>0 then
  execute eflow_publication.replace_once(definition,anchor,'p.status=''active''','M7 work evidence scope');
 elsif definition !~ $rx$from public.tasks t join public.projects p on p.id[[:space:]]*=[[:space:]]*t.linked_project_id[[:space:][:print:]]*p.status[[:space:]]*=[[:space:]]*'active'$rx$ then
  raise exception 'Review the current M7 work evidence scope before applying';
 end if;
end $migration$;

-- Snapshot consumers also read this legacy planning-only flag directly.
do $migration$
declare definition text; anchor text;
begin
 select pg_get_functiondef('eflow_r7.m7_baseline_snapshot(uuid)'::regprocedure) into definition;
 foreach anchor in array array['eflow_r7.manage(p_root,t.id)','eflow_r7.manage(p_root,t.id,true)',
   'eflow_r7.manage(p_root,t.parent_subtask_id)','eflow_r7.manage(p_root,null)'] loop
  definition:=eflow_publication.replace_once(definition,anchor,
   replace(anchor,'eflow_r7.manage','eflow_publication.manage_plan'),'work snapshot planning flags');
 end loop;
 execute definition;
end $migration$;

create or replace function public.phase3_create_task(p_project_id uuid,p_group_id uuid,p_title text)
returns public.tasks language plpgsql security definer set search_path='' as $$
declare p public.projects; t public.tasks; n integer;
begin
 select * into p from public.projects where id=p_project_id for update;
 if p.id is null or not coalesce(
  eflow_publication.planning_lead(p.id,p.org_id) or
  (public.can_create_scoped_work(p.org_id,auth.uid()) and public.can_manage_project(p.id,auth.uid())),false)
 then raise exception 'Current project planning authority required' using errcode='42501'; end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023'; end if;
 if not exists(select 1 from public.project_groups where id=p_group_id and project_id=p.id) then
  raise exception 'Choose a group from this project' using errcode='22023';
 end if;
 if length(btrim(coalesce(p_title,''))) not between 1 and 300 then
  raise exception 'Enter a task title (up to 300 characters)' using errcode='22023';
 end if;
 select coalesce(max(workspace_position)+1,0) into n from public.tasks where group_id=p_group_id;
 if eflow_publication.planning_lead(p.id,p.org_id) and not public.phase2_is_office_head(auth.uid(),p.org_id) then
  insert into public.tasks(title,description,org_id,linked_project_id,project_id,project_title,status,priority,group_id,workspace_position,created_by)
  values(btrim(p_title),'',p.org_id,p.id,p.id::text,p.title,'pending_assignment','medium',p_group_id,n,auth.uid())
  returning * into t;
 else
  t:=public.create_task_with_details(jsonb_build_object('title',p_title,'description','','org_id',p.org_id,'linked_project_id',p.id,'project_id',p.id::text,'project_title',p.title,'priority','medium'));
  update public.tasks set group_id=p_group_id,workspace_position=n where id=t.id returning * into t;
 end if;
 return t;
end $$;

create table eflow_publication.discard_requests (
 transaction_id bigint not null,
 project_id uuid not null,
 actor_id uuid not null,
 primary key(transaction_id,project_id,actor_id)
);
alter table eflow_publication.discard_requests enable row level security;

create function eflow_publication.guard_project_delete()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.publication_state='published' then
  raise exception 'Published projects must use the governed closeout and archive workflow' using errcode='23514';
 end if;
 if not exists(select 1 from eflow_publication.discard_requests d
  where d.transaction_id=txid_current() and d.project_id=old.id and d.actor_id=auth.uid()) then
  raise exception 'Use the confirmed project draft discard action' using errcode='42501';
 end if;
 return old;
end $$;
create trigger private_project_delete_guard before delete on public.projects
 for each row execute function eflow_publication.guard_project_delete();

create function public.discard_private_project(p_project uuid,p_title text,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 select * into p from public.projects where id=p_project for update;
 if not coalesce(eflow_publication.draft_manager(p.id,auth.uid()),false) then
  raise exception 'Current private project access required' using errcode='42501';
 end if;
 if btrim(p_title) is distinct from p.title or length(btrim(coalesce(p_reason,'')))<5 then
  raise exception 'Confirm the project title and enter a reason' using errcode='22023';
 end if;
 -- Drafts with linked records need the governed cleanup workflow. Avoid
 -- detaching tasks or removing records that may carry protected history.
 if exists(select 1 from public.tasks where linked_project_id=p.id)
   or exists(select 1 from eflow_project.funding where project_id=p.id)
   or exists(select 1 from eflow_project.funding_requests where project_id=p.id)
   or exists(select 1 from public.project_library_files where project_id=p.id)
   or exists(select 1 from public.project_invitation_requests where project_id=p.id)
   or exists(select 1 from public.project_readiness_reviews where project_id=p.id) then
  raise exception 'This draft has linked work, funding or review records' using errcode='23514';
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,reason,before_data)
 values(auth.uid(),'project',p.id::text,'project.draft_discarded',p.org_id,btrim(p_reason),jsonb_build_object('title',p.title,'status',p.status));
 insert into eflow_publication.discard_requests values(txid_current(),p.id,auth.uid());
 delete from public.chat_channels where project_id=p.id;
 delete from public.projects where id=p.id;
 delete from eflow_publication.discard_requests where transaction_id=txid_current() and project_id=p.id and actor_id=auth.uid();
 return p.id;
end $$;
revoke all on function public.discard_private_project(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.discard_private_project(uuid,text,text) to authenticated;

-- Old clients reach the same checked discard path. This prevents their
-- former detach-and-delete behavior from stripping a private draft's links.
create or replace function public.delete_project_permanently(p_project_id uuid,p_expected_title text,p_reason text)
returns uuid language sql security invoker set search_path='' as $$
 select public.discard_private_project(p_project_id,p_expected_title,p_reason);
$$;

do $migration$
declare definition text; signature text;
begin
 foreach signature in array array['public.soft_delete_task(uuid)','public.cancel_task(uuid,text)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  execute eflow_publication.replace_once(definition,'if not public.can_manage_task(p_task_id, caller) then',
   'if not coalesce(public.can_manage_task(p_task_id, caller),false) and not eflow_publication.planning_lead(t.linked_project_id,t.org_id) then',signature);
 end loop;
end $migration$;

create function eflow_publication.guard_task_removal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.linked_project_id is null or old.source_collaboration_draft_id is not null then return new; end if;
 if not ((old.deleted_at is null and new.deleted_at is not null) or
         (old.status<>'cancelled' and new.status='cancelled')) then return new; end if;
 if exists(select 1 from public.projects where id=old.linked_project_id and status in ('completed','archived'))
    or old.status in ('for_review','completed','cancelled') then
  raise exception 'Work under review or closed work must retain its history' using errcode='23514';
 end if;
 if exists(select 1 from public.tasks t where t.deleted_at is null and t.status<>'cancelled' and old.id=any(t.dependency_ids)) then
  raise exception 'Resolve dependent tasks before removing this task' using errcode='23514';
 end if;
 if exists(select 1 from public.work_budget_allocations a where a.task_id=old.id and a.status='approved')
    or exists(select 1 from public.petty_cash_requests r where r.task_id=old.id and r.status not in ('settled','rejected','cancelled')) then
  raise exception 'Reconcile task funding before removing this task' using errcode='23514';
 end if;
 if new.deleted_at is not null and (old.status not in ('pending_assignment','todo') or coalesce(old.percent_complete,0)<>0
    or exists(select 1 from public.task_submissions where task_id=old.id)
    or exists(select 1 from public.subtasks where task_id=old.id)
    or exists(select 1 from public.petty_cash_requests where task_id=old.id)
    or exists(select 1 from public.work_budget_allocations where task_id=old.id)) then
  raise exception 'Use cancellation to retain this task’s history' using errcode='23514';
 end if;
 return new;
end $$;
create trigger private_project_task_removal before update of deleted_at,status on public.tasks
 for each row execute function eflow_publication.guard_task_removal();

create function eflow_publication.guard_draft_task_links()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 if tg_op='UPDATE' and new.linked_project_id is not distinct from old.linked_project_id then return new; end if;
 if tg_op='UPDATE' and exists(select 1 from public.projects where id=old.linked_project_id and publication_state='draft') then
  raise exception 'Private work cannot move outside its draft project' using errcode='42501';
 end if;
 select * into p from public.projects where id=new.linked_project_id for share;
 if p.publication_state='draft' then
  if not coalesce(eflow_publication.draft_manager(p.id,auth.uid()),false) or new.org_id is distinct from p.org_id then
   raise exception 'Private task planning access required' using errcode='42501';
  end if;
  if tg_op='UPDATE' or new.status not in ('pending_assignment','todo') or coalesce(new.percent_complete,0)<>0 then
   raise exception 'Create new unstarted work in the private project' using errcode='23514';
  end if;
 end if;
 return new;
end $$;
create trigger private_project_task_links before insert or update of linked_project_id on public.tasks
 for each row execute function eflow_publication.guard_draft_task_links();

create function eflow_publication.guard_suspended_execution()
returns trigger language plpgsql security definer set search_path='' as $$
declare project_status text; root_ids uuid[]; project_ids uuid[];
begin
 if tg_table_name='tasks' then
  project_ids:=array[new.linked_project_id];
  if tg_op='UPDATE' then
   if row(new.status,new.percent_complete) is not distinct from row(old.status,old.percent_complete)
    or (new.status='cancelled' or new.status in ('todo','pending_assignment') and old.status in ('todo','pending_assignment'))
       and new.percent_complete is not distinct from old.percent_complete
   then return new; end if;
   project_ids:=project_ids||old.linked_project_id;
  elsif new.status in ('todo','pending_assignment') and coalesce(new.percent_complete,0)=0 then return new;
  end if;
 else
  root_ids:=array[new.task_id];
  if tg_op='UPDATE' then root_ids:=root_ids||old.task_id; end if;
  -- Only public.subtasks has these fields. In a generic trigger, an AND
  -- expression is insufficient to isolate references to different row types.
  if tg_table_name='subtasks' then
   if tg_op='UPDATE' then
    if row(new.status,new.percent_complete,new.started_at,new.is_completed,new.completed_at,new.completed_by,new.latest_submission_id)
     is not distinct from row(old.status,old.percent_complete,old.started_at,old.is_completed,old.completed_at,old.completed_by,old.latest_submission_id)
    then return new; end if;
   elsif new.status='todo' and coalesce(new.percent_complete,0)=0 and new.started_at is null
    and not coalesce(new.is_completed,false) and new.completed_at is null and new.completed_by is null and new.latest_submission_id is null
   then return new; end if;
  end if;
  select array_agg(t.linked_project_id) into project_ids from public.tasks t where t.id=any(root_ids);
 end if;
 for project_status in select p.status from public.projects p where p.id=any(project_ids) order by p.id for share loop
  if project_status in ('planning','on_hold','completed','archived') then
   raise exception 'Project work is unavailable while the project is %',replace(project_status,'_',' ') using errcode='23514';
  end if;
 end loop;
 return new;
end $$;
create trigger private_project_execution_guard before insert or update on public.tasks
 for each row execute function eflow_publication.guard_suspended_execution();
create trigger private_project_subtask_execution_guard before insert or update on public.subtasks
 for each row execute function eflow_publication.guard_suspended_execution();
create trigger private_project_task_update_guard before insert or update on public.task_progress_updates
 for each row execute function eflow_publication.guard_suspended_execution();
create trigger private_project_submission_guard before insert or update on public.task_submissions
 for each row execute function eflow_publication.guard_suspended_execution();
create trigger private_project_subtask_submission_guard before insert or update on public.subtask_submissions
 for each row execute function eflow_publication.guard_suspended_execution();
create trigger private_project_subtask_update_guard before insert or update on public.subtask_progress_updates
 for each row execute function eflow_publication.guard_suspended_execution();

-- Invitations alone are coordination. Review actual loss or reassignment of
-- a joined delivery Office, and keep the existing project-row serialization.
create or replace function eflow_phase7.material_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare project_id uuid; previous_id uuid; material boolean:=false; p public.projects;
begin
 if tg_table_name='tasks' then
  if tg_op<>'DELETE' then project_id:=new.linked_project_id; end if;
  if tg_op<>'INSERT' then previous_id:=old.linked_project_id; end if;
  if tg_op='UPDATE' and row(new.description,new.org_id,new.start_date,new.deadline,new.dependency_ids,
    new.budget_impact,new.deleted_at,new.linked_project_id,new.acceptance_criteria,new.definition_of_done,new.status='cancelled')
   is not distinct from row(old.description,old.org_id,old.start_date,old.deadline,old.dependency_ids,
    old.budget_impact,old.deleted_at,old.linked_project_id,old.acceptance_criteria,old.definition_of_done,old.status='cancelled')
  then return null; end if;
 else
  if tg_op<>'DELETE' then project_id:=new.project_id; end if;
  if tg_op<>'INSERT' then
   previous_id:=old.project_id;
   if old.invitation_status='joined' and old.relationship_type in ('lead','collaborating') then
    if tg_op='DELETE' then material:=true;
    else material:=row(new.office_id,new.relationship_type,new.invitation_status,new.project_id)
      is distinct from row(old.office_id,old.relationship_type,old.invitation_status,old.project_id);
    end if;
   end if;
  end if;
 end if;
 for p in select * from public.projects where id in (project_id,previous_id) order by id for update loop
  if material and p.id=previous_id and p.source_collaboration_draft_id is null and p.status='active' then
   update public.projects set status='on_hold',updated_at=now() where id=p.id;
   insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data)
   values(auth.uid(),'project',p.id::text,'project.material_change_review',p.org_id,
    jsonb_build_object('source',tg_table_name,'status','on_hold','reason','A joined delivery Office changed'));
  end if;
 end loop;
 return null;
end $$;

-- Use the canonical checked team mutation, including its membership receipt.
create function public.save_private_project_people(p_project uuid,p_users uuid[],p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare project_row public.projects; participation uuid; people uuid[]; impact jsonb;
 receipt eflow_project.commands; terms jsonb; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project::text,0));
 select * into project_row from public.projects where id=p_project for update;
 if project_row.publication_state is distinct from 'draft' or project_row.status is distinct from 'planning'
   or not coalesce(public.phase2_is_office_head(auth.uid(),project_row.org_id),false) then
  raise exception 'Only the appointed Office Head can select a private project team' using errcode='42501';
 end if;
 if p_key is null then raise exception 'Request identity required' using errcode='22023'; end if;
 terms:=jsonb_build_object('operation','select_private_project_people','project',p_project,'users',p_users);
 select * into receipt from eflow_project.commands where actor_id=auth.uid() and request_id=p_key;
 if found then
  if receipt.payload is distinct from terms then raise exception 'Team request ID was reused with different details' using errcode='22023'; end if;
  return receipt.result;
 end if;
 if project_row.project_lead_id is null then raise exception 'Appoint the Project Lead first' using errcode='23514'; end if;
 select id into participation from public.project_offices
  where project_id=p_project and office_id=project_row.org_id and relationship_type='lead' and invitation_status='joined';
 select array_agg(distinct uid order by uid) into people from unnest(coalesce(p_users,'{}')||project_row.project_lead_id) uid;
 impact:=eflow_r9.selection_impact(participation,people);
 result:=eflow_r9.select_members(participation,people,impact->>'fingerprint',p_key);
 insert into eflow_project.commands(actor_id,request_id,payload,result) values(auth.uid(),p_key,terms,result);
 return result;
end $$;
revoke all on function public.save_private_project_people(uuid,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function public.save_private_project_people(uuid,uuid[],uuid) to authenticated;

-- Keep legacy creation available to shared clients. It passes the same
-- publication guard, so it cannot create a publicly visible manual draft.
-- Only the receipt-bearing entry point can safely retry a lost create result.

-- Draft notices never enter the delivery stream. Publication reconstructs
-- current assignments from the committed plan instead of replaying old edits.
create function eflow_publication.guard_external_sharing()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.projects where id=new.project_id and publication_state='draft') then
  raise exception 'Activate the project before sending project invitations or sharing access' using errcode='23514';
 end if;
 return new;
end $$;
create trigger private_project_invitation_guard before insert on public.project_invitation_requests
 for each row execute function eflow_publication.guard_external_sharing();
create trigger private_project_share_guard before insert on public.project_access_grants
 for each row execute function eflow_publication.guard_external_sharing();

create function eflow_publication.suppress_draft_notice()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.projects p where p.publication_state='draft'
  and p.id in (new.project_id,(select t.linked_project_id from public.tasks t where t.id=new.task_id))) then return null; end if;
 return new;
end $$;
create trigger a_private_project_notice before insert on public.notifications
 for each row execute function eflow_publication.suppress_draft_notice();

create function eflow_publication.distribute_project_assignments()
returns trigger language plpgsql security definer set search_path='' as $$
declare task_row public.tasks;
begin
 if new.status<>'active' or new.publication_state<>'published' then
  raise exception 'Activation was interrupted' using errcode='23514';
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data)
 values(new.published_by,'project',new.id::text,'project.published',new.org_id,
  jsonb_build_object('publishedAt',new.published_at,'status',new.status));
 for task_row in select * from public.tasks where linked_project_id=new.id and deleted_at is null and status<>'cancelled'
 loop
  perform eflow_chat.sync_task_channel(task_row);
 end loop;
 insert into public.notifications(user_id,type,title,message,task_id,task_title,project_id,org_id,actor_id,work_node_id)
 select distinct a.worker,'assignment',case when a.node_id is null then 'Task assignment' else 'Subtask assignment' end,
  'You were assigned to "'||a.title||'".',a.task_id,a.task_title,new.id,a.org_id,auth.uid(),a.node_id
 from (
  select t.id task_id,t.title task_title,t.title,t.org_id,null::uuid node_id,
   unnest(array[t.assigned_to,t.recommendation_lead_id]||coalesce(t.team_member_ids,'{}'::uuid[])) worker
  from public.tasks t where t.linked_project_id=new.id and t.deleted_at is null and t.status<>'cancelled'
  union all
  select t.id,t.title,s.title,t.org_id,s.id,
   unnest(array[s.lead_id,s.assigned_to]||coalesce(s.assigned_to_ids,'{}'::uuid[]))
  from public.tasks t join public.subtasks s on s.task_id=t.id
  where t.linked_project_id=new.id and t.deleted_at is null and t.status<>'cancelled' and s.status<>'cancelled'
 ) a join public.profiles u on u.id=a.worker and u.is_active
 where public.can_see_task(a.task_id,a.worker) and eflow_r7.member(new.id,a.org_id,a.worker);
 return new;
end $$;
create trigger z_private_project_activation after update of status on public.projects
 for each row when(old.publication_state='draft' and new.publication_state='published')
 execute function eflow_publication.distribute_project_assignments();

drop function eflow_publication.replace_once(text,text,text,text);
revoke all on function eflow_publication.draft_manager(uuid,uuid),eflow_publication.audit_visible(text,text),
 eflow_publication.previous_can_see_project(uuid,uuid),eflow_publication.previous_can_see_task(uuid,uuid),
 eflow_publication.previous_is_channel_member(uuid,uuid),eflow_publication.previous_project_access(uuid,boolean),
 eflow_publication.previous_access(uuid,boolean),eflow_publication.planning_lead(uuid,uuid),
 eflow_publication.manage_plan(uuid,uuid,boolean),eflow_publication.guard_project_delete(),
 eflow_publication.guard_task_removal(),eflow_publication.guard_draft_task_links(),
 eflow_publication.guard_suspended_execution(),eflow_publication.guard_external_sharing(),
 eflow_publication.suppress_draft_notice(),eflow_publication.distribute_project_assignments()
 from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
