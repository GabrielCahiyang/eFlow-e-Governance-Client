-- Phase 2: capability gates for generated Items; preserve legacy domain scope.
begin;
create table if not exists public.item_capability_definition_backup (
  identity text primary key, definition text not null, captured_at timestamptz default now()
);
alter table public.item_capability_definition_backup enable row level security;
drop policy if exists item_definition_admin_read on public.item_capability_definition_backup;
create policy item_definition_admin_read on public.item_capability_definition_backup for select to authenticated using (public.is_admin(auth.uid()));
grant select on public.item_capability_definition_backup to authenticated;
revoke all on public.item_capability_definition_backup from anon;

-- Add gates to the installed helpers, retaining their ownership, membership,
-- collaboration and reviewer checks. Keep each original definition for review.
do $$
declare spec record; proc_oid oid; definition text; gate text;
begin
  for spec in select * from (values
    ('can_see_project', 'navigation.projects'),
    ('can_manage_project', 'navigation.projects'),
    ('can_see_task', 'navigation.tasks'),
    ('can_manage_task', 'tasks.assign')
  ) s(name, permission) loop
    proc_oid := to_regprocedure('public.' || spec.name || '(uuid,uuid)');
    if proc_oid is null then raise exception 'Missing required scope helper %', spec.name; end if;
    definition := pg_get_functiondef(proc_oid);
    if position('phase2_custom_item_gate' in definition) > 0 then continue; end if;
    insert into public.item_capability_definition_backup values (proc_oid::regprocedure::text, definition, now()) on conflict do nothing;
    gate := format(E'BEGIN\n  -- phase2_custom_item_gate\n  if exists (select 1 from public.profiles where id = caller_id and role like ''item_%%'') and not public.has_permission(caller_id, %L) then return false; end if;\n', spec.permission);
    if definition !~* '\mBEGIN\M' then raise exception 'Unsupported scope helper definition: %', spec.name; end if;
    execute regexp_replace(definition, '\mBEGIN\M', gate, 'i');
  end loop;
  proc_oid := to_regprocedure('public.can_create_scoped_work(uuid,uuid)');
  if proc_oid is null then raise exception 'Missing project creation scope helper'; end if;
  definition := pg_get_functiondef(proc_oid);
  if position('phase2_custom_item_gate' in definition) = 0 then
    insert into public.item_capability_definition_backup values (proc_oid::regprocedure::text, definition, now()) on conflict do nothing;
    gate := E'BEGIN\n  -- phase2_custom_item_gate\n  if exists (select 1 from public.profiles where id = caller_id and role like ''item_%'') then\n    return public.has_permission(caller_id, ''projects.create'') and public.has_permission(caller_id, ''navigation.projects'') and target_org is not null and (exists (select 1 from public.profiles where id = caller_id and org_id = target_org) or public.can_access_org(caller_id, target_org, ''manage''));\n  end if;\n';
    if definition !~* '\mBEGIN\M' then raise exception 'Unsupported project creation helper'; end if;
    execute regexp_replace(definition, '\mBEGIN\M', gate, 'i');
  end if;
end $$;

-- Accounting capability assignment carries department scope, while the cash
-- RPCs continue to enforce independent reviewers, annual locks and ceilings.
do $$ declare proc_oid oid; definition text; spec record; begin
  proc_oid := to_regprocedure('public.can_manage_department_accounting(uuid,uuid)');
  if proc_oid is not null then
    insert into public.item_capability_definition_backup values (proc_oid::regprocedure::text, pg_get_functiondef(proc_oid), now()) on conflict do nothing;
    if to_regprocedure('public._item_legacy_department_accounting(uuid,uuid)') is null then
      select b.definition into definition from public.item_capability_definition_backup b where b.identity = proc_oid::regprocedure::text;
      execute replace(definition, 'FUNCTION public.can_manage_department_accounting(', 'FUNCTION public._item_legacy_department_accounting(');
      revoke all on function public._item_legacy_department_accounting(uuid,uuid) from public, anon, authenticated;
    end if;
    execute $definition$
      create or replace function public.can_manage_department_accounting(target_org uuid, caller_id uuid)
      returns boolean language sql stable security definer set search_path = public as $body$
        select case when exists(select 1 from public.profiles where id = caller_id and role like 'item_%')
          then (public.has_permission(caller_id, 'accounting.release_cash') or public.has_permission(caller_id, 'accounting.settle_liquidation') or public.has_permission(caller_id, 'accounting.post_journal')
              or public.has_permission(caller_id, 'navigation.accounting_overview') or public.has_permission(caller_id, 'navigation.accounting_releases') or public.has_permission(caller_id, 'navigation.accounting_journal')
              or public.has_permission(caller_id, 'navigation.accounting_audit') or public.has_permission(caller_id, 'navigation.department_budgets'))
            and (exists(select 1 from public.profiles where id = caller_id and org_id = target_org) or public.can_access_org(caller_id, target_org, 'manage'))
          else public._item_legacy_department_accounting(target_org, caller_id) end;
      $body$
    $definition$;
    for spec in select * from (values
      ('record_accounting_petty_cash_release', 'accounting.release_cash'),
      ('settle_accounting_liquidation', 'accounting.settle_liquidation'),
      ('post_general_journal_adjustment', 'accounting.post_journal')
    ) s(name, permission) loop
      for proc_oid in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=spec.name loop
        definition := pg_get_functiondef(proc_oid);
        if position('phase2_custom_item_gate' in definition) > 0 then continue; end if;
        insert into public.item_capability_definition_backup values (proc_oid::regprocedure::text, definition, now()) on conflict do nothing;
        execute regexp_replace(definition, '\mBEGIN\M', format(E'BEGIN\n  -- phase2_custom_item_gate\n  if exists(select 1 from public.profiles where id=auth.uid() and role like ''item_%%'') and not public.has_permission(auth.uid(), %L) then raise exception ''Required accounting capability is missing'' using errcode=''42501''; end if;\n', spec.permission), 'i');
      end loop;
    end loop;
  end if;
end $$;

-- These guards also run inside SECURITY DEFINER RPCs. Existing scope/domain
-- checks remain authoritative; a permission does not appoint a reviewer/Head.
create or replace function public.guard_custom_item_operation()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller uuid := auth.uid(); key text; needed text; changed jsonb;
begin
  select role into key from public.profiles where id = caller;
  if key is null or key not like 'item_%' then
    if tg_op = 'DELETE' then return old; end if; return new;
  end if;
  needed := tg_argv[0];
  if tg_table_name = 'projects' then
    if tg_op = 'DELETE' then needed := 'projects.delete';
    elsif tg_op = 'INSERT' then needed := 'projects.create';
    elsif to_jsonb(new)->'archived_at' is distinct from to_jsonb(old)->'archived_at'
       or (to_jsonb(new)->>'status' in ('archived', 'cancelled') and to_jsonb(new)->'status' is distinct from to_jsonb(old)->'status') then needed := 'projects.archive';
    else needed := 'projects.create'; end if;
  elsif tg_table_name = 'tasks' and tg_op = 'UPDATE' then
    changed := to_jsonb(new);
    if exists (select 1 from jsonb_each(changed) field where field.key in ('assigned_to', 'recommendation_lead_id', 'team_member_ids', 'org_id', 'reviewer_id', 'backup_reviewer_id') and field.value is distinct from to_jsonb(old)->field.key) then needed := 'tasks.assign';
    elsif to_jsonb(new)->>'status' in ('verified', 'completed', 'rejected') and to_jsonb(new)->'status' is distinct from to_jsonb(old)->'status' then needed := 'tasks.verify';
    else needed := 'navigation.tasks'; end if;
  end if;
  if not public.has_permission(caller, needed) then raise exception 'The % capability is required', needed using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; end if; return new;
end $$;

do $$ declare spec record; tab regclass; begin
  for spec in select * from (values
    ('projects', 'navigation.projects', 'projects.create'),
    ('tasks', 'navigation.tasks', 'tasks.assign'),
    ('announcements', 'navigation.announcements', 'announcements.publish'),
    ('system_config', 'navigation.system_settings', 'settings.manage'),
    ('audit_events', 'audit.read', null::text)
  ) s(name, read_permission, write_permission) loop
    tab := to_regclass('public.' || spec.name);
    if tab is null then raise exception 'Missing required access table %', spec.name; end if;
    execute format('drop policy if exists custom_item_read_capability on %s', tab);
    execute format('create policy custom_item_read_capability on %s as restrictive for select to authenticated using (not exists (select 1 from public.profiles where id = auth.uid() and role like ''item_%%'') or public.has_permission(auth.uid(), %L))', tab, spec.read_permission);
    if spec.write_permission is not null then
      execute format('drop trigger if exists guard_custom_item_operation on %s', tab);
      execute format('create trigger guard_custom_item_operation before insert or update or delete on %s for each row execute function public.guard_custom_item_operation(%L)', tab, spec.write_permission);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
