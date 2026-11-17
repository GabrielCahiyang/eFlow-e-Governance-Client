insert into public.system_config (key, value, updated_at)
values
  ('organization_subtitle', '', now()),
  ('support_email', '', now()),
  ('activation_expiry_hours', '24', now()),
  ('default_email_notifications_enabled', 'true', now()),
  ('maintenance_banner_enabled', 'false', now()),
  ('maintenance_banner_message', '', now()),
  ('due_soon_days', '3', now())
on conflict (key) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_config'
      and policyname = 'system_config_read_public_settings'
  ) then
    create policy system_config_read_public_settings on public.system_config
      for select to authenticated
      using (
        (select auth.uid()) is not null
        and key = any (array[
          'organization_name',
          'app_version',
          'organization_subtitle',
          'support_email',
          'activation_expiry_hours',
          'default_email_notifications_enabled',
          'maintenance_banner_enabled',
          'maintenance_banner_message',
          'due_soon_days'
        ])
      );
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'system_config'
     ) then
    alter publication supabase_realtime add table public.system_config;
  end if;
end;
$$;

create or replace function public.save_general_system_settings(
  p_request uuid,
  p_expected jsonb,
  p_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_values jsonb;
  receipt record;
  caller uuid := auth.uid();
  v_support text;
begin
  if caller is null or not public.has_permission(caller, 'settings.manage') then
    raise exception 'The settings.manage capability is required' using errcode = '42501';
  end if;

  if p_request is null
     or jsonb_typeof(p_values) is distinct from 'object'
     or jsonb_typeof(p_expected) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_values)) <> 8
     or not (p_values ?& array[
       'organization_name',
       'organization_subtitle',
       'support_email',
       'activation_expiry_hours',
       'default_email_notifications_enabled',
       'maintenance_banner_enabled',
       'maintenance_banner_message',
       'due_soon_days'
     ])
     or jsonb_typeof(p_values->'organization_name') is distinct from 'string'
     or jsonb_typeof(p_values->'organization_subtitle') is distinct from 'string'
     or jsonb_typeof(p_values->'support_email') is distinct from 'string'
     or jsonb_typeof(p_values->'activation_expiry_hours') is distinct from 'string'
     or jsonb_typeof(p_values->'default_email_notifications_enabled') is distinct from 'string'
     or jsonb_typeof(p_values->'maintenance_banner_enabled') is distinct from 'string'
     or jsonb_typeof(p_values->'maintenance_banner_message') is distinct from 'string'
     or jsonb_typeof(p_values->'due_soon_days') is distinct from 'string' then
    raise exception 'Invalid general settings payload' using errcode = '22023';
  end if;

  v_support := btrim(p_values->>'support_email');
  if length(btrim(p_values->>'organization_name')) not between 1 and 120
     or length(p_values->>'organization_name') > 120
     or (p_values->>'organization_name') ~ '[[:cntrl:]]'
     or length(p_values->>'organization_subtitle') > 160
     or (p_values->>'organization_subtitle') ~ '[[:cntrl:]]'
     or (v_support <> '' and (length(v_support) > 254 or v_support !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_support ~ '[[:cntrl:]]'))
     or (p_values->>'activation_expiry_hours') not in ('24', '72', '168')
     or (p_values->>'default_email_notifications_enabled') not in ('true', 'false')
     or (p_values->>'maintenance_banner_enabled') not in ('true', 'false')
     or length(p_values->>'maintenance_banner_message') > 240
     or (p_values->>'maintenance_banner_message') ~ '[[:cntrl:]]'
     or (p_values->>'due_soon_days') not in ('1', '2', '3', '5', '7') then
    raise exception 'Invalid general settings values' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('eflow-general-system-settings', 0));

  select before_data, after_data into receipt
  from public.audit_events
  where actor_id = caller
    and entity_type = 'system_config'
    and action = 'settings.general.updated'
    and metadata->>'request_id' = p_request::text;

  if found then
    if receipt.after_data <> p_values or receipt.before_data <> p_expected then
      raise exception 'This settings request was already used for another change' using errcode = '22023';
    end if;
    return receipt.after_data;
  end if;

  select jsonb_build_object(
    'organization_name', coalesce((select value from public.system_config where key = 'organization_name'), 'LEDIPO'),
    'organization_subtitle', coalesce((select value from public.system_config where key = 'organization_subtitle'), ''),
    'support_email', coalesce((select value from public.system_config where key = 'support_email'), ''),
    'activation_expiry_hours', coalesce((select value from public.system_config where key = 'activation_expiry_hours'), '24'),
    'default_email_notifications_enabled', coalesce((select value from public.system_config where key = 'default_email_notifications_enabled'), 'true'),
    'maintenance_banner_enabled', coalesce((select value from public.system_config where key = 'maintenance_banner_enabled'), 'false'),
    'maintenance_banner_message', coalesce((select value from public.system_config where key = 'maintenance_banner_message'), ''),
    'due_soon_days', coalesce((select value from public.system_config where key = 'due_soon_days'), '3')
  ) into current_values;

  if current_values <> p_expected then
    raise exception 'Settings changed since loading. Reload before saving.' using errcode = '40001';
  end if;

  insert into public.system_config (key, value, updated_at)
  select key, value, now()
  from jsonb_each_text(p_values)
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

  insert into public.audit_events (actor_id, actor_name, entity_type, action, before_data, after_data, metadata)
  select caller, p.full_name, 'system_config', 'settings.general.updated', current_values, p_values,
         jsonb_build_object('request_id', p_request)
  from public.profiles p where p.id = caller;

  return p_values;
end;
$$;

revoke all on function public.save_general_system_settings(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_general_system_settings(uuid, jsonb, jsonb) to authenticated;

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
  v_email_notifications boolean;
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

  v_email_notifications := coalesce(
    (select value <> 'false' from public.system_config where key = 'default_email_notifications_enabled'),
    true
  );

  insert into public.profiles(id, full_name, email, employee_id, org_id, role, custom_role_key, skills, email_notifications_enabled, is_active)
  values(u.id, v_full_name, i.email_normalized, 'UNASSIGNED-' || u.id::text, i.office_id, i.account_role, d.custom_role_key, v_skills, v_email_notifications, d.requested_privileged_role is null);
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
