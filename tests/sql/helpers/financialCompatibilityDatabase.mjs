// Reconstruct the installed 27-version public baseline and the private evidence
// contract. No hosted connection, data, credentials or historical helper edits.
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {ltree} from '@electric-sql/pglite/contrib/ltree';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

export const financialMigration='20261015125031_financial_cash_compatibility.sql';
export const financialIntegrityMigration='20261015142837_financial_journal_and_refund_integrity.sql';
export const baselineMigrations=[
  '20261003000004_simplified_roles_and_office_authority.sql',
  '20261004123126_phase2_invitation_onboarding_pds.sql',
  '20261004132527_phase2_invitation_dispatch_limits.sql',
  '20261004133412_phase2_existing_identity_acceptance.sql',
  '20261004140128_phase3_project_table_workspace.sql',
  '20261004164937_phase5_workspace_ai_import.sql',
  // The installed Phase 6 names have later timestamps; these repository bodies
  // are their source equivalents, not proposed migration-history repairs.
  '20261004174950_phase6_project_office_collaboration.sql',
  '20261004182453_phase6_shared_structure_guards.sql',
  '20261004194130_phase7_readiness_governance.sql',
  '20261005170822_phase65_project_local_office_identity.sql',
  '20261007120000_r3_personal_workspaces.sql',
  '20261007152648_office_budget_dynamic_sections.sql',
  '20261007153615_office_budget_partition_funding.sql',
  '20261007175525_project_office_removal_and_history.sql',
  '20261007191654_account_login_lockout.sql',
  '20261007195837_login_gateway_discovery.sql',
  '20261007201249_project_draft_publication.sql',
  '20261007203525_project_publication_history_retention.sql',
  '20261008004900_withdraw_office_invitation.sql',
  '20261008030659_r6_project_file_library.sql',
  '20261008035748_r7_project_members_and_nested_work.sql',
  '20261008060756_r8_approved_project_invitations.sql',
  '20261008081855_r9_project_access_lifecycle.sql',
  '20261008123723_r11_project_activity_snapshots.sql',
  '20261008134347_r12_presentation_settings.sql',
  '20261009120000_refinement_project_creation_compatibility.sql',
  '20261009120100_refinement_office_removal_guest_termination.sql',
];
export const nwCorrections=[
  '20261010103936_nested_work_capabilities_and_execution.sql',
  '20261010105440_nested_work_own_lead_execution.sql',
  '20261010144145_nested_work_office_review_routing.sql',
  '20261010161650_nested_work_approval_consistency.sql',
  '20261010164510_nested_work_operation_safety.sql',
  '20261010172348_nested_work_r9_staffing_removal.sql',
  '20261010175812_nested_work_checked_confirmation.sql',
  '20261011071015_nested_work_material_date_preview.sql',
  '20261012231500_nested_work_activity_projection.sql',
];
export const migrationSource=name=>readFile(new URL('../../../supabase/migrations/'+name,import.meta.url),'utf8');

export async function financialBaselineSql(){
  const f=JSON.parse(await readFile(new URL('../phase1-deployed-schema.json',import.meta.url),'utf8'));
  let sql=`create extension ltree;create schema extensions;create extension pgcrypto with schema extensions;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
    create role authenticated;create role anon;create role service_role bypassrls;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb,created_at timestamptz default now(),unique(bucket_id,name));
    alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;
    insert into storage.buckets(id,name,public) values ('task-attachments','task-attachments',false),('budget-receipts','budget-receipts',false);
    create publication supabase_realtime;set check_function_bodies=false;`;
  for(const table of new Set(f.columns.map(c=>c.table))){
    const columns=f.columns.filter(c=>c.table===table);
    for(const c of columns)if(c.default?.includes('nextval'))sql+=`create sequence if not exists ${c.default.match(/'([^']+)'/)[1]};`;
    sql+=`create table public."${table}"(${columns.map(c=>`"${c.column}" ${c.type}${c.default?' default '+c.default:''}${c.nullable===false?' not null':''}`).join(',')});`;
  }
  for(const c of f.constraints)sql+=`alter table public."${c.table}" add constraint "${c.name}" ${c.definition};`;
  for(const fn of f.functions)sql+=fn.definition+';';
  for(const p of f.policies.filter(p=>p.schemaname==='public'))sql+=`alter table public."${p.tablename}" enable row level security;create policy "${p.policyname}" on public."${p.tablename}" as ${p.permissive} for ${p.cmd} to ${p.roles.join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`;
  sql+='grant usage on schema public,auth to authenticated,service_role;grant select,insert,update,delete on all tables in schema public to authenticated,service_role;';
  for(const t of f.triggers.filter(t=>!t.includes('eflow_evidence.')))sql+=t+';';
  // Restore generated-number metadata and unique indexes omitted by the old
  // public catalog fixture, matching the installed accounting/cash migrations.
  sql+=`alter table public.petty_cash_requests alter column request_number add generated always as identity;
    alter table public.general_journal_entries alter column entry_number add generated always as identity;
    create unique index petty_cash_request_idempotency_uni on public.petty_cash_requests(requester_id,idempotency_key) where idempotency_key is not null;
    create unique index petty_cash_liquidation_idempotency_uni on public.petty_cash_liquidations(request_id,idempotency_key) where idempotency_key is not null;
    create unique index budget_ledger_command_idempotency_uni on public.budget_ledger_entries(actor_id,correlation_key,entry_type) where actor_id is not null and correlation_key is not null;
    create unique index general_journal_source_idx on public.general_journal_entries(source_type,source_id) where source_id is not null;
    create unique index petty_cash_releases_voucher_number_idx on public.petty_cash_releases(voucher_number) where voucher_number is not null;
    create unique index petty_cash_liquidations_number_idx on public.petty_cash_liquidations(liquidation_number) where liquidation_number is not null;`;
  for(const name of baselineMigrations){
    if(name==='20261007120000_r3_personal_workspaces.sql')sql+=await migrationSource('20260831000001_task_evidence_security.sql');
    sql+=await migrationSource(name);
  }
  return sql;
}
export async function financialCompatibilityDatabase({install=false}={}){
  const db=await PGlite.create({extensions:{ltree,pgcrypto}});
  try{
    await db.exec(await financialBaselineSql());
    if(install)await db.exec(await migrationSource(financialMigration));
    return db;
  }catch(error){await db.close();throw error;}
}
