-- Additive Phase 2 foundation. Apply after canonical Phase 1 authority.
begin;
do $$ begin
 if exists(select 1 from public.profiles where role not in ('admin','head','member','accounting_staff')) then
  raise exception 'Apply Phase 1 canonical roles before Phase 2';
 end if;
end $$;

create table public.user_invitations (
 id uuid primary key default gen_random_uuid(), email text not null,
 email_normalized text not null check(email_normalized=lower(btrim(email))),
 invited_by uuid not null references public.profiles(id), office_id uuid not null references public.organizations(id),
 account_role text not null check(account_role in ('member','accounting_staff')),
 invitation_type text not null default 'office_member' check(invitation_type='office_member'),
 status text not null default 'pending' check(status in ('pending','accepted','expired','revoked')),
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null, accepted_by uuid references public.profiles(id), accepted_at timestamptz,
 revoked_at timestamptz, last_sent_at timestamptz, send_count integer not null default 0 check(send_count>=0),
 email_delivery_status text check(email_delivery_status in ('queued','sent','delivered','bounced','failed')),
 resend_email_id text, acceptance_claim uuid, acceptance_claimed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((status='accepted')=(accepted_by is not null and accepted_at is not null))
);
create unique index user_invitations_one_pending on public.user_invitations(email_normalized,office_id) where status='pending';
create index user_invitations_office_created on public.user_invitations(office_id,created_at desc);
create index user_invitations_inviter_created on public.user_invitations(invited_by,created_at desc);

create table public.user_onboarding (
 user_id uuid not null references public.profiles(id) on delete cascade, tour_key text not null,
 tour_version integer not null default 1 check(tour_version>0),
 status text not null default 'not_started' check(status in ('not_started','in_progress','completed','dismissed')),
 current_step text, state jsonb not null default '{}' check(jsonb_typeof(state)='object'),
 started_at timestamptz, completed_at timestamptz, dismissed_at timestamptz,
 updated_at timestamptz not null default now(), primary key(user_id,tour_key)
);
create table public.user_pds_documents (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
 invitation_id uuid references public.user_invitations(id), office_id uuid not null references public.organizations(id),
 storage_path text not null unique, original_filename text not null, mime_type text not null check(mime_type='application/pdf'),
 file_size bigint not null check(file_size between 1 and 10485760), uploaded_by uuid not null references public.profiles(id),
 processing_status text not null default 'pending' check(processing_status in ('pending','processing','completed','failed')),
 extraction_version integer not null default 1, processing_error text, professional_draft jsonb, processing_started_at timestamptz,
 content_sha256 text not null, created_at timestamptz not null default now(), processed_at timestamptz,
 check(user_id is not null or invitation_id is not null)
);
create index user_pds_documents_user on public.user_pds_documents(user_id,created_at desc);
create index user_pds_documents_invitation on public.user_pds_documents(invitation_id);
create index user_pds_documents_pending on public.user_pds_documents(processing_status,created_at) where processing_status in ('pending','processing');
create table public.user_professional_profiles (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 skills jsonb not null default '[]' check(jsonb_typeof(skills)='array'),
 education jsonb not null default '[]' check(jsonb_typeof(education)='array'),
 trainings jsonb not null default '[]' check(jsonb_typeof(trainings)='array'),
 certifications jsonb not null default '[]' check(jsonb_typeof(certifications)='array'),
 work_experience jsonb not null default '[]' check(jsonb_typeof(work_experience)='array'),
 specializations jsonb not null default '[]' check(jsonb_typeof(specializations)='array'),
 competency_summary text not null default '', source text not null default 'manual',
 source_document_id uuid references public.user_pds_documents(id), extraction_version integer not null default 1,
 confirmed_by_user boolean not null default false, confirmed_at timestamptz,
 last_extracted_at timestamptz, updated_at timestamptz not null default now(),
 check(confirmed_by_user=(confirmed_at is not null))
);

create function public.phase2_is_office_head(p_user uuid,p_office uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.organizations o on o.id=p.org_id
 where p.id=p_user and p.role='head' and p.is_active and o.is_active and o.id=p_office and o.head_user_id=p.id);
$$;
revoke all on function public.phase2_is_office_head(uuid,uuid) from public,anon;
grant execute on function public.phase2_is_office_head(uuid,uuid) to authenticated,service_role;

alter table public.user_invitations enable row level security;
alter table public.user_onboarding enable row level security;
alter table public.user_pds_documents enable row level security;
alter table public.user_professional_profiles enable row level security;
revoke all on public.user_invitations,public.user_onboarding,public.user_pds_documents,public.user_professional_profiles from public,anon,authenticated;
grant all on public.user_invitations,public.user_onboarding,public.user_pds_documents,public.user_professional_profiles to service_role;
-- Tokens and acceptance claims never appear in browser-facing table grants.
grant select(id,email,email_normalized,invited_by,office_id,account_role,invitation_type,status,expires_at,accepted_by,accepted_at,revoked_at,last_sent_at,send_count,email_delivery_status,resend_email_id,created_at,updated_at) on public.user_invitations to authenticated;
grant select on public.user_onboarding,public.user_professional_profiles to authenticated;
grant select(id,user_id,invitation_id,office_id,original_filename,mime_type,file_size,uploaded_by,processing_status,extraction_version,processing_error,created_at,processed_at) on public.user_pds_documents to authenticated;
create policy invitations_office_read on public.user_invitations for select to authenticated
 using(public.phase2_is_office_head(auth.uid(),office_id) or public.is_admin(auth.uid()));
create policy onboarding_own_read on public.user_onboarding for select to authenticated using(user_id=auth.uid());
create policy pds_metadata_own_read on public.user_pds_documents for select to authenticated
 using(user_id=auth.uid() or (uploaded_by=auth.uid() and public.phase2_is_office_head(auth.uid(),office_id)));
create policy professional_profile_read on public.user_professional_profiles for select to authenticated
 using(user_id=auth.uid() or (confirmed_by_user and exists(select 1 from public.profiles p where p.id=user_id and p.is_active and public.phase2_is_office_head(auth.uid(),p.org_id))));

create function public.phase2_audit(p_actor uuid,p_office uuid,p_subject uuid,p_action text) returns void
language sql security definer set search_path='' as $$
 insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,org_id,after_data)
 select p_actor,coalesce(p.full_name,''),'account',p_subject::text,p_action,p_office,jsonb_build_object('resourceId',p_subject,'officeId',p_office)
 from public.profiles p where p.id=p_actor;
$$;

create function public.phase2_invitation_conflict(p_email text,p_office uuid) returns text
language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where lower(btrim(email))=lower(btrim(p_email));
 if not found then return null; end if;
 if p.is_active is distinct from true then return 'This account is deactivated. Contact Admin.'; end if;
 if p.role in ('admin','head') then return 'Head and Admin accounts require Admin account management.'; end if;
 if p.org_id=p_office then return 'This user is already a member of your Office.'; end if;
 if p.org_id is not null then return 'This account already belongs to another Office. Contact Admin.'; end if;
 return null;
end $$;

create function public.phase2_create_invitation(p_actor uuid,p_email text,p_role text,p_hash text,p_ttl integer)
returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare office uuid; conflict text; item public.user_invitations;
begin
 select org_id into office from public.profiles where id=p_actor;
 if not public.phase2_is_office_head(p_actor,office) then raise exception 'Only the appointed active Office Head may invite' using errcode='42501'; end if;
 if p_role not in ('member','accounting_staff') then raise exception 'Head may invite only Member or Accounting Staff' using errcode='42501'; end if;
 if p_role='accounting_staff' and not exists(select 1 from public.organizations where id=office and org_type='department') then raise exception 'Accounting Staff requires an operational Office' using errcode='42501'; end if;
 if p_ttl not between 1 and 720 or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid invitation details' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase2-invite:'||office::text,0));
 if (select count(*) from public.user_invitations where invited_by=p_actor and created_at>now()-interval '1 hour')>=20 or
 (select count(*) from public.user_invitations where office_id=office and created_at>now()-interval '1 hour')>=40 then
  raise exception 'Invitation limit reached. Please try again later.' using errcode='P0001';
 end if;
 conflict:=public.phase2_invitation_conflict(p_email,office);
 if conflict is not null then raise exception '%',conflict using errcode='22023'; end if;
 update public.user_invitations set status='expired',updated_at=now() where email_normalized=lower(btrim(p_email)) and office_id=office and status='pending' and expires_at<=now();
 if exists(select 1 from public.user_invitations where email_normalized=lower(btrim(p_email)) and office_id=office and status='pending') then raise exception 'Invitation already pending. Resend or revoke it.' using errcode='23505'; end if;
 insert into public.user_invitations(email,email_normalized,invited_by,office_id,account_role,token_hash,expires_at,email_delivery_status)
 values(lower(btrim(p_email)),lower(btrim(p_email)),p_actor,office,p_role,p_hash,now()+p_ttl*interval '1 hour','queued') returning * into item;
 perform public.phase2_audit(p_actor,office,item.id,'invitation_created');
 return item;
end $$;

create function public.phase2_manage_invitation(p_actor uuid,p_id uuid,p_action text,p_hash text default null,p_ttl integer default 168)
returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare item public.user_invitations;
begin
 select * into item from public.user_invitations where id=p_id for update;
 if not found or not public.phase2_is_office_head(p_actor,item.office_id) then raise exception 'Office invitation access denied' using errcode='42501'; end if;
 if item.status not in ('pending','expired') then raise exception 'This invitation is no longer pending' using errcode='22023'; end if;
 if item.acceptance_claimed_at>now()-interval '3 minutes' then raise exception 'Acceptance is in progress. Please try again shortly.' using errcode='22023'; end if;
 if p_action='resend' then
  if coalesce(item.last_sent_at,item.updated_at)>now()-interval '60 seconds' then raise exception 'Please wait before resending this invitation again.' using errcode='22023'; end if;
  if item.send_count>=10 then raise exception 'Resend limit reached. Revoke this invitation.' using errcode='22023'; end if;
  if p_ttl not between 1 and 720 then raise exception 'Invalid expiry'; end if;
  update public.user_invitations set token_hash=p_hash,status='pending',expires_at=now()+p_ttl*interval '1 hour',email_delivery_status='queued',resend_email_id=null,acceptance_claim=null,acceptance_claimed_at=null,updated_at=now() where id=p_id returning * into item;
 elsif p_action='revoke' then
  update public.user_invitations set status='revoked',revoked_at=now(),acceptance_claim=null,acceptance_claimed_at=null,updated_at=now() where id=p_id returning * into item;
 else raise exception 'Unknown invitation action'; end if;
 perform public.phase2_audit(p_actor,item.office_id,item.id,case when p_action='resend' then 'invitation_resent' else 'invitation_revoked' end);
 return item;
end $$;

create function public.phase2_claim_invitation(p_hash text,p_claim uuid) returns public.user_invitations
language plpgsql security definer set search_path='' as $$
declare item public.user_invitations;
begin
 select * into item from public.user_invitations where token_hash=p_hash for update;
 if not found or item.status<>'pending' or item.expires_at<=now() then raise exception 'Invitation expired, revoked, or invalid' using errcode='22023'; end if;
 if not public.phase2_is_office_head(item.invited_by,item.office_id) then raise exception 'Inviter no longer leads this Office. Request a new invitation.' using errcode='42501'; end if;
 if item.acceptance_claim is not null and item.acceptance_claim<>p_claim and item.acceptance_claimed_at>now()-interval '3 minutes' then raise exception 'Acceptance is already in progress' using errcode='22023'; end if;
 update public.user_invitations set acceptance_claim=p_claim,acceptance_claimed_at=now() where id=item.id returning * into item;
 return item;
end $$;

create function public.phase2_accept_invitation(p_hash text,p_user uuid,p_name text,p_claim uuid default null)
returns public.profiles language plpgsql security definer set search_path='' as $$
declare item public.user_invitations; profile public.profiles; identity_email text; tour text; draft jsonb;
begin
 select * into item from public.user_invitations where token_hash=p_hash for update;
 select lower(btrim(email)) into identity_email from auth.users where id=p_user and email_confirmed_at is not null;
 if not found or identity_email is null or identity_email is distinct from item.email_normalized then raise exception 'Sign in with the invited verified email' using errcode='42501'; end if;
 if item.status='accepted' and item.accepted_by=p_user then select * into profile from public.profiles where id=p_user; return profile; end if;
 if item.id is null or item.status<>'pending' or item.expires_at<=now() then raise exception 'Invitation expired, revoked, or invalid' using errcode='22023'; end if;
 if not public.phase2_is_office_head(item.invited_by,item.office_id) then raise exception 'Inviter no longer leads this Office' using errcode='42501'; end if;
 if item.acceptance_claim is not null and item.acceptance_claim is distinct from p_claim and item.acceptance_claimed_at>now()-interval '3 minutes' then raise exception 'Acceptance is already in progress' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phase2-user:'||p_user::text,0));
 select * into profile from public.profiles where id=p_user for update;
 if found then
  if profile.is_active is distinct from true or profile.role in ('admin','head') or (profile.org_id is not null and profile.org_id<>item.office_id) or (profile.org_id=item.office_id and profile.role<>item.account_role) then raise exception 'This identity requires Admin resolution' using errcode='42501'; end if;
  update public.profiles set org_id=item.office_id,role=item.account_role,updated_at=now() where id=p_user returning * into profile;
 else
  if length(btrim(p_name)) not between 2 and 160 then raise exception 'Enter your full name' using errcode='22023'; end if;
  insert into public.profiles(id,full_name,email,employee_id,org_id,role,is_active)
  values(p_user,btrim(p_name),identity_email,'INV-'||p_user::text,item.office_id,item.account_role,true) returning * into profile;
 end if;
 insert into public.organization_memberships(organization_id,user_id,membership_role,created_by)
 values(item.office_id,p_user,'member',item.invited_by) on conflict(organization_id,user_id) do nothing;
 update public.user_invitations set status='accepted',accepted_by=p_user,accepted_at=now(),acceptance_claim=null,acceptance_claimed_at=null,updated_at=now() where id=item.id;
 update public.user_pds_documents set user_id=p_user where invitation_id=item.id;
 select professional_draft into draft from public.user_pds_documents where invitation_id=item.id and processing_status='completed' order by created_at desc limit 1;
 if draft is not null then
  insert into public.user_professional_profiles(user_id,skills,education,trainings,certifications,work_experience,specializations,competency_summary,source,source_document_id,last_extracted_at)
  select p_user,coalesce(draft->'skills','[]'),coalesce(draft->'education','[]'),coalesce(draft->'trainings','[]'),coalesce(draft->'certifications','[]'),coalesce(draft->'work_experience','[]'),coalesce(draft->'specializations','[]'),coalesce(draft->>'competency_summary',''),'pds',d.id,now()
  from public.user_pds_documents d where invitation_id=item.id and processing_status='completed' order by created_at desc limit 1
  on conflict(user_id) do nothing;
 end if;
 tour:=case when item.account_role='accounting_staff' then 'accounting-web-v1' else 'member-web-v1' end;
 insert into public.user_onboarding(user_id,tour_key) values(p_user,tour) on conflict do nothing;
 insert into public.notifications(user_id,type,title,message,actor_id,actor_name) values
 (p_user,'office_invitation','Welcome to your Office','Your eFlow account is ready.',item.invited_by,''),
 (item.invited_by,'office_invitation_accepted','Invitation accepted',profile.full_name||' joined your Office.',p_user,profile.full_name);
 perform public.phase2_audit(p_user,item.office_id,item.id,'invitation_accepted');
 return profile;
end $$;

-- All business mutation RPCs are gateway-only; caller IDs are not browser authority.
revoke all on function public.phase2_audit(uuid,uuid,uuid,text),public.phase2_invitation_conflict(text,uuid),public.phase2_create_invitation(uuid,text,text,text,integer),public.phase2_manage_invitation(uuid,uuid,text,text,integer),public.phase2_claim_invitation(text,uuid),public.phase2_accept_invitation(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.phase2_audit(uuid,uuid,uuid,text),public.phase2_invitation_conflict(text,uuid),public.phase2_create_invitation(uuid,text,text,text,integer),public.phase2_manage_invitation(uuid,uuid,text,text,integer),public.phase2_claim_invitation(text,uuid),public.phase2_accept_invitation(text,uuid,text,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pds-documents','pds-documents',false,10485760,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];
-- No browser Storage policy is added: upload/download goes through authorized gateway routes.
create function public.phase2_claim_pds_job() returns setof public.user_pds_documents
language sql security definer set search_path='' as $$
 update public.user_pds_documents set processing_status='processing',processing_started_at=now(),processing_error=null
 where id=(select id from public.user_pds_documents
 where processing_status='pending' or (processing_status='processing' and processing_started_at<now()-interval '10 minutes')
 order by created_at for update skip locked limit 1) returning *;
$$;
revoke all on function public.phase2_claim_pds_job() from public,anon,authenticated;
grant execute on function public.phase2_claim_pds_job() to service_role;
create function public.phase2_identity_exists(p_email text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where lower(btrim(email))=lower(btrim(p_email)));
$$;
revoke all on function public.phase2_identity_exists(text) from public,anon,authenticated;
grant execute on function public.phase2_identity_exists(text) to service_role;

-- Merge checklist and tour patches under one row lock, avoiding lost updates.
create function public.phase2_save_onboarding(p_user uuid,p_key text,p_patch jsonb) returns public.user_onboarding
language plpgsql security definer set search_path='' as $$
declare item public.user_onboarding; office uuid; previous text;
begin
 insert into public.user_onboarding(user_id,tour_key) values(p_user,p_key) on conflict do nothing;
 select * into item from public.user_onboarding where user_id=p_user and tour_key=p_key for update;
 previous:=item.status;
 update public.user_onboarding set
  state=state || (p_patch-'status'-'current_step'),
  status=coalesce(p_patch->>'status',status),
  current_step=coalesce(p_patch->>'current_step',current_step),
  started_at=case when p_patch->>'status'='in_progress' then coalesce(started_at,now()) else started_at end,
  completed_at=case when p_patch ? 'status' then case when p_patch->>'status'='completed' then now() else null end else completed_at end,
  dismissed_at=case when p_patch ? 'status' then case when p_patch->>'status'='dismissed' then now() else null end else dismissed_at end,
  updated_at=now()
 where user_id=p_user and tour_key=p_key returning * into item;
 if item.status<>previous and item.status in ('in_progress','completed','dismissed') then
  select org_id into office from public.profiles where id=p_user;
  perform public.phase2_audit(p_user,office,p_user,'onboarding_'||case when item.status='in_progress' then 'started' else item.status end);
 end if;
 return item;
end $$;
revoke all on function public.phase2_save_onboarding(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.phase2_save_onboarding(uuid,text,jsonb) to service_role;
commit;
