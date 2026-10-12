begin;

-- Private serialization state only: no work, evidence or historical decisions
-- are backfilled. A real row update makes stale RR/Serializable writers fail.
create table if not exists eflow_r7.completion_locks (
 root_id uuid primary key,
 version bigint not null default 1,
 approval_xid xid8 not null,
 approved_ids uuid[] not null default '{}'
);
alter table eflow_r7.completion_locks enable row level security;
revoke all on eflow_r7.completion_locks from public,anon,authenticated,service_role;

create or replace function eflow_r7.lock_completion(p_root uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_root is null then return;end if;
 insert into eflow_r7.completion_locks(root_id,approval_xid)
 values(p_root,pg_catalog.pg_current_xact_id())
 on conflict(root_id) do update set
  version=eflow_r7.completion_locks.version+1,
  approval_xid=excluded.approval_xid,
  approved_ids=case when eflow_r7.completion_locks.approval_xid=excluded.approval_xid
   then eflow_r7.completion_locks.approved_ids else '{}'::uuid[] end;
end $$;

create or replace function eflow_r7.require_completed_descendants(p_root uuid,p_target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare personal boolean;bad record;
begin
 personal:=exists(select 1 from public.personal_tasks where id=p_root);
 with recursive required as (
  select n.* from eflow_r7.nodes n where n.task_id=p_root and
   (p_target=p_root or n.parent_subtask_id=p_target)
  union
  select c.* from eflow_r7.nodes c join required p on c.parent_subtask_id=p.id where c.task_id=p_root
 )
 select n.id,n.title into bad from required n
 left join public.subtasks s on s.id=n.id and not personal
 where n.status is distinct from 'completed' or not personal and (
  not coalesce(s.is_completed,false) or
  -- Legacy completed rows without an attempt remain valid. An existing formal
  -- binding must still identify its own approved attempt, never pending/rejected.
  s.latest_submission_id is not null and not exists(
   select 1 from public.subtask_submissions a where a.id=s.latest_submission_id
    and a.subtask_id=s.id and a.task_id=p_root and a.status='approved'))
 order by n.id limit 1;
 if found then
  raise exception 'Complete and review every descendant first: resolve descendant "%" (%) before approval.',bad.title,bad.id
   using errcode='23514',hint='Resolve or reapprove this descendant, reload the current work tree, then retry approval.';
 end if;
end $$;

create or replace function eflow_r7.lock_completion_write()
returns trigger language plpgsql security definer set search_path='' as $$
declare r uuid;v_id uuid;approved boolean:=false;
begin
 if tg_table_name in ('tasks','personal_tasks') then r:=case when tg_op='DELETE' then old.id else new.id end;
 else r:=case when tg_op='DELETE' then old.task_id else new.task_id end;end if;
 perform eflow_r7.lock_completion(r);
 if tg_op<>'DELETE' and tg_table_name in ('tasks','subtasks','personal_tasks','personal_subtasks') then
  approved:=(tg_op='INSERT' or new.status is distinct from old.status) and new.status=case when tg_table_name='personal_tasks' then 'done' else 'completed' end;
  if approved then v_id:=new.id;end if;
 end if;
 if approved then
  update eflow_r7.completion_locks set approved_ids=array_append(approved_ids,v_id)
  where root_id=r and not(v_id=any(approved_ids));
  -- Give an actionable error before the unchanged legacy parent guard; the
  -- deferred check below still enforces the final state at commit.
  perform eflow_r7.require_completed_descendants(r,v_id);
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

create or replace function eflow_r7.check_completion_commit()
returns trigger language plpgsql security definer set search_path='' as $$
declare r uuid;target uuid;is_root boolean;personal boolean;
begin
 if tg_table_name in ('tasks','personal_tasks') then r:=case when tg_op='DELETE' then old.id else new.id end;
 else r:=case when tg_op='DELETE' then old.task_id else new.task_id end;end if;
 -- The BEFORE writer/entry-point lock remains held through this deferred check
 -- and commit. Later writes in this transaction also schedule this check, even
 -- when the caller switches constraints to IMMEDIATE. Historical approvals
 -- from another transaction are intentionally not re-decided or revoked.
 for target in select unnest(approved_ids) from eflow_r7.completion_locks
  where root_id=r and approval_xid=pg_catalog.pg_current_xact_id() loop
  personal:=exists(select 1 from public.personal_tasks where id=r);
  is_root:=target=r;
  if personal then
   if is_root then
    if not exists(select 1 from public.personal_tasks where id=target and status='done') then continue;end if;
   elsif not exists(select 1 from public.personal_subtasks where id=target and status='completed') then continue;
   end if;
  else
   if is_root then
    if not exists(select 1 from public.tasks where id=target and status='completed') then continue;end if;
   elsif not exists(select 1 from public.subtasks where id=target and status='completed') then continue;
   end if;
  end if;
  perform eflow_r7.require_completed_descendants(r,target);
 end loop;
 return null;
end $$;

-- Cover insertion/deletion/reparenting as well as status and formal attempt
-- changes. RLS, existing BEFORE guards and review-time locks remain installed.
do $$ declare t text;begin
 foreach t in array array['tasks','subtasks','personal_tasks','personal_subtasks','subtask_submissions'] loop
  execute format('drop trigger if exists nw42_completion_lock on public.%I',t);
  execute format('create trigger nw42_completion_lock before insert or update or delete on public.%I for each row execute function eflow_r7.lock_completion_write()',t);
  execute format('drop trigger if exists nw42_completion_commit on public.%I',t);
  execute format('create constraint trigger nw42_completion_commit after insert or update or delete on public.%I deferrable initially deferred for each row execute function eflow_r7.check_completion_commit()',t);
  -- A trusted repair may bypass historical workflow triggers using replica
  -- mode; this final consistency invariant must still participate in its lock.
  execute format('alter table public.%I enable always trigger nw42_completion_lock',t);
  execute format('alter table public.%I enable always trigger nw42_completion_commit',t);
 end loop;
end $$;

-- Acquire the common lock before the existing RPC row locks. Preserve the
-- entire effective definition, signature, ACL and original authority checks.
do $$ declare sig text;d text;call text;anchor text;marker text:='/* NW4.2 completion serialization */';begin
 foreach sig in array array[
  'public.decide_task_review(uuid,boolean,text,text)',
  'public.submit_task_for_review(uuid,jsonb)',
  'public.decide_subtask_review(uuid,boolean,text)',
  'public.submit_subtask_for_review(uuid,jsonb)',
  'public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)',
  'eflow_r7.command(uuid,integer,uuid,text,jsonb)'] loop
  d:=pg_catalog.pg_get_functiondef(sig::regprocedure);
  if strpos(d,marker)>0 then continue;end if;
  call:=case when sig like 'eflow_r7.command%' then 'p_root'
   when sig like 'public.%subtask%' then '(select task_id from public.subtasks where id=p_subtask_id)'
   else 'p_task_id' end;
  if d!~* '\mbegin\M' then raise exception 'Expected PL/pgSQL entry point: %',sig;end if;
  if sig like 'eflow_r7.command%' then
   -- Keep its project-before-root order, shared by access/appointment changes.
   anchor:='perform 1 from public.tasks where id=p_root for update;';
   if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'Expected command root lock: %',sig;end if;
   d:=replace(d,anchor,marker||' perform eflow_r7.lock_completion(p_root); '||anchor);
  else
   d:=regexp_replace(d,'\mbegin\M','begin '||marker||' perform eflow_r7.lock_completion('||call||');','i');
  end if;
  execute d;
 end loop;
end $$;
revoke all on function eflow_r7.lock_completion(uuid),eflow_r7.lock_completion_write(),eflow_r7.check_completion_commit(),eflow_r7.require_completed_descendants(uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
