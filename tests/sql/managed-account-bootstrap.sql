create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb default '{}');
create table public.project_offices(id uuid primary key);create table public.project_office_identities(id uuid primary key);
create table public.organizations("id" uuid default gen_random_uuid() not null,"name" text not null,"slug" text not null,"parent_id" uuid,"path" text not null,"org_type" text not null,"description" text default ''::text,"head_user_id" uuid,"is_active" boolean default true,"created_at" timestamp with time zone default now(),"updated_at" timestamp with time zone default now(),"assistant_head_user_id" uuid);
create table public.profiles("id" uuid not null,"full_name" text not null,"email" text not null,"employee_id" text,"org_id" uuid,"role" text default 'member'::text not null,"skills" jsonb default '{}'::jsonb,"workload" integer default 0,"burnout_level" text default 'low'::text,"is_active" boolean default true,"created_at" timestamp with time zone default now(),"updated_at" timestamp with time zone default now(),"email_notifications_enabled" boolean default true,"avatar_path" text);
create table public.organization_memberships("organization_id" uuid not null,"user_id" uuid not null,"membership_role" text default 'member'::text not null,"created_by" uuid,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null);
create table public.user_invitations("id" uuid default gen_random_uuid() not null,"email" text not null,"email_normalized" text not null,"invited_by" uuid not null,"office_id" uuid not null,"account_role" text not null,"invitation_type" text default 'office_member'::text not null,"status" text default 'pending'::text not null,"token_hash" text not null,"expires_at" timestamp with time zone not null,"accepted_by" uuid,"accepted_at" timestamp with time zone,"revoked_at" timestamp with time zone,"last_sent_at" timestamp with time zone,"send_count" integer default 0 not null,"email_delivery_status" text,"resend_email_id" text,"acceptance_claim" uuid,"acceptance_claimed_at" timestamp with time zone,"created_at" timestamp with time zone default now() not null,"updated_at" timestamp with time zone default now() not null,"project_office_id" uuid,"project_office_identity_id" uuid);
create table public.employee_notes("id" uuid default gen_random_uuid() not null,"profile_id" uuid not null,"strengths" text default ''::text,"weaknesses" text default ''::text,"notes" text default ''::text,"tags" text[] default '{}'::text[],"updated_by" uuid,"updated_at" timestamp with time zone default now());
create table public.user_onboarding("user_id" uuid not null,"tour_key" text not null,"tour_version" integer default 1 not null,"status" text default 'not_started'::text not null,"current_step" text,"state" jsonb default '{}'::jsonb not null,"started_at" timestamp with time zone,"completed_at" timestamp with time zone,"dismissed_at" timestamp with time zone,"updated_at" timestamp with time zone default now() not null);
create table public.audit_events("id" uuid default gen_random_uuid() not null,"actor_id" uuid,"actor_name" text default ''::text,"entity_type" text not null,"entity_id" text,"action" text not null,"reason" text,"before_data" jsonb,"after_data" jsonb,"metadata" jsonb,"org_id" uuid,"created_at" timestamp with time zone default now() not null);
alter table public.organizations add primary key(id);
alter table public.profiles add constraint "profiles_burnout_level_check" CHECK ((burnout_level = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
alter table public.profiles add constraint "profiles_email_key" UNIQUE (email);
alter table public.profiles add constraint "profiles_employee_id_key" UNIQUE (employee_id);
alter table public.profiles add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint "profiles_org_id_fkey" FOREIGN KEY (org_id) REFERENCES organizations(id);
alter table public.profiles add constraint "profiles_pkey" PRIMARY KEY (id);
alter table public.profiles add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'head'::text, 'accounting_staff'::text, 'member'::text])));
alter table public.profiles add constraint "profiles_workload_check" CHECK (((workload >= 0) AND (workload <= 100)));
alter table public.organization_memberships add constraint "organization_memberships_created_by_fkey" FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table public.organization_memberships add constraint "organization_memberships_membership_role_check" CHECK ((membership_role = ANY (ARRAY['member'::text, 'primary_approver'::text, 'backup_approver'::text])));
alter table public.organization_memberships add constraint "organization_memberships_organization_id_fkey" FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table public.organization_memberships add constraint "organization_memberships_pkey" PRIMARY KEY (organization_id, user_id);
alter table public.organization_memberships add constraint "organization_memberships_user_id_fkey" FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.user_invitations add constraint "user_invitations_accepted_by_fkey" FOREIGN KEY (accepted_by) REFERENCES profiles(id);
alter table public.user_invitations add constraint "user_invitations_account_role_check" CHECK ((account_role = ANY (ARRAY['member'::text, 'accounting_staff'::text])));
alter table public.user_invitations add constraint "user_invitations_check" CHECK ((email_normalized = lower(btrim(email))));
alter table public.user_invitations add constraint "user_invitations_check1" CHECK (((status = 'accepted'::text) = ((accepted_by IS NOT NULL) AND (accepted_at IS NOT NULL))));
alter table public.user_invitations add constraint "user_invitations_email_delivery_status_check" CHECK ((email_delivery_status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'bounced'::text, 'failed'::text])));
alter table public.user_invitations add constraint "user_invitations_invitation_type_check" CHECK ((invitation_type = ANY (ARRAY['office_member'::text, 'project_office'::text, 'project_office_identity'::text])));
alter table public.user_invitations add constraint "user_invitations_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES profiles(id);
alter table public.user_invitations add constraint "user_invitations_office_id_fkey" FOREIGN KEY (office_id) REFERENCES organizations(id);
alter table public.user_invitations add constraint "user_invitations_pkey" PRIMARY KEY (id);
alter table public.user_invitations add constraint "user_invitations_project_office_id_fkey" FOREIGN KEY (project_office_id) REFERENCES project_offices(id) ON DELETE CASCADE;
alter table public.user_invitations add constraint "user_invitations_project_office_identity_id_fkey" FOREIGN KEY (project_office_identity_id) REFERENCES project_office_identities(id);
alter table public.user_invitations add constraint "user_invitations_project_scope" CHECK ((((invitation_type = 'office_member'::text) AND (project_office_id IS NULL) AND (project_office_identity_id IS NULL)) OR ((invitation_type = 'project_office'::text) AND (project_office_id IS NOT NULL) AND (project_office_identity_id IS NULL)) OR ((invitation_type = 'project_office_identity'::text) AND (project_office_id IS NULL) AND (project_office_identity_id IS NOT NULL))));
alter table public.user_invitations add constraint "user_invitations_send_count_check" CHECK ((send_count >= 0));
alter table public.user_invitations add constraint "user_invitations_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'expired'::text, 'revoked'::text])));
alter table public.user_invitations add constraint "user_invitations_token_hash_check" CHECK ((token_hash ~ '^[a-f0-9]{64}$'::text));
alter table public.user_invitations add constraint "user_invitations_token_hash_key" UNIQUE (token_hash);
create table public.tasks(org_id uuid,deleted_at timestamptz,status text,review_route_mode text,reviewer_id uuid);
alter table public.user_invitations enable row level security;
grant usage on schema public,auth to authenticated,anon,service_role;
grant select,insert,update,delete on all tables in schema public to authenticated,service_role;
CREATE OR REPLACE FUNCTION public.phase2_manage_invitation(p_actor uuid, p_id uuid, p_action text, p_hash text DEFAULT NULL::text, p_ttl integer DEFAULT 168)
 RETURNS user_invitations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
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
 select * into inv from public.user_invitations where id=p_id;
 perform eflow_phase65.require_local_invitation(inv.id,inv.invited_by);
 return eflow_phase65.baseline_phase2_reserve_invitation_email(p_id,p_hash);
end $function$;

CREATE OR REPLACE FUNCTION public.set_organization_leadership(p_org_id uuid, p_head_user_id uuid DEFAULT NULL::uuid, p_assistant_head_user_id uuid DEFAULT NULL::uuid)
 RETURNS organizations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare caller uuid:=auth.uid(); previous_head uuid; selected_profile public.profiles; updated_org public.organizations;
begin
  if caller is null or not public.is_admin(caller) then raise exception 'Admin access is required' using errcode='42501'; end if;
  if p_assistant_head_user_id is not null then raise exception 'Only one Head may be assigned to an office' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eflow.office_leadership',0));
  select head_user_id into previous_head from public.organizations where id=p_org_id and is_active for update;
  if not found then raise exception 'Office not found or inactive' using errcode='22023'; end if;
  if p_head_user_id is not null then
    select * into selected_profile from public.profiles where id=p_head_user_id for update;
    if not found or not selected_profile.is_active or selected_profile.org_id is distinct from p_org_id or selected_profile.role='admin' then
      raise exception 'Head must already be an active member of this office' using errcode='22023';
    end if;
    if exists(select 1 from public.organizations where id<>p_org_id and head_user_id=p_head_user_id) then
      raise exception 'The selected Head already leads another office' using errcode='22023';
    end if;
  end if;
  update public.organizations set head_user_id=p_head_user_id,updated_at=now() where id=p_org_id returning * into updated_org;
  if p_head_user_id is not null then update public.profiles set role='head',updated_at=now() where id=p_head_user_id; end if;
  if previous_head is not null and previous_head is distinct from p_head_user_id then
    update public.profiles set role='member',updated_at=now() where id=previous_head and role='head'
      and not exists(select 1 from public.organizations where head_user_id=previous_head);
  end if;
  update public.tasks set reviewer_id=reviewer_id where org_id=p_org_id and deleted_at is null
    and status not in ('completed','cancelled') and review_route_mode='organization_default';
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,before_data,after_data,org_id)
    select caller,coalesce(full_name,'Admin'),'organization',p_org_id::text,'organization.leadership_changed',
      jsonb_build_object('headUserId',previous_head),jsonb_build_object('headUserId',p_head_user_id),p_org_id
    from public.profiles where id=caller;
  return updated_org;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(caller_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(select 1 from public.profiles where id = caller_id and is_active and role = 'admin');
$function$;

insert into auth.users(id,email,email_confirmed_at) values('00000000-0000-4000-8000-000000000001','admin@example.test',now()),('00000000-0000-4000-8000-000000000002','member@example.test',now());
insert into public.organizations(id,name,slug,path,org_type) values('10000000-0000-4000-8000-000000000001','LEDIPO','ledipo','ledipo','division');
insert into public.profiles(id,email,full_name,role,org_id) values('00000000-0000-4000-8000-000000000001','admin@example.test','Admin','admin','10000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002','member@example.test','Member','member','10000000-0000-4000-8000-000000000001');
