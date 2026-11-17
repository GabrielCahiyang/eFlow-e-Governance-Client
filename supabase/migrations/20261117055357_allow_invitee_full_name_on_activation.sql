alter table public.managed_account_invite_details
  alter column full_name drop not null,
  drop constraint if exists managed_account_invite_details_full_name_check,
  add constraint managed_account_invite_details_full_name_check
    check (full_name is null or (length(btrim(full_name)) >= 2 and length(btrim(full_name)) <= 160));

create or replace function public.eflow_create_managed_activation(
  p_actor uuid,
  p_data jsonb,
  p_hash text,
  p_ttl integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.user_invitations;
  d public.managed_account_invite_details;
  office uuid;
  v_email text := lower(btrim(p_data->>'email'));
  v_full_name text := nullif(btrim(coalesce(p_data->>'full_name', '')), '');
  role_name text := p_data->>'role';
  v_custom_role text := nullif(btrim(coalesce(p_data->>'custom_role_key', '')), '');
  mode text := p_data->>'mode';
begin
  perform eflow_activation.require_admin(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('eflow.activation.actor:' || p_actor::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('eflow.activation.email:' || v_email, 0));
  if mode = 'ledipo_create' then
    if (select count(*) from public.organizations where slug = 'ledipo' and is_active) <> 1 then
      raise exception 'LEDIPO is unavailable.' using errcode = '22023';
    end if;
    select id into office from public.organizations where slug = 'ledipo' and is_active;
    if nullif(p_data->>'org_id', '')::uuid is distinct from office then
      raise exception 'Choose LEDIPO for this account.' using errcode = '22023';
    end if;
  elsif mode = 'office_invite' then
    office := (p_data->>'org_id')::uuid;
  else
    raise exception 'Invalid account invitation mode.' using errcode = '22023';
  end if;
  if office is null then
    raise exception 'Choose an office.' using errcode = '22023';
  end if;
  perform eflow_activation.require_admin(p_actor, office);
  if role_name not in ('admin', 'head', 'member', 'accounting_staff') or role_name is null or v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 254 or p_ttl not between 1 and 168 then
    raise exception 'Check the account invitation details.' using errcode = '22023';
  end if;
  if v_full_name is not null and (length(v_full_name) < 2 or length(v_full_name) > 160 or v_full_name ~ '[\x00-\x1f\x7f]') then
    raise exception 'Enter a valid full name.' using errcode = '22023';
  end if;
  if v_custom_role is not null then
    perform 1 from public.custom_roles cr where cr.key = v_custom_role and cr.base_role = role_name;
    if not found then
      raise exception 'Selected custom role is no longer available.' using errcode = '22023';
    end if;
  end if;
  select * into d from public.managed_account_invite_details where request_id = (p_data->>'request_id')::uuid;
  if found then
    if d.requested_by <> p_actor or d.request_payload <> p_data then
      raise exception 'This request has different details. Start a new request.' using errcode = '23505';
    end if;
    select * into i from public.user_invitations where id = d.invitation_id;
    return eflow_activation.safe_row(i) || jsonb_build_object('token_hash', i.token_hash);
  end if;
  if exists(select 1 from auth.users u where lower(btrim(u.email)) = v_email) or exists(select 1 from public.profiles p where lower(btrim(p.email)) = v_email) then
    raise exception 'An account with this email already exists. Ask Admin to review it.' using errcode = '23505';
  end if;
  if exists(select 1 from public.user_invitations where email_normalized = v_email and invitation_type = 'managed_account' and status = 'pending') then
    raise exception 'An activation is already pending for this email.' using errcode = '23505';
  end if;
  if (select count(*) from public.user_invitations where invited_by = p_actor and invitation_type = 'managed_account' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Invitation limit reached. Please try later.' using errcode = '54000';
  end if;
  insert into public.user_invitations(email, email_normalized, invited_by, office_id, account_role, invitation_type, token_hash, expires_at, email_delivery_status)
  values(v_email, v_email, p_actor, office, case when role_name in ('admin', 'head') then 'member' else role_name end, 'managed_account', p_hash, now() + make_interval(hours => p_ttl), 'queued')
  returning * into i;
  insert into public.managed_account_invite_details(invitation_id, source_mode, full_name, skills, employee_notes, requested_privileged_role, custom_role_key, requested_by, request_id, request_payload)
  values(i.id, mode, v_full_name, coalesce(p_data->'skills', '{}'), nullif(p_data->'pds_notes', 'null'::jsonb), case when role_name in ('admin', 'head') then role_name end, v_custom_role, p_actor, (p_data->>'request_id')::uuid, p_data);
  perform eflow_activation.audit(p_actor, i, 'account.activation_staged');
  return eflow_activation.safe_row(i) || jsonb_build_object('token_hash', i.token_hash);
end;
$$;

create or replace function public.eflow_complete_managed_activation(
  p_hash text,
  p_claim uuid,
  p_auth_user uuid,
  p_skills jsonb default null,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.user_invitations;
  d public.managed_account_invite_details;
  u auth.users;
  v_skills jsonb;
  v_full_name text;
begin
  i := eflow_activation.lock_invite(p_hash);
  select * into d from public.managed_account_invite_details where invitation_id = i.id for update;
  if i.status = 'accepted' and d.completion_claim = p_claim and i.accepted_by = p_auth_user then
    return jsonb_build_object(
      'activated', true,
      'next_step', case when d.requested_privileged_role is not null and d.approved_at is null then 'awaiting_authority' else 'sign_in' end
    );
  end if;
  perform eflow_activation.assert_current(i);
  if i.acceptance_claim is distinct from p_claim or d.reconciliation_claim = p_claim or i.acceptance_claimed_at < now() - interval '5 minutes' then
    raise exception 'Activation attempt expired. Reopen your email link.' using errcode = '22023';
  end if;
  select * into u from auth.users where id = p_auth_user for update;
  if not found or lower(btrim(u.email)) <> i.email_normalized or u.email_confirmed_at is null or u.raw_app_meta_data->>'eflow_activation' is distinct from i.id::text or u.raw_app_meta_data->>'eflow_activation_attempt' is distinct from p_claim::text then
    raise exception 'This identity does not match the invitation.' using errcode = '42501';
  end if;
  if exists(select 1 from public.profiles where id = u.id or lower(btrim(email)) = i.email_normalized) then
    raise exception 'An account with this email already exists.' using errcode = '23505';
  end if;

  v_full_name := nullif(btrim(coalesce(nullif(btrim(coalesce(p_full_name, '')), ''), d.full_name, '')), '');
  if v_full_name is null or length(v_full_name) < 2 or length(v_full_name) > 160 or v_full_name ~ '[\x00-\x1f\x7f]' then
    raise exception 'Enter your full name (2 to 160 characters).' using errcode = '22023';
  end if;

  v_skills := coalesce(
    case when p_skills is not null and jsonb_typeof(p_skills) = 'object' then p_skills else null end,
    d.skills,
    '{}'::jsonb
  );

  insert into public.profiles(id, full_name, email, employee_id, org_id, role, custom_role_key, skills, is_active)
  values(u.id, v_full_name, i.email_normalized, 'UNASSIGNED-' || u.id::text, i.office_id, i.account_role, d.custom_role_key, v_skills, d.requested_privileged_role is null);
  insert into public.organization_memberships(organization_id, user_id, created_by)
  values(i.office_id, u.id, i.invited_by);
  if d.employee_notes is not null then
    insert into public.employee_notes(profile_id, strengths, weaknesses, notes, tags, updated_by)
    values(u.id, coalesce(d.employee_notes->>'strengths', ''), coalesce(d.employee_notes->>'weaknesses', ''), coalesce(d.employee_notes->>'notes', ''), array(select jsonb_array_elements_text(coalesce(d.employee_notes->'tags', '[]'))), i.invited_by);
  end if;
  insert into public.user_onboarding(user_id, tour_key) values(u.id, 'member-web-v1');
  update public.user_invitations
  set status = 'accepted', accepted_by = u.id, accepted_at = now(), acceptance_claim = null, acceptance_claimed_at = null
  where id = i.id
  returning * into i;
  update public.managed_account_invite_details
  set full_name = v_full_name, completion_claim = p_claim
  where invitation_id = i.id;
  perform eflow_activation.audit(u.id, i, 'account.activation_completed');
  return jsonb_build_object(
    'activated', true,
    'next_step', case when d.requested_privileged_role is not null then 'awaiting_authority' else 'sign_in' end
  );
end;
$$;

revoke all on function public.eflow_complete_managed_activation(text, uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.eflow_complete_managed_activation(text, uuid, uuid, jsonb, text) to service_role;
