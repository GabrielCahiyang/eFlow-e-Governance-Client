-- R9 additive sharing and reviewed removal. R3/R6/R7/R8 prerequisites.
begin;
set local lock_timeout='10s';
create schema eflow_r9;
revoke all on schema eflow_r9 from public,anon;
grant usage on schema eflow_r9 to authenticated;
create table public.project_access_grants(
 id uuid primary key,project_id uuid not null,recipient uuid not null references public.profiles(id),office_id uuid,
 access text not null check(access in ('viewer','member')),engagement text not null check(engagement in ('Permanent','Job Order','OJT','Consultant','Other')),
 access_end timestamptz,until_close boolean not null default false,created_by uuid not null,created_at timestamptz not null default now(),revoked_at timestamptz,redeem_expires_at timestamptz not null default now()+interval '7 days',redeemed_at timestamptz,
 check(engagement='Permanent' or access_end is not null or until_close)
);
create index r9_grants_recipient on public.project_access_grants(recipient,project_id,office_id) where revoked_at is null;
create index r9_grants_project on public.project_access_grants(project_id,created_at,id);
alter table public.project_access_grants enable row level security;
revoke all on public.project_access_grants from public,anon,authenticated,service_role;
grant select on public.project_access_grants to authenticated;
create table eflow_r9.removed(project_id uuid,user_id uuid,scope uuid,removed_at timestamptz not null default now(),primary key(project_id,user_id,scope));
create table eflow_r9.mutations(tx bigint,project_id uuid,primary key(tx,project_id));
create table eflow_r9.receipts(actor uuid,request uuid,payload jsonb,result jsonb,primary key(actor,request));
create table eflow_r9.events(id uuid primary key default extensions.gen_random_uuid(),project_id uuid,actor uuid,action text,details jsonb,occurred_at timestamptz not null default now());
create index r9_events_project on eflow_r9.events(project_id,occurred_at,id);
alter table eflow_r9.removed enable row level security;
alter table eflow_r9.mutations enable row level security;
alter table eflow_r9.receipts enable row level security;
alter table eflow_r9.events enable row level security;
revoke all on all tables in schema eflow_r9 from public,anon,authenticated,service_role;
-- A removed personal Lead remains nullable until explicitly reassigned.
alter table public.personal_tasks alter column lead_id drop not null;
alter table public.personal_tasks drop constraint personal_tasks_check;
alter table public.personal_tasks add constraint r9_independent_reviewer check(reviewer_id is null or lead_id is null or reviewer_id<>lead_id);
do $$declare d text;begin
 select pg_get_functiondef('public.r3_personal_project_command(uuid,text,jsonb,uuid)'::regprocedure) into d;
 d:=replace(d,'t.lead_id<>actor','t.lead_id is distinct from actor');execute d;
end $$;
create function eflow_r9.scope(p_office uuid) returns uuid language sql immutable set search_path='' as $$select coalesce(p_office,'00000000-0000-0000-0000-000000000000'::uuid)$$;
create function eflow_r9.open(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects where id=p_project and status not in ('completed','archived') and source_collaboration_draft_id is null)
 or exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project and p.status='active' and w.state='active')
$$;
create function eflow_r9.share_head(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and (exists(select 1 from public.projects p where p.id=p_project and p.source_collaboration_draft_id is null and eflow_phase6.head(p.id,p.org_id,auth.uid()))
 or exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project and (eflow_r3.personal_owner(p.workspace_id) or public.phase2_is_office_head(auth.uid(),w.sponsoring_office_id))))
$$;
create function eflow_r9.person_head(p_project uuid,p_office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and (p_office is not null and eflow_phase6.head(p_project,p_office,auth.uid()) and exists(select 1 from public.projects where id=p_project and source_collaboration_draft_id is null)
 or p_office is null and exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.personal_owner(p.workspace_id)))
$$;
create function eflow_r9.grant_valid(g public.project_access_grants,p_edit boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(g.recipient) and g.revoked_at is null and g.redeemed_at is not null
 and (g.access_end is null or g.access_end>now()) and (g.engagement='Permanent' and not g.until_close or eflow_r9.open(g.project_id))
 and (not p_edit or g.access='member' and eflow_r9.open(g.project_id))
 and not exists(select 1 from eflow_r9.removed r where r.project_id=g.project_id and r.user_id=g.recipient and r.scope=eflow_r9.scope(g.office_id))
$$;
create function eflow_r9.granted(p_project uuid,p_user uuid,p_edit boolean default false,p_office uuid default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.project_access_grants g where g.project_id=p_project and g.recipient=p_user and (not p_edit or g.office_id is not distinct from p_office) and eflow_r9.grant_valid(g,p_edit))
$$;
create function eflow_r9.allowed(p_project uuid,p_user uuid,p_office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from eflow_r9.removed r where r.project_id=p_project and r.user_id=p_user and (r.scope=eflow_r9.scope(p_office) or p_office is null))
 and not exists(select 1 from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p_project and m.user_id=p_user and (p_office is null or o.office_id=p_office)
 and (m.access_ended_at is not null or m.access_end<=now() or (m.engagement<>'Permanent' or m.until_close) and not eflow_r9.open(p_project)))
$$;
-- Save checked baselines; existing appointments and governed contracts are retained.
do $$declare sig text;d text;n text;begin
 foreach sig in array array['public.can_see_project(uuid,uuid)','public.can_see_task(uuid,uuid)','public.can_contribute_task(uuid,uuid)','eflow_r7.member(uuid,uuid,uuid)','eflow_r3.project_access(uuid,boolean)','eflow_r3.valid_member(uuid,uuid)','eflow_r6.access(uuid,boolean)'] loop
 select pg_get_functiondef(sig::regprocedure) into d;n:=split_part(split_part(sig,'(',1),'.',2);
 execute replace(d,'FUNCTION '||split_part(sig,'(',1)||'(','FUNCTION eflow_r9.baseline_'||n||'(');
 end loop;
end $$;
create or replace function public.can_see_project(target_project uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r9.baseline_can_see_project(target_project,caller_id) and (eflow_r9.allowed(target_project,caller_id,(select org_id from public.profiles where id=caller_id))
 or exists(select 1 from public.profiles where id=caller_id and is_active and role='admin') or exists(select 1 from public.project_offices o where o.project_id=target_project and eflow_phase6.head(target_project,o.office_id,caller_id))),false)
 or eflow_r9.granted(target_project,caller_id)
$$;
create or replace function public.can_see_task(target_task uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r9.baseline_can_see_task(target_task,caller_id) and (t.linked_project_id is null or t.source_collaboration_draft_id is not null or public.can_see_project(t.linked_project_id,caller_id)),false)
 or t.deleted_at is null and t.proposed_office_identity_id is null and t.source_collaboration_draft_id is null and eflow_r9.granted(t.linked_project_id,caller_id)
 from public.tasks t where t.id=target_task
$$;
create or replace function eflow_r7.member(p_project uuid,p_office uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r9.allowed(p_project,p_user,p_office) and eflow_r9.baseline_member(p_project,p_office,p_user) or eflow_r9.granted(p_project,p_user,true,p_office)
$$;
create or replace function public.can_contribute_task(target_task uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r9.baseline_can_contribute_task(target_task,caller_id) and (t.linked_project_id is null or t.source_collaboration_draft_id is not null or eflow_r9.open(t.linked_project_id) and eflow_r7.member(t.linked_project_id,t.org_id,coalesce(t.assigned_to,t.recommendation_lead_id)) and (eflow_phase6.head(t.linked_project_id,t.org_id,caller_id) or eflow_r7.member(t.linked_project_id,t.org_id,caller_id)))
 or eflow_r9.granted(t.linked_project_id,caller_id,true,t.org_id) and eflow_r7.member(t.linked_project_id,t.org_id,coalesce(t.assigned_to,t.recommendation_lead_id)) and t.deleted_at is null and (coalesce(t.assigned_to,t.recommendation_lead_id)=caller_id or caller_id=any(t.team_member_ids))
 from public.tasks t where t.id=target_task
$$;
create or replace function eflow_r3.project_access(p_project uuid,p_edit boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r9.baseline_project_access(p_project,p_edit) and (eflow_r9.allowed(p_project,auth.uid(),null) or exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.personal_owner(p.workspace_id))),false)
 or exists(select 1 from public.personal_projects where id=p_project) and eflow_r9.granted(p_project,auth.uid(),p_edit)
$$;
create or replace function eflow_r3.valid_member(p_project uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r9.allowed(p_project,p_user,null) and eflow_r9.baseline_valid_member(p_project,p_user) or exists(select 1 from public.personal_projects where id=p_project) and eflow_r9.granted(p_project,p_user,true)
$$;
create or replace function eflow_r6.access(p_project uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(eflow_r9.baseline_access(p_project,p_write) and (exists(select 1 from public.personal_projects where id=p_project) and eflow_r3.project_access(p_project,p_write)
 or public.can_see_project(p_project,auth.uid()) and (not p_write or exists(select 1 from public.project_offices o where o.project_id=p_project and (eflow_phase6.head(p_project,o.office_id,auth.uid()) or eflow_r7.member(p_project,o.office_id,auth.uid()))))),false)
 or eflow_r9.granted(p_project,auth.uid(),p_write,(select org_id from public.projects where id=p_project))
$$;
create policy r9_grants_read on public.project_access_grants for select to authenticated using(recipient=(select auth.uid()) or eflow_r9.share_head(project_id));
create function eflow_r9.internal(p_project uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from eflow_r9.mutations where tx=txid_current() and project_id=p_project)$$;
create function eflow_r9.serialize() returns trigger language plpgsql security definer set search_path='' as $$
declare j jsonb;pid uuid;begin
 j:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if tg_table_name in ('projects','personal_projects') then pid:=(j->>'id')::uuid;
 elsif tg_table_name='tasks' then pid:=(j->>'linked_project_id')::uuid;
 elsif tg_table_name='personal_tasks' then pid:=(j->>'project_id')::uuid;
 elsif tg_table_name in ('subtasks','personal_subtasks') then pid:=coalesce((select linked_project_id from public.tasks where id=(j->>'task_id')::uuid),(select project_id from public.personal_tasks where id=(j->>'task_id')::uuid));
 elsif tg_table_name='project_office_members' then select project_id into pid from public.project_offices where id=(j->>'project_office_id')::uuid;
 else pid:=(j->>'project_id')::uuid;end if;
 if pid is not null then perform pg_advisory_xact_lock(hashtextextended('r9:'||pid::text,0));end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
do $$declare n text;begin
 foreach n in array array['projects','personal_projects','tasks','subtasks','personal_tasks','personal_subtasks','project_office_members','personal_project_members','project_guest_members','project_invitation_requests','project_access_grants'] loop
 execute format('create trigger a_r9_serialize before insert or update or delete on public.%I for each row execute function eflow_r9.serialize()',n);
 end loop;
end $$;
-- Only the private removal transaction bypasses staffing guards; it cannot be set by JWT callers.
do $$declare sig text;d text;expr text;begin
 foreach sig in array array['eflow_r7.guard_root()','eflow_r7.guard_node()','public.phase6_guard_task()','public.phase6_guard_subtask()','public.guard_subtask_contributor_update()'] loop
 select pg_get_functiondef(sig::regprocedure) into d;
 expr:='coalesce((select linked_project_id from public.tasks where id=coalesce((to_jsonb(new)->>''task_id'')::uuid,(to_jsonb(new)->>''id'')::uuid)),(select project_id from public.personal_tasks where id=coalesce((to_jsonb(new)->>''task_id'')::uuid,(to_jsonb(new)->>''id'')::uuid)))';
 d:=overlay(d placing 'begin if tg_op=''UPDATE'' and eflow_r9.internal('||expr||') then return new;end if;' from strpos(lower(d),'begin') for 5);execute d;
 end loop;
end $$;
create function eflow_r9.impact(p_project uuid,p_user uuid,p_office uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('project',p_project,'user',p_user,'office',p_office,
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'lead',t.assigned_to,'recommendation_lead',t.recommendation_lead_id,'people',t.team_member_ids,'reviewer',t.reviewer_id,'backup',t.backup_reviewer_id) order by t.id) from public.tasks t where t.linked_project_id=p_project and t.org_id=p_office and (p_user in (t.assigned_to,t.recommendation_lead_id,t.reviewer_id,t.backup_reviewer_id) or p_user=any(t.team_member_ids))),'[]')||
 coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'lead',t.lead_id,'reviewer',t.reviewer_id) order by t.id) from public.personal_tasks t where t.project_id=p_project and (t.lead_id=p_user or t.reviewer_id=p_user)),'[]'),
 'nodes',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'root',n.task_id,'title',n.title,'status',n.status,'lead',n.lead_id,'people',n.assigned_to_ids,'legacy_assignee',(select assigned_to from public.subtasks where id=n.id)) order by n.id) from eflow_r7.nodes n where
 n.task_id in (select id from public.tasks where linked_project_id=p_project and org_id=p_office union all select id from public.personal_tasks where project_id=p_project)
 and (n.lead_id=p_user or p_user=any(n.assigned_to_ids) or exists(select 1 from public.subtasks where id=n.id and assigned_to=p_user)
 or n.task_id in (select id from public.tasks where linked_project_id=p_project and org_id=p_office and coalesce(assigned_to,recommendation_lead_id)=p_user union all select id from public.personal_tasks where project_id=p_project and lead_id=p_user)
 or n.id in (with recursive below as (select id from eflow_r7.nodes where lead_id=p_user union all select x.id from eflow_r7.nodes x join below b on x.parent_subtask_id=b.id) select id from below))),'[]'),
 'office_members',coalesce((select jsonb_agg(to_jsonb(m) order by m.project_office_id) from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p_project and o.office_id=p_office and m.user_id=p_user),'[]'),
 'personal_members',coalesce((select jsonb_agg(to_jsonb(m)) from public.personal_project_members m where project_id=p_project and user_id=p_user),'[]'),
 'guests',coalesce((select jsonb_agg(to_jsonb(m) order by m.request_id) from public.project_guest_members m where project_id=p_project and office_id=p_office and user_id=p_user),'[]'),
 'grants',coalesce((select jsonb_agg(to_jsonb(g) order by g.id) from public.project_access_grants g where project_id=p_project and recipient=p_user and office_id is not distinct from p_office),'[]'),
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'revision',r.revision,'state',r.state) order by r.id) from public.project_invitation_requests r where project_id=p_project and (p_office is null or office_id=p_office) and (accepted_by=p_user or email=(select lower(email) from public.profiles where id=p_user))),'[]'))
$$;
create function eflow_r9.preview(p_project uuid,p_user uuid,p_office uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;begin
 perform eflow_r3.actor();if not eflow_r9.person_head(p_project,p_office) then raise exception 'Current responsible Office Head or personal workspace owner required' using errcode='42501';end if;
 if p_office is not null and public.phase2_is_office_head(p_user,p_office) then raise exception 'Mandatory Office Head ownership needs an appointed replacement before removal';end if;
 if exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project and w.owner_id=p_user) then raise exception 'Workspace ownership needs a replacement before removal';end if;
 v:=eflow_r9.impact(p_project,p_user,p_office);return v||jsonb_build_object('fingerprint',md5(v::text));
end $$;
create function eflow_r9.clear_staff(p_project uuid,p_user uuid,p_office uuid) returns void language plpgsql security definer set search_path='' as $$
declare v jsonb:=eflow_r9.impact(p_project,p_user,p_office);roots uuid[];v_nodes uuid[];clear_leads uuid[];begin
 if jsonb_array_length(v->'tasks')+jsonb_array_length(v->'nodes')=0 then return;end if;
 select coalesce(array_agg((x->>'id')::uuid),'{}') into roots from jsonb_array_elements(v->'tasks') x where coalesce((x->>'lead')::uuid,(x->>'recommendation_lead')::uuid)=p_user;
 select coalesce(array_agg((x->>'id')::uuid),'{}') into v_nodes from jsonb_array_elements(v->'nodes') x;
 select coalesce(array_agg(id),'{}') into clear_leads from eflow_r7.nodes where id=any(v_nodes) and (lead_id=p_user or task_id=any(roots) or id in (with recursive below as (select id from eflow_r7.nodes where lead_id=p_user union all select c.id from eflow_r7.nodes c join below b on c.parent_subtask_id=b.id) select id from below));
 insert into eflow_r9.mutations values(txid_current(),p_project);
 update public.subtasks set assigned_to=case when assigned_to=p_user then null else assigned_to end,assigned_to_ids=array_remove(assigned_to_ids,p_user),lead_id=case when id=any(clear_leads) then null else lead_id end where id=any(v_nodes);
 update public.personal_subtasks set assigned_to_ids=array_remove(assigned_to_ids,p_user),lead_id=case when id=any(clear_leads) then null else lead_id end where id=any(v_nodes);
 update public.tasks set assigned_to=case when id=any(roots) then null else assigned_to end,recommendation_lead_id=case when id=any(roots) or recommendation_lead_id=p_user then null else recommendation_lead_id end,team_member_ids=array_remove(team_member_ids,p_user),assignee_name=case when id=any(roots) then '' else assignee_name end,team_member_names=array(select coalesce(u.full_name,'') from unnest(array_remove(team_member_ids,p_user)) with ordinality x(uid,pos) left join public.profiles u on u.id=x.uid order by x.pos),reviewer_id=case when reviewer_id=p_user then null else reviewer_id end,backup_reviewer_id=case when backup_reviewer_id=p_user then null else backup_reviewer_id end
 where linked_project_id=p_project and org_id=p_office and id in (select (x->>'id')::uuid from jsonb_array_elements(v->'tasks') x);
 update public.personal_tasks set revision=revision+1,lead_id=case when lead_id=p_user then null else lead_id end,reviewer_id=case when reviewer_id=p_user then null else reviewer_id end where project_id=p_project and (lead_id=p_user or reviewer_id=p_user);
 delete from eflow_r9.mutations where tx=txid_current() and project_id=p_project;
 insert into eflow_r7.tree_state(root_id,revision) select id,2 from public.tasks where linked_project_id=p_project and org_id=p_office union all select id,2 from public.personal_tasks where project_id=p_project on conflict(root_id) do update set revision=eflow_r7.tree_state.revision+1;
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,coalesce(auth.uid(),p_user),'assignments_cleared',v);
end $$;
revoke all on function eflow_r9.clear_staff(uuid,uuid,uuid) from public,anon,authenticated,service_role;
create function eflow_r9.remove_person(p_project uuid,p_user uuid,p_office uuid,p_fingerprint text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;r eflow_r9.receipts;payload jsonb:=jsonb_build_array(p_project,p_user,p_office,p_fingerprint);result jsonb;begin
 perform eflow_r3.actor();if p_request is null then raise exception 'Stable request ID required';end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project::text,0));
 if not eflow_r9.person_head(p_project,p_office) then raise exception 'Current removal authority required' using errcode='42501';end if;
 select * into r from eflow_r9.receipts where actor=auth.uid() and request=p_request;
 if found then if r.payload<>payload then raise exception 'Request ID reused';end if;return r.result;end if;
 v:=eflow_r9.preview(p_project,p_user,p_office);if v->>'fingerprint' is distinct from p_fingerprint then raise exception 'Membership or assignments changed. Refresh the impact preview before confirming.' using errcode='40001';end if;
 perform eflow_r9.clear_staff(p_project,p_user,p_office);
 update public.project_office_members m set access_ended_at=coalesce(access_ended_at,now()) from public.project_offices o where o.id=m.project_office_id and o.project_id=p_project and o.office_id=p_office and m.user_id=p_user;
 update public.personal_project_members set state='revoked',access_ended_at=coalesce(access_ended_at,now()) where project_id=p_project and user_id=p_user;
 update public.project_guest_members set ended_at=coalesce(ended_at,now()) where project_id=p_project and office_id=p_office and user_id=p_user;
 update public.project_access_grants set revoked_at=coalesce(revoked_at,now()) where project_id=p_project and recipient=p_user and office_id is not distinct from p_office;
 update public.project_invitation_requests set state='revoked',revision=revision+1 where project_id=p_project and (p_office is null or office_id=p_office) and (accepted_by=p_user or email=(select lower(email) from public.profiles where id=p_user)) and state in ('pending','approved','accepted');
 delete from eflow_r8.tokens where request_id in (select id from public.project_invitation_requests where project_id=p_project and (p_office is null or office_id=p_office) and state='revoked');
 delete from public.project_members where project_id=p_project and user_id=p_user and (p_office is null or (select org_id from public.profiles where id=p_user)=p_office);
 insert into eflow_r9.removed values(p_project,p_user,eflow_r9.scope(p_office),now()) on conflict(project_id,user_id,scope) do update set removed_at=excluded.removed_at;
 insert into eflow_r7.tree_state(root_id,revision) select id,2 from public.tasks where linked_project_id=p_project and org_id=p_office union all select id,2 from public.personal_tasks where project_id=p_project on conflict(root_id) do update set revision=eflow_r7.tree_state.revision+1;
 delete from eflow_r9.mutations where tx=txid_current() and project_id=p_project;
 result:=jsonb_build_object('removed',p_user,'project',p_project,'tasks',jsonb_array_length(v->'tasks'),'nodes',jsonb_array_length(v->'nodes'));
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,auth.uid(),'person_removed',v||jsonb_build_object('result',result));
 insert into public.audit_events(actor_id,entity_type,entity_id,action,org_id,before_data,after_data) values(auth.uid(),'project_member',p_user::text,'project.person_removed',p_office,v,result);
 insert into eflow_r9.receipts values(auth.uid(),p_request,payload,result);return result;
end $$;
create function eflow_r9.grant_access(p_id uuid,p_project uuid,p_email text,p_access text,p_engagement text,p_end timestamptz,p_close boolean,p_ttl integer default 7) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;office uuid;g public.project_access_grants;begin
 perform eflow_r3.actor();perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project::text,0));
 if not eflow_r9.share_head(p_project) or not eflow_r9.open(p_project) then raise exception 'Only the appointed Lead Office Head or personal workspace owner can share an open project' using errcode='42501';end if;
 select p.id into uid from public.profiles p join auth.users u on u.id=p.id where lower(btrim(u.email))=lower(btrim(p_email)) and eflow_r3.eligible(p.id);
 if uid is null then raise exception 'Choose an existing active verified account. External people require Head-approved Invitations.';end if;
 select org_id into office from public.projects where id=p_project;
 if p_ttl not between 1 and 30 then raise exception 'Share redemption lifetime must be 1–30 days';end if;
 if office is null and not exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id join public.profiles recipient on recipient.id=uid join public.profiles owner on owner.id=w.owner_id where p.id=p_project and (recipient.org_id is not distinct from owner.org_id and owner.org_id is not null or public.phase2_is_office_head(auth.uid(),w.sponsoring_office_id))) then raise exception 'External personal shares require the designated sponsoring Head';end if;
 if office is null and p_access='member' and not exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id join public.profiles recipient on recipient.id=uid join public.profiles owner on owner.id=w.owner_id where p.id=p_project and (recipient.org_id=owner.org_id or exists(select 1 from public.project_invitation_requests r where r.project_id=p_project and r.accepted_by=uid and r.state='accepted'))) then raise exception 'External editing membership requires R8 sponsoring Head approval';end if;
 if p_access='viewer' then p_close:=true;end if;
 if p_access not in ('viewer','member') or p_engagement not in ('Permanent','Job Order','OJT','Consultant','Other') or p_end<=now() or p_engagement<>'Permanent' and p_end is null and not coalesce(p_close,false) then raise exception 'Choose valid permission and future access terms';end if;
 if p_access='member' and office is not null and not exists(select 1 from public.profiles where id=uid and org_id=office) and not eflow_r8.guest(p_project,office,uid) then raise exception 'Members must belong to the Lead Office or have its approved guest membership. Other Offices select their own personnel.';end if;
 if exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project and w.owner_id=uid) then raise exception 'Workspace owner already has permanent ownership';end if;
 select * into g from public.project_access_grants where id=p_id;
 if found then if g.project_id<>p_project or g.recipient<>uid or g.created_by<>auth.uid() or g.access<>p_access or g.engagement<>p_engagement or g.access_end is distinct from p_end or g.until_close<>p_close or (g.redeem_expires_at-g.created_at) is distinct from make_interval(days=>p_ttl) then raise exception 'Grant ID reused with different terms';end if;return to_jsonb(g);end if;
 insert into public.project_access_grants(id,project_id,recipient,office_id,access,engagement,access_end,until_close,created_by,redeem_expires_at) values(p_id,p_project,uid,office,p_access,p_engagement,p_end,p_close,auth.uid(),now()+make_interval(days=>p_ttl)) returning * into g;
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,auth.uid(),'access_granted',to_jsonb(g));return to_jsonb(g);
end $$;
create function eflow_r9.revoke_grant(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare g public.project_access_grants;begin
 perform eflow_r3.actor();select * into g from public.project_access_grants where id=p_id;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||g.project_id::text,0));
 if not eflow_r9.share_head(g.project_id) then raise exception 'Current sharing authority required' using errcode='42501';end if;
 if g.access='member' and g.redeemed_at is not null then raise exception 'Review person removal to clear assignments before revoking member access';end if;
 update public.project_access_grants set revoked_at=coalesce(revoked_at,now()) where id=p_id;
 insert into eflow_r9.events(project_id,actor,action,details) values(g.project_id,auth.uid(),'viewer_revoked',to_jsonb(g));
end $$;
create function eflow_r9.snapshot(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();if not (public.can_see_project(p_project,auth.uid()) or eflow_r3.project_access(p_project) or eflow_r9.share_head(p_project)) then raise exception 'Current project access required' using errcode='42501';end if;
 return jsonb_build_object('can_share',eflow_r9.share_head(p_project),'open',eflow_r9.open(p_project),'kind',case when exists(select 1 from public.projects where id=p_project) then 'office' else 'personal' end,
 'grants',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object('name',p.full_name,'email',p.email,'effective',eflow_r9.grant_valid(g),'can_revoke',eflow_r9.share_head(p_project)) order by g.created_at desc,g.id) from public.project_access_grants g join public.profiles p on p.id=g.recipient where g.project_id=p_project and (eflow_r9.share_head(p_project) or g.recipient=auth.uid())),'[]'),
 'can_remove_offices',coalesce((select jsonb_agg(office_id) from public.project_offices where project_id=p_project and eflow_r9.person_head(p_project,office_id)),'[]'),'can_remove_personal',eflow_r9.person_head(p_project,null),'timezone',coalesce((select w.timezone from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project),(select w.timezone from public.office_project_homes h join public.workspaces w on w.id=h.workspace_id where h.project_id=p_project),'Asia/Singapore'));
end $$;
create function eflow_r9.open_share(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.project_access_grants;v_was_member boolean;begin
 perform eflow_r3.actor();select * into g from public.project_access_grants where id=p_id and recipient=auth.uid();
 if g.id is null then raise exception 'Share belongs to another recipient or is unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||g.project_id::text,0));select * into g from public.project_access_grants where id=p_id for update;
 if g.revoked_at is not null or g.access_end<=now() or (g.engagement<>'Permanent' or g.until_close) and not eflow_r9.open(g.project_id) or g.redeemed_at is null and (g.redeem_expires_at<=now() or not eflow_r9.open(g.project_id)) then raise exception 'Share expired, revoked or project access ended' using errcode='42501';end if;
 if g.redeemed_at is null then
 if not eflow_r3.eligible(g.created_by) then raise exception 'Issuer identity is no longer eligible. Request fresh approval';end if;
 if g.access='member' and g.office_id is not null and not exists(select 1 from public.profiles where id=g.recipient and org_id=g.office_id) and not eflow_r8.guest(g.project_id,g.office_id,g.recipient) then raise exception 'Recipient Office or guest approval changed. Request fresh approval';end if;
 if g.access='member' and g.office_id is null and not exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id join public.profiles owner on owner.id=w.owner_id join public.profiles recipient on recipient.id=g.recipient where p.id=g.project_id and recipient.org_id=owner.org_id) and not exists(select 1 from public.personal_project_members m join public.project_invitation_requests r on r.project_id=m.project_id and r.accepted_by=m.user_id and r.state='accepted' where m.project_id=g.project_id and m.user_id=g.recipient and m.state='active' and m.access_ended_at is null and (m.access_end is null or m.access_end>now())) then raise exception 'Recipient sponsoring approval changed. Request fresh approval';end if;
 if g.office_id is not null and not exists(select 1 from public.projects p where p.id=g.project_id and p.org_id=g.office_id and public.phase2_is_office_head(g.created_by,p.org_id)) or g.office_id is null and not exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=g.project_id and (w.owner_id=g.created_by or public.phase2_is_office_head(g.created_by,w.sponsoring_office_id))) then raise exception 'Issuer authority changed. Request a fresh authorized share offer';end if;
 v_was_member:=eflow_r7.member(g.project_id,g.office_id,g.recipient);
 delete from eflow_r9.removed where project_id=g.project_id and user_id=g.recipient and scope=eflow_r9.scope(g.office_id);
 update public.project_access_grants set redeemed_at=now() where id=p_id;
 if g.access='member' and not coalesce(v_was_member,false) then perform eflow_r9.clear_staff(g.project_id,g.recipient,g.office_id);end if;
 insert into eflow_r9.events(project_id,actor,action,details) values(g.project_id,auth.uid(),'share_redeemed',to_jsonb(g));
 end if;
 return jsonb_build_object('project',g.project_id,'workspace',coalesce((select workspace_id from public.office_project_homes where project_id=g.project_id),(select workspace_id from public.personal_projects where id=g.project_id)),'access',g.access);
end $$;
-- Close permanently ends temporary grants. Restore never resurrects them.
create function eflow_r9.end_grants() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status in ('completed','archived') then update public.project_access_grants set revoked_at=coalesce(revoked_at,now()) where project_id=new.id and (engagement<>'Permanent' or until_close);end if;return new;
end $$;
create trigger r9_office_end after update of status on public.projects for each row execute function eflow_r9.end_grants();
create trigger r9_personal_end after update of status on public.personal_projects for each row execute function eflow_r9.end_grants();
create function public.r9_project_access(p_project uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.snapshot(p_project)$$;
create function public.r9_grant_access(p_id uuid,p_project uuid,p_email text,p_access text,p_engagement text,p_end timestamptz,p_close boolean,p_ttl integer default 7) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.grant_access(p_id,p_project,p_email,p_access,p_engagement,p_end,p_close,p_ttl)$$;
create function public.r9_removal_preview(p_project uuid,p_user uuid,p_office uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.preview(p_project,p_user,p_office)$$;
create function public.r9_remove_person(p_project uuid,p_user uuid,p_office uuid,p_fingerprint text,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.remove_person(p_project,p_user,p_office,p_fingerprint,p_request)$$;
create function public.r9_revoke_grant(p_id uuid) returns void language sql security invoker set search_path='' as $$select eflow_r9.revoke_grant(p_id)$$;
create function public.r9_open_share(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.open_share(p_id)$$;
revoke all on all functions in schema eflow_r9 from public,anon,authenticated,service_role;
grant execute on function eflow_r9.snapshot(uuid),eflow_r9.grant_access(uuid,uuid,text,text,text,timestamptz,boolean,integer),eflow_r9.preview(uuid,uuid,uuid),eflow_r9.remove_person(uuid,uuid,uuid,text,uuid),eflow_r9.revoke_grant(uuid),eflow_r9.open_share(uuid) to authenticated;
grant execute on function eflow_r9.share_head(uuid) to authenticated;
revoke all on function public.r9_project_access(uuid),public.r9_grant_access(uuid,uuid,text,text,text,timestamptz,boolean,integer),public.r9_removal_preview(uuid,uuid,uuid),public.r9_remove_person(uuid,uuid,uuid,text,uuid),public.r9_revoke_grant(uuid),public.r9_open_share(uuid) from public,anon,service_role;
grant execute on function public.r9_project_access(uuid),public.r9_grant_access(uuid,uuid,text,text,text,timestamptz,boolean,integer),public.r9_removal_preview(uuid,uuid,uuid),public.r9_remove_person(uuid,uuid,uuid,text,uuid),public.r9_revoke_grant(uuid),public.r9_open_share(uuid) to authenticated;
-- Batch selection uses the same full impact review and transaction as person removal.
create function eflow_r9.selection_impact(p_office uuid,p_users uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare o public.project_offices;removed jsonb;roster jsonb;begin
 select * into o from public.project_offices where id=p_office;
 if not eflow_r9.person_head(o.project_id,o.office_id) then raise exception 'Own appointed Head required' using errcode='42501';end if;
 if p_users is null or cardinality(p_users)>200 or exists(select 1 from unnest(p_users) uid where not exists(select 1 from public.profiles where id=uid and org_id=o.office_id and eflow_r3.eligible(uid))) then raise exception 'Choose active verified own-Office people';end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by user_id),'[]') into roster from public.project_office_members m where project_office_id=p_office;
 select coalesce(jsonb_agg(eflow_r9.impact(o.project_id,m.user_id,o.office_id) order by m.user_id),'[]') into removed from public.project_office_members m where project_office_id=p_office and m.access_ended_at is null and not m.user_id=any(p_users);
 return jsonb_build_object('fingerprint',md5(jsonb_build_array(roster,removed,p_users)::text),'removed',removed);
end $$;
create function eflow_r9.select_members(p_office uuid,p_users uuid[],p_fingerprint text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.project_offices;v jsonb;r eflow_r9.receipts;uid uuid;payload jsonb:=jsonb_build_array(p_office,p_users,p_fingerprint);result jsonb;begin
 perform eflow_r3.actor();select * into o from public.project_offices where id=p_office;
 perform pg_advisory_xact_lock(hashtextextended('r9:'||o.project_id::text,0));
 if not eflow_r9.person_head(o.project_id,o.office_id) or not eflow_r9.open(o.project_id) or p_request is null then raise exception 'Open project and current own Head required';end if;
 select * into r from eflow_r9.receipts where actor=auth.uid() and request=p_request;
 if found then if r.payload<>payload then raise exception 'Request ID reused';end if;return r.result;end if;
 v:=eflow_r9.selection_impact(p_office,p_users);if v->>'fingerprint' is distinct from p_fingerprint then raise exception 'Membership or assignments changed. Refresh selection impact.' using errcode='40001';end if;
 for uid in select (x->>'user')::uuid from jsonb_array_elements(v->'removed') x loop
 perform eflow_r9.remove_person(o.project_id,uid,o.office_id,md5(eflow_r9.impact(o.project_id,uid,o.office_id)::text),md5(p_request::text||uid::text)::uuid);
 end loop;
 if exists(select 1 from public.project_office_members where project_office_id=p_office and user_id=any(p_users) and (access_ended_at is not null or access_end<=now())) then raise exception 'Explicitly renew ended access terms in Members before selecting that person';end if;
 insert into public.project_office_members(project_office_id,user_id,selected_by) select p_office,chosen.user_id,auth.uid() from unnest(p_users) chosen(user_id) on conflict do nothing;
 result:=to_jsonb(p_users);insert into eflow_r9.receipts values(auth.uid(),p_request,payload,result);return result;
end $$;
create function public.r9_selection_preview(p_office uuid,p_users uuid[]) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.selection_impact(p_office,p_users)$$;
create function public.r9_select_members(p_office uuid,p_users uuid[],p_fingerprint text,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.select_members(p_office,p_users,p_fingerprint,p_request)$$;
revoke all on function public.r9_selection_preview(uuid,uuid[]),public.r9_select_members(uuid,uuid[],text,uuid),eflow_r9.selection_impact(uuid,uuid[]),eflow_r9.select_members(uuid,uuid[],text,uuid) from public,anon,service_role;
grant execute on function public.r9_selection_preview(uuid,uuid[]),public.r9_select_members(uuid,uuid[],text,uuid),eflow_r9.selection_impact(uuid,uuid[]),eflow_r9.select_members(uuid,uuid[],text,uuid) to authenticated;
-- Explicit renewal never restores assignments. Guests require a new R8 Head-approved invitation.
create function eflow_r9.renew(p_project uuid,p_user uuid,p_office uuid,p_engagement text,p_end timestamptz,p_until_close boolean,p_expected jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare old_terms jsonb;result jsonb;r eflow_r9.receipts;payload jsonb:=jsonb_build_array(p_project,p_user,p_office,p_engagement,p_end,p_until_close,p_expected);begin
 perform eflow_r3.actor();perform pg_advisory_xact_lock(hashtextextended('r9:'||p_project::text,0));
 if not eflow_r9.person_head(p_project,p_office) or not eflow_r9.open(p_project) or p_request is null then raise exception 'Open project and current responsible authority required';end if;
 select * into r from eflow_r9.receipts where actor=auth.uid() and request=p_request;if found then if r.payload<>payload then raise exception 'Request ID reused';end if;return r.result;end if;
 if p_office is null then select jsonb_build_object('engagement',engagement,'access_end',access_end,'until_close',until_close,'access_ended_at',access_ended_at) into old_terms from public.personal_project_members where project_id=p_project and user_id=p_user;
 else select jsonb_build_object('engagement',m.engagement,'access_end',m.access_end,'until_close',m.until_close,'access_ended_at',m.access_ended_at) into old_terms from public.project_office_members m join public.project_offices o on o.id=m.project_office_id where o.project_id=p_project and o.office_id=p_office and m.user_id=p_user;end if;
 if p_office is null and exists(select 1 from public.project_invitation_requests where project_id=p_project and accepted_by=p_user and state='accepted') then raise exception 'Guest renewal requires a new sponsoring Head-approved invitation';end if;
 if old_terms is null or old_terms is distinct from p_expected then raise exception 'Access terms changed. Reload Members before renewal';end if;
 if not eflow_r7.member(p_project,p_office,p_user) then perform eflow_r9.clear_staff(p_project,p_user,p_office);end if;
 result:=eflow_r7.member_terms(p_project,p_user,p_office,p_engagement,p_end,p_until_close);
 if p_office is null then update public.personal_project_members set state='active',access_ended_at=null where project_id=p_project and user_id=p_user;else update public.project_office_members m set access_ended_at=null from public.project_offices o where o.id=m.project_office_id and o.project_id=p_project and o.office_id=p_office and m.user_id=p_user;end if;
 delete from eflow_r9.removed where project_id=p_project and user_id=p_user and scope=eflow_r9.scope(p_office);
 result:=result||jsonb_build_object('access_ended_at',null)||case when p_office is null then jsonb_build_object('state','active') else '{}'::jsonb end;
 insert into eflow_r9.events(project_id,actor,action,details) values(p_project,auth.uid(),'member_reapproved',jsonb_build_object('user',p_user,'before',old_terms,'after',result));
 insert into eflow_r9.receipts values(auth.uid(),p_request,payload,result);return result;
end $$;
create function public.r9_member_terms(p_project uuid,p_user uuid,p_office uuid,p_engagement text,p_end timestamptz,p_until_close boolean,p_expected jsonb,p_request uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r9.renew(p_project,p_user,p_office,p_engagement,p_end,p_until_close,p_expected,p_request)$$;
revoke all on function eflow_r9.renew(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid),public.r9_member_terms(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid) from public,anon,service_role;
grant execute on function eflow_r9.renew(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid),public.r9_member_terms(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid) to authenticated;
-- Direct personal grants are discoverable in their own workspace and member pickers.
do $$declare d text;begin
 select pg_get_functiondef('eflow_r3.workspace_access(uuid)'::regprocedure) into d;execute replace(d,'FUNCTION eflow_r3.workspace_access(','FUNCTION eflow_r9.baseline_workspace_access(');
 select pg_get_functiondef('eflow_r7.project_members(uuid)'::regprocedure) into d;execute replace(d,'FUNCTION eflow_r7.project_members(','FUNCTION eflow_r9.baseline_project_members(');
 select pg_get_functiondef('public.r3_personal_project_snapshot(uuid)'::regprocedure) into d;execute replace(d,'FUNCTION public.r3_personal_project_snapshot(','FUNCTION eflow_r9.baseline_personal_snapshot(');
 -- Fresh guest acceptance is explicit Head reapproval; clear only its own removed scope.
 select pg_get_functiondef('public.r8_accept(text,uuid,text,uuid)'::regprocedure) into d;
 d:=replace(d,'if p.kind=''office'' then', 'if p.kind=''office'' then update public.project_guest_members set ended_at=now() where project_id=p.project_id and office_id=p.office_id and user_id=p_user and ended_at is null and access_end<=now();');
 d:=replace(d,'if exists(select 1 from public.personal_project_members where project_id=p.project_id', 'update public.personal_project_members set access_ended_at=now() where project_id=p.project_id and user_id=p_user and access_ended_at is null and access_end<=now(); if exists(select 1 from public.personal_project_members where project_id=p.project_id');
 d:=replace(d,'return jsonb_build_object(''accepted'',true', 'perform eflow_r9.clear_staff(p.project_id,p_user,case when p.kind=''office'' then p.office_id end); return jsonb_build_object(''accepted'',true');
 d:=replace(d,'update public.project_invitation_requests set state=''accepted''','delete from eflow_r9.removed where project_id=p.project_id and user_id=p_user and scope=eflow_r9.scope(case when p.kind=''office'' then p.office_id end); update public.project_invitation_requests set state=''accepted''');execute d;
end $$;
create or replace function eflow_r3.workspace_access(p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$select eflow_r9.baseline_workspace_access(p_workspace) or exists(select 1 from public.personal_projects p where p.workspace_id=p_workspace and eflow_r3.project_access(p.id))$$;
create or replace function eflow_r7.project_members(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;extra jsonb;begin
 result:=eflow_r9.baseline_project_members(p_project);
 result:=result||jsonb_build_object('timezone',eflow_r9.snapshot(p_project)->>'timezone');
 select coalesce(jsonb_agg(jsonb_build_object('user_id',g.recipient,'name',u.full_name,'office',g.office_id,'office_name','Project share','engagement',g.engagement,'access_end',g.access_end,'until_close',g.until_close,'access_ended_at',g.revoked_at,'eligible',eflow_r9.granted(p_project,g.recipient,true,g.office_id),'can_read',eflow_r9.granted(p_project,g.recipient,false,g.office_id),'access',g.access,'state','share','grant_id',g.id,'responsibilities','[]'::jsonb) order by u.full_name),'[]') into extra from (select distinct on (recipient,office_id) * from public.project_access_grants g where g.project_id=p_project and g.revoked_at is null and g.redeemed_at is not null order by recipient,office_id,eflow_r9.grant_valid(g,true) desc,eflow_r9.grant_valid(g) desc,created_at desc,id) g join public.profiles u on u.id=g.recipient where g.project_id=p_project and not exists(select 1 from jsonb_array_elements(result->'members') m where m->>'user_id'=g.recipient::text and (m->>'office')::uuid is not distinct from g.office_id);
 result:=jsonb_set(result,'{members}',(select coalesce(jsonb_agg(m||jsonb_build_object('eligible',eflow_r7.member(p_project,(m->>'office')::uuid,(m->>'user_id')::uuid),'can_read',coalesce((m->>'can_read')::boolean,false) or eflow_r9.granted(p_project,(m->>'user_id')::uuid),'state',case when exists(select 1 from public.project_invitation_requests r where r.project_id=p_project and r.accepted_by=(m->>'user_id')::uuid and r.state='accepted' and r.kind='personal') then 'guest' else m->>'state' end)),'[]') from jsonb_array_elements(result->'members') m));
 return jsonb_set(result,'{members}',result->'members'||extra);
end $$;
create or replace function public.r3_personal_project_snapshot(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 result:=eflow_r9.baseline_personal_snapshot(p_project);result:=jsonb_set(result,'{members}',(select coalesce(jsonb_agg(m||jsonb_build_object('state',case when (m->>'can_read')::boolean then 'active' else 'ended' end)),'[]') from jsonb_array_elements(eflow_r7.project_members(p_project)->'members') m));return result;
end $$;
revoke all on function eflow_r9.baseline_workspace_access(uuid),eflow_r9.baseline_project_members(uuid),eflow_r9.baseline_personal_snapshot(uuid) from public,anon,authenticated,service_role;
do $$declare d text;begin
 select pg_get_functiondef('eflow_r7.end_members()'::regprocedure) into d;d:=replace(d,'m.engagement<>''Permanent''','(m.engagement<>''Permanent'' or m.until_close)');d:=replace(d,'and engagement<>''Permanent''','and (engagement<>''Permanent'' or until_close)');execute d;
 select pg_get_functiondef('eflow_r8.end_guests()'::regprocedure) into d;d:=replace(d,'engagement<>''Permanent''','(engagement<>''Permanent'' or until_close)');execute d;
end $$;
-- Accepted guest revocation must use the reviewed removal path, never leave stale staffing.
do $$declare d text;begin
 select pg_get_functiondef('eflow_r8.decide(uuid,integer,text)'::regprocedure) into d;
 d:=replace(d,'elsif p_action=''revoked'' then','elsif p_action=''revoked'' then if p.state=''accepted'' then raise exception ''Review removal in Members to clear assignments and revoke accepted membership'';end if;');execute d;
end $$;
-- Legacy callers retain additive selection and term changes. Ending a person uses
-- the complete reviewed impact; extending expired terms also clears stale work.
do $$declare d text;begin
 select pg_get_functiondef('public.phase6_set_members(uuid,uuid[])'::regprocedure) into d;
 d:=replace(d,'delete from public.project_office_members where project_office_id=o.id and not user_id=any(p_users);',
 'if exists(select 1 from public.project_office_members where project_office_id=o.id and not user_id=any(p_users)) then raise exception ''Review removal in Members before ending selected project access'';end if;');execute d;
 select pg_get_functiondef('eflow_r7.member_terms_checked(uuid,uuid,uuid,text,timestamptz,boolean,jsonb,uuid)'::regprocedure) into d;
 d:=replace(d,'v_result:=eflow_r7.member_terms(', 'if not eflow_r7.member(p_project,p_office,p_user) then perform eflow_r9.clear_staff(p_project,p_user,p_office);end if; v_result:=eflow_r7.member_terms(');execute d;
 select pg_get_functiondef('public.r3_personal_project_command(uuid,text,jsonb,uuid)'::regprocedure) into d;
 d:=replace(d,'if selected=actor then', 'if p_payload->>''state''<>''active'' then raise exception ''Review removal in Members before ending personal membership'';end if; if not eflow_r3.valid_member(p_project,selected) then perform eflow_r9.clear_staff(p_project,selected,null);end if; if selected=actor then');execute d;
end $$;
create function eflow_r9.guard_execution() returns trigger language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is not null and new.linked_project_id is not null and new.source_collaboration_draft_id is null and not eflow_r9.internal(new.linked_project_id)
 and (tg_op='INSERT' or new.status is distinct from old.status or new.percent_complete is distinct from old.percent_complete)
 and (new.status in ('in_progress','for_review','completed') or new.percent_complete>coalesce(old.percent_complete,0))
 and not eflow_r7.member(new.linked_project_id,new.org_id,coalesce(new.assigned_to,new.recommendation_lead_id)) then raise exception 'Needs reassignment: appoint an active selected task Lead before execution' using errcode='42501';end if;return new;
end $$;
revoke all on function eflow_r9.guard_execution() from public,anon,authenticated,service_role;
create trigger r9_execution before insert or update on public.tasks for each row execute function eflow_r9.guard_execution();
commit;
