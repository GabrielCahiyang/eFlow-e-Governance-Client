-- Archived & Blockchain-Sealed Project Retention, Controlled Purge, Trail Preservation,
-- Fiscal Budget Rollup, and Admin Maintenance RPCs.
--
-- Keeps permanently:
--   - public.audit_events (plus new retention disposition & hold audit entries)
--   - public.budget_ledger_entries (financial audit trail, FKs decoupled to SET NULL + retained_reference)
--   - public.general_journal_entries & public.general_journal_lines (accounting trail)
--   - public.fiscal_budget_purged_totals (preserves exact FY committed & spent figures)
--   - public.task_status_history, public.project_field_history, public.work_tree_events, public.project_library_events
--   - public.project_seal_certificates, eflow_seal.snapshots (on-chain metadata), eflow_seal.transaction_attempts
--   - eflow_retention.project_dispositions (permanent Certificate of Disposition ledger)
--
-- Purges on expiry (only when archived, not on legal hold, and confirmed sealed by default):
--   - Operational project records, tasks, subtasks, comments, chat, attachments, library files,
--     allocations, fund cash requests, liquidations, receipts, and queued storage blobs.
--   - Never touches standalone Office Petty Cash (eflow_office_cash) or user PDS files.

begin;

-- ---------------------------------------------------------------------------
-- 1. Retention policy defaults in public.system_config
-- ---------------------------------------------------------------------------
insert into public.system_config(key, value)
values
  ('project_auto_archive_days', '30'),
  ('archive_retention_days', '1825'),
  ('archive_retention_notice_days', '30'),
  ('archive_retention_require_seal', 'true'),
  ('archive_retention_auto_purge', 'false'),
  ('archive_retention_public_mode', 'keep_manifest_purge_files')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Dedicated retention schema & tables
-- ---------------------------------------------------------------------------
create schema if not exists eflow_retention;
revoke all on schema eflow_retention from public, anon, authenticated;
grant usage on schema eflow_retention to service_role;

create table if not exists eflow_retention.project_holds (
  project_id uuid primary key references public.projects(id) on delete cascade,
  is_active boolean not null default true,
  reason text not null,
  placed_by uuid references public.profiles(id) on delete set null,
  placed_at timestamptz not null default now(),
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  release_reason text
);
alter table eflow_retention.project_holds enable row level security;
create index if not exists idx_retention_holds_placed_by
  on eflow_retention.project_holds (placed_by) where placed_by is not null;
create index if not exists idx_retention_holds_released_by
  on eflow_retention.project_holds (released_by) where released_by is not null;

create table if not exists eflow_retention.project_dispositions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique,
  project_title text not null,
  org_id uuid references public.organizations(id) on delete set null,
  org_name text not null,
  archived_at timestamptz,
  sealed_at timestamptz,
  latest_certificate_id uuid,
  manifest_hash text,
  tx_hash text,
  block_number bigint,
  retention_days_applied integer not null,
  public_archive_mode text not null
    check (public_archive_mode in ('keep_manifest_purge_files', 'purge_all_public', 'keep_full_public')),
  purge_trigger text not null
    check (purge_trigger in ('scheduled', 'admin_manual', 'admin_early_override')),
  purged_by uuid references public.profiles(id) on delete set null,
  purged_by_name text not null,
  purged_at timestamptz not null default now(),
  reason text not null,
  row_counts jsonb not null default '{}'::jsonb,
  preserved_trail_counts jsonb not null default '{}'::jsonb,
  storage_objects_queued integer not null default 0,
  storage_bytes_queued bigint not null default 0,
  fiscal_rollup jsonb not null default '[]'::jsonb
);
alter table eflow_retention.project_dispositions enable row level security;
create index if not exists idx_retention_dispositions_purged_at
  on eflow_retention.project_dispositions (purged_at desc);
create index if not exists idx_retention_dispositions_org_id
  on eflow_retention.project_dispositions (org_id) where org_id is not null;
create index if not exists idx_retention_dispositions_purged_by
  on eflow_retention.project_dispositions (purged_by) where purged_by is not null;

create table if not exists eflow_retention.storage_delete_queue (
  id bigint generated always as identity primary key,
  disposition_id uuid not null references eflow_retention.project_dispositions(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  byte_size bigint not null default 0,
  status text not null default 'pending' check (status in ('pending', 'deleted', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (disposition_id, bucket_id, object_path)
);
alter table eflow_retention.storage_delete_queue enable row level security;
create index if not exists idx_retention_storage_queue_pending
  on eflow_retention.storage_delete_queue (status, id) where status in ('pending', 'failed');
create index if not exists idx_retention_storage_queue_disposition
  on eflow_retention.storage_delete_queue (disposition_id);

create table if not exists eflow_retention.notice_log (
  project_id uuid not null references public.projects(id) on delete cascade,
  notice_kind text not null
    check (notice_kind in ('notice_warning', 'notice_7d', 'ready_for_purge', 'blocked_unsealed')),
  sent_at timestamptz not null default now(),
  primary key (project_id, notice_kind)
);
alter table eflow_retention.notice_log enable row level security;

revoke all on all tables in schema eflow_retention from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Permanent Fiscal Rollup Table (prevents FY budget total drift after purge)
-- ---------------------------------------------------------------------------
create table if not exists public.fiscal_budget_purged_totals (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('budget', 'partition')),
  fiscal_budget_id uuid not null references public.department_fiscal_budgets(id) on delete restrict,
  org_id uuid not null references public.organizations(id) on delete restrict,
  partition_id uuid references public.office_budget_sections(id) on delete set null,
  disposition_id uuid not null references eflow_retention.project_dispositions(id) on delete restrict,
  project_id uuid not null,
  project_title text not null,
  committed_amount numeric(16,2) not null default 0 check (committed_amount >= 0),
  spent_amount numeric(16,2) not null default 0 check (spent_amount >= 0),
  created_at timestamptz not null default now()
);
alter table public.fiscal_budget_purged_totals enable row level security;
create index if not exists idx_fiscal_purged_totals_budget_scope
  on public.fiscal_budget_purged_totals (fiscal_budget_id, scope);
create index if not exists idx_fiscal_purged_totals_partition
  on public.fiscal_budget_purged_totals (partition_id) where partition_id is not null;
create index if not exists idx_fiscal_purged_totals_org
  on public.fiscal_budget_purged_totals (org_id);
create index if not exists idx_fiscal_purged_totals_disposition
  on public.fiscal_budget_purged_totals (disposition_id);

drop trigger if exists fiscal_budget_purged_totals_append_only on public.fiscal_budget_purged_totals;
create trigger fiscal_budget_purged_totals_append_only
  before update or delete on public.fiscal_budget_purged_totals
  for each row execute function public.prevent_budget_ledger_mutation();

revoke all on public.fiscal_budget_purged_totals from public, anon, authenticated;

-- Update budget summary & section helpers to include purged archived project totals.
create or replace function eflow_budget.legacy_summary(p_org_id uuid, p_fiscal_year integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  budget public.department_fiscal_budgets;
  committed numeric := 0;
  spent numeric := 0;
  purged_committed numeric := 0;
  purged_spent numeric := 0;
  petty_reserved numeric := 0;
  released_today numeric := 0;
  scheduled_today numeric := 0;
begin
  if auth.uid() is null or not public.can_view_department_budget(p_org_id, auth.uid()) then
    raise exception 'Budget access denied' using errcode = '42501';
  end if;
  select * into budget
  from public.department_fiscal_budgets
  where org_id = p_org_id and fiscal_year = p_fiscal_year;
  if not found then return null; end if;

  select coalesce(sum(committed_amount), 0), coalesce(sum(spent_amount), 0)
  into purged_committed, purged_spent
  from public.fiscal_budget_purged_totals
  where fiscal_budget_id = budget.id and scope = 'budget';

  select coalesce(sum(amount), 0) + purged_committed
  into committed
  from public.budget_commitments
  where fiscal_budget_id = budget.id and status = 'active';

  select coalesce(sum(actual_spent), 0) + purged_spent
  into spent
  from public.petty_cash_requests
  where fiscal_budget_id = budget.id and status = 'settled';

  select coalesce(sum(case when status = 'settled' then 0 else greatest(coalesce(approved_amount, 0) - coalesce(actual_spent, 0) - coalesce(returned_amount, 0), 0) end), 0)
  into petty_reserved
  from public.petty_cash_requests
  where fiscal_budget_id = budget.id
    and status in ('approved','scheduled_for_release','partially_released','released','liquidation_submitted','pending_leader_liquidation_review','pending_department_settlement','changes_requested','overdue_liquidation');

  select coalesce(sum(amount), 0) into released_today
  from public.petty_cash_releases
  where org_id = p_org_id and coalesce(released_at::date, scheduled_date) = current_date and status = 'released';

  select coalesce(sum(amount), 0) into scheduled_today
  from public.petty_cash_releases
  where org_id = p_org_id and scheduled_date = current_date and status = 'scheduled';

  return jsonb_build_object(
    'id', budget.id, 'orgId', budget.org_id, 'fiscalYear', budget.fiscal_year, 'status', budget.status,
    'approvedAmount', budget.approved_amount, 'committedAmount', committed, 'spentAmount', spent,
    'availableAmount', greatest(0, budget.approved_amount - committed), 'commitmentRemaining', greatest(0, committed - spent),
    'dailyPettyCashReleaseLimit', budget.daily_petty_cash_release_limit, 'perReceiptLimit', budget.per_receipt_limit,
    'liquidationDueDays', budget.liquidation_due_days, 'allowReceiptLimitOverride', budget.allow_receipt_limit_override,
    'releasedToday', released_today, 'scheduledToday', scheduled_today,
    'dailyReleaseRemaining', greatest(0, budget.daily_petty_cash_release_limit - released_today - scheduled_today),
    'pettyCashLimit', budget.daily_petty_cash_release_limit, 'pettyCashRequestLimit', budget.per_receipt_limit,
    'pettyCashReserved', petty_reserved, 'pettyCashSpent', spent,
    'pettyCashAvailable', greatest(0, budget.daily_petty_cash_release_limit - released_today - scheduled_today),
    'underutilizationThreshold', budget.underutilization_threshold, 'notes', budget.notes,
    'lockedAt', budget.locked_at, 'updatedAt', budget.updated_at
  );
end;
$function$;

create or replace function eflow_budget.partition_committed(p_section uuid)
returns numeric
language sql
stable
set search_path to ''
as $function$
  select
    (select coalesce(sum(f.amount), 0)
     from eflow_project.funding f
     join public.budget_commitments c on c.id = f.commitment_id
     where f.partition_id = p_section and c.status = 'active')
    +
    (select coalesce(sum(l.amount), 0)
     from public.work_budget_allocation_lines l
     join public.work_budget_allocations a on a.id = l.allocation_id
     join public.budget_commitments c on c.id = a.commitment_id
     where l.budget_partition_id = p_section
       and a.subtask_id is null
       and a.status = 'approved'
       and c.status = 'active'
       and l.project_funding_id is null)
    +
    (select coalesce(sum(pt.committed_amount), 0)
     from public.fiscal_budget_purged_totals pt
     where pt.scope = 'partition' and pt.partition_id = p_section);
$function$;

create or replace function eflow_budget.account_reservations(p_account uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  with amounts as (
    select p.id::text id, p.title name, sum(f.amount) amount
    from eflow_project.funding f
    join public.projects p on p.id = f.project_id
    join public.budget_commitments c on c.id = f.commitment_id
    where f.partition_id = p_account and c.status = 'active'
    group by p.id, p.title
    union all
    select t.id::text, t.title, sum(l.amount)
    from public.work_budget_allocation_lines l
    join public.work_budget_allocations a on a.id = l.allocation_id
    join public.tasks t on t.id = a.task_id
    join public.budget_commitments c on c.id = a.commitment_id
    where l.budget_partition_id = p_account
      and l.project_funding_id is null
      and a.subtask_id is null
      and a.status = 'approved'
      and c.status = 'active'
    group by t.id, t.title
    union all
    select coalesce(p.id::text, t.id::text),
      coalesce(p.title, t.title) || ' (settled spending)',
      sum(eflow_budget.request_line_obligation(r.id, l.id))
    from public.petty_cash_requests r
    join public.petty_cash_request_lines rl on rl.request_id = r.id
    join public.work_budget_allocation_lines l on l.id = rl.allocation_line_id
    join public.work_budget_allocations a on a.id = l.allocation_id
    join public.budget_commitments c on c.id = a.commitment_id
    join public.tasks t on t.id = r.task_id
    left join public.projects p on p.id = t.linked_project_id
    where l.budget_partition_id = p_account and r.status = 'settled' and c.status <> 'active'
    group by p.id, p.title, t.id, t.title
    union all
    select pt.project_id::text,
      pt.project_title || ' (archived & purged)',
      sum(pt.committed_amount)
    from public.fiscal_budget_purged_totals pt
    where pt.scope = 'partition' and pt.partition_id = p_account
    group by pt.project_id, pt.project_title
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('id', id, 'name', name, 'amount', amount) order by name, id)
      filter (where amount > 0),
    '[]'::jsonb
  )
  from amounts;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Detach trail tables so ZERO audit/history/ledger trails are ever lost
-- ---------------------------------------------------------------------------
alter table public.budget_ledger_entries
  add column if not exists retained_project_id uuid,
  add column if not exists retained_reference jsonb;

alter table public.budget_ledger_entries
  drop constraint if exists budget_ledger_entries_task_id_fkey,
  add constraint budget_ledger_entries_task_id_fkey
    foreign key (task_id) references public.tasks(id) on delete set null,
  drop constraint if exists budget_ledger_entries_subtask_id_fkey,
  add constraint budget_ledger_entries_subtask_id_fkey
    foreign key (subtask_id) references public.subtasks(id) on delete set null,
  drop constraint if exists budget_ledger_entries_commitment_id_fkey,
  add constraint budget_ledger_entries_commitment_id_fkey
    foreign key (commitment_id) references public.budget_commitments(id) on delete set null,
  drop constraint if exists budget_ledger_entries_allocation_id_fkey,
  add constraint budget_ledger_entries_allocation_id_fkey
    foreign key (allocation_id) references public.work_budget_allocations(id) on delete set null,
  drop constraint if exists budget_ledger_entries_allocation_line_id_fkey,
  add constraint budget_ledger_entries_allocation_line_id_fkey
    foreign key (allocation_line_id) references public.work_budget_allocation_lines(id) on delete set null,
  drop constraint if exists budget_ledger_entries_petty_cash_request_id_fkey,
  add constraint budget_ledger_entries_petty_cash_request_id_fkey
    foreign key (petty_cash_request_id) references public.petty_cash_requests(id) on delete set null;

alter table public.project_field_history
  add column if not exists retained_project_id uuid;
alter table public.project_field_history
  alter column project_id drop not null;
alter table public.project_field_history
  drop constraint if exists project_field_history_project_id_fkey,
  add constraint project_field_history_project_id_fkey
    foreign key (project_id) references public.projects(id) on delete set null;

alter table public.task_status_history
  add column if not exists retained_project_id uuid,
  add column if not exists retained_task_id uuid,
  add column if not exists retained_task_title text;
alter table public.task_status_history
  alter column task_id drop not null;
alter table public.task_status_history
  drop constraint if exists task_status_history_task_id_fkey,
  add constraint task_status_history_task_id_fkey
    foreign key (task_id) references public.tasks(id) on delete set null;

alter table public.project_library_events
  add column if not exists retained_file_id uuid,
  add column if not exists retained_file_name text;
alter table public.project_library_events
  alter column file_id drop not null;
alter table public.project_library_events
  drop constraint if exists project_library_events_file_id_fkey,
  add constraint project_library_events_file_id_fkey
    foreign key (file_id) references public.project_library_files(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 5. Public blockchain certificate retention metadata (for EflowPublic)
-- ---------------------------------------------------------------------------
alter table public.project_seal_certificates
  add column if not exists retention_purged_at timestamptz,
  add column if not exists retention_purge_mode text,
  add column if not exists retention_disposition_id uuid,
  add column if not exists retention_reason text;

-- ---------------------------------------------------------------------------
-- 6. Policy reader + configurable auto-archive clock
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.policy()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_auto_archive int := 30;
  v_retention_days int := 1825;
  v_notice_days int := 30;
  v_require_seal boolean := true;
  v_auto_purge boolean := false;
  v_public_mode text := 'keep_manifest_purge_files';
  v_raw text;
begin
  select value into v_raw from public.system_config where key = 'project_auto_archive_days';
  if v_raw ~ '^\d+$' then v_auto_archive := greatest(1, least(3650, v_raw::int)); end if;

  select value into v_raw from public.system_config where key = 'archive_retention_days';
  if v_raw ~ '^\d+$' then v_retention_days := greatest(1, least(7300, v_raw::int)); end if;

  select value into v_raw from public.system_config where key = 'archive_retention_notice_days';
  if v_raw ~ '^\d+$' then v_notice_days := greatest(1, least(365, v_raw::int)); end if;

  select value into v_raw from public.system_config where key = 'archive_retention_require_seal';
  if lower(coalesce(v_raw, '')) in ('true', 'false') then v_require_seal := (lower(v_raw) = 'true'); end if;

  select value into v_raw from public.system_config where key = 'archive_retention_auto_purge';
  if lower(coalesce(v_raw, '')) in ('true', 'false') then v_auto_purge := (lower(v_raw) = 'true'); end if;

  select value into v_raw from public.system_config where key = 'archive_retention_public_mode';
  if v_raw in ('keep_manifest_purge_files', 'purge_all_public', 'keep_full_public') then
    v_public_mode := v_raw;
  end if;

  return jsonb_build_object(
    'project_auto_archive_days', v_auto_archive,
    'archive_retention_days', v_retention_days,
    'archive_retention_notice_days', v_notice_days,
    'archive_retention_require_seal', v_require_seal,
    'archive_retention_auto_purge', v_auto_purge,
    'archive_retention_public_mode', v_public_mode
  );
end $$;

-- Update eflow_seal.archive_due_projects() to honor configurable project_auto_archive_days.
create or replace function eflow_seal.archive_due_projects()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  p record;
  head_id uuid;
  blockers jsonb;
  archived_count integer := 0;
  reminded_count integer := 0;
  v_archive_days integer := coalesce((eflow_retention.policy()->>'project_auto_archive_days')::integer, 30);
  v_remind_days integer := greatest(0, v_archive_days - least(7, greatest(1, v_archive_days - 1)));
begin
  for p in
    select * from public.projects
    where status = 'completed'
      and completed_at is not null
      and completed_at <= now() - make_interval(days => v_remind_days)
    order by id
    for update skip locked
  loop
    select o.head_user_id into head_id
    from public.organizations o
    join public.profiles u on u.id = o.head_user_id
    where o.id = p.org_id and o.is_active and u.is_active and u.role::text = 'head';

    if p.archive_reminded_at is null and head_id is not null then
      insert into public.notifications(user_id, type, title, message, project_id, org_id)
      values (
        head_id,
        'project_archive_reminder',
        'Project ready to archive',
        p.title || ' will be archived on '
          || to_char((p.completed_at + make_interval(days => v_archive_days)) at time zone 'Asia/Manila', 'DD Mon YYYY, HH24:MI')
          || ' PHT if it stays completed. Blockchain publication stays manual.',
        p.id,
        p.org_id
      );
      update public.projects set archive_reminded_at = now() where id = p.id;
      reminded_count := reminded_count + 1;
    end if;

    if p.completed_at > now() - make_interval(days => v_archive_days) then
      continue;
    end if;

    blockers := public.project_completion_readiness_internal(p.id)->'blockers';
    if jsonb_array_length(blockers) > 0 then
      if p.archive_blocked_at is null and head_id is not null then
        insert into public.notifications(user_id, type, title, message, project_id, org_id)
        values (head_id, 'project_archive_blocked', 'Auto-archive needs attention', p.title || ': ' || (blockers->0->>'title'), p.id, p.org_id);
        update public.projects set archive_blocked_at = now() where id = p.id;
      end if;
      continue;
    end if;

    begin
      update public.projects set status = 'archived', archived_at = now(), updated_at = now() where id = p.id;
      insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, before_data, after_data, org_id)
      values (
        null,
        'eFlow archive scheduler',
        'project',
        p.id::text,
        'project.auto_archived',
        format('Completed for %s days; closeout checks passed.', v_archive_days),
        jsonb_build_object('status', 'completed'),
        jsonb_build_object('status', 'archived', 'completed_at', p.completed_at),
        p.org_id
      );
      archived_count := archived_count + 1;
    exception when others then
      if p.archive_blocked_at is null and head_id is not null then
        insert into public.notifications(user_id, type, title, message, project_id, org_id)
        values (head_id, 'project_archive_blocked', 'Auto-archive needs attention', p.title || ' could not be archived: ' || left(sqlerrm, 250), p.id, p.org_id);
        update public.projects set archive_blocked_at = now() where id = p.id;
      end if;
    end;
  end loop;
  return jsonb_build_object('archived', archived_count, 'reminded', reminded_count);
end $function$;

-- ---------------------------------------------------------------------------
-- 7. Collect every Storage object linked to a project (working + seal buckets)
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.project_storage_objects(
  p_project_id uuid,
  p_public_mode text default 'keep_manifest_purge_files'
)
returns table (bucket_id text, object_path text, byte_size bigint)
language sql
stable
security definer
set search_path to ''
as $$
  with
  p_proj as (
    select id, source_collaboration_draft_id
    from public.projects
    where id = p_project_id
  ),
  exclusive_drafts as (
    select d.source_collaboration_draft_id as id
    from p_proj d
    where d.source_collaboration_draft_id is not null
      and not exists (
        select 1 from public.projects other
        where other.id <> p_project_id
          and other.source_collaboration_draft_id = d.source_collaboration_draft_id
      )
  ),
  p_tasks as (
    select id from public.tasks where linked_project_id = p_project_id
  ),
  p_subtasks as (
    select id from public.subtasks where task_id in (select id from p_tasks)
  ),
  p_reqs as (
    select id from public.petty_cash_requests
    where task_id in (select id from p_tasks)
       or subtask_id in (select id from p_subtasks)
  ),
  p_liqs as (
    select id from public.petty_cash_liquidations
    where request_id in (select id from p_reqs)
  ),
  p_channels as (
    select id from public.chat_channels
    where project_id = p_project_id or task_id in (select id from p_tasks)
  ),
  p_snaps as (
    select id::text as snap_id, manifest_hash
    from eflow_seal.snapshots
    where project_id = p_project_id
    union
    select id::text as snap_id, manifest_hash
    from public.project_seal_certificates
    where project_id = p_project_id
  ),
  raw_paths(bucket_id, object_path) as (
    -- Receipts & financial request attachments
    select 'budget-receipts', ltrim(r.file_path, '/')
    from public.petty_cash_receipts r
    where r.liquidation_id in (select id from p_liqs) and r.file_path is not null
    union
    select 'budget-receipts', ltrim(a.file_path, '/')
    from public.petty_cash_request_attachments a
    where a.request_id in (select id from p_reqs) and a.file_path is not null
    -- Task & subtask work attachments
    union
    select 'task-attachments', ltrim(ta.file_path, '/')
    from public.task_attachments ta
    where ta.task_id in (select id from p_tasks) and ta.file_path is not null
    union
    select 'task-attachments', ltrim(tp.attachment_path, '/')
    from public.task_progress_updates tp
    where tp.task_id in (select id from p_tasks) and tp.attachment_path is not null
    union
    select 'task-attachments', ltrim(sa.file_path, '/')
    from public.subtask_submission_attachments sa
    where (sa.task_id in (select id from p_tasks) or sa.subtask_id in (select id from p_subtasks))
      and sa.file_path is not null
    union
    select 'task-attachments', ltrim(sp.attachment_path, '/')
    from public.subtask_progress_updates sp
    where (sp.task_id in (select id from p_tasks) or sp.subtask_id in (select id from p_subtasks))
      and sp.attachment_path is not null
    -- Task comment attachments
    union
    select 'task-comment-attachments', ltrim(ca.storage_path, '/')
    from public.task_comment_attachments ca
    join public.task_comments c on c.id = ca.comment_id
    where c.task_id in (select id from p_tasks) and ca.storage_path is not null
    -- Work evidence bucket
    union
    select 'm7-work-evidence', ltrim(eo.object_name, '/')
    from eflow_evidence.objects eo
    where (eo.task_id in (select id from p_tasks) or eo.subtask_id in (select id from p_subtasks))
      and eo.object_name is not null
    -- Project library
    union
    select 'project-library', ltrim(lf.object_path, '/')
    from public.project_library_files lf
    where lf.project_id = p_project_id and lf.object_path is not null
    -- Project & task chat images
    union
    select 'conversation-images', ltrim(cm.image_path, '/')
    from public.chat_messages cm
    where cm.channel_id in (select id from p_channels) and cm.image_path is not null
    -- Exclusive proposal drafts
    union
    select 'proposal-drafts', ltrim(pd.source_file_path, '/')
    from public.proposal_collaboration_drafts pd
    where pd.id in (select id from exclusive_drafts) and pd.source_file_path is not null
    union
    select 'proposal-drafts', ltrim(pg.minutes_file_path, '/')
    from public.proposal_governance_records pg
    where pg.draft_id in (select id from exclusive_drafts) and pg.minutes_file_path is not null
    -- Seal staging & private buckets (always purged when operational project purges)
    union
    select so.bucket_id, so.name
    from storage.objects so
    where so.bucket_id in ('project-seal-private', 'project-seal-copies')
      and exists (
        select 1 from p_snaps s
        where (s.snap_id is not null and so.name like s.snap_id || '/%')
           or (s.manifest_hash is not null and so.name like s.manifest_hash || '/%')
      )
    -- Public sealed archive bucket (policy-controlled)
    union
    select so.bucket_id, so.name
    from storage.objects so
    where so.bucket_id = 'project-seal-public'
      and p_public_mode <> 'keep_full_public'
      and exists (
        select 1 from p_snaps s
        where s.manifest_hash is not null
          and (
            (p_public_mode = 'purge_all_public' and so.name like s.manifest_hash || '/%')
            or (p_public_mode = 'keep_manifest_purge_files' and so.name like s.manifest_hash || '/files/%')
          )
      )
  )
  select distinct
    rp.bucket_id,
    rp.object_path,
    coalesce((so.metadata->>'size')::bigint, 0) as byte_size
  from raw_paths rp
  left join storage.objects so
    on so.bucket_id = rp.bucket_id and so.name = rp.object_path
  where rp.object_path is not null and btrim(rp.object_path) <> '';
$$;

-- ---------------------------------------------------------------------------
-- 8. Admin Overview & Dry-Run Preview RPCs
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.overview()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_policy jsonb := eflow_retention.policy();
  v_retention_days int := (v_policy->>'archive_retention_days')::int;
  v_notice_days int := (v_policy->>'archive_retention_notice_days')::int;
  v_require_seal boolean := (v_policy->>'archive_retention_require_seal')::boolean;
  v_public_mode text := v_policy->>'archive_retention_public_mode';
begin
  return jsonb_build_object(
    'policy', v_policy,
    'archivedProjects', coalesce((
      with archived as (
        select
          p.id,
          p.title,
          p.org_id,
          o.name as org_name,
          p.completed_at,
          coalesce(p.archived_at, p.updated_at, p.created_at) as archived_at,
          cert.id as latest_certificate_id,
          cert.version as latest_seal_version,
          cert.sealed_at,
          cert.tx_hash,
          cert.block_number,
          cert.manifest_hash,
          h.is_active as hold_active,
          h.reason as hold_reason,
          h.placed_at as hold_placed_at,
          hp.full_name as hold_placed_by_name
        from public.projects p
        join public.organizations o on o.id = p.org_id
        left join lateral (
          select c.id, c.version, c.sealed_at, c.tx_hash, c.block_number, c.manifest_hash
          from public.project_seal_certificates c
          where c.project_id = p.id
          order by c.version desc, c.sealed_at desc
          limit 1
        ) cert on true
        left join eflow_retention.project_holds h on h.project_id = p.id
        left join public.profiles hp on hp.id = h.placed_by
        where p.status = 'archived'
      ),
      enriched as (
        select
          a.*,
          (a.latest_certificate_id is not null) as is_sealed,
          case
            when a.latest_certificate_id is not null then greatest(a.archived_at, a.sealed_at)
            when not v_require_seal then a.archived_at
            else null
          end as retention_anchor_at,
          (select count(*)::int from public.tasks t where t.linked_project_id = a.id) as task_count,
          (
            select count(*)::int
            from public.petty_cash_receipts r
            join public.petty_cash_liquidations l on l.id = r.liquidation_id
            join public.petty_cash_requests req on req.id = l.request_id
            join public.tasks t on t.id = req.task_id
            where t.linked_project_id = a.id
          ) as receipt_count,
          (select count(*)::int from eflow_retention.project_storage_objects(a.id, v_public_mode)) as storage_object_count,
          (select coalesce(sum(byte_size), 0)::bigint from eflow_retention.project_storage_objects(a.id, v_public_mode)) as storage_bytes
        from archived a
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'title', e.title,
          'orgId', e.org_id,
          'orgName', e.org_name,
          'completedAt', e.completed_at,
          'archivedAt', e.archived_at,
          'isSealed', e.is_sealed,
          'latestCertificateId', e.latest_certificate_id,
          'latestSealVersion', e.latest_seal_version,
          'sealedAt', e.sealed_at,
          'txHash', e.tx_hash,
          'blockNumber', e.block_number,
          'manifestHash', e.manifest_hash,
          'retentionAnchorAt', e.retention_anchor_at,
          'expiresAt', case when e.retention_anchor_at is not null then e.retention_anchor_at + make_interval(days => v_retention_days) else null end,
          'daysRemaining', case
            when e.retention_anchor_at is not null then
              ceil(extract(epoch from ((e.retention_anchor_at + make_interval(days => v_retention_days)) - now())) / 86400.0)::int
            else null
          end,
          'isExpired', (
            e.retention_anchor_at is not null
            and (e.retention_anchor_at + make_interval(days => v_retention_days)) <= now()
          ),
          'legalHold', jsonb_build_object(
            'active', coalesce(e.hold_active, false),
            'reason', e.hold_reason,
            'placedAt', e.hold_placed_at,
            'placedByName', e.hold_placed_by_name
          ),
          'status', case
            when coalesce(e.hold_active, false) then 'on_hold'
            when v_require_seal and not e.is_sealed then 'blocked_unsealed'
            when e.retention_anchor_at is not null
              and (e.retention_anchor_at + make_interval(days => v_retention_days)) <= now() then 'ready_for_purge'
            when e.retention_anchor_at is not null
              and (e.retention_anchor_at + make_interval(days => v_retention_days)) <= now() + make_interval(days => v_notice_days) then 'expiring_soon'
            else 'retained'
          end,
          'taskCount', e.task_count,
          'receiptCount', e.receipt_count,
          'storageObjectCount', e.storage_object_count,
          'storageBytes', e.storage_bytes
        )
        order by e.archived_at asc, e.title asc
      )
      from enriched e
    ), '[]'::jsonb),
    'dispositions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'projectId', d.project_id,
          'projectTitle', d.project_title,
          'orgId', d.org_id,
          'orgName', d.org_name,
          'archivedAt', d.archived_at,
          'sealedAt', d.sealed_at,
          'latestCertificateId', d.latest_certificate_id,
          'manifestHash', d.manifest_hash,
          'txHash', d.tx_hash,
          'blockNumber', d.block_number,
          'retentionDaysApplied', d.retention_days_applied,
          'publicArchiveMode', d.public_archive_mode,
          'purgeTrigger', d.purge_trigger,
          'purgedByName', d.purged_by_name,
          'purgedAt', d.purged_at,
          'reason', d.reason,
          'rowCounts', d.row_counts,
          'preservedTrailCounts', d.preserved_trail_counts,
          'storageObjectsQueued', d.storage_objects_queued,
          'storageBytesQueued', d.storage_bytes_queued,
          'fiscalRollup', d.fiscal_rollup,
          'storagePending', (select count(*)::int from eflow_retention.storage_delete_queue q where q.disposition_id = d.id and q.status = 'pending'),
          'storageDeleted', (select count(*)::int from eflow_retention.storage_delete_queue q where q.disposition_id = d.id and q.status = 'deleted'),
          'storageFailed', (select count(*)::int from eflow_retention.storage_delete_queue q where q.disposition_id = d.id and q.status = 'failed')
        )
        order by d.purged_at desc
      )
      from eflow_retention.project_dispositions d
    ), '[]'::jsonb),
    'storageQueue', (
      select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'deleted', count(*) filter (where status = 'deleted'),
        'failed', count(*) filter (where status = 'failed'),
        'bytesReclaimed', coalesce(sum(byte_size) filter (where status = 'deleted'), 0),
        'bytesPending', coalesce(sum(byte_size) filter (where status in ('pending', 'failed')), 0)
      )
      from eflow_retention.storage_delete_queue
    )
  );
end $$;

create or replace function eflow_retention.preview_project_purge(
  p_project_id uuid,
  p_public_mode text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_policy jsonb := eflow_retention.policy();
  v_mode text := coalesce(nullif(p_public_mode, ''), v_policy->>'archive_retention_public_mode');
  v_retention_days int := (v_policy->>'archive_retention_days')::int;
  v_require_seal boolean := (v_policy->>'archive_retention_require_seal')::boolean;
  v_proj record;
  v_cert record;
  v_hold record;
  v_anchor timestamptz;
  v_expires timestamptz;
  v_task_ids uuid[];
  v_subtask_ids uuid[];
  v_req_ids uuid[];
  v_liq_ids uuid[];
  v_commit_ids uuid[];
  v_alloc_ids uuid[];
  v_channel_ids uuid[];
  v_storage_by_bucket jsonb;
  v_storage_count int;
  v_storage_bytes bigint;
  v_fiscal_rollup jsonb;
begin
  if v_mode not in ('keep_manifest_purge_files', 'purge_all_public', 'keep_full_public') then
    raise exception 'Unsupported public archive disposition mode' using errcode = '22023';
  end if;

  select p.*, o.name as org_name
  into v_proj
  from public.projects p
  join public.organizations o on o.id = p.org_id
  where p.id = p_project_id;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  select c.* into v_cert
  from public.project_seal_certificates c
  where c.project_id = p_project_id
  order by c.version desc, c.sealed_at desc
  limit 1;

  select h.* into v_hold
  from eflow_retention.project_holds h
  where h.project_id = p_project_id and h.is_active;

  if v_cert.id is not null then
    v_anchor := greatest(coalesce(v_proj.archived_at, v_proj.updated_at), v_cert.sealed_at);
  elsif not v_require_seal and v_proj.status = 'archived' then
    v_anchor := coalesce(v_proj.archived_at, v_proj.updated_at);
  end if;
  if v_anchor is not null then
    v_expires := v_anchor + make_interval(days => v_retention_days);
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_task_ids
  from public.tasks where linked_project_id = p_project_id;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_subtask_ids
  from public.subtasks where task_id = any(v_task_ids);

  select coalesce(array_agg(distinct id), '{}'::uuid[]) into v_commit_ids
  from (
    select commitment_id as id from eflow_project.funding where project_id = p_project_id and commitment_id is not null
    union
    select commitment_id as id from public.work_budget_allocations where task_id = any(v_task_ids) and commitment_id is not null
  ) c;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_alloc_ids
  from public.work_budget_allocations
  where task_id = any(v_task_ids) or commitment_id = any(v_commit_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_req_ids
  from public.petty_cash_requests
  where task_id = any(v_task_ids)
     or subtask_id = any(v_subtask_ids)
     or commitment_id = any(v_commit_ids)
     or allocation_id = any(v_alloc_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_liq_ids
  from public.petty_cash_liquidations where request_id = any(v_req_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_channel_ids
  from public.chat_channels where project_id = p_project_id or task_id = any(v_task_ids);

  select
    coalesce(jsonb_agg(jsonb_build_object('bucket', b.bucket_id, 'files', b.cnt, 'bytes', b.total_bytes) order by b.bucket_id), '[]'::jsonb),
    coalesce(sum(b.cnt), 0)::int,
    coalesce(sum(b.total_bytes), 0)::bigint
  into v_storage_by_bucket, v_storage_count, v_storage_bytes
  from (
    select bucket_id, count(*)::int as cnt, coalesce(sum(byte_size), 0)::bigint as total_bytes
    from eflow_retention.project_storage_objects(p_project_id, v_mode)
    group by bucket_id
  ) b;

  select coalesce(jsonb_agg(jsonb_build_object(
    'fiscalBudgetId', fb.id,
    'fiscalYear', fb.fiscal_year,
    'budgetStatus', fb.status,
    'committedAmount', coalesce(c_agg.amt, 0),
    'spentAmount', coalesce(s_agg.amt, 0)
  ) order by fb.fiscal_year), '[]'::jsonb)
  into v_fiscal_rollup
  from (
    select distinct fiscal_budget_id from public.budget_commitments where id = any(v_commit_ids)
    union
    select distinct fiscal_budget_id from public.petty_cash_requests where id = any(v_req_ids)
  ) ids
  join public.department_fiscal_budgets fb on fb.id = ids.fiscal_budget_id
  left join lateral (
    select sum(amount) as amt from public.budget_commitments
    where id = any(v_commit_ids) and fiscal_budget_id = fb.id and status = 'active'
  ) c_agg on true
  left join lateral (
    select sum(actual_spent) as amt from public.petty_cash_requests
    where id = any(v_req_ids) and fiscal_budget_id = fb.id and status = 'settled'
  ) s_agg on true;

  return jsonb_build_object(
    'projectId', v_proj.id,
    'projectTitle', v_proj.title,
    'orgName', v_proj.org_name,
    'status', v_proj.status,
    'archivedAt', v_proj.archived_at,
    'isSealed', v_cert.id is not null,
    'sealedAt', v_cert.sealed_at,
    'txHash', v_cert.tx_hash,
    'manifestHash', v_cert.manifest_hash,
    'legalHoldActive', v_hold.project_id is not null,
    'legalHoldReason', v_hold.reason,
    'expiresAt', v_expires,
    'isExpired', (v_expires is not null and v_expires <= now()),
    'publicArchiveMode', v_mode,
    'canPurgeNormally', (
      v_proj.status = 'archived'
      and v_hold.project_id is null
      and (not v_require_seal or v_cert.id is not null)
      and v_expires is not null
      and v_expires <= now()
    ),
    'canPurgeWithEarlyOverride', (
      v_proj.status = 'archived'
      and v_hold.project_id is null
      and (not v_require_seal or v_cert.id is not null)
    ),
    'rowsToPurge', jsonb_build_object(
      'projects', 1,
      'tasks', coalesce(array_length(v_task_ids, 1), 0),
      'subtasks', coalesce(array_length(v_subtask_ids, 1), 0),
      'milestones', (select count(*)::int from public.milestones where project_id = p_project_id),
      'cashRequests', coalesce(array_length(v_req_ids, 1), 0),
      'liquidations', coalesce(array_length(v_liq_ids, 1), 0),
      'receipts', (select count(*)::int from public.petty_cash_receipts where liquidation_id = any(v_liq_ids)),
      'budgetAllocations', coalesce(array_length(v_alloc_ids, 1), 0),
      'budgetCommitments', coalesce(array_length(v_commit_ids, 1), 0),
      'taskAttachments', (select count(*)::int from public.task_attachments where task_id = any(v_task_ids))
        + (select count(*)::int from public.subtask_submission_attachments where task_id = any(v_task_ids) or subtask_id = any(v_subtask_ids)),
      'comments', (select count(*)::int from public.task_comments where task_id = any(v_task_ids)),
      'chatMessages', (select count(*)::int from public.chat_messages where channel_id = any(v_channel_ids)),
      'libraryFiles', (select count(*)::int from public.project_library_files where project_id = p_project_id)
    ),
    'trailsPreserved', jsonb_build_object(
      'auditEvents', (
        select count(*)::int from public.audit_events
        where entity_id = p_project_id::text
           or entity_id = any(select unnest(v_task_ids)::text)
           or entity_id = any(select unnest(v_subtask_ids)::text)
           or entity_id = any(select unnest(v_req_ids)::text)
           or entity_id = any(select unnest(v_liq_ids)::text)
      ),
      'budgetLedgerEntries', (
        select count(*)::int from public.budget_ledger_entries
        where task_id = any(v_task_ids)
           or subtask_id = any(v_subtask_ids)
           or commitment_id = any(v_commit_ids)
           or allocation_id = any(v_alloc_ids)
           or petty_cash_request_id = any(v_req_ids)
      ),
      'generalJournalEntries', (
        select count(*)::int from public.general_journal_entries
        where source_id in (
          select id from public.petty_cash_releases where request_id = any(v_req_ids)
          union
          select unnest(v_liq_ids)
        )
      ),
      'taskStatusHistory', (select count(*)::int from public.task_status_history where task_id = any(v_task_ids)),
      'projectFieldHistory', (select count(*)::int from public.project_field_history where project_id = p_project_id),
      'workTreeEvents', (select count(*)::int from public.work_tree_events where project_id = p_project_id),
      'projectLibraryEvents', (select count(*)::int from public.project_library_events where project_id = p_project_id),
      'blockchainCertificates', (select count(*)::int from public.project_seal_certificates where project_id = p_project_id)
    ),
    'storageSummary', jsonb_build_object(
      'totalFiles', v_storage_count,
      'totalBytes', v_storage_bytes,
      'byBucket', v_storage_by_bucket
    ),
    'fiscalRollup', v_fiscal_rollup
  );
end $$;

-- ---------------------------------------------------------------------------
-- 9. Legal Hold Management
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.set_legal_hold(
  p_project_id uuid,
  p_hold boolean,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_proj record;
  v_actor_name text;
  v_clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if length(v_clean_reason) not between 5 and 1000 then
    raise exception 'Enter a clear reason (5–1000 characters) for this legal hold change.' using errcode = '22023';
  end if;

  select p.id, p.title, p.org_id, p.status into v_proj
  from public.projects p where p.id = p_project_id for update;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if v_proj.status <> 'archived' then
    raise exception 'Legal hold applies only to archived projects' using errcode = '22023';
  end if;

  select coalesce(full_name, email, 'Admin') into v_actor_name
  from public.profiles where id = p_actor_id;

  if p_hold then
    insert into eflow_retention.project_holds(project_id, is_active, reason, placed_by, placed_at, released_by, released_at, release_reason)
    values (p_project_id, true, v_clean_reason, p_actor_id, now(), null, null, null)
    on conflict (project_id) do update
    set is_active = true,
        reason = excluded.reason,
        placed_by = excluded.placed_by,
        placed_at = now(),
        released_by = null,
        released_at = null,
        release_reason = null;
  else
    update eflow_retention.project_holds
    set is_active = false,
        released_by = p_actor_id,
        released_at = now(),
        release_reason = v_clean_reason
    where project_id = p_project_id;
  end if;

  insert into public.audit_events(actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id)
  values (
    p_actor_id,
    coalesce(v_actor_name, 'Admin'),
    'project',
    p_project_id::text,
    case when p_hold then 'retention.legal_hold_placed' else 'retention.legal_hold_released' end,
    v_clean_reason,
    jsonb_build_object('projectTitle', v_proj.title, 'legalHold', p_hold),
    v_proj.org_id
  );

  return jsonb_build_object('projectId', p_project_id, 'legalHold', p_hold, 'saved', true);
end $$;

-- ---------------------------------------------------------------------------
-- 10. Atomic Controlled Purge (Preserves All Audit/Ledger/Journal/Seal Trails)
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.execute_project_purge(
  p_project_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_early_override boolean default false,
  p_public_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_policy jsonb := eflow_retention.policy();
  v_mode text := coalesce(nullif(p_public_mode, ''), v_policy->>'archive_retention_public_mode');
  v_retention_days int := (v_policy->>'archive_retention_days')::int;
  v_require_seal boolean := (v_policy->>'archive_retention_require_seal')::boolean;
  v_clean_reason text := btrim(coalesce(p_reason, ''));
  v_proj record;
  v_cert record;
  v_anchor timestamptz;
  v_expires timestamptz;
  v_trigger_kind text;
  v_actor_name text;
  v_disposition_id uuid := gen_random_uuid();
  v_preview jsonb;
  v_storage_count int := 0;
  v_storage_bytes bigint := 0;
  v_task_ids uuid[];
  v_subtask_ids uuid[];
  v_commit_ids uuid[];
  v_alloc_ids uuid[];
  v_alloc_line_ids uuid[];
  v_req_ids uuid[];
  v_release_ids uuid[];
  v_liq_ids uuid[];
  v_receipt_ids uuid[];
  v_review_ids uuid[];
  v_channel_ids uuid[];
  v_project_office_ids uuid[];
  v_identity_ids uuid[];
  v_inv_req_ids uuid[];
  v_user_inv_ids uuid[];
  v_library_file_ids uuid[];
  v_comment_ids uuid[];
  v_exclusive_draft_id uuid;
  v_exclusive_rev_ids uuid[];
  v_tbl text;
  v_trigger_tables constant text[] := array[
    'public.budget_ledger_entries',
    'public.petty_cash_receipt_items',
    'public.petty_cash_receipts',
    'public.petty_cash_liquidations',
    'public.petty_cash_releases',
    'public.petty_cash_request_attachments',
    'public.petty_cash_request_lines',
    'public.petty_cash_requests',
    'public.work_budget_allocation_lines',
    'public.work_budget_allocations',
    'public.chat_messages',
    'public.subtask_submission_attachments',
    'public.subtask_submissions',
    'public.subtask_progress_updates',
    'public.subtasks',
    'public.task_comment_attachments',
    'public.task_comments',
    'public.task_attachments',
    'public.task_submissions',
    'public.task_progress_updates',
    'public.task_activities',
    'public.task_status_history',
    'public.tasks',
    'public.milestone_organizations',
    'public.milestones',
    'public.project_library_links',
    'public.project_library_files',
    'public.project_office_work',
    'public.project_office_people',
    'public.project_office_members',
    'public.project_office_identities',
    'public.project_offices',
    'public.project_organizations',
    'public.project_members',
    'public.project_groups',
    'public.project_guest_members',
    'public.project_invitation_requests',
    'public.project_access_grants',
    'public.projects',
    'eflow_budget.cash_commands',
    'eflow_evidence.attempts',
    'eflow_evidence.objects',
    'eflow_project.funding'
  ];
begin
  if length(v_clean_reason) not between 5 and 1000 then
    raise exception 'Enter a purge reason (5–1000 characters).' using errcode = '22023';
  end if;
  if v_mode not in ('keep_manifest_purge_files', 'purge_all_public', 'keep_full_public') then
    raise exception 'Unsupported public archive disposition mode.' using errcode = '22023';
  end if;

  set local lock_timeout = '8s';
  perform pg_advisory_xact_lock(hashtextextended('retention-purge:' || p_project_id::text, 0));

  select p.*, o.name as org_name
  into v_proj
  from public.projects p
  join public.organizations o on o.id = p.org_id
  where p.id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found or already purged.' using errcode = 'P0002';
  end if;
  if v_proj.status <> 'archived' then
    raise exception 'Only archived projects can be purged under retention policy.' using errcode = '22023';
  end if;
  if exists (
    select 1 from eflow_retention.project_holds h
    where h.project_id = p_project_id and h.is_active
  ) then
    raise exception 'This project is under Legal Hold and cannot be purged.' using errcode = '42501';
  end if;

  select c.* into v_cert
  from public.project_seal_certificates c
  where c.project_id = p_project_id
  order by c.version desc, c.sealed_at desc
  limit 1;

  if v_require_seal and v_cert.id is null then
    raise exception 'This archived project has no confirmed blockchain seal. Seal it on Polygon Amoy before purging.' using errcode = '42501';
  end if;

  if v_cert.id is not null then
    v_anchor := greatest(coalesce(v_proj.archived_at, v_proj.updated_at), v_cert.sealed_at);
  else
    v_anchor := coalesce(v_proj.archived_at, v_proj.updated_at);
  end if;
  v_expires := v_anchor + make_interval(days => v_retention_days);

  if not p_early_override and v_expires > now() then
    raise exception 'This project has not reached its retention expiration date (%) yet.',
      to_char(v_expires at time zone 'Asia/Manila', 'YYYY-MM-DD')
      using errcode = '22023';
  end if;

  if p_actor_id is null then
    v_actor_name := 'eFlow retention scheduler';
    v_trigger_kind := 'scheduled';
  else
    select coalesce(full_name, email, 'Admin') into v_actor_name
    from public.profiles where id = p_actor_id;
    v_actor_name := coalesce(v_actor_name, 'Admin');
    v_trigger_kind := case when p_early_override and v_expires > now() then 'admin_early_override' else 'admin_manual' end;
  end if;

  -- Snapshot dry-run metrics BEFORE mutating rows.
  v_preview := eflow_retention.preview_project_purge(p_project_id, v_mode);

  -- Build dependency ID arrays strictly scoped to p_project_id.
  select coalesce(array_agg(id), '{}'::uuid[]) into v_task_ids
  from public.tasks where linked_project_id = p_project_id;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_subtask_ids
  from public.subtasks where task_id = any(v_task_ids);

  if v_proj.source_collaboration_draft_id is not null
     and not exists (
       select 1 from public.projects other
       where other.id <> p_project_id
         and other.source_collaboration_draft_id = v_proj.source_collaboration_draft_id
     )
  then
    v_exclusive_draft_id := v_proj.source_collaboration_draft_id;
    select coalesce(array_agg(id), '{}'::uuid[]) into v_exclusive_rev_ids
    from public.proposal_collaboration_revisions
    where draft_id = v_exclusive_draft_id;
  else
    v_exclusive_draft_id := null;
    v_exclusive_rev_ids := '{}'::uuid[];
  end if;

  select coalesce(array_agg(distinct id), '{}'::uuid[]) into v_commit_ids
  from (
    select commitment_id as id from eflow_project.funding where project_id = p_project_id and commitment_id is not null
    union
    select id from public.budget_commitments where v_exclusive_draft_id is not null and proposal_draft_id = v_exclusive_draft_id
    union
    select commitment_id as id from public.work_budget_allocations where task_id = any(v_task_ids) and commitment_id is not null
  ) c;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_alloc_ids
  from public.work_budget_allocations
  where task_id = any(v_task_ids) or commitment_id = any(v_commit_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_alloc_line_ids
  from public.work_budget_allocation_lines where allocation_id = any(v_alloc_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_req_ids
  from public.petty_cash_requests
  where task_id = any(v_task_ids)
     or subtask_id = any(v_subtask_ids)
     or commitment_id = any(v_commit_ids)
     or allocation_id = any(v_alloc_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_release_ids
  from public.petty_cash_releases where request_id = any(v_req_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_liq_ids
  from public.petty_cash_liquidations where request_id = any(v_req_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_receipt_ids
  from public.petty_cash_receipts where liquidation_id = any(v_liq_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_review_ids
  from public.liquidation_independent_reviews where liquidation_id = any(v_liq_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_channel_ids
  from public.chat_channels where project_id = p_project_id or task_id = any(v_task_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_project_office_ids
  from public.project_offices where project_id = p_project_id;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_identity_ids
  from public.project_office_identities where project_id = p_project_id;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_inv_req_ids
  from public.project_invitation_requests where project_id = p_project_id;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_user_inv_ids
  from public.user_invitations
  where project_office_id = any(v_project_office_ids)
     or project_office_identity_id = any(v_identity_ids);

  select coalesce(array_agg(id), '{}'::uuid[]) into v_library_file_ids
  from public.project_library_files where project_id = p_project_id;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_comment_ids
  from public.task_comments where task_id = any(v_task_ids);

  -- Record permanent Certificate of Disposition FIRST so storage queue & fiscal rollups reference it.
  insert into eflow_retention.project_dispositions(
    id, project_id, project_title, org_id, org_name, archived_at, sealed_at,
    latest_certificate_id, manifest_hash, tx_hash, block_number,
    retention_days_applied, public_archive_mode, purge_trigger,
    purged_by, purged_by_name, purged_at, reason,
    row_counts, preserved_trail_counts, fiscal_rollup
  )
  values (
    v_disposition_id,
    v_proj.id,
    v_proj.title,
    v_proj.org_id,
    v_proj.org_name,
    v_proj.archived_at,
    v_cert.sealed_at,
    v_cert.id,
    v_cert.manifest_hash,
    v_cert.tx_hash,
    v_cert.block_number,
    v_retention_days,
    v_mode,
    v_trigger_kind,
    p_actor_id,
    v_actor_name,
    now(),
    v_clean_reason,
    coalesce(v_preview->'rowsToPurge', '{}'::jsonb),
    coalesce(v_preview->'trailsPreserved', '{}'::jsonb),
    coalesce(v_preview->'fiscalRollup', '[]'::jsonb)
  );

  -- Enqueue all connected Storage objects for official Storage API deletion.
  insert into eflow_retention.storage_delete_queue(disposition_id, bucket_id, object_path, byte_size)
  select v_disposition_id, s.bucket_id, s.object_path, s.byte_size
  from eflow_retention.project_storage_objects(p_project_id, v_mode) s
  on conflict (disposition_id, bucket_id, object_path) do nothing;

  select count(*)::int, coalesce(sum(byte_size), 0)::bigint
  into v_storage_count, v_storage_bytes
  from eflow_retention.storage_delete_queue
  where disposition_id = v_disposition_id;

  update eflow_retention.project_dispositions
  set storage_objects_queued = v_storage_count,
      storage_bytes_queued = v_storage_bytes
  where id = v_disposition_id;

  -- Roll up FY budget-level committed & spent totals BEFORE deleting financial rows.
  insert into public.fiscal_budget_purged_totals(
    scope, fiscal_budget_id, org_id, partition_id, disposition_id,
    project_id, project_title, committed_amount, spent_amount
  )
  select
    'budget',
    fb.id,
    fb.org_id,
    null,
    v_disposition_id,
    v_proj.id,
    v_proj.title,
    coalesce(c_agg.amt, 0),
    coalesce(s_agg.amt, 0)
  from (
    select distinct fiscal_budget_id from public.budget_commitments where id = any(v_commit_ids)
    union
    select distinct fiscal_budget_id from public.petty_cash_requests where id = any(v_req_ids)
  ) ids
  join public.department_fiscal_budgets fb on fb.id = ids.fiscal_budget_id
  left join lateral (
    select sum(amount) as amt from public.budget_commitments
    where id = any(v_commit_ids) and fiscal_budget_id = fb.id and status = 'active'
  ) c_agg on true
  left join lateral (
    select sum(actual_spent) as amt from public.petty_cash_requests
    where id = any(v_req_ids) and fiscal_budget_id = fb.id and status = 'settled'
  ) s_agg on true
  where coalesce(c_agg.amt, 0) > 0 or coalesce(s_agg.amt, 0) > 0;

  -- Roll up per-section partition committed totals BEFORE deleting eflow_project.funding.
  insert into public.fiscal_budget_purged_totals(
    scope, fiscal_budget_id, org_id, partition_id, disposition_id,
    project_id, project_title, committed_amount, spent_amount
  )
  select
    'partition',
    s.fiscal_budget_id,
    fb.org_id,
    f.partition_id,
    v_disposition_id,
    v_proj.id,
    v_proj.title,
    sum(f.amount),
    0
  from eflow_project.funding f
  join public.budget_commitments c on c.id = f.commitment_id and c.status = 'active'
  join public.office_budget_sections s on s.id = f.partition_id
  join public.department_fiscal_budgets fb on fb.id = s.fiscal_budget_id
  where f.project_id = p_project_id and f.partition_id is not null
  group by s.fiscal_budget_id, fb.org_id, f.partition_id
  having sum(f.amount) > 0;

  -- Transactional USER trigger pause (PostgreSQL system FK triggers remain 100% ACTIVE;
  -- any error rolls back the entire transaction including all trigger states).
  foreach v_tbl in array v_trigger_tables loop
    execute format('alter table %s disable trigger user', v_tbl);
  end loop;

  -- Preserve reference metadata on ALL permanent trail tables before removing parent rows.
  update public.budget_ledger_entries ble
  set retained_project_id = coalesce(ble.retained_project_id, p_project_id),
      retained_reference = coalesce(ble.retained_reference, jsonb_build_object(
        'projectId', p_project_id,
        'projectTitle', v_proj.title,
        'dispositionId', v_disposition_id,
        'taskId', ble.task_id,
        'subtaskId', ble.subtask_id,
        'commitmentId', ble.commitment_id,
        'allocationId', ble.allocation_id,
        'allocationLineId', ble.allocation_line_id,
        'pettyCashRequestId', ble.petty_cash_request_id
      )),
      task_id = case when ble.task_id = any(v_task_ids) then null else ble.task_id end,
      subtask_id = case when ble.subtask_id = any(v_subtask_ids) then null else ble.subtask_id end,
      commitment_id = case when ble.commitment_id = any(v_commit_ids) then null else ble.commitment_id end,
      allocation_id = case when ble.allocation_id = any(v_alloc_ids) then null else ble.allocation_id end,
      allocation_line_id = case when ble.allocation_line_id = any(v_alloc_line_ids) then null else ble.allocation_line_id end,
      petty_cash_request_id = case when ble.petty_cash_request_id = any(v_req_ids) then null else ble.petty_cash_request_id end
  where ble.task_id = any(v_task_ids)
     or ble.subtask_id = any(v_subtask_ids)
     or ble.commitment_id = any(v_commit_ids)
     or ble.allocation_id = any(v_alloc_ids)
     or ble.allocation_line_id = any(v_alloc_line_ids)
     or ble.petty_cash_request_id = any(v_req_ids);

  update public.project_field_history
  set retained_project_id = coalesce(retained_project_id, project_id),
      project_id = null
  where project_id = p_project_id;

  update public.task_status_history h
  set retained_project_id = coalesce(h.retained_project_id, p_project_id),
      retained_task_id = coalesce(h.retained_task_id, h.task_id),
      retained_task_title = coalesce(h.retained_task_title, (select t.title from public.tasks t where t.id = h.task_id)),
      task_id = null
  where h.task_id = any(v_task_ids);

  update public.project_library_events e
  set retained_file_id = coalesce(e.retained_file_id, e.file_id),
      retained_file_name = coalesce(e.retained_file_name, (select f.file_name from public.project_library_files f where f.id = e.file_id)),
      file_id = null
  where e.file_id = any(v_library_file_ids);

  -- Delete operational financial records & receipts (keeping budget_ledger_entries & general_journal_*).
  delete from public.department_budget_account_mappings where allocation_line_id = any(v_alloc_line_ids);
  delete from public.petty_cash_receipt_items where receipt_id = any(v_receipt_ids);
  delete from public.petty_cash_receipts where id = any(v_receipt_ids);
  delete from eflow_finance_review.events where review_id = any(v_review_ids);
  delete from eflow_finance_review.commands where review_id = any(v_review_ids);
  delete from eflow_finance_review.settlement_blocker_alerts where liquidation_id = any(v_liq_ids);
  delete from eflow_finance_review.staffing_escalation_approvals where liquidation_id = any(v_liq_ids);
  delete from eflow_work_clearance.return_commands where liquidation_id = any(v_liq_ids);
  delete from eflow_work_clearance.return_decisions where liquidation_id = any(v_liq_ids);
  delete from public.liquidation_independent_reviews where id = any(v_review_ids);
  delete from public.petty_cash_liquidations where id = any(v_liq_ids);
  delete from public.petty_cash_releases where id = any(v_release_ids);
  delete from public.petty_cash_request_attachments where request_id = any(v_req_ids);
  delete from public.petty_cash_request_lines where request_id = any(v_req_ids);
  delete from eflow_budget.cash_commands where request_id = any(v_req_ids);
  delete from public.petty_cash_requests where id = any(v_req_ids);
  delete from eflow_budget.subtask_budget_commands where result_id = any(v_alloc_ids);

  update public.work_budget_allocations set parent_allocation_line_id = null where id = any(v_alloc_ids);
  delete from public.work_budget_allocation_lines where id = any(v_alloc_line_ids);
  delete from public.work_budget_allocations where id = any(v_alloc_ids);
  delete from eflow_project.funding where project_id = p_project_id;
  delete from eflow_project.funding_requests where project_id = p_project_id;
  delete from eflow_project.commands
  where coalesce(payload->>'project', result->>'project', result->>'projectId', '') = p_project_id::text;
  delete from public.budget_commitments where id = any(v_commit_ids);

  -- Delete operational work engine & evidence state.
  delete from eflow_evidence.attempts
  where task_id = any(v_task_ids) or subtask_id = any(v_subtask_ids);
  delete from eflow_evidence.objects
  where task_id = any(v_task_ids) or subtask_id = any(v_subtask_ids);
  delete from eflow_work_clearance.acceptances
  where root_id = any(v_task_ids) or node_id = any(v_subtask_ids);

  delete from eflow_m7.activation where root = any(v_task_ids);
  delete from eflow_m7.deferred_assignments where root_id = any(v_task_ids);
  delete from eflow_m7.draft_scope where project_id = p_project_id;
  update eflow_m7.work_proposals set supersedes = null where root_id = any(v_task_ids);
  delete from eflow_m7.work_proposals where root_id = any(v_task_ids);

  delete from eflow_r7.completion_locks where root_id = any(v_task_ids);
  delete from eflow_r7.tree_state where root_id = any(v_task_ids);
  delete from eflow_r7.receipts where root_id = any(v_task_ids);
  delete from eflow_r7.mutations where root_id = any(v_task_ids);
  delete from eflow_r7.member_receipts where project_id = p_project_id;
  delete from eflow_r7.backfill_exceptions where project_id = p_project_id;

  delete from eflow_r9.events where project_id = p_project_id;
  delete from eflow_r9.mutations where project_id = p_project_id;
  delete from eflow_r9.removed where project_id = p_project_id;
  delete from eflow_r9.staffing_removals where project_id = p_project_id;
  delete from eflow_r9.receipts
  where coalesce(payload->>0, '') = any(select unnest(v_project_office_ids)::text);

  delete from eflow_r11.snapshots where project_id = p_project_id;
  delete from eflow_r3.backfill_exceptions where project_id = p_project_id;
  delete from eflow_r8.tokens where request_id = any(v_inv_req_ids);
  delete from eflow_publication.discard_requests where project_id = p_project_id;

  -- Delete subtasks, tasks, comments, attachments, library files, chat, and milestones.
  delete from public.subtask_submission_attachments
  where task_id = any(v_task_ids) or subtask_id = any(v_subtask_ids);
  update public.subtasks set parent_subtask_id = null, latest_submission_id = null where id = any(v_subtask_ids);
  delete from public.subtask_submissions
  where task_id = any(v_task_ids) or subtask_id = any(v_subtask_ids);
  delete from public.subtask_progress_updates
  where task_id = any(v_task_ids) or subtask_id = any(v_subtask_ids);
  delete from public.subtasks where id = any(v_subtask_ids);

  delete from public.task_comment_attachments where comment_id = any(v_comment_ids);
  delete from public.task_comments where id = any(v_comment_ids);
  delete from public.task_attachments where task_id = any(v_task_ids);
  delete from public.task_submissions where task_id = any(v_task_ids);
  delete from public.task_progress_updates where task_id = any(v_task_ids);
  delete from public.task_activities where task_id = any(v_task_ids);
  delete from public.task_reminders where task_id = any(v_task_ids);
  delete from public.task_organizations where task_id = any(v_task_ids);
  delete from public.task_template_runs where task_id = any(v_task_ids);
  delete from public.project_office_work where project_id = p_project_id or task_id = any(v_task_ids);
  delete from public.project_library_links where file_id = any(v_library_file_ids) or task_id = any(v_task_ids);
  delete from public.project_library_files where id = any(v_library_file_ids);

  delete from eflow_chat.nicknames where channel_id = any(v_channel_ids);
  delete from eflow_chat.personal_pins where channel_id = any(v_channel_ids);
  delete from public.chat_messages where channel_id = any(v_channel_ids);
  delete from public.chat_channel_members where channel_id = any(v_channel_ids);
  delete from public.chat_channels where id = any(v_channel_ids);

  delete from public.tasks where id = any(v_task_ids);
  delete from public.milestone_organizations
  where milestone_id in (select id from public.milestones where project_id = p_project_id);
  delete from public.milestones where project_id = p_project_id;

  -- Delete project offices, guests, invitations (never deleting user PDS documents!).
  delete from public.project_guest_members where project_id = p_project_id;
  delete from public.project_guest_account_events
  where account_id in (select id from public.project_guest_accounts where request_id = any(v_inv_req_ids));
  delete from public.project_guest_accounts where request_id = any(v_inv_req_ids);
  delete from public.project_access_grants where project_id = p_project_id;
  delete from public.project_invitation_events where request_id = any(v_inv_req_ids);
  update public.user_pds_documents set project_request_id = null where project_request_id = any(v_inv_req_ids);
  update public.user_pds_documents set invitation_id = null where invitation_id = any(v_user_inv_ids);
  delete from public.project_office_people where project_id = p_project_id;
  delete from public.project_invitation_requests where id = any(v_inv_req_ids);
  delete from eflow_activation.dispatches where invitation_id = any(v_user_inv_ids);
  delete from public.managed_account_invite_details where invitation_id = any(v_user_inv_ids);
  delete from public.user_invitations where id = any(v_user_inv_ids);
  delete from public.project_office_members where project_office_id = any(v_project_office_ids);
  delete from public.project_office_identities where id = any(v_identity_ids);
  delete from public.project_offices where id = any(v_project_office_ids);

  delete from public.project_organizations where project_id = p_project_id;
  delete from public.project_members where project_id = p_project_id;
  delete from public.project_groups where project_id = p_project_id;
  delete from public.project_import_batches where project_id = p_project_id;
  delete from public.project_pdf_import_sessions where project_id = p_project_id;
  delete from public.project_readiness_reviews where project_id = p_project_id;
  delete from public.office_project_homes where project_id = p_project_id;
  delete from public.proposal_collaboration_commit_projects where project_id = p_project_id;
  delete from public.process_mining_snapshots where project_id = p_project_id;

  delete from public.projects where id = p_project_id;

  -- Clean exclusively-owned collaboration draft if no other project uses it.
  if v_exclusive_draft_id is not null then
    delete from public.proposal_delivery_closeout_decisions where draft_id = v_exclusive_draft_id;
    delete from public.proposal_delivery_closeouts where draft_id = v_exclusive_draft_id;
    delete from public.proposal_governance_signoffs where draft_id = v_exclusive_draft_id;
    delete from public.proposal_governance_records where draft_id = v_exclusive_draft_id;
    delete from public.proposal_governance_assignments where draft_id = v_exclusive_draft_id;
    delete from public.proposal_collaboration_approvals where draft_id = v_exclusive_draft_id;
    delete from public.proposal_collaboration_change_requests where draft_id = v_exclusive_draft_id;
    delete from public.proposal_collaboration_messages where draft_id = v_exclusive_draft_id;
    delete from public.proposal_collaboration_orgs where draft_id = v_exclusive_draft_id;
    update public.proposal_collaboration_drafts set current_revision_id = null where id = v_exclusive_draft_id;
    delete from public.proposal_collaboration_revisions where id = any(v_exclusive_rev_ids);
    delete from public.proposal_collaboration_drafts where id = v_exclusive_draft_id;
  end if;

  -- Re-enable all USER triggers before finishing transaction.
  foreach v_tbl in array v_trigger_tables loop
    execute format('alter table %s enable trigger user', v_tbl);
  end loop;

  -- Stamp permanent retention metadata onto public blockchain certificates (never deleted!).
  update public.project_seal_certificates
  set retention_purged_at = now(),
      retention_purge_mode = v_mode,
      retention_disposition_id = v_disposition_id,
      retention_reason = v_clean_reason
  where project_id = p_project_id;

  -- Compact heavy dossier/manifest payloads in eflow_seal.snapshots ONLY when Mode B (purge_all_public) is chosen,
  -- while ALWAYS keeping source_hash, manifest_hash, tx_hash, block_number, block_hash, and confirmed_at forever.
  if v_mode = 'purge_all_public' then
    update eflow_seal.snapshots
    set dossier = jsonb_build_object(
          'retention_purged', true,
          'disposition_id', v_disposition_id,
          'purged_at', now()
        ),
        manifest = null
    where project_id = p_project_id;
  end if;

  -- Write permanent audit trail entry.
  insert into public.audit_events(
    actor_id, actor_name, entity_type, entity_id, action, reason, after_data, org_id
  )
  values (
    p_actor_id,
    v_actor_name,
    'project',
    p_project_id::text,
    'project.retention_purged',
    v_clean_reason,
    jsonb_build_object(
      'dispositionId', v_disposition_id,
      'projectTitle', v_proj.title,
      'purgeTrigger', v_trigger_kind,
      'publicArchiveMode', v_mode,
      'retentionDaysApplied', v_retention_days,
      'manifestHash', v_cert.manifest_hash,
      'txHash', v_cert.tx_hash,
      'blockNumber', v_cert.block_number,
      'rowsPurged', coalesce(v_preview->'rowsToPurge', '{}'::jsonb),
      'trailsPreserved', coalesce(v_preview->'trailsPreserved', '{}'::jsonb),
      'storageObjectsQueued', v_storage_count,
      'storageBytesQueued', v_storage_bytes
    ),
    v_proj.org_id
  );

  return jsonb_build_object(
    'dispositionId', v_disposition_id,
    'projectId', p_project_id,
    'projectTitle', v_proj.title,
    'purgeTrigger', v_trigger_kind,
    'publicArchiveMode', v_mode,
    'storageObjectsQueued', v_storage_count,
    'storageBytesQueued', v_storage_bytes,
    'rowsPurged', coalesce(v_preview->'rowsToPurge', '{}'::jsonb),
    'trailsPreserved', coalesce(v_preview->'trailsPreserved', '{}'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- 11. Daily Retention Evaluator (Notices + Optional Auto-Purge)
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.evaluate_due_projects()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_policy jsonb := eflow_retention.policy();
  v_retention_days int := (v_policy->>'archive_retention_days')::int;
  v_notice_days int := (v_policy->>'archive_retention_notice_days')::int;
  v_require_seal boolean := (v_policy->>'archive_retention_require_seal')::boolean;
  v_auto_purge boolean := (v_policy->>'archive_retention_auto_purge')::boolean;
  v_public_mode text := v_policy->>'archive_retention_public_mode';
  p record;
  v_cert record;
  v_anchor timestamptz;
  v_expires timestamptz;
  v_purged int := 0;
  v_notified int := 0;
  v_blocked int := 0;
begin
  for p in
    select pr.*, o.head_user_id
    from public.projects pr
    join public.organizations o on o.id = pr.org_id
    where pr.status = 'archived'
      and not exists (
        select 1 from eflow_retention.project_holds h
        where h.project_id = pr.id and h.is_active
      )
    order by pr.archived_at asc nulls last, pr.id
  loop
    select c.* into v_cert
    from public.project_seal_certificates c
    where c.project_id = p.id
    order by c.version desc, c.sealed_at desc
    limit 1;

    if v_require_seal and v_cert.id is null then
      if coalesce(p.archived_at, p.updated_at) + make_interval(days => v_retention_days) <= now() then
        if not exists (
          select 1 from eflow_retention.notice_log n
          where n.project_id = p.id and n.notice_kind = 'blocked_unsealed'
        ) then
          insert into public.notifications(user_id, type, title, message, project_id, org_id)
          select u.id, 'project_retention_blocked', 'Retention purge blocked — seal required',
            format('"%s" reached its retention period, but has no confirmed Polygon Amoy blockchain seal. Seal it before purging.', p.title),
            p.id, p.org_id
          from public.profiles u
          where u.is_active and (u.role = 'admin' or u.id = p.head_user_id);

          insert into eflow_retention.notice_log(project_id, notice_kind)
          values (p.id, 'blocked_unsealed') on conflict do nothing;
          v_blocked := v_blocked + 1;
        end if;
      end if;
      continue;
    end if;

    v_anchor := case
      when v_cert.id is not null then greatest(coalesce(p.archived_at, p.updated_at), v_cert.sealed_at)
      else coalesce(p.archived_at, p.updated_at)
    end;
    v_expires := v_anchor + make_interval(days => v_retention_days);

    -- Warning notice window
    if v_expires > now() and v_expires <= now() + make_interval(days => v_notice_days) then
      if not exists (
        select 1 from eflow_retention.notice_log n
        where n.project_id = p.id and n.notice_kind = 'notice_warning'
      ) then
        insert into public.notifications(user_id, type, title, message, project_id, org_id)
        select u.id, 'project_retention_notice', 'Archived project approaching retention expiry',
          format('"%s" is scheduled for retention disposition on %s PHT. Place a Legal Hold if an audit is pending.',
            p.title, to_char(v_expires at time zone 'Asia/Manila', 'DD Mon YYYY')),
          p.id, p.org_id
        from public.profiles u
        where u.is_active and (u.role = 'admin' or u.id = p.head_user_id);

        insert into eflow_retention.notice_log(project_id, notice_kind)
        values (p.id, 'notice_warning') on conflict do nothing;
        v_notified := v_notified + 1;
      end if;
    end if;

    -- 7-day final warning
    if v_expires > now() and v_expires <= now() + interval '7 days' then
      if not exists (
        select 1 from eflow_retention.notice_log n
        where n.project_id = p.id and n.notice_kind = 'notice_7d'
      ) then
        insert into public.notifications(user_id, type, title, message, project_id, org_id)
        select u.id, 'project_retention_notice', 'Final 7-day retention warning',
          format('"%s" reaches retention expiry on %s PHT. Audit, ledger, journal, and blockchain trails will remain permanently.',
            p.title, to_char(v_expires at time zone 'Asia/Manila', 'DD Mon YYYY')),
          p.id, p.org_id
        from public.profiles u
        where u.is_active and (u.role = 'admin' or u.id = p.head_user_id);

        insert into eflow_retention.notice_log(project_id, notice_kind)
        values (p.id, 'notice_7d') on conflict do nothing;
        v_notified := v_notified + 1;
      end if;
    end if;

    -- Expired
    if v_expires <= now() then
      if v_auto_purge then
        begin
          perform eflow_retention.execute_project_purge(
            p.id,
            null,
            format('Scheduled automatic retention purge after %s days.', v_retention_days),
            false,
            v_public_mode
          );
          v_purged := v_purged + 1;
        exception when others then
          -- Never fail the whole batch if one project hits a lock or hold race.
          null;
        end;
      else
        if not exists (
          select 1 from eflow_retention.notice_log n
          where n.project_id = p.id and n.notice_kind = 'ready_for_purge'
        ) then
          insert into public.notifications(user_id, type, title, message, project_id, org_id)
          select u.id, 'project_retention_ready', 'Archived project ready for retention purge',
            format('"%s" passed its %s-day retention window. Open System & Maintenance → Archive & Retention to review and purge.',
              p.title, v_retention_days),
            p.id, p.org_id
          from public.profiles u
          where u.is_active and u.role = 'admin';

          insert into eflow_retention.notice_log(project_id, notice_kind)
          values (p.id, 'ready_for_purge') on conflict do nothing;
          v_notified := v_notified + 1;
        end if;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'purged', v_purged,
    'notified', v_notified,
    'blockedUnsealed', v_blocked,
    'autoPurgeEnabled', v_auto_purge
  );
end $$;

-- ---------------------------------------------------------------------------
-- 12. Storage Outbox Claim & Completion Helpers (for FastAPI Gateway Worker)
-- ---------------------------------------------------------------------------
create or replace function eflow_retention.claim_storage_queue(p_limit integer default 50)
returns jsonb
language sql
security definer
set search_path to ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'dispositionId', q.disposition_id,
    'bucketId', q.bucket_id,
    'objectPath', q.object_path,
    'byteSize', q.byte_size,
    'attempts', q.attempts
  ) order by q.id), '[]'::jsonb)
  from (
    select *
    from eflow_retention.storage_delete_queue
    where status in ('pending', 'failed')
      and attempts < 8
    order by status desc, id asc
    limit greatest(1, least(200, coalesce(p_limit, 50)))
  ) q;
$$;

create or replace function eflow_retention.finish_storage_item(
  p_id bigint,
  p_deleted boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_deleted then
    update eflow_retention.storage_delete_queue
    set status = 'deleted',
        attempts = attempts + 1,
        last_error = null,
        deleted_at = now()
    where id = p_id;
  else
    update eflow_retention.storage_delete_queue
    set status = 'failed',
        attempts = attempts + 1,
        last_error = left(coalesce(p_error, 'Storage deletion failed'), 500)
    where id = p_id;
  end if;
end $$;

create or replace function eflow_retention.disposition_detail(p_disposition_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select to_jsonb(d) || jsonb_build_object(
    'storageItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'bucketId', q.bucket_id,
        'objectPath', q.object_path,
        'byteSize', q.byte_size,
        'status', q.status,
        'attempts', q.attempts,
        'lastError', q.last_error,
        'deletedAt', q.deleted_at
      ) order by q.bucket_id, q.object_path)
      from eflow_retention.storage_delete_queue q
      where q.disposition_id = d.id
    ), '[]'::jsonb)
  )
  from eflow_retention.project_dispositions d
  where d.id = p_disposition_id;
$$;

revoke all on all functions in schema eflow_retention from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13. Service-Role-Only Public RPC Wrappers (called strictly via FastAPI require_admin)
-- ---------------------------------------------------------------------------
create or replace function public.retention_admin_overview()
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.overview(); $$;

create or replace function public.retention_admin_preview(p_project_id uuid, p_public_mode text default null)
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.preview_project_purge(p_project_id, p_public_mode); $$;

create or replace function public.retention_admin_set_hold(
  p_project_id uuid, p_hold boolean, p_reason text, p_actor_id uuid
)
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.set_legal_hold(p_project_id, p_hold, p_reason, p_actor_id); $$;

create or replace function public.retention_admin_purge_project(
  p_project_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_early_override boolean default false,
  p_public_mode text default null
)
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.execute_project_purge(p_project_id, p_actor_id, p_reason, p_early_override, p_public_mode); $$;

create or replace function public.retention_admin_evaluate_due()
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.evaluate_due_projects(); $$;

create or replace function public.retention_admin_claim_storage_queue(p_limit integer default 50)
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.claim_storage_queue(p_limit); $$;

create or replace function public.retention_admin_finish_storage_item(
  p_id bigint, p_deleted boolean, p_error text default null
)
returns void language sql security invoker set search_path to ''
as $$ select eflow_retention.finish_storage_item(p_id, p_deleted, p_error); $$;

create or replace function public.retention_admin_disposition_detail(p_disposition_id uuid)
returns jsonb language sql security invoker set search_path to ''
as $$ select eflow_retention.disposition_detail(p_disposition_id); $$;

revoke all on function
  public.retention_admin_overview(),
  public.retention_admin_preview(uuid, text),
  public.retention_admin_set_hold(uuid, boolean, text, uuid),
  public.retention_admin_purge_project(uuid, uuid, text, boolean, text),
  public.retention_admin_evaluate_due(),
  public.retention_admin_claim_storage_queue(integer),
  public.retention_admin_finish_storage_item(bigint, boolean, text),
  public.retention_admin_disposition_detail(uuid)
from public, anon, authenticated;

grant execute on function
  eflow_retention.overview(),
  eflow_retention.preview_project_purge(uuid, text),
  eflow_retention.set_legal_hold(uuid, boolean, text, uuid),
  eflow_retention.execute_project_purge(uuid, uuid, text, boolean, text),
  eflow_retention.evaluate_due_projects(),
  eflow_retention.claim_storage_queue(integer),
  eflow_retention.finish_storage_item(bigint, boolean, text),
  eflow_retention.disposition_detail(uuid),
  public.retention_admin_overview(),
  public.retention_admin_preview(uuid, text),
  public.retention_admin_set_hold(uuid, boolean, text, uuid),
  public.retention_admin_purge_project(uuid, uuid, text, boolean, text),
  public.retention_admin_evaluate_due(),
  public.retention_admin_claim_storage_queue(integer),
  public.retention_admin_finish_storage_item(bigint, boolean, text),
  public.retention_admin_disposition_detail(uuid)
to service_role;

-- ---------------------------------------------------------------------------
-- 14. Schedule daily pg_cron retention check (3:00 AM PHT = 19:00 UTC)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    if exists (select 1 from cron.job where jobname = 'eflow-archive-retention-daily') then
      perform cron.unschedule('eflow-archive-retention-daily');
    end if;
    perform cron.schedule(
      'eflow-archive-retention-daily',
      '0 19 * * *',
      'select eflow_retention.evaluate_due_projects()'
    );
  end if;
end $$;

commit;
