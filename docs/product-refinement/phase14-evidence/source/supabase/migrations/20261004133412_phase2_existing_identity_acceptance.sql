begin;
create function public.phase2_profile_exists(p_email text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where lower(btrim(email))=lower(btrim(p_email)));
$$;
revoke all on function public.phase2_profile_exists(text) from public,anon,authenticated;
grant execute on function public.phase2_profile_exists(text) to service_role;
commit;
