alter table public.project_office_members add column can_edit boolean not null default false;

create function eflow_r9.guard_project_editor_flag() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.can_edit then raise exception 'Save editing access through Add People.' using errcode='42501'; end if;
  elsif new.can_edit is distinct from old.can_edit and current_user in ('anon','authenticated') then
    raise exception 'Save editing access through Add People.' using errcode='42501';
  end if;
  if new.access_ended_at is not null then new.can_edit:=false; end if;
  return new;
end $$;
revoke all on function eflow_r9.guard_project_editor_flag() from public,anon,authenticated;
create trigger project_editor_flag_guard before insert or update of can_edit,access_ended_at
  on public.project_office_members for each row execute function eflow_r9.guard_project_editor_flag();

create function eflow_r9.can_edit_selected_project(p_project uuid,p_office uuid,p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select eflow_r3.eligible(p_user) and eflow_r9.open(p_project)
    and eflow_r9.allowed(p_project,p_user,p_office)
    and exists (
      select 1 from public.project_offices o
      join public.project_office_members m on m.project_office_id=o.id
      join public.profiles u on u.id=m.user_id and u.org_id=o.office_id
      where o.project_id=p_project and o.office_id=p_office
        and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating')
        and m.user_id=p_user and m.can_edit
    )
$$;
revoke all on function eflow_r9.can_edit_selected_project(uuid,uuid,uuid) from public,anon,authenticated;

create function eflow_r9.save_project_team_edits(p_office uuid,p_users uuid[],p_editors uuid[],p_fingerprint text,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.project_offices; receipt eflow_r9.receipts; result jsonb;
  payload jsonb := jsonb_build_array('project_team_edit',p_office,p_users,p_editors,p_fingerprint);
begin
  perform eflow_r3.actor();
  select * into o from public.project_offices where id=p_office;
  if not found then raise exception 'Project team unavailable.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('r9:'||o.project_id::text,0));
  select * into o from public.project_offices where id=p_office;
  if not found or not coalesce(eflow_r9.person_head(o.project_id,o.office_id),false)
    or not eflow_r9.open(o.project_id) or o.invitation_status<>'joined'
    or o.relationship_type not in ('lead','collaborating') then
    raise exception 'Only the appointed Head can change editing access for this project team.' using errcode='42501';
  end if;
  if p_request is null or p_editors is null or p_users is null or array_position(p_editors,null) is not null
     or cardinality(p_editors)>200 or not p_editors <@ p_users then
    raise exception 'Choose editors from the selected project team.' using errcode='22023';
  end if;
  select * into receipt from eflow_r9.receipts where actor=auth.uid() and request=p_request;
  if found then
    if receipt.payload is distinct from payload then raise exception 'Request ID reused.' using errcode='22023'; end if;
    return receipt.result;
  end if;
  result := eflow_r9.select_members(p_office,p_users,p_fingerprint,md5('project_team_edit:'||p_request::text)::uuid);
  update public.project_office_members set can_edit=user_id=any(p_editors)
    where project_office_id=p_office and user_id=any(p_users) and can_edit is distinct from (user_id=any(p_editors));
  insert into eflow_r9.receipts values(auth.uid(),p_request,payload,result);
  return result;
end $$;
create function public.save_project_team_edit_access(p_office uuid,p_users uuid[],p_editors uuid[],p_fingerprint text,p_request uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select eflow_r9.save_project_team_edits(p_office,p_users,p_editors,p_fingerprint,p_request)
$$;

-- Reuse the established task planner's validation in the private editor path.
-- The public Head command and its grants are unchanged.
do $$
declare d text; original text := 'if not found or not public.can_create_scoped_work(t.org_id,auth.uid()) or not (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid())) or not public.can_manage_task(t.id,auth.uid()) then';
begin
  d:=pg_get_functiondef('public.phase3_patch_task(uuid,jsonb)'::regprocedure);
  if strpos(d,original)=0 then raise exception 'Unexpected task planner definition. Review before deploying editor access.'; end if;
  d:=replace(d,'FUNCTION public.phase3_patch_task(','FUNCTION eflow_r9.edit_selected_project_task(');
  d:=replace(d,'LANGUAGE plpgsql','LANGUAGE plpgsql SECURITY DEFINER');
  d:=replace(d,'select * into p from eflow_phase6.lock_project(t.linked_project_id);',
    'perform pg_advisory_xact_lock(hashtextextended(''r9:''||t.linked_project_id::text,0));
     select * into p from public.projects where id=t.linked_project_id for update;');
  d:=replace(d,original,'if not found or t.proposed_office_identity_id is not null or not coalesce(eflow_r9.can_edit_selected_project(p.id,t.org_id,auth.uid()),false) then');
  d:=replace(d,'Only the responsible Office Head can edit project structure','Editing access for this project task is required.');
  d:=replace(d,'select * into t from public.tasks where id=p_task_id for update;',
    'select * into t from public.tasks x where x.id=p_task_id and x.linked_project_id=p.id
      and x.org_id=t.org_id and x.proposed_office_identity_id is null and x.deleted_at is null for update;
     if not found then raise exception ''Task access changed. Reopen the project.'' using errcode=''42501''; end if;');
  d:=replace(d,'t.status in (''completed'',''cancelled'')','t.status in (''for_review'',''completed'',''cancelled'')');
  d:=replace(d,'k not in (''title'',''priority'',''deadline'',''start_date'',''estimated_hours'',''budget_impact'',''dependency_ids'',''group_id'',''workspace_position'')',
    'k not in (''title'',''priority'',''deadline'',''start_date'',''estimated_hours'')');
  execute d;
end $$;
create function public.edit_selected_project_task(p_task_id uuid,p_patch jsonb)
returns public.tasks language sql security invoker set search_path='' as $$
  select eflow_r9.edit_selected_project_task(p_task_id,p_patch)
$$;
do $$
declare d text; original text := 'elsif not eflow_phase6.work(t.id,actor) and not';
begin
  d:=pg_get_functiondef('public.phase6_guard_task()'::regprocedure);
  if strpos(d,original)=0 then raise exception 'Unexpected shared task guard definition.'; end if;
  execute replace(d,original,$guard$elsif not eflow_phase6.work(t.id,actor)
    and not (tg_op='UPDATE' and coalesce(eflow_r9.can_edit_selected_project(p.id,t.org_id,actor),false)
      and (to_jsonb(new)-array['title','priority','deadline','due_date','start_date','estimated_hours','updated_at'])
        =(to_jsonb(old)-array['title','priority','deadline','due_date','start_date','estimated_hours','updated_at']))
    and not$guard$);
end $$;

create or replace function public.guard_project_metadata_edit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and row(new.title,new.description,new.priority,new.start_date,new.target_date)
      is distinct from row(old.title,old.description,old.priority,old.start_date,old.target_date) then
    if old.status in ('completed','archived') or not (
      (public.phase2_is_office_head(auth.uid(),old.org_id) and public.can_manage_project(old.id,auth.uid()))
      or (row(new.priority,new.start_date,new.target_date) is not distinct from row(old.priority,old.start_date,old.target_date)
        and eflow_r9.can_edit_selected_project(old.id,old.org_id,auth.uid()))
    ) then raise exception 'Project metadata is read-only for this account or lifecycle' using errcode='42501'; end if;
  end if;
  return new;
end $$;
create function eflow_r9.rename_selected_project(p_project uuid,p_expected timestamptz,p_title text)
returns public.projects language plpgsql security definer set search_path='' as $$
declare p public.projects; name text := btrim(p_title);
begin
  perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project::text,0));
  select * into p from public.projects where id=p_project for update;
  if not found or not coalesce(eflow_r9.can_edit_selected_project(p.id,p.org_id,auth.uid()),false) then
    raise exception 'Editing access for this project is required.' using errcode='42501';
  end if;
  if p.updated_at is distinct from p_expected then raise exception 'The project changed. Review its current name before saving.' using errcode='40001'; end if;
  if name is null or length(name) not between 1 and 200 then raise exception 'Enter a project name up to 200 characters.' using errcode='22023'; end if;
  update public.projects set title=name where id=p_project returning * into p;
  return p;
end $$;
create function public.rename_selected_project(p_project uuid,p_expected timestamptz,p_title text)
returns public.projects language sql security invoker set search_path='' as $$
  select eflow_r9.rename_selected_project(p_project,p_expected,p_title)
$$;
revoke all on function eflow_r9.save_project_team_edits(uuid,uuid[],uuid[],text,uuid),
  public.save_project_team_edit_access(uuid,uuid[],uuid[],text,uuid),
  eflow_r9.edit_selected_project_task(uuid,jsonb),public.edit_selected_project_task(uuid,jsonb),
  eflow_r9.rename_selected_project(uuid,timestamptz,text),public.rename_selected_project(uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function eflow_r9.save_project_team_edits(uuid,uuid[],uuid[],text,uuid),
  public.save_project_team_edit_access(uuid,uuid[],uuid[],text,uuid),
  eflow_r9.edit_selected_project_task(uuid,jsonb),public.edit_selected_project_task(uuid,jsonb),
  eflow_r9.rename_selected_project(uuid,timestamptz,text),public.rename_selected_project(uuid,timestamptz,text) to authenticated;

create table public.project_field_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid,
  title text not null,
  detail text not null,
  actor_name text not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index project_field_history_project on public.project_field_history(project_id,occurred_at desc);
alter table public.project_field_history enable row level security;
revoke all on public.project_field_history from public,anon,authenticated;
grant select on public.project_field_history to authenticated;
create policy project_field_history_read on public.project_field_history for select to authenticated
  using (public.can_see_project(project_id,(select auth.uid()))
    and (task_id is null or public.can_see_task(task_id,(select auth.uid()))));

create function eflow_r9.record_project_field_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb:=to_jsonb(old); current_row jsonb:=to_jsonb(new);
  project uuid; task uuid; fields text[]; event_title text; changes text;
  actor_name text:=coalesce((select full_name from public.profiles where id=auth.uid()),'System');
begin
  if tg_table_name='project_office_members' then
    if coalesce(new.can_edit,false)=coalesce(old.can_edit,false) then return new; end if;
    select project_id into project from public.project_offices where id=new.project_office_id;
    select full_name into changes from public.profiles where id=new.user_id;
    event_title:=case when new.can_edit then 'Project editing access granted' else 'Project editing access removed' end;
  else
    if tg_table_name='projects' then
      project:=new.id;
      fields:=array['title','description','scope','priority','start_date','target_date','status','project_lead_id'];
      event_title:='Project details changed · '||new.title;
    else
      project:=new.linked_project_id;
      task:=new.id;
      fields:=array['title','description','priority','start_date','deadline','estimated_hours','group_id','deleted_at','archived_at'];
      event_title:='Task details changed · '||new.title;
    end if;
    select string_agg(initcap(replace(field,'_',' '))||': '||
      coalesce(nullif(previous->>field,''),'None')||' → '||coalesce(nullif(current_row->>field,''),'None'),E'\n')
      into changes from unnest(fields) field where previous->field is distinct from current_row->field;
  end if;
  if project is not null and changes is not null then
    insert into public.project_field_history(project_id,task_id,title,detail,actor_name)
      values(project,task,event_title,changes,actor_name);
  end if;
  return new;
end $$;
revoke all on function eflow_r9.record_project_field_history() from public,anon,authenticated;
create trigger project_field_history_project after update on public.projects
  for each row execute function eflow_r9.record_project_field_history();
create trigger project_field_history_task after update on public.tasks
  for each row execute function eflow_r9.record_project_field_history();
create trigger project_field_history_edit_access after update of can_edit on public.project_office_members
  for each row execute function eflow_r9.record_project_field_history();

do $$
declare existing text:=rtrim(pg_get_viewdef('eflow_r11.events'::regclass,true),E'; \n\r');
begin
  execute 'create or replace view eflow_r11.events with (security_invoker=true) as '||existing||
    ' union all select h.project_id,''project-change:''||h.id,''project''::text,h.title,h.detail,h.actor_name,
       h.occurred_at,h.task_id,null::jsonb from public.project_field_history h';
end $$;
