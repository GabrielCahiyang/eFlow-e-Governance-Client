-- Let a permissioned Admin maintain leader profile details without changing
-- the authoritative organization leadership assignment.
begin;

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

drop policy if exists profiles_update_user_managers on public.profiles;
create policy profiles_update_user_managers
on public.profiles for update to authenticated
using (public.has_permission(auth.uid(), 'users.manage'))
with check (public.has_permission(auth.uid(), 'users.manage'));

notify pgrst, 'reload schema';
commit;
