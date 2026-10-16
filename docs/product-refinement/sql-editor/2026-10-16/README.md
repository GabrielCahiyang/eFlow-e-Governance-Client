# NW11 SQL Editor review package — 16 October 2026

**Prepared and locally verified; DO NOT RUN THE APPLY FILE YET.** Fresh protected backup/Storage copy, successful isolated restore, compatible runtime recovery artifacts and security disposition remain open. Those are requirements in the [NW11 packet](../../nested-work-implementation-packets-2026-10-10/NW11-live-rollout-and-recovery.md), not a new approval rule. Providing SQL for manual execution does not close them. No hosted SQL application, frontend/gateway deployment or private export occurred.

Target: **ixnfphgjyelhckjwjkdv only**. Frozen candidate: **591302e923d9e1286f7379979406d254391dc814a9063c5fb6ff22f341b11976**. Main/HEAD **fbc88d76a933b33a2c50d13d2430f27ad6fd72dc**; existing dirty tree preserved. This package supersedes the historical nine-old-timestamp pending selection. Both finance fixes are already installed; neither is included for reapplication. The flawed 20261007154917 financial migration is excluded.

1. [01-read-only-preflight.sql](01-read-only-preflight.sql) is safe read-only metadata inspection. Run the whole file as postgres in the intended project's SQL Editor. It checks cluster identity and exact current catalogs/history/grants/RLS/Storage configuration. It reads no application/Auth records or object bytes. A pass means baseline match, not rollout approval.
2. [02-apply-20261015230935.sql](02-apply-20261015230935.sql) is the requested **single complete migration installation file for later approved manual execution**. First close the checklist gates. Verify its SHA-256 below, use the intended project/role, then run the entire unchanged file once in one execution. Never run only a selection. It combines the nine accepted bodies into one atomic transaction and records one NEW migration-history entry in that same transaction. It does not edit any existing history row or register nine historical timestamps as though separately applied.
3. [03-read-only-installation-check.sql](03-read-only-installation-check.sql) inspects ledger checksum and all expected postconditions after execution, including an ambiguous/lost response. Version absent, SQL error, drift or mismatched postconditions requires investigation before any retry. This check is safe now, but absence of the new version is expected until approved execution.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| [01-read-only-preflight.sql](01-read-only-preflight.sql) | 5,678 | d5fe31bb3fb79b336bbc280ecf37800ddd275f3c818e455c8b82d8edc79920a8 |
| [02-apply-20261015230935.sql](02-apply-20261015230935.sql) | 458,283 | bb6610a074aac0c2af9aa9f478792495257c87e4596fa2870f8326738ccb406a |
| [03-read-only-installation-check.sql](03-read-only-installation-check.sql) | 94,240 | 13c921115ba5aeeddb52c280a9bff2c7fd22c1e355357a0161aea0310c1682d3 |

The actual native CLI generated **20261015230935_nested_work_verified_corrections.sql** using migration new. The reviewed isolated workspace contains the **29 exact installed version/name/statement-array source equivalents**, then this **one pending integration migration**. Workspace body SHA-256: **595cbbd2cb92335d004c323d18926a89c793e4baceb932e637e5ad5b0b1e67cf**. Its 67 ledger statements, joined with newline, hash to **f81d71f9326d4c5b3a7db9feeb48d0ec7cefe1c6d129957b20af27bf5c6852c7**. The install-file checksum differs because that file also contains outer transaction, history INSERT, comments and outcome SELECT. There is no circular/self-hash claim.

Native CLI **2.116.0** dry run, with **--skip-vault --dry-run**, selected exactly this one pending file, no roles/seeds, no include-all. Hosted read-only preflight passed before and after; history remains 29 entries. [Dry-run receipt](../../../../.refinement/nw11-current-20261016/sql-editor-hosted-readonly-and-dry-run.json), [sanitized native log](../../../../.refinement/nw11-current-20261016/sql-editor-native-dry-run-attempt1.log). The dry run does not execute the migration or prove real hosted behavior. The manifest's local-only preflight-pending marker reflects its earlier packaging time; this separate later receipt closes that inspection step, not the recovery gates.

## Exact source order

All nine source byte hashes match the frozen candidate. Only paired outer BEGIN/COMMIT statements are removed to provide one surrounding transaction; the reviewed SQL statements are retained. This includes the corrected raw-line-ending NW2.2 source.

| Order | Accepted source | SHA-256 |
| --- | --- | --- |
| 1 | 20261010103936_nested_work_capabilities_and_execution.sql | 6df279188ff3cb4306b19d0aba17cfbdc96daaa6f0bb4c9ae2eec6da0455dc9c |
| 2 | 20261010105440_nested_work_own_lead_execution.sql | 7f36fea512aa28ce00e322e21ef4d226095dff87d3d074172b802300eb2fe3c9 |
| 3 | 20261010144145_nested_work_office_review_routing.sql | 9993a5ed5ecca0acdf756eee2bb5b32b2619b678711229af792dfdf532dc38fc |
| 4 | 20261010161650_nested_work_approval_consistency.sql | 58fceb9b3d629ecbd35533ebe9ca30c9e0ccd7e2d07909ad3ad06806b01c6a02 |
| 5 | 20261010164510_nested_work_operation_safety.sql | 82d72c71808ca6111979016ffc067aa74378d8535a87c3bcc3425045d99d3fe0 |
| 6 | 20261010172348_nested_work_r9_staffing_removal.sql | efe8559aa96c36a6b057e05ee4487b7711ddc46a0cc4a7796c3c8e07080815ec |
| 7 | 20261010175812_nested_work_checked_confirmation.sql | 43b0c624ae81fda5b59398f00ce1a4b0f96f61ff934a8c8be261ccd3e4c31708 |
| 8 | 20261011071015_nested_work_material_date_preview.sql | 6200c5ecff31e2032be121fe2f4ac7c6f76564c4e4b6d4b3a30d7a39c26f7f5d |
| 9 | 20261012231500_nested_work_activity_projection.sql | c9bac7d726bf10b33fa35b0f3b8fb2e451635cb19971234dab91ca679b3a55eb |

Installed financial prerequisites, preserved: 20261015125031 source e786df31a639771f86d81e180fa269fa9ea30f0c8e5455e2c9d561a7c3415e4e; 20261015142837 source fde5e5db2f88b489f37e09f1e89eb9f3446d1659e053110e53b182610ab7b467. Actual installed statement hashes are separately recorded in [manifest.json](manifest.json); source-file and installed-statement byte hashes are different provenance concepts.

## Scope, checks and recovery

The correction installs 2 private coordination tables, 73 changed/new function contracts, 16 column contracts, 21 constraints and 36 trigger contracts, plus the exact invoker-security Activity view definition. These are **148 catalog postconditions plus the view definition**, not counts of changed application records. Existing immutable histories, Office budgets/cash/journal/liquidation/evidence records are not backfilled or rewritten by this installation. Existing financial writer functions receive the already-reviewed NW shared locking preambles; their accepted financial authority, validation, audit and retry logic remains. The complete observed catalog outside the exact reviewed changes and the complementary role/schema/default-grant/seven-bucket contracts must remain unchanged inside the transaction.

Seven meaningful local checks pass: original nine-file sequence versus atomic payload result; late failure full rollback; altered authority function configuration rollback; exact old 29-row history preservation/one new row; duplicate rejection; wrong-cluster rejection; history-drift rejection. Local models overlay all **490 actual installed function definitions and EXECUTE contracts** but contain synthetic data. Their target/catalog pins are explicitly local. Production-file pins are never relaxed. [Local receipt](../../../../.refinement/nw11-current-20261016/sql-editor-local-verification.json). The first failed test used a stale disposable cluster ID and is preserved; the corrected test does not weaken production checks. Intermediate successful package attempts were archived before efficiency/testing improvements, not silently overwritten.

Before commit, any SQL error aborts the transaction, including the new history insertion; inspect actual outcome after transport uncertainty. After a confirmed commit, prefer a reviewed additive forward fix. Never delete ledger entries, reinstall broad legacy permission functions, flatten hierarchy/history or undo ended/revoked R9 access. A destructive restore requires separate explicit approval, fresh rehearsed recovery artifacts and a real impact/reconciliation decision. This package supplies no destructive recovery SQL.

The package is preparation tooling outside the frozen candidate. No successful NW10 suite was repeated because no candidate input changed. Synthetic PGlite, catalog hashes and CLI dry run do not prove real signed JWTs, hosted RLS/direct-table denial, multi-session races or Storage bytes/signed access. Use the [current readiness checklist](../../nw11-1-readiness-checklist-2026-10-16.md) before deciding to execute.
