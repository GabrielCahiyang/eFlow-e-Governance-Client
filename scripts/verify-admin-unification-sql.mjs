/** Isolated PostgreSQL rehearsal. Never reads .env or connects to Supabase.
 * Install the test runtime once:
 * npm install --prefix tmp/phase1-sql-runtime --no-save --package-lock=false @electric-sql/pglite@0.5.8
 * Then: node scripts/verify-admin-unification-sql.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/phase1-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js';

const sql = async (name) => readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
const db = await PGlite.create();
let assertions = 0;
const check = async (expression) => {
  const { rows } = await db.query(`select (${expression}) as ok`);
  assert.equal(rows[0].ok, true, expression);
  assertions++;
};
const denied = async (statement, message) => {
  await assert.rejects(db.exec(statement), message);
  assertions++;
};
const identity = async (number) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [
  number ? `00000000-0000-0000-0000-${String(number).padStart(12, '0')}` : '',
]);
const extract = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `Missing original function ${name}`);
  const end = source.indexOf('$$;', start);
  return source.slice(start, end + 3);
};

try {
  const core = await sql('20260712000000_core_workflow');
  // Helpers first, so fixture policies can reference the original definitions.
  // SQL helpers are created after their tables, matching actual migration order.
  const fixture = await readFile(new URL('../tests/sql/admin-unification-fixture.sql', import.meta.url), 'utf8');
  const policyStart = fixture.indexOf('alter table public.profiles enable');
  await db.exec(fixture.slice(0, policyStart));
  for (const name of ['auth_role', 'auth_org_path', 'org_in_my_subtree', 'is_super_admin']) {
    await db.exec(extract(core, name));
  }
  const access = await sql('20260819000000_sir_gerson_access_control');
  for (const name of ['has_permission', 'can_access_org']) await db.exec(extract(access, name));
  await db.exec(fixture.slice(policyStart));
  await db.exec(await sql('20260928000004_revocable_admin_role'));
  await db.exec(await sql('20260928000005_admin_leadership_profile_edits'));
  const personal = await sql('20260711000000_personal_settings');
  await db.exec(extract(personal, 'guard_self_profile_update'));
  await db.exec('create trigger guard_self_profile_update before update on public.profiles for each row execute function public.guard_self_profile_update()');
  await db.exec(await sql('20260819000006_super_admin_project_read_only'));
  await db.exec(await sql('20260819000007_super_admin_task_read_only'));
  const migration = await sql('20261003000000_unify_admin_identity');
  await db.exec(migration);
  // Re-run before any mutation: archive snapshots and audit events stay unique.
  await db.exec(migration);
  await check("(select count(*) from profiles where role = 'super_admin') = 0");
  await check("(select count(*) from admin_unification_profile_backup) = 3");
  await check("(select count(*) from audit_events where action = 'admin.identity_unified') = 3");
  await check("(select previous_role = 'super_admin' and profile_snapshot->>'employee_id' = 'ROOT' and jsonb_array_length(permission_overrides) = 1 from admin_unification_profile_backup where profile_id = '00000000-0000-0000-0000-000000000001')");
  await check("(select count(*) from user_permission_overrides) = 1");
  await check("(select count(*) from admin_unification_definition_backup where kind = 'policy') >= 4");
  for (const number of [1, 2]) {
    const uid = `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
    await identity(number);
    await check(`is_admin('${uid}') and is_super_admin('${uid}') and has_permission('${uid}', 'future.permission')`);
    await check(`can_access_org('${uid}', '10000000-0000-0000-0000-000000000001', 'manage')`);
    await denied("insert into projects values (gen_random_uuid(), 'Forbidden')", /Admin project access is read-only/);
    await denied("insert into tasks values (gen_random_uuid(), 'Forbidden')", /Admin task access is read-only/);
    await denied("update profiles set role = 'employee' where id = auth.uid()", /personal profile settings/);
  }
  await denied("update role_permissions set allowed = false where role = 'admin'", /core access cannot be revoked/);
  await denied("delete from role_permissions where role = 'admin'", /core access cannot be revoked/);
  await denied("insert into role_permissions values ('super_admin', 'tasks.assign', true, now())", /legacy administrative role is retired/);
  for (const number of [1, 5]) {
    await denied(`insert into user_permission_overrides values ('00000000-0000-0000-0000-${String(number).padStart(12, '0')}', 'users.manage', false, null)`, /core access cannot be overridden/);
  }
  await denied("insert into profiles(id, role) values (gen_random_uuid(), 'super_admin')", /profiles_role_check/);
  await denied("update organizations set head_user_id = '00000000-0000-0000-0000-000000000002'", /cannot be assigned/);
  await db.exec('set role authenticated');
  await check('(select count(*) from admin_unification_profile_backup) = 3');
  await db.exec("update profiles set full_name = 'Head updated by Admin' where id = '00000000-0000-0000-0000-000000000004'");
  await check("(select full_name = 'Head updated by Admin' from profiles where id = '00000000-0000-0000-0000-000000000004')");
  await db.exec("insert into storage.objects values (gen_random_uuid(), 'Admin upload')");
  await identity(3);
  await check('(select count(*) from admin_unification_profile_backup) = 0');
  await denied("insert into admin_unification_profile_backup values (gen_random_uuid(), 'admin', '{}', '[]', now())", /permission denied/);
  await denied("update profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001'", /Only the Admin can manage administrative/);
  await denied("update profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000004'", /Only the Admin can manage administrative/);
  await denied("insert into role_permissions values ('employee', 'new.permission', true, now())", /Only Admin can manage role permissions/);
  await denied("insert into user_permission_overrides values ('00000000-0000-0000-0000-000000000004', 'users.manage', true, null)", /Only Admin can manage individual/);
  await db.exec('reset role');
  await identity(null);
  await db.exec("update profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001'");
  await check("not is_admin('00000000-0000-0000-0000-000000000001') and auth_role('00000000-0000-0000-0000-000000000001') is null");
  for (const statement of [
    "delete from profiles where id = '00000000-0000-0000-0000-000000000002'",
    "update profiles set is_active = false where id = '00000000-0000-0000-0000-000000000002'",
    "update profiles set role = 'employee' where id = '00000000-0000-0000-0000-000000000002'",
  ]) await denied(statement, /last active Admin/);
  await check("(select count(*) from profiles where role = 'admin' and is_active) = 1");
  console.log(`Admin unification SQL rehearsal passed (${assertions} assertions, migration applied twice).`);
} catch (error) {
  console.error(error.message);
  if (error.detail) console.error(error.detail);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await db.close();
}
