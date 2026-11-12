import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('protects current work, funding and history before unlinking a project', async () => {
  const db = await PGlite.create();
  const project = '10000000-0000-4000-8000-000000000001';
  const head = '10000000-0000-4000-8000-000000000002';
  const other = '10000000-0000-4000-8000-000000000003';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema eflow_project;
      create schema eflow_phase6;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('test.actor', true), '')::uuid
      $$;
      create function public.org_in_my_subtree(uuid, uuid) returns boolean language sql as $$
        select $1 = $2
      $$;
      create function public.can_manage_project(uuid, uuid) returns boolean language sql as $$ select true $$;
      create table public.profiles (id uuid primary key, role text, full_name text, is_active boolean);
      create table public.projects (id uuid primary key, org_id uuid, title text, status text, owner_id uuid, completed_at timestamptz);
      create table public.tasks (id int primary key, linked_project_id uuid references public.projects, status text, deleted_at timestamptz, group_id uuid, milestone_id uuid);
      create table public.task_status_history (task_id int, from_status text, to_status text);
      create table public.task_submissions (task_id int, status text);
      create table public.subtasks (task_id int, status text, is_completed boolean, completed_at timestamptz);
      create table public.subtask_submissions (task_id int, status text);
      create table public.petty_cash_requests (task_id int, status text, actual_spent numeric);
      create table public.budget_commitments (id int primary key, authorization_payload jsonb, status text, amount numeric);
      create table public.work_budget_allocations (task_id int, commitment_id int, status text, amount numeric);
      create table public.audit_events (actor_id uuid, actor_name text, entity_type text, entity_id text, action text, reason text, before_data jsonb, after_data jsonb, org_id uuid);
      create table public.project_guest_members (project_id uuid);
      create table eflow_phase6.project_deletions (tx bigint, actor uuid, project_id uuid);
      create table eflow_project.funding (project_id uuid not null references public.projects, amount numeric);
      create table eflow_project.funding_requests (project_id uuid not null references public.projects, status text);
    `);
    const directory = new URL('../../supabase/migrations/', import.meta.url);
    const files = await readdir(directory);
    for (const suffix of ['preserve_funding_history_on_project_delete.sql', 'restrict_project_deletion_after_work_or_funding.sql']) {
      const file = files.find(name => name.endsWith(suffix));
      expect(file).toBeDefined();
      await db.exec(await readFile(new URL(file!, directory), 'utf8'));
    }
    await db.query("insert into public.profiles values ($1, 'head', 'Head', true), ($2, 'head', 'Another Head', true)", [head, other]);
    await db.query("insert into public.projects values ($1, $2, 'Practice', 'active', $2, null)", [project, head]);
    await db.query("insert into public.tasks values (1, $1, 'cancelled', null, null, null)", [project]);
    const setActor = (id: string) => db.query("select set_config('test.actor', $1, false)", [id]);
    const blockers = async () => (await db.query<{ blockers: string[] }>(
      'select public.get_project_deletion_blockers($1) as blockers', [project],
    )).rows[0].blockers;
    const remove = () => db.query("select public.delete_project_permanently($1, 'Practice', 'Test cleanup')", [project]);

    await setActor(other);
    await expect(blockers()).rejects.toThrow('Only an active Head for this project');
    await setActor(head);
    expect(await blockers()).toEqual([expect.stringContaining('still has tasks')]);
    await expect(remove()).rejects.toThrow('This project cannot be deleted');
    await expect(db.query('delete from public.projects where id = $1', [project])).rejects.toThrow('This project cannot be deleted');
    expect((await db.query('select linked_project_id from public.tasks')).rows).toEqual([{ linked_project_id: project }]);

    await db.exec("update public.tasks set deleted_at = now(); insert into public.task_status_history values (1, 'completed', 'cancelled')");
    expect(await blockers()).toEqual([expect.stringContaining('completed work')]);
    await expect(remove()).rejects.toThrow('This project cannot be deleted');
    await db.exec("delete from public.task_status_history; insert into public.subtasks values (1, 'completed', true, now())");
    expect(await blockers()).toEqual([expect.stringContaining('completed work')]);
    await db.exec("delete from public.subtasks; insert into public.petty_cash_requests values (1, 'settled', 500)");
    expect(await blockers()).toEqual([expect.stringContaining('spending history')]);
    await expect(remove()).rejects.toThrow('This project cannot be deleted');

    await db.exec("update public.petty_cash_requests set status = 'liquidation_submitted', actual_spent = null");
    await db.query("insert into eflow_project.funding values ($1, 2000)", [project]);
    expect(await blockers()).toEqual([expect.stringContaining('committed funds'), expect.stringContaining('open funding or cash requests')]);
    await expect(remove()).rejects.toThrow('This project cannot be deleted');

    await db.exec("update public.petty_cash_requests set status = 'settled', actual_spent = 0; update eflow_project.funding set amount = 0");
    await db.query("insert into eflow_project.funding_requests values ($1, 'pending')", [project]);
    expect(await blockers()).toEqual([expect.stringContaining('open funding or cash requests')]);
    await db.exec("update eflow_project.funding_requests set status = 'rejected'");
    expect(await blockers()).toEqual([]);
    await remove();
    expect((await db.query('select id from public.projects')).rows).toEqual([]);
    expect((await db.query('select linked_project_id from public.tasks')).rows).toEqual([{ linked_project_id: null }]);
    expect((await db.query('select deleted_project_id from eflow_project.funding')).rows).toEqual([{ deleted_project_id: project }]);
    expect((await db.query('select action from public.audit_events')).rows).toEqual([{ action: 'project.deleted' }]);
  } finally {
    await db.close();
  }
}, 30_000);
