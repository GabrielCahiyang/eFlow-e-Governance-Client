-- Coordinated Web cutover: operational reads and deliberate draft-management
-- operations share the same account, but only the latter enter a private scope.
begin;
create table eflow_m7.draft_scope (
 tx bigint not null, actor_id uuid not null, project_id uuid not null,
 primary key(tx,actor_id,project_id)
);
alter table eflow_m7.draft_scope enable row level security;

create function eflow_m7.project_visible(p_project uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select p_project is null or exists (
  select 1 from public.projects p where p.id=p_project and (
   p.status<>'planning' or p_actor=auth.uid() and exists(
    select 1 from eflow_m7.draft_scope d where d.tx=txid_current()
     and d.actor_id=p_actor and d.project_id=p.id
   )
  )
 );
$$;

-- Preserve dependency OIDs for existing policies and invoker functions.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.can_see_project(uuid,uuid)'::regprocedure);
 execute replace(definition,'FUNCTION public.can_see_project(', 'FUNCTION eflow_m7.previous_project_access(');
 definition:=pg_get_functiondef('public.can_see_task(uuid,uuid)'::regprocedure);
 execute replace(definition,'FUNCTION public.can_see_task(', 'FUNCTION eflow_m7.previous_task_access(');
end $migration$;
create or replace function public.can_see_project(target_project uuid,caller_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select target_project is not null and eflow_m7.project_visible(target_project,caller_id)
  and eflow_m7.previous_project_access(target_project,caller_id);
$$;
create or replace function public.can_see_task(target_task uuid,caller_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=target_task
  and eflow_m7.project_visible(t.linked_project_id,caller_id)
  and eflow_m7.previous_task_access(t.id,caller_id));
$$;

create function eflow_m7.node_visible(p_root uuid,p_node uuid,p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t join public.subtasks s on s.task_id=t.id
  where t.id=p_root and s.id=p_node and public.can_see_task(t.id,p_actor)
   and (t.assigned_to=p_actor or eflow_m7.node_activated(t.id,s.id) or exists (
    select 1 from eflow_m7.draft_scope d where d.tx=txid_current()
      and d.actor_id=p_actor and d.project_id=t.linked_project_id
   )));
$$;
create function eflow_m7.personal_node_visible(p_root uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r7.read_root(p_root) and exists(
  select 1 from public.personal_subtasks s join public.personal_tasks t on t.id=s.task_id
   where t.id=p_root and s.id=p_node and (t.lead_id=auth.uid() or eflow_r7.head(p_root)
    or t.status<>'todo' and (s.start_date is null or s.started_at is not null or s.status in ('for_review','completed')))
 );
$$;
create function eflow_m7.can_view_work_event(p_root uuid,p_node uuid,p_before jsonb,p_after jsonb)
returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r7.read_root(p_root) and (
  (eflow_r7.root(p_root)->>'lead')::uuid=auth.uid()
  or (p_node is null or eflow_m7.node_visible(p_root,p_node,auth.uid()) or eflow_m7.personal_node_visible(p_root,p_node))
  and not exists(
   select 1 from jsonb_array_elements(coalesce(p_before->'nodes','[]') || coalesce(p_after->'nodes','[]')) n
   where not (eflow_m7.node_visible(p_root,(n->>'id')::uuid,auth.uid()) or eflow_m7.personal_node_visible(p_root,(n->>'id')::uuid))
  )
 );
$$;
create function eflow_m7.can_view_linked_work(p_task uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (p_task is null or public.can_see_task(p_task,auth.uid()))
  and (p_node is null or eflow_m7.node_visible(p_task,p_node,auth.uid()));
$$;

-- Finance has its own actor and Office authority. These restrictive policies
-- only add lifecycle visibility, leaving existing finance policies decisive.
create function eflow_m7.finance_link_visible(p_task uuid,p_node uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (p_task is null and p_node is null) or exists(select 1 from public.tasks t where t.id=p_task
  and eflow_m7.project_visible(t.linked_project_id,auth.uid())
  and (p_node is null or t.assigned_to=auth.uid() or eflow_m7.node_activated(t.id,p_node)));
$$;

create policy m7_operational_project on public.projects as restrictive for select to authenticated
 using(eflow_m7.project_visible(id,auth.uid()));
create policy m7_operational_task on public.tasks as restrictive for select to authenticated
 using(eflow_m7.project_visible(linked_project_id,auth.uid()));
create policy m7_operational_subtask on public.subtasks as restrictive for select to authenticated
 using(eflow_m7.node_visible(task_id,id,auth.uid()));
create policy m7_operational_personal_subtask on public.personal_subtasks as restrictive for select to authenticated
 using(eflow_m7.personal_node_visible(task_id,id));
create policy m7_operational_work_events on public.work_tree_events as restrictive for select to authenticated
 using(eflow_m7.can_view_work_event(root_id,node_id,before_data,after_data));
create policy m7_operational_subtask_updates on public.subtask_progress_updates as restrictive for select to authenticated
 using(eflow_m7.can_view_linked_work(task_id,subtask_id));
create policy m7_operational_subtask_submissions on public.subtask_submissions as restrictive for select to authenticated
 using(eflow_m7.can_view_linked_work(task_id,subtask_id));
create policy m7_operational_notifications on public.notifications as restrictive for select to authenticated
 using(case when entity_type='m7_personal_work_proposal' then
   eflow_m7.personal_node_visible(task_id,work_node_id) and eflow_r3.project_access(project_id)
  else eflow_m7.project_visible(project_id,auth.uid()) and case when financial_record_id is null
   then eflow_m7.can_view_linked_work(task_id,work_node_id)
   else eflow_m7.finance_link_visible(task_id,work_node_id) end end);
create policy m7_operational_allocations on public.work_budget_allocations as restrictive for select to authenticated
 using(eflow_m7.finance_link_visible(task_id,subtask_id));
create policy m7_operational_cash on public.petty_cash_requests as restrictive for select to authenticated
 using(eflow_m7.finance_link_visible(task_id,subtask_id));

-- Defer fresh assignment notices before INSERT so Realtime and push
-- dispatch see the same publication boundary as recipient reads.
create table eflow_m7.deferred_assignments (
 id uuid primary key, root_id uuid not null, node_id uuid not null, recipient_id uuid not null, payload jsonb not null
);
alter table eflow_m7.deferred_assignments enable row level security;
create index m7_deferred_assignment_scope on eflow_m7.deferred_assignments(root_id,node_id);
create function eflow_m7.defer_work_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.type in ('assignment','reassignment') and new.work_node_id is not null and exists (
  select 1 from public.tasks t join public.subtasks s on s.task_id=t.id and s.id=new.work_node_id
   where t.id=new.task_id and new.user_id is distinct from t.assigned_to
    and not eflow_m7.node_activated(t.id,s.id)
 ) then
  insert into eflow_m7.deferred_assignments values(new.id,new.task_id,new.work_node_id,new.user_id,to_jsonb(new));
  return null;
 end if;
 return new;
end $$;
create trigger zz_m7_defer_work_assignment before insert on public.notifications
 for each row execute function eflow_m7.defer_work_assignment();

create function eflow_m7.publish_work_assignments()
returns trigger language plpgsql security definer set search_path='' as $$
declare target_root uuid; target_node uuid; queued eflow_m7.deferred_assignments; recorded public.notifications;
begin
 if tg_table_name='tasks' then
  if old.status is not distinct from new.status or new.status<>'in_progress' then return null; end if;
  target_root:=new.id;
 else
  if new.started_at is null or new.started_at is not distinct from old.started_at then return null; end if;
  target_root:=new.task_id;
  target_node:=new.id;
 end if;
 for queued in select d.* from eflow_m7.deferred_assignments d
  where d.root_id=target_root and (target_node is null or d.node_id=target_node)
   and eflow_m7.node_activated(d.root_id,d.node_id) for update
 loop
  if public.can_see_task(queued.root_id,queued.recipient_id) and exists (
   select 1 from public.subtasks s where s.task_id=queued.root_id and s.id=queued.node_id
    and (s.lead_id=queued.recipient_id or queued.recipient_id=any(s.assigned_to_ids))
  ) then
   recorded:=jsonb_populate_record(null::public.notifications,queued.payload);
   recorded.created_at:=clock_timestamp();
   insert into public.notifications select (recorded).* on conflict(id) do nothing;
  end if;
  delete from eflow_m7.deferred_assignments where id=queued.id;
 end loop;
 return null;
end $$;
create trigger zz_m7_publish_work_assignment_on_task_start after update of status on public.tasks
 for each row execute function eflow_m7.publish_work_assignments();
create trigger zz_m7_publish_work_assignment_on_subtask_start after update of started_at on public.subtasks
 for each row execute function eflow_m7.publish_work_assignments();
revoke all on function eflow_m7.defer_work_assignment(),eflow_m7.publish_work_assignments() from public,anon,authenticated,service_role;

create function eflow_m7.with_visible_counts(p_snapshot jsonb)
returns jsonb language sql stable set search_path='' as $$
 with leaves as (
  select n from jsonb_array_elements(p_snapshot->'nodes') n
  where not exists(select 1 from jsonb_array_elements(p_snapshot->'nodes') c
   where c->>'parent_subtask_id'=n->>'id')
 )
 select p_snapshot || jsonb_build_object('leaf_total',count(*),
  'leaf_completed',count(*) filter (where n->>'status'='completed')) from leaves;
$$;
revoke all on function eflow_m7.with_visible_counts(jsonb) from public,anon,authenticated,service_role;

do $migration$
begin
 perform eflow_m7.replace_body_part('eflow_m7.with_schedule(jsonb)',
  ') s on true',
  $body$) s on true
   where case when p_snapshot->'root'->>'kind'='office' then eflow_m7.node_visible(
     (p_snapshot->'root'->>'id')::uuid,(n.value->>'id')::uuid,auth.uid())
   else eflow_m7.personal_node_visible((p_snapshot->'root'->>'id')::uuid,(n.value->>'id')::uuid) end$body$);
 perform eflow_m7.replace_body_part('eflow_r7.snapshot(uuid)',
  'select eflow_m7.with_schedule(eflow_r7.m7_baseline_snapshot(p_root))',
  'select eflow_m7.with_visible_counts(eflow_m7.with_schedule(eflow_r7.m7_baseline_snapshot(p_root)))');
 perform eflow_m7.replace_body_part('eflow_r7.office_work_roots()',
  'where n.task_id=t.id and eflow_r7.member',
  'where n.task_id=t.id and eflow_m7.node_visible(t.id,n.id,auth.uid()) and eflow_r7.member');
 perform eflow_m7.replace_body_part('eflow_r7.work_activity(uuid[],timestamptz,uuid)',
  'and eflow_r7.read_root(e.root_id) and',
  'and eflow_m7.can_view_work_event(e.root_id,e.node_id,e.before_data,e.after_data) and');
 perform eflow_m7.replace_body_part('eflow_r7.command(uuid,integer,uuid,text,jsonb)',
  'if not coalesce((r->>''open'')::boolean,false) then',
  $body$if v_kind='office' and (
  (p_command<>'create' and v_id is not null and not eflow_m7.node_visible(p_root,v_id,auth.uid()))
  or (v_parent is not null and not eflow_m7.node_visible(p_root,v_parent,auth.uid()))
 ) then raise exception 'Current branch access required' using errcode='42501'; end if;
 if v_kind='personal' and p_command in ('progress','submit') and exists (
  select 1 from public.personal_subtasks s where s.id=v_id and s.task_id=p_root
   and s.start_date is not null and s.started_at is null
 ) then raise exception 'This subtask has not started' using errcode='42501'; end if;
 if not coalesce((r->>'open')::boolean,false) then$body$);
end $migration$;

-- Explicit draft endpoints use the existing writers with current authorization,
-- impact confirmation, revision, receipt, and funding checks still in force.
create function eflow_m7.enter_draft(p_project uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not eflow_r3.eligible(actor) then raise exception 'Draft access denied' using errcode='42501'; end if;
 perform 1 from public.projects p where p.id=p_project and p.status='planning' for update;
 if not found or not (public.can_manage_project(p_project,actor) or eflow_project.lead(p_project,actor)) then
  raise exception 'Draft access denied' using errcode='42501';
 end if;
 insert into eflow_m7.draft_scope values(txid_current(),actor,p_project);
end $$;

create function eflow_m7.leave_draft(p_project uuid)
returns void language sql security definer set search_path='' as $$
 delete from eflow_m7.draft_scope where tx=txid_current() and actor_id=auth.uid() and project_id=p_project;
$$;

create function public.m7_draft_projects()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.id),'[]') from public.projects p
 where p.status='planning' and eflow_r3.eligible(auth.uid())
  and (public.can_manage_project(p.id,auth.uid()) or eflow_project.lead(p.id,auth.uid()));
$$;

create function public.m7_draft_project(p_project uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform eflow_m7.enter_draft(p_project);
 result:=jsonb_build_object('flow',eflow_project.snapshot(p_project),
  'groups',coalesce((select jsonb_agg(to_jsonb(g) order by g.position,g.id) from public.project_groups g where g.project_id=p_project),'[]'),
  'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.workspace_position,t.id) from public.tasks t
   where t.linked_project_id=p_project and t.deleted_at is null and public.can_see_task(t.id,auth.uid())),'[]'));
 perform eflow_m7.leave_draft(p_project);
 return result;
end $$;

create function public.m7_draft_task_create(p_project uuid,p_group uuid,p_title text)
returns public.tasks language plpgsql security definer set search_path='' as $$
declare result public.tasks;
begin
 perform eflow_m7.enter_draft(p_project);
 result:=public.phase3_create_task(p_project,p_group,p_title);
 perform eflow_m7.leave_draft(p_project);
 return result;
end $$;

create function public.m7_draft_work(
 p_project uuid,p_root uuid,p_operation text,p_revision integer default null,p_request uuid default null,
 p_command text default null,p_payload jsonb default null,p_fingerprint text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.tasks where id=p_root and linked_project_id=p_project)
    or not coalesce(eflow_r3.eligible(auth.uid()),false)
    or not (public.can_manage_project(p_project,auth.uid()) or eflow_project.lead(p_project,auth.uid())) then
  raise exception 'Draft work access denied' using errcode='42501';
 end if;
 perform eflow_r7.lock_impact(p_root);
 perform eflow_m7.enter_draft(p_project);
 if not exists(select 1 from public.tasks t where t.id=p_root and t.linked_project_id=p_project
  and t.deleted_at is null and public.can_see_task(t.id,auth.uid())) then
  raise exception 'Draft work access denied' using errcode='42501';
 end if;
 case p_operation
  when 'tree' then result:=public.r7_work_tree(p_root);
  when 'impact' then result:=public.nw_work_impact(p_root,p_revision,p_command,p_payload);
  when 'command' then
   if p_fingerprint is null and p_command in ('edit','move','order','delete') then
    raise exception 'Confirm the current work impact first' using errcode='22023';
   end if;
   if p_fingerprint is null then result:=public.r7_work_command(p_root,p_revision,p_request,p_command,p_payload);
   else result:=public.nw_work_command(p_root,p_revision,p_request,p_command,p_payload,p_fingerprint); end if;
  when 'patch_task' then result:=to_jsonb(public.phase3_patch_task(p_root,p_payload));
  when 'allocate_task' then result:=to_jsonb(public.allocate_project_task_funding(p_root,p_payload->'lines',p_payload->>'reason',p_request));
  else raise exception 'Unsupported draft operation' using errcode='22023';
 end case;
 perform eflow_m7.leave_draft(p_project);
 return result;
end $$;

revoke all on function eflow_m7.previous_project_access(uuid,uuid),eflow_m7.previous_task_access(uuid,uuid),
 eflow_m7.enter_draft(uuid),eflow_m7.leave_draft(uuid),eflow_m7.project_visible(uuid,uuid),eflow_m7.node_visible(uuid,uuid,uuid),
 eflow_m7.personal_node_visible(uuid,uuid),eflow_m7.can_view_work_event(uuid,uuid,jsonb,jsonb),eflow_m7.can_view_linked_work(uuid,uuid),eflow_m7.finance_link_visible(uuid,uuid),public.m7_draft_projects(),
 public.m7_draft_project(uuid),public.m7_draft_task_create(uuid,uuid,text),
 public.m7_draft_work(uuid,uuid,text,integer,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function eflow_m7.project_visible(uuid,uuid),eflow_m7.node_visible(uuid,uuid,uuid),
 eflow_m7.personal_node_visible(uuid,uuid),eflow_m7.can_view_work_event(uuid,uuid,jsonb,jsonb),eflow_m7.can_view_linked_work(uuid,uuid),eflow_m7.finance_link_visible(uuid,uuid),public.m7_draft_projects(),
 public.m7_draft_project(uuid),public.m7_draft_task_create(uuid,uuid,text),
 public.m7_draft_work(uuid,uuid,text,integer,uuid,text,jsonb,text) to authenticated;
-- Assignment discovery returns only actual appointments, inside a current
-- Office workspace the caller can enter. The broader project browser keeps
-- its own authorized task reads.
create function public.m7_office_assignments(p_workspace uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=eflow_r3.actor();
begin
 if p_workspace is not null and not (eflow_r3.workspace_access(p_workspace)
  and exists(select 1 from public.workspaces w where w.id=p_workspace and w.kind='office'))
 then raise exception 'Current Office workspace access required' using errcode='42501'; end if;
 return coalesce((
  with scope as (
   select t.id,t.assigned_to,t.team_member_ids,w.id as workspace_id
   from public.tasks t
   left join public.office_project_homes h on h.project_id=t.linked_project_id
   join lateral (
    select ws.id from public.workspaces ws
     where ws.kind='office' and (ws.id=h.workspace_id or ws.office_id=t.org_id)
      and eflow_r3.workspace_access(ws.id)
     order by (ws.id=h.workspace_id) desc nulls last,ws.id limit 1
   ) w on true
   where t.deleted_at is null and t.proposed_office_identity_id is null
     and t.source_collaboration_draft_id is null and public.can_see_task(t.id,actor)
     and (p_workspace is null or w.id=p_workspace)
  ), assignments as (
   select 'office-task:'||t.id::text key,t.workspace_id from scope t
    where t.assigned_to=actor or actor=any(t.team_member_ids)
   union all
   select 'office-node:'||s.id::text key,t.workspace_id
    from scope t join public.subtasks s on s.task_id=t.id
    where (s.lead_id=actor or actor=any(s.assigned_to_ids))
     and eflow_m7.node_visible(t.id,s.id,actor)
  )
  select jsonb_agg(to_jsonb(a) order by a.key) from assignments a
 ),'[]'::jsonb);
end $$;
revoke all on function public.m7_office_assignments(uuid) from public,anon,authenticated,service_role;
grant execute on function public.m7_office_assignments(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
