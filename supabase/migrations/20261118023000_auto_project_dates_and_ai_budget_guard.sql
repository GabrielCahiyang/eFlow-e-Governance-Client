-- Remove mandatory project start/target dates from project setup and auto-derive
-- project start_date / target_date from tasks & subtasks.
-- Enforce Head-authorized eflow_project.funding as the strict ceiling & pool for AI imports.

begin;
set local lock_timeout = '10s';

-- 1. Allow save_details, authorize_funding, ready, finish_setup, guard_work, and allocate_task
--    to operate without pre-entered project start/target dates.
CREATE OR REPLACE FUNCTION eflow_project.save_details(p_project uuid, p_details jsonb)
 RETURNS public.projects
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects; leader uuid;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) then
  raise exception 'Only the appointed Head can save project setup' using errcode='42501';
 end if;
 if p.updated_at is distinct from (p_details->>'version')::timestamptz then
  raise exception 'Project changed elsewhere. Reopen setup and review current details before saving' using errcode='40001';
 end if;
 leader:=nullif(p_details->>'lead','')::uuid;
 if leader is not null and not exists(select 1 from public.profiles where id=leader and is_active and org_id=p.org_id and role not in ('admin','viewer','super_admin')) then
  raise exception 'Choose an active project lead from the implementing office' using errcode='23514';
 end if;
 if length(btrim(p_details->>'title')) not between 1 and 200 or length(coalesce(p_details->>'description',''))>12000 or length(coalesce(p_details->>'scope',''))>12000 then
  raise exception 'Enter a project title up to 200 characters; description and scope may each contain up to 12000 characters' using errcode='23514';
 end if;
 update public.projects
 set title=btrim(p_details->>'title'),
     description=coalesce(p_details->>'description',''),
     scope=coalesce(p_details->>'scope',''),
     project_lead_id=leader,
     start_date=coalesce(nullif(p_details->>'start','')::date, start_date),
     target_date=coalesce(nullif(p_details->>'end','')::date, target_date),
     funding_not_required=coalesce((p_details->>'noFunding')::boolean,false),
     updated_at=clock_timestamp()
 where id=p.id
 returning * into p;
 if p.start_date is not null and p.target_date is not null and p.start_date>p.target_date then
  raise exception 'Project target date must be on or after its start date' using errcode='23514';
 end if;
 if p.project_lead_id is not null then
  insert into public.project_office_members(project_office_id,user_id,selected_by)
   select id,p.project_lead_id,auth.uid() from public.project_offices where project_id=p.id and office_id=p.org_id and relationship_type='lead'
   on conflict do nothing;
  insert into public.project_members(project_id,user_id,role) values(p.id,p.project_lead_id,'member') on conflict do nothing;
 end if;
 return p;
end $function$;

CREATE OR REPLACE FUNCTION eflow_project.ready(p_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((
  select p.setup_completed_at is not null
     and btrim(p.title)<>''
     and btrim(p.description)<>''
     and btrim(p.scope)<>''
     and (p.start_date is null or p.target_date is null or p.target_date>=p.start_date)
     and eflow_project.lead(p.id,p.project_lead_id)
     and (p.funding_not_required or exists(
      select 1 from eflow_project.funding f
      join public.budget_commitments c on c.id=f.commitment_id
      where f.project_id=p.id and f.amount>0 and c.status='active'
     ))
  from public.projects p where p.id=p_project
 ), false)
$function$;

CREATE OR REPLACE FUNCTION eflow_project.finish_setup(p_project uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) then
  raise exception 'Only the appointed Head may finish setup' using errcode='42501';
 end if;
 update public.projects set setup_completed_at=now(),updated_at=clock_timestamp() where id=p.id;
 if not eflow_project.ready(p.id) then
  raise exception 'Provide title, description, scope, project lead, and authorize funding or select No funding required' using errcode='23514';
 end if;
end $function$;

CREATE OR REPLACE FUNCTION eflow_project.guard_work()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare project uuid; t public.tasks;
begin
 if tg_table_name='tasks' then project:=new.linked_project_id;
 elsif tg_table_name='subtasks' then select * into t from public.tasks where id=new.task_id; project:=t.linked_project_id;
 elsif tg_table_name='project_office_members' then select project_id into project from public.project_offices where id=new.project_office_id;
 else project:=new.project_id; end if;
 if project is null then return new; end if;
 if tg_table_name='project_offices' and to_jsonb(new)->>'relationship_type'='lead' and exists(select 1 from public.projects p where p.id=project and p.org_id=(to_jsonb(new)->>'office_id')::uuid) then return new; end if;
 if tg_table_name in ('project_members','project_office_members','project_access_grants') and exists(select 1 from public.projects where id=project and coalesce(to_jsonb(new)->>'user_id',to_jsonb(new)->>'recipient')::uuid in (owner_id,created_by,project_lead_id)) then return new; end if;
 if not eflow_project.ready(project) then
  raise exception 'Complete project details, scope, project lead and funding setup before adding tasks, subtasks or people' using errcode='23514';
 end if;
 return new;
end $function$;

CREATE OR REPLACE FUNCTION eflow_project.authorize_funding(p_project uuid, p_lines jsonb, p_reason text, p_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.projects; line jsonb; s public.office_budget_sections; b public.department_fiscal_budgets; c uuid; amount numeric; q integer; payload jsonb; receipt eflow_project.commands; total numeric:=0;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or auth.uid() is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or p.status in ('completed','archived') then
  raise exception 'Only the appointed Head may authorize funding for an open project' using errcode='42501';
 end if;
 if p_key is null or btrim(coalesce(p_reason,''))='' or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100 then
  raise exception 'Select funding sources, amounts and an authorization reason' using errcode='23514';
 end if;
 payload:=jsonb_build_object('project',p_project,'lines',p_lines,'reason',p_reason);
 select * into receipt from eflow_project.commands where actor_id=auth.uid() and request_id=p_key;
 if found then
  if receipt.payload<>payload then raise exception 'This request key belongs to different funding details' using errcode='23514'; end if;
  return receipt.result;
 end if;
 if p.project_lead_id is null or btrim(p.description)='' or btrim(p.scope)='' then
  raise exception 'Save complete project details and scope before authorizing funding' using errcode='23514';
 end if;
 perform 1 from public.department_fiscal_budgets fb where fb.org_id=p.org_id order by fb.id for update;
 for line in select value from jsonb_array_elements(p_lines) loop
  amount:=(line->>'amount')::numeric;
  q:=null;
  if amount is null or amount<=0 or amount<>round(amount,2) or amount>90000000000 then
   raise exception 'Enter a positive amount in cents' using errcode='23514';
  end if;
  select * into s from public.office_budget_sections where id=(line->>'partitionId')::uuid and not retired;
  select * into b from public.department_fiscal_budgets where id=s.fiscal_budget_id and org_id=p.org_id and status='locked';
  if b.id is null or exists(select 1 from public.office_budget_sections where parent_id=s.id and not retired) then
   raise exception 'Choose a released leaf funding account from this office and a locked fiscal year' using errcode='23514';
  end if;
  if amount>s.amount-s.held_amount-eflow_budget.partition_committed(s.id) then
   raise exception 'Funding source %: requested %, available %',s.name,amount,s.amount-s.held_amount-eflow_budget.partition_committed(s.id) using errcode='23514';
  end if;
  if amount>b.approved_amount-eflow_budget.section_total(b.id,true)-(select coalesce(sum(bc.amount),0) from public.budget_commitments bc where fiscal_budget_id=b.id and status='active') then
   raise exception 'Office Budget has insufficient available funding' using errcode='23514';
  end if;
  select bc.id into c from public.budget_commitments bc join eflow_project.funding pf on pf.commitment_id=bc.id where pf.project_id=p.id and bc.fiscal_budget_id=b.id and bc.status='active' limit 1;
  if c is null then
   insert into public.budget_commitments(fiscal_budget_id,title,amount,created_by,funding_kind,authorization_key,authorization_payload)
    values(b.id,'Project: '||p.title,0,auth.uid(),'direct_work',gen_random_uuid(),jsonb_build_object('projectId',p.id))
    returning id into c;
  end if;
  insert into eflow_project.funding(project_id,commitment_id,partition_id,fiscal_year,quarter,amount)
   values(p.id,c,s.id,b.fiscal_year,q,amount)
   on conflict(project_id,partition_id) where quarter is null do update set amount=eflow_project.funding.amount+excluded.amount;
  update public.budget_commitments set amount=(select sum(pf.amount) from eflow_project.funding pf where pf.commitment_id=c) where id=c;
  insert into public.budget_ledger_entries(fiscal_budget_id,org_id,commitment_id,entry_type,amount,description,actor_id,reason,metadata)
   values(b.id,p.org_id,c,'proposal_committed',amount,'Project funding reserved: '||p.title,auth.uid(),p_reason,jsonb_build_object('projectId',p.id,'partitionId',s.id));
  total:=total+amount;
 end loop;
 update public.projects set funding_not_required=false,updated_at=clock_timestamp() where id=p.id;
 insert into eflow_project.commands values(auth.uid(),p_key,payload,jsonb_build_object('authorized',total));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data,reason)
  values(auth.uid(),'project',p.id::text,'project.funding_authorized',p.org_id,payload,p_reason);
 return jsonb_build_object('authorized',total);
end $function$;

-- 2. Remove project-date boundary rejections from task/subtask schedule guards and
--    automatically derive project start_date / target_date from tasks & subtasks.
CREATE OR REPLACE FUNCTION eflow_schedule.guard_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE due date;
BEGIN
  IF NEW.linked_project_id IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.linked_project_id, NEW.start_date, NEW.deadline, NEW.due_date, NEW.deleted_at)
      IS NOT DISTINCT FROM ROW(OLD.linked_project_id, OLD.start_date, OLD.deadline, OLD.due_date, OLD.deleted_at) THEN
      RETURN NEW;
    END IF;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:' || NEW.linked_project_id::text, 0));
  due := coalesce(eflow_schedule.calendar_day(nullif(NEW.deadline, '')),
    eflow_schedule.calendar_day(NEW.due_date));
  IF NEW.start_date IS NOT NULL AND due < NEW.start_date THEN
    RAISE EXCEPTION 'Task due date cannot be before its start date.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION eflow_schedule.guard_web_subtask_plan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare first_day date; last_day date; project_id uuid;
begin
  if tg_op='INSERT' then
    if new.priority<>'medium' and not coalesce(eflow_r7.internal(new.task_id),false) then
      raise exception 'Use the authorized subtask command to set priority.' using errcode='42501';
    end if;
  elsif new.priority is distinct from old.priority and not coalesce(eflow_r7.internal(new.task_id),false) then
    raise exception 'Use the authorized subtask command to edit priority.' using errcode='42501';
  end if;
  if new.parent_subtask_id is not null then
    if tg_op='INSERT' then
      raise exception 'Add subtasks directly to their task.' using errcode='22023';
    elsif new.parent_subtask_id is distinct from old.parent_subtask_id then
      raise exception 'Move subtasks directly to their task.' using errcode='22023';
    end if;
  end if;
  if tg_op='UPDATE' then
    if row(new.start_date,new.due_date) is not distinct from row(old.start_date,old.due_date) then return new; end if;
    if not coalesce(eflow_r7.internal(new.task_id),false)
      and not coalesce(public.can_manage_subtasks(new.task_id,auth.uid()),false) then
      raise exception 'Only the current planning authority can change the subtask schedule.' using errcode='42501';
    end if;
    if nullif(btrim(new.due_date_change_reason),'') is null then
      raise exception 'Enter a reason for the schedule change.' using errcode='22023';
    end if;
  end if;
  select t.linked_project_id, t.start_date,
    coalesce(eflow_schedule.calendar_day(nullif(t.deadline, '')), eflow_schedule.calendar_day(t.due_date))
  into project_id, first_day, last_day
  from public.tasks t
  where t.id=new.task_id;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    case when project_id is null then 'subtask-schedule:'||new.task_id else 'r9:'||project_id end,0));
  if new.start_date is not null and ((project_id is not null and new.due_date is null) or new.start_date>new.due_date)
    or (first_day is not null and least(new.start_date,new.due_date)<first_day)
    or (last_day is not null and greatest(new.start_date,new.due_date)>last_day) then
    raise exception 'Keep the subtask start and due dates within the parent task schedule.' using errcode='22023';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION eflow_schedule.guard_web_subtask_parent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_project_id uuid;
  v_parent_task_id uuid;
  first_day date;
  last_day date;
  conflicting_title text;
BEGIN
  IF tg_table_name = 'projects' THEN
    IF pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1'
       OR ROW(new.start_date, new.target_date)
          IS NOT DISTINCT FROM ROW(old.start_date, old.target_date)
    THEN
      RETURN new;
    END IF;
    v_project_id := new.id;
    first_day := new.start_date;
    last_day := new.target_date;
  ELSE
    IF new.deleted_at IS NOT NULL
       OR ROW(new.start_date, new.deadline, new.due_date, new.linked_project_id)
          IS NOT DISTINCT FROM
          ROW(old.start_date, old.deadline, old.due_date, old.linked_project_id)
    THEN
      RETURN new;
    END IF;
    v_parent_task_id := new.id;
    v_project_id := new.linked_project_id;
    first_day := new.start_date;
    last_day := coalesce(
      eflow_schedule.calendar_day(nullif(new.deadline, '')),
      eflow_schedule.calendar_day(new.due_date)
    );
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      CASE
        WHEN v_project_id IS NULL THEN 'subtask-schedule:' || v_parent_task_id
        ELSE 'r9:' || v_project_id
      END,
      0
    )
  );

  SELECT s.title
  INTO conflicting_title
  FROM public.subtasks s
  JOIN public.tasks t ON t.id = s.task_id
  WHERE t.deleted_at IS NULL
    AND (
      CASE
        WHEN v_parent_task_id IS NULL THEN t.linked_project_id = v_project_id
        ELSE t.id = v_parent_task_id
      END
    )
    AND (
      (first_day IS NOT NULL AND LEAST(s.start_date, s.due_date) < first_day)
      OR (last_day IS NOT NULL AND GREATEST(s.start_date, s.due_date) > last_day)
    )
  ORDER BY s.id
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Reschedule subtask "%" before changing this timeline.',
      conflicting_title
      USING ERRCODE = '22023';
  END IF;

  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_project_metadata_edit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1'
     and row(new.title, new.description, new.priority) is not distinct from row(old.title, old.description, old.priority)
     and old.status not in ('completed', 'archived') then
    return new;
  end if;
  if auth.uid() is not null and row(new.title,new.description,new.priority,new.start_date,new.target_date)
      is distinct from row(old.title,old.description,old.priority,old.start_date,old.target_date) then
    if old.status in ('completed','archived') or not (
      (public.phase2_is_office_head(auth.uid(),old.org_id) and public.can_manage_project(old.id,auth.uid()))
      or (row(new.priority,new.start_date,new.target_date) is not distinct from row(old.priority,old.start_date,old.target_date)
        and eflow_r9.can_edit_selected_project(old.id,old.org_id,auth.uid()))
    ) then raise exception 'Project metadata is read-only for this account or lifecycle' using errcode='42501'; end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION eflow_phase7.guard_project()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare syncing boolean := pg_catalog.current_setting('eflow.syncing_project_schedule', true) = '1';
begin
 if tg_op='UPDATE' and auth.uid() is not null and new.source_collaboration_draft_id is distinct from old.source_collaboration_draft_id then raise exception 'Project governance identity is immutable' using errcode='42501';end if;
 if new.source_collaboration_draft_id is not null then return new;end if;
 if tg_op='INSERT' then
  if new.status='active' then raise exception 'Create the project in Planning, then review readiness' using errcode='22023';end if;
  return new;
 end if;
 if (not syncing or new.description is distinct from old.description)
    and row(new.description,new.start_date,new.target_date) is distinct from row(old.description,old.start_date,old.target_date)
    and old.status='active' then
  new.status:='on_hold';
 end if;
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
end $function$;

CREATE OR REPLACE FUNCTION eflow_schedule.sync_project_timeline(p_project uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_min date;
  v_max date;
  v_status text;
  v_old_start date;
  v_old_end date;
begin
  if p_project is null then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:' || p_project::text, 0));
  select status, start_date, target_date
  into v_status, v_old_start, v_old_end
  from public.projects
  where id = p_project
  for update;
  if not found or v_status in ('completed', 'archived') then return; end if;

  with bounds as (
    select t.start_date as s_day,
           coalesce(eflow_schedule.calendar_day(nullif(t.deadline, '')), eflow_schedule.calendar_day(t.due_date)) as e_day
    from public.tasks t
    where t.linked_project_id = p_project
      and t.deleted_at is null
      and t.status <> 'cancelled'
    union all
    select s.start_date as s_day,
           s.due_date as e_day
    from public.subtasks s
    join public.tasks t on t.id = s.task_id
    where t.linked_project_id = p_project
      and t.deleted_at is null
      and t.status <> 'cancelled'
  ),
  days as (
    select s_day as day from bounds where s_day is not null
    union all
    select e_day as day from bounds where e_day is not null
  )
  select min(day), max(day) into v_min, v_max from days;

  if v_min is null and v_max is null then
    return;
  end if;

  if v_min is distinct from v_old_start or v_max is distinct from v_old_end then
    perform pg_catalog.set_config('eflow.syncing_project_schedule', '1', true);
    update public.projects
    set start_date = v_min,
        target_date = v_max,
        updated_at = clock_timestamp()
    where id = p_project;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION eflow_schedule.on_work_schedule_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_project_id uuid;
  v_prev_project_id uuid;
begin
  if tg_table_name = 'tasks' then
    if tg_op <> 'DELETE' then v_project_id := new.linked_project_id; end if;
    if tg_op <> 'INSERT' then v_prev_project_id := old.linked_project_id; end if;
    if v_project_id is not null then
      perform eflow_schedule.sync_project_timeline(v_project_id);
    end if;
    if v_prev_project_id is not null and v_prev_project_id is distinct from v_project_id then
      perform eflow_schedule.sync_project_timeline(v_prev_project_id);
    end if;
  else
    if tg_op <> 'DELETE' then
      select t.linked_project_id into v_project_id from public.tasks t where t.id = new.task_id;
    end if;
    if tg_op <> 'INSERT' then
      select t.linked_project_id into v_prev_project_id from public.tasks t where t.id = old.task_id;
    end if;
    if v_project_id is not null then
      perform eflow_schedule.sync_project_timeline(v_project_id);
    end if;
    if v_prev_project_id is not null and v_prev_project_id is distinct from v_project_id then
      perform eflow_schedule.sync_project_timeline(v_prev_project_id);
    end if;
  end if;
  return null;
end $function$;

revoke all on function eflow_schedule.sync_project_timeline(uuid), eflow_schedule.on_work_schedule_change() from public, anon, authenticated;

drop trigger if exists zz_sync_project_timeline_from_tasks on public.tasks;
create trigger zz_sync_project_timeline_from_tasks
  after insert or delete or update of linked_project_id, start_date, deadline, due_date, deleted_at, status
  on public.tasks
  for each row
  execute function eflow_schedule.on_work_schedule_change();

drop trigger if exists zz_sync_project_timeline_from_subtasks on public.subtasks;
create trigger zz_sync_project_timeline_from_subtasks
  after insert or delete or update of task_id, start_date, due_date
  on public.subtasks
  for each row
  execute function eflow_schedule.on_work_schedule_change();

-- 3. Enforce Head-authorized project funding inside import_project_pdf_work &
--    support allocating from eflow_project.funding during complete_pdf_import_session.
CREATE OR REPLACE FUNCTION public.import_project_pdf_work(p_project_id uuid, p_request_id uuid, p_review jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare p public.projects; result jsonb; item jsonb; line jsonb; keys text[];seen text[]:='{}';line_keys text[]:='{}';fingerprint text;amount numeric;total numeric:=0;expected numeric;quantity numeric;unit_cost numeric; empty_group uuid; receipt public.project_import_batches; canonical_review jsonb;
 source_group jsonb; source_task jsonb; resolved_groups jsonb:='[]'; mapped_tasks jsonb:='{}'; mapped_groups jsonb:='[]';
 matched_group uuid; matched_task public.tasks; existing_count int:=0; requested_count int:=0; reused_groups int:=0;
 prior_imports_only boolean:=true; source_keys text[]:='{}'; group_names text[]:='{}'; task_names text[]; collision_title text;
 original_hash text;
 authorized_total numeric:=0; already_allocated numeric:=0; remaining_budget numeric:=0;
begin
 select * into p from public.projects where id=p_project_id for update;
 if not found or auth.uid() is null or not public.can_manage_project(p.id,auth.uid()) or not public.can_create_scoped_work(p.org_id,auth.uid()) then
  raise exception 'Only the responsible Office Head can import project work' using errcode='42501';end if;
 select * into receipt from public.project_import_batches where id=p_request_id;
 if found then
  if receipt.project_id<>p.id or receipt.created_by<>auth.uid() then raise exception 'This import reference belongs to another request' using errcode='22023';end if;
  if receipt.review ? 'pdfOriginalReviewHash' then
   if receipt.review->>'pdfOriginalReviewHash' is distinct from encode(sha256(convert_to(p_review::text,'UTF8')),'hex') then
    raise exception 'This import reference was already used for another review' using errcode='22023';end if;
  elsif receipt.review is distinct from p_review then
   raise exception 'This import reference was already used for another review' using errcode='22023';
  end if;
  if coalesce((receipt.result->>'alreadyImported')::boolean,false) then return receipt.result;end if;
  result:=public.phase65_import_project_work(p_project_id,p_request_id,receipt.review);
  if receipt.review ? 'pdfOriginalReviewHash' then
   return result||jsonb_build_object('reusedGroupCount',(select count(*) from jsonb_array_elements(receipt.review->'groups') as saved_group(value) where nullif(saved_group.value->>'existingGroupId','') is not null));
  end if;
  return result;
 end if;
 if p.status in ('completed','archived') then raise exception 'Closed project structure is read-only' using errcode='22023';end if;

 select coalesce(sum(f.amount),0) into authorized_total
 from eflow_project.funding f
 join public.budget_commitments c on c.id=f.commitment_id
 where f.project_id=p.id and f.amount>0 and c.status='active';
 select coalesce(sum(l.amount),0) into already_allocated
 from public.work_budget_allocation_lines l
 join public.work_budget_allocations wa on wa.id=l.allocation_id
 join eflow_project.funding f on f.id=l.project_funding_id
 where f.project_id=p.id and wa.subtask_id is null and wa.status='approved';
 remaining_budget:=greatest(0, authorized_total - already_allocated);

 if p_review ? 'taskBudgets' then
  if jsonb_typeof(p_review->'taskBudgets') is distinct from 'array' or jsonb_array_length(p_review->'taskBudgets')>100
   or jsonb_typeof(p_review->'sourceBudgetTotal') is distinct from 'number' then raise exception 'Invalid source budget' using errcode='22023';end if;
  expected:=(p_review->>'sourceBudgetTotal')::numeric;
  if (expected::text in ('NaN','Infinity','-Infinity') or expected<0 or expected>1000000000000 or expected<>round(expected,2)) then raise exception 'Invalid source budget total' using errcode='22023';end if;
  select array_agg(t->>'key') into keys from jsonb_array_elements(p_review->'groups') g cross join lateral jsonb_array_elements(g->'tasks') t;
  for item in select value from jsonb_array_elements(p_review->'taskBudgets') loop
   if nullif(item->>'key','') is null or not (item->>'key'=any(keys)) or item->>'key'=any(seen)
    or jsonb_typeof(item->'lines') is distinct from 'array' or jsonb_array_length(item->'lines')>500
    or coalesce(item->>'decision','') not in ('funded','missing','no_cost') then raise exception 'Invalid task budget reference' using errcode='22023';end if;
   seen:=array_append(seen,item->>'key');
   if (item->>'decision'='funded') is distinct from (jsonb_array_length(item->'lines')>0) then raise exception 'Funded tasks need source cost lines' using errcode='22023';end if;
   for line in select value from jsonb_array_elements(item->'lines') loop
    if jsonb_typeof(line->'amount') is distinct from 'number' or length(btrim(coalesce(line->>'particular',''))) not between 1 and 2000
     or length(btrim(coalesce(line->>'fundSource',''))) not between 1 and 200 then raise exception 'Invalid source cost line' using errcode='22023';end if;
    if (line ? 'quantity' and jsonb_typeof(line->'quantity') is distinct from 'number') or (line ? 'unitCost' and jsonb_typeof(line->'unitCost') is distinct from 'number') then raise exception 'Invalid source quantity or unit cost' using errcode='22023';end if;
    amount:=(line->>'amount')::numeric;quantity:=coalesce((line->>'quantity')::numeric,1);unit_cost:=coalesce((line->>'unitCost')::numeric,amount);
    if amount<=0 or amount>9999999999 or amount<>round(amount,2) or quantity<=0 or quantity>90071992547409 or quantity<>round(quantity,2) or unit_cost<=0 or unit_cost>9999999999 or unit_cost<>round(unit_cost,2) then raise exception 'Invalid source amount, quantity or unit cost' using errcode='22023';end if;
    if round(coalesce((line->>'quantity')::numeric,1)*coalesce((line->>'unitCost')::numeric,amount),2)<>amount then raise exception 'Source quantity and price do not match the amount' using errcode='22023';end if;
    fingerprint:=jsonb_build_array(line->>'particular',line->>'fundSource',amount)::text;
    if fingerprint=any(line_keys) then raise exception 'A source cost was counted more than once' using errcode='22023';end if;
    line_keys:=array_append(line_keys,fingerprint);total:=total+amount;
   end loop;
  end loop;
  if cardinality(seen) is distinct from cardinality(keys) or total<>expected then raise exception 'Task budgets do not match the source total' using errcode='22023';end if;
  if total>0 then
   if p.funding_not_required or authorized_total<=0 then
    raise exception 'This project has no authorized funding. AI cannot add task budgets.' using errcode='23514';
   end if;
   if total>remaining_budget then
    raise exception 'Task budgets (₱%) exceed remaining Head-authorized project funding (₱%).', total, remaining_budget using errcode='23514';
   end if;
  end if;
 elsif p_review ? 'sourceBudgetTotal' then raise exception 'Source task budgets are missing' using errcode='22023';
 end if;

 if p_request_id is null or p_review ? 'pdfOriginalReviewHash' or p_review->>'schemaVersion' is distinct from '1'
  or jsonb_typeof(p_review->'groups') is distinct from 'array' or jsonb_array_length(p_review->'groups') not between 1 and 30
  or jsonb_typeof(p_review->'offices') is distinct from 'array' or jsonb_array_length(p_review->'offices')>100
  or octet_length(p_review::text)>2000000 then raise exception 'Invalid reviewed project import' using errcode='22023';end if;
 for source_group in select value from jsonb_array_elements(p_review->'groups') loop
  if length(btrim(coalesce(source_group->>'title',''))) not between 1 and 120 or jsonb_typeof(source_group->'tasks') is distinct from 'array'
   or jsonb_array_length(source_group->'tasks') not between 1 and 100 then raise exception 'Each group needs a title and tasks' using errcode='22023';end if;
  if eflow_validation.normalized_work_name(source_group->>'title')=any(group_names) then raise exception 'The PDF contains repeated group names. Use a distinct name for each group.' using errcode='22023';end if;
  group_names:=array_append(group_names,eflow_validation.normalized_work_name(source_group->>'title'));
  matched_group:=nullif(source_group->>'existingGroupId','')::uuid;
  if matched_group is null then
   select g.id into matched_group from public.project_groups g where g.project_id=p.id
    and eflow_validation.normalized_work_name(g.title)=eflow_validation.normalized_work_name(source_group->>'title');
  elsif not exists(select 1 from public.project_groups g where g.id=matched_group and g.project_id=p.id) then
   raise exception 'Choose a group in this project' using errcode='22023';
  end if;
  if matched_group is not null then
   source_group:=jsonb_set(source_group,'{existingGroupId}',to_jsonb(matched_group::text));
   mapped_groups:=mapped_groups||to_jsonb(matched_group::text);reused_groups:=reused_groups+1;
  end if;
  task_names:='{}';
  for source_task in select value from jsonb_array_elements(source_group->'tasks') loop
   requested_count:=requested_count+1;
   if length(coalesce(source_task->>'key','')) not between 1 and 80 or source_task->>'key'=any(source_keys)
    or length(btrim(coalesce(source_task->>'title',''))) not between 1 and 300 then raise exception 'PDF tasks need unique references and valid names' using errcode='22023';end if;
   if eflow_validation.normalized_work_name(source_task->>'title')=any(task_names) then raise exception 'The PDF contains repeated task names in one group. No work was added.' using errcode='22023';end if;
   task_names:=array_append(task_names,eflow_validation.normalized_work_name(source_task->>'title'));
   source_keys:=array_append(source_keys,source_task->>'key');
   select * into matched_task from public.tasks t where (t.group_id=matched_group or (t.group_id is null and t.linked_project_id=p.id and exists(select 1 from public.project_groups g where g.id=matched_group and g.is_default))) and t.deleted_at is null
    and eflow_validation.normalized_work_name(t.title)=eflow_validation.normalized_work_name(source_task->>'title');
   if found then
    existing_count:=existing_count+1;collision_title:=matched_task.title;
    mapped_tasks:=mapped_tasks||jsonb_build_object(source_task->>'key',matched_task.id);
    prior_imports_only:=prior_imports_only and exists(select 1 from public.project_import_batches b
     where b.project_id=p.id and b.id::text=matched_task.import_batch_id
      and nullif(b.review->>'sourceName','') is not null and b.review->>'sourceName'=p_review->>'sourceName');
   end if;
  end loop;
  resolved_groups:=resolved_groups||jsonb_build_array(source_group);
 end loop;
 if requested_count>100 then raise exception 'Import up to 100 tasks at once' using errcode='22023';end if;
 if existing_count=requested_count and prior_imports_only and jsonb_array_length(p_review->'offices')=0
  and not coalesce((p_review->>'applyProjectDetails')::boolean,false) then
  result:=jsonb_build_object('taskCount',0,'subitemCount',0,'groupCount',0,'taskIds',mapped_tasks,'groupIds',mapped_groups,
   'alreadyImported',true,'existingTaskCount',existing_count,'reusedGroupCount',reused_groups);
  insert into public.project_import_batches(id,project_id,created_by,review,result) values(p_request_id,p.id,auth.uid(),p_review,result);
 else
  if existing_count>0 then raise exception 'A task named "%" already exists in this project. No work was added. Open the existing task, or use a new project for a separate copy.',collision_title using errcode='22023';end if;
  original_hash:=encode(sha256(convert_to(p_review::text,'UTF8')),'hex');
  canonical_review:=jsonb_set(p_review,'{groups}',resolved_groups)||jsonb_build_object('pdfOriginalReviewHash',original_hash);
  result:=public.phase65_import_project_work(p_project_id,p_request_id,canonical_review);
  result:=result||jsonb_build_object('reusedGroupCount',reused_groups);
  for item in select value from jsonb_array_elements(coalesce(p_review->'taskBudgets','[]')) loop
   select coalesce(sum((value->>'amount')::numeric),0) into amount from jsonb_array_elements(item->'lines');
   perform public.phase3_patch_task((result->'taskIds'->>(item->>'key'))::uuid,jsonb_build_object('budget_impact',amount));
  end loop;
 end if;
 if requested_count>0 then
  for empty_group in select g.id from public.project_groups g
   where g.project_id=p_project_id and g.is_default
    and not exists(select 1 from public.tasks t where t.deleted_at is null
     and (t.group_id=g.id or (t.group_id is null and t.linked_project_id=g.project_id)))
  loop perform public.delete_empty_project_group(empty_group);end loop;
 end if;
 return result;
end $function$;

CREATE OR REPLACE FUNCTION public.complete_pdf_import_session(p_id uuid, p_revision integer, p_runner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.project_pdf_import_sessions; p public.projects; r jsonb; a jsonb; t jsonb; g jsonb; i uuid; root uuid; snap jsonb;
 assigned integer:=0; offices integer:=0; seen text[]:='{}'; k text;
 alloc jsonb; alloc_line jsonb; src eflow_project.funding; sec public.office_budget_sections; alloc_id uuid;
 alloc_total numeric; line_amt numeric; used_amt numeric; task_row public.tasks;
begin
 select * into s from public.project_pdf_import_sessions where id=p_id;
 if s.id is null or s.actor_id is distinct from auth.uid() then raise exception 'Import session unavailable' using errcode='42501';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r9:'||s.project_id::text,0));
 p:=eflow_phase65.require_lead(s.project_id,auth.uid());
 select * into s from public.project_pdf_import_sessions where id=p_id for update;
 if s.result is not null then return s.result;end if;
 if p_revision is null or s.revision<>p_revision or s.runner is distinct from p_runner or s.lease_until<=now() then raise exception 'Import session changed. Resume it before saving.' using errcode='40001';end if;
 if s.state->>'stage' not in ('ready','saving') or jsonb_typeof(s.state->'review') is distinct from 'object' or jsonb_typeof(coalesce(s.state->'assignments','[]')) is distinct from 'array' then raise exception 'Finish preparing the import first' using errcode='22023';end if;
 r:=public.import_project_pdf_work(p.id,s.id,s.state->'review');
 if not coalesce((r->>'alreadyImported')::boolean,false) then
  for g in select value from jsonb_array_elements(s.state->'review'->'groups') loop
   for t in select value from jsonb_array_elements(g->'tasks') loop
    select (x.identity_ids->>(t->>'officeKey'))::uuid into i from eflow_phase65.import_receipts x where x.batch_id=s.id;
    if i is not null and exists(select 1 from public.project_office_identities where id=i and canonical_office_id is distinct from p.org_id) then
     insert into public.project_office_work(task_id,identity_id,project_id) values((r->'taskIds'->>(t->>'key'))::uuid,i,p.id);
    end if;
   end loop;
  end loop;
  -- Allocate Head-authorized eflow_project.funding to imported tasks cleanly when supplied.
  if jsonb_typeof(s.state->'budgetAllocations') = 'array' and jsonb_array_length(s.state->'budgetAllocations') > 0 then
   if p.funding_not_required then
    raise exception 'This project is set to No funding required. AI cannot allocate task budgets.' using errcode='23514';
   end if;
   for alloc in select value from jsonb_array_elements(s.state->'budgetAllocations') loop
    k:=alloc->>'key';
    root:=(r->'taskIds'->>k)::uuid;
    if root is null then raise exception 'Invalid task budget allocation reference' using errcode='22023'; end if;
    select * into task_row from public.tasks where id=root and deleted_at is null;
    if task_row.id is null or task_row.proposed_office_identity_id is not null then continue; end if;
    alloc_total:=0;
    for alloc_line in select value from jsonb_array_elements(coalesce(alloc->'lines','[]')) loop
     line_amt:=(alloc_line->>'amount')::numeric;
     if line_amt is null or line_amt<=0 or line_amt<>round(line_amt,2) then
      raise exception 'Invalid task funding allocation amount' using errcode='22023';
     end if;
     select * into src from eflow_project.funding where id=(alloc_line->>'sourceId')::uuid and project_id=p.id for update;
     if src.id is null or not exists(select 1 from public.budget_commitments where id=src.commitment_id and status='active') then
      raise exception 'Selected Head-authorized project funding source is unavailable' using errcode='23514';
     end if;
     select coalesce(sum(l.amount),0) into used_amt
     from public.work_budget_allocation_lines l
     join public.work_budget_allocations wa on wa.id=l.allocation_id
     where wa.status='approved' and wa.subtask_id is null and l.project_funding_id=src.id;
     if used_amt + line_amt > src.amount then
      raise exception 'Task allocation (₱%) exceeds remaining authorized balance in source', line_amt using errcode='23514';
     end if;
     select wa.id into alloc_id
     from public.work_budget_allocations wa
     where wa.task_id=root and wa.subtask_id is null and wa.status='approved' and wa.commitment_id=src.commitment_id
     for update limit 1;
     if alloc_id is null then
      insert into public.work_budget_allocations(commitment_id,task_id,amount,status,reason,requested_by,decided_by,decision_reason,decided_at)
       values(src.commitment_id,root,line_amt,'approved','AI import allocated from Head-authorized project funding',auth.uid(),auth.uid(),'Allocated within Head-authorized project funding',now())
       returning id into alloc_id;
     else
      update public.work_budget_allocations set amount=amount+line_amt where id=alloc_id;
     end if;
     select * into sec from public.office_budget_sections where id=src.partition_id;
     insert into public.work_budget_allocation_lines(allocation_id,budget_partition_id,project_funding_id,expense_class,category,particular,quantity,unit,unit_cost,amount,fund_source,position)
      values(alloc_id,sec.id,src.id,'Project allocation',sec.name,coalesce(nullif(btrim(alloc_line->>'particular'),''),task_row.title),1,'allocation',line_amt,line_amt,'Project budget',(select coalesce(max(l.position),-1)+1 from public.work_budget_allocation_lines l where l.allocation_id=alloc_id));
     alloc_total:=alloc_total+line_amt;
    end loop;
    if alloc_total > 0 then
     perform public.phase3_patch_task(root, jsonb_build_object('budget_impact', alloc_total));
    end if;
   end loop;
  end if;
  for a in select value from jsonb_array_elements(coalesce(s.state->'assignments','[]')) loop
   k:=a->>'key';root:=(r->'taskIds'->>k)::uuid;
   if root is null or k=any(seen) then raise exception 'Invalid assignment task reference' using errcode='22023';end if;
   seen:=array_append(seen,k);
   if exists(select 1 from public.tasks where id=root and proposed_office_identity_id is not null) then raise exception 'Office invitations must be accepted before assignment' using errcode='22023';end if;
   snap:=public.r7_work_tree(root);
   perform public.auto_assign_project_task(root,(snap->>'revision')::int,gen_random_uuid(),(a->>'lead')::uuid,
    array(select jsonb_array_elements_text(a->'people'))::uuid[]);
   assigned:=assigned+1;
  end loop;
 end if;
 select count(*) into offices from eflow_phase65.import_receipts x cross join lateral jsonb_each_text(x.identity_ids) z
 join public.project_office_identities q on q.id=z.value::uuid
 where x.batch_id=s.id and q.canonical_office_id is distinct from p.org_id;
 r:=r||jsonb_build_object('assignedTaskCount',assigned,'officeCount',offices,
 'needsPeopleCount',greatest(0,coalesce((r->>'taskCount')::int,0)-assigned));
 update public.project_pdf_import_sessions set result=r,state=state-'sourceText'-'draft'||jsonb_build_object('stage','completed'),
 revision=revision+1,lease_until=null,updated_at=now() where id=s.id;
 return r;
end $function$;

notify pgrst, 'reload schema';
commit;
