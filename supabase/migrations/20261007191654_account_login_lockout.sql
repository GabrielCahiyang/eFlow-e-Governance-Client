-- eFlow login counter, not a Supabase Auth hook. Gateway-only RPCs.
create schema if not exists private;
create table private.eflow_login_settings (
  singleton boolean primary key default true check(singleton),
  max_attempts integer not null default 3 check(max_attempts between 1 and 20),
  updated_at timestamptz not null default now()
);
insert into private.eflow_login_settings(singleton) values(true);
create table private.eflow_login_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0 check(failed_attempts >= 0),
  last_failed_at timestamptz,
  locked_at timestamptz,
  auth_ban_until timestamptz,
  lease uuid,
  lease_until timestamptz
);
create index eflow_login_locked on private.eflow_login_accounts(locked_at) where locked_at is not null;
create table private.eflow_login_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table private.eflow_login_settings enable row level security;
alter table private.eflow_login_accounts enable row level security;
alter table private.eflow_login_audit enable row level security;
revoke all on private.eflow_login_settings, private.eflow_login_accounts, private.eflow_login_audit from public, anon, authenticated;

create function private.eflow_login_begin(p_email text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; account private.eflow_login_accounts; token uuid; maximum integer;
begin
  if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
  select u.id into uid from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(btrim(p_email));
  if uid is null then return jsonb_build_object('status','unknown'); end if;
  insert into private.eflow_login_accounts(user_id) values(uid) on conflict do nothing;
  select * into account from private.eflow_login_accounts where user_id=uid for update;
  select max_attempts into maximum from private.eflow_login_settings where singleton;
  if account.locked_at is not null and (account.auth_ban_until is not null or account.lease_until > now()) then
    return jsonb_build_object('status','locked','user_id',uid);
  end if;
  if account.lease_until > now() then return jsonb_build_object('status','busy'); end if;
  token := gen_random_uuid();
  update private.eflow_login_accounts set lease=token, lease_until=now()+interval '60 seconds' where user_id=uid;
  return jsonb_build_object('status',case when account.locked_at is not null then 'locked' else 'ready' end,
    'user_id',uid,'lease',token,'max_attempts',maximum);
end $$;

create function private.eflow_login_finish(p_user uuid, p_lease uuid, p_outcome text, p_ban_until timestamptz default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare account private.eflow_login_accounts; maximum integer; failures integer;
begin
  if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
  select * into account from private.eflow_login_accounts where user_id=p_user for update;
  if not found or account.lease is distinct from p_lease or account.lease_until <= now() then return jsonb_build_object('status','stale'); end if;
  if p_outcome='ban' and account.locked_at is not null and p_ban_until > now() then
    update private.eflow_login_accounts set auth_ban_until=p_ban_until,lease=null,lease_until=null where user_id=p_user;
    return jsonb_build_object('status','locked');
  end if;
  if account.locked_at is not null then
    update private.eflow_login_accounts set lease=null,lease_until=null where user_id=p_user;
    return jsonb_build_object('status','locked');
  end if;
  if p_outcome='invalid_credentials' then
    select max_attempts into maximum from private.eflow_login_settings where singleton;
    failures := account.failed_attempts+1;
    update private.eflow_login_accounts set failed_attempts=failures,last_failed_at=now(),
      locked_at=case when failures>=maximum then now() end,
      lease=case when failures>=maximum then p_lease end,
      lease_until=case when failures>=maximum then now()+interval '60 seconds' end where user_id=p_user;
    insert into private.eflow_login_audit(user_id,action,details) values(p_user,
      case when failures>=maximum then 'locked' else 'failed_login' end,jsonb_build_object('attempts',failures,'limit',maximum));
    return jsonb_build_object('status',case when failures>=maximum then 'locked' else 'invalid_credentials' end);
  elsif p_outcome='success' then
    update private.eflow_login_accounts set failed_attempts=0,lease=null,lease_until=null where user_id=p_user;
    if account.failed_attempts>0 then insert into private.eflow_login_audit(user_id,action) values(p_user,'counter_reset'); end if;
    return jsonb_build_object('status','success');
  elsif p_outcome='abort' then
    update private.eflow_login_accounts set lease=null,lease_until=null where user_id=p_user;
    return jsonb_build_object('status','aborted');
  end if;
  raise exception 'Invalid login outcome';
end $$;

create function private.eflow_login_admin(p_actor uuid, p_action text, p_user uuid default null, p_limit integer default null, p_lease uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare account private.eflow_login_accounts; token uuid; result jsonb;
begin
  if auth.role() is distinct from 'service_role' or not exists(select 1 from public.profiles where id=p_actor and is_active and role in ('admin','super_admin')) then raise insufficient_privilege; end if;
  if p_action='read' then
    select jsonb_build_object('max_attempts',s.max_attempts,'accounts',coalesce((
      select jsonb_agg(jsonb_build_object('user_id',a.user_id,'email',u.email,'full_name',p.full_name,'role',p.role,
        'failed_attempts',a.failed_attempts,'locked_at',a.locked_at,'last_failed_at',a.last_failed_at) order by a.locked_at desc)
      from private.eflow_login_accounts a join auth.users u on u.id=a.user_id join public.profiles p on p.id=a.user_id
      where a.locked_at is not null),'[]'::jsonb)) into result from private.eflow_login_settings s where singleton;
    return result;
  elsif p_action='settings' then
    if p_limit is null or p_limit not between 1 and 20 then raise exception 'Attempt limit must be between 1 and 20'; end if;
    update private.eflow_login_settings set max_attempts=p_limit,updated_at=now() where singleton;
    insert into private.eflow_login_audit(actor_id,action,details) values(p_actor,'limit_changed',jsonb_build_object('limit',p_limit));
    return jsonb_build_object('max_attempts',p_limit);
  end if;
  select * into account from private.eflow_login_accounts where user_id=p_user for update;
  if not found or account.locked_at is null then return jsonb_build_object('status','not_locked'); end if;
  if p_action='unlock_begin' then
    if account.lease_until > now() then return jsonb_build_object('status','busy'); end if;
    token:=gen_random_uuid();
    update private.eflow_login_accounts set lease=token,lease_until=now()+interval '60 seconds' where user_id=p_user;
    return jsonb_build_object('status','ready','lease',token,'auth_ban_until',account.auth_ban_until);
  elsif p_action='unlock_finish' and account.lease=p_lease and account.lease_until > now() then
    update private.eflow_login_accounts set locked_at=null,failed_attempts=0,auth_ban_until=null,lease=null,lease_until=null where user_id=p_user;
    insert into private.eflow_login_audit(user_id,actor_id,action) values(p_user,p_actor,'unlocked');
    return jsonb_build_object('status','unlocked');
  end if;
  return jsonb_build_object('status','stale');
end $$;

-- Invoker wrappers expose only the gateway service role, never browser clients.
create function public.eflow_login_begin(p_email text) returns jsonb language sql security invoker set search_path='' as $$ select private.eflow_login_begin(p_email) $$;
create function public.eflow_login_finish(p_user uuid,p_lease uuid,p_outcome text,p_ban_until timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$ select private.eflow_login_finish(p_user,p_lease,p_outcome,p_ban_until) $$;
create function public.eflow_login_admin(p_actor uuid,p_action text,p_user uuid default null,p_limit integer default null,p_lease uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select private.eflow_login_admin(p_actor,p_action,p_user,p_limit,p_lease) $$;
revoke all on function private.eflow_login_begin(text),private.eflow_login_finish(uuid,uuid,text,timestamptz),private.eflow_login_admin(uuid,text,uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.eflow_login_begin(text),public.eflow_login_finish(uuid,uuid,text,timestamptz),public.eflow_login_admin(uuid,text,uuid,integer,uuid) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.eflow_login_begin(text),private.eflow_login_finish(uuid,uuid,text,timestamptz),private.eflow_login_admin(uuid,text,uuid,integer,uuid) to service_role;
grant execute on function public.eflow_login_begin(text),public.eflow_login_finish(uuid,uuid,text,timestamptz),public.eflow_login_admin(uuid,text,uuid,integer,uuid) to service_role;
