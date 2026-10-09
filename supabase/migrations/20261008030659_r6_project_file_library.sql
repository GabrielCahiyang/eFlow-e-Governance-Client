-- Additive R6 project-only general documents. Requires R3 and Phase 6.5.
begin;
create schema eflow_r6;
revoke all on schema eflow_r6 from public,anon,authenticated;
grant usage on schema eflow_r6 to authenticated;

create table public.project_library_files (
 id uuid primary key,
 project_id uuid not null,
 project_kind text not null check(project_kind in ('office','personal')),
 -- Historical identity snapshots must not block existing account removal.
 uploader_id uuid not null,
 uploader_name text not null,
 responsible_office_id uuid references public.organizations(id) on delete set null,
 initial_task_id uuid,
 file_name text not null check(length(file_name) between 1 and 200 and file_name !~ '[/\\]'),
 file_size bigint not null check(file_size between 1 and 10485760),
 mime_type text not null check(mime_type in ('application/pdf','text/plain','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_path text generated always as (id::text||'/document') stored unique,
 state text not null default 'pending' check(state in ('pending','ready','removed')),
 created_at timestamptz not null default now(),
 committed_at timestamptz,
 removed_at timestamptz,
 removed_by uuid
);
create index project_library_scope on public.project_library_files(project_id,created_at,id);
create table public.project_library_links (
 file_id uuid not null references public.project_library_files(id),
 task_id uuid not null,
 linked_by uuid not null,
 linked_at timestamptz not null default now(),
 primary key(file_id,task_id)
);
create table public.project_library_events (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null,
 file_id uuid not null references public.project_library_files(id),
 task_id uuid,
 actor_id uuid not null,
 actor_name text not null,
 action text not null check(action in ('uploaded','linked','unlinked','removed')),
 occurred_at timestamptz not null default now()
);
create index project_library_event_scope on public.project_library_events(project_id,task_id,occurred_at,id);
alter table public.project_library_files enable row level security;
alter table public.project_library_links enable row level security;
alter table public.project_library_events enable row level security;
revoke all on public.project_library_files,public.project_library_links from public,anon,authenticated;
grant select on public.project_library_files,public.project_library_links to authenticated;
revoke all on public.project_library_events from public,anon,authenticated;
grant select on public.project_library_events to authenticated;

create function eflow_r6.access(p_project uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and (
 exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.project_access(p.id,p_write) and (not p_write or p.status='active'))
 or exists(select 1 from public.projects p where p.id=p_project and public.can_see_project(p.id,auth.uid())
 and (not p_write or p.status not in ('completed','archived'))
 and exists(select 1 from public.project_offices o join public.organizations org on org.id=o.office_id and org.is_active
 join public.profiles u on u.id=auth.uid() and u.org_id=o.office_id
 where o.project_id=p.id and o.invitation_status='joined' and (not p_write or o.relationship_type in ('lead','collaborating')) and (
 public.phase2_is_office_head(auth.uid(),o.office_id)
 or exists(select 1 from public.project_office_members m where m.project_office_id=o.id and m.user_id=auth.uid())
 or o.relationship_type='lead' and exists(select 1 from public.tasks t where t.linked_project_id=p.id and t.org_id=o.office_id and t.deleted_at is null
 and (t.assigned_to=auth.uid() or auth.uid()=any(coalesce(t.team_member_ids,'{}'::uuid[]))))
 )))
 )
$$;
create function eflow_r6.task_access(p_project uuid,p_task uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select eflow_r6.access(p_project,p_write) and (p_task is null or
 exists(select 1 from public.personal_tasks t join public.personal_projects p on p.id=t.project_id join public.workspaces w on w.id=p.workspace_id
 where t.id=p_task and t.project_id=p_project and (not p_write or t.status<>'done' and (t.lead_id=auth.uid() or w.owner_id=auth.uid())))
 or exists(select 1 from public.tasks t where t.id=p_task and t.linked_project_id=p_project and t.deleted_at is null and public.can_see_task(t.id,auth.uid())
 and (not p_write or t.archived_at is null and t.proposed_office_identity_id is null and t.status not in ('for_review','completed','cancelled')
 and (t.assigned_to=auth.uid() or auth.uid()=any(coalesce(t.team_member_ids,'{}'::uuid[])) or eflow_phase6.head(p_project,t.org_id,auth.uid())))))
$$;
create function eflow_r6.manage(p_file uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_library_files f where f.id=p_file and eflow_r6.access(f.project_id,true) and (
 f.uploader_id=auth.uid() or exists(select 1 from public.personal_projects p where p.id=f.project_id and eflow_r3.personal_owner(p.workspace_id))
 or eflow_phase6.head(f.project_id,f.responsible_office_id,auth.uid())))
$$;
create policy r6_files_read on public.project_library_files for select to authenticated using (
 eflow_r6.access(project_id) and (state='ready' or uploader_id=(select auth.uid())));
create policy r6_links_read on public.project_library_links for select to authenticated using (
 exists(select 1 from public.project_library_files f where f.id=file_id and f.state='ready' and eflow_r6.task_access(f.project_id,task_id)));
create policy r6_events_read on public.project_library_events for select to authenticated using(eflow_r6.task_access(project_id,task_id));
create function eflow_r6.record_event() returns trigger language plpgsql security definer set search_path='' as $$
declare v_file uuid; v_task uuid; v_action text; v_project uuid;
begin
 if auth.uid() is null then raise exception 'File history actor required'; end if;
 if tg_table_name='project_library_links' then
  if tg_op='DELETE' then v_file=old.file_id;v_task=old.task_id;v_action='unlinked';
  else v_file=new.file_id;v_task=new.task_id;v_action='linked';end if;
 else
  v_file=new.id;v_task=new.initial_task_id;
  if old.state='pending' and new.state='ready' then v_action='uploaded';
  elsif old.state<>new.state and new.state='removed' then v_action='removed';else return new;end if;
 end if;
 select project_id into v_project from public.project_library_files where id=v_file;
 insert into public.project_library_events(project_id,file_id,task_id,actor_id,actor_name,action)
 values(v_project,v_file,v_task,auth.uid(),(select full_name from public.profiles where id=auth.uid()),v_action);
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger r6_file_events after update of state on public.project_library_files for each row execute function eflow_r6.record_event();
create trigger r6_link_events after insert or delete on public.project_library_links for each row execute function eflow_r6.record_event();

create function eflow_r6.object_access(p_name text,p_owner text,p_operation text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_library_files f where f.object_path=p_name and (
 p_operation='read' and (f.state='ready' and eflow_r6.access(f.project_id)
 or f.state='pending' and f.uploader_id=auth.uid() and eflow_r6.task_access(f.project_id,f.initial_task_id,true))
 or p_operation='insert' and f.state='pending' and f.uploader_id=auth.uid() and p_owner=auth.uid()::text and eflow_r6.task_access(f.project_id,f.initial_task_id,true)
 or p_operation='delete' and f.state='pending' and f.uploader_id=auth.uid() and p_owner=auth.uid()::text and eflow_r6.access(f.project_id,true)
 ))
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('project-library','project-library',false,10485760,array['application/pdf','text/plain','image/png','image/jpeg','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
create policy r6_library_read on storage.objects for select to authenticated using(bucket_id='project-library' and eflow_r6.object_access(name,owner_id,'read'));
create policy r6_library_read_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'project-library' or eflow_r6.object_access(name,owner_id,'read'));
create policy r6_library_insert on storage.objects for insert to authenticated with check(bucket_id='project-library' and eflow_r6.object_access(name,owner_id,'insert'));
create policy r6_library_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'project-library' or eflow_r6.object_access(name,owner_id,'insert'));
create policy r6_library_no_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'project-library') with check(bucket_id<>'project-library');
create policy r6_library_delete on storage.objects for delete to authenticated using(bucket_id='project-library' and eflow_r6.object_access(name,owner_id,'delete'));
create policy r6_library_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'project-library' or eflow_r6.object_access(name,owner_id,'delete'));

create function eflow_r6.list_files(p_project uuid,p_task uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(eflow_r6.task_access(p_project,p_task),false) then raise exception 'Project file access denied' using errcode='42501'; end if;
 return jsonb_build_object('can_write',eflow_r6.task_access(p_project,p_task,true),'files',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object(
 'linked',exists(select 1 from public.project_library_links l where l.file_id=f.id and l.task_id=p_task),
 'links',(select count(*) from public.project_library_links l where l.file_id=f.id),
 'can_remove',eflow_r6.manage(f.id),
 'link',(select to_jsonb(l) from public.project_library_links l where l.file_id=f.id and l.task_id=p_task)) order by f.created_at desc,f.id)
 from public.project_library_files f where f.project_id=p_project and f.state='ready'),'[]'::jsonb));
end $$;
create function eflow_r6.command(p_project uuid,p_task uuid,p_command text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f public.project_library_files; v_id uuid=(p_payload->>'id')::uuid; v_kind text; v_object storage.objects;
begin
 -- Lock the current project before checking closure and task authority.
 perform 1 from public.projects where id=p_project for update;
 perform 1 from public.personal_projects where id=p_project for update;
 if p_task is not null then
  perform 1 from public.tasks where id=p_task for update;
  perform 1 from public.personal_tasks where id=p_task for update;
 end if;
 if not coalesce(eflow_r6.task_access(p_project,p_task,true),false) then raise exception 'Project file write denied or work closed' using errcode='42501'; end if;
 if p_command='reserve' then
  v_kind=case when exists(select 1 from public.personal_projects where id=p_project) then 'personal' else 'office' end;
  insert into public.project_library_files(id,project_id,project_kind,uploader_id,uploader_name,responsible_office_id,initial_task_id,file_name,file_size,mime_type,sha256)
  values(v_id,p_project,v_kind,auth.uid(),(select full_name from public.profiles where id=auth.uid()),case when v_kind='office' then (select org_id from public.profiles where id=auth.uid()) end,p_task,
   trim(p_payload->>'name'),(p_payload->>'size')::bigint,p_payload->>'type',p_payload->>'sha256') on conflict(id) do nothing;
 end if;
 select * into f from public.project_library_files where id=v_id and project_id=p_project for update;
 if f.id is null or f.state='removed' then raise exception 'File unavailable'; end if;
 if p_command='reserve' then
  if f.uploader_id<>auth.uid() or f.initial_task_id is distinct from p_task or f.file_name<>trim(p_payload->>'name') or f.file_size<>(p_payload->>'size')::bigint
   or f.mime_type<>p_payload->>'type' or f.sha256<>p_payload->>'sha256' then raise exception 'Upload identity conflict'; end if;
 elsif p_command='commit' then
  if f.uploader_id<>auth.uid() or f.initial_task_id is distinct from p_task then raise exception 'Upload access denied'; end if;
  select * into v_object from storage.objects where bucket_id='project-library' and name=f.object_path;
  if v_object.id is null then return to_jsonb(f); end if;
  if v_object.owner_id<>auth.uid()::text or (v_object.metadata->>'size')::bigint is distinct from f.file_size or v_object.metadata->>'mimetype' is distinct from f.mime_type then raise exception 'Stored file metadata conflict'; end if;
  update public.project_library_files set state='ready',committed_at=coalesce(committed_at,now()) where id=f.id returning * into f;
  if p_task is not null then insert into public.project_library_links(file_id,task_id,linked_by) values(f.id,p_task,auth.uid()) on conflict do nothing; end if;
 elsif p_command='link' then
  if f.state<>'ready' or p_task is null then raise exception 'Choose a ready project file and task'; end if;
  insert into public.project_library_links(file_id,task_id,linked_by) values(f.id,p_task,auth.uid()) on conflict do nothing;
 elsif p_command='unlink' then
  if p_task is null then raise exception 'Task required'; end if;
  delete from public.project_library_links where file_id=f.id and task_id=p_task;
 elsif p_command='remove' then
  if not eflow_r6.manage(f.id) then raise exception 'File removal denied' using errcode='42501'; end if;
  if exists(select 1 from public.project_library_links where file_id=f.id) then raise exception 'Unlink this document from its tasks before removing it from the library'; end if;
  update public.project_library_files set state='removed',removed_at=now(),removed_by=auth.uid() where id=f.id returning * into f;
 else raise exception 'Unknown file command'; end if;
 return to_jsonb(f);
end $$;
-- Public invoker adapters expose only the checked private implementations.
create function public.r6_list_project_files(p_project uuid,p_task uuid default null) returns jsonb language sql security invoker set search_path='' as $$select eflow_r6.list_files(p_project,p_task)$$;
create function public.r6_project_file_command(p_project uuid,p_task uuid,p_command text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select eflow_r6.command(p_project,p_task,p_command,p_payload)$$;
revoke all on all functions in schema eflow_r6 from public,anon,authenticated;
grant execute on function eflow_r6.access(uuid,boolean),eflow_r6.task_access(uuid,uuid,boolean),eflow_r6.object_access(text,text,text),eflow_r6.list_files(uuid,uuid),eflow_r6.command(uuid,uuid,text,jsonb) to authenticated;
revoke all on function public.r6_list_project_files(uuid,uuid),public.r6_project_file_command(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.r6_list_project_files(uuid,uuid),public.r6_project_file_command(uuid,uuid,text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
