-- Reviewed project publication is separate from operational draft publication.
-- No existing project is published and no wallet transaction is sent by this migration.
create schema if not exists eflow_seal;
revoke all on schema eflow_seal from public, anon, authenticated;

alter table public.projects add column if not exists completed_at timestamptz;
alter table public.projects add column if not exists archive_reminded_at timestamptz;
alter table public.projects add column if not exists archive_blocked_at timestamptz;
create index if not exists project_archive_clock_idx on public.projects(completed_at,id) where status='completed' and completed_at is not null;

-- Only a trustworthy completion event supplies a historical clock.
update public.projects p set completed_at=q.completed_at
from (select entity_id,max(created_at) completed_at from public.audit_events
      where entity_type='project' and action='project.completed' group by entity_id) q
where p.id::text=q.entity_id and p.status in ('completed','archived') and p.completed_at is null;

create or replace function eflow_seal.completion_clock() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='completed' and old.status is distinct from 'completed' then
  new.completed_at:=now(); new.archive_reminded_at:=null; new.archive_blocked_at:=null;
 elsif new.status not in ('completed','archived') then
  new.completed_at:=null; new.archive_reminded_at:=null; new.archive_blocked_at:=null;
 else
  -- Clients cannot postpone a scheduled archive by changing the clock.
  new.completed_at:=old.completed_at;
  if auth.uid() is not null then
   new.archive_reminded_at:=old.archive_reminded_at; new.archive_blocked_at:=old.archive_blocked_at;
  end if;
 end if;
 return new;
end $$;
drop trigger if exists seal_completion_clock on public.projects;
create trigger seal_completion_clock before update on public.projects for each row execute function eflow_seal.completion_clock();

create table if not exists eflow_seal.snapshots(
 -- Durable identity rather than a FK: discarding a private preview must not
 -- prevent deletion of an unsealed project. Approved projects have writer guards.
 id uuid primary key default gen_random_uuid(), project_id uuid not null,
 version integer not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 source_hash text not null, dossier jsonb not null,
 state text not null default 'preparing' check(state in ('preparing','review_ready','queued','uploading','broadcast','confirming','confirmed','failed','simulation','cancelled')),
 manifest text, manifest_hash text, approved_by uuid references public.profiles(id), approved_at timestamptz,
 archive_uri text, storage_kind text, tx_hash text, signed_tx text, nonce bigint, publisher text,
 contract_address text, chain_id integer, block_number bigint, block_hash text, confirmed_at timestamptz,
 error text, attempts integer not null default 0, lease_owner uuid, lease_until timestamptz,
 previous_id uuid references eflow_seal.snapshots(id), correction_note text, reverted boolean not null default false,
 unique(project_id,version), check(manifest_hash is null or manifest_hash ~ '^[a-f0-9]{64}$')
);
create unique index if not exists seal_one_open_job on eflow_seal.snapshots(project_id)
 where state not in ('cancelled','simulation','confirmed');
create index on eflow_seal.snapshots(created_by);
create index on eflow_seal.snapshots(approved_by) where approved_by is not null;
create index on eflow_seal.snapshots(previous_id) where previous_id is not null;
alter table eflow_seal.snapshots enable row level security;
create table eflow_seal.transaction_attempts(
 tx_hash text primary key, snapshot_id uuid not null references eflow_seal.snapshots(id),
 nonce bigint not null,signed_tx text not null,publisher text not null,created_at timestamptz not null default now(),
 receipt_status integer check(receipt_status in(0,1)),block_number bigint,block_hash text
);
create index on eflow_seal.transaction_attempts(snapshot_id);
alter table eflow_seal.transaction_attempts enable row level security;
create table eflow_seal.preview_edits(id uuid primary key default gen_random_uuid(),snapshot_id uuid not null references eflow_seal.snapshots(id),actor_id uuid not null,previous_hash text not null,next_hash text not null,created_at timestamptz not null default now());
create index on eflow_seal.preview_edits(snapshot_id);
alter table eflow_seal.preview_edits enable row level security;
create table if not exists eflow_seal.wallet_lease(id boolean primary key default true check(id), owner uuid, until_at timestamptz);
alter table eflow_seal.wallet_lease enable row level security;
insert into eflow_seal.wallet_lease(id) values(true) on conflict do nothing;
create table if not exists public.project_seal_certificates(
 id uuid primary key, project_id uuid not null, version integer not null, title text not null,
 manifest_hash text not null, archive_uri text not null, storage_kind text not null,
 chain_id integer not null check(chain_id=80002), contract_address text not null,
 tx_hash text not null unique, block_number bigint not null, block_hash text not null,
 publisher text not null, sealed_at timestamptz not null, previous_id uuid,
 unique(project_id,version)
);
alter table public.project_seal_certificates enable row level security;
create policy seal_public_read on public.project_seal_certificates for select to anon,authenticated using(true);
grant select on public.project_seal_certificates to anon,authenticated;
revoke insert,update,delete,truncate on public.project_seal_certificates from anon,authenticated,service_role;

create or replace function eflow_seal.require_head(p_id uuid,p_actor uuid) returns void
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.projects p join public.organizations o on o.id=p.org_id
  join public.profiles u on u.id=p_actor where p.id=p_id and o.head_user_id=u.id and u.role::text='head' and u.is_active
  and o.is_active) then raise exception 'Only the appointed Head can publish this project.' using errcode='42501'; end if;
end $$;

-- Scheduler runs in hosted Postgres, not on the AI laptop. Eligibility is the
-- existing financial/work closeout calculation; nothing is bypassed or released.
create or replace function eflow_seal.archive_due_projects() returns jsonb
language plpgsql security definer set search_path='' as $$
declare p record; head_id uuid; blockers jsonb; archived_count integer:=0; reminded_count integer:=0;
begin
 for p in select * from public.projects where status='completed' and completed_at<=now()-interval '23 days'
  order by id for update skip locked loop
  select o.head_user_id into head_id from public.organizations o join public.profiles u on u.id=o.head_user_id
   where o.id=p.org_id and o.is_active and u.is_active and u.role::text='head';
  if p.archive_reminded_at is null and head_id is not null then
   insert into public.notifications(user_id,type,title,message,project_id,org_id)
   values(head_id,'project_archive_reminder','Project ready to archive',
    p.title||' will be archived on '||to_char((p.completed_at+interval '30 days') at time zone 'Asia/Manila','DD Mon YYYY, HH24:MI')||' PHT if it stays completed. Blockchain publication stays manual.',p.id,p.org_id);
   update public.projects set archive_reminded_at=now() where id=p.id;
   reminded_count:=reminded_count+1;
  end if;
  if p.completed_at>now()-interval '30 days' then continue; end if;
  blockers:=public.project_completion_readiness_internal(p.id)->'blockers';
  if jsonb_array_length(blockers)>0 then
   if p.archive_blocked_at is null and head_id is not null then
    insert into public.notifications(user_id,type,title,message,project_id,org_id)
    values(head_id,'project_archive_blocked','Auto-archive needs attention',p.title||': '||(blockers->0->>'title'),p.id,p.org_id);
    update public.projects set archive_blocked_at=now() where id=p.id;
   end if;
   continue;
  end if;
  begin
   update public.projects set status='archived',archived_at=now(),updated_at=now() where id=p.id;
   insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,reason,before_data,after_data,org_id)
   values(null,'eFlow archive scheduler','project',p.id::text,'project.auto_archived','Completed for 30 days; closeout checks passed.',
    jsonb_build_object('status','completed'),jsonb_build_object('status','archived','completed_at',p.completed_at),p.org_id);
   archived_count:=archived_count+1;
  exception when others then
   if p.archive_blocked_at is null and head_id is not null then
    insert into public.notifications(user_id,type,title,message,project_id,org_id)
    values(head_id,'project_archive_blocked','Auto-archive needs attention',p.title||' could not be archived: '||left(sqlerrm,250),p.id,p.org_id);
    update public.projects set archive_blocked_at=now() where id=p.id;
   end if;
  end;
 end loop;
 return jsonb_build_object('archived',archived_count,'reminded',reminded_count);
end $$;
revoke all on function eflow_seal.archive_due_projects() from public,anon,authenticated;

-- An exact, reviewed snapshot is never changed. Append a linked correction
-- certificate instead of rewriting old bytes or restoring a sealed project.
create or replace function eflow_seal.assert_editable(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_id is null then return; end if;
 perform pg_advisory_xact_lock(hashtextextended('project-seal:'||p_id::text,0));
 if exists(select 1 from eflow_seal.snapshots where project_id=p_id and approved_at is not null and state not in ('cancelled','simulation')) then
  raise exception 'This project is locked for blockchain publication. Its published record cannot be edited.' using errcode='55000';
 end if;
end $$;

create or replace function eflow_seal.row_project(r jsonb,t text) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
 if t='projects' then return (r->>'id')::uuid; end if;
 if t='tasks' then return (r->>'linked_project_id')::uuid; end if;
 if t='project_library_links' then select project_id into result from public.project_library_files where id=(r->>'file_id')::uuid; return result; end if;
 if r ? 'project_id' then return nullif(r->>'project_id','')::uuid; end if;
 if r ? 'task_id' then select linked_project_id into result from public.tasks where id=(r->>'task_id')::uuid;
 elsif r ? 'request_id' then select t.linked_project_id into result from public.petty_cash_requests c join public.tasks t on t.id=c.task_id where c.id=(r->>'request_id')::uuid;
 elsif r ? 'allocation_id' then select t.linked_project_id into result from public.work_budget_allocations a join public.tasks t on t.id=a.task_id where a.id=(r->>'allocation_id')::uuid;
 elsif t='petty_cash_receipts' then select t.linked_project_id into result from public.petty_cash_liquidations l join public.petty_cash_requests c on c.id=l.request_id join public.tasks t on t.id=c.task_id where l.id=(r->>'liquidation_id')::uuid;
 elsif t='project_office_members' then select project_id into result from public.project_offices where id=(r->>'project_office_id')::uuid;
 elsif t='task_comment_attachments' then select t.linked_project_id into result from public.task_comments c join public.tasks t on t.id=c.task_id where c.id=(r->>'comment_id')::uuid;
 elsif t='milestone_organizations' then select project_id into result from public.milestones where id=(r->>'milestone_id')::uuid;
 elsif t='petty_cash_receipt_items' then select t.linked_project_id into result from public.petty_cash_receipts r0 join public.petty_cash_liquidations l on l.id=r0.liquidation_id join public.petty_cash_requests c on c.id=l.request_id join public.tasks t on t.id=c.task_id where r0.id=(r->>'receipt_id')::uuid;
 end if;
 return result;
end $$;
create or replace function eflow_seal.guard_record() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then perform eflow_seal.assert_editable(eflow_seal.row_project(to_jsonb(old),tg_table_name)); end if;
 if tg_op<>'DELETE' then perform eflow_seal.assert_editable(eflow_seal.row_project(to_jsonb(new),tg_table_name)); return new; end if;
 return old;
end $$;
do $$ declare r record; begin
 for r in select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and
  (table_schema='public' and table_name=any(array['projects','tasks','subtasks','project_groups','project_members','project_organizations','project_offices','project_office_members','project_office_identities','project_office_people','project_office_work','milestones','milestone_organizations','task_comments','task_comment_attachments','task_attachments','subtask_submission_attachments','task_progress_updates','subtask_progress_updates','task_submissions','subtask_submissions','task_status_history','project_library_files','project_library_links','work_budget_allocations','work_budget_allocation_lines','petty_cash_requests','petty_cash_liquidations','petty_cash_releases','petty_cash_receipts','petty_cash_receipt_items','petty_cash_request_attachments'])
    or table_schema='eflow_project' and table_name='funding') loop
  execute format('create trigger z_seal_immutable before insert or update or delete on %I.%I for each row execute function eflow_seal.guard_record()',r.table_schema,r.table_name);
 end loop;
end $$;

-- Content-addressed immutable backups. No browser may write/replace these files.
insert into storage.buckets(id,name,public) values('project-seal-private','project-seal-private',false),('project-seal-public','project-seal-public',true)
 on conflict(id) do nothing;
create policy seal_storage_guard on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id not in('project-seal-private','project-seal-public'))
 with check(bucket_id not in('project-seal-private','project-seal-public'));
insert into storage.buckets(id,name,public) values('project-seal-copies','project-seal-copies',false) on conflict(id) do nothing;
revoke all on all tables in schema eflow_seal from public,anon,authenticated;
revoke all on all functions in schema eflow_seal from public,anon,authenticated;

-- Hosted cadence; deliberately no minting worker here.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('eflow-project-auto-archive','17 * * * *','select eflow_seal.archive_due_projects()');
-- Only fixed, server-owned query specifications use this helper.
create or replace function eflow_seal.rows(q text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin execute 'select coalesce(jsonb_agg(v order by v::text),''[]''::jsonb) from ('||q||') x cross join lateral (select to_jsonb(x) v) j' into result; return result; end $$;

create or replace function eflow_seal.public_fields(value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 case jsonb_typeof(value)
 when 'object' then return coalesce((select jsonb_object_agg(key,eflow_seal.public_fields(v)) from jsonb_each(value) x(key,v)
  where lower(key) !~ '(password|secret|access_token|refresh_token|api_key|authorization|signed.?url|pds|burnout|coaching|health|recommendation|recommended_employee|professional_profile|workload)' and lower(key)<>'latest_submission'),'{}'::jsonb);
 when 'array' then return coalesce((select jsonb_agg(eflow_seal.public_fields(v) order by ord) from jsonb_array_elements(value) with ordinality x(v,ord)),'[]'::jsonb);
 else return value;
 end case;
end $$;

create or replace function eflow_seal.dossier(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; ids text; requests text; allocations text; liquidations text; journal_ids text; entities text;
begin
 ids:=format('select id from public.tasks where linked_project_id=%L::uuid',p_id);
 requests:='select id from public.petty_cash_requests where task_id in ('||ids||')';
 allocations:='select id from public.work_budget_allocations where task_id in ('||ids||')';
 liquidations:='select id from public.petty_cash_liquidations where request_id in ('||requests||')';
 journal_ids:='select id from public.general_journal_entries where source_id::text in (select id::text from public.petty_cash_requests where task_id in ('||ids||') union select id::text from public.petty_cash_liquidations where request_id in ('||requests||') union select id::text from public.petty_cash_releases where request_id in ('||requests||'))';
 journal_ids:='with recursive related(id) as (('||journal_ids||') union select j.id from public.general_journal_entries j join related r on j.source_id=r.id) select id from related';
 entities:=format('select %L::text as id union select id::text from public.tasks where linked_project_id=%L::uuid union select id::text from public.subtasks where task_id in (%s) union select id::text from public.petty_cash_requests where id in (%s) union select id::text from public.petty_cash_liquidations where id in (%s) union select id::text from public.petty_cash_releases where request_id in (%s) union select id::text from public.work_budget_allocations where id in (%s) union select id::text from public.milestones where project_id=%L::uuid',p_id::text,p_id,ids,requests,liquidations,requests,allocations,p_id);
 select jsonb_build_object('schema_version',1,'project',to_jsonb(p)-array['archive_reminded_at','archive_blocked_at'],
  'office',jsonb_build_object('id',o.id,'name',o.name)) into result from public.projects p join public.organizations o on o.id=p.org_id where p.id=p_id;
 if result is null then raise exception 'Project not found.' using errcode='22023'; end if;
 return eflow_seal.public_fields(result||jsonb_build_object(
  'groups',eflow_seal.rows(format('select * from public.project_groups where project_id=%L::uuid',p_id)),
  'members',eflow_seal.rows(format('select m.user_id,m.role,u.full_name from public.project_members m left join public.profiles u on u.id=m.user_id where m.project_id=%L::uuid',p_id)),
  'project_guests',eflow_seal.rows(format('select m.user_id,m.office_id,m.engagement,m.access_end,m.until_close,m.ended_at,u.full_name from public.project_guest_members m left join public.profiles u on u.id=m.user_id where m.project_id=%L::uuid',p_id)),
  'offices',eflow_seal.rows(format('select * from public.project_offices where project_id=%L::uuid',p_id)),
  'participating_offices',eflow_seal.rows(format('select * from public.project_organizations where project_id=%L::uuid',p_id)),
  'office_work',eflow_seal.rows(format('select * from public.project_office_work where project_id=%L::uuid',p_id)),
  'office_people',eflow_seal.rows(format('select * from public.project_office_people where project_id=%L::uuid',p_id)),
  'office_identities',eflow_seal.rows(format('select id,display_name,canonical_office_id,relationship_type,contact_status from public.project_office_identities where project_id=%L::uuid',p_id)),
  'office_members',eflow_seal.rows(format('select m.*,u.full_name from public.project_office_members m join public.project_offices o on o.id=m.project_office_id left join public.profiles u on u.id=m.user_id where o.project_id=%L::uuid',p_id)),
  'milestones',eflow_seal.rows(format('select * from public.milestones where project_id=%L::uuid',p_id)),
  'milestone_offices',eflow_seal.rows(format('select o.* from public.milestone_organizations o join public.milestones m on m.id=o.milestone_id where m.project_id=%L::uuid',p_id)),
  'tasks',eflow_seal.rows('select id,title,description,status,priority,assigned_to,assignee_name,team_member_ids,team_member_names,deadline,due_date,start_date,dependency_ids,group_id,workspace_position,reviewer_id,backup_reviewer_id,acceptance_criteria,definition_of_done,cancellation_reason,cancelled_at,created_at,updated_at,deleted_at from public.tasks where id in ('||ids||')'),
  'subtasks',eflow_seal.rows('select * from public.subtasks where task_id in ('||ids||')'),
  'task_submissions',eflow_seal.rows('select * from public.task_submissions where task_id in ('||ids||')'),
  'subtask_submissions',eflow_seal.rows('select * from public.subtask_submissions where task_id in ('||ids||')'),
  'task_updates',eflow_seal.rows('select * from public.task_progress_updates where task_id in ('||ids||')'),
  'subtask_updates',eflow_seal.rows('select * from public.subtask_progress_updates where task_id in ('||ids||')'),
  'status_history',eflow_seal.rows('select * from public.task_status_history where task_id in ('||ids||')'),
  'comments',eflow_seal.rows('select * from public.task_comments where task_id in ('||ids||')'),
  'comment_files',eflow_seal.rows('select a.* from public.task_comment_attachments a join public.task_comments c on c.id=a.comment_id where c.task_id in ('||ids||')'),
  'task_files',eflow_seal.rows('select * from public.task_attachments where task_id in ('||ids||')'),
  'subtask_files',eflow_seal.rows('select * from public.subtask_submission_attachments where task_id in ('||ids||')'),
  'library_files',eflow_seal.rows(format('select * from public.project_library_files where project_id=%L::uuid and state=''ready''',p_id)),
  'library_links',eflow_seal.rows(format('select l.* from public.project_library_links l join public.project_library_files f on f.id=l.file_id where f.project_id=%L::uuid and f.state=''ready''',p_id)),
  'funding',eflow_seal.rows(format('select f.*,s.name as account_name from eflow_project.funding f left join public.office_budget_sections s on s.id=f.partition_id where f.project_id=%L::uuid',p_id)),
  'allocations',eflow_seal.rows('select * from public.work_budget_allocations where id in ('||allocations||')'),
  'allocation_lines',eflow_seal.rows('select * from public.work_budget_allocation_lines where allocation_id in ('||allocations||')'),
  'cash_requests',eflow_seal.rows('select * from public.petty_cash_requests where id in ('||requests||')'),
  'cash_releases',eflow_seal.rows('select * from public.petty_cash_releases where request_id in ('||requests||')'),
  'liquidations',eflow_seal.rows('select * from public.petty_cash_liquidations where id in ('||liquidations||')'),
  'receipts',eflow_seal.rows('select * from public.petty_cash_receipts where liquidation_id in ('||liquidations||')'),
  'receipt_items',eflow_seal.rows('select i.* from public.petty_cash_receipt_items i join public.petty_cash_receipts r on r.id=i.receipt_id where r.liquidation_id in ('||liquidations||')'),
  'request_files',eflow_seal.rows('select * from public.petty_cash_request_attachments where request_id in ('||requests||')'),
  'budget_ledger',eflow_seal.rows('select * from public.budget_ledger_entries where task_id in ('||ids||') or petty_cash_request_id in ('||requests||')'),
  'journal_entries',eflow_seal.rows('select * from public.general_journal_entries where id in ('||journal_ids||')'),
  'journal_lines',eflow_seal.rows('select * from public.general_journal_lines where journal_entry_id in ('||journal_ids||')'),
  'audit',eflow_seal.rows('select id,actor_name,entity_type,entity_id,action,reason,before_data,after_data,created_at from public.audit_events where entity_id in ('||entities||')')
 ));
end $$;

create or replace function public.prepare_project_seal(p_project_id uuid,p_correction text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots; d jsonb; h text; v integer; previous uuid;
begin
 perform eflow_seal.require_head(p_project_id,auth.uid());
 perform pg_advisory_xact_lock(hashtextextended('project-seal:'||p_project_id::text,0));
 if not exists(select 1 from public.projects where id=p_project_id and status='archived') then raise exception 'Archive this project before publishing it.' using errcode='22023'; end if;
 select id into previous from eflow_seal.snapshots where project_id=p_project_id and state='confirmed' order by version desc limit 1;
 if previous is not null and length(btrim(coalesce(p_correction,'')))<10 then raise exception 'Explain the correction before preparing a new certificate.' using errcode='22023'; end if;
 if length(coalesce(p_correction,''))>4000 then raise exception 'Keep the correction note under 4,000 characters.' using errcode='22023'; end if;
 select * into s from eflow_seal.snapshots where project_id=p_project_id and state not in ('cancelled','simulation','confirmed') order by version desc limit 1;
 if found then return jsonb_build_object('id',s.id,'state',s.state); end if;
 d:=eflow_seal.dossier(p_project_id); h:=encode(sha256(convert_to(d::text,'UTF8')),'hex');
 select coalesce(max(version),0)+1 into v from eflow_seal.snapshots where project_id=p_project_id;
 insert into eflow_seal.snapshots(project_id,version,created_by,source_hash,dossier,previous_id,correction_note) values(p_project_id,v,auth.uid(),h,d,previous,nullif(btrim(p_correction),'')) returning * into s;
 return jsonb_build_object('id',s.id,'state',s.state);
end $$;

create or replace function public.project_seal_status(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots; p public.projects;
begin
 perform eflow_seal.require_head(p_project_id,auth.uid());
 select * into p from public.projects where id=p_project_id;
 select * into s from eflow_seal.snapshots where project_id=p_project_id order by version desc limit 1;
 return jsonb_build_object('project_id',p_project_id,'completed_at',p.completed_at,'auto_archive_at',p.completed_at+interval '30 days',
  'snapshot',case when s.id is null then null else to_jsonb(s)-array['dossier','signed_tx','lease_owner','lease_until'] end);
end $$;

create or replace function public.approve_project_seal(p_snapshot_id uuid,p_manifest_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots; current_hash text;
begin
 select * into s from eflow_seal.snapshots where id=p_snapshot_id;
 perform eflow_seal.require_head(s.project_id,auth.uid());
 perform pg_advisory_xact_lock(hashtextextended('project-seal:'||s.project_id::text,0));
 select * into s from eflow_seal.snapshots where id=p_snapshot_id for update;
 if s.manifest_hash is distinct from p_manifest_hash then raise exception 'The reviewed record changed. Open the preview again.' using errcode='40001'; end if;
 if s.approved_at is not null then return jsonb_build_object('id',s.id,'state',s.state); end if;
 if s.state<>'review_ready' then raise exception 'Wait until all files are ready to review.' using errcode='22023'; end if;
 current_hash:=encode(sha256(convert_to(eflow_seal.dossier(s.project_id)::text,'UTF8')),'hex');
 if current_hash<>s.source_hash then raise exception 'Project records changed. Discard this preview and prepare it again.' using errcode='40001'; end if;
 if jsonb_array_length(public.project_completion_readiness_internal(s.project_id)->'blockers')>0 then raise exception 'Resolve project closeout issues before publishing.' using errcode='22023'; end if;
 update eflow_seal.snapshots set state='queued',approved_by=auth.uid(),approved_at=now(),error=null where id=s.id;
 insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,reason,after_data,org_id)
 select auth.uid(),u.full_name,'project',p.id::text,'project.seal_approved','Head reviewed full public records and attachments.',jsonb_build_object('snapshot_id',s.id,'manifest_hash',s.manifest_hash),p.org_id from public.projects p join public.profiles u on u.id=auth.uid() where p.id=s.project_id;
 return jsonb_build_object('id',s.id,'state','queued');
end $$;

create or replace function public.discard_project_seal(p_snapshot_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots;
begin
 select * into s from eflow_seal.snapshots where id=p_snapshot_id for update;
 perform eflow_seal.require_head(s.project_id,auth.uid());
 if s.approved_at is not null then raise exception 'Publication has started. Resume the same job instead.' using errcode='55000'; end if;
 update eflow_seal.snapshots set state='cancelled',lease_owner=null,lease_until=null where id=s.id;
end $$;

-- Internal service operations are inaccessible with an anon/user JWT.
create or replace function public.seal_worker_claim(p_worker uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots;
begin
 select * into s from eflow_seal.snapshots where state in('preparing','queued','uploading','broadcast','confirming')
 and (lease_until is null or lease_until<now())
 and (state='preparing' or signed_tx is not null or not exists(select 1 from eflow_seal.snapshots pending where pending.signed_tx is not null and pending.state not in('confirmed','cancelled','simulation')))
 order by (signed_tx is not null) desc,created_at for update skip locked limit 1;
 if not found then return null; end if;
 if not exists(select 1 from public.projects where id=s.project_id) and s.approved_at is null then
  update eflow_seal.snapshots set state='cancelled',error='The unsealed project was removed.',lease_owner=null,lease_until=null where id=s.id;
  return null;
 end if;
 if s.approved_at is not null and s.archive_uri is null and s.signed_tx is null then
  begin perform eflow_seal.require_head(s.project_id,s.approved_by);
  exception when insufficient_privilege then
   update eflow_seal.snapshots set state='failed',error='The appointed Head changed. The current Head must review and retry publication.',lease_owner=null,lease_until=null where id=s.id;
   return null;
  end;
 end if;
 update eflow_seal.snapshots set lease_owner=p_worker,lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=s.id returning * into s;
 return to_jsonb(s)||jsonb_build_object('previous_manifest',(select manifest from eflow_seal.snapshots where id=s.previous_id and state='confirmed'));
end $$;
create or replace function public.seal_worker_save(p_worker uuid,p_snapshot_id uuid,p_patch jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots; n eflow_seal.snapshots;
begin
 select * into s from eflow_seal.snapshots where id=p_snapshot_id for update;
 if s.lease_owner is distinct from p_worker or s.lease_until<now() then raise exception 'Publication worker lease expired.' using errcode='55000'; end if;
 if s.state in('confirmed','simulation','cancelled') then raise exception 'Publication is already final.' using errcode='55000'; end if;
 if exists(select 1 from jsonb_object_keys(p_patch) k where k<>all(array['state','manifest','manifest_hash','archive_uri','storage_kind','tx_hash','signed_tx','nonce','publisher','contract_address','chain_id','block_number','block_hash','error','confirmed_at','reverted'])) then raise exception 'Invalid publication update.'; end if;
 if s.approved_at is not null and p_patch ?| array['manifest','manifest_hash'] then raise exception 'The reviewed manifest is immutable.'; end if;
 n:=jsonb_populate_record(s,p_patch);
 if n.state='simulation' and (n.signed_tx is not null or n.archive_uri is not null) then raise exception 'A live publication cannot become a simulation.'; end if;
 if s.signed_tx is not null and row(n.signed_tx,n.tx_hash,n.nonce,n.publisher,n.contract_address,n.chain_id,n.archive_uri) is distinct from row(s.signed_tx,s.tx_hash,s.nonce,s.publisher,s.contract_address,s.chain_id,s.archive_uri) then raise exception 'The saved blockchain transaction is immutable. Reconcile this transaction instead.'; end if;
 if n.manifest is not null and encode(sha256(convert_to(n.manifest,'UTF8')),'hex') is distinct from n.manifest_hash then raise exception 'Manifest hash does not match its bytes.'; end if;
 if n.state not in('preparing','review_ready','failed') and s.approved_at is null then raise exception 'The Head must review this record first.'; end if;
 if n.signed_tx is not null and s.signed_tx is null then
  insert into eflow_seal.transaction_attempts(tx_hash,snapshot_id,nonce,signed_tx,publisher) values(n.tx_hash,s.id,n.nonce,n.signed_tx,n.publisher);
 end if;
 if n.reverted and (n.signed_tx is null or n.block_number is null or n.block_hash is null or n.state<>'failed') then raise exception 'A finalized failed receipt is required before replacing a transaction.'; end if;
 if n.reverted or n.state='confirmed' then
  update eflow_seal.transaction_attempts set receipt_status=case when n.reverted then 0 else 1 end,block_number=n.block_number,block_hash=n.block_hash where tx_hash=n.tx_hash;
 end if;
 if n.state='confirmed' then
  if n.chain_id<>80002 or n.tx_hash is null or n.block_number is null or n.block_hash is null or n.archive_uri is null or n.contract_address is null or n.publisher is null then raise exception 'A verified Amoy receipt is required.'; end if;
  insert into public.project_seal_certificates(id,project_id,version,title,manifest_hash,archive_uri,storage_kind,chain_id,contract_address,tx_hash,block_number,block_hash,publisher,sealed_at,previous_id)
   values(s.id,s.project_id,s.version,s.dossier->'project'->>'title',n.manifest_hash,n.archive_uri,n.storage_kind,n.chain_id,n.contract_address,n.tx_hash,n.block_number,n.block_hash,n.publisher,now(),s.previous_id);
  insert into public.notifications(user_id,type,title,message,project_id,org_id)
   select o.head_user_id,'project_seal_confirmed','Project sealed on Amoy',p.title||' now has a confirmed public project certificate.',p.id,p.org_id from public.projects p join public.organizations o on o.id=p.org_id where p.id=s.project_id and o.head_user_id is not null;
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,reason,after_data,org_id)
   select null,'eFlow blockchain verifier','project',p.id::text,'project.seal_confirmed','Amoy receipt, archive fingerprint and finality verified.',jsonb_build_object('snapshot_id',s.id,'manifest_hash',s.manifest_hash,'tx_hash',n.tx_hash,'block_number',n.block_number),p.org_id from public.projects p where p.id=s.project_id;
 end if;
 update eflow_seal.snapshots set state=n.state,manifest=n.manifest,manifest_hash=n.manifest_hash,archive_uri=n.archive_uri,storage_kind=n.storage_kind,tx_hash=n.tx_hash,signed_tx=n.signed_tx,nonce=n.nonce,publisher=n.publisher,contract_address=n.contract_address,chain_id=n.chain_id,block_number=n.block_number,block_hash=n.block_hash,confirmed_at=case when n.state='confirmed' then now() else n.confirmed_at end,error=n.error,reverted=n.reverted,lease_owner=null,lease_until=null where id=s.id;
end $$;

create or replace function public.retry_project_seal(p_snapshot_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots;
begin
 select * into s from eflow_seal.snapshots where id=p_snapshot_id for update;
 perform eflow_seal.require_head(s.project_id,auth.uid());
 if s.state<>'failed' then return; end if;
 if s.approved_at is not null then
  insert into public.audit_events(actor_id,actor_name,entity_type,entity_id,action,reason,after_data,org_id)
   select auth.uid(),u.full_name,'project',p.id::text,'project.seal_retry_approved','Head reviewed the saved publication before retrying.',jsonb_build_object('snapshot_id',s.id,'manifest_hash',s.manifest_hash,'previous_approver',s.approved_by),p.org_id from public.projects p join public.profiles u on u.id=auth.uid() where p.id=s.project_id;
 end if;
 update eflow_seal.snapshots set state=case when signed_tx is not null and not reverted then 'broadcast' when approved_at is not null then 'queued' else 'preparing' end,
 approved_by=case when approved_at is not null and archive_uri is null and signed_tx is null then auth.uid() else approved_by end,
 signed_tx=case when reverted then null else signed_tx end,tx_hash=case when reverted then null else tx_hash end,nonce=case when reverted then null else nonce end,
 block_number=case when reverted then null else block_number end,block_hash=case when reverted then null else block_hash end,reverted=false,
 error=null,lease_owner=null,lease_until=null where id=s.id;
end $$;

create or replace function public.seal_wallet_claim(p_worker uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update eflow_seal.wallet_lease set owner=p_worker,until_at=now()+interval '5 minutes' where id and (owner=p_worker or until_at is null or until_at<now())
 and not exists(select 1 from eflow_seal.snapshots pending where signed_tx is not null and state not in('confirmed','cancelled','simulation') and lease_owner is distinct from p_worker);
 return found;
end $$;
create or replace function public.seal_wallet_release(p_worker uuid) returns void
language sql security definer set search_path='' as $$ update eflow_seal.wallet_lease set owner=null,until_at=null where id and owner=p_worker $$;

create or replace function public.seal_snapshot_preview(p_snapshot_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots;
begin
 select * into s from eflow_seal.snapshots where id=p_snapshot_id;
 perform eflow_seal.require_head(s.project_id,auth.uid());
 return to_jsonb(s)-array['signed_tx','lease_owner','lease_until'];
end $$;

create or replace function public.can_upload_project_seal_copy(p_path text) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare s eflow_seal.snapshots;
begin
 if p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}$' or split_part(p_path,'/',2)<>coalesce(auth.uid()::text,'') then return false; end if;
 select * into s from eflow_seal.snapshots where id=split_part(p_path,'/',1)::uuid and state='review_ready' and approved_at is null;
 if not found then return false; end if;
 perform eflow_seal.require_head(s.project_id,auth.uid());return true;
exception when insufficient_privilege or invalid_text_representation then return false;
end $$;
create policy seal_copy_upload on storage.objects for insert to authenticated with check(bucket_id='project-seal-copies' and public.can_upload_project_seal_copy(name));
create policy seal_copy_read on storage.objects for select to authenticated using(bucket_id='project-seal-copies' and public.can_upload_project_seal_copy(name));
create policy seal_copy_guard on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'project-seal-copies' or public.can_upload_project_seal_copy(name))
 with check(bucket_id<>'project-seal-copies' or public.can_upload_project_seal_copy(name));

create or replace function public.seal_replace_preview(p_snapshot_id uuid,p_actor uuid,p_previous_hash text,p_manifest text,p_manifest_hash text) returns void
language plpgsql security definer set search_path='' as $$
declare s eflow_seal.snapshots; m jsonb;
begin
 select * into s from eflow_seal.snapshots where id=p_snapshot_id for update;
 perform eflow_seal.require_head(s.project_id,p_actor);
 if s.state<>'review_ready' or s.approved_at is not null then raise exception 'This record is already approved. The reviewed files cannot change.' using errcode='55000'; end if;
 if s.manifest_hash<>p_previous_hash then raise exception 'The preview changed. Open the latest record before replacing a file.' using errcode='40001'; end if;
 if encode(sha256(convert_to(p_manifest,'UTF8')),'hex')<>p_manifest_hash then raise exception 'The publication copy fingerprint is invalid.'; end if;
 m:=p_manifest::jsonb;
 if m->'records' is distinct from s.dossier or m->>'snapshot_id' is distinct from s.id::text or m->>'source_hash' is distinct from s.source_hash then raise exception 'Publication copies cannot rewrite project records.'; end if;
 update eflow_seal.snapshots set manifest=p_manifest,manifest_hash=p_manifest_hash where id=s.id;
 insert into eflow_seal.preview_edits(snapshot_id,actor_id,previous_hash,next_hash) values(s.id,p_actor,s.manifest_hash,p_manifest_hash);
end $$;

revoke all on all functions in schema eflow_seal from public,anon,authenticated;
revoke all on function public.prepare_project_seal(uuid,text),public.project_seal_status(uuid),public.approve_project_seal(uuid,text),public.discard_project_seal(uuid),public.retry_project_seal(uuid),public.seal_snapshot_preview(uuid),public.seal_worker_claim(uuid),public.seal_worker_save(uuid,uuid,jsonb),public.seal_wallet_claim(uuid),public.seal_wallet_release(uuid) from public,anon,authenticated;
grant execute on function public.prepare_project_seal(uuid,text),public.project_seal_status(uuid),public.approve_project_seal(uuid,text),public.discard_project_seal(uuid),public.retry_project_seal(uuid),public.seal_snapshot_preview(uuid) to authenticated;
grant execute on function public.seal_worker_claim(uuid),public.seal_worker_save(uuid,uuid,jsonb),public.seal_wallet_claim(uuid),public.seal_wallet_release(uuid) to service_role;
revoke all on function public.can_upload_project_seal_copy(text),public.seal_replace_preview(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.can_upload_project_seal_copy(text) to anon,authenticated;
grant execute on function public.seal_replace_preview(uuid,uuid,text,text,text) to service_role;
notify pgrst,'reload schema';
