-- Add a revocable Admin role while keeping the Super Admin account protected.
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in (
    'super_admin', 'admin', 'dept_head', 'assistant_head', 'accounting_staff', 'employee',
    'department_head', 'executive', 'legislative', 'hrmo', 'finance',
    'councilor_pad'
  ));

insert into public.role_permissions (role, permission, allowed) values
  ('admin', 'navigation.projects', true),
  ('admin', 'navigation.reports', true),
  ('admin', 'navigation.announcements', true),
  ('admin', 'navigation.user_management', true),
  ('admin', 'navigation.organization', true),
  ('admin', 'navigation.audit', true),
  ('admin', 'navigation.system_settings', true),
  ('admin', 'navigation.data_tools', true),
  ('admin', 'reports.export', true),
  ('admin', 'announcements.publish', true),
  ('admin', 'users.manage', true),
  ('admin', 'audit.read', true),
  ('admin', 'settings.manage', true),
  ('admin', 'database.backup', true)
on conflict (role, permission) do nothing;

-- Admins with users.manage may manage ordinary employee and accounting
-- profiles. Only the Super Admin may create, promote, demote, deactivate, or
-- otherwise alter Admin, Super Admin, and leadership accounts.
create or replace function public.guard_administrative_role_management()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
begin
  if caller is null then
    return new;
  end if;

  caller_role := public.auth_role(caller);
  if caller_role = 'super_admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role in ('super_admin', 'admin') then
      raise exception 'Only the Super Admin can create an administrative account'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if caller = old.id then
    return new;
  end if;

  if old.role in ('super_admin', 'admin')
     or new.role in ('super_admin', 'admin') then
    raise exception 'Only the Super Admin can manage administrative accounts'
      using errcode = '42501';
  end if;

  if old.role in ('dept_head', 'department_head', 'assistant_head')
     or new.role in ('dept_head', 'department_head', 'assistant_head') then
    if new.role is distinct from old.role
       or new.org_id is distinct from old.org_id
       or new.is_active is distinct from old.is_active then
      raise exception 'Only the Super Admin can change leadership assignment or account status'
        using errcode = '42501';
    end if;
  elsif old.role not in ('employee', 'accounting_staff')
        or new.role not in ('employee', 'accounting_staff') then
    raise exception 'Only the Super Admin can change this account role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_administrative_role_management on public.profiles;
create trigger guard_administrative_role_management
before insert or update on public.profiles
for each row execute function public.guard_administrative_role_management();

-- Keep administrative accounts out of the organization leadership slots even
-- when a caller bypasses the client-side candidate list.
create or replace function public.guard_administrative_leadership_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.head_user_id is not null and exists (
    select 1 from public.profiles
    where id = new.head_user_id and role in ('super_admin', 'admin')
  ) then
    raise exception 'Administrative accounts cannot be assigned as organization Head'
      using errcode = '22023';
  end if;

  if new.assistant_head_user_id is not null and exists (
    select 1 from public.profiles
    where id = new.assistant_head_user_id and role in ('super_admin', 'admin')
  ) then
    raise exception 'Administrative accounts cannot be assigned as Assistant Head'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_administrative_leadership_assignment on public.organizations;
create trigger guard_administrative_leadership_assignment
before insert or update of head_user_id, assistant_head_user_id on public.organizations
for each row execute function public.guard_administrative_leadership_assignment();

-- Existing policies remain in place for owners and the Super Admin. These
-- additive policies grant only the capability selected in Role Defaults or an
-- individual override.
drop policy if exists profiles_update_user_managers on public.profiles;
create policy profiles_update_user_managers
on public.profiles for update to authenticated
using (public.has_permission(auth.uid(), 'users.manage'))
with check (public.has_permission(auth.uid(), 'users.manage'));

drop policy if exists announcements_write_permission on public.announcements;
create policy announcements_write_permission
on public.announcements for all to authenticated
using (public.has_permission(auth.uid(), 'announcements.publish'))
with check (public.has_permission(auth.uid(), 'announcements.publish'));

drop policy if exists audit_read_permission on public.audit_events;
create policy audit_read_permission
on public.audit_events for select to authenticated
using (public.has_permission(auth.uid(), 'audit.read'));

drop policy if exists system_config_write_permission on public.system_config;
create policy system_config_write_permission
on public.system_config for all to authenticated
using (public.has_permission(auth.uid(), 'settings.manage'))
with check (public.has_permission(auth.uid(), 'settings.manage'));

notify pgrst, 'reload schema';
commit;
