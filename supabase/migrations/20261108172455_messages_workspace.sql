-- The existing task channel and message IDs remain the source of truth.
create schema if not exists eflow_chat;
revoke all on schema eflow_chat from public, anon, authenticated;

alter table public.chat_channels add column project_id uuid references public.projects(id) on delete set null;
alter table public.chat_channels drop constraint chat_channels_channel_type_check;
alter table public.chat_channels add constraint chat_channels_channel_type_check
  check(channel_type in ('task','org','direct','project'));
create unique index chat_channels_project_unique on public.chat_channels(project_id) where project_id is not null;

create function eflow_chat.sync_project_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chat_channels (channel_type,project_id,name) values ('project',new.id,new.title)
  on conflict(project_id) where project_id is not null do update set name=excluded.name;
  return new;
end $$;
revoke all on function eflow_chat.sync_project_channel() from public,anon,authenticated;
create trigger projects_sync_chat_channel after insert or update of title on public.projects
for each row execute function eflow_chat.sync_project_channel();
insert into public.chat_channels (channel_type,project_id,name)
select 'project',id,title from public.projects on conflict(project_id) where project_id is not null do nothing;

create function eflow_chat.sync_task_channel(t public.tasks)
returns void language plpgsql set search_path = '' as $$
declare
  channel uuid;
  members uuid[];
begin
  if t.deleted_at is not null then
    delete from public.chat_channel_members m using public.chat_channels c
    where c.task_id=t.id and m.channel_id=c.id;
    return;
  end if;
  insert into public.chat_channels (channel_type, task_id, name)
  values ('task', t.id, t.title)
  on conflict (task_id) where task_id is not null do update set name=excluded.name
  returning id into channel;

  select coalesce(array_agg(distinct p.id), '{}'::uuid[]) into members
  from public.profiles p
  where p.is_active and p.id=any(array[t.created_by,t.assigned_to,t.recommendation_lead_id]
    || coalesce(t.team_member_ids,'{}'::uuid[]))
    and public.can_see_task(t.id,p.id);

  delete from public.chat_channel_members m where m.channel_id=channel and m.user_id<>all(members);
  insert into public.chat_channel_members (channel_id,user_id)
    select channel,unnest(members) on conflict (channel_id,user_id) do nothing;
end $$;

create or replace function public.sync_task_chat_channel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' then
    -- Access teardown must not re-add a former creator or assignee.
    if eflow_r9.staffing_removal_allowed(tg_table_name,to_jsonb(old),to_jsonb(new)) then
      delete from public.chat_channel_members c using public.chat_channels h,eflow_r9.staffing_removals m
      where c.channel_id=h.id and h.task_id=new.id and m.tx=pg_current_xact_id()
        and m.relation_name=tg_table_name and m.row_id=new.id and c.user_id=m.removed_user;
      return new;
    end if;
  end if;
  perform eflow_chat.sync_task_channel(new);
  return new;
end $$;

drop trigger tasks_sync_chat_channel on public.tasks;
create trigger tasks_sync_chat_channel
after insert or update of title,created_by,assigned_to,recommendation_lead_id,team_member_ids,linked_project_id,org_id,deleted_at
on public.tasks for each row execute function public.sync_task_chat_channel();

-- Re-evaluate task access at read/send time too, including when project access
-- is withdrawn without touching the task row.
create or replace function public.is_channel_member(p_channel uuid, caller uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chat_channels c
    join public.profiles p on p.id=caller and p.is_active
    left join public.tasks t on t.id=c.task_id
    left join public.projects project on project.id=c.project_id
    left join public.organizations channel_org on channel_org.id=c.org_id
    left join public.organizations actor_org on actor_org.id=p.org_id
    where c.id=p_channel and (
      (c.channel_type='org' and (channel_org.path::text=actor_org.path::text
        or starts_with(actor_org.path::text,channel_org.path::text||'.')))
      or (c.channel_type='project' and public.can_see_project(project.id,p.id) and (
        p.id in (project.owner_id,project.project_lead_id)
        or exists(select 1 from public.project_members m where m.project_id=project.id and m.user_id=p.id)
        or exists(select 1 from public.project_offices po join public.project_office_members pm on pm.project_office_id=po.id
          where po.project_id=project.id and pm.user_id=p.id)))
      or (c.channel_type in ('task','direct')
        and exists(select 1 from public.chat_channel_members m where m.channel_id=c.id and m.user_id=p.id)
        and (c.channel_type<>'task' or (t.id is not null and t.deleted_at is null and public.can_see_task(t.id,p.id))))
    )
  );
$$;

alter policy channels_member_read on public.chat_channels using (public.is_channel_member(id,auth.uid()));
alter policy messages_member_read on public.chat_messages using (public.is_channel_member(channel_id,auth.uid()));
alter policy messages_member_insert on public.chat_messages with check (sender_id=auth.uid() and public.is_channel_member(channel_id,auth.uid()));
drop policy org_channels_ancestor_read on public.chat_channels;
drop policy org_messages_ancestor_read on public.chat_messages;
drop policy org_messages_ancestor_insert on public.chat_messages;
revoke update on public.chat_channel_members from authenticated, anon;
grant update (last_read_at) on public.chat_channel_members to authenticated;

alter table public.chat_messages add column pinned_at timestamptz;
alter table public.chat_messages add column reaction_users jsonb not null default '{}'::jsonb;
alter table public.chat_messages add column image_path text;
alter table public.chat_messages add constraint chat_message_image_path check (image_path is null or
  (split_part(image_path,'/',1)=channel_id::text and split_part(image_path,'/',2)=sender_id::text));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('conversation-images','conversation-images',false,10485760,array['image/jpeg','image/png','image/gif','image/webp'])
on conflict(id) do nothing;

-- Match the path without casting untrusted storage names to UUID.
create function public.can_access_conversation_image(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when split_part(p_path,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_channel_member(split_part(p_path,'/',1)::uuid,auth.uid()) else false end;
$$;
revoke all on function public.can_access_conversation_image(text) from public,anon;
grant execute on function public.can_access_conversation_image(text) to authenticated;

create policy conversation_images_read on storage.objects for select to authenticated
using(bucket_id='conversation-images' and public.can_access_conversation_image(name));
create policy conversation_images_upload on storage.objects for insert to authenticated
with check(bucket_id='conversation-images' and public.can_access_conversation_image(name)
  and split_part(name,'/',2)=auth.uid()::text and cardinality(storage.foldername(name))=2);
create policy conversation_images_cleanup on storage.objects for delete to authenticated
using(bucket_id='conversation-images' and public.can_access_conversation_image(name)
  and split_part(name,'/',2)=auth.uid()::text
  and not exists(select 1 from public.chat_messages m where m.image_path=name));

alter policy messages_member_insert on public.chat_messages with check (
  sender_id=auth.uid() and public.is_channel_member(channel_id,auth.uid())
  and pinned_at is null and reaction_users='{}'::jsonb
  and (length(btrim(content))>0 or image_path is not null)
  and (image_path is null or exists (select 1 from storage.objects o
    where o.bucket_id='conversation-images' and o.name=chat_messages.image_path))
);

create function public.list_message_conversations()
returns table(channel_id uuid, channel_type text, task_id uuid, org_id uuid, project_id uuid, name text,
  project_title text, last_message text, last_message_at timestamptz, unread boolean,
  is_lead boolean, other_user_id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id,c.channel_type,c.task_id,c.org_id,c.project_id,
    coalesce(nullif(person.full_name,''),nullif(c.name,''),'Conversation'),t.project_title,
    case when latest.image_path is not null and latest.content='' then 'Sent an image' else latest.content end,
    latest.created_at,coalesce(incoming.created_at>coalesce(m.last_read_at,c.created_at),false),
    coalesce(coalesce(t.recommendation_lead_id,t.assigned_to)=auth.uid(),false),person.id
  from public.chat_channels c
  left join public.chat_channel_members m on m.channel_id=c.id and m.user_id=auth.uid()
  left join public.tasks t on t.id=c.task_id
  left join lateral (
    select p.id,p.full_name from public.chat_channel_members cm join public.profiles p on p.id=cm.user_id
    where c.channel_type='direct' and cm.channel_id=c.id and p.id<>auth.uid()
    order by p.id limit 1
  ) person on true
  left join lateral (
    select msg.content,msg.created_at,msg.image_path from public.chat_messages msg where msg.channel_id=c.id
    order by msg.created_at desc,msg.id desc limit 1
  ) latest on true
  left join lateral (
    select msg.created_at from public.chat_messages msg
    where msg.channel_id=c.id and msg.sender_id is distinct from auth.uid()
      and msg.created_at>coalesce(m.last_read_at,c.created_at)
    order by msg.created_at desc limit 1
  ) incoming on true
  where (m.channel_id is not null or c.channel_type in ('org','project')) and public.is_channel_member(c.id,auth.uid())
  order by coalesce(latest.created_at,c.created_at) desc,c.id;
$$;

create function public.read_message_conversation(p_channel uuid,p_through timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_channel_member(p_channel,auth.uid()) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
  if p_through is null then return; end if;
  if not exists(select 1 from public.chat_channels c where c.id=p_channel and c.channel_type in ('org','project')) then
    update public.chat_channel_members m set last_read_at=greatest(m.last_read_at,least(p_through,statement_timestamp()))
    where m.channel_id=p_channel and m.user_id=auth.uid()
      and (m.last_read_at is null or m.last_read_at<least(p_through,statement_timestamp()));
    return;
  end if;
  insert into public.chat_channel_members as m (channel_id,user_id,last_read_at)
    values (p_channel,auth.uid(),least(p_through,statement_timestamp()))
    on conflict (channel_id,user_id) do update
    set last_read_at=greatest(m.last_read_at,excluded.last_read_at)
    where m.last_read_at is null or m.last_read_at<excluded.last_read_at;
end $$;

create function public.list_message_people(p_channel uuid default null)
returns table(id uuid, name text, is_lead boolean)
language sql stable security definer set search_path = '' as $$
  select p.id,p.full_name,coalesce(coalesce(t.recommendation_lead_id,t.assigned_to)=p.id,false)
  from public.profiles actor
  join public.profiles p on p.is_active
  left join public.chat_channels c on c.id=p_channel
  left join public.tasks t on t.id=c.task_id
  where actor.id=auth.uid() and actor.is_active and (
    (p_channel is null and actor.org_id=p.org_id and actor.id<>p.id)
    or (p_channel is not null and public.is_channel_member(c.id,actor.id)
      and public.is_channel_member(c.id,p.id)
      and (c.channel_type<>'org' or actor.org_id=p.org_id or p.org_id=c.org_id))
  )
  order by p.full_name,p.id;
$$;

create function public.open_direct_conversation(p_person uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); channel uuid;
begin
  if not exists(select 1 from public.list_message_people() p where p.id=p_person) then
    raise exception 'This person is unavailable for direct messages' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor,p_person)::text||greatest(actor,p_person)::text,0));
  select c.id into channel from public.chat_channels c
  join public.chat_channel_members a on a.channel_id=c.id and a.user_id=actor
  join public.chat_channel_members b on b.channel_id=c.id and b.user_id=p_person
  where c.channel_type='direct'
    and not exists(select 1 from public.chat_channel_members m where m.channel_id=c.id and m.user_id not in (actor,p_person))
  order by c.created_at,c.id limit 1;
  if channel is null then
    insert into public.chat_channels (channel_type,name) values ('direct','') returning id into channel;
    insert into public.chat_channel_members (channel_id,user_id) values (channel,actor),(channel,p_person);
  end if;
  return channel;
end $$;

create function public.set_conversation_message_pin(p_message uuid,p_pin boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.chat_messages m set pinned_at=case when p_pin then now() end
  where m.id=p_message and public.is_channel_member(m.channel_id,auth.uid());
  if not found then raise exception 'Message unavailable' using errcode='42501'; end if;
end $$;

create function public.toggle_conversation_reaction(p_message uuid,p_emoji text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); label text; reactions jsonb; people jsonb;
begin
  if p_emoji is null or p_emoji not in ('👍','❤️','😂','😮','😢','😡') then
    raise exception 'Choose a supported reaction' using errcode='22023';
  end if;
  select m.reaction_users into reactions from public.chat_messages m
  where m.id=p_message and public.is_channel_member(m.channel_id,actor) for update;
  if not found then raise exception 'Message unavailable' using errcode='42501'; end if;
  select coalesce(nullif(p.full_name,''),'Someone') into label from public.profiles p where p.id=actor;
  people:=coalesce(reactions->p_emoji,'{}'::jsonb);
  people:=case when people ? actor::text then people-actor::text else people||jsonb_build_object(actor::text,label) end;
  update public.chat_messages set reaction_users=jsonb_set(reactions,array[p_emoji],people,true) where id=p_message;
end $$;

revoke all on function eflow_chat.sync_task_channel(public.tasks) from public,anon,authenticated;
revoke all on function public.list_message_conversations(), public.read_message_conversation(uuid,timestamptz),
  public.list_message_people(uuid), public.open_direct_conversation(uuid),
  public.set_conversation_message_pin(uuid,boolean), public.toggle_conversation_reaction(uuid,text) from public,anon;
grant execute on function public.list_message_conversations(), public.read_message_conversation(uuid,timestamptz),
  public.list_message_people(uuid), public.open_direct_conversation(uuid),
  public.set_conversation_message_pin(uuid,boolean), public.toggle_conversation_reaction(uuid,text) to authenticated;

-- Existing threads, messages and read markers are retained where access still applies.
do $$ declare task public.tasks; begin
  for task in select * from public.tasks where deleted_at is null or exists (
    select 1 from public.chat_channels where task_id=tasks.id
  ) loop
    perform eflow_chat.sync_task_channel(task);
  end loop;
end $$;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_channels') then
      alter publication supabase_realtime add table public.chat_channels;
    end if;
  end if;
end $$;
