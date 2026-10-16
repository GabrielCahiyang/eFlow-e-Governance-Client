# User-directed manual main-database handoff — 16 October 2026


**Latest installed checkpoint:** user-run R3 is now applied and independently verified on main: 30 migrations, new20261015230935 once, all150 checks and view, old29 unchanged. Do not rerun apply. [Installation receipt](nw11-database-installation-receipt-2026-10-16.md) and [current readiness](nw11-1-readiness-checklist-2026-10-16.md) supersede all earlier pending SQL directions below. Frontend/gateway runtime and genuine acceptance remain pending; no full NW11 completion claim.


**Latest — revision 3, 16 October 2026:** both prior user applies rolled back; main remains at 29 migrations. The second error was a PostgreSQL-18-versus-17 NOT NULL catalog assumption. Use only the [PG17-verified R3 files](sql-editor/2026-10-16-r3/README.md), retaining every nullability/authority rule. [Full repair receipt](nw11-constraint-repair-receipt-2026-10-16.md). Earlier R1/R2 file pointers below are historical and superseded. No integration is installed yet; user-run manual main remains selected and release/recovery gaps remain unverified.


**Current incident update — 16 October 2026:** the user's original manual apply failed the function-source postcondition and rolled back; actual catalog/history/recovery fingerprints match the 29-version baseline exactly. Use only the [corrected revision-2 package](sql-editor/2026-10-16-r2/README.md) and its revised checker. CRLF paste reproduction and all retained authority/financial checks pass; [repair receipt](nw11-postcondition-repair-receipt-2026-10-16.md). The integration is not yet installed. User-directed manual application remains selected; backup/restore/runtime/security gaps are not counted passed.

The user explicitly chose manual application directly to **ixnfphgjyelhckjwjkdv**, without the isolated restore rehearsal. This later direction supersedes the earlier stop instruction for that manual database step. It does not count missing backup/restore/runtime/security verification as passed or authorize agent-hosted application, publishing, private export, grants outside the reviewed SQL, history repair or destructive recovery. Overall NW11 release readiness remains unverified.

The unchanged [apply SQL](sql-editor/2026-10-16/02-apply-20261015230935.sql) has SHA-256 **bb6610a074aac0c2af9aa9f478792495257c87e4596fa2870f8326738ccb406a**. Its comments and original package README describe the original recovery prerequisite; the user's later operational decision is documented here without altering the verified SQL or its target/baseline/authority/atomicity guards. Frozen source/archive identity remains **591302e923d9e1286f7379979406d254391dc814a9063c5fb6ff22f341b11976**.

Fresh authorized read-only inspection at 10:39 Singapore time on 16 October verifies the exact baseline, **29** installed versions and no installed **20261015230935** integration. [Receipt](../../.refinement/nw11-current-20261016/manual-main-baseline-20261016-attempt2.json). The first wrapper check erroneously expected transaction_read_only to remain on after the preflight's explicit ROLLBACK; its source/log/false receipt are retained. The corrected check verifies the intended idle transaction boundary; the production SQL/preflight checks were unchanged.

1. In the intended project's Supabase SQL Editor, run the **entire unchanged apply file once**, as postgres. Do not select only part, rerun either financial migration or execute the nine original NW source files separately.
2. Run the entire [read-only installation check](sql-editor/2026-10-16/03-read-only-installation-check.sql). Expected new ledger version **20261015230935**, name **nested_work_verified_corrections**, statement SHA **f81d71f9326d4c5b3a7db9feeb48d0ec7cefe1c6d129957b20af27bf5c6852c7**, total history **30** if no other migration has intervened, and no postcondition error.
3. Return the result or exact error for read-only verification. If execution fails or the response is ambiguous, stop and inspect actual state before retrying. Do not remove guards or edit history to force a pass.

The agent has not applied anything. A successful database step alone does not establish deployed frontend/gateway identity, genuine session/RLS/Storage acceptance, completed NW11 or recoverability. Existing security/runtime/data-recovery limitations remain recorded separately.
