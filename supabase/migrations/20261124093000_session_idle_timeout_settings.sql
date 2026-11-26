-- Add Admin-configurable session inactivity timeout & warning lead settings to system_config
insert into public.system_config (key, value, updated_at)
values
  ('session_idle_timeout_minutes', '60', now()),
  ('session_warning_lead_minutes', '5', now())
on conflict (key) do nothing;

-- Allow all authenticated sessions to read the active session timeout policy (non-destructive alter)
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'system_config'
      and policyname = 'system_config_read_public_settings'
  ) then
    alter policy system_config_read_public_settings on public.system_config
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
          'due_soon_days',
          'session_idle_timeout_minutes',
          'session_warning_lead_minutes'
        ])
      );
  else
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
          'due_soon_days',
          'session_idle_timeout_minutes',
          'session_warning_lead_minutes'
        ])
      );
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
security invoker
set search_path = ''
as $$
declare
  current_values jsonb;
  receipt record;
  caller uuid := auth.uid();
  v_support text;
  v_timeout_raw text;
  v_warning_raw text;
  v_timeout_min integer;
  v_warning_min integer;
begin
  if caller is null or not public.has_permission(caller, 'settings.manage') then
    raise exception 'The settings.manage capability is required' using errcode = '42501';
  end if;

  if p_request is null
     or jsonb_typeof(p_values) is distinct from 'object'
     or jsonb_typeof(p_expected) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(p_values)) <> 10
     or not (p_values ?& array[
       'organization_name',
       'organization_subtitle',
       'support_email',
       'activation_expiry_hours',
       'default_email_notifications_enabled',
       'maintenance_banner_enabled',
       'maintenance_banner_message',
       'due_soon_days',
       'session_idle_timeout_minutes',
       'session_warning_lead_minutes'
     ])
     or jsonb_typeof(p_values->'organization_name') is distinct from 'string'
     or jsonb_typeof(p_values->'organization_subtitle') is distinct from 'string'
     or jsonb_typeof(p_values->'support_email') is distinct from 'string'
     or jsonb_typeof(p_values->'activation_expiry_hours') is distinct from 'string'
     or jsonb_typeof(p_values->'default_email_notifications_enabled') is distinct from 'string'
     or jsonb_typeof(p_values->'maintenance_banner_enabled') is distinct from 'string'
     or jsonb_typeof(p_values->'maintenance_banner_message') is distinct from 'string'
     or jsonb_typeof(p_values->'due_soon_days') is distinct from 'string'
     or jsonb_typeof(p_values->'session_idle_timeout_minutes') is distinct from 'string'
     or jsonb_typeof(p_values->'session_warning_lead_minutes') is distinct from 'string' then
    raise exception 'Invalid general settings payload' using errcode = '22023';
  end if;

  v_support := btrim(p_values->>'support_email');
  v_timeout_raw := btrim(p_values->>'session_idle_timeout_minutes');
  v_warning_raw := btrim(p_values->>'session_warning_lead_minutes');

  if v_timeout_raw !~ '^[0-9]{1,3}$' or v_warning_raw !~ '^[0-9]{1,2}$' then
    raise exception 'Session timeout and warning countdown must be whole numbers in minutes.' using errcode = '22023';
  end if;

  v_timeout_min := v_timeout_raw::integer;
  v_warning_min := v_warning_raw::integer;

  if v_timeout_min < 5 or v_timeout_min > 480 then
    raise exception 'Session inactivity timeout must be between 5 and 480 minutes.' using errcode = '22023';
  end if;

  if v_warning_min < 1 or v_warning_min > 30 then
    raise exception 'Session warning countdown must be between 1 and 30 minutes.' using errcode = '22023';
  end if;

  if v_warning_min >= v_timeout_min then
    raise exception 'Session warning countdown must be shorter than the inactivity timeout.' using errcode = '22023';
  end if;

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
    'due_soon_days', coalesce((select value from public.system_config where key = 'due_soon_days'), '3'),
    'session_idle_timeout_minutes', coalesce((select value from public.system_config where key = 'session_idle_timeout_minutes'), '60'),
    'session_warning_lead_minutes', coalesce((select value from public.system_config where key = 'session_warning_lead_minutes'), '5')
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
