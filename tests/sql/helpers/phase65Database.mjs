import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { ltree } from '@electric-sql/pglite/contrib/ltree';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

/** Disposable real PostgreSQL; no environment variables, accounts or network. */
export async function phase65Database({ liveHistoryDirectory, withdrawalSnapshot, repositoryContinuation = false } = {}) {
 if (repositoryContinuation && liveHistoryDirectory) throw new Error('Choose repository continuation or live-history replay, not both.');
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
  // Local integration only: these historical files keep their recorded names.
  // Deployment must still use a separate workspace populated from live history.
  const continuation = [
   '20261007152648_office_budget_dynamic_sections.sql',
   '20261007153615_office_budget_partition_funding.sql',
   '20261007154917_petty_cash_vouchers_items.sql',
   '20261007160031_office_budget_ledgers.sql',
   '20261007175525_project_office_removal_and_history.sql',
   '20261007191654_account_login_lockout.sql',
   '20261007195837_login_gateway_discovery.sql',
   '20261007201249_project_draft_publication.sql',
   '20261007203525_project_publication_history_retention.sql',
   '20261008004900_withdraw_office_invitation.sql',
  ];
  const selected = liveHistoryDirectory ? (await readdir(liveHistoryDirectory)).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort() : [...migrations, ...(repositoryContinuation ? continuation : [])];
  if (liveHistoryDirectory && (selected.length !== 18 || selected.at(-1) !== '20261008004900_withdraw_office_invitation.sql')) throw new Error('Expected the reviewed 18-entry R13 live ledger; inspect changed history before replay.');
  for (const name of selected) {
   try {
    // The latest ledger statement is a placeholder. Keep that receipt intact;
    // use a separately read, explicitly supplied current definition for local
    // compatibility only. This helper never connects to or repairs a ledger.
    if (liveHistoryDirectory && name === '20261008004900_withdraw_office_invitation.sql') {
     if (!withdrawalSnapshot) throw new Error('Incomplete withdrawal ledger SQL requires a reviewed current-definition snapshot.');
     await db.exec(await readFile(withdrawalSnapshot, 'utf8'));
     await db.exec('revoke all on function public.phase6_withdraw_office_invitation(uuid) from public, anon; grant execute on function public.phase6_withdraw_office_invitation(uuid) to authenticated, service_role;');
    } else await db.exec(await readFile(liveHistoryDirectory ? resolve(liveHistoryDirectory, name) : new URL('../../../supabase/migrations/' + name, import.meta.url), 'utf8'));
   }
   catch (error) { error.message = name + ': ' + error.message; throw error; }
  }
  return db;
 } catch (error) { await db.close(); throw error; }
}
