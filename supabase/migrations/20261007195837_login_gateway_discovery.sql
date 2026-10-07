-- The gateway URL is public routing information; all other settings stay private.
create function public.eflow_login_gateway_endpoint() returns text
language sql stable security definer set search_path = '' as $$
  select value from public.system_config where key = 'ai_endpoint' limit 1
$$;
revoke all on function public.eflow_login_gateway_endpoint() from public;
grant execute on function public.eflow_login_gateway_endpoint() to anon, authenticated, service_role;
