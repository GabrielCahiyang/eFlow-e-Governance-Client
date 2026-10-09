// Disposable PostgreSQL integration of both parents. No hosted credentials or writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { phase65Database } from '../tests/sql/helpers/phase65Database.mjs';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let db, checks = 0;
const value = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0];
const check = (ok, label) => { assert.ok(ok, label); checks++; };
const deny = async (sql, args = [], pattern) => { await assert.rejects(db.query(sql, args), pattern); checks++; };
const actor = async n => {
  await db.exec('reset role');
  await value("select set_config('request.jwt.claim.sub',$1,false)", [n ? id(n) : '']);
  await db.exec('set role authenticated');
};
const install = async name => db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
const create = (title, extra = {}) => value('select to_jsonb(create_project_with_details($1::jsonb))',
  [JSON.stringify({ title, org_id: id(90), status: 'planning', ...extra })]);
try {
  db = await phase65Database({ repositoryContinuation: true });
  await db.exec(`
    insert into organizations(id,name,slug,path,org_type) values
      ('${id(90)}','Lead Office','lead','lead','department'),('${id(91)}','Foreign Office','foreign','foreign','department');
    insert into auth.users(id,email,email_confirmed_at) values ${[1,2,3,4].map(n => `('${id(n)}','p${n}@example.test',now())`).join(',')};
    insert into profiles(id,full_name,email,employee_id,role,is_active,org_id) values
      ('${id(1)}','Admin','p1@example.test','1','admin',true,null),
      ('${id(2)}','Lead Head','p2@example.test','2','member',true,'${id(90)}'),
      ('${id(3)}','Lead member','p3@example.test','3','member',true,'${id(90)}'),
      ('${id(4)}','Foreign Head','p4@example.test','4','member',true,'${id(91)}');`);
  await actor(1);
  await value('select set_organization_leadership($1,$2,null)', [id(90),id(2)]);
  await value('select set_organization_leadership($1,$2,null)', [id(91),id(4)]);
  await actor(2);
  const draft = await create('Previously created draft', { start_date: '2026-10-01', target_date: '2026-12-01' });
  check(draft.publication_state === 'draft', 'Fixture reproduces the incoming publication guard');
  const group = await value('select id from project_groups where project_id=$1 order by position limit 1', [draft.id]);
  const task = await value('select (phase3_create_task($1,$2,$3)).id', [draft.id,group,'Existing delivery work']);
  const published = await create('Historical Head publication');
  // A historical accepted receipt predates the merge. Preserve exact provenance.
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update projects set publication_state='published',published_at='2026-10-07T12:00:00Z',published_by=$2,updated_at='2026-10-07T12:00:00Z' where id=$1", [published.id,id(2)]);
  await db.query("insert into audit_events(actor_id,entity_type,entity_id,action,org_id,after_data) values($1,'project',$2,'project.published',$3,'{\"historical\":true}')", [id(2),published.id,id(90)]);
  await db.exec('set session_replication_role=origin');
  const before = await value('select to_jsonb(p) from projects p where id=$1', [draft.id]);
  const provenance = await value('select to_jsonb(p) from projects p where id=$1', [published.id]);
  const audits = await value("select jsonb_agg(to_jsonb(a) order by id) from audit_events a where action='project.published'");
  await install('20261009120000_refinement_project_creation_compatibility.sql');
  const after = await value('select to_jsonb(p) from projects p where id=$1', [draft.id]);
  assert.deepEqual(after, { ...before, publication_state: 'published' }); checks++;
  assert.deepEqual(await value('select to_jsonb(p) from projects p where id=$1', [published.id]), provenance); checks++;
  assert.deepEqual(await value("select jsonb_agg(to_jsonb(a) order by id) from audit_events a where action='project.published'"), audits); checks++;
  check(await value('select count(*)=1 from tasks where id=$1 and linked_project_id=$2', [task,draft.id]), 'Normalization preserves existing delivery work');
  check(await value("select tgenabled='O' from pg_trigger where tgrelid='projects'::regclass and tgname='projects_touch'"), 'Timestamp trigger restored');

  await db.exec(`create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
    insert into storage.buckets(id,name,public) values('task-attachments','task-attachments',false);`);

  for (const file of [
    '20260831000001_task_evidence_security.sql',
    '20261007120000_r3_personal_workspaces.sql',
    '20261008030659_r6_project_file_library.sql',
    '20261008035748_r7_project_members_and_nested_work.sql',
    '20261008060756_r8_approved_project_invitations.sql',
    '20261008081855_r9_project_access_lifecycle.sql',
    '20261008123723_r11_project_activity_snapshots.sql',
    '20261008134347_r12_presentation_settings.sql',
  ]) await install(file);
  await actor(2);
  const ordinary = await create('Immediate Office project');
  check(ordinary.publication_state === 'published' && ordinary.status === 'planning', 'Manual creation enters ordinary Planning immediately');
  check(ordinary.published_at === null && ordinary.published_by === null, 'Manual creation invents no Head-publication provenance');
  check(await value('select can_see_project($1,$2) and can_manage_project($1,$2)', [ordinary.id,id(2)]), 'Creating Head can navigate and manage the ordinary project');
  check(await value('select count(*)>0 from project_groups where project_id=$1', [ordinary.id]), 'Ordinary creation retains Main table groups');
  const readiness = await value('select phase7_project_readiness($1)', [ordinary.id]);
  check(readiness.stage === 'Planning' && !Object.hasOwn(readiness,'canPublish'), 'Original readiness stage and public contract retained');
  check(!readiness.checks.some(c => c.key.startsWith('project_description') || c.key.startsWith('task_name:')), 'No second publication-specific readiness gate');
  await deny('select phase7_activate_project($1)', [ordinary.id], /readiness is incomplete/);
  await deny('update projects set published_by=$2 where id=$1', [published.id,id(3)], /history cannot be edited/);
  await value('select publish_project($1)', [ordinary.id]);
  check(await value("select status='planning' and published_at is null from projects where id=$1", [ordinary.id]), 'Retained legacy endpoint is idempotent and does not activate ordinary projects');

  const ordinaryGroup = await value('select id from project_groups where project_id=$1 order by position limit 1', [ordinary.id]);
  const ordinaryTask = await value('select (phase3_create_task($1,$2,$3)).id', [ordinary.id,ordinaryGroup,'Ready work']);
  await db.exec('reset role; set session_replication_role=replica');
  await db.query("update tasks set assigned_to=$2,status='todo',due_date='2026-12-01' where id=$1", [ordinaryTask,id(2)]);
  await db.exec('set session_replication_role=origin');
  await actor(2);
  await db.query("update projects set start_date='2026-10-01',target_date='2026-12-01' where id=$1", [ordinary.id]);
  for (const kind of ['structure','dates','budget']) await value('select phase7_review_project($1,$2)', [ordinary.id,kind]);
  check((await value('select phase7_project_readiness($1)', [ordinary.id])).canActivate, 'Existing reviews enable the original activation flow');
  await value('select phase7_activate_project($1)', [ordinary.id]);
  check(await value("select status='active' and published_at is null from projects where id=$1", [ordinary.id]), 'Original activation succeeds without a Head publish step');
  await db.query('update projects set description=$2 where id=$1', [ordinary.id,'Changed delivery scope']);
  check(await value("select status='on_hold' from projects where id=$1", [ordinary.id]), 'Material-change review remains enforced');
  await actor(3);
  await deny('select phase7_review_project($1,$2)', [ordinary.id,'structure'], /Lead Head/);
  await deny('select phase7_activate_project($1)', [ordinary.id], /Lead Head/);
  await actor(4);
  await deny('select phase7_project_readiness($1)', [ordinary.id], /access required/);
  await deny('select create_project_with_details($1::jsonb)', [JSON.stringify({title:'Foreign scope',org_id:id(90)})], /cannot create/);
  await actor(1);
  await deny('select create_project_with_details($1::jsonb)', [JSON.stringify({title:'Admin operation',org_id:id(90)})]);
  await actor(null);
  await deny('select create_project_with_details($1::jsonb)', [JSON.stringify({title:'Anonymous',org_id:id(90)})], /Authentication/);
  await db.exec('reset role');
  check(!await value("select has_function_privilege('anon','public.publish_project(uuid)','EXECUTE')"), 'Anonymous legacy publication RPC stays denied');
  assert.deepEqual(await value("select jsonb_agg(to_jsonb(a) order by id) from audit_events a where action='project.published'"), audits); checks++;
  console.log(`Merged project creation PostgreSQL: ${checks} checks passed; historical publication receipts preserved; no hosted writes.`);
} catch (error) {
  console.error(error.message, error.where || '');
  process.exitCode = 1;
} finally { await db?.close(); }
