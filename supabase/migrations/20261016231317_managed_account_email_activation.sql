-- Account onboarding is separate from Office/project participation.
create schema eflow_activation;
revoke all on schema eflow_activation from public,anon,authenticated;
grant usage on schema eflow_activation to service_role;

alter table public.user_invitations drop constraint user_invitations_invitation_type_check;
alter table public.user_invitations add constraint user_invitations_invitation_type_check check(invitation_type in ('office_member','project_office','project_office_identity','managed_account'));
alter table public.user_invitations drop constraint user_invitations_project_scope;
alter table public.user_invitations add constraint user_invitations_project_scope check(
 (invitation_type in ('office_member','managed_account') and project_office_id is null and project_office_identity_id is null) or
 (invitation_type='project_office' and project_office_id is not null and project_office_identity_id is null) or
 (invitation_type='project_office_identity' and project_office_id is null and project_office_identity_id is not null));
create unique index managed_activation_pending_email on public.user_invitations(email_normalized) where invitation_type='managed_account' and status='pending';
create policy managed_activation_private on public.user_invitations as restrictive for select to authenticated
 using(invitation_type<>'managed_account' or public.is_admin(auth.uid()));
-- The unused public registration callback must not provision active profiles.
revoke insert on public.profiles from public,anon,authenticated;

create table public.managed_account_invite_details(
 invitation_id uuid primary key references public.user_invitations(id),
 source_mode text not null check(source_mode in ('ledipo_create','office_invite')),
 full_name text not null check(length(btrim(full_name)) between 2 and 160),
 skills jsonb not null default '{}' check(jsonb_typeof(skills)='object'),
 employee_notes jsonb check(employee_notes is null or jsonb_typeof(employee_notes)='object'),
 requested_privileged_role text check(requested_privileged_role in ('admin','head')),
 requested_by uuid not null references public.profiles(id),
 request_id uuid not null unique,
 request_payload jsonb not null,
 completion_claim uuid,
 reconciliation_claim uuid,
 approved_by uuid references public.profiles(id),
 approved_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.managed_account_invite_details enable row level security;
revoke all on public.managed_account_invite_details from public,anon,authenticated;
grant select,insert,update on public.managed_account_invite_details to service_role;
create table eflow_activation.dispatches(invitation_id uuid not null references public.user_invitations(id), token_hash text not null, actor uuid not null, office uuid not null, sent_at timestamptz not null default now(),primary key(invitation_id,token_hash));
create index on eflow_activation.dispatches(actor,sent_at);
create index on eflow_activation.dispatches(office,sent_at);
create table eflow_activation.request_limits(key text primary key, window_start timestamptz not null, hits int not null);
alter table eflow_activation.dispatches enable row level security;
alter table eflow_activation.request_limits enable row level security;

create function eflow_activation.require_admin(p_actor uuid,p_office uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.profiles where id=p_actor and role='admin' and is_active for share;
 if not found then raise exception 'Active Admin access required.' using errcode='42501';end if;
 if p_office is not null then
  perform 1 from public.organizations where id=p_office and is_active and org_type in ('department','division','section','unit') for share;
  if not found then raise exception 'Choose an active participating office.' using errcode='22023';end if;
 end if;
end $$;
create function eflow_activation.guard_details() returns trigger language plpgsql security definer set search_path='' as $$
declare i public.user_invitations;
begin
 select * into i from public.user_invitations where id=new.invitation_id;
 if i.invitation_type is distinct from 'managed_account' or i.invited_by is distinct from new.requested_by then raise exception 'Invalid managed invitation.';end if;
 if new.source_mode='ledipo_create' and (select count(*) from public.organizations where id=i.office_id and slug='ledipo' and is_active)<>1 then raise exception 'LEDIPO is unavailable.';end if;
 return new;
end $$;
create trigger managed_activation_details_guard before insert or update on public.managed_account_invite_details for each row execute function eflow_activation.guard_details();

create function eflow_activation.safe_row(i public.user_invitations) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('invitation_id',i.id,'email',i.email,'full_name',d.full_name,'office_id',i.office_id,'office_name',o.name,
 'account_role',i.account_role,'requested_privileged_role',d.requested_privileged_role,'source_mode',d.source_mode,
 'status',case when i.status='pending' and i.expires_at<=now() then 'expired' else i.status end,
 'email_delivery_status',i.email_delivery_status,'expires_at',i.expires_at,'created_at',i.created_at,'last_sent_at',i.last_sent_at,
 'needs_reconciliation',d.reconciliation_claim is not null,
 'awaiting_authority',i.status='accepted' and d.requested_privileged_role is not null and d.approved_at is null)
 from public.managed_account_invite_details d join public.organizations o on o.id=i.office_id where d.invitation_id=i.id;
$$;
create function eflow_activation.audit(p_actor uuid,i public.user_invitations,p_action text) returns void language sql security definer set search_path='' as $$
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,metadata)
 values(p_actor,'user',i.id::text,p_action,i.office_id,jsonb_build_object('invitation_id',i.id));
$$;
create function eflow_activation.assert_current(i public.user_invitations) returns void language plpgsql security definer set search_path='' as $$
begin
 if i.id is null or i.invitation_type<>'managed_account' or i.status<>'pending' or i.expires_at<=clock_timestamp() then
  raise exception 'Invalid or expired activation link.' using errcode='22023';end if;
 perform eflow_activation.require_admin(i.invited_by,i.office_id);
end $$;
create function eflow_activation.lock_invite(p_hash text) returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare i public.user_invitations;
begin
 select * into i from public.user_invitations where token_hash=p_hash and invitation_type='managed_account';
 if not found then raise exception 'Invalid or expired activation link.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('eflow.activation.email:'||i.email_normalized,0));
 select * into i from public.user_invitations where id=i.id for update;
 if i.token_hash is distinct from p_hash then raise exception 'Invalid or expired activation link.' using errcode='22023';end if;
 return i;
end $$;

create function public.eflow_managed_account_options(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform eflow_activation.require_admin(p_actor);
 return jsonb_build_object('offices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'slug',slug) order by name) from public.organizations where is_active and org_type in ('department','division','section','unit')),'[]'::jsonb));
end $$;
create function public.eflow_list_managed_activations(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform eflow_activation.require_admin(p_actor);
 return jsonb_build_object('invitations',coalesce((select jsonb_agg(eflow_activation.safe_row(i) order by i.created_at desc) from (select * from public.user_invitations i where i.invitation_type='managed_account' and (i.status<>'accepted' or exists(select 1 from public.managed_account_invite_details d where d.invitation_id=i.id and d.requested_privileged_role is not null and d.approved_at is null)) order by i.created_at desc limit 250) i),'[]'::jsonb));
end $$;
create function public.eflow_create_managed_activation(p_actor uuid,p_data jsonb,p_hash text,p_ttl int) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.user_invitations; d public.managed_account_invite_details; office uuid; v_email text:=lower(btrim(p_data->>'email')); role_name text:=p_data->>'role'; mode text:=p_data->>'mode';
begin
 perform eflow_activation.require_admin(p_actor);
 perform pg_advisory_xact_lock(hashtextextended('eflow.activation.actor:'||p_actor::text,0));
 perform pg_advisory_xact_lock(hashtextextended('eflow.activation.email:'||v_email,0));
 if mode='ledipo_create' then
  if (select count(*) from public.organizations where slug='ledipo' and is_active)<>1 then raise exception 'LEDIPO is unavailable.' using errcode='22023';end if;
  select id into office from public.organizations where slug='ledipo' and is_active;
  if nullif(p_data->>'org_id','')::uuid is distinct from office then raise exception 'Choose LEDIPO for this account.' using errcode='22023';end if;
 elsif mode='office_invite' then office:=(p_data->>'org_id')::uuid;
 else raise exception 'Invalid account invitation mode.' using errcode='22023';end if;
 if office is null then raise exception 'Choose an office.' using errcode='22023';end if;
 perform eflow_activation.require_admin(p_actor,office);
 if role_name not in ('admin','head','member','accounting_staff') or role_name is null or v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 or p_ttl not between 1 and 168 then raise exception 'Check the account invitation details.' using errcode='22023';end if;
 select * into d from public.managed_account_invite_details where request_id=(p_data->>'request_id')::uuid;
 if found then
  if d.requested_by<>p_actor or d.request_payload<>p_data then raise exception 'This request has different details. Start a new request.' using errcode='23505';end if;
  select * into i from public.user_invitations where id=d.invitation_id;
  return eflow_activation.safe_row(i)||jsonb_build_object('token_hash',i.token_hash);
 end if;
 -- Normalize both identity sources, including orphan Auth records. Never take over.
 if exists(select 1 from auth.users u where lower(btrim(u.email))=v_email) or exists(select 1 from public.profiles p where lower(btrim(p.email))=v_email) then raise exception 'An account with this email already exists. Ask Admin to review it.' using errcode='23505';end if;
 if exists(select 1 from public.user_invitations where email_normalized=v_email and invitation_type='managed_account' and status='pending') then raise exception 'An activation is already pending for this email.' using errcode='23505';end if;
 if (select count(*) from public.user_invitations where invited_by=p_actor and invitation_type='managed_account' and created_at>now()-interval '1 hour')>=30 then raise exception 'Invitation limit reached. Please try later.' using errcode='54000';end if;
 insert into public.user_invitations(email,email_normalized,invited_by,office_id,account_role,invitation_type,token_hash,expires_at,email_delivery_status)
 values(v_email,v_email,p_actor,office,case when role_name in ('admin','head') then 'member' else role_name end,'managed_account',p_hash,now()+make_interval(hours=>p_ttl),'queued') returning * into i;
 insert into public.managed_account_invite_details(invitation_id,source_mode,full_name,skills,employee_notes,requested_privileged_role,requested_by,request_id,request_payload)
 values(i.id,mode,p_data->>'full_name',coalesce(p_data->'skills','{}'),nullif(p_data->'pds_notes','null'::jsonb),case when role_name in ('admin','head') then role_name end,p_actor,(p_data->>'request_id')::uuid,p_data);
 perform eflow_activation.audit(p_actor,i,'account.activation_staged');
 return eflow_activation.safe_row(i)||jsonb_build_object('token_hash',i.token_hash);
end $$;

create function public.eflow_reserve_managed_activation_email(p_id uuid,p_hash text) returns boolean language plpgsql security definer set search_path='' as $$
declare i public.user_invitations;
begin
 select * into i from public.user_invitations where id=p_id;
 if i.invitation_type is distinct from 'managed_account' then raise exception 'Invalid activation.' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('eflow.activation.actor:'||i.invited_by::text,0));
 i:=eflow_activation.lock_invite(p_hash);perform eflow_activation.assert_current(i);
 if i.id<>p_id then raise exception 'Invalid activation.';end if;
 if exists(select 1 from eflow_activation.dispatches where invitation_id=i.id and token_hash=p_hash) then return false;end if;
 if i.send_count>=6 or (i.last_sent_at is not null and i.last_sent_at>now()-interval '1 minute') or
 (select count(*) from eflow_activation.dispatches where (actor=i.invited_by or office=i.office_id) and sent_at>now()-interval '1 hour')>=30 then raise exception 'Please wait before resending. Email limit reached.' using errcode='54000';end if;
 insert into eflow_activation.dispatches(invitation_id,token_hash,actor,office) values(i.id,p_hash,i.invited_by,i.office_id);
 update public.user_invitations set send_count=send_count+1,last_sent_at=now(),email_delivery_status='queued' where id=i.id;
 perform eflow_activation.audit(i.invited_by,i,'account.activation_email_attempted');return true;
end $$;
create function public.eflow_managed_activation_delivery(p_id uuid,p_hash text,p_status text,p_message text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','failed') then raise exception 'Invalid delivery status.';end if;
 update public.user_invitations set email_delivery_status=p_status,resend_email_id=p_message,updated_at=now()
 where id=p_id and token_hash=p_hash and invitation_type='managed_account' and status='pending';
end $$;

create function public.eflow_manage_managed_activation(p_actor uuid,p_id uuid,p_action text,p_hash text default null,p_ttl int default 24) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.user_invitations; d public.managed_account_invite_details; prior_claim text;
begin
 perform eflow_activation.require_admin(p_actor);
 perform pg_advisory_xact_lock(hashtextextended('eflow.activation.actor:'||p_actor::text,0));
 select * into i from public.user_invitations where id=p_id and invitation_type='managed_account';
 i:=eflow_activation.lock_invite(i.token_hash);
 perform eflow_activation.require_admin(p_actor,i.office_id);
 if p_action='approve' then
  select * into d from public.managed_account_invite_details where invitation_id=i.id for update;
  if i.status<>'accepted' or d.requested_privileged_role is null then raise exception 'Verify the email before approving this account.' using errcode='22023';end if;
  if d.approved_at is not null then return eflow_activation.safe_row(i);end if;
  perform 1 from public.profiles where id=i.accepted_by and not is_active and role='member' and org_id=i.office_id for update;
  if not found then raise exception 'This account changed. Review it before approval.' using errcode='22023';end if;
  if d.requested_privileged_role='head' then
   perform pg_advisory_xact_lock(hashtextextended('eflow.office_leadership',0));
   perform 1 from public.organizations where id=i.office_id and head_user_id is null for update;
   if not found then raise exception 'This office already has a Head. Review its leadership first.' using errcode='22023';end if;
   update public.profiles set is_active=true where id=i.accepted_by;
   prior_claim:=current_setting('request.jwt.claim.sub',true);
   perform set_config('request.jwt.claim.sub',p_actor::text,true);
   perform public.set_organization_leadership(i.office_id,i.accepted_by,null);
   perform set_config('request.jwt.claim.sub',coalesce(prior_claim,''),true);
  else update public.profiles set role='admin',is_active=true where id=i.accepted_by;end if;
  update public.managed_account_invite_details set approved_by=p_actor,approved_at=now() where invitation_id=i.id;
 elsif p_action='revoke' then
  if i.status='accepted' then raise exception 'This account is activated. Use account deactivation instead.' using errcode='22023';end if;
  update public.user_invitations set status='revoked',revoked_at=coalesce(revoked_at,now()),acceptance_claim=null,acceptance_claimed_at=null where id=i.id returning * into i;
 elsif p_action='resend' then
  if i.status not in ('pending','expired') then raise exception 'This invitation can no longer be resent.' using errcode='22023';end if;
  if i.acceptance_claimed_at>now()-interval '5 minutes' then raise exception 'Activation is in progress. Please wait.' using errcode='54000';end if;
  if i.send_count>=6 or i.last_sent_at>now()-interval '1 minute' then raise exception 'Please wait before resending.' using errcode='54000';end if;
  if p_ttl not between 1 and 168 then raise exception 'Invalid expiry.';end if;
  update public.user_invitations set token_hash=p_hash,expires_at=now()+make_interval(hours=>p_ttl),status='pending',acceptance_claim=null,acceptance_claimed_at=null,email_delivery_status='queued',updated_at=now() where id=i.id returning * into i;
 else raise exception 'Invalid activation action.' using errcode='22023';end if;
 perform eflow_activation.audit(p_actor,i,'account.activation_'||p_action);
 return eflow_activation.safe_row(i)||case when p_action='resend' then jsonb_build_object('token_hash',i.token_hash) else '{}'::jsonb end;
end $$;

create function public.eflow_managed_activation_limit(p_key text,p_max int) returns void language plpgsql security definer set search_path='' as $$
declare count_now int;
begin
 if length(p_key)>150 or p_max not between 1 and 60 then raise exception 'Invalid rate limit.';end if;
 insert into eflow_activation.request_limits values(p_key,clock_timestamp(),1) on conflict(key) do update
 set hits=case when request_limits.window_start<clock_timestamp()-interval '1 minute' then 1 else request_limits.hits+1 end,
 window_start=case when request_limits.window_start<clock_timestamp()-interval '1 minute' then clock_timestamp() else request_limits.window_start end returning hits into count_now;
 if count_now>p_max then raise exception 'Please wait before trying again.' using errcode='54000';end if;
 delete from eflow_activation.request_limits where window_start<now()-interval '1 day';
end $$;
create function public.eflow_validate_managed_activation(p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.user_invitations;
begin
 i:=eflow_activation.lock_invite(p_hash);perform eflow_activation.assert_current(i);
 return (eflow_activation.safe_row(i))-array['invitation_id','source_mode','status','email_delivery_status','last_sent_at','created_at','awaiting_authority','needs_reconciliation'];
end $$;
create function public.eflow_claim_managed_activation(p_hash text,p_claim uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.user_invitations; d public.managed_account_invite_details; u auth.users;
begin
 i:=eflow_activation.lock_invite(p_hash);
 select * into d from public.managed_account_invite_details where invitation_id=i.id;
 if i.status='accepted' and d.completion_claim=p_claim then return jsonb_build_object('accepted',true,'next_step',case when d.requested_privileged_role is not null and d.approved_at is null then 'awaiting_authority' else 'sign_in' end);end if;
 perform eflow_activation.assert_current(i);
 if p_claim is null or (i.acceptance_claim is not null and i.acceptance_claim<>p_claim and i.acceptance_claimed_at>now()-interval '5 minutes') then raise exception 'Activation is already in progress. Please wait.' using errcode='54000';end if;
 select * into u from auth.users where lower(btrim(email))=i.email_normalized;
 if found and d.reconciliation_claim=p_claim then raise exception 'Account cleanup is pending. Contact Admin before retrying.' using errcode='22023';end if;
 if found and (u.raw_app_meta_data->>'eflow_activation' is distinct from i.id::text or u.raw_app_meta_data->>'eflow_activation_attempt' is distinct from p_claim::text or exists(select 1 from public.profiles where id=u.id)) then raise exception 'This email needs Admin review.' using errcode='23505';end if;
 if u.id is null then update public.managed_account_invite_details set reconciliation_claim=null where invitation_id=i.id;end if;
 update public.user_invitations set acceptance_claim=p_claim,acceptance_claimed_at=now() where id=i.id;
 return jsonb_build_object('invitation_id',i.id,'email',i.email_normalized,'auth_user_id',u.id,'accepted',false);
end $$;
create function public.eflow_complete_managed_activation(p_hash text,p_claim uuid,p_auth_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.user_invitations; d public.managed_account_invite_details; u auth.users;
begin
 i:=eflow_activation.lock_invite(p_hash);
 select * into d from public.managed_account_invite_details where invitation_id=i.id for update;
 if i.status='accepted' and d.completion_claim=p_claim and i.accepted_by=p_auth_user then return jsonb_build_object('activated',true,'next_step',case when d.requested_privileged_role is not null and d.approved_at is null then 'awaiting_authority' else 'sign_in' end);end if;
 perform eflow_activation.assert_current(i);
 if i.acceptance_claim is distinct from p_claim or d.reconciliation_claim=p_claim or i.acceptance_claimed_at<now()-interval '5 minutes' then raise exception 'Activation attempt expired. Reopen your email link.' using errcode='22023';end if;
 select * into u from auth.users where id=p_auth_user for update;
 if not found or lower(btrim(u.email))<>i.email_normalized or u.email_confirmed_at is null or u.raw_app_meta_data->>'eflow_activation' is distinct from i.id::text or u.raw_app_meta_data->>'eflow_activation_attempt' is distinct from p_claim::text then raise exception 'This identity does not match the invitation.' using errcode='42501';end if;
 if exists(select 1 from public.profiles where id=u.id or lower(btrim(email))=i.email_normalized) then raise exception 'An account with this email already exists.' using errcode='23505';end if;
 insert into public.profiles(id,full_name,email,employee_id,org_id,role,skills,is_active)
 values(u.id,d.full_name,i.email_normalized,'UNASSIGNED-'||u.id::text,i.office_id,i.account_role,d.skills,d.requested_privileged_role is null);
 insert into public.organization_memberships(organization_id,user_id,created_by) values(i.office_id,u.id,i.invited_by);
 if d.employee_notes is not null then
  insert into public.employee_notes(profile_id,strengths,weaknesses,notes,tags,updated_by)
  values(u.id,coalesce(d.employee_notes->>'strengths',''),coalesce(d.employee_notes->>'weaknesses',''),coalesce(d.employee_notes->>'notes',''),array(select jsonb_array_elements_text(coalesce(d.employee_notes->'tags','[]'))),i.invited_by);
 end if;
 insert into public.user_onboarding(user_id,tour_key) values(u.id,'member-web-v1');
 update public.user_invitations set status='accepted',accepted_by=u.id,accepted_at=now(),acceptance_claim=null,acceptance_claimed_at=null where id=i.id returning * into i;
 update public.managed_account_invite_details set completion_claim=p_claim where invitation_id=i.id;
 perform eflow_activation.audit(u.id,i,'account.activation_completed');
 return jsonb_build_object('activated',true,'next_step',case when d.requested_privileged_role is not null then 'awaiting_authority' else 'sign_in' end);
end $$;

-- Serialize timeout reconciliation against completion. A plain SELECT could
-- observe the old pending version while a completion transaction was committing.
create function public.eflow_reconcile_managed_activation(p_id uuid,p_claim uuid,p_auth_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.user_invitations; d public.managed_account_invite_details; u auth.users;
begin
 select * into i from public.user_invitations where id=p_id and invitation_type='managed_account';
 i:=eflow_activation.lock_invite(i.token_hash);
 select * into d from public.managed_account_invite_details where invitation_id=i.id for update;
 if i.status='accepted' then
  if d.completion_claim=p_claim and i.accepted_by=p_auth_user then return jsonb_build_object('accepted',true,'next_step',case when d.requested_privileged_role is not null and d.approved_at is null then 'awaiting_authority' else 'sign_in' end);end if;
  raise exception 'Account completion needs Admin review.' using errcode='22023';
 end if;
 select * into u from auth.users where id=p_auth_user for update;
 if not found or u.raw_app_meta_data->>'eflow_activation' is distinct from p_id::text or u.raw_app_meta_data->>'eflow_activation_attempt' is distinct from p_claim::text or exists(select 1 from public.profiles where id=p_auth_user) then raise exception 'Account completion needs Admin review.' using errcode='22023';end if;
 update public.managed_account_invite_details set reconciliation_claim=p_claim where invitation_id=i.id;
 update public.user_invitations set acceptance_claim=null,acceptance_claimed_at=null where id=i.id and acceptance_claim=p_claim;
 perform eflow_activation.audit(i.invited_by,i,'account.activation_cleanup_required');
 return jsonb_build_object('accepted',false,'discard_created_identity',true);
end $$;

-- Explicit grants: no browser can call these service-only business operations.
revoke all on all functions in schema eflow_activation from public,anon,authenticated;
do $$ declare f record;begin
 for f in select p.oid::regprocedure as identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('eflow_managed_account_options','eflow_list_managed_activations','eflow_create_managed_activation','eflow_reserve_managed_activation_email','eflow_managed_activation_delivery','eflow_manage_managed_activation','eflow_managed_activation_limit','eflow_validate_managed_activation','eflow_claim_managed_activation','eflow_complete_managed_activation','eflow_reconcile_managed_activation') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.identity);
  execute format('grant execute on function %s to service_role',f.identity);
 end loop;
end $$;

-- Reject managed-account tokens on every legacy Office/project entry point.
CREATE OR REPLACE FUNCTION public.phase2_manage_invitation(p_actor uuid, p_id uuid, p_action text, p_hash text DEFAULT NULL::text, p_ttl integer DEFAULT 168)
 RETURNS user_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.user_invitations where id=p_id and invitation_type='managed_account') then raise exception 'Use account activation for this invitation.' using errcode='22023';end if;
 perform eflow_phase65.require_local_invitation(p_id,p_actor);
 return eflow_phase65.baseline_phase2_manage_invitation(p_actor,p_id,p_action,p_hash,p_ttl);
end $function$;

CREATE OR REPLACE FUNCTION public.phase2_accept_invitation(p_hash text, p_user uuid, p_name text, p_claim uuid DEFAULT NULL::uuid)
 RETURNS profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.user_invitations where token_hash=p_hash and invitation_type='managed_account') then raise exception 'Use account activation for this invitation.' using errcode='22023';end if;
 if exists(select 1 from public.user_invitations where token_hash=p_hash and invitation_type='project_office_identity') then return eflow_phase65.accept_local(p_hash,p_user,p_name,p_claim);end if;
 return eflow_phase65.baseline_phase2_accept_invitation(p_hash,p_user,p_name,p_claim);
end $function$;

CREATE OR REPLACE FUNCTION public.phase2_claim_invitation(p_hash text, p_claim uuid)
 RETURNS user_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare inv public.user_invitations;begin
 if exists(select 1 from public.user_invitations where token_hash=p_hash and invitation_type='managed_account') then raise exception 'Use account activation for this invitation.' using errcode='22023';end if;
 select * into inv from public.user_invitations where token_hash=p_hash;
 perform eflow_phase65.require_local_invitation(inv.id,inv.invited_by);
 return eflow_phase65.baseline_phase2_claim_invitation(p_hash,p_claim);
end $function$;

CREATE OR REPLACE FUNCTION public.phase2_reserve_invitation_email(p_id uuid, p_hash text)
 RETURNS user_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare inv public.user_invitations;begin
 if exists(select 1 from public.user_invitations where id=p_id and invitation_type='managed_account') then raise exception 'Use account activation for this invitation.' using errcode='22023';end if;
 select * into inv from public.user_invitations where id=p_id;
 perform eflow_phase65.require_local_invitation(inv.id,inv.invited_by);
 return eflow_phase65.baseline_phase2_reserve_invitation_email(p_id,p_hash);
end $function$;


