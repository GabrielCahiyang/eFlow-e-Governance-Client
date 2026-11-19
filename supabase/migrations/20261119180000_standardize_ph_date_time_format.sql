-- Standardize all user-facing SQL date/time notifications and errors to Philippine Time (Asia/Manila) MM/DD/YYYY

-- and lock current_date evaluations in reminder/escalation/validation functions to Asia/Manila.



CREATE OR REPLACE FUNCTION eflow_guests.maintain()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.profiles; g public.project_guest_accounts; stamp timestamptz:=now();begin
 -- Always lock profiles before lifecycle rows, matching invitation acceptance.
 for p in select u.* from public.profiles u join public.project_guest_accounts a on a.user_id=u.id
  where u.is_active order by u.id for update of u skip locked loop
  if not eflow_guests.temporary(p.id) then continue;end if;
  select * into g from public.project_guest_accounts where user_id=p.id for update;
  if exists(select 1 from eflow_guests.projects(p.id)) then
   if g.unassigned_since is not null then
    update public.project_guest_accounts set unassigned_since=null,warned_at=null,blocked_notified_at=null,updated_at=stamp where user_id=p.id;
    insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'countdown_cancelled','Assigned to an active project.');
   end if;
   continue;
  end if;
  if g.unassigned_since is null then
   update public.project_guest_accounts set unassigned_since=stamp,updated_at=stamp where user_id=p.id;
   insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'countdown_started','No active project. Seven-day assignment window started.');
   continue;
  end if;
  if eflow_guests.finance_open(p.id) then
   if g.blocked_notified_at is null then
    perform eflow_guests.notify(p.id,'Guest cleanup paused',p.full_name||' has an open cash responsibility. Settle it before account deactivation.');
    update public.project_guest_accounts set blocked_notified_at=stamp,updated_at=stamp where user_id=p.id;
    insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'cleanup_paused','An open cash responsibility needs settlement.');
   end if;
   continue;
  end if;
  if g.unassigned_since<=stamp-interval '7 days' then
   insert into eflow_guests.writes values(txid_current(),p.id) on conflict do nothing;
   update public.profiles set is_active=false,updated_at=stamp where id=p.id;
   delete from eflow_guests.writes where tx=txid_current() and user_id=p.id;
   update public.project_guest_accounts set deactivated_at=stamp,deactivation_reason='No active project for seven days.',updated_at=stamp where user_id=p.id;
   insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'auto_deactivated','No active project for seven days.');
   perform eflow_guests.notify(p.id,'Guest account deactivated',p.full_name||' no longer has an active project. Admin can reactivate the login for seven days; project access must be assigned separately.');
  elsif g.unassigned_since<=stamp-interval '5 days' and g.warned_at is null then
   perform eflow_guests.notify(p.id,'Guest account deactivates in 2 days',p.full_name||' has no active project. Assign a project before '||to_char((g.unassigned_since + interval '7 days') at time zone 'Asia/Manila', 'MM/DD/YYYY, HH12:MI AM') || ' PHT'||' to keep the account active.');
   update public.project_guest_accounts set warned_at=stamp,updated_at=stamp where user_id=p.id;
   insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'warning_sent','Two days remain to assign an active project.');
  end if;
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION eflow_retention.evaluate_due_projects()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
            p.title, to_char(v_expires at time zone 'Asia/Manila', 'MM/DD/YYYY')),
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
            p.title, to_char(v_expires at time zone 'Asia/Manila', 'MM/DD/YYYY')),
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
end $function$;

CREATE OR REPLACE FUNCTION eflow_retention.execute_project_purge(p_project_id uuid, p_actor_id uuid, p_reason text, p_early_override boolean DEFAULT false, p_public_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
      to_char(v_expires at time zone 'Asia/Manila', 'MM/DD/YYYY')
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
end $function$;

CREATE OR REPLACE FUNCTION eflow_seal.archive_due_projects()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
          || to_char((p.completed_at + make_interval(days => v_archive_days)) at time zone 'Asia/Manila', 'MM/DD/YYYY, HH12:MI AM')
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

CREATE OR REPLACE FUNCTION public.dispatch_hierarchy_deadline_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  inserted_count int := 0;
begin
  with task_dates as (
    select task.*,
      case
        when task.due_date ~ '^\d{4}-\d{2}-\d{2}' then left(task.due_date, 10)::date
        when task.deadline ~ '^\d{4}-\d{2}-\d{2}' then left(task.deadline, 10)::date
        else null
      end as due_on
    from public.tasks task
    where task.deleted_at is null and task.archived_at is null
  ), proposal_dates as (
    select project.org_id, project.proposal_id,
      max(project.proposal_title) as title,
      max(project.target_date) as due_on,
      bool_or(project.status not in ('completed', 'archived')) as incomplete
    from public.projects project
    where project.proposal_id is not null and project.status <> 'archived'
    group by project.org_id, project.proposal_id
  ), deadline_candidates as (
    select 'subtask'::text as entity_type, subtask.id::text as entity_key,
      subtask.title as entity_title, subtask.due_date as due_on,
      recipient.recipient_id, case when subtask.due_date < current_date then 'overdue' else 'due_soon' end as reminder_kind,
      task.id as task_id, task.title as task_title, task.linked_project_id as project_id,
      task.proposal_id, task.org_id
    from public.subtasks subtask
    join task_dates task on task.id = subtask.task_id
    cross join lateral (
      select distinct recipient_id from unnest(
        coalesce(subtask.assigned_to_ids, '{}'::uuid[])
        || array_remove(array[subtask.assigned_to, task.recommendation_lead_id], null)
      ) recipient_id
    ) recipient
    where subtask.is_completed = false
      and subtask.status not in ('completed', 'for_review')
      and subtask.due_date is not null
      and subtask.due_date <= current_date + 3

    union all

    select 'task', task.id::text, task.title, task.due_on,
      recipient.recipient_id, case when task.due_on < current_date then 'overdue' else 'due_soon' end,
      task.id, task.title, task.linked_project_id, task.proposal_id, task.org_id
    from task_dates task
    left join public.organizations org on org.id = task.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        coalesce(task.team_member_ids, '{}'::uuid[])
        || array_remove(array[task.assigned_to, task.recommendation_lead_id, org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where task.status not in ('completed', 'cancelled')
      and task.due_on is not null and task.due_on <= current_date + 3

    union all

    select 'project', project.id::text, project.title, project.target_date,
      recipient.recipient_id, case when project.target_date < current_date then 'overdue' else 'due_soon' end,
      null::uuid, null::text, project.id, project.proposal_id, project.org_id
    from public.projects project
    left join public.organizations org on org.id = project.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[project.owner_id, org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where project.status not in ('completed', 'archived')
      and project.target_date is not null and project.target_date <= current_date + 3

    union all

    select 'proposal', proposal.org_id::text || ':' || proposal.proposal_id,
      coalesce(proposal.title, 'Proposal'), proposal.due_on,
      recipient.recipient_id, case when proposal.due_on < current_date then 'overdue' else 'due_soon' end,
      null::uuid, null::text, null::uuid, proposal.proposal_id, proposal.org_id
    from proposal_dates proposal
    join public.organizations org on org.id = proposal.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where proposal.incomplete and proposal.due_on is not null and proposal.due_on <= current_date + 3
  ), completion_candidates as (
    select 'project'::text as entity_type, project.id::text as entity_key,
      project.title as entity_title, coalesce(project.target_date, project.created_at::date) as due_on,
      recipient.recipient_id, 'completion_recommended'::text as reminder_kind,
      null::uuid as task_id, null::text as task_title, project.id as project_id,
      project.proposal_id, project.org_id
    from public.projects project
    left join public.organizations org on org.id = project.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[project.owner_id, org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where project.status not in ('completed', 'archived')
      and exists (
        select 1 from public.tasks task
        where task.linked_project_id = project.id and task.deleted_at is null
          and task.archived_at is null and task.status <> 'cancelled'
      )
      and not exists (
        select 1 from public.tasks task
        where task.linked_project_id = project.id and task.deleted_at is null
          and task.archived_at is null and task.status not in ('completed', 'cancelled')
      )

    union all

    select 'proposal', project.org_id::text || ':' || project.proposal_id,
      max(project.proposal_title), coalesce(max(project.target_date), min(project.created_at)::date),
      recipient.recipient_id, 'completion_recommended',
      null::uuid, null::text, null::uuid, project.proposal_id, project.org_id
    from public.projects project
    join public.organizations org on org.id = project.org_id
    cross join lateral (
      select distinct recipient_id from unnest(
        array_remove(array[org.head_user_id, null::uuid], null)
      ) recipient_id
    ) recipient
    where project.proposal_id is not null and project.status <> 'archived'
      and exists (select 1 from public.projects incomplete where incomplete.org_id = project.org_id and incomplete.proposal_id = project.proposal_id and incomplete.status <> 'completed')
      and not exists (
        select 1
        from public.projects child
        where child.org_id = project.org_id and child.proposal_id = project.proposal_id and child.status <> 'archived'
          and (
            not exists (select 1 from public.tasks task where task.linked_project_id = child.id and task.deleted_at is null and task.archived_at is null and task.status <> 'cancelled')
            or exists (select 1 from public.tasks task where task.linked_project_id = child.id and task.deleted_at is null and task.archived_at is null and task.status not in ('completed', 'cancelled'))
          )
      )
    group by project.org_id, project.proposal_id, recipient.recipient_id
  ), candidates as (
    select distinct * from deadline_candidates
    union
    select distinct * from completion_candidates
  ), inserted as (
    insert into public.hierarchy_deadline_reminders (
      entity_type, entity_key, recipient_id, reminder_kind, due_on
    )
    select entity_type, entity_key, recipient_id, reminder_kind, due_on
    from candidates
    on conflict do nothing
    returning entity_type, entity_key, recipient_id, reminder_kind, due_on
  ), notifications_inserted as (
    insert into public.notifications (
      user_id, type, title, message, task_id, task_title,
      status_to, reason, project_id, proposal_id, org_id, entity_type
    )
    select inserted.recipient_id,
      case when inserted.reminder_kind = 'completion_recommended' then 'status_change' else 'overdue' end,
      case
        when inserted.reminder_kind = 'completion_recommended' then initcap(inserted.entity_type) || ' ready to complete'
        when inserted.reminder_kind = 'overdue' then initcap(inserted.entity_type) || ' overdue'
        else initcap(inserted.entity_type) || ' due soon'
      end,
      case
        when inserted.reminder_kind = 'completion_recommended' then 'All delivery work for "' || candidate.entity_title || '" is approved. Review and mark it completed.'
        when inserted.reminder_kind = 'overdue' then '"' || candidate.entity_title || '" passed its target date on ' || to_char(inserted.due_on, 'MM/DD/YYYY') || ' and is not completed.'
        else '"' || candidate.entity_title || '" is due on ' || to_char(inserted.due_on, 'MM/DD/YYYY') || '.'
      end,
      candidate.task_id, candidate.task_title,
      case when inserted.reminder_kind = 'completion_recommended' then 'completion_recommended' else null end,
      'Target date: ' || to_char(inserted.due_on, 'MM/DD/YYYY'),
      candidate.project_id, candidate.proposal_id, candidate.org_id, inserted.entity_type
    from inserted
    join candidates candidate
      on candidate.entity_type = inserted.entity_type
      and candidate.entity_key = inserted.entity_key
      and candidate.recipient_id = inserted.recipient_id
      and candidate.reminder_kind = inserted.reminder_kind
      and candidate.due_on = inserted.due_on
    returning 1
  )
  select count(*) into inserted_count from notifications_inserted;

  return inserted_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_subtask_due_date(p_subtask_id uuid, p_due_date date, p_reason text DEFAULT NULL::text)
 RETURNS subtasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller uuid := auth.uid();
  caller_name text := '';
  subtask public.subtasks;
  parent_task public.tasks;
  reason_required boolean;
  previous_due date;
begin
  if caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into subtask
  from public.subtasks
  where id = p_subtask_id
  for update;
  if not found then raise exception 'Subtask not found' using errcode = 'P0002'; end if;

  select * into parent_task
  from public.tasks
  where id = subtask.task_id and deleted_at is null
  for update;
  if not found then raise exception 'Parent task not found' using errcode = 'P0002'; end if;

  if not public.can_manage_subtasks(subtask.task_id, caller) then
    raise exception 'Only the Task Lead or an authorized manager may change a subtask deadline'
      using errcode = '42501';
  end if;
  if public.auth_role(caller) = 'admin' then
    raise exception 'Admin task oversight is read-only' using errcode = '42501';
  end if;
  if parent_task.archived_at is not null
     or parent_task.status in ('for_review', 'completed', 'cancelled') then
    raise exception 'Subtask deadlines are locked while the parent task is under review, completed, cancelled, or archived'
      using errcode = '22023';
  end if;
  if p_due_date is null then
    raise exception 'A subtask due date is required' using errcode = '22023';
  end if;
  if p_due_date is not null and (
    (parent_task.due_date ~ '^\d{4}-\d{2}-\d{2}' and p_due_date > left(parent_task.due_date, 10)::date)
    or (not coalesce(parent_task.due_date ~ '^\d{4}-\d{2}-\d{2}', false) and coalesce(parent_task.deadline ~ '^\d{4}-\d{2}-\d{2}', false) and p_due_date > left(parent_task.deadline, 10)::date)
  ) then
    raise exception 'Subtask due date cannot be later than its parent task due date'
      using errcode = '22023';
  end if;

  if subtask.due_date is not distinct from p_due_date then return subtask; end if;
  previous_due := subtask.due_date;
  reason_required := subtask.status <> 'todo' or subtask.percent_complete > 0;
  if reason_required and coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required after subtask work has started'
      using errcode = '22023';
  end if;

  select coalesce(full_name, 'Task Lead') into caller_name
  from public.profiles where id = caller;

  perform set_config('eflow.subtask_deadline_authorized', 'on', true);
  update public.subtasks
  set due_date = p_due_date,
      due_date_change_reason = nullif(btrim(p_reason), ''),
      due_date_changed_at = now(),
      due_date_changed_by = caller,
      updated_at = now()
  where id = p_subtask_id
  returning * into subtask;
  perform set_config('eflow.subtask_deadline_authorized', 'off', true);

  insert into public.audit_events (
    actor_id, actor_name, entity_type, entity_id, action, reason,
    before_data, after_data, org_id
  ) values (
    caller, caller_name, 'subtask', subtask.id::text, 'subtask.deadline.updated',
    nullif(btrim(p_reason), ''),
    jsonb_build_object('dueDate', previous_due),
    jsonb_build_object('dueDate', p_due_date), parent_task.org_id
  );

  insert into public.notifications (
    user_id, type, title, message, task_id, task_title, actor_id, actor_name,
    reason, project_id, proposal_id, org_id, entity_type
  )
  select recipient_id, 'status_change', 'Subtask deadline updated',
    caller_name || ' changed the deadline for "' || subtask.title || '" to ' || coalesce(to_char(p_due_date, 'MM/DD/YYYY'), 'No deadline') || '.',
    parent_task.id, parent_task.title, caller, caller_name,
    nullif(btrim(p_reason), ''), parent_task.linked_project_id,
    parent_task.proposal_id, parent_task.org_id, 'subtask'
  from (
    select distinct recipient_id
    from unnest(
      coalesce(subtask.assigned_to_ids, '{}'::uuid[])
      || array_remove(array[subtask.assigned_to], null)
    ) recipient_id
  ) recipients
  where recipient_id <> caller;

  return subtask;
exception when others then
  perform set_config('eflow.subtask_deadline_authorized', 'off', true);
  raise;
end;
$function$;

-- Lock TimeZone = 'Asia/Manila' so current_date and ::date evaluate in Philippine Time, not UTC.

ALTER FUNCTION public.dispatch_hierarchy_deadline_reminders() SET "TimeZone" TO 'Asia/Manila';

ALTER FUNCTION public.dispatch_task_review_reminders() SET "TimeZone" TO 'Asia/Manila';

ALTER FUNCTION public.run_governance_review_escalations() SET "TimeZone" TO 'Asia/Manila';

ALTER FUNCTION public.validate_cash_request_needed_by() SET "TimeZone" TO 'Asia/Manila';
