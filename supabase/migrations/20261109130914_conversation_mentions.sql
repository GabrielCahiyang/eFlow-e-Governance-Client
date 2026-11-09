alter table public.notifications add column conversation_id uuid;
create policy notification_conversation_reference_server_only
on public.notifications as restrictive for insert to authenticated
with check (conversation_id is null);

-- Keep the message and its alerts in the same transaction. Use the same
-- eligible participants as the conversation's Members list.
create function eflow_chat.notify_message_mentions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  payload jsonb;
  body text := new.content;
  everyone boolean;
  sender text;
  chat_name text;
begin
  if actor is null or new.sender_id is distinct from actor then return new; end if;
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

  insert into public.notifications(user_id, type, title, message, actor_id, actor_name, conversation_id)
  select person.id, 'comment', 'You were mentioned',
    case when everyone then sender || ' mentioned @everyone in ' || chat_name
         else sender || ' mentioned you in ' || chat_name end,
    actor, sender, new.channel_id
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

revoke all on function eflow_chat.notify_message_mentions() from public, anon, authenticated;
create trigger chat_messages_notify_mentions after insert on public.chat_messages
for each row execute function eflow_chat.notify_message_mentions();
