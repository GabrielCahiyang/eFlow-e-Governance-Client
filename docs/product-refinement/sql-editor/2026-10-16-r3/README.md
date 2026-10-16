# SQL Editor package revision 3 — PostgreSQL 17 reference


**INSTALLED — do not rerun the apply file.** User application and independent hosted read-only verification succeeded: version20261015230935, 30 entries, 67 exact statements, all150 checks/view passed. [Current installation receipt](../../nw11-database-installation-receipt-2026-10-16.md). Remaining preparation instructions below are historical.

**Use these files instead of revisions 1 and 2.** Both earlier user-run attempts rolled back; actual read-only inspection confirms the unchanged **29-version** baseline, no integration version 20261015230935 and no new coordination objects. No cleanup, financial reinstallation or migration-history repair is needed. [Repair receipt](../../nw11-constraint-repair-receipt-2026-10-16.md).

The user's explicit direct-manual-main decision persists; backup/restore/runtime/security verification remains unverified, not passed. The agent has not applied SQL or deployed anything. Target is **ixnfphgjyelhckjwjkdv only**, PostgreSQL **17.6**. Frozen NW10 candidate is **591302e923d9e1286f7379979406d254391dc814a9063c5fb6ff22f341b11976**.

1. Replace all previous SQL Editor contents with the entire [revision-3 apply file](02-apply-20261015230935.sql). Run once as postgres in the intended project. Do not append to old SQL or select only part.
2. Run the entire [revision-3 read-only installation check](03-read-only-installation-check.sql). Do not use either older checker; its package checksum differs.
3. Send the result or exact error. Expected status **NW11_DATABASE_VERIFIED_RUNTIME_ACCEPTANCE_PENDING**, version **20261015230935**, name nested_work_verified_corrections, **30** installed versions if nothing else intervenes, **67** statements and SHA-256 **67fc3c7190d1c4bfdf8fe45f5f9f3c4880655e5adec2195c78d9eab57dbfecb7**. If any error or ambiguous response occurs, inspect actual state before retrying.

[01-read-only-preflight.sql](01-read-only-preflight.sql) checks the same exact cluster/catalog/history/recovery pins plus an explicit PostgreSQL-17 major requirement. The new version is the same original native-CLI-generated **uninstalled** pending version; no installed timestamp is changed. Exact 29 installed statement equivalents + one new pending integration are in the isolated workspace. Both finance fixes remain installed and are excluded. The nine NW source byte hashes and executable payload remain unchanged, payload SHA **0c5254e1f70bbc42f4cfc838b4081bb746a9a7cc12168208149a6cd426063e05**.

| File | SHA-256 |
| --- | --- |
| [01-read-only-preflight.sql](01-read-only-preflight.sql) | dc0c987e36c13c73771f0c98229db22b8425aa13fe540bec26cf20d8788a2697 |
| [02-apply-20261015230935.sql](02-apply-20261015230935.sql) | ef0ba36a9d57f4beaf249cb919572b347657f9206cfb45bb113a8b448cd4817f |
| [03-read-only-installation-check.sql](03-read-only-installation-check.sql) | 6de980d0c88bd64e3ed320f7970b004f5e01c198f7833b77b33dca3fabb64b3c |

## Constraint correction and full verification

The previous local model used PostgreSQL **18.3**, while main is **17.6**. PostgreSQL 18 introduced named column NOT NULL catalog entries; PG17 uses column metadata for these rules. [Official release notes](https://www.postgresql.org/docs/18/release-18.html), [PG17 pg_attribute](https://www.postgresql.org/docs/17/catalog-pg-attribute.html). The previous verifier incorrectly expected 14 PG18-only named rows. This package now derives expectations with isolated **PostgreSQL 17.5 / PGlite 0.4.6**, matching the hosted major. It explicitly rejects another hosted major. This is synthetic disposable analysis, not a native or private backup restore.

The repair retains all **134 shared expected hashes** from revision 2: 73 functions, 2 tables, 16 information-schema columns, 7 ordinary/constraint-trigger entries and 36 triggers. It replaces the 14 invalid named-row expectations with **16 direct column-attribute contracts**, including all **14 NOT NULL rules**, precise types, defaults, identity/generated flags and collation names. Total: **150** catalog postconditions plus unchanged exact Activity-view definition. Unchanged-catalog protection now also includes direct column attributes for existing public/eflow tables; function/EXECUTE/RLS/history/financial/evidence protection is retained. The revision-2 paired CRLF canonicalization and canonical ledger storage remain intact.

Verification: **20/20** PG17 package integration cases; **4/4** exact delivered-file LF/CRLF/missing-version cases; parser **5/5**, operational guards **20/20**. Tests demonstrate actual SQLSTATE **23502** on NULL approval_xid and NULL staffing-removal fingerprint, independent direct-column NOT NULL detection, rejection of dropped NOT NULL/PK/deferred-trigger rules, all retained function-body/grant/search-path/financial-RLS/history/target/duplicate/late-failure guards, and complete transactional rollback. Both exact delivered file formats pass all postconditions and preserve all 29 historical rows plus a canonical new ledger entry.

The old R2 file independently reproduces the exact user's constraint error on PG17 and passes on PG18. All 490 actual baseline function contracts compare exactly in both local models after existing declared CRLF/ACL ordering rules; all other R2 contract hashes match. [Major comparison](../../../../.refinement/nw11-constraint-20261016/pg17-pg18-contract-comparison.json), [local cases](../../../../.refinement/nw11-constraint-20261016/sql-editor-local-verification.json), [exact delivered-file proof](../../../../.refinement/nw11-constraint-20261016/r3-delivered-files-verification.json).

Native CLI 2.116.0 **--skip-vault --dry-run** selects exactly one reviewed pending file, no roles/seeds/include-all. Actual read-only preflight passes before/after, main remains **29**. [Dry run](../../../../.refinement/nw11-constraint-20261016/sql-editor-hosted-readonly-and-dry-run.json), [manifest](manifest.json). Original failed files/logs remain unchanged. No production record, grant, account, migration history or frontend/gateway was changed by the agent. NW10 frozen inputs remain unchanged; passing local release suites were not restarted. Real hosted sessions/JWT/RLS/Storage, runtime identity and recoverability remain separate requirements.
