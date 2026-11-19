-- Persist latest Deep Process Analysis snapshots per Office and filter scope
-- so Heads can inspect the last saved update date, time, and report even when
-- the private analysis backend (:8321) is offline.

create table if not exists public.process_mining_snapshots (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  scope_key         text not null check (btrim(scope_key) <> ''),
  project_id        uuid references public.projects(id) on delete cascade,
  include_completed boolean not null default true,
  from_date         date,
  to_date           date,
  report            jsonb not null check (jsonb_typeof(report) = 'object'),
  summary           jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  generated_at      timestamptz not null default now(),
  saved_at          timestamptz not null default now(),
  saved_by          uuid references public.profiles(id) on delete set null,
  saved_by_name     text not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint process_mining_snapshots_scope_key_unique unique (org_id, scope_key)
);

create index if not exists process_mining_snapshots_org_saved_idx
  on public.process_mining_snapshots(org_id, saved_at desc);
create index if not exists process_mining_snapshots_project_idx
  on public.process_mining_snapshots(project_id)
  where project_id is not null;
create index if not exists process_mining_snapshots_saved_by_idx
  on public.process_mining_snapshots(saved_by)
  where saved_by is not null;

drop trigger if exists process_mining_snapshots_touch on public.process_mining_snapshots;
create trigger process_mining_snapshots_touch
  before update on public.process_mining_snapshots
  for each row execute function public.touch_updated_at();

alter table public.process_mining_snapshots enable row level security;

revoke all on public.process_mining_snapshots from public, anon;
grant select, insert, update on public.process_mining_snapshots to authenticated;

drop policy if exists process_mining_snapshots_select on public.process_mining_snapshots;
create policy process_mining_snapshots_select
  on public.process_mining_snapshots
  for select
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'navigation.team_intelligence')
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.role::text in ('head', 'dept_head', 'department_head')
        and p.org_id = process_mining_snapshots.org_id
    )
  );

drop policy if exists process_mining_snapshots_insert on public.process_mining_snapshots;
create policy process_mining_snapshots_insert
  on public.process_mining_snapshots
  for insert
  to authenticated
  with check (
    public.has_permission((select auth.uid()), 'navigation.team_intelligence')
    and (saved_by is null or saved_by = (select auth.uid()))
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.role::text in ('head', 'dept_head', 'department_head')
        and p.org_id = process_mining_snapshots.org_id
    )
  );

drop policy if exists process_mining_snapshots_update on public.process_mining_snapshots;
create policy process_mining_snapshots_update
  on public.process_mining_snapshots
  for update
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'navigation.team_intelligence')
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.role::text in ('head', 'dept_head', 'department_head')
        and p.org_id = process_mining_snapshots.org_id
    )
  )
  with check (
    public.has_permission((select auth.uid()), 'navigation.team_intelligence')
    and (saved_by is null or saved_by = (select auth.uid()))
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
        and p.role::text in ('head', 'dept_head', 'department_head')
        and p.org_id = process_mining_snapshots.org_id
    )
  );
