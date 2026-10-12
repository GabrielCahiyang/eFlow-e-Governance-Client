# R0–R13 database rollout — 9 October 2026

Target: **`ixnfphgjyelhckjwjkdv` only**. Status: **installed by the user through Dashboard SQL Editor; all 17 hosted installation checks passed**. The assistant performed read-only hosted confirmation. The native backup restoration gate remains unresolved; full R13 release acceptance is open.

The live server has 18 installed migration entries. None of the seven refinement migrations is installed, including `public.r11_project_activity(uuid,uuid,integer,integer,text,text,timestamptz,timestamptz)`. This explains the application's “Complete Activity history is not installed on this server” message. The missing private R3/R7/R8/R9/R11 namespaces were also checked; no partial installation was found.

## Reviewed migration order

R0, R1, R2, R4, R5, R10 and R13 have no separate database migration. Their application changes are in the merged source. Install the seven database phases and both merge compatibility fixes in this order:

1. `20261007120000_r3_personal_workspaces.sql`
2. `20261008030659_r6_project_file_library.sql`
3. `20261008035748_r7_project_members_and_nested_work.sql`
4. `20261008060756_r8_approved_project_invitations.sql`
5. `20261008081855_r9_project_access_lifecycle.sql`
6. `20261008123723_r11_project_activity_snapshots.sql`
7. `20261008134347_r12_presentation_settings.sql`
8. `20261009120000_refinement_project_creation_compatibility.sql`
9. `20261009120100_refinement_office_removal_guest_termination.sql`

The compatibility fixes preserve immediate Planning project creation without a draft-publication gate, and terminate removed-Office access without deleting history. Other teammate migrations already installed on the server remain intact. This rollout does not install unrelated pending finance migrations.

## Preparation and recovery gate

A fresh isolated CLI workspace was populated from the actual live ledger, preserving all installed versions and names, then populated with byte-identical copies of these nine files. The dry run selected exactly these files, with no roles, seeds or history repairs. R3 predates newer installed entries, so `--include-all` is required **only in that isolated workspace**. Running a push against the repository's historical migration directory would select a different migration set.

A fresh protected, consistent custom-format archive, password-free role export and private canonical snapshots of 92 public/Auth tables were produced. The archive is 2,108,474 bytes; listing and full decompression passed. Checksums and the reviewed SQL inventory are in the [preparation receipt](r0-r13-database-rollout-evidence-2026-10-09.json). No credentials, account contents or canonical row snapshots are included in this receipt.

The restore rehearsal stopped before cluster creation because Windows Application Control rejected `initdb.exe` with WinError 4551. No system security policy was changed. There is no installed WSL distribution or available Docker CLI in this environment. The [R13 rollout contract](r13-release-contract.md) requires resolving “incomplete historical replay/backup recovery with the operator before claiming a recoverable migration baseline.” The [Phase 6.5 live addendum](../phase65-live-deployment-2026-10-07.md) describes recovery exclusions and the requirement to inspect schema and ledger after a failed application. Its historical restore receipt does not establish restoration of this fresh archive.

## Dashboard SQL Editor continuation requested by the user

The user subsequently selected Dashboard SQL Editor. The [prepared three-query package](sql-editor/2026-10-09/README.md) contains a read-only preflight, one atomic nine-migration installation with exact new source-history recording and original-row preservation checks, and a read-only verification query. All five preflight checks passed on the live server. The exact package passed 33 disposable PostgreSQL/PGlite assertions including rollback, source history, Activity authorization and all 17 installation checks. Existing migration history is neither repaired nor overwritten. The package has not been applied by the assistant.

The user reported successful application and passing verification. Independent hosted read-only confirmation then passed all 17 checks: the expected 27 version/name entries, exact reviewed SQL in all nine new history records, R11/R12 function installation and execution boundaries, RLS on all 17 new public tables, the private library bucket, immediate publication, restored readiness and removed-Office helper authority. See the [hosted installation receipt](sql-editor/2026-10-09/hosted-installation-verification.json). This establishes readiness for application testing, not a genuine-session/provider acceptance chain or recovery of the actual archive. Security advisor results are retained in the receipt; neither existing advisory warnings nor hosted anonymous EXECUTE grants on the actor-guarded R3 APIs were changed by this confirmation.

## Alternative: continue using the local CLI helper

Use an approved PostgreSQL 17 installation with the required extensions for a disposable restore. The task-local helper is `.refinement/deploy-refinements.py`; its prepared workspace and sanitized command logs are under `.refinement/rollout-2026-10-09/`. These ignored files are local operational material, not committed release tooling.

Set `EFLOW_RESTORE_PG_BIN` to that installation's `bin` directory, then run from the repository root:

```powershell
& server/.venv/Scripts/python.exe .refinement/deploy-refinements.py rehearse
```

This restores the actual archive locally, applies the exact pending selection through the CLI, and verifies the ledger, original rows, Activity execution grants, new RLS tables, private library bucket and publication compatibility. Provider-only extension/Vault implementations are excluded only from the local restore list; the full archive remains unchanged. Storage object payloads and platform configuration are outside this database archive. These migrations do not replace hosted object payloads.

After rehearsal passes, announce a brief application write pause, take a fresh backup if the prior backup is older than one hour or application data has changed, then apply:

```powershell
& server/.venv/Scripts/python.exe .refinement/deploy-refinements.py backup
& server/.venv/Scripts/python.exe .refinement/deploy-refinements.py apply
```

The apply helper refuses to continue without a successful rehearsal, matching source checksums, an unchanged live ledger, a fresh verified archive, unchanged original rows and the exact final dry-run selection. If application fails, inspect the live schema and ledger before choosing any continuation: SQL with an explicit COMMIT can install a schema before the CLI records its version. Do not repair the ledger or rerun blindly.

After successful application, re-read the live ledger (expected 27 entries), verify authenticated Activity reads and anonymous denial, and reload the application. Matching frontend/gateway hosting, genuine provider delivery, concurrency, Storage authority and the remaining R13 performance/accessibility acceptance remain separate release gates. This document records preparation, not their completion.
