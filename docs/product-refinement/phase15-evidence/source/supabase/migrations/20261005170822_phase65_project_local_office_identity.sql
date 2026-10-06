begin;
set local lock_timeout='10s';
create schema eflow_phase65;
revoke all on schema eflow_phase65 from public,anon,authenticated;
grant usage on schema eflow_phase65 to service_role;

alter table public.project_offices add constraint project_offices_identity_scope unique(id,project_id,office_id);
create table public.project_office_identities (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.projects(id) on delete cascade,
 display_name text not null check(length(btrim(display_name)) between 1 and 200),
 normalized_name text generated always as (lower(btrim(display_name))) stored,
 canonical_office_id uuid references public.organizations(id),
 project_office_id uuid,
 relationship_type text not null default 'collaborating' check(relationship_type in ('lead','collaborating','observer')),
 contact_email text not null default '', contact_user_id uuid references public.profiles(id),
 contact_status text not null default 'none' check(contact_status in ('none','invited','accepted','revoked')),
 provenance jsonb not null default '{}' check(jsonb_typeof(provenance)='object' and octet_length(provenance::text)<=10000),
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,project_id),
 check((canonical_office_id is null)=(project_office_id is null)),
 foreign key(project_office_id,project_id,canonical_office_id) references public.project_offices(id,project_id,office_id)
);
create unique index project_office_identities_local_name on public.project_office_identities(project_id,normalized_name) where canonical_office_id is null;
create index project_office_identities_contact on public.project_office_identities(contact_user_id) where contact_user_id is not null;
alter table public.project_office_identities enable row level security;
revoke all on public.project_office_identities from public,anon,authenticated;
grant select on public.project_office_identities to authenticated;
grant all on public.project_office_identities to service_role;

insert into public.project_office_identities(project_id,display_name,canonical_office_id,project_office_id,relationship_type,contact_email,contact_user_id,contact_status,provenance)
select o.project_id,n.name,o.office_id,o.id,o.relationship_type,o.contact_email,o.contact_user_id,
 case when o.contact_user_id is not null then 'accepted' when o.invitation_status='revoked' then 'revoked' when o.contact_email<>'' then 'invited' else 'none' end,
 jsonb_build_object('source','canonical_backfill') from public.project_offices o join public.organizations n on n.id=o.office_id;

create function eflow_phase65.sync_canonical_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.project_office_identities(project_id,display_name,canonical_office_id,project_office_id,relationship_type,contact_email,contact_user_id,contact_status,provenance)
 select new.project_id,n.name,new.office_id,new.id,new.relationship_type,new.contact_email,new.contact_user_id,
 case when new.contact_user_id is not null then 'accepted' when new.contact_email<>'' then 'invited' else 'none' end,jsonb_build_object('source','canonical_backfill') from public.organizations n where n.id=new.office_id;
 return new;
end $$;
create trigger phase65_canonical_identity after insert on public.project_offices for each row execute function eflow_phase65.sync_canonical_identity();

alter table public.tasks add column proposed_office_identity_id uuid;
alter table public.tasks add constraint tasks_proposed_office_scope foreign key(proposed_office_identity_id,linked_project_id) references public.project_office_identities(id,project_id);
alter table public.tasks add constraint tasks_proposed_office_project check(proposed_office_identity_id is null or linked_project_id is not null);
create index tasks_proposed_office on public.tasks(proposed_office_identity_id) where proposed_office_identity_id is not null;
create table eflow_phase65.import_receipts (
 batch_id uuid primary key references public.project_import_batches(id) on delete cascade,
 identity_ids jsonb not null
);
revoke all on eflow_phase65.import_receipts from public,anon,authenticated;

alter table public.user_invitations add column project_office_identity_id uuid references public.project_office_identities(id);
alter table public.user_invitations drop constraint user_invitations_invitation_type_check;
alter table public.user_invitations drop constraint invitation_project_scope;
alter table public.user_invitations add constraint user_invitations_invitation_type_check check(invitation_type in ('office_member','project_office','project_office_identity'));
alter table public.user_invitations add constraint user_invitations_project_scope check(
 (invitation_type='office_member' and project_office_id is null and project_office_identity_id is null) or
 (invitation_type='project_office' and project_office_id is not null and project_office_identity_id is null) or
 (invitation_type='project_office_identity' and project_office_id is null and project_office_identity_id is not null));
create unique index user_invitations_identity_pending on public.user_invitations(project_office_identity_id) where status='pending' and invitation_type='project_office_identity';
create index user_invitations_identity on public.user_invitations(project_office_identity_id,created_at desc) where project_office_identity_id is not null;
grant select(project_office_identity_id) on public.user_invitations to authenticated;

-- Preserve existing implementations, grants and public signatures. Copies are private.
do $$ declare d text; n text; begin
 foreach n in array array['can_see_project','phase2_accept_invitation','phase2_manage_invitation','phase2_claim_invitation','phase2_reserve_invitation_email'] loop
  select pg_get_functiondef(oid) into strict d from pg_proc where pronamespace='public'::regnamespace and proname=n;
  execute replace(d,'FUNCTION public.'||n||'(','FUNCTION eflow_phase65.baseline_'||n||'(');
 end loop;
 foreach n in array array['readiness','fingerprint'] loop
  select pg_get_functiondef(oid) into strict d from pg_proc where pronamespace='eflow_phase7'::regnamespace and proname=n;
  execute replace(d,'FUNCTION eflow_phase7.'||n||'(','FUNCTION eflow_phase65.baseline_'||n||'(');
 end loop;
end $$;
revoke all on all functions in schema eflow_phase65 from public,anon,authenticated;

create or replace function public.can_see_project(target_project uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_phase65.baseline_can_see_project(target_project,caller_id),false) or exists(
 select 1 from public.project_office_identities i join public.profiles u on u.id=caller_id and u.is_active and u.role<>'admin'
 where i.project_id=target_project and i.contact_user_id=caller_id and i.contact_status='accepted'
 and (i.project_office_id is null or exists(select 1 from public.project_offices o where o.id=i.project_office_id and o.invitation_status<>'revoked')));
$$;
create policy project_office_identities_read on public.project_office_identities for select to authenticated using(public.can_see_project(project_id,(select auth.uid())));

create function eflow_phase65.require_lead(p_project uuid,p_actor uuid) returns public.projects language plpgsql security definer set search_path='' as $$
declare p public.projects;begin
 select * into p from public.projects where id=p_project for update;
 if p.id is null or p_actor is null or not public.phase2_is_office_head(p_actor,p.org_id) or not public.can_manage_project(p.id,p_actor) then raise exception 'Only the appointed Lead Office Head can manage Office identities' using errcode='42501';end if;
 if p.status in ('completed','archived') or p.source_collaboration_draft_id is not null then raise exception 'Closed or governed project identities are read-only' using errcode='22023';end if;
 return p;
end $$;

create function public.phase65_save_office_identity(p_project uuid,p_id uuid,p_name text,p_evidence text default '') returns public.project_office_identities language plpgsql security definer set search_path='' as $$
declare p public.projects;i public.project_office_identities;begin
 p:=eflow_phase65.require_lead(p_project,auth.uid());
 if p_id is null or length(btrim(coalesce(p_name,''))) not between 1 and 200 or length(coalesce(p_evidence,''))>2000 then raise exception 'Enter an Office name within 200 characters' using errcode='22023';end if;
 select * into i from public.project_office_identities where id=p_id for update;
 if found then
  if i.project_id<>p.id then raise exception 'Office identity belongs to another project' using errcode='42501';end if;
  if i.canonical_office_id is not null and i.display_name<>btrim(p_name) then raise exception 'Linked Office identity cannot be renamed' using errcode='22023';end if;
  update public.project_office_identities set display_name=btrim(p_name),updated_at=now() where id=i.id returning * into i;
 else
  insert into public.project_office_identities(id,project_id,display_name,created_by,provenance) values(p_id,p.id,btrim(p_name),auth.uid(),jsonb_build_object('source',case when p_evidence='' then 'manual' else 'reviewed_import' end,'evidence',p_evidence))
  on conflict(project_id,normalized_name) where canonical_office_id is null do nothing returning * into i;
  if i.id is null then select * into i from public.project_office_identities where project_id=p.id and normalized_name=lower(btrim(p_name)) and canonical_office_id is null;end if;
 end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project_office_identity',i.id::text,'project.office_identity_saved',p.org_id,jsonb_build_object('name',i.display_name));
 return i;
end $$;

create function public.phase65_create_invitation(p_actor uuid,p_identity uuid,p_email text,p_access text,p_hash text,p_ttl integer) returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare p public.projects;i public.project_office_identities;inv public.user_invitations;pid uuid;begin
 select project_id into pid from public.project_office_identities where id=p_identity;
 p:=eflow_phase65.require_lead(pid,p_actor);
 select * into i from public.project_office_identities where id=p_identity for update;
 if i.canonical_office_id is not null or i.contact_status='accepted' then raise exception 'Invalid invitation: use the linked Office participation' using errcode='22023';end if;
 if p_access is null or p_access not in ('collaborating','observer') or p_ttl is null or p_ttl not between 1 and 720 or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_email is null or length(p_email)>254 or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation fields' using errcode='22023';end if;
 update public.user_invitations set status='expired',updated_at=now() where project_office_identity_id=i.id and status='pending' and expires_at<=now();
 if exists(select 1 from public.user_invitations where project_office_identity_id=i.id and status='pending') then raise exception 'Invitation already pending' using errcode='22023';end if;
 update public.project_office_identities set relationship_type=p_access,contact_email=lower(btrim(p_email)),contact_user_id=null,contact_status='invited',updated_at=now() where id=i.id;
 insert into public.user_invitations(email,email_normalized,invited_by,office_id,account_role,invitation_type,project_office_identity_id,token_hash,expires_at)
 values(lower(btrim(p_email)),lower(btrim(p_email)),p_actor,p.org_id,'member','project_office_identity',i.id,p_hash,now()+make_interval(hours=>p_ttl)) returning * into inv;
 perform public.phase2_audit(p_actor,p.org_id,inv.id,'project_local_office_invitation_created');return inv;
end $$;

create function eflow_phase65.accept_local(p_hash text,p_user uuid,p_name text,p_claim uuid) returns public.profiles language plpgsql security definer set search_path='' as $$
declare inv public.user_invitations;i public.project_office_identities;p public.projects;u public.profiles;email text;begin
 select * into inv from public.user_invitations where token_hash=p_hash for update;
 select lower(btrim(a.email)) into email from auth.users a where id=p_user and email_confirmed_at is not null;
 if email is null or email is distinct from inv.email_normalized then raise exception 'Sign in with the invited verified email' using errcode='42501';end if;
 if inv.status='accepted' and inv.accepted_by=p_user then select * into u from public.profiles where id=p_user;return u;end if;
 select * into i from public.project_office_identities where id=inv.project_office_identity_id for update;
 p:=eflow_phase65.require_lead(i.project_id,inv.invited_by);
 if inv.invitation_type<>'project_office_identity' or inv.office_id<>p.org_id or inv.status<>'pending' or inv.expires_at<=now() or i.canonical_office_id is not null or i.contact_status<>'invited' then raise exception 'Invitation expired, revoked, or invalid' using errcode='22023';end if;
 if inv.acceptance_claim is not null and inv.acceptance_claim is distinct from p_claim and inv.acceptance_claimed_at>now()-interval '3 minutes' then raise exception 'Acceptance is already in progress' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('phase2-user:'||p_user::text,0));
 select * into u from public.profiles where id=p_user for update;
 if found then
  if u.is_active is distinct from true or u.role='admin' then raise exception 'This identity requires Admin resolution' using errcode='42501';end if;
 else
  if length(btrim(coalesce(p_name,''))) not between 2 and 160 then raise exception 'Enter your full name' using errcode='22023';end if;
  insert into public.profiles(id,full_name,email,employee_id,role,is_active) values(p_user,btrim(p_name),email,'INV-'||p_user::text,'member',true) returning * into u;
 end if;
 update public.project_office_identities set contact_user_id=p_user,contact_status='accepted',updated_at=now() where id=i.id;
 update public.user_invitations set status='accepted',accepted_by=p_user,accepted_at=now(),acceptance_claim=null,acceptance_claimed_at=null,updated_at=now() where id=inv.id;
 perform public.phase2_audit(p_user,inv.office_id,inv.id,'project_local_office_invitation_accepted');
 insert into public.notifications(user_id,type,title,message,actor_id,actor_name) values(inv.invited_by,'project_office_invitation','Office contact accepted',u.full_name||' accepted. Directory linking and Office Head confirmation remain required.',p_user,u.full_name);
 return u;
end $$;
create or replace function public.phase2_accept_invitation(p_hash text,p_user uuid,p_name text,p_claim uuid default null) returns public.profiles language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.user_invitations where token_hash=p_hash and invitation_type='project_office_identity') then return eflow_phase65.accept_local(p_hash,p_user,p_name,p_claim);end if;
 return eflow_phase65.baseline_phase2_accept_invitation(p_hash,p_user,p_name,p_claim);
end $$;

create function eflow_phase65.require_local_invitation(p_id uuid,p_actor uuid) returns void language plpgsql security definer set search_path='' as $$
declare inv public.user_invitations;i public.project_office_identities;begin
 select * into inv from public.user_invitations where id=p_id;
 if inv.invitation_type='project_office_identity' then
  select * into i from public.project_office_identities where id=inv.project_office_identity_id;
  perform eflow_phase65.require_lead(i.project_id,p_actor);
  if i.canonical_office_id is not null or i.contact_status='accepted' then raise exception 'Invalid invitation: Office already linked or accepted' using errcode='22023';end if;
 end if;
end $$;
create or replace function public.phase2_manage_invitation(p_actor uuid,p_id uuid,p_action text,p_hash text default null,p_ttl integer default 168) returns public.user_invitations language plpgsql security definer set search_path='' as $$
begin
 perform eflow_phase65.require_local_invitation(p_id,p_actor);
 return eflow_phase65.baseline_phase2_manage_invitation(p_actor,p_id,p_action,p_hash,p_ttl);
end $$;
create or replace function public.phase2_claim_invitation(p_hash text,p_claim uuid) returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare inv public.user_invitations;begin
 select * into inv from public.user_invitations where token_hash=p_hash;
 perform eflow_phase65.require_local_invitation(inv.id,inv.invited_by);
 return eflow_phase65.baseline_phase2_claim_invitation(p_hash,p_claim);
end $$;
create or replace function public.phase2_reserve_invitation_email(p_id uuid,p_hash text) returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare inv public.user_invitations;begin
 select * into inv from public.user_invitations where id=p_id;
 perform eflow_phase65.require_local_invitation(inv.id,inv.invited_by);
 return eflow_phase65.baseline_phase2_reserve_invitation_email(p_id,p_hash);
end $$;

create function eflow_phase65.invitation_state() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.invitation_type='project_office_identity' and new.status in ('revoked','pending') then
  update public.project_office_identities set contact_status=case when new.status='revoked' then 'revoked' else 'invited' end,updated_at=now() where id=new.project_office_identity_id and contact_status<>'accepted';
 end if;return new;
end $$;
create trigger phase65_invitation_state after update of status on public.user_invitations for each row execute function eflow_phase65.invitation_state();

create function public.phase65_link_office_identity(p_identity uuid,p_office uuid) returns void language plpgsql security definer set search_path='' as $$
declare i public.project_office_identities;p public.projects;o public.project_offices;pid uuid;begin
 select project_id into pid from public.project_office_identities where id=p_identity;
 p:=eflow_phase65.require_lead(pid,auth.uid());
 select * into i from public.project_office_identities where id=p_identity for update;
 if i.canonical_office_id is not null then
  if i.canonical_office_id=p_office then return;end if;
  raise exception 'Linked Office identity cannot be replaced' using errcode='22023';
 end if;
 if p_office=p.org_id or not exists(select 1 from public.organizations where id=p_office and is_active) then raise exception 'Choose an active collaborating Office' using errcode='22023';end if;
 if exists(select 1 from public.user_invitations where project_office_identity_id=i.id and status='pending') then raise exception 'Accept or revoke the pending invitation before linking' using errcode='22023';end if;
 if i.contact_user_id is not null and not exists(select 1 from public.profiles where id=i.contact_user_id and is_active and role<>'admin' and (org_id is null or org_id=p_office)) then raise exception 'This contact belongs to another Office or needs Admin resolution' using errcode='42501';end if;
 insert into public.project_offices(project_id,office_id,relationship_type,invitation_status,contact_email,contact_user_id,joined_at)
 values(p.id,p_office,i.relationship_type,case when i.contact_status='accepted' then case when i.relationship_type='observer' or public.phase2_is_office_head(i.contact_user_id,p_office) then 'joined' else 'awaiting_head' end else 'pending' end,i.contact_email,i.contact_user_id,
 case when i.contact_status='accepted' and (i.relationship_type='observer' or public.phase2_is_office_head(i.contact_user_id,p_office)) then now() end)
 on conflict(project_id,office_id) do nothing;
 select * into o from public.project_offices where project_id=p.id and office_id=p_office for update;
 if o.relationship_type<>i.relationship_type or o.invitation_status='revoked' then raise exception 'Resolution conflict: review the existing Office participation first' using errcode='22023';end if;
 update public.project_office_identities set canonical_office_id=p_office,project_office_id=o.id,updated_at=now() where id=i.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'project_office_identity',i.id::text,'project.office_identity_linked',p.org_id,jsonb_build_object('office_id',p_office));
end $$;

create function eflow_phase65.guard_task() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.project_office_identities;begin
 if tg_op='UPDATE' and old.proposed_office_identity_id is not null and new.proposed_office_identity_id is not null and new.org_id is distinct from old.org_id then raise exception 'Resolve proposed responsibility atomically before changing canonical Office' using errcode='42501';end if;
 if tg_op='UPDATE' and old.proposed_office_identity_id is not null and (new.linked_project_id is distinct from old.linked_project_id or new.source_collaboration_draft_id is distinct from old.source_collaboration_draft_id) then raise exception 'Project work identity is protected' using errcode='42501';end if;
 if (tg_op='INSERT' and new.proposed_office_identity_id is not null) or (tg_op='UPDATE' and new.proposed_office_identity_id is distinct from old.proposed_office_identity_id) then
  perform eflow_phase65.require_lead(new.linked_project_id,auth.uid());
  if tg_op='UPDATE' and old.proposed_office_identity_id is not null and new.proposed_office_identity_id is null then
   select * into i from public.project_office_identities where id=old.proposed_office_identity_id;
   if i.canonical_office_id is null or new.org_id is distinct from i.canonical_office_id or old.status<>'pending_assignment' or new.status<>'pending_assignment' or new.assigned_to is not null or new.recommendation_lead_id is not null or cardinality(coalesce(new.team_member_ids,'{}'::uuid[]))>0 or not exists(select 1 from public.project_offices where id=i.project_office_id and invitation_status='joined' and relationship_type<>'observer') then raise exception 'Resolve proposed responsibility to a joined canonical Office' using errcode='42501';end if;
  end if;
 end if;
 if new.proposed_office_identity_id is not null then
  if new.status not in ('pending_assignment','cancelled') or new.assigned_to is not null or new.recommendation_lead_id is not null or cardinality(coalesce(new.team_member_ids,'{}'::uuid[]))>0 or nullif(btrim(new.team_id),'') is not null then raise exception 'Resolve proposed Office identity before staffing or execution' using errcode='42501';end if;
  if exists(select 1 from public.subtasks where task_id=new.id and (status<>'todo' or assigned_to is not null or cardinality(coalesce(assigned_to_ids,'{}'::uuid[]))>0)) or exists(select 1 from public.task_submissions where task_id=new.id) or exists(select 1 from public.subtask_submissions where task_id=new.id) or exists(select 1 from public.subtask_progress_updates where task_id=new.id) or exists(select 1 from public.work_budget_allocations where task_id=new.id) or exists(select 1 from public.petty_cash_requests where task_id=new.id) then raise exception 'Started, staffed or funded work cannot become proposed responsibility' using errcode='42501';end if;
 end if;return new;
end $$;
create trigger phase65_pending_task before insert or update on public.tasks for each row execute function eflow_phase65.guard_task();

create function public.phase65_propose_task_office(p_task uuid,p_identity uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;i public.project_office_identities;begin
 select * into t from public.tasks where id=p_task and deleted_at is null for update;
 perform eflow_phase65.require_lead(t.linked_project_id,auth.uid());
 select * into i from public.project_office_identities where id=p_identity;
 if i.id is null or i.project_id<>t.linked_project_id or i.relationship_type='observer' or t.archived_at is not null or t.status<>'pending_assignment' then raise exception 'Choose a proposed collaborating Office for unstarted work' using errcode='22023';end if;
 update public.tasks set proposed_office_identity_id=i.id where id=t.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'task',t.id::text,'project.office_responsibility_proposed',t.org_id,jsonb_build_object('identity_id',i.id));
end $$;

create function public.phase65_resolve_task_office(p_task uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.tasks;i public.project_office_identities;begin
 select * into t from public.tasks where id=p_task and deleted_at is null for update;
 perform eflow_phase65.require_lead(t.linked_project_id,auth.uid());
 select * into i from public.project_office_identities where id=t.proposed_office_identity_id for update;
 if i.id is null or i.canonical_office_id is null or not exists(select 1 from public.project_offices where id=i.project_office_id and invitation_status='joined' and relationship_type<>'observer') then raise exception 'Link the Office and obtain its Head confirmation first' using errcode='22023';end if;
 -- Match Phase 6 handover preflight. Clearing the marker must be atomic with
 -- org_id: a second write would correctly fail the foreign-Office work guard.
 if t.archived_at is not null or t.status<>'pending_assignment' or t.assigned_to is not null or t.recommendation_lead_id is not null or cardinality(coalesce(t.team_member_ids,'{}'::uuid[]))>0 or exists(select 1 from public.subtasks where task_id=t.id and (status<>'todo' or assigned_to is not null or cardinality(coalesce(assigned_to_ids,'{}'::uuid[]))>0)) then raise exception 'Office handover requires unstarted, unassigned work without staffed or started subitems' using errcode='22023';end if;
 update public.tasks set org_id=i.canonical_office_id,department=(select name from public.organizations where id=i.canonical_office_id),reviewer_id=null,backup_reviewer_id=null,proposed_office_identity_id=null where id=t.id;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'task',t.id::text,'project.responsible_office',t.org_id,jsonb_build_object('office_id',i.canonical_office_id));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values(auth.uid(),'task',t.id::text,'project.office_responsibility_resolved',t.org_id,jsonb_build_object('identity_id',i.id,'office_id',i.canonical_office_id));
end $$;

create function eflow_phase65.guard_child() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid;old_tid uuid;begin
 tid:=new.task_id;
 if tg_op='UPDATE' then old_tid:=old.task_id;end if;
 -- Lock the parent: proposal creation and execution/funding cannot race.
 perform 1 from public.tasks where id in (tid,old_tid) order by id for update;
 if exists(select 1 from public.tasks where id in (tid,old_tid) and proposed_office_identity_id is not null) then
  if tg_table_name<>'subtasks' then raise exception 'Resolve proposed Office identity before evidence or funding' using errcode='42501';end if;
  if new.status<>'todo' or new.assigned_to is not null or cardinality(coalesce(new.assigned_to_ids,'{}'::uuid[]))>0 or (tg_op='UPDATE' and tid is distinct from old_tid) then raise exception 'Resolve proposed Office identity before subitem staffing or execution' using errcode='42501';end if;
 end if;return new;
end $$;
create trigger phase65_pending_subtask before insert or update on public.subtasks for each row execute function eflow_phase65.guard_child();
create trigger phase65_pending_submission before insert or update on public.task_submissions for each row execute function eflow_phase65.guard_child();
create trigger phase65_pending_allocation before insert or update on public.work_budget_allocations for each row execute function eflow_phase65.guard_child();
create trigger phase65_pending_cash before insert or update on public.petty_cash_requests for each row execute function eflow_phase65.guard_child();
create function eflow_phase65.guard_progress() returns trigger language plpgsql security definer set search_path='' as $$
declare tids uuid[];begin
 select array_agg(task_id) into tids from public.subtasks where id=new.subtask_id or (tg_op='UPDATE' and id=old.subtask_id);
 tids:=tids||array[new.task_id];
 if tg_op='UPDATE' then tids:=tids||array[old.task_id];end if;
 perform 1 from public.tasks where id=any(tids) order by id for update;
 if exists(select 1 from public.tasks where id=any(tids) and proposed_office_identity_id is not null) then raise exception 'Resolve proposed Office identity before progress or evidence' using errcode='42501';end if;
 return new;
end $$;
create trigger phase65_pending_progress before insert or update on public.subtask_progress_updates for each row execute function eflow_phase65.guard_progress();
create trigger phase65_pending_subtask_submission before insert or update on public.subtask_submissions for each row execute function eflow_phase65.guard_progress();

create function public.phase65_import_project_work(p_project_id uuid,p_request_id uuid,p_review jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;o jsonb;g jsonb;t jsonb;i public.project_office_identities;ids jsonb:='{}';p public.projects;begin
 p:=eflow_phase65.require_lead(p_project_id,auth.uid());
 v_result:=public.phase5_import_project_work(p_project_id,p_request_id,p_review);
 if exists(select 1 from eflow_phase65.import_receipts where batch_id=p_request_id) then return v_result;end if;
 for o in select value from jsonb_array_elements(p_review->'offices') loop
  if nullif(o->>'officeId','')::uuid=p.org_id then
   select * into i from public.project_office_identities where project_id=p.id and canonical_office_id=p.org_id;
  else
   i:=public.phase65_save_office_identity(p.id,gen_random_uuid(),o->>'name',o->>'evidence');
  end if;
  ids:=ids||jsonb_build_object(o->>'key',i.id);
 end loop;
 for g in select value from jsonb_array_elements(p_review->'groups') loop
  for t in select value from jsonb_array_elements(g->'tasks') loop
   if nullif(t->>'officeKey','') is not null then
    select * into i from public.project_office_identities where id=(ids->>(t->>'officeKey'))::uuid;
    if i.canonical_office_id is distinct from p.org_id then perform public.phase65_propose_task_office((v_result->'taskIds'->>(t->>'key'))::uuid,i.id);end if;
   end if;
  end loop;
 end loop;
 -- Dedicated receipt marker, including imports with zero local Offices.
 insert into eflow_phase65.import_receipts(batch_id,identity_ids) values(p_request_id,ids);
 return v_result;
end $$;

create or replace function eflow_phase7.fingerprint(p_id uuid,p_kind text) returns text language sql stable security definer set search_path='' as $$
 -- Canonical backfill must not invalidate existing approval fingerprints.
 select case when p_kind='structure' and exists(select 1 from public.project_office_identities i where i.project_id=p_id and i.provenance->>'source' is distinct from 'canonical_backfill') then
 md5(eflow_phase65.baseline_fingerprint(p_id,p_kind)||
 coalesce((select jsonb_agg(jsonb_build_array(i.id,i.canonical_office_id,i.contact_status) order by i.id)::text from public.project_office_identities i where i.project_id=p_id and i.provenance->>'source' is distinct from 'canonical_backfill'),'[]')||
 coalesce((select jsonb_agg(jsonb_build_array(t.id,t.proposed_office_identity_id) order by t.id)::text from public.tasks t where t.linked_project_id=p_id and t.proposed_office_identity_id is not null and t.deleted_at is null and t.status<>'cancelled'),'[]'))
 else eflow_phase65.baseline_fingerprint(p_id,p_kind) end;
$$;
create or replace function eflow_phase7.readiness(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;checks jsonb;n integer;good boolean;begin
 r:=eflow_phase65.baseline_readiness(p_id);
 select count(*) into n from public.tasks where linked_project_id=p_id and proposed_office_identity_id is not null and deleted_at is null and status<>'cancelled';
 checks:=(r->'checks')||jsonb_build_array(jsonb_build_object('key','office_identity','label','Proposed Office responsibilities resolved','ok',n=0,'detail',n||' tasks need directory linking, Office Head confirmation and explicit handover in Project Offices.'));
 good:=not exists(select 1 from jsonb_array_elements(checks) c where not (c->>'ok')::boolean);
 return r||jsonb_build_object('checks',checks,'ready',good,'canActivate',good and (r->>'canActivate')::boolean,'stage',case when n>0 then 'Office identity resolution' else r->>'stage' end);
end $$;

revoke all on all functions in schema eflow_phase65 from public,anon,authenticated;
revoke all on function public.phase65_create_invitation(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.phase65_create_invitation(uuid,uuid,text,text,text,integer) to service_role;
revoke all on function public.phase65_save_office_identity(uuid,uuid,text,text),public.phase65_link_office_identity(uuid,uuid),public.phase65_propose_task_office(uuid,uuid),public.phase65_resolve_task_office(uuid),public.phase65_import_project_work(uuid,uuid,jsonb) from public,anon;
grant execute on function public.phase65_save_office_identity(uuid,uuid,text,text),public.phase65_link_office_identity(uuid,uuid),public.phase65_propose_task_office(uuid,uuid),public.phase65_resolve_task_office(uuid),public.phase65_import_project_work(uuid,uuid,jsonb) to authenticated;
alter publication supabase_realtime add table public.project_office_identities;
notify pgrst,'reload schema';
commit;
