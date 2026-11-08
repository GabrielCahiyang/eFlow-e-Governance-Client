-- Temporary project accounts only. No Auth users, evidence or history are deleted.
begin;
set local lock_timeout='10s';
create schema eflow_guests;
revoke all on schema eflow_guests from public,anon,authenticated;

create table public.project_guest_accounts(
 user_id uuid primary key references public.profiles(id),
 request_id uuid not null references public.project_invitation_requests(id),
 sponsor_office_id uuid not null references public.organizations(id),
 registered_at timestamptz not null default now(),
 unassigned_since timestamptz, warned_at timestamptz, blocked_notified_at timestamptz,
 deactivated_at timestamptz, deactivation_reason text,
 updated_at timestamptz not null default now()
);
create table public.project_guest_account_events(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 actor_id uuid references public.profiles(id), action text not null,
 reason text not null, created_at timestamptz not null default now(),
 request_key uuid unique, terms jsonb
);
create index guest_account_event_history on public.project_guest_account_events(user_id,created_at desc);
alter table public.project_guest_accounts enable row level security;
alter table public.project_guest_account_events enable row level security;
revoke all on public.project_guest_accounts,public.project_guest_account_events from public,anon,authenticated;
grant select on public.project_guest_accounts,public.project_guest_account_events to authenticated;
grant all on public.project_guest_accounts,public.project_guest_account_events to service_role;
create policy guest_admin_read on public.project_guest_accounts for select to authenticated using(public.is_admin((select auth.uid())));
create policy guest_event_admin_read on public.project_guest_account_events for select to authenticated using(public.is_admin((select auth.uid())));

create table eflow_guests.writes(tx bigint not null,user_id uuid not null,primary key(tx,user_id));
alter table eflow_guests.writes enable row level security;
create function eflow_guests.temporary(p_user uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.id=p_user and p.role='member' and p.org_id is null
 and p.employee_id='GUEST-'||p.id::text)
 and not exists(select 1 from public.user_invitations i where i.accepted_by=p_user and i.status='accepted' and i.invitation_type='office_member')
$$;

-- Count membership, not task assignments or recent sign-ins. On-hold projects
-- remain assigned; expired/revoked membership and closed projects do not.
create function eflow_guests.projects(p_user uuid) returns table(id uuid,title text) language sql volatile security definer set search_path='' as $$
 with memberships as (
  select m.project_id from public.project_guest_members m join public.project_offices o on o.project_id=m.project_id and o.office_id=m.office_id
   where m.user_id=p_user and m.ended_at is null and (m.access_end is null or m.access_end>now()) and o.invitation_status='joined'
  union select o.project_id from public.project_office_members m join public.project_offices o on o.id=m.project_office_id
   where m.user_id=p_user and m.access_ended_at is null and (m.access_end is null or m.access_end>now()) and o.invitation_status='joined'
  union select g.project_id from public.project_access_grants g where g.recipient=p_user and g.revoked_at is null and g.redeemed_at is not null and (g.access_end is null or g.access_end>now())
  union select m.project_id from public.personal_project_members m where m.user_id=p_user and m.state='active' and m.access_ended_at is null and (m.access_end is null or m.access_end>now())
 )
 select p.id,p.title from public.projects p where p.status not in ('completed','archived') and
  (p.id in(select project_id from memberships) or p.owner_id=p_user or p.project_lead_id=p_user)
 union select p.id,p.title from public.personal_projects p join public.workspaces w on w.id=p.workspace_id
  where p.status='active' and w.state='active' and p.id in(select project_id from memberships)
$$;
create function eflow_guests.finance_open(p_user uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select exists(select 1 from public.petty_cash_requests r where
  (r.requester_id=p_user or r.cash_recipient_id=p_user or r.task_leader_id=p_user and r.status in ('pending_leader_review','pending_leader_liquidation_review'))
  and r.status not in ('settled','rejected','cancelled','expired','draft'))
 or exists(select 1 from eflow_office_cash.requests r where r.requester=p_user and r.status not in ('settled','rejected','cancelled'))
$$;
create function eflow_guests.enroll() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='accepted' and new.accepted_by is not null and eflow_guests.temporary(new.accepted_by) then
  insert into public.project_guest_accounts(user_id,request_id,sponsor_office_id) values(new.accepted_by,new.id,new.office_id) on conflict(user_id) do nothing;
 end if;
 return new;
end $$;
create trigger register_project_guest_account after insert or update of state,accepted_by on public.project_invitation_requests for each row execute function eflow_guests.enroll();
insert into public.project_guest_accounts(user_id,request_id,sponsor_office_id)
 select distinct on(i.accepted_by) i.accepted_by,i.id,i.office_id from public.project_invitation_requests i
 where i.state='accepted' and eflow_guests.temporary(i.accepted_by) order by i.accepted_by,i.accepted_at desc;

create function eflow_guests.guard_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.is_active is distinct from old.is_active and eflow_guests.temporary(old.id)
 and exists(select 1 from public.project_guest_accounts where user_id=old.id)
 and not exists(select 1 from eflow_guests.writes where tx=txid_current() and user_id=old.id) then
  raise exception 'Manage this account in User Management → Project guests and enter a reason.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger guard_project_guest_status before update of is_active on public.profiles for each row execute function eflow_guests.guard_status();

create function eflow_guests.notify(p_user uuid,p_title text,p_message text) returns void language sql security definer set search_path='' as $$
 insert into public.notifications(user_id,type,title,message)
 select recipient,'system',p_title,p_message from (
  select p_user recipient
  union select o.head_user_id from public.organizations o where o.is_active and o.head_user_id is not null and o.id in(
   select sponsor_office_id from public.project_guest_accounts where user_id=p_user
   union select office_id from public.project_invitation_requests where accepted_by=p_user and state='accepted')
 ) recipients where exists(select 1 from public.profiles p where p.id=recipient and (p.is_active or recipient=p_user))
$$;

-- A database schedule works even when no browser or laptop gateway is open.
create function eflow_guests.maintain() returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles; g public.project_guest_accounts; stamp timestamptz:=now();begin
 -- Always lock profiles before lifecycle rows, matching invitation acceptance.
 for p in select u.* from public.profiles u join public.project_guest_accounts a on a.user_id=u.id
  where u.is_active order by u.id for update of u skip locked loop
  if not eflow_guests.temporary(p.id) then continue;end if;
  select * into g from public.project_guest_accounts where user_id=p.id for update;
  if exists(select 1 from eflow_guests.projects(p.id)) then
   if g.unassigned_since is not null then
    update public.project_guest_accounts set unassigned_since=null,warned_at=null,blocked_notified_at=null,updated_at=stamp where user_id=p.id;
    insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'countdown_cancelled','Assigned to an active project.');
   end if;
   continue;
  end if;
  if g.unassigned_since is null then
   update public.project_guest_accounts set unassigned_since=stamp,updated_at=stamp where user_id=p.id;
   insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'countdown_started','No active project. Seven-day assignment window started.');
   continue;
  end if;
  if eflow_guests.finance_open(p.id) then
   if g.blocked_notified_at is null then
    perform eflow_guests.notify(p.id,'Guest cleanup paused',p.full_name||' has an open cash responsibility. Settle it before account deactivation.');
    update public.project_guest_accounts set blocked_notified_at=stamp,updated_at=stamp where user_id=p.id;
    insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'cleanup_paused','An open cash responsibility needs settlement.');
   end if;
   continue;
  end if;
  if g.unassigned_since<=stamp-interval '7 days' then
   insert into eflow_guests.writes values(txid_current(),p.id) on conflict do nothing;
   update public.profiles set is_active=false,updated_at=stamp where id=p.id;
   delete from eflow_guests.writes where tx=txid_current() and user_id=p.id;
   update public.project_guest_accounts set deactivated_at=stamp,deactivation_reason='No active project for seven days.',updated_at=stamp where user_id=p.id;
   insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'auto_deactivated','No active project for seven days.');
   perform eflow_guests.notify(p.id,'Guest account deactivated',p.full_name||' no longer has an active project. Admin can reactivate the login for seven days; project access must be assigned separately.');
  elsif g.unassigned_since<=stamp-interval '5 days' and g.warned_at is null then
   perform eflow_guests.notify(p.id,'Guest account deactivates in 2 days',p.full_name||' has no active project. Assign a project before '||to_char(g.unassigned_since+interval '7 days','YYYY-MM-DD HH24:MI TZ')||' to keep the account active.');
   update public.project_guest_accounts set warned_at=stamp,updated_at=stamp where user_id=p.id;
   insert into public.project_guest_account_events(user_id,action,reason) values(p.id,'warning_sent','Two days remain to assign an active project.');
  end if;
 end loop;
end $$;

create function public.admin_project_guests() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not coalesce(public.is_admin(auth.uid()),false) then raise exception 'Only Admin can manage project guests.' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',p.id,'full_name',p.full_name,'email',p.email,'is_active',p.is_active,
 'sponsor_office',o.name,'unassigned_since',g.unassigned_since,'deactivates_at',case when p.is_active and jsonb_array_length(active.projects)=0 then coalesce(g.unassigned_since,now())+interval '7 days' end,
 'deactivated_at',g.deactivated_at,'deactivation_reason',g.deactivation_reason,'finance_open',eflow_guests.finance_open(p.id),
 'projects',active.projects,'registered_at',g.registered_at) order by p.full_name,p.id),'[]') into result
 from public.project_guest_accounts g join public.profiles p on p.id=g.user_id join public.organizations o on o.id=g.sponsor_office_id
 cross join lateral(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'title',x.title) order by x.title),'[]') projects from eflow_guests.projects(p.id) x) active
 where eflow_guests.temporary(p.id);
 return result;
end $$;
create function public.admin_project_guest_history(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.is_admin(auth.uid()),false) then raise exception 'Only Admin can view guest history.' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from
  (select e.id,e.action,e.reason,e.created_at,coalesce(p.full_name,'System') actor from public.project_guest_account_events e left join public.profiles p on p.id=e.actor_id where e.user_id=p_user order by e.created_at desc,e.id limit 100) x),'[]');
end $$;
create function public.admin_set_project_guest_state(p_user uuid,p_active boolean,p_reason text,p_key uuid) returns void language plpgsql security definer set search_path='' as $$
declare p public.profiles;g public.project_guest_accounts; prior public.project_guest_account_events; terms jsonb;begin
 if not coalesce(public.is_admin(auth.uid()),false) then raise exception 'Only Admin can manage project guests.' using errcode='42501';end if;
 if p_user=auth.uid() or p_active is null or p_key is null or length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Enter a reason (3–1,000 characters).';end if;
 select * into p from public.profiles where id=p_user for update;
 select * into g from public.project_guest_accounts where user_id=p_user for update;
 if g.user_id is null or not eflow_guests.temporary(p_user) then raise exception 'This is not a temporary project guest.' using errcode='42501';end if;
 terms:=jsonb_build_object('user',p_user,'active',p_active,'reason',btrim(p_reason),'actor',auth.uid());
 select * into prior from public.project_guest_account_events where request_key=p_key;
 if found then if prior.terms is distinct from terms then raise exception 'This request was already used for another change.';end if;return;end if;
 if not p_active and eflow_guests.finance_open(p_user) then raise exception 'Settle this guest’s open cash responsibility before deactivating the account.';end if;
 if p.is_active=p_active then raise exception 'This account has already changed. Reopen its current details.';end if;
 insert into eflow_guests.writes values(txid_current(),p_user);
 update public.profiles set is_active=p_active,updated_at=now() where id=p_user;
 delete from eflow_guests.writes where tx=txid_current() and user_id=p_user;
 update public.project_guest_accounts set unassigned_since=case when p_active and not exists(select 1 from eflow_guests.projects(p_user)) then now() end,
  warned_at=null,blocked_notified_at=null,deactivated_at=case when p_active then null else now() end,
  deactivation_reason=case when p_active then null else btrim(p_reason) end,updated_at=now() where user_id=p_user;
 insert into public.project_guest_account_events(user_id,actor_id,action,reason,request_key,terms)
  values(p_user,auth.uid(),case when p_active then 'reactivated' else 'deactivated' end,btrim(p_reason),p_key,terms);
 perform eflow_guests.notify(p_user,case when p_active then 'Guest login reactivated' else 'Guest account deactivated' end,
  p.full_name||case when p_active then ' can sign in again. Assign an active project within seven days. Expired project access has not been restored.' else ' can no longer sign in. Work and account history are retained.' end);
end $$;

revoke all on all functions in schema eflow_guests from public,anon,authenticated;
revoke all on function public.admin_project_guests(),public.admin_project_guest_history(uuid),public.admin_set_project_guest_state(uuid,boolean,text,uuid) from public,anon;
grant execute on function public.admin_project_guests(),public.admin_project_guest_history(uuid),public.admin_set_project_guest_state(uuid,boolean,text,uuid) to authenticated;
do $$begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('eflow-project-guest-lifecycle','*/15 * * * *','select eflow_guests.maintain()');
 end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.project_guest_accounts,public.project_guest_account_events;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
