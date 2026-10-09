-- Atomic, validated presentation settings. No source policy or session rules change.
create function public.r12_save_presentation_settings(p_request uuid,p_expected jsonb,p_values jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_values jsonb; receipt record; caller uuid:=auth.uid();
begin
 if caller is null or not public.has_permission(caller,'settings.manage') then
  raise exception 'The settings.manage capability is required' using errcode='42501';
 end if;
 if p_request is null or jsonb_typeof(p_values) is distinct from 'object'
   or jsonb_typeof(p_expected) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_values))<>2
   or not(p_values ?& array['organization_name','app_version'])
   or jsonb_typeof(p_values->'organization_name') is distinct from 'string'
   or jsonb_typeof(p_values->'app_version') is distinct from 'string'
   or length(btrim(p_values->>'organization_name')) not between 1 and 120
   or length(p_values->>'organization_name')>120
   or length(btrim(p_values->>'app_version')) not between 1 and 40
   or (p_values->>'organization_name') ~ '[[:cntrl:]]'
   or (p_values->>'app_version') !~ '^[A-Za-z0-9][A-Za-z0-9._+ -]{0,39}$' then
  raise exception 'Invalid presentation settings' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('r12-presentation-settings',0));
 select before_data,after_data into receipt from public.audit_events
  where actor_id=caller and entity_type='system_config' and action='settings.presentation.updated'
   and metadata->>'request_id'=p_request::text;
 if found then
  if receipt.after_data<>p_values or receipt.before_data<>p_expected then
   raise exception 'This settings request was already used for another change' using errcode='22023';
  end if;
  return receipt.after_data;
 end if;
 select jsonb_build_object('organization_name',(select value from public.system_config where key='organization_name'),
  'app_version',(select value from public.system_config where key='app_version')) into current_values;
 if current_values<>p_expected then
  raise exception 'Settings changed since loading. Reload before saving.' using errcode='40001';
 end if;
 insert into public.system_config(key,value,updated_at)
  select key,value,now() from jsonb_each_text(p_values)
  on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 insert into public.audit_events(actor_id,actor_name,entity_type,action,before_data,after_data,metadata)
  select caller,p.full_name,'system_config','settings.presentation.updated',current_values,p_values,
   jsonb_build_object('request_id',p_request) from public.profiles p where p.id=caller;
 return p_values;
end $$;
revoke all on function public.r12_save_presentation_settings(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.r12_save_presentation_settings(uuid,jsonb,jsonb) to authenticated;
