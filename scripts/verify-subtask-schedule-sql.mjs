import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const migration = name => readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8');
const source = async (file, signature) => {
  const sql = await migration(file);
  const start = sql.toLowerCase().indexOf(signature);
  assert.ok(start >= 0, signature);
  return sql.slice(start, sql.indexOf('$$;', start) + 3);
};
const db = new PGlite();
try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA eflow_r7; CREATE SCHEMA eflow_schedule;
    CREATE TABLE projects(id uuid PRIMARY KEY,start_date date,target_date date);
    CREATE TABLE tasks(id uuid PRIMARY KEY,linked_project_id uuid,start_date date,deadline text,due_date text,deleted_at timestamptz);
    CREATE TABLE personal_tasks(id uuid PRIMARY KEY);
    CREATE TABLE subtasks(id uuid PRIMARY KEY,task_id uuid,parent_subtask_id uuid,lead_id uuid,title text,assigned_to_ids uuid[],sibling_order integer,due_date date,is_standalone boolean,status text,percent_complete integer,created_at timestamptz);
    CREATE TABLE personal_subtasks (LIKE subtasks INCLUDING ALL);
    CREATE VIEW eflow_r7.nodes AS
      SELECT *, 'office'::text AS kind FROM subtasks
      UNION ALL SELECT *, 'personal'::text FROM personal_subtasks;
    SET check_function_bodies = off;
  `);
  await db.exec(await source('20261029232938_project_task_schedule_bounds.sql', 'create function eflow_schedule.calendar_day'));
  await db.exec(await source('20261030013255_direct_subitem_completion.sql', 'create or replace function eflow_r7.command'));
  await db.exec(await source('20261010175812_nested_work_checked_confirmation.sql', 'create or replace function eflow_r7.work_impact'));
  await db.exec(await source('20261010103936_nested_work_capabilities_and_execution.sql', 'create or replace function eflow_r7.snapshot'));
  await db.exec(await migration('20261112191530_subtask_schedule_bounds.sql'));
  await db.exec('SET check_function_bodies = on');
  const id = suffix => `'00000000-0000-0000-0000-00000000000${suffix}'`;
  const [project, task, parent, child, personal, personalChild, legacy, unscheduledTask, outOfBounds] = [1,2,3,4,5,6,7,8,9].map(id);
  await db.exec(`
    INSERT INTO projects VALUES (${project},'2026-10-30','2026-11-05');
    INSERT INTO tasks VALUES (${task},${project},'2026-11-01','2026-11-04',NULL,NULL);
    INSERT INTO tasks VALUES (${unscheduledTask},${project},NULL,NULL,NULL,NULL);
    INSERT INTO personal_tasks VALUES (${personal});
    INSERT INTO subtasks(id,task_id,title,start_date,due_date) VALUES
      (${parent},${task},'Parent','2026-11-01','2026-11-04'),
      (${legacy},${task},'Legacy',NULL,'2026-11-02');
    INSERT INTO subtasks(id,task_id,parent_subtask_id,title,start_date,due_date)
      VALUES (${child},${task},${parent},'Nested child','2026-11-03','2026-11-03');
    INSERT INTO personal_subtasks(id,task_id,title,start_date,due_date)
      VALUES (${personalChild},${personal},'Personal','2026-11-02','2026-11-03');
  `);
  const rejects = async (statement, message) =>
    assert.rejects(db.exec(statement), error => error.code === '22023' && message.test(error.message));
  await rejects(`INSERT INTO subtasks(id,task_id,title,start_date,due_date)
    VALUES (${outOfBounds},${unscheduledTask},'Outside project','2026-10-29','2026-11-05')`, /cannot be before 2026-10-30/);
  await rejects(`INSERT INTO subtasks(id,task_id,title,start_date,due_date)
    VALUES (${outOfBounds},${unscheduledTask},'Outside project','2026-11-05','2026-11-06')`, /cannot be after 2026-11-05/);
  await rejects(`UPDATE subtasks SET start_date='2026-10-31' WHERE id=${child}`, /cannot be before 2026-11-01/);
  await rejects(`UPDATE subtasks SET due_date='2026-11-06' WHERE id=${child}`, /cannot be after 2026-11-04/);
  await rejects(`UPDATE subtasks SET due_date='2026-11-02' WHERE id=${child}`, /on or after/);
  await rejects(`UPDATE subtasks SET start_date=NULL WHERE id=${child}`, /Choose a subtask start/);
  await rejects(`UPDATE subtasks SET start_date='2026-11-04' WHERE id=${parent}`, /Nested child/);
  await rejects(`UPDATE tasks SET deadline='2026-11-02' WHERE id=${task}`, /Parent|Nested child/);
  await rejects(`UPDATE projects SET target_date='2026-11-03' WHERE id=${project}`, /Parent/);
  await rejects(`UPDATE personal_subtasks SET due_date=NULL WHERE id=${personalChild}`, /Choose a subtask due/);
  await db.exec(`UPDATE subtasks SET title='Renamed legacy' WHERE id=${legacy}`);
  assert.deepEqual((await db.query(`SELECT start_date FROM eflow_r7.nodes WHERE id=${legacy}`)).rows, [{start_date:null}]);
  console.log('Subtask schedule migration, legacy records and ten date rejections passed.');
} catch (error) {
  console.error(error.code || '', error.message, error.where || '');
  const position = Number(error.internalPosition || error.position);
  if (position) console.error((error.internalQuery || error.query || '').slice(Math.max(0, position - 100), position + 90));
  process.exitCode = 1;
} finally {
  await db.close();
}
