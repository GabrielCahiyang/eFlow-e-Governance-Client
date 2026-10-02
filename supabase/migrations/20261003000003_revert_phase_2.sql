-- Revert Phase 2 only. Keep Phase 1 Admin identity, privileges and protections.
-- Run the entire file as postgres in Supabase SQL Editor.
-- No users, Auth accounts, organisation appointments or audit history are deleted.
begin;

-- Prevent role changes racing the preflight and removal of the Item foreign key.
lock table public.profiles, public.role_permissions in share row exclusive mode;
do $$
declare unsupported text;
begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception 'Phase 1 must remain installed before reverting Phase 2';
  end if;
  select string_agg(distinct role, ', ') into unsupported from public.profiles
    where role not in ('admin','dept_head','assistant_head','accounting_staff','employee',
      'department_head','executive','legislative','hrmo','finance','councilor_pad');
  if unsupported is not null then
    raise exception 'Rollback stopped: users still have unsupported/custom Items: %. Reassign these users to reviewed Phase 1 roles first; no users will be changed automatically.', unsupported;
  end if;
  if to_regclass('public.access_items') is not null then
    lock table public.access_items, public.employee_statuses in share row exclusive mode;
  end if;
end $$;

-- Retain a recoverable catalogue/permission snapshot without active catalogue APIs.
create table if not exists public.phase2_rollback_archive (
  source_table text not null,
  record_key text not null,
  snapshot jsonb not null,
  archived_at timestamptz not null default now(),
  primary key (source_table, record_key)
);
alter table public.phase2_rollback_archive enable row level security;
drop policy if exists phase2_rollback_archive_admin_read on public.phase2_rollback_archive;
create policy phase2_rollback_archive_admin_read on public.phase2_rollback_archive
  for select to authenticated using (public.is_admin(auth.uid()));
revoke all on public.phase2_rollback_archive from anon, authenticated;
grant select on public.phase2_rollback_archive to authenticated;

do $$ declare tab text; begin
  foreach tab in array array['access_items','employee_statuses'] loop
    if to_regclass('public.' || tab) is not null then
      execute format('insert into public.phase2_rollback_archive(source_table,record_key,snapshot)
        select %L, id::text, to_jsonb(t) from public.%I t
        on conflict(source_table,record_key) do nothing', tab, tab);
    end if;
  end loop;
end $$;
insert into public.phase2_rollback_archive(source_table,record_key,snapshot)
select 'role_permissions', role || ':' || permission, to_jsonb(rp)
from public.role_permissions rp where role not in (
  'admin','dept_head','assistant_head','accounting_staff','employee',
  'department_head','executive','legislative','hrmo','finance','councilor_pad'
) on conflict(source_table,record_key) do nothing;

-- Restore the installed post-Phase-1 definitions archived by Phase 2.
-- Never use Phase 1's original root identity as a rollback target.
do $$ declare saved record; begin
  if to_regclass('public.item_capability_definition_backup') is not null then
    for saved in select * from public.item_capability_definition_backup loop
      if position('phase2_custom_item_gate' in saved.definition) > 0 then
        raise exception 'Invalid pre-Phase-2 function archive: %', saved.identity;
      end if;
      execute saved.definition;
    end loop;
  end if;
end $$;

-- has_permission was captured before Phase 1's literal conversion. Apply that
-- exact conversion to the archived definition to retain Phase 1 semantics.
do $$ declare saved_definition text; begin
  if to_regclass('public.access_items') is not null then
    select definition into saved_definition from public.admin_unification_definition_backup
      where kind = 'function' and identity = 'has_permission(uuid,text)';
    if saved_definition is null then
      raise exception 'Missing original has_permission function archive. Rollback stopped without changing the database.';
    end if;
    execute replace(replace(saved_definition, quote_literal('super_admin'), quote_literal('admin')), 'Super Admin', 'Admin');
  end if;
end $$;
create or replace function public.auth_role(caller_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select role::text from public.profiles where id = caller_id and is_active;
$$;

-- Remove only Phase 2's added policies and mutation guards.
do $$ declare tab text; begin
  foreach tab in array array['projects','tasks','announcements','system_config','audit_events'] loop
    if to_regclass('public.' || tab) is not null then
      execute format('drop policy if exists custom_item_read_capability on public.%I', tab);
      execute format('drop trigger if exists guard_custom_item_operation on public.%I', tab);
    end if;
  end loop;
end $$;
drop trigger if exists guard_profile_item_assignment on public.profiles;

-- Restore the existing immediate leadership integrity guard. Already completed
-- Head/Assistant Head appointments remain intact.
drop trigger if exists guard_profile_leadership_integrity on public.profiles;
create trigger guard_profile_leadership_integrity
before insert or update of role, org_id, is_active on public.profiles
for each row execute function public.guard_profile_leadership_integrity();

drop function if exists public.finalize_managed_user(uuid,uuid,jsonb);
drop function if exists public.guard_profile_item_assignment();
drop function if exists public.guard_custom_item_operation();
drop function if exists public._item_legacy_department_accounting(uuid,uuid);

alter table public.profiles drop constraint if exists profiles_access_item_key_fk;
alter table public.role_permissions drop constraint if exists role_permissions_item_key_fk;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'admin','dept_head','assistant_head','accounting_staff','employee',
  'department_head','executive','legislative','hrmo','finance','councilor_pad'
));

-- Unassigned custom defaults are archived above; built-in defaults and user
-- overrides are left unchanged. Referenced custom users stop at the preflight.
delete from public.role_permissions where role not in (
  'admin','dept_head','assistant_head','accounting_staff','employee',
  'department_head','executive','legislative','hrmo','finance','councilor_pad'
);

-- No CASCADE: an unexpected later dependency must abort the rollback.
drop table if exists public.access_items;
drop table if exists public.employee_statuses;
drop function if exists public.guard_access_catalogue();
drop function if exists public.audit_catalogue_change();

-- Keep item_capability_definition_backup and all Phase 1 archives for recovery.
insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,after_data)
select null,'Phase 2 rollback','system','phase2','migration.phase2_reverted',
  jsonb_build_object('phase1Retained',true,'catalogueArchive','phase2_rollback_archive')
where not exists (select 1 from public.audit_events where action='migration.phase2_reverted');

notify pgrst, 'reload schema';
commit;
