import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('corrects the unassigned OJT role and preserves leadership and invitation records', async () => {
  const migration = readFileSync('supabase/migrations/20261118160000_correct_ojt_custom_role_account_type.sql', 'utf8');
  const db = await PGlite.create();
  try {
    await db.exec(`
      create table public.custom_roles (key text primary key, label text, base_role text, updated_at timestamptz default now());
      create table public.profiles (role text, custom_role_key text);
      create table public.user_invitations (id int primary key, status text, account_role text);
      create table public.managed_account_invite_details (invitation_id int, custom_role_key text, requested_privileged_role text);
      insert into public.custom_roles (key, label, base_role) values ('ojt_2', 'OJT', 'head'), ('ojt', 'Acting Head', 'head');
      insert into public.profiles values ('head', 'ojt_2');
      insert into public.user_invitations values (1, 'expired', 'head');
      insert into public.managed_account_invite_details values (1, 'ojt_2', 'head');
    `);
    const accountType = async () => (await db.query<{ base_role: string }>("select base_role from public.custom_roles where key = 'ojt_2'")).rows[0].base_role;
    await db.exec(migration);
    expect(await accountType()).toBe('head');
    await db.exec("update public.user_invitations set status = 'revoked'");
    await db.exec(migration);
    expect(await accountType()).toBe('head');
    await db.exec("delete from public.profiles where custom_role_key = 'ojt_2'; update public.user_invitations set status = 'expired'");
    await db.exec(migration);
    expect(await accountType()).toBe('head');
    await db.exec("update public.user_invitations set status = 'revoked'");
    await db.exec(migration);
    expect(await accountType()).toBe('member');
    expect((await db.query("select base_role from public.custom_roles where key = 'ojt'")).rows).toEqual([{ base_role: 'head' }]);
    expect((await db.query('select status, account_role from public.user_invitations')).rows).toEqual([{ status: 'revoked', account_role: 'head' }]);
  } finally {
    await db.close();
  }
}, 15000);
