-- eFlow evidence security. Apply this WHOLE file, not the earlier chat hotfix.
-- Does not create task-files, modify Storage metadata, delete files, or replace
-- the existing workflow RPCs. See docs/mobile-phase-1-backend-handoff.md.
begin;
set local lock_timeout = '10s';

do $$
begin
  if not exists (select 1 from storage.buckets b where b.id = 'task-attachments' and b.public is false) then
    raise exception 'task-attachments must exist and be private';
  end if;
  if exists (select 1 from storage.buckets b where b.id = 'task-files' and b.public is distinct from false) then
    raise exception 'Optional task-files bucket must be private when present';
  end if;
  if to_regclass('public.subtask_submission_attachments') is null
     or to_regclass('public.subtask_progress_updates') is null
     or to_regclass('public.task_submissions') is null
     or to_regprocedure('public.can_see_task(uuid,uuid)') is null then
    raise exception 'Apply the task/subtask evidence workflow migrations first';
  end if;
end;
$$;

-- Not an exposed API schema. Durable seals survive deletion of workflow rows.
-- Cleanup tombstones are never recycled: a delayed Storage deletion cannot
-- delete a newly uploaded file at a reused name.
create schema if not exists eflow_evidence;
revoke all on schema eflow_evidence from public, anon, authenticated;
grant usage on schema eflow_evidence to anon, authenticated;

create table if not exists eflow_evidence.objects (
  bucket_id text not null,
  object_name text not null,
  object_id uuid,
  task_id uuid,
  subtask_id uuid,
  actor_id uuid,
  state text not null check (state in ('finalized', 'cleanup')),
  reference_kind text,
  reference_id uuid,
  recorded_at timestamptz not null default now(),
  legacy boolean not null default false,
  primary key (bucket_id, object_name)
);

create table if not exists eflow_evidence.attempts (
  kind text not null check (kind in ('task', 'subtask')),
  submission_id uuid not null,
  task_id uuid not null,
  subtask_id uuid,
  actor_id uuid not null,
  creation_xid xid8 not null default pg_current_xact_id(),
  primary key (kind, submission_id)
);
alter table eflow_evidence.objects enable row level security;
alter table eflow_evidence.attempts enable row level security;
revoke all on all tables in schema eflow_evidence from public, anon, authenticated, service_role;

-- This is the server acceptance contract for NEW evidence. Existing evidence
-- remains readable even when it exceeds these limits. Configure bucket upload
-- limits through the Storage settings/API as documented in the handoff.
create or replace function public.get_task_evidence_rules()
returns jsonb language sql immutable set search_path = pg_catalog
as $$
  select jsonb_build_object(
    'bucketId', 'task-attachments',
    'maxFileBytes', 52428800,
    'maxFilesPerSubmission', 10,
    'recommendedSignedUrlSeconds', 300,
    'orphanMinimumAgeHours', 24,
    'allowedMimeTypes', jsonb_build_array(
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'image/gif', 'image/heic', 'image/heif', 'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/wav'
    )
  );
$$;

create or replace function eflow_evidence.active_actor()
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

-- Safe parsing: malformed paths return no row, never a UUID-cast exception.
create or replace function eflow_evidence.path_context(p_name text)
returns table(task_id uuid, subtask_id uuid, attempt text)
language plpgsql stable security definer set search_path = pg_catalog
as $$
declare
  parts text[] := string_to_array(p_name, '/');
  uuid_pattern constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_name is null then return; end if;
  if cardinality(parts) = 4 and parts[1] = 'subtasks' then
    if parts[2] !~* uuid_pattern or parts[4] in ('', '.', '..')
       or not (parts[3] = 'progress' or parts[3] ~* uuid_pattern) then return; end if;
    return query select s.task_id, s.id, parts[3]
      from public.subtasks s where s.id = parts[2]::uuid;
  elsif cardinality(parts) = 3 then
    if parts[1] !~* uuid_pattern or parts[2] !~* uuid_pattern
       or parts[3] in ('', '.', '..') then return; end if;
    return query select t.id, null::uuid, parts[2]
      from public.tasks t where t.id = parts[1]::uuid;
  end if;
end;
$$;

create or replace function eflow_evidence.can_read_task(p_task uuid, p_subtask uuid)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select eflow_evidence.active_actor() and (
    coalesce(public.can_see_task(p_task, auth.uid()), false)
    or exists (select 1 from public.subtasks s join public.tasks t on t.id = s.task_id
      where s.id = p_subtask and s.task_id = p_task and t.deleted_at is null
        and (s.assigned_to = auth.uid() or s.reviewer_id = auth.uid()
          or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text))
  );
$$;

create or replace function eflow_evidence.can_upload(p_name text)
returns boolean language plpgsql stable security definer set search_path = pg_catalog
as $$
declare ctx record; t public.tasks; s public.subtasks;
begin
  if not eflow_evidence.active_actor() then return false; end if;
  if exists (select 1 from eflow_evidence.objects o where o.bucket_id = 'task-attachments' and o.object_name = p_name) then return false; end if;
  select * into ctx from eflow_evidence.path_context(p_name);
  if not found then return false; end if;
  select * into t from public.tasks where id = ctx.task_id;
  if t.deleted_at is not null or t.archived_at is not null
     or t.status is null or t.status not in ('todo', 'in_progress', 'changes_requested') then return false; end if;
  if ctx.subtask_id is null then
    return t.status = 'in_progress'
      and coalesce(t.assigned_to, t.recommendation_lead_id) is not distinct from auth.uid()
      and not exists (select 1 from public.task_submissions a where a.id = ctx.attempt::uuid);
  end if;
  select * into s from public.subtasks where id = ctx.subtask_id;
  return coalesce(s.status in ('todo', 'in_progress', 'changes_requested'), false)
    and (coalesce(s.assigned_to = auth.uid(), false)
      or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text)
    and (ctx.attempt = 'progress' or not exists (
      select 1 from public.subtask_submissions a where a.id::text = lower(ctx.attempt)));
end;
$$;

create or replace function eflow_evidence.can_read(p_bucket text, p_name text, p_owner text)
returns boolean language plpgsql stable security definer set search_path = pg_catalog
as $$
declare seal eflow_evidence.objects; ctx record;
begin
  if not eflow_evidence.active_actor() then return false; end if;
  select * into seal from eflow_evidence.objects where bucket_id = p_bucket and object_name = p_name;
  if found then
    if seal.state = 'cleanup' then return coalesce(p_owner = auth.uid()::text, false); end if;
    return eflow_evidence.can_read_task(seal.task_id, seal.subtask_id);
  end if;
  -- Owners can still clean up their unsubmitted upload after reassignment.
  if p_owner = auth.uid()::text then return true; end if;
  select * into ctx from eflow_evidence.path_context(p_name);
  if not found then return false; end if;
  return eflow_evidence.can_read_task(ctx.task_id, ctx.subtask_id);
end;
$$;

-- Record already-referenced evidence as immutable without rewriting history.
-- Abort ambiguous cross-task references rather than guessing an access owner.
do $$
begin
  if exists (
    select refs.path from (
      select file_path as path, task_id from public.task_attachments
      union all select file_path, task_id from public.subtask_submission_attachments
      union all select attachment_path, task_id from public.subtask_progress_updates
    ) refs where nullif(refs.path, '') is not null
    group by refs.path having count(distinct refs.task_id) > 1
  ) then
    raise exception 'An evidence path is referenced by multiple tasks. Audit these legacy references before applying this migration.';
  end if;
  if exists (
    select 1 from (
      select file_path as path, task_id, null::uuid as subtask_id from public.task_attachments
      union all select file_path, task_id, subtask_id from public.subtask_submission_attachments
      union all select attachment_path, task_id, subtask_id from public.subtask_progress_updates
    ) refs cross join lateral eflow_evidence.path_context(refs.path) ctx
    where ctx.task_id is distinct from refs.task_id or ctx.subtask_id is distinct from refs.subtask_id
  ) then
    raise exception 'An existing evidence reference contradicts its task/subtask path. Audit this binding before applying the migration.';
  end if;
end;
$$;

with refs as (
  select file_path as path, task_id, null::uuid as subtask_id, uploaded_by as actor_id, 'task_attachment' as kind, id
    from public.task_attachments
  union all select file_path, task_id, subtask_id, uploaded_by, 'subtask_attachment', id
    from public.subtask_submission_attachments
  union all select attachment_path, task_id, subtask_id, author_id, 'progress', id
    from public.subtask_progress_updates
)
insert into eflow_evidence.objects(bucket_id, object_name, object_id, task_id, subtask_id, actor_id, state, reference_kind, reference_id, legacy)
select b.id, r.path, o.id, r.task_id, r.subtask_id, r.actor_id, 'finalized', r.kind, r.id, true
from refs r cross join storage.buckets b
left join storage.objects o on o.bucket_id = b.id and o.name = r.path
where b.id in ('task-attachments', 'task-files') and nullif(r.path, '') is not null
  and (b.id = 'task-attachments' or o.id is not null)
on conflict (bucket_id, object_name) do nothing;

-- Same lock is used by finalization and cleanup. It is NOT taken in an RLS
-- predicate: Storage may run permission probes in rolled-back transactions.
create or replace function eflow_evidence.lock_path(p_bucket text, p_name text)
returns void language sql volatile set search_path = pg_catalog
as $$ select pg_advisory_xact_lock(hashtextextended(p_bucket || '/' || p_name, 817261)); $$;

create or replace function eflow_evidence.seal_file(
  p_name text, p_task uuid, p_subtask uuid, p_attempt text,
  p_kind text, p_reference uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare ctx record; obj storage.objects; rules jsonb := public.get_task_evidence_rules(); bytes bigint; mime text;
begin
  if not eflow_evidence.active_actor() then raise exception 'An active authenticated profile is required' using errcode = '42501'; end if;
  select * into ctx from eflow_evidence.path_context(p_name);
  if not found or ctx.task_id is distinct from p_task or ctx.subtask_id is distinct from p_subtask
     or lower(ctx.attempt) is distinct from lower(p_attempt) then
    raise exception 'Evidence path does not belong to this task and attempt' using errcode = '22023';
  end if;
  perform eflow_evidence.lock_path('task-attachments', p_name);
  if exists (select 1 from eflow_evidence.objects o where o.bucket_id = 'task-attachments' and o.object_name = p_name) then
    raise exception 'Evidence is already finalized or claimed for cleanup; upload a new file' using errcode = '22023';
  end if;
  select * into obj from storage.objects where bucket_id = 'task-attachments' and name = p_name;
  if not found or obj.owner_id is distinct from auth.uid()::text then
    raise exception 'Evidence file is missing or was not uploaded by you' using errcode = '42501';
  end if;
  if coalesce(obj.metadata ->> 'size', '') !~ '^[0-9]{1,15}$' then
    raise exception 'Storage has not recorded a valid evidence size' using errcode = '22023';
  end if;
  bytes := (obj.metadata ->> 'size')::bigint;
  mime := lower(split_part(coalesce(obj.metadata ->> 'mimetype', ''), ';', 1));
  if bytes <= 0 or bytes > (rules ->> 'maxFileBytes')::bigint then
    raise exception 'Evidence must be nonempty and no larger than 50 MiB' using errcode = '22023';
  end if;
  if not ((rules -> 'allowedMimeTypes') ? mime) then
    raise exception 'Unsupported evidence MIME type: %', mime using errcode = '22023';
  end if;
  insert into eflow_evidence.objects(bucket_id, object_name, object_id, task_id, subtask_id, actor_id, state, reference_kind, reference_id)
  values ('task-attachments', p_name, obj.id, p_task, p_subtask, auth.uid(), 'finalized', p_kind, p_reference);
  return jsonb_build_object('fileSize', bytes, 'mimeType', mime);
end;
$$;

-- Preserve RPC signatures and existing audit, notifications, review routing,
-- status transitions, and dependency triggers. Enforce at the persisted rows.
create or replace function eflow_evidence.guard_attempt()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare t public.tasks; s public.subtasks; kind text; sid uuid;
begin
  if not eflow_evidence.active_actor() or new.submitter_id is distinct from auth.uid() then
    raise exception 'Submission requires its active authenticated submitter' using errcode = '42501';
  end if;
  if new.status is distinct from 'pending' or new.decided_by is not null or new.decided_at is not null
     or new.decision_feedback is not null or new.decided_by_name is not null then
    raise exception 'A new submission must be pending and undecided' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = new.task_id;
  if not found or t.deleted_at is not null or t.archived_at is not null then
    raise exception 'Task is not open for submission' using errcode = '22023';
  end if;
  if tg_table_name = 'task_submissions' then
    kind := 'task';
    if coalesce(t.assigned_to, t.recommendation_lead_id) is distinct from auth.uid() then
      raise exception 'Only the effective Task Leader may submit the parent task' using errcode = '42501';
    end if;
    if t.status <> 'in_progress' or exists (
      select 1 from public.subtasks child where child.task_id = t.id and (child.status is distinct from 'completed' or not coalesce(child.is_completed, false))
    ) then raise exception 'Parent submission requires in-progress work and all subtasks approved' using errcode = '22023'; end if;
  else
    kind := 'subtask'; sid := new.subtask_id;
    select * into s from public.subtasks where id = sid;
    if not found or s.task_id is distinct from t.id or not (
      coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text
    ) then raise exception 'This subtask is not assigned to you' using errcode = '42501'; end if;
    if s.status is null or s.status not in ('todo', 'in_progress', 'changes_requested')
       or t.status is null or t.status not in ('todo', 'in_progress', 'changes_requested') then
      raise exception 'Task/subtask is not open for submission' using errcode = '22023';
    end if;
    if new.reviewer_id = auth.uid() or new.reviewer_id is distinct from public.resolve_subtask_reviewer(t, auth.uid())
       or new.reviewer_id is null then raise exception 'Invalid subtask reviewer' using errcode = '42501'; end if;
  end if;
  insert into eflow_evidence.attempts(kind, submission_id, task_id, subtask_id, actor_id)
  values (kind, new.id, t.id, sid, auth.uid());
  return new;
end;
$$;

-- The parent RPC also stores a presentation snapshot on tasks. Build that
-- snapshot's attachment metadata from the validated relational rows rather
-- than retaining untrusted fileSize/mimeType values from its JSON payload.
create or replace function eflow_evidence.guard_task_snapshot()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare attempt eflow_evidence.attempts; files jsonb;
begin
  if new.latest_submission is not distinct from old.latest_submission then return new; end if;
  if auth.role() = 'service_role' or (auth.uid() is null and coalesce(auth.role(), '') = '') then return new; end if;
  select * into attempt from eflow_evidence.attempts a
  where a.kind = 'task' and a.task_id = new.id and a.submission_id::text = new.latest_submission ->> 'id';
  if not found or attempt.creation_xid <> pg_current_xact_id()
     or attempt.actor_id is distinct from auth.uid() then
    raise exception 'Submission snapshot must come from the current validated submission' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'fileName', a.file_name, 'filePath', a.file_path, 'fileSize', a.file_size, 'mimeType', a.mime_type
  ) order by incoming.position), '[]'::jsonb) into files
  from jsonb_array_elements(coalesce(new.latest_submission -> 'attachments', '[]'::jsonb)) with ordinality as incoming(item, position)
  join public.task_attachments a on a.submission_id = attempt.submission_id
    and a.file_path = incoming.item ->> 'filePath';
  if jsonb_array_length(files) <> (select count(*) from public.task_attachments a where a.submission_id = attempt.submission_id) then
    raise exception 'Submission snapshot does not match its validated evidence' using errcode = '22023';
  end if;
  new.latest_submission := jsonb_set(new.latest_submission, '{attachments}', files);
  return new;
end;
$$;

create or replace function eflow_evidence.guard_attachment()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare attempt eflow_evidence.attempts; v_kind text; sid uuid; count_files integer; facts jsonb;
begin
  v_kind := case when tg_table_name = 'task_attachments' then 'task' else 'subtask' end;
  select * into attempt from eflow_evidence.attempts a where a.kind = v_kind and a.submission_id = new.submission_id;
  if not found or attempt.creation_xid <> pg_current_xact_id()
     or attempt.actor_id is distinct from auth.uid() or new.uploaded_by is distinct from auth.uid()
     or new.task_id is distinct from attempt.task_id then
    raise exception 'Evidence must be attached by its submitter in the submission transaction' using errcode = '42501';
  end if;
  if v_kind = 'subtask' then
    sid := new.subtask_id;
    if sid is distinct from attempt.subtask_id then raise exception 'Evidence subtask mismatch' using errcode = '22023'; end if;
    select count(*) into count_files from public.subtask_submission_attachments a where a.submission_id = new.submission_id;
  else
    select count(*) into count_files from public.task_attachments a where a.submission_id = new.submission_id;
  end if;
  if count_files >= (public.get_task_evidence_rules() ->> 'maxFilesPerSubmission')::integer then
    raise exception 'At most 10 evidence files are allowed per submission' using errcode = '22023';
  end if;
  if nullif(btrim(new.file_name), '') is null then raise exception 'Evidence filename is required' using errcode = '22023'; end if;
  facts := eflow_evidence.seal_file(new.file_path, new.task_id, sid, new.submission_id::text, v_kind || '_attachment', new.id);
  -- Never trust the client-provided size/type for the stored evidence record.
  new.file_size := (facts ->> 'fileSize')::bigint;
  new.mime_type := facts ->> 'mimeType';
  return new;
end;
$$;

create or replace function eflow_evidence.guard_progress()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare s public.subtasks; t public.tasks;
begin
  if not eflow_evidence.active_actor() or new.author_id is distinct from auth.uid() then
    raise exception 'Progress requires its active authenticated author' using errcode = '42501';
  end if;
  select * into s from public.subtasks where id = new.subtask_id;
  select * into t from public.tasks where id = new.task_id;
  if s.id is null or t.id is null or s.task_id is distinct from t.id or not (
    coalesce(s.assigned_to = auth.uid(), false) or coalesce(to_jsonb(s.assigned_to_ids), '[]'::jsonb) ? auth.uid()::text
  ) then raise exception 'This subtask is not assigned to you' using errcode = '42501'; end if;
  if t.deleted_at is not null or t.archived_at is not null
     or t.status is null or t.status not in ('todo', 'in_progress', 'changes_requested')
     or s.status is null or s.status not in ('todo', 'in_progress', 'changes_requested') then
    raise exception 'Task/subtask is not open for progress' using errcode = '22023';
  end if;
  if nullif(new.attachment_path, '') is not null then
    perform eflow_evidence.seal_file(new.attachment_path, t.id, s.id, 'progress', 'progress', new.id);
  end if;
  return new;
end;
$$;

create or replace function eflow_evidence.check_subtask_evidence()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if not exists (select 1 from public.subtask_submission_attachments a where a.submission_id = new.id) then
    raise exception 'Subtask submission requires at least one validated evidence file' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- Deny mutation of evidence bindings. Review status/decision fields on the
-- submission tables remain editable by the existing review RPCs.
create or replace function eflow_evidence.guard_history()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare old_binding jsonb; new_binding jsonb;
begin
  if tg_op = 'UPDATE' then
    old_binding := to_jsonb(old); new_binding := to_jsonb(new);
    if tg_table_name in ('task_submissions', 'subtask_submissions') then
      old_binding := old_binding - array['status','decided_by','decided_by_name','decision_feedback','decided_at'];
      new_binding := new_binding - array['status','decided_by','decided_by_name','decision_feedback','decided_at'];
    end if;
    if old_binding = new_binding then return new; end if;
  end if;
  -- Retention/repair is an explicit administrator operation, never a client
  -- permission. Durable file seals remain even if administrators remove rows.
  if auth.role() = 'service_role' or (auth.uid() is null and coalesce(auth.role(), '') = '') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception 'Submitted evidence/history is immutable' using errcode = '42501';
end;
$$;

-- Correct the stale planning-lead precedence without changing existing pending
-- submissions' stored reviewers. New submissions/progress use the live lead.
create or replace function public.resolve_subtask_reviewer(target_task public.tasks, submitter uuid)
returns uuid language plpgsql stable security definer set search_path = pg_catalog
as $$
declare candidate uuid;
begin
  foreach candidate in array array[
    coalesce(target_task.assigned_to, target_task.recommendation_lead_id),
    target_task.reviewer_id, target_task.backup_reviewer_id, target_task.created_by
  ] loop
    if candidate is not null and candidate <> submitter and exists (
      select 1 from public.profiles p where p.id = candidate and p.is_active
    ) then return candidate; end if;
  end loop;
  return null;
end;
$$;

do $$
declare target text;
begin
  foreach target in array array['task_submissions','subtask_submissions'] loop
    execute format('drop trigger if exists evidence_guard_attempt on public.%I', target);
    execute format('create trigger evidence_guard_attempt before insert on public.%I for each row execute function eflow_evidence.guard_attempt()', target);
  end loop;
  foreach target in array array['task_attachments','subtask_submission_attachments'] loop
    execute format('drop trigger if exists evidence_guard_attachment on public.%I', target);
    execute format('create trigger evidence_guard_attachment before insert on public.%I for each row execute function eflow_evidence.guard_attachment()', target);
  end loop;
  foreach target in array array['task_submissions','subtask_submissions','task_attachments','subtask_submission_attachments','subtask_progress_updates'] loop
    execute format('drop trigger if exists evidence_guard_history on public.%I', target);
    execute format('create trigger evidence_guard_history before update or delete on public.%I for each row execute function eflow_evidence.guard_history()', target);
  end loop;
end;
$$;
drop trigger if exists evidence_guard_progress on public.subtask_progress_updates;
create trigger evidence_guard_progress before insert on public.subtask_progress_updates
for each row execute function eflow_evidence.guard_progress();
drop trigger if exists evidence_require_subtask_file on public.subtask_submissions;
create constraint trigger evidence_require_subtask_file after insert on public.subtask_submissions
deferrable initially deferred for each row execute function eflow_evidence.check_subtask_evidence();
drop trigger if exists evidence_guard_task_snapshot on public.tasks;
create trigger evidence_guard_task_snapshot before update of latest_submission on public.tasks
for each row execute function eflow_evidence.guard_task_snapshot();

-- Call this RPC and WAIT FOR SUCCESS before Storage.remove(). It commits a
-- permanent cleanup claim; finalization will then reject the same path.
-- Service-role workers may claim only unreferenced uploads >=24 hours old.
create or replace function public.claim_task_evidence_cleanup(p_object_name text, p_bucket_id text default 'task-attachments')
returns boolean language plpgsql security definer set search_path = pg_catalog
as $$
declare obj storage.objects; seal eflow_evidence.objects; worker boolean := coalesce(auth.role() = 'service_role', false);
begin
  if p_bucket_id is null or p_bucket_id not in ('task-attachments', 'task-files') or nullif(p_object_name, '') is null then
    raise exception 'Invalid evidence cleanup target' using errcode = '22023';
  end if;
  if not worker and not eflow_evidence.active_actor() then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform eflow_evidence.lock_path(p_bucket_id, p_object_name);
  select * into obj from storage.objects where bucket_id = p_bucket_id and name = p_object_name;
  if not found then return false; end if;
  if not worker and obj.owner_id is distinct from auth.uid()::text then raise exception 'Only the uploader may clean up this file' using errcode = '42501'; end if;
  if worker and (obj.created_at is null or obj.created_at > now() - interval '24 hours') then raise exception 'Orphan cleanup requires an upload at least 24 hours old' using errcode = '22023'; end if;
  select * into seal from eflow_evidence.objects where bucket_id = p_bucket_id and object_name = p_object_name;
  if found then
    if seal.state = 'finalized' then raise exception 'Finalized evidence cannot be deleted' using errcode = '42501'; end if;
    if seal.object_id is distinct from obj.id then raise exception 'Cleanup object identity changed; manual inspection required' using errcode = '22023'; end if;
    return true;
  end if;
  if exists (select 1 from public.task_attachments a where a.file_path = p_object_name)
     or exists (select 1 from public.subtask_submission_attachments a where a.file_path = p_object_name)
     or exists (select 1 from public.subtask_progress_updates a where a.attachment_path = p_object_name) then
    raise exception 'Referenced evidence cannot be deleted' using errcode = '42501';
  end if;
  insert into eflow_evidence.objects(bucket_id, object_name, object_id, actor_id, state)
  values (p_bucket_id, p_object_name, obj.id, auth.uid(), 'cleanup');
  return true;
end;
$$;

create or replace function eflow_evidence.can_delete(p_bucket text, p_name text, p_id uuid, p_owner text)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select eflow_evidence.active_actor() and p_owner = auth.uid()::text and exists (
    select 1 from eflow_evidence.objects o where o.bucket_id = p_bucket and o.object_name = p_name
      and o.object_id = p_id and o.state = 'cleanup'
  );
$$;

-- Remove the broad legacy policy and replace either version of the chat hotfix.
drop policy if exists taskfiles_rw on storage.objects;
drop policy if exists eflow_evidence_scope_guard on storage.objects;
drop policy if exists eflow_evidence_no_delete on storage.objects;
drop policy if exists eflow_evidence_read on storage.objects;
drop policy if exists eflow_evidence_insert on storage.objects;
drop policy if exists eflow_evidence_no_update on storage.objects;
drop policy if exists eflow_evidence_read_guard on storage.objects;
drop policy if exists eflow_evidence_insert_guard on storage.objects;
drop policy if exists eflow_evidence_delete_guard on storage.objects;
drop policy if exists eflow_evidence_delete on storage.objects;

create policy eflow_evidence_read_guard on storage.objects as restrictive for select to anon, authenticated
using (bucket_id not in ('task-attachments','task-files') or eflow_evidence.can_read(bucket_id, name, owner_id));
create policy eflow_evidence_read on storage.objects for select to authenticated
using (bucket_id in ('task-attachments','task-files') and eflow_evidence.can_read(bucket_id, name, owner_id));

create policy eflow_evidence_insert_guard on storage.objects as restrictive for insert to anon, authenticated
with check (bucket_id not in ('task-attachments','task-files') or (bucket_id = 'task-attachments' and owner_id = auth.uid()::text and eflow_evidence.can_upload(name)));
create policy eflow_evidence_insert on storage.objects for insert to authenticated
with check (bucket_id = 'task-attachments' and owner_id = auth.uid()::text and eflow_evidence.can_upload(name));

create policy eflow_evidence_no_update on storage.objects as restrictive for update to anon, authenticated
using (bucket_id not in ('task-attachments','task-files'))
with check (bucket_id not in ('task-attachments','task-files'));

create policy eflow_evidence_delete_guard on storage.objects as restrictive for delete to anon, authenticated
using (bucket_id not in ('task-attachments','task-files') or eflow_evidence.can_delete(bucket_id, name, id, owner_id));
create policy eflow_evidence_delete on storage.objects for delete to authenticated
using (bucket_id in ('task-attachments','task-files') and eflow_evidence.can_delete(bucket_id, name, id, owner_id));

revoke all on all functions in schema eflow_evidence from public, anon, authenticated, service_role;
grant execute on function eflow_evidence.can_read(text,text,text), eflow_evidence.can_upload(text), eflow_evidence.can_delete(text,text,uuid,text) to anon, authenticated;
revoke all on function public.get_task_evidence_rules() from public, anon;
grant execute on function public.get_task_evidence_rules() to authenticated, service_role;
revoke all on function public.claim_task_evidence_cleanup(text,text) from public, anon;
grant execute on function public.claim_task_evidence_cleanup(text,text) to authenticated, service_role;
revoke all on function public.resolve_subtask_reviewer(public.tasks,uuid) from public, anon;
grant execute on function public.resolve_subtask_reviewer(public.tasks,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
