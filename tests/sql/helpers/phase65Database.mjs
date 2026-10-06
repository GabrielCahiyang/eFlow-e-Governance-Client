import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/** Disposable real PostgreSQL; no environment variables, accounts or network. */
export async function phase65Database() {
 const db = await PGlite.create({ extensions: { ltree, pgcrypto } });
 try {
  const fixture = JSON.parse(await readFile(new URL('../phase1-deployed-schema.json', import.meta.url), 'utf8'));
  await db.exec(`create extension ltree; create schema extensions; create extension pgcrypto with schema extensions;
   create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
   create role authenticated; create role anon; create role service_role bypassrls;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create publication supabase_realtime;
   set check_function_bodies=false;`);
  for (const table of new Set(fixture.columns.map(c => c.table))) {
   const cols = fixture.columns.filter(c => c.table === table);
   for (const c of cols) if (c.default?.includes('nextval')) await db.exec(`create sequence if not exists ${c.default.match(/'([^']+)'/)[1]}`);
   await db.exec(`create table public."${table}" (${cols.map(c => `"${c.column}" ${c.type}${c.default ? ' default ' + c.default : ''}${c.nullable === false ? ' not null' : ''}`).join(',')})`);
  }
  for (const c of fixture.constraints) await db.exec(`alter table public."${c.table}" add constraint "${c.name}" ${c.definition}`);
  for (const f of fixture.functions) await db.exec(f.definition + ';');
  for (const p of fixture.policies.filter(p => p.schemaname === 'public')) {
   await db.exec(`alter table public."${p.tablename}" enable row level security; create policy "${p.policyname}" on public."${p.tablename}" as ${p.permissive} for ${p.cmd} to ${p.roles.join(',')}${p.qual ? ' using (' + p.qual + ')' : ''}${p.with_check ? ' with check (' + p.with_check + ')' : ''};`);
  }
  await db.exec('grant usage on schema public,auth to authenticated,service_role; grant select,insert,update,delete on all tables in schema public to authenticated,service_role');
  // The archived fixture contains public definitions only. Evidence seal
  // triggers reference a separate private schema and have their own runner.
  for (const t of fixture.triggers.filter(t => !t.includes('eflow_evidence.'))) await db.exec(t + ';');
  const migrations = [
   '20261003000004_simplified_roles_and_office_authority.sql',
   '20261004123126_phase2_invitation_onboarding_pds.sql',
   '20261004132527_phase2_invitation_dispatch_limits.sql',
   '20261004133412_phase2_existing_identity_acceptance.sql',
   '20261004140128_phase3_project_table_workspace.sql',
   '20261004164937_phase5_workspace_ai_import.sql',
   '20261004174950_phase6_project_office_collaboration.sql',
   '20261004182453_phase6_shared_structure_guards.sql',
   '20261004194130_phase7_readiness_governance.sql',
   '20261005170822_phase65_project_local_office_identity.sql',
  ];
  for (const name of migrations) {
   try { await db.exec(await readFile(new URL('../../../supabase/migrations/' + name, import.meta.url), 'utf8')); }
   catch (error) { error.message = name + ': ' + error.message; throw error; }
  }
  return db;
 } catch (error) { await db.close(); throw error; }
}
