create or replace function public.guard_admin_role_permissions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  target_role text;
  required boolean;
begin
  if tg_op = 'DELETE' then
    target_role := old.role;
  else
    target_role := new.role;
  end if;

  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Only Admin can manage role permissions' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if old.role in ('admin', 'super_admin') then
      raise exception 'Admin defaults are fixed administrative access' using errcode = '42501';
    end if;
    return old;
  end if;

  if target_role not in ('admin', 'head', 'member', 'accounting_staff')
     and not exists (select 1 from public.custom_roles cr where cr.key = target_role) then
    raise exception 'Choose a canonical account role or active custom role' using errcode = '22023';
  end if;

  if tg_op = 'UPDATE' and old.role in ('admin', 'super_admin')
     and (new.role <> old.role or new.permission <> old.permission) then
    raise exception 'Admin defaults are fixed administrative access' using errcode = '42501';
  end if;

  if target_role in ('admin', 'super_admin') then
    required := (
      new.permission in (
        'navigation.user_management',
        'users.manage',
        'navigation.organization',
        'navigation.audit',
        'audit.read',
        'navigation.system_settings',
        'settings.manage',
        'navigation.data_tools',
        'database.backup'
      )
    );
    if new.allowed is distinct from required then
      raise exception 'Admin defaults are fixed administrative access' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.cleanup_custom_role_permissions()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.role_permissions where role = old.key;
  return old;
end;
$function$;

create or replace trigger trg_cleanup_custom_role_permissions
  after delete on public.custom_roles
  for each row
  execute function public.cleanup_custom_role_permissions();

create or replace function public.touch_custom_roles_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create or replace trigger trg_touch_custom_roles_updated_at
  before update on public.custom_roles
  for each row
  execute function public.touch_custom_roles_updated_at();
