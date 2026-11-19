import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

const task = '20000000-0000-4000-8000-000000000001';
const subtask = '20000000-0000-4000-8000-000000000002';
const actor = '20000000-0000-4000-8000-000000000003';

async function setup() {
  const db = await PGlite.create();
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema eflow_work_clearance;
    create table public.subtasks (id uuid primary key, task_id uuid);
    create table public.petty_cash_requests (task_id uuid, subtask_id uuid, status text, actual_spent numeric);
    create table public.audit_events (
      id uuid primary key default gen_random_uuid(), actor_id uuid, actor_name text, entity_type text, entity_id text,
      action text, reason text, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
    create table public.task_activities (
      id uuid primary key default gen_random_uuid(), task_id uuid not null, actor_id uuid, actor_name text,
      type text not null, content text, metadata jsonb, created_at timestamptz default now());
    insert into public.subtasks values ('${subtask}', '${task}');
  `);
  return db;
}
const migration = () => readFile(new URL('../../supabase/migrations/20261119080000_log_unused_budget_returned_on_completion.sql', import.meta.url), 'utf8');
const activities = async (db: PGlite) => (await db.query<{ content: string; metadata: Record<string, unknown> }>(
  "select content, metadata from public.task_activities where type = 'budget_unused_returned' order by created_at, id")).rows;

it('logs a task whose whole budget was returned, keeping the original amount in the history', async () => {
  const db = await setup();
  try {
    await db.exec(await migration());
    await db.query(
      `insert into public.audit_events (actor_id, actor_name, entity_type, entity_id, action, before_data, after_data)
       values ($1, 'Head', 'task', $2, 'project.unused_funding_restored_automatically', '{"amount": 400}', '{"amount": 0, "returned": 400}')`,
      [actor, task],
    );
    const rows = await activities(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].metadata).toMatchObject({ scope: 'task', budget: 400, returned: 400, kept: 0, actualSpent: 0 });
    expect(rows[0].content).toContain('₱400.00 was returned to the project budget');
    expect(rows[0].content).toContain('Actual spent: ₱0.00');
  } finally { await db.close(); }
});

it('records the spent part for partly used budgets and logs subtask caps against their task', async () => {
  const db = await setup();
  try {
    await db.exec(await migration());
    await db.query("insert into public.petty_cash_requests values ($1, null, 'settled', 200), ($1, null, 'released', 999)", [task]);
    await db.query(
      `insert into public.audit_events (actor_id, entity_type, entity_id, action, before_data, after_data) values
       ($1, 'task', $2, 'project.unused_funding_restored_automatically', '{"amount": 500}', '{"amount": 200, "returned": 300}'),
       ($1, 'subtask', $3, 'project.subtask_unused_funding_restored', '{"amount": 250}', '{"amount": 0}'),
       ($1, 'task', $2, 'project.task_unused_funding_released', '{"amount": 500}', '{"amount": 100}')`,
      [actor, task, subtask],
    );
    const rows = await activities(db);
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.metadata.scope).sort()).toEqual(['subtask', 'task']);
    const taskRow = rows.find(row => row.metadata.scope === 'task')!;
    expect(taskRow.metadata).toMatchObject({ budget: 500, returned: 300, kept: 200, actualSpent: 200 });
    const subtaskRow = rows.find(row => row.metadata.scope === 'subtask')!;
    expect(subtaskRow.metadata).toMatchObject({ subtaskId: subtask, returned: 250 });
    expect((await db.query<{ task_id: string }>("select task_id from public.task_activities where metadata->>'scope' = 'subtask'")).rows[0].task_id).toBe(task);
  } finally { await db.close(); }
});

it('ignores nothing-returned events, never blocks the audit write, and backfills once', async () => {
  const db = await setup();
  try {
    await db.query(
      `insert into public.audit_events (entity_type, entity_id, action, before_data, after_data) values
       ('task', $1, 'project.unused_funding_restored_automatically', '{"amount": 100}', '{"amount": 70, "returned": 30}')`,
      [task],
    );
    await db.exec(await migration());
    expect(await activities(db)).toHaveLength(1);
    await db.exec(await migration());
    expect(await activities(db)).toHaveLength(1);
    await db.query(
      `insert into public.audit_events (entity_type, entity_id, action, before_data, after_data) values
       ('task', $1, 'project.unused_funding_restored_automatically', '{"amount": 100}', '{"amount": 100, "returned": 0}'),
       ('task', 'not-a-uuid', 'project.unused_funding_restored_automatically', '{"amount": 100}', '{"amount": 0, "returned": 100}')`,
      [task],
    );
    expect(await activities(db)).toHaveLength(1);
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.audit_events")).rows[0].n).toBe(3);
  } finally { await db.close(); }
});
