-- Phase 2 catalogue and assignment identity. Apply after Admin unification.
begin;
do $$ begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Apply Phase 1 Admin unification before Phase 2';
  end if;
end $$;

create table if not exists public.employee_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists employee_status_name_unique
  on public.employee_statuses(lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
insert into public.employee_statuses(name) values ('Job Order'), ('Casual'), ('Regular/Permanent') on conflict do nothing;

create table if not exists public.access_items (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique default ('item_' || replace(gen_random_uuid()::text, '-', '')),
  title text not null check (length(btrim(title)) between 1 and 160),
  role text not null check (length(btrim(role)) between 1 and 160),
  employee_status_id uuid references public.employee_statuses(id) on delete restrict,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists access_item_description_unique on public.access_items(
  lower(regexp_replace(btrim(title), '\s+', ' ', 'g')),
  lower(regexp_replace(btrim(role), '\s+', ' ', 'g')),
  coalesce(employee_status_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Keep established role keys as stable Item keys. Employment classifications
-- are intentionally NULL until reviewed by Admin; none are guessed.
insert into public.access_items(permission_key, title, role, is_system)
select key, label, label, true from (values
  ('admin', 'Admin'), ('dept_head', 'Head'), ('assistant_head', 'Assistant Head'),
  ('accounting_staff', 'Accounting Staff'), ('employee', 'Employee'),
  ('department_head', 'Legacy Head'), ('executive', 'Executive'),
  ('legislative', 'Legislative'), ('hrmo', 'HRMO'), ('finance', 'Finance'), ('councilor_pad', 'Councilor')
) defaults(key, label)
where not exists (select 1 from public.access_items where permission_key = defaults.key)
on conflict (permission_key) do nothing;
insert into public.access_items(permission_key, title, role, is_system)
select role, initcap(replace(role, '_', ' ')), initcap(replace(role, '_', ' ')), true
from (select role from public.profiles union select role from public.role_permissions) existing
where role <> 'super_admin' and not exists (select 1 from public.access_items where permission_key = existing.role)
on conflict (permission_key) do nothing;

alter table public.profiles drop constraint if exists profiles_role_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_access_item_key_fk' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_access_item_key_fk foreign key (role) references public.access_items(permission_key) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'role_permissions_item_key_fk' and conrelid = 'public.role_permissions'::regclass) then
    alter table public.role_permissions add constraint role_permissions_item_key_fk foreign key (role) references public.access_items(permission_key) on delete cascade;
  end if;
end $$;

create or replace function public.guard_access_catalogue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Only Admin can maintain Items and Employee Status' using errcode = '42501';
  end if;
  if tg_table_name = 'access_items' then
    if tg_op = 'DELETE' then
      if old.is_system then raise exception 'System Items are retained for workflow compatibility' using errcode = '42501'; end if;
      if exists (select 1 from public.profiles where role = old.permission_key) then
        raise exception 'This Item is assigned to users. Retire it after reassigning active users' using errcode = '23503';
      end if;
    else
      if tg_op = 'INSERT' and (new.is_system or new.permission_key !~ '^item_[0-9a-f]{32}$') then
        raise exception 'New Items require a generated permission identity' using errcode = '42501';
      end if;
      if tg_op = 'UPDATE' and (new.permission_key <> old.permission_key or new.is_system <> old.is_system or new.id <> old.id) then
        raise exception 'Item permission identity is immutable' using errcode = '42501';
      end if;
      if new.permission_key = 'admin' and not new.is_active then
        raise exception 'The Admin Item must remain active' using errcode = '42501';
      end if;
      if tg_op = 'UPDATE' and old.is_active and not new.is_active
         and exists (select 1 from public.profiles where role = old.permission_key and is_active) then
        raise exception 'Reassign active users before retiring this Item' using errcode = '23503';
      end if;
      if new.employee_status_id is null and (tg_op = 'INSERT' or not new.is_system) then
        raise exception 'Select an Employee Status from maintenance' using errcode = '23502';
      end if;
      if new.employee_status_id is not null and (tg_op = 'INSERT' or new.employee_status_id is distinct from old.employee_status_id)
         and not exists (select 1 from public.employee_statuses where id = new.employee_status_id and is_active for share) then
        raise exception 'Select an active Employee Status' using errcode = '22023';
      end if;
    end if;
  elsif tg_op = 'UPDATE' and new.id <> old.id then
    raise exception 'Employee Status identity is immutable' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists guard_access_catalogue on public.access_items;
create trigger guard_access_catalogue before insert or update or delete on public.access_items for each row execute function public.guard_access_catalogue();
drop trigger if exists guard_employee_status_catalogue on public.employee_statuses;
create trigger guard_employee_status_catalogue before insert or update or delete on public.employee_statuses for each row execute function public.guard_access_catalogue();

create or replace function public.guard_profile_item_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare selected_item public.access_items;
begin
  select * into selected_item from public.access_items where permission_key = new.role for share;
  if not found then raise exception 'Select an existing Item' using errcode = '23503'; end if;
  if not selected_item.is_active and (tg_op = 'INSERT' or new.role is distinct from old.role or new.is_active) then
    raise exception 'Select an active Item' using errcode = '22023';
  end if;
  if (tg_op = 'INSERT' or new.role is distinct from old.role) and new.is_active
     and (selected_item.employee_status_id is null or not exists (select 1 from public.employee_statuses where id = selected_item.employee_status_id and is_active for share)) then
    raise exception 'Assign this Item an active Employee Status before assigning new users' using errcode = '22023';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role and auth.uid() is not null and not public.is_admin(auth.uid()) then
    raise exception 'Only Admin can assign a different Item' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_item_assignment on public.profiles;
create trigger guard_profile_item_assignment before insert or update on public.profiles for each row execute function public.guard_profile_item_assignment();

-- An inactive Item or account has no capabilities, including user overrides.
create or replace function public.has_permission(p_user_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_user_id is null or nullif(btrim(p_permission), '') is null then false
    when not exists (select 1 from public.profiles p join public.access_items i on i.permission_key = p.role where p.id = p_user_id and p.is_active and i.is_active) then false
    when public.is_admin(p_user_id) then true
    else coalesce(
      (select allowed from public.user_permission_overrides where user_id = p_user_id and permission = p_permission),
      (select rp.allowed from public.profiles p join public.role_permissions rp on rp.role = p.role where p.id = p_user_id and rp.permission = p_permission), false)
  end;
$$;
create or replace function public.auth_role(caller_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select p.role from public.profiles p join public.access_items i on i.permission_key = p.role where p.id = caller_id and p.is_active and i.is_active;
$$;

create or replace function public.audit_catalogue_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, before_data, after_data)
  values (auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), 'Catalogue migration/service'),
    tg_table_name, coalesce(new.id, old.id)::text, 'catalogue.' || tg_table_name || '.' || lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end);
  if tg_op = 'DELETE' then return old; end if; return new;
end;
$$;
drop trigger if exists audit_catalogue on public.access_items;
create trigger audit_catalogue after insert or update or delete on public.access_items for each row execute function public.audit_catalogue_change();
drop trigger if exists audit_employee_status on public.employee_statuses;
create trigger audit_employee_status after insert or update or delete on public.employee_statuses for each row execute function public.audit_catalogue_change();
alter table public.access_items enable row level security;
alter table public.employee_statuses enable row level security;
drop policy if exists items_read on public.access_items;
create policy items_read on public.access_items for select to authenticated using (auth.uid() is not null);
drop policy if exists items_write on public.access_items;
create policy items_write on public.access_items for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
drop policy if exists statuses_read on public.employee_statuses;
create policy statuses_read on public.employee_statuses for select to authenticated using (auth.uid() is not null);
drop policy if exists statuses_write on public.employee_statuses;
create policy statuses_write on public.employee_statuses for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
revoke all on public.access_items, public.employee_statuses from anon;
grant select, insert, update, delete on public.access_items, public.employee_statuses to authenticated, service_role;

-- Only the trusted gateway may finalize Auth/profile creation. Its caller is
-- revalidated from profiles inside this same transaction. No Employee bridge.
-- Validate the completed appointment, so an inserted Head and its slot can be
-- committed together while direct profile-only promotions remain rejected.
drop trigger if exists guard_profile_leadership_integrity on public.profiles;
create constraint trigger guard_profile_leadership_integrity
after insert or update on public.profiles deferrable initially deferred
for each row execute function public.guard_profile_leadership_integrity();

create or replace function public.finalize_managed_user(p_actor_id uuid, p_uid uuid, p_profile jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare selected_key text := p_profile->>'role'; target_org uuid := nullif(p_profile->>'org_id', '')::uuid;
  selected_item public.access_items; target public.organizations; existing public.profiles;
  previous_claim text := current_setting('request.jwt.claim.sub', true);
begin
  if not public.is_admin(p_actor_id) and not (public.has_permission(p_actor_id, 'users.manage') and selected_key in ('employee', 'accounting_staff')) then
    raise exception 'Admin access is required for this Item assignment' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('eflow.user.finalize:' || p_uid::text, 0));
  select * into selected_item from public.access_items where permission_key = selected_key and is_active for share;
  if not found then raise exception 'Select an active Item' using errcode = '22023'; end if;
  if selected_item.employee_status_id is null or not exists (select 1 from public.employee_statuses where id = selected_item.employee_status_id and is_active for share) then
    raise exception 'Assign this Item an active Employee Status before creating new users' using errcode = '22023';
  end if;
  if target_org is not null then
    select * into target from public.organizations where id = target_org and is_active for update;
    if not found then raise exception 'Select an active organization' using errcode = '22023'; end if;
  end if;
  select * into existing from public.profiles where id = p_uid for update;
  if found then
    if existing.role = selected_key and existing.org_id is not distinct from target_org and lower(existing.email) = lower(p_profile->>'email') then return p_uid; end if;
    raise exception 'This account already has a different profile assignment' using errcode = '23505';
  end if;
  if selected_key in ('dept_head', 'department_head', 'assistant_head') then
    if target_org is null then raise exception 'Head appointments require an organization' using errcode = '22023'; end if;
    if (selected_key = 'assistant_head' and target.assistant_head_user_id is not null)
       or (selected_key <> 'assistant_head' and target.head_user_id is not null)
       or exists (select 1 from public.profiles where org_id = target_org and is_active
         and case when selected_key = 'assistant_head' then role = 'assistant_head' else role in ('dept_head', 'department_head') end) then
      raise exception 'This organization already has an appointed Head/Assistant Head' using errcode = '23505';
    end if;
  end if;
  if nullif(btrim(p_profile->>'full_name'), '') is null or nullif(btrim(p_profile->>'email'), '') is null then
    raise exception 'Name and email are required' using errcode = '22023';
  end if;
  -- Give existing audited leadership RPCs the verified actor context. This
  -- function is service-role-only; clients cannot impersonate p_actor_id.
  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  insert into public.profiles(id, full_name, email, role, org_id, employee_id, skills, is_active)
  values (p_uid, btrim(p_profile->>'full_name'), lower(btrim(p_profile->>'email')), selected_key, target_org,
    coalesce(nullif(btrim(p_profile->>'employee_id'), ''), 'UNASSIGNED-' || p_uid::text), coalesce(p_profile->'skills', '{}'::jsonb), true);
  if selected_key in ('dept_head', 'department_head', 'assistant_head') then
    perform public.set_organization_leadership(target_org,
      case when selected_key = 'assistant_head' then target.head_user_id else p_uid end,
      case when selected_key = 'assistant_head' then p_uid else target.assistant_head_user_id end);
  end if;
  insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, after_data)
  values (p_actor_id, coalesce((select full_name from public.profiles where id = p_actor_id), ''), 'profile', p_uid::text, 'user.created_in_item', jsonb_build_object('item', selected_key, 'org_id', target_org));
  perform set_config('request.jwt.claim.sub', coalesce(previous_claim, ''), true);
  return p_uid;
end;
$$;
revoke all on function public.finalize_managed_user(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_managed_user(uuid, uuid, jsonb) to service_role;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'access_items') then alter publication supabase_realtime add table public.access_items; end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'employee_statuses') then alter publication supabase_realtime add table public.employee_statuses; end if;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
