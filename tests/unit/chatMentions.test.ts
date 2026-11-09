import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { editChatDraft, findMentionQuery, insertChatMention, mentionHighlights } from '../../src/app/features/chat-calls/services/chatMentions';

it('tracks selected people through edits and only highlights actual mention tokens', () => {
  const text = 'Hi @Cris';
  const query = findMentionQuery(text, text.length)!;
  const selected = insertChatMention({ text, mentions: [] }, query, '@Cris Ibarra', 'cris')!.draft;
  expect(selected.mentions).toEqual([{ id: 'cris', label: '@Cris Ibarra', start: 3 }]);
  expect(editChatDraft(selected, 'Please ' + selected.text).mentions[0].start).toBe(10);
  expect(editChatDraft(selected, selected.text.replace('Ibarra', 'Rivera')).mentions).toEqual([]);
  expect(findMentionQuery('user@example', 12)).toBeUndefined();
  expect(mentionHighlights('(@everyone) email@everyone @everyone_else', [], true))
    .toEqual([{ label: '@everyone', start: 1 }]);
});

it('writes one bell alert per eligible recipient, ignoring outsiders, inactive people and quoted replies', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema eflow_chat;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.profiles(id uuid primary key, full_name text, is_active boolean, org_id uuid);
      create table public.organizations(id uuid primary key, path text);
      create table public.chat_channels(id uuid primary key, channel_type text, name text, task_id uuid, org_id uuid, project_id uuid);
      create table public.chat_channel_members(channel_id uuid, user_id uuid);
      create table public.chat_messages(channel_id uuid, sender_id uuid, content text);
      create table public.notifications(user_id uuid, type text, title text, message text, actor_id uuid, actor_name text);
      create table public.tasks(id uuid primary key, deleted_at timestamptz, recommendation_lead_id uuid, assigned_to uuid);
      create table public.projects(id uuid primary key, owner_id uuid, project_lead_id uuid);
      create table public.project_members(project_id uuid, user_id uuid);
      create table public.project_offices(id uuid, project_id uuid);
      create table public.project_office_members(project_office_id uuid, user_id uuid);
      create function public.can_see_project(uuid, uuid) returns boolean language sql as $$ select true $$;
      create function public.can_see_task(uuid, uuid) returns boolean language sql as $$ select true $$;
      alter table public.notifications enable row level security;
      create policy old_notification_insert on public.notifications for insert to authenticated with check (true);
      grant insert on public.notifications, public.chat_messages to authenticated;
    `);
    const dir = new URL('../../supabase/migrations/', import.meta.url);
    const chat = await readFile(new URL('20261108172455_messages_workspace.sql', dir), 'utf8');
    const definition = (name: string) => chat.match(new RegExp('create (?:or replace )?function public\\.' + name + '\\([\\s\\S]+?\\n\\$\\$;'))![0];
    await db.exec(definition('is_channel_member') + definition('list_message_people'));
    await db.exec(await readFile(new URL('20261109130914_conversation_mentions.sql', dir), 'utf8'));

    const actor = '00000000-0000-4000-8000-000000000001';
    const [target, duplicateName, inactive, outsider] = [2, 3, 4, 5].map(n => actor.slice(0, -1) + n);
    const task = actor.slice(0, -1) + 'a';
    const channel = actor.slice(0, -1) + 'b';
    const direct = actor.slice(0, -1) + 'c';
    await db.query('insert into profiles values ($1,\'Sender\',true,null),($2,\'Alex Rivera\',true,null),($3,\'Alex Rivera\',true,null),($4,\'Inactive\',false,null),($5,\'Outsider\',true,null)', [actor, target, duplicateName, inactive, outsider]);
    await db.query('insert into tasks(id) values ($1)', [task]);
    await db.query("insert into chat_channels values ($1,'task','Task team',$2,null,null),($3,'direct','',null,null,null)", [channel, task, direct]);
    await db.query('insert into chat_channel_members values ($1,$2),($1,$3),($1,$4),($1,$5),($6,$2),($6,$3)', [channel, actor, target, duplicateName, inactive, direct]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
    const send = async (content: string, destination = channel) => {
      await db.exec('set role authenticated');
      await db.query('insert into chat_messages values ($1,$2,$3)', [destination, actor, content]);
      await db.exec('reset role');
    };
    const recipients = async () => (await db.query('select user_id, conversation_id from notifications order by user_id')).rows;

    await send(JSON.stringify({ text: '@Alex Rivera @Outsider', replyToText: '@everyone', mentions: [
      { id: target, label: '@Alex Rivera' }, { id: target, label: '@Alex Rivera' }, { id: outsider, label: '@Outsider' },
    ] }));
    expect(await recipients()).toEqual([{ user_id: target, conversation_id: channel }]);
    await db.exec('truncate notifications');
    await send('Email user@everyone or https://example.test/@everyone');
    await send('@everyone', direct);
    await send('{invalid JSON');
    expect(await recipients()).toEqual([]);
    await send(JSON.stringify({ text: 'Hi (@Everyone) @everyone and @Alex Rivera', mentions: [{ id: target, label: '@Alex Rivera' }] }));
    expect(await recipients()).toEqual([target, duplicateName].map(user_id => ({ user_id, conversation_id: channel })));
    await db.exec('set role authenticated');
    await expect(db.query('insert into notifications (user_id, conversation_id) values ($1,$2)', [target, channel])).rejects.toThrow(/row-level security/);
  } finally {
    await db.close();
  }
}, 30_000);
