-- R7 additive project rosters and bounded nested work; depends on R3/R6/6.5.
begin;
set local lock_timeout='10s';
create schema eflow_r7;
alter table public.notifications add column work_node_id uuid;
revoke all on schema eflow_r7 from public,anon,authenticated;
grant usage on schema eflow_r7 to authenticated;

alter table public.project_office_members add column engagement text not null default 'Permanent',
 add column access_end timestamptz, add column until_close boolean not null default false, add column access_ended_at timestamptz;
alter table public.personal_project_members add column engagement text not null default 'Permanent',
 add column access_end timestamptz, add column until_close boolean not null default false, add column access_ended_at timestamptz;
alter table public.project_office_members add constraint r7_office_terms check(engagement in ('Permanent','Job Order','OJT','Consultant','Other') and (engagement='Permanent' or access_end is not null or until_close));
alter table public.personal_project_members add constraint r7_personal_terms check(engagement in ('Permanent','Job Order','OJT','Consultant','Other') and (engagement='Permanent' or access_end is not null or until_close));
create table eflow_r7.backfill_exceptions(project_id uuid,user_id uuid,reason text,primary key(project_id,user_id));
-- Every currently staffed identity stays recorded; no affiliation is rewritten.
with staffed as (
 select t.linked_project_id project_id,t.org_id,unnest(array_remove(array[coalesce(t.assigned_to,t.recommendation_lead_id)]||coalesce(t.team_member_ids,'{}'::uuid[]),null)) user_id from public.tasks t where t.deleted_at is null
 union select t.linked_project_id,t.org_id,unnest(array_remove(array[s.assigned_to]||coalesce(s.assigned_to_ids,'{}'::uuid[]),null)) from public.subtasks s join public.tasks t on t.id=s.task_id
 union select m.project_id,p.org_id,m.user_id from public.project_members m join public.profiles p on p.id=m.user_id
)
insert into public.project_office_members(project_office_id,user_id,selected_by)
 select distinct o.id,s.user_id,s.user_id from staffed s join public.project_offices o on o.project_id=s.project_id and o.office_id=s.org_id
 join public.profiles p on p.id=s.user_id and p.org_id=o.office_id on conflict do nothing;
with staffed as (
 select t.linked_project_id project_id,t.org_id,unnest(array_remove(array[coalesce(t.assigned_to,t.recommendation_lead_id)]||coalesce(t.team_member_ids,'{}'::uuid[]),null)) user_id from public.tasks t where t.deleted_at is null
 union select t.linked_project_id,t.org_id,unnest(array_remove(array[s.assigned_to]||coalesce(s.assigned_to_ids,'{}'::uuid[]),null)) from public.subtasks s join public.tasks t on t.id=s.task_id
)
insert into eflow_r7.backfill_exceptions select distinct s.project_id,s.user_id,'No matching participating Office/affiliation; historical staffing retained' from staffed s
 where s.project_id is not null and not exists(select 1 from public.project_offices o join public.profiles p on p.id=s.user_id and p.org_id=o.office_id where o.project_id=s.project_id and o.office_id=s.org_id);

alter table public.subtasks add column parent_subtask_id uuid references public.subtasks(id),
 add column lead_id uuid references public.profiles(id) on delete set null,
 add column sibling_order integer not null default 0 check(sibling_order>=0);
update public.subtasks set sibling_order=position;
create index r7_subtask_parent on public.subtasks(task_id,parent_subtask_id,sibling_order,id);
create table public.personal_subtasks (
 id uuid primary key default extensions.gen_random_uuid(),task_id uuid not null references public.personal_tasks(id),
 parent_subtask_id uuid references public.personal_subtasks(id),lead_id uuid references public.profiles(id) on delete set null,
 title text not null check(length(btrim(title)) between 1 and 200),assigned_to_ids uuid[] not null default '{}',
 sibling_order integer not null default 0 check(sibling_order>=0),due_date date,is_standalone boolean not null default false,
 status text not null default 'todo' check(status in ('todo','in_progress','for_review','changes_requested','completed')),
 percent_complete integer not null default 0 check(percent_complete between 0 and 100),note text not null default '' check(length(note)<=4000),
 reviewer_id uuid,submitted_by uuid,created_at timestamptz not null default now()
);
create index r7_personal_parent on public.personal_subtasks(task_id,parent_subtask_id,sibling_order,id);
alter table public.personal_subtasks enable row level security;
revoke all on public.personal_subtasks from public,anon,authenticated;
grant select on public.personal_subtasks to authenticated;
create table eflow_r7.tree_state(root_id uuid primary key,revision integer not null default 1);
create table eflow_r7.receipts(actor_id uuid,request_id uuid,root_id uuid,payload jsonb,result jsonb,primary key(actor_id,request_id));
-- A private transaction marker cannot be forged with a client-set GUC.
create table eflow_r7.mutations(tx bigint,actor uuid,root_id uuid,primary key(tx,actor,root_id));
create table public.work_tree_events(id uuid primary key default extensions.gen_random_uuid(),root_id uuid not null,project_id uuid not null,
 actor_id uuid not null,actor_name text not null,command text not null,node_id uuid,before_data jsonb,after_data jsonb,occurred_at timestamptz not null default now());
create index r7_events_root on public.work_tree_events(root_id,occurred_at,id);
alter table public.work_tree_events enable row level security;
revoke all on public.work_tree_events from public,anon,authenticated;
grant select on public.work_tree_events to authenticated;
alter table eflow_r7.backfill_exceptions enable row level security;
alter table eflow_r7.tree_state enable row level security;
alter table eflow_r7.receipts enable row level security;
alter table eflow_r7.mutations enable row level security;
revoke all on all tables in schema eflow_r7 from public,anon,authenticated;

create view eflow_r7.nodes as
 select id,task_id,parent_subtask_id,lead_id,title,assigned_to_ids,sibling_order,due_date,is_standalone,status,percent_complete,created_at,'office'::text kind from public.subtasks
 union all select id,task_id,parent_subtask_id,lead_id,title,assigned_to_ids,sibling_order,due_date,is_standalone,status,percent_complete,created_at,'personal'::text from public.personal_subtasks;
revoke all on eflow_r7.nodes from public,anon,authenticated;
create function eflow_r7.member(p_project uuid,p_office uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(p_user) and (
 exists(select 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id join public.profiles u on u.id=m.user_id and u.org_id=o.office_id
 join public.projects p on p.id=o.project_id where p.id=p_project and o.office_id=p_office and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating')
 and m.user_id=p_user and m.access_ended_at is null and (m.access_end is null or m.access_end>now()) and (m.engagement='Permanent' or p.status not in ('completed','archived')))
 or p_office is null and eflow_r3.valid_member(p_project,p_user) and not exists(select 1 from public.personal_project_members m join public.personal_projects p on p.id=m.project_id where m.project_id=p_project and m.user_id=p_user
 and (m.access_ended_at is not null or m.access_end<=now() or m.engagement<>'Permanent' and p.status<>'active')))
$$;
create function eflow_r7.root(p_root uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('id',t.id,'project',t.linked_project_id,'office',t.org_id,'lead',coalesce(t.assigned_to,t.recommendation_lead_id),'kind','office','status',t.status,
 'open',t.deleted_at is null and t.archived_at is null and t.proposed_office_identity_id is null and t.status not in ('for_review','completed','cancelled') and p.status not in ('completed','archived'),'people',coalesce(t.team_member_ids,'{}'::uuid[]),'due',coalesce(nullif(left(t.due_date,10),''),nullif(left(t.deadline,10),'')))
 from public.tasks t join public.projects p on p.id=t.linked_project_id where t.id=p_root and t.source_collaboration_draft_id is null and p.source_collaboration_draft_id is null),
 (select jsonb_build_object('id',t.id,'project',t.project_id,'office',null,'lead',t.lead_id,'kind','personal','status',t.status,'open',p.status='active' and t.status not in ('submitted','done'),'owner',w.owner_id,'people',array[t.lead_id],'due',null)
 from public.personal_tasks t join public.personal_projects p on p.id=t.project_id join public.workspaces w on w.id=p.workspace_id where t.id=p_root))
$$;
create function eflow_r7.reader() returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) or exists(select 1 from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid() and p.role='admin' and p.is_active and u.email_confirmed_at is not null)
$$;
create function eflow_r7.read_root(p_root uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r7.reader() and coalesce(
 (select case when r->>'kind'='office' then public.can_see_task(p_root,auth.uid()) else eflow_r3.project_access((r->>'project')::uuid) end from (select eflow_r7.root(p_root) r) x),false)
$$;
create policy r7_personal_read on public.personal_subtasks for select to authenticated using(eflow_r7.read_root(task_id));
create policy r7_events_read on public.work_tree_events for select to authenticated using(eflow_r7.read_root(root_id));
create function eflow_r7.head(p_root uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and case when r->>'kind'='office' then eflow_phase6.head((r->>'project')::uuid,(r->>'office')::uuid,auth.uid()) else (r->>'owner')::uuid=auth.uid() end from (select eflow_r7.root(p_root) r) x
$$;
create function eflow_r7.chain(p_root uuid,p_node uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);n record;v_id uuid:=p_node;v_seen uuid[]:='{}';begin
 if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,(r->>'lead')::uuid) then return false;end if;
 while v_id is not null loop
  select * into n from eflow_r7.nodes where id=v_id and task_id=p_root;
  if not found or v_id=any(v_seen) or cardinality(v_seen)>=8 then return false;end if;
  v_seen:=v_seen||v_id;
  if n.lead_id is null or not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,n.lead_id) then return false;end if;
  v_id:=n.parent_subtask_id;
 end loop;return true;
end $$;
-- Parent management: callers may organize below their appointment, never above it.
create function eflow_r7.manage(p_root uuid,p_node uuid,p_replace_lead boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);n record;v_id uuid:=p_node;begin
 if not eflow_r7.read_root(p_root) or not coalesce((r->>'open')::boolean,false) then return false;end if;
 if eflow_r7.head(p_root) then return true;end if;
 if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,auth.uid()) then return false;end if;
 if (r->>'lead')::uuid=auth.uid() then return true;end if;
 if p_replace_lead and v_id is not null then select parent_subtask_id into v_id from eflow_r7.nodes where id=v_id and task_id=p_root;end if;
 if v_id is null or not eflow_r7.chain(p_root,v_id) then return false;end if;
 while v_id is not null loop
  select * into n from eflow_r7.nodes where id=v_id and task_id=p_root;
  if n.lead_id=auth.uid() then return true;end if;v_id:=n.parent_subtask_id;
 end loop;return false;
end $$;
create function eflow_r7.internal(p_root uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=p_root)
$$;
create function eflow_r7.reviewer(p_node uuid,p_submitter uuid) returns uuid language plpgsql stable security definer set search_path='' as $$
declare n record;r jsonb;v_id uuid;v_candidate uuid;begin
 select * into n from eflow_r7.nodes where id=p_node;if not found then return null;end if;
 r:=eflow_r7.root(n.task_id);v_id:=n.parent_subtask_id;
 if r is null then select public.resolve_subtask_reviewer(t,p_submitter) into v_candidate from public.tasks t where t.id=n.task_id;return v_candidate;end if;
 while v_id is not null loop
  select * into n from eflow_r7.nodes where id=v_id;
  if n.lead_id is distinct from p_submitter and eflow_r7.chain(n.task_id,n.id) then return n.lead_id;end if;v_id:=n.parent_subtask_id;
 end loop;
 v_candidate:=(r->>'lead')::uuid;
 if v_candidate is distinct from p_submitter and eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_candidate) then return v_candidate;end if;
 if r->>'kind'='office' then select o.head_user_id into v_candidate from public.organizations o where o.id=(r->>'office')::uuid;
 else v_candidate:=(r->>'owner')::uuid;end if;
 if v_candidate is distinct from p_submitter and eflow_r3.eligible(v_candidate) and (r->>'kind'='personal' or public.phase2_is_office_head(v_candidate,(r->>'office')::uuid)) then return v_candidate;end if;return null;
end $$;

-- New assignments require the selected roster, including the former lead exception.
create or replace function eflow_phase6.work(p_task uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.tasks t where t.id=p_task and t.deleted_at is null and eflow_r3.eligible(p_user) and (
 eflow_phase6.head(t.linked_project_id,t.org_id,p_user) or eflow_r7.member(t.linked_project_id,t.org_id,p_user)
 and (coalesce(t.assigned_to,t.recommendation_lead_id)=p_user or p_user=any(coalesce(t.team_member_ids,'{}'::uuid[])))))
$$;
create function eflow_r7.guard_root() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid;v_internal boolean;begin
 if tg_table_name='tasks' then
  if new.linked_project_id is null or new.source_collaboration_draft_id is not null then return new;end if;
  if tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to or new.recommendation_lead_id is distinct from old.recommendation_lead_id or new.team_member_ids is distinct from old.team_member_ids then
   if auth.uid() is not null and (tg_op='INSERT' or new.assigned_to is distinct from old.assigned_to or new.recommendation_lead_id is distinct from old.recommendation_lead_id or not eflow_r7.internal(new.id)) and not eflow_phase6.head(new.linked_project_id,new.org_id,auth.uid()) then raise exception 'Only the appointed responsible Head transfers the root lead; contributors use the narrow operation' using errcode='42501';end if;
   foreach uid in array array_remove(array[coalesce(new.assigned_to,new.recommendation_lead_id)]||coalesce(new.team_member_ids,'{}'::uuid[]),null) loop
    if not eflow_r7.member(new.linked_project_id,new.org_id,uid) then raise exception 'Select an active selected project member' using errcode='42501';end if;
   end loop;
  end if;
  if tg_op='UPDATE' and coalesce(new.assigned_to,new.recommendation_lead_id) is distinct from coalesce(old.assigned_to,old.recommendation_lead_id) then
   v_internal:=eflow_r7.internal(new.id);
   insert into eflow_r7.mutations values(txid_current(),auth.uid(),new.id) on conflict do nothing;
   update public.subtasks set lead_id=null where task_id=new.id and lead_id is not null;
   if not v_internal then delete from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=new.id;end if;
  end if;
 else
  if tg_op='UPDATE' and new.lead_id is distinct from old.lead_id then
   v_internal:=eflow_r7.internal(new.id);insert into eflow_r7.mutations values(txid_current(),auth.uid(),new.id) on conflict do nothing;
   update public.personal_subtasks set lead_id=null where task_id=new.id;
   if not v_internal then delete from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=new.id;end if;
  end if;
  if new.status in ('submitted','done') and exists(select 1 from public.personal_subtasks where task_id=new.id and status<>'completed') then raise exception 'Complete and review every descendant before completing the root';end if;
 end if;return new;
end $$;
create trigger r7_root_staffing before insert or update on public.tasks for each row execute function eflow_r7.guard_root();
create trigger r7_personal_root before update on public.personal_tasks for each row execute function eflow_r7.guard_root();

create function eflow_r7.guard_node() returns trigger language plpgsql security definer set search_path='' as $$
declare n record;r jsonb;v_root uuid;v_parent uuid;v_depth int:=1;v_seen uuid[];v_due date;v_uid uuid;begin
 v_root:=case when tg_op='DELETE' then old.task_id else new.task_id end;r:=eflow_r7.root(v_root);
 if r is null or tg_table_name='subtasks' and exists(select 1 from public.tasks where id=v_root and proposed_office_identity_id is not null) then
  if tg_op<>'DELETE' and (new.parent_subtask_id is not null or new.lead_id is not null) then raise exception 'Nested delegation requires a project root';end if;
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if auth.uid() is not null and not eflow_r7.read_root(v_root) then raise exception 'Current work access required' using errcode='42501';end if;
 if tg_op='DELETE' then
  if auth.uid() is not null and not eflow_r7.internal(v_root) and not eflow_r7.manage(v_root,null) then raise exception 'Work deletion denied' using errcode='42501';end if;
  if exists(select 1 from eflow_r7.nodes where parent_subtask_id=old.id) then raise exception 'Delete the reviewed subtree through the nested work action';end if;
  if old.status<>'todo' or old.percent_complete<>0 then raise exception 'Started work and history cannot be deleted';end if;
  if tg_table_name='subtasks' and (exists(select 1 from public.subtask_progress_updates where subtask_id=old.id) or exists(select 1 from public.subtask_submissions where subtask_id=old.id)
   or exists(select 1 from public.work_budget_allocations where subtask_id=old.id) or exists(select 1 from public.petty_cash_requests where subtask_id=old.id) or exists(select 1 from public.budget_ledger_entries where subtask_id=old.id)) then raise exception 'Evidence, progress, budget and cash history prevent deletion';end if;return old;
 end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.task_id is distinct from old.task_id) then raise exception 'Work identity is immutable' using errcode='42501';end if;
 if auth.uid() is not null and not eflow_r7.internal(v_root) and (
  tg_op='INSERT' and (new.parent_subtask_id is not null or new.lead_id is not null)
  or tg_op='UPDATE' and (new.parent_subtask_id is distinct from old.parent_subtask_id or new.lead_id is distinct from old.lead_id or new.sibling_order is distinct from old.sibling_order)
 ) then raise exception 'Use the versioned nested work operation' using errcode='42501';end if;
 if tg_op='INSERT' and new.parent_subtask_id is null and tg_table_name='subtasks' then new.sibling_order:=new.position;end if;
 v_parent:=new.parent_subtask_id;v_seen:=array[new.id];
 if r->>'due' ~ '^\d{4}-\d{2}-\d{2}$' then v_due:=(r->>'due')::date;end if;
 while v_parent is not null loop
  select * into n from eflow_r7.nodes where id=v_parent and task_id=v_root;
  if not found or v_parent=any(v_seen) then raise exception 'Same root required; self-parent and cycles are forbidden';end if;
  v_seen:=v_seen||v_parent;v_depth:=v_depth+1;
  if v_depth>8 then raise exception 'Maximum subitem depth is 8';end if;
  if n.due_date is not null then v_due:=least(v_due,n.due_date);end if;v_parent:=n.parent_subtask_id;
 end loop;
 if new.due_date is null and tg_op='INSERT' then new.due_date:=v_due;end if;
 if v_due is not null and new.due_date>v_due then raise exception 'Child deadline cannot exceed an ancestor deadline';end if;
 if tg_op='INSERT' or new.assigned_to_ids is distinct from old.assigned_to_ids or new.lead_id is not null and new.lead_id is distinct from old.lead_id then
  foreach v_uid in array array_remove(array[new.lead_id]||coalesce(new.assigned_to_ids,'{}'::uuid[]),null) loop
   if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose active selected people from this project and responsible Office' using errcode='42501';end if;
  end loop;
 end if;
 if tg_op='UPDATE' and not eflow_r7.internal(v_root) and new.parent_subtask_id is not null and (to_jsonb(new)-array['status','percent_complete','is_completed','completed_by','completed_at','reviewer_id','latest_submission_id','updated_at']) is distinct from (to_jsonb(old)-array['status','percent_complete','is_completed','completed_by','completed_at','reviewer_id','latest_submission_id','updated_at']) then raise exception 'Nested planning uses the versioned branch operation' using errcode='42501';end if;
 if auth.uid() is not null and not eflow_r7.internal(v_root) and (tg_op='INSERT' or (to_jsonb(new)-array['status','percent_complete','is_completed','completed_by','completed_at','reviewer_id','latest_submission_id','updated_at']) is distinct from (to_jsonb(old)-array['status','percent_complete','is_completed','completed_by','completed_at','reviewer_id','latest_submission_id','updated_at'])) and not eflow_r7.manage(v_root,null) then raise exception 'Current root lead or Head required for flat planning' using errcode='42501';end if;
 return new;
end $$;
create trigger r7_node_bounds before insert or update or delete on public.subtasks for each row execute function eflow_r7.guard_node();
create trigger r7_personal_bounds before insert or update or delete on public.personal_subtasks for each row execute function eflow_r7.guard_node();

-- Keep legacy signatures/return types; narrowly admit checked R7 structural writes.
do $$ declare d text;n text;begin
 foreach n in array array['guard_subtask_contributor_update','phase6_guard_subtask'] loop
  select pg_get_functiondef(('public.'||n||'()')::regprocedure) into d;
  if strpos(lower(d),'begin')=0 then raise exception 'Review changed subtask trigger';end if;
  d:=overlay(d placing E'begin\n if tg_table_name=''subtasks'' and eflow_r7.internal(case when tg_op=''DELETE'' then old.task_id else new.task_id end) then if tg_op=''DELETE'' then return old;else return new;end if;end if;' from strpos(lower(d),'begin') for 5);
  execute d;
 end loop;
 select pg_get_functiondef('public.phase6_guard_task()'::regprocedure) into d;
 d:=overlay(d placing E'begin\n if tg_op=''UPDATE'' and (to_jsonb(new)-array[''team_member_ids'',''team_member_names'',''updated_at''])=(to_jsonb(old)-array[''team_member_ids'',''team_member_names'',''updated_at'']) and eflow_r7.internal(old.id) then return new;end if;\n if tg_op=''UPDATE'' and pg_trigger_depth()>1 and (to_jsonb(new)-array[''subtask_count'',''subtask_completed_count'',''last_activity_at'',''updated_at''])=(to_jsonb(old)-array[''subtask_count'',''subtask_completed_count'',''last_activity_at'',''updated_at'']) then return new;end if;' from strpos(lower(d),'begin') for 5);
 execute d;
end $$;

-- Counts retain their existing public contract; manual progress is never replaced.
do $$ declare d text;begin
 select pg_get_functiondef('public.refresh_task_subtask_rollup(uuid,boolean)'::regprocedure) into d;
 execute replace(replace(d,'FUNCTION public.refresh_task_subtask_rollup(','FUNCTION eflow_r7.baseline_refresh_task_subtask_rollup('),'SET search_path TO ''public''','SET search_path TO ''''');
end $$;
create or replace function public.refresh_task_subtask_rollup(target_task uuid,touch_activity boolean default true) returns void language plpgsql security definer set search_path='' as $$
begin
 if eflow_r7.root(target_task) is null then perform eflow_r7.baseline_refresh_task_subtask_rollup(target_task,touch_activity);return;end if;
 if auth.uid() is not null and not public.can_see_task(target_task,auth.uid()) then raise exception 'Task unavailable' using errcode='42501';end if;
 update public.tasks set subtask_count=(select count(*) from public.subtasks where task_id=target_task),
 subtask_completed_count=(select count(*) from public.subtasks where task_id=target_task and is_completed),
 last_activity_at=case when touch_activity then now() else last_activity_at end where id=target_task and deleted_at is null;
end $$;

create function eflow_r7.pending_reviewer(p_node uuid) returns uuid language sql stable security definer set search_path='' as $$
 select eflow_r7.reviewer(n.id,case when n.kind='office' then(select s.submitter_id from public.subtask_submissions s join public.subtasks t on t.latest_submission_id=s.id where t.id=n.id) else(select submitted_by from public.personal_subtasks where id=n.id)end) from eflow_r7.nodes n where n.id=p_node
$$;
create function eflow_r7.snapshot(p_root uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=eflow_r7.root(p_root);v_nodes jsonb;v_people jsonb;begin
 if not eflow_r7.read_root(p_root) then raise exception 'Nested work access denied' using errcode='42501';end if;
 with recursive tree as (
  select n.*,1 depth,array[n.sibling_order] path from eflow_r7.nodes n where n.task_id=p_root and n.parent_subtask_id is null
  union all select n.*,t.depth+1,t.path||n.sibling_order from eflow_r7.nodes n join tree t on n.parent_subtask_id=t.id where n.task_id=p_root and t.depth<8
 ) select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('can_manage',eflow_r7.manage(p_root,t.id),'can_appoint',eflow_r7.manage(p_root,t.id,true),'can_order',eflow_r7.manage(p_root,t.parent_subtask_id),'can_work',eflow_r7.node_work(t.id,auth.uid()),'can_review',t.status='for_review' and eflow_r7.pending_reviewer(t.id)=auth.uid(),'current_reviewer',eflow_r7.pending_reviewer(t.id)) order by path,id),'[]'::jsonb) into v_nodes from tree t;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'office',p.org_id,'eligible',eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id)) order by p.full_name,p.id),'[]'::jsonb) into v_people from public.profiles p where eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p.id) or p.id=(r->>'lead')::uuid or coalesce(r->'people','[]') ? p.id::text or exists(select 1 from eflow_r7.nodes n where n.task_id=p_root and (n.lead_id=p.id or p.id=any(n.assigned_to_ids)));
 return jsonb_build_object('root',r,'revision',coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1),'can_manage',eflow_r7.manage(p_root,null),'can_transfer',eflow_r7.head(p_root),'nodes',v_nodes,'people',v_people,
 'leaf_total',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)),
 'leaf_completed',(select count(*) from eflow_r7.nodes n where n.task_id=p_root and n.status='completed' and not exists(select 1 from eflow_r7.nodes c where c.parent_subtask_id=n.id)));
end $$;

create function eflow_r7.node_work(p_node uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(p_user) and eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,p_user)
 and coalesce((r->>'open')::boolean,false) and eflow_r7.chain(n.task_id,n.parent_subtask_id)
 and p_user=any(coalesce(n.assigned_to_ids,'{}'::uuid[])) from eflow_r7.nodes n cross join lateral (select eflow_r7.root(n.task_id) r) x where n.id=p_node
$$;
-- Function body checking is deferred only for the preceding mutual helper reference.

create function eflow_r7.bump() returns trigger language plpgsql security definer set search_path='' as $$
declare v_root uuid;begin
 if tg_table_name in ('tasks','personal_tasks') then v_root:=new.id;else v_root:=case when tg_op='DELETE' then old.task_id else new.task_id end;end if;
 insert into eflow_r7.tree_state(root_id,revision) values(v_root,2) on conflict(root_id) do update set revision=eflow_r7.tree_state.revision+1;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger r7_tree_revision after insert or update or delete on public.subtasks for each row execute function eflow_r7.bump();
create trigger r7_personal_revision after insert or update or delete on public.personal_subtasks for each row execute function eflow_r7.bump();
create trigger r7_root_revision after update of assigned_to,team_member_ids,due_date,deadline,status on public.tasks for each row execute function eflow_r7.bump();
create trigger r7_personal_root_revision after update on public.personal_tasks for each row execute function eflow_r7.bump();

create function eflow_r7.command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;n eflow_r7.nodes;parent eflow_r7.nodes;v_id uuid:=(p_payload->>'id')::uuid;v_parent uuid:=(p_payload->>'parent')::uuid;v_lead uuid:=(p_payload->>'lead')::uuid;
 v_people uuid[];v_order uuid[];v_subtree uuid[];v_uid uuid;v_receipt eflow_r7.receipts;v_before jsonb;v_result jsonb;v_terms jsonb;v_kind text;v_position int;v_due date;begin
 perform eflow_r3.actor();
 if p_request is null then raise exception 'Request identity required';end if;
 r:=eflow_r7.root(p_root);v_kind:=r->>'kind';
 if not eflow_r7.read_root(p_root) then raise exception 'Work access denied' using errcode='42501';end if;
 perform 1 from public.projects where id=(r->>'project')::uuid for update;
 perform 1 from public.personal_projects where id=(r->>'project')::uuid for update;
 perform 1 from public.tasks where id=p_root for update;
 perform 1 from public.personal_tasks where id=p_root for update;
 r:=eflow_r7.root(p_root);
 v_terms:=jsonb_build_object('command',p_command,'payload',p_payload);
 select * into v_receipt from eflow_r7.receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if v_receipt.root_id<>p_root or v_receipt.payload<>v_terms then raise exception 'Request terms conflict';end if;
  return eflow_r7.snapshot(p_root);
 end if;
 if not coalesce((r->>'open')::boolean,false) then raise exception 'Closed or unresolved work is read-only' using errcode='42501';end if;
 if coalesce((select revision from eflow_r7.tree_state where root_id=p_root),1) is distinct from p_revision then raise exception 'Work changed; reload and review the current tree' using errcode='40001';end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('id','parent','lead','people','title','due','standalone','order','note','progress','approve')) then raise exception 'Unsupported branch fields';end if;
 if v_id is not null then select * into n from eflow_r7.nodes where id=v_id and task_id=p_root;end if;
 if p_command<>'create' and p_command not in ('contributors','order','root_lead') and n.id is null then raise exception 'Choose a node in this root';end if;
 if p_command in ('progress','submit','review') then
  if v_kind<>'personal' then raise exception 'Use the existing Office evidence workflow';end if;
  if p_command='review' then
   if n.status<>'for_review' or not coalesce(p_payload->>'approve','') in ('true','false') or auth.uid() is distinct from eflow_r7.reviewer(n.id,(select submitted_by from public.personal_subtasks where id=n.id)) then raise exception 'Current independent reviewer required' using errcode='42501';end if;
  elsif not coalesce(eflow_r7.node_work(n.id,auth.uid()),false) or n.status in ('for_review','completed') then raise exception 'Current assigned worker required' using errcode='42501';end if;
 elsif p_command='create' then
  if not coalesce(eflow_r7.manage(p_root,v_parent),false) then raise exception 'Only a current lead may add work below their branch' using errcode='42501';end if;
 elsif p_command='order' then
  if not coalesce(eflow_r7.manage(p_root,v_parent),false) then raise exception 'Sibling ordering denied' using errcode='42501';end if;
 elsif p_command='root_lead' then
  if not coalesce(eflow_r7.head(p_root),false) then raise exception 'Only its responsible Head or personal owner transfers the root' using errcode='42501';end if;
 else
  if not coalesce(eflow_r7.manage(p_root,v_id,p_command='staff' and v_lead is distinct from n.lead_id),false) then raise exception 'Branch staffing denied; ancestors and siblings are protected' using errcode='42501';end if;
 end if;
 if p_command not in ('progress','submit','review','contributors','staff') and n.id is not null and (n.status<>'todo' or n.percent_complete<>0) then raise exception 'Planning changes require untouched work';end if;
 v_before:=eflow_r7.snapshot(p_root);
 insert into eflow_r7.mutations values(txid_current(),auth.uid(),p_root);
 if p_command='root_lead' then
  if v_id is not null or v_lead is null or not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_lead) then raise exception 'Choose an eligible selected root lead';end if;
  if v_kind='office' then
   select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove((select team_member_ids from public.tasks where id=p_root)||array[v_lead],null))));
   if cardinality(v_people)>200 or not(v_people @> array[v_lead]) then raise exception 'Include the root lead in contributors';end if;
   update public.tasks set assigned_to=v_lead,assignee_name=(select full_name from public.profiles where id=v_lead),team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
  else update public.personal_tasks set lead_id=v_lead,revision=revision+1 where id=p_root;end if;
 elsif p_command='contributors' then
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_kind<>'office' or v_id is not null or not coalesce(eflow_r7.manage(p_root,null),false) then raise exception 'Root contributor operation denied' using errcode='42501';end if;
  if not (v_people @> array[(r->>'lead')::uuid]) then raise exception 'Root lead must remain; transfer uses its responsible Head';end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose selected project people';end if;end loop;
  update public.tasks set team_member_ids=v_people,team_member_names=array(select full_name from public.profiles where id=any(v_people) order by array_position(v_people,id)) where id=p_root;
 elsif p_command='create' then
  if v_parent is not null and exists(select 1 from eflow_r7.nodes where id=v_parent and (status<>'todo' or percent_complete<>0)) then raise exception 'Add children before starting the parent';end if;
  if v_id is null or exists(select 1 from eflow_r7.nodes where id=v_id) or exists(select 1 from public.tasks where id=v_id) or exists(select 1 from public.personal_tasks where id=v_id) then raise exception 'New disjoint node identity required';end if;
  if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a subitem title';end if;
  select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people',to_jsonb(array_remove(array[v_lead],null))));
  if v_lead is not null and not(v_people @> array[v_lead]) or cardinality(v_people)>200 then raise exception 'Include the appointed lead in contributors';end if;
  if v_kind='office' then
   insert into public.subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to,assigned_to_ids,sibling_order,position,created_by,due_date,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_lead,v_people,v_position,(select coalesce(max(position),-1)+1 from public.subtasks where task_id=p_root),auth.uid(),(p_payload->>'due')::date,coalesce((p_payload->>'standalone')::boolean,false));
  else
   insert into public.personal_subtasks(id,task_id,parent_subtask_id,title,lead_id,assigned_to_ids,sibling_order,due_date,is_standalone)
   values(v_id,p_root,v_parent,btrim(p_payload->>'title'),v_lead,v_people,v_position,(p_payload->>'due')::date,coalesce((p_payload->>'standalone')::boolean,false));
  end if;
 elsif p_command='staff' then
  if n.status='completed' then raise exception 'Completed responsibility is historical';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into v_people from jsonb_array_elements_text(coalesce(p_payload->'people','[]'));
  if cardinality(v_people)>200 or v_lead is null or not(v_people @> array[v_lead]) then raise exception 'Choose a lead and include them among contributors';end if;
  foreach v_uid in array v_people loop if not eflow_r7.member((r->>'project')::uuid,(r->>'office')::uuid,v_uid) then raise exception 'Choose eligible project people';end if;end loop;
  with recursive below as (select id from eflow_r7.nodes where parent_subtask_id=v_id union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select coalesce(array_agg(id),'{}') into v_subtree from below;
  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.status<>'completed' and not(c.assigned_to_ids <@ v_people)) then raise exception 'Reassign unfinished descendant workers before removing a branch contributor';end if;
  if v_kind='office' then
   update public.subtasks set lead_id=v_lead,assigned_to=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.subtasks set lead_id=null where id=any(v_subtree);end if;
  else
   update public.personal_subtasks set lead_id=v_lead,assigned_to_ids=v_people where id=v_id;
   if n.lead_id is distinct from v_lead then update public.personal_subtasks set lead_id=null where id=any(v_subtree);end if;
  end if;
 elsif p_command in ('edit','move','delete') then
  with recursive below as (select * from eflow_r7.nodes where id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
   select array_agg(id) into v_subtree from below;
  if exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and (c.status<>'todo' or c.percent_complete<>0)) then raise exception 'The entire subtree must be untouched';end if;
  if p_command='move' then
   if not coalesce(eflow_r7.manage(p_root,v_parent),false) or v_parent=any(v_subtree) then raise exception 'Destination branch denied or cycle';end if;
   select * into parent from eflow_r7.nodes where id=v_parent and task_id=p_root;
   if v_parent is not null and parent.id is null then raise exception 'Destination must share the root';end if;
   select coalesce(max(sibling_order),-1)+1 into v_position from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent;
   if v_kind='office' then update public.subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;else update public.personal_subtasks set parent_subtask_id=v_parent,sibling_order=v_position where id=v_id;end if;
   -- Revalidate every descendant after the parent move, including depth overflow.
   if v_kind='office' then update public.subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;else update public.personal_subtasks set parent_subtask_id=parent_subtask_id,lead_id=null where id=any(v_subtree) and id<>v_id;end if;
  elsif p_command='edit' then
   v_due:=(p_payload->>'due')::date;
   if v_due is not null and exists(select 1 from eflow_r7.nodes c where c.id=any(v_subtree) and c.id<>v_id and c.due_date>v_due) then raise exception 'Edit descendant dates before shortening this deadline';end if;
   if length(btrim(p_payload->>'title')) not between 1 and 200 then raise exception 'Enter a title';end if;
   perform set_config('eflow.subtask_deadline_authorized','on',true);
   if v_kind='office' then update public.subtasks set title=btrim(p_payload->>'title'),due_date=v_due,due_date_change_reason=coalesce(p_payload->>'note','Nested work planning'),due_date_changed_at=now(),due_date_changed_by=auth.uid(),is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;
   else update public.personal_subtasks set title=btrim(p_payload->>'title'),due_date=v_due,is_standalone=coalesce((p_payload->>'standalone')::boolean,is_standalone) where id=v_id;end if;
   perform set_config('eflow.subtask_deadline_authorized','off',true);
  else
   if v_kind='office' and (exists(select 1 from public.subtask_progress_updates where subtask_id=any(v_subtree)) or exists(select 1 from public.subtask_submissions where subtask_id=any(v_subtree))
    or exists(select 1 from public.work_budget_allocations where subtask_id=any(v_subtree)) or exists(select 1 from public.petty_cash_requests where subtask_id=any(v_subtree))
    or exists(select 1 from public.budget_ledger_entries where subtask_id=any(v_subtree))) then raise exception 'Evidence, budget and cash history prohibit subtree deletion';end if;
   -- Children first: no CASCADE can erase evidence or financial identities.
   loop
    select id into v_uid from eflow_r7.nodes c where c.id=any(v_subtree) and not exists(select 1 from eflow_r7.nodes d where d.parent_subtask_id=c.id) limit 1;
    exit when v_uid is null;
    if v_kind='office' then delete from public.subtasks where id=v_uid;else delete from public.personal_subtasks where id=v_uid;end if;
   end loop;
  end if;
 elsif p_command='order' then
  select coalesce(array_agg(value::uuid),'{}') into v_order from jsonb_array_elements_text(coalesce(p_payload->'order','[]'));
  if (select count(*) from eflow_r7.nodes where task_id=p_root and parent_subtask_id is not distinct from v_parent)<>cardinality(v_order)
   or (select count(distinct u) from unnest(v_order) u)<>cardinality(v_order) or exists(select 1 from unnest(v_order) u where not exists(select 1 from eflow_r7.nodes c where c.id=u and c.task_id=p_root and c.parent_subtask_id is not distinct from v_parent and c.status='todo' and c.percent_complete=0)) then raise exception 'Order must contain every untouched sibling exactly once';end if;
  if v_kind='office' then update public.subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);else update public.personal_subtasks set sibling_order=array_position(v_order,id)-1 where id=any(v_order);end if;
 elsif p_command in ('progress','submit','review') then
  if p_command<>'review' and not n.is_standalone and exists(select 1 from eflow_r7.nodes c where c.task_id=p_root and c.parent_subtask_id is not distinct from n.parent_subtask_id and c.sibling_order<n.sibling_order and not c.is_standalone and c.status<>'completed') then raise exception 'Complete earlier ordered siblings first';end if;
  if p_command in ('submit','review') and exists(with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_id union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select 1 from below where status<>'completed') then raise exception 'Complete and review every descendant first';end if;
  if p_command='progress' then
   if (p_payload->>'progress')::int not between 0 and 99 then raise exception 'Progress must be 0–99; submit at completion';end if;
   update public.personal_subtasks set percent_complete=(p_payload->>'progress')::int,status='in_progress',note=coalesce(p_payload->>'note','') where id=v_id;
  elsif p_command='submit' then
   v_lead:=eflow_r7.reviewer(v_id,auth.uid());if v_lead is null then raise exception 'An independent ancestor lead or owner is required';end if;
   update public.personal_subtasks set status='for_review',percent_complete=100,note=coalesce(p_payload->>'note',''),submitted_by=auth.uid(),reviewer_id=v_lead where id=v_id;
  else
   if not (p_payload->>'approve')::boolean and btrim(coalesce(p_payload->>'note',''))='' then raise exception 'Feedback required';end if;
   update public.personal_subtasks set status=case when (p_payload->>'approve')::boolean then 'completed' else 'changes_requested' end,percent_complete=case when (p_payload->>'approve')::boolean then 100 else 99 end,note=coalesce(p_payload->>'note','') where id=v_id;
  end if;
 else raise exception 'Unsupported work command';end if;
 if v_kind='office' and p_command not in ('contributors','progress','submit','review') then
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique deferred;end if;
  with recursive ordered as (
   select id,array[lpad(sibling_order::text,10,'0')||id::text] path from public.subtasks where task_id=p_root and parent_subtask_id is null
   union all select c.id,p.path||(lpad(c.sibling_order::text,10,'0')||c.id::text) from public.subtasks c join ordered p on c.parent_subtask_id=p.id where c.task_id=p_root
  ), ranked as (select id,row_number() over(order by path)-1 rank from ordered)
  update public.subtasks s set position=r.rank from ranked r where s.id=r.id and s.position<>r.rank;
  if exists(select 1 from pg_constraint where conrelid='public.subtasks'::regclass and conname='subtasks_task_position_unique') then set constraints public.subtasks_task_position_unique immediate;end if;
 end if;
 delete from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=p_root;
 v_result:=eflow_r7.snapshot(p_root);
 insert into public.work_tree_events(root_id,project_id,actor_id,actor_name,command,node_id,before_data,after_data) values(p_root,(r->>'project')::uuid,auth.uid(),(select full_name from public.profiles where id=auth.uid()),p_command,v_id,v_before,v_result);
 if v_kind='office' and p_command in ('create','staff','contributors','root_lead') then
  foreach v_uid in array coalesce(v_people,'{}') loop
   if v_uid<>auth.uid() and not coalesce((case when p_command in ('contributors','root_lead') then v_before->'root'->'people' else (select to_jsonb(assigned_to_ids) from jsonb_to_recordset(v_before->'nodes') as old_node(id uuid,assigned_to_ids uuid[]) where id=v_id) end) ? v_uid::text,false) then
    insert into public.notifications(user_id,type,title,message,task_id,task_title,actor_id,actor_name,project_id,work_node_id)
    values(v_uid,'assignment',case when v_id is null then 'Task assignment' else 'Subtask assignment' end,'You were assigned to "'||coalesce(p_payload->>'title',n.title,(select title from public.tasks where id=p_root))||'".',p_root,(select title from public.tasks where id=p_root),auth.uid(),(select full_name from public.profiles where id=auth.uid()),(r->>'project')::uuid,v_id);
   end if;
  end loop;
 end if;
 insert into eflow_r7.receipts values(auth.uid(),p_request,p_root,v_terms,v_result);
 return v_result;
end $$;

create function eflow_r7.project_members(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_members jsonb;v_offices jsonb;begin
 if not eflow_r7.reader() then raise exception 'Verified current read access required' using errcode='42501';end if;
 if exists(select 1 from public.personal_projects where id=p_project) then
  if not eflow_r3.project_access(p_project) then raise exception 'Personal project access denied' using errcode='42501';end if;
  select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('name',p.full_name,'office',p.org_id,'can_read',eflow_r3.eligible(p.id) and m.state='active' and m.access_ended_at is null and (m.access_end is null or m.access_end>now()) and (m.engagement='Permanent' or (select status='active' from public.personal_projects where id=p_project)),'eligible',eflow_r7.member(p_project,null,p.id),'responsibilities',
   coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'title',t.title,'role',case when t.lead_id=p.id then 'Task Lead' else 'Independent reviewer' end)) from public.personal_tasks t where t.project_id=p_project and (t.lead_id=p.id or t.reviewer_id=p.id)),'[]'::jsonb)||
   coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'node',n.id,'title',t.title||' / '||n.title,'role',case when n.lead_id=p.id then 'Subitem Lead' else 'Subitem contributor' end)) from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id where t.project_id=p_project and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))),'[]'::jsonb)) order by p.full_name),'[]') into v_members from public.personal_project_members m join public.profiles p on p.id=m.user_id where m.project_id=p_project;
  return jsonb_build_object('kind','personal','members',v_members,'offices','[]'::jsonb,'can_select',exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.personal_owner(p.workspace_id)));
 end if;
 if not public.can_see_project(p_project,auth.uid()) then raise exception 'Project access denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object('name',p.full_name,'office',o.office_id,'office_name',org.name,'access',case when o.relationship_type='observer' then 'viewer' else 'member' end,'state',o.invitation_status,'can_read',eflow_r3.eligible(p.id) and p.org_id=o.office_id and o.invitation_status='joined' and m.access_ended_at is null and (m.access_end is null or m.access_end>now()) and (m.engagement='Permanent' or (select status not in ('completed','archived') from public.projects where id=p_project)),'eligible',eflow_r7.member(p_project,o.office_id,p.id),
 'responsibilities',coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'title',t.title,'role',case when coalesce(t.assigned_to,t.recommendation_lead_id)=p.id then 'Task Lead' else 'Contributor' end)) from public.tasks t where t.linked_project_id=p_project and t.deleted_at is null and (coalesce(t.assigned_to,t.recommendation_lead_id)=p.id or p.id=any(coalesce(t.team_member_ids,'{}'::uuid[])))),'[]'::jsonb)||coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'node',n.id,'title',t.title||' / '||n.title,'role',case when n.lead_id=p.id then 'Subitem Lead' else 'Subitem contributor' end)) from public.subtasks n join public.tasks t on t.id=n.task_id where t.linked_project_id=p_project and t.deleted_at is null and (n.lead_id=p.id or p.id=any(n.assigned_to_ids))),'[]'::jsonb)) order by org.name,p.full_name),'[]') into v_members
 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id join public.organizations org on org.id=o.office_id join public.profiles p on p.id=m.user_id where o.project_id=p_project;
 select coalesce(jsonb_agg(to_jsonb(o)||jsonb_build_object('name',org.name,'can_select',eflow_phase6.head(o.project_id,o.office_id,auth.uid()),'eligible_count',(select count(*) from public.profiles p where p.org_id=o.office_id and eflow_r3.eligible(p.id)))),'[]') into v_offices from public.project_offices o join public.organizations org on org.id=o.office_id where o.project_id=p_project;
 return jsonb_build_object('kind','office','members',v_members,'offices',v_offices);
end $$;
create function eflow_r7.member_terms(p_project uuid,p_user uuid,p_office uuid,p_engagement text,p_end timestamptz,p_until_close boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old jsonb;v_new jsonb;begin
 perform eflow_r3.actor();
 if p_engagement not in ('Permanent','Job Order','OJT','Consultant','Other') or p_end<=now() or p_engagement<>'Permanent' and p_end is null and not coalesce(p_until_close,false) then raise exception 'Choose valid engagement and access-end terms';end if;
 if p_office is null then
  perform 1 from public.personal_projects where id=p_project for update;
  if not exists(select 1 from public.personal_projects p where p.id=p_project and p.status='active' and eflow_r3.personal_owner(p.workspace_id)) then raise exception 'Personal owner required' using errcode='42501';end if;
  if exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project and w.owner_id=p_user) and (p_engagement<>'Permanent' or p_end is not null or p_until_close) then raise exception 'Workspace ownership requires permanent access';end if;
  select to_jsonb(m) into v_old from public.personal_project_members m where project_id=p_project and user_id=p_user;
  update public.personal_project_members set engagement=p_engagement,access_end=p_end,until_close=p_until_close where project_id=p_project and user_id=p_user returning to_jsonb(personal_project_members) into v_new;
 else
  perform 1 from public.projects where id=p_project for update;
  if not eflow_phase6.head(p_project,p_office,auth.uid()) or exists(select 1 from public.projects where id=p_project and status in ('completed','archived')) then raise exception 'Own appointed operational Office Head required' using errcode='42501';end if;
  select to_jsonb(m) into v_old from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p_project and o.office_id=p_office and m.user_id=p_user;
  update public.project_office_members m set engagement=p_engagement,access_end=p_end,until_close=p_until_close from public.project_offices o where o.id=m.project_office_id and o.project_id=p_project and o.office_id=p_office and m.user_id=p_user returning to_jsonb(m) into v_new;
 end if;
 if v_new is null then raise exception 'Select the project member first';end if;
 insert into public.audit_events(actor_id,entity_type,entity_id,action,before_data,after_data,org_id) values(auth.uid(),'project_member',p_user::text,'project.member_terms',v_old,v_new,p_office);
 return v_new;
end $$;

-- Retain legacy Office workflow payloads and formal evidence writes, with current
-- branch assignment and reviewer checks before each existing operation.
do $$ declare d text;n text;sig text;begin
 foreach sig in array array['public.save_subtask_progress(uuid,integer,text,text,text,text,text,text)','public.submit_subtask_for_review(uuid,jsonb)','public.decide_subtask_review(uuid,boolean,text)'] loop
  select replace(pg_get_functiondef(sig::regprocedure),chr(13),'') into d;
  d:=overlay(d placing E'begin\n if eflow_r7.root((select task_id from public.subtasks where id=p_subtask_id)) is not null then\n if not eflow_r3.eligible(auth.uid()) then raise exception ''Current verified operational identity required'' using errcode=''42501'';end if;\n if not eflow_r7.read_root((select task_id from public.subtasks where id=p_subtask_id)) then raise exception ''Work access denied'' using errcode=''42501'';end if;end if;' from strpos(lower(d),'begin') for 5);
  if sig like '%decide_subtask_review%' then
   d:=replace(d,'if public.auth_role(caller) is null or caller_role=''admin'' or submission_row.reviewer_id is distinct from caller then','if public.auth_role(caller) is null or caller_role=''admin'' or caller is distinct from (case when eflow_r7.root(subtask_row.task_id) is null then submission_row.reviewer_id else eflow_r7.reviewer(p_subtask_id,submission_row.submitter_id) end) then');
   if d not like '%else eflow_r7.reviewer%' then raise exception 'Review changed review function';end if;
   d:=replace(d,'status_from, status_to, reason','status_from, status_to, reason, work_node_id');
   d:=replace(d,'''for_review'', next_status, coalesce(nullif(btrim(p_feedback), ''''), '''')','''for_review'', next_status, coalesce(nullif(btrim(p_feedback), ''''), ''''), p_subtask_id');
  else
   d:=replace(d,'if not (',E'if not (eflow_r7.root(subtask_row.task_id) is null or coalesce(eflow_r7.node_work(p_subtask_id,caller),false)) or not (');
   if sig like '%submit_subtask_for_review%' then
    d:=replace(d,'reviewer := public.resolve_subtask_reviewer(task_row, caller);','reviewer := eflow_r7.reviewer(p_subtask_id,caller);');
    d:=replace(d,'status_from, status_to, reason','status_from, status_to, reason, work_node_id');
    d:=replace(d,'previous_status, ''for_review'', note_text','previous_status, ''for_review'', note_text, p_subtask_id');
    if d not like '%reviewer := eflow_r7.reviewer%' then raise exception 'Review changed submission function';end if;
   end if;
  end if;execute d;
 end loop;
 -- Sibling prerequisites retain the legacy flat sequence when parent is null.
 select pg_get_functiondef('public.guard_subtask_execution_dependencies()'::regprocedure) into d;
 d:=replace(d,'prerequisite.position < new.position','prerequisite.parent_subtask_id is not distinct from new.parent_subtask_id and prerequisite.sibling_order < new.sibling_order');
 d:=replace(d,'numbered.position <= prerequisite.position','numbered.parent_subtask_id is not distinct from prerequisite.parent_subtask_id and numbered.sibling_order <= prerequisite.sibling_order');
 d:=replace(d,'order by prerequisite.position','order by prerequisite.sibling_order');
 if d not like '%prerequisite.sibling_order < new.sibling_order%' then raise exception 'Review changed sequence function';end if;execute d;
 -- A checked branch worker need not acquire ancestor/root contributor privileges.
 select pg_get_functiondef('public.phase6_guard_subtask()'::regprocedure) into d;
 d:=replace(d,'and not eflow_phase6.work(t.id,auth.uid()) then',E'and not eflow_phase6.work(t.id,auth.uid()) and not (tg_table_name in (''subtasks'',''subtask_progress_updates'') and (eflow_r7.node_work(coalesce(to_jsonb(new)->>''subtask_id'',to_jsonb(new)->>''id'')::uuid,auth.uid()) or auth.uid()=eflow_r7.reviewer((to_jsonb(new)->>''id'')::uuid,(select submitter_id from public.subtask_submissions where id=(to_jsonb(new)->>''latest_submission_id'')::uuid)))) then');
 execute d;
end $$;

-- Keep private formal evidence sealing and object ownership intact. Expired or
-- revoked delegation cannot upload new child evidence. Older fixture-only test
-- databases do not contain this private deployed helper.
do $$ declare d text;begin
 if to_regprocedure('eflow_evidence.guard_attempt()') is not null then
  select pg_get_functiondef('eflow_evidence.guard_attempt()'::regprocedure) into d;
  if strpos(d,'public.resolve_subtask_reviewer(t, auth.uid())')=0 then raise exception 'Review changed evidence attempt guard';end if;
  d:=replace(d,'public.resolve_subtask_reviewer(t, auth.uid())','(case when eflow_r7.root(t.id) is null then public.resolve_subtask_reviewer(t, auth.uid()) else eflow_r7.reviewer(new.subtask_id,auth.uid()) end)');execute d;
 end if;
 if to_regprocedure('eflow_evidence.can_upload(text)') is not null then
  select pg_get_functiondef('eflow_evidence.can_upload(text)'::regprocedure) into d;
  if strpos(d,'select * into t from public.tasks')=0 then raise exception 'Review changed evidence upload helper';end if;
  d:=replace(d,'select * into t from public.tasks',E'if eflow_r7.root(ctx.task_id) is not null and (ctx.subtask_id is not null and not eflow_r7.node_work(ctx.subtask_id,auth.uid()) or ctx.subtask_id is null and not eflow_r7.member((eflow_r7.root(ctx.task_id)->>''project'')::uuid,(eflow_r7.root(ctx.task_id)->>''office'')::uuid,auth.uid())) then return false;end if;
 select * into t from public.tasks');execute d;
 end if;
end $$;
-- Reject incompatible nested imports/templates before any legacy flat mutation.
do $$ declare d text;begin
 select pg_get_functiondef('public.save_subtask_template(uuid,jsonb)'::regprocedure) into d;
 d:=overlay(d placing E'begin
 if exists(select 1 from jsonb_array_elements(coalesce(p_payload->''items'',''[]'')) item where item ?| array[''parentSubtaskId'',''parent_subtask_id'',''children'',''subitems'']) then raise exception ''Nested templates need a hierarchy format; parent links cannot be flattened'';end if;' from strpos(lower(d),'begin') for 5);execute d;
 select pg_get_functiondef('public.apply_subtask_template(uuid,uuid,text,jsonb)'::regprocedure) into d;
 d:=overlay(d placing E'begin
 if exists(select 1 from jsonb_array_elements(coalesce(p_items,''[]'')) item where item ?| array[''parentSubtaskId'',''parent_subtask_id'',''children'',''subitems'']) or p_mode=''replace'' and exists(select 1 from public.subtasks where task_id=p_task_id and parent_subtask_id is not null) then raise exception ''Use the checked subtree actions; flat templates cannot replace nested work'';end if;' from strpos(lower(d),'begin') for 5);execute d;
 select pg_get_functiondef('public.phase5_import_project_work(uuid,uuid,jsonb)'::regprocedure) into d;
 d:=overlay(d placing E'begin
 if exists(select 1 from jsonb_array_elements(coalesce(p_review->''groups'',''[]'')) g cross join lateral jsonb_array_elements(coalesce(g->''tasks'',''[]'')) t cross join lateral jsonb_array_elements(coalesce(t->''subitems'',''[]'')) item where item ?| array[''parentSubtaskId'',''parent_subtask_id'',''children'',''subitems'']) then raise exception ''Nested imports need a hierarchy format; parent links cannot be flattened'';end if;' from strpos(lower(d),'begin') for 5);execute d;
end $$;

-- Every descendant is required before parent submission/approval, including legacy RPCs.
create function eflow_r7.guard_completion() returns trigger language plpgsql security definer set search_path='' as $$
declare v_node uuid;begin
 v_node:=new.id;
 if new.status in ('for_review','completed') and new.status is distinct from old.status and exists(
  with recursive below as (select * from eflow_r7.nodes where parent_subtask_id=v_node union all select c.* from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id)
  select 1 from below where status<>'completed') then raise exception 'Complete and review every descendant first';end if;
 return new;
end $$;
create trigger r7_parent_completion before update of status on public.subtasks for each row execute function eflow_r7.guard_completion();
create trigger r7_personal_completion before update of status on public.personal_subtasks for each row execute function eflow_r7.guard_completion();

-- Apply the new terms to legacy personal operations and R6 library reads.
do $$ declare d text;begin
 select pg_get_functiondef('public.can_contribute_task(uuid,uuid)'::regprocedure) into d;
 d:=replace(d,'eflow_phase6.shared(t.linked_project_id) and t.source_collaboration_draft_id is null','t.linked_project_id is not null and t.source_collaboration_draft_id is null');execute d;
 select pg_get_functiondef('eflow_r3.valid_member(uuid,uuid)'::regprocedure) into d;
 d:=replace(d,'pm.access=''member'' and pm.state=''active''','pm.access=''member'' and pm.state=''active'' and pm.access_ended_at is null and (pm.access_end is null or pm.access_end>now()) and (pm.engagement=''Permanent'' or p.status=''active'')');
 execute d;
 select pg_get_functiondef('eflow_r3.project_access(uuid,boolean)'::regprocedure) into d;
 d:=replace(d,'pm.state=''active'' and (pm.access','pm.state=''active'' and pm.access_ended_at is null and (pm.access_end is null or pm.access_end>now()) and (pm.engagement=''Permanent'' or p.status=''active'') and (pm.access');execute d;
 select pg_get_functiondef('eflow_r6.access(uuid,boolean)'::regprocedure) into d;
 d:=replace(d,'m.user_id=auth.uid())','m.user_id=auth.uid() and m.access_ended_at is null and (m.access_end is null or m.access_end>now()) and (m.engagement=''Permanent'' or p.status not in (''completed'',''archived'')))');
 d:=replace(d,E'or o.relationship_type=''lead'' and exists(select 1 from public.tasks t where t.linked_project_id=p.id and t.org_id=o.office_id and t.deleted_at is null\r\n and (t.assigned_to=auth.uid() or auth.uid()=any(coalesce(t.team_member_ids,''{}''::uuid[]))))','');
 -- Handle LF migrations as well as the repository's Windows checkout.
 d:=replace(d,E'or o.relationship_type=''lead'' and exists(select 1 from public.tasks t where t.linked_project_id=p.id and t.org_id=o.office_id and t.deleted_at is null\n and (t.assigned_to=auth.uid() or auth.uid()=any(coalesce(t.team_member_ids,''{}''::uuid[]))))','');
 execute d;
end $$;
create function eflow_r7.end_members() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('completed','archived') and new.status is distinct from old.status then
  if tg_table_name='projects' then update public.project_office_members m set access_ended_at=coalesce(access_ended_at,now()) from public.project_offices o where o.id=m.project_office_id and o.project_id=new.id and m.engagement<>'Permanent';
  else update public.personal_project_members set access_ended_at=coalesce(access_ended_at,now()) where project_id=new.id and engagement<>'Permanent';end if;
 end if;return new;
end $$;
create trigger r7_office_end after update of status on public.projects for each row execute function eflow_r7.end_members();
create trigger r7_personal_end after update of status on public.personal_projects for each row execute function eflow_r7.end_members();

create function eflow_r7.pending_reviews() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();
 return coalesce((select jsonb_agg(to_jsonb(s) order by s.submitted_at,s.id) from public.subtask_submissions s
 join public.subtasks n on n.latest_submission_id=s.id where s.status='pending' and public.can_see_task(n.task_id,auth.uid())
 and auth.uid()=(case when eflow_r7.root(n.task_id) is null then s.reviewer_id else eflow_r7.pending_reviewer(n.id) end)),'[]');
end $$;
create function eflow_r7.personal_work_roots(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();if not eflow_r3.project_access(p_project) then raise exception 'Personal project unavailable' using errcode='42501';end if;
 return coalesce((select jsonb_agg(distinct n.task_id) from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id where t.project_id=p_project and (eflow_r7.node_work(n.id,auth.uid()) or n.status='for_review' and eflow_r7.pending_reviewer(n.id)=auth.uid())),'[]');
end $$;
create function public.r7_personal_work_roots(p_project uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.personal_work_roots(p_project)$$;
create table eflow_r7.member_receipts(actor_id uuid,request_id uuid,project_id uuid,office_id uuid,payload jsonb,result jsonb,primary key(actor_id,request_id));
alter table eflow_r7.member_receipts enable row level security;
revoke all on eflow_r7.member_receipts from public,anon,authenticated;
create function eflow_r7.select_members(p_office uuid,p_expected uuid[],p_users uuid[],p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.project_offices;v_current uuid[];v_terms jsonb;v_receipt eflow_r7.member_receipts;v_result jsonb;begin
 perform eflow_r3.actor();select * into o from public.project_offices where id=p_office;
 if o.id is null or p_request is null or not eflow_phase6.head(o.project_id,o.office_id,auth.uid()) then raise exception 'Current appointed Office Head required' using errcode='42501';end if;
 perform 1 from public.projects where id=o.project_id for update;perform 1 from public.project_offices where id=o.id for update;
 v_terms:=jsonb_build_object('expected',p_expected,'users',p_users);
 select * into v_receipt from eflow_r7.member_receipts where actor_id=auth.uid() and request_id=p_request;
 if found then
  if v_receipt.office_id<>p_office or v_receipt.payload<>v_terms then raise exception 'Request identity is immutable';end if;return v_receipt.result;
 end if;
 select coalesce(array_agg(user_id order by user_id),'{}') into v_current from public.project_office_members where project_office_id=p_office;
 if v_current is distinct from array(select distinct u from unnest(p_expected) u order by u) then raise exception 'Project membership changed. Reload selection before saving.' using errcode='40001';end if;
 perform public.phase6_set_members(p_office,p_users);
 select coalesce(jsonb_agg(to_jsonb(m) order by m.user_id),'[]') into v_result from public.project_office_members m where project_office_id=p_office;
 insert into eflow_r7.member_receipts values(auth.uid(),p_request,o.project_id,p_office,v_terms,v_result);return v_result;
end $$;
create function public.r7_select_office_members(p_office uuid,p_expected uuid[],p_users uuid[],p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.select_members(p_office,p_expected,p_users,p_request)$$;
create function eflow_r7.office_work_roots() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();return coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.tasks t where eflow_r7.read_root(t.id) and exists(select 1 from public.subtasks n where n.task_id=t.id and eflow_r7.member(t.linked_project_id,t.org_id,auth.uid()) and eflow_r7.chain(t.id,n.parent_subtask_id) and (auth.uid()=any(n.assigned_to_ids) or n.lead_id=auth.uid()))),'[]');
end $$;
create function public.r7_office_work_roots() returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.office_work_roots()$$;
create function eflow_r7.work_activity(p_roots uuid[],p_before timestamptz,p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_rows jsonb;v_more boolean;begin
 if not eflow_r7.reader() then raise exception 'Verified current read access required' using errcode='42501';end if;if (p_before is null)<>(p_id is null) then raise exception 'Use a complete event cursor';end if;if cardinality(p_roots)>1000 then raise exception 'Choose a bounded work scope';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc,e.id desc),'[]') into v_rows from
 (select * from public.work_tree_events e where e.root_id=any(p_roots) and eflow_r7.read_root(e.root_id) and (p_before is null or (e.occurred_at,e.id)<(p_before,p_id)) order by e.occurred_at desc,e.id desc limit 26) e;
 v_more:=jsonb_array_length(v_rows)>25;if v_more then v_rows:=v_rows-25;end if;
 return jsonb_build_object('events',v_rows,'more',v_more);
end $$;
create function public.r7_work_activity(p_roots uuid[],p_before timestamptz default null,p_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.work_activity(p_roots,p_before,p_id)$$;
create function eflow_r7.guard_personal_members() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (tg_op='DELETE' or new.state<>'active' or new.access<>'member') and exists(select 1 from public.personal_subtasks n join public.personal_tasks t on t.id=n.task_id where t.project_id=old.project_id and n.status<>'completed' and (n.lead_id=old.user_id or old.user_id=any(n.assigned_to_ids))) then raise exception 'Reassign unfinished personal descendants before changing member access';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger r7_personal_members before update of state,access or delete on public.personal_project_members for each row execute function eflow_r7.guard_personal_members();
create function eflow_r7.member_terms_checked(p_project uuid,p_user uuid,p_office uuid,p_engagement text,p_end timestamptz,p_until_close boolean,p_expected jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_before jsonb;v_terms jsonb;v_receipt eflow_r7.member_receipts;v_result jsonb;begin
 perform eflow_r3.actor();
 if p_office is null then
  perform 1 from public.personal_projects where id=p_project for update;
  if not exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.personal_owner(p.workspace_id)) then raise exception 'Personal owner required' using errcode='42501';end if;
  select jsonb_build_object('engagement',engagement,'access_end',access_end,'until_close',until_close,'access_ended_at',access_ended_at) into v_before from public.personal_project_members where project_id=p_project and user_id=p_user;
 else
  perform 1 from public.projects where id=p_project for update;
  if not eflow_phase6.head(p_project,p_office,auth.uid()) then raise exception 'Current own Office Head required' using errcode='42501';end if;
  select jsonb_build_object('engagement',m.engagement,'access_end',m.access_end,'until_close',m.until_close,'access_ended_at',m.access_ended_at) into v_before from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p_project and o.office_id=p_office and m.user_id=p_user;
 end if;
 v_terms:=jsonb_build_object('user',p_user,'engagement',p_engagement,'end',p_end,'until',p_until_close,'expected',p_expected);
 if p_request is not null then
  select * into v_receipt from eflow_r7.member_receipts where actor_id=auth.uid() and request_id=p_request;
  if found then
   if v_receipt.project_id<>p_project or v_receipt.office_id is distinct from p_office or v_receipt.payload<>v_terms then raise exception 'Request identity is immutable';end if;return v_receipt.result;
  end if;
 end if;
 if p_expected is not null and p_expected is distinct from v_before then raise exception 'Access terms changed. Reload Members before saving.' using errcode='40001';end if;
 v_result:=eflow_r7.member_terms(p_project,p_user,p_office,p_engagement,p_end,p_until_close);
 if p_request is not null then insert into eflow_r7.member_receipts values(auth.uid(),p_request,p_project,p_office,v_terms,v_result);end if;return v_result;
end $$;
create function public.r7_pending_subtask_reviews() returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.pending_reviews()$$;
create function public.r7_work_tree(p_root uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.snapshot(p_root)$$;
create function public.r7_work_command(p_root uuid,p_revision integer,p_request uuid,p_command text,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.command(p_root,p_revision,p_request,p_command,p_payload)$$;
create function public.r7_project_members(p_project uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.project_members(p_project)$$;
create function public.r7_member_terms(p_project uuid,p_user uuid,p_office uuid,p_engagement text,p_end timestamptz,p_until_close boolean,p_expected jsonb default null,p_request uuid default null) returns jsonb language sql security invoker set search_path='' as $$select eflow_r7.member_terms_checked(p_project,p_user,p_office,p_engagement,p_end,p_until_close,p_expected,p_request)$$;
revoke all on all functions in schema eflow_r7 from public,anon,authenticated;
grant execute on function eflow_r7.snapshot(uuid),eflow_r7.command(uuid,integer,uuid,text,jsonb),eflow_r7.project_members(uuid),eflow_r7.member_terms_checked(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid),eflow_r7.read_root(uuid) to authenticated;
grant execute on function eflow_r7.pending_reviews() to authenticated;
revoke all on function public.r7_pending_subtask_reviews() from public,anon;
grant execute on function public.r7_pending_subtask_reviews() to authenticated;
revoke all on function public.r7_work_tree(uuid),public.r7_work_command(uuid,integer,uuid,text,jsonb),public.r7_project_members(uuid),public.r7_member_terms(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid) from public,anon;
grant execute on function public.r7_work_tree(uuid),public.r7_work_command(uuid,integer,uuid,text,jsonb),public.r7_project_members(uuid),public.r7_member_terms(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid) to authenticated;



revoke all on function public.r7_personal_work_roots(uuid) from public,anon;
grant execute on function public.r7_personal_work_roots(uuid),eflow_r7.personal_work_roots(uuid) to authenticated;

revoke all on function public.r7_select_office_members(uuid,uuid[],uuid[],uuid) from public,anon;
grant execute on function public.r7_select_office_members(uuid,uuid[],uuid[],uuid),eflow_r7.select_members(uuid,uuid[],uuid[],uuid) to authenticated;

revoke all on function public.r7_office_work_roots(),public.r7_work_activity(uuid[],timestamptz,uuid) from public,anon;
grant execute on function public.r7_office_work_roots(),eflow_r7.office_work_roots(),public.r7_work_activity(uuid[],timestamptz,uuid),eflow_r7.work_activity(uuid[],timestamptz,uuid) to authenticated;

notify pgrst,'reload schema';
commit;
