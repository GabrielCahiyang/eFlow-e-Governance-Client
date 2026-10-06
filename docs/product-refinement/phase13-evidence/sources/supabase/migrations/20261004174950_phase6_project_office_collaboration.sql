-- Phase 6: project access never changes a person's global role or Office.
begin;
set local lock_timeout='10s';
create schema if not exists eflow_phase6;
revoke all on schema eflow_phase6 from public,anon;
grant usage on schema eflow_phase6 to authenticated,service_role;

create table public.project_offices (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 office_id uuid not null references public.organizations(id),
 relationship_type text not null check(relationship_type in ('lead','collaborating','observer')),
 invitation_status text not null default 'pending' check(invitation_status in ('pending','awaiting_head','joined','revoked')),
 contact_email text not null default '',
 contact_user_id uuid references public.profiles(id),
 joined_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(project_id,office_id)
);
create unique index project_offices_one_lead on public.project_offices(project_id) where relationship_type='lead';
create index project_offices_office on public.project_offices(office_id,invitation_status,project_id);
create index project_offices_contact on public.project_offices(contact_user_id) where contact_user_id is not null;
create table public.project_office_members (
 project_office_id uuid not null references public.project_offices(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 selected_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 primary key(project_office_id,user_id)
);
create index project_office_members_user on public.project_office_members(user_id,project_office_id);
alter table public.project_offices enable row level security;
alter table public.project_office_members enable row level security;
revoke all on public.project_offices,public.project_office_members from public,anon,authenticated;
grant select on public.project_offices,public.project_office_members to authenticated;
grant all on public.project_offices,public.project_office_members to service_role;

alter table public.user_invitations drop constraint user_invitations_invitation_type_check;
alter table public.user_invitations add constraint user_invitations_invitation_type_check check(invitation_type in ('office_member','project_office'));
alter table public.user_invitations add column project_office_id uuid references public.project_offices(id) on delete cascade;
alter table public.user_invitations add constraint invitation_project_scope check((invitation_type='project_office')=(project_office_id is not null));
drop index public.user_invitations_one_pending;
create unique index user_invitations_one_pending on public.user_invitations(email_normalized,office_id) where status='pending' and invitation_type='office_member';
create unique index user_invitations_project_pending on public.user_invitations(project_office_id) where status='pending' and invitation_type='project_office';
create index user_invitations_project_office on public.user_invitations(project_office_id,created_at desc) where project_office_id is not null;

-- Preserve the previous functions verbatim, including governed collaboration.
do $$ declare n text; d text; begin
 foreach n in array array['can_see_project','can_manage_task','can_contribute_task'] loop
  select pg_get_functiondef(oid) into strict d from pg_proc where pronamespace='public'::regnamespace and proname=n;
  execute replace(d,'FUNCTION public.'||n||'(','FUNCTION eflow_phase6.baseline_'||n||'(');
 end loop;
end $$;
revoke all on all functions in schema eflow_phase6 from public,anon,authenticated;

create function eflow_phase6.shared(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_offices where project_id=p_project and relationship_type<>'lead');
$$;
create function eflow_phase6.head(p_project uuid,p_office uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.phase2_is_office_head(p_user,p_office) and exists(select 1 from public.project_offices o
 where o.project_id=p_project and o.office_id=p_office and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating'));
$$;
create function eflow_phase6.access(p_project uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_user and p.is_active and p.role<>'admin') and exists(
 select 1 from public.project_offices o where o.project_id=p_project and o.invitation_status<>'revoked' and (
  o.contact_user_id=p_user and o.invitation_status in ('awaiting_head','joined')
  or public.phase2_is_office_head(p_user,o.office_id)
  or o.invitation_status='joined' and exists(select 1 from public.project_office_members m join public.profiles p on p.id=m.user_id
    where m.project_office_id=o.id and m.user_id=p_user and p.org_id=o.office_id and p.is_active)));
$$;
create function eflow_phase6.work(p_task uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t join public.project_offices o on o.project_id=t.linked_project_id and o.office_id=t.org_id
 join public.profiles p on p.id=p_user and p.is_active and p.org_id=t.org_id and p.role<>'admin'
 where t.id=p_task and t.deleted_at is null and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating') and (
 public.phase2_is_office_head(p_user,o.office_id) or (t.assigned_to=p_user or t.recommendation_lead_id=p_user or p_user=any(coalesce(t.team_member_ids,'{}'::uuid[])))
 and (o.relationship_type='lead' or exists(select 1 from public.project_office_members m where m.project_office_id=o.id and m.user_id=p_user))));
$$;
revoke all on function eflow_phase6.shared(uuid),eflow_phase6.head(uuid,uuid,uuid),eflow_phase6.access(uuid,uuid),eflow_phase6.work(uuid,uuid) from public,anon;
grant execute on function eflow_phase6.shared(uuid),eflow_phase6.head(uuid,uuid,uuid),eflow_phase6.access(uuid,uuid),eflow_phase6.work(uuid,uuid) to authenticated,service_role;

create or replace function public.can_see_project(target_project uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_phase6.baseline_can_see_project(target_project,caller_id) or eflow_phase6.access(target_project,caller_id);
$$;
create or replace function public.can_manage_task(target_task uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when eflow_phase6.shared(t.linked_project_id) and t.source_collaboration_draft_id is null
 then eflow_phase6.head(t.linked_project_id,t.org_id,caller_id)
 else eflow_phase6.baseline_can_manage_task(target_task,caller_id) end from public.tasks t where t.id=target_task and t.deleted_at is null;
$$;
create or replace function public.can_contribute_task(target_task uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case when eflow_phase6.shared(t.linked_project_id) and t.source_collaboration_draft_id is null
 then eflow_phase6.work(target_task,caller_id) else eflow_phase6.baseline_can_contribute_task(target_task,caller_id) end
 from public.tasks t where t.id=target_task and t.deleted_at is null;
$$;
create policy project_offices_read on public.project_offices for select to authenticated using(public.can_see_project(project_id,(select auth.uid())));
create policy project_office_members_read on public.project_office_members for select to authenticated using(exists(select 1 from public.project_offices o where o.id=project_office_id and public.can_see_project(o.project_id,(select auth.uid()))));

create function public.phase6_lead_office() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.org_id is not null then insert into public.project_offices(project_id,office_id,relationship_type,invitation_status,joined_at)
 values(new.id,new.org_id,'lead','joined',now()); end if; return new;
end $$;
revoke all on function public.phase6_lead_office() from public,anon,authenticated;
create trigger phase6_project_lead after insert on public.projects for each row execute function public.phase6_lead_office();
insert into public.project_offices(project_id,office_id,relationship_type,invitation_status,joined_at)
select id,org_id,'lead','joined',created_at from public.projects where org_id is not null;

-- Service-only creation validates the JWT actor and project; the existing Phase 2
-- claim, email reservation, resend and revoke functions remain the token engine.
create function public.phase6_create_invitation(p_actor uuid,p_project uuid,p_office uuid,p_email text,p_access text,p_hash text,p_ttl integer)
returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare p public.projects; o public.project_offices; i public.user_invitations;
begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or not public.phase2_is_office_head(p_actor,p.org_id) or not public.can_manage_project(p.id,p_actor) then raise exception 'Only the appointed Lead Office Head can invite Offices' using errcode='42501'; end if;
 if p.status in ('completed','archived') or p.source_collaboration_draft_id is not null then raise exception 'Invalid invitation: closed or governed project' using errcode='22023'; end if;
 if p_office=p.org_id or not exists(select 1 from public.organizations where id=p_office) or p_access not in ('collaborating','observer') or p_ttl not between 1 and 720 or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation fields' using errcode='22023'; end if;
 insert into public.project_offices(project_id,office_id,relationship_type,contact_email) values(p.id,p_office,p_access,lower(btrim(p_email)))
 on conflict(project_id,office_id) do nothing;
 select * into o from public.project_offices where project_id=p.id and office_id=p_office for update;
 if o.invitation_status in ('joined','awaiting_head') then raise exception 'Office already joined or awaits its Head' using errcode='22023'; end if;
 update public.user_invitations set status='expired',updated_at=now() where project_office_id=o.id and status='pending' and expires_at<=now();
 if exists(select 1 from public.user_invitations where project_office_id=o.id and status='pending') then raise exception 'Invitation already pending' using errcode='22023'; end if;
 update public.project_offices set relationship_type=p_access,contact_email=lower(btrim(p_email)),contact_user_id=null,invitation_status='pending',updated_at=now() where id=o.id;
 insert into public.user_invitations(email,email_normalized,invited_by,office_id,account_role,invitation_type,project_office_id,token_hash,expires_at)
 values(lower(btrim(p_email)),lower(btrim(p_email)),p_actor,p.org_id,'member','project_office',o.id,p_hash,now()+make_interval(hours=>p_ttl)) returning * into i;
 perform public.phase2_audit(p_actor,p.org_id,i.id,'project_office_invitation_created'); return i;
end $$;
revoke all on function public.phase6_create_invitation(uuid,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.phase6_create_invitation(uuid,uuid,uuid,text,text,text,integer) to service_role;

create function public.phase6_accept_invitation(p_hash text,p_user uuid,p_name text,p_claim uuid default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare i public.user_invitations; o public.project_offices; p public.projects; profile public.profiles; email text; joined boolean;
begin
 select * into i from public.user_invitations where token_hash=p_hash for update;
 if i.id is null or i.invitation_type<>'project_office' then raise exception 'Invalid invitation' using errcode='22023'; end if;
 select lower(btrim(u.email)) into email from auth.users u where id=p_user and email_confirmed_at is not null;
 if email is null or email<>i.email_normalized then raise exception 'Sign in with the invited verified email' using errcode='42501'; end if;
 if i.status='accepted' and i.accepted_by=p_user then select * into profile from public.profiles where id=p_user;return profile;end if;
 select * into o from public.project_offices where id=i.project_office_id for update;
 select * into p from public.projects where id=o.project_id;
 if i.status<>'pending' or i.expires_at<=now() or p.status in ('completed','archived') or o.invitation_status<>'pending' then raise exception 'Invitation expired, revoked, or invalid' using errcode='22023'; end if;
 if not public.phase2_is_office_head(i.invited_by,p.org_id) or i.office_id<>p.org_id then raise exception 'Inviter no longer leads this Office' using errcode='42501'; end if;
 if i.acceptance_claim is not null and i.acceptance_claim is distinct from p_claim and i.acceptance_claimed_at>now()-interval '3 minutes' then raise exception 'Acceptance is already in progress' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('phase2-user:'||p_user::text,0));
 select * into profile from public.profiles where id=p_user for update;
 if found then
  if not profile.is_active or profile.role='admin' or profile.org_id is not null and profile.org_id<>o.office_id then raise exception 'This identity requires Admin resolution: another Office' using errcode='42501'; end if;
 else
  if length(btrim(p_name)) not between 2 and 160 then raise exception 'Enter your full name' using errcode='22023';end if;
  -- A project contact is not global Office membership or a Head appointment.
  insert into public.profiles(id,full_name,email,employee_id,role,is_active) values(p_user,btrim(p_name),email,'INV-'||p_user::text,'member',true) returning * into profile;
 end if;
 joined:=o.relationship_type='observer' or public.phase2_is_office_head(p_user,o.office_id);
 update public.project_offices set contact_user_id=p_user,invitation_status=case when joined then 'joined' else 'awaiting_head' end,joined_at=case when joined then now() end,updated_at=now() where id=o.id;
 update public.user_invitations set status='accepted',accepted_by=p_user,accepted_at=now(),acceptance_claim=null,acceptance_claimed_at=null,updated_at=now() where id=i.id;
 perform public.phase2_audit(p_user,i.office_id,i.id,'project_office_invitation_accepted');
 insert into public.notifications(user_id,type,title,message,actor_id,actor_name) values(i.invited_by,'project_office_invitation','Office invitation accepted',profile.full_name||' accepted the project invitation.',p_user,profile.full_name);
 return profile;
end $$;
revoke all on function public.phase6_accept_invitation(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.phase6_accept_invitation(text,uuid,text,uuid) to service_role;

-- Keep Phase 2 callers compatible while preventing a project link being used to
-- acquire global membership in the Lead Office through its old acceptance RPC.
do $$ declare d text; begin
 select pg_get_functiondef('public.phase2_accept_invitation(text,uuid,text,uuid)'::regprocedure) into d;
 d:=replace(d,'select * into item from public.user_invitations where token_hash=p_hash for update;',
 'select * into item from public.user_invitations where token_hash=p_hash for update; if item.invitation_type=''project_office'' then return public.phase6_accept_invitation(p_hash,p_user,p_name,p_claim); end if;');
 if d not like '%return public.phase6_accept_invitation%' then raise exception 'Phase 2 acceptance definition changed; review migration';end if;
 execute d;
end $$;

-- These RPCs deliberately own writes to the read-only participation tables.
-- Authenticated clients cannot change their Office, relationship or membership
-- by directly inserting rows; every mutation validates the actual auth.uid().
create function public.phase6_confirm_office(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.project_offices;p public.projects;
begin
 select * into o from public.project_offices where id=p_id for update;
 select * into p from public.projects where id=o.project_id;
 if o.id is null or not public.phase2_is_office_head(auth.uid(),o.office_id) or o.invitation_status<>'awaiting_head' or p.status in ('completed','archived') then raise exception 'Only the appointed Office Head can confirm this collaboration' using errcode='42501';end if;
 update public.project_offices set invitation_status='joined',joined_at=now(),updated_at=now() where id=o.id;
 perform public.phase2_audit(auth.uid(),o.office_id,o.id,'project_office_confirmed');
end $$;
create function public.phase6_set_members(p_id uuid,p_users uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare o public.project_offices;p public.projects;u uuid;
begin
 select * into o from public.project_offices where id=p_id for update;
 select * into p from public.projects where id=o.project_id;
 if o.id is null or not public.phase2_is_office_head(auth.uid(),o.office_id) or o.invitation_status<>'joined' or p.status in ('completed','archived') then raise exception 'Only the appointed Office Head can select its own project members' using errcode='42501';end if;
 if p_users is null or cardinality(p_users)>200 then raise exception 'Invalid member selection' using errcode='22023';end if;
 foreach u in array p_users loop
  if not exists(select 1 from public.profiles where id=u and org_id=o.office_id and is_active and role<>'admin') then raise exception 'Select active members of your own Office' using errcode='42501';end if;
 end loop;
 if exists(select 1 from public.tasks t where t.linked_project_id=p.id and t.org_id=o.office_id and t.deleted_at is null and t.status not in ('completed','cancelled')
 and exists(select 1 from public.project_office_members m where m.project_office_id=o.id and not m.user_id=any(p_users)
 and (m.user_id=t.assigned_to or m.user_id=t.recommendation_lead_id or m.user_id=any(coalesce(t.team_member_ids,'{}'::uuid[]))))) then raise exception 'Reassign active work before removing its project members' using errcode='22023';end if;
 delete from public.project_office_members where project_office_id=o.id and not user_id=any(p_users);
 insert into public.project_office_members(project_office_id,user_id,selected_by) select o.id,distinct_user,auth.uid() from (select distinct unnest(p_users) distinct_user) x on conflict do nothing;
 perform public.phase2_audit(auth.uid(),o.office_id,o.id,'project_office_members_selected');
end $$;
revoke all on function public.phase6_confirm_office(uuid),public.phase6_set_members(uuid,uuid[]) from public,anon;
grant execute on function public.phase6_confirm_office(uuid),public.phase6_set_members(uuid,uuid[]) to authenticated;

-- Canonical org_id remains the responsible Office used by Head review and
-- accounting. Handover is limited to unstarted, unstaffed work without staffed or started subitems.
create function public.phase6_responsible_office(p_task uuid,p_office uuid) returns public.tasks language plpgsql security definer set search_path='' as $$
declare t public.tasks;p public.projects;
begin
 select * into t from public.tasks where id=p_task and deleted_at is null for update;
 select * into p from public.projects where id=t.linked_project_id for update;
 if p.id is null or not public.phase2_is_office_head(auth.uid(),p.org_id) or not public.can_manage_project(p.id,auth.uid()) or p.source_collaboration_draft_id is not null then raise exception 'Only the Lead Office Head can set responsibility' using errcode='42501';end if;
 if p.status in ('completed','archived') or t.archived_at is not null or t.status<>'pending_assignment' or t.assigned_to is not null or t.recommendation_lead_id is not null or cardinality(coalesce(t.team_member_ids,'{}'::uuid[]))>0 or exists(select 1 from public.subtasks where task_id=t.id and (status<>'todo' or assigned_to is not null or cardinality(coalesce(assigned_to_ids,'{}'::uuid[]))>0)) then raise exception 'Office handover requires an unstarted, unassigned task without staffed or started subitems' using errcode='22023';end if;
 if not exists(select 1 from public.project_offices where project_id=p.id and office_id=p_office and invitation_status='joined' and relationship_type in ('lead','collaborating')) then raise exception 'Choose a joined collaborating Office' using errcode='22023';end if;
 update public.tasks set org_id=p_office,department=(select name from public.organizations where id=p_office),reviewer_id=null,backup_reviewer_id=null where id=t.id returning * into t;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'task',t.id::text,'project.responsible_office',p.org_id,jsonb_build_object('office_id',p_office));return t;
end $$;
revoke all on function public.phase6_responsible_office(uuid,uuid) from public,anon;
grant execute on function public.phase6_responsible_office(uuid,uuid) to authenticated;

create function public.phase6_guard_task() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.projects; t public.tasks; candidate uuid; actor uuid:=auth.uid();
begin
 if tg_op='DELETE' then t:=old;else t:=new;end if;
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
  elsif not eflow_phase6.work(t.id,actor) then raise exception 'Your project access is read-only for this Office work' using errcode='42501';end if;
  if tg_op='UPDATE' and (new.assigned_to is distinct from old.assigned_to or new.recommendation_lead_id is distinct from old.recommendation_lead_id or new.team_member_ids is distinct from old.team_member_ids or new.team_id is distinct from old.team_id) and not eflow_phase6.head(p.id,new.org_id,actor) then raise exception 'Only the responsible Office Head can choose its employees' using errcode='42501';end if;
 end if;
 if tg_op<>'DELETE' then
  if not exists(select 1 from public.project_offices where project_id=p.id and office_id=new.org_id and relationship_type in ('lead','collaborating') and invitation_status='joined') then raise exception 'Responsible Office must be a joined collaborator' using errcode='23514';end if;
  foreach candidate in array array_remove(array[new.assigned_to,new.recommendation_lead_id]||coalesce(new.team_member_ids,'{}'::uuid[]),null) loop
   if not exists(select 1 from public.profiles q where q.id=candidate and q.org_id=new.org_id and q.is_active and q.role<>'admin' and (public.phase2_is_office_head(candidate,new.org_id) or new.org_id=p.org_id or exists(select 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p.id and o.office_id=new.org_id and m.user_id=candidate))) then raise exception 'Select active project members from the responsible Office' using errcode='42501';end if;
  end loop;
  return new;
 end if;return old;
end $$;
revoke all on function public.phase6_guard_task() from public,anon,authenticated;
create trigger phase6_task_authority before insert or update or delete on public.tasks for each row execute function public.phase6_guard_task();

-- Phase 3 keeps its complete allowlist and dependency/date validation. Only its
-- authority gate expands to the participating Head for that task's own Office.
-- Row-locking a project requires UPDATE privileges. Collaborators must not gain
-- those privileges: this narrowly authorized helper locks it for planning only.
create function eflow_phase6.lock_project(p_id uuid) returns public.projects language plpgsql security definer set search_path='' as $$
declare p public.projects;begin
 if not public.can_manage_project(p_id,auth.uid()) and not exists(select 1 from public.project_offices o where o.project_id=p_id and eflow_phase6.head(p_id,o.office_id,auth.uid())) then raise exception 'Only an authorized Office Head can edit project planning' using errcode='42501';end if;
 select * into p from public.projects where id=p_id for update;return p;
end $$;
revoke all on function eflow_phase6.lock_project(uuid) from public,anon;
grant execute on function eflow_phase6.lock_project(uuid) to authenticated;
do $$ declare d text;begin
 select pg_get_functiondef('public.phase3_patch_task(uuid,jsonb)'::regprocedure) into d;
 d:=replace(d,'or not public.can_manage_project(p.id,auth.uid()) or not public.can_manage_task(t.id,auth.uid())','or not (public.can_manage_project(p.id,auth.uid()) or eflow_phase6.head(p.id,t.org_id,auth.uid())) or not public.can_manage_task(t.id,auth.uid())');
 d:=replace(d,'select * into p from public.projects where id=t.linked_project_id for update;','select * into p from eflow_phase6.lock_project(t.linked_project_id);');
 if d not like '%or eflow_phase6.head(p.id,t.org_id,auth.uid())%' then raise exception 'Phase 3 patch definition changed; review migration';end if;
 execute d;
end $$;

-- Legacy project member controls must not become a cross-Office staffing route.
create function public.phase6_guard_project_member() returns trigger language plpgsql security definer set search_path='' as $$
declare pid uuid; uid uuid; oid uuid;begin
 if tg_op='DELETE' then pid:=old.project_id;uid:=old.user_id;else pid:=new.project_id;uid:=new.user_id;end if;
 if eflow_phase6.shared(pid) and auth.uid() is not null then
  select org_id into oid from public.profiles where id=uid and is_active;
  if not eflow_phase6.head(pid,oid,auth.uid()) then raise exception 'Each Office selects its own project personnel' using errcode='42501';end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.phase6_guard_project_member() from public,anon,authenticated;
create trigger phase6_project_member_authority before insert or update or delete on public.project_members for each row execute function public.phase6_guard_project_member();

create function public.phase6_guard_subtask() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.tasks;tid uuid;begin
 if tg_op='DELETE' then tid:=old.task_id;else tid:=new.task_id;end if;
 select * into t from public.tasks where id=tid;
 if auth.uid() is not null and t.source_collaboration_draft_id is null and eflow_phase6.shared(t.linked_project_id) and not eflow_phase6.work(t.id,auth.uid()) then raise exception 'Observer and other Office access is read-only' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.phase6_guard_subtask() from public,anon,authenticated;
create trigger phase6_subtask_authority before insert or update or delete on public.subtasks for each row execute function public.phase6_guard_subtask();
create trigger phase6_progress_authority before insert or update or delete on public.subtask_progress_updates for each row execute function public.phase6_guard_subtask();
create trigger phase6_submission_authority before insert or update or delete on public.task_submissions for each row execute function public.phase6_guard_subtask();

create function public.phase6_invitation_state() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.invitation_type='project_office' and new.status='revoked' then
 update public.project_offices set invitation_status='revoked',updated_at=now() where id=new.project_office_id and invitation_status='pending';
 end if;return new;
end $$;
revoke all on function public.phase6_invitation_state() from public,anon,authenticated;
create trigger phase6_invitation_state after update of status on public.user_invitations for each row execute function public.phase6_invitation_state();

create function public.phase6_guard_project() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if eflow_phase6.shared(old.id) and (new.org_id is distinct from old.org_id or new.source_collaboration_draft_id is distinct from old.source_collaboration_draft_id) then raise exception 'Shared project Office and governance identities are protected' using errcode='42501';end if;
 return new;
end $$;
revoke all on function public.phase6_guard_project() from public,anon,authenticated;
create trigger phase6_project_identity before update of org_id,source_collaboration_draft_id on public.projects for each row execute function public.phase6_guard_project();

do $$ begin
 alter publication supabase_realtime add table public.project_offices,public.project_office_members;
end $$;
commit;
