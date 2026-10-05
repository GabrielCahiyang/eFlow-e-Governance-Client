# Phase 1 delivery

**Current database status � 2026-10-04:** Phase 1, the three Phase 2 migrations, and the Phase 3 workspace migration are now applied to the main Eflow project (`ixnfphgjyelhckjwjkdv`) following the user's explicit instruction. A fresh full custom database archive, role definitions and all 67 actual storage files were verified outside the repository before rollout; the authority preflight passed. Main now has Admin 1, Head 7, Member 9, Accounting Staff 1, with unchanged baseline counts: profiles 18, Offices 10, projects 1, tasks 1, subitems 1. Thirty Phase 3 authority/workflow checks passed with every test record rolled back. Hosted frontend/gateway release identification, production email/SMTP and deployed acceptance remain outstanding. The dated readiness and rehearsal details below are historical; statements that live SQL was not applied are superseded by this update.


Phase 1 is implemented in the application and gateway. The coordinated database migration is prepared and has **not** been applied to the deployed project. Deploy the migration, gateway, and frontend together after backup and deployment approval.

## Result

- Account roles: Admin, Head, Accounting Staff, Member. Task Lead remains contextual. Future workspace access values are types only.
- Legacy identities normalize at the authentication boundary. Assistant Head becomes Member without receiving Head authority. Unsupported prototype roles fail closed.
- Admin's global sidebar contains User Management. Administration contains account management, role defaults, individual access, office structure, account audit, system settings, and backup/export. Admin receives no automatic project/task/financial authority.
- Head finalizes normal office output, including their own work, with separate performer/finalizer audit fields. Explicit and governance review routes retain independence.
- Head retains financial approvals and independent late-liquidation authorization. Accounting Staff executes cash/cheque releases, settlement, and journal posting. Own-funds and independent-settlement safeguards remain enforced.
- Active copy uses Office and Member; physical database fields and official employment identifiers retain compatibility.
- Head components and feature entry points use Head names. Member code is grouped under the members feature.
- Eleven reusable workspace controls provide white surfaces, Figtree, teal accents, underline tabs, menus/popovers, split actions, inline editing, avatars, statuses, empty states, and skeletons. Existing project views remain in place.
- Guided tours use the canonical roles and destinations. Invitations, onboarding, new project tables/views, and new AI workflows remain later phases.

## Verification completed

Fresh closure checks on **2026-10-03** passed after the final header/cleanup edits:

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 155 files, **555 tests passed**, no failures |
| `npm run build` | Passed; 5,858 modules transformed |
| `npm run verify:phase1-authority` | **37 assertions passed** |
| `server/.venv/Scripts/python.exe -m unittest discover -s server/tests -v` | **19 tests passed** |
| `EFLOW_E2E=1`, `EFLOW_E2E_BASE_URL=http://127.0.0.1:5174`, `npx playwright test tests/e2e/phase1-authority.spec.ts --workers=1 --reporter=line` | **All four roles passed**, including the corrected Admin headers |
| `npm run verify:client-secrets` | Passed against the fresh production output |

The SQL checks cover transactional blocking, role translation, preserved operational rows, scoped visibility, review routes, audited Head self-finalization, financial completion blockers, Head/accounting separation, late authorization, settlement, and own-funds rejection. The Phase 1 E2E suite uses synthetic accounts and intercepted requests. Existing circular-chunk, mixed static/dynamic import, and bundle-size warnings remain; the production build exits successfully.

Read-only browser acceptance also used real development accounts with the current hosted database, without request interception:

| Canonical role | Observed |
| --- | --- |
| Admin | Administration-only navigation; canonical role headers; nine administrative allows disabled; operational permissions denied in the displayed defaults |
| Head | Office/People/Insights navigation; normal review workspace opens; no accounting release/journal destinations |
| Member | Assigned-task board opens; no administration/accounting destinations; contextual leadership appears for the account's existing leading work |
| Accounting Staff | Role resolves from the real profile; accounting navigation, office-scoped General Journal, and voucher/release workspace with settlement queue open |

Local browser evidence is in ignored `test-results/phase1-manual/`; synthetic evidence is in the Phase 1 Playwright output directories. Logs are `test-results/phase1-unit-closure.log`, `test-results/phase1-gateway-closure.log`, `test-results/phase1-sql-closure.log`, `test-results/phase1-e2e-closure.log`, `phase1-build-closure.log`, and `phase1-client-secrets-closure.log`. These artifacts remain local.

These manual checks establish pre-deployment UI behavior. They do **not** establish migrated database enforcement or acceptance of submission, self-finalization, release, settlement, or journal posting against migrated data. The isolated restored database now passes 26 checks using disposable records for submission, self-finalization, cash release, late authorization, settlement, balanced journal posting, and authorization denials. All-role browser acceptance against the migrated environment and after coordinated deployment remains pending. No operational records, permissions, or financial decisions were changed during the browser checks.

The SQL rehearsal builds synthetic tables from a schema-only fixture. It reproduces relevant policies, functions, constraints, and authority triggers; it is not a full hosted Supabase restore and does not reproduce foreign keys, storage, external services, or every unrelated accounting automation trigger. No production user records are in the fixture.

## Historical readiness and rehearsal status (before 2026-10-04 main rollout)

**Implementation verification is clean. Production closure remains incomplete.** No Phase 2 work or production migration was started.

Read-only readiness diagnostics on project `ixnfphgjyelhckjwjkdv` (Eflow) found:

- Roles: Admin 1, legacy Head 7, legacy Assistant Head 3, legacy Member 6, Accounting Staff 1. There are **16 legacy profiles** and **3 assistant appointments**. Expected translated counts, if these records remain unchanged, are Admin 1, Head 7, Member 9, Accounting Staff 1.
- Unsupported profiles, invalid Head appointments, active Heads without an appointment, normal pending reviews without an active Head, assistant task reviewers, and open normal cross-routing mismatches: **0** each. One profile has no office; the UI identifies the administrative account as unassigned.
- Baseline rows: profiles 18, organizations 10, projects 1, tasks 1, subtasks 1; petty-cash requests/releases/liquidations and budget ledger entries 0 each. Auth users: 21; storage objects: 67. Counts must be recaptured with the verified backup and maintenance window; this diagnostic is not a backup or the formal deployment preflight.
- Neither the Phase 1 archive table nor `supabase_migrations.schema_migrations` exists. Validate and establish the intended migration-tracking path in rehearsal before applying this migration once. Do not run an indiscriminate push of the repository's older migration files.

PostgreSQL 17 tools are installed under `C:/Program Files/PostgreSQL/17/bin`. The initially configured direct hostname did not resolve; the supplied **Session pooler** connection is now saved in ignored local `EFLOW_DATABASE_URL` and connects successfully. Keep credentials out of committed files. The user selected the existing isolated project `eflow-phase1-rehearsal` (`epmwzfjlghtpeygbhrdv`). Read-only checks confirmed PostgreSQL 17.11, no public application tables, zero Auth users, and zero storage objects, separate from live Eflow. Its local `EFLOW_REHEARSAL_DATABASE_URL` is still missing, so the restore has not started. Configure that projectâ€™s Session pooler connection under the rehearsal variable and revalidate the target before restoring. The source includes Supabase-managed extensions such as `supabase_vault`, so the plain local PostgreSQL installation cannot be assumed to reproduce the hosted environment.

The complete logical database archive and storage copies have now been collected outside the repository:

- `pg_dumpall --roles-only --no-role-passwords` exported database role definitions. Role passwords are deliberately excluded and need separate secure recovery/rotation where applicable.
- Native `pg_dump --format=custom --serializable-deferrable` exported all database schemas/data, including Auth and storage metadata. The archive is **1,670,531 bytes**. Its directory includes Auth user data, storage object metadata, and application tables; an offline `pg_restore --file=NUL` successfully read/decompressed every entry. This is archive verification, **not a database restore**.
- All **67 storage objects** were copied, totaling **55,516,499 bytes**. Five transient connection failures were retried successfully; object sizes and SHA-256 values were checked.
- The database archive, roles, storage payloads, storage inventory, source count diagnostic, and checksum manifest are packaged in an **AES-256 encrypted ZIP**, **49,625,329 bytes**. Reading every packaged file with the recovery key reproduced its recorded checksum. ZIP SHA-256: `42f93ffed1eb30080519646197a706b6db88ba9a804b3fbf3fc8c16387678c86`.
- The ignored local receipt `test-results/phase1-backup-receipt.json` records the archive's resolved location and the separate recovery-key file location. The recovery key and database credentials are not included in the receipt, documentation, or ZIP. Preserve both the archive and separately stored recovery key for disaster recovery.
- Source Vault secret count is **0**. Supabase Auth/service configuration is external to the database; review encryption/configuration requirements before restoring and whenever source Vault contents change. The source had no migration-history table to export.
- Source writes were **not paused** for this rehearsal backup. The database archive uses a consistent snapshot, while stored files were copied separately. Refresh the coordinated backup and formal counts during the deployment maintenance window.

**The full logical restore and isolated migration rehearsal passed on 2026-10-03.**

- Restored 111 selected data tables and compared all **1,490 records** using sorted native COPY checksums before storage uploads or migration; every comparison matched, including 21 Auth users and 67 storage object records.
- Confirmed **80 application/evidence tables, 223 functions, 131 policies, 93 triggers (including the deferred evidence constraint trigger), and 231 foreign keys** against the archive's selected definitions.
- Uploaded and downloaded all **67 actual storage files**, checking all **55,516,499 bytes** against the original SHA-256 values. Uploading updates storage metadata timestamps, so the exact metadata comparison was completed first.
- Retained the isolated project's Supabase-managed infrastructure, roles, and Auth/storage migration tracking; restored application/evidence definitions, supported extensions, Auth data, storage data, and custom storage policies. The expired source CLI login was not recreated. Protected `storage.buckets_vectors` and `storage.vector_indexes` data were excluded as directed by Supabase's restore guide; both source tables were empty. The first restore attempt rolled back completely before this correction; the corrected restore committed.
- Applied only the exact prepared Phase 1 file through Supabase CLI from a separate staging folder. The dry run selected one migration, and normal migration history now contains version **20261003000004** once. No older repository migrations, seeds, or role scripts were pushed.
- Canonical counts are **Admin 1, Head 7, Member 9, Accounting Staff 1**. Assistant appointments are null. All saved operational baseline counts match after migration and the rolled-back workflow checks.
- **26 hosted authority/workflow checks passed**, with actual foreign keys, RLS, immutable evidence guards, and accounting automation enabled. These include Member submission and self-review denial; Head review and audited self-finalization; Admin operational denial and archive access; unsettled-fund completion blocking; Accounting cash release; independent late authorization; Accounting settlement retaining Head authorization; expense/refund ledger entries and a balanced three-line journal; own-funds settlement denial; and last-Admin protection. Disposable workflow records were rolled back. Document/request sequences can advance during this isolated test.
- The local backup receipt now records verified database/storage restoration and migration rehearsal. Detailed reports are outside the repository at the path in ignored `test-results/phase1-rehearsal-location.txt`; `rehearsal-completion.json` records the final counts and evidence locations. The encrypted backup remains unchanged.

This closes the restore/migration rehearsal gate. All-role browser acceptance on the migrated environment, deployment destination/release identification, a fresh backup during the agreed write-pause window, and coordinated live deployment remain outstanding. No live migration was applied.

The existing gateway Backup & Export implementation exports the **public schema/data** and a **storage manifest**; it does not export Auth records, all database roles/schemas, or actual storage object payloads. That app export cannot replace the complete backup collected here. Use the [Supabase backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) to handle managed schemas, roles, encryption, and external configuration in the isolated target.

Before deployment approval, complete migrated all-role browser acceptance, identify the frontend/gateway deployment destinations and previous release artifacts, and agree on the write-pause window. The successful isolated restore, before/after counts, and hosted authority checks are now recorded. A successful local build alone does not close those gates.

Migration prepared: `20261003000004_simplified_roles_and_office_authority.sql`. SHA-256 of the verified file: `4386ebb5789e48f5397ad33f2227cb8aa87ca6d141fc0b29a943bf36742a12e5`.

## Assistant-column cleanup decision

Retain the null `assistant_head_user_id` column and existing leadership RPC signature during the compatibility window. The migration removes assistant appointments and authority; current clients pass a null assistant argument. Schedule physical removal separately after migrated database acceptance and retirement of old clients. At that point, inventory database functions, RPC callers, historical/backup dependencies, and restore procedures before changing the schema/API contract. No column-removal migration is included in this closure work.

## Deployment and rollback

1. Create and verify a full database backup outside the repository. Include schemas, data, roles, Auth records, and storage object backups appropriate to the deployment. A schema snapshot or Phase 1 archive table is not a full backup. Rehearse restoring the backup into an isolated PostgreSQL/Supabase environment.
2. Run `supabase/preflight/phase1_office_authority.sql` and save its count report. Resolve unsupported accounts, invalid Head appointments, and normal pending reviews without an active Head. Compare deployed definitions with the schema fixture before using this migration against a newer database.
3. Pause writes and old clients during the coordinated rollout. Apply only `20261003000004_simplified_roles_and_office_authority.sql` once through normal migration tracking. Do not push unrelated pending migrations.
4. Deploy the gateway and frontend together. The migration archives affected authority rows and deployed definitions, translates legacy identities, resets role defaults, removes Admin permission overrides, preserves non-Admin explicit overrides, nulls assistant appointments, and reroutes only open normal tasks. Completed/historical decisions and evidence remain intact. The physical assistant column remains for old-client compatibility.
5. Rerun the count report. Canonical role counts must contain no legacy roles; assistant assignments must be zero; operational counts must match the saved report. Inspect the protected `phase1_authority_row_backup` and `phase1_authority_definition_backup` archives. Verify all four deployed accounts and migrated workflows. The local regression baseline above is clean; rerun affected checks if the release source changes.
6. If rollout fails, stop writes and restore the verified complete backup plus the previous gateway/frontend release as one coordinated rollback. Archive rows alone cannot restore the entire database. If migration preflight fails, its transaction rolls back without applying the Phase 1 changes.

For future checks, use `npm run check`, `npm test`, `npm run build`, `npm run verify:phase1-authority`, the Python gateway tests, and `tests/e2e/phase1-authority.spec.ts`. All synthetic browser requests are intercepted; that suite does not modify deployed records.
