import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';

it('blocks funded projects and preserves returned funding and request history on deletion', async () => {
  const db = await PGlite.create();
  const project = '10000000-0000-4000-8000-000000000001';
  const other = '10000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema eflow_project;
      create table public.projects (id uuid primary key);
      create table eflow_project.funding (
        id integer primary key, project_id uuid not null references public.projects, amount numeric not null
      );
      create table eflow_project.funding_requests (
        id integer primary key, project_id uuid not null references public.projects, status text not null
      );
      create table public.work_budget_allocation_lines (
        id integer primary key, project_funding_id integer references eflow_project.funding
      );
    `);
    await db.query('insert into public.projects values ($1), ($2)', [project, other]);
    await db.query('insert into eflow_project.funding values (1, $1, 0), (2, $1, 250), (3, $2, 90)', [project, other]);
    await db.query("insert into eflow_project.funding_requests values (1, $1, 'pending')", [project]);
    await db.exec('insert into public.work_budget_allocation_lines values (1, 1)');
    const removeProject = () => db.query('delete from public.projects where id = $1 returning id', [project]);
    await expect(removeProject()).rejects.toThrow('funding_project_id_fkey');

    const directory = new URL('../../supabase/migrations/', import.meta.url);
    const file = (await readdir(directory)).find(name => name.endsWith('_preserve_funding_history_on_project_delete.sql'));
    expect(file).toBeDefined();
    await db.exec(await readFile(new URL(file!, directory), 'utf8'));
    await expect(removeProject()).rejects.toThrow('Return unused funds');
    await db.exec('update eflow_project.funding set amount = 0 where id = 2');
    await expect(removeProject()).rejects.toThrow('Resolve pending funding requests');
    expect((await db.query('select project_id, deleted_project_id from eflow_project.funding where id = 1')).rows)
      .toEqual([{ project_id: project, deleted_project_id: null }]);

    await db.exec("update eflow_project.funding_requests set status = 'rejected' where id = 1");
    expect((await removeProject()).rows).toEqual([{ id: project }]);
    expect((await db.query('select id, project_id, deleted_project_id from eflow_project.funding order by id')).rows)
      .toEqual([
        { id: 1, project_id: null, deleted_project_id: project },
        { id: 2, project_id: null, deleted_project_id: project },
        { id: 3, project_id: other, deleted_project_id: null },
      ]);
    expect((await db.query('select project_id, deleted_project_id, status from eflow_project.funding_requests')).rows)
      .toEqual([{ project_id: null, deleted_project_id: project, status: 'rejected' }]);
    expect((await db.query('select project_funding_id from public.work_budget_allocation_lines')).rows)
      .toEqual([{ project_funding_id: 1 }]);
  } finally {
    await db.close();
  }
}, 30_000);
