-- R3 additive, versioned scope. Office project/task/finance/evidence contracts stay intact.
-- Reviewed backfill/rollback contract: docs/product-refinement/r3-workspace-schema.md.
begin;
create schema eflow_r3;
revoke all on schema eflow_r3 from public;
grant usage on schema eflow_r3 to authenticated;

create table public.workspaces (
 id uuid primary key default extensions.gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 120),
 kind text not null check(kind in ('office','personal')),
 office_id uuid unique references public.organizations(id),
 owner_id uuid references public.profiles(id),
 state text not null default 'active' check(state in ('active','ended')),
 timezone text not null default 'Asia/Singapore',
 created_at timestamptz not null default now(),
 check((kind='office' and office_id is not null and owner_id is null and id=office_id)
    or (kind='personal' and office_id is null and owner_id is not null))
);
create table public.workspace_members (
 workspace_id uuid references public.workspaces(id) on delete cascade,
 user_id uuid references public.profiles(id),
 state text not null default 'active' check(state in ('active','ended','revoked')),
 primary key(workspace_id,user_id)
);
create table public.office_project_homes (
 project_id uuid primary key references public.projects(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id)
);
create table eflow_r3.backfill_exceptions (
 project_id uuid primary key references public.projects(id) on delete cascade,
 reason text not null, recorded_at timestamptz not null default now()
);
create table public.personal_projects (
 id uuid primary key default extensions.gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 title text not null check(length(btrim(title)) between 1 and 200),
 description text not null default '',
 workflow_mode text not null default 'personal' check(workflow_mode='personal'),
 status text not null default 'active' check(status in ('active','completed','archived')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 revision integer not null default 1
);
create index personal_projects_workspace on public.personal_projects(workspace_id);
create table public.personal_project_members (
 project_id uuid references public.personal_projects(id) on delete cascade,
 user_id uuid references public.profiles(id),
 access text not null check(access in ('member','viewer')),
 state text not null default 'active' check(state in ('active','ended','revoked')),
 primary key(project_id,user_id)
);
create table public.personal_tasks (
 id uuid primary key default extensions.gen_random_uuid(),
 project_id uuid not null references public.personal_projects(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 200),
 lead_id uuid not null references public.profiles(id),
 reviewer_id uuid references public.profiles(id),
 status text not null default 'todo' check(status in ('todo','in_progress','submitted','done')),
 progress integer not null default 0 check(progress between 0 and 100),
 note text not null default '' check(length(note)<=4000),
 review_note text not null default '' check(length(review_note)<=4000),
 submitted_by uuid references public.profiles(id),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 check(reviewer_id is distinct from lead_id)
);
create index personal_tasks_project on public.personal_tasks(project_id);
create table public.personal_work_events (
 id uuid primary key default extensions.gen_random_uuid(),
 project_id uuid not null references public.personal_projects(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),
 command text not null, payload jsonb not null, result jsonb not null,
 occurred_at timestamptz not null default now()
);
create table public.personal_project_shortcuts (
 project_id uuid references public.personal_projects(id) on delete cascade,
 office_workspace_id uuid references public.workspaces(id),
 created_by uuid not null references public.profiles(id),
 primary key(project_id,office_workspace_id)
);
create table eflow_r3.receipts (
 actor_id uuid not null, request_id uuid not null,
 operation text not null, payload jsonb not null, result jsonb not null,
 primary key(actor_id,request_id)
);

-- Helpers accept no caller-supplied actor. Verified, active operational identity required.
create function eflow_r3.eligible(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join auth.users u on u.id=p.id
 where p.id=p_user and p.is_active and p.role in ('head','member','accounting_staff') and u.email_confirmed_at is not null)
$$;
create function eflow_r3.actor() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if not eflow_r3.eligible(auth.uid()) then raise exception 'Active verified operational identity required' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function eflow_r3.personal_owner(p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and exists(select 1 from public.workspaces w
 where w.id=p_workspace and w.kind='personal' and w.state='active' and w.owner_id=auth.uid())
$$;
create function eflow_r3.project_access(p_project uuid,p_edit boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id
 where p.id=p_project and w.kind='personal' and w.state='active' and
 (w.owner_id=auth.uid() or exists(select 1 from public.workspace_members wm join public.personal_project_members pm on pm.user_id=wm.user_id
 where wm.workspace_id=w.id and wm.user_id=auth.uid() and wm.state='active' and pm.project_id=p.id and pm.state='active' and (pm.access='member' or (not p_edit and p.status='active')))))
$$;
create function eflow_r3.workspace_access(p_workspace uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(auth.uid()) and exists(select 1 from public.workspaces w where w.id=p_workspace and w.state='active' and
 ((w.kind='personal' and (w.owner_id=auth.uid() or exists(select 1 from public.workspace_members wm where wm.workspace_id=w.id and wm.user_id=auth.uid() and wm.state='active'
 and exists(select 1 from public.personal_projects p where p.workspace_id=w.id and eflow_r3.project_access(p.id)))))
 or (w.kind='office' and exists(select 1 from public.organizations o where o.id=w.office_id and o.is_active) and
 (exists(select 1 from public.profiles p where p.id=auth.uid() and p.org_id=w.office_id)
 or exists(select 1 from public.office_project_homes h where h.workspace_id=w.id and public.can_see_project(h.project_id,auth.uid()))))))
$$;
create function eflow_r3.valid_member(p_project uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(p_user) and exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id
 where p.id=p_project and w.state='active' and (w.owner_id=p_user or exists(select 1 from public.personal_project_members pm join public.workspace_members wm on wm.user_id=pm.user_id and wm.workspace_id=w.id
 where pm.project_id=p.id and pm.user_id=p_user and pm.access='member' and pm.state='active' and wm.state='active')))
$$;

insert into public.workspaces(id,name,kind,office_id) select id,name,'office',id from public.organizations;
-- Canonical project.org_id wins. Only one joined lead is a fallback; ambiguity stays explicit.
insert into public.office_project_homes(project_id,workspace_id)
 select p.id,coalesce(p.org_id,(select min(o.office_id::text)::uuid from public.project_offices o where o.project_id=p.id and o.relationship_type='lead' and o.invitation_status='joined'
 having count(*)=1)) from public.projects p
 where p.org_id is not null or (select count(*) from public.project_offices o where o.project_id=p.id and o.relationship_type='lead' and o.invitation_status='joined')=1;
insert into eflow_r3.backfill_exceptions(project_id,reason)
 select p.id,'No unique canonical Office home; retain legacy authorized visibility pending explicit resolution' from public.projects p where not exists(select 1 from public.office_project_homes h where h.project_id=p.id);

create function eflow_r3.sync_office() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.workspaces(id,name,kind,office_id) values(new.id,new.name,'office',new.id)
 on conflict(id) do update set name=excluded.name;
 return new;
end $$;
create trigger r3_workspace_office after insert or update of name on public.organizations for each row execute function eflow_r3.sync_office();
create function eflow_r3.sync_project_home() returns trigger language plpgsql security definer set search_path='' as $$
declare home uuid;
begin
 home:=new.org_id;
 if home is null then select min(o.office_id::text)::uuid into home from public.project_offices o where o.project_id=new.id and o.relationship_type='lead' and o.invitation_status='joined' having count(*)=1; end if;
 if home is not null then
 insert into public.office_project_homes values(new.id,home) on conflict(project_id) do update set workspace_id=excluded.workspace_id;
 delete from eflow_r3.backfill_exceptions where project_id=new.id;
 else
 delete from public.office_project_homes where project_id=new.id;
 insert into eflow_r3.backfill_exceptions(project_id,reason) values(new.id,'No unique canonical Office home') on conflict(project_id) do nothing;
 end if;
 return new;
end $$;
create trigger r3_project_home after insert or update of org_id on public.projects for each row execute function eflow_r3.sync_project_home();
-- A caller-provided request UUID cannot alias legacy evidence/finance identities.
create function eflow_r3.disjoint_id() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text,1));
 if (tg_table_name='personal_projects' and exists(select 1 from public.projects where id=new.id))
 or (tg_table_name='projects' and exists(select 1 from public.personal_projects where id=new.id))
 or (tg_table_name='personal_tasks' and (exists(select 1 from public.tasks where id=new.id) or exists(select 1 from public.subtasks where id=new.id)))
 or (tg_table_name in ('tasks','subtasks') and exists(select 1 from public.personal_tasks where id=new.id)) then
 raise exception 'Personal and Office identities must be disjoint' using errcode='22023';
 end if;
 return new;
end $$;
create trigger r3_personal_project_id before insert or update of id on public.personal_projects for each row execute function eflow_r3.disjoint_id();
create trigger r3_office_project_id before insert or update of id on public.projects for each row execute function eflow_r3.disjoint_id();
create trigger r3_personal_task_id before insert or update of id on public.personal_tasks for each row execute function eflow_r3.disjoint_id();
create trigger r3_office_task_id before insert or update of id on public.tasks for each row execute function eflow_r3.disjoint_id();
create trigger r3_office_subtask_id before insert or update of id on public.subtasks for each row execute function eflow_r3.disjoint_id();

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.office_project_homes enable row level security;
alter table public.personal_projects enable row level security;
alter table public.personal_project_members enable row level security;
alter table public.personal_tasks enable row level security;
alter table public.personal_project_shortcuts enable row level security;
alter table public.personal_work_events enable row level security;
create policy r3_workspace_read on public.workspaces for select to authenticated using(eflow_r3.workspace_access(id));
create policy r3_workspace_member_read on public.workspace_members for select to authenticated using(eflow_r3.workspace_access(workspace_id) and (user_id=auth.uid() or eflow_r3.personal_owner(workspace_id)));
create policy r3_office_home_read on public.office_project_homes for select to authenticated using(eflow_r3.eligible(auth.uid()) and public.can_see_project(project_id,auth.uid()));
create policy r3_personal_project_read on public.personal_projects for select to authenticated using(eflow_r3.project_access(id));
create policy r3_personal_member_read on public.personal_project_members for select to authenticated using(eflow_r3.project_access(project_id));
create policy r3_personal_task_read on public.personal_tasks for select to authenticated using(eflow_r3.project_access(project_id));
create policy r3_personal_shortcut_read on public.personal_project_shortcuts for select to authenticated using(eflow_r3.project_access(project_id) and eflow_r3.workspace_access(office_workspace_id));
create policy r3_personal_event_read on public.personal_work_events for select to authenticated using(eflow_r3.project_access(project_id));
revoke all on public.workspaces,public.workspace_members,public.office_project_homes,public.personal_projects,public.personal_project_members,public.personal_tasks,public.personal_project_shortcuts,public.personal_work_events from anon,authenticated;
grant select on public.workspaces,public.workspace_members,public.office_project_homes,public.personal_projects,public.personal_project_members,public.personal_tasks,public.personal_project_shortcuts,public.personal_work_events to authenticated;
-- No personal table is in supabase_realtime; polling always rechecks current grants.
-- No personal Storage bucket or evidence/PDS adapter is introduced here.

create function public.r3_list_workspaces() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();
 return coalesce((select jsonb_agg(to_jsonb(w)||jsonb_build_object('owner_name',p.full_name) order by w.kind,w.name,w.id)
 from public.workspaces w left join public.profiles p on p.id=w.owner_id where eflow_r3.workspace_access(w.id)),'[]'::jsonb);
end $$;
create function public.r3_select_workspace(p_workspace uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare w public.workspaces; projects jsonb;
begin
 perform eflow_r3.actor();
 if not eflow_r3.workspace_access(p_workspace) then raise exception 'Workspace access denied' using errcode='42501'; end if;
 select * into w from public.workspaces where id=p_workspace;
 if w.kind='personal' then
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('kind','personal','home_workspace_id',p.workspace_id) order by p.created_at desc,p.id),'[]') into projects from public.personal_projects p where p.workspace_id=w.id and eflow_r3.project_access(p.id);
 else
 select coalesce(jsonb_agg(item order by created_at desc,id),'[]') into projects from (
 select p.id,p.created_at,to_jsonb(p)||jsonb_build_object('kind','office','home_workspace_id',h.workspace_id) item from public.projects p left join public.office_project_homes h on h.project_id=p.id
 where public.can_see_project(p.id,auth.uid()) and (h.workspace_id=w.id or exists(select 1 from public.project_offices o where o.project_id=p.id and o.office_id=w.office_id and o.invitation_status in ('joined','awaiting_head'))
 or h.project_id is null or exists(select 1 from public.project_office_identities i where i.project_id=p.id and i.contact_user_id=auth.uid() and i.contact_status='accepted'))
 union all
 select p.id,p.created_at,to_jsonb(p)||jsonb_build_object('kind','personal','home_workspace_id',p.workspace_id,'shortcut',true) from public.personal_projects p join public.personal_project_shortcuts s on s.project_id=p.id
 where s.office_workspace_id=w.id and eflow_r3.project_access(p.id)
 ) items;
 end if;
 return jsonb_build_object('workspace',to_jsonb(w)||jsonb_build_object('owner_name',(select full_name from public.profiles where id=w.owner_id)),'projects',projects);
end $$;

create function public.r3_create_workspace(p_request uuid,p_name text,p_timezone text default 'Asia/Singapore') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=eflow_r3.actor(); w public.workspaces;
begin
 if p_request is null or length(btrim(p_name)) not between 1 and 120 or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Invalid workspace name or timezone' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
 select * into w from public.workspaces where id=p_request;
 if found then
 if w.kind<>'personal' or w.owner_id<>actor or w.name<>btrim(p_name) or w.timezone<>p_timezone then raise exception 'Workspace request conflict' using errcode='22023'; end if;
 return to_jsonb(w);
 end if;
 insert into public.workspaces(id,name,kind,owner_id,timezone) values(p_request,btrim(p_name),'personal',actor,p_timezone) returning * into w;
 insert into public.workspace_members values(w.id,actor,'active');
 return to_jsonb(w);
end $$;
create function public.r3_create_personal_project(p_workspace uuid,p_request uuid,p_title text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=eflow_r3.actor(); p public.personal_projects;
begin
 if not eflow_r3.personal_owner(p_workspace) then raise exception 'Personal workspace owner required' using errcode='42501'; end if;
 if p_request is null or length(btrim(p_title)) not between 1 and 200 then raise exception 'Invalid project title' using errcode='22023'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 select * into p from public.personal_projects where id=p_request;
 if found then
 if p.workspace_id<>p_workspace or p.created_by<>actor or p.title<>btrim(p_title) then raise exception 'Project request conflict' using errcode='22023'; end if;
 return to_jsonb(p);
 end if;
 insert into public.personal_projects(id,workspace_id,title,created_by) values(p_request,p_workspace,btrim(p_title),actor) returning * into p;
 insert into public.personal_project_members values(p.id,actor,'member','active');
 return to_jsonb(p);
end $$;
create function public.r3_personal_project_snapshot(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();
 if not eflow_r3.project_access(p_project) then raise exception 'Project access denied' using errcode='42501'; end if;
 return jsonb_build_object('project',(select to_jsonb(p) from public.personal_projects p where p.id=p_project),
 'owner',(select w.owner_id from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.personal_tasks t where t.project_id=p_project),'[]'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('name',p.full_name,'eligible',eflow_r3.valid_member(p_project,m.user_id))) from public.personal_project_members m join public.profiles p on p.id=m.user_id where m.project_id=p_project),'[]'),
 'shortcuts',coalesce((select jsonb_agg(s.office_workspace_id) from public.personal_project_shortcuts s where s.project_id=p_project),'[]'));
end $$;
-- Already-onboarded own-Office candidates only. No cross-Office directory or email dispatch.
create function public.r3_personal_member_candidates(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform eflow_r3.actor();
 if not exists(select 1 from public.personal_projects p where p.id=p_project and eflow_r3.personal_owner(p.workspace_id)) then raise exception 'Personal workspace owner required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name) order by p.full_name,p.id) from public.profiles p
 where eflow_r3.eligible(p.id) and (p.id=auth.uid() or p.org_id=(select org_id from public.profiles where id=auth.uid()))),'[]');
end $$;

create function public.r3_personal_project_command(p_project uuid,p_command text,p_payload jsonb,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=eflow_r3.actor(); p public.personal_projects; t public.personal_tasks; receipt eflow_r3.receipts; owner boolean; selected uuid; office uuid; result jsonb;
begin
 if p_request is null or p_payload is null then raise exception 'Invalid request' using errcode='22023'; end if;
 select * into p from public.personal_projects where id=p_project for update;
 if not found or not eflow_r3.project_access(p_project,true) then raise exception 'Project edit access denied' using errcode='42501'; end if;
 owner:=eflow_r3.personal_owner(p.workspace_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||p_request::text,0));
 select * into receipt from eflow_r3.receipts where actor_id=actor and request_id=p_request;
 if found then
 if receipt.operation<>p_project::text||':'||p_command or receipt.payload<>p_payload then raise exception 'Request conflict' using errcode='22023'; end if;
 return receipt.result;
 end if;
 if p.status<>'active' and not (p.status='completed' and p_command='archive_project') then raise exception 'Personal project is closed' using errcode='22023'; end if;
 if p_command in ('set_member','create_task','staff_task','complete_project','archive_project','shortcut') and not owner then raise exception 'Personal workspace owner required' using errcode='42501'; end if;
 if p_command='set_member' then
 selected:=(p_payload->>'user_id')::uuid;
 if selected=actor then raise exception 'Workspace owner membership is mandatory' using errcode='22023'; end if;
 if not eflow_r3.eligible(selected) or not exists(select 1 from public.profiles target join public.profiles me on me.id=actor where target.id=selected and target.org_id=me.org_id) then raise exception 'Choose an active verified own-Office identity' using errcode='42501'; end if;
 if p_payload->>'access' not in ('viewer','member') or p_payload->>'state' not in ('active','ended','revoked') or not p_payload ?& array['access','state'] then raise exception 'Invalid membership terms' using errcode='22023'; end if;
 if (p_payload->>'state'<>'active' or p_payload->>'access'<>'member') and exists(select 1 from public.personal_tasks where project_id=p.id and status<>'done' and (lead_id=selected or reviewer_id=selected)) then raise exception 'Resolve unfinished personal assignments before removal or Viewer access' using errcode='22023'; end if;
 insert into public.workspace_members values(p.workspace_id,selected,'active') on conflict(workspace_id,user_id) do update set state='active';
 insert into public.personal_project_members values(p.id,selected,p_payload->>'access',p_payload->>'state') on conflict(project_id,user_id) do update set access=excluded.access,state=excluded.state;
 result:=jsonb_build_object('user_id',selected,'state',p_payload->>'state');
 elsif p_command='create_task' then
 if length(btrim(p_payload->>'title')) not between 1 and 200 or not p_payload ? 'title' then raise exception 'Invalid task title' using errcode='22023'; end if;
 selected:=(p_payload->>'lead_id')::uuid;
 if not eflow_r3.valid_member(p.id,selected) then raise exception 'Choose an active project member as lead' using errcode='42501'; end if;
 if nullif(p_payload->>'reviewer_id','') is not null and not eflow_r3.valid_member(p.id,(p_payload->>'reviewer_id')::uuid) then raise exception 'Choose an active project member as reviewer' using errcode='42501'; end if;
 if selected=(p_payload->>'reviewer_id')::uuid then raise exception 'Independent reviewer cannot review own work' using errcode='22023'; end if;
 insert into public.personal_tasks(id,project_id,title,lead_id,reviewer_id) values(p_request,p.id,btrim(p_payload->>'title'),selected,nullif(p_payload->>'reviewer_id','')::uuid) returning * into t;
 result:=to_jsonb(t);
 elsif p_command in ('progress_task','submit_task','review_task','staff_task') then
 select * into t from public.personal_tasks where id=(p_payload->>'task_id')::uuid and project_id=p.id for update;
 if not found or t.revision is distinct from (p_payload->>'revision')::integer then raise exception 'Task changed; refresh before continuing' using errcode='40001'; end if;
 if p_command='staff_task' then
 selected:=(p_payload->>'lead_id')::uuid;
 if t.status='done' or not eflow_r3.valid_member(p.id,selected) then raise exception 'Choose active lead for unfinished work' using errcode='42501'; end if;
 if t.reviewer_id is not null and nullif(p_payload->>'reviewer_id','') is null then raise exception 'Required independent review cannot be waived by staffing' using errcode='22023'; end if;
 if nullif(p_payload->>'reviewer_id','') is not null and not eflow_r3.valid_member(p.id,(p_payload->>'reviewer_id')::uuid) then raise exception 'Choose an active independent reviewer' using errcode='42501'; end if;
 if selected=(p_payload->>'reviewer_id')::uuid then raise exception 'Independent reviewer cannot review own work' using errcode='22023'; end if;
 -- Staffing reopens a submission; an owner cannot silently waive a submitted review.
 update public.personal_tasks set lead_id=selected,reviewer_id=nullif(p_payload->>'reviewer_id','')::uuid,status='in_progress',submitted_by=null,revision=revision+1 where id=t.id returning * into t;
 elsif p_command='review_task' then
 if t.reviewer_id is distinct from actor or t.submitted_by=actor or not eflow_r3.valid_member(p.id,actor) or not eflow_r3.valid_member(p.id,t.lead_id) or t.status<>'submitted' then raise exception 'Appointed independent reviewer required' using errcode='42501'; end if;
 if p_payload->>'decision' not in ('approve','reject') or not p_payload ? 'decision' then raise exception 'Invalid review decision' using errcode='22023'; end if;
 update public.personal_tasks set status=case when p_payload->>'decision'='approve' then 'done' else 'in_progress' end,review_note=coalesce(p_payload->>'note',''),revision=revision+1 where id=t.id returning * into t;
 else
 if t.lead_id<>actor or not eflow_r3.valid_member(p.id,actor) or t.status not in ('todo','in_progress') then raise exception 'Current task lead required' using errcode='42501'; end if;
 if p_command='submit_task' and t.reviewer_id is not null and not eflow_r3.valid_member(p.id,t.reviewer_id) then raise exception 'Required reviewer is no longer active' using errcode='42501'; end if;
 update public.personal_tasks set status=case when p_command='progress_task' then 'in_progress' when reviewer_id is null then 'done' else 'submitted' end,
 progress=case when p_command='progress_task' then (p_payload->>'progress')::integer else 100 end,
 note=coalesce(p_payload->>'note',''),submitted_by=case when p_command='submit_task' then actor else null end,revision=revision+1 where id=t.id returning * into t;
 end if;
 result:=to_jsonb(t);
 elsif p_command='complete_project' then
 if exists(select 1 from public.personal_tasks where project_id=p.id and status<>'done') then raise exception 'Finish work and required independent reviews before closeout' using errcode='22023'; end if;
 update public.personal_projects set status='completed',revision=revision+1 where id=p.id returning * into p;
 result:=to_jsonb(p);
 elsif p_command='archive_project' then
 update public.personal_projects set status='archived',revision=revision+1 where id=p.id returning * into p;
 result:=to_jsonb(p);
 elsif p_command='shortcut' then
 office:=(p_payload->>'office_workspace_id')::uuid;
 if not exists(select 1 from public.workspaces w join public.profiles me on me.id=actor and me.org_id=w.office_id where w.id=office and w.kind='office' and eflow_r3.workspace_access(w.id)) then raise exception 'Choose your canonical Office workspace' using errcode='42501'; end if;
 if (p_payload->>'enabled')::boolean then insert into public.personal_project_shortcuts values(p.id,office,actor) on conflict do nothing;
 else delete from public.personal_project_shortcuts where project_id=p.id and office_workspace_id=office; end if;
 result:=jsonb_build_object('office_workspace_id',office,'enabled',(p_payload->>'enabled')::boolean);
 else raise exception 'Unsupported personal project command' using errcode='22023';
 end if;
 insert into eflow_r3.receipts values(actor,p_request,p.id::text||':'||p_command,p_payload,result);
 insert into public.personal_work_events(project_id,actor_id,command,payload,result) values(p.id,actor,p_command,p_payload,result);
 return result;
end $$;

revoke all on all functions in schema eflow_r3 from public;
grant execute on function eflow_r3.workspace_access(uuid),eflow_r3.project_access(uuid,boolean),eflow_r3.personal_owner(uuid),eflow_r3.eligible(uuid) to authenticated;
revoke all on function public.r3_list_workspaces(),public.r3_select_workspace(uuid),public.r3_create_workspace(uuid,text,text),public.r3_create_personal_project(uuid,uuid,text),public.r3_personal_project_snapshot(uuid),public.r3_personal_member_candidates(uuid),public.r3_personal_project_command(uuid,text,jsonb,uuid) from public;
grant execute on function public.r3_list_workspaces(),public.r3_select_workspace(uuid),public.r3_create_workspace(uuid,text,text),public.r3_create_personal_project(uuid,uuid,text),public.r3_personal_project_snapshot(uuid),public.r3_personal_member_candidates(uuid),public.r3_personal_project_command(uuid,text,jsonb,uuid) to authenticated;
commit;
