/** Phase 2 isolated PostgreSQL rehearsal; no .env/live connections. Uses the
 * same disposable PGlite runtime as verify-admin-unification-sql.mjs. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '../tmp/phase1-sql-runtime/node_modules/@electric-sql/pglite/dist/index.js';
const db = await PGlite.create();
const read = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const sql = (name) => read(`supabase/migrations/${name}.sql`);
const extract = (source, name) => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, name); return source.slice(start, source.indexOf('$$;', start) + 3);
};
let assertions = 0;
const check = async (expression) => { assert.equal((await db.query(`select (${expression}) ok`)).rows[0].ok, true, expression); assertions++; };
const denied = async (statement, pattern) => { await assert.rejects(db.exec(statement), pattern); assertions++; };
const uid = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const identity = (n) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [n ? uid(n) : '']);
const org = '10000000-0000-0000-0000-000000000002';
try {
  const fixture = await read('tests/sql/admin-unification-fixture.sql');
  const split = fixture.indexOf('alter table public.profiles enable');
  await db.exec(fixture.slice(0, split));
  await db.exec(await read('tests/sql/access-items-fixture.sql'));
  const core = await sql('20260712000000_core_workflow');
  for (const name of ['auth_role', 'auth_org_path', 'org_in_my_subtree', 'is_super_admin', 'is_project_member']) await db.exec(extract(core, name));
  const access = await sql('20260819000000_sir_gerson_access_control');
  for (const name of ['has_permission', 'can_access_org']) await db.exec(extract(access, name));
  await db.exec(fixture.slice(split));
  await db.exec(await sql('20260928000004_revocable_admin_role'));
  await db.exec(await sql('20260928000005_admin_leadership_profile_edits'));
  const leadership = await sql('20260814000000_assistant_head_review_routing');
  await db.exec(extract(leadership, 'set_organization_leadership'));
  const portfolios = await sql('20260819000005_proposal_portfolios_and_unique_leadership');
  for (const name of ['guard_profile_leadership_integrity', 'can_create_scoped_work']) await db.exec(extract(portfolios, name));
  const runtime = await sql('20260821000003_collaboration_runtime');
  for (const name of ['can_see_project', 'can_manage_project', 'can_see_task', 'can_manage_task']) await db.exec(extract(runtime, name));
  await db.exec(extract(await sql('20260822000008_department_budget_and_petty_cash'), 'is_department_budget_approver'));
  const accounting = await sql('20260919000000_phase04_phase05_accounting');
  for (const name of ['is_department_accounting_staff', 'can_manage_department_accounting']) await db.exec(extract(accounting, name));
  // A representative SECURITY DEFINER operation exercises the inserted gate;
  // existing financial amounts/reviewer rules retain their separate coverage.
  await db.exec(`create function public.record_accounting_petty_cash_release(p_org_id uuid) returns void language plpgsql security definer as $$ begin
    if not public.can_manage_department_accounting(p_org_id, auth.uid()) then raise exception 'Accounting scope denied'; end if;
    insert into audit_events(actor_id,action) values(auth.uid(),'fixture.accounting.release'); end $$;`);
  await db.exec(await sql('20261003000000_unify_admin_identity'));
  await db.exec('create trigger guard_profile_leadership_integrity before insert or update of role, org_id, is_active on public.profiles for each row execute function guard_profile_leadership_integrity()');
  const definitions = await db.query("select p.oid::regprocedure::text identity,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('has_permission','auth_role','can_see_project','can_manage_project','can_see_task','can_manage_task','can_create_scoped_work','can_manage_department_accounting','record_accounting_petty_cash_release')");
  await db.exec(await sql('20261003000001_access_items_and_employee_status'));
  await db.exec(await sql('20261003000002_dynamic_item_capabilities'));
  const rollback = await sql('20261003000003_revert_phase_2');
  await identity(1);
  const {rows:[item]}=await db.query("insert into access_items(title,role,employee_status_id) select 'Rollback test','Custom',id from employee_statuses where name='Casual' returning permission_key");
  await db.query("insert into role_permissions(role,permission,allowed) values($1,'navigation.tasks',true)",[item.permission_key]);
  await db.query("insert into profiles(id,full_name,email,employee_id,role,is_active) values($1,'Retained user','retained@example.test','ROLLBACK-RETAINED',$2,false)",[uid(9),item.permission_key]);
  await assert.rejects(db.exec(rollback), /users still have unsupported.*Items/); assertions++;
  await db.exec('rollback;');
  await check("to_regclass('public.access_items') is not null");
  await check("(select role like 'item_%' from profiles where employee_id='ROLLBACK-RETAINED')");
  await db.exec("update profiles set role='employee' where employee_id='ROLLBACK-RETAINED'");
  await db.exec(rollback);
  for (const original of definitions.rows) {
    const {rows:[current]}=await db.query('select pg_get_functiondef(to_regprocedure($1)) definition',[original.identity]);
    assert.equal(current.definition,original.definition,original.identity); assertions++;
  }
  await check("to_regclass('public.access_items') is null and to_regclass('public.employee_statuses') is null");
  await check("(select count(*) from phase2_rollback_archive where source_table='employee_statuses')=3 and (select count(*) from phase2_rollback_archive where source_table='access_items')=12");
  await check("exists(select 1 from phase2_rollback_archive where source_table='role_permissions' and snapshot->>'role' like 'item_%') and not exists(select 1 from role_permissions where role like 'item_%')");
  await check("(select role='employee' and not is_active from profiles where employee_id='ROLLBACK-RETAINED')");
  await check("not exists(select 1 from pg_policies where policyname='custom_item_read_capability')");
  await check("not exists(select 1 from pg_trigger where tgname in ('guard_profile_item_assignment','guard_custom_item_operation'))");
  await check("exists(select 1 from pg_trigger where tgname='guard_profile_leadership_integrity' and not tgdeferrable and (tgtype & 2)=2)");
  await check("to_regprocedure('public.finalize_managed_user(uuid,uuid,jsonb)') is null and to_regprocedure('public._item_legacy_department_accounting(uuid,uuid)') is null");
  await check("is_admin('00000000-0000-0000-0000-000000000001') and has_permission('00000000-0000-0000-0000-000000000001','arbitrary.future.permission')");
  await denied("insert into profiles(id,role) values('00000000-0000-0000-0000-000000000020','item_unknown')",/profiles_role_check/);
  await denied("update role_permissions set allowed=false where role='admin'",/Admin core access/);
  await db.exec('set role authenticated');
  await check('(select count(*) from phase2_rollback_archive)>0');
  await identity(3);
  await check('(select count(*) from phase2_rollback_archive)=0');
  await denied('delete from phase2_rollback_archive',/permission denied/);
  await db.exec('reset role');
  await identity(null);
  await db.exec("update profiles set is_active=false where role='admin' and id <> '00000000-0000-0000-0000-000000000001'");
  await denied("delete from profiles where id='00000000-0000-0000-0000-000000000001'",/last active Admin/);
  await db.exec(rollback);
  await check("(select count(*) from audit_events where action='migration.phase2_reverted')=1");
  console.log('Phase 2 rollback rehearsal passed ('+assertions+' assertions, including rollback twice and retained Phase 1 definitions).');
} catch (error) {
  console.error(error.message); if(error.where) console.error(error.where); process.exitCode=1;
} finally { await db.close(); }
