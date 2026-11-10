import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('enforces archive, membership, deletion and private conversation settings in PostgreSQL', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema eflow_chat;
      create schema auth;
      create schema storage;
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table profiles(id uuid primary key, full_name text);
      create table projects(id uuid primary key,title text,status text,completed_at timestamptz,project_lead_id uuid,org_id uuid);
      create table tasks(id uuid primary key,linked_project_id uuid,recommendation_lead_id uuid,assigned_to uuid);
      create table chat_channels(id uuid primary key,project_id uuid,task_id uuid,channel_type text,name text,created_at timestamptz default now());
      create table members(channel_id uuid,user_id uuid);
      create table chat_messages(id uuid primary key default gen_random_uuid(),channel_id uuid,sender_id uuid,sender_name text,
        content text,image_path text,pinned_at timestamptz,reaction_users jsonb default '{}');
      create table notifications(user_id uuid,type text,title text,message text,actor_id uuid,actor_name text,conversation_id uuid);
      create table storage.objects(name text,bucket_id text);
      create policy conversation_images_read on storage.objects for select using(true);
      create policy conversation_images_cleanup on storage.objects for delete using(true);
      create policy notification_conversation_reference_server_only on notifications for insert with check(true);
      create function public.is_channel_member(uuid,uuid) returns boolean language sql stable as
        $$select exists(select 1 from public.members where channel_id=$1 and user_id=$2)$$;
      create function public.phase2_is_office_head(uuid,uuid) returns boolean language sql stable as $$select false$$;
      create function public.can_access_conversation_image(text) returns boolean language sql stable as
        $$select public.is_channel_member(split_part($1,'/',1)::uuid,auth.uid())$$;
      create function public.list_message_people(uuid) returns table(id uuid,name text,is_lead boolean) language sql stable as
        $$select p.id,p.full_name,false from public.profiles p where public.is_channel_member($1,auth.uid()) and public.is_channel_member($1,p.id)$$;
      create function public.list_message_conversations()
      returns table(channel_id uuid,name text,project_title text,last_message_at timestamptz)
      language sql stable as $$select id,name,null::text,null::timestamptz from public.chat_channels where public.is_channel_member(id,auth.uid())$$;
      create function eflow_chat.notify_message_mentions() returns trigger language plpgsql as $$begin return new; end$$;
      create trigger notify_mentions after insert on chat_messages for each row execute function eflow_chat.notify_message_mentions();
    `);
    const sql = await readFile(new URL('../../supabase/migrations/20261110114038_messages_lifecycle_and_customization.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    const id = (suffix: string) => '00000000-0000-4000-8000-0000000000' + suffix;
    const [lead, peer, outsider, project, task, group, taskChat, original, reply] =
      ['01','02','03','04','05','06','07','08','09'].map(id);
    const as = (actor: string) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
    await db.query("insert into profiles values ($1,'Lead'),($2,'Peer'),($3,'Outsider')", [lead, peer, outsider]);
    await db.query("insert into projects values ($1,'Project A','active',null,$2,null)", [project, lead]);
    await db.query('insert into tasks values ($1,$2,$3,null)', [task, project, peer]);
    await db.query("insert into chat_channels(id,project_id,task_id,channel_type,name) values ($1,$2,null,'project','Project A'),($3,null,$4,'task','Task A')", [group,project,taskChat,task]);
    await db.query('insert into members values ($1,$2),($1,$3),($4,$2),($4,$3)', [group,lead,peer,taskChat]);
    await as(lead);
    const photo = group + '/' + lead + '/avatar-test.png';
    await db.query("insert into storage.objects values ($1,'conversation-images')", [photo]);
    await db.query("select edit_conversation_group($1,'Project chat',$2)", [group, photo]);
    await db.query('select set_conversation_pin($1,true)', [taskChat]);
    await db.query("select set_conversation_nickname($1,$2,'Coordinator')", [group,peer]);
    expect((await db.query('select nickname from list_message_people_v2($1) where id=$2', [group,peer])).rows).toEqual([{ nickname: 'Coordinator' }]);
    expect((await db.query("select c->>'name' name,c->>'avatar_path' photo from list_message_conversations_v2() c where c->>'channel_id'=$1", [group])).rows)
      .toEqual([{ name: 'Project chat', photo }]);
    const attachment = group + '/' + lead + '/attachment.png';
    await db.query("insert into chat_messages(id,channel_id,sender_id,sender_name,content,image_path,pinned_at,reaction_users) values ($1,$2,$3,'Lead','Private text',$4,now(),'{\"emoji\":{}}')", [original, group, lead, attachment]);
    await as(peer);
    await db.query("select set_conversation_nickname($1,$2,'Team captain')", [group,lead]);
    expect((await db.query('select nickname from list_message_people_v2($1) where id=$2', [group,lead])).rows)
      .toEqual([{ nickname: 'Team captain' }]);
    await db.query("insert into chat_messages(id,channel_id,sender_id,sender_name,content) values ($1,$2,$3,'Peer',$4)", [reply, group, peer, JSON.stringify({ text: 'A reply', replyToId: original })]);
    await expect(db.query('select remove_conversation_message($1)', [original])).rejects.toThrow(/your own/);
    await expect(db.query("select edit_conversation_group($1,'Wrong',null)", [group])).rejects.toThrow(/chat lead/);
    await as(lead);
    await db.query('select remove_conversation_message($1)', [original]);
    expect((await db.query('select content,image_path,pinned_at,reaction_users from chat_messages where id=$1', [original])).rows)
      .toEqual([{ content: 'Message deleted.', image_path: null, pinned_at: null, reaction_users: {} }]);
    expect((await db.query('select content::jsonb content from chat_messages where id=$1', [reply])).rows)
      .toEqual([{ content: { text: 'A reply', replyToId: original, replyToText: 'Message deleted.' } }]);
    await as(peer);
    expect((await db.query('select can_read_shared_conversation_image($1) allowed', [attachment])).rows).toEqual([{ allowed: false }]);
    expect((await db.query("select c->>'personal_pin' pin from list_message_conversations_v2() c where c->>'channel_id'=$1", [taskChat])).rows)
      .toEqual([{ pin: null }]);
    await expect(db.query("select set_conversation_nickname($1,$2,'Wrong')", [group,outsider])).rejects.toThrow(/no longer in the chat/);
    await db.query("update projects set status='completed',completed_at=now() where id=$1", [project]);
    expect((await db.query("select c->>'archived' archived from list_message_conversations_v2() c")).rows)
      .toEqual([{ archived: 'true' }, { archived: 'true' }]);
    await expect(db.query("insert into chat_messages(channel_id,sender_id,sender_name,content) values ($1,$2,'Peer','New')", [taskChat, peer])).rejects.toThrow(/archived/);
    await expect(db.query("select set_conversation_nickname($1,$2,'New')", [group,peer])).rejects.toThrow(/archived/);
    await db.query("update projects set status='active' where id=$1", [project]);
    const sent = await db.query("insert into chat_messages(channel_id,sender_id,sender_name,content) values ($1,$2,'Peer','@everyone') returning id", [taskChat,peer]);
    expect((await db.query('select user_id,conversation_id,conversation_message_id from notifications')).rows)
      .toEqual([{ user_id: lead, conversation_id: taskChat, conversation_message_id: sent.rows[0].id }]);
  } finally { await db.close(); }
}, 30_000);
