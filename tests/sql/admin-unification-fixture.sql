-- Disposable PostgreSQL fixture. This contains no live credentials or data.
create role authenticated;
create role anon;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public, auth, storage to authenticated, anon;

create table public.profiles (
  id uuid primary key, full_name text, email text, role text not null,
  org_id uuid, employee_id text, workload integer default 0, burnout_level text,
  is_active boolean not null default true
);
create table public.organizations (
  id uuid primary key, name text, path text, head_user_id uuid, assistant_head_user_id uuid
);
create table public.role_permissions (
  role text, permission text, allowed boolean not null, updated_at timestamptz default now(),
  primary key(role, permission)
);
create table public.user_permission_overrides (
  user_id uuid references public.profiles(id) on delete cascade,
  permission text, allowed boolean not null, set_by uuid,
  primary key(user_id, permission)
);
create table public.user_org_scope_grants (
  user_id uuid, org_id uuid, access_level text, expires_at timestamptz
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid, actor_name text,
  entity_type text, entity_id text, action text, before_data jsonb, after_data jsonb
);
create table public.announcements (id uuid primary key, title text);
create table public.system_config (key text primary key, value jsonb);
create table public.projects (id uuid primary key, title text);
create table public.tasks (id uuid primary key, title text);
create table storage.objects (id uuid primary key, name text);

insert into public.organizations values ('10000000-0000-0000-0000-000000000001', 'Department', 'department', null, null);
insert into public.profiles(id, full_name, email, role, employee_id, org_id) values
  ('00000000-0000-0000-0000-000000000001', 'Former root', 'root@example.test', 'super_admin', 'ROOT', null),
  ('00000000-0000-0000-0000-000000000002', 'Existing Admin', 'admin@example.test', 'admin', 'ADMIN', null),
  ('00000000-0000-0000-0000-000000000003', 'Employee', 'employee@example.test', 'employee', 'EMP', '10000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'Head', 'head@example.test', 'dept_head', 'HEAD', '10000000-0000-0000-0000-000000000001');
insert into public.profiles(id, full_name, role, is_active) values
  ('00000000-0000-0000-0000-000000000005', 'Inactive Admin', 'admin', false);
insert into public.role_permissions(role, permission, allowed) values
  ('super_admin', 'database.backup', true), ('admin', 'database.backup', false),
  ('employee', 'users.manage', true), ('employee', 'navigation.audit', false);
insert into public.user_permission_overrides values
  ('00000000-0000-0000-0000-000000000001', 'database.backup', false, null),
  ('00000000-0000-0000-0000-000000000002', 'navigation.audit', false, null),
  ('00000000-0000-0000-0000-000000000003', 'tasks.assign', true, null);

alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table storage.objects enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.auth_role(auth.uid()) = 'super_admin');
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.auth_role(auth.uid()) = 'super_admin');
create policy role_permissions_write on public.role_permissions to authenticated
  using (public.auth_role(auth.uid()) = 'super_admin') with check (public.auth_role(auth.uid()) = 'super_admin');
create policy user_overrides_write on public.user_permission_overrides to authenticated
  using (public.auth_role(auth.uid()) = 'super_admin') with check (public.auth_role(auth.uid()) = 'super_admin');
create policy storage_admin on storage.objects to authenticated
  using (public.auth_role(auth.uid()) = 'super_admin') with check (public.auth_role(auth.uid()) = 'super_admin');
grant select, insert, update, delete on all tables in schema public, storage to authenticated;
