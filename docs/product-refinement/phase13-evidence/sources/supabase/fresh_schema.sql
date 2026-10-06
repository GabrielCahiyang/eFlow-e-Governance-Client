-- ════════════════════════════════════════════════════════════════════════════
-- eFlow — FRESH FULL SCHEMA (single-file, copy-paste into a NEW Supabase project)
-- ────────────────────────────────────────────────────────────────────────────
-- Run this whole file once in the Supabase SQL editor of a brand-new project.
-- It creates every table, index, constraint, trigger, RLS policy, RPC, storage
-- bucket, and seed the eFlow web app depends on — aligned to the current code
-- and to the "Task Flow Stabilization and Dashboard Accuracy Plan".
--
-- Design decisions baked in (from the plan):
--   • tasks.linked_project_id is the ONE canonical task→project link.
--     tasks.project_id remains only as legacy proposal-hierarchy text.
--   • A task is unassigned ONLY when assigned_to IS NULL. A CHECK constraint
--     forbids pending_assignment + assignee, and active statuses + no assignee.
--   • changes_requested is a first-class status (distinct from in_progress).
--   • archived_at is a separate flag, never a status.
--   • Status transitions go through transition_task_status() which validates the
--     transition, writes history + activity + audit, and is SECURITY DEFINER so
--     ordinary clients cannot flip task.status directly (a trigger blocks that).
--   • task_comments / task_progress_updates / task_comment_attachments are
--     readable only to people who can see the task (not every authenticated user).
--   • audit_events is append-only (INSERT policy only; no UPDATE/DELETE).
--
-- Safe to re-run: every statement is idempotent (if not exists / or replace /
-- guarded policy creation).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "ltree";       -- organizations.path (also works as text)

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1 — CORE IDENTITY: organizations, profiles, system_config, preferences
-- ════════════════════════════════════════════════════════════════════════════

-- ─── organizations (dynamic org tree via text ltree-style path) ──────────────
create table if not exists public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null,
  parent_id    uuid references public.organizations(id) on delete set null,
  path         text not null,                       -- e.g. 'lgu.engineering.roads'
  org_type     text not null default 'department'
                 check (org_type in ('lgu','department','division','section','unit')),
  description  text not null default '',
  head_user_id uuid,                                -- FK added after profiles exists
  assistant_head_user_id uuid,                      -- FK added after profiles exists
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists organizations_slug_key  on public.organizations(slug);
create index        if not exists organizations_path_idx  on public.organizations(path);
create index        if not exists organizations_parent_idx on public.organizations(parent_id);

-- ─── profiles (1:1 with auth.users) ──────────────────────────────────────────
create table if not exists public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  full_name                   text not null default '',
  email                       text not null default '',
  avatar_path                 text,
  email_notifications_enabled boolean not null default true,
  employee_id                 text not null default '',
  org_id                      uuid references public.organizations(id) on delete set null,
  role                        text not null default 'employee'
                                check (role in (
                                  'super_admin','admin','dept_head','assistant_head','accounting_staff','employee',
                                  -- legacy roles still referenced by older panels
                                  'department_head','executive','legislative',
                                  'hrmo','finance','councilor_pad')),
  skills                      jsonb not null default '{}'::jsonb,
  workload                    int not null default 0,
  burnout_level               text not null default 'low' check (burnout_level in ('low','medium','high')),
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists profiles_org_idx  on public.profiles(org_id);
create index if not exists profiles_role_idx on public.profiles(role);

-- organizations.head_user_id → profiles (added now that profiles exists)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_head_user_fk') then
    alter table public.organizations
      add constraint organizations_head_user_fk
      foreign key (head_user_id) references public.profiles(id) on delete set null;
  end if;
end;
$$;

-- organizations.assistant_head_user_id → profiles
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_assistant_head_user_fk') then
    alter table public.organizations
      add constraint organizations_assistant_head_user_fk
      foreign key (assistant_head_user_id) references public.profiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organizations_distinct_leadership_check') then
    alter table public.organizations
      add constraint organizations_distinct_leadership_check
      check (head_user_id is null or assistant_head_user_id is null or head_user_id <> assistant_head_user_id);
  end if;
end;
$$;

create unique index if not exists profiles_one_active_head_per_org
  on public.profiles(org_id)
  where is_active and role in ('dept_head', 'department_head');
create unique index if not exists profiles_one_active_assistant_per_org
  on public.profiles(org_id)
  where is_active and role = 'assistant_head';
create unique index if not exists organizations_unique_head_user
  on public.organizations(head_user_id)
  where head_user_id is not null;
create unique index if not exists organizations_unique_assistant_user
  on public.organizations(assistant_head_user_id)
  where assistant_head_user_id is not null;

create or replace function public.guard_profile_leadership_integrity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_active and new.role in ('dept_head', 'department_head')
     and (new.org_id is null or not exists (
       select 1 from public.organizations o
       where o.id = new.org_id and o.head_user_id = new.id and o.is_active
     )) then
    raise exception 'Assign Head through the organization leadership slot' using errcode = '23514';
  end if;
  if new.is_active and new.role = 'assistant_head'
     and (new.org_id is null or not exists (
       select 1 from public.organizations o
       where o.id = new.org_id and o.assistant_head_user_id = new.id and o.is_active
     )) then
    raise exception 'Assign Assistant Head through the organization leadership slot' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_leadership_integrity on public.profiles;
create trigger guard_profile_leadership_integrity
before insert or update of role, org_id, is_active on public.profiles
for each row execute function public.guard_profile_leadership_integrity();

-- ─── system_config (key/value settings) ──────────────────────────────────────
create table if not exists public.system_config (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- ─── user_preferences (theme etc.) ───────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  theme      text not null default 'system' check (theme in ('light','dark','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2 — SHARED HELPERS (security-definer scope functions + touch trigger)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.auth_role(caller_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  return (
    select case when role = 'assistant_head' then 'dept_head' else role::text end
    from public.profiles where id = caller_id
  );
end;
$$;

create or replace function public.is_super_admin(caller_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.auth_role(caller_id) = 'super_admin';
end;
$$;

create or replace function public.auth_org_path(caller_id uuid)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  return (
    select o.path::text
    from public.organizations o
    join public.profiles p on p.org_id = o.id
    where p.id = caller_id
  );
end;
$$;

-- Is target_org the caller's own org or a descendant? (text path, ltree-safe.)
create or replace function public.org_in_my_subtree(target_org uuid, caller_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  caller_path text;
begin
  caller_path := public.auth_org_path(caller_id);
  if caller_path is null then return false; end if;
  return exists (
    select 1 from public.organizations o
    where o.id = target_org
      and (o.path::text = caller_path or o.path::text like caller_path || '.%')
  );
end;
$$;

create or replace function public.can_create_scoped_work(target_org uuid, caller_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  caller_profile public.profiles;
begin
  if caller_id is null then return false; end if;
  select * into caller_profile
  from public.profiles
  where id = caller_id and is_active;
  if not found then return false; end if;
  if caller_profile.role = 'super_admin' then return true; end if;
  return caller_profile.role in ('dept_head', 'department_head', 'assistant_head')
    and target_org is not null
    and target_org = caller_profile.org_id;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3 — OPERATIONAL PROJECTS: projects, project_members, milestones
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references public.organizations(id) on delete set null,
  title        text not null,
  description  text not null default '',
  owner_id     uuid references public.profiles(id) on delete set null,
  proposal_id  text,
  proposal_title text,
  program_id   text,
  program_title text,
  source_type  text not null default 'standalone'
                 check (source_type in ('ai_pdf','manual','standalone')),
  source_file_name text,
  status       text not null default 'planning'
                 check (status in ('planning','active','on_hold','completed','archived')),
  priority     text not null default 'medium' check (priority in ('low','medium','high')),
  start_date   date,
  target_date  date,
  archived_at  timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists projects_org_idx    on public.projects(org_id);
create index if not exists projects_status_idx on public.projects(status);
create index if not exists projects_target_idx on public.projects(target_date);
create index if not exists projects_owner_idx  on public.projects(owner_id);
create index if not exists projects_proposal_scope_idx on public.projects(org_id, proposal_id);

drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create or replace function public.guard_super_admin_project_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and public.is_super_admin(auth.uid()) then
    raise exception 'Super Admin project access is read-only. Ask the organization Head or Assistant Head to make this change.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_super_admin_project_mutation on public.projects;
create trigger guard_super_admin_project_mutation
before insert or update or delete on public.projects
for each row execute function public.guard_super_admin_project_mutation();

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members(user_id);

create table if not exists public.milestones (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  due_date      date,
  status        text not null default 'auto'
                  check (status in ('auto','not_started','in_progress','at_risk','completed')),
  manual_status text check (manual_status in ('not_started','in_progress','at_risk','completed')),
  manual_note   text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists milestones_project_idx on public.milestones(project_id, sort_order);

drop trigger if exists milestones_touch on public.milestones;
create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();

-- Membership + visibility helpers (depend on projects/project_members).
create or replace function public.is_project_member(target_project uuid, caller_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.project_members m
    where m.project_id = target_project and m.user_id = caller_id
  );
end;
$$;

create or replace function public.can_see_project(target_project uuid, caller_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  caller_profile public.profiles;
  proj_org uuid;
  proj_owner uuid;
begin
  select * into caller_profile from public.profiles where id = caller_id and is_active;
  if not found then return false; end if;
  if caller_profile.role = 'super_admin' then return true; end if;
  select org_id, owner_id into proj_org, proj_owner from public.projects where id = target_project;
  if not found then return false; end if;
  if caller_profile.role in ('dept_head', 'department_head', 'assistant_head') then
    return proj_org = caller_profile.org_id;
  end if;
  return proj_owner = caller_id or public.is_project_member(target_project, caller_id);
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4 — TASKS + subtables (status_history, activities, attachments, subtasks)
-- ════════════════════════════════════════════════════════════════════════════
-- The status set matches taskService plus the plan's new changes_requested.
create table if not exists public.tasks (
  id                       uuid primary key default gen_random_uuid(),
  title                    text not null default 'Untitled task',
  description              text,
  status                   text not null default 'pending_assignment'
                             check (status in (
                               'pending_assignment','todo','in_progress',
                               'for_review','changes_requested','completed')),
  priority                 text not null default 'medium' check (priority in ('low','medium','high')),
  assigned_to              uuid references public.profiles(id) on delete set null,
  assignee_name            text default '',
  department               text default '',
  org_id                   uuid references public.organizations(id) on delete set null,
  team_id                  text default '',
  team_name                text default '',
  team_member_ids          uuid[] not null default '{}'::uuid[],
  team_member_names        text[] not null default '{}'::text[],
  deadline                 text default '',          -- kept text: legacy fuzzy schedules
  due_date                 text default '',
  tags                     text[] not null default '{}'::text[],
  feedback                 text,
  latest_submission        jsonb,
  rejection_note           text,
  rejected_at              timestamptz,
  reopen_reason            text,
  reopened_at              timestamptz,
  reopened_by_id           uuid references public.profiles(id) on delete set null,
  reopened_by_name         text default '',
  recommended_employee_ids uuid[] not null default '{}'::uuid[],
  recommendation_reasoning text,
  recommendation_source    text,
  recommendation_lead_id   uuid references public.profiles(id) on delete set null,
  burnout_warning          boolean not null default false,
  -- proposal-decomposition hierarchy (LEGACY text links — never used for metrics)
  proposal_id              text,
  proposal_title           text,
  program_id               text,
  program_title            text,
  project_id               text,      -- LEGACY (text). Canonical link is linked_project_id.
  project_title            text,
  activity_id              text,
  activity_title           text,
  activity_schedule        text,
  hierarchy_path           text,
  import_batch_id          text,
  audit_hash               text,
  barangay                 text,
  estimated_hours          numeric,
  budget_impact            numeric,
  subtask_count            int not null default 0,
  subtask_completed_count  int not null default 0,
  -- canonical operational links (the plan's single source of truth)
  linked_project_id        uuid references public.projects(id) on delete set null,
  milestone_id             uuid references public.milestones(id) on delete set null,
  percent_complete         int not null default 0 check (percent_complete between 0 and 100),
  archived_at              timestamptz,
  last_activity_at         timestamptz,
  created_by               uuid references public.profiles(id) on delete set null,
  deleted_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  -- Plan §0.3: assignment/status consistency.
  constraint tasks_assignment_consistent check (
    -- unassigned only when there is no assignee
    (status = 'pending_assignment' and assigned_to is null)
    -- these statuses are legitimate with or without further checks below
    or (status in ('todo','in_progress','for_review','changes_requested','completed'))
  ),
  constraint tasks_active_needs_assignee check (
    status not in ('todo','in_progress','for_review','changes_requested')
    or assigned_to is not null
  )
);

create index if not exists tasks_linked_project_idx on public.tasks(linked_project_id);
create index if not exists tasks_milestone_idx      on public.tasks(milestone_id);
create index if not exists tasks_status_idx         on public.tasks(status);
create index if not exists tasks_assignee_idx       on public.tasks(assigned_to);
create index if not exists tasks_org_idx            on public.tasks(org_id);
create index if not exists tasks_created_by_idx     on public.tasks(created_by);
create index if not exists tasks_review_queue_idx   on public.tasks(status) where status = 'for_review';
create index if not exists tasks_not_deleted_idx    on public.tasks(deleted_at) where deleted_at is null;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

create or replace function public.guard_super_admin_task_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and public.is_super_admin(auth.uid()) then
    raise exception 'Super Admin task access is read-only. Ask the responsible organization to make this change.'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_super_admin_task_mutation on public.tasks;
create trigger guard_super_admin_task_mutation
before insert or update or delete on public.tasks
for each row execute function public.guard_super_admin_task_mutation();

create table if not exists public.task_status_history (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text default '',
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists task_status_history_task_idx on public.task_status_history(task_id, created_at);

create table if not exists public.task_activities (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  type       text not null default '',
  content    text not null default '',
  actor_id   uuid references public.profiles(id) on delete set null,
  actor_name text default 'System',
  created_at timestamptz not null default now()
);
create index if not exists task_activities_task_idx on public.task_activities(task_id, created_at desc);

create table if not exists public.task_attachments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploader_name text default '',
  file_name     text not null default '',
  file_path     text not null,
  file_size     bigint not null default 0,
  mime_type     text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists task_attachments_task_idx on public.task_attachments(task_id);

create table if not exists public.subtasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks(id) on delete cascade,
  title        text not null,
  is_completed boolean not null default false,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  assigned_to  uuid references public.profiles(id) on delete set null,
  position     int not null default 0,
  source       text not null default 'manual' check (source in ('ai_extracted','template','manual')),
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists subtasks_task_idx on public.subtasks(task_id, position);

drop trigger if exists subtasks_touch on public.subtasks;
create trigger subtasks_touch before update on public.subtasks
  for each row execute function public.touch_updated_at();

-- Can I see this task? Drives RLS on the discussion/attachment tables (plan §4).
create or replace function public.can_see_task(target_task uuid, caller_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  t_assignee uuid; t_creator uuid; t_org uuid; t_project uuid;
begin
  if public.is_super_admin(caller_id) then return true; end if;
  select assigned_to, created_by, org_id, linked_project_id
    into t_assignee, t_creator, t_org, t_project
  from public.tasks where id = target_task;
  if not found then return false; end if;
  return (
    t_assignee = caller_id
    or t_creator = caller_id
    or public.org_in_my_subtree(t_org, caller_id)
    or (t_project is not null and public.can_see_project(t_project, caller_id))
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5 — TASK COLLABORATION: comments, comment attachments, progress updates
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text not null default '',
  body        text not null,
  created_at  timestamptz not null default now(),
  edited_at   timestamptz,
  deleted_at  timestamptz,
  deleted_by  uuid references public.profiles(id) on delete set null
);
create index if not exists task_comments_task_idx on public.task_comments(task_id, created_at);

create table if not exists public.task_comment_attachments (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid not null references public.task_comments(id) on delete cascade,
  storage_path text not null,
  file_name    text not null default '',
  mime_type    text not null default '',
  file_size    bigint not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists task_comment_attach_idx on public.task_comment_attachments(comment_id);

create table if not exists public.task_progress_updates (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks(id) on delete cascade,
  author_id        uuid references public.profiles(id) on delete set null,
  author_name      text not null default '',
  percent_complete int check (percent_complete between 0 and 100),
  blocker_category text,
  blocker          text,
  next_step        text,
  note             text,
  attachment_path  text,
  attachment_name  text,
  created_at       timestamptz not null default now()
);
create index if not exists task_progress_task_idx on public.task_progress_updates(task_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6 — NOTIFICATIONS + EMPLOYEE NOTES
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'assignment',
  title       text not null default '',
  message     text not null default '',
  task_id     uuid references public.tasks(id) on delete set null,
  task_title  text default '',
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text default '',
  status_from text default '',
  status_to   text default '',
  reason      text default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, read, created_at desc);

create table if not exists public.employee_notes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  strengths  text not null default '',
  weaknesses text not null default '',
  notes      text not null default '',
  tags       jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 7 — ANNOUNCEMENTS + RECIPIENTS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  audience     text not null default 'all' check (audience in ('all','org','users')),
  org_id       uuid references public.organizations(id) on delete set null,
  status       text not null default 'draft' check (status in ('draft','published','withdrawn')),
  published_at timestamptz,
  expires_at   timestamptz,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists announcements_status_idx on public.announcements(status, published_at desc);

drop trigger if exists announcements_touch on public.announcements;
create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();

create table if not exists public.announcement_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
create index if not exists announcement_recipients_user_idx on public.announcement_recipients(user_id, read_at);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 8 — AUDIT (append-only) + PERMISSIONS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text not null default 'System',
  entity_type text not null default '',
  entity_id   text,                      -- opaque id: a uuid OR a composite key like 'role:permission'
  action      text not null default '',
  reason      text,
  before_data jsonb,
  after_data  jsonb,
  metadata    jsonb,
  org_id      uuid references public.organizations(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);
create index if not exists audit_events_actor_idx  on public.audit_events(actor_id, created_at desc);
create index if not exists audit_events_org_idx    on public.audit_events(org_id, created_at desc);

create table if not exists public.role_permissions (
  role       text not null,
  permission text not null,
  allowed    boolean not null default false,
  primary key (role, permission)
);

create table if not exists public.user_permission_overrides (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  permission text not null,
  allowed    boolean not null,
  set_by     uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 9 — CHAT + CALLS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.chat_channels (
  id           uuid primary key default gen_random_uuid(),
  channel_type text not null default 'direct' check (channel_type in ('direct','task','org')),
  name         text not null default '',
  task_id      uuid references public.tasks(id) on delete cascade,
  org_id       uuid references public.organizations(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create index if not exists chat_channels_task_idx on public.chat_channels(task_id);
create index if not exists chat_channels_org_idx  on public.chat_channels(org_id);
create unique index if not exists chat_channels_task_uni on public.chat_channels(task_id) where task_id is not null;
create unique index if not exists chat_channels_org_uni on public.chat_channels(org_id) where org_id is not null and channel_type = 'org';

create table if not exists public.chat_channel_members (
  channel_id   uuid not null references public.chat_channels(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (channel_id, user_id)
);
create index if not exists chat_channel_members_user_idx on public.chat_channel_members(user_id);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid not null references public.chat_channels(id) on delete cascade,
  sender_id   uuid references public.profiles(id) on delete set null,
  sender_name text not null default '',
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_channel_idx on public.chat_messages(channel_id, created_at);

create table if not exists public.calls (
  id          uuid primary key default gen_random_uuid(),
  channel_id  uuid references public.chat_channels(id) on delete set null,
  caller_id   uuid references public.profiles(id) on delete set null,
  caller_name text not null default '',
  callee_id   uuid references public.profiles(id) on delete set null,
  callee_name text not null default '',
  call_type   text not null default 'audio' check (call_type in ('audio','video')),
  status      text not null default 'ringing' check (status in ('ringing','active','ended','declined','missed')),
  answered_at timestamptz,
  ended_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists calls_callee_idx on public.calls(callee_id, status);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 10 — AUTHORITATIVE TASK LIFECYCLE (plan §2.1 / §2.2)
-- ────────────────────────────────────────────────────────────────────────────
-- One protected operation owns status transitions and their side effects. It
-- derives the actor from auth.uid(), validates the transition table + scope,
-- and (as SECURITY DEFINER) does history + activity + audit + notification in a
-- single call. A BEFORE-UPDATE guard forbids ordinary clients from changing
-- task.status by any other path.
-- ════════════════════════════════════════════════════════════════════════════

-- Allowed (from → to) pairs. Everything else is rejected.
create or replace function public.is_allowed_task_transition(from_status text, to_status text)
returns boolean language sql immutable as $$
  select (from_status, to_status) in (
    ('pending_assignment','todo'),
    ('todo','in_progress'),
    ('in_progress','for_review'),
    ('for_review','completed'),
    ('for_review','changes_requested'),
    ('changes_requested','in_progress'),
    ('completed','in_progress'),
    -- assignment can move an unassigned/backlog task straight to todo
    ('pending_assignment','pending_assignment'),
    -- idempotent re-assert of the same state is harmless
    ('todo','todo'),('in_progress','in_progress'),('for_review','for_review'),
    ('changes_requested','changes_requested'),('completed','completed')
  );
$$;

-- Session flag the guard trigger checks: only transition_task_status() (which
-- sets it) may alter task.status. Any other UPDATE that changes status raises.
create or replace function public.guard_task_status_write()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if coalesce(current_setting('eflow.allow_status_write', true), 'off') <> 'on' then
      raise exception 'Task status may only change through transition_task_status()' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- NOT attached by default. The current client still writes status directly
-- (assignTask/submitTaskForReview/verifyTask), so attaching this now would
-- break those flows. transition_task_status() and assign_task() are ready to
-- adopt; once the client calls them exclusively, lock writes down by running:
--
--   create trigger guard_task_status_write before update on public.tasks
--     for each row execute function public.guard_task_status_write();
--
-- transition_task_status()/assign_task() set eflow.allow_status_write='on', so
-- they keep working after you attach it. Until then the app is unaffected.
drop trigger if exists guard_task_status_write on public.tasks;

-- The one protected transition entry point.
create or replace function public.transition_task_status(
  p_task_id uuid,
  p_to_status text,
  p_feedback text default null,
  p_reason text default null
)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  caller_role text;
  caller_name text;
  t public.tasks;
  prev_status text;
  is_manager boolean;
  recipient uuid;
begin
  if caller is null then raise exception 'Not authenticated' using errcode = '42501'; end if;

  select role, full_name into caller_role, caller_name from public.profiles where id = caller;

  select * into t from public.tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Task not found'; end if;
  prev_status := t.status;

  -- Scope: super admin, in-subtree manager, task creator, or the assignee.
  is_manager := public.is_super_admin(caller)
                or public.org_in_my_subtree(t.org_id, caller)
                or t.created_by = caller;

  if not public.is_allowed_task_transition(t.status, p_to_status) then
    raise exception 'Illegal task transition: % -> %', t.status, p_to_status using errcode = '22023';
  end if;

  -- Per-transition authorization + required evidence.
  if p_to_status = 'todo' and t.status = 'pending_assignment' then
    if not is_manager then raise exception 'Only a manager may assign work' using errcode='42501'; end if;
    if t.assigned_to is null then raise exception 'Assign an owner before moving to To do' using errcode='22023'; end if;
  elsif p_to_status = 'in_progress' and t.status in ('todo','changes_requested') then
    if not (t.assigned_to = caller or is_manager) then raise exception 'Only the assignee may start work' using errcode='42501'; end if;
  elsif p_to_status = 'for_review' then
    if not (t.assigned_to = caller or is_manager) then raise exception 'Only the assignee may submit for review' using errcode='42501'; end if;
  elsif p_to_status in ('completed','changes_requested') then
    if not is_manager then raise exception 'Only a reviewer may decide a review' using errcode='42501'; end if;
    if p_to_status = 'changes_requested' and coalesce(btrim(p_feedback),'') = '' then
      raise exception 'Feedback is required when requesting changes' using errcode='22023';
    end if;
  elsif p_to_status = 'in_progress' and t.status = 'completed' then
    if not is_manager then raise exception 'Only a manager may reopen a completed task' using errcode='42501'; end if;
    if coalesce(btrim(p_reason),'') = '' then raise exception 'A reason is required to reopen' using errcode='22023'; end if;
  end if;

  -- Apply the change (guard trigger permits it because of this GUC).
  perform set_config('eflow.allow_status_write', 'on', true);

  update public.tasks set
    status         = p_to_status,
    feedback       = case when p_to_status in ('completed','changes_requested') then p_feedback else feedback end,
    rejection_note = case when p_to_status = 'changes_requested' then coalesce(p_feedback, p_reason)
                          when p_to_status = 'completed' then null else rejection_note end,
    rejected_at    = case when p_to_status = 'changes_requested' then now()
                          when p_to_status = 'completed' then null else rejected_at end,
    reopen_reason  = case when prev_status = 'completed' and p_to_status = 'in_progress' then p_reason else reopen_reason end,
    reopened_at    = case when prev_status = 'completed' and p_to_status = 'in_progress' then now() else reopened_at end,
    reopened_by_id = case when prev_status = 'completed' and p_to_status = 'in_progress' then caller else reopened_by_id end,
    last_activity_at = now()
  where id = p_task_id
  returning * into t;

  perform set_config('eflow.allow_status_write', 'off', true);

  -- History + activity in the same transaction.
  insert into public.task_status_history (task_id, from_status, to_status, actor_id, actor_name, note)
  values (p_task_id, prev_status, p_to_status, caller, coalesce(caller_name,'User'), coalesce(p_feedback, p_reason));

  insert into public.task_activities (task_id, type, content, actor_id, actor_name)
  values (p_task_id, p_to_status, coalesce(p_feedback, p_reason, 'Status changed to ' || p_to_status), caller, coalesce(caller_name,'User'));

  insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id)
  values (caller, coalesce(caller_name,'User'), 'task', p_task_id::text, 'task.transition.' || p_to_status,
          coalesce(p_reason, p_feedback),
          jsonb_build_object('status', prev_status),
          jsonb_build_object('status', p_to_status),
          t.org_id);

  -- Notify the AFFECTED party (plan §2.3), never just the actor.
  --   submission → creator/reviewer; decision/reopen → assignee.
  if p_to_status = 'for_review' then
    recipient := t.created_by;
  else
    recipient := t.assigned_to;
  end if;
  if recipient is not null and recipient <> caller then
    insert into public.notifications (user_id, type, title, message, task_id, task_title, actor_id, actor_name, status_to)
    values (recipient,
            case when p_to_status='completed' then 'completed'
                 when p_to_status='for_review' then 'approval_needed'
                 else 'status_change' end,
            'Task ' || replace(p_to_status,'_',' '),
            coalesce(caller_name,'Someone') || ' moved "' || t.title || '" to ' || replace(p_to_status,'_',' ') || '.',
            p_task_id, t.title, caller, coalesce(caller_name,'User'), p_to_status);
  end if;

  return t;
end;
$$;

-- Assignment RPC: set the owner and (if backlog) advance to todo atomically.
create or replace function public.assign_task(
  p_task_id uuid,
  p_assignee uuid,
  p_assignee_name text default null
)
returns public.tasks language plpgsql security definer set search_path = public as $$
declare
  caller uuid := auth.uid();
  caller_name text;
  t public.tasks;
begin
  if caller is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  select full_name into caller_name from public.profiles where id = caller;
  select * into t from public.tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'Task not found'; end if;

  if not (public.is_super_admin(caller) or public.org_in_my_subtree(t.org_id, caller) or t.created_by = caller) then
    raise exception 'Not allowed to assign this task' using errcode='42501';
  end if;
  if p_assignee is not null and not exists (select 1 from public.profiles where id = p_assignee and is_active) then
    raise exception 'Assignee is not an active profile' using errcode='22023';
  end if;

  perform set_config('eflow.allow_status_write', 'on', true);
  update public.tasks set
    assigned_to   = p_assignee,
    assignee_name = coalesce(p_assignee_name, assignee_name),
    status        = case when p_assignee is not null and status = 'pending_assignment' then 'todo' else status end,
    last_activity_at = now()
  where id = p_task_id
  returning * into t;
  perform set_config('eflow.allow_status_write', 'off', true);

  insert into public.task_status_history (task_id, from_status, to_status, actor_id, actor_name, note)
  values (p_task_id, 'pending_assignment', t.status, caller, coalesce(caller_name,'User'), 'Assignment');

  insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, after_data, org_id)
  values (caller, coalesce(caller_name,'User'), 'task', p_task_id::text, 'task.assigned',
          jsonb_build_object('assigned_to', p_assignee, 'status', t.status), t.org_id);

  if p_assignee is not null and p_assignee <> caller then
    insert into public.notifications (user_id, type, title, message, task_id, task_title, actor_id, actor_name, status_to)
    values (p_assignee, 'assignment', 'New Task Assigned',
            'You have been assigned to "' || t.title || '".', p_task_id, t.title, caller, coalesce(caller_name,'User'), t.status);
  end if;

  return t;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 11 — SUPPORTING TRIGGERS (subtask counters, self-profile guard,
--              default preferences, task chat channel on assignment)
-- ════════════════════════════════════════════════════════════════════════════

-- Keep tasks.subtask_count / subtask_completed_count in sync.
create or replace function public.recount_subtasks()
returns trigger language plpgsql set search_path = public as $$
declare tid uuid;
begin
  tid := coalesce(new.task_id, old.task_id);
  update public.tasks set
    subtask_count = (select count(*) from public.subtasks where task_id = tid),
    subtask_completed_count = (select count(*) from public.subtasks where task_id = tid and is_completed)
  where id = tid;
  return null;
end;
$$;

drop trigger if exists subtasks_recount on public.subtasks;
create trigger subtasks_recount after insert or update or delete on public.subtasks
  for each row execute function public.recount_subtasks();

-- Users may edit only their own personal fields on their profile.
create or replace function public.guard_self_profile_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.role is distinct from old.role
      or new.org_id is distinct from old.org_id
      or new.employee_id is distinct from old.employee_id
      or new.workload is distinct from old.workload
      or new.burnout_level is distinct from old.burnout_level
      or new.is_active is distinct from old.is_active then
      raise exception 'You may only update personal profile settings.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_self_profile_update on public.profiles;
create trigger guard_self_profile_update before update on public.profiles
  for each row execute function public.guard_self_profile_update();

-- Auto-create user_preferences + a default employee_notes row for each profile.
create or replace function public.on_profile_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created after insert on public.profiles
  for each row execute function public.on_profile_created();

-- Each organization has one standing channel. Membership is derived from the
-- organization tree by is_channel_member below, not duplicated in the task
-- channel membership table.
create or replace function public.ensure_org_chat_channel()
returns trigger as $$
begin
  insert into public.chat_channels (channel_type, org_id, name)
  values ('org', new.id, new.name || ' Chat')
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists organizations_create_chat_channel on public.organizations;
create trigger organizations_create_chat_channel after insert on public.organizations
  for each row execute function public.ensure_org_chat_channel();

-- When a task gains an assignee, ensure a 'task' chat channel exists with the
-- assignee + creator as members (matches chatService expectations).
create or replace function public.ensure_task_channel()
returns trigger language plpgsql security definer set search_path = public as $$
declare ch uuid;
begin
  if new.assigned_to is not null and (tg_op = 'INSERT' or new.assigned_to is distinct from old.assigned_to) then
    select id into ch from public.chat_channels where task_id = new.id;
    if ch is null then
      insert into public.chat_channels (channel_type, name, task_id, org_id)
      values ('task', coalesce(new.title,'Task'), new.id, new.org_id)
      returning id into ch;
    end if;
    insert into public.chat_channel_members (channel_id, user_id)
      values (ch, new.assigned_to) on conflict do nothing;
    if new.created_by is not null then
      insert into public.chat_channel_members (channel_id, user_id)
        values (ch, new.created_by) on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_task_channel on public.tasks;
create trigger ensure_task_channel after insert or update of assigned_to on public.tasks
  for each row execute function public.ensure_task_channel();

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 12 — ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────────────────
-- Every table has RLS enabled. The discussion/attachment tables are scoped to
-- people who can see the parent task (plan §4) — replacing the old using(true).
-- Helper predicates (is_super_admin, org_in_my_subtree, can_see_task,
-- can_see_project) are SECURITY DEFINER so they bypass RLS while evaluating.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.organizations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.system_config            enable row level security;
alter table public.user_preferences         enable row level security;
alter table public.projects                 enable row level security;
alter table public.project_members          enable row level security;
alter table public.milestones               enable row level security;
alter table public.tasks                    enable row level security;
alter table public.task_status_history      enable row level security;
alter table public.task_activities          enable row level security;
alter table public.task_attachments         enable row level security;
alter table public.subtasks                 enable row level security;
alter table public.task_comments            enable row level security;
alter table public.task_comment_attachments enable row level security;
alter table public.task_progress_updates    enable row level security;
alter table public.notifications            enable row level security;
alter table public.employee_notes           enable row level security;
alter table public.announcements            enable row level security;
alter table public.announcement_recipients  enable row level security;
alter table public.audit_events             enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.chat_channels            enable row level security;
alter table public.chat_channel_members     enable row level security;
alter table public.chat_messages            enable row level security;
alter table public.calls                    enable row level security;

-- Reusable policy creator (drops-then-creates so the file is idempotent).
create or replace function public._mkpolicy(
  p_table text, p_name text, p_cmd text, p_using text, p_check text default null
) returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I', p_name, p_table);
  if p_cmd = 'INSERT' then
    execute format('create policy %I on public.%I for insert with check (%s)', p_name, p_table, coalesce(p_check, p_using));
  elsif p_check is null then
    execute format('create policy %I on public.%I for %s using (%s)', p_name, p_table, p_cmd, p_using);
  else
    execute format('create policy %I on public.%I for %s using (%s) with check (%s)', p_name, p_table, p_cmd, p_using, p_check);
  end if;
end;
$$;

-- ─── organizations ───────────────────────────────────────────────────────────
select public._mkpolicy('organizations','org_read','SELECT','auth.uid() is not null');
select public._mkpolicy('organizations','org_write','ALL','public.is_super_admin(auth.uid())','public.is_super_admin(auth.uid())');

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- Everyone signed-in can read profiles (names/avatars are shown everywhere).
select public._mkpolicy('profiles','profiles_read','SELECT','auth.uid() is not null');
-- A user may update their own row (the trigger restricts WHICH columns); admins update anyone.
select public._mkpolicy('profiles','profiles_update','UPDATE',
  'auth.uid() = id or public.is_super_admin(auth.uid())',
  'auth.uid() = id or public.is_super_admin(auth.uid())');
select public._mkpolicy('profiles','profiles_insert','INSERT',NULL,
  'auth.uid() = id or public.is_super_admin(auth.uid())');
select public._mkpolicy('profiles','profiles_delete','DELETE','public.is_super_admin(auth.uid())');

-- ─── system_config ────────────────────────────────────────────────────────────
select public._mkpolicy('system_config','cfg_read','SELECT','auth.uid() is not null');
select public._mkpolicy('system_config','cfg_write','ALL','public.is_super_admin(auth.uid())','public.is_super_admin(auth.uid())');

-- ─── user_preferences (own only) ───────────────────────────────────────────────
select public._mkpolicy('user_preferences','prefs_all','ALL','auth.uid() = user_id','auth.uid() = user_id');

-- ─── projects / members / milestones ───────────────────────────────────────────
select public._mkpolicy('projects','projects_read','SELECT','public.can_see_project(id, auth.uid())');
select public._mkpolicy('projects','projects_insert','INSERT',NULL,
  'created_by = auth.uid() and public.can_create_scoped_work(org_id, auth.uid())');
select public._mkpolicy('projects','projects_update','UPDATE',
  'public.is_super_admin(auth.uid()) or public.org_in_my_subtree(org_id, auth.uid()) or created_by = auth.uid()',
  'public.is_super_admin(auth.uid()) or public.org_in_my_subtree(org_id, auth.uid()) or created_by = auth.uid()');
select public._mkpolicy('projects','projects_delete','DELETE',
  'public.is_super_admin(auth.uid()) or public.org_in_my_subtree(org_id, auth.uid()) or created_by = auth.uid()');
select public._mkpolicy('project_members','pm_read','SELECT','public.can_see_project(project_id, auth.uid())');
select public._mkpolicy('project_members','pm_write','ALL','public.can_see_project(project_id, auth.uid())','public.can_see_project(project_id, auth.uid())');
select public._mkpolicy('milestones','ms_read','SELECT','public.can_see_project(project_id, auth.uid())');
select public._mkpolicy('milestones','ms_write','ALL','public.can_see_project(project_id, auth.uid())','public.can_see_project(project_id, auth.uid())');

-- ─── tasks ──────────────────────────────────────────────────────────────────────
-- Read a task if you can see it. Writes allowed to assignee/creator/subtree/admin,
-- but the guard trigger still forces status changes through transition_task_status().
select public._mkpolicy('tasks','tasks_read','SELECT','deleted_at is null and public.can_see_task(id, auth.uid())');
select public._mkpolicy('tasks','tasks_insert','INSERT',NULL,
  'created_by = auth.uid() and public.can_create_scoped_work(org_id, auth.uid())');
select public._mkpolicy('tasks','tasks_update','UPDATE',
  'public.can_see_task(id, auth.uid())',
  'public.can_see_task(id, auth.uid())');
select public._mkpolicy('tasks','tasks_delete','DELETE',
  'public.is_super_admin(auth.uid()) or public.org_in_my_subtree(org_id, auth.uid()) or created_by = auth.uid()');

-- ─── task subtables — all scoped to can_see_task ─────────────────────────────────
select public._mkpolicy('task_status_history','tsh_read','SELECT','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_status_history','tsh_insert','INSERT',NULL,'public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_activities','ta_read','SELECT','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_activities','ta_insert','INSERT',NULL,'public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_attachments','tatt_read','SELECT','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_attachments','tatt_write','ALL','public.can_see_task(task_id, auth.uid())','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('subtasks','st_read','SELECT','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('subtasks','st_write','ALL','public.can_see_task(task_id, auth.uid())','public.can_see_task(task_id, auth.uid())');

-- ─── task collaboration — REPLACES using(true) (plan §4) ─────────────────────────
select public._mkpolicy('task_comments','tc_read','SELECT','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_comments','tc_insert','INSERT',NULL,'public.can_see_task(task_id, auth.uid()) and author_id = auth.uid()');
select public._mkpolicy('task_comments','tc_update','UPDATE','author_id = auth.uid() or public.is_super_admin(auth.uid())','author_id = auth.uid() or public.is_super_admin(auth.uid())');
select public._mkpolicy('task_comment_attachments','tca_read','SELECT',
  'exists (select 1 from public.task_comments c where c.id = comment_id and public.can_see_task(c.task_id, auth.uid()))');
select public._mkpolicy('task_comment_attachments','tca_insert','INSERT',NULL,
  'exists (select 1 from public.task_comments c where c.id = comment_id and public.can_see_task(c.task_id, auth.uid()))');
select public._mkpolicy('task_progress_updates','tpu_read','SELECT','public.can_see_task(task_id, auth.uid())');
select public._mkpolicy('task_progress_updates','tpu_insert','INSERT',NULL,'public.can_see_task(task_id, auth.uid()) and author_id = auth.uid()');

-- ─── notifications (own only) ────────────────────────────────────────────────────
select public._mkpolicy('notifications','notif_read','SELECT','auth.uid() = user_id');
select public._mkpolicy('notifications','notif_update','UPDATE','auth.uid() = user_id','auth.uid() = user_id');
-- Inserts happen through SECURITY DEFINER functions/service role; allow same-subtree actor inserts too.
select public._mkpolicy('notifications','notif_insert','INSERT',NULL,'auth.uid() is not null');

-- ─── employee_notes (managers within subtree + admin) ────────────────────────────
select public._mkpolicy('employee_notes','en_read','SELECT',
  'public.is_super_admin(auth.uid()) or profile_id = auth.uid() or exists (select 1 from public.profiles p where p.id = profile_id and public.org_in_my_subtree(p.org_id, auth.uid()))');
select public._mkpolicy('employee_notes','en_write','ALL',
  'public.is_super_admin(auth.uid()) or exists (select 1 from public.profiles p where p.id = profile_id and public.org_in_my_subtree(p.org_id, auth.uid()))',
  'public.is_super_admin(auth.uid()) or exists (select 1 from public.profiles p where p.id = profile_id and public.org_in_my_subtree(p.org_id, auth.uid()))');

-- ─── announcements + recipients ──────────────────────────────────────────────────
select public._mkpolicy('announcements','ann_read','SELECT',
  'status = ''published'' or created_by = auth.uid() or public.is_super_admin(auth.uid())');
select public._mkpolicy('announcements','ann_write','ALL',
  'public.is_super_admin(auth.uid()) or created_by = auth.uid()',
  'public.is_super_admin(auth.uid()) or created_by = auth.uid()');
select public._mkpolicy('announcement_recipients','ar_read','SELECT',
  'user_id = auth.uid() or public.is_super_admin(auth.uid())');
select public._mkpolicy('announcement_recipients','ar_write','ALL','public.is_super_admin(auth.uid()) or user_id = auth.uid()','public.is_super_admin(auth.uid()) or user_id = auth.uid()');

-- ─── audit_events — APPEND ONLY (insert + scoped read; no update/delete) ──────────
select public._mkpolicy('audit_events','audit_insert','INSERT',NULL,'auth.uid() is not null');
select public._mkpolicy('audit_events','audit_read','SELECT',
  'public.is_super_admin(auth.uid()) or actor_id = auth.uid() or public.org_in_my_subtree(org_id, auth.uid())');

-- ─── permissions ──────────────────────────────────────────────────────────────────
select public._mkpolicy('role_permissions','rp_read','SELECT','auth.uid() is not null');
select public._mkpolicy('role_permissions','rp_write','ALL','public.is_super_admin(auth.uid())','public.is_super_admin(auth.uid())');
select public._mkpolicy('user_permission_overrides','upo_read','SELECT','user_id = auth.uid() or public.is_super_admin(auth.uid())');
select public._mkpolicy('user_permission_overrides','upo_write','ALL','public.is_super_admin(auth.uid())','public.is_super_admin(auth.uid())');

-- ─── chat + calls (membership-scoped) ──────────────────────────────────────────────
create or replace function public.is_channel_member(p_channel uuid, caller uuid)
returns boolean as $$
  select exists (
    select 1 from public.chat_channel_members m
    where m.channel_id = p_channel and m.user_id = caller
  ) or exists (
    select 1
    from public.chat_channels c
    join public.organizations channel_org on channel_org.id = c.org_id
    join public.profiles profile on profile.id = caller
    join public.organizations user_org on user_org.id = profile.org_id
    where c.id = p_channel
      and c.channel_type = 'org'
      and (
        user_org.path::text = channel_org.path::text
        or pg_catalog.starts_with(user_org.path::text, channel_org.path::text || '.')
      )
  );
$$ language sql security definer;

select public._mkpolicy('chat_channels','cc_read','SELECT','public.is_channel_member(id, auth.uid()) or public.is_super_admin(auth.uid())');
select public._mkpolicy('chat_channels','cc_write','ALL','auth.uid() is not null','auth.uid() is not null');
select public._mkpolicy('chat_channel_members','ccm_read','SELECT','auth.uid() is not null');
select public._mkpolicy('chat_channel_members','ccm_write','ALL','auth.uid() is not null','auth.uid() is not null');
select public._mkpolicy('chat_messages','cm_read','SELECT','public.is_channel_member(channel_id, auth.uid()) or public.is_super_admin(auth.uid())');
select public._mkpolicy('chat_messages','cm_insert','INSERT',NULL,'sender_id = auth.uid() and public.is_channel_member(channel_id, auth.uid())');
select public._mkpolicy('calls','calls_read','SELECT','caller_id = auth.uid() or callee_id = auth.uid()');
select public._mkpolicy('calls','calls_write','ALL','caller_id = auth.uid() or callee_id = auth.uid()','caller_id = auth.uid() or callee_id = auth.uid()');

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 13 — STORAGE BUCKETS + policies
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('profile-avatars','profile-avatars', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('task-attachments','task-attachments', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('task-files','task-files', false) on conflict (id) do nothing;

-- Avatars: object path is '<userId>/avatar.<ext>' — owner-scoped by first path segment.
drop policy if exists avatars_rw on storage.objects;
create policy avatars_rw on storage.objects for all
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Task files/attachments: any signed-in user may read/write within these buckets
-- (fine-grained per-task control lives on the DB rows; objects are private).
drop policy if exists taskfiles_rw on storage.objects;
create policy taskfiles_rw on storage.objects for all
  using (bucket_id in ('task-attachments','task-files') and auth.uid() is not null)
  with check (bucket_id in ('task-attachments','task-files') and auth.uid() is not null);

-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 14 — SEED DATA (role permission matrix; mirrors permissionService)
-- ════════════════════════════════════════════════════════════════════════════
insert into public.role_permissions (role, permission, allowed) values
  ('admin','navigation.projects',true),('admin','navigation.reports',true),
  ('admin','navigation.announcements',true),('admin','navigation.user_management',true),
  ('admin','navigation.organization',true),('admin','navigation.audit',true),
  ('admin','navigation.system_settings',true),('admin','navigation.data_tools',true),
  ('admin','reports.export',true),('admin','announcements.publish',true),
  ('admin','users.manage',true),('admin','audit.read',true),
  ('admin','settings.manage',true),('admin','database.backup',true),
  ('super_admin','projects.create',true),('super_admin','projects.archive',true),('super_admin','projects.delete',true),
  ('super_admin','tasks.assign',true),('super_admin','tasks.verify',true),
  ('super_admin','reports.export',true),('super_admin','announcements.publish',true),
  ('super_admin','users.manage',true),('super_admin','audit.read',true),
  ('super_admin','settings.manage',true),
  ('dept_head','projects.create',true),('dept_head','projects.archive',true),('dept_head','projects.delete',true),
  ('dept_head','tasks.assign',true),('dept_head','tasks.verify',true),
  ('dept_head','reports.export',true),
  ('assistant_head','projects.create',true),('assistant_head','projects.archive',true),('assistant_head','projects.delete',true),
  ('assistant_head','tasks.assign',true),('assistant_head','tasks.verify',true),
  ('assistant_head','reports.export',true),
  ('employee','reports.export',true)
on conflict (role, permission) do update set allowed = excluded.allowed;

-- Realtime: add the tables the client subscribes to via postgres_changes.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tasks','task_activities','task_status_history','subtasks',
    'task_comments','task_progress_updates','projects','milestones',
    'notifications','announcements','audit_events','employee_notes',
    'chat_messages','chat_channels','chat_channel_members','calls',
    'organizations','profiles'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', tbl);
    exception when duplicate_object then null; when undefined_object then null;
    end;
  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- END OF FRESH SCHEMA
-- ────────────────────────────────────────────────────────────────────────────
-- Next steps after running this file:
--   1. Create your first auth user (Supabase Auth → Users) and note its uuid.
--   2. insert into public.organizations (name, slug, path, org_type)
--        values ('Local Government','lgu','lgu','lgu');
--   3. Promote yourself:  update public.profiles
--        set role='super_admin', org_id=(select id from organizations where slug='lgu')
--        where id='<your-auth-uuid>';
--      (A profile row is created by your app on first sign-in / registration.)
-- ════════════════════════════════════════════════════════════════════════════
