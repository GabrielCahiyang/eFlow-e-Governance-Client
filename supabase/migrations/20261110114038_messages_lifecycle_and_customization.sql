alter table public.chat_channels add column custom_name text, add column avatar_path text;
alter table public.chat_messages add column deleted_at timestamptz, add column activity_kind text;
create policy chat_activity_server_only on public.chat_messages as restrictive for insert to authenticated
with check (activity_kind is null);
alter table public.notifications add column conversation_message_id uuid;

create table eflow_chat.personal_pins (
  channel_id uuid references public.chat_channels(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);
create table eflow_chat.nicknames (
  channel_id uuid references public.chat_channels(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  nickname text not null,
  primary key (channel_id, user_id)
);
alter table eflow_chat.personal_pins enable row level security;
alter table eflow_chat.nicknames enable row level security;

create function eflow_chat.project_for_channel(p_channel uuid)
returns uuid language sql stable set search_path = '' as $$
  select coalesce(c.project_id,t.linked_project_id)
  from public.chat_channels c left join public.tasks t on t.id=c.task_id
  where c.id=p_channel
$$;

create function eflow_chat.require_open(p_channel uuid)
returns void language plpgsql set search_path = '' as $$
declare state text;
begin
  select status into state from public.projects where id=eflow_chat.project_for_channel(p_channel) for share;
  if state in ('completed','archived') then
    raise exception 'This project chat is archived.' using errcode='42501';
  end if;
end $$;

create function eflow_chat.can_edit_group(p_channel uuid,p_actor uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists(
    select 1 from public.chat_channels c
    left join public.projects p on p.id=c.project_id
    left join public.tasks t on t.id=c.task_id
    where c.id=p_channel and public.is_channel_member(c.id,p_actor) and (
      (c.channel_type='project' and (p.project_lead_id=p_actor or public.phase2_is_office_head(p_actor,p.org_id)))
      or (c.channel_type='task' and coalesce(t.recommendation_lead_id,t.assigned_to)=p_actor)
    )
  )
$$;

create function eflow_chat.message_payload(p_text text)
returns jsonb language plpgsql immutable set search_path = '' as $$
begin
  if left(p_text,1)='{' then return p_text::jsonb; end if;
  return null;
exception when data_exception then return null;
end $$;

create function eflow_chat.guard_message_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare payload jsonb; source public.chat_messages;
begin
  -- Permit cascading cleanup after the channel itself has been deleted.
  if tg_op='DELETE' then
    if exists(select 1 from public.chat_channels where id=old.channel_id) then
      perform eflow_chat.require_open(old.channel_id);
    end if;
    return old;
  end if;
  perform eflow_chat.require_open(new.channel_id);
  if tg_op='UPDATE' and old.deleted_at is not null then
    if new is distinct from old then raise exception 'This message was deleted.' using errcode='42501'; end if;
    return new;
  end if;
  if tg_op='INSERT' then
    if new.deleted_at is not null or starts_with(split_part(new.image_path,'/',3),'avatar-') then
      raise exception 'Invalid new message.' using errcode='42501';
    end if;
  end if;
  if tg_op='INSERT' or new.content is distinct from old.content then
    payload:=eflow_chat.message_payload(new.content);
    if jsonb_typeof(payload->'replyToId')='string' then
      select * into source from public.chat_messages
      where id=(payload->>'replyToId')::uuid and channel_id=new.channel_id for share;
      if not found or source.deleted_at is not null then
        payload:=(payload-'replyToName'-'replyToText')||jsonb_build_object('replyToText','Message deleted.');
      else
        payload:=payload||jsonb_build_object('replyToName',source.sender_name,'replyToText',
          coalesce(eflow_chat.message_payload(source.content)->>'text',nullif(source.content,''),'Shared image'));
      end if;
      new.content:=payload::text;
    end if;
  end if;
  return new;
end $$;

create trigger chat_messages_guard_lifecycle
before insert or update or delete on public.chat_messages
for each row execute function eflow_chat.guard_message_write();

create function public.list_message_conversations_v2()
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(summary)||jsonb_build_object(
    'name',coalesce(c.custom_name,summary.name),
    'parent_project_id',p.id,'project_title',coalesce(p.title,summary.project_title),
    'default_name',summary.name,'avatar_path',c.avatar_path,
    'archived',coalesce(p.status in ('completed','archived'),false),
    'completed_at',p.completed_at,
    'personal_pin',pin.pinned_at,
    'can_edit_group',eflow_chat.can_edit_group(c.id,auth.uid())
  )
  from public.list_message_conversations() summary
  join public.chat_channels c on c.id=summary.channel_id
  left join public.projects p on p.id=eflow_chat.project_for_channel(c.id)
  left join eflow_chat.personal_pins pin on pin.channel_id=c.id and pin.user_id=auth.uid()
  order by coalesce(summary.last_message_at,c.created_at) desc,c.id
$$;

create function public.list_message_people_v2(p_channel uuid)
returns table(id uuid,name text,is_lead boolean,nickname text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.name,p.is_lead,n.nickname
  from public.list_message_people(p_channel) p
  left join eflow_chat.nicknames n on n.channel_id=p_channel and n.user_id=p.id
$$;

create function public.set_conversation_pin(p_channel uuid,p_pin boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not public.is_channel_member(p_channel,actor) then
    raise exception 'Conversation unavailable.' using errcode='42501';
  end if;
  perform eflow_chat.require_open(p_channel);
  if p_pin then
    insert into eflow_chat.personal_pins(channel_id,user_id) values(p_channel,actor) on conflict do nothing;
  else
    delete from eflow_chat.personal_pins where channel_id=p_channel and user_id=actor;
  end if;
end $$;

create function public.edit_conversation_group(p_channel uuid,p_name text,p_avatar text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); previous text;
begin
  if actor is null or not eflow_chat.can_edit_group(p_channel,actor) then
    raise exception 'Only the chat lead can edit this group.' using errcode='42501';
  end if;
  perform eflow_chat.require_open(p_channel);
  select avatar_path into previous from public.chat_channels where id=p_channel for update;
  if char_length(btrim(p_name))>100 then raise exception 'Use a chat name up to 100 characters.' using errcode='22023'; end if;
  if p_avatar is distinct from previous and p_avatar is not null and (
    split_part(p_avatar,'/',1)<>p_channel::text or split_part(p_avatar,'/',2)<>actor::text
    or not starts_with(split_part(p_avatar,'/',3),'avatar-')
    or not exists(select 1 from storage.objects where bucket_id='conversation-images' and name=p_avatar)
    or exists(select 1 from public.chat_messages where image_path=p_avatar)
  ) then raise exception 'Choose an uploaded chat photo.' using errcode='22023'; end if;
  update public.chat_channels set custom_name=nullif(btrim(p_name),''),avatar_path=p_avatar where id=p_channel;
end $$;

create function public.set_conversation_nickname(p_channel uuid,p_person uuid,p_nickname text)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); actor_name text; person_name text; previous text;
begin
  if actor is null or not public.is_channel_member(p_channel,actor)
    or not exists(select 1 from public.chat_channels where id=p_channel and channel_type in ('task','project'))
    then raise exception 'Group chat unavailable.' using errcode='42501'; end if;
  perform eflow_chat.require_open(p_channel);
  select name into person_name from public.list_message_people(p_channel) where id=p_person;
  if not found then raise exception 'This person is no longer in the chat.' using errcode='42501'; end if;
  perform 1 from public.chat_channels where id=p_channel for update;
  p_nickname:=nullif(btrim(p_nickname),'');
  if char_length(p_nickname)>40 then raise exception 'Use a nickname up to 40 characters.' using errcode='22023'; end if;
  select nickname into previous from eflow_chat.nicknames where channel_id=p_channel and user_id=p_person;
  if previous is not distinct from p_nickname then return; end if;
  if p_nickname is null then
    delete from eflow_chat.nicknames where channel_id=p_channel and user_id=p_person;
  else
    insert into eflow_chat.nicknames values(p_channel,p_person,p_nickname)
    on conflict(channel_id,user_id) do update set nickname=excluded.nickname;
  end if;
  select full_name into actor_name from public.profiles where id=actor;
  insert into public.chat_messages(channel_id,sender_id,sender_name,content,activity_kind)
  values(p_channel,actor,actor_name,
    case when p_nickname is null then actor_name||' cleared the nickname for '||person_name||'.'
    else actor_name||' set the nickname for '||person_name||' to '||p_nickname||'.' end,'nickname');
end $$;

create function public.remove_conversation_message(p_message uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); source public.chat_messages; original text; attachment text;
begin
  select * into source from public.chat_messages where id=p_message and sender_id=actor
    and public.is_channel_member(channel_id,actor) for update;
  if not found then raise exception 'You can only remove your own messages.' using errcode='42501'; end if;
  perform eflow_chat.require_open(source.channel_id);
  if source.deleted_at is not null then return null; end if;
  original:=coalesce(eflow_chat.message_payload(source.content)->>'text',source.content);
  attachment:=source.image_path;
  update public.chat_messages set deleted_at=now(),content='Message deleted.',image_path=null,pinned_at=null,reaction_users='{}'
  where id=p_message;
  -- Older replies stored only a copy of the sender and text. Clear matching copies too.
  update public.chat_messages m
  set content=((q.payload-'replyToName'-'replyToText')||jsonb_build_object('replyToText','Message deleted.'))::text
  from (
    select id,eflow_chat.message_payload(content) payload from public.chat_messages
    where channel_id=source.channel_id and id<>p_message and deleted_at is null
  ) q
  where m.id=q.id and (q.payload->>'replyToId'=p_message::text or (
    q.payload->>'replyToId' is null and q.payload->>'replyToName'=source.sender_name
    and q.payload->>'replyToText'=original
  ));
  return attachment;
end $$;

create function public.chat_avatar_is_used(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_access_conversation_image(p_path) and exists(
    select 1 from public.chat_channels where avatar_path=p_path
  )
$$;
create function public.can_read_shared_conversation_image(p_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_access_conversation_image(p_path) and (
    split_part(p_path,'/',2)=auth.uid()::text
    or exists(select 1 from public.chat_channels where avatar_path=p_path)
    or exists(select 1 from public.chat_messages where image_path=p_path and deleted_at is null)
  )
$$;
alter policy conversation_images_read on storage.objects using (
  bucket_id='conversation-images' and public.can_read_shared_conversation_image(name)
);
alter policy conversation_images_cleanup on storage.objects using (
  bucket_id='conversation-images' and public.can_access_conversation_image(name)
  and split_part(name,'/',2)=auth.uid()::text
  and not public.chat_avatar_is_used(name)
  and not exists(select 1 from public.chat_messages m where m.image_path=name)
);

alter policy notification_conversation_reference_server_only on public.notifications
with check (conversation_id is null and conversation_message_id is null);
revoke all on function eflow_chat.project_for_channel(uuid),eflow_chat.require_open(uuid),
  eflow_chat.can_edit_group(uuid,uuid),eflow_chat.message_payload(text),eflow_chat.guard_message_write()
from public,anon,authenticated;
revoke all on function public.list_message_conversations_v2(),public.list_message_people_v2(uuid),
  public.set_conversation_pin(uuid,boolean),public.edit_conversation_group(uuid,text,text),
  public.set_conversation_nickname(uuid,uuid,text),public.remove_conversation_message(uuid),
  public.chat_avatar_is_used(text),public.can_read_shared_conversation_image(text)
from public,anon;
grant execute on function public.list_message_conversations_v2(),public.list_message_people_v2(uuid),
  public.set_conversation_pin(uuid,boolean),public.edit_conversation_group(uuid,text,text),
  public.set_conversation_nickname(uuid,uuid,text),public.remove_conversation_message(uuid),
  public.chat_avatar_is_used(text),public.can_read_shared_conversation_image(text)
to authenticated;

create or replace function eflow_chat.notify_message_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  payload jsonb;
  body text := new.content;
  everyone boolean;
  sender text;
  chat_name text;
begin
  if actor is null or new.sender_id is distinct from actor or new.activity_kind is not null then return new; end if;
  if left(new.content, 1) = '{' then
    begin
      payload := new.content::jsonb;
    exception when data_exception then
      payload := null;
    end;
    if jsonb_typeof(payload->'text') = 'string' then body := payload->>'text'; end if;
  end if;

  everyone := body ~* '(^|[[:space:]([{])@everyone(?![[:alnum:]_@/-])';
  if not coalesce(everyone, false) and jsonb_typeof(payload->'mentions') is distinct from 'array' then
    return new;
  end if;

  select coalesce(nullif(c.name, ''), 'Direct message'),
         coalesce(nullif(p.full_name, ''), 'Someone'),
         c.channel_type <> 'direct' and everyone
    into chat_name, sender, everyone
  from public.chat_channels c join public.profiles p on p.id = actor
  where c.id = new.channel_id;

  if not coalesce(everyone, false) and jsonb_typeof(payload->'mentions') is distinct from 'array' then
    return new;
  end if;

  insert into public.notifications(user_id, type, title, message, actor_id, actor_name, conversation_id, conversation_message_id)
  select person.id, 'comment', 'You were mentioned',
    case when everyone then sender || ' mentioned @everyone in ' || chat_name
         else sender || ' mentioned you in ' || chat_name end,
    actor, sender, new.channel_id, new.id
  from (
    select member.id, member.name from public.list_message_people(new.channel_id) member where not everyone
    union all
    select p.id, p.full_name from public.profiles p where everyone and public.is_channel_member(new.channel_id, p.id)
  ) person
  where person.id <> actor and (everyone or exists (
    select 1
    from jsonb_array_elements(case when jsonb_typeof(payload->'mentions') = 'array'
      then payload->'mentions' else '[]'::jsonb end) mention
    where mention->>'id' = person.id::text and mention->>'label' = '@' || person.name
      and strpos(body, mention->>'label') > 0
  ));
  return new;
end $$;
