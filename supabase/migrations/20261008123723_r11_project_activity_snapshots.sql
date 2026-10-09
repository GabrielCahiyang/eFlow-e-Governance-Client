-- R11 is additive. Existing event tables, policies and workflow commands stay intact.
-- Private, owner-only, expiring snapshots freeze membership AND event values so
-- concurrent inserts/decisions cannot shift pages. Every read revalidates source RLS.
create schema eflow_r11;
revoke all on schema eflow_r11 from public,anon;
grant usage on schema eflow_r11 to authenticated;

create view eflow_r11.events with (security_invoker=true) as
select p.id project_id, 'audit:'||a.id event_id, 'project'::text kind,
 replace(replace(a.action,'.',' '),'_',' ') title,
 coalesce(nullif(a.reason,''),replace(a.entity_type,'_',' ')||' update') detail,
 coalesce(nullif(a.actor_name,''),'System') actor_name, a.created_at occurred_at,
 case when a.entity_type='task' then t.id end task_id
from public.audit_events a
join public.projects p on a.entity_id=p.id::text
 or exists(select 1 from public.tasks x where x.linked_project_id=p.id and x.id::text=a.entity_id)
 or exists(select 1 from public.milestones m where m.project_id=p.id and m.id::text=a.entity_id)
left join public.tasks t on t.id::text=a.entity_id
union all
select t.linked_project_id,'status:'||s.id,'status','Task moved to '||replace(s.to_status,'_',' '),coalesce(nullif(s.note,''),'Status updated'),coalesce(nullif(s.actor_name,''),'System'),s.created_at,t.id
from public.task_status_history s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'progress:task:'||s.id,'progress','Task progress updated',coalesce(nullif(s.blocker,''),nullif(s.note,''),nullif(s.next_step,''),s.percent_complete::text||'% complete','Progress recorded'),s.author_name,s.created_at,t.id
from public.task_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'progress:subtask:'||s.id,'progress','Subtask progress updated',coalesce(nullif(s.blocker,''),nullif(s.note,''),nullif(s.next_step,''),s.percent_complete::text||'% complete'),s.author_name,s.created_at,t.id
from public.subtask_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'submission:task:'||s.id,'submission','Task submitted for review','Attempt '||s.version||' · '||s.note,s.submitter_name,s.submitted_at,t.id
from public.task_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'decision:task:'||s.id,'submission','Task '||replace(s.status,'_',' '),coalesce(s.decision_feedback,'Attempt '||s.version),coalesce(s.decided_by_name,'Reviewer'),s.decided_at,t.id
from public.task_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select t.linked_project_id,'submission:subtask:'||s.id,'submission','Subtask submitted for review','Attempt '||s.version||' · '||s.note,s.submitter_name,s.submitted_at,t.id
from public.subtask_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'decision:subtask:'||s.id,'submission','Subtask '||replace(s.status,'_',' '),coalesce(s.decision_feedback,'Attempt '||s.version),coalesce(s.decided_by_name,'Reviewer'),s.decided_at,t.id
from public.subtask_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select e.project_id,'work:'||e.id,case when e.command='progress' then 'progress' when e.command in ('submit','review') then 'submission' else 'project' end,replace(e.command,'_',' '),
 coalesce((select n->>'title' from jsonb_array_elements(coalesce(e.after_data->'nodes','[]')||coalesce(e.before_data->'nodes','[]')) n where n->>'id'=e.node_id::text limit 1),'Root task people'),e.actor_name,e.occurred_at,e.root_id
from public.work_tree_events e
union all
select e.project_id,'personal:'||e.id,case when e.command='progress_task' then 'progress' when e.command in ('submit_task','review_task') then 'submission' else 'project' end,replace(e.command,'_',' '),coalesce(nullif(e.payload->>'note',''),nullif(e.payload->>'title',''),'Personal project work change'),p.full_name,e.occurred_at,null::uuid
from public.personal_work_events e left join public.profiles p on p.id=e.actor_id;
revoke all on eflow_r11.events from public,anon;
grant select on eflow_r11.events to authenticated;

create table eflow_r11.snapshots (
 id uuid primary key default extensions.gen_random_uuid(),
 owner_id uuid not null default auth.uid(), project_id uuid not null,
 filters jsonb not null, events jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '1 hour'
);
alter table eflow_r11.snapshots enable row level security;
revoke all on eflow_r11.snapshots from public,anon,authenticated;
grant select,insert,delete on eflow_r11.snapshots to authenticated;
create policy r11_own_snapshot on eflow_r11.snapshots to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create index r11_snapshot_expiry on eflow_r11.snapshots(owner_id,expires_at);

create function public.r11_project_activity(p_project uuid,p_snapshot uuid default null,
 p_page integer default 0,p_size integer default 25,p_kind text default 'all',
 p_search text default '',p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s eflow_r11.snapshots; v_events jsonb; v_total integer; v_page integer;
 v_filters jsonb:=jsonb_build_object('kind',p_kind,'search',btrim(p_search),'from',p_from,'to',p_to);
begin
 if auth.uid() is null or not exists(select 1 from public.projects where id=p_project union all select 1 from public.personal_projects where id=p_project) then
  raise exception 'Current project access required' using errcode='42501';
 end if;
 if p_size not in (25,50,100) or p_page<0 or p_kind not in ('all','project','status','progress','submission') or length(p_search)>500 or (p_from is not null and p_to is not null and p_from>=p_to) then
  raise exception 'Invalid activity filters or page';
 end if;
 if p_snapshot is null then
  delete from eflow_r11.snapshots where owner_id=auth.uid() and expires_at<=now();
  select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at desc,e.event_id collate "C" desc),'[]') into v_events
  from eflow_r11.events e where e.project_id=p_project and (p_kind='all' or e.kind=p_kind)
   and (p_from is null or e.occurred_at>=p_from) and (p_to is null or e.occurred_at<p_to)
   and (btrim(p_search)='' or strpos(lower(e.title||' '||e.detail||' '||coalesce(e.actor_name,'')),lower(btrim(p_search)))>0);
  insert into eflow_r11.snapshots(project_id,filters,events) values(p_project,v_filters,v_events) returning * into s;
 else
  select * into s from eflow_r11.snapshots where id=p_snapshot and project_id=p_project and expires_at>now() and filters=v_filters;
  if not found then raise exception 'History snapshot expired or changed. Refresh history.' using errcode='P0002'; end if;
  -- Missing/deleted/now-hidden sources invalidate the snapshot, never leak cached facts.
  if exists(select 1 from jsonb_array_elements(s.events) x where not exists(select 1 from eflow_r11.events e where e.project_id=p_project and e.event_id=x->>'event_id')) then
   raise exception 'History access or source records changed. Refresh history.' using errcode='42501';
  end if;
 end if;
 v_total:=jsonb_array_length(s.events);
 v_page:=least(p_page,greatest(0,(v_total-1)/p_size));
 select coalesce(jsonb_agg(x.event order by x.position),'[]') into v_events
 from (select event,position from jsonb_array_elements(s.events) with ordinality a(event,position)
  order by position limit p_size offset v_page*p_size) x;
 return jsonb_build_object('snapshot',s.id,'asOf',s.created_at,'expiresAt',s.expires_at,
  'page',v_page,'size',p_size,'total',v_total,'events',v_events,'more',(v_page+1)*p_size<v_total);
end $$;
revoke all on function public.r11_project_activity(uuid,uuid,integer,integer,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.r11_project_activity(uuid,uuid,integer,integer,text,text,timestamptz,timestamptz) to authenticated;
