-- Resumable, actor-scoped PDF preparation; atomic publication and project-only office guests.
create table public.project_pdf_import_sessions(
 id uuid primary key, project_id uuid not null references public.projects(id) on delete cascade,
 actor_id uuid not null references public.profiles(id), revision integer not null default 1,
 state jsonb not null default '{}', result jsonb, runner uuid, lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint pdf_session_state_size check(octet_length(state::text)<=3000000)
);
alter table public.project_pdf_import_sessions enable row level security;
grant select on public.project_pdf_import_sessions to authenticated;
revoke all on public.project_pdf_import_sessions from anon;
create policy pdf_session_own_read on public.project_pdf_import_sessions for select to authenticated
 using(actor_id=(select auth.uid()) and public.can_manage_project(project_id,(select auth.uid())));
create unique index one_pending_pdf_import on public.project_pdf_import_sessions(project_id,actor_id)
 where result is null and coalesce(state->>'stage','')<>'discarded';

create table public.project_office_people(
 request_id uuid primary key references public.project_invitation_requests(id) on delete cascade,
 identity_id uuid not null references public.project_office_identities(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 participation_role text not null check(participation_role in ('representative','employee')),
 created_at timestamptz not null default now()
);
create index project_office_people_identity on public.project_office_people(identity_id);
alter table public.project_office_people enable row level security;
grant select on public.project_office_people to authenticated;
create policy project_office_people_read on public.project_office_people for select to authenticated
 using(public.can_manage_project(project_id,(select auth.uid())) or exists(
 select 1 from public.project_invitation_requests r where r.id=request_id and r.accepted_by=(select auth.uid())));

create table public.project_office_work(
 task_id uuid primary key references public.tasks(id) on delete cascade,
 identity_id uuid not null references public.project_office_identities(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade
);
create index project_office_work_identity on public.project_office_work(identity_id);
alter table public.project_office_work enable row level security;
grant select on public.project_office_work to authenticated;
create policy project_office_work_read on public.project_office_work for select to authenticated
 using(public.can_see_project(project_id,(select auth.uid())));
-- No direct writes: the canonical import and invitation commands own these mappings.
revoke insert,update,delete on public.project_office_people,public.project_office_work from public,anon,authenticated;

create function public.save_pdf_import_session(p_id uuid,p_project uuid,p_revision integer,p_runner uuid,p_state jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.project_pdf_import_sessions;p public.projects;
begin
 p:=eflow_phase65.require_lead(p_project,auth.uid());
 if p.status in ('completed','archived') then raise exception 'This project is read-only' using errcode='22023';end if;
 if p_runner is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>3000000
 or coalesce(p_state->>'stage','') not in ('reading','preparing','offices','review_offices','staffing','ready','saving','failed','discarded') then raise exception 'Invalid import checkpoint' using errcode='22023';end if;
 select * into s from public.project_pdf_import_sessions where id=p_id for update;
 if not found then
  if p_revision<>0 then raise exception 'Import session changed. Reopen the import.' using errcode='40001';end if;
  insert into public.project_pdf_import_sessions(id,project_id,actor_id,state,runner,lease_until)
   values(p_id,p_project,auth.uid(),p_state,p_runner,now()+interval '90 seconds') returning * into s;
 else
  if s.project_id<>p_project or s.actor_id<>auth.uid() then raise exception 'Import session unavailable' using errcode='42501';end if;
  if s.result is not null then return to_jsonb(s);end if;
  if s.revision<>p_revision or s.runner is distinct from p_runner and s.lease_until>now() then raise exception 'This import is open elsewhere. Wait briefly and resume it.' using errcode='40001';end if;
  update public.project_pdf_import_sessions set state=p_state,revision=revision+1,runner=p_runner,
   lease_until=now()+interval '90 seconds',updated_at=now() where id=s.id returning * into s;
 end if;
 return to_jsonb(s);
end $$;

create function public.touch_pdf_import_session(p_id uuid,p_runner uuid,p_release boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.project_pdf_import_sessions set lease_until=case when p_release then now() else now()+interval '90 seconds' end
 where id=p_id and actor_id=auth.uid() and runner=p_runner and result is null
 and public.can_manage_project(project_id,auth.uid());
 if not found then raise exception 'Import session is no longer available' using errcode='42501';end if;
end $$;

-- Service-only context for Qwen before tasks exist. Uses the same canonical candidate rules.
create function public.pdf_import_available_people(p_project uuid,p_actor uuid)
returns table(id uuid,full_name text) language plpgsql security definer set search_path='' as $$
declare p public.projects;
begin
 p:=eflow_phase65.require_lead(p_project,p_actor);
 return query select q.id,q.full_name from public.profiles q where q.is_active and q.role<>'admin'
 and ((q.org_id=p.org_id and eflow_r9.allowed(p.id,q.id,p.org_id)) or eflow_r7.member(p.id,p.org_id,q.id))
 order by q.full_name,q.id;
end $$;
revoke all on function public.pdf_import_available_people(uuid,uuid) from public,anon,authenticated;
grant execute on function public.pdf_import_available_people(uuid,uuid) to service_role;

create function public.complete_pdf_import_session(p_id uuid,p_revision integer,p_runner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.project_pdf_import_sessions;p public.projects;r jsonb;a jsonb;t jsonb;g jsonb;i uuid;root uuid;snap jsonb;
 assigned integer:=0;offices integer:=0;seen text[]:='{}';k text;
begin
 select * into s from public.project_pdf_import_sessions where id=p_id for update;
 if s.id is null or s.actor_id is distinct from auth.uid() then raise exception 'Import session unavailable' using errcode='42501';end if;
 p:=eflow_phase65.require_lead(s.project_id,auth.uid());
 if s.result is not null then return s.result;end if;
 if s.revision<>p_revision or s.runner is distinct from p_runner or s.lease_until<=now() then raise exception 'Import session changed. Resume it before saving.' using errcode='40001';end if;
 if s.state->>'stage' not in ('ready','saving') or jsonb_typeof(s.state->'review')<>'object' then raise exception 'Finish preparing the import first' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||p.id::text,0));
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
end $$;

-- Project-only invitations: the lead Head sponsors both representatives and employees.
create function public.invite_project_office_person(p_id uuid,p_identity uuid,p_email text,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.project_office_identities;p public.projects;r jsonb;previous public.project_office_people;
begin
 select * into i from public.project_office_identities where id=p_identity for update;
 p:=eflow_phase65.require_lead(i.project_id,auth.uid());
 if i.id is null or i.relationship_type='lead' or i.provenance->>'removed'='true' or p.status in ('completed','archived')
 or p_role not in ('representative','employee') then raise exception 'Choose an available project Office and invitation type' using errcode='22023';end if;
 select * into previous from public.project_office_people where request_id=p_id;
 if found and (previous.identity_id<>i.id or previous.participation_role<>p_role) then raise exception 'This invitation was already used with other details' using errcode='22023';end if;
 r:=eflow_r8.submit(p_id,p.id,null,null,p.org_id,p_email,'Project Office: '||i.display_name,'{}'::text[],'Other',null,true);
 insert into public.project_office_people(request_id,identity_id,project_id,participation_role) values(p_id,i.id,p.id,p_role) on conflict do nothing;
 if r->>'state'='pending' then r:=eflow_r8.decide(p_id,(r->>'revision')::int,'approved');end if;
 return r;
end $$;

-- Acceptance activates only the sponsoring project's guest membership.
create function eflow_phase65.activate_project_office_person()
returns trigger language plpgsql security definer set search_path='' as $$
declare person public.project_office_people;i public.project_office_identities;
begin
 if new.state<>'accepted' or old.state='accepted' then return new;end if;
 select * into person from public.project_office_people where request_id=new.id;
 if not found then return new;end if;
 select * into i from public.project_office_identities where id=person.identity_id;
 if i.provenance->>'removed'='true' then raise exception 'This Office was removed from the project' using errcode='42501';end if;
 update public.project_office_identities set contact_status='accepted',contact_user_id=coalesce(contact_user_id,new.accepted_by),
 contact_email=case when contact_email='' then new.email else contact_email end,updated_at=now() where id=i.id;
 -- Existing canonical directory invitations retain their own handover workflow.
 if i.canonical_office_id is null then
  update public.tasks set proposed_office_identity_id=null where proposed_office_identity_id=i.id
   and deleted_at is null and status='pending_assignment' and assigned_to is null;
 end if;
 return new;
end $$;
create trigger project_office_person_accepted after update of state on public.project_invitation_requests
 for each row execute function eflow_phase65.activate_project_office_person();
revoke all on function eflow_phase65.activate_project_office_person() from public,anon,authenticated;

-- Once a named Office has joined, recommend only its accepted, still-active project people.
create function eflow_phase65.office_candidate(p_root uuid,p_person uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.project_office_work where task_id=p_root)
 or exists(select 1 from public.project_office_work w join public.project_office_people o on o.identity_id=w.identity_id
 join public.project_invitation_requests r on r.id=o.request_id
 join public.project_guest_members m on m.request_id=r.id and m.user_id=r.accepted_by
 where w.task_id=p_root and r.state='accepted' and r.accepted_by=p_person
 and m.ended_at is null and (m.access_end is null or m.access_end>now())
 and eflow_r7.member(w.project_id,m.office_id,p_person))
$$;
revoke all on function eflow_phase65.office_candidate(uuid,uuid) from public,anon,authenticated;
-- Replace no existing authority: add the Office association restriction to candidate lookup.
create or replace function public.project_ai_available_people(p_root uuid,p_actor uuid)
returns table(id uuid,full_name text) language plpgsql security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);
begin
 if r is null or r->>'kind'<>'office' or not coalesce(eflow_phase6.head((r->>'project')::uuid,(r->>'office')::uuid,p_actor),false) then raise exception 'Responsible Head required' using errcode='42501';end if;
 return query select p.id,p.full_name from public.profiles p where p.is_active and p.role<>'admin'
 and ((p.org_id=(r->>'office')::uuid and eflow_r9.allowed((r->>'project')::uuid,p.id,(r->>'office')::uuid))
 or eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id))
 and eflow_phase65.office_candidate(p_root,p.id) order by p.full_name,p.id;
end $$;

revoke all on function public.save_pdf_import_session(uuid,uuid,integer,uuid,jsonb),
 public.touch_pdf_import_session(uuid,uuid,boolean),public.complete_pdf_import_session(uuid,integer,uuid),
 public.invite_project_office_person(uuid,uuid,text,text) from public,anon;
grant execute on function public.save_pdf_import_session(uuid,uuid,integer,uuid,jsonb),
 public.touch_pdf_import_session(uuid,uuid,boolean),public.complete_pdf_import_session(uuid,integer,uuid),
 public.invite_project_office_person(uuid,uuid,text,text) to authenticated;
