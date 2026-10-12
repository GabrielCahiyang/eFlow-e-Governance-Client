-- NW9.6 separately reviewed additive projection slice; local and undeployed.
-- Appends only recorded work-event metadata. Existing columns, kinds, source
-- policies, invoker security, RPC, expiry and bounded reads remain unchanged.
create or replace view eflow_r11.events with (security_invoker=true) as
select p.id project_id, 'audit:'||a.id event_id, 'project'::text kind,
 replace(replace(a.action,'.',' '),'_',' ') title,
 coalesce(nullif(a.reason,''),replace(a.entity_type,'_',' ')||' update') detail,
 coalesce(nullif(a.actor_name,''),'System') actor_name, a.created_at occurred_at,
 case when a.entity_type='task' then t.id end task_id, null::jsonb as work_event
from public.audit_events a
join public.projects p on a.entity_id=p.id::text
 or exists(select 1 from public.tasks x where x.linked_project_id=p.id and x.id::text=a.entity_id)
 or exists(select 1 from public.milestones m where m.project_id=p.id and m.id::text=a.entity_id)
left join public.tasks t on t.id::text=a.entity_id
union all
select t.linked_project_id,'status:'||s.id,'status','Task moved to '||replace(s.to_status,'_',' '),coalesce(nullif(s.note,''),'Status updated'),coalesce(nullif(s.actor_name,''),'System'),s.created_at,t.id, null::jsonb as work_event
from public.task_status_history s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'progress:task:'||s.id,'progress','Task progress updated',coalesce(nullif(s.blocker,''),nullif(s.note,''),nullif(s.next_step,''),s.percent_complete::text||'% complete','Progress recorded'),s.author_name,s.created_at,t.id, null::jsonb as work_event
from public.task_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'progress:subtask:'||s.id,'progress','Subtask progress updated',coalesce(nullif(s.blocker,''),nullif(s.note,''),nullif(s.next_step,''),s.percent_complete::text||'% complete'),s.author_name,s.created_at,t.id, null::jsonb as work_event
from public.subtask_progress_updates s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'submission:task:'||s.id,'submission','Task submitted for review','Attempt '||s.version||' · '||s.note,s.submitter_name,s.submitted_at,t.id, null::jsonb as work_event
from public.task_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'decision:task:'||s.id,'submission','Task '||replace(s.status,'_',' '),coalesce(s.decision_feedback,'Attempt '||s.version),coalesce(s.decided_by_name,'Reviewer'),s.decided_at,t.id, null::jsonb as work_event
from public.task_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select t.linked_project_id,'submission:subtask:'||s.id,'submission','Subtask submitted for review','Attempt '||s.version||' · '||s.note,s.submitter_name,s.submitted_at,t.id, null::jsonb as work_event
from public.subtask_submissions s join public.tasks t on t.id=s.task_id
union all
select t.linked_project_id,'decision:subtask:'||s.id,'submission','Subtask '||replace(s.status,'_',' '),coalesce(s.decision_feedback,'Attempt '||s.version),coalesce(s.decided_by_name,'Reviewer'),s.decided_at,t.id, null::jsonb as work_event
from public.subtask_submissions s join public.tasks t on t.id=s.task_id where s.decided_at is not null
union all
select e.project_id,'work:'||e.id,case when e.command='progress' then 'progress' when e.command in ('submit','review') then 'submission' else 'project' end,replace(e.command,'_',' '),
 coalesce((select n->>'title' from jsonb_array_elements(coalesce(e.after_data->'nodes','[]')||coalesce(e.before_data->'nodes','[]')) n where n->>'id'=e.node_id::text limit 1),'Root task people'),e.actor_name,e.occurred_at,e.root_id, jsonb_build_object('id',e.id,'root_id',e.root_id,'node_id',e.node_id,'command',e.command,'actor_name',e.actor_name,'occurred_at',e.occurred_at,'before_data',e.before_data,'after_data',e.after_data) as work_event
from public.work_tree_events e
union all
select e.project_id,'personal:'||e.id,case when e.command='progress_task' then 'progress' when e.command in ('submit_task','review_task') then 'submission' else 'project' end,replace(e.command,'_',' '),coalesce(nullif(e.payload->>'note',''),nullif(e.payload->>'title',''),'Personal project work change'),p.full_name,e.occurred_at,null::uuid, null::jsonb as work_event
from public.personal_work_events e left join public.profiles p on p.id=e.actor_id;
