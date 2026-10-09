begin;
set local lock_timeout='10s';
create schema if not exists eflow_publication;
revoke all on schema eflow_publication from public,anon,authenticated;

-- Grandfather every existing project, including historical planning projects.
alter table public.projects add column publication_state text not null default 'published' check(publication_state in ('draft','published'));
alter table public.projects alter column publication_state set default 'draft';
alter table public.projects add column published_at timestamptz;
alter table public.projects add column published_by uuid references public.profiles(id) on delete set null;

do $$ declare definition text; begin
 select pg_get_functiondef('eflow_phase7.readiness(uuid)'::regprocedure) into definition;
 execute replace(definition,'FUNCTION eflow_phase7.readiness(', 'FUNCTION eflow_publication.baseline_readiness(');
end $$;
create function eflow_publication.task_date(value text) returns date language plpgsql immutable set search_path='' as $$
begin
 if value is null or btrim(value)='' or value !~ '^\d{4}-\d{2}-\d{2}($|T| )' then return null;end if;
 return left(value,10)::date;
exception when datetime_field_overflow or invalid_datetime_format then return null;
end $$;
create or replace function eflow_phase7.readiness(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.projects; r jsonb; checks jsonb; good boolean; t record;
begin
 r:=eflow_publication.baseline_readiness(p_id);
 select * into p from public.projects where id=p_id;
 if p.publication_state<>'draft' then return r; end if;
 checks:=r->'checks';
 checks:=checks||jsonb_build_array(
  jsonb_build_object('key','project_name','label','Project name filled in','ok',nullif(btrim(p.title),'') is not null,'detail','Enter a project name.'),
  jsonb_build_object('key','project_description','label','Project purpose filled in','ok',nullif(btrim(p.description),'') is not null,'detail','Project description/purpose cannot be blank.'),
  jsonb_build_object('key','project_office','label','Lead Office assigned','ok',p.org_id is not null,'detail','Choose the responsible Lead Office.'),
  jsonb_build_object('key','project_lead','label','Project lead assigned','ok',exists(select 1 from public.profiles u where u.id=p.owner_id and u.org_id=p.org_id and u.is_active and u.role<>'admin'),'detail','Choose an active project lead from the responsible Office.')
 );
 for t in select id,title,start_date,deadline,assigned_to,org_id from public.tasks where linked_project_id=p.id and deleted_at is null and status<>'cancelled' order by id loop
  if nullif(btrim(t.title),'') is null then
   checks:=checks||jsonb_build_array(jsonb_build_object('key','task_name:'||t.id,'label','Task name is missing','ok',false,'detail','Name this task in Main table.'));
  end if;
  if t.assigned_to is null then
   checks:=checks||jsonb_build_array(jsonb_build_object('key','task_owner:'||t.id,'label','Task owner is missing','ok',false,'detail',coalesce(nullif(btrim(t.title),''),'Unnamed task')||': assign an eligible task owner.'));
  end if;
  if t.org_id is null then
   checks:=checks||jsonb_build_array(jsonb_build_object('key','task_office:'||t.id,'label','Responsible Office is missing','ok',false,'detail',coalesce(nullif(btrim(t.title),''),'Unnamed task')||': select its responsible Office.'));
  end if;
  if (nullif(btrim(t.start_date::text),'') is not null and eflow_publication.task_date(t.start_date::text) is null)
   or (nullif(btrim(t.deadline::text),'') is not null and eflow_publication.task_date(t.deadline::text) is null)
   or eflow_publication.task_date(t.deadline::text)<eflow_publication.task_date(t.start_date::text) then
   checks:=checks||jsonb_build_array(jsonb_build_object('key','task_dates:'||t.id,'label','Task dates need fixing','ok',false,'detail',coalesce(nullif(btrim(t.title),''),'Unnamed task')||': enter valid dates; deadline cannot be before its start date.'));
  end if;
 end loop;
 good:=not exists(select 1 from jsonb_array_elements(checks) c where not coalesce((c->>'ok')::boolean,false));
 return r||jsonb_build_object('checks',checks,'ready',good,'canActivate',good and p.status in ('planning','on_hold'),'canPublish',public.phase2_is_office_head(auth.uid(),p.org_id) and public.can_manage_project(p.id,auth.uid()),'stage',case when good then 'Ready to publish' else 'Draft' end);
end $$;

create function eflow_publication.guard_project() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin
 if tg_op='INSERT' then
  if new.source_collaboration_draft_id is null then
   new.publication_state:='draft';new.published_at:=null;new.published_by:=null;new.status:='planning';
  else
   -- Existing governed publication keeps its approved proposal workflow.
   if not public.phase2_is_office_head(auth.uid(),new.org_id) then raise exception 'Only the owning Office Head can publish' using errcode='42501';end if;
   new.publication_state:='published';new.published_at:=now();new.published_by:=auth.uid();
  end if;
  return new;
 end if;
 if old.publication_state='published' and new.publication_state is distinct from old.publication_state then raise exception 'Published projects cannot be moved back into Drafts' using errcode='22023';end if;
 if old.publication_state='draft' and new.publication_state='published' then
  if not public.phase2_is_office_head(auth.uid(),old.org_id) or not public.can_manage_project(old.id,auth.uid()) then raise exception 'Only the owning Office Head can publish' using errcode='42501';end if;
  if row(new.title,new.description,new.org_id,new.owner_id,new.start_date,new.target_date) is distinct from row(old.title,old.description,old.org_id,old.owner_id,old.start_date,old.target_date) then raise exception 'Save project changes before publishing' using errcode='22023';end if;
  r:=eflow_phase7.readiness(old.id);
  if not (r->>'canActivate')::boolean then raise exception 'Cannot publish: required details or reviews are missing' using errcode='22023',detail=(r->'checks')::text;end if;
  new.status:='active';new.published_at:=now();new.published_by:=auth.uid();
  insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project',old.id::text,'project.published',old.org_id,r);
 else
  if row(new.published_at,new.published_by) is distinct from row(old.published_at,old.published_by) then raise exception 'Publication history cannot be edited' using errcode='42501';end if;
  if new.publication_state='draft' and new.status not in ('planning','on_hold','archived') then raise exception 'Publish the draft before starting or completing delivery' using errcode='22023';end if;
 end if;
 return new;
end $$;
create trigger a_project_draft_publication before insert or update on public.projects for each row execute function eflow_publication.guard_project();

create function public.publish_project(p_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) then raise exception 'Only the owning Office Head can publish' using errcode='42501';end if;
 if p.publication_state='published' then return;end if;
 update public.projects set publication_state='published',status='active',updated_at=now() where id=p.id;
end $$;
revoke all on all functions in schema eflow_publication from public,anon,authenticated;
revoke all on function public.publish_project(uuid) from public,anon;
grant execute on function public.publish_project(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
