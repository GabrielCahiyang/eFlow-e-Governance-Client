-- Phase 1: one Admin identity with the former Super Admin authority.
-- Preserve existing deployed function signatures, policies, and review rules.
begin;

create table if not exists public.admin_unification_profile_backup (
  profile_id uuid primary key,
  previous_role text not null,
  profile_snapshot jsonb not null,
  permission_overrides jsonb not null,
  captured_at timestamptz not null default now()
);
create table if not exists public.admin_unification_permission_backup (
  role text not null,
  permission text not null,
  record_snapshot jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (role, permission)
);
create table if not exists public.admin_unification_definition_backup (
  kind text not null,
  identity text not null,
  definition text not null,
  captured_at timestamptz not null default now(),
  primary key (kind, identity)
);

with captured as (
  insert into public.admin_unification_profile_backup(profile_id, previous_role, profile_snapshot, permission_overrides)
  select p.id, p.role, to_jsonb(p), coalesce((
    select jsonb_agg(to_jsonb(o)) from public.user_permission_overrides o where o.user_id = p.id
  ), '[]'::jsonb)
  from public.profiles p where p.role in ('admin', 'super_admin')
  on conflict (profile_id) do nothing
  returning profile_id, previous_role, permission_overrides
)
insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, before_data, after_data)
select null, 'Admin identity migration', 'profile', profile_id::text, 'admin.identity_unified',
  jsonb_build_object('role', previous_role, 'permissionOverrides', permission_overrides),
  jsonb_build_object('role', 'admin', 'administrativeAccess', 'full')
from captured;

insert into public.admin_unification_permission_backup(role, permission, record_snapshot)
select role, permission, to_jsonb(rp) from public.role_permissions rp
where role in ('admin', 'super_admin') on conflict (role, permission) do nothing;

-- Transform the definitions actually deployed, rather than reinstalling older
-- migration versions. Only the exact retired role literal and its label change.
-- CREATE OR REPLACE keeps signatures, owners, grants, and function attributes.
do $migration$
declare target record; original text; replacement text; archive_identity text;
begin
  for target in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public' and p.prokind = 'f' and l.lanname in ('sql', 'plpgsql')
      -- This new guard deliberately recognizes and rejects the retired key.
      -- Leave it intact when rehearsing or re-running this migration.
      and p.proname <> 'guard_admin_role_permissions'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e')
  loop
    original := pg_get_functiondef(target.oid);
    replacement := replace(replace(original, quote_literal('super_admin'), quote_literal('admin')), 'Super Admin', 'Admin');
    if replacement is distinct from original then
      archive_identity := target.oid::regprocedure::text;
      insert into public.admin_unification_definition_backup(kind, identity, definition)
      values ('function', archive_identity, original) on conflict (kind, identity) do nothing;
      execute replacement;
    end if;
  end loop;

  -- ALTER POLICY preserves its command, roles, and permissive/restrictive mode.
  for target in select * from pg_policies where schemaname in ('public', 'storage') loop
    original := format('alter policy %I on %I.%I', target.policyname, target.schemaname, target.tablename)
      || case when target.qual is null then '' else ' using (' || target.qual || ')' end
      || case when target.with_check is null then '' else ' with check (' || target.with_check || ')' end;
    replacement := replace(original, quote_literal('super_admin'), quote_literal('admin'));
    if replacement is distinct from original then
      archive_identity := format('%I.%I.%I', target.schemaname, target.tablename, target.policyname);
      insert into public.admin_unification_definition_backup(kind, identity, definition)
      values ('policy', archive_identity, original) on conflict (kind, identity) do nothing;
      execute replacement;
    end if;
  end loop;
end;
$migration$;

-- Preserve the old helper's public signature for its existing policy/RPC callers.
create or replace function public.is_admin(caller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = caller_id and is_active and role = 'admin');
$$;
create or replace function public.is_super_admin(caller_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(caller_id);
$$;
create or replace function public.auth_role(caller_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = caller_id and is_active;
$$;

-- Preserve the original permission snapshots before removing obsolete rows.
-- Root authority is implicit, matching the former Super Admin behaviour.
insert into public.role_permissions(role, permission, allowed)
select 'admin', permission, true from public.role_permissions group by permission
on conflict (role, permission) do update set allowed = true;
delete from public.role_permissions where role = 'super_admin';
delete from public.user_permission_overrides where user_id in (
  select id from public.profiles where role in ('admin', 'super_admin')
);

update public.profiles set role = 'admin' where role = 'super_admin';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'admin', 'dept_head', 'assistant_head', 'accounting_staff', 'employee',
  'department_head', 'executive', 'legislative', 'hrmo', 'finance', 'councilor_pad'
));

-- These archives are append-only to application clients and retained even if
-- the original account is later removed. They intentionally have no profile FK.
alter table public.admin_unification_profile_backup enable row level security;
alter table public.admin_unification_permission_backup enable row level security;
alter table public.admin_unification_definition_backup enable row level security;
drop policy if exists admin_unification_profile_read on public.admin_unification_profile_backup;
create policy admin_unification_profile_read on public.admin_unification_profile_backup for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists admin_unification_permission_read on public.admin_unification_permission_backup;
create policy admin_unification_permission_read on public.admin_unification_permission_backup for select to authenticated using (public.is_admin(auth.uid()));
drop policy if exists admin_unification_definition_read on public.admin_unification_definition_backup;
create policy admin_unification_definition_read on public.admin_unification_definition_backup for select to authenticated using (public.is_admin(auth.uid()));
revoke all on public.admin_unification_profile_backup, public.admin_unification_permission_backup, public.admin_unification_definition_backup from anon, authenticated;
grant select on public.admin_unification_profile_backup, public.admin_unification_permission_backup, public.admin_unification_definition_backup to authenticated;

create or replace function public.guard_last_active_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and old.is_active then
    if tg_op = 'DELETE' or new.role is distinct from 'admin' or new.is_active is distinct from true then
      -- VOLATILE trigger functions take a fresh snapshot for the count after
      -- this shared transaction lock. Concurrent removals cannot both pass.
      perform pg_advisory_xact_lock(hashtextextended('eflow.last_active_admin', 0));
      if not exists (select 1 from public.profiles where id <> old.id and role = 'admin' and is_active) then
        raise exception 'The last active Admin cannot be deleted, deactivated, or reassigned' using errcode = '42501';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists guard_last_active_admin on public.profiles;
create trigger guard_last_active_admin before update or delete on public.profiles
for each row execute function public.guard_last_active_admin();

create or replace function public.guard_admin_role_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  if tg_op = 'DELETE' then target_role := old.role; else target_role := new.role; end if;
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Only Admin can manage role permissions' using errcode = '42501';
  end if;
  if target_role = 'super_admin' then
    raise exception 'Choose Admin; the legacy administrative role is retired' using errcode = '22023';
  end if;
  if (tg_op in ('UPDATE', 'DELETE') and old.role = 'admin') or target_role = 'admin' then
    if tg_op = 'DELETE' then raise exception 'Admin core access cannot be revoked' using errcode = '42501'; end if;
    if new.role <> 'admin' or not new.allowed then
      raise exception 'Admin core access cannot be revoked' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists guard_admin_role_permissions on public.role_permissions;
create trigger guard_admin_role_permissions before insert or update or delete on public.role_permissions
for each row execute function public.guard_admin_role_permissions();

create or replace function public.guard_admin_permission_overrides()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  if tg_op = 'DELETE' then target_user := old.user_id; else target_user := new.user_id; end if;
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Only Admin can manage individual access' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = target_user and role = 'admin')
     or (tg_op = 'UPDATE' and exists (select 1 from public.profiles where id = old.user_id and role = 'admin')) then
    raise exception 'Admin core access cannot be overridden' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists guard_admin_permission_overrides on public.user_permission_overrides;
create trigger guard_admin_permission_overrides before insert or update or delete on public.user_permission_overrides
for each row execute function public.guard_admin_permission_overrides();

notify pgrst, 'reload schema';
commit;
