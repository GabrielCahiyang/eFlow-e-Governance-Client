-- Planned dates are nullable for historical work. New work defaults in its workspace calendar.
begin;
create schema eflow_m7;
revoke all on schema eflow_m7 from public, anon, authenticated;
grant usage on schema eflow_m7 to authenticated, service_role;

alter table public.subtasks add column start_date date, add column started_at timestamptz;
alter table public.personal_subtasks add column start_date date, add column started_at timestamptz;
create index m7_office_scheduled_subtasks on public.subtasks (task_id, start_date)
 where start_date is not null and started_at is null and status = 'todo';
create index m7_personal_scheduled_subtasks on public.personal_subtasks (task_id, start_date)
 where start_date is not null and started_at is null and status = 'todo';

-- Keep the installed implementations and their grants. Abort if the reviewed
-- baseline differs, instead of silently dropping a newer authorization check.
create function eflow_m7.replace_body_part(p_function regprocedure, p_old text, p_new text)
returns void language plpgsql set search_path = '' as $$
declare definition text := pg_get_functiondef(p_function);
begin
 if strpos(definition, p_old) = 0 or strpos(replace(definition, p_old, ''), p_new) > 0 then
  raise exception 'Review the installed function before applying M7: % (%).', p_function, left(p_old,100);
 end if;
 execute replace(definition, p_old, p_new);
end $$;
revoke all on function eflow_m7.replace_body_part(regprocedure,text,text) from public,anon,authenticated,service_role;

create function eflow_m7.work_day(p_root uuid)
returns date language sql stable security definer set search_path = '' as $$
 select (statement_timestamp() at time zone coalesce(
  (select w.timezone from public.personal_tasks t
   join public.personal_projects p on p.id=t.project_id
   join public.workspaces w on w.id=p.workspace_id where t.id=p_root),
  (select w.timezone from public.tasks t join public.workspaces w on w.office_id=t.org_id
   where t.id=p_root and w.kind='office' order by w.id limit 1),
  'Asia/Manila'))::date;
$$;

create table eflow_m7.activation (
 tx bigint not null, root uuid not null, primary key (tx, root)
);
alter table eflow_m7.activation enable row level security;

create function eflow_m7.schedule_node()
returns trigger language plpgsql security definer set search_path = '' as $$
declare root jsonb := eflow_r7.root(new.task_id); today date := eflow_m7.work_day(new.task_id);
 ancestor uuid := new.parent_subtask_id; n eflow_r7.nodes;
 parent_start date; parent_due date; eligible boolean := true;
begin
 if tg_op = 'UPDATE' then
  if new.started_at is distinct from old.started_at and not exists (
    select 1 from eflow_m7.activation a where a.tx=txid_current() and a.root=new.task_id
  ) then raise exception 'Subtask start time is managed by the lifecycle' using errcode='42501'; end if;
  if new.start_date is not distinct from old.start_date and new.due_date is not distinct from old.due_date
    and new.parent_subtask_id is not distinct from old.parent_subtask_id then return new; end if;
  if new.start_date is null and old.start_date is not null then
   raise exception 'Keep a planned start date for scheduled work' using errcode='22023';
  end if;
  if old.started_at is not null and new.start_date is distinct from old.start_date then
   raise exception 'A started subtask retains its planned start date' using errcode='22023';
  end if;
 else
  new.started_at := null;
  new.start_date := coalesce(new.start_date,today);
 end if;
 if new.start_date is null then return new; end if;
 if root->>'kind' = 'office' then
  select t.start_date::date into parent_start from public.tasks t where t.id=new.task_id;
 end if;
 while ancestor is not null loop
  select * into n from eflow_r7.nodes where id=ancestor and task_id=new.task_id;
  if not found then raise exception 'Parent is unavailable in this work tree' using errcode='23514'; end if;
  if tg_table_name='subtasks' then
   select s.start_date into parent_due from public.subtasks s where s.id=n.id;
  else
   select s.start_date into parent_due from public.personal_subtasks s where s.id=n.id;
  end if;
  parent_start := greatest(parent_start,parent_due);
  eligible := eligible and n.status not in ('completed','for_review');
  ancestor := n.parent_subtask_id;
 end loop;
 if new.start_date < parent_start or new.start_date > new.due_date then
  raise exception 'Choose a start date within the parent schedule, or reschedule the parent first' using errcode='22023';
 end if;
 if tg_op='INSERT' and eligible and new.status='todo' and new.start_date<=today
    and root->>'status'='in_progress' and (root->>'open')::boolean then
  new.started_at := statement_timestamp();
 end if;
 return new;
end $$;
create trigger zz_m7_office_subtask_schedule before insert or update on public.subtasks
 for each row execute function eflow_m7.schedule_node();
create trigger zz_m7_personal_subtask_schedule before insert or update on public.personal_subtasks
 for each row execute function eflow_m7.schedule_node();

-- Store the new field inside the same existing revision, audit and receipt transaction.
do $migration$
begin
 perform eflow_m7.replace_body_part('eflow_r7.command(uuid,integer,uuid,text,jsonb)',
  '''title'',''due'',''standalone''', '''title'',''due'',''start'',''standalone''');
 perform eflow_m7.replace_body_part('eflow_r7.command(uuid,integer,uuid,text,jsonb)',
  ',due_date,is_standalone)', ',due_date,start_date,is_standalone)');
 perform eflow_m7.replace_body_part('eflow_r7.command(uuid,integer,uuid,text,jsonb)',
  '(p_payload->>''due'')::date,coalesce', '(p_payload->>''due'')::date,(p_payload->>''start'')::date,coalesce');
 perform eflow_m7.replace_body_part('eflow_r7.command(uuid,integer,uuid,text,jsonb)',
  'due_date=v_due,', 'due_date=v_due,start_date=case when p_payload ? ''start'' then (p_payload->>''start'')::date else start_date end,');
 perform eflow_m7.replace_body_part('eflow_r7.work_impact(uuid,integer,text,jsonb)',
  '''title'',''due'',''standalone''', '''title'',''due'',''start'',''standalone''');
 perform eflow_m7.replace_body_part('eflow_r7.guard_node()',
  '''completed_at'',''reviewer_id''', '''completed_at'',''started_at'',''reviewer_id''');
 perform eflow_m7.replace_body_part('public.transition_task_status(uuid,text,text,text)',
  '  select role::text, full_name',
  $body$  if p_to_status='in_progress' and public.can_see_task(p_task_id,caller) then
    perform eflow_r7.lock_impact(p_task_id);
  end if;
  select role::text, full_name$body$);
 perform eflow_m7.replace_body_part('public.r3_personal_project_command(uuid,text,jsonb,uuid)',
  ' select * into p from public.personal_projects where id=p_project for update;',
  $body$ if p_command in ('progress_task','submit_task','review_task','staff_task')
  and eflow_r3.project_access(p_project,true) and exists (
   select 1 from public.personal_tasks candidate where candidate.id=(p_payload->>'task_id')::uuid and candidate.project_id=p_project
  ) then perform eflow_r7.lock_impact((p_payload->>'task_id')::uuid); end if;
 select * into p from public.personal_projects where id=p_project for update;$body$);
 perform eflow_m7.replace_body_part('public.r3_personal_project_command(uuid,text,jsonb,uuid)',
  $old$status='in_progress',submitted_by=null$old$,
  $new$status=case when t.status='todo' then 'todo' else 'in_progress' end,submitted_by=null$new$);
 perform eflow_m7.replace_body_part('public.guard_subtask_contributor_update()',
  '  if workflow_authorized then',
  $body$  if workflow_authorized or (new.started_at is distinct from old.started_at
    and (to_jsonb(new)-'started_at'-'updated_at')=(to_jsonb(old)-'started_at'-'updated_at')
    and exists(select 1 from eflow_m7.activation a where a.tx=txid_current() and a.root=old.task_id)) then$body$);
end $migration$;

create function eflow_m7.record_node_start()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.started_at is not null and (tg_op='INSERT' or old.started_at is null) then
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data)
  values(auth.uid(),'subtask',new.id::text,'subtask.started_automatically',
   (select t.org_id from public.tasks t where t.id=new.task_id),
   jsonb_build_object('rootId',new.task_id,'startDate',new.start_date,'startedAt',new.started_at,'kind',tg_table_name));
 end if;
 return null;
end $$;
create trigger m7_office_node_start_log after insert or update of started_at on public.subtasks
 for each row execute function eflow_m7.record_node_start();
create trigger m7_personal_node_start_log after insert or update of started_at on public.personal_subtasks
 for each row execute function eflow_m7.record_node_start();

create function eflow_m7.activate_root_children(p_root uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare root jsonb := eflow_r7.root(p_root); today date := eflow_m7.work_day(p_root); count_started integer;
begin
 if root is null or root->>'status'<>'in_progress' or not (root->>'open')::boolean then return 0; end if;
 insert into eflow_m7.activation values(txid_current(),p_root);
 if root->>'kind'='office' then
  with recursive eligible as (
   select s.id from public.subtasks s where s.task_id=p_root and s.parent_subtask_id is null
    and s.status in ('todo','in_progress','changes_requested') and coalesce(s.start_date,today)<=today
   union all
   select s.id from public.subtasks s join eligible e on e.id=s.parent_subtask_id
    where s.task_id=p_root and s.status in ('todo','in_progress','changes_requested') and coalesce(s.start_date,today)<=today
  ) update public.subtasks s set started_at=statement_timestamp()
    where s.id in (select id from eligible) and s.started_at is null and s.start_date is not null and s.status='todo';
 else
  with recursive eligible as (
   select s.id from public.personal_subtasks s where s.task_id=p_root and s.parent_subtask_id is null
    and s.status in ('todo','in_progress','changes_requested') and coalesce(s.start_date,today)<=today
   union all
   select s.id from public.personal_subtasks s join eligible e on e.id=s.parent_subtask_id
    where s.task_id=p_root and s.status in ('todo','in_progress','changes_requested') and coalesce(s.start_date,today)<=today
  ) update public.personal_subtasks s set started_at=statement_timestamp()
    where s.id in (select id from eligible) and s.started_at is null and s.start_date is not null and s.status='todo';
 end if;
 get diagnostics count_started = row_count;
 delete from eflow_m7.activation a where a.tx=txid_current() and a.root=p_root;
 return count_started;
end $$;

create function eflow_m7.guard_root_start()
returns trigger language plpgsql security definer set search_path = '' as $$
declare lead uuid; root jsonb;
begin
 if new.status='in_progress' and old.status in ('todo','pending_assignment','changes_requested') then
  if tg_table_name='tasks' then lead:=old.assigned_to; else lead:=old.lead_id; end if;
  root:=eflow_r7.root(new.id);
  if lead is null or lead is distinct from auth.uid() or not coalesce(eflow_r3.eligible(lead),false)
     or root is not null and not coalesce(eflow_r7.read_root(new.id),false) then
   raise exception 'Only the appointed Task Lead can start this task' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
create trigger m7_office_root_start_guard before update of status on public.tasks
 for each row execute function eflow_m7.guard_root_start();
create trigger m7_personal_root_start_guard before update of status on public.personal_tasks
 for each row execute function eflow_m7.guard_root_start();

create function eflow_m7.start_children_after_root()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if old.status is distinct from new.status and new.status='in_progress' then
  perform eflow_m7.activate_root_children(new.id);
 end if;
 return null;
end $$;
create trigger m7_office_root_activates_subtasks after update of status on public.tasks
 for each row execute function eflow_m7.start_children_after_root();
create trigger m7_personal_root_activates_subtasks after update of status on public.personal_tasks
 for each row execute function eflow_m7.start_children_after_root();

-- Keep the established rollup and scope checks while removing child-to-root start.
do $migration$
begin
 perform eflow_m7.replace_body_part('public.refresh_task_subtask_rollup(uuid,boolean)',
  'started:=r->>''status''=''todo''', 'started:=false and r->>''status''=''todo''');
end $migration$;

-- The scheduler invokes one bounded batch. Each root uses the same writer lock as
-- the hierarchy commands and rechecks eligibility after the lock is acquired.
create function eflow_m7.activate_scheduled_subtasks(p_limit integer default 50)
returns integer language plpgsql security definer set search_path = '' as $$
declare root_id uuid; count_started integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 200 then raise exception 'Invalid batch size' using errcode='22023'; end if;
 for root_id in
  select task_id from (
   select s.task_id from public.subtasks s join public.tasks t on t.id=s.task_id
    join public.projects p on p.id=t.linked_project_id
    where t.status='in_progress' and t.deleted_at is null and t.archived_at is null and p.status in ('active','on_hold')
     and s.start_date<=eflow_m7.work_day(s.task_id) and s.started_at is null and s.status='todo'
   union
   select s.task_id from public.personal_subtasks s join public.personal_tasks t on t.id=s.task_id
    join public.personal_projects p on p.id=t.project_id
    where t.status='in_progress' and p.status='active'
     and s.start_date<=eflow_m7.work_day(s.task_id) and s.started_at is null and s.status='todo'
  ) roots order by task_id limit p_limit
 loop
  perform eflow_r7.lock_impact(root_id);
  perform 1 from public.tasks t where t.id=root_id for update;
  perform 1 from public.personal_tasks t where t.id=root_id for update;
  count_started := count_started + eflow_m7.activate_root_children(root_id);
 end loop;
 return count_started;
end $$;

-- Expose schedule data in the canonical snapshot so read, command and replay
-- responses agree. Existing blocker decorations on r7_work_tree stay intact.
create function eflow_m7.with_schedule(p_snapshot jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_set(jsonb_set(p_snapshot,'{root,scheduling}',jsonb_build_object(
  'version',1,'today',eflow_m7.work_day((p_snapshot->'root'->>'id')::uuid))),
  '{nodes}',coalesce((
   select jsonb_agg(n.value || jsonb_build_object('start_date',s.start_date,'started_at',s.started_at,
    'effective_status',case when s.started_at is not null and n.value->>'status'='todo'
      then 'in_progress' else n.value->>'status' end) order by n.ordinality)
   from jsonb_array_elements(p_snapshot->'nodes') with ordinality n(value,ordinality)
   left join lateral (
    select start_date,started_at from public.subtasks where id=(n.value->>'id')::uuid and p_snapshot->'root'->>'kind'='office'
    union all
    select start_date,started_at from public.personal_subtasks where id=(n.value->>'id')::uuid and p_snapshot->'root'->>'kind'='personal'
   ) s on true
  ),'[]'::jsonb));
$$;
alter function eflow_r7.snapshot(uuid) rename to m7_baseline_snapshot;
revoke all on function eflow_r7.m7_baseline_snapshot(uuid) from public,anon,authenticated,service_role;
create function eflow_r7.snapshot(p_root uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select eflow_m7.with_schedule(eflow_r7.m7_baseline_snapshot(p_root));
$$;
revoke all on function eflow_r7.snapshot(uuid) from public,anon,authenticated,service_role;
grant execute on function eflow_r7.snapshot(uuid) to authenticated;

revoke execute on all functions in schema eflow_m7 from public,anon,authenticated,service_role;
grant execute on function eflow_m7.activate_scheduled_subtasks(integer) to service_role;
do $scheduler$
begin
 if to_regprocedure('cron.schedule(text,text,text)') is not null then
  execute $job$select cron.schedule('eflow-m7-subtask-starts','*/5 * * * *',
   'select eflow_m7.activate_scheduled_subtasks(50)')$job$;
 end if;
end $scheduler$;
notify pgrst, 'reload schema';
commit;
