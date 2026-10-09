-- R8: project-only guests; no token, delivery or grant before Head approval.
begin;
set local lock_timeout='10s';
create schema eflow_r8;
revoke all on schema eflow_r8 from public,anon;
grant usage on schema eflow_r8 to authenticated,service_role;
alter table public.workspaces add column sponsoring_office_id uuid references public.organizations(id);
create table public.project_invitation_requests(
 id uuid primary key default extensions.gen_random_uuid(),project_id uuid not null,
 root_id uuid,node_id uuid,office_id uuid not null references public.organizations(id),
 kind text not null check(kind in ('office','personal')),requester uuid not null references public.profiles(id),
 email text not null check(length(email)<=254 and email=lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 summary text not null default '' check(length(summary)<=1500),skills text[] not null default '{}' check(cardinality(skills)<=40),
 engagement text not null check(engagement in ('Permanent','Job Order','OJT','Consultant','Other')),
 access_end timestamptz,until_close boolean not null default false,
 state text not null default 'pending' check(state in ('pending','approved','rejected','revoked','expired','accepted')),
 revision integer not null default 1,approved_by uuid references public.profiles(id),approved_at timestamptz,
 request_expires_at timestamptz not null default now()+interval '30 days',
 invitation_created_at timestamptz,expires_at timestamptz,accepted_by uuid references public.profiles(id),accepted_at timestamptz,
 delivery_status text not null default 'not_attempted' check(delivery_status in ('not_attempted','attempting','provider_accepted','failed')),
 delivery_error text,last_sent_at timestamptz,send_count integer not null default 0,
 onboarding text not null default 'pending' check(onboarding in ('pending','complete')),
 created_at timestamptz not null default now(),
 check(engagement='Permanent' or access_end is not null or until_close),
 check(node_id is null or root_id is not null),check(state<>'accepted' or accepted_by is not null)
);
create unique index r8_one_open_request on public.project_invitation_requests(project_id,office_id,email) where state in ('pending','approved');
create index r8_project_requests on public.project_invitation_requests(project_id,created_at,id);
create index r8_requester_created on public.project_invitation_requests(requester,created_at);
create index r8_head_pending on public.project_invitation_requests(office_id,project_id) where state in ('pending','approved');
create table eflow_r8.tokens(request_id uuid primary key references public.project_invitation_requests(id),hash text unique not null check(hash ~ '^[a-f0-9]{64}$'),provider_id text,claim uuid,claimed_at timestamptz);
create table public.project_guest_members(
 project_id uuid not null references public.projects(id),office_id uuid not null references public.organizations(id),
 user_id uuid not null references public.profiles(id),request_id uuid not null references public.project_invitation_requests(id),
 engagement text not null,access_end timestamptz,until_close boolean not null,ended_at timestamptz,
 primary key(project_id,office_id,user_id)
);
alter table public.project_invitation_requests enable row level security;
alter table public.project_guest_members enable row level security;
alter table eflow_r8.tokens enable row level security;
create index r8_guest_user on public.project_guest_members(user_id,project_id,office_id);
revoke all on public.project_invitation_requests,public.project_guest_members,eflow_r8.tokens from public,anon,authenticated;
grant all on public.project_invitation_requests,public.project_guest_members,eflow_r8.tokens to service_role;

create function eflow_r8.open_scope(p_project uuid,p_office uuid,p_kind text) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_kind='office' then exists(select 1 from public.projects p join public.project_offices o on o.project_id=p.id where p.id=p_project and p.status not in ('completed','archived') and p.source_collaboration_draft_id is null and o.office_id=p_office and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating'))
 else exists(select 1 from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project and p.status='active' and w.state='active' and w.sponsoring_office_id=p_office) end
$$;
create function eflow_r8.requester(p public.project_invitation_requests) returns boolean language plpgsql stable security definer set search_path='' as $$
declare r jsonb;begin
 if not eflow_r3.eligible(p.requester) or not eflow_r8.open_scope(p.project_id,p.office_id,p.kind) then return false;end if;
 if p.root_id is not null then
  r:=eflow_r7.root(p.root_id);
  if r is null or (r->>'project')::uuid<>p.project_id or not (r->>'open')::boolean or (r->>'kind')<>p.kind or p.kind='office' and (r->>'office')::uuid<>p.office_id then return false;end if;
  if p.node_id is not null and not exists(select 1 from eflow_r7.nodes where id=p.node_id and task_id=p.root_id) then return false;end if;
 end if;
 if p.kind='office' and public.phase2_is_office_head(p.requester,p.office_id) then return true;end if;
 if p.kind='personal' and exists(select 1 from public.personal_projects x join public.workspaces w on w.id=x.workspace_id where x.id=p.project_id and w.owner_id=p.requester) then return true;end if;
 r:=eflow_r7.root(p.root_id);
 if r is null or (r->>'project')::uuid<>p.project_id or not (r->>'open')::boolean or (r->>'kind')<>p.kind or p.kind='office' and (r->>'office')::uuid<>p.office_id then return false;end if;
 if not eflow_r7.member(p.project_id,case when p.kind='office' then p.office_id end,p.requester) then return false;end if;
 if p.node_id is not null and not exists(select 1 from eflow_r7.nodes n where n.id=p.node_id and n.task_id=p.root_id) then return false;end if;
 return (r->>'lead')::uuid=p.requester or p.node_id is not null and eflow_r7.chain(p.root_id,p.node_id) and exists(
 with recursive chain as (select id,parent_subtask_id,lead_id from eflow_r7.nodes where id=p.node_id and task_id=p.root_id union all select n.id,n.parent_subtask_id,n.lead_id from eflow_r7.nodes n join chain c on n.id=c.parent_subtask_id) select 1 from chain where lead_id=p.requester);
end $$;
create function eflow_r8.valid(p public.project_invitation_requests) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r8.requester(p) and p.request_expires_at>now() and (p.access_end is null or p.access_end>now()) and eflow_r3.eligible(p.approved_by) and public.phase2_is_office_head(p.approved_by,p.office_id)
$$;
-- Optional request attachment remains private and is bound to the eventual recipient.
alter table public.user_pds_documents add column project_request_id uuid references public.project_invitation_requests(id);
create index r8_private_pds_request on public.user_pds_documents(project_request_id,created_at) where project_request_id is not null;
create unique index r8_private_pds_retry on public.user_pds_documents(project_request_id,uploaded_by,content_sha256) where project_request_id is not null;
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.user_pds_documents'::regclass and contype='c' and pg_get_constraintdef(oid) like '%user_id IS NOT NULL%' loop execute format('alter table public.user_pds_documents drop constraint %I',c.conname);end loop;
end $$;
alter table public.user_pds_documents add constraint r8_pds_owner check(user_id is not null or invitation_id is not null or project_request_id is not null);
create function eflow_r8.safe(p public.project_invitation_requests) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p)||jsonb_build_object('state',case when p.state in ('pending','approved') and (p.request_expires_at<=now() or p.expires_at<=now() or p.access_end<=now()) then 'expired' else p.state end,
 'can_approve',p.state='pending' and p.request_expires_at>now() and (p.access_end is null or p.access_end>now()) and eflow_r8.requester(p) and eflow_r3.eligible(auth.uid()) and public.phase2_is_office_head(auth.uid(),p.office_id),
 'can_dispatch',p.state='approved' and p.approved_by=auth.uid() and eflow_r8.valid(p),
 'can_complete_onboarding',p.state='accepted' and p.accepted_by=auth.uid(),
 'can_revoke',p.state in ('pending','approved','accepted') and (p.requester=auth.uid() or public.phase2_is_office_head(auth.uid(),p.office_id)),
 'pds_documents',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'original_filename',d.original_filename,'processing_status',d.processing_status)) from public.user_pds_documents d where d.project_request_id=p.id and (d.user_id=auth.uid() or d.uploaded_by=auth.uid())),'[]'::jsonb))
$$;
create function eflow_r8.submit(p_id uuid,p_project uuid,p_root uuid,p_node uuid,p_office uuid,p_email text,p_summary text,p_skills text[],p_engagement text,p_end timestamptz,p_close boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.project_invitation_requests;old public.project_invitation_requests;begin
 perform eflow_r3.actor();
 select * into old from public.project_invitation_requests where id=p_id for update;
 p.id:=p_id;p.project_id:=p_project;p.root_id:=p_root;p.node_id:=p_node;p.office_id:=p_office;p.email:=lower(btrim(p_email));p.summary:=p_summary;p.skills:=p_skills;p.engagement:=p_engagement;p.access_end:=p_end;p.until_close:=p_close;p.requester:=auth.uid();p.kind:=case when exists(select 1 from public.projects where id=p_project) then 'office' else 'personal' end;
 if not eflow_r8.requester(p) then raise exception 'Current owner or scoped Lead and a designated sponsoring Office are required' using errcode='42501';end if;
 if p_end<=now() then raise exception 'Access end must be in the future';end if;
 if old.id is not null then
  if old.requester<>auth.uid() or (to_jsonb(old)-array['state','revision','approved_by','approved_at','request_expires_at','invitation_created_at','expires_at','accepted_by','accepted_at','delivery_status','delivery_error','last_sent_at','send_count','onboarding','created_at']) is distinct from (to_jsonb(p)-array['state','revision','approved_by','approved_at','request_expires_at','invitation_created_at','expires_at','accepted_by','accepted_at','delivery_status','delivery_error','last_sent_at','send_count','onboarding','created_at']) then raise exception 'Request ID was already used for different terms';end if;
  return eflow_r8.safe(old);
 end if;
 if (select count(*) from public.project_invitation_requests where requester=auth.uid() and created_at>now()-interval '1 hour')>=50 then raise exception 'Invitation request limit; please wait before requesting more';end if;
 update public.project_invitation_requests set state='expired',revision=revision+1 where project_id=p_project and office_id=p_office and email=p.email and state in ('pending','approved') and (request_expires_at<=now() or expires_at<=now() or access_end<=now());
 insert into public.project_invitation_requests(id,project_id,root_id,node_id,office_id,kind,requester,email,summary,skills,engagement,access_end,until_close) values(p_id,p_project,p_root,p_node,p_office,p.kind,auth.uid(),p.email,p_summary,p_skills,p_engagement,p_end,p_close) returning * into p;
 insert into public.notifications(user_id,type,title,message,project_id,actor_id,actor_name) select o.head_user_id,'system','Project invitation approval requested',p.email||' · Review in project Members / Invitations',p_project,auth.uid(),u.full_name from public.organizations o join public.profiles u on u.id=auth.uid() where o.id=p_office;
 return eflow_r8.safe(p);
end $$;
create function eflow_r8.decide(p_id uuid,p_revision integer,p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.project_invitation_requests;begin
 perform eflow_r3.actor();select * into p from public.project_invitation_requests where id=p_id for update;
 if p.id is null then raise exception 'Request unavailable';end if;
 if p_action in ('approved','rejected') then
  if not public.phase2_is_office_head(auth.uid(),p.office_id) then raise exception 'Only the current appointed sponsoring Head can decide' using errcode='42501';end if;
  if p.state=p_action and p.approved_by=auth.uid() and p.revision=p_revision+1 then return eflow_r8.safe(p);end if;
  if p.state<>'pending' or p.revision<>p_revision or not eflow_r8.requester(p) or p.request_expires_at<=now() or p.access_end<=now() then raise exception 'Stale or unavailable request; request renewed approval';end if;
  update public.project_invitation_requests set state=p_action,approved_by=auth.uid(),approved_at=now(),revision=revision+1 where id=p_id returning * into p;
 elsif p_action='revoked' then
  if p.requester<>auth.uid() and not public.phase2_is_office_head(auth.uid(),p.office_id) then raise exception 'Request access denied' using errcode='42501';end if;
  if p.state='revoked' then return eflow_r8.safe(p);end if;
  if p.revision<>p_revision then raise exception 'Stale request';end if;
  update public.project_invitation_requests set state='revoked',revision=revision+1 where id=p_id returning * into p;
  delete from eflow_r8.tokens where request_id=p_id;
  update public.project_guest_members set ended_at=coalesce(ended_at,now()) where request_id=p_id;
  if p.kind='personal' then update public.personal_project_members set access_ended_at=coalesce(access_ended_at,now()) where project_id=p.project_id and user_id=p.accepted_by;end if;
 else raise exception 'Invalid decision';end if;
 insert into public.notifications(user_id,type,title,message,project_id,actor_id,actor_name) select p.requester,'system','Project invitation '||p.state,p.email||' · View project Members / Invitations',p.project_id,auth.uid(),u.full_name from public.profiles u where u.id=auth.uid();
 return eflow_r8.safe(p);
end $$;
create function eflow_r8.list_requests(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_office uuid;v_kind text;v_owner boolean;begin
 perform eflow_r3.actor();
 select p.org_id,'office' into v_office,v_kind from public.projects p where p.id=p_project;
 if not found then select w.sponsoring_office_id,'personal',w.owner_id=auth.uid() into v_office,v_kind,v_owner from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project;end if;
 if v_kind='office' then select coalesce((select office_id from public.project_offices o where o.project_id=p_project and eflow_phase6.head(p_project,o.office_id,auth.uid()) limit 1),v_office) into v_office;end if;
 if v_kind is null or not (coalesce(v_owner,false) or public.can_see_project(p_project,auth.uid()) or eflow_r3.project_access(p_project) or exists(select 1 from public.project_invitation_requests p where p.project_id=p_project and public.phase2_is_office_head(auth.uid(),p.office_id))) then raise exception 'Project invitation access denied' using errcode='42501';end if;
 return jsonb_build_object('office_id',v_office,'kind',v_kind,'timezone',coalesce((select timezone from public.workspaces where id=v_office),(select w.timezone from public.personal_projects p join public.workspaces w on w.id=p.workspace_id where p.id=p_project),'Asia/Singapore'),'workspace_id',(select workspace_id from public.personal_projects where id=p_project),'can_designate',coalesce(v_owner,false),'can_request',eflow_r8.open_scope(p_project,v_office,v_kind) and (coalesce(v_owner,false) or exists(select 1 from public.project_offices o where o.project_id=p_project and eflow_phase6.head(p_project,o.office_id,auth.uid()))),'requests',coalesce((select jsonb_agg(eflow_r8.safe(p) order by p.created_at desc,p.id) from public.project_invitation_requests p where p.project_id=p_project and (p.requester=auth.uid() or p.accepted_by=auth.uid() or public.phase2_is_office_head(auth.uid(),p.office_id))),'[]'::jsonb));
end $$;
create function eflow_r8.designate(p_workspace uuid,p_office uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not eflow_r3.personal_owner(p_workspace) or not exists(select 1 from public.organizations o where o.id=p_office and o.is_active and public.phase2_is_office_head(o.head_user_id,o.id)) then raise exception 'Choose an active sponsoring Office with an appointed Head' using errcode='42501';end if;
 update public.workspaces set sponsoring_office_id=p_office where id=p_workspace;
end $$;

-- Service-only token operations: explicit actor comes only from validated gateway identity.
create function public.r8_reserve_dispatch(p_actor uuid,p_id uuid,p_revision integer,p_hash text,p_ttl integer,p_resend boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.project_invitation_requests;begin
 select * into p from public.project_invitation_requests where id=p_id for update;
 if p.state<>'approved' or p.revision<>p_revision or p.approved_by is distinct from p_actor or not eflow_r8.valid(p) then raise exception 'Stale approval or current authority unavailable';end if;
 if p.delivery_status='provider_accepted' and not p_resend then raise exception 'Provider already accepted this invitation; use explicit resend';end if;
 if p.last_sent_at>now()-interval '60 seconds' then raise exception 'Please wait 60 seconds before retrying';end if;
 if p.send_count>=10 or p_ttl not between 1 and 720 then raise exception 'Invitation resend limit or invalid lifetime';end if;
 update public.project_invitation_requests set invitation_created_at=coalesce(invitation_created_at,now()),expires_at=least(now()+make_interval(hours=>p_ttl),request_expires_at,coalesce(access_end,'infinity'::timestamptz)),delivery_status='attempting',delivery_error=null,last_sent_at=now(),send_count=send_count+1,revision=revision+1 where id=p_id returning * into p;
 insert into eflow_r8.tokens(request_id,hash) values(p_id,p_hash) on conflict(request_id) do update set hash=excluded.hash,provider_id=null,claim=null,claimed_at=null;
 return to_jsonb(p);
end $$;
create function public.r8_finish_dispatch(p_id uuid,p_hash text,p_provider text,p_error text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.project_invitation_requests where id=p_id for update;
 if not exists(select 1 from eflow_r8.tokens where request_id=p_id and hash=p_hash for update) then return false;end if;
 update eflow_r8.tokens set provider_id=p_provider where request_id=p_id;
 update public.project_invitation_requests set delivery_status=case when p_provider is null then 'failed' else 'provider_accepted' end,delivery_error=left(p_error,500) where id=p_id and state='approved';return found;
end $$;
create function public.r8_lookup(p_hash text,p_claim uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.project_invitation_requests;t eflow_r8.tokens;begin
 select * into t from eflow_r8.tokens where hash=p_hash;
 select * into p from public.project_invitation_requests where id=t.request_id for update;
 select * into t from eflow_r8.tokens where hash=p_hash for update;
 if t.request_id is null then raise exception 'Invitation expired, revoked or unavailable';end if;
 if p.id is null or p.state not in ('approved','accepted') or p.state='approved' and (not eflow_r8.valid(p) or p.expires_at<=now()) then raise exception 'Invitation expired, revoked or unavailable';end if;
 if p_claim is not null and p.state='approved' then
  if t.claim is not null and t.claim<>p_claim and t.claimed_at>now()-interval '5 minutes' then raise exception 'Acceptance is already in progress';end if;
  update eflow_r8.tokens set claim=p_claim,claimed_at=now() where request_id=p.id;
 end if;
 return to_jsonb(p)||jsonb_build_object('existing_account',exists(select 1 from auth.users where lower(email)=p.email),'needs_full_name',not exists(select 1 from public.profiles u join auth.users a on a.id=u.id where lower(a.email)=p.email),'project_title',coalesce((select title from public.projects where id=p.project_id),(select title from public.personal_projects where id=p.project_id)), 'home_workspace_id',coalesce((select workspace_id from public.office_project_homes where project_id=p.project_id),(select workspace_id from public.personal_projects where id=p.project_id)),'office_name',(select name from public.organizations where id=p.office_id));
end $$;
create function public.r8_accept(p_hash text,p_user uuid,p_name text,p_claim uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.project_invitation_requests;t eflow_r8.tokens;u public.profiles;w uuid;begin
 select * into t from eflow_r8.tokens where hash=p_hash;select * into p from public.project_invitation_requests where id=t.request_id for update;
 select * into t from eflow_r8.tokens where hash=p_hash for update;
 if t.request_id is null then raise exception 'Invitation expired, revoked or unavailable';end if;
 if p.id is null or not exists(select 1 from auth.users where id=p_user and lower(email)=p.email and email_confirmed_at is not null) then raise exception 'Sign in with the invited verified email';end if;
 if p.state='accepted' and p.accepted_by=p_user then return jsonb_build_object('accepted',true,'project_id',p.project_id,'kind',p.kind);end if;
 if p.state<>'approved' or p.expires_at<=now() or not eflow_r8.valid(p) or t.claim is not null and t.claim is distinct from p_claim and t.claimed_at>now()-interval '5 minutes' then raise exception 'Invitation expired, revoked or authority changed';end if;
 select * into u from public.profiles where id=p_user for update;
 if u.id is null then
  if length(btrim(p_name)) not between 2 and 160 then raise exception 'Enter your full name';end if;
  insert into public.profiles(id,full_name,email,employee_id,role,is_active,org_id) values(p_user,btrim(p_name),p.email,'GUEST-'||p_user::text,'member',true,null) returning * into u;
 end if;
 if not eflow_r3.eligible(p_user) then raise exception 'Deactivated or non-operational identity requires Admin resolution';end if;
 if p.kind='office' then
  if exists(select 1 from public.project_guest_members where project_id=p.project_id and office_id=p.office_id and user_id=p_user and ended_at is null) or eflow_r7.member(p.project_id,p.office_id,p_user) then raise exception 'Already a project member; do not replace independent access';end if;
  insert into public.project_guest_members(project_id,office_id,user_id,request_id,engagement,access_end,until_close) values(p.project_id,p.office_id,p_user,p.id,p.engagement,p.access_end,p.until_close) on conflict(project_id,office_id,user_id) do update set request_id=excluded.request_id,engagement=excluded.engagement,access_end=excluded.access_end,until_close=excluded.until_close,ended_at=null;
 else
  if exists(select 1 from public.personal_project_members where project_id=p.project_id and user_id=p_user and state='active' and access_ended_at is null) then raise exception 'Already a project member; do not replace independent access';end if;
  select workspace_id into w from public.personal_projects where id=p.project_id;
  insert into public.workspace_members(workspace_id,user_id) values(w,p_user) on conflict(workspace_id,user_id) do update set state='active';
  insert into public.personal_project_members(project_id,user_id,access,engagement,access_end,until_close) values(p.project_id,p_user,'member',p.engagement,p.access_end,p.until_close) on conflict(project_id,user_id) do update set access='member',state='active',engagement=excluded.engagement,access_end=excluded.access_end,until_close=excluded.until_close,access_ended_at=null;
 end if;
 update public.user_pds_documents set user_id=p_user where project_request_id=p.id and user_id is null;
 insert into public.user_professional_profiles(user_id,skills,education,trainings,certifications,work_experience,specializations,competency_summary,source,source_document_id,last_extracted_at)
 select p_user,coalesce(d.professional_draft->'skills','[]'),coalesce(d.professional_draft->'education','[]'),coalesce(d.professional_draft->'trainings','[]'),coalesce(d.professional_draft->'certifications','[]'),coalesce(d.professional_draft->'work_experience','[]'),coalesce(d.professional_draft->'specializations','[]'),coalesce(d.professional_draft->>'competency_summary',''),'pds',d.id,now()
 from public.user_pds_documents d where d.project_request_id=p.id and d.processing_status='completed' and d.professional_draft is not null order by d.created_at desc limit 1 on conflict(user_id) do nothing;
 insert into public.notifications(user_id,type,title,message,project_id,actor_id,actor_name) values(p.requester,'system','Project invitation accepted',u.full_name||' accepted membership; assign work separately',p.project_id,p_user,u.full_name);
 update public.project_invitation_requests set state='accepted',accepted_by=p_user,accepted_at=now(),revision=revision+1 where id=p.id;
 return jsonb_build_object('accepted',true,'project_id',p.project_id,'kind',p.kind);
end $$;
create function eflow_r8.complete_onboarding(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform eflow_r3.actor();update public.project_invitation_requests set onboarding='complete' where id=p_id and accepted_by=auth.uid() and state='accepted';if not found then raise exception 'Accepted recipient required';end if;
end $$;

create function eflow_r8.guest(p_project uuid,p_office uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select eflow_r3.eligible(p_user) and exists(select 1 from public.project_guest_members m join public.projects p on p.id=m.project_id join public.project_offices o on o.project_id=m.project_id and o.office_id=m.office_id where m.project_id=p_project and (p_office is null or m.office_id=p_office) and m.user_id=p_user and m.ended_at is null and (m.access_end is null or m.access_end>now()) and (m.engagement='Permanent' or p.status not in ('completed','archived')) and o.invitation_status='joined' and o.relationship_type in ('lead','collaborating'))
$$;
-- Wrap reviewed predicates, retaining original Office and governed collaboration branches.
do $$declare n text;d text;begin
 foreach n in array array['can_see_project','can_see_task','can_contribute_task'] loop
  select pg_get_functiondef(oid) into strict d from pg_proc where pronamespace='public'::regnamespace and proname=n;
  execute replace(d,'FUNCTION public.'||n||'(','FUNCTION eflow_r8.baseline_'||n||'(');
 end loop;
 select pg_get_functiondef('eflow_r7.member(uuid,uuid,uuid)'::regprocedure) into d;
 execute replace(d,'FUNCTION eflow_r7.member(','FUNCTION eflow_r8.baseline_member(');
end $$;
create or replace function eflow_r7.member(p_project uuid,p_office uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select eflow_r8.baseline_member(p_project,p_office,p_user) or eflow_r8.guest(p_project,p_office,p_user)$$;
create function eflow_r8.independent(p_project uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.project_guest_members where project_id=p_project and user_id=p_user) or exists(select 1 from public.projects p where p.id=p_project and (p.owner_id=p_user or public.is_project_member(p.id,p_user) or public.can_access_org(p_user,p.org_id,'read') or eflow_phase6.access(p.id,p_user)))
$$;
create or replace function public.can_see_project(target_project uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$select eflow_r8.baseline_can_see_project(target_project,caller_id) and eflow_r8.independent(target_project,caller_id) or eflow_r8.guest(target_project,null,caller_id)$$;
create or replace function public.can_see_task(target_task uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$select eflow_r8.baseline_can_see_task(target_task,caller_id) and (select eflow_r8.independent(t.linked_project_id,caller_id) or t.created_by=caller_id or t.reviewer_id=caller_id or t.backup_reviewer_id=caller_id from public.tasks t where t.id=target_task) or exists(select 1 from public.tasks t where t.id=target_task and t.deleted_at is null and t.proposed_office_identity_id is null and t.source_collaboration_draft_id is null and eflow_r8.guest(t.linked_project_id,t.org_id,caller_id))$$;
create or replace function public.can_contribute_task(target_task uuid,caller_id uuid) returns boolean language sql stable security definer set search_path='' as $$select eflow_r8.baseline_can_contribute_task(target_task,caller_id) and (select not exists(select 1 from public.project_guest_members m where m.project_id=t.linked_project_id and m.office_id=t.org_id and m.user_id=caller_id) or eflow_r7.member(t.linked_project_id,t.org_id,caller_id) from public.tasks t where t.id=target_task) or exists(select 1 from public.tasks t where t.id=target_task and t.deleted_at is null and t.proposed_office_identity_id is null and t.source_collaboration_draft_id is null and eflow_r8.guest(t.linked_project_id,t.org_id,caller_id) and (coalesce(t.assigned_to,t.recommendation_lead_id)=caller_id or caller_id=any(t.team_member_ids)))$$;
create function eflow_r8.end_guests() returns trigger language plpgsql security definer set search_path='' as $$begin if new.status in ('completed','archived') then update public.project_guest_members set ended_at=coalesce(ended_at,now()) where project_id=new.id and engagement<>'Permanent';end if;return new;end $$;
create trigger r8_end_guests after update of status on public.projects for each row execute function eflow_r8.end_guests();

create function public.r8_submit_request(p_id uuid,p_project uuid,p_root uuid,p_node uuid,p_office uuid,p_email text,p_summary text,p_skills text[],p_engagement text,p_end timestamptz,p_close boolean) returns jsonb language sql security invoker set search_path='' as $$select eflow_r8.submit(p_id,p_project,p_root,p_node,p_office,p_email,p_summary,p_skills,p_engagement,p_end,p_close)$$;
create function public.r8_decide_request(p_id uuid,p_revision integer,p_action text) returns jsonb language sql security invoker set search_path='' as $$select eflow_r8.decide(p_id,p_revision,p_action)$$;
create function public.r8_list_requests(p_project uuid) returns jsonb language sql security invoker set search_path='' as $$select eflow_r8.list_requests(p_project)$$;
create function public.r8_designate_sponsor(p_workspace uuid,p_office uuid) returns void language sql security invoker set search_path='' as $$select eflow_r8.designate(p_workspace,p_office)$$;
create function public.r8_complete_onboarding(p_id uuid) returns void language sql security invoker set search_path='' as $$select eflow_r8.complete_onboarding(p_id)$$;
revoke all on all functions in schema eflow_r8 from public,anon,authenticated;
grant execute on function eflow_r8.submit(uuid,uuid,uuid,uuid,uuid,text,text,text[],text,timestamptz,boolean),eflow_r8.decide(uuid,integer,text),eflow_r8.list_requests(uuid),eflow_r8.designate(uuid,uuid),eflow_r8.complete_onboarding(uuid) to authenticated;
revoke all on function public.r8_reserve_dispatch(uuid,uuid,integer,text,integer,boolean),public.r8_finish_dispatch(uuid,text,text,text),public.r8_lookup(text,uuid),public.r8_accept(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.r8_reserve_dispatch(uuid,uuid,integer,text,integer,boolean),public.r8_finish_dispatch(uuid,text,text,text),public.r8_lookup(text,uuid),public.r8_accept(text,uuid,text,uuid) to service_role;
grant execute on all functions in schema eflow_r8 to service_role;
revoke all on function public.r8_submit_request(uuid,uuid,uuid,uuid,uuid,text,text,text[],text,timestamptz,boolean),public.r8_decide_request(uuid,integer,text),public.r8_list_requests(uuid),public.r8_designate_sponsor(uuid,uuid),public.r8_complete_onboarding(uuid) from public,anon;
grant execute on function public.r8_submit_request(uuid,uuid,uuid,uuid,uuid,text,text,text[],text,timestamptz,boolean),public.r8_decide_request(uuid,integer,text),public.r8_list_requests(uuid),public.r8_designate_sponsor(uuid,uuid),public.r8_complete_onboarding(uuid) to authenticated;
create function public.r8_pds_context(p_actor uuid,p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.project_invitation_requests;begin
 select * into p from public.project_invitation_requests where id=p_id;
 if p.id is null or not eflow_r3.eligible(p_actor) or p.state not in ('pending','approved','accepted') or not eflow_r8.open_scope(p.project_id,p.office_id,p.kind) or not (p.requester=p_actor and eflow_r8.requester(p) or public.phase2_is_office_head(p_actor,p.office_id) or p.accepted_by=p_actor and (p.kind='office' and eflow_r8.guest(p.project_id,p.office_id,p_actor) or p.kind='personal' and eflow_r3.valid_member(p.project_id,p_actor))) then raise exception 'Current request uploader or active recipient required';end if;
 return jsonb_build_object('office_id',p.office_id,'accepted_by',p.accepted_by);
end $$;
revoke all on function public.r8_pds_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.r8_pds_context(uuid,uuid) to service_role;
create function eflow_r8.bind_pds() returns trigger language plpgsql security definer set search_path='' as $$
 declare p public.project_invitation_requests;begin
 if new.project_request_id is null then return new;end if;
 select * into p from public.project_invitation_requests where id=new.project_request_id for update;
 perform public.r8_pds_context(new.uploaded_by,new.project_request_id);
 if new.invitation_id is not null or new.office_id<>p.office_id then raise exception 'Private PDS scope mismatch';end if;
 new.user_id:=p.accepted_by;return new;
end $$;
revoke all on function eflow_r8.bind_pds() from public,anon,authenticated;
create trigger r8_bind_pds before insert or update of project_request_id on public.user_pds_documents for each row execute function eflow_r8.bind_pds();
do $$declare d text;begin
 select pg_get_functiondef('eflow_r7.project_members(uuid)'::regprocedure) into d;
 execute replace(d,'FUNCTION eflow_r7.project_members(','FUNCTION eflow_r8.baseline_project_members(');
end $$;
revoke all on function eflow_r8.baseline_project_members(uuid) from public,anon,authenticated;
create or replace function eflow_r7.project_members(p_project uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;guests jsonb;begin
 result:=eflow_r8.baseline_project_members(p_project);
 if result->>'kind'='office' then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',u.id,'name',u.full_name,'office',m.office_id,'office_name',o.name||' · Sponsored guest','engagement',m.engagement,'access_end',m.access_end,'until_close',m.until_close,'access_ended_at',m.ended_at,'eligible',eflow_r8.guest(p_project,m.office_id,u.id),'access','member','state','guest','request_id',m.request_id,'responsibilities',coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'title',t.title,'role',case when coalesce(t.assigned_to,t.recommendation_lead_id)=u.id then 'Task Lead' else 'Contributor' end)) from public.tasks t where t.linked_project_id=p_project and t.deleted_at is null and (coalesce(t.assigned_to,t.recommendation_lead_id)=u.id or u.id=any(t.team_member_ids))),'[]')||coalesce((select jsonb_agg(jsonb_build_object('root',t.id,'node',n.id,'title',n.title,'role',case when n.lead_id=u.id then 'Subitem Lead' else 'Subitem contributor' end)) from public.subtasks n join public.tasks t on t.id=n.task_id where t.linked_project_id=p_project and t.deleted_at is null and (n.lead_id=u.id or u.id=any(n.assigned_to_ids))),'[]'))),'[]') into guests from public.project_guest_members m join public.profiles u on u.id=m.user_id join public.organizations o on o.id=m.office_id where m.project_id=p_project;
  result:=jsonb_set(result,'{members}',(result->'members')||guests);
 end if;return result;
end $$;
revoke all on function eflow_r8.independent(uuid,uuid) from public,anon,authenticated;
-- Every invitation transition has immutable attribution; service roles cannot alter old events.
create table public.project_invitation_events(id uuid primary key default extensions.gen_random_uuid(),request_id uuid not null references public.project_invitation_requests(id),actor_id uuid,action text not null,before_data jsonb,after_data jsonb,occurred_at timestamptz not null default now());
create index r8_events_request on public.project_invitation_events(request_id,occurred_at,id);
alter table public.project_invitation_events enable row level security;
revoke all on public.project_invitation_events from public,anon,authenticated,service_role;
create function eflow_r8.record_event() returns trigger language plpgsql security definer set search_path='' as $$begin
 insert into public.project_invitation_events(request_id,actor_id,action,before_data,after_data) values(new.id,coalesce(auth.uid(),case when new.state='accepted' then new.accepted_by else new.approved_by end,new.requester),case when tg_op='INSERT' then 'request_submitted' when new.state is distinct from old.state then new.state when new.delivery_status is distinct from old.delivery_status then new.delivery_status else 'updated' end,case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));return new;
end $$;
revoke all on function eflow_r8.record_event() from public,anon,authenticated;
create trigger r8_events after insert or update on public.project_invitation_requests for each row execute function eflow_r8.record_event();
create function eflow_r8.head_queue() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 perform eflow_r3.actor();return coalesce((select jsonb_agg(jsonb_build_object('project_id',p.project_id,'title',coalesce((select title from public.projects where id=p.project_id),(select title from public.personal_projects where id=p.project_id))) order by p.project_id) from (select distinct project_id from public.project_invitation_requests where state in ('pending','approved') and public.phase2_is_office_head(auth.uid(),office_id)) p),'[]');
end $$;
create function public.r8_head_invitation_queue() returns jsonb language sql security invoker set search_path='' as $$select eflow_r8.head_queue()$$;
revoke all on function eflow_r8.head_queue(),public.r8_head_invitation_queue() from public,anon;
grant execute on function eflow_r8.head_queue(),public.r8_head_invitation_queue() to authenticated;
-- New private PDS rows do not inherit Office-wide metadata access.
create function eflow_r8.pds_read(p_user uuid,p_uploader uuid,p_request uuid,p_office uuid) returns boolean language sql stable security definer set search_path='' as $$
 select p_user=auth.uid() or p_uploader=auth.uid() and (p_request is null and public.phase2_is_office_head(auth.uid(),p_office) or p_request is not null and exists(select 1 from public.project_invitation_requests r where r.id=p_request and eflow_r3.eligible(auth.uid()) and (r.requester=auth.uid() and eflow_r8.requester(r) or public.phase2_is_office_head(auth.uid(),r.office_id))))
$$;
revoke all on function eflow_r8.pds_read(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function eflow_r8.pds_read(uuid,uuid,uuid,uuid) to authenticated;
alter policy pds_metadata_own_read on public.user_pds_documents using(eflow_r8.pds_read(user_id,uploaded_by,project_request_id,office_id));
commit;
