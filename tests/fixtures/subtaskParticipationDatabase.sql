-- Disposable authorization model for captured hosted writers and review functions.
-- Helpers supply identity/scope/finance context; this is not full hosted RLS QA.
create role authenticated;
create schema auth;create schema eflow_r3;create schema eflow_r7;
create schema eflow_m7;create schema eflow_evidence;create schema eflow_publication;
create schema eflow_work_edit;create schema eflow_work_clearance;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function eflow_r3.eligible(uuid) returns boolean language sql stable as $$select $1 is not null$$;
create function eflow_r3.actor() returns uuid language sql stable as $$select auth.uid()$$;
create table public.tasks(id uuid primary key,assigned_to uuid,linked_project_id uuid,org_id uuid,status text,deleted_at timestamptz,source_collaboration_draft_id uuid,archived_at timestamptz);
create table public.projects(id uuid primary key,status text);
create table public.personal_tasks(id uuid,project_id uuid);
create table public.personal_subtasks(id uuid,task_id uuid,lead_id uuid,assigned_to_ids uuid[]);
create table public.subtasks(id uuid primary key,task_id uuid,lead_id uuid,assigned_to_ids uuid[],assigned_to uuid,title text,
 parent_subtask_id uuid,sibling_order integer,depth integer,is_standalone boolean,status text,percent_complete integer,
 is_completed boolean,completed_by uuid,completed_at timestamptz,started_at timestamptz,dependency_ids uuid[],reviewer_id uuid,latest_submission_id uuid);
create view eflow_r7.nodes as select s.*,'office'::text as kind from public.subtasks s;
create table public.profiles(id uuid,full_name text);
create table public.subtask_progress_updates(id uuid primary key default gen_random_uuid(),subtask_id uuid,task_id uuid,author_id uuid,author_name text,
 percent_complete integer,blocker_category text,blocker text,next_step text,note text,attachment_path text,attachment_name text,created_at timestamptz default now());
create table public.task_activities(task_id uuid,type text,content text,actor_id uuid,actor_name text);
create table public.audit_events(actor_id uuid,actor_name text,entity_type text,entity_id text,action text,before_data jsonb,after_data jsonb,org_id uuid);
create table public.notifications(user_id uuid,type text,title text,message text,task_id uuid,actor_id uuid,work_node_id uuid,entity_type text,project_id uuid);
create table eflow_r7.mutations(tx bigint,actor uuid,root_id uuid);
create table eflow_r7.receipts(actor_id uuid,request_id uuid,root_id uuid,payload jsonb,result jsonb,primary key(actor_id,request_id));
create table eflow_m7.work_proposals(id uuid primary key,root_id uuid,node_id uuid,author_id uuid,reviewer_id uuid,kind text,state text,
 submitted_as_lead boolean,terms jsonb,baseline jsonb,supersedes uuid,decision_request uuid,decision_note text,decided_at timestamptz);
create table eflow_m7.applying_work_proposal(tx bigint,proposal_id uuid);
create function eflow_r7.root(uuid) returns jsonb language sql stable as $$
 select jsonb_build_object('id',t.id,'project',t.linked_project_id,'office',t.org_id,'kind','office','open',true,'status',t.status,'lead',t.assigned_to)
 from public.tasks t where t.id=$1$$;
create function eflow_r7.read_root(uuid) returns boolean language sql stable as $$select auth.uid() is not null and exists(select 1 from public.tasks where id=$1)$$;
create function public.can_see_task(uuid,uuid) returns boolean language sql stable as $$select $2 is not null and exists(select 1 from public.tasks where id=$1)$$;
create function public.can_manage_subtasks(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.tasks where id=$1 and assigned_to=$2)$$;
create function eflow_r7.head(uuid) returns boolean language sql stable as $$select false$$;
create function eflow_r7.member(uuid,uuid,uuid) returns boolean language sql stable as $$select $3 is not null$$;
create function eflow_r7.manage(uuid,uuid) returns boolean language sql stable as $$
 select auth.uid()=t.assigned_to or auth.uid()=s.lead_id from public.tasks t left join public.subtasks s on s.task_id=t.id and s.id=$2 where t.id=$1$$;
create function eflow_r7.node_work(uuid,uuid) returns boolean language sql stable as $$select $2=s.lead_id or $2=any(coalesce(s.assigned_to_ids,'{}')) from public.subtasks s where id=$1$$;
-- Eligible ancestor fallback for the contributor-review fixture below.
create function eflow_r7.reviewer(uuid,uuid) returns uuid language sql stable as $$select t.assigned_to from public.tasks t join public.subtasks s on s.task_id=t.id where s.id=$1$$;
create function eflow_r7.internal(uuid) returns boolean language sql stable as $$select exists(select 1 from eflow_r7.mutations where tx=txid_current() and actor=auth.uid() and root_id=$1)$$;
create function eflow_r7.lock_impact(uuid) returns void language plpgsql as $$begin return;end$$;
create function eflow_r7.lock_completion(uuid) returns void language plpgsql as $$begin return;end$$;
create function eflow_r7.require_completed_descendants(uuid,uuid) returns void language plpgsql as $$begin
 if exists(select 1 from public.subtasks where task_id=$1 and parent_subtask_id=$2 and status<>'completed') then raise exception 'Complete every child step first';end if;end$$;
create function eflow_r7.subtask_dependencies_ready(uuid,uuid[]) returns boolean language sql stable as $$select true$$;
create function eflow_r7.operation_impact(uuid,text,jsonb) returns jsonb language sql stable as $$select '{"allowed":true}'::jsonb$$;
create function eflow_publication.subtask_planning_locked(uuid) returns boolean language sql stable as $$select false$$;
create function eflow_publication.subtask_staffing_locked(uuid) returns boolean language sql stable as $$select false$$;
create function eflow_publication.root_contributor_change_locked(uuid) returns boolean language sql stable as $$select false$$;
create function eflow_publication.planning_lead(uuid,uuid) returns boolean language sql stable as $$select false$$;
create function eflow_publication.manage_plan(uuid,uuid,boolean default false) returns boolean language sql stable as $$select eflow_r7.manage($1,$2)$$;
create function eflow_work_edit.state(uuid,uuid) returns jsonb language sql stable as $$select '{"details":true}'::jsonb$$;
create function eflow_m7.node_activated(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.subtasks where task_id=$1 and id=$2 and started_at is not null)$$;
create function eflow_m7.personal_node_activated(uuid,uuid) returns boolean language sql stable as $$select false$$;
create function eflow_m7.work_scope_open(uuid,uuid) returns boolean language sql stable as $$select exists(select 1 from public.tasks t join public.projects p on p.id=t.linked_project_id where t.id=$1 and t.status='in_progress' and p.status='active')$$;
create function eflow_m7.work_baseline(uuid,uuid) returns jsonb language sql stable as $$select '{}'::jsonb$$;
create function eflow_m7.is_subtask_lead(uuid,uuid,uuid) returns boolean language sql stable as $$select coalesce((select lead_id=$3 from public.subtasks where task_id=$1 and id=$2),false)$$;
create function eflow_m7.check_proposal_files(jsonb,uuid,uuid,uuid,uuid) returns void language plpgsql as $$begin return;end$$;
create function eflow_m7.log_proposal(eflow_m7.work_proposals,text) returns void language plpgsql as $$begin return;end$$;
create function eflow_work_clearance.accepted(uuid,uuid) returns boolean language sql stable as $$select false$$;
create function eflow_work_clearance.cash_open(uuid,uuid) returns boolean language sql stable as $$select false$$;
create function eflow_evidence.active_actor() returns boolean language sql stable as $$select auth.uid() is not null$$;
create function eflow_evidence.seal_file(text,uuid,uuid,text,text,uuid) returns void language plpgsql as $$begin return;end$$;

insert into public.projects values('10000000-0000-4000-8000-000000000001','active');
insert into public.tasks(id,assigned_to,linked_project_id,org_id,status,deleted_at,source_collaboration_draft_id) values('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','in_progress',null,null);
insert into public.subtasks(id,task_id,lead_id,assigned_to_ids,title,sibling_order,depth,is_standalone,status,percent_complete,is_completed,started_at,dependency_ids)
 values('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',
 array['30000000-0000-4000-8000-000000000003'::uuid],'Assigned step',0,1,true,'in_progress',43,false,now(),'{}');
